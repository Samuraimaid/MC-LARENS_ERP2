from backend.domains.inventory.product_labels import (
    build_label_payload,
    get_label_catalog,
    render_labels_tspl,
    render_labels_tspl_bytes,
    resolve_product_barcode,
    resolve_template,
)


def test_resolve_product_barcode_prefers_barcode():
    assert resolve_product_barcode({"sku": "ABC-1", "barcode": "999"}) == "999"
    assert resolve_product_barcode({"sku": "ABC-1"}) == "ABC-1"


def test_resolve_template_with_overrides():
    template = resolve_template("rect_50x30", {"width_mm": 55, "shape": "round"})
    assert template["width_mm"] == 55
    assert template["shape"] == "round"


def test_build_label_payload_contains_branch_and_quantity():
    label = build_label_payload(
        product={"product_id": "p1", "sku": "SKU-1", "name": "Filtro", "price": 10},
        branch={"branch_id": "branch_main", "name": "Central"},
        warehouse={"warehouse_id": "wh_main", "name": "Bodega Central"},
        template=resolve_template("rect_50x30"),
        quantity=20,
    )
    assert label["quantity"] == 20
    assert label["branch_name"] == "Central"
    assert label["warehouse_name"] == "Bodega Central"


def test_render_labels_tspl_contains_barcode_and_print():
    label = build_label_payload(
        product={"sku": "SKU-22", "name": "Producto demo"},
        branch={"name": "TopCar"},
        warehouse={"name": "Bodega Norte"},
        template=resolve_template("card_60x40"),
        quantity=3,
    )
    tspl = render_labels_tspl(label)
    assert "PRINT 3,1" in tspl
    raw = render_labels_tspl_bytes(label)
    assert raw.startswith(b"SIZE ")
    assert b"BITMAP 0,0," in raw
    assert b"PRINT 3,1" in raw


def test_label_catalog_includes_xprinter_profile():
    catalog = get_label_catalog()
    printer_ids = {entry["id"] for entry in catalog["printers"]}
    assert "xprinter_xp460b" in printer_ids


def test_col_50x100_template_exists():
    catalog = get_label_catalog()
    template_ids = {entry["id"] for entry in catalog["templates"]}
    assert "col_50x100" in template_ids
    template = resolve_template("col_50x100")
    assert template["width_mm"] == 100
    assert template["height_mm"] == 50
    assert template["roll_width_mm"] == 50
    assert template["roll_length_mm"] == 100
    assert template["layout"] == "card"


def test_resolve_label_branch_name_prefers_company_name():
    from backend.domains.inventory.product_labels import resolve_label_branch_name

    assert resolve_label_branch_name({"company_name": "Mundo de Accesorios", "name": "Central"}) == "Mundo de Accesorios"
    assert resolve_label_branch_name({"company_name": "TopCar", "name": "TopCar El Calvario"}) == "TopCar"


def test_render_labels_tspl_roll_bitmap_layout():
    label = build_label_payload(
        product={"sku": "SKU-50", "name": "Producto alto", "barcode": "SKU-50"},
        branch={"branch_id": "branch_main", "company_name": "Mundo de Accesorios"},
        warehouse={"name": "Bodega"},
        template=resolve_template("col_50x100"),
        quantity=2,
    )
    tspl = render_labels_tspl(label)
    assert "SIZE 50 mm, 100 mm" in tspl
    assert "PRINT 2,1" in tspl
    raw = render_labels_tspl_bytes(label)
    assert raw.startswith(b"SIZE 50 mm, 100 mm")
    assert b"DENSITY 12" in raw
    assert b"BITMAP 0,0," in raw
    assert b"PRINT 2,1" in raw
    assert len(raw) > 5000