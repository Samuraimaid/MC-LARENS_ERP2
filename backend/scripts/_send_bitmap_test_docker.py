from __future__ import annotations

import base64
import json
import pathlib
import urllib.request

from backend.domains.inventory.product_labels import (
    build_label_payload,
    render_labels_tspl_bytes,
    resolve_template,
)

label = build_label_payload(
    product={
        "sku": "DEF-TOY-001",
        "name": "Defensa Toyota",
        "barcode": "123456",
        "price": 150,
    },
    branch={"branch_id": "branch_main", "company_name": "Mundo de Accesorios"},
    warehouse={"name": "Bodega Central"},
    template=resolve_template("col_50x100"),
    quantity=1,
)
tspl_bytes = render_labels_tspl_bytes(label)
token_path = pathlib.Path("/app/backend/data/label-bridge-token.txt")
token = token_path.read_text(encoding="utf-8").strip()
payload = json.dumps(
    {
        "printer_name": "Xprinter XP-460B",
        "language": "TSPL",
        "copies": 1,
        "data_base64": base64.b64encode(tspl_bytes).decode("ascii"),
    }
).encode("utf-8")
req = urllib.request.Request(
    "http://host.docker.internal:9265/print",
    data=payload,
    method="POST",
    headers={"Content-Type": "application/json", "X-MCLarens-Bridge-Token": token},
)
with urllib.request.urlopen(req, timeout=60) as resp:
    result = resp.read().decode("utf-8")
print(f"bytes={len(tspl_bytes)}")
print(result)