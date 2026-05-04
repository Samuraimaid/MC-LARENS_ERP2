import React, { useEffect, useMemo, useState, useId } from "react";
import axios from "axios";
import { toast } from "sonner";
import { API_BASE as API } from "@/lib/api";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { RefreshCw, Download, Eye, Upload, Plus, X } from "lucide-react";

const BACKUP_SCOPE_OPTIONS = [
  { key: "users", label: "Solo usuarios" },
  { key: "customers_with_vehicles", label: "Solo clientes con vehículos" },
  { key: "brands_models", label: "Solo marcas y modelos" },
  { key: "inventory", label: "Solo inventario" },
  { key: "permissions", label: "Solo permisos" },
  { key: "movements", label: "Solo movimientos" },
  { key: "registros", label: "Solo registros" },
];

const QUICK_FILTERS = [
  { key: "1h", label: "Última hora" },
  { key: "today", label: "Hoy" },
  { key: "7d", label: "7 días" },
];

const ACTION_LABELS_ES = {
  price_update: "Cambió precio de producto",
  backup_export: "Exportó respaldo",
  backup_import: "Importó respaldo",
  request_post: "Creó",
  request_put: "Actualizó",
  request_patch: "Actualizó",
  request_delete: "Eliminó",
};

const ENTITY_LABELS_ES = {
  users: "usuario",
  sales: "venta",
  products: "producto",
  inventory: "inventario",
  customers: "cliente",
  vehicles: "vehículo",
  notifications: "notificación",
  backup: "respaldo",
};

function toDateTimeLocalValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function formatEventTimestamp(timestamp) {
  if (!timestamp) return "-";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;

  const parts = new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value || "";
  const day = get("day");
  const month = (get("month") || "").replace(".", "");
  const year = get("year");
  const hour = get("hour");
  const minute = get("minute");
  const second = get("second");
  return `${day}/${month}/${year} - ${hour}:${minute}:${second}`;
}

function formatFriendlyAction(event) {
  const action = String(event?.action || "");
  const entityType = String(event?.entity_type || "");
  const entityId = String(event?.entity_id || "").trim();
  const details = event?.details || {};

  if (action === "price_update") {
    return entityId ? `Cambió precio de producto (${entityId})` : "Cambió precio de producto";
  }
  if (action === "backup_import") {
    return details?.filename ? `Importó respaldo (${details.filename})` : "Importó respaldo";
  }
  if (action === "backup_export") {
    return "Exportó respaldo";
  }

  if (entityType === "sales") {
    const invoice = details?.invoice_number || details?.invoice || details?.sale_number;
    if (invoice) return `Realizó venta con factura ${invoice}`;
    if (entityId) return `Realizó venta (${entityId})`;
    return "Realizó venta";
  }

  if (entityType === "users" && action === "request_post") {
    return entityId ? `Agregó usuario (${entityId})` : "Agregó usuario";
  }

  if (action.startsWith("request_")) {
    const verb = ACTION_LABELS_ES[action] || "Realizó";
    const entityLabel = ENTITY_LABELS_ES[entityType] || entityType || "registro";
    return entityId ? `${verb} ${entityLabel} (${entityId})` : `${verb} ${entityLabel}`;
  }

  return ACTION_LABELS_ES[action] || action || "-";
}

