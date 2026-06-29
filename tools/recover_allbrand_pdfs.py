#!/usr/bin/env python3
"""Recover PDF files linked from AllBrand's directory, including Wayback snapshots."""

from __future__ import annotations

import csv
import hashlib
import json
import os
import re
import shutil
import threading
import time
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urljoin, urlsplit, urlunsplit

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

PAGE_URL = "https://www.allbrandwindowdoorparts.com/content/pdfs"
OUT_ROOT = Path("pdf_scrape_output")
FILES_DIR = OUT_ROOT / "pdfs"
TMP_DIR = OUT_ROOT / "_tmp"
MAX_WORKERS = int(os.environ.get("PDF_SCRAPE_WORKERS", "5"))
MAX_FILE_BYTES = int(os.environ.get("PDF_MAX_FILE_BYTES", str(750 * 1024 * 1024)))
LINK_LIMIT = int(os.environ.get("PDF_LINK_LIMIT", "0"))
_tls = threading.local()


def session() -> requests.Session:
    s = getattr(_tls, "session", None)
    if s is None:
        s = requests.Session()
        retry = Retry(
            total=2,
            connect=2,
            read=2,
            status=2,
            backoff_factor=1.25,
            status_forcelist=(408, 425, 429, 500, 502, 503, 504),
            allowed_methods=frozenset({"GET", "HEAD"}),
            raise_on_status=False,
        )
        adapter = HTTPAdapter(max_retries=retry, pool_connections=MAX_WORKERS * 3, pool_maxsize=MAX_WORKERS * 3)
        s.mount("https://", adapter)
        s.mount("http://", adapter)
        s.headers.update(
            {
                "User-Agent": "Mozilla/5.0 (compatible; AWDP-PDF-Recovery/1.0; +https://github.com/alykay1522/AWDP1)",
                "Accept": "application/pdf,application/json,text/html;q=0.8,*/*;q=0.5",
            }
        )
        _tls.session = s
    return s


def normalize_url(url: str) -> str:
    parts = urlsplit(url.strip())
    scheme = (parts.scheme or "https").lower()
    netloc = parts.netloc.lower()
    path = re.sub(r"/{2,}", "/", parts.path)
    return urlunsplit((scheme, netloc, path, parts.query, ""))


def candidate_urls(url: str) -> list[str]:
    p = urlsplit(url)
    host = p.netloc.lower()
    hosts = [host]
    if host.startswith("www."):
        hosts.append(host[4:])
    else:
        hosts.append("www." + host)
    schemes = [p.scheme or "http", "https" if (p.scheme or "http") == "http" else "http"]
    values: list[str] = []
    for h in hosts:
        for scheme in schemes:
            candidate = urlunsplit((scheme, h, p.path, p.query, ""))
            if candidate not in values:
                values.append(candidate)
    return values


def safe_filename(index: int, url: str, link_text: str) -> str:
    raw = unquote(Path(urlsplit(url).path).name)
    if not raw or raw.lower() == ".pdf":
        raw = link_text or f"document_{index}.pdf"
    if not raw.lower().endswith(".pdf"):
        raw += ".pdf"
    stem, suffix = os.path.splitext(raw)
    stem = re.sub(r"[\\/:*?\"<>|\x00-\x1f]+", "_", stem)
    stem = re.sub(r"\s+", " ", stem).strip(" ._") or f"document_{index}"
    stem = stem[:150].rstrip(" ._")
    return f"{index:04d}_{stem}{suffix.lower()}"


