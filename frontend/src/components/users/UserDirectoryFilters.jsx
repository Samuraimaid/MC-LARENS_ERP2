import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterCombobox } from "@/components/users/FilterCombobox";
import { RefreshCw, Search, X } from "lucide-react";

export const OVERRIDES_FILTER_OPTIONS = [
  { value: "custom", label: "Solo personalizados" },
  { value: "inherited", label: "Solo heredados del rol" },
];

export function UserDirectoryFilters({
  directory,
  rolesMap = {},
  branches = [],
  showOverridesFilter = true,
  onRefresh,
  searchTestId,
  className,
}) {
  const {
    search,
    setSearch,
    roleFilter,
    setRoleFilter,
    branchFilter,
    setBranchFilter,
    overridesFilter,
    setOverridesFilter,
    loading,
    clearFilters,
    refresh,
  } = directory;

  const roleOptions = useMemo(
    () =>
      Object.entries(rolesMap)
        .map(([value, meta]) => ({
          value,
          label: meta?.label || value,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" })),
    [rolesMap]
  );

  const branchOptions = useMemo(
    () =>
      [...branches]
        .map((branch) => ({
          value: branch.branch_id,
          label: branch.name || branch.branch_id,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" })),
    [branches]
  );

  const handleRefresh = () => {
    onRefresh?.();
    refresh();
  };

  return (
    <div className={cn("grid gap-3 ui-fade-in-stagger lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto]", className)}>
      <div className="space-y-2">
        <Label>Buscar usuario</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nombre, apellido, teléfono o correo"
            className="pl-9"
            data-testid={searchTestId}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Rol</Label>
        <FilterCombobox
          value={roleFilter}
          onChange={setRoleFilter}
          options={roleOptions}
          placeholder="Filtrar por rol"
          searchPlaceholder="Buscar rol..."
          allLabel="Todos los roles"
          testId="filter-role-users"
        />
      </div>
      <div className="space-y-2">
        <Label>Sucursal</Label>
        <FilterCombobox
          value={branchFilter}
          onChange={setBranchFilter}
          options={[
            { value: "__none__", label: "Sin sucursal" },
            ...branchOptions,
          ]}
          placeholder="Filtrar por sucursal"
          searchPlaceholder="Buscar sucursal..."
          allLabel="Todas las sucursales"
          testId="filter-branch-users"
        />
      </div>
      {showOverridesFilter ? (
        <div className="space-y-2">
          <Label>Permisos</Label>
          <FilterCombobox
            value={overridesFilter}
            onChange={setOverridesFilter}
            options={OVERRIDES_FILTER_OPTIONS}
            placeholder="Filtrar permisos"
            searchPlaceholder="Buscar..."
            allLabel="Todos los permisos"
            testId="filter-overrides-users"
          />
        </div>
      ) : (
        <div className="hidden lg:block" aria-hidden="true" />
      )}
      <div className="flex items-end gap-2">
        <Button type="button" variant="outline" onClick={clearFilters}>
          <X className="h-4 w-4 mr-1" />
          Limpiar
        </Button>
        <Button type="button" variant="outline" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>
    </div>
  );
}