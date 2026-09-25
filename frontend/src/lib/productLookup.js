const PRODUCT_CODE_FIELDS = ["sku", "barcode", "ean", "upc", "product_id"];

/** Min token length for edit-distance ≤1 matching (protects short codes like H11 vs H4). */
export const FUZZY_MIN_TOKEN_LENGTH = 4;

/**
 * Query token (lowercased) → additional spellings to try.
 * Prefer canonical catalog brands (DLAA, DS18, FOX).
 */
export const SEARCH_TOKEN_ALIASES = {
  dlla: ["dlaa"],
  dlaal: ["dlaa"],
  dss18: ["ds18"],
  ds018: ["ds18"],
  foox: ["fox"],
  foxx: ["fox"],
  f0x: ["fox"],
  foxs: ["fox"],
};

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

/**
 * Normalize free-text search before tokenizing:
 * collapse spaced/hyphenated DS18 forms so "DS 18" / "DSS 18" behave like one token.
 */
export function normalizeSearchInput(searchValue) {
  let s = normalizeScanCode(searchValue).toLowerCase();
  // DSS18 / DS 18 / DS-18 / DS_18 → ds18
  s = s.replace(/\bdss?\s*[-_]?\s*18\b/g, "ds18");
  return s;
}

/** Trim + split on whitespace; drop empties. Applies brand-ish pre-normalization. */
export function tokenizeSearchQuery(searchValue) {
  return normalizeSearchInput(searchValue)
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Expand a single query token with brand aliases (token itself always included).
 */
export function expandSearchToken(token) {
  const t = String(token || "").toLowerCase().trim();
  if (!t) return [];
  const extras = SEARCH_TOKEN_ALIASES[t] || [];
  return Array.from(new Set([t, ...extras]));
}

/**
 * True when Levenshtein/Damerau distance between a and b is at most 1
 * (substitute, insert, delete, or adjacent transposition).
 */
export function isEditDistanceAtMostOne(a, b) {
  const x = String(a || "");
  const y = String(b || "");
  if (x === y) return true;
  const lx = x.length;
  const ly = y.length;
  if (Math.abs(lx - ly) > 1) return false;

  if (lx === ly) {
    let diffs = 0;
    for (let i = 0; i < lx; i += 1) {
      if (x[i] === y[i]) continue;
      // Adjacent transposition (Damerau)
      if (
        i + 1 < lx &&
        x[i] === y[i + 1] &&
        x[i + 1] === y[i] &&
        x.slice(i + 2) === y.slice(i + 2)
      ) {
        return true;
      }
      diffs += 1;
      if (diffs > 1) return false;
    }
    return diffs <= 1;
  }

  // Insert / delete: walk the longer string, allow one skip
  const longer = lx > ly ? x : y;
  const shorter = lx > ly ? y : x;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < longer.length && j < shorter.length) {
    if (longer[i] === shorter[j]) {
      i += 1;
      j += 1;
    } else {
      edits += 1;
      if (edits > 1) return false;
      i += 1;
    }
  }
  return true;
}

/** Split searchable blob into alphanumeric words for fuzzy word matching. */
export function tokenizeSearchableWords(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
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
 * A single query token matches searchable text when any expanded alias is a
 * substring, or (for tokens length ≥ FUZZY_MIN_TOKEN_LENGTH) any searchable
 * word is within edit distance 1 (incl. transposition).
 */
export function tokenMatchesSearchText(token, searchableText, words = null) {
  const variants = expandSearchToken(token);
  if (variants.length === 0) return true;

  const text = String(searchableText || "");
  if (variants.some((v) => text.includes(v))) return true;

  const fuzzyVariants = variants.filter((v) => v.length >= FUZZY_MIN_TOKEN_LENGTH);
  if (fuzzyVariants.length === 0) return false;

  const wordList = words || tokenizeSearchableWords(text);
  return fuzzyVariants.some((v) =>
    wordList.some((w) => w.length >= FUZZY_MIN_TOKEN_LENGTH && isEditDistanceAtMostOne(v, w))
  );
}

/**
 * Product matches search when every whitespace token appears somewhere in
 * searchable fields (AND), with brand aliases + light fuzzy for long tokens.
 * Empty query matches all. Short tokens (<4) stay exact/substring-only so
 * unrelated codes (H11 vs H4) do not collide.
 */
export function productMatchesSearch(product, searchValue) {
  const normalized = normalizeSearchInput(searchValue);
  if (!normalized) return true;

  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  // Fast path: full query (or single token) hits a product code field (exact substring)
  const codeValues = getProductCodeValues(product);
  const codeBlob = codeValues.map((v) => v.toLowerCase()).join(" ");
  if (codeValues.some((value) => value.toLowerCase().includes(normalized))) {
    return true;
  }
  // Soft match against code fields for typo'd SKUs / brands in codes
  if (tokens.every((token) => tokenMatchesSearchText(token, codeBlob))) {
    return true;
  }

  const searchableText = getProductSearchableText(product);
  const words = tokenizeSearchableWords(searchableText);
  return tokens.every((token) => tokenMatchesSearchText(token, searchableText, words));
}
