import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { THEME_SKINS } from "../lib/themeSkins";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Input } from "../components/ui/input";
import { Separator } from "../components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Sun, Moon, Monitor, Settings2, Bell, Shield, Database, Trash2, Sparkles, Car, ReceiptText,
  Plus, Save, FileText, Eye, ExternalLink, X, DollarSign, Printer, Download, RefreshCw, Wallet,
  MessageSquareText,
} from "lucide-react";
import { VehicleCatalogSettingsPanel } from "@/components/settings/VehicleCatalogSettingsPanel";
import { DialogMessagesSettingsPanel } from "@/components/settings/DialogMessagesSettingsPanel";
import { SessionSecuritySettingsPanel } from "@/components/settings/SessionSecuritySettingsPanel";
import { SystemSettingsContent } from "./SystemSettingsPage";
import { toast } from "sonner";
import { API_BASE as API } from "@/lib/api";
import { useRoles } from "../lib/useRoles";
import {
  BILLING_SUBTAB_OPTIONS,
  PDF_DOCUMENT_TYPE_OPTIONS,
  PDF_PREVIEW_OPTIONS,
  PDF_THEME_COLOR_OPTIONS,
  SETTINGS_TAB_OPTIONS,
  buildDefaultPdfDocumentSettings,
  sectionOptionsForDocType,
} from "@/lib/pdfDocumentSections";
import { PETTY_CASH_CATEGORY_OPTIONS } from "@/lib/pettyCash";

const WATERMARK_LOGO_AUTO = "auto";

const WATERMARK_LOGO_PRESETS = [
  { id: WATERMARK_LOGO_AUTO, label: "Automático por sucursal" },
  { id: "mundo-logo", label: "Mundo de Accesorios" },
  { id: "topcar-logo", label: "TopCar" },
  { id: "logo-transparent", label: "Logo transparente (formularios)" },
];

const normalizeWatermarkLogoPreset = (value) => {
  const raw = String(value || "").trim();
  return raw || WATERMARK_LOGO_AUTO;
};

const watermarkLogoPresetToPayload = (value) => {
  const normalized = normalizeWatermarkLogoPreset(value);
  return normalized === WATERMARK_LOGO_AUTO ? "" : normalized;
};

const DEFAULT_PDF_DOCUMENT_SETTINGS = buildDefaultPdfDocumentSettings();

const SETTINGS_TAB_ICONS = {
  Settings2,
  ReceiptText,
  Car,
  DollarSign,
  Bell,
  Printer,
  MessageSquareText,
  Shield,
};

const VALID_SETTINGS_TABS = SETTINGS_TAB_OPTIONS.map((tab) => tab.id);
const VALID_BILLING_TABS = BILLING_SUBTAB_OPTIONS.map((tab) => tab.id);

const DEFAULT_SELLER_VOUCHER_SETTINGS = {
  body_font_size: 6,
  title_font_size: 7,
  chars_per_line: 64,
  top_feed_lines: 8,
  left_margin_chars: 2,
  barcode_module_width: 4,
  barcode_pdf_bar_width: 0.66,
  texts: {
    company_name: "MUNDO DE ACCESORIOS",
    subtitle: "VOUCHER DE VENTA (NO FISCAL)",
    scan_label: "ESCANEAR EN CAJA",
    footer_valid: "Valido hasta cobro en caja",
    footer_disclaimer: "NO ES FACTURA FISCAL",
  },
  sections: {
    header_rules: true,
    company_name: true,
    subtitle: true,
    invoice_number: true,
    date: true,
    customer: true,
    vehicle: true,
    plate: true,
    items: true,
    breakdown: true,
    breakdown_gross_subtotal: true,
    breakdown_line_discount: true,
    breakdown_price_discount: true,
    breakdown_code_discount: true,
    breakdown_global_discount: true,
    breakdown_blocked_discount: true,
    breakdown_subtotal: true,
    breakdown_retention: true,
    breakdown_iva: true,
    breakdown_total: true,
    payment_plan: true,
    barcode: true,
    scan_label: true,
    footer_valid: true,
    footer_disclaimer: true,
  },
};

const SELLER_VOUCHER_SECTION_OPTIONS = [
  { key: "header_rules", label: "Líneas decorativas (=)" },
  { key: "company_name", label: "Nombre de empresa" },
  { key: "subtitle", label: "Subtítulo del voucher" },
  { key: "invoice_number", label: "Número de factura" },
  { key: "date", label: "Fecha de venta" },
  { key: "customer", label: "Cliente" },
  { key: "vehicle", label: "Vehículo" },
  { key: "plate", label: "Placa" },
  { key: "items", label: "Detalle de productos" },
  { key: "breakdown", label: "Desglose (bloque completo)" },
  { key: "payment_plan", label: "Plan de pago acordado" },
  { key: "scan_label", label: "Texto de escaneo" },
  { key: "barcode", label: "Código de barras" },
  { key: "footer_valid", label: "Pie: válido hasta cobro" },
  { key: "footer_disclaimer", label: "Pie: no es factura fiscal" },
];

const SELLER_VOUCHER_BREAKDOWN_SECTION_OPTIONS = [
  { key: "breakdown_gross_subtotal", label: "Subtotal sin descuentos" },
  { key: "breakdown_line_discount", label: "Descuento línea %" },
  { key: "breakdown_price_discount", label: "Descuento precio" },
  { key: "breakdown_code_discount", label: "Descuento código" },
  { key: "breakdown_global_discount", label: "Descuento global" },
  { key: "breakdown_blocked_discount", label: "Descuentos removidos por método" },
  { key: "breakdown_subtotal", label: "Subtotal" },
  { key: "breakdown_retention", label: "Retención IR" },
  { key: "breakdown_iva", label: "IVA" },
  { key: "breakdown_total", label: "TOTAL" },
];

const SELLER_VOUCHER_TEXT_FIELDS = [
  { key: "company_name", label: "Nombre de empresa" },
  { key: "subtitle", label: "Subtítulo" },
  { key: "scan_label", label: "Texto de escaneo (ej. ESCANEAR EN CAJA)" },
  { key: "footer_valid", label: "Pie — válido hasta cobro" },
  { key: "footer_disclaimer", label: "Pie — aviso legal" },
];

const DEFAULT_THERMAL_INVOICE_SETTINGS = {
  body_font_size: 6,
  title_font_size: 7,
  chars_per_line: 64,
  top_feed_lines: 8,
  left_margin_chars: 2,
  barcode_module_width: 4,
  barcode_pdf_bar_width: 0.66,
  texts: {
    company_name: "MUNDO DE ACCESORIOS",
    subtitle: "COMPROBANTE DE COBRO (NO FISCAL)",
    payment_header: "COBRO REALIZADO",
    footer_paid: "COMPROBANTE PAGADO",
    footer_disclaimer: "NO ES FACTURA FISCAL",
  },
  sections: {
    header_rules: true,
    company_name: true,
    subtitle: true,
    invoice_number: true,
    date: true,
    customer: true,
    vehicle: true,
    plate: true,
    items: true,
    breakdown: true,
    breakdown_gross_subtotal: true,
    breakdown_line_discount: true,
    breakdown_price_discount: true,
    breakdown_code_discount: true,
    breakdown_global_discount: true,
    breakdown_blocked_discount: true,
    breakdown_subtotal: true,
    breakdown_retention: true,
    breakdown_iva: false,
    breakdown_total: true,
    payment_header: true,
    payment_method: true,
    amount_collected: true,
    received_amount: true,
    change_amount: true,
    cashier_name: true,
    collected_date: true,
    footer_paid: true,
    footer_disclaimer: true,
  },
};

const THERMAL_INVOICE_SECTION_OPTIONS = [
  { key: "header_rules", label: "Líneas decorativas (=)" },
  { key: "company_name", label: "Nombre de empresa" },
  { key: "subtitle", label: "Subtítulo del comprobante" },
  { key: "invoice_number", label: "Número de factura" },
  { key: "date", label: "Fecha de venta" },
  { key: "customer", label: "Cliente" },
  { key: "vehicle", label: "Vehículo" },
  { key: "plate", label: "Placa" },
  { key: "items", label: "Detalle de productos" },
  { key: "breakdown", label: "Desglose (bloque completo)" },
  { key: "payment_header", label: "Encabezado de cobro" },
  { key: "payment_method", label: "Forma de pago" },
  { key: "amount_collected", label: "Monto cobrado" },
  { key: "received_amount", label: "Monto recibido" },
  { key: "change_amount", label: "Cambio entregado" },
  { key: "cashier_name", label: "Nombre del cajero" },
  { key: "collected_date", label: "Fecha/hora de cobro" },
  { key: "footer_paid", label: "Pie: comprobante pagado" },
  { key: "footer_disclaimer", label: "Pie: aviso legal" },
];

