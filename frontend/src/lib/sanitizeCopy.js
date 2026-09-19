/**
 * Utility to sanitize product copy for display:
 * - strips supplier country-of-origin artifacts
 * - hides hex / base64 garbage blobs
 * - strips internal catalog metadata lines (catalog_batch, price_note, etc.)
 */

const CHINA_ORIGIN_PATTERNS = [
  /detalles\s+r[aá]pidos\s+lugar\s+de\s+origen\s*:\s*guangdong[,\s]*china\b/gi,
  /detalles\s+r[aá]pidos\s+lugar\s+de\s+origen\s*:\s*china\b/gi,
  /detalles\s+r[aá]pidos\s+origen\s*:\s*guangdong[,\s]*china\b/gi,
  /detalles\s+r[aá]pidos\s+origen\s*:\s*china\b/gi,
  /lugar\s+de\s+origen\s*:\s*guangdong[,\s]*china\b/gi,
  /lugar\s+de\s+origen\s*:\s*china\b/gi,
  /origen\s*:\s*guangdong[,\s]*china\b/gi,
  /origen\s*:\s*china\b/gi,
  /place\s+of\s+origin\s*:\s*guangdong[,\s]*china\b/gi,
  /place\s+of\s+origin\s*:\s*china\b/gi,
  /country\s+of\s+origin\s*:\s*china\b/gi,
  /made\s+in\s+china\b/gi,
  /hecho\s+en\s+china\b/gi,
  /fabricado\s+en\s+china\b/gi,
  /guangdong[,\s]+china\b/gi,
];

/** Internal import metadata — never show in UI */
const INTERNAL_META_LINE =
  /^(catalog_batch|source_sites|isolation_product_id_prefix|price_note|do_not_mix_with)\b\s*[:=]/i;

/** raw=$… val=… cur=… dumps (inline or whole line) */
const RAW_PRICE_DUMP = /\braw\s*=\s*[^;\n]*\bval\s*=\s*[^;\n]*\bcur\s*=/i;

/** Long hex run with almost no spaces (encrypted/blob dump) */
function looksLikeHexBlob(text) {
  const compact = String(text || "").replace(/\s+/g, "");
  if (compact.length < 48) return false;
  const hexChars = (compact.match(/[0-9a-fA-F]/g) || []).length;
  return hexChars / compact.length >= 0.92 && !/\s/.test(String(text).trim().slice(0, 80));
}

/** Long base64-looking blob */
function looksLikeBase64Blob(text) {
  const t = String(text || "").trim();
  if (t.length < 64) return false;
  if (/\s{2,}|\n/.test(t) && t.length < 200) return false;
  const compact = t.replace(/\s+/g, "");
  if (compact.length < 64) return false;
  if (!/^[A-Za-z0-9+/]+=*$/.test(compact)) return false;
  // Avoid killing normal short titles that happen to be alphanumeric
  return compact.length >= 80;
}

/** Repetitive garbage titles e.g. "púrpura del púrpura de púrpura…" */
function looksLikeRepetitiveGarbage(text) {
  const words = String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4);
  if (words.length < 6) return false;
  const counts = {};
  for (const w of words) counts[w] = (counts[w] || 0) + 1;
  const max = Math.max(...Object.values(counts));
  return max >= 4 && max / words.length >= 0.45;
}

/**
 * Sanitize product description / long copy for display.
 * Returns empty string when the whole value is junk (caller should hide section).
 */
export function sanitizeProductDescription(text) {
  if (!text || typeof text !== "string") return "";

  let cleaned = text.replace(/\r\n/g, "\n");

  if (looksLikeHexBlob(cleaned) || looksLikeBase64Blob(cleaned)) {
    return "";
  }

  // Drop dashed separator + trailing internal metadata block
  cleaned = cleaned.replace(/\n---+\s*\n[\s\S]*$/m, "\n");

  // Strip metadata lines and raw price dumps line-by-line
  cleaned = cleaned
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (INTERNAL_META_LINE.test(t)) return false;
      if (RAW_PRICE_DUMP.test(t)) return false;
      if (/^(catalog_batch|source_sites|isolation_product_id_prefix|price_note|do_not_mix_with)\s*=/i.test(t)) {
        return false;
      }
      return true;
    })
    .join("\n");

  // Inline raw= dumps left in human paragraphs
  cleaned = cleaned.replace(RAW_PRICE_DUMP, "");

  // Origin patterns
  for (const pattern of CHINA_ORIGIN_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }

  cleaned = cleaned.replace(/^\s*detalles\s+r[aá]pidos[:\s-]*(?:\r?\n|$)/gim, "");
  cleaned = cleaned.replace(/detalles\s+r[aá]pidos[:\s-]*\n/gi, "\n");
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
  cleaned = cleaned.replace(/[ \t]{2,}/g, " ");
  cleaned = cleaned.trim();

  if (looksLikeHexBlob(cleaned) || looksLikeBase64Blob(cleaned) || looksLikeRepetitiveGarbage(cleaned)) {
    return "";
  }

  return cleaned;
}

/**
 * Sanitize short product copy (names, card titles). Falls back to a safe label
 * when the value is junk rather than returning empty (keeps cards usable).
 */
export function sanitizeProductCopy(text, { fallback = "" } = {}) {
  if (!text || typeof text !== "string") return fallback || "";

  const asDesc = sanitizeProductDescription(text);
  if (asDesc) return asDesc;

  // Names: also scrub origin + metadata but keep short human strings
  let cleaned = text;
  for (const pattern of CHINA_ORIGIN_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }
  cleaned = cleaned
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t) return false;
      if (INTERNAL_META_LINE.test(t)) return false;
      if (RAW_PRICE_DUMP.test(t)) return false;
      return true;
    })
    .join(" ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  if (!cleaned || looksLikeHexBlob(cleaned) || looksLikeBase64Blob(cleaned) || looksLikeRepetitiveGarbage(cleaned)) {
    return fallback || "";
  }
  return cleaned;
}

export function isUniversalProduct(product) {
  if (!product) return false;
  if (product.compatibility?.is_universal === true || product.is_universal === true) return true;

  const text = (product.compatibilidad_texto || product.compatibility?.texto || "").toLowerCase();
  if (text.includes("universal")) return true;

  return false;
}