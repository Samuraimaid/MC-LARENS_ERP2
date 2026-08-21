import os
import re

files_to_check = [
    'frontend/src/components/sales/SaleForm.jsx',
    'frontend/src/components/sales/PaymentPlanEditor.jsx',
    'frontend/src/components/sales/PriceTierSelector.jsx',
    'frontend/src/components/sales/PriceTierCompare.jsx',
    'frontend/src/components/sales/DocumentAuditPanel.jsx',
    'frontend/src/components/sales/TintWindowMaterialDialog.jsx',
    'frontend/src/components/customers/CustomerVehicleFormTabs.jsx',
    'frontend/src/components/erp/VehicleCabVariantSelect.jsx',
    'frontend/src/components/erp/ProductBarcodeScannerDialog.jsx',
    'frontend/src/components/erp/SaleFlowStepProgress.jsx',
    'frontend/src/components/erp/EmptyCartPlaceholder.jsx',
    'frontend/src/components/erp/SavingsHighlightRow.jsx',
    'frontend/src/components/erp/ErpRollingNumber.jsx',
    'frontend/src/components/ui/searchable-select.jsx',
    'frontend/src/lib/priceTiers.js',
    'frontend/src/lib/plannedPaymentPlan.js',
    'frontend/src/lib/vehicleCatalog.js',
    'frontend/src/lib/saleTotals.js',
    'frontend/src/lib/draftReview.js',
    'frontend/src/lib/productLookup.js',
]

for rel_path in files_to_check:
    full_path = os.path.abspath(rel_path)
    if not os.path.exists(full_path):
        print(f"NOT FOUND: {rel_path}")
        continue
    
    with open(full_path, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()
    
    # Check for variables named _ or top level declarations
    matches = re.findall(r'(?:const|let|var)\s+(_[A-Za-z0-9_$]*|_)\s*=', content)
    if matches:
        print(f"File {rel_path} declares: {matches}")
        
    # Check for functions called before declared
    # Find all const / let at module level (not inside function)
    # Check if they reference functions declared below them
