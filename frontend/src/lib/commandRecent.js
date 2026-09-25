/** U14 — recent command palette entries (localStorage). */

export const COMMAND_RECENT_STORAGE_KEY = "erp:cmdk-recent";
export const COMMAND_RECENT_MAX = 8;

/**
 * @typedef {{ id: string, label: string, group?: string, href?: string, at: number }} RecentCommand
 */

/**
 * @returns {RecentCommand[]}
 */
export function loadRecentCommands() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(COMMAND_RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row) => row && typeof row.id === "string" && typeof row.label === "string")
      .slice(0, COMMAND_RECENT_MAX);
  } catch {
    return [];
  }
}

/**
 * @param {{ id: string, label: string, group?: string, href?: string }} item
 * @returns {RecentCommand[]}
 */
export function pushRecentCommand(item) {
  if (!item?.id || !item?.label) return loadRecentCommands();
  const prev = loadRecentCommands().filter((row) => row.id !== item.id);
  const next = [
    {
      id: item.id,
      label: item.label,
      group: item.group || undefined,
      href: item.href || undefined,
      at: Date.now(),
    },
    ...prev,
  ].slice(0, COMMAND_RECENT_MAX);
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(COMMAND_RECENT_STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    /* quota / private mode */
  }
  return next;
}

export function clearRecentCommands() {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(COMMAND_RECENT_STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}
