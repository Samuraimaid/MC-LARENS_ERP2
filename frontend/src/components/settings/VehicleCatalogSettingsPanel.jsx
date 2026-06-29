import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Database,
  RefreshCw,
  Search,
  CheckCircle2,
  History,
  BarChart3,
  ClipboardCheck,
  CloudDownload,
  RotateCcw,
  Truck,
} from "lucide-react";
import { API_BASE as API } from "@/lib/api";
import { VEHICLE_CATALOG_BRANDS } from "@/lib/vehicleCatalog";

const SILHOUETTE_OPTIONS = [
  { slug: "hatchback", label: "Hatchback" },
  { slug: "sedan", label: "Sedán" },
  { slug: "suv", label: "SUV" },
  { slug: "station-wagon", label: "Station Wagon" },
  { slug: "convertible", label: "Convertible" },
  { slug: "camioneta-1-cabina", label: "Camioneta 1 cabina" },
  { slug: "camioneta-cabina-y-media", label: "Camioneta cabina y media" },
  { slug: "microbus-carga", label: "Microbús de carga" },
  { slug: "microbus-pasajeros", label: "Microbús de pasajeros" },
  { slug: "camion-carga", label: "Camión de carga" },
  { slug: "cabezal", label: "Cabezal" },
];

const REVIEW_STATUS_META = {
  pending: { label: "Pendiente", variant: "secondary" },
  valid: { label: "Válida", variant: "default" },
  ignore: { label: "Ignorar", variant: "outline" },
  edited: { label: "Editada", variant: "default" },
};

function proposalKey(proposal, index) {
  return `${proposal.brand}::${proposal.model}::${index}`;
}

