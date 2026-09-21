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

/** Trim + split on whitespace; drop empties. */
export function tokenizeSearchQuery(searchValue) {
  return normalizeScanCode(searchValue)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Flatten searchable product fields (case-folded) for multi-token AND matching.
 * Includes sku/name/brand/description + compatibility brands/models/texto + bombillo.
 */
export function getProductSearchableText(product) {
  const compatibility = product?.compatibility || {};
  const brands = Array.isArray(compatibility.brands) ? compatibility.brands.join(" ") : "";
  const models = Array.isArray(compatibility.models) ? compatibility.models.join(" ") : "";
  const vehicleTypes = Array.isArray(compatibility.vehicle_types)
    ? compatibility.vehicle_types.join(" ")
    : Array.isArray(product?.vehicle_types)
      ? product.vehicle_types.join(" ")
      : "";
  const compatText = product?.compatibilidad_texto || compatibility.texto || "";
  const bombilloBits = [product?.bombillo, product?.specs?.Bombillo, product?.specs?.bombillo]
    .filter(Boolean)
    .join(" ");

  return [
    product?.name,
    product?.sku,
    product?.barcode,
    product?.ean,
    product?.upc,
    product?.product_id,
    product?.category,
    product?.subcategory,
    product?.brand,
    product?.description,
    brands,
    models,
    vehicleTypes,
    compatText,
    bombilloBits,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * Product matches search when every whitespace token appears somewhere in
 * searchable fields (AND). Empty query matches all.
 */
export function productMatchesSearch(product, searchValue) {
  const normalized = normalizeScanCode(searchValue);
  if (!normalized) return true;

  const lower = normalized.toLowerCase();
  const tokens = lower.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  // Fast path: full query (or single token) hits a product code field
  const codeValues = getProductCodeValues(product);
  if (codeValues.some((value) => value.toLowerCase().includes(lower))) {
    return true;
  }

  const searchableText = getProductSearchableText(product);
  return tokens.every((token) => searchableText.includes(token));
}
