/**
 * Vehicle top-down category and silhouette resolver for MC-LARENS ERP
 * Supporting full comprehensive range of 14 vehicle body types with real high-res top-down renders.
 */

import vehicleDescriptorTypes from "@/data/vehicleDescriptorTypes.json";
import masterBlueprintCatalog from "@/data/vehicle_blueprints_master_index.json";

export const VEHICLE_CATEGORIES = [
  { id: "sedan", label: "Sedán / Automóvil", shortLabel: "Sedán", image: "/vehicles/clean_sedan.png" },
  { id: "suv", label: "SUV / Crossover 4x4", shortLabel: "SUV / 4x4", image: "/vehicles/clean_suv.png" },
  { id: "camioneta_doble_cabina", label: "Camioneta Doble Cabina", shortLabel: "Doble Cabina", image: "/vehicles/clean_camioneta_doble_cabina.png" },
  { id: "camioneta_cabina_media", label: "Camioneta Cabina y Media", shortLabel: "Cabina y Media", image: "/vehicles/clean_camioneta_cabina_media.png" },
  { id: "camioneta_1_cabina", label: "Camioneta 1 Cabina", shortLabel: "Camioneta 1 Cab.", image: "/vehicles/clean_camioneta_1_cabina.png" },
  { id: "camion_1_cabina", label: "Camión 1 Cabina (Plataforma)", shortLabel: "Camión 1 Cab.", image: "/vehicles/clean_camion_1_cabina.png" },
  { id: "camion_2_cabinas", label: "Camión 2 Cabinas (Doble Cabina)", shortLabel: "Camión 2 Cab.", image: "/vehicles/clean_camion_2_cabinas.png" },
  { id: "camion_carga_furgon", label: "Camión de Carga (Furgón)", shortLabel: "Camión Furgón", image: "/vehicles/clean_camion_carga_furgon.png" },
  { id: "station_wagon", label: "Station Wagon / Familiar", shortLabel: "Station Wagon", image: "/vehicles/clean_station_wagon.png" },
  { id: "microbus_pasajeros", label: "Microbús de Pasajeros", shortLabel: "Microbús Pas.", image: "/vehicles/clean_microbus_pasajeros.png" },
  { id: "microbus_techo_alto", label: "Microbús Techo Alto", shortLabel: "Techo Alto", image: "/vehicles/clean_microbus_techo_alto.png" },
  { id: "microbus_carga", label: "Microbús Panel de Carga", shortLabel: "Panel Carga", image: "/vehicles/clean_microbus_carga.png" },
  { id: "bus_mediano_coaster", label: "Bus Mediano (Estilo Coaster)", shortLabel: "Bus Coaster", image: "/vehicles/clean_bus_mediano_coaster.png" },
  { id: "bus_grande_marcopolo", label: "Bus Grande (Estilo Marcopolo)", shortLabel: "Bus Grande", image: "/vehicles/clean_bus_grande_marcopolo.png" },
];

const KNOWN_CATEGORIES = new Set(VEHICLE_CATEGORIES.map((c) => c.id));

const CATEGORY_ALIASES = {
  hatchback: "sedan",
  coupe: "sedan",
  coupé: "sedan",
  convertible: "sedan",
  cabriolet: "sedan",
  pickup: "camioneta_doble_cabina",
  "pick-up": "camioneta_doble_cabina",
  "pickup-doble-cabina": "camioneta_doble_cabina",
  "pickup-cabina-media": "camioneta_cabina_media",
  "pickup-1-cabina": "camioneta_1_cabina",
  furgon: "microbus_carga",
  furgón: "microbus_carga",
  panel: "microbus_carga",
  minivan: "microbus_pasajeros",
  minibus: "microbus_pasajeros",
  minibús: "microbus_pasajeros",
  camion: "camion_1_cabina",
  camión: "camion_1_cabina",
  bus: "bus_mediano_coaster",
};

const TRIM_AND_STOP_WORDS = new Set([
  "de", "del", "la", "el", "los", "las", "cabina", "doble", "sencilla", "media",
  "4x4", "4x2", "ano", "año", "presente", "present", "van", "pickup", "pick-up",
  "auto", "m/t", "a/t", "gasolina", "diesel", "hybrid", "hibrido", "híbrido",
  "electric", "electrico", "eléctrico", "turbo", "intercooler", "v6", "v8",
  "touring", "limited", "sport", "sportage", "executive", "premium", "edition",
  "special", "custom", "standard", "classic", "plus", "pro", "cross", "active",
  "comfort", "elegance", "luxury", "line", "package", "pack", "crew", "regular",
  "king", "single", "super", "extended", "club", "ute", "truck", "car",
]);