def fetch_source_page() -> tuple[str, list[dict[str, Any]]]:
    r = session().get(PAGE_URL, timeout=(20, 120))
    r.raise_for_status()
    html = r.text
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    (OUT_ROOT / "source_page.html").write_text(html, encoding="utf-8")
    soup = BeautifulSoup(html, "html.parser")
    found: "OrderedDict[str, dict[str, Any]]" = OrderedDict()
    for anchor in soup.find_all("a", href=True):
        href = urljoin(r.url, anchor.get("href", "").strip())
        text = " ".join(anchor.get_text(" ", strip=True).split())
        if not unquote(urlsplit(href).path).lower().endswith(".pdf"):
            continue
        normalized = normalize_url(href)
        found.setdefault(normalized, {"source_url": normalized, "link_texts": []})
        if text and text not in found[normalized]["link_texts"]:
            found[normalized]["link_texts"].append(text)
    links = list(found.values())
    if LINK_LIMIT > 0:
        links = links[:LINK_LIMIT]
    for i, item in enumerate(links, 1):
        item["sequence"] = i
        item["link_text"] = " | ".join(item.pop("link_texts"))
    return r.url, links


def download_pdf(url: str, tmp_path: Path) -> tuple[bool, dict[str, Any]]:
    info: dict[str, Any] = {"http_status": "", "content_type": "", "final_url": "", "bytes": 0, "error": ""}
    try:
        with session().get(url, stream=True, allow_redirects=True, timeout=(25, 180)) as r:
            info["http_status"] = r.status_code
            info["content_type"] = r.headers.get("Content-Type", "")
            info["final_url"] = r.url
            if r.status_code >= 400:
                info["error"] = f"HTTP {r.status_code}"
                return False, info
            declared = r.headers.get("Content-Length")
            if declared and declared.isdigit() and int(declared) > MAX_FILE_BYTES:
                info["error"] = f"declared size exceeds limit ({declared} bytes)"
                return False, info
            total = 0
            first = bytearray()
            with tmp_path.open("wb") as fh:
                for chunk in r.iter_content(chunk_size=1024 * 1024):
                    if not chunk:
                        continue
                    total += len(chunk)
                    if total > MAX_FILE_BYTES:
                        raise ValueError(f"file exceeds {MAX_FILE_BYTES} byte safety limit")
                    if len(first) < 8192:
                        first.extend(chunk[: 8192 - len(first)])
                    fh.write(chunk)
            info["bytes"] = total
            if b"%PDF-" not in bytes(first):
                tmp_path.unlink(missing_ok=True)
                info["error"] = f"not a PDF; content-type={info['content_type']!r}"
                return False, info
            return True, info
    except Exception as exc:  # noqa: BLE001
        tmp_path.unlink(missing_ok=True)
        info["error"] = f"{type(exc).__name__}: {exc}"
        return False, info


def cdx_snapshots(original_url: str) -> tuple[list[dict[str, str]], str]:
    endpoint = "https://web.archive.org/cdx/search/cdx"
    params = {
        "url": original_url,
        "output": "json",
        "fl": "timestamp,original,statuscode,mimetype,digest,length",
        "filter": ["statuscode:200", "mimetype:application/pdf"],
        "collapse": "digest",
        "limit": "-10",
    }
    try:
        r = session().get(endpoint, params=params, timeout=(20, 90))
        if r.status_code != 200:
            return [], f"CDX HTTP {r.status_code}"
        data = r.json()
        if not isinstance(data, list) or len(data) < 2:
            return [], "CDX no PDF snapshots"
        header = data[0]
        rows = [dict(zip(header, row)) for row in data[1:] if len(row) == len(header)]
        rows.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        return rows, ""
    except Exception as exc:  # noqa: BLE001
        return [], f"CDX {type(exc).__name__}: {exc}"


