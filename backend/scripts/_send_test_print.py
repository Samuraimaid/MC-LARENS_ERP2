from __future__ import annotations

import json
import pathlib
import traceback
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
tspl = (ROOT / "data" / "_tspl_send.txt").read_text(encoding="utf-8")
token = (ROOT / "data" / "label-bridge-token.txt").read_text(encoding="utf-8").strip()
payload = json.dumps(
    {"printer_name": "Xprinter XP-460B", "language": "TSPL", "copies": 1, "data": tspl}
).encode("utf-8")
req = urllib.request.Request(
    "http://127.0.0.1:9265/print",
    data=payload,
    method="POST",
    headers={"Content-Type": "application/json", "X-MCLarens-Bridge-Token": token},
)
out_lines: list[str] = []
try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        out_lines.append(resp.read().decode("utf-8"))
except Exception:
    out_lines.append(traceback.format_exc())
(ROOT / "data" / "_print_result.txt").write_text("\n".join(out_lines), encoding="utf-8")