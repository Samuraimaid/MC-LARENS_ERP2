/**
 * Vehicle top-down category and silhouette resolver for MC-LARENS ERP
 */

export const VEHICLE_CATEGORIES = [
  { id: "sedan", label: "Sedán / Automóvil", shortLabel: "Sedán", image: "/vehicles/clean_sedan.png" },
  { id: "suv", label: "SUV / Camioneta", shortLabel: "SUV / 4x4", image: "/vehicles/clean_suv.png" },
  { id: "station_wagon", label: "Station Wagon", shortLabel: "Station Wagon", image: "/vehicles/clean_station_wagon.png" },
  { id: "microbus_pasajeros", label: "Microbús Pasajeros", shortLabel: "Microbús", image: "/vehicles/clean_microbus_pasajeros.png" },
  { id: "microbus_carga", label: "Microbús Panel Carga", shortLabel: "Panel Carga", image: "/vehicles/clean_microbus_carga.png" },
];

/**
 * Resolves the vehicle category based on vehicle object metadata
 */
export function resolveVehicleCategory(vehicle) {
  if (!vehicle) return "sedan";
  const slug = String(
    vehicle.vehicle_type_slug ||
    vehicle.type ||
    vehicle.body_type ||
    vehicle.category ||
    ""
  ).toLowerCase();
  
  const brand = String(vehicle.brand || "").toLowerCase();
  const model = String(vehicle.model || "").toLowerCase();
  const text = `${slug} ${brand} ${model}`;

  // 1. Panel de Carga / Furgón
  if (
    text.includes("panel") ||
    text.includes("carga") ||
    text.includes("furgon") ||
    text.includes("furgón") ||
    text.includes("van carga") ||
    text.includes("microbus-carga")
  ) {
    return "microbus_carga";
  }

  // 2. Microbús / Minibús / Minivan / Bus
  if (
    text.includes("microbus") ||
    text.includes("microbús") ||
    text.includes("minibus") ||
    text.includes("minibús") ||
    text.includes("minivan") ||
    text.includes("van") ||
    text.includes("hiace") ||
    text.includes("urvan") ||
    text.includes("coaster") ||
    text.includes("pasajero") ||
    text.includes("microbus-pasajeros")
  ) {
    return "microbus_pasajeros";
  }

  // 3. Station Wagon / Familiar
  if (
    text.includes("station") ||
    text.includes("wagon") ||
    text.includes("familiar") ||
    text.includes("probox") ||
    text.includes("ad expert") ||
    text.includes("station-wagon")
  ) {
    return "station_wagon";
  }

  // 4. SUV / Camioneta / 4x4 / Pick-up
  if (
    text.includes("suv") ||
    text.includes("camioneta") ||
    text.includes("pickup") ||
    text.includes("pick-up") ||
    text.includes("hilux") ||
    text.includes("prado") ||
    text.includes("land cruiser") ||
    text.includes("rav4") ||
    text.includes("cr-v") ||
    text.includes("crv") ||
    text.includes("d-max") ||
    text.includes("dmax") ||
    text.includes("frontier") ||
    text.includes("l200") ||
    text.includes("tucson") ||
    text.includes("sportage") ||
    text.includes("patrol") ||
    text.includes("4x4") ||
    text.includes("crossover") ||
    text.includes("camioneta-1-cabina") ||
    text.includes("camioneta-cabina-y-media")
  ) {
    return "suv";
  }

  // 5. Default -> Sedán / Hatchback
  return "sedan";
}

/**
 * Top-down SVG glass geometry calibrated per vehicle model (viewBox 0 0 200 360)
 */
export const VEHICLE_GLASS_GEOMETRY = {
  sedan: {
    windshield: {
      d: "M54,78 L146,78 L138,132 L62,132 Z",
      topStrip: "M54,78 L146,78 L144,90 L56,90 Z",
      bottomStrip: "M61,122 L139,122 L138,132 L62,132 Z",
      textY: 105,
      subY: 118,
    },
    front_sides: [
      { d: "M46,136 L62,136 L60,192 L44,192 Z" },
      { d: "M138,136 L154,136 L156,192 L140,192 Z" },
    ],
    rear_sides: [
      { d: "M44,196 L58,196 L56,248 L42,248 Z" },
      { d: "M142,196 L156,196 L158,248 L144,248 Z" },
    ],
    rear: {
      d: "M66,252 L134,252 L128,294 L72,294 Z",
      topStrip: "M66,252 L134,252 L133,260 L67,260 Z",
      bottomStrip: "M71,286 L129,286 L128,294 L72,294 Z",
      textY: 271,
      subY: 284,
    },
  },
  suv: {
    windshield: {
      d: "M52,76 L148,76 L140,134 L60,134 Z",
      topStrip: "M52,76 L148,76 L146,88 L54,88 Z",
      bottomStrip: "M59,124 L141,124 L140,134 L60,134 Z",
      textY: 104,
      subY: 117,
    },
    front_sides: [
      { d: "M44,138 L60,138 L58,196 L42,196 Z" },
      { d: "M140,138 L156,138 L158,196 L142,196 Z" },
    ],
    rear_sides: [
      { d: "M42,200 L58,200 L56,262 L40,262 Z" },
      { d: "M142,200 L158,200 L160,262 L144,262 Z" },
    ],
    rear: {
      d: "M62,266 L138,266 L132,308 L68,308 Z",
      topStrip: "M62,266 L138,266 L137,274 L63,274 Z",
      bottomStrip: "M67,300 L133,300 L132,308 L68,308 Z",
      textY: 284,
      subY: 297,
    },
  },
  station_wagon: {
    windshield: {
      d: "M54,76 L146,76 L138,130 L62,130 Z",
      topStrip: "M54,76 L146,76 L144,88 L56,88 Z",
      bottomStrip: "M61,120 L139,120 L138,130 L62,130 Z",
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
      d: "M64,272 L136,272 L130,314 L70,314 Z",
      topStrip: "M64,272 L136,272 L135,280 L65,280 Z",
      bottomStrip: "M69,306 L131,306 L130,314 L70,314 Z",
      textY: 290,
      subY: 303,
    },
  },
  microbus_pasajeros: {
    windshield: {
      d: "M50,70 L150,70 L144,128 L56,128 Z",
      topStrip: "M50,70 L150,70 L148,82 L52,82 Z",
      bottomStrip: "M55,118 L145,118 L144,128 L56,128 Z",
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
  microbus_carga: {
    windshield: {
      d: "M50,70 L150,70 L144,128 L56,128 Z",
      topStrip: "M50,70 L150,70 L148,82 L52,82 Z",
      bottomStrip: "M55,118 L145,118 L144,128 L56,128 Z",
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
};