def availability_snapshot(original_url: str) -> tuple[list[dict[str, str]], str]:
    endpoint = "https://archive.org/wayback/available"
    try:
        r = session().get(endpoint, params={"url": original_url, "timestamp": "20261231"}, timeout=(20, 90))
        if r.status_code != 200:
            return [], f"availability HTTP {r.status_code}"
        closest = r.json().get("archived_snapshots", {}).get("closest", {})
        if not closest or not closest.get("available"):
            return [], "availability no snapshot"
        replay_url = closest.get("url", "")
        match = re.search(r"/web/(\d{6,14})(?:[a-z_]+)?/(.+)$", replay_url)
        timestamp = closest.get("timestamp", "")
        archived_original = original_url
        if match:
            timestamp = timestamp or match.group(1)
            archived_original = match.group(2)
        return [{"timestamp": timestamp, "original": archived_original, "statuscode": str(closest.get("status", "")), "mimetype": ""}], ""
    except Exception as exc:  # noqa: BLE001
        return [], f"availability {type(exc).__name__}: {exc}"


def archive_download_urls(snapshot: dict[str, str]) -> list[str]:
    ts = snapshot.get("timestamp", "")
    original = snapshot.get("original", "")
    if not ts or not original:
        return []
    return [
        f"https://web.archive.org/web/{ts}id_/{original}",
        f"https://web.archive.org/web/{ts}if_/{original}",
        f"https://web.archive.org/web/{ts}/{original}",
    ]


def recover_one(item: dict[str, Any]) -> dict[str, Any]:
    index = item["sequence"]
    source_url = item["source_url"]
    result: dict[str, Any] = {
        **item,
        "retrieval_source": "",
        "archive_timestamp": "",
        "attempted_url": "",
        "final_url": "",
        "http_status": "",
        "content_type": "",
        "status": "failed",
        "stored_file": "",
        "bytes": 0,
        "sha256": "",
        "error": "",
        "_tmp_path": "",
    }
    errors: list[str] = []
    tmp_path = TMP_DIR / f"{index:04d}.part"

    # A live file wins when a link has come back online.
    for candidate in candidate_urls(source_url):
        result["attempted_url"] = candidate
        ok, info = download_pdf(candidate, tmp_path)
        result.update({k: info[k] for k in ("http_status", "content_type", "final_url", "bytes")})
        if ok:
            result["status"] = "downloaded"
            result["retrieval_source"] = "live"
            result["_tmp_path"] = str(tmp_path)
            return result
        errors.append(f"live {candidate}: {info['error']}")

    # Recover the most recent valid archived PDF, trying URL host/scheme variants.
    for original in candidate_urls(source_url):
        snapshots, lookup_error = cdx_snapshots(original)
        if lookup_error:
            errors.append(f"{original}: {lookup_error}")
        if not snapshots:
            snapshots, lookup_error = availability_snapshot(original)
            if lookup_error:
                errors.append(f"{original}: {lookup_error}")
        for snapshot in snapshots:
            for archived_url in archive_download_urls(snapshot):
                result["attempted_url"] = archived_url
                ok, info = download_pdf(archived_url, tmp_path)
                result.update({k: info[k] for k in ("http_status", "content_type", "final_url", "bytes")})
                if ok:
                    result["status"] = "downloaded"
                    result["retrieval_source"] = "wayback"
                    result["archive_timestamp"] = snapshot.get("timestamp", "")
                    result["_tmp_path"] = str(tmp_path)
                    result["error"] = ""
                    return result
                errors.append(f"archive {archived_url}: {info['error']}")
            time.sleep(0.15)

    result["error"] = " || ".join(errors)[-12000:]
    return result


def finalize_downloads(results: list[dict[str, Any]]) -> None:
    hashes: dict[str, str] = {}
    for row in sorted(results, key=lambda x: x["sequence"]):
        tmp = row.pop("_tmp_path", "")
        if row["status"] != "downloaded" or not tmp:
            continue
        tmp_path = Path(tmp)
        digest = hashlib.sha256()
        with tmp_path.open("rb") as fh:
            for chunk in iter(lambda: fh.read(1024 * 1024), b""):
                digest.update(chunk)
        sha = digest.hexdigest()
        row["sha256"] = sha
        if sha in hashes:
            row["status"] = "duplicate_content"
            row["stored_file"] = hashes[sha]
            tmp_path.unlink(missing_ok=True)
            continue
        filename = safe_filename(row["sequence"], row["source_url"], row["link_text"])
        destination = FILES_DIR / filename
        shutil.move(str(tmp_path), destination)
        row["stored_file"] = destination.relative_to(OUT_ROOT).as_posix()
        hashes[sha] = row["stored_file"]


