import manifest from "@/data/vehicleThumbnailManifest.json";
import vehicleDescriptorTypes from "@/data/vehicleDescriptorTypes.json";
import { API_BASE } from "@/lib/api";
import { isPickupSlug, resolveCabVariantPayload } from "@/lib/vehicleCabVariant";

const TYPE_ALIASES = manifest.type_aliases || {};
const DEFAULT_SLUG = manifest.default_slug || "default";
const KNOWN_SLUGS = new Set(Object.keys(manifest.assets || {}));

const SLUG_LABELS = {
  hatchback: "Hatchback",
  sedan: "Sedán",
  convertible: "Convertible",
  suv: "SUV",
  "station-wagon": "Station Wagon",
  "camioneta-1-cabina": "Camioneta 1 Cabina",
  "camioneta-cabina-y-media": "Camioneta Doble Cabina",
  "microbus-carga": "Microbús de Carga",
  "microbus-pasajeros": "Microbus de Pasajeros",
  "camion-carga": "Camion de Carga",
  cabezal: "Cabezal",
};

const TEXT_RULES = [
  [/\b(doble cabina|double cab|crew cab|cabina y media|crewman)\b/i, "camioneta-cabina-y-media"],
  [/\b(1 cabina|una cabina|cabina simple|single cab)\b/i, "camioneta-1-cabina"],
  [/\b(camioneta doble cabina)\b/i, "camioneta-cabina-y-media"],
  [/\b(camioneta 1 cabina|pickup 1 cabina)\b/i, "camioneta-1-cabina"],
  [/\b(microbus de pasajeros|microbús de pasajeros|minibus)\b/i, "microbus-pasajeros"],
  [/\b(microbus de carga|microbús de carga|van de carga|cargo van)\b/i, "microbus-carga"],
  [/\b(cabezal|tractocamion|tracto camion)\b/i, "cabezal"],
  [/\b(camion de carga|camión de carga|box truck)\b/i, "camion-carga"],
  [/\b(pickup doble cabina|pickup double cab)\b/i, "camioneta-cabina-y-media"],
  [/\b(pickup cabina simple|pickup single cab)\b/i, "camioneta-1-cabina"],
  [/\b(pickup|camioneta)\b/i, "camioneta-1-cabina"],
  [/\b(convertible|cabrio|cabriolet)\b/i, "convertible"],
  [/\b(station wagon|wagon|familiar|estate|break)\b/i, "station-wagon"],
  [/\b(suv|crossover|sport utility)\b/i, "suv"],
  [/\b(hatchback large|hatchback|hatch\/|hatch )\b/i, "hatchback"],
  [/\b(sedan|sedán|saloon|large car)\b/i, "sedan"],
  [/\b(minivan|microbus)\b/i, "microbus-pasajeros"],
];

export const VEHICLE_THUMBNAIL_CLASS =
  "rounded-md bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 object-contain object-center";

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function hasVehicleIdentity(vehicle) {
  if (!vehicle) return false;
  return Boolean(String(vehicle.brand || "").trim() || String(vehicle.model || "").trim());
}

function matchTextRules(text = "") {
  const normalized = normalizeText(text);
  if (!normalized) return null;

  const parenthetical = [...normalized.matchAll(/\(([^)]+)\)/g)].map((match) => match[1]);
  for (const group of parenthetical) {
    for (const [pattern, slug] of TEXT_RULES) {
      if (pattern.test(group)) return slug;
    }
  }

  for (const [pattern, slug] of TEXT_RULES) {
    if (pattern.test(normalized)) return slug;
  }
  return null;
}

export function inferVehicleTypeSlugFromText(...parts) {
  const combined = parts.filter(Boolean).join(" ");
  return matchTextRules(combined);
}

function resolveDescriptorTypeSlug(vehicle) {
  const brand = String(vehicle?.brand || "").trim();
  const descriptor = String(vehicle?.descriptor || "").trim();
  if (!brand || !descriptor) return null;
  const key = `${brand.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toUpperCase()}::${descriptor}`;
  return vehicleDescriptorTypes.entries?.[key]?.default_silhouette_slug || null;
}

