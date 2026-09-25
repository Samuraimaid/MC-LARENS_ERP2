/**
 * Draft conflict helpers (U5) — no silent last-write-wins when both sides diverge.
 */

import { toast } from "sonner";
import { getDraftSnapshotFingerprint } from "@/lib/draftStorage";

function parseSnapshot(raw) {
  if (!raw) return null;
  try {
    const draft = typeof raw === "string" ? JSON.parse(raw) : raw;
    return draft && typeof draft === "object" ? draft : null;
  } catch {
    return null;
  }
}

function updatedAtMs(snapshot, fallback) {
  const fromSnap = Date.parse(String(snapshot?.updatedAt || ""));
  if (Number.isFinite(fromSnap)) return fromSnap;
  const fromFallback = Date.parse(String(fallback || ""));
  return Number.isFinite(fromFallback) ? fromFallback : 0;
}

/**
 * Detect conflicts where local and server snapshots both have content and differ.
 * @returns {Array<{ draftId, localSnapshot, serverSnapshot, localAt, serverAt }>}
 */
export function detectDraftConflicts(draftKeyPrefix, serverDrafts = []) {
  if (typeof window === "undefined") return [];
  const conflicts = [];

  (Array.isArray(serverDrafts) ? serverDrafts : []).forEach((draft) => {
    if (!draft?.id) return;
    const storageKey = `${draftKeyPrefix}${draft.id}`;
    const localRaw = window.localStorage.getItem(storageKey);
    const localSnapshot = parseSnapshot(localRaw);
    const serverSnapshot =
      draft.snapshot && typeof draft.snapshot === "object" ? draft.snapshot : {};

    if (!localSnapshot) return;

    const localFp = getDraftSnapshotFingerprint(localSnapshot);
    const serverFp = getDraftSnapshotFingerprint(serverSnapshot);
    if (!localFp || !serverFp) return;
    if (localFp === serverFp) return;

    const localAt = updatedAtMs(localSnapshot);
    const serverAt = updatedAtMs(serverSnapshot, draft.updatedAt);

    // Both sides have real edits that diverge — conflict (incl. local newer than server)
    const localHasContent = localAt > 0 || localFp.length > 8;
    const serverHasContent = serverAt > 0 || serverFp.length > 8;
    if (!localHasContent || !serverHasContent) return;

    conflicts.push({
      draftId: draft.id,
      name: draft.name || draft.id,
      localSnapshot,
      serverSnapshot,
      localAt,
      serverAt,
      storageKey,
    });
  });

  return conflicts;
}

/**
 * Apply conflict choice for one draft.
 * @param {"local"|"server"|"both"} choice
 */
export function applyDraftConflictChoice(conflict, choice, { draftKeyPrefix } = {}) {
  if (typeof window === "undefined" || !conflict?.draftId) return null;
  const storageKey = conflict.storageKey || `${draftKeyPrefix || ""}${conflict.draftId}`;

  if (choice === "server") {
    window.localStorage.setItem(storageKey, JSON.stringify(conflict.serverSnapshot || {}));
    return { draftId: conflict.draftId, applied: "server" };
  }

  if (choice === "local") {
    // keep local; caller should push local to server
    window.localStorage.setItem(storageKey, JSON.stringify(conflict.localSnapshot || {}));
    return { draftId: conflict.draftId, applied: "local", snapshot: conflict.localSnapshot };
  }

  if (choice === "both") {
    const backupId = `${conflict.draftId}_local_${Date.now().toString(36)}`;
    const backupKey = `${draftKeyPrefix || storageKey.replace(conflict.draftId, "")}${backupId}`;
    window.localStorage.setItem(backupKey, JSON.stringify(conflict.localSnapshot || {}));
    window.localStorage.setItem(storageKey, JSON.stringify(conflict.serverSnapshot || {}));
    return {
      draftId: conflict.draftId,
      applied: "both",
      backupId,
      backupKey,
      localSnapshot: conflict.localSnapshot,
      serverSnapshot: conflict.serverSnapshot,
    };
  }

  return null;
}

/**
 * Minimal toast UI: keep local / take server / keep both.
 */
export function promptDraftConflictToast(conflict, {
  draftKeyPrefix,
  onResolved,
  duration = 20000,
} = {}) {
  if (!conflict) return;

  const title = "Conflicto de borrador";
  const description =
    `El borrador «${conflict.name || conflict.draftId}» cambió en otra pestaña o dispositivo. ` +
    "Elige qué versión conservar (no se sobrescribe en silencio).";

  toast.warning(title, {
    description,
    duration,
    action: {
      label: "Usar servidor",
      onClick: () => {
        const result = applyDraftConflictChoice(conflict, "server", { draftKeyPrefix });
        toast.message("Se aplicó la versión del servidor");
        if (typeof onResolved === "function") onResolved(result);
      },
    },
    cancel: {
      label: "Mantener local",
      onClick: () => {
        const result = applyDraftConflictChoice(conflict, "local", { draftKeyPrefix });
        toast.message("Se mantuvo la versión local — se sincronizará al servidor");
        if (typeof onResolved === "function") onResolved(result);
      },
    },
  });

  // Secondary path for "keep both" via a follow-up toast button
  toast.message("¿Conservar ambos?", {
    description: "Guarda tu copia local como respaldo y carga la del servidor.",
    duration: Math.min(duration, 16000),
    action: {
      label: "Conservar ambos",
      onClick: () => {
        const result = applyDraftConflictChoice(conflict, "both", { draftKeyPrefix });
        toast.success("Se conservaron ambas versiones (local como respaldo)");
        if (typeof onResolved === "function") onResolved(result);
      },
    },
  });
}
