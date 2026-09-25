/**
 * U5 autosave status bus — Liquid Glass pill + MainLayout header icon.
 * Guardado (SYNCED) must only fire after server confirm — never on localStorage alone.
 */

export const AUTOSAVE_STATUS_EVENT = "erp:autosave-status";
export const AUTOSAVE_DIRTY_EVENT = "erp:autosave-dirty";
export const AUTOSAVE_QUEUE_EVENT = "erp:autosave-queue";

/** Debounce for draft persist / server PATCH after last keystroke */
export const AUTOSAVE_DEBOUNCE_MS = 800;

export const AUTOSAVE_STATUS = {
  IDLE: "idle",
  TYPING: "typing",
  SAVING: "saving",
  SYNCING: "syncing",
  RECOVERING: "recovering",
  SYNCED: "synced",
  DISCONNECTED: "disconnected",
  OFFLINE: "offline",
  ERROR: "error",
};

/** Spanish pill labels (video 05) */
export const AUTOSAVE_STATUS_LABELS_ES = {
  [AUTOSAVE_STATUS.IDLE]: "",
  [AUTOSAVE_STATUS.TYPING]: "Escribiendo…",
  [AUTOSAVE_STATUS.SAVING]: "Escribiendo…",
  [AUTOSAVE_STATUS.SYNCING]: "Guardando…",
  [AUTOSAVE_STATUS.RECOVERING]: "Guardando…",
  [AUTOSAVE_STATUS.SYNCED]: "Guardado",
  [AUTOSAVE_STATUS.DISCONNECTED]: "Sin conexión",
  [AUTOSAVE_STATUS.OFFLINE]: "Sin conexión",
  [AUTOSAVE_STATUS.ERROR]: "Error · Reintentar",
};

export const AUTOSAVE_STATUS_ERROR_DETAIL_ES = "No se pudo guardar";

const dirtySources = new Set();

export function emitAutosaveStatus(status, meta = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(AUTOSAVE_STATUS_EVENT, {
      detail: {
        status,
        at: new Date().toISOString(),
        ...meta,
      },
    })
  );
}

export function getAutosaveStatusLabel(status) {
  return AUTOSAVE_STATUS_LABELS_ES[status] || "";
}

export function setAutosaveDirty(sourceId, dirty = true) {
  if (!sourceId) return;
  const id = String(sourceId);
  if (dirty) dirtySources.add(id);
  else dirtySources.delete(id);
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(AUTOSAVE_DIRTY_EVENT, {
      detail: {
        sourceId: id,
        dirty: Boolean(dirty),
        dirtyCount: dirtySources.size,
        at: new Date().toISOString(),
      },
    })
  );
}

export function clearAutosaveDirty(sourceId) {
  setAutosaveDirty(sourceId, false);
}

export function getAutosaveDirtyCount() {
  return dirtySources.size;
}

export function isAutosaveDirty() {
  return dirtySources.size > 0;
}

export function emitAutosaveQueueCount(count, meta = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(AUTOSAVE_QUEUE_EVENT, {
      detail: {
        count: Number(count) || 0,
        at: new Date().toISOString(),
        ...meta,
      },
    })
  );
}