const CONFIDENCE_OPACITY = {
  override: 1,
  rules: 0.72,
  web_sync: 0.6,
  catalog: 0.85,
  unknown: 0.65,
};

export function getWatermarkConfidenceMultiplier(vehicle) {
  const source = String(vehicle?.classification_source || "unknown").trim().toLowerCase();
  return CONFIDENCE_OPACITY[source] ?? CONFIDENCE_OPACITY.unknown;
}

export function resolveVehicleTypeSlug(vehicle) {
  if (!hasVehicleIdentity(vehicle)) return null;

  const presetSlug = normalizeText(
    vehicle?.vehicle_type_slug || vehicle?.thumbnail_slug || ""
  );
  const cabVariant = vehicle?.vehicle_cab_variant;
  if (cabVariant && isPickupSlug(presetSlug)) {
    const cabResolved = resolveCabVariantPayload(presetSlug, cabVariant);
    if (cabResolved?.vehicle_type_slug && KNOWN_SLUGS.has(cabResolved.vehicle_type_slug)) {
      return cabResolved.vehicle_type_slug;
    }
  }
  if (presetSlug && KNOWN_SLUGS.has(presetSlug)) {
    return presetSlug;
  }
  if (presetSlug && TYPE_ALIASES[presetSlug]) {
    return TYPE_ALIASES[presetSlug];
  }

  const rawType = normalizeText(
    vehicle?.vehicle_type || vehicle?.type || vehicle?.body_type || vehicle?.body_class || ""
  );

  const fromType = rawType && TYPE_ALIASES[rawType] ? TYPE_ALIASES[rawType] : matchTextRules(rawType);
  const fromDescriptor = resolveDescriptorTypeSlug(vehicle);
  const fromModel = inferVehicleTypeSlugFromText(
    vehicle?.brand,
    vehicle?.model,
    vehicle?.descriptor
  );

  if (fromDescriptor && (!fromType || (fromType === "sedan" && fromDescriptor !== "sedan"))) {
    return fromDescriptor;
  }
  if (fromModel && (!fromType || (fromType === "sedan" && fromModel !== "sedan"))) {
    return fromModel;
  }
  if (fromType) return fromType;

  return null;
}

export function getVehicleThumbnailTypeLabel(vehicle) {
  const slug = resolveVehicleTypeSlug(vehicle);
  return slug ? SLUG_LABELS[slug] || slug : null;
}

function buildThumbnailUrl(slug, { version = "bundled", style = "card" } = {}) {
  if (!slug) return null;
  const safeSlug = KNOWN_SLUGS.has(slug) ? slug : DEFAULT_SLUG;
  const params = new URLSearchParams();
  if (style === "watermark") params.set("style", "watermark");
  params.set("v", encodeURIComponent(version || "bundled"));
  return `${API_BASE}/vehicle-thumbnails/${safeSlug}.png?${params.toString()}`;
}

export function getVehicleThumbnailType(vehicle) {
  if (!hasVehicleIdentity(vehicle)) return null;
  return resolveVehicleTypeSlug(vehicle);
}

export function getVehicleThumbnail(vehicle, options = {}) {
  if (!hasVehicleIdentity(vehicle)) return null;

  const explicit =
    vehicle.thumbnail_url ||
    vehicle.vehicle_thumbnail ||
    vehicle.image_url ||
    vehicle.image ||
    vehicle.photo_url ||
    null;

  if (explicit && typeof explicit === "string") return explicit;

  const slug = resolveVehicleTypeSlug(vehicle);
  if (!slug) return null;

  const version =
    options.version ||
    vehicle.thumbnail_version ||
    vehicle.vehicle_thumbnail_version ||
    slug;

  return buildThumbnailUrl(slug, {
    version,
    style: options.style || "card",
  });
}

export function getVehicleWatermarkUrl(vehicle, options = {}) {
  return getVehicleThumbnail(vehicle, { ...options, style: "watermark" });
}