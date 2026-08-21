import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Layers,
  Save,
  RefreshCw,
  Check,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Upload,
  FolderUp,
  FileArchive,
  CheckCircle2,
  Car,
  Sparkles,
} from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { API_BASE as API } from "@/lib/api";

export default function TintMaterialsSettingsPanel() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [policy, setPolicy] = useState(null);

  // Estados del Importador de Blueprints ZIP
  const [blueprintBrands, setBlueprintBrands] = useState([]);
  const [uploadingZip, setUploadingZip] = useState(false);
  const [selectedZipFile, setSelectedZipFile] = useState(null);
  const [brandNameInput, setBrandNameInput] = useState("");
  const [localZipPathInput, setLocalZipPathInput] = useState("");

  const canEditPrices = user?.role === "gerencia" || user?.role === "programador";
  const canEditAvailability =
    canEditPrices || user?.role === "coordinador_polarizados" || user?.role === "supervisor";

  const fetchPolicy = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/tint/window-materials/policy`, { withCredentials: true });
      setPolicy(res.data?.policy || {});
    } catch (err) {
      console.error("Error fetching tint policy", err);
      toast.error("No se pudo cargar la política de polarizados");
    } finally {
      setLoading(false);
    }
  };

  const fetchBlueprintBrands = async () => {
    try {
      const res = await axios.get(`${API}/vehicle-blueprints/brands`, { withCredentials: true });
      setBlueprintBrands(res.data?.brands || []);
    } catch (err) {
      console.warn("Error loading blueprint brands", err);
    }
  };

  useEffect(() => {
    fetchPolicy();
    fetchBlueprintBrands();
  }, []);

  const handleToggleRequirePlan = (checked) => {
    if (!canEditPrices) return;
    setPolicy((prev) => ({ ...prev, require_plan_on_installed_sale: checked }));
  };

  const handlePriceChange = (materialId, group, value) => {
    if (!canEditPrices) return;
    const num = Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
    setPolicy((prev) => {
      const materials = (prev.materials || []).map((m) => {
        if (m.id === materialId) {
          const price_by_zone_group = { ...(m.price_by_zone_group || {}) };
          price_by_zone_group[group] = num;
          return { ...m, price_by_zone_group };
        }
        return m;
      });
      return { ...prev, materials };
    });
  };

  const handleAvailabilityToggle = (materialId, checked) => {
    if (!canEditAvailability) return;
    setPolicy((prev) => {
      const materials = (prev.materials || []).map((m) => {
        if (m.id === materialId) {
          return { ...m, is_active: checked };
        }
        return m;
      });
      return { ...prev, materials };
    });
  };

  const handleRollQtyChange = (materialId, bandKey, value) => {
    if (!canEditAvailability) return;
    const num = Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
    setPolicy((prev) => {
      const materials = (prev.materials || []).map((m) => {
        if (m.id === materialId) {
          const rolls = { ...(m.rolls || {}) };
          if (rolls[bandKey]) {
            rolls[bandKey] = { ...rolls[bandKey], virtual_qty: num };
          }
          return { ...m, rolls };
        }
        return m;
      });
      return { ...prev, materials };
    });
  };

  const handleRollAvailabilityChange = (materialId, bandKey, checked) => {
    if (!canEditAvailability) return;
    setPolicy((prev) => {
      const materials = (prev.materials || []).map((m) => {
        if (m.id === materialId) {
          const rolls = { ...(m.rolls || {}) };
          if (rolls[bandKey]) {
            rolls[bandKey] = { ...rolls[bandKey], is_available: checked };
          }
          return { ...m, rolls };
        }
        return m;
      });
      return { ...prev, materials };
    });
  };

  const handleSunstripPriceChange = (key, value) => {
    if (!canEditPrices) return;
    const num = Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
    setPolicy((prev) => ({
      ...prev,
      sunstrip_pricing: {
        ...(prev.sunstrip_pricing || {}),
        [key]: num,
      },
    }));
  };

  const handleSave = async () => {
    if (!canEditAvailability) {
      toast.error("No tienes permisos para modificar la política de polarizados.");
      return;
    }
    setSaving(true);
    try {
      const res = await axios.post(
        `${API}/tint/window-materials/policy`,
        { policy },
        { withCredentials: true }
      );
      setPolicy(res.data?.policy || policy);
      toast.success(res.data?.message || "Política de polarizados guardada exitosamente");
    } catch (err) {
      console.error("Error saving policy", err);
      toast.error(err?.response?.data?.detail || "Error al guardar la política");
    } finally {
      setSaving(false);
    }
  };

  // Subir archivo ZIP vía navegador
  const handleUploadZip = async (e) => {
    e.preventDefault();
    if (!selectedZipFile) {
      toast.error("Por favor selecciona un archivo .ZIP con los planos del vehículo.");
      return;
    }

    setUploadingZip(true);
    const formData = new FormData();
    formData.append("file", selectedZipFile);
    if (brandNameInput.trim()) {
      formData.append("brand", brandNameInput.trim());
    }

    try {
      const res = await axios.post(`${API}/vehicle-blueprints/upload-zip`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        withCredentials: true,
      });
      toast.success(res.data?.message || "Blueprints subidos y procesados con éxito");
      setSelectedZipFile(null);
      setBrandNameInput("");
      fetchBlueprintBrands();
    } catch (err) {
      console.error("Error uploading zip", err);
      toast.error(err?.response?.data?.detail || "Error al procesar archivo ZIP");
    } finally {
      setUploadingZip(false);
    }
  };

  // Procesar archivo ZIP local en el servidor
  const handleProcessLocalZip = async () => {
    if (!localZipPathInput.trim()) {
      toast.error("Por favor ingresa la ruta local del archivo .ZIP en el servidor.");
      return;
    }

    setUploadingZip(true);
    try {
      const res = await axios.post(
        `${API}/vehicle-blueprints/process-local-zip`,
        { zip_path: localZipPathInput.trim(), brand: brandNameInput.trim() || undefined },
        { withCredentials: true }
      );
      toast.success(res.data?.message || "Blueprints procesados con éxito");
      setLocalZipPathInput("");
      setBrandNameInput("");
      fetchBlueprintBrands();
    } catch (err) {
      console.error("Error processing local zip", err);
      toast.error(err?.response?.data?.detail || "Error al procesar archivo local");
    } finally {
      setUploadingZip(false);
    }
  };

  if (loading || !policy) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground gap-2">
        <RefreshCw className="h-5 w-5 animate-spin text-primary" />
        <span>Cargando configuración de polarizados...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. SECCIÓN AUTÓNOMA DE SUBIDA DE BLUEPRINTS (.ZIP) */}
      <Card className="border-blue-200 dark:border-blue-900 bg-gradient-to-br from-blue-50/40 via-white to-indigo-50/30 dark:from-zinc-900 dark:via-zinc-900 dark:to-blue-950/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-600/15 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <FolderUp className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <span>Importador Autónomo de Catálogo de Blueprints (.ZIP)</span>
                  <Badge variant="outline" className="bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border-blue-300 text-[10px]">
                    Gerencia / Programador
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  Sube paquetes comprimidos de planos técnicos por marca para extraer siluetas, tags y recortar marcas de agua automáticamente.
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchBlueprintBrands}
              className="text-xs gap-1.5 h-8"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refrescar Marcas
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-1">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            {/* Formulario de Subida por Navegador */}
            <form onSubmit={handleUploadZip} className="md:col-span-7 space-y-3 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
              <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                <FileArchive className="h-4 w-4 text-blue-600" />
                Subir archivo .ZIP desde tu equipo:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Nombre de la Marca (Opcional):</Label>
                  <Input
                    type="text"
                    placeholder="Ej. NISSAN, HYUNDAI, KIA"
                    value={brandNameInput}
                    onChange={(e) => setBrandNameInput(e.target.value)}
                    className="h-8 text-xs font-semibold"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Seleccionar Archivo .ZIP:</Label>
                  <Input
                    type="file"
                    accept=".zip"
                    onChange={(e) => setSelectedZipFile(e.target.files?.[0] || null)}
                    className="h-8 text-xs cursor-pointer"
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={uploadingZip || !selectedZipFile}
                size="sm"
                className="w-full h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                {uploadingZip ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {uploadingZip ? "Procesando y Limpiando Imágenes..." : "Subir y Procesar Blueprints (.ZIP)"}
              </Button>
            </form>

            {/* Marcas Procesadas Disponibles */}
            <div className="md:col-span-5 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-2">
              <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Car className="h-4 w-4 text-emerald-600" /> Marcas Indexadas en ERP:
                </span>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {blueprintBrands.length} marcas
                </Badge>
              </span>
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {blueprintBrands.length === 0 ? (
                  <div className="text-center py-4 text-xs text-muted-foreground">
                    Aún no hay marcas cargadas.
                  </div>
                ) : (
                  blueprintBrands.map((b) => (
                    <div
                      key={b.slug}
                      className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 text-xs"
                    >
                      <span className="font-bold text-zinc-900 dark:text-zinc-100">{b.brand}</span>
                      <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border-emerald-300 font-mono text-[10px]">
                        {b.models_count} modelos
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Tarjeta de Control General de Políticas */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">Control de Ventas e Instalación de Polarizados</CardTitle>
                <CardDescription className="text-xs">
                  Reglas de selección de films, bandas de rollo (≤40" / ≤20") y facturación obligatoria.
                </CardDescription>
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2">
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar Cambios
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <div className="flex items-center justify-between rounded-xl border p-3.5 bg-zinc-50/50 dark:bg-zinc-900/50">
            <div>
              <Label className="text-sm font-semibold">Exigir Plan de Polarizado al Facturar</Label>
              <p className="text-xs text-muted-foreground">
                Si está activo, toda venta con vehículo y servicio de polarizado debe tener asignados sus materiales por ventana.
              </p>
            </div>
            <Switch
              checked={Boolean(policy.require_plan_on_installed_sale)}
              onCheckedChange={handleToggleRequirePlan}
              disabled={!canEditPrices}
            />
          </div>

          <div className="rounded-xl border p-3.5 bg-zinc-50/50 dark:bg-zinc-900/50 space-y-3">
            <div>
              <Label className="text-sm font-semibold">Precios de Bandas de Sol / Viseras (USD)</Label>
              <p className="text-xs text-muted-foreground">
                Costo adicional cobrado al activar viseras superiores o inferiores en parabrisas delantero y trasero.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-[11px] text-muted-foreground block mb-1">Superior Delantero:</span>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs text-muted-foreground">$</span>
                  <Input
                    type="number"
                    min="0"
                    value={policy.sunstrip_pricing?.windshield_top ?? 10}
                    onChange={(e) => handleSunstripPriceChange("windshield_top", e.target.value)}
                    disabled={!canEditPrices}
                    className="pl-6 text-xs font-mono"
                  />
                </div>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block mb-1">Inferior Delantero:</span>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs text-muted-foreground">$</span>
                  <Input
                    type="number"
                    min="0"
                    value={policy.sunstrip_pricing?.windshield_bottom ?? 10}
                    onChange={(e) => handleSunstripPriceChange("windshield_bottom", e.target.value)}
                    disabled={!canEditPrices}
                    className="pl-6 text-xs font-mono"
                  />
                </div>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block mb-1">Superior Trasero:</span>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs text-muted-foreground">$</span>
                  <Input
                    type="number"
                    min="0"
                    value={policy.sunstrip_pricing?.rear_top ?? 10}
                    onChange={(e) => handleSunstripPriceChange("rear_top", e.target.value)}
                    disabled={!canEditPrices}
                    className="pl-6 text-xs font-mono"
                  />
                </div>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block mb-1">Inferior Trasero:</span>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs text-muted-foreground">$</span>
                  <Input
                    type="number"
                    min="0"
                    value={policy.sunstrip_pricing?.rear_bottom ?? 10}
                    onChange={(e) => handleSunstripPriceChange("rear_bottom", e.target.value)}
                    disabled={!canEditPrices}
                    className="pl-6 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Catálogo de Films y Precios Extra */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
            Catálogo Oficial de Materiales ({policy.materials?.length || 0} referencias):
          </h3>
          {!canEditPrices && (
            <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
              <Lock className="h-3.5 w-3.5" /> Edición de precios reservada a Gerencia / Programador
            </span>
          )}
        </div>

        {(policy.materials || []).map((mat) => (
          <Card key={mat.id} className="overflow-hidden">
            <CardHeader className="py-3 px-4 bg-zinc-50/70 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {mat.brand === "3M" || String(mat.id).includes("3m") ? (
                    <img src="/brands/3m.png" alt="3M" className="h-5 max-w-[55px] object-contain drop-shadow-sm" />
                  ) : (
                    <img src="/brands/solargard.png" alt="Solar Gard" className="h-5 max-w-[65px] object-contain drop-shadow-sm" />
                  )}
                  <span className="font-bold text-sm text-zinc-900 dark:text-white">{mat.name}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {mat.gama_label || mat.family}
                  </Badge>
                  {mat.vlt && (
                    <Badge className="bg-blue-600 text-white text-[10px]">
                      {mat.vlt}% VLT
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Activo en Catálogo:</span>
                  <Switch
                    checked={Boolean(mat.is_active)}
                    onCheckedChange={(checked) => handleAvailabilityToggle(mat.id, checked)}
                    disabled={!canEditAvailability}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Precios de Recargo por Zona */}
              <div>
                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-2">
                  Recargo Extra al Cliente (USD) por Zona del Vehículo:
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-[11px] text-muted-foreground block mb-1">Parabrisas Delantero:</span>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-xs text-muted-foreground">$</span>
                      <Input
                        type="number"
                        min="0"
                        value={mat.price_by_zone_group?.windshield ?? 0}
                        onChange={(e) => handlePriceChange(mat.id, "windshield", e.target.value)}
                        disabled={!canEditPrices}
                        className="pl-6 text-xs font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground block mb-1">Laterales Completos (4 vent.):</span>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-xs text-muted-foreground">$</span>
                      <Input
                        type="number"
                        min="0"
                        value={mat.price_by_zone_group?.sides ?? 0}
                        onChange={(e) => handlePriceChange(mat.id, "sides", e.target.value)}
                        disabled={!canEditPrices}
                        className="pl-6 text-xs font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground block mb-1">Parabrisas Trasero:</span>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-xs text-muted-foreground">$</span>
                      <Input
                        type="number"
                        min="0"
                        value={mat.price_by_zone_group?.rear ?? 0}
                        onChange={(e) => handlePriceChange(mat.id, "rear", e.target.value)}
                        disabled={!canEditPrices}
                        className="pl-6 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Disponibilidad de Rollos por Talla */}
              <div>
                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-2">
                  Disponibilidad de Rollos y Stock Virtual en Taller:
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {Object.keys(mat.rolls || {}).map((bandKey) => {
                    const roll = mat.rolls[bandKey];
                    const bandLabel =
                      bandKey === "windshield_under_40"
                        ? "Parabrisas ≤ 40\""
                        : bandKey === "windshield_over_40"
                        ? "Parabrisas > 40\""
                        : bandKey === "side_under_20"
                        ? "Laterales ≤ 20\""
                        : "Laterales > 20\"";

                    return (
                      <div
                        key={bandKey}
                        className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200 text-[11px]">
                            {bandLabel}
                          </span>
                          <Switch
                            checked={Boolean(roll.is_available)}
                            onCheckedChange={(checked) =>
                              handleRollAvailabilityChange(mat.id, bandKey, checked)
                            }
                            disabled={!canEditAvailability}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                          <span>SKU: {roll.sku}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap">Stock:</span>
                          <Input
                            type="number"
                            min="0"
                            value={roll.virtual_qty ?? 0}
                            onChange={(e) => handleRollQtyChange(mat.id, bandKey, e.target.value)}
                            disabled={!canEditAvailability}
                            className="h-7 text-xs font-mono"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

TintMaterialsSettingsPanel.propTypes = {};
