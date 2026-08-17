/**
 * Vehicle top-down category and silhouette resolver for MC-LARENS ERP
 * Supporting full comprehensive range of 14 vehicle body types with real high-res top-down renders.
 */

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

  // 1. Bus Grande (Marcopolo, Autobús, Bus Interlocal)
  if (
    text.includes("marcopolo") ||
    text.includes("bus grande") ||
    text.includes("autobus") ||
    text.includes("autobús") ||
    text.includes("pullman") ||
    text.includes("g8")
  ) {
    return "bus_grande_marcopolo";
  }

  // 2. Bus Mediano (Coaster, Civilian, Rosa)
  if (
    text.includes("coaster") ||
    text.includes("civilian") ||
    text.includes("rosa") ||
    text.includes("bus mediano")
  ) {
    return "bus_mediano_coaster";
  }

  // 3. Camión 2 Cabinas / Doble Cabina
  if (
    (text.includes("camion") || text.includes("camión")) &&
    (text.includes("doble") || text.includes("2 cabina") || text.includes("dos cabina"))
  ) {
    return "camion_2_cabinas";
  }

  // 4. Camión Furgón / Carga Cerrada
  if (
    (text.includes("camion") || text.includes("camión")) &&
    (text.includes("furgon") || text.includes("furgón") || text.includes("caja") || text.includes("termico") || text.includes("frio"))
  ) {
    return "camion_carga_furgon";
  }

  // 5. Camión 1 Cabina / Baranda / Plataforma
  if (
    text.includes("camion") ||
    text.includes("camión") ||
    text.includes("k2700") ||
    text.includes("k2500") ||
    text.includes("k3000") ||
    text.includes("porter") ||
    text.includes("h100") ||
    text.includes("dyna") ||
    text.includes("canter") ||
    text.includes("camion-carga") ||
    text.includes("cabezal")
  ) {
    return "camion_1_cabina";
  }

  // 6. Camioneta Cabina y Media (Extra Cab / King Cab)
  if (
    text.includes("media") ||
    text.includes("cabina y media") ||
    text.includes("extra cab") ||
    text.includes("king cab") ||
    text.includes("supercab") ||
    text.includes("club cab") ||
    text.includes("camioneta-cabina-y-media")
  ) {
    return "camioneta_cabina_media";
  }

  // 7. Camioneta 1 Cabina (Single Cab / Regular Cab)
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

  // 8. Camioneta Doble Cabina
  if (
    text.includes("doble cabina") ||
    text.includes("double cab") ||
    text.includes("crew cab")
  ) {
    return "camioneta_doble_cabina";
  }

  // 9. Panel de Carga / Furgón
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

  // 10. Microbús Techo Alto (Hiace High Roof, Urvan Techo Alto)
  if (
    text.includes("techo alto") ||
    text.includes("high roof") ||
    text.includes("gran hiace")
  ) {
    return "microbus_techo_alto";
  }

  // 11. Microbús / Minibús / Minivan / Van de Pasajeros
  if (
    text.includes("microbus") ||
    text.includes("microbús") ||
    text.includes("minibus") ||
    text.includes("minibús") ||
    text.includes("minivan") ||
    text.includes("van") ||
    text.includes("hiace") ||
    text.includes("urvan") ||
    text.includes("pasajero") ||
    text.includes("microbus-pasajeros")
  ) {
    return "microbus_pasajeros";
  }

  // 12. Station Wagon / Familiar
  if (
    text.includes("station") ||
    text.includes("wagon") ||
    text.includes("familiar") ||
    text.includes("probox") ||
    text.includes("ad expert") ||
    text.includes("succeed") ||
    text.includes("station-wagon")
  ) {
    return "station_wagon";
  }

  // 13. SUV / Camioneta 4x4 / Crossover / Pick-up
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
    text.includes("crossover")
  ) {
    return "suv";
  }

  // 14. Default -> Sedán / Hatchback
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
  camioneta_doble_cabina: {
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
      { d: "M42,200 L58,200 L56,252 L40,252 Z" },
      { d: "M142,200 L158,200 L160,252 L144,252 Z" },
    ],
    rear: {
      d: "M60,250 L140,250 L138,266 L62,266 Z",
      topStrip: "M60,250 L140,250 L139,256 L61,256 Z",
      bottomStrip: "M61,260 L139,260 L138,266 L62,266 Z",
      textY: 258,
      subY: 264,
    },
  },
  camioneta_cabina_media: {
    windshield: {
      d: "M52,76 L148,76 L140,134 L60,134 Z",
      topStrip: "M52,76 L148,76 L146,88 L54,88 Z",
      bottomStrip: "M59,124 L141,124 L140,134 L60,134 Z",
      textY: 104,
      subY: 117,
    },
    front_sides: [
      { d: "M44,138 L60,138 L58,192 L42,192 Z" },
      { d: "M140,138 L156,138 L158,192 L142,192 Z" },
    ],
    rear_sides: [
      { d: "M42,196 L56,196 L54,232 L40,232 Z" },
      { d: "M144,196 L158,196 L160,232 L146,232 Z" },
    ],
    rear: {
      d: "M60,228 L140,228 L138,244 L62,244 Z",
      topStrip: "M60,228 L140,228 L139,234 L61,234 Z",
      bottomStrip: "M61,238 L139,238 L138,244 L62,244 Z",
      textY: 236,
      subY: 242,
    },
  },
  camioneta_1_cabina: {
    windshield: {
      d: "M52,76 L148,76 L140,134 L60,134 Z",
      topStrip: "M52,76 L148,76 L146,88 L54,88 Z",
      bottomStrip: "M59,124 L141,124 L140,134 L60,134 Z",
      textY: 104,
      subY: 117,
    },
    front_sides: [
      { d: "M44,138 L60,138 L58,198 L42,198 Z" },
      { d: "M140,138 L156,138 L158,198 L142,198 Z" },
    ],
    rear_sides: [],
    rear: {
      d: "M60,198 L140,198 L138,214 L62,214 Z",
      topStrip: "M60,198 L140,198 L139,204 L61,204 Z",
      bottomStrip: "M61,208 L139,208 L138,214 L62,214 Z",
      textY: 206,
      subY: 212,
    },
  },
  camion_1_cabina: {
    windshield: {
      d: "M50,70 L150,70 L144,130 L56,130 Z",
      topStrip: "M50,70 L150,70 L148,82 L52,82 Z",
      bottomStrip: "M55,120 L145,120 L144,130 L56,130 Z",
      textY: 100,
      subY: 113,
    },
    front_sides: [
      { d: "M42,134 L58,134 L56,196 L40,196 Z" },
      { d: "M142,134 L158,134 L160,196 L144,196 Z" },
    ],
    rear_sides: [],
    rear: {
      d: "M60,196 L140,196 L138,214 L62,214 Z",
      topStrip: "M60,196 L140,196 L139,202 L61,202 Z",
      bottomStrip: "M61,208 L139,208 L138,214 L62,214 Z",
      textY: 205,
      subY: 211,
    },
  },
  camion_2_cabinas: {
    windshield: {
      d: "M50,70 L150,70 L144,130 L56,130 Z",
      topStrip: "M50,70 L150,70 L148,82 L52,82 Z",
      bottomStrip: "M55,120 L145,120 L144,130 L56,130 Z",
      textY: 100,
      subY: 113,
    },
    front_sides: [
      { d: "M42,134 L58,134 L56,194 L40,194 Z" },
      { d: "M142,134 L158,134 L160,194 L144,194 Z" },
    ],
    rear_sides: [
      { d: "M40,198 L56,198 L54,250 L38,250 Z" },
      { d: "M144,198 L160,198 L162,250 L146,250 Z" },
    ],
    rear: {
      d: "M60,248 L140,248 L138,264 L62,264 Z",
      topStrip: "M60,248 L140,248 L139,254 L61,254 Z",
      bottomStrip: "M61,258 L139,258 L138,264 L62,264 Z",
      textY: 256,
      subY: 262,
    },
  },
  camion_carga_furgon: {
    windshield: {
      d: "M50,70 L150,70 L144,130 L56,130 Z",
      topStrip: "M50,70 L150,70 L148,82 L52,82 Z",
      bottomStrip: "M55,120 L145,120 L144,130 L56,130 Z",
      textY: 100,
      subY: 113,
    },
    front_sides: [
      { d: "M42,134 L58,134 L56,194 L40,194 Z" },
      { d: "M142,134 L158,134 L160,194 L144,194 Z" },
    ],
    rear_sides: [],
    rear: {
      d: "M60,196 L140,196 L138,212 L62,212 Z",
      topStrip: "M60,196 L140,196 L139,202 L61,202 Z",
      bottomStrip: "M61,208 L139,208 L138,212 L62,212 Z",
      textY: 204,
      subY: 210,
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
  microbus_techo_alto: {
    windshield: {
      d: "M50,68 L150,68 L144,128 L56,128 Z",
      topStrip: "M50,68 L150,68 L148,80 L52,80 Z",
      bottomStrip: "M55,118 L145,118 L144,128 L56,128 Z",
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
  bus_mediano_coaster: {
    windshield: {
      d: "M50,56 L150,56 L146,110 L54,110 Z",
      topStrip: "M50,56 L150,56 L148,68 L52,68 Z",
      bottomStrip: "M55,100 L145,100 L146,110 L54,110 Z",
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
      topStrip: "M52,50 L148,50 L146,65 L54,65 Z",
      bottomStrip: "M57,105 L143,105 L144,115 L56,115 Z",
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
