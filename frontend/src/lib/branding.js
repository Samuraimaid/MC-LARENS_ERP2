export const TOPCAR_BRANCH_IDS = new Set(["branch_north", "branch_south"]);

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
