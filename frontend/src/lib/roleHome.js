const TECHNICIAN_KIOSK_ROLES = new Set([
  "instalaciones",
  "instalador",
  "electrico",
  "polarizador",
]);

/** Roles que pueden operar el módulo de caja (API + menú). */
const CASHIER_ACCESS_ROLES = new Set(["gerencia", "supervisor", "programador", "cajero"]);

/** Roles de venta con UI restringida (sin sidebar completo). */
const SELLER_ROLES = new Set(["ventas", "jefe_vendedores", "jefe_tienda"]);

/**
 * Rol dedicado de cajero: kiosko fijo en /cashier, sin sidebar.
 * NO confundir con canAccessCashier (gerencia/supervisor también acceden a caja).
 */
export function isCashierKioskRole(role) {
  return String(role || "").toLowerCase() === "cajero";
}

/** Alias histórico: solo el kiosko de cajero dedicado. */
export function isCashierRole(role) {
  return isCashierKioskRole(role);
}

export function canAccessCashier(role) {
  return CASHIER_ACCESS_ROLES.has(String(role || "").toLowerCase());
}

export function isSellerRole(role) {
  return SELLER_ROLES.has(String(role || "").toLowerCase());
}

/** UI sin sidebar/menú lateral (cajero dedicado o vendedor). */
export function usesRestrictedNavigation(role) {
  return isCashierKioskRole(role) || isSellerRole(role);
}

export function canPrintLetterInvoice(role, sale) {
  if (!canAccessCashier(role)) return false;
  return String(sale?.payment_status || "").toLowerCase() === "paid";
}

/** Gerencia y supervisión pueden reimprimir el voucher POS 80mm desde el tablero. */
export function canReprintSellerVoucher(role) {
  return ["gerencia", "supervisor"].includes(String(role || "").toLowerCase());
}

/**
 * Ruta de aterrizaje post-login. Única fuente de verdad — no duplicar lógica en LoginPage.
 */
export function getRoleHomePath(role) {
  const normalized = String(role || "").toLowerCase();
  if (isCashierKioskRole(normalized)) return "/cashier";
  if (TECHNICIAN_KIOSK_ROLES.has(normalized)) return "/technician";
  if (normalized === "recursos_humanos") return "/human-resources";
  if (normalized === "coordinador_instalaciones") return "/coordinator/instalaciones";
  if (normalized === "coordinador_polarizados") return "/coordinator/polarizados";
  if (normalized === "bodegas" || normalized === "jefe_tienda") return "/dispatch";
  if (normalized === "transporte" || normalized === "entregador") return "/driver";
  return "/workbench";
}

export const ROLE_HOME_MATRIX = [
  { role: "cajero", home: "/cashier", restrictedNav: true, canAccessCashier: true },
  { role: "ventas", home: "/workbench", restrictedNav: true, canAccessCashier: false },
  { role: "jefe_vendedores", home: "/workbench", restrictedNav: true, canAccessCashier: false },
  { role: "jefe_tienda", home: "/dispatch", restrictedNav: true, canAccessCashier: false },
  { role: "gerencia", home: "/workbench", restrictedNav: false, canAccessCashier: true },
  { role: "supervisor", home: "/workbench", restrictedNav: false, canAccessCashier: true },
  { role: "programador", home: "/workbench", restrictedNav: false, canAccessCashier: true },
  { role: "instalaciones", home: "/technician", restrictedNav: false, canAccessCashier: false },
  { role: "recursos_humanos", home: "/human-resources", restrictedNav: false, canAccessCashier: false },
  { role: "bodegas", home: "/dispatch", restrictedNav: false, canAccessCashier: false },
];