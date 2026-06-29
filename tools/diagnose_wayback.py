#!/usr/bin/env python3

import json
from pathlib import Path

import requests

URLS = [
    "https://web.archive.org/web/20230322132929id_/https://www.allbrandwindowdoorparts.com/pdf/How%20To%20Measure%20-%20BiltBest%20Casement%20Sash%20Frame%20NO%20Glass.pdf",
    "https://web.archive.org/web/20230322132929if_/https://www.allbrandwindowdoorparts.com/pdf/How%20To%20Measure%20-%20BiltBest%20Casement%20Sash%20Frame%20NO%20Glass.pdf",
    "https://web.archive.org/web/20230322132929/https://www.allbrandwindowdoorparts.com/pdf/How%20To%20Measure%20-%20BiltBest%20Casement%20Sash%20Frame%20NO%20Glass.pdf",
    "http://web.archive.org/web/20230322132929id_/https://www.allbrandwindowdoorparts.com/pdf/How%20To%20Measure%20-%20BiltBest%20Casement%20Sash%20Frame%20NO%20Glass.pdf",
]

out = Path("wayback_diagnostic")
out.mkdir(exist_ok=True)
report = []
for index, url in enumerate(URLS, 1):
    try:
        response = requests.get(
            url,
            headers={"User-Agent": "Mozilla/5.0", "Accept": "application/pdf,*/*"},
            timeout=(20, 120),
            allow_redirects=True,
        )
        body = response.content
        (out / f"response_{index}.bin").write_bytes(body)
        row = {
            "requested_url": url,
            "final_url": response.url,
            "status": response.status_code,
            "headers": dict(response.headers),
            "history": [
                {"status": item.status_code, "url": item.url, "headers": dict(item.headers)}
                for item in response.history
            ],
            "bytes": len(body),
            "first_1024_repr": repr(body[:1024]),
            "first_1024_hex": body[:1024].hex(),
            "pdf_marker_offset": body.find(b"%PDF-"),
        }
    except Exception as exc:
        row = {"requested_url": url, "error": f"{type(exc).__name__}: {exc}"}
    report.append(row)
    print(json.dumps(row, indent=2), flush=True)

(out / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