def write_reports(page_final_url: str, rows: list[dict[str, Any]], elapsed: float) -> None:
    fields = [
        "sequence", "link_text", "source_url", "retrieval_source", "archive_timestamp",
        "attempted_url", "final_url", "http_status", "content_type", "status",
        "stored_file", "bytes", "sha256", "error",
    ]
    with (OUT_ROOT / "pdf_index.csv").open("w", newline="", encoding="utf-8-sig") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(sorted(rows, key=lambda x: x["sequence"]))
    payload = {
        "source_page": PAGE_URL,
        "source_page_final_url": page_final_url,
        "generated_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "elapsed_seconds": round(elapsed, 2),
        "links": sorted(rows, key=lambda x: x["sequence"]),
    }
    (OUT_ROOT / "pdf_index.json").write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    total = len(rows)
    unique = sum(r["status"] == "downloaded" for r in rows)
    duplicates = sum(r["status"] == "duplicate_content" for r in rows)
    failed = sum(r["status"] == "failed" for r in rows)
    live = sum(r["status"] in {"downloaded", "duplicate_content"} and r["retrieval_source"] == "live" for r in rows)
    wayback = sum(r["status"] in {"downloaded", "duplicate_content"} and r["retrieval_source"] == "wayback" for r in rows)
    unique_bytes = sum(int(r["bytes"] or 0) for r in rows if r["status"] == "downloaded")
    summary = (
        "AllBrand Window & Door Parts PDF recovery\n"
        "===========================================\n"
        f"Source: {PAGE_URL}\n"
        f"Unique PDF URLs found: {total}\n"
        f"Unique PDF files saved: {unique}\n"
        f"Duplicate PDF contents: {duplicates}\n"
        f"Recovered from live URLs: {live}\n"
        f"Recovered from Wayback snapshots: {wayback}\n"
        f"Unrecoverable links: {failed}\n"
        f"Unique bytes saved: {unique_bytes}\n"
        f"Elapsed seconds: {elapsed:.2f}\n\n"
        "The live directory links were tested first. Dead links were searched in the Internet Archive.\n"
        "See pdf_index.csv or pdf_index.json for each URL, archive timestamp, checksum, and error.\n"
    )
    (OUT_ROOT / "README.txt").write_text(summary, encoding="utf-8")
    print(summary, flush=True)


def main() -> None:
    started = time.monotonic()
    if OUT_ROOT.exists():
        shutil.rmtree(OUT_ROOT)
    FILES_DIR.mkdir(parents=True)
    TMP_DIR.mkdir(parents=True)
    page_final_url, links = fetch_source_page()
    print(f"Found {len(links)} unique PDF URLs", flush=True)
    results: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(recover_one, item): item for item in links}
        for completed, future in enumerate(as_completed(futures), 1):
            row = future.result()
            results.append(row)
            print(
                f"[{completed}/{len(links)}] {row['status']} via {row['retrieval_source'] or 'none'}: "
                f"{row['source_url']} ({row['bytes']} bytes)",
                flush=True,
            )
    finalize_downloads(results)
    shutil.rmtree(TMP_DIR, ignore_errors=True)
    elapsed = time.monotonic() - started
    write_reports(page_final_url, results, elapsed)
    archive_path = shutil.make_archive("allbrandwindowdoorparts_pdfs", "zip", root_dir=OUT_ROOT)
    print(f"Created {archive_path} ({Path(archive_path).stat().st_size} bytes)", flush=True)


if __name__ == "__main__":
    main()
