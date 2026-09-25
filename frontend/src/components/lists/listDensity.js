/**
 * McLarens ERP — homogeneidad de densidad de listas (estilo Google Material).
 * compact | comfortable | cozy  →  UI ES: Delgada | Cómoda | Amplia
 */

export const LIST_DENSITY_STORAGE_KEY = "mclarens_list_density";
/** Legacy Inventario (Lot C) — migrar al global */
export const LEGACY_INVENTORY_VIEW_KEY = "mclarens_inventory_view_mode";

export const LIST_DENSITY_MODES = ["compact", "comfortable", "cozy"];

export const DEFAULT_LIST_DENSITY = "comfortable";

/** @type {Record<string, { id: string, label: string, shortLabel: string, title: string, googleHint: string }>} */
export const LIST_DENSITY_META = {
  compact: {
    id: "compact",
    label: "Delgada",
    shortLabel: "Delgada",
    title: "Delgada — filas densas (estilo Google dense list)",
    googleHint: "dense",
  },
  comfortable: {
    id: "comfortable",
    label: "Cómoda",
    shortLabel: "Cómoda",
    title: "Cómoda — lista estándar con avatar/miniatura",
    googleHint: "standard",
  },
  cozy: {
    id: "cozy",
    label: "Amplia",
    shortLabel: "Amplia",
    title: "Amplia — filas holgadas con miniatura grande",
    googleHint: "roomy",
  },
};

const LEGACY_INV_MAP = {
  delgada: "compact",
  intermedia: "comfortable",
  columnas: "cozy",
};

export function normalizeListDensity(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (LIST_DENSITY_MODES.includes(raw)) return raw;
  if (LEGACY_INV_MAP[raw]) return LEGACY_INV_MAP[raw];
  return DEFAULT_LIST_DENSITY;
}

export function readListDensity(storageKey = LIST_DENSITY_STORAGE_KEY) {
  if (typeof window === "undefined" || !window.localStorage) {
    return DEFAULT_LIST_DENSITY;
  }
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw) return normalizeListDensity(raw);
    // Migrar preferencia de Inventario Lot C → global
    if (storageKey === LIST_DENSITY_STORAGE_KEY) {
      const legacy = window.localStorage.getItem(LEGACY_INVENTORY_VIEW_KEY);
      if (legacy) {
        const migrated = normalizeListDensity(legacy);
        window.localStorage.setItem(LIST_DENSITY_STORAGE_KEY, migrated);
        return migrated;
      }
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_LIST_DENSITY;
}

export function writeListDensity(mode, storageKey = LIST_DENSITY_STORAGE_KEY) {
  const next = normalizeListDensity(mode);
  if (typeof window === "undefined" || !window.localStorage) return next;
  try {
    window.localStorage.setItem(storageKey, next);
  } catch {
    /* ignore */
  }
  return next;
}

/** Tokens Tailwind por modo — filas Google-like */
export const DENSITY_TOKENS = {
  compact: {
    row: "gap-2 px-2.5 py-1.5 min-h-[40px]",
    media: "h-8 w-8 rounded-md",
    mediaIcon: "h-3.5 w-3.5",
    primary: "text-sm font-medium leading-tight",
    secondary: "text-[11px] text-muted-foreground leading-tight",
    trailing: "gap-0.5",
    tableRow: "h-9 [&_td]:py-1 [&_td]:px-2 [&_th]:py-1.5 [&_th]:px-2 text-sm",
    tableThumb: "h-7 w-7",
    listGap: "gap-0 divide-y divide-border/50",
    cardPad: "p-2",
  },
  comfortable: {
    row: "gap-3 px-3 py-2.5 min-h-[56px]",
    media: "h-10 w-10 rounded-lg",
    mediaIcon: "h-4 w-4",
    primary: "text-sm font-semibold leading-snug",
    secondary: "text-xs text-muted-foreground leading-snug",
    trailing: "gap-1",
    tableRow: "h-12 [&_td]:py-2 [&_td]:px-3 [&_th]:py-2.5 [&_th]:px-3 text-sm",
    tableThumb: "h-9 w-9",
    listGap: "gap-1.5",
    cardPad: "p-3",
  },
  cozy: {
    row: "gap-4 px-4 py-3.5 min-h-[72px]",
    media: "h-14 w-14 rounded-xl",
    mediaIcon: "h-6 w-6",
    primary: "text-base font-semibold leading-snug",
    secondary: "text-sm text-muted-foreground leading-snug",
    trailing: "gap-1.5",
    tableRow: "h-16 [&_td]:py-3 [&_td]:px-4 [&_th]:py-3 [&_th]:px-4 text-base",
    tableThumb: "h-12 w-12",
    listGap: "gap-2.5",
    cardPad: "p-4",
  },
};

export function densityTokens(mode) {
  return DENSITY_TOKENS[normalizeListDensity(mode)] || DENSITY_TOKENS[DEFAULT_LIST_DENSITY];
}

export function pageDensityStorageKey(pageId) {
  if (!pageId) return LIST_DENSITY_STORAGE_KEY;
  return `${LIST_DENSITY_STORAGE_KEY}__${String(pageId).replace(/[^\w-]+/g, "_")}`;
}
