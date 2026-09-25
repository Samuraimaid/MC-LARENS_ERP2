/**
 * Offline draft save queue (U5).
 * Persists failed/offline server writes; drains oldest-first on reconnect.
 * Uses saveServerDraft when flow+draftId present; falls back to /drafts/backup.
 */

import axios from "axios";
import { API_BASE as API } from "@/lib/api";
import { saveServerDraft } from "@/lib/serverDrafts";
import { emitAutosaveQueueCount, emitAutosaveStatus, AUTOSAVE_STATUS } from "@/lib/autosaveStatus";

export const OFFLINE_DRAFT_QUEUE_KEY = "erp_offline_draft_queue_v1";

function safeParse(raw) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function readOfflineDraftQueue() {
  if (typeof window === "undefined") return [];
  try {
    return safeParse(window.localStorage.getItem(OFFLINE_DRAFT_QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeOfflineDraftQueue(items) {
  if (typeof window === "undefined") return;
  const list = Array.isArray(items) ? items : [];
  window.localStorage.setItem(OFFLINE_DRAFT_QUEUE_KEY, JSON.stringify(list));
  emitAutosaveQueueCount(list.length);
}

export function getOfflineDraftQueueCount() {
  return readOfflineDraftQueue().length;
}

/**
 * Enqueue a draft save. Dedupes by flow+draftId (keeps newest payload, oldest enqueuedAt).
 */
export function enqueueOfflineDraftSave(entry) {
  if (!entry || typeof entry !== "object") return readOfflineDraftQueue();
  const flow = String(entry.flow || "").trim();
  const draftId = String(entry.draftId || "").trim();
  if (!flow || !draftId) return readOfflineDraftQueue();

  const now = new Date().toISOString();
  const queue = readOfflineDraftQueue();
  const existingIdx = queue.findIndex(
    (item) => item.flow === flow && item.draftId === draftId
  );

  if (existingIdx >= 0) {
    const prev = queue[existingIdx];
    queue[existingIdx] = {
      ...prev,
      name: entry.name || prev.name || null,
      snapshot: entry.snapshot && typeof entry.snapshot === "object" ? entry.snapshot : prev.snapshot,
      backupEntries: Array.isArray(entry.backupEntries) ? entry.backupEntries : prev.backupEntries,
      updatedAt: now,
      // keep original enqueuedAt so oldest-first drain order is stable
    };
  } else {
    queue.push({
      id: `odq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      flow,
      draftId,
      name: entry.name || null,
      snapshot: entry.snapshot && typeof entry.snapshot === "object" ? entry.snapshot : {},
      backupEntries: Array.isArray(entry.backupEntries) ? entry.backupEntries : null,
      enqueuedAt: now,
      updatedAt: now,
    });
  }

  // oldest-first by enqueuedAt
  queue.sort((a, b) => String(a.enqueuedAt || "").localeCompare(String(b.enqueuedAt || "")));
  writeOfflineDraftQueue(queue);
  emitAutosaveStatus(AUTOSAVE_STATUS.OFFLINE, {
    source: entry.source || flow,
    queueCount: queue.length,
  });
  return queue;
}

export function clearOfflineDraftQueue() {
  writeOfflineDraftQueue([]);
}

async function flushQueueItem(item) {
  if (item.flow && item.draftId && item.snapshot && typeof item.snapshot === "object") {
    await saveServerDraft(item.flow, item.draftId, {
      name: item.name || null,
      snapshot: item.snapshot,
    });
    return;
  }
  if (Array.isArray(item.backupEntries) && item.backupEntries.length > 0) {
    await axios.post(`${API}/drafts/backup`, { entries: item.backupEntries }, { withCredentials: true });
  }
}

let drainInFlight = null;

/**
 * Drain queue oldest-first. Stops on first failure (item stays at head).
 * @returns {{ flushed: number, remaining: number, error?: Error }}
 */
export async function drainOfflineDraftQueue({ isOnline } = {}) {
  if (drainInFlight) return drainInFlight;

  drainInFlight = (async () => {
    const online =
      typeof isOnline === "boolean"
        ? isOnline
        : typeof navigator === "undefined"
          ? true
          : navigator.onLine !== false;

    if (!online) {
      const remaining = getOfflineDraftQueueCount();
      return { flushed: 0, remaining };
    }

    let flushed = 0;
    let queue = readOfflineDraftQueue();

    while (queue.length > 0) {
      const head = queue[0];
      try {
        await flushQueueItem(head);
        queue = queue.slice(1);
        writeOfflineDraftQueue(queue);
        flushed += 1;
      } catch (error) {
        emitAutosaveStatus(AUTOSAVE_STATUS.ERROR, {
          source: head?.flow || "offline-queue",
          queueCount: queue.length,
          message: AUTOSAVE_STATUS.ERROR,
        });
        return { flushed, remaining: queue.length, error };
      }
    }

    if (flushed > 0) {
      emitAutosaveStatus(AUTOSAVE_STATUS.SYNCED, {
        source: "offline-queue",
        queueCount: 0,
      });
    }
    return { flushed, remaining: 0 };
  })();

  try {
    return await drainInFlight;
  } finally {
    drainInFlight = null;
  }
}

export function isBrowserOffline() {
  if (typeof navigator === "undefined") return false;
  return navigator.onLine === false;
}
