import { useCallback, useEffect, useRef } from "react";

const DEFAULT_SCROLL_ROOT = "main.erp-shell-main";
const STORAGE_PREFIX = "mclarens_list_scroll:";

function resolveScrollRoot(scrollRoot) {
  if (typeof scrollRoot === "string") {
    return document.querySelector(scrollRoot);
  }
  if (scrollRoot && scrollRoot.current) return scrollRoot.current;
  if (scrollRoot instanceof Element) return scrollRoot;
  return document.querySelector(DEFAULT_SCROLL_ROOT) || null;
}

function getScrollTop(root) {
  if (!root) {
    return window.scrollY || document.documentElement.scrollTop || 0;
  }
  return root.scrollTop || 0;
}

function setScrollTop(root, top) {
  const y = Math.max(0, Number(top) || 0);
  if (!root) {
    window.scrollTo({ top: y, behavior: "auto" });
    return;
  }
  if (typeof root.scrollTo === "function") {
    root.scrollTo({ top: y, behavior: "auto" });
  } else {
    root.scrollTop = y;
  }
}

function storageKeyFor(pageKey, searchQuery) {
  const q = searchQuery == null || searchQuery === "" ? "" : String(searchQuery);
  return `${STORAGE_PREFIX}${pageKey}${q ? `?q=${encodeURIComponent(q)}` : ""}`;
}

/**
 * Guarda/restaura scrollTop de `main.erp-shell-main` (o contenedor)
 * al abrir/cerrar detalle (dialog/drawer/ruta) dentro de la sesión.
 *
 * Uso típico:
 *   const scroll = useListScrollRestore({ pageKey: "inventory", searchQuery: search });
 *   // antes de abrir detalle:
 *   scroll.save();
 *   // al cerrar detalle / onOpenChange(false):
 *   scroll.restore();
 */
export function useListScrollRestore({
  pageKey,
  searchQuery = "",
  scrollRoot = DEFAULT_SCROLL_ROOT,
  enabled = true,
  restoreOnMount = true,
} = {}) {
  const pageKeyRef = useRef(pageKey);
  pageKeyRef.current = pageKey;
  const searchRef = useRef(searchQuery);
  searchRef.current = searchQuery;
  const restoredRef = useRef(false);

  const key = storageKeyFor(pageKey || "list", searchQuery);

  const save = useCallback(() => {
    if (!enabled || !pageKeyRef.current) return;
    try {
      const root = resolveScrollRoot(scrollRoot);
      const top = getScrollTop(root);
      const k = storageKeyFor(pageKeyRef.current, searchRef.current);
      sessionStorage.setItem(
        k,
        JSON.stringify({ top, savedAt: Date.now(), path: window.location?.pathname || "" })
      );
    } catch {
      /* ignore quota / private mode */
    }
  }, [enabled, scrollRoot]);

  const restore = useCallback(
    (opts = {}) => {
      if (!enabled || !pageKeyRef.current) return;
      const delay = opts.delayMs ?? 50;
      const k = storageKeyFor(pageKeyRef.current, searchRef.current);
      let payload = null;
      try {
        const raw = sessionStorage.getItem(k);
        if (raw) payload = JSON.parse(raw);
      } catch {
        payload = null;
      }
      if (!payload || typeof payload.top !== "number") return;

      const apply = () => {
        const root = resolveScrollRoot(scrollRoot);
        setScrollTop(root, payload.top);
      };

      if (delay <= 0) {
        apply();
        requestAnimationFrame(apply);
      } else {
        setTimeout(() => {
          apply();
          requestAnimationFrame(apply);
        }, delay);
      }
    },
    [enabled, scrollRoot]
  );

  const clear = useCallback(() => {
    if (!pageKeyRef.current) return;
    try {
      sessionStorage.removeItem(storageKeyFor(pageKeyRef.current, searchRef.current));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!enabled || !restoreOnMount || !pageKey || restoredRef.current) return;
    restoredRef.current = true;
    restore({ delayMs: 80 });
  }, [enabled, restoreOnMount, pageKey, restore]);

  return {
    storageKey: key,
    save,
    restore,
    clear,
    resolveScrollRoot: () => resolveScrollRoot(scrollRoot),
  };
}

export default useListScrollRestore;
