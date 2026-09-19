/**
 * Bombillo (bulb socket) compatibility for catalog / sale product search.
 * Uses vehicleCatalog.json `bombillos` overlay + productRecommendations alias expand.
 * Does not invent fitment when a vehicle has no bombillos data.
 */

import { findCatalogEntryForVehicle } from "@/lib/vehicleCatalog";
import {
  expandBombilloAliases,
  getProductBombillo,
  inferDs18KitBombilloFromSku,
} from "@/lib/productRecommendations";

const XENON_BOMBILLOS = new Set([
  "D1S", "D1R", "D2S", "D2R", "D3S", "D3R", "D4S", "D4R",
]);

const normalizeText = (text) =>
  (text || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const normalizeBombilloCode = (code) =>
  (code || "")
    .toString()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/JP$/i, "");

/** Keywords that indicate the seller is searching for bulbs / LED kits. */
const BULB_QUERY_RE =
  /\b(bombillo|bombillos|bulbo|bulbos|led\s*kit|kit\s*led|vixh|vtlh|halogeno|halogen|xenon|hid|h[1-9]\d?|900[358]|hb[34]|h1[136]|neblina|antiniebla|faro\s*led)\b/i;

/**
 * Resolve catalog entry for a customer vehicle (brand + year + model/label).
 * Key style used in enrichment reverse-index: `BRAND::label` e.g. `TOYOTA::Hilux [2016-2020]`.
 */
export function resolveVehicleCatalogEntry(vehicle) {
  if (!vehicle) return null;
  const brand = vehicle.brand || vehicle.make || "";
  const year = vehicle.year || vehicle.model_year || "";
  const model =
    vehicle.model ||
    vehicle.label ||
    vehicle.descriptor ||
    vehicle.vehicle_model ||
    "";
  return findCatalogEntryForVehicle(brand, year, model);
}

export function vehicleCatalogErpKey(vehicleOrEntry) {
  const entry =
    vehicleOrEntry?.brand && (vehicleOrEntry?.label || vehicleOrEntry?.descriptor)
      ? vehicleOrEntry
      : resolveVehicleCatalogEntry(vehicleOrEntry);
  if (!entry?.brand) return "";
  const label = entry.label || entry.descriptor || entry.model || "";
  return `${String(entry.brand).toUpperCase()}::${label}`;
}

/**
 * Collect socket size codes from all bombillos positions on the catalog entry.
 * @returns {{ sizes: Set<string>, entry: object|null, hasData: boolean, erpKey: string }}
 */
export function getVehicleBombillos(vehicle) {
  const entry = resolveVehicleCatalogEntry(vehicle);
  const sizes = new Set();
  if (!entry?.bombillos || typeof entry.bombillos !== "object") {
    return {
      sizes,
      entry,
      hasData: false,
      erpKey: vehicleCatalogErpKey(entry || vehicle),
    };
  }
  for (const value of Object.values(entry.bombillos)) {
    const list = Array.isArray(value) ? value : value ? [value] : [];
    for (const code of list) {
      const n = normalizeBombilloCode(code);
      if (n && !XENON_BOMBILLOS.has(n)) sizes.add(n);
    }
  }
  return {
    sizes,
    entry,
    hasData: sizes.size > 0,
    erpKey: vehicleCatalogErpKey(entry),
  };
}

/** Primary size codes declared on a product (bombillo field / specs / DS18 SKU). */
export function productBombilloSizes(product) {
  const sizes = new Set();
  if (!product) return sizes;
  const fromField = getProductBombillo(product);
  if (fromField) sizes.add(fromField);
  const fromSku = inferDs18KitBombilloFromSku(product.sku);
  if (fromSku) sizes.add(fromSku);
  return sizes;
}

export function isXenonOrHidProduct(product) {
  if (!product) return false;
  for (const code of productBombilloSizes(product)) {
    if (XENON_BOMBILLOS.has(code)) return true;
  }
  const text = normalizeText(
    `${product.name || ""} ${product.sku || ""} ${product.subcategory || ""} ${product.description || ""}`
  );
  return /\b(xenon|hid)\b/.test(text) || /\bd[1-4][sr]\b/.test(text);
}