/**
 * Searches the 8,692-blueprint master catalog for a specific vehicle brand, model, and year.
 * Returns the exact blueprint match if available, or null.
 */
export function findMatchingVehicleBlueprint(vehicle) {
  if (!vehicle) return null;
  const brand = String(vehicle.brand || "").toLowerCase().trim();
  const model = String(vehicle.model || vehicle.descriptor || "").toLowerCase().trim();
  const year = parseInt(vehicle.year, 10) || null;

  const blueprints = masterBlueprintCatalog?.blueprints || [];
  if (!blueprints.length) return null;

  const normBrand = brand.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]/g, "");
  const brandMatches = blueprints.filter((b) => {
    const bSlug = String(b.brand_slug || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    return bSlug === normBrand || normBrand.includes(bSlug) || bSlug.includes(normBrand);
  });

  if (brandMatches.length === 0) return null;

  // Clean and split model tokens into primary and secondary
  const cleanedModel = model
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\[.*?\]|\(.*?\)/g, " ")
    .replace(/\b\d+\.\d+L?\b|\b[A-Z0-9]{4,8}\b/gi, " ");

  const rawTokens = cleanedModel.split(/[\s\-_/]+/).map((t) => t.trim().toLowerCase());
  const primaryTokens = [];
  const secondaryTokens = [];

  for (const t of rawTokens) {
    if (t.length < 2) continue;
    if (TRIM_AND_STOP_WORDS.has(t)) {
      secondaryTokens.push(t);
    } else {
      primaryTokens.push(t);
    }
  }

  if (primaryTokens.length === 0 && secondaryTokens.length === 0) return null;

  let bestMatch = null;
  let bestScore = 0;

  for (const b of brandMatches) {
    const bModel = String(b.model_name || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    const bRaw = String(b.raw_header_text || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

    let modelScore = 0;

    for (const t of primaryTokens) {
      if (t === bModel || ` ${bModel} `.includes(` ${t} `)) {
        modelScore += 120;
      } else if (bModel.includes(t)) {
        modelScore += 80;
      } else if (bRaw.includes(t)) {
        modelScore += 40;
      }
    }

    for (const t of secondaryTokens) {
      if (bModel.includes(t)) {
        modelScore += 10;
      }
    }

    // Require at least one primary token match if primary tokens exist
    if (primaryTokens.length > 0 && modelScore < 40) {
      continue;
    }

    let yearScore = 0;
    if (year && b.year_start) {
      if (year >= b.year_start && (!b.year_end || year <= b.year_end)) {
        yearScore = 25;
      } else if (Math.abs(year - b.year_start) <= 3) {
        yearScore = 15;
      } else if (Math.abs(year - b.year_start) <= 6) {
        yearScore = 5;
      }
    }

    const totalScore = modelScore + yearScore;
    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestMatch = b;
    }
  }

  return bestMatch;
}


/**
 * Resolves the vehicle category based on vehicle object metadata and comprehensive ERP vehicle catalog
 */