export function VehicleCatalogSettingsPanel({ canManage = false }) {
  const [catalogTab, setCatalogTab] = useState("resumen");
  const [catalogAudit, setCatalogAudit] = useState(null);
  const [catalogSummary, setCatalogSummary] = useState(null);
  const [catalogSyncState, setCatalogSyncState] = useState(null);
  const [catalogVersions, setCatalogVersions] = useState([]);
  const [catalogSchedule, setCatalogSchedule] = useState(null);
  const [syncBrandInput, setSyncBrandInput] = useState("TOYOTA");
  const [loadingCatalogAudit, setLoadingCatalogAudit] = useState(false);
  const [syncingCatalog, setSyncingCatalog] = useState(false);
  const [applyingCatalogSync, setApplyingCatalogSync] = useState(false);
  const [rebuildingCatalogTypes, setRebuildingCatalogTypes] = useState(false);
  const [backfillingFleet, setBackfillingFleet] = useState(false);
  const [rollingBackVersion, setRollingBackVersion] = useState("");
  const [proposalReviews, setProposalReviews] = useState({});

  const quality = catalogAudit?.quality_metrics || {};

  const fetchCatalogAudit = async () => {
    if (!canManage) return;
    setLoadingCatalogAudit(true);
    try {
      const response = await axios.get(`${API}/vehicle-catalog/audit`, { withCredentials: true });
      setCatalogAudit(response.data || null);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudo cargar la auditoría del catálogo");
    } finally {
      setLoadingCatalogAudit(false);
    }
  };

  const fetchCatalogSummary = async () => {
    if (!canManage) return;
    try {
      const response = await axios.get(`${API}/vehicle-catalog/summary`, { withCredentials: true });
      setCatalogSummary(response.data || null);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudo cargar el resumen del catálogo");
    }
  };

  const fetchCatalogSyncLast = async () => {
    if (!canManage) return;
    try {
      const response = await axios.get(`${API}/vehicle-catalog/sync/last`, { withCredentials: true });
      setCatalogSyncState(response.data || null);
      const proposals = response.data?.proposals || [];
      const nextReviews = {};
      proposals.forEach((proposal, index) => {
        const key = proposalKey(proposal, index);
        nextReviews[key] = {
          review_status: proposal.review_status || "pending",
          descriptor: proposal.descriptor || "",
          vehicle_type_slug: proposal.vehicle_type_slug || "sedan",
          engine: proposal.engine || "por definir [G]",
        };
      });
      setProposalReviews(nextReviews);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudo cargar la última sincronización");
    }
  };

  const fetchCatalogVersions = async () => {
    if (!canManage) return;
    try {
      const response = await axios.get(`${API}/vehicle-catalog/versions`, { withCredentials: true });
      setCatalogVersions(response.data?.versions || []);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudo cargar el historial");
    }
  };

  const fetchCatalogSchedule = async () => {
    if (!canManage) return;
    try {
      const response = await axios.get(`${API}/vehicle-catalog/schedule`, { withCredentials: true });
      setCatalogSchedule(response.data || null);
    } catch {
      setCatalogSchedule(null);
    }
  };

  useEffect(() => {
    if (!canManage) return;
    fetchCatalogAudit();
    fetchCatalogSummary();
    fetchCatalogSyncLast();
    fetchCatalogVersions();
    fetchCatalogSchedule();
  }, [canManage]);

  const runCatalogSync = async () => {
    if (!canManage) return;
    setSyncingCatalog(true);
    try {
      const brands = syncBrandInput ? [syncBrandInput.trim().toUpperCase()] : undefined;
      const response = await axios.post(
        `${API}/vehicle-catalog/sync`,
        { brands, max_brands: 10 },
        { withCredentials: true }
      );
      setCatalogSyncState(response.data || null);
      const proposals = response.data?.proposals || [];
      const nextReviews = {};
      proposals.forEach((proposal, index) => {
        const key = proposalKey(proposal, index);
        nextReviews[key] = {
          review_status: "pending",
          descriptor: proposal.descriptor || "",
          vehicle_type_slug: proposal.vehicle_type_slug || "sedan",
          engine: proposal.engine || "por definir [G]",
        };
      });
      setProposalReviews(nextReviews);
      setCatalogTab("revision");
      toast.success(`Sync completado: ${response.data?.proposal_count || 0} propuestas`);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al sincronizar catálogo");
    } finally {
      setSyncingCatalog(false);
    }
  };

  const applyValidProposals = async () => {
    if (!canManage) return;
    const proposals = (catalogSyncState?.proposals || [])
      .map((proposal, index) => {
        const key = proposalKey(proposal, index);
        const review = proposalReviews[key] || {};
        if (!["valid", "edited"].includes(review.review_status)) return null;
        return {
          ...proposal,
          review_status: review.review_status,
          descriptor: review.descriptor || proposal.descriptor,
          engine: review.engine || proposal.engine,
          vehicle_type_slug: review.vehicle_type_slug || proposal.vehicle_type_slug,
          label: `${review.descriptor || proposal.descriptor} - ${review.engine || proposal.engine || "por definir [G]"}`,
        };
      })
      .filter(Boolean);

    if (!proposals.length) {
      toast.error("Marca al menos una propuesta como válida o editada");
      return;
    }

    setApplyingCatalogSync(true);
    try {
      const response = await axios.post(
        `${API}/vehicle-catalog/sync/apply`,
        { proposals, max_add: 200 },
        { withCredentials: true }
      );
      toast.success(`Agregadas ${response.data?.added || 0} entradas · backup ${response.data?.backup_version_id || ""}`);
      await Promise.all([fetchCatalogAudit(), fetchCatalogSyncLast(), fetchCatalogSummary(), fetchCatalogVersions()]);
      setCatalogTab("resumen");
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudieron aplicar las propuestas");
    } finally {
      setApplyingCatalogSync(false);
    }
  };

  const rebuildCatalogTypes = async () => {
    if (!canManage) return;
    setRebuildingCatalogTypes(true);
    try {
      const response = await axios.post(`${API}/vehicle-catalog/rebuild-types`, {}, { withCredentials: true });
      toast.success(`Siluetas re-asignadas (${response.data?.entries || 0} entradas)`);
      await fetchCatalogAudit();
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo re-asignar siluetas");
    } finally {
      setRebuildingCatalogTypes(false);
    }
  };

  const runFleetBackfill = async (dryRun = false) => {
    if (!canManage) return;
    setBackfillingFleet(true);
    try {
      const response = await axios.post(
        `${API}/vehicle-catalog/backfill-fleet`,
        { dry_run: dryRun, limit: 5000 },
        { withCredentials: true }
      );
      const stats = response.data || {};
      toast.success(
        dryRun
          ? `Simulación: ${stats.updated || 0} vehículos se actualizarían`
          : `Backfill: ${stats.updated || 0} vehículos actualizados`
      );
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo ejecutar el backfill");
    } finally {
      setBackfillingFleet(false);
    }
  };

  const rollbackCatalog = async (versionId) => {
    if (!canManage || !versionId) return;
    const confirmed = window.confirm(`¿Restaurar el catálogo a la versión ${versionId}?`);
    if (!confirmed) return;
    setRollingBackVersion(versionId);
    try {
      await axios.post(`${API}/vehicle-catalog/rollback`, { version_id: versionId }, { withCredentials: true });
      toast.success("Catálogo restaurado");
      await Promise.all([fetchCatalogAudit(), fetchCatalogSummary(), fetchCatalogVersions()]);
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo restaurar el catálogo");
    } finally {
      setRollingBackVersion("");
    }
  };

  const updateProposalReview = (key, patch) => {
    setProposalReviews((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || {}), ...patch },
    }));
  };

  const validProposalCount = useMemo(
    () =>
      Object.values(proposalReviews).filter((review) => ["valid", "edited"].includes(review.review_status)).length,
    [proposalReviews]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Catálogo maestro y sincronización web
        </CardTitle>
        <CardDescription>
          Auditoría, descubrimiento de modelos, revisión humana, versionado y backfill de flota.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!canManage && (
          <p className="text-sm text-amber-600">Solo gerencia puede administrar el catálogo maestro.</p>
        )}

        <Tabs value={catalogTab} onValueChange={setCatalogTab}>
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 md:grid-cols-5">
            <TabsTrigger value="resumen" className="text-xs sm:text-sm">Resumen</TabsTrigger>
            <TabsTrigger value="auditoria" className="text-xs sm:text-sm">Auditoría</TabsTrigger>
            <TabsTrigger value="sync" className="text-xs sm:text-sm">Sincronizar</TabsTrigger>
            <TabsTrigger value="revision" className="text-xs sm:text-sm">Revisión</TabsTrigger>
            <TabsTrigger value="historial" className="text-xs sm:text-sm">Historial</TabsTrigger>
          </TabsList>

          <TabsContent value="resumen" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Entradas maestro</p>
                <p className="text-2xl font-semibold">{catalogAudit?.total_entries ?? "—"}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Marcas maestro</p>
                <p className="text-2xl font-semibold">{catalogAudit?.total_brands ?? "—"}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Marcas MongoDB</p>
                <p className="text-2xl font-semibold">{catalogSummary?.mongo_settings?.brands ?? "—"}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Cobertura siluetas</p>
                <p className="text-2xl font-semibold">{quality.coverage_pct != null ? `${quality.coverage_pct}%` : "—"}</p>
              </div>
            </div>

            <div className="rounded-md border p-3 text-sm space-y-2">
              <p className="font-medium">Unificación de catálogos</p>
              <p className="text-muted-foreground">{catalogSummary?.recommendation}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">Compartidas: {catalogSummary?.divergence?.shared_brands ?? 0}</Badge>
                <Badge variant="outline">Solo maestro: {(catalogSummary?.divergence?.only_in_master || []).length}</Badge>
                <Badge variant="outline">Solo MongoDB: {(catalogSummary?.divergence?.only_in_mongo || []).length}</Badge>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={!canManage || backfillingFleet} onClick={() => runFleetBackfill(true)}>
                <Truck className="mr-2 h-4 w-4" />
                Simular backfill flota
              </Button>
              <Button type="button" disabled={!canManage || backfillingFleet} onClick={() => runFleetBackfill(false)}>
                <Truck className="mr-2 h-4 w-4" />
                Backfill flota
              </Button>
              <Button type="button" variant="outline" disabled={!canManage || loadingCatalogAudit} onClick={fetchCatalogAudit}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Actualizar
              </Button>
            </div>

            {catalogSchedule && (
              <p className="text-xs text-muted-foreground">
                Sync automático mensual: {catalogSchedule.enabled ? "activo" : "inactivo"}
                {catalogSchedule.last_auto_sync_at ? ` · última: ${new Date(catalogSchedule.last_auto_sync_at).toLocaleString("es")}` : ""}
              </p>
            )}
          </TabsContent>

          <TabsContent value="auditoria" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Líneas modelo</p>
                <p className="text-2xl font-semibold">{catalogAudit?.total_lines ?? "—"}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Sin silueta</p>
                <p className="text-2xl font-semibold">{catalogAudit?.missing_vehicle_type_slug ?? "—"}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Override manual</p>
                <p className="text-2xl font-semibold">{quality.override_pct != null ? `${quality.override_pct}%` : "—"}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Por reglas</p>
                <p className="text-2xl font-semibold">{quality.rules_pct != null ? `${quality.rules_pct}%` : "—"}</p>
              </div>
            </div>

            <div className="rounded-md border p-3 space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Métricas de calidad
              </p>
              <div className="grid gap-2 sm:grid-cols-2 text-xs text-muted-foreground">
                <p>Pickups en catálogo: {quality.pickup_entries ?? 0}</p>
                <p>Pickups sin pista de cabina: {quality.pickup_without_cab_hint ?? 0}</p>
                <p>Web sync: {quality.web_sync_pct != null ? `${quality.web_sync_pct}%` : "—"}</p>
                <p>Grupos solapados: {(catalogAudit?.overlap_groups || []).length}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={!canManage || loadingCatalogAudit} onClick={fetchCatalogAudit}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Actualizar auditoría
              </Button>
              <Button type="button" variant="outline" disabled={!canManage || rebuildingCatalogTypes} onClick={rebuildCatalogTypes}>
                Re-asignar siluetas
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="sync" className="space-y-4 mt-4">
            <div className="grid gap-3 md:grid-cols-[220px_1fr_auto] items-end">
              <div className="space-y-2">
                <Label>Marca a sincronizar</Label>
                <Select value={syncBrandInput} onValueChange={setSyncBrandInput}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar marca" />
                  </SelectTrigger>
                  <SelectContent>
                    {VEHICLE_CATALOG_BRANDS.map((brand) => (
                      <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground pb-2">
                Fuentes: Wikipedia + Wikidata. vPIC se usa al decodificar VIN en registro de vehículos.
              </p>
              <Button type="button" disabled={!canManage || syncingCatalog} onClick={runCatalogSync}>
                <Search className="mr-2 h-4 w-4" />
                {syncingCatalog ? "Buscando..." : "Buscar modelos nuevos"}
              </Button>
            </div>

            {catalogSyncState?.updated_at && (
              <p className="text-xs text-muted-foreground">
                Última sync: {new Date(catalogSyncState.updated_at).toLocaleString("es")}
                {" · "}
                {catalogSyncState.proposal_count || 0} propuestas
              </p>
            )}
          </TabsContent>

          <TabsContent value="revision" className="space-y-4 mt-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4" />
                Cola de revisión humana · {validProposalCount} listas para aplicar
              </p>
              <Button type="button" size="sm" disabled={!canManage || applyingCatalogSync} onClick={applyValidProposals}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Aplicar válidas/editadas
              </Button>
            </div>

            {(catalogSyncState?.proposals || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay propuestas pendientes. Ejecuta una sincronización primero.</p>
            ) : (
              <div className="space-y-3 rounded-md border p-3 max-h-[28rem] overflow-y-auto">
                {(catalogSyncState.proposals || []).slice(0, 80).map((proposal, index) => {
                  const key = proposalKey(proposal, index);
                  const review = proposalReviews[key] || {};
                  const statusMeta = REVIEW_STATUS_META[review.review_status] || REVIEW_STATUS_META.pending;
                  return (
                    <div key={key} className="rounded border p-3 space-y-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">{proposal.model}</p>
                          <p className="text-xs text-muted-foreground">{proposal.brand} · {proposal.source}</p>
                        </div>
                        <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                      </div>

                      <div className="grid gap-2 md:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Descriptor</Label>
                          <Input
                            value={review.descriptor ?? proposal.descriptor ?? ""}
                            disabled={!canManage}
                            onChange={(event) => updateProposalReview(key, { descriptor: event.target.value, review_status: "edited" })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Motor</Label>
                          <Input
                            value={review.engine ?? proposal.engine ?? ""}
                            disabled={!canManage}
                            onChange={(event) => updateProposalReview(key, { engine: event.target.value, review_status: "edited" })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Silueta</Label>
                          <Select
                            value={review.vehicle_type_slug || proposal.vehicle_type_slug || "sedan"}
                            onValueChange={(value) => updateProposalReview(key, { vehicle_type_slug: value, review_status: "edited" })}
                            disabled={!canManage}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {SILHOUETTE_OPTIONS.map((item) => (
                                <SelectItem key={item.slug} value={item.slug}>{item.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Decisión</Label>
                          <Select
                            value={review.review_status || "pending"}
                            onValueChange={(value) => updateProposalReview(key, { review_status: value })}
                            disabled={!canManage}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pendiente</SelectItem>
                              <SelectItem value="valid">Válida</SelectItem>
                              <SelectItem value="edited">Editada</SelectItem>
                              <SelectItem value="ignore">Ignorar</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="historial" className="space-y-4 mt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <History className="h-4 w-4" />
              Versiones del catálogo (backup automático en cada aplicación)
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {catalogVersions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aún no hay versiones guardadas.</p>
              ) : (
                catalogVersions.map((version) => (
                  <div key={version.version_id} className="flex items-center justify-between gap-2 rounded border p-2 text-sm">
                    <div>
                      <p className="font-medium">{version.version_id}</p>
                      <p className="text-xs text-muted-foreground">
                        {version.reason} · {version.total_entries} entradas · {new Date(version.created_at).toLocaleString("es")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!canManage || rollingBackVersion === version.version_id}
                      onClick={() => rollbackCatalog(version.version_id)}
                    >
                      <RotateCcw className="mr-1 h-3 w-3" />
                      Restaurar
                    </Button>
                  </div>
                ))
              )}
            </div>
            <Button type="button" variant="outline" size="sm" disabled={!canManage} onClick={fetchCatalogVersions}>
              <CloudDownload className="mr-2 h-4 w-4" />
              Actualizar historial
            </Button>
          </TabsContent>
        </Tabs>

        <Separator />
        <p className="text-xs text-muted-foreground">
          El catálogo maestro JSON es la fuente para siluetas en tarjetas. MongoDB conserva variaciones y colores para filtros legacy.
        </p>
      </CardContent>
    </Card>
  );
}