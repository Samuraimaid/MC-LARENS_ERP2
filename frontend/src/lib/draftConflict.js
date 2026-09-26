/**
 * Draft conflict helpers (U5).
 * Login/workbench resolves diverged drafts as "keep both" (local backup + server)
 * and shows one non-blocking progress banner. No stacked choice toasts.
 */

import React from "react";
import { getDraftSnapshotFingerprint } from "@/lib/draftStorage";

const resolvedConflictKeys = new Set();

export function draftConflictSyncKey(conflict) {
  if (!conflict?.draftId) return "";
  return `${conflict.draftId}|${conflict.localAt || 0}|${conflict.serverAt || 0}`;
}

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

function uniqueConflicts(conflicts = []) {
  const seen = new Set();
  const list = [];
  (Array.isArray(conflicts) ? conflicts : []).forEach((conflict) => {
    const key = draftConflictSyncKey(conflict);
    if (!key || seen.has(key)) return;
    seen.add(key);
    list.push(conflict);
  });
  return list;
}

/**
 * Keep both: backup the local snapshot and load the server copy.
 * One progress callback for the whole batch. Already-resolved keys are skipped.
 */
export async function resolveDraftConflictsKeepBoth(conflicts, {
  draftKeyPrefix,
  onResolved,
  onProgress,
  shouldAbort,
} = {}) {
  const list = uniqueConflicts(conflicts);
  const failed = [];
  let done = 0;
  const report = (running) => {
    if (typeof onProgress === "function") {
      onProgress({
        visible: running || failed.length > 0 || done > 0,
        running,
        done,
        total: list.length,
        failed: failed.slice(),
      });
    }
  };

  report(list.length > 0);
  for (const conflict of list) {
    if (typeof shouldAbort === "function" && shouldAbort()) break;
    const key = draftConflictSyncKey(conflict);
    try {
      if (!resolvedConflictKeys.has(key)) {
        const result = applyDraftConflictChoice(conflict, "both", { draftKeyPrefix });
        if (!result) throw new Error("empty");
        resolvedConflictKeys.add(key);
        if (typeof onResolved === "function") onResolved(result);
      }
    } catch {
      failed.push({
        draftId: conflict.draftId,
        name: conflict.name || conflict.draftId,
        conflict,
      });
    }
    done += 1;
    report(done < list.length);
    await new Promise((resolve) => {
      setTimeout(resolve, 16);
    });
  }

  const outcome = {
    visible: failed.length > 0 || done > 0,
    running: false,
    done,
    total: list.length,
    failed: failed.slice(),
  };
  if (typeof onProgress === "function") onProgress(outcome);
  return outcome;
}

/**
 * One non-blocking pill. The form underneath stays clickable.
 */
export function DraftSyncBanner({ progress, onRetry }) {
  if (!progress?.visible) return null;
  const failedNames = (progress.failed || [])
    .map((row) => row.name || row.draftId)
    .filter(Boolean);
  const label = progress.running
    ? `Sincronizando borradores… ${progress.done}/${progress.total}`
    : `No se pudo sincronizar ${failedNames.join(", ")} — reintentar`;

  return React.createElement(
    "div",
    {
      className: "pointer-events-none fixed left-1/2 top-3 z-40 -translate-x-1/2",
      role: "status",
      "aria-live": "polite",
    },
    React.createElement(
      "div",
      {
        className: progress.running
          ? "pointer-events-none inline-flex items-center gap-2 rounded-full border border-sky-500/40 bg-background/85 px-3 py-1 text-[11px] font-medium text-sky-900 shadow-sm backdrop-blur dark:text-sky-100"
          : "pointer-events-auto inline-flex items-center gap-2 rounded-full border border-amber-500/50 bg-background/90 px-3 py-1 text-[11px] font-medium text-amber-950 shadow-sm backdrop-blur dark:text-amber-100",
        "data-testid": "draft-sync-banner",
      },
      React.createElement("span", null, label),
      !progress.running && failedNames.length && typeof onRetry === "function"
        ? React.createElement(
            "button",
            {
              type: "button",
              className: "underline underline-offset-2",
              onClick: () => onRetry(progress.failed || []),
            },
            "Reintentar"
          )
        : null
    )
  );
}