const THERMAL_INVOICE_BREAKDOWN_SECTION_OPTIONS = [
  { key: "breakdown_gross_subtotal", label: "Subtotal sin descuentos" },
  { key: "breakdown_line_discount", label: "Descuento línea %" },
  { key: "breakdown_price_discount", label: "Descuento precio" },
  { key: "breakdown_code_discount", label: "Descuento código" },
  { key: "breakdown_global_discount", label: "Descuento global" },
  { key: "breakdown_blocked_discount", label: "Descuentos removidos por método" },
  { key: "breakdown_subtotal", label: "Subtotal" },
  { key: "breakdown_retention", label: "Retención IR" },
  { key: "breakdown_iva", label: "IVA" },
  { key: "breakdown_total", label: "TOTAL" },
];

const THERMAL_INVOICE_TEXT_FIELDS = [
  { key: "company_name", label: "Nombre de empresa" },
  { key: "subtitle", label: "Subtítulo" },
  { key: "payment_header", label: "Encabezado de cobro" },
  { key: "footer_paid", label: "Pie — comprobante pagado" },
  { key: "footer_disclaimer", label: "Pie — aviso legal" },
];

export function SettingsPage() {
  const { user, hasPermission } = useAuth();
  const rolesMap = useRoles();
  const [searchParams, setSearchParams] = useSearchParams();
  const { mode, skin, setMode, setSkin, setSystemTheme, watermarkOpacity, setWatermarkOpacity } = useTheme();
  const canManageVehicleSettings = (user?.role || "").toLowerCase() === "gerencia";
  const canManageAppearanceSettings = (user?.role || "").toLowerCase() === "gerencia";
  const canManageSystemSettings = hasPermission("system_settings", "view");
  const [profilePin, setProfilePin] = useState("");
  const [savingProfilePin, setSavingProfilePin] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const activeTab = VALID_SETTINGS_TABS.includes(searchParams.get("tab") || "")
    ? searchParams.get("tab")
    : "general";
  const activeBillingTab = VALID_BILLING_TABS.includes(searchParams.get("billingTab") || "")
    ? searchParams.get("billingTab")
    : "exchange";
  const [selectedPdfDocType, setSelectedPdfDocType] = useState("invoice");
  const [vehicleSettings, setVehicleSettings] = useState({ brands: [], colors: [] });
  const [loadingVehicleSettings, setLoadingVehicleSettings] = useState(false);
  const [savingVehicleSettings, setSavingVehicleSettings] = useState(false);
  const [vehicleThumbnailManifest, setVehicleThumbnailManifest] = useState({ catalog: [], assets: {} });
  const [loadingVehicleThumbnails, setLoadingVehicleThumbnails] = useState(false);
  const [uploadingThumbnailSlug, setUploadingThumbnailSlug] = useState("");
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
    pdf_documents: DEFAULT_PDF_DOCUMENT_SETTINGS,
  });
  const [pdfDocumentsSettings, setPdfDocumentsSettings] = useState(DEFAULT_PDF_DOCUMENT_SETTINGS);
  const [sellerVoucherSettings, setSellerVoucherSettings] = useState(DEFAULT_SELLER_VOUCHER_SETTINGS);
  const [thermalInvoiceSettings, setThermalInvoiceSettings] = useState(DEFAULT_THERMAL_INVOICE_SETTINGS);
  const [previewingThermalInvoice, setPreviewingThermalInvoice] = useState(false);
  const [embeddedThermalInvoicePreviewUrl, setEmbeddedThermalInvoicePreviewUrl] = useState("");
  const embeddedThermalInvoicePreviewUrlRef = useRef("");
  const [pettyCashSettings, setPettyCashSettings] = useState({
    fund_amount: 5000,
    currency: "NIO",
    monthly_cap: 15000,
    low_balance_threshold_pct: 20,
    requires_approval_above: 500,
    voucher_prefix: "CC",
    allowed_categories: PETTY_CASH_CATEGORY_OPTIONS.map((item) => item.id),
  });
  const [branches, setBranches] = useState([]);
  const [selectedBillingBranchId, setSelectedBillingBranchId] = useState(user?.branch_id || "branch_main");
  const [previewingPdfKind, setPreviewingPdfKind] = useState("");
  const [previewingSellerVoucher, setPreviewingSellerVoucher] = useState(false);
  const [embeddedSellerVoucherPreviewUrl, setEmbeddedSellerVoucherPreviewUrl] = useState("");
  const embeddedSellerVoucherPreviewUrlRef = useRef("");
  const [embeddedPreviewKind, setEmbeddedPreviewKind] = useState("invoice_pending");
  const [embeddedPdfPreviewUrl, setEmbeddedPdfPreviewUrl] = useState("");
  const [embeddedPdfPreviewLabel, setEmbeddedPdfPreviewLabel] = useState("");
  const embeddedPdfPreviewUrlRef = useRef("");
  const [loadingBillingSettings, setLoadingBillingSettings] = useState(false);
  const [savingBillingSettings, setSavingBillingSettings] = useState(false);
  const [newOfficialRate, setNewOfficialRate] = useState("36.5");
  const [newIvaRate, setNewIvaRate] = useState("15");
  const [newRule, setNewRule] = useState({ name: "", cadence: "daily", rate: "36.5", start_at: "", end_at: "", active: true });
  const [newCancelReason, setNewCancelReason] = useState("");
  const [watermarkOpacityPercent, setWatermarkOpacityPercent] = useState(() => String(Math.round(watermarkOpacity * 100)));
  const [savingAppearanceSettings, setSavingAppearanceSettings] = useState(false);
  const canManageBillingSettings = ["gerencia", "recursos_humanos"].includes((user?.role || "").toLowerCase());
  const canManageDialogMessages = ["gerencia", "programador"].includes((user?.role || "").toLowerCase());

  const handleSettingsTabChange = (nextTab) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", nextTab);
    if (nextTab !== "billing") {
      params.delete("billingTab");
    } else if (!params.get("billingTab")) {
      params.set("billingTab", "exchange");
    }
    setSearchParams(params, { replace: true });
  };

  const handleBillingTabChange = (nextBillingTab) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", "billing");
    params.set("billingTab", nextBillingTab);
    setSearchParams(params, { replace: true });
  };

  const downloadExcelBackup = async () => {
    const pin = window.prompt("Confirma con tu PIN de 8 dígitos para descargar el respaldo:");
    if (!pin) return;
    const cleanPin = String(pin).replace(/\D/g, "").slice(0, 8);
    if (cleanPin.length !== 8) {
      toast.error("El PIN debe tener 8 dígitos");
      return;
    }
    setBackingUp(true);
    try {
      const { requestReauthToken, withReauthHeader } = await import("@/lib/reauth");
      const { reauth_token } = await requestReauthToken(cleanPin, "backup.download");
      const response = await axios.get(
        `${API}/backup/excel`,
        withReauthHeader({ responseType: "blob" }, reauth_token),
      );
      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `erp_full_backup_${new Date().toISOString().replace(/[:.]/g, "-")}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Respaldo Excel descargado");
    } catch (error) {
      const detail = error?.response?.data?.detail;
      toast.error(
        (typeof detail === "object" ? detail?.message : detail) ||
          "No se pudo descargar respaldo",
      );
    } finally {
      setBackingUp(false);
    }
  };
  const selectedBillingBranch = useMemo(
    () => branches.find((branch) => branch.branch_id === selectedBillingBranchId) || null,
    [branches, selectedBillingBranchId]
  );
  const billingBranchQuery = () => (selectedBillingBranchId ? { branch_id: selectedBillingBranchId } : {});

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

  useEffect(() => {
    setWatermarkOpacityPercent(String(Math.round(watermarkOpacity * 100)));
  }, [watermarkOpacity]);

  const saveWatermarkOpacity = async () => {
    if (!canManageAppearanceSettings) {
      toast.error("Solo gerencia puede modificar esta configuración");
      return;
    }
    const numericPercent = Number(watermarkOpacityPercent);
    if (!Number.isFinite(numericPercent) || numericPercent < 0 || numericPercent > 30) {
      toast.error("Ingresa un valor válido entre 0 y 30%");
      return;
    }

    const nextOpacity = numericPercent / 100;
    setSavingAppearanceSettings(true);
    try {
      const response = await axios.put(
        `${API}/settings/appearance`,
        { watermark_opacity: nextOpacity },
        { withCredentials: true }
      );
      setWatermarkOpacity(response?.data?.watermark_opacity ?? nextOpacity);
      toast.success("Transparencia de marca de agua actualizada");
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudo guardar la transparencia");
    } finally {
      setSavingAppearanceSettings(false);
    }
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

  const fetchVehicleThumbnails = async () => {
    if (!canManageVehicleSettings) return;
    setLoadingVehicleThumbnails(true);
    try {
      const response = await axios.get(`${API}/settings/vehicle-thumbnails`, { withCredentials: true });
      setVehicleThumbnailManifest(response.data || { catalog: [], assets: {} });
    } catch (error) {
      toast.error("No se pudo cargar las siluetas de vehículos");
    } finally {
      setLoadingVehicleThumbnails(false);
    }
  };

  const buildThumbnailPreviewUrl = (slug, asset) => {
    const version = asset?.updated_at || asset?.source || "bundled";
    return `${API}/vehicle-thumbnails/${slug}.png?v=${encodeURIComponent(version)}`;
  };

  const uploadVehicleThumbnail = async (slug, file) => {
    if (!file || !canManageVehicleSettings) return;
    setUploadingThumbnailSlug(slug);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await axios.put(`${API}/settings/vehicle-thumbnails/${slug}`, formData, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });
      const asset = response.data?.asset;
      setVehicleThumbnailManifest((prev) => ({
        ...prev,
        assets: {
          ...(prev.assets || {}),
          [slug]: asset || prev.assets?.[slug],
        },
      }));
      toast.success(`Silueta actualizada: ${asset?.label || slug}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo actualizar la silueta");
    } finally {
      setUploadingThumbnailSlug("");
    }
  };

  const resetVehicleThumbnail = async (slug) => {
    if (!canManageVehicleSettings) return;
    setUploadingThumbnailSlug(slug);
    try {
      const response = await axios.delete(`${API}/settings/vehicle-thumbnails/${slug}`, { withCredentials: true });
      const asset = response.data?.asset;
      setVehicleThumbnailManifest((prev) => ({
        ...prev,
        assets: {
          ...(prev.assets || {}),
          [slug]: asset || prev.assets?.[slug],
        },
      }));
      toast.success("Silueta restablecida");
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo restablecer la silueta");
    } finally {
      setUploadingThumbnailSlug("");
    }
  };

  useEffect(() => {
    fetchVehicleSettings();
    fetchVehicleThumbnails();
  }, []);

  useEffect(() => {
    if (!user?.branch_id) return;
    setSelectedBillingBranchId((current) => current || user.branch_id);
  }, [user?.branch_id]);

  const fetchBranches = async () => {
    try {
      const response = await axios.get(`${API}/branches`, { withCredentials: true });
      const rows = Array.isArray(response.data) ? response.data : [];
      setBranches(rows);
      if (!selectedBillingBranchId && rows.length > 0) {
        const preferred = rows.find((row) => row.branch_id === user?.branch_id) || rows[0];
        setSelectedBillingBranchId(preferred.branch_id);
      }
    } catch (error) {
      toast.error("No se pudieron cargar las sucursales");
    }
  };

  useEffect(() => {
    if (canManageBillingSettings) {
      fetchBranches();
    }
  }, [canManageBillingSettings]);

  const fetchBillingSettings = async () => {
    if (!canManageBillingSettings) return;
    setLoadingBillingSettings(true);
    try {
      const response = await axios.get(`${API}/settings/billing`, {
        withCredentials: true,
        params: billingBranchQuery(),
      });
      const payload = response.data || {};
      const exchange = payload.exchange || {};
      const cancelReasons = Array.isArray(payload.cancel_reasons) ? payload.cancel_reasons : [];
      const pdfDocuments = {
        ...DEFAULT_PDF_DOCUMENT_SETTINGS,
        ...(payload.pdf_documents || {}),
        theme_colors: {
          ...DEFAULT_PDF_DOCUMENT_SETTINGS.theme_colors,
          ...((payload.pdf_documents || {}).theme_colors || {}),
        },
        sections: Object.fromEntries(
          Object.keys(DEFAULT_PDF_DOCUMENT_SETTINGS.sections).map((docType) => [
            docType,
            {
              ...DEFAULT_PDF_DOCUMENT_SETTINGS.sections[docType],
              ...((payload.pdf_documents || {}).sections || {})[docType],
            },
          ])
        ),
      };
      setBillingSettings({
        exchange: {
          official_rate: Number(exchange.official_rate || 36.5),
          effective_rate: Number(exchange.effective_rate || exchange.official_rate || 36.5),
          effective_source: exchange.effective_source || "billing_official",
          rules: Array.isArray(exchange.rules) ? exchange.rules : [],
        },
        iva_rate: Number(payload.iva_rate || 15),
        cancel_reasons: cancelReasons,
        pdf_documents: pdfDocuments,
        seller_voucher: {
          ...DEFAULT_SELLER_VOUCHER_SETTINGS,
          ...(payload.seller_voucher || {}),
          texts: {
            ...DEFAULT_SELLER_VOUCHER_SETTINGS.texts,
            ...((payload.seller_voucher || {}).texts || {}),
          },
          sections: {
            ...DEFAULT_SELLER_VOUCHER_SETTINGS.sections,
            ...((payload.seller_voucher || {}).sections || {}),
          },
        },
      });
      setPdfDocumentsSettings({
        ...pdfDocuments,
        watermark_logo_url: normalizeWatermarkLogoPreset(pdfDocuments.watermark_logo_url),
      });
      setSellerVoucherSettings({
        ...DEFAULT_SELLER_VOUCHER_SETTINGS,
        ...(payload.seller_voucher || {}),
        texts: {
          ...DEFAULT_SELLER_VOUCHER_SETTINGS.texts,
          ...((payload.seller_voucher || {}).texts || {}),
        },
        sections: {
          ...DEFAULT_SELLER_VOUCHER_SETTINGS.sections,
          ...((payload.seller_voucher || {}).sections || {}),
        },
      });
      setThermalInvoiceSettings({
        ...DEFAULT_THERMAL_INVOICE_SETTINGS,
        ...(payload.thermal_invoice || {}),
        texts: {
          ...DEFAULT_THERMAL_INVOICE_SETTINGS.texts,
          ...((payload.thermal_invoice || {}).texts || {}),
        },
        sections: {
          ...DEFAULT_THERMAL_INVOICE_SETTINGS.sections,
          ...((payload.thermal_invoice || {}).sections || {}),
        },
      });
      setNewOfficialRate(String(exchange.official_rate || 36.5));
      setNewIvaRate(String(payload.iva_rate || 15));
      try {
        const pettyResponse = await axios.get(`${API}/settings/petty-cash`, {
          withCredentials: true,
          params: billingBranchQuery(),
        });
        setPettyCashSettings({
          ...pettyCashSettings,
          ...(pettyResponse.data?.petty_cash_settings || {}),
          allowed_categories: pettyResponse.data?.petty_cash_settings?.allowed_categories
            || PETTY_CASH_CATEGORY_OPTIONS.map((item) => item.id),
        });
      } catch (pettyError) {
        console.error("No se pudo cargar configuración de caja chica", pettyError);
      }
    } catch (error) {
      toast.error("No se pudo cargar configuración de facturación");
    } finally {
      setLoadingBillingSettings(false);
    }
  };

  useEffect(() => {
    if (!canManageBillingSettings || !selectedBillingBranchId) return;
    fetchBillingSettings();
  }, [canManageBillingSettings, selectedBillingBranchId]);

  const saveOfficialRate = async () => {
    const numeric = Number(newOfficialRate || 0);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      toast.error("Ingresa una tasa oficial válida");
      return;
    }
    setSavingBillingSettings(true);
    try {
      await axios.put(
        `${API}/settings/billing/exchange`,
        { official_rate: numeric },
        { withCredentials: true, params: billingBranchQuery() }
      );
      toast.success("Tasa oficial actualizada");
      await fetchBillingSettings();
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo actualizar la tasa oficial");
    } finally {
      setSavingBillingSettings(false);
    }
  };

  const updatePdfDocumentsField = (field, value) => {
    setPdfDocumentsSettings((prev) => ({ ...prev, [field]: value }));
  };

  const updatePdfDocumentsSection = (docType, key, checked) => {
    setPdfDocumentsSettings((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        [docType]: {
          ...(prev.sections?.[docType] || DEFAULT_PDF_DOCUMENT_SETTINGS.sections[docType]),
          [key]: checked,
        },
      },
    }));
  };

  const updatePdfThemeColor = (key, value) => {
    setPdfDocumentsSettings((prev) => ({
      ...prev,
      theme_colors: { ...prev.theme_colors, [key]: value },
    }));
  };

  const buildPdfPreviewDraftPayload = () => ({
    watermark_enabled: Boolean(pdfDocumentsSettings.watermark_enabled),
    watermark_opacity: Number(pdfDocumentsSettings.watermark_opacity),
    watermark_scale: Number(pdfDocumentsSettings.watermark_scale),
    watermark_logo_url: watermarkLogoPresetToPayload(pdfDocumentsSettings.watermark_logo_url),
    show_status_badge: Boolean(pdfDocumentsSettings.show_status_badge),
    theme_colors: pdfDocumentsSettings.theme_colors,
    sections: pdfDocumentsSettings.sections,
  });

  const revokeEmbeddedPdfPreview = () => {
    if (embeddedPdfPreviewUrlRef.current) {
      window.URL.revokeObjectURL(embeddedPdfPreviewUrlRef.current);
      embeddedPdfPreviewUrlRef.current = "";
    }
    setEmbeddedPdfPreviewUrl("");
    setEmbeddedPdfPreviewLabel("");
  };

  useEffect(() => () => {
    if (embeddedPdfPreviewUrlRef.current) {
      window.URL.revokeObjectURL(embeddedPdfPreviewUrlRef.current);
    }
    if (embeddedSellerVoucherPreviewUrlRef.current) {
      window.URL.revokeObjectURL(embeddedSellerVoucherPreviewUrlRef.current);
    }
  }, []);

  const fetchPdfPreviewBlob = async (kind, { useDraft = true } = {}) => {
    const response = useDraft
      ? await axios.post(
          `${API}/settings/billing/pdf-documents/preview`,
          { kind, pdf_documents: buildPdfPreviewDraftPayload() },
          { withCredentials: true, responseType: "blob", params: billingBranchQuery() }
        )
      : await axios.get(`${API}/settings/billing/pdf-documents/preview`, {
          params: { kind, ...billingBranchQuery() },
          withCredentials: true,
          responseType: "blob",
        });
    const contentType = response.headers["content-type"] || "";
    if (response.status !== 200 || !contentType.includes("pdf")) {
      throw new Error("No se pudo generar la vista previa PDF");
    }
    return window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
  };

  const showEmbeddedPdfPreview = async (kind = embeddedPreviewKind) => {
    setPreviewingPdfKind(kind);
    try {
      revokeEmbeddedPdfPreview();
      const blobUrl = await fetchPdfPreviewBlob(kind, { useDraft: true });
      const label = PDF_PREVIEW_OPTIONS.find((option) => option.id === kind)?.label || kind;
      embeddedPdfPreviewUrlRef.current = blobUrl;
      setEmbeddedPdfPreviewUrl(blobUrl);
      setEmbeddedPdfPreviewLabel(label);
      setEmbeddedPreviewKind(kind);
    } catch (error) {
      toast.error(error?.response?.data?.detail || error?.message || "Error al generar vista previa PDF");
    } finally {
      setPreviewingPdfKind("");
    }
  };

  const openPdfPreviewInNewTab = async (kind = embeddedPreviewKind) => {
    setPreviewingPdfKind(kind);
    try {
      const blobUrl = await fetchPdfPreviewBlob(kind, { useDraft: true });
      const previewWindow = window.open(blobUrl, "_blank");
      if (!previewWindow) {
        toast.error("Permite ventanas emergentes para abrir la vista previa");
      }
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60 * 1000);
    } catch (error) {
      toast.error(error?.response?.data?.detail || error?.message || "Error al abrir vista previa PDF");
    } finally {
      setPreviewingPdfKind("");
    }
  };

  const buildSellerVoucherDraftPayload = () => ({
    body_font_size: Number(sellerVoucherSettings.body_font_size),
    title_font_size: Number(sellerVoucherSettings.title_font_size),
    chars_per_line: Number(sellerVoucherSettings.chars_per_line),
    top_feed_lines: Number(sellerVoucherSettings.top_feed_lines),
    left_margin_chars: Number(sellerVoucherSettings.left_margin_chars),
    barcode_module_width: Number(sellerVoucherSettings.barcode_module_width),
    barcode_pdf_bar_width: Number(sellerVoucherSettings.barcode_pdf_bar_width),
    texts: sellerVoucherSettings.texts,
    sections: sellerVoucherSettings.sections,
  });

  const buildThermalInvoiceDraftPayload = () => ({
    body_font_size: Number(thermalInvoiceSettings.body_font_size),
    title_font_size: Number(thermalInvoiceSettings.title_font_size),
    chars_per_line: Number(thermalInvoiceSettings.chars_per_line),
    top_feed_lines: Number(thermalInvoiceSettings.top_feed_lines),
    left_margin_chars: Number(thermalInvoiceSettings.left_margin_chars),
    barcode_module_width: Number(thermalInvoiceSettings.barcode_module_width),
    barcode_pdf_bar_width: Number(thermalInvoiceSettings.barcode_pdf_bar_width),
    texts: thermalInvoiceSettings.texts,
    sections: thermalInvoiceSettings.sections,
  });

  const updateSellerVoucherField = (field, value) => {
    setSellerVoucherSettings((prev) => ({ ...prev, [field]: value }));
  };

  const updateSellerVoucherText = (key, value) => {
    setSellerVoucherSettings((prev) => ({
      ...prev,
      texts: { ...prev.texts, [key]: value },
    }));
  };

  const updateSellerVoucherSection = (key, checked) => {
    setSellerVoucherSettings((prev) => ({
      ...prev,
      sections: { ...prev.sections, [key]: checked },
    }));
  };

  const updateThermalInvoiceField = (field, value) => {
    setThermalInvoiceSettings((prev) => ({ ...prev, [field]: value }));
  };

  const updateThermalInvoiceText = (key, value) => {
    setThermalInvoiceSettings((prev) => ({
      ...prev,
      texts: { ...prev.texts, [key]: value },
    }));
  };

  const updateThermalInvoiceSection = (key, checked) => {
    setThermalInvoiceSettings((prev) => ({
      ...prev,
      sections: { ...prev.sections, [key]: checked },
    }));
  };

  const revokeEmbeddedSellerVoucherPreview = () => {
    if (embeddedSellerVoucherPreviewUrlRef.current) {
      window.URL.revokeObjectURL(embeddedSellerVoucherPreviewUrlRef.current);
      embeddedSellerVoucherPreviewUrlRef.current = "";
    }
    setEmbeddedSellerVoucherPreviewUrl("");
  };

  const showEmbeddedSellerVoucherPreview = async () => {
    setPreviewingSellerVoucher(true);
    try {
      revokeEmbeddedSellerVoucherPreview();
      const response = await axios.post(
        `${API}/settings/billing/seller-voucher/preview`,
        { seller_voucher: buildSellerVoucherDraftPayload() },
        { withCredentials: true, responseType: "blob", params: billingBranchQuery() }
      );
      const contentType = response.headers["content-type"] || "";
      if (response.status !== 200 || !contentType.includes("pdf")) {
        throw new Error("No se pudo generar la vista previa del voucher");
      }
      const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      embeddedSellerVoucherPreviewUrlRef.current = blobUrl;
      setEmbeddedSellerVoucherPreviewUrl(blobUrl);
    } catch (error) {
      toast.error(error?.response?.data?.detail || error?.message || "Error al generar vista previa del voucher");
    } finally {
      setPreviewingSellerVoucher(false);
    }
  };

  const updatePettyCashField = (field, value) => {
    setPettyCashSettings((prev) => ({ ...prev, [field]: value }));
  };

  const savePettyCashSettings = async () => {
    setSavingBillingSettings(true);
    try {
      const response = await axios.put(
        `${API}/settings/petty-cash`,
        pettyCashSettings,
        { withCredentials: true, params: billingBranchQuery() }
      );
      setPettyCashSettings(response.data?.petty_cash_settings || pettyCashSettings);
      toast.success("Configuración de caja chica guardada");
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo guardar caja chica");
    } finally {
      setSavingBillingSettings(false);
    }
  };

  const revokeEmbeddedThermalInvoicePreview = () => {
    if (embeddedThermalInvoicePreviewUrlRef.current) {
      window.URL.revokeObjectURL(embeddedThermalInvoicePreviewUrlRef.current);
      embeddedThermalInvoicePreviewUrlRef.current = "";
    }
    setEmbeddedThermalInvoicePreviewUrl("");
  };

  const showEmbeddedThermalInvoicePreview = async () => {
    setPreviewingThermalInvoice(true);
    try {
      revokeEmbeddedThermalInvoicePreview();
      const response = await axios.post(
        `${API}/settings/billing/seller-voucher/preview`,
        { kind: "thermal_invoice", thermal_invoice: buildThermalInvoiceDraftPayload() },
        { withCredentials: true, responseType: "blob", params: billingBranchQuery() }
      );
      const contentType = response.headers["content-type"] || "";
      if (response.status !== 200 || !contentType.includes("pdf")) {
        throw new Error("No se pudo generar la vista previa de la factura termica");
      }
      const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      embeddedThermalInvoicePreviewUrlRef.current = blobUrl;
      setEmbeddedThermalInvoicePreviewUrl(blobUrl);
    } catch (error) {
      toast.error(error?.response?.data?.detail || error?.message || "Error al generar vista previa termica");
    } finally {
      setPreviewingThermalInvoice(false);
    }
  };

  const saveSellerVoucherSettings = async () => {
    setSavingBillingSettings(true);
    try {
      const response = await axios.put(
        `${API}/settings/billing/seller-voucher`,
        {
          ...buildSellerVoucherDraftPayload(),
          thermal_invoice: buildThermalInvoiceDraftPayload(),
        },
        { withCredentials: true, params: billingBranchQuery() }
      );
      const saved = response.data?.seller_voucher || sellerVoucherSettings;
      const savedThermal = response.data?.thermal_invoice || thermalInvoiceSettings;
      setSellerVoucherSettings({
        ...DEFAULT_SELLER_VOUCHER_SETTINGS,
        ...saved,
        texts: { ...DEFAULT_SELLER_VOUCHER_SETTINGS.texts, ...(saved.texts || {}) },
        sections: { ...DEFAULT_SELLER_VOUCHER_SETTINGS.sections, ...(saved.sections || {}) },
      });
      setThermalInvoiceSettings({
        ...DEFAULT_THERMAL_INVOICE_SETTINGS,
        ...savedThermal,
        texts: { ...DEFAULT_THERMAL_INVOICE_SETTINGS.texts, ...(savedThermal.texts || {}) },
        sections: { ...DEFAULT_THERMAL_INVOICE_SETTINGS.sections, ...(savedThermal.sections || {}) },
      });
      setBillingSettings((prev) => ({ ...prev, seller_voucher: saved, thermal_invoice: savedThermal }));
      toast.success("Configuracion de voucher POS y factura termica actualizada");
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo guardar la configuración del voucher");
    } finally {
      setSavingBillingSettings(false);
    }
  };

  const savePdfDocumentsSettings = async () => {
    setSavingBillingSettings(true);
    try {
      const response = await axios.put(
        `${API}/settings/billing/pdf-documents`,
        {
          watermark_enabled: Boolean(pdfDocumentsSettings.watermark_enabled),
          watermark_opacity: Number(pdfDocumentsSettings.watermark_opacity),
          watermark_scale: Number(pdfDocumentsSettings.watermark_scale),
          watermark_logo_url: watermarkLogoPresetToPayload(pdfDocumentsSettings.watermark_logo_url),
          show_status_badge: Boolean(pdfDocumentsSettings.show_status_badge),
          theme_colors: pdfDocumentsSettings.theme_colors,
          sections: pdfDocumentsSettings.sections,
        },
        { withCredentials: true, params: billingBranchQuery() }
      );
      const saved = {
        ...DEFAULT_PDF_DOCUMENT_SETTINGS,
        ...(response.data?.pdf_documents || pdfDocumentsSettings),
        theme_colors: {
          ...DEFAULT_PDF_DOCUMENT_SETTINGS.theme_colors,
          ...((response.data?.pdf_documents || pdfDocumentsSettings).theme_colors || {}),
        },
        sections: Object.fromEntries(
          Object.keys(DEFAULT_PDF_DOCUMENT_SETTINGS.sections).map((docType) => [
            docType,
            {
              ...DEFAULT_PDF_DOCUMENT_SETTINGS.sections[docType],
              ...((response.data?.pdf_documents || pdfDocumentsSettings).sections || {})[docType],
            },
          ])
        ),
      };
      setPdfDocumentsSettings({
        ...saved,
        watermark_logo_url: normalizeWatermarkLogoPreset(saved.watermark_logo_url),
      });
      setBillingSettings((prev) => ({ ...prev, pdf_documents: saved }));
      toast.success("Apariencia de documentos PDF actualizada");
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo guardar la configuración PDF");
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
      await axios.put(
        `${API}/settings/billing/iva`,
        { iva_rate: numeric },
        { withCredentials: true, params: billingBranchQuery() }
      );
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
        { withCredentials: true, params: billingBranchQuery() }
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
        { withCredentials: true, params: billingBranchQuery() }
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
      await axios.delete(`${API}/settings/billing/exchange/rules/${ruleId}`, {
        withCredentials: true,
        params: billingBranchQuery(),
      });
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
        { withCredentials: true, params: billingBranchQuery() }
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
        { withCredentials: true, params: billingBranchQuery() }
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
      await axios.delete(`${API}/settings/billing/cancel-reasons/${reasonId}`, {
        withCredentials: true,
        params: billingBranchQuery(),
      });
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Centro de configuración</h1>
          <p className="text-muted-foreground">Apariencia, facturación, vehículos, monedas e impresoras en un solo lugar</p>
        </div>
        {canManageSystemSettings ? (
          <Button onClick={downloadExcelBackup} disabled={backingUp} data-testid="download-backup-btn-settings">
            {backingUp ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Descargar respaldo
          </Button>
        ) : null}
      </div>

      <Tabs value={activeTab} onValueChange={handleSettingsTabChange} className="space-y-4 animate-fade-up-soft">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-md border bg-card p-1.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
          {SETTINGS_TAB_OPTIONS.map((tab) => {
            const Icon = SETTINGS_TAB_ICONS[tab.icon];
            const isGerenciaOrProg = ["gerencia", "programador"].includes(String(user?.role || "").toLowerCase());
            const hidden =
              (tab.id === "billing" && !canManageBillingSettings)
              || (tab.id === "vehicles" && !canManageVehicleSettings)
              || (tab.id === "dialogos" && !canManageDialogMessages)
              || (tab.id === "seguridad" && !isGerenciaOrProg)
              || (["monedas", "notificaciones", "impresoras"].includes(tab.id) && !canManageSystemSettings);
            if (hidden) return null;
            return (
              <TabsTrigger key={tab.id} value={tab.id} className="gap-2 rounded-full">
                {Icon ? <Icon className="h-4 w-4" /> : null}
                {tab.label}
              </TabsTrigger>
            );
          })}
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
            {canManageAppearanceSettings ? (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <Label>Transparencia de marca de agua</Label>
                      <p className="text-xs text-muted-foreground">
                        Ajuste global para login, reloj de asistencia y fondo principal.
                      </p>
                    </div>
                    <span className="min-w-14 text-right text-sm font-semibold">{watermarkOpacityPercent}%</span>
                  </div>
                  <Input
                    type="range"
                    min="0"
                    max="30"
                    step="1"
                    value={watermarkOpacityPercent}
                    onChange={(event) => setWatermarkOpacityPercent(event.target.value)}
                    data-testid="settings-watermark-opacity"
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="30"
                      step="1"
                      value={watermarkOpacityPercent}
                      onChange={(event) => setWatermarkOpacityPercent(event.target.value)}
                      className="w-24"
                    />
                    <Button
                      onClick={saveWatermarkOpacity}
                      disabled={savingAppearanceSettings}
                      data-testid="settings-watermark-opacity-save"
                    >
                      {savingAppearanceSettings ? "Guardando..." : "Guardar"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Disponible solo para gerencia. Rango permitido: 0% a 30%.</p>
                </div>
              </>
            ) : null}
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
                Cada sucursal tiene su propia configuración de facturas, cotizaciones, crédito, abonos y voucher POS.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!canManageBillingSettings ? (
                <p className="text-sm text-amber-600">Solo Gerencia y Recursos Humanos pueden modificar esta pestaña.</p>
              ) : loadingBillingSettings ? (
                <p className="text-sm text-muted-foreground">Cargando configuración de facturación...</p>
              ) : (
                <>
                  <div className="space-y-3 rounded-md border bg-muted/20 p-4">
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="min-w-[260px] flex-1 space-y-2">
                        <Label>Sucursal a configurar</Label>
                        <Select value={selectedBillingBranchId} onValueChange={setSelectedBillingBranchId}>
                          <SelectTrigger><SelectValue placeholder="Seleccionar sucursal" /></SelectTrigger>
                          <SelectContent>
                            {branches.map((branch) => (
                              <SelectItem key={branch.branch_id} value={branch.branch_id}>
                                {branch.name || branch.branch_id}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {selectedBillingBranch?.name
                          ? `Editando: ${selectedBillingBranch.name}`
                          : `ID: ${selectedBillingBranchId}`}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Los PDFs impresos usan la configuración de la sucursal donde se creó la venta o cotización.
                    </p>
                  </div>

                  <Tabs value={activeBillingTab} onValueChange={handleBillingTabChange} className="space-y-4">
                    <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-md border bg-muted/20 p-1.5 sm:grid-cols-3 lg:grid-cols-5">
                      {BILLING_SUBTAB_OPTIONS.map((tab) => (
                        <TabsTrigger key={tab.id} value={tab.id} className="rounded-full text-sm">
                          {tab.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    <TabsContent value="exchange" className="space-y-4 mt-0">
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
                    </TabsContent>

                    <TabsContent value="pdf" className="space-y-4 mt-0">
                  <div className="space-y-4 rounded-md border p-4">
                    <div className="flex items-start gap-3">
                      <FileText className="mt-0.5 h-5 w-5 text-muted-foreground" />
                      <div>
                        <h3 className="font-medium">Documentos PDF</h3>
                        <p className="text-xs text-muted-foreground">
                          Usa los mismos logos del ERP (formularios). Si no eliges uno, se aplica el logo de la sucursal.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded-md border px-3 py-2">
                      <div>
                        <Label>Marca de agua en fondo</Label>
                        <p className="text-xs text-muted-foreground">Logo centrado con transparencia</p>
                      </div>
                      <Switch
                        checked={Boolean(pdfDocumentsSettings.watermark_enabled)}
                        onCheckedChange={(checked) => updatePdfDocumentsField("watermark_enabled", checked)}
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Opacidad de marca de agua ({Math.round(Number(pdfDocumentsSettings.watermark_opacity || 0) * 100)}%)</Label>
                        <Input
                          type="range"
                          min="2"
                          max="35"
                          step="1"
                          value={Math.round(Number(pdfDocumentsSettings.watermark_opacity || 0.08) * 100)}
                          onChange={(e) => updatePdfDocumentsField("watermark_opacity", Number(e.target.value) / 100)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Escala del logo ({Math.round(Number(pdfDocumentsSettings.watermark_scale || 0.55) * 100)}%)</Label>
                        <Input
                          type="range"
                          min="25"
                          max="90"
                          step="1"
                          value={Math.round(Number(pdfDocumentsSettings.watermark_scale || 0.55) * 100)}
                          onChange={(e) => updatePdfDocumentsField("watermark_scale", Number(e.target.value) / 100)}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Logo de marca de agua</Label>
                        <Select
                          value={
                            WATERMARK_LOGO_PRESETS.some(
                              (preset) => preset.id === normalizeWatermarkLogoPreset(pdfDocumentsSettings.watermark_logo_url)
                            )
                              ? normalizeWatermarkLogoPreset(pdfDocumentsSettings.watermark_logo_url)
                              : "custom"
                          }
                          onValueChange={(value) => {
                            if (value === "custom") return;
                            updatePdfDocumentsField("watermark_logo_url", value);
                          }}
                        >
                          <SelectTrigger><SelectValue placeholder="Seleccionar logo" /></SelectTrigger>
                          <SelectContent>
                            {WATERMARK_LOGO_PRESETS.map((preset) => (
                              <SelectItem key={preset.id} value={preset.id}>{preset.label}</SelectItem>
                            ))}
                            <SelectItem value="custom">URL personalizada</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>URL personalizada (opcional)</Label>
                        <Input
                          value={pdfDocumentsSettings.watermark_logo_url || ""}
                          onChange={(e) => updatePdfDocumentsField("watermark_logo_url", e.target.value)}
                          placeholder="https://... o preset: mundo-logo"
                        />
                      </div>
                    </div>

                    <div className="space-y-3 rounded-md border bg-muted/20 p-4">
                      <div>
                        <Label>Vista previa integrada</Label>
                        <p className="text-xs text-muted-foreground">
                          Usa los valores actuales del formulario (no necesitas guardar antes de previsualizar).
                        </p>
                      </div>
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="min-w-[220px] flex-1 space-y-2">
                          <Label className="text-xs text-muted-foreground">Tipo de documento</Label>
                          <Select value={embeddedPreviewKind} onValueChange={setEmbeddedPreviewKind}>
                            <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                            <SelectContent>
                              {PDF_PREVIEW_OPTIONS.map((option) => (
                                <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          onClick={() => showEmbeddedPdfPreview(embeddedPreviewKind)}
                          disabled={Boolean(previewingPdfKind)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          {previewingPdfKind ? "Generando..." : "Ver vista previa aquí"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => openPdfPreviewInNewTab(embeddedPreviewKind)}
                          disabled={Boolean(previewingPdfKind)}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Abrir en pestaña nueva
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {PDF_PREVIEW_OPTIONS.map((option) => (
                          <Button
                            key={option.id}
                            variant="outline"
                            size="sm"
                            disabled={Boolean(previewingPdfKind)}
                            onClick={() => showEmbeddedPdfPreview(option.id)}
                          >
                            {previewingPdfKind === option.id ? "Generando..." : option.label}
                          </Button>
                        ))}
                      </div>
                      {embeddedPdfPreviewUrl ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium">Vista previa: {embeddedPdfPreviewLabel}</p>
                            <Button variant="ghost" size="sm" onClick={revokeEmbeddedPdfPreview}>
                              <X className="h-4 w-4 mr-1" />
                              Cerrar
                            </Button>
                          </div>
                          <div className="overflow-hidden rounded-md border bg-white shadow-sm">
                            <iframe
                              title={`Vista previa PDF ${embeddedPdfPreviewLabel}`}
                              src={embeddedPdfPreviewUrl}
                              className="h-[min(72vh,760px)] w-full"
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between rounded-md border px-3 py-2">
                      <div>
                        <Label>Etiqueta de estado en encabezado</Label>
                        <p className="text-xs text-muted-foreground">Ej: Factura pagada, Cotización, Abono registrado</p>
                      </div>
                      <Switch
                        checked={Boolean(pdfDocumentsSettings.show_status_badge)}
                        onCheckedChange={(checked) => updatePdfDocumentsField("show_status_badge", checked)}
                      />
                    </div>

                    <div className="space-y-3">
                      <Label>Colores por tipo de documento</Label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {PDF_THEME_COLOR_OPTIONS.map((option) => (
                          <div key={option.key} className="flex items-center justify-between gap-3 rounded-md border p-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{option.label}</p>
                              <p className="text-xs text-muted-foreground">{option.hint}</p>
                            </div>
                            <Input
                              type="color"
                              value={pdfDocumentsSettings.theme_colors?.[option.key] || DEFAULT_PDF_DOCUMENT_SETTINGS.theme_colors[option.key]}
                              onChange={(e) => updatePdfThemeColor(option.key, e.target.value.toUpperCase())}
                              className="h-10 w-14 cursor-pointer p-1"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3 rounded-md border border-dashed bg-muted/10 p-4">
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div className="space-y-2">
                          <Label>Tipo de documento a personalizar</Label>
                          <Select value={selectedPdfDocType} onValueChange={setSelectedPdfDocType}>
                            <SelectTrigger className="w-[min(100%,320px)]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PDF_DOCUMENT_TYPE_OPTIONS.map((option) => (
                                <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {selectedPdfDocType === "petty_cash" ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Wallet className="h-4 w-4" />
                            Insumos, viáticos, adelantos, bonos y alimentación
                          </div>
                        ) : null}
                      </div>
                      <Label className="text-xs text-muted-foreground">Secciones visibles en el PDF</Label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {sectionOptionsForDocType(selectedPdfDocType)
                          .filter((option) => !option.isBreakdownChild)
                          .map((option) => (
                            <div key={option.key} className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
                              <span className="text-sm">{option.label}</span>
                              <Switch
                                checked={Boolean(pdfDocumentsSettings.sections?.[selectedPdfDocType]?.[option.key])}
                                onCheckedChange={(checked) => updatePdfDocumentsSection(selectedPdfDocType, option.key, checked)}
                              />
                            </div>
                          ))}
                      </div>
                      {pdfDocumentsSettings.sections?.[selectedPdfDocType]?.breakdown ? (
                        <div className="space-y-2 rounded-md border border-dashed p-3">
                          <Label className="text-xs text-muted-foreground">Líneas del desglose</Label>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {sectionOptionsForDocType(selectedPdfDocType)
                              .filter((option) => option.isBreakdownChild)
                              .map((option) => (
                                <div key={option.key} className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
                                  <span className="text-sm">{option.label}</span>
                                  <Switch
                                    checked={Boolean(pdfDocumentsSettings.sections?.[selectedPdfDocType]?.[option.key])}
                                    onCheckedChange={(checked) => updatePdfDocumentsSection(selectedPdfDocType, option.key, checked)}
                                  />
                                </div>
                              ))}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <Button onClick={savePdfDocumentsSettings} disabled={savingBillingSettings}>
                      <Save className="h-4 w-4 mr-2" />
                      Guardar documentos PDF
                    </Button>
                  </div>
                    </TabsContent>

                    <TabsContent value="petty-cash" className="space-y-4 mt-0">
                  <div className="space-y-4 rounded-md border p-4">
                    <div className="flex items-start gap-3">
                      <Wallet className="mt-0.5 h-5 w-5 text-muted-foreground" />
                      <div>
                        <h3 className="font-medium">Fondo de caja chica por sucursal</h3>
                        <p className="text-xs text-muted-foreground">
                          Define fondo autorizado, tope mensual, umbral de alerta y montos que requieren aprobación de gerencia.
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Fondo autorizado (NIO)</Label>
                        <Input type="number" step="0.01" value={pettyCashSettings.fund_amount} onChange={(e) => updatePettyCashField("fund_amount", Number(e.target.value))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Tope mensual de gasto</Label>
                        <Input type="number" step="0.01" value={pettyCashSettings.monthly_cap} onChange={(e) => updatePettyCashField("monthly_cap", Number(e.target.value))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Alerta saldo bajo (% del fondo)</Label>
                        <Input type="number" step="1" value={pettyCashSettings.low_balance_threshold_pct} onChange={(e) => updatePettyCashField("low_balance_threshold_pct", Number(e.target.value))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Aprobación requerida sobre (NIO)</Label>
                        <Input type="number" step="0.01" value={pettyCashSettings.requires_approval_above} onChange={(e) => updatePettyCashField("requires_approval_above", Number(e.target.value))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Prefijo de comprobante</Label>
                        <Input value={pettyCashSettings.voucher_prefix || "CC"} onChange={(e) => updatePettyCashField("voucher_prefix", e.target.value.toUpperCase())} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Categorías permitidas</Label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {PETTY_CASH_CATEGORY_OPTIONS.map((option) => (
                          <div key={option.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                            <span className="text-sm">{option.label}</span>
                            <Switch
                              checked={pettyCashSettings.allowed_categories?.includes(option.id)}
                              onCheckedChange={(checked) => {
                                setPettyCashSettings((prev) => ({
                                  ...prev,
                                  allowed_categories: checked
                                    ? [...new Set([...(prev.allowed_categories || []), option.id])]
                                    : (prev.allowed_categories || []).filter((id) => id !== option.id),
                                }));
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    <Button onClick={savePettyCashSettings} disabled={savingBillingSettings}>
                      <Save className="h-4 w-4 mr-2" />
                      Guardar caja chica
                    </Button>
                  </div>
                    </TabsContent>

                    <TabsContent value="voucher" className="space-y-4 mt-0">
                  <div className="space-y-4 rounded-md border p-4">
                    <div className="flex items-start gap-3">
                      <ReceiptText className="mt-0.5 h-5 w-5 text-muted-foreground" />
                      <div>
                        <h3 className="font-medium">Voucher POS 80mm (ventas / caja)</h3>
                        <p className="text-xs text-muted-foreground">
                          Ajusta fuente, márgenes, textos y secciones del ticket térmico. Usa margen superior y margen izquierdo si la impresora recorta líneas o columnas. Vehículo, placa y líneas de descuento solo aparecen cuando la venta incluye esos datos.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Tamaño de fuente cuerpo ({sellerVoucherSettings.body_font_size} pt)</Label>
                        <Input
                          type="range"
                          min="5"
                          max="10"
                          step="1"
                          value={Number(sellerVoucherSettings.body_font_size || 6)}
                          onChange={(e) => updateSellerVoucherField("body_font_size", Number(e.target.value))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Tamaño de fuente títulos ({sellerVoucherSettings.title_font_size} pt)</Label>
                        <Input
                          type="range"
                          min="6"
                          max="12"
                          step="1"
                          value={Number(sellerVoucherSettings.title_font_size || 7)}
                          onChange={(e) => updateSellerVoucherField("title_font_size", Number(e.target.value))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Avance superior antes de imprimir ({sellerVoucherSettings.top_feed_lines} líneas)</Label>
                        <Input
                          type="range"
                          min="0"
                          max="20"
                          step="1"
                          value={Number(sellerVoucherSettings.top_feed_lines || 8)}
                          onChange={(e) => updateSellerVoucherField("top_feed_lines", Number(e.target.value))}
                        />
                        <p className="text-xs text-muted-foreground">Corrige encabezado recortado en impresoras térmicas.</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Margen izquierdo ({sellerVoucherSettings.left_margin_chars} espacios)</Label>
                        <Input
                          type="range"
                          min="0"
                          max="8"
                          step="1"
                          value={Number(sellerVoucherSettings.left_margin_chars || 2)}
                          onChange={(e) => updateSellerVoucherField("left_margin_chars", Number(e.target.value))}
                        />
                        <p className="text-xs text-muted-foreground">Evita que se corten las primeras columnas del texto.</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Ancho código de barras ESC/POS ({sellerVoucherSettings.barcode_module_width})</Label>
                        <Input
                          type="range"
                          min="2"
                          max="6"
                          step="1"
                          value={Number(sellerVoucherSettings.barcode_module_width || 4)}
                          onChange={(e) => updateSellerVoucherField("barcode_module_width", Number(e.target.value))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Caracteres por línea ({sellerVoucherSettings.chars_per_line})</Label>
                        <Input
                          type="range"
                          min="32"
                          max="64"
                          step="2"
                          value={Number(sellerVoucherSettings.chars_per_line || 64)}
                          onChange={(e) => updateSellerVoucherField("chars_per_line", Number(e.target.value))}
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label>Textos personalizables</Label>
                      <div className="grid gap-3 md:grid-cols-2">
                        {SELLER_VOUCHER_TEXT_FIELDS.map((field) => (
                          <div key={field.key} className="space-y-2">
                            <Label className="text-xs text-muted-foreground">{field.label}</Label>
                            <Input
                              value={sellerVoucherSettings.texts?.[field.key] || ""}
                              onChange={(e) => updateSellerVoucherText(field.key, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label>Secciones visibles en el voucher</Label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {SELLER_VOUCHER_SECTION_OPTIONS.map((option) => (
                          <div key={option.key} className="flex items-center justify-between rounded-md border px-3 py-2">
                            <span className="text-sm">{option.label}</span>
                            <Switch
                              checked={Boolean(sellerVoucherSettings.sections?.[option.key])}
                              onCheckedChange={(checked) => updateSellerVoucherSection(option.key, checked)}
                            />
                          </div>
                        ))}
                      </div>
                      {sellerVoucherSettings.sections?.breakdown ? (
                        <div className="space-y-2 rounded-md border border-dashed bg-muted/10 p-3">
                          <Label className="text-xs text-muted-foreground">Líneas del desglose</Label>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {SELLER_VOUCHER_BREAKDOWN_SECTION_OPTIONS.map((option) => (
                              <div
                                key={option.key}
                                className="flex items-center justify-between rounded-md border bg-background px-3 py-2"
                              >
                                <span className="text-sm">{option.label}</span>
                                <Switch
                                  checked={Boolean(sellerVoucherSettings.sections?.[option.key])}
                                  onCheckedChange={(checked) => updateSellerVoucherSection(option.key, checked)}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-3 rounded-md border bg-muted/20 p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <Button onClick={showEmbeddedSellerVoucherPreview} disabled={previewingSellerVoucher}>
                          <Eye className="h-4 w-4 mr-2" />
                          {previewingSellerVoucher ? "Generando..." : "Vista previa voucher"}
                        </Button>
                        <Button onClick={saveSellerVoucherSettings} disabled={savingBillingSettings}>
                          <Save className="h-4 w-4 mr-2" />
                          Guardar voucher POS
                        </Button>
                      </div>
                      {embeddedSellerVoucherPreviewUrl ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium">Vista previa del voucher POS</p>
                            <Button variant="ghost" size="sm" onClick={revokeEmbeddedSellerVoucherPreview}>
                              <X className="h-4 w-4 mr-1" />
                              Cerrar
                            </Button>
                          </div>
                          <div className="overflow-hidden rounded-md border bg-white shadow-sm">
                            <iframe
                              title="Vista previa voucher POS"
                              src={embeddedSellerVoucherPreviewUrl}
                              className="h-[min(72vh,760px)] w-full"
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-4 rounded-md border p-4">
                    <div className="flex items-start gap-3">
                      <ReceiptText className="mt-0.5 h-5 w-5 text-muted-foreground" />
                      <div>
                        <h3 className="font-medium">Factura termica 80mm (post-cobro, sin IVA)</h3>
                        <p className="text-xs text-muted-foreground">
                          Comprobante impreso automaticamente al cobrar ventas sin IVA. Incluye monto recibido, cambio y datos del cajero en el mismo ticket.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Avance superior ({thermalInvoiceSettings.top_feed_lines} lineas)</Label>
                        <Input
                          type="range"
                          min="0"
                          max="20"
                          step="1"
                          value={Number(thermalInvoiceSettings.top_feed_lines || 8)}
                          onChange={(e) => updateThermalInvoiceField("top_feed_lines", Number(e.target.value))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Margen izquierdo ({thermalInvoiceSettings.left_margin_chars} espacios)</Label>
                        <Input
                          type="range"
                          min="0"
                          max="8"
                          step="1"
                          value={Number(thermalInvoiceSettings.left_margin_chars || 2)}
                          onChange={(e) => updateThermalInvoiceField("left_margin_chars", Number(e.target.value))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Caracteres por linea ({thermalInvoiceSettings.chars_per_line})</Label>
                        <Input
                          type="range"
                          min="32"
                          max="64"
                          step="2"
                          value={Number(thermalInvoiceSettings.chars_per_line || 64)}
                          onChange={(e) => updateThermalInvoiceField("chars_per_line", Number(e.target.value))}
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label>Textos personalizables</Label>
                      <div className="grid gap-3 md:grid-cols-2">
                        {THERMAL_INVOICE_TEXT_FIELDS.map((field) => (
                          <div key={field.key} className="space-y-2">
                            <Label className="text-xs text-muted-foreground">{field.label}</Label>
                            <Input
                              value={thermalInvoiceSettings.texts?.[field.key] || ""}
                              onChange={(e) => updateThermalInvoiceText(field.key, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label>Secciones visibles en factura termica</Label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {THERMAL_INVOICE_SECTION_OPTIONS.map((option) => (
                          <div key={option.key} className="flex items-center justify-between rounded-md border px-3 py-2">
                            <span className="text-sm">{option.label}</span>
                            <Switch
                              checked={Boolean(thermalInvoiceSettings.sections?.[option.key])}
                              onCheckedChange={(checked) => updateThermalInvoiceSection(option.key, checked)}
                            />
                          </div>
                        ))}
                      </div>
                      {thermalInvoiceSettings.sections?.breakdown ? (
                        <div className="space-y-2 rounded-md border border-dashed bg-muted/10 p-3">
                          <Label className="text-xs text-muted-foreground">Lineas del desglose</Label>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {THERMAL_INVOICE_BREAKDOWN_SECTION_OPTIONS.map((option) => (
                              <div
                                key={option.key}
                                className="flex items-center justify-between rounded-md border bg-background px-3 py-2"
                              >
                                <span className="text-sm">{option.label}</span>
                                <Switch
                                  checked={Boolean(thermalInvoiceSettings.sections?.[option.key])}
                                  onCheckedChange={(checked) => updateThermalInvoiceSection(option.key, checked)}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-3 rounded-md border bg-muted/20 p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <Button onClick={showEmbeddedThermalInvoicePreview} disabled={previewingThermalInvoice}>
                          <Eye className="h-4 w-4 mr-2" />
                          {previewingThermalInvoice ? "Generando..." : "Vista previa factura termica"}
                        </Button>
                      </div>
                      {embeddedThermalInvoicePreviewUrl ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium">Vista previa factura termica</p>
                            <Button variant="ghost" size="sm" onClick={revokeEmbeddedThermalInvoicePreview}>
                              <X className="h-4 w-4 mr-1" />
                              Cerrar
                            </Button>
                          </div>
                          <div className="overflow-hidden rounded-md border bg-white shadow-sm">
                            <iframe
                              title="Vista previa factura termica"
                              src={embeddedThermalInvoicePreviewUrl}
                              className="h-[min(72vh,760px)] w-full"
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                    </TabsContent>

                    <TabsContent value="cancel" className="space-y-4 mt-0">
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
                    </TabsContent>
                  </Tabs>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monedas" className="space-y-6">
          <div className="rounded-md border bg-background p-2 sm:p-4 ui-panel">
            <SystemSettingsContent forcedSection="monedas" showPageHeader={false} showBackupButton={false} />
          </div>
        </TabsContent>

        <TabsContent value="notificaciones" className="space-y-6">
          <div className="rounded-md border bg-background p-2 sm:p-4 ui-panel">
            <SystemSettingsContent forcedSection="notificaciones" showPageHeader={false} showBackupButton={false} />
          </div>
        </TabsContent>

        <TabsContent value="impresoras" className="space-y-6">
          <div className="rounded-md border bg-background p-2 sm:p-4 ui-panel">
            <SystemSettingsContent forcedSection="impresoras" showPageHeader={false} showBackupButton={false} />
          </div>
        </TabsContent>

        <TabsContent value="dialogos" className="space-y-6">
          {canManageDialogMessages ? (
            <DialogMessagesSettingsPanel />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Mensajes de diálogos</CardTitle>
                <CardDescription>
                  Solo gerencia y programadores pueden editar estos textos.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="seguridad" className="space-y-6">
          <SessionSecuritySettingsPanel />
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

          <VehicleCatalogSettingsPanel canManage={canManageVehicleSettings} />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Siluetas de vehículos
              </CardTitle>
              <CardDescription>
                Miniaturas genéricas por tipo de vehículo para tarjetas de ventas, cotizaciones y flota.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!canManageVehicleSettings && (
                <p className="text-sm text-amber-600">Solo gerencia puede actualizar siluetas.</p>
              )}
              {loadingVehicleThumbnails ? (
                <p className="text-sm text-muted-foreground">Cargando siluetas...</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {(vehicleThumbnailManifest.catalog || []).map((item) => {
                    const slug = item.slug;
                    const asset = vehicleThumbnailManifest.assets?.[slug] || {};
                    const previewUrl = buildThumbnailPreviewUrl(slug, asset);
                    const isUploading = uploadingThumbnailSlug === slug;
                    return (
                      <div key={slug} className="rounded-lg border p-3 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-sm">{item.label}</p>
                            <p className="text-xs text-muted-foreground">{slug}</p>
                          </div>
                          <Badge variant={asset.source === "active" ? "default" : "secondary"}>
                            {asset.source === "active" ? "Personalizada" : "Incluida"}
                          </Badge>
                        </div>
                        <img
                          src={previewUrl}
                          alt={item.label}
                          className="h-32 w-full rounded-md bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 object-contain object-center"
                        />
                        <div className="flex flex-wrap gap-2">
                          <Input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            disabled={!canManageVehicleSettings || isUploading}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) uploadVehicleThumbnail(slug, file);
                              event.target.value = "";
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!canManageVehicleSettings || isUploading || asset.source !== "active"}
                            onClick={() => resetVehicleThumbnail(slug)}
                          >
                            Restablecer
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Cada modelo del catálogo maestro ya trae `vehicle_type_slug` pre-asignado; las tarjetas usan esa silueta sin recalcular.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
