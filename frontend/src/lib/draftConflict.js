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
 * Automatically resolve conflict by always choosing the newest timestamp.
 * - If server is newer -> applies server snapshot.
 * - If local is newer -> keeps local snapshot so it gets pushed to server.
 */
export function resolveDraftConflictByLatest(conflict, { draftKeyPrefix } = {}) {
  if (typeof window === "undefined" || !conflict?.draftId) return null;
  const serverIsNewer = (conflict.serverAt || 0) > (conflict.localAt || 0);
  const choice = serverIsNewer ? "server" : "local";
  return applyDraftConflictChoice(conflict, choice, { draftKeyPrefix });
}

const pendingDraftConflictToasts = [];
let draftConflictFlushTimer = 0;

/**
 * Optional prompt toast (now bypassed by default in favor of resolveDraftConflictByLatest).
 */
export function promptDraftConflictToast(conflict, {
  draftKeyPrefix,
  onResolved,
} = {}) {
  if (!conflict) return;
  pendingDraftConflictToasts.push({ conflict, draftKeyPrefix, onResolved });
  if (draftConflictFlushTimer) return;
  draftConflictFlushTimer = window.setTimeout(() => {
    const items = pendingDraftConflictToasts.splice(0);
    draftConflictFlushTimer = 0;
    if (!items.length) return;
    const count = items.length;
    const first = items[0].conflict;
    toast.warning(count > 1 ? "Sincronizando borradores" : "Conflicto de borrador", {
      id: "draft-sync",
      description: count > 1
        ? `${count} borradores cambiaron en otro dispositivo.`
        : `El borrador «${first.name || first.draftId}» cambió en otro dispositivo.`,
      duration: 6000,
      action: {
        label: "Conservar ambos",
        onClick: () => {
          items.forEach(({ conflict: item, draftKeyPrefix: prefix, onResolved: done }) => {
            const result = applyDraftConflictChoice(item, "both", { draftKeyPrefix: prefix });
            if (typeof done === "function") done(result);
          });
          toast.success("Borradores sincronizados", {
            description: count > 1 ? `${count} borradores quedaron al día.` : "Se conservaron ambas versiones.",
          });
        },
      },
    });
  }, 0);
}

