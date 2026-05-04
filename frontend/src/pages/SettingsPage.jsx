import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { THEME_SKINS } from "../lib/themeSkins";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Input } from "../components/ui/input";
import { Separator } from "../components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Sun, Moon, Monitor, Settings2, Bell, Shield, Database, Trash2, Sparkles, Car, ReceiptText, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { API_BASE as API } from "@/lib/api";
import ConnectivityBadge from "../components/ConnectivityBadge";
import { useRoles } from "../lib/useRoles";

export function SettingsPage() {
  const { user } = useAuth();
  const rolesMap = useRoles();
  const { mode, skin, setMode, setSkin, setSystemTheme } = useTheme();
  const canManageVehicleSettings = (user?.role || "").toLowerCase() === "gerencia";
  const [profilePin, setProfilePin] = useState("");
  const [savingProfilePin, setSavingProfilePin] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [vehicleSettings, setVehicleSettings] = useState({ brands: [], colors: [] });
  const [loadingVehicleSettings, setLoadingVehicleSettings] = useState(false);
  const [savingVehicleSettings, setSavingVehicleSettings] = useState(false);

  const [brandInput, setBrandInput] = useState("");
  const [yearInput, setYearInput] = useState("");
  const [modelInput, setModelInput] = useState("");
  const [variationInput, setVariationInput] = useState("");
  const [colorInput, setColorInput] = useState("");

  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [selectedYearId, setSelectedYearId] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [selectedVariationId, setSelectedVariationId] = useState("");
  const [selectedColorId, setSelectedColorId] = useState("");

  const [billingSettings, setBillingSettings] = useState({
    exchange: { official_rate: 36.5, effective_rate: 36.5, effective_source: "billing_official", rules: [] },
    iva_rate: 15,
    cancel_reasons: [],
  });
  const [loadingBillingSettings, setLoadingBillingSettings] = useState(false);
  const [savingBillingSettings, setSavingBillingSettings] = useState(false);
  const [newOfficialRate, setNewOfficialRate] = useState("36.5");
  const [newIvaRate, setNewIvaRate] = useState("15");
  const [newRule, setNewRule] = useState({ name: "", cadence: "daily", rate: "36.5", start_at: "", end_at: "", active: true });
  const [newCancelReason, setNewCancelReason] = useState("");
  const canManageBillingSettings = ["gerencia", "recursos_humanos"].includes((user?.role || "").toLowerCase());

  const selectedBrand = useMemo(
    () => vehicleSettings.brands.find((brand) => brand.id === selectedBrandId) || null,
    [vehicleSettings.brands, selectedBrandId]
  );
  const selectedYear = useMemo(
    () => selectedBrand?.years?.find((year) => year.id === selectedYearId) || null,
    [selectedBrand, selectedYearId]
  );
  const selectedModel = useMemo(
    () => selectedYear?.models?.find((model) => model.id === selectedModelId) || null,
    [selectedYear, selectedModelId]
  );

  const clearLocalDrafts = () => {
    if (typeof window === "undefined" || !window.localStorage) return;
    const prefixes = ["draft_sale_v1_", "draft_quote_v1_"];
    const metaKeys = [
      "draft_sale_tabs_v1",
      "draft_sale_active_v1",
      "draft_quote_tabs_v1",
      "draft_quote_active_v1",
    ];
    const keysToRemove = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i) || "";
      if (prefixes.some((prefix) => key.startsWith(prefix)) || metaKeys.includes(key)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => window.localStorage.removeItem(key));
  };

  /**
   * Maneja la acción de limpiar borradores.
   * - Pide confirmación al usuario.
   * - Llama al endpoint para borrar backups en el servidor.
   * - Limpia el localStorage de borradores locales.
   * - Muestra toasts de éxito/error y controla el estado de carga.
   */
  const [clearing, setClearing] = useState(false);

  const handleClearDrafts = async () => {
    const confirmClear = window.confirm("¿Deseas borrar todos los borradores guardados?");
    if (!confirmClear) return;
    setClearing(true);
    try {
      await axios.delete(`${API}/drafts/backup`, { withCredentials: true });
      clearLocalDrafts();
      toast.success("Borradores eliminados");
    } catch (error) {
      // Mostrar el error en consola para ayudar al desarrollador al depurar
      // y dar retroalimentación al usuario.
      // eslint-disable-next-line no-console
      console.error("Error limpiando borradores:", error);
      toast.error("No se pudieron eliminar los borradores");
    } finally {
      setClearing(false);
    }
  };

  const persistTheme = async (nextMode, nextSkin) => {
    try {
      await axios.put(
        `${API}/settings/theme`,
        { mode: nextMode, skin: nextSkin },
        { withCredentials: true }
      );
    } catch (error) {
      toast.error("No se pudo guardar el tema");
    }
  };

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    persistTheme(nextMode, skin);
  };

  const handleSkinChange = (nextSkin) => {
    setSkin(nextSkin);
    persistTheme(mode, nextSkin);
  };

  const updateProfilePin = async () => {
    if (!user?.user_id) {
      toast.error("No se pudo identificar el usuario actual");
      return;
    }
    if (!/^\d{4}$/.test(profilePin)) {
      toast.error("El PIN debe ser numérico de 4 dígitos");
      return;
    }

    setSavingProfilePin(true);
    try {
      await axios.put(
        `${API}/users/${user.user_id}/pin`,
        { new_pin: profilePin },
        { withCredentials: true }
      );
      toast.success("PIN de marcación actualizado");
      setProfilePin("");
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo actualizar el PIN");
    } finally {
      setSavingProfilePin(false);
    }
  };

  const fetchVehicleSettings = async () => {
    setLoadingVehicleSettings(true);
    try {
      const response = await axios.get(`${API}/settings/vehicles`, { withCredentials: true });
      const brands = Array.isArray(response.data?.brands) ? response.data.brands : [];
      const colors = Array.isArray(response.data?.colors) ? response.data.colors : [];
      setVehicleSettings({ brands, colors });
    } catch (error) {
      toast.error("No se pudo cargar la configuración de vehículos");
    } finally {
      setLoadingVehicleSettings(false);
    }
  };

  useEffect(() => {
    fetchVehicleSettings();
  }, []);

  const fetchBillingSettings = async () => {
    if (!canManageBillingSettings) return;
    setLoadingBillingSettings(true);
    try {
      const response = await axios.get(`${API}/settings/billing`, { withCredentials: true });
      const payload = response.data || {};
      const exchange = payload.exchange || {};
      const cancelReasons = Array.isArray(payload.cancel_reasons) ? payload.cancel_reasons : [];
      setBillingSettings({
        exchange: {
          official_rate: Number(exchange.official_rate || 36.5),
          effective_rate: Number(exchange.effective_rate || exchange.official_rate || 36.5),
          effective_source: exchange.effective_source || "billing_official",
          rules: Array.isArray(exchange.rules) ? exchange.rules : [],
        },
        iva_rate: Number(payload.iva_rate || 15),
        cancel_reasons: cancelReasons,
      });
      setNewOfficialRate(String(exchange.official_rate || 36.5));
      setNewIvaRate(String(payload.iva_rate || 15));
    } catch (error) {
      toast.error("No se pudo cargar configuración de facturación");
    } finally {
      setLoadingBillingSettings(false);
    }
  };

  useEffect(() => {
    fetchBillingSettings();
  }, [canManageBillingSettings]);

  const saveOfficialRate = async () => {
    const numeric = Number(newOfficialRate || 0);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      toast.error("Ingresa una tasa oficial válida");
      return;
    }
    setSavingBillingSettings(true);
    try {
      await axios.put(`${API}/settings/billing/exchange`, { official_rate: numeric }, { withCredentials: true });
      toast.success("Tasa oficial actualizada");
      await fetchBillingSettings();
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo actualizar la tasa oficial");
    } finally {
      setSavingBillingSettings(false);
    }
  };

  const saveIvaRate = async () => {
    const numeric = Number(newIvaRate || 0);
    if (!Number.isFinite(numeric) || numeric <= 0 || numeric > 100) {
      toast.error("Ingresa un IVA válido entre 0 y 100");
      return;
    }
    setSavingBillingSettings(true);
    try {
      await axios.put(`${API}/settings/billing/iva`, { iva_rate: numeric }, { withCredentials: true });
      toast.success("IVA actualizado");
      await fetchBillingSettings();
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo actualizar el IVA");
    } finally {
      setSavingBillingSettings(false);
    }
  };

  const addExchangeRule = async () => {
    const rate = Number(newRule.rate || 0);
    if (!newRule.name.trim()) return toast.error("Escribe un nombre para la regla");
    if (!Number.isFinite(rate) || rate <= 0) return toast.error("Tasa inválida para la regla");
    setSavingBillingSettings(true);
    try {
      await axios.post(
        `${API}/settings/billing/exchange/rules`,
        {
          name: newRule.name,
          cadence: newRule.cadence,
          rate,
          start_at: newRule.start_at || null,
          end_at: newRule.end_at || null,
          active: Boolean(newRule.active),
        },
        { withCredentials: true }
      );
      toast.success("Regla de tasa agregada");
      setNewRule({ name: "", cadence: "daily", rate: newOfficialRate || "36.5", start_at: "", end_at: "", active: true });
      await fetchBillingSettings();
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo agregar la regla");
    } finally {
      setSavingBillingSettings(false);
    }
  };

  const toggleExchangeRule = async (rule) => {
    setSavingBillingSettings(true);
    try {
      await axios.put(
        `${API}/settings/billing/exchange/rules/${rule.id}`,
        {
          name: rule.name,
          cadence: rule.cadence,
          rate: Number(rule.rate || 0),
          start_at: rule.start_at || null,
          end_at: rule.end_at || null,
          active: !Boolean(rule.active),
        },
        { withCredentials: true }
      );
      await fetchBillingSettings();
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo cambiar estado de regla");
    } finally {
      setSavingBillingSettings(false);
    }
  };

  const deleteExchangeRule = async (ruleId) => {
    if (!window.confirm("¿Eliminar esta regla de tasa?")) return;
    setSavingBillingSettings(true);
    try {
      await axios.delete(`${API}/settings/billing/exchange/rules/${ruleId}`, { withCredentials: true });
      toast.success("Regla eliminada");
      await fetchBillingSettings();
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo eliminar la regla");
    } finally {
      setSavingBillingSettings(false);
    }
  };

  const addCancelReason = async () => {
    if (!newCancelReason.trim()) return toast.error("Escribe un motivo");
    setSavingBillingSettings(true);
    try {
      await axios.post(
        `${API}/settings/billing/cancel-reasons`,
        { reason: newCancelReason.trim(), active: true },
        { withCredentials: true }
      );
      setNewCancelReason("");
      toast.success("Motivo agregado");
      await fetchBillingSettings();
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo agregar el motivo");
    } finally {
      setSavingBillingSettings(false);
    }
  };

  const editCancelReason = async (reasonRow) => {
    const nextReason = window.prompt("Editar motivo de anulación", reasonRow.reason || "");
    if (!nextReason) return;
    setSavingBillingSettings(true);
    try {
      await axios.put(
        `${API}/settings/billing/cancel-reasons/${reasonRow.id}`,
        {
          reason: nextReason,
          active: Boolean(reasonRow.active),
          sort_order: reasonRow.sort_order,
        },
        { withCredentials: true }
      );
      toast.success("Motivo actualizado");
      await fetchBillingSettings();
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo actualizar el motivo");
    } finally {
      setSavingBillingSettings(false);
    }
  };

  const deleteCancelReason = async (reasonId) => {
    if (!window.confirm("¿Eliminar este motivo de anulación?")) return;
    setSavingBillingSettings(true);
    try {
      await axios.delete(`${API}/settings/billing/cancel-reasons/${reasonId}`, { withCredentials: true });
      toast.success("Motivo eliminado");
      await fetchBillingSettings();
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo eliminar el motivo");
    } finally {
      setSavingBillingSettings(false);
    }
  };

  useEffect(() => {
    if (!vehicleSettings.brands.some((brand) => brand.id === selectedBrandId)) {
      setSelectedBrandId(vehicleSettings.brands[0]?.id || "");
    }
  }, [vehicleSettings.brands, selectedBrandId]);

  useEffect(() => {
    if (!selectedBrand?.years?.some((year) => year.id === selectedYearId)) {
      setSelectedYearId(selectedBrand?.years?.[0]?.id || "");
    }
  }, [selectedBrand, selectedYearId]);

  useEffect(() => {
    if (!selectedYear?.models?.some((model) => model.id === selectedModelId)) {
      setSelectedModelId(selectedYear?.models?.[0]?.id || "");
    }
  }, [selectedYear, selectedModelId]);

  useEffect(() => {
    if (!selectedModel?.variations?.some((variation) => variation.id === selectedVariationId)) {
      setSelectedVariationId(selectedModel?.variations?.[0]?.id || "");
    }
  }, [selectedModel, selectedVariationId]);

  useEffect(() => {
    if (!vehicleSettings.colors.some((color) => color.id === selectedColorId)) {
      setSelectedColorId(vehicleSettings.colors[0]?.id || "");
    }
  }, [vehicleSettings.colors, selectedColorId]);

  const runVehicleMutation = async (requestFn, successMessage) => {
    if (!canManageVehicleSettings) {
      toast.error("Solo gerencia puede modificar esta configuración");
      return;
    }
    setSavingVehicleSettings(true);
    try {
      await requestFn();
      await fetchVehicleSettings();
      if (successMessage) toast.success(successMessage);
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo completar la operación");
    } finally {
      setSavingVehicleSettings(false);
    }
  };

  const addBrand = async () => {
    const name = brandInput.trim();
    if (!name) return toast.error("Escribe una marca");
    await runVehicleMutation(
      () => axios.post(`${API}/settings/vehicles/brands`, { name }, { withCredentials: true }),
      "Marca agregada"
    );
    setBrandInput("");
  };

  const renameBrand = async () => {
    if (!selectedBrandId || !selectedBrand) return;
    const nextName = window.prompt("Nuevo nombre de marca", selectedBrand.name || "");
    if (!nextName) return;
    await runVehicleMutation(
      () => axios.put(`${API}/settings/vehicles/brands/${selectedBrandId}`, { name: nextName }, { withCredentials: true }),
      "Marca actualizada"
    );
  };

  const deleteBrand = async () => {
    if (!selectedBrandId) return;
    if (!window.confirm("¿Eliminar marca y toda su estructura?") ) return;
    await runVehicleMutation(
      () => axios.delete(`${API}/settings/vehicles/brands/${selectedBrandId}`, { withCredentials: true }),
      "Marca eliminada"
    );
  };

  const addYear = async () => {
    const year = yearInput.trim();
    if (!selectedBrandId) return toast.error("Selecciona una marca");
    if (!year) return toast.error("Escribe un año o rango");
    await runVehicleMutation(
      () => axios.post(`${API}/settings/vehicles/brands/${selectedBrandId}/years`, { year }, { withCredentials: true }),
      "Año agregado"
    );
    setYearInput("");
  };

  const renameYear = async () => {
    if (!selectedBrandId || !selectedYearId || !selectedYear) return;
    const nextValue = window.prompt("Nuevo valor de año", selectedYear.value || "");
    if (!nextValue) return;
    await runVehicleMutation(
      () => axios.put(`${API}/settings/vehicles/brands/${selectedBrandId}/years/${selectedYearId}`, { year: nextValue }, { withCredentials: true }),
      "Año actualizado"
    );
  };

  const deleteYear = async () => {
    if (!selectedBrandId || !selectedYearId) return;
    if (!window.confirm("¿Eliminar año y todos sus modelos?") ) return;
    await runVehicleMutation(
      () => axios.delete(`${API}/settings/vehicles/brands/${selectedBrandId}/years/${selectedYearId}`, { withCredentials: true }),
      "Año eliminado"
    );
  };

  const addModel = async () => {
    const name = modelInput.trim();
    if (!selectedBrandId || !selectedYearId) return toast.error("Selecciona marca y año");
    if (!name) return toast.error("Escribe un modelo");
    await runVehicleMutation(
      () => axios.post(`${API}/settings/vehicles/brands/${selectedBrandId}/years/${selectedYearId}/models`, { name }, { withCredentials: true }),
      "Modelo agregado"
    );
    setModelInput("");
  };

  const renameModel = async () => {
    if (!selectedBrandId || !selectedYearId || !selectedModelId || !selectedModel) return;
    const nextName = window.prompt("Nuevo nombre del modelo", selectedModel.name || "");
    if (!nextName) return;
    await runVehicleMutation(
      () => axios.put(`${API}/settings/vehicles/brands/${selectedBrandId}/years/${selectedYearId}/models/${selectedModelId}`, { name: nextName }, { withCredentials: true }),
      "Modelo actualizado"
    );
  };

  const deleteModel = async () => {
    if (!selectedBrandId || !selectedYearId || !selectedModelId) return;
    if (!window.confirm("¿Eliminar modelo y sus variaciones?") ) return;
    await runVehicleMutation(
      () => axios.delete(`${API}/settings/vehicles/brands/${selectedBrandId}/years/${selectedYearId}/models/${selectedModelId}`, { withCredentials: true }),
      "Modelo eliminado"
    );
  };

  const addVariation = async () => {
    const value = variationInput.trim();
    if (!selectedBrandId || !selectedYearId || !selectedModelId) return toast.error("Selecciona marca, año y modelo");
    if (!value) return toast.error("Escribe una variación");
    await runVehicleMutation(
      () => axios.post(
        `${API}/settings/vehicles/brands/${selectedBrandId}/years/${selectedYearId}/models/${selectedModelId}/variations`,
        { value },
        { withCredentials: true }
      ),
      "Variación agregada"
    );
    setVariationInput("");
  };

  const renameVariation = async () => {
    if (!selectedBrandId || !selectedYearId || !selectedModelId || !selectedVariationId) return;
    const variation = selectedModel?.variations?.find((item) => item.id === selectedVariationId);
    const nextValue = window.prompt("Nuevo valor de variación", variation?.value || "");
    if (!nextValue) return;
    await runVehicleMutation(
      () => axios.put(
        `${API}/settings/vehicles/brands/${selectedBrandId}/years/${selectedYearId}/models/${selectedModelId}/variations/${selectedVariationId}`,
        { value: nextValue },
        { withCredentials: true }
      ),
      "Variación actualizada"
    );
  };

  const deleteVariation = async () => {
    if (!selectedBrandId || !selectedYearId || !selectedModelId || !selectedVariationId) return;
    if (!window.confirm("¿Eliminar variación?") ) return;
    await runVehicleMutation(
      () => axios.delete(
        `${API}/settings/vehicles/brands/${selectedBrandId}/years/${selectedYearId}/models/${selectedModelId}/variations/${selectedVariationId}`,
        { withCredentials: true }
      ),
      "Variación eliminada"
    );
  };

  const addColor = async () => {
    const value = colorInput.trim();
    if (!value) return toast.error("Escribe un color");
    await runVehicleMutation(
      () => axios.post(`${API}/settings/vehicles/colors`, { value }, { withCredentials: true }),
      "Color agregado"
    );
    setColorInput("");
  };

  const renameColor = async () => {
    if (!selectedColorId) return;
    const color = vehicleSettings.colors.find((item) => item.id === selectedColorId);
    const nextValue = window.prompt("Nuevo nombre de color", color?.value || "");
    if (!nextValue) return;
    await runVehicleMutation(
      () => axios.put(`${API}/settings/vehicles/colors/${selectedColorId}`, { value: nextValue }, { withCredentials: true }),
      "Color actualizado"
    );
  };

  const deleteColor = async () => {
    if (!selectedColorId) return;
    if (!window.confirm("¿Eliminar color?") ) return;
    await runVehicleMutation(
      () => axios.delete(`${API}/settings/vehicles/colors/${selectedColorId}`, { withCredentials: true }),
      "Color eliminado"
    );
  };


  return (
    <div className="p-6 space-y-6" data-testid="settings-page">
      {/* Header */}
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">Ajustes del sistema y preferencias</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="billing">Facturación</TabsTrigger>
          <TabsTrigger value="vehicles">Vehículos</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Theme Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Apariencia
            </CardTitle>
            <CardDescription>Personaliza el tema de la aplicación</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={mode === "light" ? "default" : "outline"}
                className="flex flex-col h-auto py-4"
                onClick={() => handleModeChange("light")}
                data-testid="theme-light"
              >
                <Sun className="h-6 w-6 mb-2" />
                <span className="text-xs">Claro</span>
              </Button>
              <Button
                variant={mode === "dark" ? "default" : "outline"}
                className="flex flex-col h-auto py-4"
                onClick={() => handleModeChange("dark")}
                data-testid="theme-dark"
              >
                <Moon className="h-6 w-6 mb-2" />
                <span className="text-xs">Oscuro</span>
              </Button>
              <Button
                variant={mode === "system" ? "default" : "outline"}
                className="flex flex-col h-auto py-4"
                onClick={() => {
                  setSystemTheme();
                  persistTheme("system", skin);
                }}
                data-testid="theme-system"
              >
                <Monitor className="h-6 w-6 mb-2" />
                <span className="text-xs">Sistema</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              El tema del sistema detecta automáticamente la preferencia de tu navegador.
            </p>
            <Separator />
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Skins</Label>
                  <p className="text-xs text-muted-foreground">Elige un estilo visual</p>
                </div>
                <Sparkles className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-3 grid gap-2">
                {THEME_SKINS.map((themeSkin) => (
                  <button
                    key={themeSkin.id}
                    type="button"
                    onClick={() => handleSkinChange(themeSkin.id)}
                    className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition ${
                      skin === themeSkin.id ? "border-primary bg-primary/10" : "hover:bg-accent"
                    }`}
                    aria-pressed={skin === themeSkin.id}
                  >
                    <div>
                      <p className="text-sm font-medium">{themeSkin.label}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {themeSkin.group} · {themeSkin.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {themeSkin.swatches.map((color) => (
                        <span
                          key={color}
                          className="h-4 w-4 rounded-full border"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>PIN de marcación personal (4 dígitos)</Label>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={profilePin}
                  onChange={(e) => setProfilePin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  maxLength={4}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="••••"
                  data-testid="settings-profile-pin"
                />
                <Button
                  onClick={updateProfilePin}
                  disabled={savingProfilePin || profilePin.length !== 4}
                  data-testid="settings-profile-pin-save"
                >
                  {savingProfilePin ? "Guardando..." : "Actualizar"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Este PIN es para marcar entrada y salida desde tu perfil, junto con la configuración de tema.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Notifications Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificaciones
            </CardTitle>
            <CardDescription>Configura las alertas del sistema</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Stock Bajo</Label>
                <p className="text-xs text-muted-foreground">Alertas cuando el inventario esté bajo</p>
              </div>
              <Switch defaultChecked data-testid="notify-stock" />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label>Órdenes Pendientes</Label>
                <p className="text-xs text-muted-foreground">Notificar órdenes sin asignar</p>
              </div>
              <Switch defaultChecked data-testid="notify-orders" />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label>Créditos Vencidos</Label>
                <p className="text-xs text-muted-foreground">Alertas de pagos pendientes</p>
              </div>
              <Switch defaultChecked data-testid="notify-credits" />
            </div>
          </CardContent>
        </Card>

        {/* User Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Mi Cuenta
            </CardTitle>
            <CardDescription>Información de tu perfil</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Nombre</Label>
              <p className="font-medium">{user?.name}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Email</Label>
              <p className="font-medium">{user?.email}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Rol</Label>
                <p className="font-medium capitalize">{(rolesMap && rolesMap[user?.role]?.label) || user?.role}</p>
            </div>
            {user?.branch_id && (
              <div>
                <Label className="text-muted-foreground">Sucursal</Label>
                <p className="font-medium">{user?.branch_id}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* System Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Sistema
            </CardTitle>
            <CardDescription>Información del sistema</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Versión</Label>
              <p className="font-mono">1.0.0</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Ambiente</Label>
              <p className="font-mono">Producción</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Sucursales</Label>
              <p className="font-mono">3 activas</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Bodegas</Label>
              <p className="font-mono">8 activas</p>
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label>Borradores guardados</Label>
                <p className="text-xs text-muted-foreground">Borra ventas y cotizaciones almacenadas</p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleClearDrafts}
                disabled={clearing}
                aria-busy={clearing}
                data-testid="clear-drafts"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {clearing ? "Limpiando..." : "Limpiar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
        </TabsContent>

        <TabsContent value="billing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ReceiptText className="h-5 w-5" />
                Facturación
              </CardTitle>
              <CardDescription>
                Configura tasa oficial/schedule y catálogo de motivos de anulación.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!canManageBillingSettings ? (
                <p className="text-sm text-amber-600">Solo Gerencia y Recursos Humanos pueden modificar esta pestaña.</p>
              ) : loadingBillingSettings ? (
                <p className="text-sm text-muted-foreground">Cargando configuración de facturación...</p>
              ) : (
                <>
                  <div className="space-y-3 rounded-md border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">Tasa de cambio oficial (USD → NIO)</h3>
                        <p className="text-xs text-muted-foreground">
                          Tasa efectiva actual: {Number(billingSettings.exchange.effective_rate || 0).toFixed(4)} ({billingSettings.exchange.effective_source || "n/a"})
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="space-y-2">
                        <Label>Tasa oficial</Label>
                        <Input
                          type="number"
                          step="0.0001"
                          value={newOfficialRate}
                          onChange={(e) => setNewOfficialRate(e.target.value)}
                          className="w-48"
                        />
                      </div>
                      <Button onClick={saveOfficialRate} disabled={savingBillingSettings}>
                        <Save className="h-4 w-4 mr-2" />
                        Guardar tasa oficial
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-md border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">Porcentaje de IVA para ventas y cotizaciones</h3>
                        <p className="text-xs text-muted-foreground">
                          Valor actual configurado: {Number(billingSettings.iva_rate || 0).toFixed(2)}%
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="space-y-2">
                        <Label>IVA (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={newIvaRate}
                          onChange={(e) => setNewIvaRate(e.target.value)}
                          className="w-48"
                        />
                      </div>
                      <Button onClick={saveIvaRate} disabled={savingBillingSettings}>
                        <Save className="h-4 w-4 mr-2" />
                        Guardar IVA
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-md border p-4">
                    <h3 className="font-medium">Programación de tasas</h3>
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                      <div className="space-y-2 md:col-span-2">
                        <Label>Nombre regla</Label>
                        <Input value={newRule.name} onChange={(e) => setNewRule((prev) => ({ ...prev, name: e.target.value }))} placeholder="Ej: Semana Santa" />
                      </div>
                      <div className="space-y-2">
                        <Label>Cadencia</Label>
                        <Select value={newRule.cadence} onValueChange={(value) => setNewRule((prev) => ({ ...prev, cadence: value }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Por día</SelectItem>
                            <SelectItem value="weekly">Por semana</SelectItem>
                            <SelectItem value="monthly">Por mes</SelectItem>
                            <SelectItem value="custom">Período</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Tasa</Label>
                        <Input type="number" step="0.0001" value={newRule.rate} onChange={(e) => setNewRule((prev) => ({ ...prev, rate: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Inicio</Label>
                        <Input type="datetime-local" value={newRule.start_at} onChange={(e) => setNewRule((prev) => ({ ...prev, start_at: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Fin</Label>
                        <Input type="datetime-local" value={newRule.end_at} onChange={(e) => setNewRule((prev) => ({ ...prev, end_at: e.target.value }))} />
                      </div>
                    </div>
                    <Button onClick={addExchangeRule} disabled={savingBillingSettings}>
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar regla
                    </Button>

                    <div className="space-y-2">
                      {(billingSettings.exchange.rules || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">Sin reglas creadas.</p>
                      ) : (
                        billingSettings.exchange.rules.map((rule) => (
                          <div key={rule.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                            <div>
                              <p className="font-medium">{rule.name} · {rule.cadence} · {Number(rule.rate || 0).toFixed(4)}</p>
                              <p className="text-xs text-muted-foreground">{rule.start_at || "sin inicio"} → {rule.end_at || "sin fin"}</p>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => toggleExchangeRule(rule)}>
                                {rule.active ? "Desactivar" : "Activar"}
                              </Button>
                              <Button variant="destructive" size="sm" onClick={() => deleteExchangeRule(rule.id)}>Eliminar</Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 rounded-md border p-4">
                    <h3 className="font-medium">Motivos de anulación</h3>
                    <div className="flex gap-2">
                      <Input value={newCancelReason} onChange={(e) => setNewCancelReason(e.target.value)} placeholder="Nuevo motivo" />
                      <Button onClick={addCancelReason} disabled={savingBillingSettings}>Agregar</Button>
                    </div>
                    <div className="space-y-2">
                      {(billingSettings.cancel_reasons || []).map((reasonRow) => (
                        <div key={reasonRow.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                          <p className="text-sm">{reasonRow.reason}</p>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => editCancelReason(reasonRow)}>Editar</Button>
                            <Button variant="destructive" size="sm" onClick={() => deleteCancelReason(reasonRow.id)}>Eliminar</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vehicles" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Catálogo de Vehículos
              </CardTitle>
              <CardDescription>
                Administra marcas, años, modelos, variaciones y colores desde esta pestaña.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!canManageVehicleSettings && (
                <p className="text-sm text-amber-600">
                  Modo solo lectura: solo gerencia puede crear, editar o eliminar elementos.
                </p>
              )}
              {loadingVehicleSettings ? (
                <p className="text-sm text-muted-foreground">Cargando configuración de vehículos...</p>
              ) : (
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-4 rounded-md border p-4">
                    <h3 className="font-medium">Estructura Marca → Año → Modelo → Variación</h3>

                    <div className="space-y-2">
                      <Label>Nueva marca</Label>
                      <div className="flex gap-2">
                        <Input value={brandInput} onChange={(e) => setBrandInput(e.target.value.toUpperCase())} placeholder="Ej: TOYOTA" />
                        <Button onClick={addBrand} disabled={savingVehicleSettings || !canManageVehicleSettings}>Agregar</Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Marca</Label>
                      <Select value={selectedBrandId || ""} onValueChange={setSelectedBrandId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar marca" />
                        </SelectTrigger>
                        <SelectContent>
                          {vehicleSettings.brands.map((brand) => (
                            <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={renameBrand} disabled={!selectedBrandId || savingVehicleSettings || !canManageVehicleSettings}>Editar</Button>
                        <Button variant="destructive" onClick={deleteBrand} disabled={!selectedBrandId || savingVehicleSettings || !canManageVehicleSettings}>Eliminar</Button>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label>Nuevo año/rango</Label>
                      <div className="flex gap-2">
                        <Input value={yearInput} onChange={(e) => setYearInput(e.target.value)} placeholder="Ej: 2024 o 2004-2015" />
                        <Button onClick={addYear} disabled={!selectedBrandId || savingVehicleSettings || !canManageVehicleSettings}>Agregar</Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Año</Label>
                      <Select value={selectedYearId || ""} onValueChange={setSelectedYearId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar año" />
                        </SelectTrigger>
                        <SelectContent>
                          {(selectedBrand?.years || []).map((year) => (
                            <SelectItem key={year.id} value={year.id}>{year.value}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={renameYear} disabled={!selectedYearId || savingVehicleSettings || !canManageVehicleSettings}>Editar</Button>
                        <Button variant="destructive" onClick={deleteYear} disabled={!selectedYearId || savingVehicleSettings || !canManageVehicleSettings}>Eliminar</Button>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label>Nuevo modelo</Label>
                      <div className="flex gap-2">
                        <Input value={modelInput} onChange={(e) => setModelInput(e.target.value)} placeholder="Ej: Hilux (AN10/20)" />
                        <Button onClick={addModel} disabled={!selectedYearId || savingVehicleSettings || !canManageVehicleSettings}>Agregar</Button>
                      </div>
                      <p className="text-xs text-muted-foreground">Formato requerido: Modelo (Generación)</p>
                    </div>

                    <div className="space-y-2">
                      <Label>Modelo</Label>
                      <Select value={selectedModelId || ""} onValueChange={setSelectedModelId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar modelo" />
                        </SelectTrigger>
                        <SelectContent>
                          {(selectedYear?.models || []).map((model) => (
                            <SelectItem key={model.id} value={model.id}>{model.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={renameModel} disabled={!selectedModelId || savingVehicleSettings || !canManageVehicleSettings}>Editar</Button>
                        <Button variant="destructive" onClick={deleteModel} disabled={!selectedModelId || savingVehicleSettings || !canManageVehicleSettings}>Eliminar</Button>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label>Nueva variación</Label>
                      <div className="flex gap-2">
                        <Input value={variationInput} onChange={(e) => setVariationInput(e.target.value)} placeholder="Ej: 3.0L 1KD-FTV [D]" />
                        <Button onClick={addVariation} disabled={!selectedModelId || savingVehicleSettings || !canManageVehicleSettings}>Agregar</Button>
                      </div>
                      <p className="text-xs text-muted-foreground">Formato requerido: Cilindrada Motor [Combustible], ej: 2.0L 1GD-FTV [D]</p>
                    </div>

                    <div className="space-y-2">
                      <Label>Variación</Label>
                      <Select value={selectedVariationId || ""} onValueChange={setSelectedVariationId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar variación" />
                        </SelectTrigger>
                        <SelectContent>
                          {(selectedModel?.variations || []).map((variation) => (
                            <SelectItem key={variation.id} value={variation.id}>{variation.value}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={renameVariation} disabled={!selectedVariationId || savingVehicleSettings || !canManageVehicleSettings}>Editar</Button>
                        <Button variant="destructive" onClick={deleteVariation} disabled={!selectedVariationId || savingVehicleSettings || !canManageVehicleSettings}>Eliminar</Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 rounded-md border p-4">
                    <h3 className="font-medium">Colores de vehículos</h3>
                    <div className="space-y-2">
                      <Label>Nuevo color</Label>
                      <div className="flex gap-2">
                        <Input value={colorInput} onChange={(e) => setColorInput(e.target.value)} placeholder="Ej: Blanco Perla" />
                        <Button onClick={addColor} disabled={savingVehicleSettings || !canManageVehicleSettings}>Agregar</Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Color</Label>
                      <Select value={selectedColorId || ""} onValueChange={setSelectedColorId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar color" />
                        </SelectTrigger>
                        <SelectContent>
                          {vehicleSettings.colors.map((color) => (
                            <SelectItem key={color.id} value={color.id}>{color.value}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={renameColor} disabled={!selectedColorId || savingVehicleSettings || !canManageVehicleSettings}>Editar</Button>
                        <Button variant="destructive" onClick={deleteColor} disabled={!selectedColorId || savingVehicleSettings || !canManageVehicleSettings}>Eliminar</Button>
                      </div>
                    </div>

                    <Separator />
                    <div className="text-xs text-muted-foreground space-y-2">
                      <p>Sugerencia 1: agrega solo variaciones estándar en este endpoint y conserva motores completos en el catálogo maestro.</p>
                      <p>Sugerencia 2: usa años/rangos consistentes (ej. 2024 o 2004-2015) para mejorar filtros y autocompletado.</p>
                      <p>Sugerencia 3: evita duplicados por acentos/mayúsculas para mantener búsquedas limpias.</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <ConnectivityBadge />
    </div>
  );
}
