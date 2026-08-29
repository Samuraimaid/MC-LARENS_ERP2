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
  
  // 1. Coincidencia directa por código exacto o parcial
  const codeValues = getProductCodeValues(product);
  if (codeValues.some((value) => value.toLowerCase().includes(lower))) {
    return true;
  }

  // 2. Coincidencia multi-token (todas las palabras buscadas deben coincidir)
  const tokens = lower.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  const searchableText = `${product?.name || ""} ${product?.sku || ""} ${product?.category || ""} ${product?.subcategory || ""} ${product?.brand || ""}`.toLowerCase();

  return tokens.every((token) => searchableText.includes(token));
}