function MultiSelectAutocomplete({
  label,
  placeholder,
  options,
  selectedValues,
  onChange,
  emptyHelp,
}) {
  const [draft, setDraft] = useState("");
  const listId = useId();

  const normalizedDraft = draft.trim().toLowerCase();
  const availableOptions = useMemo(() => {
    return (options || []).filter((option) => !selectedValues.includes(option));
  }, [options, selectedValues]);

  const suggestions = useMemo(() => {
    if (!normalizedDraft) return availableOptions.slice(0, 30);
    return availableOptions
      .filter((option) => option.toLowerCase().includes(normalizedDraft))
      .slice(0, 30);
  }, [availableOptions, normalizedDraft]);

  const addValue = (rawValue) => {
    const value = String(rawValue || "").trim();
    if (!value || selectedValues.includes(value)) return;
    onChange([...selectedValues, value]);
    setDraft("");
  };

  const removeValue = (valueToRemove) => {
    onChange(selectedValues.filter((item) => item !== valueToRemove));
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{label}</div>
      <div className="flex items-center gap-2">
        <Input
          list={listId}
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addValue(draft);
            }
          }}
        />
        <Button type="button" variant="outline" onClick={() => addValue(draft)} disabled={!draft.trim()}>
          <Plus className="h-4 w-4 mr-1" />
          Agregar
        </Button>
      </div>
      <datalist id={listId}>
        {suggestions.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
      <div className="flex flex-wrap gap-2 min-h-8">
        {selectedValues.length === 0 && <span className="text-xs text-muted-foreground">{emptyHelp}</span>}
        {selectedValues.map((value) => (
          <Badge key={value} variant="secondary" className="gap-2">
            {value}
            <button
              type="button"
              className="inline-flex"
              onClick={() => removeValue(value)}
              aria-label={`Quitar ${value}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
    </div>
  );
}

export function HyperVisorPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [access, setAccess] = useState({ enabled: false, mode: null, role: null });
  const [summary, setSummary] = useState(null);
  const [events, setEvents] = useState([]);
  const [backupScopes, setBackupScopes] = useState([]);
  const [backupFile, setBackupFile] = useState(null);
  const [overwriteImport, setOverwriteImport] = useState(false);
  const [busyExport, setBusyExport] = useState(false);
  const [busyImport, setBusyImport] = useState(false);
  const [filterOptions, setFilterOptions] = useState({
    users: [],
    actions: [],
    entity_types: [],
    entity_ids: [],
  });
  const [filters, setFilters] = useState({
    from_timestamp: "",
    to_timestamp: "",
    actor_names: [],
    actions: [],
    entity_types: [],
    entity_ids: [],
  });

  const modeLabel = useMemo(() => {
    if (access.mode === "full") return "Acceso completo";
    if (access.mode === "readonly") return "Solo lectura";
    return "Sin acceso";
  }, [access.mode]);

  const fetchData = async (showToast = false, overrideFilters = null) => {
    try {
      setRefreshing(true);
      const activeFilters = overrideFilters || filters;
      const params = {};
      if (activeFilters.from_timestamp) {
        const dateFrom = new Date(activeFilters.from_timestamp);
        if (!Number.isNaN(dateFrom.getTime())) params.from_timestamp = dateFrom.toISOString();
      }
      if (activeFilters.to_timestamp) {
        const dateTo = new Date(activeFilters.to_timestamp);
        if (!Number.isNaN(dateTo.getTime())) params.to_timestamp = dateTo.toISOString();
      }
      if (activeFilters.actor_names.length) params.actor_name = activeFilters.actor_names.join(",");
      if (activeFilters.actions.length) params.action = activeFilters.actions.join(",");
      if (activeFilters.entity_types.length) params.entity_type = activeFilters.entity_types.join(",");
      if (activeFilters.entity_ids.length) params.entity_id = activeFilters.entity_ids.join(",");

      const [accessRes, summaryRes, eventsRes, optionsRes] = await Promise.all([
        axios.get(`${API}/hypervisor/access`, { withCredentials: true }),
        axios.get(`${API}/hypervisor/summary`, { withCredentials: true }),
        axios.get(`${API}/hypervisor/events`, { withCredentials: true, params: { limit: 200, ...params } }),
        axios.get(`${API}/hypervisor/filter-options`, { withCredentials: true }),
      ]);

      setAccess(accessRes.data || { enabled: false, mode: null });
      setSummary(summaryRes.data || null);
      setEvents(eventsRes.data?.events || []);
      setFilterOptions({
        users: optionsRes?.data?.users || [],
        actions: optionsRes?.data?.actions || [],
        entity_types: optionsRes?.data?.entity_types || [],
        entity_ids: optionsRes?.data?.entity_ids || [],
      });
      if (showToast) toast.success("HyperVisor actualizado");
    } catch (error) {
      const detail = error?.response?.data?.detail;
      if (error?.response?.status === 403) {
        toast.error("No tienes permiso para HyperVisor");
      } else {
        toast.error(detail || "Error cargando HyperVisor");
      }
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyQuickFilter = (key) => {
    const now = new Date();
    let from = null;
    if (key === "1h") {
      from = new Date(now.getTime() - 60 * 60 * 1000);
    } else if (key === "today") {
      from = new Date(now);
      from.setHours(0, 0, 0, 0);
    } else if (key === "7d") {
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
    if (!from) return;

    const nextFilters = {
      ...filters,
      from_timestamp: toDateTimeLocalValue(from),
      to_timestamp: toDateTimeLocalValue(now),
    };
    setFilters(nextFilters);
    fetchData(true, nextFilters);
  };

  const toggleScope = (scopeKey) => {
    setBackupScopes((prev) => {
      if (prev.includes(scopeKey)) return prev.filter((k) => k !== scopeKey);
      return [...prev, scopeKey];
    });
  };

  const downloadExcelBackup = async () => {
    setBusyExport(true);
    try {
      const scopeValue = backupScopes.join(",");
      const response = await axios.get(`${API}/backup/excel`, {
        withCredentials: true,
        responseType: "blob",
        params: {
          scopes: scopeValue || undefined,
          secure: true,
        },
      });

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `erp_secure_backup_${new Date().toISOString().replace(/[:.]/g, "-")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Respaldo seguro descargado");
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudo descargar respaldo");
    } finally {
      setBusyExport(false);
    }
  };

  const importExcelBackup = async () => {
    if (!backupFile) {
      toast.error("Selecciona un archivo de respaldo");
      return;
    }
    if (access.mode !== "full") {
      toast.error("Solo gerencia o programador puede importar respaldos");
      return;
    }

    setBusyImport(true);
    try {
      const scopeValue = backupScopes.join(",");
      const formData = new FormData();
      formData.append("file", backupFile);
      if (scopeValue) formData.append("scopes", scopeValue);
      formData.append("overwrite", overwriteImport ? "true" : "false");

      const response = await axios.post(`${API}/backup/excel/import`, formData, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("Respaldo importado correctamente");
      const sheets = response?.data?.sheets || {};
      const sheetNames = Object.keys(sheets);
      if (sheetNames.length) {
        const first = sheetNames[0];
        const sample = sheets[first];
        toast.info(
          `Importación: ${sheetNames.length} hojas procesadas. Ejemplo ${first} -> +${sample.inserted} / ~${sample.updated} / =${sample.skipped}`,
          { duration: 4500 }
        );
      }
      await fetchData(false);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudo importar respaldo");
    } finally {
      setBusyImport(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="hypervisor-page">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">HyiperVisor</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Trazabilidad global de cambios y respaldos operativos.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={access.mode === "full" ? "default" : "secondary"}>{modeLabel}</Badge>
          <Button variant="outline" onClick={() => fetchData(true)} disabled={refreshing}>
            {refreshing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
            Actualizar
          </Button>
          <Button onClick={downloadExcelBackup} disabled={busyExport}>
            {busyExport ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Exportar respaldo seguro
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Respaldo selectivo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 md:grid-cols-3">
            {BACKUP_SCOPE_OPTIONS.map((opt) => (
              <label key={opt.key} className="flex items-center gap-2 text-sm border rounded-md px-3 py-2">
                <input
                  type="checkbox"
                  checked={backupScopes.includes(opt.key)}
                  onChange={() => toggleScope(opt.key)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>

          <div className="text-xs text-muted-foreground">
            Si no seleccionas nada, se exporta/importa todo el respaldo disponible.
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Input
              type="file"
              accept=".xlsx"
              onChange={(e) => setBackupFile(e.target.files?.[0] || null)}
              className="max-w-md"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={overwriteImport}
                onChange={(e) => setOverwriteImport(Boolean(e.target.checked))}
              />
              Sobrescribir existentes
            </label>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" onClick={downloadExcelBackup} disabled={busyExport}>
              {busyExport ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Exportar selección
            </Button>
            <Button
              variant="secondary"
              onClick={importExcelBackup}
              disabled={busyImport || access.mode !== "full"}
            >
              {busyImport ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Importar selección
            </Button>
            {access.mode !== "full" && (
              <Badge variant="secondary">Importación solo para Gerencia/Programador</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Eventos totales</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary?.total_events ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Eventos 24h</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary?.events_24h ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Eventos 7 días</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary?.events_7d ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Cambios de precio 7 días</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary?.price_changes_7d ?? 0}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            {QUICK_FILTERS.map((quick) => (
              <Button key={quick.key} variant="outline" onClick={() => applyQuickFilter(quick.key)} disabled={refreshing}>
                {quick.label}
              </Button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Input
              type="datetime-local"
              placeholder="Desde"
              value={filters.from_timestamp}
              onChange={(e) => setFilters((prev) => ({ ...prev, from_timestamp: e.target.value }))}
            />
            <Input
              type="datetime-local"
              placeholder="Hasta"
              value={filters.to_timestamp}
              onChange={(e) => setFilters((prev) => ({ ...prev, to_timestamp: e.target.value }))}
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <MultiSelectAutocomplete
              label="Usuarios"
              placeholder="Escribe o selecciona usuario"
              options={filterOptions.users}
              selectedValues={filters.actor_names}
              onChange={(values) => setFilters((prev) => ({ ...prev, actor_names: values }))}
              emptyHelp="Puedes seleccionar uno o varios usuarios"
            />
            <MultiSelectAutocomplete
              label="Acciones"
              placeholder="Escribe o selecciona acción"
              options={filterOptions.actions}
              selectedValues={filters.actions}
              onChange={(values) => setFilters((prev) => ({ ...prev, actions: values }))}
              emptyHelp="Puedes seleccionar una o varias acciones"
            />
            <MultiSelectAutocomplete
              label="Entidades"
              placeholder="Escribe o selecciona entidad"
              options={filterOptions.entity_types}
              selectedValues={filters.entity_types}
              onChange={(values) => setFilters((prev) => ({ ...prev, entity_types: values }))}
              emptyHelp="Puedes seleccionar una o varias entidades"
            />
            <MultiSelectAutocomplete
              label="ID"
              placeholder="Escribe o selecciona ID"
              options={filterOptions.entity_ids}
              selectedValues={filters.entity_ids}
              onChange={(values) => setFilters((prev) => ({ ...prev, entity_ids: values }))}
              emptyHelp="Puedes seleccionar uno o varios IDs"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="secondary" onClick={() => fetchData(true)} disabled={refreshing}>Aplicar filtros</Button>
            <Button
              variant="outline"
              onClick={() => {
                const clearedFilters = {
                  from_timestamp: "",
                  to_timestamp: "",
                  actor_names: [],
                  actions: [],
                  entity_types: [],
                  entity_ids: [],
                };
                setFilters(clearedFilters);
                fetchData(false, clearedFilters);
              }}
              disabled={refreshing}
            >
              Limpiar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Eventos recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-3">Fecha</th>
                  <th className="text-left py-2 pr-3">Usuario</th>
                  <th className="text-left py-2 pr-3">Rol</th>
                  <th className="text-left py-2 pr-3">Acción</th>
                  <th className="text-left py-2 pr-3">Entidad</th>
                  <th className="text-left py-2 pr-3">ID</th>
                  <th className="text-left py-2 pr-3">Status</th>
                  <th className="text-left py-2">Ruta</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.event_id} className="border-b align-top">
                    <td className="py-2 pr-3 whitespace-nowrap">{formatEventTimestamp(event.timestamp)}</td>
                    <td className="py-2 pr-3">{event.actor_name || event.actor_user_id || "sistema"}</td>
                    <td className="py-2 pr-3">{event.actor_role || "-"}</td>
                    <td className="py-2 pr-3">{formatFriendlyAction(event)}</td>
                    <td className="py-2 pr-3">{event.entity_type || "-"}</td>
                    <td className="py-2 pr-3">{event.entity_id || "-"}</td>
                    <td className="py-2 pr-3">{event.status_code || "-"}</td>
                    <td className="py-2">{event.path || "-"}</td>
                  </tr>
                ))}
                {events.length === 0 && (
                  <tr>
                    <td className="py-6 text-center text-muted-foreground" colSpan={8}>
                      Sin eventos para los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
