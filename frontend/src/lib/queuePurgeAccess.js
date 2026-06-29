/** Roles autorizados para limpiar colas y eliminar trabajos pendientes. */
export const QUEUE_PURGE_ROLES = new Set(["gerencia", "supervisor", "programador"]);

export function canPurgeOperationalQueue(role) {
  return QUEUE_PURGE_ROLES.has(String(role || "").toLowerCase());
}