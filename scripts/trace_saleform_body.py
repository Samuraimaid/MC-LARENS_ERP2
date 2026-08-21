import re

with open('frontend/src/components/sales/SaleForm.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Let's find all declarations: const x = ..., let x = ...
# and check if any declaration's initialization expression accesses a variable declared below it!
# Break the file into component body lines
comp_start = code.find('export default function SaleForm(')
return_start = code.find('  return (\n    <div', comp_start)
body = code[comp_start:return_start]

# Find all statements in body
# Let's track variables declared so far
declared = set([
    'customers', 'products', 'warehouses', 'inventory', 'crossBranchInventory', 'vehicles',
    'initialData', 'onSubmit', 'submitLabel', 'confirmSendToCashier', 'exchangeRate',
    'buyExchangeRate', 'defaultIvaRate', 'draftKey', 'extraFields', 'onOpenCatalogSearch',
    'onDraftPersist', 'onDraftSaveStateChange', 'onDraftClear', 'onDataRefresh', 'flowType',
    'step4Label', 'step5Label', 'currencyValue', 'onCurrencyChange', 'hideCurrencyField', 'draftReview',
    'React', 'useCallback', 'useMemo', 'useState', 'useEffect', 'useRef', 'flushSync', 'axios',
    'useAuth', 'Label', 'Input', 'Button', 'Checkbox', 'Switch', 'Dialog', 'DialogContent',
    'DialogDescription', 'DialogHeader', 'DialogTitle', 'ContextualDialogFooter', 'ContextualDialogHeader',
    'getStatusPrimaryButtonClass', 'getStatusSecondaryButtonClass', 'useDialogMessages', 'Select',
    'SelectContent', 'SelectItem', 'SelectTrigger', 'SelectValue', 'SearchableSelect', 'cn',
    'formatCurrency', 'CUSTOMER_VEHICLE_CARD_PATTERNS', 'API', 'Building2', 'BookOpen', 'Car',
    'CarFront', 'CreditCard', 'FileText', 'FlaskConical', 'Hand', 'MapPin', 'Minus', 'Banknote',
    'Palette', 'Package', 'Phone', 'Plus', 'PlusCircle', 'Percent', 'PencilLine', 'ArrowRightLeft',
    'BadgeAlert', 'RefreshCcw', 'ShieldCheck', 'ShoppingCart', 'Tag', 'Trash2', 'Truck', 'Undo2',
    'User', 'UserSearch', 'UserPlus', 'Warehouse', 'Wrench', 'PackageSearch', 'ScanBarcode',
    'Layers', 'toast', 'Badge', 'formatVehicleIdentityHint', 'getVehicleSelectOptionsByBrandYear',
    'getVehicleYearsByBrand', 'getCatalogVehiclePayload', 'isPickupCatalogModel', 'isValidVehicleSelection',
    'VEHICLE_CATALOG_BRANDS', 'VEHICLE_COLOR_SUGGESTIONS', 'formatChasis', 'formatCedula', 'formatPhone',
    'formatPlateNumber', 'formatRUC', 'getPaymentMethodSummaryLabel', 'normalizePaymentMethodCode',
    'normalizePaymentMethodList', 'paymentMethodsAllowDiscounts', 'PaymentPlanEditor', 'buildDefaultPlanLine',
    'buildMixedPaymentPlan', 'buildPlanLinesForSubmit', 'buildSinglePaymentPlan', 'isPlanLineAmountEmpty',
    'rebalanceMixedPlanRemainders', 'syncMixedPlanLines', 'resolveCustomerCreditDays', 'validatePlanAgainstTotal',
    'validatePlanLineUniqueness', 'playCartQuantityUpSound', 'playCartQuantityDownSound', 'playCartRemoveSound',
    'playCartPickupSound', 'playCreationSuccessSound', 'playUndoSound', 'playSelectionFeedbackSound',
    'CustomerVehicleFormTabs', 'VehicleCabVariantSelect', 'ProductBarcodeScannerDialog', 'getCameraContextError',
    'SaleFlowStepProgress', 'EmptyCartPlaceholder', 'SavingsHighlightRow', 'ErpRollingCurrency',
    'ErpRollingQuantity', 'ERP_ANIMATION_CLASSES', 'ERP_SEARCH_ROW', 'ERP_SEMANTIC_TONES', 'buildSaleFlowSteps',
    'getErpCustomerSearchRowTone', 'getErpProductTone', 'isErpDraftSupervisor', 'findProductsByScanCode',
    'productMatchesSearch', 'clampSellerGlobalDiscount', 'getSellerCartLineLockState', 'isDraftBlockedForSeller',
    'isDraftReleasedWithRestrictions', 'sellerGlobalDiscountExceeded', 'computeSaleTotals', 'defaultApplyIvaForCustomer',
    'isSaleDraftSaveEligible', 'scrollToAnchor', 'TIER_LABELS', 'TIER_PRECIO1', 'TIER_PRECIO2',
    'buildPrecio2CartSignature', 'buildTierChangeAuditEvent', 'cartNeedsPrecio2Approval', 'canSellerEditLinePrice',
    'detectPriceTier', 'isSupervisorPricingRole', 'repriceCartItemsForTier', 'resolveDefaultUnitPrice',
    'resolveProductTierPrice', 'tierRequiresSupervisorApproval', 'PriceTierSelector', 'PriceTierCompare',
    'DocumentAuditPanel', 'TintWindowMaterialDialog', 'PLATE_PREFIXES', 'VEHICLE_BRANDS',
    'normalizeGlobalDiscountMode', 'clampGlobalDiscountValue', 'SaleTotalsBreakdownRow'
])

lines = body.split('\n')
for line_idx, line in enumerate(lines, 1):
    actual_line_num = code[:comp_start].count('\n') + line_idx
    # Check for const [a, b] = or const a = or let a =
    # First, if line has useMemo/useState or direct expression, check what identifiers it uses
    # But only check expressions evaluated immediately (like in useMemo or top-level const)
    # Ignore inside useEffect or useCallback bodies (they run later)
    
    # Extract declared variables on this line
    m_arr = re.search(r'(?:const|let|var)\s+\[([^\]]+)\]\s*=', line)
    if m_arr:
        vars_in_arr = [v.strip().split(':')[0].strip() for v in m_arr.group(1).split(',') if v.strip()]
        for v in vars_in_arr:
            declared.add(v)
    m_var = re.search(r'(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=', line)
    if m_var:
        declared.add(m_var.group(1))

print(f"Total declared in SaleForm component body: {len(declared)}")
