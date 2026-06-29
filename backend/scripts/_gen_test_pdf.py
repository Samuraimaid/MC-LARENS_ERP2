from pathlib import Path

from backend.domains.inventory.product_labels import build_label_payload, render_labels_pdf, resolve_template

label = build_label_payload(
    product={"sku": "DEF-TOY-001", "name": "Defensa Toyota", "barcode": "123456", "price": 150},
    branch={"branch_id": "branch_main", "company_name": "Mundo de Accesorios"},
    warehouse={"name": "Bodega Central"},
    template=resolve_template("col_50x100"),
)
Path("/tmp/test.pdf").write_bytes(render_labels_pdf(label))
print("ok")