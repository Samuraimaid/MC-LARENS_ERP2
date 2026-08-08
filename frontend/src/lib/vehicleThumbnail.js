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

/** Weak legacy presets that must not override Hilux/X-Trail model inference */
const WEAK_PRESET_SLUGS = new Set(["", "default", "sedan", "hatchback"]);

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
  // Pickup models by name (draft cards often only have brand + model)
  [
    /\b(hilux|tacoma|tundra|ranger|amarok|s10|l200|frontier|np300|colorado|canyon|navara|triton|saveiro|strada|oroch|montana|toro|titan|maverick|ridgeline|bt-50|d-max|dmax|musso|wildtrak|silverado|f-150|f150|gladiator)\b/i,
    "camioneta-cabina-y-media",
  ],
  [/\b(pickup|camioneta)\b/i, "camioneta-1-cabina"],
  [/\b(convertible|cabrio|cabriolet)\b/i, "convertible"],
  [/\b(station wagon|wagon|familiar|estate|break)\b/i, "station-wagon"],
  [
    /\b(x-trail|xtrail|qashqai|rav4|cr-v|hr-v|tucson|sportage|sorento|duster|tracker|equinox|pathfinder|4runner|fortuner|prado|land cruiser|cx-5|cx-30|forester|outlander|kicks|creta|seltos|tiguan|escape|explorer)\b/i,
    "suv",
  ],
  [/\b(suv|crossover|sport utility)\b/i, "suv"],
  [/\b(hatchback large|hatchback|hatch\/|hatch |swift|cultus|mazda2|picanto|fabia|spark)\b/i, "hatchback"],
  [/\b(sedan|sedán|saloon|large car)\b/i, "sedan"],
  [/\b(minivan|microbus)\b/i, "microbus-pasajeros"],
];

const MODEL_TOKEN_DEFAULTS = {
  hilux: "camioneta-cabina-y-media",
  tacoma: "camioneta-cabina-y-media",
  tundra: "camioneta-cabina-y-media",
  ranger: "camioneta-cabina-y-media",
  amarok: "camioneta-cabina-y-media",
  s10: "camioneta-cabina-y-media",
  l200: "camioneta-cabina-y-media",
  frontier: "camioneta-cabina-y-media",
  np300: "camioneta-cabina-y-media",
  colorado: "camioneta-cabina-y-media",
  navara: "camioneta-cabina-y-media",
  triton: "camioneta-cabina-y-media",
  "d-max": "camioneta-cabina-y-media",
  dmax: "camioneta-cabina-y-media",
  "bt-50": "camioneta-cabina-y-media",
  silverado: "camioneta-cabina-y-media",
  "f-150": "camioneta-cabina-y-media",
  f150: "camioneta-cabina-y-media",
  "x-trail": "suv",
  xtrail: "suv",
  qashqai: "suv",
  rav4: "suv",
  "cr-v": "suv",
  "hr-v": "suv",
  tucson: "suv",
  sportage: "suv",
  sorento: "suv",
  duster: "suv",
  fortuner: "suv",
  prado: "suv",
  "4runner": "suv",
  pathfinder: "suv",
  kicks: "suv",
  corolla: "sedan",
  camry: "sedan",
  civic: "sedan",
  accord: "sedan",
  sentra: "sedan",
  yaris: "hatchback",
  swift: "hatchback",
  spark: "hatchback",
  prius: "hatchback",
  gol: "hatchback",
};

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

function matchModelTokenDefaults(text = "") {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  const tokens = Object.entries(MODEL_TOKEN_DEFAULTS).sort((a, b) => b[0].length - a[0].length);
  for (const [token, slug] of tokens) {
    const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(normalized)) return slug;
  }
  return null;
}

export function inferVehicleTypeSlugFromText(...parts) {
  const combined = parts.filter(Boolean).join(" ");
  return matchTextRules(combined) || matchModelTokenDefaults(combined);
}

function resolveDescriptorTypeSlug(vehicle) {
  const brand = String(vehicle?.brand || "").trim();
  const descriptor = String(vehicle?.descriptor || "").trim();
  if (!brand || !descriptor) return null;
  const key = `${brand.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toUpperCase()}::${descriptor}`;
  return vehicleDescriptorTypes.entries?.[key]?.default_silhouette_slug || null;
}

