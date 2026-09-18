/**
 * Product Image Resolution & Fallback Helpers
 * McLaren's ERP - Image Engine
 */

export const GCS_BASE = "https://storage.googleapis.com/mclarens-erp-products";

/**
 * Extracts and sanitizes the primary product image URL.
 * Filters out empty/whitespace strings and Unsplash placeholders.
 * Returns null if no valid image is available.
 */
export function getProductImageUrl(product) {
  if (!product) return null;
  const raw =
    (Array.isArray(product.images) && product.images.find((u) => typeof u === "string" && u.trim())) ||
    product.image_url ||
    product.image ||
    null;
  if (!raw || typeof raw !== "string") return null;
  const u = raw.trim();
  if (!u) return null;
  if (u.includes("images.unsplash.com")) return null;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/uploads/") || u.startsWith("/")) return u;
  return u;
}

/**
 * Converts a legacy local /uploads/... URL to its absolute GCS bucket equivalent.
 */
export function uploadsToGcsUrl(url) {
  if (!url || typeof url !== "string" || !url.startsWith("/uploads/")) return null;
  return `${GCS_BASE}/${url.slice("/uploads/".length)}`;
}

/**
 * Derives 2-letter uppercase brand initials for placeholders.
 */
export function brandInitials(brand) {
  const b = (brand || "?").trim();
  if (!b) return "?";
  const parts = b.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
