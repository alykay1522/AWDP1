#!/usr/bin/env python3
"""Recover the AllBrand PDF collection using bulk Wayback CDX indexes."""

from __future__ import annotations

import json
import shutil
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import unquote, urlsplit, urlunsplit

import recover_allbrand_pdfs as base


def resource_key(url: str) -> tuple[str, str]:
    parts = urlsplit(url)
    host = parts.netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    path = unquote(parts.path).lower()
    return host, path


def parent_prefix(url: str) -> str:
    parts = urlsplit(url)
    parent = parts.path.rsplit("/", 1)[0] + "/"
    return urlunsplit((parts.scheme or "http", parts.netloc, parent, "", ""))


def fetch_bulk_cdx(prefix: str) -> tuple[list[dict[str, str]], dict[str, object]]:
    endpoint = "https://web.archive.org/cdx/search/cdx"
    params = {
        "url": prefix,
        "matchType": "prefix",
        "output": "json",
        "fl": "timestamp,original,statuscode,mimetype,digest,length",
        "filter": ["statuscode:200", "mimetype:application/pdf"],
        "collapse": "digest",
        "limit": "50000",
    }
    report: dict[str, object] = {"prefix": prefix, "status": "failed", "rows": 0, "error": ""}
    try:
        response = base.session().get(endpoint, params=params, timeout=(25, 240))
        report["http_status"] = response.status_code
        report["request_url"] = response.url
        if response.status_code != 200:
            report["error"] = f"HTTP {response.status_code}: {response.text[:300]}"
            return [], report
        data = response.json()
        if not isinstance(data, list) or not data:
            report["status"] = "empty"
            return [], report
        header = data[0]
        rows = [dict(zip(header, values)) for values in data[1:] if len(values) == len(header)]
        rows = [row for row in rows if unquote(urlsplit(row.get("original", "")).path).lower().endswith(".pdf")]
        report["status"] = "ok"
        report["rows"] = len(rows)
        return rows, report
    except Exception as exc:  # noqa: BLE001
        report["error"] = f"{type(exc).__name__}: {exc}"
        return [], report


def recover_snapshot(item: dict[str, object], snapshots: list[dict[str, str]]) -> dict[str, object]:
    index = int(item["sequence"])
    tmp_path = base.TMP_DIR / f"{index:04d}.part"
    result: dict[str, object] = {
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
    if not snapshots:
        result["error"] = "No matching PDF capture returned by the bulk Wayback CDX index"
        return result

    # Prefer the newest captures and try several unique archived versions.
    snapshots = sorted(snapshots, key=lambda row: row.get("timestamp", ""), reverse=True)[:8]
    for snapshot in snapshots:
        for archived_url in base.archive_download_urls(snapshot):
            result["attempted_url"] = archived_url
            ok, info = base.download_pdf(archived_url, tmp_path)
            for key in ("http_status", "content_type", "final_url", "bytes"):
                result[key] = info[key]
            if ok:
                result["status"] = "downloaded"
                result["retrieval_source"] = "wayback_bulk"
                result["archive_timestamp"] = snapshot.get("timestamp", "")
                result["_tmp_path"] = str(tmp_path)
                return result
            errors.append(f"{archived_url}: {info['error']}")
        time.sleep(0.1)
    result["error"] = " || ".join(errors)[-12000:]
    return result


def main() -> None:
    started = time.monotonic()
    if base.OUT_ROOT.exists():
        shutil.rmtree(base.OUT_ROOT)
    base.FILES_DIR.mkdir(parents=True)
    base.TMP_DIR.mkdir(parents=True)
    page_final_url, links = base.fetch_source_page()
    print(f"Found {len(links)} unique PDF URLs", flush=True)

    prefixes: list[str] = []
    for link in links:
        parent = parent_prefix(str(link["source_url"]))
        for candidate in base.candidate_urls(parent):
            if candidate not in prefixes:
                prefixes.append(candidate)

    all_captures: list[dict[str, str]] = []
    reports: list[dict[str, object]] = []
    with ThreadPoolExecutor(max_workers=min(6, len(prefixes))) as executor:
        futures = {executor.submit(fetch_bulk_cdx, prefix): prefix for prefix in prefixes}
        for future in as_completed(futures):
            rows, report = future.result()
            reports.append(report)
            all_captures.extend(rows)
            print(f"CDX {report['status']}: {report['prefix']} ({report['rows']} PDF rows)", flush=True)

    (base.OUT_ROOT / "cdx_query_report.json").write_text(
        json.dumps(sorted(reports, key=lambda row: str(row["prefix"])), indent=2), encoding="utf-8"
    )
    print(f"Bulk CDX returned {len(all_captures)} PDF capture rows", flush=True)

    captures_by_key: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)
    captures_by_basename: dict[str, list[dict[str, str]]] = defaultdict(list)
    for capture in all_captures:
        original = capture.get("original", "")
        key = resource_key(original)
        captures_by_key[key].append(capture)
        basename = Path(key[1]).name
        if basename:
            captures_by_basename[basename].append(capture)

    matched = 0
    item_snapshots: list[tuple[dict[str, object], list[dict[str, str]]]] = []
    for link in links:
        key = resource_key(str(link["source_url"]))
        snapshots = captures_by_key.get(key, [])
        if not snapshots:
            basename_candidates = captures_by_basename.get(Path(key[1]).name, [])
            unique_keys = {resource_key(row.get("original", "")) for row in basename_candidates}
            if len(unique_keys) == 1:
                snapshots = basename_candidates
        if snapshots:
            matched += 1
        item_snapshots.append((link, snapshots))
    print(f"Matched {matched}/{len(links)} directory URLs to archived PDF captures", flush=True)

    results: list[dict[str, object]] = []
    with ThreadPoolExecutor(max_workers=base.MAX_WORKERS) as executor:
        futures = {executor.submit(recover_snapshot, item, snapshots): item for item, snapshots in item_snapshots}
        for completed, future in enumerate(as_completed(futures), 1):
            row = future.result()
            results.append(row)
            print(
                f"[{completed}/{len(links)}] {row['status']}: {row['source_url']} ({row['bytes']} bytes)",
                flush=True,
            )

    base.finalize_downloads(results)
    shutil.rmtree(base.TMP_DIR, ignore_errors=True)
    elapsed = time.monotonic() - started
    base.write_reports(page_final_url, results, elapsed)
    archive_path = shutil.make_archive("allbrandwindowdoorparts_pdfs", "zip", root_dir=base.OUT_ROOT)
    print(f"Created {archive_path} ({Path(archive_path).stat().st_size} bytes)", flush=True)


if __name__ == "__main__":
    main()
