import { useCallback, useMemo, useRef, useState } from "react";

/**
 * Multi-select de filas/cards por id (string|number).
 * Ideal para lotes (bulk) en listas ERP.
 *
 * U3: tri-state (partial → solo selecciona), shift-click rango,
 * Set persiste al filtrar/paginar (no auto-clear).
 */
export function useListSelection(initialIds = []) {
  const [selected, setSelected] = useState(() => new Set(initialIds.map(String)));
  const lastAnchorIdRef = useRef(null);

  const toggle = useCallback((id) => {
    const key = String(id);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    lastAnchorIdRef.current = key;
  }, []);

  /**
   * Toggle con rango inclusivo (Shift+click) sobre orderedIds (orden filtrado actual).
   * Sin Shift: toggle simple y actualiza ancla.
   */
  const toggleWithRange = useCallback((id, { shiftKey = false, orderedIds = [] } = {}) => {
    const key = String(id);
    const ordered = Array.isArray(orderedIds) ? orderedIds.map(String) : [];

    if (shiftKey && lastAnchorIdRef.current != null && ordered.length > 0) {
      const anchor = String(lastAnchorIdRef.current);
      const a = ordered.indexOf(anchor);
      const b = ordered.indexOf(key);
      if (a >= 0 && b >= 0) {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        const range = ordered.slice(lo, hi + 1);
        setSelected((prev) => {
          const next = new Set(prev);
          range.forEach((rid) => next.add(rid));
          return next;
        });
        return;
      }
    }

    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    lastAnchorIdRef.current = key;
  }, []);

  const selectAll = useCallback((ids) => {
    const list = Array.isArray(ids) ? ids : [];
    setSelected(new Set(list.map(String)));
  }, []);

  /** Solo agrega ids (nunca limpia). Útil para "Seleccionar los N que coinciden". */
  const selectMatching = useCallback((ids) => {
    const list = Array.isArray(ids) ? ids : [];
    setSelected((prev) => {
      const next = new Set(prev);
      list.forEach((id) => next.add(String(id)));
      return next;
    });
  }, []);

  const addMany = useCallback((ids) => {
    const list = Array.isArray(ids) ? ids : [];
    setSelected((prev) => {
      const next = new Set(prev);
      list.forEach((id) => next.add(String(id)));
      return next;
    });
  }, []);

  const removeMany = useCallback((ids) => {
    const list = Array.isArray(ids) ? ids : [];
    setSelected((prev) => {
      const next = new Set(prev);
      list.forEach((id) => next.delete(String(id)));
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setSelected(new Set());
    lastAnchorIdRef.current = null;
  }, []);

  const isSelected = useCallback(
    (id) => selected.has(String(id)),
    [selected]
  );

  const count = selected.size;

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  const allVisibleSelected = useCallback(
    (visibleIds) => {
      const list = Array.isArray(visibleIds) ? visibleIds.map(String) : [];
      if (list.length === 0) return false;
      return list.every((id) => selected.has(id));
    },
    [selected]
  );

  const someVisibleSelected = useCallback(
    (visibleIds) => {
      const list = Array.isArray(visibleIds) ? visibleIds.map(String) : [];
      if (list.length === 0) return false;
      return list.some((id) => selected.has(id)) && !list.every((id) => selected.has(id));
    },
    [selected]
  );

  /**
   * Tri-state header:
   * - Si todos visibles ya están seleccionados → quita solo los visibles.
   * - Si vacío o parcial (indeterminate) → SOLO agrega visibles (nunca limpia).
   */
  const toggleAllVisible = useCallback((visibleIds) => {
    const list = Array.isArray(visibleIds) ? visibleIds.map(String) : [];
    if (list.length === 0) return;
    setSelected((prev) => {
      const allOn = list.every((id) => prev.has(id));
      if (allOn) {
        const next = new Set(prev);
        list.forEach((id) => next.delete(id));
        return next;
      }
      // empty OR partial → select all visible only (never clear)
      const next = new Set(prev);
      list.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  return {
    selected,
    selectedIds,
    count,
    toggle,
    toggleWithRange,
    selectAll,
    selectMatching,
    addMany,
    removeMany,
    clear,
    isSelected,
    allVisibleSelected,
    someVisibleSelected,
    toggleAllVisible,
    setSelected,
    lastAnchorIdRef,
  };
}

export default useListSelection;
