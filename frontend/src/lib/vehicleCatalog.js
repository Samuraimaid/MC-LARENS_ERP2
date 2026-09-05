import vehicleCatalogData from "@/data/vehicleCatalog.json";
import vehicleDescriptorTypes from "@/data/vehicleDescriptorTypes.json";
import { resolveCabVariantPayload } from "@/lib/vehicleCabVariant";

const entries = Array.isArray(vehicleCatalogData?.entries) ? vehicleCatalogData.entries : [];
const CATALOG_MIN_YEAR = 1980;
const CATALOG_MAX_YEAR = new Date().getFullYear() + 1;

const normalizeText = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toUpperCase();

export const VEHICLE_CATALOG_BRANDS = Array.from(
  new Set(entries.map((entry) => entry.brand).filter(Boolean))
).sort((a, b) => a.localeCompare(b, "es"));

export const VEHICLE_COLOR_SUGGESTIONS = [
  "Blanco",
  "Negro",
  "Gris",
  "Plata",
  "Rojo",
  "Azul",
  "Verde",
  "Amarillo",
  "Naranja",
  "Marron",
  "Beige",
  "Dorado",
  "Vino",
  "Turquesa",
  "Celeste",
  "Morado",
  "Bronce",
  "Champagne",
  "Grafito",
  "Perla",
];

const getDescriptor = (entry) => entry?.descriptor || entry?.label || "";

const parseYearSpan = (descriptor) => {
  const yearsToken = descriptor.match(/\[(.*?)\]/)?.[1]?.trim();
  if (!yearsToken) {
    return { start: CATALOG_MIN_YEAR, end: CATALOG_MAX_YEAR };
  }

  const directRange = yearsToken.match(/^(\d{4})\s*-\s*(\d{4})$/);
  if (directRange) {
    return {
      start: Number(directRange[1]),
      end: Number(directRange[2]),
    };
  }

  const presentRange = yearsToken.match(/^(\d{4})\s*-\s*(Presente|Actualidad)$/i);
  if (presentRange) {
    return {
      start: Number(presentRange[1]),
      end: CATALOG_MAX_YEAR,
    };
  }

  const untilYear = yearsToken.match(/^hasta\s+(\d{4})$/i);
  if (untilYear) {
    return {
      start: CATALOG_MIN_YEAR,
      end: Number(untilYear[1]),
    };
  }

  const singleYear = yearsToken.match(/^(\d{4})$/);
  if (singleYear) {
    const y = Number(singleYear[1]);
    return { start: y, end: y };
  }

  return { start: CATALOG_MIN_YEAR, end: CATALOG_MAX_YEAR };
};

const yearInEntryRange = (entry, year) => {
  const y = Number(year);
  if (!Number.isFinite(y)) return false;
  const { start, end } = parseYearSpan(getDescriptor(entry));
  return y >= start && y <= end;
};

const uniqueSorted = (values) => Array.from(new Set(values));

export function getVehicleOptionsByBrand(brand) {
  if (!brand) return [];
  const normalizedBrand = normalizeText(brand);
  const labels = entries
    .filter((entry) => normalizeText(entry.brand) === normalizedBrand)
    .map((entry) => entry.label)
    .filter(Boolean);

  return Array.from(new Set(labels)).sort((a, b) => a.localeCompare(b, "es"));
}

export function getVehicleYearsByBrand(brand) {
  if (!brand) return [];
  const normalizedBrand = normalizeText(brand);

  const years = [];
  entries
    .filter((entry) => normalizeText(entry.brand) === normalizedBrand)
    .forEach((entry) => {
      const { start, end } = parseYearSpan(getDescriptor(entry));
      const low = Math.max(CATALOG_MIN_YEAR, start);
      const high = Math.min(CATALOG_MAX_YEAR, end);
      if (low > high) return;
      for (let y = low; y <= high; y += 1) {
        years.push(String(y));
      }
    });

  return uniqueSorted(years).sort((a, b) => Number(b) - Number(a));
}

const buildVehicleSelectOption = (entry) => {
  const descriptor = getDescriptor(entry);
  const years = descriptor.match(/\[(.*?)\]/)?.[1]?.trim() || null;
  const modelLine = descriptor.replace(/\s*\[.*?\]\s*/, "").trim() || entry.model || entry.label;
  const hintParts = [
    years ? `Años ${years}` : null,
    entry.engine ? `Motor ${entry.engine}` : null,
    entry.vehicle_type_label || null,
  ].filter(Boolean);

  return {
    value: entry.label,
    label: modelLine,
    hint: hintParts.join(" · "),
  };
};

export function getVehicleOptionsByBrandYear(brand, year) {
  return getVehicleSelectOptionsByBrandYear(brand, year).map((option) => option.value);
}

