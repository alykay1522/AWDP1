#!/usr/bin/env python3
"""Download and index every PDF linked from the AllBrand PDF directory."""

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
MAX_WORKERS = int(os.environ.get("PDF_SCRAPE_WORKERS", "8"))
MAX_FILE_BYTES = int(os.environ.get("PDF_MAX_FILE_BYTES", str(750 * 1024 * 1024)))

_tls = threading.local()


def session() -> requests.Session:
    s = getattr(_tls, "session", None)
    if s is None:
        s = requests.Session()
        retry = Retry(
            total=3,
            connect=3,
            read=3,
            status=3,
            backoff_factor=1.0,
            status_forcelist=(408, 425, 429, 500, 502, 503, 504),
            allowed_methods=frozenset({"GET", "HEAD"}),
            raise_on_status=False,
        )
        adapter = HTTPAdapter(max_retries=retry, pool_connections=MAX_WORKERS * 2, pool_maxsize=MAX_WORKERS * 2)
        s.mount("https://", adapter)
        s.mount("http://", adapter)
        s.headers.update(
            {
                "User-Agent": "Mozilla/5.0 (compatible; AWDP-PDF-Archive/1.0)",
                "Accept": "application/pdf,text/html;q=0.8,*/*;q=0.5",
                "Referer": PAGE_URL,
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
    hosts = [p.netloc]
    if p.netloc.startswith("www."):
        hosts.append(p.netloc[4:])
    elif p.netloc in {"doorswindowshardware.com", "allbrandwindowdoorparts.com"}:
        hosts.append("www." + p.netloc)

    schemes = [p.scheme or "https"]
    schemes.append("http" if schemes[0] == "https" else "https")

    variants: list[str] = []
    for host in hosts:
        for scheme in schemes:
            item = urlunsplit((scheme, host, p.path, p.query, ""))
            if item not in variants:
                variants.append(item)
    return variants


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
        path = unquote(urlsplit(href).path).lower()
        if not path.endswith(".pdf"):
            continue
        normalized = normalize_url(href)
        if normalized not in found:
            found[normalized] = {"source_url": normalized, "link_texts": []}
        if text and text not in found[normalized]["link_texts"]:
            found[normalized]["link_texts"].append(text)

    links = list(found.values())
    for i, item in enumerate(links, 1):
        item["sequence"] = i
        item["link_text"] = " | ".join(item.pop("link_texts"))
    return r.url, links


def download_one(item: dict[str, Any]) -> dict[str, Any]:
    index = item["sequence"]
    source_url = item["source_url"]
    result: dict[str, Any] = {
        **item,
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
    for candidate in candidate_urls(source_url):
        result["attempted_url"] = candidate
        tmp_path = TMP_DIR / f"{index:04d}.part"
        try:
            with session().get(candidate, stream=True, allow_redirects=True, timeout=(20, 120)) as r:
                result["http_status"] = r.status_code
                result["final_url"] = r.url
                result["content_type"] = r.headers.get("Content-Type", "")
                if r.status_code >= 400:
                    errors.append(f"{candidate}: HTTP {r.status_code}")
                    continue
                declared = r.headers.get("Content-Length")
                if declared and declared.isdigit() and int(declared) > MAX_FILE_BYTES:
                    errors.append(f"{candidate}: declared size exceeds limit ({declared} bytes)")
                    continue

                total = 0
                first = bytearray()
                with tmp_path.open("wb") as fh:
                    for chunk in r.iter_content(chunk_size=1024 * 1024):
                        if not chunk:
                            continue
                        total += len(chunk)
                        if total > MAX_FILE_BYTES:
                            raise ValueError(f"file exceeds {MAX_FILE_BYTES} byte safety limit")
                        if len(first) < 4096:
                            first.extend(chunk[: 4096 - len(first)])
                        fh.write(chunk)

                if b"%PDF-" not in bytes(first):
                    tmp_path.unlink(missing_ok=True)
                    errors.append(
                        f"{candidate}: response is not a PDF (content-type {result['content_type']!r})"
                    )
                    continue
                if total == 0:
                    tmp_path.unlink(missing_ok=True)
                    errors.append(f"{candidate}: empty response")
                    continue

                result["status"] = "downloaded"
                result["bytes"] = total
                result["_tmp_path"] = str(tmp_path)
                result["error"] = ""
                return result
        except Exception as exc:  # noqa: BLE001 - each URL must be recorded, not abort the batch
            tmp_path.unlink(missing_ok=True)
            errors.append(f"{candidate}: {type(exc).__name__}: {exc}")

    result["error"] = " || ".join(errors)[-4000:]
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

        filename = safe_filename(row["sequence"], row["final_url"] or row["source_url"], row["link_text"])
        destination = FILES_DIR / filename
        shutil.move(str(tmp_path), destination)
        relative = destination.relative_to(OUT_ROOT).as_posix()
        row["stored_file"] = relative
        hashes[sha] = relative


def write_reports(page_final_url: str, rows: list[dict[str, Any]], elapsed: float) -> None:
    fields = [
        "sequence",
        "link_text",
        "source_url",
        "attempted_url",
        "final_url",
        "http_status",
        "content_type",
        "status",
        "stored_file",
        "bytes",
        "sha256",
        "error",
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
    downloaded = sum(r["status"] == "downloaded" for r in rows)
    duplicates = sum(r["status"] == "duplicate_content" for r in rows)
    failed = sum(r["status"] == "failed" for r in rows)
    unique_bytes = sum(int(r["bytes"] or 0) for r in rows if r["status"] == "downloaded")
    summary = (
        "AllBrand Window & Door Parts PDF scrape\n"
        "=========================================\n"
        f"Source: {PAGE_URL}\n"
        f"Unique PDF URLs found: {total}\n"
        f"Unique PDFs saved: {downloaded}\n"
        f"Duplicate PDF contents: {duplicates}\n"
        f"Failed or non-PDF links: {failed}\n"
        f"Unique bytes saved: {unique_bytes}\n"
        f"Elapsed seconds: {elapsed:.2f}\n\n"
        "See pdf_index.csv or pdf_index.json for every URL, redirect, HTTP status, checksum, and error.\n"
    )
    (OUT_ROOT / "README.txt").write_text(summary, encoding="utf-8")
    print(summary)


def main() -> None:
    started = time.monotonic()
    if OUT_ROOT.exists():
        shutil.rmtree(OUT_ROOT)
    FILES_DIR.mkdir(parents=True)
    TMP_DIR.mkdir(parents=True)

    page_final_url, links = fetch_source_page()
    print(f"Found {len(links)} unique PDF URLs")

    results: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(download_one, item): item for item in links}
        for completed, future in enumerate(as_completed(futures), 1):
            row = future.result()
            results.append(row)
            print(
                f"[{completed}/{len(links)}] {row['status']}: "
                f"{row['source_url']} ({row['bytes']} bytes)",
                flush=True,
            )

    finalize_downloads(results)
    shutil.rmtree(TMP_DIR, ignore_errors=True)
    elapsed = time.monotonic() - started
    write_reports(page_final_url, results, elapsed)

    archive_base = Path("allbrandwindowdoorparts_pdfs")
    archive_path = shutil.make_archive(str(archive_base), "zip", root_dir=OUT_ROOT)
    print(f"Created {archive_path} ({Path(archive_path).stat().st_size} bytes)")


if __name__ == "__main__":
    main()
