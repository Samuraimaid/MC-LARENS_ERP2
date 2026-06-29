export const KDS_REFRESH_EVENT = "mclarens-kds-refresh";

export function dispatchKdsRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(KDS_REFRESH_EVENT));
  }
}

export function getTimeElapsed(createdAt) {
  if (!createdAt) return "—";
  const now = new Date();
  const created = new Date(createdAt);
  const minutes = Math.floor((now - created) / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function getPriorityRank(priority) {
  const order = { urgent: 0, high: 1, normal: 2, low: 3 };
  return order[priority] ?? 2;
}

export function sortByPriorityThenAge(items, { createdAtKey = "created_at" } = {}) {
  return [...items].sort((a, b) => {
    const priorityDiff = getPriorityRank(a.priority) - getPriorityRank(b.priority);
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(a[createdAtKey]) - new Date(b[createdAtKey]);
  });
}

export const PRIORITY_BADGE = {
  urgent: "border-red-500 text-red-500",
  high: "border-orange-500 text-orange-500",
  normal: "border-muted-foreground",
  low: "border-slate-400 text-slate-500",
};