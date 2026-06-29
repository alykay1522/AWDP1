#!/usr/bin/env python3
"""Try every historical CDX capture for the 23 unresolved PDF links."""

from __future__ import annotations

import csv
import hashlib
import json
import shutil
import time
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

import recover_allbrand_pdfs as base

FAILED_SEQUENCES = {
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    31, 103, 105, 107, 109, 193, 200, 207, 227, 233, 238, 242, 251,
}
OUT = Path("historical_recovery_output")
FILES = OUT / "pdfs"
TMP = OUT / "_tmp"


def all_cdx_snapshots(url: str) -> tuple[list[dict[str, str]], str]:
    params = {
        "url": url,
        "output": "json",
        "fl": "timestamp,original,statuscode,mimetype,digest,length",
        "filter": "statuscode:200",
        "collapse": "digest",
        "limit": "1000",
    }
    try:
        response = base.session().get(
            "https://web.archive.org/cdx/search/cdx",
            params=params,
            timeout=(20, 150),
        )
        if response.status_code != 200:
            return [], f"CDX HTTP {response.status_code}: {response.text[:200]}"
        data = response.json()
        if not isinstance(data, list) or len(data) < 2:
            return [], "CDX no captures"
        header = data[0]
        rows = [dict(zip(header, row)) for row in data[1:] if len(row) == len(header)]
        return rows, ""
    except Exception as exc:  # noqa: BLE001
        return [], f"CDX {type(exc).__name__}: {exc}"


def snapshot_priority(row: dict[str, str]) -> tuple[int, int, str]:
    timestamp = row.get("timestamp", "")
    try:
        length = int(row.get("length") or 0)
    except ValueError:
        length = 0
    # Prefer captures before the 2023 Imunify challenge and bodies larger than challenge pages.
    modern_penalty = 1 if timestamp >= "20220101" else 0
    short_penalty = 1 if length and length < 5000 else 0
    return modern_penalty, short_penalty, timestamp


def recover_one(item: dict[str, Any]) -> dict[str, Any]:
    sequence = int(item["sequence"])
    tmp_path = TMP / f"{sequence:04d}.part"
    result: dict[str, Any] = {
        **item,
        "status": "failed",
        "stored_file": "",
        "bytes": 0,
        "sha256": "",
        "archive_timestamp": "",
        "archive_original": "",
        "attempted_url": "",
        "http_status": "",
        "content_type": "",
        "error": "",
        "captures_found": 0,
    }
    errors: list[str] = []
    snapshots: list[dict[str, str]] = []
    seen_capture: set[tuple[str, str, str]] = set()
    for variant in base.candidate_urls(str(item["source_url"])):
        rows, error = all_cdx_snapshots(variant)
        if error:
            errors.append(f"{variant}: {error}")
        for row in rows:
            key = (row.get("timestamp", ""), row.get("original", ""), row.get("digest", ""))
            if key not in seen_capture:
                seen_capture.add(key)
                snapshots.append(row)
    snapshots.sort(key=snapshot_priority)
    result["captures_found"] = len(snapshots)

    # Keep the pass bounded while covering all distinct historical bodies in practice.
    for snapshot in snapshots[:80]:
        timestamp = snapshot.get("timestamp", "")
        original = snapshot.get("original", "")
        if not timestamp or not original:
            continue
        urls = [
            f"https://web.archive.org/web/{timestamp}id_/{original}",
            f"http://web.archive.org/web/{timestamp}id_/{original}",
        ]
        for archived_url in urls:
            result["attempted_url"] = archived_url
            ok, info = base.download_pdf(archived_url, tmp_path)
            result["http_status"] = info["http_status"]
            result["content_type"] = info["content_type"]
            result["bytes"] = info["bytes"]
            if ok:
                digest = hashlib.sha256(tmp_path.read_bytes()).hexdigest()
                filename = base.safe_filename(sequence, str(item["source_url"]), str(item["link_text"]))
                destination = FILES / filename
                shutil.move(str(tmp_path), destination)
                result.update(
                    {
                        "status": "downloaded",
                        "stored_file": destination.relative_to(OUT).as_posix(),
                        "sha256": digest,
                        "archive_timestamp": timestamp,
                        "archive_original": original,
                        "error": "",
                    }
                )
                return result
            errors.append(f"{archived_url}: {info['error']}")
        time.sleep(0.08)

    result["error"] = " || ".join(errors)[-16000:]
    return result


def main() -> None:
    started = time.monotonic()
    if OUT.exists():
        shutil.rmtree(OUT)
    FILES.mkdir(parents=True)
    TMP.mkdir(parents=True)
    _, links = base.fetch_source_page()
    targets = [item for item in links if int(item["sequence"]) in FAILED_SEQUENCES]
    print(f"Deep historical recovery targets: {len(targets)}", flush=True)

    results: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(recover_one, item): item for item in targets}
        for completed, future in enumerate(as_completed(futures), 1):
            row = future.result()
            results.append(row)
            print(
                f"[{completed}/{len(targets)}] {row['status']}: seq {row['sequence']} "
                f"captures={row['captures_found']} bytes={row['bytes']}",
                flush=True,
            )

    shutil.rmtree(TMP, ignore_errors=True)
    fields = [
        "sequence", "link_text", "source_url", "status", "stored_file", "bytes", "sha256",
        "archive_timestamp", "archive_original", "captures_found", "attempted_url",
        "http_status", "content_type", "error",
    ]
    with (OUT / "historical_recovery_index.csv").open("w", newline="", encoding="utf-8-sig") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(sorted(results, key=lambda row: int(row["sequence"])))
    (OUT / "historical_recovery_index.json").write_text(
        json.dumps(sorted(results, key=lambda row: int(row["sequence"])), indent=2), encoding="utf-8"
    )
    recovered = sum(row["status"] == "downloaded" for row in results)
    summary = {
        "targets": len(results),
        "recovered": recovered,
        "still_unresolved": len(results) - recovered,
        "recovered_bytes": sum(int(row["bytes"] or 0) for row in results if row["status"] == "downloaded"),
        "elapsed_seconds": round(time.monotonic() - started, 2),
    }
    (OUT / "historical_recovery_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    (OUT / "README.txt").write_text(
        "Deep historical recovery of unresolved AllBrand PDF links\n"
        f"Targets: {summary['targets']}\nRecovered: {summary['recovered']}\n"
        f"Still unresolved: {summary['still_unresolved']}\nRecovered bytes: {summary['recovered_bytes']}\n",
        encoding="utf-8",
    )
    with zipfile.ZipFile("allbrandwindowdoorparts_pdfs_supplement.zip", "w", zipfile.ZIP_STORED, allowZip64=True) as archive:
        for path in sorted(OUT.rglob("*")):
            if path.is_file():
                archive.write(path, path.relative_to(OUT).as_posix())
    print(json.dumps(summary, indent=2), flush=True)


if __name__ == "__main__":
    main()