export function resolveVehicleCategory(vehicle) {
  if (!vehicle) return "sedan";

  // 1. Direct assigned slug validation
  const directSlug = String(
    vehicle.vehicle_type_slug ||
    vehicle.type ||
    vehicle.body_type ||
    vehicle.category ||
    ""
  ).toLowerCase().trim();

  if (KNOWN_CATEGORIES.has(directSlug)) return directSlug;
  if (CATEGORY_ALIASES[directSlug]) return CATEGORY_ALIASES[directSlug];

  // 1.1 Match from 8,692-blueprint Master Engineering Catalog
  const matchedBp = findMatchingVehicleBlueprint(vehicle);
  if (matchedBp?.category && KNOWN_CATEGORIES.has(matchedBp.category)) {
    return matchedBp.category;
  }
  if (matchedBp?.category && CATEGORY_ALIASES[matchedBp.category]) {
    return CATEGORY_ALIASES[matchedBp.category];
  }

  const brand = String(vehicle.brand || "").trim().toUpperCase();
  const descriptor = String(vehicle.descriptor || vehicle.model || "").trim();
  const normBrand = brand.normalize("NFD").replace(/\p{Diacritic}/gu, "");

  // 2. Exact match in ERP Vehicle Descriptor Catalog
  if (normBrand && descriptor) {
    const key = `${normBrand}::${descriptor}`;
    const catalogSlug = vehicleDescriptorTypes.entries?.[key]?.default_silhouette_slug;
    if (catalogSlug && KNOWN_CATEGORIES.has(catalogSlug)) return catalogSlug;
    if (catalogSlug && CATEGORY_ALIASES[catalogSlug]) return CATEGORY_ALIASES[catalogSlug];
  }

  // 3. Fuzzy match in ERP Vehicle Descriptor Catalog by Brand + Model
  const model = String(vehicle.model || "").trim();
  if (normBrand && model) {
    const modelToken = model.split("(")[0].trim().toUpperCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
    if (modelToken.length >= 2) {
      const entries = vehicleDescriptorTypes.entries || {};
      for (const [key, profile] of Object.entries(entries)) {
        if (!key.startsWith(`${normBrand}::`)) continue;
        const entryDesc = key.slice(normBrand.length + 2).toUpperCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
        if (entryDesc.includes(modelToken) || entryDesc.startsWith(modelToken)) {
          const slug = String(profile?.default_silhouette_slug || "").trim();
          if (KNOWN_CATEGORIES.has(slug)) return slug;
          if (CATEGORY_ALIASES[slug]) return CATEGORY_ALIASES[slug];
        }
      }
    }
  }

  // 4. Exhaustive Text Token Matching covering all ERP vehicles
  const text = `${directSlug} ${brand.toLowerCase()} ${model.toLowerCase()}`;

  // 4.1 Bus Grande (Marcopolo, Autobús, Bus Interlocal, Pullman)
  if (
    text.includes("marcopolo") ||
    text.includes("bus grande") ||
    text.includes("autobus") ||
    text.includes("autobús") ||
    text.includes("pullman") ||
    text.includes("viaggio") ||
    text.includes("paradiso") ||
    text.includes("irizar") ||
    text.includes("busscar") ||
    text.includes("blue bird") ||
    text.includes("g8") ||
    text.includes("g7")
  ) {
    return "bus_grande_marcopolo";
  }

  // 4.2 Bus Mediano (Coaster, Civilian, Rosa, County, Cosmos)
  if (
    text.includes("coaster") ||
    text.includes("civilian") ||
    text.includes("rosa") ||
    text.includes("county") ||
    text.includes("cosmos") ||
    text.includes("bus mediano")
  ) {
    return "bus_mediano_coaster";
  }

  // 4.3 Camión 2 Cabinas / Doble Cabina
  if (
    (text.includes("camion") || text.includes("camión")) &&
    (text.includes("doble") || text.includes("2 cabina") || text.includes("dos cabina") || text.includes("crew"))
  ) {
    return "camion_2_cabinas";
  }

  // 4.4 Camión Furgón / Carga Cerrada
  if (
    (text.includes("camion") || text.includes("camión")) &&
    (text.includes("furgon") || text.includes("furgón") || text.includes("caja") || text.includes("termico") || text.includes("frio") || text.includes("frío"))
  ) {
    return "camion_carga_furgon";
  }

  // 4.5 Camión 1 Cabina / Baranda / Plataforma
  if (
    text.includes("camion") ||
    text.includes("camión") ||
    text.includes("k2700") ||
    text.includes("k2500") ||
    text.includes("k3000") ||
    text.includes("porter") ||
    text.includes("h100") ||
    text.includes("h-100") ||
    text.includes("dyna") ||
    text.includes("canter") ||
    text.includes("dutro") ||
    text.includes("npr") ||
    text.includes("nqr") ||
    text.includes("nhr") ||
    text.includes("forward") ||
    text.includes("hd72") ||
    text.includes("hd65") ||
    text.includes("cabstar") ||
    text.includes("camion-carga") ||
    text.includes("cabezal")
  ) {
    return "camion_1_cabina";
  }

  // 4.6 Camioneta Cabina y Media (Extra Cab / King Cab)
  if (
    text.includes("media") ||
    text.includes("cabina y media") ||
    text.includes("extra cab") ||
    text.includes("king cab") ||
    text.includes("supercab") ||
    text.includes("club cab") ||
    text.includes("space cab") ||
    text.includes("camioneta-cabina-y-media")
  ) {
    return "camioneta_cabina_media";
  }

  // 4.7 Camioneta 1 Cabina (Single Cab / Regular Cab)
  if (
    text.includes("1 cabina") ||
    text.includes("una cabina") ||
    text.includes("single cab") ||
    text.includes("regular cab") ||
    text.includes("cabina sencilla") ||
    text.includes("camioneta-1-cabina")
  ) {
    return "camioneta_1_cabina";
  }

  // 4.8 Camioneta Doble Cabina / Pick-up (Hilux, Frontier, D-Max, L200, Ranger, etc.)
  if (
    text.includes("doble cabina") ||
    text.includes("double cab") ||
    text.includes("crew cab") ||
    text.includes("hilux") ||
    text.includes("frontier") ||
    text.includes("d-max") ||
    text.includes("dmax") ||
    text.includes("l200") ||
    text.includes("ranger") ||
    text.includes("amarok") ||
    text.includes("tacoma") ||
    text.includes("tundra") ||
    text.includes("titan") ||
    text.includes("bt-50") ||
    text.includes("bt50") ||
    text.includes("navara") ||
    text.includes("colorado") ||
    text.includes("silverado") ||
    text.includes("f-150") ||
    text.includes("f150") ||
    text.includes("f-250") ||
    text.includes("f250") ||
    text.includes("ram 1500") ||
    text.includes("ram 2500") ||
    text.includes("ram") ||
    text.includes("poer") ||
    text.includes("wingle") ||
    text.includes("t60") ||
    text.includes("t90") ||
    text.includes("cannon") ||
    text.includes("gladiator") ||
    text.includes("ridgeline") ||
    text.includes("alaskan") ||
    text.includes("musso") ||
    text.includes("pickup") ||
    text.includes("pick-up")
  ) {
    return "camioneta_doble_cabina";
  }

  // 4.9 Panel de Carga / Furgón
  if (
    text.includes("panel") ||
    text.includes("carga") ||
    text.includes("furgon") ||
    text.includes("furgón") ||
    text.includes("van carga") ||
    text.includes("nv200") ||
    text.includes("partner") ||
    text.includes("berlingo") ||
    text.includes("kangoo") ||
    text.includes("caddy") ||
    text.includes("microbus-carga")
  ) {
    return "microbus_carga";
  }

  // 4.10 Microbús Techo Alto (Hiace High Roof, Urvan Techo Alto)
  if (
    text.includes("techo alto") ||
    text.includes("high roof") ||
    text.includes("gran hiace")
  ) {
    return "microbus_techo_alto";
  }

  // 4.11 Microbús / Minibús / Minivan / Van de Pasajeros
  if (
    text.includes("microbus") ||
    text.includes("microbús") ||
    text.includes("minibus") ||
    text.includes("minibús") ||
    text.includes("minivan") ||
    text.includes("van") ||
    text.includes("hiace") ||
    text.includes("urvan") ||
    text.includes("nv350") ||
    text.includes("h-1") ||
    text.includes("starex") ||
    text.includes("caravan") ||
    text.includes("grace") ||
    text.includes("transit") ||
    text.includes("sprinter") ||
    text.includes("carnival") ||
    text.includes("sedona") ||
    text.includes("sienna") ||
    text.includes("odyssey") ||
    text.includes("pacifica") ||
    text.includes("ertiga") ||
    text.includes("avanza") ||
    text.includes("xpander") ||
    text.includes("pasajero") ||
    text.includes("microbus-pasajeros")
  ) {
    return "microbus_pasajeros";
  }

  // 4.12 Station Wagon / Familiar
  if (
    text.includes("station") ||
    text.includes("wagon") ||
    text.includes("familiar") ||
    text.includes("probox") ||
    text.includes("succeed") ||
    text.includes("ad expert") ||
    text.includes("caldina") ||
    text.includes("wingroad") ||
    text.includes("fielder") ||
    text.includes("station-wagon")
  ) {
    return "station_wagon";
  }

  // 4.13 SUV / Camioneta Cerrada 4x4 / Crossover
  if (
    text.includes("suv") ||
    text.includes("camioneta") ||
    text.includes("crossover") ||
    text.includes("4x4") ||
    text.includes("4wd") ||
    text.includes("awd") ||
    text.includes("prado") ||
    text.includes("land cruiser") ||
    text.includes("rav4") ||
    text.includes("rav-4") ||
    text.includes("cr-v") ||
    text.includes("crv") ||
    text.includes("tucson") ||
    text.includes("sportage") ||
    text.includes("santa fe") ||
    text.includes("santafe") ||
    text.includes("sorento") ||
    text.includes("patrol") ||
    text.includes("pathfinder") ||
    text.includes("fortuner") ||
    text.includes("4runner") ||
    text.includes("everest") ||
    text.includes("montero") ||
    text.includes("pajero") ||
    text.includes("outlander") ||
    text.includes("asx") ||
    text.includes("explorer") ||
    text.includes("edge") ||
    text.includes("escape") ||
    text.includes("cherokee") ||
    text.includes("compass") ||
    text.includes("renegade") ||
    text.includes("forester") ||
    text.includes("outback") ||
    text.includes("crosstrek") ||
    text.includes("qashqai") ||
    text.includes("x-trail") ||
    text.includes("xtrail") ||
    text.includes("kicks") ||
    text.includes("duster") ||
    text.includes("captur") ||
    text.includes("tracker") ||
    text.includes("tahoe") ||
    text.includes("suburban") ||
    text.includes("equinox") ||
    text.includes("traverse") ||
    text.includes("creta") ||
    text.includes("venue") ||
    text.includes("palisade") ||
    text.includes("seltos") ||
    text.includes("telluride") ||
    text.includes("cx-3") ||
    text.includes("cx-30") ||
    text.includes("cx-5") ||
    text.includes("cx-50") ||
    text.includes("cx-60") ||
    text.includes("cx-9") ||
    text.includes("cx-90") ||
    text.includes("tiguan") ||
    text.includes("touareg") ||
    text.includes("taos") ||
    text.includes("t-cross") ||
    text.includes("nivus") ||
    text.includes("x1") ||
    text.includes("x3") ||
    text.includes("x5") ||
    text.includes("q3") ||
    text.includes("q5") ||
    text.includes("q7") ||
    text.includes("glc") ||
    text.includes("gle") ||
    text.includes("macan") ||
    text.includes("cayenne") ||
    text.includes("defender") ||
    text.includes("discovery") ||
    text.includes("evoque") ||
    text.includes("velar") ||
    text.includes("range rover") ||
    text.includes("rush") ||
    text.includes("terios") ||
    text.includes("jimny") ||
    text.includes("vitara") ||
    text.includes("grand vitara") ||
    text.includes("fronx") ||
    text.includes("haval") ||
    text.includes("tiggo") ||
    text.includes("coolray")
  ) {
    return "suv";
  }

  // 4.14 Default -> Sedán / Automóvil / Hatchback (Corolla, Civic, Yaris, Sentra, Elantra, etc.)
  return "sedan";
}

