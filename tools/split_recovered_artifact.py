#!/usr/bin/env python3
"""Split the recovered PDF collection into four independently extractable ZIP files."""

from __future__ import annotations

import csv
import json
import shutil
import zipfile
from pathlib import Path

SOURCE_ROOT = Path("source_artifact")
WORK_ROOT = Path("split_work")
OUTPUT_ROOT = Path("split_output")
PART_COUNT = 4


def main() -> None:
    if WORK_ROOT.exists():
        shutil.rmtree(WORK_ROOT)
    if OUTPUT_ROOT.exists():
        shutil.rmtree(OUTPUT_ROOT)
    WORK_ROOT.mkdir(parents=True)
    OUTPUT_ROOT.mkdir(parents=True)

    candidates = list(SOURCE_ROOT.rglob("allbrandwindowdoorparts_pdfs.zip"))
    if len(candidates) != 1:
        raise RuntimeError(f"Expected one recovered archive, found {len(candidates)}: {candidates}")
    source_zip = candidates[0]
    print(f"Extracting {source_zip} ({source_zip.stat().st_size} bytes)", flush=True)
    with zipfile.ZipFile(source_zip) as archive:
        bad = archive.testzip()
        if bad:
            raise RuntimeError(f"Source archive failed integrity test at {bad}")
        archive.extractall(WORK_ROOT)

    pdf_dir = WORK_ROOT / "pdfs"
    pdf_files = sorted((p for p in pdf_dir.rglob("*") if p.is_file()), key=lambda p: p.stat().st_size, reverse=True)
    if not pdf_files:
        raise RuntimeError("Recovered archive contains no PDF files")

    bins: list[list[Path]] = [[] for _ in range(PART_COUNT)]
    totals = [0] * PART_COUNT
    for path in pdf_files:
        target = min(range(PART_COUNT), key=lambda index: totals[index])
        bins[target].append(path)
        totals[target] += path.stat().st_size

    manifest_rows: list[dict[str, object]] = []
    for part_index, files in enumerate(bins, 1):
        zip_name = f"allbrandwindowdoorparts_pdfs_part_{part_index}_of_{PART_COUNT}.zip"
        zip_path = OUTPUT_ROOT / zip_name
        readme = (
            f"AllBrand Window & Door Parts recovered PDF collection\n"
            f"Part {part_index} of {PART_COUNT}\n"
            f"PDF files in this part: {len(files)}\n"
            f"Uncompressed PDF bytes in this part: {sum(p.stat().st_size for p in files)}\n\n"
            "Each part is a standalone ZIP. Extract all four parts into the same destination folder "
            "to assemble the complete recovered collection. Filenames are unique and retain their "
            "directory sequence prefixes. The separate indexes package identifies every recovered "
            "and unrecoverable source URL.\n"
        )
        with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_STORED, allowZip64=True) as archive:
            archive.writestr("PART_README.txt", readme)
            for path in sorted(files, key=lambda p: p.name.lower()):
                arcname = Path("pdfs") / path.relative_to(pdf_dir)
                archive.write(path, arcname.as_posix())
                manifest_rows.append(
                    {
                        "part": part_index,
                        "part_zip": zip_name,
                        "stored_file": arcname.as_posix(),
                        "bytes": path.stat().st_size,
                    }
                )
        with zipfile.ZipFile(zip_path) as archive:
            bad = archive.testzip()
            if bad:
                raise RuntimeError(f"Part {part_index} failed integrity test at {bad}")
        print(
            f"Created {zip_path}: {zip_path.stat().st_size} bytes, "
            f"{len(files)} PDFs, {totals[part_index - 1]} uncompressed bytes",
            flush=True,
        )

    indexes_dir = OUTPUT_ROOT / "indexes"
    indexes_dir.mkdir()
    for name in (
        "README.txt",
        "pdf_index.csv",
        "pdf_index.json",
        "source_page.html",
        "cdx_query_report.json",
    ):
        source = WORK_ROOT / name
        if source.exists():
            shutil.copy2(source, indexes_dir / name)

    manifest_csv = indexes_dir / "parts_manifest.csv"
    with manifest_csv.open("w", newline="", encoding="utf-8-sig") as fh:
        writer = csv.DictWriter(fh, fieldnames=["part", "part_zip", "stored_file", "bytes"])
        writer.writeheader()
        writer.writerows(sorted(manifest_rows, key=lambda row: str(row["stored_file"])))

    manifest_json = {
        "parts": PART_COUNT,
        "total_pdf_files": len(pdf_files),
        "total_pdf_bytes": sum(path.stat().st_size for path in pdf_files),
        "part_sizes_uncompressed": totals,
        "files": sorted(manifest_rows, key=lambda row: str(row["stored_file"])),
    }
    (indexes_dir / "parts_manifest.json").write_text(json.dumps(manifest_json, indent=2), encoding="utf-8")

    summary = {
        "total_pdf_files": len(pdf_files),
        "total_pdf_bytes": sum(path.stat().st_size for path in pdf_files),
        "part_zip_bytes": [
            (OUTPUT_ROOT / f"allbrandwindowdoorparts_pdfs_part_{i}_of_{PART_COUNT}.zip").stat().st_size
            for i in range(1, PART_COUNT + 1)
        ],
    }
    (indexes_dir / "split_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2), flush=True)


if __name__ == "__main__":
    main()
