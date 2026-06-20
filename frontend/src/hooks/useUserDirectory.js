import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_BASE as API } from "@/lib/api";
import { toast } from "sonner";

function overridesParam(overridesFilter) {
  if (overridesFilter === "custom") return true;
  if (overridesFilter === "inherited") return false;
  return undefined;
}

export function useUserDirectory({
  active = true,
  pageSize = 60,
  pinOnly = true,
} = {}) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [overridesFilter, setOverridesFilter] = useState("all");
  const [offset, setOffset] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setOffset(0);
  }, [debouncedSearch, roleFilter, branchFilter, overridesFilter]);

  const fetchDirectory = useCallback(async () => {
    if (!active) return;
    setLoading(true);
    try {
      const hasOverrides = overridesParam(overridesFilter);
      const params = {
        search: debouncedSearch,
        role: roleFilter,
        branch_id: branchFilter,
        pin_only: pinOnly,
        limit: pageSize,
        offset,
      };
      if (hasOverrides !== undefined) {
        params.has_overrides = hasOverrides;
      }

      const response = await axios.get(`${API}/users/directory`, {
        withCredentials: true,
        params,
      });
      setRows(Array.isArray(response.data?.rows) ? response.data.rows : []);
      setTotal(Number(response.data?.total || 0));
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudo cargar el directorio de usuarios");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    active,
    branchFilter,
    debouncedSearch,
    offset,
    overridesFilter,
    pageSize,
    pinOnly,
  ]);

  useEffect(() => {
    fetchDirectory();
  }, [fetchDirectory]);

  const pagination = useMemo(() => {
    const start = total === 0 ? 0 : offset + 1;
    const end = Math.min(offset + rows.length, total);
    return {
      start,
      end,
      total,
      hasMore: offset + rows.length < total,
      canPrev: offset > 0,
      page: Math.floor(offset / pageSize) + 1,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }, [offset, pageSize, rows.length, total]);

  const queryKey = useMemo(
    () => [debouncedSearch, roleFilter, branchFilter, overridesFilter, offset].join("|"),
    [branchFilter, debouncedSearch, offset, overridesFilter, roleFilter]
  );

  const clearFilters = useCallback(() => {
    setSearch("");
    setRoleFilter("all");
    setBranchFilter("all");
    setOverridesFilter("all");
  }, []);

  const nextPage = useCallback(() => {
    setOffset((current) => current + pageSize);
  }, [pageSize]);

  const prevPage = useCallback(() => {
    setOffset((current) => Math.max(0, current - pageSize));
  }, [pageSize]);

  return {
    search,
    setSearch,
    roleFilter,
    setRoleFilter,
    branchFilter,
    setBranchFilter,
    overridesFilter,
    setOverridesFilter,
    rows,
    total,
    loading,
    pageSize,
    pagination,
    queryKey,
    clearFilters,
    refresh: fetchDirectory,
    nextPage,
    prevPage,
  };
}