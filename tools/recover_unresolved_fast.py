#!/usr/bin/env python3
"""Bounded recovery pass for unresolved PDFs using all CDX MIME types."""

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

import requests

import recover_allbrand_pdfs as base

TARGETS = {1,2,3,4,5,6,7,8,9,10,31,103,105,107,109,193,200,207,227,233,238,242,251}
OUT = Path("fast_recovery_output")
FILES = OUT / "pdfs"
TMP = OUT / "_tmp"


def lookup(url: str) -> tuple[list[dict[str, str]], str]:
    try:
        r = requests.get(
            "https://web.archive.org/cdx/search/cdx",
            params={
                "url": url,
                "output": "json",
                "fl": "timestamp,original,statuscode,mimetype,digest,length",
                "filter": "statuscode:200",
                "collapse": "digest",
                "limit": "500",
            },
            headers={"User-Agent": "Mozilla/5.0 (compatible; AWDP-PDF-Recovery/1.0)"},
            timeout=(10, 30),
        )
        if r.status_code != 200:
            return [], f"HTTP {r.status_code}"
        data = r.json()
        if not isinstance(data, list) or len(data) < 2:
            return [], "no captures"
        header = data[0]
        return [dict(zip(header, row)) for row in data[1:] if len(row) == len(header)], ""
    except Exception as exc:  # noqa: BLE001
        return [], f"{type(exc).__name__}: {exc}"


def priority(row: dict[str, str]) -> tuple[int, int, str]:
    ts = row.get("timestamp", "")
    try:
        size = int(row.get("length") or 0)
    except ValueError:
        size = 0
    return (1 if ts >= "20220101" else 0, 1 if 0 < size < 5000 else 0, ts)


def recover(item: dict[str, Any]) -> dict[str, Any]:
    sequence = int(item["sequence"])
    result = {**item, "status":"failed", "stored_file":"", "bytes":0, "sha256":"", "archive_timestamp":"", "captures_found":0, "error":""}
    captures: list[dict[str, str]] = []
    errors: list[str] = []
    # Start with the exact linked URL. Only try variants when it has no captures.
    rows, error = lookup(str(item["source_url"]))
    captures.extend(rows)
    if error:
        errors.append(f"exact lookup: {error}")
    if not captures:
        for variant in base.candidate_urls(str(item["source_url"]))[1:]:
            rows, error = lookup(variant)
            captures.extend(rows)
            if error:
                errors.append(f"{variant}: {error}")
            if captures:
                break
    unique: dict[tuple[str,str,str], dict[str,str]] = {}
    for row in captures:
        unique[(row.get("timestamp",""), row.get("original",""), row.get("digest",""))] = row
    captures = sorted(unique.values(), key=priority)
    result["captures_found"] = len(captures)
    tmp = TMP / f"{sequence:04d}.part"
    for row in captures[:30]:
        ts, original = row.get("timestamp",""), row.get("original","")
        if not ts or not original:
            continue
        url = f"https://web.archive.org/web/{ts}id_/{original}"
        ok, info = base.download_pdf(url, tmp)
        if ok:
            dest = FILES / base.safe_filename(sequence, str(item["source_url"]), str(item["link_text"]))
            shutil.move(str(tmp), dest)
            result.update({
                "status":"downloaded",
                "stored_file":dest.relative_to(OUT).as_posix(),
                "bytes":info["bytes"],
                "sha256":hashlib.sha256(dest.read_bytes()).hexdigest(),
                "archive_timestamp":ts,
                "error":"",
            })
            return result
        errors.append(f"{url}: {info['error']}")
    result["error"] = " || ".join(errors)[-12000:]
    return result


def main() -> None:
    started = time.monotonic()
    if OUT.exists(): shutil.rmtree(OUT)
    FILES.mkdir(parents=True); TMP.mkdir(parents=True)
    _, links = base.fetch_source_page()
    items = [x for x in links if int(x["sequence"]) in TARGETS]
    results=[]
    with ThreadPoolExecutor(max_workers=10) as pool:
        futures={pool.submit(recover,item):item for item in items}
        for n,f in enumerate(as_completed(futures),1):
            row=f.result(); results.append(row)
            print(f"[{n}/{len(items)}] {row['status']} seq={row['sequence']} captures={row['captures_found']} bytes={row['bytes']}",flush=True)
    shutil.rmtree(TMP,ignore_errors=True)
    fields=["sequence","link_text","source_url","status","stored_file","bytes","sha256","archive_timestamp","captures_found","error"]
    with (OUT/"fast_recovery_index.csv").open("w",newline="",encoding="utf-8-sig") as fh:
        w=csv.DictWriter(fh,fieldnames=fields,extrasaction="ignore"); w.writeheader(); w.writerows(sorted(results,key=lambda r:int(r["sequence"])))
    (OUT/"fast_recovery_index.json").write_text(json.dumps(sorted(results,key=lambda r:int(r["sequence"])),indent=2),encoding="utf-8")
    summary={"targets":len(results),"recovered":sum(r["status"]=="downloaded" for r in results),"still_unresolved":sum(r["status"]!="downloaded" for r in results),"recovered_bytes":sum(int(r["bytes"] or 0) for r in results if r["status"]=="downloaded"),"elapsed_seconds":round(time.monotonic()-started,2)}
    (OUT/"summary.json").write_text(json.dumps(summary,indent=2),encoding="utf-8")
    with zipfile.ZipFile("allbrandwindowdoorparts_pdfs_fast_supplement.zip","w",zipfile.ZIP_STORED,allowZip64=True) as z:
        for p in sorted(OUT.rglob("*")):
            if p.is_file(): z.write(p,p.relative_to(OUT).as_posix())
    print(json.dumps(summary,indent=2),flush=True)

if __name__=="__main__": main()