export function getVehicleSelectOptionsByBrandYear(brand, year) {
  if (!brand || !year) return [];
  const normalizedBrand = normalizeText(brand);

  const options = entries
    .filter((entry) => normalizeText(entry.brand) === normalizedBrand)
    .filter((entry) => yearInEntryRange(entry, year))
    .map((entry) => buildVehicleSelectOption(entry))
    .filter((option) => option.value);

  const seen = new Set();
  return options
    .filter((option) => {
      if (seen.has(option.value)) return false;
      seen.add(option.value);
      return true;
    })
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}

export function findCatalogEntryForVehicle(brand, year, model) {
  if (!brand) return null;
  const normalizedBrand = normalizeText(brand);
  const normalizedModel = normalizeText(model || "");
  if (!normalizedModel) return null;

  const exactLabel = entries.find(
    (entry) => normalizeText(entry.brand) === normalizedBrand && entry.label === model
  );
  if (exactLabel) return exactLabel;

  const candidates = entries.filter((entry) => {
    if (normalizeText(entry.brand) !== normalizedBrand) return false;
    if (year && !yearInEntryRange(entry, year)) return false;
    const entryModel = normalizeText(entry.model || "");
    const descriptorModel = normalizeText(getDescriptor(entry).replace(/\s*\[.*?\]\s*/, ""));
    return (
      entryModel === normalizedModel ||
      descriptorModel === normalizedModel ||
      descriptorModel.includes(normalizedModel) ||
      normalizedModel.includes(descriptorModel) ||
      (entryModel && (entryModel.includes(normalizedModel) || normalizedModel.includes(entryModel)))
    );
  });

  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) {
    // Prioritize exact model name match
    const exactModelMatch = candidates.find((entry) => normalizeText(entry.model || "") === normalizedModel);
    if (exactModelMatch) return exactModelMatch;

    const labelMatch = candidates.find((entry) => normalizeText(entry.label).includes(normalizedModel));
    if (labelMatch) return labelMatch;
  }
  return candidates[0] || null;
}

export function formatVehicleIdentityHint(brand, year, model) {
  const entry = findCatalogEntryForVehicle(brand, year, model);
  if (!entry) return "";
  return buildVehicleSelectOption(entry).hint;
}

export function isValidVehicleSelection(brand, year, model) {
  if (!brand || !year || !model) return false;
  const normalizedBrand = normalizeText(brand);
  const validBrand = VEHICLE_CATALOG_BRANDS.some(
    (candidate) => normalizeText(candidate) === normalizedBrand
  );
  if (!validBrand) return false;

  const numYear = Number(year);
  if (Number.isNaN(numYear) || numYear < CATALOG_MIN_YEAR || numYear > CATALOG_MAX_YEAR) {
    return false;
  }

  const validModels = getVehicleOptionsByBrandYear(brand, year);
  if (validModels.includes(model)) return true;

  const matched = findCatalogEntryForVehicle(brand, year, model);
  if (matched) return true;

  const normModel = normalizeText(model);
  const brandEntries = entries.filter((e) => normalizeText(e.brand) === normalizedBrand);
  if (brandEntries.length > 0) {
    const modelMatches = brandEntries.some((e) => {
      const em = normalizeText(e.model || "");
      const el = normalizeText(e.label || "");
      const ed = normalizeText((e.descriptor || "").replace(/\s*\[.*?\]\s*/, ""));
      return em === normModel || el === normModel || ed === normModel || em.includes(normModel) || normModel.includes(em);
    });
    if (modelMatches) return true;
  }

  return false;
}

export function normalizeVehicleBrand(brand) {
  if (!brand) return "";
  const normalized = normalizeText(brand);
  const exact = VEHICLE_CATALOG_BRANDS.find((candidate) => normalizeText(candidate) === normalized);
  return exact || brand;
}

