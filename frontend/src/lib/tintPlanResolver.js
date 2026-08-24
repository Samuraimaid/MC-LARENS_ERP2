/**
 * Intelligent Tint Plan Preselector & Scope Resolver for MC-LARENS ERP
 * Infers service type, contracted zones, sunstrips, shades, and gamas based on product SKU, name, description, and metadata.
 * Restricts editable zones so non-contracted windows are locked to "none" preventing accidental billing or roll consumption.
 */

export function detectTintPlanFromProduct(product, vehicle) {
  if (!product) return null;

  const name = String(product.name || "").toLowerCase();
  const sku = String(product.sku || "").toUpperCase();
  const desc = String(product.description || "").toLowerCase();
  const subcat = String(product.subcategory || "").toLowerCase();
  const category = String(product.category || "").toLowerCase();
  const polarizadoType = String(product.polarizado_type || "").toLowerCase();
  const windowOpts = Array.isArray(product.window_options)
    ? product.window_options.map((o) => String(o).toLowerCase())
    : [];

  const text = `${name} ${sku} ${desc} ${subcat} ${category} ${polarizadoType} ${windowOpts.join(" ")}`;

  // 1. Detectar Gama Oficial
  let detectedGama = "all";
  if (
    text.includes("nano") ||
    text.includes("cerámic") ||
    text.includes("ceramic") ||
    text.includes("supreme") ||
    text.includes("solstice") ||
    text.includes("camaleon") ||
    text.includes("titanium") ||
    sku.includes("NC-")
  ) {
    detectedGama = "nano_ceramico";
  } else if (
    text.includes("quantum") ||
    text.includes("endeavor") ||
    text.includes("premium") ||
    text.includes("carbon") ||
    sku.includes("CS-") ||
    sku.includes("PREM")
  ) {
    detectedGama = "gama_premium";
  } else if (
    text.includes("tinmax") ||
    text.includes("smoke") ||
    text.includes("charcoal") ||
    text.includes("sungard") ||
    sku.includes("SG-")
  ) {
    detectedGama = "tinmax";
  } else if (
    text.includes("estandar") ||
    text.includes("estándar") ||
    text.includes("standard") ||
    text.includes("económic") ||
    text.includes("economica") ||
    sku.includes("STD-")
  ) {
    detectedGama = "gama_economica";
  }

  // 2. Detectar Tonalidad / VLT
  let detectedVlt = 20;
  if (
    text.includes("70%") ||
    text.includes(" 70 ") ||
    text.includes("claro") ||
    text.includes("solstice 70")
  ) {
    detectedVlt = 70;
  } else if (
    text.includes("35%") ||
    text.includes("38%") ||
    text.includes("42%") ||
    text.includes("medio")
  ) {
    detectedVlt = 35;
  } else if (
    text.includes("5%") ||
    text.includes("05%") ||
    text.includes("4%") ||
    text.includes("04%") ||
    text.includes("limo") ||
    text.includes("oscuro total")
  ) {
    detectedVlt = 5;
  } else if (
    text.includes("20%") ||
    text.includes("19%") ||
    text.includes("14%") ||
    text.includes("26%") ||
    text.includes("intermedio") ||
    text.includes("oscuro")
  ) {
    detectedVlt = 20;
  }

  // 3. Resolver Material Base idóneo para la zona según Gama y VLT
  let baseSidesMaterial = "std_20";
  let baseWindshieldMaterial = "std_70";

  if (detectedGama === "nano_ceramico") {
    if (detectedVlt === 5) baseSidesMaterial = "nc_supreme_04";
    else if (detectedVlt === 35) baseSidesMaterial = "nc_supreme_42";
    else baseSidesMaterial = "nc_supreme_20";

    baseWindshieldMaterial = detectedVlt === 70 ? "nc_solstice_70" : "nc_supreme_42";
  } else if (detectedGama === "gama_premium") {
    if (detectedVlt === 5) baseSidesMaterial = "cs_endeavor_05";
    else if (detectedVlt === 35) baseSidesMaterial = "cs_quantum_28";
    else baseSidesMaterial = "cs_quantum_19";

    baseWindshieldMaterial = detectedVlt === 70 ? "cs_quantum_28" : "cs_quantum_19";
  } else if (detectedGama === "tinmax") {
    if (detectedVlt === 5) baseSidesMaterial = "sg_charcoal_05";
    else if (detectedVlt === 35) baseSidesMaterial = "sg_smoke_35";
    else baseSidesMaterial = "sg_charcoal_20";

    baseWindshieldMaterial = "sg_smoke_35";
  } else {
    if (detectedVlt === 5) baseSidesMaterial = "std_05";
    else if (detectedVlt === 35) baseSidesMaterial = "std_35";
    else baseSidesMaterial = "std_20";

    baseWindshieldMaterial = "std_70";
  }

  // 4. Clasificación de tipo de producto y zonas objetivo
  const isSunstrip =
    text.includes("franja") ||
    text.includes("banda") ||
    text.includes("visera") ||
    text.includes("sunstrip") ||
    sku.startsWith("POL-FRA") ||
    subcat.includes("franja") ||
    windowOpts.includes("franja_superior");

  const isFrontSidesOnly =
    text.includes("solo vidrios delanteros") ||
    text.includes("vidrios delanteros") ||
    text.includes("solo delanteros") ||
    text.includes("laterales delanteros") ||
    sku.startsWith("POL-DEL") ||
    subcat.includes("delanteros") ||
    windowOpts.includes("delanteros");

  const isWindshieldOnly =
    (text.includes("parabrisas delantero") ||
      text.includes("solo parabrisas") ||
      sku.startsWith("POL-PAR") ||
      windowOpts.includes("parabrisas")) &&
    !isSunstrip;

  const isRearOnly =
    text.includes("vidrio trasero") ||
    text.includes("solo trasero") ||
    text.includes("luneta") ||
    text.includes("parabrisas trasero") ||
    sku.startsWith("POL-TRA") ||
    windowOpts.includes("trasero");

  const isSidesAndRearOnly =
    text.includes("solo laterales y trasero") ||
    text.includes("laterales y trasero") ||
    sku.startsWith("POL-LAT") ||
    windowOpts.includes("laterales_trasero");

  // CASO A: Banda Frontal / Franja Superior Parabrisas (SOLO BANDA)
  if (isSunstrip) {
    return {
      serviceType: "franja_superior",
      serviceLabel: "Banda Frontal / Franja Superior",
      allowedZones: [], // No se polariza ningún cristal completo
      allowedSunstrips: ["windshield_top"],
      isSunstripOnly: true,
      activeZone: "windshield",
      viewMode: "top", // Muestra la vista de planta donde la banda superior brilla en el parabrisas
      selectedGama,
      linkSides: false,
      selectedMaterials: {
        windshield: "none",
        front_sides: "none",
        rear_sides: "none",
        rear: "none",
      },
      sunstrips: {
        windshield_top: { enabled: true, material_id: baseSidesMaterial },
        windshield_bottom: { enabled: false, material_id: baseSidesMaterial },
        rear_top: { enabled: false, material_id: baseSidesMaterial },
        rear_bottom: { enabled: false, material_id: baseSidesMaterial },
      },
      badgeNote: "Banda Frontal Superior (Cristales completos bloqueados)",
      lockedExplanation: "Servicio de Banda Frontal: Los cristales completos están bloqueados para evitar consumos de rollos indebidos.",
    };
  }

  // CASO B: Solo Vidrios Delanteros (SOLO FRONT SIDES)
  if (isFrontSidesOnly) {
    return {
      serviceType: "vidrios_delanteros",
      serviceLabel: "Solo Vidrios Delanteros",
      allowedZones: ["front_sides"],
      allowedSunstrips: [],
      isSunstripOnly: false,
      activeZone: "front_sides",
      viewMode: "lateral",
      selectedGama,
      linkSides: false,
      selectedMaterials: {
        windshield: "none",
        front_sides: baseSidesMaterial,
        rear_sides: "none",
        rear: "none",
      },
      sunstrips: {
        windshield_top: { enabled: false, material_id: "std_20" },
        windshield_bottom: { enabled: false, material_id: "std_20" },
        rear_top: { enabled: false, material_id: "std_20" },
        rear_bottom: { enabled: false, material_id: "std_20" },
      },
      badgeNote: `Vidrios Delanteros: ${detectedVlt}% (Resto de zonas bloqueadas)`,
      lockedExplanation: "Paquete de Solo Vidrios Delanteros: Parabrisas y vidrios traseros bloqueados.",
    };
  }

  // CASO C: Parabrisas Delantero Completo
  if (isWindshieldOnly) {
    return {
      serviceType: "parabrisas_delantero",
      serviceLabel: "Parabrisas Delantero",
      allowedZones: ["windshield"],
      allowedSunstrips: ["windshield_top", "windshield_bottom"],
      isSunstripOnly: false,
      activeZone: "windshield",
      viewMode: "lateral",
      selectedGama,
      linkSides: false,
      selectedMaterials: {
        windshield: baseWindshieldMaterial,
        front_sides: "none",
        rear_sides: "none",
        rear: "none",
      },
      sunstrips: {
        windshield_top: { enabled: false, material_id: "std_20" },
        windshield_bottom: { enabled: false, material_id: "std_20" },
        rear_top: { enabled: false, material_id: "std_20" },
        rear_bottom: { enabled: false, material_id: "std_20" },
      },
      badgeNote: `Parabrisas Delantero: ${detectedVlt === 70 ? "70% Claro" : "Antirreflejo"}`,
      lockedExplanation: "Paquete Parabrisas Delantero: Ventanas laterales y trasero bloqueados.",
    };
  }

  // CASO D: Vidrio Trasero / Luneta
  if (isRearOnly) {
    return {
      serviceType: "vidrio_trasero",
      serviceLabel: "Vidrio Trasero / Luneta",
      allowedZones: ["rear"],
      allowedSunstrips: ["rear_top", "rear_bottom"],
      isSunstripOnly: false,
      activeZone: "rear",
      viewMode: "top",
      selectedGama,
      linkSides: false,
      selectedMaterials: {
        windshield: "none",
        front_sides: "none",
        rear_sides: "none",
        rear: baseSidesMaterial,
      },
      sunstrips: {
        windshield_top: { enabled: false, material_id: "std_20" },
        windshield_bottom: { enabled: false, material_id: "std_20" },
        rear_top: { enabled: false, material_id: "std_20" },
        rear_bottom: { enabled: false, material_id: "std_20" },
      },
      badgeNote: `Vidrio Trasero: ${detectedVlt}%`,
      lockedExplanation: "Paquete Vidrio Trasero: Parabrisas y laterales bloqueados.",
    };
  }

  // CASO E: Solo Laterales y Trasero
  if (isSidesAndRearOnly) {
    return {
      serviceType: "laterales_y_trasero",
      serviceLabel: "Laterales y Vidrio Trasero",
      allowedZones: ["front_sides", "rear_sides", "rear"],
      allowedSunstrips: ["rear_top", "rear_bottom"],
      isSunstripOnly: false,
      activeZone: "front_sides",
      viewMode: "lateral",
      selectedGama,
      linkSides: true,
      selectedMaterials: {
        windshield: "none",
        front_sides: baseSidesMaterial,
        rear_sides: baseSidesMaterial,
        rear: baseSidesMaterial,
      },
      sunstrips: {
        windshield_top: { enabled: false, material_id: "std_20" },
        windshield_bottom: { enabled: false, material_id: "std_20" },
        rear_top: { enabled: false, material_id: "std_20" },
        rear_bottom: { enabled: false, material_id: "std_20" },
      },
      badgeNote: `Laterales + Trasero: ${detectedVlt}% (Parabrisas delantero bloqueado)`,
      lockedExplanation: "Paquete Laterales y Trasero: Parabrisas delantero no incluido.",
    };
  }

  // CASO F: Polarizado Completo (Por defecto para POL-*-COM o genérico)
  return {
    serviceType: "completo",
    serviceLabel: "Polarizado Completo",
    allowedZones: ["windshield", "front_sides", "rear_sides", "rear"],
    allowedSunstrips: ["windshield_top", "windshield_bottom", "rear_top", "rear_bottom"],
    isSunstripOnly: false,
    activeZone: "windshield",
    viewMode: "lateral",
    selectedGama,
    linkSides: true,
    selectedMaterials: {
      windshield: baseWindshieldMaterial,
      front_sides: baseSidesMaterial,
      rear_sides: baseSidesMaterial,
      rear: baseSidesMaterial,
    },
    sunstrips: {
      windshield_top: { enabled: false, material_id: "std_20" },
      windshield_bottom: { enabled: false, material_id: "std_20" },
      rear_top: { enabled: false, material_id: "std_20" },
      rear_bottom: { enabled: false, material_id: "std_20" },
    },
    badgeNote: `Polarizado Completo (${detectedVlt}%)`,
    lockedExplanation: null,
  };
}
