import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_LIST_DENSITY,
  LIST_DENSITY_STORAGE_KEY,
  densityTokens,
  normalizeListDensity,
  pageDensityStorageKey,
  readListDensity,
  writeListDensity,
} from "@/components/lists/listDensity";

const CHANGE_EVENT = "mclarens:list-density-change";

/**
 * Densidad de listas ERP (global `mclarens_list_density` + override opcional por página).
 * @param {{ pageId?: string, preferPageOverride?: boolean }} [opts]
 */
export function useListDensity(opts = {}) {
  const { pageId, preferPageOverride = false } = opts;
  const storageKey =
    preferPageOverride && pageId
      ? pageDensityStorageKey(pageId)
      : LIST_DENSITY_STORAGE_KEY;

  const [density, setDensityState] = useState(() => readListDensity(storageKey));

  useEffect(() => {
    const sync = (ev) => {
      const key = ev?.detail?.key;
      if (key && key !== storageKey && key !== LIST_DENSITY_STORAGE_KEY) return;
      setDensityState(readListDensity(storageKey));
    };
    window.addEventListener(CHANGE_EVENT, sync);
    const onStorage = (e) => {
      if (!e.key || e.key === storageKey || e.key === LIST_DENSITY_STORAGE_KEY) {
        setDensityState(readListDensity(storageKey));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, [storageKey]);

  const setDensity = useCallback(
    (mode) => {
      const next = writeListDensity(mode, storageKey);
      // Homogeneidad: si no hay override de página, el global es la fuente de verdad
      if (preferPageOverride && storageKey !== LIST_DENSITY_STORAGE_KEY) {
        // page override only — leave global alone
      } else if (storageKey !== LIST_DENSITY_STORAGE_KEY) {
        writeListDensity(next, LIST_DENSITY_STORAGE_KEY);
      }
      setDensityState(next);
      try {
        window.dispatchEvent(
          new CustomEvent(CHANGE_EVENT, { detail: { key: storageKey, density: next } })
        );
      } catch {
        /* ignore */
      }
    },
    [preferPageOverride, storageKey]
  );

  const tokens = useMemo(() => densityTokens(density), [density]);
  const normalized = normalizeListDensity(density) || DEFAULT_LIST_DENSITY;

  return {
    density: normalized,
    setDensity,
    tokens,
    storageKey,
    isCompact: normalized === "compact",
    isComfortable: normalized === "comfortable",
    isCozy: normalized === "cozy",
  };
}

export default useListDensity;
