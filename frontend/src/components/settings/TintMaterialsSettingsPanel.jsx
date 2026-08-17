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

  useEffect(() => {
    fetchPolicy();
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await axios.put(`${API}/tint/window-materials/policy`, { policy }, { withCredentials: true });
      setPolicy(res.data?.policy || policy);
      toast.success("Política de polarizados actualizada con éxito");
    } catch (err) {
      console.error("Error saving policy", err);
      toast.error(err?.response?.data?.detail || "No se pudo guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !policy) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Cargando política de polarizados...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tarjeta de Control General */}
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
                    step="1"
                    value={policy.sunstrip_pricing?.top_windshield_strip_usd ?? 10}
                    onChange={(e) => {
                      if (!canEditPrices) return;
                      const val = Math.max(0, parseFloat(e.target.value) || 0);
                      setPolicy((prev) => ({
                        ...prev,
                        sunstrip_pricing: {
                          ...(prev.sunstrip_pricing || {}),
                          top_windshield_strip_usd: val,
                        },
                      }));
                    }}
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
                    step="1"
                    value={policy.sunstrip_pricing?.bottom_windshield_strip_usd ?? 10}
                    onChange={(e) => {
                      if (!canEditPrices) return;
                      const val = Math.max(0, parseFloat(e.target.value) || 0);
                      setPolicy((prev) => ({
                        ...prev,
                        sunstrip_pricing: {
                          ...(prev.sunstrip_pricing || {}),
                          bottom_windshield_strip_usd: val,
                        },
                      }));
                    }}
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
                    step="1"
                    value={policy.sunstrip_pricing?.top_rear_strip_usd ?? 10}
                    onChange={(e) => {
                      if (!canEditPrices) return;
                      const val = Math.max(0, parseFloat(e.target.value) || 0);
                      setPolicy((prev) => ({
                        ...prev,
                        sunstrip_pricing: {
                          ...(prev.sunstrip_pricing || {}),
                          top_rear_strip_usd: val,
                        },
                      }));
                    }}
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
                    step="1"
                    value={policy.sunstrip_pricing?.bottom_rear_strip_usd ?? 10}
                    onChange={(e) => {
                      if (!canEditPrices) return;
                      const val = Math.max(0, parseFloat(e.target.value) || 0);
                      setPolicy((prev) => ({
                        ...prev,
                        sunstrip_pricing: {
                          ...(prev.sunstrip_pricing || {}),
                          bottom_rear_strip_usd: val,
                        },
                      }));
                    }}
                    disabled={!canEditPrices}
                    className="pl-6 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Catálogo de Materiales y Rollos */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-blue-500" />
          Materiales Disponibles y Precios por Zona (USD)
        </h3>

        {(policy.materials || []).map((mat) => (
          <Card key={mat.id} className="border-zinc-200 dark:border-zinc-800">
            <CardHeader className="py-3 px-4 bg-zinc-50/80 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-zinc-900 dark:text-white">{mat.name}</span>
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    {mat.family} · VLT {mat.vlt}%
                  </Badge>
                </div>
                {!canEditPrices && (
                  <Badge variant="outline" className="text-[10px] text-zinc-500 flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Solo lectura de precios
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {/* Precios por Zona (USD) */}
              <div>
                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-2">
                  Recargo Adicional por Zona (USD):
                </Label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <span className="text-[11px] text-muted-foreground block mb-1">Parabrisas delantero:</span>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-xs text-muted-foreground">$</span>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        value={mat.price_by_zone_group?.windshield ?? 0}
                        onChange={(e) => handlePriceChange(mat.id, "windshield", e.target.value)}
                        disabled={!canEditPrices}
                        className="pl-6 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] text-muted-foreground block mb-1">Ventanas Laterales (Del. + Tras.):</span>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-xs text-muted-foreground">$</span>
                      <Input
                        type="number"
                        step="1"
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
                        step="1"
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
