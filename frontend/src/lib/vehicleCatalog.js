import vehicleCatalogData from "@/data/vehicleCatalog.json";

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

export function getVehicleOptionsByBrandYear(brand, year) {
  if (!brand || !year) return [];
  const normalizedBrand = normalizeText(brand);

  const labels = entries
    .filter((entry) => normalizeText(entry.brand) === normalizedBrand)
    .filter((entry) => yearInEntryRange(entry, year))
    .map((entry) => entry.label)
    .filter(Boolean);

  return uniqueSorted(labels).sort((a, b) => a.localeCompare(b, "es"));
}

export function isValidVehicleSelection(brand, year, model) {
  if (!brand || !year || !model) return false;
  const normalizedBrand = normalizeText(brand);
  const validBrand = VEHICLE_CATALOG_BRANDS.some(
    (candidate) => normalizeText(candidate) === normalizedBrand
  );
  if (!validBrand) return false;

  const validYears = getVehicleYearsByBrand(brand);
  if (!validYears.includes(String(year))) return false;

  const validModels = getVehicleOptionsByBrandYear(brand, year);
  return validModels.includes(model);
}

export function normalizeVehicleBrand(brand) {
  if (!brand) return "";
  const normalized = normalizeText(brand);
  const exact = VEHICLE_CATALOG_BRANDS.find((candidate) => normalizeText(candidate) === normalized);
  return exact || brand;
}
