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

