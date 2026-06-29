const PRODUCT_CODE_FIELDS = ["sku", "barcode", "ean", "upc", "product_id"];

export function normalizeScanCode(code) {
  return String(code || "").trim();
}

function getProductCodeValues(product) {
  return PRODUCT_CODE_FIELDS
    .map((field) => String(product?.[field] || "").trim())
    .filter(Boolean);
}

export function findProductsByScanCode(products = [], code) {
  const normalized = normalizeScanCode(code);
  if (!normalized) return [];

  const lower = normalized.toLowerCase();
  const exactMatches = (products || []).filter((product) =>
    getProductCodeValues(product).some((value) => value.toLowerCase() === lower)
  );
  if (exactMatches.length) return exactMatches;

  return (products || []).filter((product) =>
    getProductCodeValues(product).some((value) => value.toLowerCase().includes(lower))
  );
}

export function productMatchesSearch(product, searchValue) {
  const normalized = normalizeScanCode(searchValue);
  if (!normalized) return true;

  const lower = normalized.toLowerCase();
  if (getProductCodeValues(product).some((value) => value.toLowerCase().includes(lower))) {
    return true;
  }

  return (
    String(product?.name || "").toLowerCase().includes(lower)
    || String(product?.category || "").toLowerCase().includes(lower)
  );
}