/** Fuzzy: brand+model "TOYOTA"+"HILUX" → catalog key "TOYOTA::Hilux (AN120)..." */
function resolveDescriptorTypeSlugFuzzy(vehicle) {
  const brand = normalizeText(vehicle?.brand || "").toUpperCase();
  const model = normalizeText(vehicle?.model || "");
  if (!brand || !model) return null;
  const modelToken = model.split("(")[0].trim();
  if (modelToken.length < 2) return null;

  let bestSlug = null;
  let bestScore = 0;
  const entries = vehicleDescriptorTypes.entries || {};
  for (const [key, profile] of Object.entries(entries)) {
    if (!key.startsWith(`${brand}::`)) continue;
    const descriptor = key.slice(brand.length + 2);
    const descNorm = normalizeText(descriptor);
    if (!descNorm.includes(modelToken) && !descNorm.startsWith(modelToken)) continue;
    const slug = String(profile?.default_silhouette_slug || "").trim();
    if (!slug || !KNOWN_SLUGS.has(slug)) continue;
    const score = descNorm.startsWith(modelToken) ? 100 : 50;
    if (score > bestScore) {
      bestScore = score;
      bestSlug = slug;
    }
  }
  return bestSlug;
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

function normalizePresetSlug(raw) {
  const presetSlug = normalizeText(raw || "");
  if (!presetSlug) return null;
  if (KNOWN_SLUGS.has(presetSlug)) return presetSlug;
  if (TYPE_ALIASES[presetSlug]) return TYPE_ALIASES[presetSlug];
  return null;
}

/**
 * Resolve silhouette slug for watermark/cards.
 * Prefer brand+model catalog/model-token inference over stale hatchback/sedan presets.
 */
export function resolveVehicleTypeSlug(vehicle) {
  if (!hasVehicleIdentity(vehicle)) return null;

  const presetSlug = normalizePresetSlug(
    vehicle?.vehicle_type_slug || vehicle?.thumbnail_slug || "",
  );
  const cabVariant = vehicle?.vehicle_cab_variant;
  if (cabVariant && isPickupSlug(presetSlug)) {
    const cabResolved = resolveCabVariantPayload(presetSlug, cabVariant);
    if (cabResolved?.vehicle_type_slug && KNOWN_SLUGS.has(cabResolved.vehicle_type_slug)) {
      return cabResolved.vehicle_type_slug;
    }
  }

  const rawType = normalizeText(
    vehicle?.vehicle_type || vehicle?.type || vehicle?.body_type || vehicle?.body_class || "",
  );
  const fromType = rawType && TYPE_ALIASES[rawType] ? TYPE_ALIASES[rawType] : matchTextRules(rawType);
  const fromDescriptor = resolveDescriptorTypeSlug(vehicle);
  const fromFuzzy = fromDescriptor ? null : resolveDescriptorTypeSlugFuzzy(vehicle);
  const fromModel = inferVehicleTypeSlugFromText(
    vehicle?.brand,
    vehicle?.model,
    vehicle?.descriptor,
  );

  // Catalog / model family first (Hilux → camioneta, X-Trail → SUV)
  const strongInferred = fromDescriptor || fromFuzzy || fromModel;

  if (strongInferred && KNOWN_SLUGS.has(strongInferred)) {
    if (!presetSlug || WEAK_PRESET_SLUGS.has(presetSlug)) {
      return strongInferred;
    }
    // Override clearly wrong body-class presets on pickups/SUVs
    if (strongInferred.startsWith("camioneta") && ["hatchback", "sedan", "convertible"].includes(presetSlug)) {
      return strongInferred;
    }
    if (strongInferred === "suv" && ["hatchback", "sedan"].includes(presetSlug)) {
      return strongInferred;
    }
  }

  if (presetSlug && KNOWN_SLUGS.has(presetSlug) && !WEAK_PRESET_SLUGS.has(presetSlug)) {
    return presetSlug;
  }
  if (presetSlug && KNOWN_SLUGS.has(presetSlug) && !strongInferred) {
    return presetSlug;
  }

  if (fromType && KNOWN_SLUGS.has(fromType) && !WEAK_PRESET_SLUGS.has(fromType)) {
    return fromType;
  }
  if (strongInferred && KNOWN_SLUGS.has(strongInferred)) {
    return strongInferred;
  }
  if (fromType && KNOWN_SLUGS.has(fromType)) {
    return fromType;
  }

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

  // Do not trust stale explicit hatchback URLs when brand/model imply another body
  const slug = resolveVehicleTypeSlug(vehicle);
  if (!slug) {
    const explicit =
      vehicle.thumbnail_url ||
      vehicle.vehicle_thumbnail ||
      vehicle.image_url ||
      vehicle.image ||
      vehicle.photo_url ||
      null;
    if (explicit && typeof explicit === "string") return explicit;
    return null;
  }

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

/** Build a minimal vehicle identity object from free-text label if needed */
export function vehicleIdentityFromLabel(label, fallback = null) {
  if (fallback && hasVehicleIdentity(fallback)) return fallback;
  const text = String(label || "").trim();
  if (!text) return null;
  // "TOYOTA HILUX 2023 • M 211 877 • AZUL"
  const head = text.split("•")[0].trim();
  const parts = head.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { brand: parts[0] || "", model: parts.slice(1).join(" ") };
  const yearIdx = parts.findIndex((p) => /^\d{4}$/.test(p));
  if (yearIdx > 0) {
    return {
      brand: parts[0],
      model: parts.slice(1, yearIdx).join(" ") || parts[1],
      year: parts[yearIdx],
    };
  }
  return { brand: parts[0], model: parts.slice(1).join(" ") };
}
