export const CUSTOMER_VEHICLE_CARD_PATTERNS = {
  shared: {
    shell: "rounded-xl px-3.5 py-2.5 shadow-sm ui-panel animate-fade-up-soft sm:px-4 sm:py-3",
    split: "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:items-center sm:gap-3",
    splitCompact: "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2",
    info: "min-w-0 space-y-2",
    actions: "flex flex-col items-end gap-1.5 self-start sm:self-center",
    pairedMinHeight: "min-h-[88px]",
    pairedCompactMinHeight: "min-h-[76px]",
  },
  customer: {
    shell: "border border-emerald-200 bg-emerald-50/70",
    title: "inline-flex min-w-0 items-start gap-2 font-semibold text-emerald-900",
    metaGrid: "grid gap-x-6 gap-y-1 text-xs text-emerald-900/90 sm:grid-cols-2",
    badge: "shrink-0 text-[10px] uppercase tracking-wide",
  },
  vehicle: {
    shell: "border border-sky-200 bg-sky-50/80",
    title: "inline-flex min-w-0 items-start gap-1.5 text-sm font-semibold leading-tight text-sky-900",
    metaGrid: "grid gap-x-5 gap-y-1 text-xs text-sky-900/90 sm:grid-cols-2",
    badge: "shrink-0 border-sky-300 bg-white/70 text-[10px] uppercase tracking-wide text-sky-900",
  },
  carryout: {
    shell: "border border-emerald-200 bg-emerald-50/80",
    title: "inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold leading-tight text-emerald-900",
    badge: "shrink-0 border-emerald-300 bg-white/70 text-[10px] uppercase tracking-wide text-emerald-900",
  },
};
