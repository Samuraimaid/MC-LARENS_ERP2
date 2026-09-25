import { useCallback, useMemo, useState } from "react";

/**
 * Multi-select de filas/cards por id (string|number).
 * Ideal para lotes (bulk) en listas ERP.
 */
export function useListSelection(initialIds = []) {
  const [selected, setSelected] = useState(() => new Set(initialIds.map(String)));

  const toggle = useCallback((id) => {
    const key = String(id);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids) => {
    const list = Array.isArray(ids) ? ids : [];
    setSelected(new Set(list.map(String)));
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

  const toggleAllVisible = useCallback(
    (visibleIds) => {
      const list = Array.isArray(visibleIds) ? visibleIds.map(String) : [];
      if (list.length === 0) return;
      setSelected((prev) => {
        const allOn = list.every((id) => prev.has(id));
        if (allOn) {
          const next = new Set(prev);
          list.forEach((id) => next.delete(id));
          return next;
        }
        const next = new Set(prev);
        list.forEach((id) => next.add(id));
        return next;
      });
    },
    []
  );

  return {
    selected,
    selectedIds,
    count,
    toggle,
    selectAll,
    addMany,
    removeMany,
    clear,
    isSelected,
    allVisibleSelected,
    someVisibleSelected,
    toggleAllVisible,
    setSelected,
  };
}

export default useListSelection;
