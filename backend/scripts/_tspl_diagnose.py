from __future__ import annotations

import json
import pathlib
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
TOKEN = (ROOT / "data" / "label-bridge-token.txt").read_text(encoding="utf-8").strip()
BRIDGE = "http://127.0.0.1:9265/print"

TESTS = {
    "minimal_text": "\r\n".join(
        [
            "SIZE 50 mm,30 mm",
            "GAP 2 mm,0 mm",
            "DIRECTION 0",
            "REFERENCE 0,0",
            "DENSITY 12",
            "SPEED 4",
            "CLS",
            'TEXT 40,40,"3",0,1,1,"TEST MC-LARENS"',
            "PRINT 1,1",
            "",
        ]
    ),
    "full_50x100": "\r\n".join(
        [
            "SIZE 50 mm,100 mm",
            "GAP 2 mm,0 mm",
            "DIRECTION 0",
            "REFERENCE 0,0",
            "DENSITY 12",
            "SPEED 4",
            "CLS",
            "BOX 10,10,390,790,3",
            'TEXT 30,60,"4",0,1,1,"MUNDO"',
            'TEXT 30,160,"3",0,1,1,"Defensa Toyota"',
            'TEXT 30,240,"2",0,1,1,"SKU DEF-TOY-001"',
            'BARCODE 40,520,"128",90,1,0,2,4,"123456"',
            'TEXT 40,640,"2",0,1,1,"123456"',
            "PRINT 1,1",
            "",
        ]
    ),
    "direction1": "\r\n".join(
        [
            "SIZE 50 mm,100 mm",
            "GAP 2 mm,0 mm",
            "DIRECTION 1",
            "REFERENCE 0,0",
            "DENSITY 12",
            "SPEED 4",
            "CLS",
            "BOX 10,10,390,790,3",
            'TEXT 30,60,"4",0,1,1,"DIR1 TEST"',
            "PRINT 1,1",
            "",
        ]
    ),
}


def send(name: str, tspl: str) -> str:
    payload = json.dumps(
        {"printer_name": "Xprinter XP-460B", "language": "TSPL", "copies": 1, "data": tspl}
    ).encode("utf-8")
    req = urllib.request.Request(
        BRIDGE,
        data=payload,
        method="POST",
        headers={"Content-Type": "application/json", "X-MCLarens-Bridge-Token": TOKEN},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return f"{name}: {resp.read().decode('utf-8')}"


def main() -> None:
    lines = [send(name, tspl) for name, tspl in TESTS.items()]
    out = ROOT / "data" / "_tspl_diagnose_results.txt"
    out.write_text("\n".join(lines), encoding="utf-8")
    print(out)


if __name__ == "__main__":
    main()