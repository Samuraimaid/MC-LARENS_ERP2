from __future__ import annotations

from pathlib import Path

from backend.domains.inventory.product_labels import (
    _resolve_label_logo_path,
    build_label_payload,
    render_labels_pdf,
    render_labels_tspl,
    resolve_template,
)

label = build_label_payload(
    product={"sku": "DEF-TOY-001", "name": "Defensa Toyota", "barcode": "123456", "price": 150},
    branch={"branch_id": "branch_main", "company_name": "Mundo de Accesorios", "name": "Central"},
    warehouse={"warehouse_id": "wh_main", "name": "Bodega Central"},
    template=resolve_template("col_50x100"),
)

lines = [
    f"brand={label['brand_id']}",
    f"logo={_resolve_label_logo_path('branch_main', '', {'branch_id': 'branch_main', 'brand_id': label['brand_id']})}",
    f"template={label['template']}",
]
tspl = render_labels_tspl(label)
lines.append("---TSPL---")
lines.extend(tspl.splitlines()[:20])
pdf = render_labels_pdf(label)
out_pdf = Path(__file__).resolve().parents[1] / "data" / "_test_label.pdf"
out_pdf.write_bytes(pdf)
lines.append(f"pdf_bytes={len(pdf)}")
lines.append(f"pdf_path={out_pdf}")

out_txt = Path(__file__).resolve().parents[1] / "data" / "_label_debug.txt"
out_txt.write_text("\n".join(lines), encoding="utf-8")
print(out_txt)