#!/usr/bin/env python3
"""Run the AllBrand recovery while skipping live URLs already verified as 404."""

from pathlib import Path
from typing import Any

import recover_allbrand_pdfs as recovery

_original_download_pdf = recovery.download_pdf


def archive_only_download(url: str, tmp_path: Path) -> tuple[bool, dict[str, Any]]:
    if "web.archive.org" not in url:
        return False, {
            "http_status": "skipped",
            "content_type": "",
            "final_url": url,
            "bytes": 0,
            "error": "live URL previously verified HTTP 404",
        }
    return _original_download_pdf(url, tmp_path)


recovery.download_pdf = archive_only_download

if __name__ == "__main__":
    recovery.main()