/**
 * Top-down SVG glass geometry calibrated per vehicle model (viewBox 0 0 200 360)
 */
export const VEHICLE_GLASS_GEOMETRY = {
  sedan: {
    windshield: {
      d: "M54,86 L146,86 L142,136 L58,136 Z",
      topStrip: "M60,124 L140,124 L142,136 L58,136 Z",
      bottomStrip: "M54,86 L146,86 L144,98 L56,98 Z",
      textY: 110,
      subY: 122,
    },
    front_sides: [
      { d: "M44,140 L58,140 L56,194 L42,194 Z" },
      { d: "M142,140 L156,140 L158,194 L144,194 Z" },
    ],
    rear_sides: [
      { d: "M42,198 L56,198 L54,248 L40,248 Z" },
      { d: "M144,198 L158,198 L160,248 L146,248 Z" },
    ],
    rear: {
      d: "M64,250 L136,250 L132,312 L68,312 Z",
      topStrip: "M64,250 L136,250 L135,260 L65,260 Z",
      bottomStrip: "M67,302 L133,302 L132,312 L68,312 Z",
      textY: 278,
      subY: 290,
    },
  },
  suv: {
    windshield: {
      d: "M52,86 L148,86 L144,136 L56,136 Z",
      topStrip: "M58,124 L142,124 L144,136 L56,136 Z",
      bottomStrip: "M52,86 L148,86 L146,98 L54,98 Z",
      textY: 110,
      subY: 122,
    },
    front_sides: [
      { d: "M42,140 L58,140 L56,196 L40,196 Z" },
      { d: "M142,140 L158,140 L160,196 L144,196 Z" },
    ],
    rear_sides: [
      { d: "M40,200 L56,200 L54,262 L38,262 Z" },
      { d: "M144,200 L160,200 L162,262 L146,262 Z" },
    ],
    rear: {
      d: "M62,264 L138,264 L134,318 L66,318 Z",
      topStrip: "M62,264 L138,264 L137,274 L63,274 Z",
      bottomStrip: "M65,308 L135,308 L134,318 L66,318 Z",
      textY: 288,
      subY: 300,
    },
  },
  camioneta_doble_cabina: {
    windshield: {
      d: "M56,96 L144,96 L148,138 L52,138 Z",
      topStrip: "M53,126 L147,126 L148,138 L52,138 Z",
      bottomStrip: "M56,96 L144,96 L142,108 L58,108 Z",
      textY: 114,
      subY: 126,
    },
    front_sides: [
      { d: "M44,142 L58,142 L58,182 L44,182 Z" },
      { d: "M142,142 L156,142 L156,182 L142,182 Z" },
    ],
    rear_sides: [
      { d: "M44,186 L58,186 L58,220 L44,220 Z" },
      { d: "M142,186 L156,186 L156,220 L142,220 Z" },
    ],
    rear: {
      d: "M60,222 L140,222 L138,238 L62,238 Z",
      topStrip: "M60,222 L140,222 L139,228 L61,228 Z",
      bottomStrip: "M61,232 L139,232 L138,238 L62,238 Z",
      textY: 230,
      subY: 235,
    },
  },
  camioneta_cabina_media: {
    windshield: {
      d: "M56,96 L144,96 L148,138 L52,138 Z",
      topStrip: "M53,126 L147,126 L148,138 L52,138 Z",
      bottomStrip: "M56,96 L144,96 L142,108 L58,108 Z",
      textY: 114,
      subY: 126,
    },
    front_sides: [
      { d: "M44,142 L58,142 L58,182 L44,182 Z" },
      { d: "M142,142 L156,142 L156,182 L142,182 Z" },
    ],
    rear_sides: [
      { d: "M45,186 L57,186 L57,208 L45,208 Z" },
      { d: "M143,186 L155,186 L155,208 L143,208 Z" },
    ],
    rear: {
      d: "M60,210 L140,210 L138,226 L62,226 Z",
      topStrip: "M60,210 L140,210 L139,216 L61,216 Z",
      bottomStrip: "M61,220 L139,220 L138,226 L62,226 Z",
      textY: 218,
      subY: 224,
    },
  },
  camioneta_1_cabina: {
    windshield: {
      d: "M56,96 L144,96 L148,138 L52,138 Z",
      topStrip: "M53,126 L147,126 L148,138 L52,138 Z",
      bottomStrip: "M56,96 L144,96 L142,108 L58,108 Z",
      textY: 114,
      subY: 126,
    },
    front_sides: [
      { d: "M44,142 L58,142 L58,188 L44,188 Z" },
      { d: "M142,142 L156,142 L156,188 L142,188 Z" },
    ],
    rear_sides: [],
    rear: {
      d: "M60,192 L140,192 L138,208 L62,208 Z",
      topStrip: "M60,192 L140,192 L139,198 L61,198 Z",
      bottomStrip: "M61,202 L139,202 L138,208 L62,208 Z",
      textY: 200,
      subY: 206,
    },
  },
  camion_1_cabina: {
    windshield: {
      d: "M46,80 L154,80 L152,126 L48,126 Z",
      topStrip: "M55,116 L145,116 L144,126 L56,126 Z",
      bottomStrip: "M46,80 L154,80 L152,92 L48,92 Z",
      textY: 102,
      subY: 114,
    },
    front_sides: [
      { d: "M40,130 L54,130 L54,178 L40,178 Z" },
      { d: "M146,130 L160,130 L160,178 L146,178 Z" },
    ],
    rear_sides: [],
    rear: {
      d: "M56,180 L144,180 L142,196 L58,196 Z",
      topStrip: "M56,180 L144,180 L143,186 L57,186 Z",
      bottomStrip: "M57,190 L143,190 L142,196 L58,196 Z",
      textY: 188,
      subY: 194,
    },
  },
  camion_2_cabinas: {
    windshield: {
      d: "M46,80 L154,80 L152,126 L48,126 Z",
      topStrip: "M55,116 L145,116 L144,126 L56,126 Z",
      bottomStrip: "M46,80 L154,80 L152,92 L48,92 Z",
      textY: 102,
      subY: 114,
    },
    front_sides: [
      { d: "M40,130 L54,130 L54,174 L40,174 Z" },
      { d: "M146,130 L160,130 L160,174 L146,174 Z" },
    ],
    rear_sides: [
      { d: "M40,178 L54,178 L54,216 L40,216 Z" },
      { d: "M146,178 L160,178 L160,216 L146,216 Z" },
    ],
    rear: {
      d: "M56,218 L144,218 L142,234 L58,234 Z",
      topStrip: "M56,218 L144,218 L143,224 L57,224 Z",
      bottomStrip: "M57,228 L143,228 L142,234 L58,234 Z",
      textY: 226,
      subY: 232,
    },
  },
  camion_carga_furgon: {
    windshield: {
      d: "M46,80 L154,80 L152,126 L48,126 Z",
      topStrip: "M55,116 L145,116 L144,126 L56,126 Z",
      bottomStrip: "M46,80 L154,80 L152,92 L48,92 Z",
      textY: 102,
      subY: 114,
    },
    front_sides: [
      { d: "M40,130 L54,130 L54,178 L40,178 Z" },
      { d: "M146,130 L160,130 L160,178 L146,178 Z" },
    ],
    rear_sides: [],
    rear: {
      d: "M56,180 L144,180 L142,196 L58,196 Z",
      topStrip: "M56,180 L144,180 L143,186 L57,186 Z",
      bottomStrip: "M57,190 L143,190 L142,196 L58,196 Z",
      textY: 188,
      subY: 194,
    },
  },

  station_wagon: {
    windshield: {
      d: "M54,76 L146,76 L138,130 L62,130 Z",
      topStrip: "M61,118 L139,118 L138,130 L62,130 Z",
      bottomStrip: "M54,76 L146,76 L144,88 L56,88 Z",
      textY: 102,
      subY: 115,
    },
    front_sides: [
      { d: "M46,134 L60,134 L58,192 L44,192 Z" },
      { d: "M140,134 L154,134 L156,192 L142,192 Z" },
    ],
    rear_sides: [
      { d: "M44,196 L58,196 L56,268 L42,268 Z" },
      { d: "M142,196 L156,196 L158,268 L144,268 Z" },
    ],
    rear: {
      d: "M64,270 L136,270 L132,328 L68,328 Z",
      topStrip: "M64,270 L136,270 L135,280 L65,280 Z",
      bottomStrip: "M67,318 L133,318 L132,328 L68,328 Z",
      textY: 292,
      subY: 306,
    },
  },
  microbus_pasajeros: {
    windshield: {
      d: "M50,70 L150,70 L144,128 L56,128 Z",
      topStrip: "M55,118 L145,118 L144,128 L56,128 Z",
      bottomStrip: "M50,70 L150,70 L148,82 L52,82 Z",
      textY: 98,
      subY: 111,
    },
    front_sides: [
      { d: "M42,132 L58,132 L56,188 L40,188 Z" },
      { d: "M142,132 L158,132 L160,188 L144,188 Z" },
    ],
    rear_sides: [
      { d: "M40,192 L56,192 L54,278 L38,278 Z" },
      { d: "M144,192 L160,192 L162,278 L146,278 Z" },
    ],
    rear: {
      d: "M58,282 L142,282 L138,322 L62,322 Z",
      topStrip: "M58,282 L142,282 L141,290 L59,290 Z",
      bottomStrip: "M61,314 L139,314 L138,322 L62,322 Z",
      textY: 300,
      subY: 313,
    },
  },
  microbus_techo_alto: {
    windshield: {
      d: "M50,68 L150,68 L144,128 L56,128 Z",
      topStrip: "M55,118 L145,118 L144,128 L56,128 Z",
      bottomStrip: "M50,68 L150,68 L148,80 L52,80 Z",
      textY: 98,
      subY: 111,
    },
    front_sides: [
      { d: "M42,132 L58,132 L56,188 L40,188 Z" },
      { d: "M142,132 L158,132 L160,188 L144,188 Z" },
    ],
    rear_sides: [
      { d: "M40,192 L56,192 L54,284 L38,284 Z" },
      { d: "M144,192 L160,192 L162,284 L146,284 Z" },
    ],
    rear: {
      d: "M58,286 L142,286 L138,326 L62,326 Z",
      topStrip: "M58,286 L142,286 L141,294 L59,294 Z",
      bottomStrip: "M61,318 L139,318 L138,326 L62,326 Z",
      textY: 304,
      subY: 317,
    },
  },
  microbus_carga: {
    windshield: {
      d: "M50,70 L150,70 L144,128 L56,128 Z",
      topStrip: "M55,118 L145,118 L144,128 L56,128 Z",
      bottomStrip: "M50,70 L150,70 L148,82 L52,82 Z",
      textY: 98,
      subY: 111,
    },
    front_sides: [
      { d: "M42,132 L58,132 L56,192 L40,192 Z" },
      { d: "M142,132 L158,132 L160,192 L144,192 Z" },
    ],
    rear_sides: [
      { d: "M40,196 L56,196 L54,278 L38,278 Z" },
      { d: "M144,196 L160,196 L162,278 L146,278 Z" },
    ],
    rear: {
      d: "M58,282 L142,282 L138,322 L62,322 Z",
      topStrip: "M58,282 L142,282 L141,290 L59,290 Z",
      bottomStrip: "M61,314 L139,314 L138,322 L62,322 Z",
      textY: 300,
      subY: 313,
    },
  },
  bus_mediano_coaster: {
    windshield: {
      d: "M50,56 L150,56 L146,110 L54,110 Z",
      topStrip: "M55,100 L145,100 L146,110 L54,110 Z",
      bottomStrip: "M50,56 L150,56 L148,68 L52,68 Z",
      textY: 82,
      subY: 96,
    },
    front_sides: [
      { d: "M44,114 L58,114 L56,160 L42,160 Z" },
      { d: "M142,114 L156,114 L158,160 L144,160 Z" },
    ],
    rear_sides: [
      { d: "M42,164 L56,164 L54,300 L40,300 Z" },
      { d: "M144,164 L158,164 L160,300 L146,300 Z" },
    ],
    rear: {
      d: "M56,306 L144,306 L140,336 L60,336 Z",
      topStrip: "M56,306 L144,306 L143,314 L57,314 Z",
      bottomStrip: "M59,328 L141,328 L140,336 L60,336 Z",
      textY: 318,
      subY: 328,
    },
  },
  bus_grande_marcopolo: {
    windshield: {
      d: "M52,50 L148,50 L144,115 L56,115 Z",
      topStrip: "M57,105 L143,105 L144,115 L56,115 Z",
      bottomStrip: "M52,50 L148,50 L146,65 L54,65 Z",
      textY: 85,
      subY: 100,
    },
    front_sides: [
      { d: "M46,118 L58,118 L56,160 L44,160 Z" },
      { d: "M142,118 L154,118 L156,160 L144,160 Z" },
    ],
    rear_sides: [
      { d: "M44,164 L56,164 L54,310 L42,310 Z" },
      { d: "M144,164 L156,164 L158,310 L146,310 Z" },
    ],
    rear: {
      d: "M56,316 L144,316 L140,344 L60,344 Z",
      topStrip: "M56,316 L144,316 L143,324 L57,324 Z",
      bottomStrip: "M59,336 L141,336 L140,344 L60,344 Z",
      textY: 326,
      subY: 336,
    },
  },
};

