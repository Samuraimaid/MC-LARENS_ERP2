export const AUTOSAVE_STATUS_EVENT = "erp:autosave-status";

export const AUTOSAVE_STATUS = {
  SAVING: "saving",
  SYNCING: "syncing",
  RECOVERING: "recovering",
  SYNCED: "synced",
  DISCONNECTED: "disconnected",
};

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