/**
 * Treat as bombillo/LED-kit product for search coloring (not amplifiers, etc.).
 */
export function isBombilloProduct(product) {
  if (!product) return false;
  if (productBombilloSizes(product).size > 0) return true;
  const brand = normalizeText(product.brand);
  const skuU = String(product.sku || "").toUpperCase();
  if (brand === "ds18" && (skuU.startsWith("VIXH") || skuU.startsWith("VTLH"))) return true;
  const text = normalizeText(
    `${product.name || ""} ${product.subcategory || ""} ${product.category || ""} ${product.description || ""}`
  );
  if (/\bbombillo/.test(text) || /\bled\s*kit\b/.test(text) || /\bkit\s*led\b/.test(text)) {
    return true;
  }
  if (/\b(halogeno|halogen)\b/.test(text) && /\b(h\d|900\d|hb\d)\b/.test(text)) return true;
  return false;
}

export function isBombilloRelatedQuery(query) {
  const q = normalizeText(query);
  if (!q) return false;
  if (BULB_QUERY_RE.test(q)) return true;
  // bare size tokens common in POS
  if (/^(h\d{1,2}|900[358]|hb[34]|h1[136]|880|881)$/i.test(q.replace(/\s+/g, ""))) return true;
  return false;
}

/**
 * Alias-expanded intersection; xenon/HID products never count as compatible LED.
 */
export function isBombilloCompatible(product, vehicleBombilloSet) {
  if (!product || !(vehicleBombilloSet instanceof Set) || vehicleBombilloSet.size === 0) {
    return false;
  }
  if (isXenonOrHidProduct(product)) return false;

  const productSizes = productBombilloSizes(product);
  if (!productSizes.size) return false;

  const vehicleExpanded = new Set();
  for (const code of vehicleBombilloSet) {
    for (const alias of expandBombilloAliases(code)) {
      if (!XENON_BOMBILLOS.has(alias)) vehicleExpanded.add(alias);
    }
  }

  for (const code of productSizes) {
    if (XENON_BOMBILLOS.has(code)) continue;
    for (const alias of expandBombilloAliases(code)) {
      if (vehicleExpanded.has(alias)) return true;
    }
  }
  return false;
}

/**
 * @returns {'compatible'|'incompatible'|'neutral'|null}
 * null = do not apply bombillo coloring on this row
 */
export function getBombilloCompatStatus(product, vehicle, options = {}) {
  const query = options.query || "";
  if (!vehicle) return null;

  const bulbProduct = isBombilloProduct(product);
  const queryLooksBulb = isBombilloRelatedQuery(query);
  if (!bulbProduct && !queryLooksBulb) return null;
  if (!bulbProduct) return null; // only color bulb-type rows

  const { sizes, hasData } = getVehicleBombillos(vehicle);
  if (!hasData) return "neutral";

  if (isBombilloCompatible(product, sizes)) return "compatible";
  return "incompatible";
}

/**
 * Stable-ish sort: compatible bulbs → other products → incompatible bulbs.
 * Non-bulb rows keep relative order within the middle bucket.
 */
export function sortProductsByBombilloCompat(products, vehicle, query = "") {
  if (!vehicle || !Array.isArray(products) || products.length === 0) {
    return products;
  }

  const { sizes, hasData } = getVehicleBombillos(vehicle);
  const queryLooksBulb = isBombilloRelatedQuery(query);
  const anyBulb = products.some((p) => isBombilloProduct(p));
  if (!hasData || (!queryLooksBulb && !anyBulb)) {
    return products;
  }

  const rank = (product) => {
    if (!isBombilloProduct(product)) return 1;
    if (!hasData) return 1;
    if (isBombilloCompatible(product, sizes)) return 0;
    return 2;
  };

  return products
    .map((product, index) => ({ product, index, rank: rank(product) }))
    .sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.index - b.index))
    .map((row) => row.product);
}

export function bombilloCompatRowClass(status) {
  if (status === "compatible") {
    return "border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/20";
  }
  if (status === "incompatible") {
    return "border-slate-300/80 bg-slate-100/60 opacity-60 grayscale-[35%] dark:bg-slate-900/40 dark:border-slate-600/50";
  }
  return "";
}
