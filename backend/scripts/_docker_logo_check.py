from backend.domains.inventory.product_labels import _resolve_label_logo_path, resolve_label_brand_id

branch = {"branch_id": "branch_main", "company_name": "Mundo de Accesorios"}
print("brand", resolve_label_brand_id(branch))
print("logo", _resolve_label_logo_path("branch_main", "", branch))