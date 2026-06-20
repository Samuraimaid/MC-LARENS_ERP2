export function getRoleHomePath(role) {
  const normalized = String(role || "").toLowerCase();
  if (normalized === "cajero") return "/cashier";
  return "/workbench";
}

export function isCashierRole(role) {
  return String(role || "").toLowerCase() === "cajero";
}