/**
 * Coordenadas de polígonos SVG laterales calibradas por categoría de vehículo (viewBox 0 0 640 360)
 */
export const LATERAL_GLASS_GEOMETRY = {
  camioneta_doble_cabina: {
    front: "M 216,92 L 302,92 L 302,138 L 186,138 Z",
    rear: "M 326,92 L 388,92 L 419,133 L 419,138 L 326,138 Z",
    frontText: { x: 250, y: 118 },
    rearText: { x: 368, y: 118 },
  },
  pickup: {
    front: "M 216,92 L 302,92 L 302,138 L 186,138 Z",
    rear: "M 326,92 L 388,92 L 419,133 L 419,138 L 326,138 Z",
    frontText: { x: 250, y: 118 },
    rearText: { x: 368, y: 118 },
  },
  camioneta_cabina_media: {
    front: "M 216,92 L 302,92 L 302,138 L 186,138 Z",
    rear: "M 326,92 L 388,92 L 419,133 L 419,138 L 326,138 Z",
    frontText: { x: 250, y: 118 },
    rearText: { x: 368, y: 118 },
  },
  camioneta_1_cabina: {
    front: "M 216,92 L 320,92 L 320,138 L 186,138 Z",
    rear: "",
    frontText: { x: 260, y: 118 },
    rearText: { x: 0, y: 0 },
  },
  sedan: {
    front: "M 188,102 L 272,102 L 272,146 L 168,146 Z",
    rear: "M 284,102 L 368,102 L 416,138 L 416,146 L 284,146 Z",
    frontText: { x: 232, y: 126 },
    rearText: { x: 348, y: 126 },
  },
  hatchback: {
    front: "M 188,102 L 272,102 L 272,146 L 168,146 Z",
    rear: "M 284,102 L 368,102 L 416,138 L 416,146 L 284,146 Z",
    frontText: { x: 232, y: 126 },
    rearText: { x: 348, y: 126 },
  },
  suv: {
    front: "M 205,96 L 288,96 L 288,142 L 180,142 Z",
    rear: "M 300,96 L 380,96 L 420,135 L 420,142 L 300,142 Z",
    frontText: { x: 246, y: 120 },
    rearText: { x: 360, y: 120 },
  },
  station_wagon: {
    front: "M 205,96 L 288,96 L 288,142 L 180,142 Z",
    rear: "M 300,96 L 380,96 L 420,135 L 420,142 L 300,142 Z",
    frontText: { x: 246, y: 120 },
    rearText: { x: 360, y: 120 },
  },
  microbus_pasajeros: {
    front: "M 160,90 L 250,90 L 250,142 L 130,142 Z",
    rear: "M 260,90 L 460,90 L 460,142 L 260,142 Z",
    frontText: { x: 200, y: 120 },
    rearText: { x: 360, y: 120 },
  },
  microbus_carga: {
    front: "M 160,90 L 250,90 L 250,142 L 130,142 Z",
    rear: "",
    frontText: { x: 200, y: 120 },
    rearText: { x: 0, y: 0 },
  },
  camion_1_cabina: {
    front: "M 160,90 L 260,90 L 260,142 L 130,142 Z",
    rear: "",
    frontText: { x: 200, y: 120 },
    rearText: { x: 0, y: 0 },
  },
  camion_2_cabinas: {
    front: "M 160,90 L 240,90 L 240,142 L 130,142 Z",
    rear: "M 250,90 L 330,90 L 330,142 L 250,142 Z",
    frontText: { x: 195, y: 120 },
    rearText: { x: 290, y: 120 },
  },
};

