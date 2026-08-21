import os
import re

files = [
    "frontend/src/components/sales/SaleForm.jsx",
    "frontend/src/components/sales/PaymentPlanEditor.jsx",
    "frontend/src/components/sales/PriceTierSelector.jsx",
    "frontend/src/components/sales/PriceTierCompare.jsx",
    "frontend/src/components/sales/DocumentAuditPanel.jsx",
    "frontend/src/components/sales/TintWindowMaterialDialog.jsx",
    "frontend/src/components/customers/CustomerVehicleFormTabs.jsx",
    "frontend/src/components/erp/VehicleCabVariantSelect.jsx",
    "frontend/src/components/erp/ProductBarcodeScannerDialog.jsx",
    "frontend/src/components/erp/SaleFlowStepProgress.jsx",
    "frontend/src/components/erp/EmptyCartPlaceholder.jsx",
    "frontend/src/components/erp/SavingsHighlightRow.jsx",
    "frontend/src/components/erp/ErpRollingNumber.jsx",
    "frontend/src/components/ui/searchable-select.jsx",
]

for file_path in files:
    full_path = os.path.abspath(file_path)
    if not os.path.exists(full_path):
        print(f"MISSING: {file_path}")
        continue
    
    with open(full_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    
    # 1. Check for top-level const/let declarations and their usage
    top_level_consts = {}
    for i, line in enumerate(lines):
        m = re.match(r'^(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=', line.strip())
        if m:
            top_level_consts[m.group(1)] = i + 1

    # Check if any top level const is used before line i+1 in top-level code (outside functions)
    print(f"\n--- Checking {file_path} ---")
    print(f"Top-level consts: {list(top_level_consts.keys())}")
    
    # Let's also check for hooks or components defined as const inside components
    # or functions used before declaration
