import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserDirectoryFilters } from "@/components/users/UserDirectoryFilters";
import { DirectoryPagination } from "@/components/users/DirectoryPagination";
import { useUserDirectory } from "@/hooks/useUserDirectory";
import { UserRound, Check } from "lucide-react";

export function UserDirectoryPicker({
  selectedUserId = "",
  onSelect,
  rolesMap = {},
  branches = [],
  active = true,
  className,
}) {
  const directory = useUserDirectory({ active, pageSize: 40, pinOnly: true });
  const {
    rows,
    total,
    loading,
    pagination,
    queryKey,
    nextPage,
    prevPage,
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

  const branchLabelById = useMemo(() => {
    const map = new Map(branchOptions.map((item) => [item.value, item.label]));
    map.set("__none__", "Sin sucursal");
    return map;
  }, [branchOptions]);

  const roleLabelById = useMemo(
    () => new Map(roleOptions.map((item) => [item.value, item.label])),
    [roleOptions]
  );

  const selectedUser = rows.find((row) => row.user_id === selectedUserId)
    || (selectedUserId ? { user_id: selectedUserId, display_name: selectedUserId } : null);

  const getRoleColor = (role) => {
    const colors = {
      gerencia: "bg-purple-500",
      supervisor: "bg-blue-500",
      ventas: "bg-green-500",
      cajero: "bg-emerald-500",
      bodegas: "bg-yellow-500",
      instalaciones: "bg-cyan-500",
    };
    return colors[role] || "bg-slate-500";
  };

  return (
    <div className={cn("space-y-4 animate-fade-up-soft", className)}>
      <UserDirectoryFilters
        directory={directory}
        rolesMap={rolesMap}
        branches={branches}
        showOverridesFilter
      />

      {selectedUser ? (
        <div className="rounded-lg border bg-muted/30 px-3 py-2 flex items-center justify-between gap-3 ui-panel animate-erp-fade-check">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-9 w-9">
              <AvatarFallback className={getRoleColor(selectedUser.role)}>
                {(selectedUser.display_name || selectedUser.name || "?").charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="font-medium truncate">
                {selectedUser.display_name || selectedUser.name || selectedUser.user_id}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {roleLabelById.get(selectedUser.role) || selectedUser.role || "Sin rol"}
                {" · "}
                {branchLabelById.get(selectedUser.branch_id) || "Sin sucursal"}
              </div>
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => onSelect?.("")}>
            Quitar selección
          </Button>
        </div>
      ) : null}

      <div
        key={queryKey}
        className="rounded-lg border overflow-hidden ui-panel shadow-sm animate-draft-load"
      >
        <div className="flex items-center justify-between border-b bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          <span>
            {loading
              ? "Buscando usuarios..."
              : `${total} usuario(s) en total`}
          </span>
          <span className="hidden sm:inline">Haz clic en una fila para editar permisos</span>
        </div>
        <div className="max-h-[320px] overflow-y-auto divide-y">
          {!loading && rows.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground animate-fade-up-soft">
              <UserRound className="mx-auto mb-2 h-8 w-8 opacity-40" />
              No hay usuarios con esos filtros.
            </div>
          ) : (
            rows.map((row) => {
              const isSelected = row.user_id === selectedUserId;
              return (
                <button
                  key={row.user_id}
                  type="button"
                  onClick={() => onSelect?.(row.user_id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 flex items-center gap-3 ui-interactive transition-colors hover:bg-muted/50",
                    isSelected && "bg-primary/10 hover:bg-primary/15"
                  )}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className={getRoleColor(row.role)}>
                      {(row.display_name || row.name || "?").charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{row.display_name || row.name}</span>
                      {row.has_user_overrides ? (
                        <Badge variant="secondary" className="text-[10px]">Personalizado</Badge>
                      ) : null}
                      {isSelected ? <Badge className="text-[10px]">Seleccionado</Badge> : null}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {roleLabelById.get(row.role) || row.role}
                      {" · "}
                      {branchLabelById.get(row.branch_id) || "Sin sucursal"}
                      {row.phone ? ` · ${row.phone}` : ""}
                    </div>
                  </div>
                  {isSelected ? <Check className="h-4 w-4 text-primary shrink-0" /> : null}
                </button>
              );
            })
          )}
        </div>
        <DirectoryPagination
          pagination={pagination}
          loading={loading}
          onPrev={prevPage}
          onNext={nextPage}
        />
      </div>
    </div>
  );
}