const TYPE_LABEL_BY_SLUG = {
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

const MODEL_TYPE_RULES = [
  [/\b(doble cabina|double cab|crew cab|crewman)\b/i, "camioneta-cabina-y-media"],
  [/\b(cabina simple|single cab|pickup cabina simple)\b/i, "camioneta-1-cabina"],
  [/\b(pickup)\b/i, "camioneta-1-cabina"],
  [/\b(hatchback|hatch\/|hatch )\b/i, "hatchback"],
  [/\b(suv|crossover)\b/i, "suv"],
  [/\b(wagon|familiar)\b/i, "station-wagon"],
  [/\b(sedan|sedán)\b/i, "sedan"],
  [/\b(minivan|microbus)\b/i, "microbus-pasajeros"],
  [/\b(van)\b/i, "microbus-carga"],
];

function inferSlugFromCatalogText(...parts) {
  const combined = parts.filter(Boolean).join(" ");
  if (!combined) return null;
  for (const [pattern, slug] of MODEL_TYPE_RULES) {
    if (pattern.test(combined)) return slug;
  }
  return null;
}

function descriptorTypeKey(brand, descriptor) {
  if (!brand || !descriptor) return null;
  return `${normalizeText(brand)}::${descriptor}`;
}

export function getDescriptorTypeProfile(brand, modelOrDescriptor) {
  if (!brand || !modelOrDescriptor) return null;
  const normalizedBrand = normalizeText(brand);
  const byLabel = entries.find(
    (entry) => normalizeText(entry.brand) === normalizedBrand && entry.label === modelOrDescriptor
  );
  const descriptor = byLabel?.descriptor || modelOrDescriptor;
  const key = descriptorTypeKey(brand, descriptor);
  return vehicleDescriptorTypes.entries?.[key] || null;
}

export function getCatalogEntryForModel(brand, model) {
  if (!brand || !model) return null;
  const normalizedBrand = normalizeText(brand);
  return (
    entries.find(
      (entry) => normalizeText(entry.brand) === normalizedBrand && entry.label === model
    ) || null
  );
}

export function getVehicleTypeSlugFromCatalog(brand, model) {
  const match = getCatalogEntryForModel(brand, model);
  if (match) {
    if (match.vehicle_type_slug) return match.vehicle_type_slug;
    if (match.thumbnail_slug) return match.thumbnail_slug;
    const profile = getDescriptorTypeProfile(brand, match.descriptor || "");
    if (profile?.default_silhouette_slug) return profile.default_silhouette_slug;
  }
  const directProfile = getDescriptorTypeProfile(brand, model || "");
  if (directProfile?.default_silhouette_slug) return directProfile.default_silhouette_slug;
  return null;
}

export function inferVehicleTypeFromCatalog(brand, model) {
  const match = getCatalogEntryForModel(brand, model);
  if (!match) return null;
  if (match.vehicle_type_label) return match.vehicle_type_label;
  const slug = getVehicleTypeSlugFromCatalog(brand, model);
  if (slug) return TYPE_LABEL_BY_SLUG[slug] || null;
  const slugFromText = inferSlugFromCatalogText(match.descriptor, model, brand);
  return slugFromText ? TYPE_LABEL_BY_SLUG[slugFromText] || null : null;
}

const PICKUP_SLUGS = new Set([
  "camioneta-1-cabina",
  "camioneta_1_cabina",
  "camioneta-cabina-y-media",
  "camioneta_cabina_media",
  "camioneta-doble-cabina",
  "camioneta_doble_cabina",
  "pickup",
  "pick-up",
  "pickup-doble-cabina",
  "pickup-cabina-media",
  "pickup-1-cabina",
]);

const KNOWN_PICKUP_KEYWORDS = [
  "tacoma",
  "hilux",
  "frontier",
  "ranger",
  "d-max",
  "dmax",
  "l200",
  "bt-50",
  "bt50",
  "amarok",
  "colorado",
  "silverado",
  "f-150",
  "f150",
  "f-250",
  "f250",
  "f-350",
  "f350",
  "ram 1500",
  "ram 2500",
  "ram 3500",
  "ram",
  "tundra",
  "titan",
  "navara",
  "poer",
  "wingle",
  "ridgeline",
  "gladiator",
  "cybertruck",
  "maverick",
  "santa cruz",
  "s10",
  "montana",
  "saveiro",
  "strada",
  "oroq",
  "alaskan",
  "terrano",
  "land cruiser 79",
  "land cruiser pick",
  "pickup",
  "pick-up",
];

export function isPickupCatalogModel(brand, model) {
  const slug = getVehicleTypeSlugFromCatalog(brand, model);
  if (slug && PICKUP_SLUGS.has(String(slug).toLowerCase().trim())) {
    return true;
  }
  const normModel = String(model || "").toLowerCase().trim();
  const normBrand = String(brand || "").toLowerCase().trim();
  const text = `${normBrand} ${normModel}`;
  return KNOWN_PICKUP_KEYWORDS.some((kw) => text.includes(kw));
}

export function getCatalogVehiclePayload(brand, model, options = {}) {
  const match = getCatalogEntryForModel(brand, model);
  if (!match) return null;
  const slug = getVehicleTypeSlugFromCatalog(brand, model);
  const payload = {
    descriptor: match.descriptor || undefined,
    vehicle_type: inferVehicleTypeFromCatalog(brand, model) || undefined,
    vehicle_type_slug: slug || undefined,
    thumbnail_slug: slug || undefined,
    classification_source: match.classification_source || undefined,
  };

  const cabVariant = options.vehicleCabVariant || options.vehicle_cab_variant;
  if (cabVariant && isPickupCatalogModel(brand, model)) {
    const cabPayload = resolveCabVariantPayload(slug, cabVariant);
    if (cabPayload) {
      return { ...payload, ...cabPayload };
    }
  }

  return payload;
}
