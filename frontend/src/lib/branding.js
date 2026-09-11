export const TOPCAR_BRANCH_IDS = new Set(["branch_north", "branch_south"]);

export const BRANCH_LABELS = {
  branch_main: "Mundo de Accesorios",
  branch_north: "TopCar El Calvario",
  branch_south: "TopCar La Tigre",
  all: "Todas las sucursales",
  central: "Mando Central / Todas",
};

export const GLOBAL_BRANCH_ROLES = new Set([
  "gerencia",
  "supervisor",
  "programador",
  "recursos_humanos",
  "coordinador_instalaciones",
  "coordinador_polarizados",
  "publicidad",
]);

export function formatUserBranchLabel(user) {
  const branchId = String(user?.branch_id || "").trim();
  if (branchId && BRANCH_LABELS[branchId]) {
    return BRANCH_LABELS[branchId];
  }
  if (branchId && branchId !== "none" && branchId !== "null") {
    return branchId;
  }
  const role = String(user?.role || "").trim().toLowerCase();
  if (GLOBAL_BRANCH_ROLES.has(role)) {
    return "Todas las sucursales";
  }
  return "Mundo de Accesorios";
}

export function getBrandingForBranch(branchId) {
  const isTopCar = TOPCAR_BRANCH_IDS.has(String(branchId || ""));
  if (isTopCar) {
    return {
      brandName: "TopCar Accessories",
      logo: "/topcar-logo.png",
      favicon: "/topcar-favicon-32.png",
    };
  }

  return {
    brandName: "Mundo de Accesorios",
    logo: "/mundo-logo.png",
    favicon: "/mundo-favicon-32.png",
  };
}

export const ERP_CATEGORY_LABELS = {
  detailing_cuidado: "Detailing y Cuidado Automotriz",
  cuidado_automotriz: "Detailing y Cuidado Automotriz",
  lubricantes_fluidos: "Lubricantes, Grasas y Fluidos",
  iluminacion: "Iluminación y Faros LED",
  accesorios_iluminacion: "Iluminación y Faros LED",
  audio_multimedia: "Car Audio y Multimedia",
  car_audio: "Car Audio y Multimedia",
  accesorios_4x4_exterior: "Accesorios 4x4 y Exterior",
  seguridad_alarmas: "Seguridad y Alarmas",
  polarizados: "Películas y Polarizados",
  servicios: "Servicios de Taller",
  servicios_taller: "Servicios e Instalaciones",
  repuestos_mantenimiento: "Repuestos y Mantenimiento",
  accesorios_electronicos: "Accesorios Electrónicos",
  accesorios_no_electricos: "Accesorios Generales",
};

export function formatCategoryLabel(cat) {
  if (!cat || cat === "all") return "Todas las categorías";
  if (ERP_CATEGORY_LABELS[cat]) return ERP_CATEGORY_LABELS[cat];
  return String(cat)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}


