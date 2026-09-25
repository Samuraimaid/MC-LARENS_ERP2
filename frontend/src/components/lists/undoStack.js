/**
 * U8 — Undo stack (time machine): recent reversible actions.
 * Soft-delete / deactivate only — no invented trash backend.
 * Toast shows the top entry; Cmd/Ctrl+Z undoes the latest.
 */

export const UNDO_STACK_TTL_MS = 9000;
export const UNDO_STACK_MAX = 8;

/** @typedef {{ id: string, label: string, description?: string, onUndo: () => (void|Promise<void>), expiresAt: number, ttlMs: number }} UndoEntry */

/** @type {UndoEntry[]} */
let stack = [];
/** @type {Set<(entries: UndoEntry[]) => void>} */
const listeners = new Set();
let hotkeyBound = false;

function prune() {
  const now = Date.now();
  stack = stack.filter((e) => e.expiresAt > now);
}

function notify() {
  prune();
  const snapshot = stack.slice();
  listeners.forEach((fn) => {
    try {
      fn(snapshot);
    } catch {
      /* ignore subscriber errors */
    }
  });
}

export function getUndoStack() {
  prune();
  return stack.slice();
}

export function subscribeUndoStack(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Push a reversible action.
 * @param {{ id?: string, label: string, description?: string, onUndo: () => (void|Promise<void>), ttlMs?: number }} opts
 * @returns {string} entry id
 */
export function pushUndo(opts = {}) {
  const ttlMs = opts.ttlMs ?? UNDO_STACK_TTL_MS;
  const id = opts.id || `undo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  prune();
  // Replace same id if re-pushed
  stack = stack.filter((e) => e.id !== id);
  /** @type {UndoEntry} */
  const entry = {
    id,
    label: opts.label || "Acción",
    description: opts.description,
    onUndo: opts.onUndo,
    expiresAt: Date.now() + ttlMs,
    ttlMs,
  };
  stack.push(entry);
  while (stack.length > UNDO_STACK_MAX) stack.shift();
  ensureUndoHotkey();
  notify();
  return id;
}

/** Remove without running undo (toast dismissed / TTL). */
export function dropUndo(id) {
  const before = stack.length;
  stack = stack.filter((e) => e.id !== id);
  if (stack.length !== before) notify();
}

async function runEntry(entry) {
  try {
    await entry.onUndo?.();
    return true;
  } catch {
    entry.expiresAt = Date.now() + Math.min(entry.ttlMs, 4000);
    stack.push(entry);
    notify();
    return false;
  }
}

/** Undo the latest (top) entry. */
export async function undoLatest() {
  prune();
  const entry = stack.pop();
  if (!entry) return false;
  notify();
  return runEntry(entry);
}

/** Undo a specific entry by id (toast Deshacer). */
export async function undoById(id) {
  prune();
  const idx = stack.findIndex((e) => e.id === id);
  if (idx < 0) return false;
  const [entry] = stack.splice(idx, 1);
  notify();
  return runEntry(entry);
}

/**
 * Undo up to N most recent entries (cheap batch).
 * @param {number} n
 */
export async function undoLastN(n = 1) {
  const count = Math.max(0, Math.min(Number(n) || 0, getUndoStack().length));
  let done = 0;
  for (let i = 0; i < count; i += 1) {
    const ok = await undoLatest();
    if (!ok) break;
    done += 1;
  }
  return done;
}

function isEditableTarget(el) {
  if (!el || typeof el !== "object") return false;
  const tag = String(el.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (el.isContentEditable) return true;
  return typeof el.closest === "function" && !!el.closest("[contenteditable=true]");
}

function onKeyDown(e) {
  if (!(e.metaKey || e.ctrlKey)) return;
  if (String(e.key || "").toLowerCase() !== "z" || e.shiftKey || e.altKey) return;
  if (isEditableTarget(e.target)) return;
  prune();
  if (!stack.length) return;
  e.preventDefault();
  undoLatest().then((ok) => {
    if (ok && typeof window !== "undefined") {
      // Lightweight feedback without importing sonner here (toast may already dismiss)
    }
  });
}

export function ensureUndoHotkey() {
  if (hotkeyBound || typeof window === "undefined") return;
  window.addEventListener("keydown", onKeyDown);
  hotkeyBound = true;
}

export function __resetUndoStackForTests() {
  stack = [];
  notify();
}
