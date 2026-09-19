/**
 * Utility to sanitize product copy, removing supplier country-of-origin artifacts
 * (e.g. "Lugar de origen: Guangdong, China", "Made in China", etc.)
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

export function sanitizeProductCopy(text) {
  if (!text || typeof text !== "string") return text || "";
  
  let cleaned = text;
  
  // Strip origin patterns
  for (const pattern of CHINA_ORIGIN_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }
  
  // Clean up dangling or empty "Detalles rápidos" header if left alone
  cleaned = cleaned.replace(/^\s*detalles\s+r[aá]pidos[:\s-]*(?:\r?\n|$)/gim, "");
  cleaned = cleaned.replace(/detalles\s+r[aá]pidos[:\s-]*\n/gi, "\n");
  
  // Clean multiple blank lines or multiple spaces
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
  cleaned = cleaned.replace(/[ \t]{2,}/g, " ");
  
  return cleaned.trim();
}

export function isUniversalProduct(product) {
  if (!product) return false;
  if (product.compatibility?.is_universal === true || product.is_universal === true) return true;
  
  const text = (product.compatibilidad_texto || product.compatibility?.texto || "").toLowerCase();
  if (text.includes("universal")) return true;
  
  return false;
}
