import React, { useCallback, useMemo, useState, useEffect, useRef, useDeferredValue } from "react";
import { flushSync } from "react-dom";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ContextualDialogFooter,
  ContextualDialogHeader,
  getStatusPrimaryButtonClass,
  getStatusSecondaryButtonClass,
} from "@/components/ui/contextual-dialog-header";
import { useDialogMessages } from "@/context/DialogMessagesContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SearchableSelect from "@/components/ui/searchable-select";
import { cn, formatCurrency } from "@/lib/utils";
import { CUSTOMER_VEHICLE_CARD_PATTERNS } from "@/lib/cardPatterns";
import { API_BASE as API } from "@/lib/api";
import {
  AlertTriangle,
  ArrowRightLeft,
  BadgeAlert,
  Banknote,
  BookOpen,
  Building2,
  Camera,
  Car,
  CarFront,
  Check,
  CreditCard,
  Eye,
  FileText,
  FlaskConical,
  Hand,
  Layers,
  Loader2,
  MapPin,
  Minus,
  Package,
  PackageSearch,
  Palette,
  PencilLine,
  Percent,
  Phone,
  Plus,
  PlusCircle,
  RefreshCcw,
  ScanBarcode,
  Scissors,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Tag,
  Trash2,
  Truck,
  Undo2,
  User,
  UserPlus,
  UserSearch,
  Warehouse,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import CirculationCardOcrScannerModal from "@/components/vehicles/CirculationCardOcrScannerModal";
import ProductQuickViewDialog from "@/components/erp/ProductQuickViewDialog";
import ProductImageHoverZoom from "@/components/erp/ProductImageHoverZoom";
import {
  formatVehicleIdentityHint,
  getVehicleSelectOptionsByBrandYear,
  getVehicleYearsByBrand,
  getCatalogVehiclePayload,
  isPickupCatalogModel,
  isValidVehicleSelection,
  normalizeVehicleBrand,
  findCatalogEntryForVehicle,
  VEHICLE_CATALOG_BRANDS,
  VEHICLE_COLOR_SUGGESTIONS,
} from "@/lib/vehicleCatalog";
import { getVehicleDisplayImage } from "@/lib/vehicleSilhouette";
import {
  formatChasis,
  formatCedula,
  formatPhone,
  formatPlateNumber,
  formatRUC,
} from "@/lib/formatters";
import {
  getPaymentMethodSummaryLabel,
  normalizePaymentMethodCode,
  normalizePaymentMethodList,
  paymentMethodsAllowDiscounts,
} from "@/lib/paymentMethods";
import PaymentPlanEditor from "@/components/sales/PaymentPlanEditor";
import {
  buildDefaultPlanLine,
  buildMixedPaymentPlan,
  buildPlanLinesForSubmit,
  buildSinglePaymentPlan,
  isPlanLineAmountEmpty,
  rebalanceMixedPlanRemainders,
  syncMixedPlanLines,
  resolveCustomerCreditDays,
  validatePlanAgainstTotal,
  validatePlanLineUniqueness,
} from "@/lib/plannedPaymentPlan";
import {
  playCartQuantityUpSound,
  playCartQuantityDownSound,
  playCartRemoveSound,
  playCartPickupSound,
  playCreationSuccessSound,
  playUndoSound,
  playSelectionFeedbackSound,
} from "@/lib/uiSounds";
import CustomerVehicleFormTabs from "@/components/customers/CustomerVehicleFormTabs";
import { VehicleCabVariantSelect } from "@/components/erp/VehicleCabVariantSelect";
import ProductBarcodeScannerDialog from "@/components/erp/ProductBarcodeScannerDialog";
import { getCameraContextError } from "@/lib/cameraAccess";
import SaleFlowStepProgress from "@/components/erp/SaleFlowStepProgress";
import EmptyCartPlaceholder from "@/components/erp/EmptyCartPlaceholder";
import SavingsHighlightRow from "@/components/erp/SavingsHighlightRow";
import { ErpRollingCurrency, ErpRollingQuantity } from "@/components/erp/ErpRollingNumber";
import {
  ERP_ANIMATION_CLASSES,
  ERP_SEARCH_ROW,
  ERP_SEMANTIC_TONES,
  buildSaleFlowSteps,
  getErpCustomerSearchRowTone,
  getErpProductTone,
  isErpDraftSupervisor,
} from "@/lib/erpDesignSystem";

import { findProductsByScanCode, productMatchesSearch } from "@/lib/productLookup";
import {
  clampSellerGlobalDiscount,
  getSellerCartLineLockState,
  isDraftBlockedForSeller,
  isDraftReleasedWithRestrictions,
  sellerGlobalDiscountExceeded,
} from "@/lib/draftReview";
import { computeSaleTotals, defaultApplyIvaForCustomer } from "@/lib/saleTotals";
import { isSaleDraftSaveEligible } from "@/lib/draftSaveEligibility";
import { scrollToAnchor } from "@/lib/scrollPageToTop";
import {
  TIER_LABELS,
  TIER_PRECIO1,
  TIER_PRECIO2,
  buildPrecio2CartSignature,
  buildTierChangeAuditEvent,
  cartNeedsPrecio2Approval,
  canSellerEditLinePrice,
  detectPriceTier,
  isSupervisorPricingRole,
  repriceCartItemsForTier,
  resolveDefaultUnitPrice,
  resolveProductTierPrice,
  tierRequiresSupervisorApproval,
} from "@/lib/priceTiers";
import PriceTierSelector from "@/components/sales/PriceTierSelector";
import PriceTierCompare from "@/components/sales/PriceTierCompare";
import DocumentAuditPanel from "@/components/sales/DocumentAuditPanel";
import TintWindowMaterialDialog from "@/components/sales/TintWindowMaterialDialog";
import { resolveVehicleCategory } from "@/lib/vehicleSilhouette";

export function getProductVehicleCompatibility(product, vehicle) {
  if (!vehicle) return { isCompatible: true, isSpecificTint: false, isSpecific: false, badge: null };

  const sku = String(product?.sku || "").toUpperCase();
  const name = String(product?.name || "").toLowerCase();
  const category = resolveVehicleCategory(vehicle);
  const compatibility = product?.compatibility || {};

  const isTintProduct =
    sku.startsWith("POL-") ||
    name.includes("polarizado") ||
    String(product?.category || "").toLowerCase().includes("polarizado");

  if (isTintProduct) {
    const isSedanVehicle = category === "sedan" || ["coupe", "convertible"].includes(category);
    const isHatchbackVehicle = category === "hatchback";
    const isSuvVehicle = ["suv", "station_wagon"].includes(category);
    const isPickupVehicle = [
      "pickup",
      "camioneta_doble_cabina",
      "camioneta_cabina_media",
      "camioneta_1_cabina",
    ].includes(category);
    const isVanVehicle = [
      "van",
      "microbus_pasajeros",
      "microbus_techo_alto",
      "microbus_carga",
    ].includes(category);
    const isTruckVehicle = [
      "truck",
      "camion_1_cabina",
      "camion_2_cabinas",
      "camion_carga_furgon",
      "bus_mediano_coaster",
      "bus_grande_marcopolo",
    ].includes(category);
    const isMotoVehicle = ["moto", "atv", "cuadriciclo"].includes(category);

    if (isMotoVehicle) {
      return { isCompatible: false, isSpecificTint: true, isSpecific: true, badge: "No aplica a motocicletas/ATV" };
    }

    // Universal partial tint items (apply to all 4+ wheeled vehicles)
    if (sku === "POL-DEL-001" || sku.includes("-DEL-") || name.includes("vidrios delanteros") || name.includes("solo delanteros")) {
      return { isCompatible: true, isSpecificTint: true, isSpecific: true, badge: "Compatible (Vidrios Delanteros)" };
    }
    if (sku === "POL-FRA-SUP" || sku.includes("-FRA-") || name.includes("franja") || name.includes("sunstrip")) {
      return { isCompatible: true, isSpecificTint: true, isSpecific: true, badge: "Compatible (Franja Parabrisas)" };
    }
    if (sku === "POL-LIM-001" || sku.includes("-LIM-") || name.includes("despolarizado") || name.includes("limpieza de vidrios")) {
      return { isCompatible: true, isSpecificTint: true, isSpecific: true, badge: "Compatible (Limpieza Vidrios)" };
    }
    if (sku === "POL-CSS-001" || sku.includes("-CSS-") || name.includes("sin sellado")) {
      return { isCompatible: true, isSpecificTint: true, isSpecific: true, badge: "Compatible (Sin Parabrisas)" };
    }
    if (sku === "POL-VEN-001" || sku.includes("-VEN-") || name.includes("ventana individual")) {
      return { isCompatible: true, isSpecificTint: true, isSpecific: true, badge: "Compatible (Ventana Individual)" };
    }

    // Complete Tint Product Identification
    const isSedanTint =
      sku === "POL-SED-COM" ||
      sku.includes("-SED-") ||
      ((name.includes("sedán") || name.includes("sedan") || name.includes("automóvil") || name.includes("automovil")) &&
        !name.includes("suv") &&
        !name.includes("camioneta") &&
        !name.includes("hatchback"));

    const isHatchbackTint =
      sku === "POL-HB-COM" ||
      sku.includes("-HB-") ||
      name.includes("hatchback") ||
      name.includes("compacto");

    const isSuvTint =
      sku === "POL-SUV-COM" ||
      sku.includes("-SUV-") ||
      ((name.includes("suv") || name.includes("station wagon") || name.includes("todo terreno")) &&
        !name.includes("pickup") &&
        !name.includes("doble cabina") &&
        !name.includes("camión"));

    const isPickupTint =
      sku === "POL-PCK-COM" ||
      sku.includes("-PCK-") ||
      name.includes("pickup") ||
      name.includes("pick-up") ||
      name.includes("doble cabina") ||
      name.includes("tina");

    const isVanTint =
      sku === "POL-VAN-COM" ||
      sku.includes("-VAN-") ||
      ((name.includes("microbús") || name.includes("microbus") || name.includes("van") || name.includes("minivan")) &&
        !name.includes("camión") &&
        !name.includes("camion"));

    const isTruckTint =
      sku === "POL-TRK-COM" ||
      sku.includes("-TRK-") ||
      (sku === "POL-CAM-COM" && (name.includes("camión") || name.includes("camion"))) ||
      name.includes("camión") ||
      name.includes("camion") ||
      name.includes("cabezal") ||
      name.includes("furgón");

    const isCamLegacyTint =
      sku === "POL-CAM-COM" ||
      (name.includes("camión") && name.includes("microbús"));

    if (isSuvVehicle) {
      if (isSuvTint) return { isCompatible: true, isSpecificTint: true, isSpecific: true, badge: "Compatible (SUV / Station Wagon)" };
      if (isSedanTint) return { isCompatible: false, isSpecificTint: true, isSpecific: true, badge: "Para Sedán / Auto" };
      if (isHatchbackTint) return { isCompatible: false, isSpecificTint: true, isSpecific: true, badge: "Para Hatchback" };
      if (isPickupTint) return { isCompatible: false, isSpecificTint: true, isSpecific: true, badge: "Para Camioneta Pickup" };
      if (isVanTint || isTruckTint || isCamLegacyTint) return { isCompatible: false, isSpecificTint: true, isSpecific: true, badge: "Para Vehículo Pesado" };
    } else if (isPickupVehicle) {
      if (isPickupTint) return { isCompatible: true, isSpecificTint: true, isSpecific: true, badge: "Compatible (Camioneta Pickup)" };
      if (isSuvTint) return { isCompatible: false, isSpecificTint: true, isSpecific: true, badge: "Para SUV / Station Wagon" };
      if (isSedanTint) return { isCompatible: false, isSpecificTint: true, isSpecific: true, badge: "Para Sedán / Auto" };
      if (isHatchbackTint) return { isCompatible: false, isSpecificTint: true, isSpecific: true, badge: "Para Hatchback" };
      if (isVanTint || isTruckTint || isCamLegacyTint) return { isCompatible: false, isSpecificTint: true, isSpecific: true, badge: "Para Vehículo Pesado" };
    } else if (isSedanVehicle) {
      if (isSedanTint) return { isCompatible: true, isSpecificTint: true, isSpecific: true, badge: "Compatible (Sedán / Auto)" };
      if (isHatchbackTint) return { isCompatible: true, isSpecificTint: true, isSpecific: true, badge: "Compatible (Auto Compacto)" };
      if (isSuvTint) return { isCompatible: false, isSpecificTint: true, isSpecific: true, badge: "Para SUV / Camioneta" };
      if (isPickupTint) return { isCompatible: false, isSpecificTint: true, isSpecific: true, badge: "Para Camioneta Pickup" };
      if (isVanTint || isTruckTint || isCamLegacyTint) return { isCompatible: false, isSpecificTint: true, isSpecific: true, badge: "Para Vehículo Pesado" };
    } else if (isHatchbackVehicle) {
      if (isHatchbackTint) return { isCompatible: true, isSpecificTint: true, isSpecific: true, badge: "Compatible (Hatchback / Compacto)" };
      if (isSedanTint) return { isCompatible: true, isSpecificTint: true, isSpecific: true, badge: "Compatible (Sedán / Auto)" };
      if (isSuvTint) return { isCompatible: false, isSpecificTint: true, isSpecific: true, badge: "Para SUV / Camioneta" };
      if (isPickupTint) return { isCompatible: false, isSpecificTint: true, isSpecific: true, badge: "Para Camioneta Pickup" };
      if (isVanTint || isTruckTint || isCamLegacyTint) return { isCompatible: false, isSpecificTint: true, isSpecific: true, badge: "Para Vehículo Pesado" };
    } else if (isVanVehicle) {
      if (isVanTint) return { isCompatible: true, isSpecificTint: true, isSpecific: true, badge: "Compatible (Microbús / Van)" };
      if (isCamLegacyTint || isTruckTint) return { isCompatible: true, isSpecificTint: true, isSpecific: true, badge: "Compatible (Microbús / Camión)" };
      if (isSedanTint || isHatchbackTint || isSuvTint || isPickupTint) return { isCompatible: false, isSpecificTint: true, isSpecific: true, badge: "Para Vehículo Liviano" };
    } else if (isTruckVehicle) {
      if (isTruckTint || isCamLegacyTint) return { isCompatible: true, isSpecificTint: true, isSpecific: true, badge: "Compatible (Camión / Cabezal)" };
      if (isVanTint) return { isCompatible: false, isSpecificTint: true, isSpecific: true, badge: "Para Microbús / Van" };
      if (isSedanTint || isHatchbackTint || isSuvTint || isPickupTint) return { isCompatible: false, isSpecificTint: true, isSpecific: true, badge: "Para Vehículo Liviano" };
    }

    return { isCompatible: true, isSpecificTint: true, isSpecific: true, badge: "Compatible" };
  }

  // Non-tint products: Check structured compatibility
  const hasStructuredCompat =
    (Array.isArray(compatibility.brands) && compatibility.brands.length > 0) ||
    (Array.isArray(compatibility.models) && compatibility.models.length > 0) ||
    Boolean(compatibility.year_from) ||
    Boolean(compatibility.year_to) ||
    (Array.isArray(compatibility.vehicle_types) && compatibility.vehicle_types.length > 0) ||
    (Array.isArray(product?.vehicle_types) && product.vehicle_types.length > 0);

  const vBrand = String(vehicle.brand || "").toLowerCase().trim();
  const vModel = String(vehicle.model || "").toLowerCase().trim();
  const vYear = Number(vehicle.year);
  const vType = String(vehicle.vehicle_type || vehicle.type || vehicle.body_type || "").toLowerCase().trim();

  if (hasStructuredCompat) {
    const brands = (Array.isArray(compatibility.brands) ? compatibility.brands : [])
      .map((b) => String(b).toLowerCase().trim())
      .filter(Boolean);

    if (brands.length > 0 && vBrand && !brands.some((b) => vBrand.includes(b) || b.includes(vBrand))) {
      return { isCompatible: false, isSpecificTint: false, isSpecific: true, badge: `Para ${brands.map((b) => b.toUpperCase()).join(", ")}` };
    }

    const models = (Array.isArray(compatibility.models) ? compatibility.models : [])
      .map((m) => String(m).toLowerCase().trim())
      .filter(Boolean);

    if (models.length > 0 && vModel && !models.some((m) => vModel.includes(m) || m.includes(vModel))) {
      return { isCompatible: false, isSpecificTint: false, isSpecific: true, badge: `Para ${models.map((m) => m.toUpperCase()).join(", ")}` };
    }

    if (!Number.isNaN(vYear) && vYear > 0 && (compatibility.year_from || compatibility.year_to)) {
      const yearFrom = Number(compatibility.year_from || 0);
      const yearTo = Number(compatibility.year_to || 9999);
      if (vYear < yearFrom || vYear > yearTo) {
        return { isCompatible: false, isSpecificTint: false, isSpecific: true, badge: `Años ${compatibility.year_from || "..."}-${compatibility.year_to || "Act."}` };
      }
    }

    const types = (Array.isArray(compatibility.vehicle_types) ? compatibility.vehicle_types : (product?.vehicle_types || []))
      .map((t) => String(t).toLowerCase().trim())
      .filter(Boolean);

    if (types.length > 0 && vType && !types.some((t) => vType.includes(t) || t.includes(vType))) {
      return { isCompatible: false, isSpecificTint: false, isSpecific: true, badge: `Carrocería ${types.join(", ")}` };
    }

    return { isCompatible: true, isSpecificTint: false, isSpecific: true, badge: "Compatible" };
  }

  // If no structured compatibility, check if product description explicitly targets other brands
  const KNOWN_BRANDS = [
    "toyota", "nissan", "hyundai", "kia", "mitsubishi", "suzuki", "honda", "mazda",
    "isuzu", "ford", "chevrolet", "volkswagen", "scion", "jeep", "dodge", "ram", "subaru"
  ];
  const brandsInTitle = KNOWN_BRANDS.filter((b) => name.includes(b));
  if (brandsInTitle.length > 0 && vBrand) {
    const matchesVehicleBrand = brandsInTitle.some((b) => vBrand.includes(b) || b.includes(vBrand));
    if (!matchesVehicleBrand) {
      return {
        isCompatible: false,
        isSpecificTint: false,
        isSpecific: true,
        badge: `Para ${brandsInTitle.map((b) => b.toUpperCase()).join("/")}`,
      };
    }
    return {
      isCompatible: true,
      isSpecificTint: false,
      isSpecific: true,
      badge: `Compatible (${vBrand.toUpperCase()})`,
    };
  }

  return { isCompatible: true, isSpecificTint: false, isSpecific: false, badge: null };
}

// Prefijos de placa Nicaragua
const PLATE_PREFIXES = [
  "M", "LE", "CH", "MY", "GR", "CZ", "MT", "BO", "CT", "RI",
  "NS", "ES", "MZ", "JI", "RS", "AN", "AS", "TM", "ZC", "PN",
  "EN", "CD", "MI", "OI"
];

// Lista de marcas de vehículos
const VEHICLE_BRANDS = [
  "ACURA", "ALFA ROMEO", "ASIA", "ASTON MARTIN", "AUDI", "BAIC", "BAJAJ", "BENTLEY", "BMW", "BYD",
  "CADILLAC", "CHANGAN", "CHERY", "CHEVROLET", "CHRYSLER", "CITROEN", "DAEWOO", "DAIHATSU", "DODGE",
  "DS", "FAW", "FIAT", "FORD", "FOTON", "GEELY", "GENESIS", "GMC", "GREATWALL", "HAIMA", "HINO",
  "HOLDEN", "HONDA", "HUMMER", "HYUNDAI", "INFINITY", "INTERNATIONAL", "ISUZU", "IVECO", "JAC",
  "JEEP", "KMAZ", "KIA", "LADA", "LANCIA", "LAND ROVER", "LEXUS", "LIFAN", "MAHINDRA",
  "MERCEDES-BENZ", "MINI", "MITSUBISHI", "NISSAN", "OPEL", "PEUGEOT", "PONTIAC", "PORSCHE",
  "RENAULT", "SCANIA", "SEAT", "SSANG YONG", "SUBARU", "SUZUKI", "TOYOTA", "UAZ", "VOLKSWAGEN",
  "VOLVO", "ZOTYE"
];

const normalizeGlobalDiscountMode = (value) => (value === "fixed" ? "fixed" : "percent");

const clampGlobalDiscountValue = (value, mode = "percent") => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  if (mode === "fixed") {
    return Math.max(0, Number(numericValue.toFixed(2)));
  }
  return Math.max(0, Math.min(100, Math.round(numericValue)));
};

function SaleTotalsBreakdownRow({
  label,
  value,
  currency,
  prefix = "",
  className = "",
}) {
  return (
    <div className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4", className)}>
      <span className="min-w-0 pr-2">{label}</span>
      <ErpRollingCurrency
        value={value}
        currency={currency}
        prefix={prefix}
        className="shrink-0 text-right"
      />
    </div>
  );
}

export default function SaleForm({
  customers = [],
  products = [],
  warehouses = [],
  inventory = [],
  crossBranchInventory = [],
  vehicles = [],
  initialData = {},
  onSubmit,
  submitLabel = "Crear",
  /** Sellers (and sales desk): confirm checklist before locking invoice in caja */
  confirmSendToCashier = false,
  exchangeRate = 36.5,
  buyExchangeRate = null,
  defaultIvaRate = 15,
  draftKey = null,
  extraFields = null,
  onOpenCatalogSearch = null,
  onDraftPersist = null,
  onDraftSaveStateChange = null,
  onDraftClear = null,
  onDataRefresh = null,
  flowType = "sale",
  step4Label = "Paso 4: Carrito del Cliente",
  step5Label = "Paso 5: Método de Pago",
  currencyValue = null,
  onCurrencyChange = null,
  hideCurrencyField = false,
  draftReview = {},
}) {
  const { user } = useAuth();
  const { getMessage: getDialogMessage } = useDialogMessages();
  const isSupervisorUser = isErpDraftSupervisor(user?.role);
  const isSellerRole = String(user?.role || "").toLowerCase() === "ventas";
  const sellerReleasedRestricted = isDraftReleasedWithRestrictions(draftReview) && !isSupervisorUser;
  const sellerParamsLocked = sellerReleasedRestricted;
  const sellerFlowLocked = sellerParamsLocked || (!isSupervisorUser && isDraftBlockedForSeller(draftReview));
  const sellerPaymentPlanBlocked = !isSupervisorUser && isDraftBlockedForSeller(draftReview);
  const sellerPaymentPlanStructureLocked = sellerReleasedRestricted;

  const notifySellerFlowLocked = useCallback(() => {
    toast.error("No puedes modificar cliente ni forma de entrega en este borrador.");
  }, []);

  const notifySellerParamsLocked = useCallback(() => {
    toast.error("No puedes modificar método de pago, retención IR ni parámetros fiscales en un borrador revisado por supervisión.");
  }, []);
  const [selectedCustomer, setSelectedCustomer] = useState(initialData.selectedCustomer || null);
  const [selectedVehicle, setSelectedVehicle] = useState(initialData.selectedVehicle || "");
  const [selectedWarehouse, setSelectedWarehouse] = useState(initialData.selectedWarehouse || "");
  const [cartItems, setCartItems] = useState(initialData.cartItems || []);
  const cartHistory = useRef([]);
  const [globalDiscountMode, setGlobalDiscountMode] = useState(
    normalizeGlobalDiscountMode(initialData.globalDiscountMode || initialData.global_discount_mode)
  );
  const [globalDiscount, setGlobalDiscount] = useState(
    clampGlobalDiscountValue(
      initialData.globalDiscount || 0,
      normalizeGlobalDiscountMode(initialData.globalDiscountMode || initialData.global_discount_mode)
    )
  );
  const [globalDiscountDraft, setGlobalDiscountDraft] = useState(
    String(
      clampGlobalDiscountValue(
        initialData.globalDiscount || 0,
        normalizeGlobalDiscountMode(initialData.globalDiscountMode || initialData.global_discount_mode)
      )
    )
  );
  const [paymentMethod, setPaymentMethod] = useState(initialData.paymentMethod || initialData.payment_type || "cash");
  const [notes, setNotes] = useState(initialData.notes || "");
  const [applyIVA, setApplyIVA] = useState(
    initialData.applyIVA ?? false,
  );
  const [onlyCompatibleProducts, setOnlyCompatibleProducts] = useState(true);
  const [ivaRate, setIvaRate] = useState(initialData.ivaRate ?? defaultIvaRate);
  const [applyRetention, setApplyRetention] = useState(initialData.applyRetention ?? false);
  const [retentionRate, setRetentionRate] = useState(initialData.retentionRate ?? 2);
  const canManageTaxes = ["gerencia", "programador", "supervisor"].includes(String(user?.role || "").toLowerCase());
  const isSupervisorUser = ["gerencia", "programador", "supervisor", "jefe_vendedores", "jefe_tienda"].includes(String(user?.role || "").toLowerCase());
  const [mixedPaymentMethods, setMixedPaymentMethods] = useState(
    normalizePaymentMethodList(initialData.mixedPaymentMethods || initialData.mixed_payment_methods || [])
  );
  const initialPlanLines = (initialData.planned_payment_plan?.lines || initialData.paymentPlanLines || []).map((line) => ({
    metodo: line.metodo || "cash",
    moneda: line.moneda || "NIO",
    monto_origen: line.monto_origen ?? "",
  }));
  const [paymentPlanLines, setPaymentPlanLines] = useState(
    initialPlanLines.length ? initialPlanLines : [buildDefaultPlanLine(initialData.paymentMethod || "cash", initialData.currency || "NIO")],
  );
  const [planTotalChangedHint, setPlanTotalChangedHint] = useState(false);
  const [paymentPlanSubmitAttention, setPaymentPlanSubmitAttention] = useState(false);
  const [paymentPlanSubmitAttentionMessage, setPaymentPlanSubmitAttentionMessage] = useState("");
  const paymentPlanSectionRef = useRef(null);
  const prevPlanTargetRef = useRef(0);
  const planAutoSyncSkipRef = useRef(true);
  const [currency, setCurrency] = useState(initialData.currency || "NIO");
  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const deferredProductSearch = useDeferredValue(productSearch);
  const [quickViewProduct, setQuickViewProduct] = useState(null);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [discountCode, setDiscountCode] = useState("");
  const [appliedDiscounts, setAppliedDiscounts] = useState(initialData.appliedDiscounts || []);
  const [localCustomers, setLocalCustomers] = useState(customers);
  const [localVehicles, setLocalVehicles] = useState(vehicles);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [showNewVehicleDialog, setShowNewVehicleDialog] = useState(false);
  const [newCustomerTab, setNewCustomerTab] = useState("customer");
  const [useVinDecoder, setUseVinDecoder] = useState(false);
  const [isDecodingVin, setIsDecodingVin] = useState(false);
  const [vehicleFlowOption, setVehicleFlowOption] = useState("carryout");
  const [logisticMode, setLogisticMode] = useState(initialData.logistic_mode || initialData.logisticMode || null);
  const [deliveryDestinationType, setDeliveryDestinationType] = useState("domicilio");
  const [deliveryCost, setDeliveryCost] = useState("");
  const [selectedMessengerId, setSelectedMessengerId] = useState("");
  const [messengerOptions, setMessengerOptions] = useState([]);
  const [messengerLoading, setMessengerLoading] = useState(false);
  const [messengerLoadFailed, setMessengerLoadFailed] = useState(false);
  const deliveryMessengerRetryRef = useRef(false);
  const [isVehiclePickerVisible, setIsVehiclePickerVisible] = useState(true);
  const [useVehicleVinDecoder, setUseVehicleVinDecoder] = useState(false);
  const [isDecodingVehicleVin, setIsDecodingVehicleVin] = useState(false);
  const [showSaleOcrModal, setShowSaleOcrModal] = useState(false);
  const [isSubmittingVehicle, setIsSubmittingVehicle] = useState(false);
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);
  const [vehicleConflictData, setVehicleConflictData] = useState(null);
  const [showVehicleConflictDialog, setShowVehicleConflictDialog] = useState(false);
  const [vehicleTransferReason, setVehicleTransferReason] = useState("Compraventa / Traspaso de vehículo");
  const [isTransferringVehicle, setIsTransferringVehicle] = useState(false);
  const [pendingVehicleTransfer, setPendingVehicleTransfer] = useState(
    initialData.pending_vehicle_transfer || initialData.pendingVehicleTransfer || null
  );
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [pendingCustomerId, setPendingCustomerId] = useState(null);
  const draftSnapshotRef = useRef(null);
  const customerSearchRef = useRef(null);
  const productSearchRef = useRef(null);
  const customerListRef = useRef(null);
  const productListRef = useRef(null);
  const leftPaneRef = useRef(null);
  const stepTwoSectionRef = useRef(null);
  const stepThreeSectionRef = useRef(null);
  const stepFourSectionRef = useRef(null);
  const didStepThreeAutoScrollRef = useRef(false);
  const recentlyCreatedVehicleIdRef = useRef("");
  const productTransferTimerRef = useRef(null);
  const cartFlashTimerRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const longPressHideTimerRef = useRef(null);
  const quantityHoldTimersRef = useRef(new Map());
  const clearProductSearchAfterCartUpdateRef = useRef(false);
  const [productTransferAnimation, setProductTransferAnimation] = useState(null);
  const [cartFlashActive, setCartFlashActive] = useState(false);
  const [vehiclePulseActive, setVehiclePulseActive] = useState(false);
  const [stepThreeUnlockFlash, setStepThreeUnlockFlash] = useState(false);
  const prevStepTwoCompleteRef = useRef(false);
  const [activeStockBreakdownKey, setActiveStockBreakdownKey] = useState(null);
  const [customerHighlightIndex, setCustomerHighlightIndex] = useState(0);
  const [productHighlightIndex, setProductHighlightIndex] = useState(0);
  const [priceEditorOpen, setPriceEditorOpen] = useState(false);
  const [priceEditorItemId, setPriceEditorItemId] = useState(null);
  const [priceEditorMode, setPriceEditorMode] = useState("amount");
  const [priceEditorAmount, setPriceEditorAmount] = useState("");
  const [priceEditorPercent, setPriceEditorPercent] = useState("0");
  const [salePricingContext, setSalePricingContext] = useState(null);
  const [activePriceTier, setActivePriceTier] = useState(TIER_PRECIO1);
  const [auditEvents, setAuditEvents] = useState([]);
  const [tierChangeConfirmOpen, setTierChangeConfirmOpen] = useState(false);
  const [pendingTierChange, setPendingTierChange] = useState(null);
  const [sendToCashierConfirmOpen, setSendToCashierConfirmOpen] = useState(false);
  const [pendingCashierPayload, setPendingCashierPayload] = useState(null);
  const [submittingToCashier, setSubmittingToCashier] = useState(false);
  const canEditLinePrice = useMemo(
    () => canSellerEditLinePrice(user, salePricingContext),
    [salePricingContext, user],
  );
  const effectivePricingContext = useMemo(() => {
    if (!salePricingContext) return null;
    return {
      ...salePricingContext,
      default_price_tier: activePriceTier || salePricingContext.default_price_tier,
      default_price_tier_label: TIER_LABELS[activePriceTier] || salePricingContext.default_price_tier_label,
    };
  }, [salePricingContext, activePriceTier]);
  const [precio2ApprovalId, setPrecio2ApprovalId] = useState(null);
  /** none | pending | approved | rejected — never treat pending as authorized */
  const [precio2ApprovalStatus, setPrecio2ApprovalStatus] = useState("none");
  const [precio2ApprovedSignature, setPrecio2ApprovedSignature] = useState("");
  const [commercialIncludeInstallation, setCommercialIncludeInstallation] = useState(false);
  const [commercialIncludeDelivery, setCommercialIncludeDelivery] = useState(false);
  const [requestingPrecio2Approval, setRequestingPrecio2Approval] = useState(false);
  const [tintDialogOpen, setTintDialogOpen] = useState(false);
  const [tintDialogProduct, setTintDialogProduct] = useState(null);
  const [tintDialogCartItem, setTintDialogCartItem] = useState(null);
  const priceEditorAmountRef = useRef(null);
  const priceEditorPercentRef = useRef(null);
  const [newCustomer, setNewCustomer] = useState({
    first_name: "",
    last_name: "",
    customer_type: "natural",
    tax_id: "",
    email: "",
    phone_prefix: "+505",
    phone: "",
    address: "",
    credit_limit: 0,
    add_vehicle: false,
    plate_prefix: "M",
    plate_number: "",
    brand: "",
    model: "",
    year: "",
    color: "",
    chasis: "",
    vehicle_cab_variant: "",
  });
  const [newVehicle, setNewVehicle] = useState({
    plate_prefix: "M",
    plate_number: "",
    brand: "",
    model: "",
    year: "",
    color: "",
    chasis: "",
    vehicle_cab_variant: "",
  });
  const normalizedUserRole = String(user?.role || "").toLowerCase();
  const canManageCreditLimit = ["gerencia", "recursos_humanos", "admin"].includes(normalizedUserRole);
  const isNewCustomerCompany = newCustomer.customer_type === "empresa";
  const isQuotationFlow = flowType === "quotation";
  const normalizedPaymentMethod = useMemo(() => normalizePaymentMethodCode(paymentMethod), [paymentMethod]);
  const normalizedMixedPaymentMethods = useMemo(
    () => normalizePaymentMethodList(mixedPaymentMethods),
    [mixedPaymentMethods]
  );
  const paymentOptionMeta = useMemo(() => ({
    cash: {
      label: "Efectivo",
      icon: Banknote,
      className: "text-emerald-700",
      itemClassName: "text-emerald-800 data-[highlighted]:bg-emerald-50 data-[state=checked]:bg-emerald-50",
      badgeClassName: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    transfer: {
      label: "Transferencia",
      icon: ArrowRightLeft,
      className: "text-emerald-700",
      itemClassName: "text-emerald-800 data-[highlighted]:bg-emerald-50 data-[state=checked]:bg-emerald-50",
      badgeClassName: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    card: {
      label: "Tarjeta",
      icon: CreditCard,
      className: "text-amber-700",
      itemClassName: "text-amber-800 data-[highlighted]:bg-amber-50 data-[state=checked]:bg-amber-50",
      badgeClassName: "bg-amber-50 text-amber-700 border-amber-200",
    },
    credit: {
      label: "Crédito",
      icon: BadgeAlert,
      className: "text-red-700",
      itemClassName: "text-red-800 data-[highlighted]:bg-red-50 data-[state=checked]:bg-red-50",
      badgeClassName: "bg-red-50 text-red-700 border-red-200",
    },
    mixed: {
      label: "Mixto",
      icon: ArrowRightLeft,
      className: "text-slate-700",
      itemClassName: "text-slate-800 data-[highlighted]:bg-slate-50 data-[state=checked]:bg-slate-50",
      badgeClassName: "bg-slate-50 text-slate-700 border-slate-200",
    },
  }), []);
  const discountsAllowedByPayment = paymentMethodsAllowDiscounts(normalizedPaymentMethod, normalizedMixedPaymentMethods);
  const discountsBlockedByPayment = !discountsAllowedByPayment;
  const paymentMethodSummaryLabel = useMemo(
    () => getPaymentMethodSummaryLabel(normalizedPaymentMethod, normalizedMixedPaymentMethods),
    [normalizedMixedPaymentMethods, normalizedPaymentMethod]
  );
  const paymentMethodSelectionItems = useMemo(() => ["cash", "transfer", "card", "credit"], []);
  const isCurrencyControlled = typeof currencyValue === "string" && currencyValue.length > 0;
  const isTouchDevice = typeof window !== "undefined" && navigator.maxTouchPoints > 0;
  const [isPortraitOrientation, setIsPortraitOrientation] = useState(
    typeof window !== "undefined" ? window.matchMedia("(orientation: portrait)").matches : false
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(orientation: portrait)");
    const updateOrientation = () => setIsPortraitOrientation(mediaQuery.matches);
    updateOrientation();
    mediaQuery.addEventListener("change", updateOrientation);
    return () => mediaQuery.removeEventListener("change", updateOrientation);
  }, []);

  const clearBreakdownTimers = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (longPressHideTimerRef.current) {
      clearTimeout(longPressHideTimerRef.current);
      longPressHideTimerRef.current = null;
    }
  }, []);

  const startBreakdownLongPress = useCallback((key, canShow) => {
    if (!isTouchDevice || !canShow) return;
    clearBreakdownTimers();
    longPressTimerRef.current = setTimeout(() => {
      setActiveStockBreakdownKey(key);
      longPressTimerRef.current = null;
    }, 450);
  }, [clearBreakdownTimers, isTouchDevice]);

  const endBreakdownLongPress = useCallback((key) => {
    clearBreakdownTimers();
    if (!isTouchDevice || activeStockBreakdownKey !== key) return;
    longPressHideTimerRef.current = setTimeout(() => {
      setActiveStockBreakdownKey((prev) => (prev === key ? null : prev));
      longPressHideTimerRef.current = null;
    }, 2200);
  }, [activeStockBreakdownKey, clearBreakdownTimers, isTouchDevice]);

  const clearQuantityHold = useCallback((productId) => {
    const timerSet = quantityHoldTimersRef.current.get(productId);
    if (!timerSet) return;
    if (timerSet.timeoutId) clearTimeout(timerSet.timeoutId);
    if (timerSet.intervalId) clearInterval(timerSet.intervalId);
    quantityHoldTimersRef.current.delete(productId);
  }, []);

  useEffect(() => {
    return () => {
      quantityHoldTimersRef.current.forEach((timerSet) => {
        if (timerSet.timeoutId) clearTimeout(timerSet.timeoutId);
        if (timerSet.intervalId) clearInterval(timerSet.intervalId);
      });
      quantityHoldTimersRef.current.clear();
    };
  }, []);

  function applyCurrencyChange(nextCurrency, { force = false } = {}) {
    if (sellerParamsLocked && !force) {
      notifySellerParamsLocked();
      return;
    }
    if (isCurrencyControlled && typeof onCurrencyChange === "function") {
      onCurrencyChange(nextCurrency);
    }
    setCurrency(nextCurrency);
    if (!force) {
      persistDraftSnapshot({ currency: nextCurrency });
    }
  }

  useEffect(() => {
    setLocalCustomers(customers);
  }, [customers]);

  useEffect(() => {
    setLocalVehicles((prev) => {
      if (Array.isArray(vehicles) && vehicles.length === 0 && Array.isArray(prev) && prev.length > 0) {
        return prev;
      }
      return vehicles;
    });
  }, [vehicles]);

  useEffect(() => {
    if (!isCurrencyControlled) return;
    if (!currencyValue) return;
    if (currency === currencyValue) return;
    setCurrency(currencyValue);
  }, [currency, currencyValue, isCurrencyControlled]);

  const normalizeCustomerId = useCallback((value) => {
    if (value === null || value === undefined || value === "") return "";
    return String(value);
  }, []);

  const customerVehicles = useMemo(() => {
    if (!selectedCustomer) return [];
    const selectedCustomerId = normalizeCustomerId(selectedCustomer.customer_id);
    const list = Array.isArray(localVehicles) ? localVehicles : [];
    return list.filter((v) => normalizeCustomerId(v?.customer_id) === selectedCustomerId);
  }, [localVehicles, normalizeCustomerId, selectedCustomer]);

  const normalizeVehicleId = useCallback((value) => {
    if (value === null || value === undefined || value === "") return "";
    return String(value);
  }, []);

  const customerVehicleCountById = useMemo(() => {
    const counts = {};
    const list = Array.isArray(localVehicles) ? localVehicles : [];
    list.forEach((vehicle) => {
      if (!vehicle?.customer_id) return;
      counts[vehicle.customer_id] = (counts[vehicle.customer_id] || 0) + 1;
    });
    return counts;
  }, [localVehicles]);

  const hasSelectedVehicle = Boolean(selectedVehicle);
  const selectedVehicleOption = useMemo(() => {
    if (vehicleFlowOption === "new") return "new";
    if (vehicleFlowOption === "carryout") return "carryout";
    if (selectedVehicle) return `vehicle:${selectedVehicle}`;
    return "carryout";
  }, [vehicleFlowOption, selectedVehicle]);

  const selectedVehicleData = useMemo(() => {
    const normalizedSelectedVehicle = normalizeVehicleId(selectedVehicle);
    if (!normalizedSelectedVehicle) return null;
    return customerVehicles.find((v) => normalizeVehicleId(v.vehicle_id ?? v.id) === normalizedSelectedVehicle) || null;
  }, [customerVehicles, normalizeVehicleId, selectedVehicle]);

  const stepOneComplete = Boolean(selectedCustomer?.customer_id);
  /** Valid fulfillment choice that can unlock products */
  const hasValidFulfillmentSelection = useMemo(() => {
    if (!logisticMode) return false;
    if (logisticMode === "installed") {
      return Boolean(selectedVehicleData);
    }
    return logisticMode === "carryout" || logisticMode === "delivery";
  }, [logisticMode, selectedVehicleData]);

  /**
   * Show the 3 delivery mode buttons when:
   * - user reopened the step, or
   * - there is no valid selection yet (avoids empty "Paso 2" after draft restore)
   */
  const showFulfillmentChooser = Boolean(
    stepOneComplete
    && selectedCustomer
    && (isVehiclePickerVisible || !hasValidFulfillmentSelection),
  );

  const stepTwoComplete = useMemo(() => {
    if (!stepOneComplete || !hasValidFulfillmentSelection) return false;
    // Chooser open means user is still deciding delivery mode
    if (showFulfillmentChooser) return false;
    return true;
  }, [stepOneComplete, hasValidFulfillmentSelection, showFulfillmentChooser]);

  const triggerVehiclePulse = useCallback(() => {
    setVehiclePulseActive(true);
    window.setTimeout(() => setVehiclePulseActive(false), 2000);
  }, []);

  const applyNewlyCreatedVehicleSelection = useCallback((vehicleId, vehicleRecord = null) => {
    const normalizedId = normalizeVehicleId(vehicleId);
    if (!normalizedId) return;
    recentlyCreatedVehicleIdRef.current = normalizedId;
    setLogisticMode("installed");
    setVehicleFlowOption("registered");
    setSelectedVehicle(normalizedId);
    setIsVehiclePickerVisible(false);
    if (vehicleRecord && typeof vehicleRecord === "object") {
      setLocalVehicles((prev) => {
        const exists = prev.some((v) => normalizeVehicleId(v.vehicle_id ?? v.id) === normalizedId);
        if (exists) return prev;
        return [...prev, vehicleRecord];
      });
    }
    triggerVehiclePulse();
  }, [normalizeVehicleId, triggerVehiclePulse]);

  const isCompanyCustomer = useCallback((customer) => {
    const type = String(customer?.customer_type || "").toLowerCase();
    return type === "empresa" || type === "company" || type === "juridica" || type === "juridico";
  }, []);

  const isCompanyCustomerFlow = Boolean(selectedCustomer) && isCompanyCustomer(selectedCustomer);

  const newCustomerTone = isNewCustomerCompany
    ? {
      modal: "border-blue-400 bg-blue-100/80 dark:border-blue-500/40 dark:bg-blue-500/15",
      tabsList: "bg-blue-100/90 dark:bg-blue-500/20",
      panel: "border border-blue-200 bg-blue-50/85 dark:border-blue-500/30 dark:bg-blue-500/10 rounded-md p-3",
    }
    : {
      modal: "border-emerald-400 bg-emerald-100/80 dark:border-emerald-500/40 dark:bg-emerald-500/15",
      tabsList: "bg-emerald-100/90 dark:bg-emerald-500/20",
      panel: "border border-emerald-200 bg-emerald-50/85 dark:border-emerald-500/30 dark:bg-emerald-500/10 rounded-md p-3",
    };

  const vehicleOptionTriggerTone = useMemo(() => {
    if (logisticMode === "delivery") {
      return "border-amber-300 bg-amber-50 text-amber-900";
    }
    if (logisticMode === "carryout" || selectedVehicleOption === "carryout") {
      return "border-emerald-300 bg-emerald-50 text-emerald-900";
    }
    if (selectedVehicleOption === "new") {
      return "border-violet-300 bg-violet-50 text-violet-900";
    }
    if (selectedVehicleOption.startsWith("vehicle:")) {
      return "border-sky-300 bg-sky-50 text-sky-900";
    }
    return "";
  }, [logisticMode, selectedVehicleOption]);

  const newCustomerYearOptions = useMemo(
    () => getVehicleYearsByBrand(newCustomer.brand),
    [newCustomer.brand]
  );
  const newCustomerModelOptions = useMemo(
    () => getVehicleSelectOptionsByBrandYear(newCustomer.brand, newCustomer.year),
    [newCustomer.brand, newCustomer.year]
  );

  const newVehicleYearOptions = useMemo(
    () => getVehicleYearsByBrand(newVehicle.brand),
    [newVehicle.brand]
  );

  const newVehicleModelOptions = useMemo(
    () => getVehicleSelectOptionsByBrandYear(newVehicle.brand, newVehicle.year),
    [newVehicle.brand, newVehicle.year]
  );
  const showNewVehicleCabVariant = useMemo(
    () => isPickupCatalogModel(newVehicle.brand, newVehicle.model),
    [newVehicle.brand, newVehicle.model]
  );

  useEffect(() => {
    if (!draftLoaded) return;
    if (pendingCustomerId && !selectedCustomer) {
      return;
    }
    const normalizedSelectedVehicle = normalizeVehicleId(selectedVehicle);
    const hasRestorableVehicle = Boolean(normalizedSelectedVehicle);
    const pendingCreatedVehicle = normalizeVehicleId(recentlyCreatedVehicleIdRef.current);

    if (
      pendingCreatedVehicle
      && normalizedSelectedVehicle === pendingCreatedVehicle
    ) {
      if (vehicleFlowOption !== "registered") {
        setVehicleFlowOption("registered");
      }
      if (isVehiclePickerVisible) {
        setIsVehiclePickerVisible(false);
      }
      if (customerVehicles.some((v) => normalizeVehicleId(v.vehicle_id ?? v.id) === pendingCreatedVehicle)) {
        recentlyCreatedVehicleIdRef.current = "";
      }
      return;
    }

    if (hasRestorableVehicle && localVehicles.length === 0) {
      return;
    }

    if (!selectedCustomer) {
      if (logisticMode !== null) setLogisticMode(null);
      if (vehicleFlowOption !== "carryout" || selectedVehicle) {
        setVehicleFlowOption("carryout");
        setSelectedVehicle("");
      }
      return;
    }
    if (logisticMode === "installed") {
      if (normalizedSelectedVehicle && customerVehicles.some((v) => normalizeVehicleId(v.vehicle_id ?? v.id) === normalizedSelectedVehicle)) {
        if (vehicleFlowOption !== "registered") {
          setVehicleFlowOption("registered");
        }
      }
      return;
    }
    if (logisticMode === "carryout" || logisticMode === "delivery") {
      if (vehicleFlowOption !== "carryout" || selectedVehicle) {
        setVehicleFlowOption("carryout");
        setSelectedVehicle("");
      }
    }
  }, [draftLoaded, pendingCustomerId, selectedCustomer, customerVehicles, logisticMode, localVehicles.length, normalizeVehicleId, selectedVehicle, vehicleFlowOption]);

  useEffect(() => {
    if (logisticMode === "carryout" || logisticMode === "delivery") {
      setSelectedVehicle("");
      setCartItems((prev) => prev.map((item) => ({ ...item, with_installation: false })));
    }
  }, [logisticMode]);

  const fetchMessengerOptions = useCallback(async ({ showErrorToast = false, isActive = () => true } = {}) => {
    if (!user?.branch_id) return;
    if (isActive()) setMessengerLoading(true);
    try {
      const response = await axios.get(`${API}/hr/messengers/status`, { withCredentials: true });
      const branches = response.data?.branches || [];
      const branchRow = branches.find((row) => String(row.branch_id) === String(user.branch_id));
      const messengers = branchRow?.messengers || [];
      if (!isActive()) return;
      setMessengerOptions(messengers);
      setMessengerLoadFailed(false);
      const preferred = messengers.find((row) => row.status === "disponible") || messengers[0];
      if (preferred?.messenger_id) {
        setSelectedMessengerId((current) => current || preferred.messenger_id);
      }
    } catch (error) {
      if (!isActive()) return;
      setMessengerLoadFailed(true);
      setMessengerOptions([]);
      if (showErrorToast) {
        toast.error("No se pudo cargar mensajeros de la sucursal");
      } else {
        console.warn(
          "[SaleForm] Precarga de mensajeros omitida:",
          error?.response?.status || error?.message || error,
        );
      }
    } finally {
      if (isActive()) setMessengerLoading(false);
    }
  }, [user?.branch_id]);

  useEffect(() => {
    if (!user?.branch_id) return undefined;
    let active = true;
    void fetchMessengerOptions({ showErrorToast: false, isActive: () => active });
    return () => {
      active = false;
    };
  }, [user?.branch_id, fetchMessengerOptions]);

  useEffect(() => {
    if (logisticMode !== "delivery") {
      deliveryMessengerRetryRef.current = false;
      return;
    }
    if (!user?.branch_id || !messengerLoadFailed || messengerLoading) return;
    if (deliveryMessengerRetryRef.current) return;
    deliveryMessengerRetryRef.current = true;
    void fetchMessengerOptions({ showErrorToast: true });
  }, [logisticMode, messengerLoadFailed, messengerLoading, fetchMessengerOptions, user?.branch_id]);


  useEffect(() => {
    if (!draftLoaded) return;
    if (pendingCustomerId) return;
    if (isCompanyCustomerFlow) return;
    if (applyRetention) {
      setApplyRetention(false);
    }
  }, [draftLoaded, pendingCustomerId, isCompanyCustomerFlow, applyRetention]);

  useEffect(() => {
    if (!draftKey || typeof window === "undefined") {
      setDraftLoaded(true);
      return;
    }
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) {
        setDraftLoaded(true);
        return;
      }
      const draft = JSON.parse(raw);
      if (draft?.selectedCustomerId) {
        setPendingCustomerId(draft.selectedCustomerId);
      }
      setSelectedVehicle(normalizeVehicleId(draft?.selectedVehicle));
      if (draft?.selectedVehicleData && typeof draft.selectedVehicleData === "object") {
        const restoredVehicleId = normalizeVehicleId(draft.selectedVehicleData.vehicle_id ?? draft.selectedVehicleData.id);
        if (restoredVehicleId) {
          setLocalVehicles((prev) => {
            const exists = prev.some((v) => normalizeVehicleId(v.vehicle_id ?? v.id) === restoredVehicleId);
            if (exists) return prev;
            return [...prev, draft.selectedVehicleData];
          });
        }
      }
      setSelectedWarehouse(draft?.selectedWarehouse || "");
      setCartItems(draft?.cartItems || []);
      setActivePriceTier(draft?.activePriceTier || draft?.active_price_tier || TIER_PRECIO1);
      setAuditEvents(Array.isArray(draft?.auditEvents) ? draft.auditEvents : []);
      setPaymentMethod(draft?.paymentMethod || draft?.payment_type || "cash");
      setMixedPaymentMethods(normalizePaymentMethodList(draft?.mixedPaymentMethods || draft?.mixed_payment_methods || []));
      const restoredGlobalDiscountMode = normalizeGlobalDiscountMode(draft?.globalDiscountMode || draft?.global_discount_mode);
      setGlobalDiscountMode(restoredGlobalDiscountMode);
      const restoredGlobalDiscount = clampGlobalDiscountValue(draft?.globalDiscount || 0, restoredGlobalDiscountMode);
      setGlobalDiscount(restoredGlobalDiscount);
      setGlobalDiscountDraft(String(restoredGlobalDiscount));
      const restoredPlanLines = (draft?.paymentPlanLines || draft?.planned_payment_plan?.lines || []).map((line) => ({
        metodo: line.metodo || draft?.paymentMethod || "cash",
        moneda: line.moneda || draft?.currency || "NIO",
        monto_origen: line.monto_origen ?? "",
      }));
      if (restoredPlanLines.length) {
        setPaymentPlanLines(restoredPlanLines);
      }
      setNotes(draft?.notes || "");
      const restoredCustomer = customers.find(
        (c) => String(c.customer_id ?? "") === String(draft?.selectedCustomerId ?? ""),
      );
      setApplyIVA(draft?.applyIVA ?? false);
      setApplyRetention(draft?.applyRetention ?? false);
      setRetentionRate(draft?.retentionRate ?? 2);
      setIvaRate(defaultIvaRate);
      applyCurrencyChange(draft?.currency || "NIO", { force: true });
      setCustomerSearch(draft?.customerSearch || "");
      setProductSearch(draft?.productSearch || "");
      setAppliedDiscounts(draft?.appliedDiscounts || []);
      setVehicleFlowOption(
        draft?.vehicleFlowOption || (draft?.selectedVehicle ? "registered" : "carryout"),
      );
      // Do not invent "carryout" when draft never chose delivery mode — keep null so Paso 2 chooser shows
      setLogisticMode(
        draft?.logisticMode
        || (draft?.delivery_info?.is_delivery ? "delivery" : (draft?.selectedVehicle ? "installed" : null)),
      );
      setDeliveryDestinationType(draft?.deliveryDestinationType || draft?.delivery_info?.destination_type || "domicilio");
      setDeliveryCost(
        draft?.deliveryCost != null
          ? String(draft.deliveryCost)
          : String(draft?.delivery_info?.delivery_cost || ""),
      );
      setSelectedMessengerId(draft?.selectedMessengerId || draft?.delivery_info?.messenger_id || "");
      // Restore fulfillment UI visibility carefully — never leave Paso 2 blank
      const restoredLogistic =
        draft?.logisticMode
        || (draft?.delivery_info?.is_delivery ? "delivery" : (draft?.selectedVehicle ? "installed" : null));
      if (typeof draft?.isVehiclePickerVisible === "boolean") {
        // If draft claims picker is closed but has no valid mode, force open
        const modeOk = restoredLogistic === "carryout"
          || restoredLogistic === "delivery"
          || (restoredLogistic === "installed" && Boolean(draft?.selectedVehicle));
        setIsVehiclePickerVisible(draft.isVehiclePickerVisible || !modeOk);
      } else if (restoredLogistic === "carryout" || restoredLogistic === "delivery" || (restoredLogistic === "installed" && draft?.selectedVehicle)) {
        setIsVehiclePickerVisible(false);
      } else {
        setIsVehiclePickerVisible(true);
      }
      setShowNewCustomer(Boolean(draft?.showNewCustomer));
      setShowNewVehicleDialog(Boolean(draft?.showNewVehicleDialog));
      setNewCustomerTab(draft?.newCustomerTab || "customer");
      setUseVinDecoder(Boolean(draft?.useVinDecoder));
      setUseVehicleVinDecoder(Boolean(draft?.useVehicleVinDecoder));
      setNewCustomer((prev) => ({ ...prev, ...(draft?.newCustomer || {}) }));
      setNewVehicle((prev) => ({ ...prev, ...(draft?.newVehicle || {}) }));
      setPendingVehicleTransfer(draft?.pending_vehicle_transfer || draft?.pendingVehicleTransfer || null);
      draftSnapshotRef.current = draft;
    } catch (error) {
      console.warn("No se pudo cargar borrador:", error);
    } finally {
      setDraftLoaded(true);
    }
  }, [defaultIvaRate, draftKey, normalizeVehicleId]);

  useEffect(() => {
    if (!pendingCustomerId || localCustomers.length === 0) return;
    const pendingId = normalizeCustomerId(pendingCustomerId);
    const found = localCustomers.find((c) => normalizeCustomerId(c.customer_id) === pendingId);
    if (found) {
      setSelectedCustomer(found);
      setPendingCustomerId(null);
    }
  }, [pendingCustomerId, localCustomers, normalizeCustomerId]);

  const normalizedCartItems = useMemo(() => (
    (cartItems || []).map(i => ({
      ...i,
      quantity: i.quantity || 1,
      discount: i.discount || 0,
      installation_type: i.installation_type || "optional",
      installation_price: i.installation_price || 0,
      with_installation: i.with_installation || false,
      original_unit_price: (() => {
        const raw = Number(i.original_unit_price);
        if (Number.isFinite(raw) && raw > 0) return raw;
        return Number(i.unit_price || 0);
      })(),
      price_edit_history: (Array.isArray(i.price_edit_history)
        ? i.price_edit_history
        : (Number.isFinite(Number(i.previous_unit_price)) ? [Number(i.previous_unit_price)] : [])
      )
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
        .slice(0, 2),
      price_edit_count: (() => {
        const raw = Number(i.price_edit_count);
        if (Number.isFinite(raw) && raw >= 0) return Math.floor(raw);
        const legacy = Number.isFinite(Number(i.previous_unit_price)) ? 1 : 0;
        return legacy;
      })(),
    }))
  ), [cartItems]);

  const pushCartHistory = useCallback((snapshot, label) => {
    cartHistory.current = [{ snapshot, label }, ...cartHistory.current].slice(0, 20);
  }, []);

  const clearProductTransferAnimation = useCallback(() => {
    if (productTransferTimerRef.current) {
      clearTimeout(productTransferTimerRef.current);
      productTransferTimerRef.current = null;
    }
    setProductTransferAnimation(null);
  }, []);

  const flashCartLanding = useCallback(() => {
    if (cartFlashTimerRef.current) {
      clearTimeout(cartFlashTimerRef.current);
    }
    setCartFlashActive(true);
    cartFlashTimerRef.current = window.setTimeout(() => {
      setCartFlashActive(false);
    }, 650);
  }, []);

  const clearProductSearch = useCallback(() => {
    flushSync(() => {
      setProductSearch("");
      setProductHighlightIndex(0);
    });
    const input = productSearchRef.current;
    if (input) {
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
    }
  }, []);

  const triggerProductTransferAnimation = useCallback((product, sourceElement) => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(min-width: 1024px)").matches) return;
    if (!sourceElement?.getBoundingClientRect) return;

    const sourceRect = sourceElement.getBoundingClientRect();
    const targetRect = stepFourSectionRef.current?.getBoundingClientRect();
    if (!targetRect) return;

    const animationId = `${product.product_id}-${Date.now()}`;
    const destinationLeft = Math.max(16, targetRect.left + 16);
    const destinationTop = Math.max(16, targetRect.top + 12);
    const cardWidth = Math.min(Math.max(sourceRect.width, 180), 360);
    const cardHeight = Math.min(Math.max(sourceRect.height, 96), 140);

    clearProductTransferAnimation();
    setProductTransferAnimation({
      id: animationId,
      title: product.name,
      sku: product.sku || "",
      startLeft: sourceRect.left,
      startTop: sourceRect.top,
      startWidth: cardWidth,
      startHeight: cardHeight,
      endLeft: destinationLeft,
      endTop: destinationTop,
      endWidth: Math.min(targetRect.width - 24, Math.max(cardWidth - 16, 160)),
      endHeight: Math.min(110, cardHeight - 10),
    });

    window.requestAnimationFrame(() => {
      setProductTransferAnimation((current) => (current && current.id === animationId ? { ...current, active: true } : current));
    });

    productTransferTimerRef.current = window.setTimeout(() => {
      setProductTransferAnimation((current) => (current && current.id === animationId ? null : current));
      productTransferTimerRef.current = null;
    }, 850);
  }, [clearProductTransferAnimation]);

  const addToCart = (product, options = {}) => {
    const { sourceElement = null } = options;
    const localStock = getLocalStoreStockValue(product);
    if (localStock <= 0) {
      toast.error("Sin existencias en tu tienda", {
        description: `"${product.name}" no tiene existencias disponibles en tu tienda y no puede ser agregado al carrito.`,
        duration: 4000,
      });
      return;
    }
    const existing = normalizedCartItems.find(item => item.product_id === product.product_id);
    if (existing && !isSupervisorUser) {
      const lineLock = getSellerCartLineLockState(existing.product_id, draftReview);
      if (lineLock.locked) {
        toast.error("No puedes modificar líneas revisadas por supervisión");
        return;
      }
    }
    const currentQty = existing ? Math.max(1, Math.floor(Number(existing.quantity) || 1)) : 0;
    if (currentQty >= localStock) {
      toast.warning("Límite de existencias alcanzado", {
        description: `Ya tienes ${currentQty} unidad${currentQty !== 1 ? "es" : ""} de "${product.name}" en el carrito, que es el máximo disponible en tu tienda.`,
        duration: 4000,
      });
      return;
    }

    const isTintProduct =
      String(product.product_id || "").toUpperCase().startsWith("POL-")
      || String(product.sku || "").toUpperCase().startsWith("POL-")
      || String(product.category || "").toLowerCase().includes("polariz")
      || String(product.name || "").toLowerCase().includes("polarizado");

    if (isTintProduct && hasSelectedVehicle && !existing && !options.skipTintDialog) {
      setTintDialogProduct(product);
      setTintDialogCartItem(null);
      setTintDialogOpen(true);
      return;
    }

    const label = existing
      ? `Se redujo la cantidad de "${product.name}"`
      : `Se quitó "${product.name}" del carrito`;
    pushCartHistory([...normalizedCartItems], label);
    const installationType = product.installation_type || "optional";
    const installationPrice = product.installation_price || 0;
    const withInstallation = installationType === "required";
    let nextCartItems;
    if (existing) {
      nextCartItems = normalizedCartItems.map(item => item.product_id === product.product_id ? { ...item, quantity: item.quantity + 1 } : item);
    } else {
      nextCartItems = [
        ...normalizedCartItems,
        {
          product_id: product.product_id,
          product_name: product.name,
          sku: product.sku || "",
          image: product.images?.[0] || null,
          quantity: 1,
          unit_price: resolveDefaultUnitPrice(product, effectivePricingContext),
          original_unit_price: resolveProductTierPrice(product, TIER_PRECIO1),
          price_tier: activePriceTier,
          price_tier_label: TIER_LABELS[activePriceTier] || activePriceTier,
          price_edit_history: [],
          price_edit_count: 0,
          discount: 0,
          installation_type: installationType,
          installation_price: installationPrice,
          with_installation: hasSelectedVehicle ? withInstallation : false,
          ...(sellerReleasedRestricted ? { added_after_release: true } : {}),
        },
      ];
    }
        clearProductSearchAfterCartUpdateRef.current = true;
        flashCartLanding();
        triggerProductTransferAnimation(product, sourceElement);
    setCartItems(nextCartItems);
    persistDraftSnapshot({ cartItems: nextCartItems, productSearch: "" });
    playCartPickupSound();
  };

  const requestSampleForItem = async (item) => {
    if (!selectedCustomer || !selectedCustomer.customer_id) {
      toast.error("Selecciona un cliente antes de solicitar la muestra");
      return;
    }

    const warehouseId = selectedWarehouse || item.warehouse_id || warehouses?.[0]?.warehouse_id;
    if (!warehouseId) {
      toast.error("Selecciona una bodega para solicitar la muestra");
      return;
    }

    try {
      await axios.post(
        `${API}/samples/request`,
        {
          customer_id: selectedCustomer.customer_id,
          product_id: item.product_id,
          warehouse_id: warehouseId,
          quantity: 1,
        },
        { withCredentials: true }
      );
      toast.success("Muestra solicitada a bodega");
      updateCartItem(item.product_id, "sample_status", "requested", { persist: true });
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo solicitar la muestra");
    }
  };

  const applyDiscountCode = () => {
    if (sellerParamsLocked) {
      toast.error("No puedes aplicar códigos de descuento en un borrador liberado con cambios de supervisión");
      return;
    }
    if (discountsBlockedByPayment) {
      toast.error("Con este método de pago no aplican descuentos ni promociones");
      return;
    }
    const normalizedCode = String(discountCode || "").trim().toUpperCase();
    if (!normalizedCode) {
      toast.error("Ingresa un código de descuento");
      return;
    }
    const codes = {
      "DESC10": { type: "percent", value: 10, name: "10% de descuento" },
      "DESC20": { type: "percent", value: 20, name: "20% de descuento" },
      "FIJO100": { type: "fixed", value: 100, name: "C$100 de descuento" },
    };
    const code = codes[normalizedCode];
    if (!code) {
      toast.error("Codigo de descuento no valido");
      return;
    }
    if (appliedDiscounts.find(d => d.code === normalizedCode)) {
      toast.error("Ese codigo ya fue aplicado");
      return;
    }
    const nextAppliedDiscounts = [...appliedDiscounts, { ...code, code: normalizedCode }];
    setAppliedDiscounts(nextAppliedDiscounts);
    setDiscountCode("");
    persistDraftSnapshot({ appliedDiscounts: nextAppliedDiscounts, discountCode: "" });
    toast.success(`Codigo ${normalizedCode} aplicado`);
  };

  const removeDiscountCode = (code) => {
    if (sellerParamsLocked) {
      notifySellerParamsLocked();
      return;
    }
    const nextAppliedDiscounts = (Array.isArray(appliedDiscounts) ? appliedDiscounts : []).filter(d => d?.code !== code);
    setAppliedDiscounts(nextAppliedDiscounts);
    persistDraftSnapshot({ appliedDiscounts: nextAppliedDiscounts });
  };

  const resetNewCustomerForm = () => {
    setNewCustomer({
      first_name: "",
      last_name: "",
      customer_type: "natural",
      tax_id: "",
      email: "",
      phone_prefix: "+505",
      phone: "",
      address: "",
      credit_limit: 0,
      add_vehicle: false,
      plate_prefix: "M",
      plate_number: "",
      brand: "",
      model: "",
      year: "",
      color: "",
      chasis: "",
      vehicle_cab_variant: "",
    });
    setNewCustomerTab("customer");
    setUseVinDecoder(false);
    setIsDecodingVin(false);
  };

  const resetNewVehicleForm = () => {
    setNewVehicle({
      plate_prefix: "M",
      plate_number: "",
      brand: "",
      model: "",
      year: "",
      color: "",
      chasis: "",
      vehicle_cab_variant: "",
    });
    setUseVehicleVinDecoder(false);
    setIsDecodingVehicleVin(false);
  };

  const handleApplySaleOcr = (ocrVehicle) => {
    if (!ocrVehicle) return;
    const nextVehicle = { ...newVehicle };
    if (ocrVehicle.vin || ocrVehicle.chasis) {
      nextVehicle.chasis = formatChasis(ocrVehicle.vin || ocrVehicle.chasis);
    }

    const normalizedBrand = normalizeVehicleBrand(ocrVehicle.brand);
    const targetBrand = normalizedBrand || ocrVehicle.brand || nextVehicle.brand;
    if (targetBrand) nextVehicle.brand = targetBrand;

    const targetYear = ocrVehicle.year ? String(ocrVehicle.year) : nextVehicle.year;
    if (targetYear) nextVehicle.year = targetYear;

    if (ocrVehicle.model) {
      const resolvedEntry = findCatalogEntryForVehicle(targetBrand, targetYear, ocrVehicle.model);
      if (resolvedEntry?.label) {
        nextVehicle.model = resolvedEntry.label;
      } else {
        nextVehicle.model = ocrVehicle.model;
      }
    }

    if (ocrVehicle.color && ocrVehicle.color !== "No especificado") nextVehicle.color = ocrVehicle.color;
    if (ocrVehicle.vehicle_type) nextVehicle.vehicle_type = ocrVehicle.vehicle_type;
    if (ocrVehicle.vehicle_type_slug) nextVehicle.vehicle_type_slug = ocrVehicle.vehicle_type_slug;
    if (ocrVehicle.version_level) nextVehicle.version_level = ocrVehicle.version_level;
    if (ocrVehicle.trim) nextVehicle.trim = ocrVehicle.trim;

    // Auto-detect pickup cab variant
    if (isPickupCatalogModel(nextVehicle.brand, nextVehicle.model)) {
      const trimText = `${ocrVehicle.trim || ""} ${ocrVehicle.vehicle_type || ""}`.toLowerCase();
      if (trimText.includes("doble") || trimText.includes("d/cabina") || trimText.includes("double")) {
        nextVehicle.vehicle_cab_variant = "camioneta-cabina-y-media";
      } else if (trimText.includes("simple") || trimText.includes("s/cabina") || trimText.includes("single")) {
        nextVehicle.vehicle_cab_variant = "camioneta-1-cabina";
      } else {
        nextVehicle.vehicle_cab_variant = "camioneta-cabina-y-media";
      }
    }

    if (ocrVehicle.plate) {
      const cleanPlate = ocrVehicle.plate.trim().toUpperCase();
      const match = cleanPlate.match(/^([A-Z]{1,4})[\s\-_]*(.*)$/);
      if (match) {
        const rawPrefix = match[1];
        const rawDigits = match[2].replace(/[^0-9]/g, "");
        const matchedPrefix = PLATE_PREFIXES.find((p) => p.toUpperCase() === rawPrefix) || "M";
        nextVehicle.plate_prefix = matchedPrefix;
        nextVehicle.plate_number = rawDigits ? formatPlateNumber(matchedPrefix, rawDigits) : "";
      } else {
        nextVehicle.plate_number = cleanPlate;
      }
    }

    setNewVehicle(nextVehicle);
    persistDraftSnapshot({ newVehicle: nextVehicle });
    setShowSaleOcrModal(false);
    toast.success("¡Datos de circulación aplicados con éxito!");
  };

  const decodeNewCustomerVin = async () => {
    const vin = formatChasis(newCustomer.chasis || "");
    if (vin.length !== 17) {
      toast.error("Ingresa un VIN válido de 17 caracteres");
      return;
    }
    try {
      setIsDecodingVin(true);
      const response = await axios.get(`${API}/vehicles/decode-vin`, {
        params: { vin },
        withCredentials: true,
      });
      const decoded = response.data || {};
      setNewCustomer((prev) => ({
        ...prev,
        chasis: formatChasis(decoded?.vin || prev.chasis),
        brand: decoded?.brand || prev.brand,
        model: decoded?.model || prev.model,
        year: decoded?.year ? String(decoded.year) : prev.year,
        vehicle_cab_variant: decoded?.vehicle_cab_variant || prev.vehicle_cab_variant,
      }));
      toast.success("VIN decodificado");
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo decodificar el VIN");
    } finally {
      setIsDecodingVin(false);
    }
  };

  const createNewCustomer = async () => {
    if (!newCustomer.phone) {
      toast.error("El teléfono es requerido");
      return;
    }

    if (isNewCustomerCompany) {
      if (!String(newCustomer.first_name || "").trim()) {
        toast.error("El nombre de la empresa es requerido");
        return;
      }
      if (!String(newCustomer.tax_id || "").trim()) {
        toast.error("El RUC es requerido para registrar una empresa");
        return;
      }
    } else if (!newCustomer.first_name) {
      toast.error("Nombre y teléfono son requeridos");
      return;
    }

    try {
      const fullPhone = `${newCustomer.phone_prefix}-${newCustomer.phone}`;
      const companyName = String(newCustomer.first_name || "").trim();
      const customerData = {
        name: isNewCustomerCompany
          ? companyName
          : `${newCustomer.first_name} ${newCustomer.last_name}`.trim(),
        first_name: isNewCustomerCompany ? companyName : newCustomer.first_name,
        last_name: isNewCustomerCompany ? "" : newCustomer.last_name,
        customer_type: newCustomer.customer_type,
        tax_id: newCustomer.tax_id,
        email: newCustomer.email || null,
        phone: fullPhone,
        address: newCustomer.address || null,
        credit_limit: parseFloat(newCustomer.credit_limit) || 0,
      };

      if (isSubmittingCustomer) return;
      setIsSubmittingCustomer(true);

      const response = await axios.post(`${API}/customers`, customerData, { withCredentials: true });
      const customerId = response.data.customer_id;
      toast.success("Cliente creado exitosamente");
      playCreationSuccessSound();

      let createdVehicleId = null;
      if (newCustomer.add_vehicle && newCustomer.brand && newCustomer.model) {
        if (!newCustomer.year) {
          toast.error("Selecciona el año del vehículo");
          setIsSubmittingCustomer(false);
          return;
        }
        if (!isValidVehicleSelection(newCustomer.brand, newCustomer.year, newCustomer.model)) {
          toast.error("Marca, año y modelo deben seleccionarse desde la lista");
          setIsSubmittingCustomer(false);
          return;
        }
        if (isPickupCatalogModel(newCustomer.brand, newCustomer.model) && !newCustomer.vehicle_cab_variant) {
          toast.error("Selecciona el tipo de cabina para esta camioneta");
          setIsSubmittingCustomer(false);
          return;
        }
        const plateFormatted = newCustomer.plate_prefix === "M"
          ? `M ${newCustomer.plate_number}`
          : `${newCustomer.plate_prefix} ${newCustomer.plate_number}`;

        const vehicleData = {
          customer_id: customerId,
          plate: plateFormatted,
          brand: newCustomer.brand,
          model: newCustomer.model,
          year: parseInt(newCustomer.year, 10) || new Date().getFullYear(),
          color: newCustomer.color || null,
          vin: newCustomer.chasis || null,
          ...(getCatalogVehiclePayload(newCustomer.brand, newCustomer.model, {
            vehicleCabVariant: newCustomer.vehicle_cab_variant,
          }) || {}),
        };

        try {
          const vehicleResponse = await axios.post(`${API}/vehicles`, vehicleData, { withCredentials: true });
          createdVehicleId = vehicleResponse?.data?.vehicle_id;
          toast.success("Vehículo registrado");
          playCreationSuccessSound();

          if (createdVehicleId) {
            applyNewlyCreatedVehicleSelection(createdVehicleId, vehicleResponse?.data);
          }

          const vehiclesRes = await axios.get(`${API}/vehicles`, { withCredentials: true });
          setLocalVehicles(vehiclesRes.data);
        } catch (vehErr) {
          const vDetail = vehErr.response?.data?.detail;
          if (vehErr.response?.status === 409 && vDetail?.code === "VEHICLE_OWNED_BY_ANOTHER") {
            setVehicleConflictData(vDetail);
            setShowVehicleConflictDialog(true);
            toast.warning("El vehículo ingresado pertenece a otro cliente/empresa. Revisa el traspaso de propietario.");
          } else {
            const vMsg = typeof vDetail === "string" ? vDetail : (vDetail?.message || "No se pudo registrar el vehículo");
            toast.error(vMsg);
          }
        }
      }

      const customersRes = await axios.get(`${API}/customers`, { withCredentials: true });
      setLocalCustomers(customersRes.data);
      const created = customersRes.data.find(c => c.customer_id === customerId);
      if (created) {
        setSelectedCustomer(created);
        if (createdVehicleId) {
          setLogisticMode("installed");
        } else {
          setLogisticMode(null);
          setIsVehiclePickerVisible(true);
        }
      }

      resetNewCustomerForm();
      setShowNewCustomer(false);
      if (typeof onDataRefresh === "function") {
        onDataRefresh();
      }
      persistDraftSnapshot({
        selectedCustomerId: customerId,
        vehicleFlowOption: createdVehicleId ? "registered" : "carryout",
        logisticMode: createdVehicleId ? "installed" : null,
        selectedVehicle: createdVehicleId ? normalizeVehicleId(createdVehicleId) : "",
        isVehiclePickerVisible: createdVehicleId ? false : true,
        showNewCustomer: false,
        newCustomerTab: "customer",
        newCustomer: {
          first_name: "",
          last_name: "",
          customer_type: "natural",
          tax_id: "",
          email: "",
          phone_prefix: "+505",
          phone: "",
          address: "",
          credit_limit: 0,
          add_vehicle: false,
          plate_prefix: "M",
          plate_number: "",
          brand: "",
          model: "",
          year: "",
          color: "",
          chasis: "",
        },
        useVinDecoder: false,
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al crear cliente");
    } finally {
      setIsSubmittingCustomer(false);
    }
  };

  const decodeCustomerVehicleVin = async () => {
    const vin = formatChasis(newVehicle.chasis || "");
    if (vin.length !== 17) {
      toast.error("Ingresa un VIN válido de 17 caracteres");
      return;
    }
    try {
      setIsDecodingVehicleVin(true);
      const response = await axios.get(`${API}/vehicles/decode-vin`, {
        params: { vin },
        withCredentials: true,
      });
      const decoded = response.data || {};
      setNewVehicle((prev) => ({
        ...prev,
        chasis: formatChasis(decoded?.vin || prev.chasis),
        brand: decoded?.brand || prev.brand,
        model: decoded?.model || prev.model,
        year: decoded?.year ? String(decoded.year) : prev.year,
        vehicle_cab_variant: decoded?.vehicle_cab_variant || prev.vehicle_cab_variant,
      }));
      toast.success("VIN decodificado");
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo decodificar el VIN");
    } finally {
      setIsDecodingVehicleVin(false);
    }
  };

  const createVehicleForSelectedCustomer = async () => {
    if (isSubmittingVehicle) return;
    if (!selectedCustomer?.customer_id) {
      toast.error("Selecciona un cliente antes de registrar vehículo");
      return;
    }
    if (!newVehicle.brand || !newVehicle.model || !newVehicle.year) {
      toast.error("Marca, año y modelo son requeridos");
      return;
    }
    if (!newVehicle.plate_number) {
      toast.error("La placa es requerida");
      return;
    }
    if (!isValidVehicleSelection(newVehicle.brand, newVehicle.year, newVehicle.model)) {
      toast.error("Marca, año y modelo deben seleccionarse desde la lista");
      return;
    }
    if (showNewVehicleCabVariant && !newVehicle.vehicle_cab_variant) {
      toast.error("Selecciona el tipo de cabina para esta camioneta");
      return;
    }

    try {
      setIsSubmittingVehicle(true);
      const plateFormatted = newVehicle.plate_prefix === "M"
        ? `M ${newVehicle.plate_number}`
        : `${newVehicle.plate_prefix} ${newVehicle.plate_number}`;

      const vehicleData = {
        customer_id: selectedCustomer.customer_id,
        plate: plateFormatted,
        brand: newVehicle.brand,
        model: newVehicle.model,
        year: parseInt(newVehicle.year, 10) || new Date().getFullYear(),
        color: newVehicle.color || null,
        vin: newVehicle.chasis || null,
        ...(getCatalogVehiclePayload(newVehicle.brand, newVehicle.model, {
          vehicleCabVariant: newVehicle.vehicle_cab_variant,
        }) || {}),
      };

      const response = await axios.post(`${API}/vehicles`, vehicleData, { withCredentials: true });
      const createdVehicleId = response?.data?.vehicle_id;

      if (createdVehicleId) {
        applyNewlyCreatedVehicleSelection(createdVehicleId, response?.data);
      }

      const vehiclesRes = await axios.get(`${API}/vehicles`, { withCredentials: true });
      setLocalVehicles(vehiclesRes.data);
      if (typeof onDataRefresh === "function") {
        onDataRefresh();
      }

      setShowNewVehicleDialog(false);
      resetNewVehicleForm();
      persistDraftSnapshot({
        vehicleFlowOption: "registered",
        logisticMode: "installed",
        selectedVehicle: normalizeVehicleId(createdVehicleId),
        isVehiclePickerVisible: false,
        showNewVehicleDialog: false,
        newVehicle: {
          plate_prefix: "M",
          plate_number: "",
          brand: "",
          model: "",
          year: "",
          color: "",
          chasis: "",
          vehicle_cab_variant: "",
        },
        useVehicleVinDecoder: false,
      });
      toast.success("Vehículo registrado para el cliente");
    } catch (error) {
      const errDetail = error.response?.data?.detail;
      if (error.response?.status === 409 && errDetail?.code === "VEHICLE_OWNED_BY_ANOTHER") {
        setVehicleConflictData(errDetail);
        setShowVehicleConflictDialog(true);
      } else {
        const msg = typeof errDetail === "string" ? errDetail : (errDetail?.message || "No se pudo registrar el vehículo");
        toast.error(msg);
      }
    } finally {
      setIsSubmittingVehicle(false);
    }
  };

  const handleExecuteSupervisorTransfer = async () => {
    if (!vehicleConflictData?.existing_vehicle?.vehicle_id || !selectedCustomer?.customer_id) {
      toast.error("Datos incompletos para realizar el traspaso");
      return;
    }
    try {
      setIsTransferringVehicle(true);
      const vehicleId = vehicleConflictData.existing_vehicle.vehicle_id;
      const res = await axios.post(
        `${API}/vehicles/${vehicleId}/transfer-owner`,
        {
          target_customer_id: selectedCustomer.customer_id,
          reason: vehicleTransferReason || "Traspaso de vehículo por venta",
          draft_id: initialData?.draft_id || initialData?.id || null,
          flow: "sales",
        },
        { withCredentials: true }
      );

      toast.success(res.data?.message || "Vehículo traspasado exitosamente.");
      setShowVehicleConflictDialog(false);
      setShowNewVehicleDialog(false);
      resetNewVehicleForm();

      const vehiclesRes = await axios.get(`${API}/vehicles`, { withCredentials: true });
      setLocalVehicles(vehiclesRes.data);
      applyNewlyCreatedVehicleSelection(vehicleId, res.data?.vehicle);
      if (typeof onDataRefresh === "function") {
        onDataRefresh();
      }
      setPendingVehicleTransfer(null);
      persistDraftSnapshot({
        selectedVehicle: normalizeVehicleId(vehicleId),
        vehicleFlowOption: "registered",
        logisticMode: "installed",
        pending_vehicle_transfer: null,
      });
    } catch (error) {
      const errDetail = error.response?.data?.detail;
      toast.error(typeof errDetail === "string" ? errDetail : "No se pudo realizar el traspaso del vehículo");
    } finally {
      setIsTransferringVehicle(false);
    }
  };

  const handleRequestSellerTransfer = () => {
    if (!vehicleConflictData?.existing_vehicle?.vehicle_id || !selectedCustomer?.customer_id) {
      toast.error("Datos incompletos para solicitar el traspaso");
      return;
    }
    const transferReq = {
      vehicle_id: vehicleConflictData.existing_vehicle.vehicle_id,
      target_customer_id: selectedCustomer.customer_id,
      target_customer_name: selectedCustomer.name || [selectedCustomer.first_name, selectedCustomer.last_name].filter(Boolean).join(" "),
      previous_customer_id: vehicleConflictData.owner_info?.customer_id,
      previous_customer_name: vehicleConflictData.owner_info?.name || "Dueño Anterior",
      brand: vehicleConflictData.existing_vehicle.brand,
      model: vehicleConflictData.existing_vehicle.model,
      year: vehicleConflictData.existing_vehicle.year,
      plate: vehicleConflictData.existing_vehicle.plate,
      vin: vehicleConflictData.existing_vehicle.vin,
      reason: vehicleTransferReason || "Traspaso solicitado por venta de vehículo",
      requested_at: new Date().toISOString(),
      requested_by_user_id: user?.user_id,
      requested_by_name: user?.name,
    };

    setPendingVehicleTransfer(transferReq);
    setShowVehicleConflictDialog(false);
    setShowNewVehicleDialog(false);
    resetNewVehicleForm();

    persistDraftSnapshot({
      pending_vehicle_transfer: transferReq,
      isVehiclePickerVisible: false,
      logisticMode: "installed",
    });

    toast.info("Solicitud de traspaso guardada en el borrador. Un supervisor o gerente debe aprobarla para asignar el vehículo.");
  };

  const handleApproveDraftTransfer = async (approved = true) => {
    const draftId = initialData?.draft_id || initialData?.id;
    if (!draftId) {
      toast.error("Identificador de borrador no disponible");
      return;
    }
    try {
      setIsTransferringVehicle(true);
      const res = await axios.post(
        `${API}/drafts/sales/${draftId}/approve-vehicle-transfer`,
        {
          approved,
          reason: approved ? "Aprobado por supervisión" : "Rechazado por supervisión",
        },
        { withCredentials: true }
      );

      if (approved) {
        toast.success(res.data?.message || "Traspaso aprobado exitosamente.");
        const vehicleId = pendingVehicleTransfer?.vehicle_id;
        const vehiclesRes = await axios.get(`${API}/vehicles`, { withCredentials: true });
        setLocalVehicles(vehiclesRes.data);
        if (vehicleId) {
          applyNewlyCreatedVehicleSelection(vehicleId, res.data?.vehicle);
        }
      } else {
        toast.info("Solicitud de traspaso rechazada.");
      }
      setPendingVehicleTransfer(null);
      if (typeof onDataRefresh === "function") {
        onDataRefresh();
      }
    } catch (error) {
      const errDetail = error.response?.data?.detail;
      toast.error(typeof errDetail === "string" ? errDetail : "Error al procesar la aprobación del traspaso");
    } finally {
      setIsTransferringVehicle(false);
    }
  };

  const paymentExchangeRate = Number(buyExchangeRate || exchangeRate) || 36.5;

  const convertPrice = (priceUSD) => {
    if (currency === "NIO") {
      return priceUSD * exchangeRate;
    }
    return priceUSD;
  };

  const isDeliveryLogistics = logisticMode === "delivery";

  const totals = useMemo(() => computeSaleTotals({
    cartItems: normalizedCartItems,
    currency,
    exchangeRate,
    sellRate: exchangeRate,
    ivaRate,
    globalDiscount,
    globalDiscountMode,
    appliedDiscounts,
    paymentMethod: normalizedPaymentMethod,
    mixedPaymentMethods: normalizedMixedPaymentMethods,
    applyIVA,
    applyRetention,
    retentionRate,
    hasSelectedVehicle,
    isCompanyCustomerFlow,
    supervisorDiscountPreapproved: sellerReleasedRestricted && globalDiscount > 0,
    deliveryCost: Number(deliveryCost) || 0,
    isDelivery: isDeliveryLogistics,
  }), [
    normalizedCartItems,
    currency,
    exchangeRate,
    ivaRate,
    globalDiscount,
    globalDiscountMode,
    appliedDiscounts,
    normalizedPaymentMethod,
    normalizedMixedPaymentMethods,
    applyIVA,
    applyRetention,
    retentionRate,
    hasSelectedVehicle,
    isCompanyCustomerFlow,
    sellerReleasedRestricted,
    deliveryCost,
    isDeliveryLogistics,
  ]);

  useEffect(() => {
    const nextTarget = Number(totals.total || 0);
    if (prevPlanTargetRef.current === 0 && nextTarget > 0) {
      prevPlanTargetRef.current = nextTarget;
      return;
    }
    if (prevPlanTargetRef.current === nextTarget) return;
    setPaymentPlanLines((prev) => {
      const hasAmounts = prev.some((line) => !isPlanLineAmountEmpty(line));
      if (!hasAmounts) return prev;
      setPlanTotalChangedHint(true);
      if (normalizedPaymentMethod === "mixed") {
        return rebalanceMixedPlanRemainders(prev, paymentExchangeRate, nextTarget);
      }
      return prev;
    });
    prevPlanTargetRef.current = nextTarget;
  }, [totals.total, paymentExchangeRate, normalizedPaymentMethod]);

  useEffect(() => {
    const validation = validatePlanAgainstTotal(paymentPlanLines, paymentExchangeRate, totals.total);
    if (validation.ok) {
      setPlanTotalChangedHint(false);
      setPaymentPlanSubmitAttention(false);
      setPaymentPlanSubmitAttentionMessage("");
    }
  }, [paymentPlanLines, paymentExchangeRate, totals.total]);

  const isPaymentPlanReady = useMemo(() => {
    if (normalizedPaymentMethod === "credit") return true;
    if (normalizedPaymentMethod === "mixed" && normalizedMixedPaymentMethods.length === 0) return false;
    if (!paymentPlanLines.length) return false;
    if (paymentPlanLines.some((line) => isPlanLineAmountEmpty(line))) return false;
    const uniqueness = validatePlanLineUniqueness(paymentPlanLines);
    if (!uniqueness.ok) return false;
    return validatePlanAgainstTotal(paymentPlanLines, paymentExchangeRate, totals.total).ok;
  }, [
    normalizedMixedPaymentMethods.length,
    normalizedPaymentMethod,
    paymentExchangeRate,
    paymentPlanLines,
    totals.total,
  ]);

  const focusMixedPaymentPlanMismatch = (message) => {
    setPlanTotalChangedHint(true);
    setPaymentPlanSubmitAttention(true);
    setPaymentPlanSubmitAttentionMessage(
      message || "Ajusta el plan de cobro mixto para que cuadre con el total antes de enviar la factura a caja.",
    );
    scrollToAnchor({ anchorRef: paymentPlanSectionRef, behavior: "smooth", block: "center" });
  };

  const handleMixedMethodToggle = (method, nextChecked) => {
    if (sellerParamsLocked) {
      notifySellerParamsLocked();
      return;
    }
    if (nextChecked) {
      const nextMethods = Array.from(new Set([...normalizedMixedPaymentMethods, method]));
      setMixedPaymentMethods(nextMethods);
      playSelectionFeedbackSound();
      persistDraftSnapshot({ mixedPaymentMethods: nextMethods });
      return;
    }
    const linesForMethod = (Array.isArray(paymentPlanLines) ? paymentPlanLines : []).filter(
      (line) => normalizePaymentMethodCode(line?.metodo) === method,
    );
    if (linesForMethod.length > 1) {
      toast.error("Quita las líneas adicionales de este método antes de desmarcarlo");
      return;
    }
    const nextMethods = (Array.isArray(normalizedMixedPaymentMethods) ? normalizedMixedPaymentMethods : []).filter((item) => item !== method);
    const nextLines = (Array.isArray(paymentPlanLines) ? paymentPlanLines : []).filter(
      (line) => normalizePaymentMethodCode(line?.metodo) !== method,
    );
    setMixedPaymentMethods(nextMethods);
    setPaymentPlanLines(nextMethods.length ? nextLines : []);
    playSelectionFeedbackSound();
    persistDraftSnapshot({ mixedPaymentMethods: nextMethods });
  };

  const handlePlanLineRemoved = (removedLine, nextLines) => {
    if (normalizedPaymentMethod !== "mixed" || !removedLine) return;
    const method = normalizePaymentMethodCode(removedLine.metodo);
    const remainingForMethod = (Array.isArray(nextLines) ? nextLines : []).filter(
      (line) => normalizePaymentMethodCode(line?.metodo) === method,
    ).length;
    if (remainingForMethod > 0) return;
    const nextMethods = (Array.isArray(normalizedMixedPaymentMethods) ? normalizedMixedPaymentMethods : []).filter((item) => item !== method);
    setMixedPaymentMethods(nextMethods);
    if (!nextMethods.length) {
      setPaymentPlanLines([]);
    }
    persistDraftSnapshot({ mixedPaymentMethods: nextMethods });
  };

  const clearPrecio2Approval = useCallback(() => {
    setPrecio2ApprovalId(null);
    setPrecio2ApprovalStatus("none");
    setPrecio2ApprovedSignature("");
  }, []);

  const requestPrecio2Approval = async () => {
    if (!selectedCustomer?.customer_id) {
      toast.error("Selecciona un cliente primero");
      return;
    }
    if (isSupervisorUser) {
      toast.message("Supervisión no requiere solicitud de Precio 2");
      return;
    }
    const motivo = window.prompt("Motivo de la solicitud de Precio 2 (obligatorio):", "");
    if (motivo === null) return;
    if (!motivo.trim()) {
      toast.error("El motivo es obligatorio");
      return;
    }
    const precio2Items = normalizedCartItems
      .filter((item) => detectPriceTier(productsById.get(String(item.product_id)), item.unit_price) === TIER_PRECIO2)
      .map((item) => ({
        product_id: item.product_id,
        unit_price: item.unit_price,
      }));
    if (!precio2Items.length) {
      toast.error("No hay líneas con Precio 2 en el carrito");
      return;
    }
    setRequestingPrecio2Approval(true);
    try {
      const response = await axios.post(`${API}/approvals`, {
        type: "sale_precio2",
        reason: motivo.trim(),
        payload: {
          customer_id: selectedCustomer.customer_id,
          items: precio2Items,
        },
      }, { withCredentials: true });
      const approvalId = response.data?.approval_id || null;
      // Only store request id as pending — backend must later return status=approved
      setPrecio2ApprovalId(approvalId);
      setPrecio2ApprovalStatus(approvalId ? "pending" : "none");
      setPrecio2ApprovedSignature("");
      toast.success("Solicitud de Precio 2 enviada. Espera aprobación de supervisión o gerencia.");
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo solicitar aprobación de Precio 2");
    } finally {
      setRequestingPrecio2Approval(false);
    }
  };

  const handleSubmit = async () => {
    if (!logisticMode) {
      toast.error("Selecciona cómo se entrega la venta: Para llevar, Con envío o Instalado");
      return;
    }
    if (
      salePricingContext?.pricing_profile === "casa_comercial"
      && !salePricingContext?.can_serve_commercial_house
      && !isSupervisorUser
    ) {
      toast.error("Los clientes Casa Comercial solo pueden ser atendidos por Vendedores VIP o supervisión");
      return;
    }
    if (needsPrecio2Approval && precio2ApprovalStatus !== "approved") {
      toast.error(
        precio2ApprovalStatus === "pending"
          ? "La solicitud de Precio 2 aún está pendiente de supervisión/gerencia"
          : "Precio 2 requiere aprobación de supervisor o gerencia antes de facturar",
      );
      return;
    }
    if (logisticMode === "installed" && !normalizeVehicleId(selectedVehicle)) {
      toast.error("Selecciona un vehículo para la venta instalada");
      return;
    }
    if (logisticMode === "delivery") {
      const parsedDeliveryCost = Number(deliveryCost);
      if (!Number.isFinite(parsedDeliveryCost) || parsedDeliveryCost < 0) {
        toast.error("Ingrese un costo de envío válido (mayor o igual a cero)");
        return;
      }
      if (!selectedMessengerId) {
        toast.error("Debe asignar un mensajero para el delivery");
        return;
      }
      const selectedMessenger = messengerOptions.find((row) => row.messenger_id === selectedMessengerId);
      if (selectedMessenger && !["disponible", "en_ruta"].includes(String(selectedMessenger.status || ""))) {
        toast.error("El mensajero seleccionado no está disponible para ruta");
        return;
      }
    }
    const payloadPaymentMethod = normalizedPaymentMethod;
    const payloadMixedPaymentMethods = normalizedPaymentMethod === "mixed" ? normalizedMixedPaymentMethods : [];
    if (normalizedPaymentMethod === "mixed" && payloadMixedPaymentMethods.length === 0) {
      toast.error("Selecciona al menos un método para el pago mixto");
      return;
    }
    let plannedPaymentPlan = null;
    let payloadCreditDays = null;
    if (payloadPaymentMethod === "credit") {
      const approvedCreditDays = resolveCustomerCreditDays(selectedCustomer);
      if (!approvedCreditDays) {
        toast.error("Cliente sin crédito aprobado. Gerencia/supervisor debe configurar límite y plazo.");
        return;
      }
      if (Number(selectedCustomer?.credit_limit || 0) <= 0) {
        toast.error("Cliente sin límite de crédito aprobado.");
        return;
      }
      payloadCreditDays = approvedCreditDays;
    } else {
      const finalizedPlanLines = buildPlanLinesForSubmit({
        lines: paymentPlanLines,
        paymentMethod: payloadPaymentMethod,
        mixedMethods: payloadMixedPaymentMethods,
        exchangeRate: paymentExchangeRate,
        targetTotal: totals.total,
        currency,
        preserveMixedStructure: sellerReleasedRestricted,
      });
      const uniquenessValidation = validatePlanLineUniqueness(finalizedPlanLines);
      if (!uniquenessValidation.ok) {
        if (payloadPaymentMethod === "mixed") {
          focusMixedPaymentPlanMismatch(uniquenessValidation.message);
        } else {
          toast.error(uniquenessValidation.message);
        }
        return;
      }
      const planValidation = validatePlanAgainstTotal(
        finalizedPlanLines,
        paymentExchangeRate,
        totals.total,
      );
      if (!planValidation.ok) {
        if (payloadPaymentMethod === "mixed") {
          focusMixedPaymentPlanMismatch(planValidation.message);
        } else {
          toast.error(planValidation.message);
        }
        return;
      }
      const planLinesForPayload = planValidation.adjustedLines || finalizedPlanLines;
      plannedPaymentPlan = payloadPaymentMethod === "mixed"
        ? buildMixedPaymentPlan({
          methods: payloadMixedPaymentMethods,
          lines: planLinesForPayload,
          total: totals.total,
          exchangeRate: paymentExchangeRate,
          currency,
        })
        : buildSinglePaymentPlan({
          method: payloadPaymentMethod,
          total: totals.total,
          currency,
          exchangeRate: paymentExchangeRate,
        });
    }
    const payloadDiscountPercent = discountsBlockedByPayment
      ? 0
      : Number(totals.globalDiscountEffectivePercent || 0);
    const payloadDiscountCodes = discountsBlockedByPayment ? [] : appliedDiscounts.map(d => d.code);
    const payloadAppliedDiscounts = discountsBlockedByPayment ? [] : appliedDiscounts;
    const payload = {
      customer_id: selectedCustomer?.customer_id || selectedCustomer,
      vehicle_id: selectedVehicle,
      warehouse_id: selectedWarehouse,
      items: normalizedCartItems.map(i => ({
        product_id: i.product_id,
        quantity: i.quantity,
        discount: discountsBlockedByPayment ? 0 : i.discount,
        unit_price: i.unit_price,
        original_unit_price: i.original_unit_price ?? i.unit_price,
        installation_price: i.installation_price || 0,
        product_name: i.product_name,
        with_installation: hasSelectedVehicle && (i.installation_type === "required" || Boolean(i.with_installation)),
      })),
      discount: payloadDiscountPercent,
      payment_type: payloadPaymentMethod,
      payment_method: payloadPaymentMethod,
      mixed_payment_methods: payloadMixedPaymentMethods,
      planned_payment_plan: plannedPaymentPlan,
      credit_days: payloadCreditDays,
      currency,
      apply_iva: applyIVA,
      iva_rate: ivaRate,
      apply_retention: isCompanyCustomerFlow && applyRetention && totals.retentionThresholdMet,
      retention_rate: (isCompanyCustomerFlow && applyRetention && totals.retentionThresholdMet) ? retentionRate / 100 : 0,
      retention_amount: totals.retention,
      exchange_rate: exchangeRate,
      discount_codes: payloadDiscountCodes,
      applied_discounts: payloadAppliedDiscounts,
      discounts_blocked_by_method: totals.discountsBlockedByPayment,
      total_amount: totals.total,
      notes,
      logistic_mode: logisticMode,
      delivery_required: logisticMode === "delivery",
      delivery_info: logisticMode === "delivery"
        ? {
          is_delivery: true,
          destination_type: deliveryDestinationType,
          delivery_cost: Number(deliveryCost) || 0,
          messenger_id: selectedMessengerId,
          delivery_status: "pendiente",
        }
        : null,
      ...(precio2ApprovalStatus === "approved" && precio2ApprovalId
        ? { precio2_approval_id: precio2ApprovalId }
        : {}),
      ...(isCommercialHouseSale ? {
        commercial_include_installation: commercialIncludeInstallation,
        commercial_include_delivery: commercialIncludeDelivery,
      } : {}),
      active_price_tier: activePriceTier,
      active_price_tier_label: TIER_LABELS[activePriceTier] || activePriceTier,
      audit_events: auditEvents,
    };

    // Sellers: confirm before locking invoice in caja (edits later need approval)
    if (confirmSendToCashier && flowType === "sale") {
      setPendingCashierPayload(payload);
      setSendToCashierConfirmOpen(true);
      return;
    }

    await executeSubmitToCashier(payload);
  };

  const executeSubmitToCashier = async (payload) => {
    if (!payload) return false;
    setSubmittingToCashier(true);
    try {
      const result = onSubmit && onSubmit(payload);
      let submissionResult = result;
      if (result && typeof result.then === "function") {
        submissionResult = await result;
      }
      if (submissionResult?.ok !== true) return false;
      if (draftKey && typeof window !== "undefined") {
        window.localStorage.removeItem(draftKey);
        if (typeof onDraftClear === "function") {
          onDraftClear();
        }
      }
      setSendToCashierConfirmOpen(false);
      setPendingCashierPayload(null);
      return true;
    } catch (error) {
      throw error;
    } finally {
      setSubmittingToCashier(false);
    }
  };

  const buildDraftSnapshot = useCallback((overrides = {}) => {
    const selectedCustomerId = selectedCustomer?.customer_id || (typeof selectedCustomer === "string" ? selectedCustomer : null);
    const baseSnapshot = {
      selectedCustomerId,
      selectedVehicle,
      selectedWarehouse,
      cartItems: normalizedCartItems,
      paymentMethod: normalizedPaymentMethod,
      mixedPaymentMethods: normalizedPaymentMethod === "mixed" ? normalizedMixedPaymentMethods : [],
      paymentPlanLines,
      planned_payment_plan: normalizedPaymentMethod === "credit" ? null : {
        mode: normalizedPaymentMethod,
        lines: paymentPlanLines,
      },
      globalDiscountMode,
      globalDiscount,
      notes,
      applyIVA,
      ivaRate,
      applyRetention,
      retentionRate,
      currency,
      exchangeRate,
      appliedDiscounts,
      customerSearch,
      productSearch,
      activePriceTier,
      auditEvents,
      vehicleFlowOption,
      logisticMode,
      deliveryDestinationType,
      deliveryCost,
      selectedMessengerId,
      isVehiclePickerVisible,
      selectedVehicleData,
      showNewCustomer,
      showNewVehicleDialog,
      newCustomerTab,
      newCustomer,
      newVehicle,
      useVinDecoder,
      useVehicleVinDecoder,
    };
    return {
      ...(draftSnapshotRef.current || {}),
      ...baseSnapshot,
      ...overrides,
      updatedAt: new Date().toISOString(),
    };
  }, [
    selectedCustomer,
    selectedVehicle,
    selectedWarehouse,
    normalizedCartItems,
    normalizedPaymentMethod,
    normalizedMixedPaymentMethods,
    globalDiscountMode,
    globalDiscount,
    notes,
    applyIVA,
    ivaRate,
    applyRetention,
    retentionRate,
    currency,
    exchangeRate,
    appliedDiscounts,
    customerSearch,
    productSearch,
    activePriceTier,
    auditEvents,
    vehicleFlowOption,
    logisticMode,
    deliveryDestinationType,
    deliveryCost,
    selectedMessengerId,
    isVehiclePickerVisible,
    selectedVehicleData,
    showNewCustomer,
    showNewVehicleDialog,
    newCustomerTab,
    newCustomer,
    newVehicle,
    useVinDecoder,
    useVehicleVinDecoder,
  ]);

  const hasNestedDraftData = useCallback((snapshot) => {
    const customerDraft = snapshot?.newCustomer || {};
    const vehicleDraft = snapshot?.newVehicle || {};
    const hasCustomerDraft = Object.values(customerDraft).some((value) => {
      if (typeof value === "boolean") return value;
      return String(value || "").trim() !== "" && String(value) !== "0";
    });
    const hasVehicleDraft = Object.values(vehicleDraft).some((value) => {
      if (typeof value === "boolean") return value;
      return String(value || "").trim() !== "";
    });
    return Boolean(snapshot?.showNewCustomer || snapshot?.showNewVehicleDialog || hasCustomerDraft || hasVehicleDraft);
  }, []);

  const persistDraftSnapshot = useCallback((overrides = {}) => {
    if (!draftKey || typeof window === "undefined") return false;
    if (!draftLoaded) return false;
    const snapshot = buildDraftSnapshot(overrides);
    const snapshotEligible = isSaleDraftSaveEligible(snapshot);

    if (!snapshotEligible) {
      window.localStorage.removeItem(draftKey);
      draftSnapshotRef.current = null;
      if (typeof onDraftClear === "function") {
        onDraftClear();
      }
      if (typeof onDraftSaveStateChange === "function") {
        onDraftSaveStateChange({ state: "saved", at: new Date().toISOString() });
      }
      return true;
    }

    draftSnapshotRef.current = snapshot;
    try {
      if (typeof onDraftSaveStateChange === "function") {
        onDraftSaveStateChange({ state: "saving", at: new Date().toISOString() });
      }
      window.localStorage.setItem(draftKey, JSON.stringify(snapshot));
      if (typeof onDraftPersist === "function") {
        onDraftPersist(snapshot);
      }
      if (typeof onDraftSaveStateChange === "function") {
        onDraftSaveStateChange({ state: "saved", at: new Date().toISOString() });
      }
      return true;
    } catch (error) {
      if (typeof onDraftSaveStateChange === "function") {
        onDraftSaveStateChange({ state: "error", at: new Date().toISOString() });
      }
      return false;
    }
  }, [buildDraftSnapshot, draftKey, draftLoaded, onDraftClear, onDraftPersist, onDraftSaveStateChange]);

  const handleOpenBarcodeScanner = useCallback(() => {
    const contextError = getCameraContextError();
    if (contextError) {
      toast.error(contextError, { duration: 12000 });
      return;
    }
    setShowBarcodeScanner(true);
  }, []);

  const handleBarcodeScan = useCallback((code) => {
    const matches = findProductsByScanCode(products, code);
    if (matches.length === 1) {
      addToCart(matches[0]);
      setShowBarcodeScanner(false);
      toast.success(`Producto agregado: ${matches[0].name}`);
      return;
    }

    setProductSearch(code);
    persistDraftSnapshot({ productSearch: code });
    setShowBarcodeScanner(false);

    if (matches.length > 1) {
      toast.info(`${matches.length} productos coinciden con "${code}". Elige uno de la lista.`);
      return;
    }

    toast.warning(`No se encontró producto con el código "${code}"`);
  }, [addToCart, persistDraftSnapshot, products]);

  useEffect(() => {
    if (!isCompanyCustomerFlow) return;
    if (!applyRetention) return;
    if (totals.retentionThresholdMet) return;

    setApplyRetention(false);
    persistDraftSnapshot({ applyRetention: false, retentionRate });
    toast.info("La retención IR requiere subtotal con descuentos >= C$1,000.00");
  }, [
    applyRetention,
    isCompanyCustomerFlow,
    persistDraftSnapshot,
    retentionRate,
    totals.retentionThresholdMet,
  ]);

  const commitGlobalDiscountValue = useCallback((rawValue) => {
    if (sellerParamsLocked) {
      toast.error("No puedes modificar descuentos globales en un borrador liberado con cambios de supervisión");
      return;
    }
    let normalizedValue = clampGlobalDiscountValue(rawValue, globalDiscountMode);
    if (!isSupervisorUser && isSellerRole) {
      const subtotalBase = totals.subtotalAfterItemPriceDiscounts || 0;
      if (sellerGlobalDiscountExceeded({
        value: normalizedValue,
        mode: globalDiscountMode,
        currency,
        exchangeRate,
        subtotal: subtotalBase,
      })) {
        toast.warning("Descuentos mayores a 2% o C$500 solo los puede aprobar gerencia.", { duration: 5000 });
        normalizedValue = clampSellerGlobalDiscount({
          value: normalizedValue,
          mode: globalDiscountMode,
          currency,
          exchangeRate,
          subtotal: subtotalBase,
        });
      }
    }
    setGlobalDiscount(normalizedValue);
    setGlobalDiscountDraft(String(normalizedValue));
    persistDraftSnapshot({ globalDiscount: normalizedValue });
  }, [currency, exchangeRate, globalDiscountMode, isSellerRole, isSupervisorUser, persistDraftSnapshot, sellerParamsLocked, totals.subtotalAfterItemPriceDiscounts]);

  const handleGlobalDiscountInputChange = useCallback((rawValue) => {
    if (sellerParamsLocked) {
      notifySellerParamsLocked();
      return;
    }
    setGlobalDiscountDraft(String(rawValue ?? ""));
  }, [notifySellerParamsLocked, sellerParamsLocked]);

  const handlePaymentPlanLinesChange = useCallback((nextLines) => {
    setPaymentPlanLines(nextLines);
    persistDraftSnapshot({
      paymentPlanLines: nextLines,
      planned_payment_plan: normalizedPaymentMethod === "credit" ? null : {
        mode: normalizedPaymentMethod,
        lines: nextLines,
      },
    });
  }, [normalizedPaymentMethod, persistDraftSnapshot]);

  useEffect(() => {
    planAutoSyncSkipRef.current = true;
  }, [draftKey]);

  useEffect(() => {
    if (normalizedPaymentMethod === "credit" || !draftLoaded) return;
    if (planAutoSyncSkipRef.current) {
      planAutoSyncSkipRef.current = false;
      const hasRestoredAmounts = paymentPlanLines.some((line) => !isPlanLineAmountEmpty(line));
      if (hasRestoredAmounts) return;
    }
    if (normalizedPaymentMethod === "mixed") {
      const nextLines = syncMixedPlanLines(
        paymentPlanLines,
        normalizedMixedPaymentMethods,
        exchangeRate,
        totals.total,
        currency,
      );
      handlePaymentPlanLinesChange(nextLines);
      return;
    }
    const amount = currency === "USD"
      ? Number((totals.total / (exchangeRate || 36.5)).toFixed(4))
      : Number(totals.total || 0).toFixed(2);
    handlePaymentPlanLinesChange([{
      metodo: normalizedPaymentMethod,
      moneda: currency,
      monto_origen: amount,
    }]);
  }, [
    currency,
    draftLoaded,
    exchangeRate,
    normalizedMixedPaymentMethods.join("|"),
    normalizedPaymentMethod,
    totals.total,
  ]);

  const applyGlobalDiscountModeChange = useCallback((nextModeValue) => {
    if (sellerParamsLocked) {
      notifySellerParamsLocked();
      return;
    }
    const nextMode = normalizeGlobalDiscountMode(nextModeValue);
    const normalizedValue = clampGlobalDiscountValue(globalDiscount, nextMode);
    setGlobalDiscountMode(nextMode);
    setGlobalDiscount(normalizedValue);
    setGlobalDiscountDraft(String(normalizedValue));
    playSelectionFeedbackSound();
    persistDraftSnapshot({
      globalDiscountMode: nextMode,
      globalDiscount: normalizedValue,
    });
  }, [globalDiscount, notifySellerParamsLocked, persistDraftSnapshot, sellerParamsLocked]);

  const undoCartChange = useCallback(() => {
    if (cartHistory.current.length === 0) return;
    const [{ snapshot: prev, label }, ...rest] = cartHistory.current;
    cartHistory.current = rest;
    setCartItems(prev);
    persistDraftSnapshot({ cartItems: prev });
    playUndoSound();
    toast.info(label || "Acción deshecha");
  }, [persistDraftSnapshot]);

  const resetSaleFlowForCustomerChange = useCallback(() => {
    cartHistory.current = [];
    setCartItems([]);
    setAppliedDiscounts([]);
    setProductSearch("");
    setSelectedVehicle("");
    setVehicleFlowOption("carryout");
    setLogisticMode(null);
    setIsVehiclePickerVisible(true);
    setStepThreeUnlockFlash(false);
    prevStepTwoCompleteRef.current = false;
    didStepThreeAutoScrollRef.current = false;
  }, []);

  const handleSelectCustomer = useCallback((customer) => {
    if (sellerFlowLocked) {
      notifySellerFlowLocked();
      return;
    }
    const shouldResetCart = normalizedCartItems.length > 0;
    if (shouldResetCart) {
      resetSaleFlowForCustomerChange();
    }
    const nextApplyIva = false;
    setSelectedCustomer(customer);
    setPendingCustomerId(null);
    setCustomerSearch("");
    setSelectedVehicle("");
    setVehicleFlowOption("carryout");
    setLogisticMode(null);
    setIsVehiclePickerVisible(true);
    setApplyIVA(nextApplyIva);
    playSelectionFeedbackSound();
    persistDraftSnapshot({
      selectedCustomerId: customer?.customer_id || null,
      customerSearch: "",
      selectedVehicle: "",
      vehicleFlowOption: "carryout",
      logisticMode: null,
      cartItems: shouldResetCart ? [] : normalizedCartItems,
      appliedDiscounts: shouldResetCart ? [] : appliedDiscounts,
      productSearch: "",
      applyIVA: nextApplyIva,
    });
  }, [
    appliedDiscounts,
    normalizedCartItems,
    persistDraftSnapshot,
    resetSaleFlowForCustomerChange,
    sellerFlowLocked,
    notifySellerFlowLocked,
  ]);

  const handleClearSelectedCustomer = useCallback(() => {
    if (sellerFlowLocked) {
      notifySellerFlowLocked();
      return;
    }
    resetSaleFlowForCustomerChange();
    setSelectedCustomer(null);
    setPendingCustomerId(null);
    setSelectedVehicle("");
    setVehicleFlowOption("carryout");
    setLogisticMode(null);
    setIsVehiclePickerVisible(true);
    setCustomerSearch("");
    playSelectionFeedbackSound();
    persistDraftSnapshot({
      selectedCustomerId: null,
      selectedVehicle: "",
      vehicleFlowOption: "carryout",
      logisticMode: null,
      customerSearch: "",
      cartItems: [],
      appliedDiscounts: [],
      productSearch: "",
    });
    setTimeout(() => customerSearchRef.current?.focus(), 0);
  }, [notifySellerFlowLocked, persistDraftSnapshot, resetSaleFlowForCustomerChange, sellerFlowLocked]);

  const handleSelectFulfillmentMode = useCallback((nextMode) => {
    if (sellerFlowLocked) {
      notifySellerFlowLocked();
      return;
    }
    setLogisticMode(nextMode);
    if (nextMode === "installed") {
      setVehicleFlowOption("registered");
      const hasValidVehicle = Boolean(selectedVehicle)
        && customerVehicles.some((v) => normalizeVehicleId(v.vehicle_id ?? v.id) === normalizeVehicleId(selectedVehicle));
      if (hasValidVehicle) {
        setIsVehiclePickerVisible(false);
      } else {
        setSelectedVehicle("");
        setIsVehiclePickerVisible(true);
        if (customerVehicles.length === 0) {
          toast.info("Selecciona o registra un vehículo para la instalación");
        }
      }
    } else {
      setVehicleFlowOption("carryout");
      setSelectedVehicle("");
      setIsVehiclePickerVisible(false);
      setCartItems((prev) => prev.map((item) => ({ ...item, with_installation: false })));
    }
    persistDraftSnapshot({
      logisticMode: nextMode,
      vehicleFlowOption: nextMode === "installed" ? "registered" : "carryout",
      selectedVehicle: nextMode === "installed" ? selectedVehicle : "",
      isVehiclePickerVisible: nextMode === "installed",
    });
    playSelectionFeedbackSound();
  }, [
    customerVehicles,
    normalizeVehicleId,
    notifySellerFlowLocked,
    persistDraftSnapshot,
    selectedVehicle,
    sellerFlowLocked,
  ]);

  const handleReopenFulfillmentStep = useCallback(() => {
    if (sellerFlowLocked) {
      notifySellerFlowLocked();
      return;
    }
    setIsVehiclePickerVisible(true);
    persistDraftSnapshot({ isVehiclePickerVisible: true });
  }, [notifySellerFlowLocked, persistDraftSnapshot, sellerFlowLocked]);

  const handleSelectVehicleFlow = useCallback((nextFlowOption, nextVehicleId = "") => {
    if (sellerFlowLocked) {
      notifySellerFlowLocked();
      return;
    }
    const normalizedVehicleId = normalizeVehicleId(nextVehicleId);
    const pendingCreatedVehicle = normalizeVehicleId(recentlyCreatedVehicleIdRef.current);
    if (normalizedVehicleId && normalizedVehicleId !== pendingCreatedVehicle) {
      recentlyCreatedVehicleIdRef.current = "";
    }
    setLogisticMode("installed");
    setVehicleFlowOption(nextFlowOption);
    setSelectedVehicle(normalizedVehicleId);
    setOnlyCompatibleProducts(true);
    if (nextFlowOption !== "new") {
      setIsVehiclePickerVisible(false);
    }
    playSelectionFeedbackSound();
    if (nextFlowOption === "registered" && normalizedVehicleId) {
      triggerVehiclePulse();
    }
    persistDraftSnapshot({
      vehicleFlowOption: nextFlowOption,
      selectedVehicle: normalizedVehicleId,
      showNewVehicleDialog: nextFlowOption === "new",
      logisticMode: "installed",
      isVehiclePickerVisible: nextFlowOption === "new",
    });
  }, [normalizeVehicleId, notifySellerFlowLocked, persistDraftSnapshot, sellerFlowLocked, triggerVehiclePulse]);

  const updateCartItem = useCallback((productId, field, value, options = {}) => {
    if (field === "unit_price" && !canEditLinePrice) {
      toast.error("Los Vendedores VIP usan la tarifa establecida. Solo gerencia o supervisión pueden editar precios.");
      return normalizedCartItems;
    }
    if (!isSupervisorUser) {
      const lineLock = getSellerCartLineLockState(productId, draftReview);
      if (lineLock.locked && ["quantity", "discount", "unit_price", "with_installation"].includes(field)) {
        toast.error("No puedes modificar líneas revisadas por supervisión");
        return normalizedCartItems;
      }
    }
    const prevItem = normalizedCartItems.find((item) => item.product_id === productId);
    const name = prevItem?.product_name || "producto";
    const fieldLabels = { quantity: "cantidad", discount: "descuento", with_installation: "instalación", unit_price: "precio" };
    const fieldLabel = fieldLabels[field] || field;
    pushCartHistory([...normalizedCartItems], `Se restauró ${fieldLabel} de "${name}"`);
    const normalizedValue = field === "quantity"
      ? Math.max(1, Math.floor(Number(value) || 1))
      : value;
    const additionalPatch = options.patch && typeof options.patch === "object" ? options.patch : null;
    const nextCartItems = normalizedCartItems.map(item => item.product_id === productId
      ? { ...item, [field]: normalizedValue, ...(additionalPatch || {}) }
      : item);
    setCartItems(nextCartItems);
    if (field === "quantity") {
      const prevQuantity = Number(prevItem?.quantity || 0);
      const nextQuantity = Number(normalizedValue || 0);
      if (Number.isFinite(nextQuantity) && nextQuantity > 0 && nextQuantity !== prevQuantity) {
        if (nextQuantity > prevQuantity) playCartQuantityUpSound();
        else playCartQuantityDownSound();
      }
    }
    if (options.persist) {
      persistDraftSnapshot({ cartItems: nextCartItems });
    }
    return nextCartItems;
  }, [canEditLinePrice, draftReview, isSupervisorUser, normalizedCartItems, persistDraftSnapshot, pushCartHistory]);

  const removeFromCart = useCallback((productId) => {
    if (!isSupervisorUser) {
      const lineLock = getSellerCartLineLockState(productId, draftReview);
      if (!lineLock.deletable) {
        toast.error("No puedes eliminar productos revisados por supervisión");
        return;
      }
    }
    const item = normalizedCartItems.find(i => i.product_id === productId);
    const name = item?.product_name || "producto";
    pushCartHistory([...normalizedCartItems], `Se restauró "${name}" al carrito`);
    const nextCartItems = normalizedCartItems.filter(i => i.product_id !== productId);
    setCartItems(nextCartItems);
    playCartRemoveSound();
    persistDraftSnapshot({ cartItems: nextCartItems });
  }, [draftReview, isSupervisorUser, normalizedCartItems, persistDraftSnapshot, pushCartHistory]);

  const changeCartItemQuantityBy = useCallback((productId, delta) => {
    const currentItem = normalizedCartItems.find((item) => item.product_id === productId);
    const currentQuantity = Math.max(1, Math.floor(Number(currentItem?.quantity) || 1));
    const nextQuantity = Math.max(1, currentQuantity + delta);
    updateCartItem(productId, "quantity", nextQuantity, { persist: true });
  }, [normalizedCartItems, updateCartItem]);

  const handleApplyTintPlan = useCallback(({ tint_window_plan, materials_extra }) => {
    if (tintDialogCartItem) {
      updateCartItem(tintDialogCartItem.product_id, "materials_extra", materials_extra, {
        patch: { tint_window_plan },
        persist: true,
      });
      toast.success("Plan de polarizado actualizado");
    } else if (tintDialogProduct) {
      const product = tintDialogProduct;
      const installationType = product.installation_type || "optional";
      const installationPrice = product.installation_price || 0;
      const withInstallation = installationType === "required";
      const nextCartItems = [
        ...normalizedCartItems,
        {
          product_id: product.product_id,
          product_name: product.name,
          sku: product.sku || "",
          image: product.images?.[0] || null,
          quantity: 1,
          unit_price: resolveDefaultUnitPrice(product, effectivePricingContext),
          original_unit_price: resolveProductTierPrice(product, TIER_PRECIO1),
          price_tier: activePriceTier,
          price_tier_label: TIER_LABELS[activePriceTier] || activePriceTier,
          price_edit_history: [],
          price_edit_count: 0,
          discount: 0,
          installation_type: installationType,
          installation_price: installationPrice,
          with_installation: hasSelectedVehicle ? withInstallation : false,
          materials_extra: materials_extra || 0,
          tint_window_plan: tint_window_plan || null,
          ...(sellerReleasedRestricted ? { added_after_release: true } : {}),
        },
      ];
      clearProductSearchAfterCartUpdateRef.current = true;
      flashCartLanding();
      setCartItems(nextCartItems);
      persistDraftSnapshot({ cartItems: nextCartItems, productSearch: "" });
      playCartPickupSound();
      toast.success("Polarizado configurado y agregado al carrito");
    }
    setTintDialogOpen(false);
    setTintDialogProduct(null);
    setTintDialogCartItem(null);
  }, [
    activePriceTier,
    effectivePricingContext,
    hasSelectedVehicle,
    normalizedCartItems,
    persistDraftSnapshot,
    sellerReleasedRestricted,
    tintDialogCartItem,
    tintDialogProduct,
    updateCartItem,
  ]);

  const priceEditorItem = useMemo(
    () => normalizedCartItems.find((item) => item.product_id === priceEditorItemId) || null,
    [normalizedCartItems, priceEditorItemId]
  );

  const priceEditorPreview = useMemo(() => {
    if (!priceEditorItem) return null;

    const currentAmountInCurrency = convertPrice(priceEditorItem.unit_price || 0);
    const quantity = Math.max(1, Math.floor(Number(priceEditorItem.quantity) || 1));
    let nextAmountInCurrency = currentAmountInCurrency;
    let isValid = true;

    if (priceEditorMode === "amount") {
      const parsedAmount = Number(priceEditorAmount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        isValid = false;
      } else {
        nextAmountInCurrency = parsedAmount;
      }
    } else {
      const parsedPercent = Number(priceEditorPercent);
      if (!Number.isFinite(parsedPercent) || parsedPercent <= -100) {
        isValid = false;
      } else {
        nextAmountInCurrency = currentAmountInCurrency * (1 + parsedPercent / 100);
        if (nextAmountInCurrency <= 0) {
          isValid = false;
        }
      }
    }

    const deltaPerUnit = nextAmountInCurrency - currentAmountInCurrency;
    const discountPerUnit = Math.max(0, -deltaPerUnit);
    const increasePerUnit = Math.max(0, deltaPerUnit);
    return {
      isValid,
      quantity,
      nextAmountInCurrency,
      discountPerUnit,
      discountTotal: discountPerUnit * quantity,
      increasePerUnit,
      increaseTotal: increasePerUnit * quantity,
      deltaPerUnit,
      deltaTotal: deltaPerUnit * quantity,
    };
  }, [
    convertPrice,
    priceEditorAmount,
    priceEditorItem,
    priceEditorMode,
    priceEditorPercent,
  ]);

  const openPriceEditor = useCallback((item) => {
    if (!canEditLinePrice) {
      toast.error("Los Vendedores VIP usan la tarifa establecida. Solo gerencia o supervisión pueden editar precios.");
      return;
    }
    if (Number(item.price_edit_count || 0) >= 3) {
      toast.error("Solo se permite editar el precio 3 veces por producto");
      return;
    }
    const currentAmountInCurrency = convertPrice(item.unit_price || 0);
    setPriceEditorItemId(item.product_id);
    setPriceEditorMode("amount");
    setPriceEditorAmount(String(Number(currentAmountInCurrency.toFixed(2))));
    setPriceEditorPercent("0");
    setPriceEditorOpen(true);
    playSelectionFeedbackSound();
  }, [canEditLinePrice, convertPrice]);

  useEffect(() => {
    if (!priceEditorOpen) return undefined;
    const focusTimer = window.setTimeout(() => {
      const input = priceEditorMode === "amount"
        ? priceEditorAmountRef.current
        : priceEditorPercentRef.current;
      if (!input) return;
      input.focus();
      input.select();
    }, 0);
    return () => window.clearTimeout(focusTimer);
  }, [priceEditorOpen, priceEditorMode, priceEditorItemId]);

  const closePriceEditor = useCallback(() => {
    setPriceEditorOpen(false);
    setPriceEditorItemId(null);
  }, []);

  const applyPriceEditor = useCallback(() => {
    if (!priceEditorItem) {
      toast.error("No se encontró el producto a editar");
      return;
    }

    const currentAmountInCurrency = convertPrice(priceEditorItem.unit_price || 0);
    let nextAmountInCurrency = currentAmountInCurrency;

    if (priceEditorMode === "amount") {
      const parsedAmount = Number(priceEditorAmount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        toast.error("Ingresa un monto válido mayor a 0");
        return;
      }
      nextAmountInCurrency = parsedAmount;
    } else {
      const parsedPercent = Number(priceEditorPercent);
      if (!Number.isFinite(parsedPercent) || parsedPercent <= -100) {
        toast.error("El porcentaje debe ser mayor a -100");
        return;
      }
      nextAmountInCurrency = currentAmountInCurrency * (1 + parsedPercent / 100);
      if (nextAmountInCurrency <= 0) {
        toast.error("El precio final debe ser mayor a 0");
        return;
      }
    }

    const nextUnitPrice = currency === "NIO"
      ? nextAmountInCurrency / exchangeRate
      : nextAmountInCurrency;
    const roundedNextUnitPrice = Number(nextUnitPrice.toFixed(6));
    const currentUnitPrice = Number(priceEditorItem.unit_price || 0);
    const currentEditCount = Math.max(0, Math.floor(Number(priceEditorItem.price_edit_count || 0)));
    const currentHistory = Array.isArray(priceEditorItem.price_edit_history)
      ? priceEditorItem.price_edit_history
      : [];

    if (currentEditCount >= 3) {
      toast.error("Este producto ya alcanzó el máximo de 3 ediciones de precio");
      closePriceEditor();
      return;
    }

    if (Math.abs(roundedNextUnitPrice - currentUnitPrice) < 0.000001) {
      toast.info("El precio no cambió");
      closePriceEditor();
      return;
    }

    const preservedOriginalUnitPrice = Number(
      priceEditorItem.original_unit_price || priceEditorItem.unit_price || currentUnitPrice
    );
    updateCartItem(
      priceEditorItem.product_id,
      "unit_price",
      roundedNextUnitPrice,
      {
        persist: true,
        patch: {
          original_unit_price: preservedOriginalUnitPrice,
          price_edit_count: currentEditCount + 1,
          price_edit_history: [currentUnitPrice, ...currentHistory]
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value) && value > 0)
            .slice(0, 2),
        },
      }
    );
    toast.success("Precio actualizado");
    playSelectionFeedbackSound();
    closePriceEditor();
  }, [
    closePriceEditor,
    convertPrice,
    currency,
    exchangeRate,
    priceEditorAmount,
    priceEditorItem,
    priceEditorMode,
    priceEditorPercent,
    updateCartItem,
  ]);

  const startQuantityHold = useCallback((productId, delta) => {
    clearQuantityHold(productId);
    changeCartItemQuantityBy(productId, delta);

    const timeoutId = setTimeout(() => {
      const intervalId = setInterval(() => {
        changeCartItemQuantityBy(productId, delta);
      }, 115);

      const current = quantityHoldTimersRef.current.get(productId) || {};
      quantityHoldTimersRef.current.set(productId, { ...current, intervalId });
    }, 260);

    quantityHoldTimersRef.current.set(productId, { timeoutId, intervalId: null });
  }, [changeCartItemQuantityBy, clearQuantityHold]);

  const handleOpenCatalogSearch = useCallback(() => {
    const snapshot = buildDraftSnapshot();
    if (!snapshot.selectedCustomerId) {
      toast.error("Selecciona un cliente antes de buscar desde catálogo");
      return;
    }

    if (typeof onOpenCatalogSearch === "function") {
      onOpenCatalogSearch(snapshot);
      return;
    }

    if (draftKey && typeof window !== "undefined") {
      window.localStorage.setItem(draftKey, JSON.stringify(snapshot));
      window.localStorage.setItem("catalog_open_draft", isQuotationFlow ? "quote" : "sale");
      window.location.href = "/catalog";
      return;
    }

    toast.error("No se pudo abrir catálogo porque no hay un borrador activo");
  }, [buildDraftSnapshot, draftKey, isQuotationFlow, onOpenCatalogSearch]);

  const isSnapshotEmpty = (snapshot) => !isSaleDraftSaveEligible(snapshot);

  useEffect(() => {
    if (!draftKey || typeof window === "undefined") return undefined;
    return () => {
      // If draft was explicitly cleared (key removed), do not resurrect stale data on unmount.
      if (window.localStorage.getItem(draftKey) === null) {
        return;
      }
      if (draftSnapshotRef.current && isSaleDraftSaveEligible(draftSnapshotRef.current)) {
        window.localStorage.setItem(draftKey, JSON.stringify(draftSnapshotRef.current));
      }
    };
  }, [draftKey]);

  const filteredCustomers = useMemo(() => {
    const list = Array.isArray(localCustomers) ? localCustomers : [];
    if (!customerSearch) return list;
    const searchLower = customerSearch.toLowerCase();
    return list.filter(c =>
      c?.name?.toLowerCase().includes(searchLower) ||
      c?.phone?.includes(customerSearch) ||
      c?.tax_id?.includes(customerSearch)
    );
  }, [localCustomers, customerSearch]);

  const warehouseById = useMemo(
    () => new Map((warehouses || []).map((warehouse) => [String(warehouse.warehouse_id), warehouse])),
    [warehouses]
  );

  const inventoryByProductId = useMemo(() => {
    const map = new Map();
    if (Array.isArray(inventory)) {
      for (let i = 0; i < inventory.length; i++) {
        const row = inventory[i];
        const pid = String(row?.product_id || "");
        if (!pid) continue;
        let list = map.get(pid);
        if (!list) {
          list = [];
          map.set(pid, list);
        }
        list.push(row);
      }
    }
    return map;
  }, [inventory]);

  const crossBranchByProductId = useMemo(() => {
    const map = new Map();
    if (Array.isArray(crossBranchInventory)) {
      for (let i = 0; i < crossBranchInventory.length; i++) {
        const row = crossBranchInventory[i];
        if (Number(row?.quantity || 0) <= 0) continue;
        const pid = String(row?.product_id || "");
        if (!pid) continue;
        let list = map.get(pid);
        if (!list) {
          list = [];
          map.set(pid, list);
        }
        list.push(row);
      }
    }
    return map;
  }, [crossBranchInventory]);

  const inventoryByWarehouseQuickView = useMemo(() => {
    const map = {};
    if (Array.isArray(inventory)) {
      for (let i = 0; i < inventory.length; i++) {
        const row = inventory[i];
        const pid = String(row?.product_id || "");
        if (!pid) continue;
        if (!map[pid]) map[pid] = [];
        map[pid].push(row);
      }
    }
    return map;
  }, [inventory]);

  const inventoryByProductQuickView = useMemo(() => {
    const map = {};
    if (Array.isArray(inventory)) {
      for (let i = 0; i < inventory.length; i++) {
        const row = inventory[i];
        const pid = String(row?.product_id || "");
        if (!pid) continue;
        map[pid] = (map[pid] || 0) + (Number(row?.quantity) || 0);
      }
    }
    return map;
  }, [inventory]);

  const indexedProducts = useMemo(() => {
    const list = Array.isArray(products) ? products : [];
    return list.map((p) => {
      const codeValues = [p?.sku, p?.barcode, p?.ean, p?.upc, p?.product_id]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase().trim());
      const searchableText = `${p?.name || ""} ${p?.sku || ""} ${p?.category || ""} ${p?.subcategory || ""} ${p?.brand || ""}`.toLowerCase();
      return {
        product: p,
        codeValues,
        searchableText,
      };
    });
  }, [products]);

  const filteredProducts = useMemo(() => {
    const term = (deferredProductSearch || "").trim().toLowerCase();
    if (!term) return Array.isArray(products) ? products : [];

    const tokens = term.split(/\s+/).filter(Boolean);
    const matched = [];

    for (let i = 0; i < indexedProducts.length; i++) {
      const item = indexedProducts[i];
      // 1. Exact or partial code match
      const hasCodeMatch = item.codeValues.some((v) => v.includes(term));
      if (hasCodeMatch) {
        matched.push(item.product);
        continue;
      }
      // 2. Multi-token match across name, brand, category, subcategory
      const allTokensMatch = tokens.every((token) => item.searchableText.includes(token));
      if (allTokensMatch) {
        matched.push(item.product);
      }
    }

    // Si hay un vehículo seleccionado o si está activo el switch de Solo compatibles
    if (selectedVehicleData && (logisticMode === "installed" || onlyCompatibleProducts)) {
      const scored = matched.map((product) => ({
        product,
        compat: getProductVehicleCompatibility(product, selectedVehicleData),
      }));

      const finalItems = onlyCompatibleProducts
        ? scored.filter((s) => s.compat.isCompatible)
        : scored;

      finalItems.sort((a, b) => {
        if (a.compat.isCompatible && !b.compat.isCompatible) return -1;
        if (!a.compat.isCompatible && b.compat.isCompatible) return 1;
        return 0;
      });
      return finalItems.map((s) => s.product);
    }

    return matched;
  }, [indexedProducts, products, deferredProductSearch, selectedVehicleData, logisticMode, onlyCompatibleProducts]);

  const MAX_SEARCH_DROPDOWN_ITEMS = 30;
  const visibleProducts = useMemo(() => {
    return filteredProducts.slice(0, MAX_SEARCH_DROPDOWN_ITEMS);
  }, [filteredProducts]);

  const getProductStockThreshold = useCallback((product) => {
    const thresholdCandidates = [
      product?.min_stock,
      product?.minimum_stock,
      product?.stock_min,
      product?.reorder_point,
      product?.low_stock_threshold,
    ];
    return thresholdCandidates
      .map((value) => Number(value))
      .find((value) => Number.isFinite(value)) ?? 5;
  }, []);

  const getFallbackProductStock = useCallback((product) => {
    const stockCandidates = [
      product?.available_stock,
      product?.stock,
      product?.quantity,
      product?.qty,
      product?.inventory_quantity,
      product?.stock_quantity,
    ];
    return stockCandidates
      .map((value) => Number(value))
      .find((value) => Number.isFinite(value));
  }, []);

  const getLocalStoreStockValue = useCallback((product) => {
    const normalizedProductId = String(product?.product_id || "");
    if (!normalizedProductId) return getFallbackProductStock(product);

    const productRows = inventoryByProductId.get(normalizedProductId) || [];

    if (productRows.length === 0) {
      return getFallbackProductStock(product);
    }

    const userBranchId = String(user?.branch_id || "");
    if (userBranchId) {
      let total = 0;
      for (let i = 0; i < productRows.length; i++) {
        const row = productRows[i];
        const warehouse = warehouseById.get(String(row?.warehouse_id || ""));
        const branchId = String(warehouse?.branch_id || "");
        if (branchId === userBranchId) {
          total += Number(row?.quantity || 0);
        }
      }
      return total;
    }

    // If seller has no assigned branch, we cannot infer "local store" stock reliably.
    // Keep tone policy strict to seller store only by treating local stock as zero.
    return 0;
  }, [getFallbackProductStock, inventoryByProductId, user?.branch_id, warehouseById]);

  const getProductStockStatus = useCallback((product, isServiceProduct) => {
    if (isServiceProduct) return "service";

    const stockValue = getLocalStoreStockValue(product);
    const lowStockThreshold = getProductStockThreshold(product);

    if (!Number.isFinite(stockValue)) return "in_stock";
    if (stockValue <= 0) return "out_of_stock";
    if (stockValue <= lowStockThreshold) return "low_stock";
    return "in_stock";
  }, [getLocalStoreStockValue, getProductStockThreshold]);

  const getProductTone = useCallback(
    (stockStatus, isServiceProduct) => getErpProductTone(stockStatus, isServiceProduct),
    []
  );

  const saleFlowSteps = useMemo(
    () => buildSaleFlowSteps({
      stepOneComplete,
      stepTwoComplete,
      cartCount: normalizedCartItems.length,
    }),
    [stepOneComplete, stepTwoComplete, normalizedCartItems.length]
  );

  const productsById = useMemo(
    () => new Map((products || []).map((product) => [String(product.product_id), product])),
    [products]
  );

  const needsPrecio2Approval = useMemo(
    () => cartNeedsPrecio2Approval(normalizedCartItems, productsById, { isSupervisor: isSupervisorUser }),
    [normalizedCartItems, productsById, isSupervisorUser],
  );

  const precio2CartSignature = useMemo(
    () => buildPrecio2CartSignature(normalizedCartItems, productsById),
    [normalizedCartItems, productsById],
  );

  const isCommercialHouseSale = Boolean(
    salePricingContext?.pricing_profile === "casa_comercial"
    && salePricingContext?.can_serve_commercial_house,
  );

  useEffect(() => {
    const customerId = selectedCustomer?.customer_id;
    if (!customerId) {
      setSalePricingContext(null);
      setActivePriceTier(TIER_PRECIO1);
      setAuditEvents([]);
      setPrecio2ApprovalId(null);
      setCommercialIncludeInstallation(false);
      setCommercialIncludeDelivery(false);
      return undefined;
    }
    let cancelled = false;
    axios.get(`${API}/pricing/sale-context`, {
      params: { customer_id: customerId },
      withCredentials: true,
    })
      .then((response) => {
        if (!cancelled) {
          const ctx = response.data || null;
          setSalePricingContext(ctx);
          if (ctx?.default_price_tier) {
            setActivePriceTier((prev) => prev === TIER_PRECIO1 ? ctx.default_price_tier : prev);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setSalePricingContext(null);
      });
    return () => { cancelled = true; };
  }, [selectedCustomer?.customer_id]);

  const applyActiveTierChange = useCallback((newTier) => {
    const fromTier = activePriceTier;
    if (!newTier || newTier === fromTier) return;
    const repriced = repriceCartItemsForTier(normalizedCartItems, productsById, newTier);
    const auditEvent = buildTierChangeAuditEvent({ user, fromTier, toTier: newTier });
    const nextAudit = [auditEvent, ...auditEvents];
    setActivePriceTier(newTier);
    setCartItems(repriced);
    setAuditEvents(nextAudit);
    // Switching tiers invalidates any prior Precio 2 authorization
    clearPrecio2Approval();
    persistDraftSnapshot({ activePriceTier: newTier, cartItems: repriced, auditEvents: nextAudit });
    const needsApproval = tierRequiresSupervisorApproval(newTier, user);
    if (needsApproval) {
      toast.warning(
        `${TIER_LABELS[newTier] || newTier} aplicado. Debes solicitar y obtener aprobación de supervisión/gerencia antes de facturar.`,
      );
    } else {
      toast.success(`${TIER_LABELS[newTier] || newTier} aplicado a todas las líneas`);
    }
    setTierChangeConfirmOpen(false);
    setPendingTierChange(null);
  }, [
    activePriceTier,
    auditEvents,
    clearPrecio2Approval,
    normalizedCartItems,
    persistDraftSnapshot,
    productsById,
    user,
  ]);

  const handleActiveTierChange = useCallback((newTier) => {
    if (!newTier || newTier === activePriceTier) return;
    if (normalizedCartItems.length > 0) {
      setPendingTierChange(newTier);
      setTierChangeConfirmOpen(true);
      return;
    }
    applyActiveTierChange(newTier);
  }, [activePriceTier, applyActiveTierChange, normalizedCartItems.length]);

  // Invalidate approval when customer changes or Precio 2 lines/prices change
  useEffect(() => {
    clearPrecio2Approval();
  }, [selectedCustomer?.customer_id, clearPrecio2Approval]);

  useEffect(() => {
    if (!needsPrecio2Approval) {
      clearPrecio2Approval();
      return;
    }
    if (
      precio2ApprovalStatus === "approved"
      && precio2ApprovedSignature
      && precio2ApprovedSignature !== precio2CartSignature
    ) {
      clearPrecio2Approval();
      toast.message("Cambiaste líneas/precios de Precio 2: se requiere nueva aprobación");
    }
  }, [
    clearPrecio2Approval,
    needsPrecio2Approval,
    precio2ApprovalStatus,
    precio2ApprovedSignature,
    precio2CartSignature,
  ]);

  // Poll pending Precio 2 approval so the seller can finalize only when approved
  useEffect(() => {
    if (!precio2ApprovalId || precio2ApprovalStatus !== "pending") return undefined;
    let cancelled = false;

    const poll = async () => {
      try {
        const response = await axios.get(`${API}/approvals/${precio2ApprovalId}`, {
          withCredentials: true,
        });
        if (cancelled) return;
        const status = String(response.data?.status || "").toLowerCase();
        if (status === "approved") {
          setPrecio2ApprovalStatus("approved");
          setPrecio2ApprovedSignature(precio2CartSignature);
          toast.success("Precio 2 aprobado por supervisión. Ya puedes facturar.");
        } else if (status === "rejected") {
          setPrecio2ApprovalStatus("rejected");
          toast.error("La solicitud de Precio 2 fue rechazada");
        }
      } catch {
        // Keep pending; next tick retries
      }
    };

    poll();
    const timer = window.setInterval(poll, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [precio2ApprovalId, precio2ApprovalStatus, precio2CartSignature]);

  const scrollProductList = (delta) => {
    const list = productListRef.current;
    if (!list) return;
    if (list.scrollHeight <= list.clientHeight) return;
    const next = Math.max(0, Math.min(list.scrollTop + delta, list.scrollHeight - list.clientHeight));
    list.scrollTop = next;
  };

  const handleProductSearchWheel = (event) => {
    if (!productSearch.trim()) return;
    const list = productListRef.current;
    if (!list || list.scrollHeight <= list.clientHeight) return;
    event.preventDefault();
    scrollProductList(event.deltaY);
  };

  const handleProductSearchKeyDown = (event) => {
    if (!productSearch.trim()) return;
    if (event.key === "PageDown") {
      event.preventDefault();
      scrollProductList(220);
    }
    if (event.key === "PageUp") {
      event.preventDefault();
      scrollProductList(-220);
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setProductHighlightIndex((prev) => Math.min(prev + 1, Math.max(filteredProducts.length - 1, 0)));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setProductHighlightIndex((prev) => Math.max(prev - 1, 0));
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const item = filteredProducts[productHighlightIndex];
      if (item) {
        const list = productListRef.current;
        const sourceElement = list?.querySelector(`[data-index="${productHighlightIndex}"]`) || null;
        addToCart(item, { sourceElement });
      }
    }
    if (event.key === "Escape") {
      event.preventDefault();
      clearProductSearch();
    }
  };

  const handleCustomerSearchKeyDown = (event) => {
    if (!customerSearch.trim()) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCustomerHighlightIndex((prev) => Math.min(prev + 1, Math.max(filteredCustomers.length - 1, 0)));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setCustomerHighlightIndex((prev) => Math.max(prev - 1, 0));
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const item = filteredCustomers[customerHighlightIndex];
      if (item) {
        handleSelectCustomer(item);
      }
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setCustomerSearch("");
    }
  };

  useEffect(() => {
    setCustomerHighlightIndex(0);
  }, [customerSearch, filteredCustomers.length, handleSelectCustomer]);

  useEffect(() => {
    setProductHighlightIndex(0);
    if (productListRef.current) {
      productListRef.current.scrollTop = 0;
    }
  }, [deferredProductSearch, filteredProducts.length]);

  useEffect(() => {
    const list = customerListRef.current;
    if (!list) return;
    const item = list.querySelector(`[data-index="${customerHighlightIndex}"]`);
    if (item) item.scrollIntoView({ block: "nearest" });
  }, [customerHighlightIndex]);

  useEffect(() => {
    const list = productListRef.current;
    if (!list) return;
    const item = list.querySelector(`[data-index="${productHighlightIndex}"]`);
    if (item) item.scrollIntoView({ block: "nearest" });
  }, [productHighlightIndex]);

  useEffect(() => {
    const handleShortcut = (event) => {
      if (event.altKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        customerSearchRef.current?.focus();
      }
      if (event.altKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        productSearchRef.current?.focus();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (draftKey) {
          persistDraftSnapshot();
          // Mensaje eliminado para autoguardado silencioso
        } else {
          // Mensaje eliminado para autoguardado silencioso
        }
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [draftKey, persistDraftSnapshot]);

  useEffect(() => {
    const stepOneDone = Boolean(selectedCustomer?.customer_id);
    const stepTwoSelected = stepOneDone && stepTwoComplete;

    if (!stepTwoSelected) {
      didStepThreeAutoScrollRef.current = false;
      return;
    }

    if (didStepThreeAutoScrollRef.current || typeof window === "undefined") return;
    if (!window.matchMedia("(min-width: 1024px)").matches) return;

    const leftPane = leftPaneRef.current;
    const stepThreeSection = stepThreeSectionRef.current;
    const stepFourSection = stepFourSectionRef.current;
    if (!stepThreeSection || !stepFourSection) return;

    didStepThreeAutoScrollRef.current = true;
    window.requestAnimationFrame(() => {
      const stepThreeTop = stepThreeSection.getBoundingClientRect().top;
      const stepFourTop = stepFourSection.getBoundingClientRect().top;
      const delta = stepThreeTop - stepFourTop;

      if (Math.abs(delta) > 8) {
        if (leftPane && leftPane.scrollHeight > leftPane.clientHeight) {
          leftPane.scrollBy({ top: delta, behavior: "smooth" });
        } else {
          window.scrollBy({ top: delta, behavior: "smooth" });
        }
      }

      window.requestAnimationFrame(() => {
        productSearchRef.current?.focus();
      });
    });
  }, [selectedCustomer?.customer_id, stepTwoComplete]);

  useEffect(() => {
    return () => clearBreakdownTimers();
  }, [clearBreakdownTimers]);

  useEffect(() => {
    if (!clearProductSearchAfterCartUpdateRef.current) return;
    clearProductSearchAfterCartUpdateRef.current = false;
    clearProductSearch();
  }, [cartItems, clearProductSearch]);

  useEffect(() => {
    return () => {
      clearProductTransferAnimation();
      if (cartFlashTimerRef.current) {
        clearTimeout(cartFlashTimerRef.current);
        cartFlashTimerRef.current = null;
      }
    };
  }, [clearProductTransferAnimation]);

  useEffect(() => {
    if (stepTwoComplete && !prevStepTwoCompleteRef.current) {
      setStepThreeUnlockFlash(true);
      const timer = window.setTimeout(() => setStepThreeUnlockFlash(false), 700);
      prevStepTwoCompleteRef.current = stepTwoComplete;
      return () => window.clearTimeout(timer);
    }
    prevStepTwoCompleteRef.current = stepTwoComplete;
  }, [stepTwoComplete]);

  return (
    <div className="space-y-4">
      {sellerReleasedRestricted ? (
        <div className={ERP_SEMANTIC_TONES?.restrictedBanner || "rounded-lg border border-violet-300/70 bg-violet-50/80 px-3 py-2 text-xs text-violet-900 dark:border-violet-500/35 dark:bg-violet-500/10 dark:text-violet-100"}>
          Borrador liberado por supervisión. Cliente, vehículo, líneas existentes, método de pago y retención IR están bloqueados; puedes agregar productos nuevos y ajustar montos del plan de cobro acordado.
        </div>
      ) : null}
      <SaleFlowStepProgress steps={saleFlowSteps} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6 lg:items-start">
      {productTransferAnimation ? (
        <div
          className={cn(
            "pointer-events-none fixed z-50 rounded-2xl border border-sky-200/70 bg-gradient-to-br from-white via-sky-50 to-emerald-50 p-3 shadow-[0_18px_45px_rgba(14,165,233,0.28)] ring-1 ring-white/80 backdrop-blur-sm transition-all duration-700 ease-out",
            productTransferAnimation.active ? "opacity-0 scale-95" : "opacity-100 scale-100"
          )}
          style={{
            left: `${productTransferAnimation.active ? productTransferAnimation.endLeft : productTransferAnimation.startLeft}px`,
            top: `${productTransferAnimation.active ? productTransferAnimation.endTop : productTransferAnimation.startTop}px`,
            width: `${productTransferAnimation.active ? productTransferAnimation.endWidth : productTransferAnimation.startWidth}px`,
            height: `${productTransferAnimation.active ? productTransferAnimation.endHeight : productTransferAnimation.startHeight}px`,
          }}
        >
          <div className="flex h-full items-center gap-3 overflow-hidden">
            <div className="h-12 w-12 shrink-0 rounded-xl bg-gradient-to-br from-sky-200 via-white to-emerald-200 shadow-inner ring-1 ring-white/70" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{productTransferAnimation.title}</p>
              <p className="truncate text-[11px] text-slate-600">{productTransferAnimation.sku}</p>
            </div>
          </div>
        </div>
      ) : null}
      <div ref={leftPaneRef} className="space-y-4 lg:pr-1 lg:min-h-[28rem]">
        <div className="shrink-0 overflow-hidden">
          <Label className="inline-flex items-center gap-2">
            <User className="h-4 w-4" />
            <span>Paso 1: Agregar Cliente/Empresa o buscar en la lista</span>
          </Label>
          {!selectedCustomer ? (
            <div className="flex items-center gap-2 mb-2 mt-2">
              <div className="relative flex-1">
                <UserSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, teléfono o cédula..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  onKeyDown={handleCustomerSearchKeyDown}
                  ref={customerSearchRef}
                  disabled={sellerFlowLocked}
                  className="mb-0 pl-9"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={sellerFlowLocked}
                onClick={() => {
                  setShowNewCustomer(true);
                  persistDraftSnapshot({ showNewCustomer: true });
                }}
                title="Nuevo Registro"
                className={cn(
                  "ui-interactive border-emerald-500/40 bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/20 dark:text-emerald-200",
                  isPortraitOrientation ? "px-2" : ""
                )}
              >
                <UserPlus className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                <Building2 className={cn("h-4 w-4 text-emerald-700 dark:text-emerald-300", isPortraitOrientation ? "" : "mr-2")} />
                {!isPortraitOrientation ? "Nuevo Registro" : <span className="sr-only">Nuevo Registro</span>}
              </Button>
            </div>
          ) : null}
          {selectedCustomer ? (
            <div className={cn("mt-1 mb-3", CUSTOMER_VEHICLE_CARD_PATTERNS.shared.shell, CUSTOMER_VEHICLE_CARD_PATTERNS.customer.shell)}>
              <div className={CUSTOMER_VEHICLE_CARD_PATTERNS.shared.split}>
                <div className={CUSTOMER_VEHICLE_CARD_PATTERNS.shared.info}>
                  <p className={CUSTOMER_VEHICLE_CARD_PATTERNS.customer.title}>
                    {isCompanyCustomer(selectedCustomer) ? <Building2 className="h-4 w-4 text-blue-700" /> : <User className="h-4 w-4 text-emerald-700" />}
                    <span className="min-w-0 whitespace-normal break-words leading-tight">{selectedCustomer.name}</span>
                  </p>

                  <div className={CUSTOMER_VEHICLE_CARD_PATTERNS.customer.metaGrid}>
                    <p className="inline-flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-emerald-700" />
                      {selectedCustomer.phone || "Sin teléfono"}
                    </p>
                    <p className="inline-flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-emerald-700" />
                      {isCompanyCustomer(selectedCustomer) ? "RUC" : "Cédula"}: {selectedCustomer.tax_id || "Sin registro"}
                    </p>
                    <p className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-emerald-700" />
                      {selectedCustomer.address || selectedCustomer.shipping_address || selectedCustomer.billing_address || "Sin dirección"}
                    </p>
                    <p className="inline-flex items-center gap-1.5 font-semibold text-emerald-900">
                      <Car className="h-3.5 w-3.5 text-emerald-700" />
                      {customerVehicles.length} {customerVehicles.length === 1 ? "vehículo" : "vehículos"}
                    </p>
                  </div>
                </div>

                <div className={CUSTOMER_VEHICLE_CARD_PATTERNS.shared.actions}>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-10 px-4 text-sm font-medium"
                    disabled={sellerFlowLocked}
                    onClick={handleClearSelectedCustomer}
                  >
                    <RefreshCcw className="h-4 w-4 mr-2" />
                    Cambiar
                  </Button>
                  <Badge variant="outline" className={CUSTOMER_VEHICLE_CARD_PATTERNS.customer.badge}>
                    {isCompanyCustomer(selectedCustomer) ? "Empresa" : "Cliente"}
                  </Badge>
                  {salePricingContext?.default_price_tier_label ? (
                    <Badge variant="outline" className="border-violet-300 bg-violet-50 text-violet-800">
                      {salePricingContext.default_price_tier_label}
                    </Badge>
                  ) : null}
                </div>
              </div>
              {salePricingContext?.pricing_profile === "casa_comercial" && !salePricingContext?.can_serve_commercial_house && !isSupervisorUser ? (
                <p className="mt-2 text-xs text-amber-700">
                  Este cliente Casa Comercial requiere un Vendedor VIP o supervisión.
                </p>
              ) : null}
              {selectedCustomer && salePricingContext ? (
                <div className="mt-3 space-y-2">
                  <PriceTierSelector
                    user={user}
                    pricingContext={salePricingContext}
                    activeTier={activePriceTier}
                    onTierChange={handleActiveTierChange}
                    disabled={sellerFlowLocked}
                    precio2ApprovalStatus={precio2ApprovalStatus}
                  />
                  {Array.isArray(auditEvents) && auditEvents.some((e) => e?.event_type === "tier_change") ? (
                    <DocumentAuditPanel
                      events={auditEvents.filter((e) => e?.event_type === "tier_change").slice(0, 3)}
                      activePriceTier={activePriceTier}
                      activePriceTierLabel={TIER_LABELS[activePriceTier]}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {!selectedCustomer ? (
            customerSearch.trim() ? (
              <div
                ref={customerListRef}
                className={cn(
                  "rounded-lg border p-2",
                  filteredCustomers.length > 6
                    ? "max-h-64 overflow-y-auto overscroll-contain"
                    : "overflow-hidden"
                )}
              >
                {filteredCustomers.length === 0 ? (
                  <p className="text-center text-muted-foreground p-4">Sin resultados</p>
                ) : (
                  <div className="grid gap-2 md:grid-cols-2">
                    {filteredCustomers.map((c, index) => {
                      const isCompany = isCompanyCustomer(c);
                      const isHighlighted = index === customerHighlightIndex;
                      const typeLabel = isCompany ? "Empresa" : "Cliente";
                      const rowAddress = c.address || c.shipping_address || c.billing_address || "Sin dirección";
                      const taxLabel = isCompany ? "RUC" : "Cédula";
                      const rowVehicleCount = customerVehicleCountById[c.customer_id] || 0;
                      const rowTone = getErpCustomerSearchRowTone(isCompany, isHighlighted);
                      return (
                        <button
                          key={c.customer_id}
                          data-index={index}
                          type="button"
                          className={cn(rowTone.row, ERP_SEARCH_ROW.customer)}
                          onClick={() => handleSelectCustomer(c)}
                          onMouseEnter={() => setCustomerHighlightIndex(index)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className={cn("text-sm font-semibold inline-flex min-w-0 items-center gap-1.5", rowTone.title)}>
                              {isCompany ? <Building2 className="h-4 w-4 shrink-0 text-blue-700 dark:text-blue-300" /> : <User className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />}
                              <span className="truncate">{c.name}</span>
                            </p>
                            <Badge variant="outline" className={cn("shrink-0 text-[10px]", rowTone.badge)}>
                              {typeLabel}
                            </Badge>
                          </div>
                          <div className={cn("mt-1.5 grid gap-x-3 gap-y-1 text-[11px] sm:grid-cols-2", rowTone.meta)}>
                            <p className="inline-flex items-center gap-1.5">
                              <Phone className="h-3 w-3" />
                              <span className="truncate">{c.phone || "Sin teléfono"}</span>
                            </p>
                            <p className="inline-flex items-center gap-1.5">
                              <FileText className="h-3 w-3" />
                              <span className="truncate">{taxLabel}: {c.tax_id || "Sin registro"}</span>
                            </p>
                            <p className="inline-flex items-center gap-1.5">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate">{rowAddress}</span>
                            </p>
                            <p className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                              <Car className="h-3 w-3" />
                              <span>{rowVehicleCount} {rowVehicleCount === 1 ? "vehículo" : "vehículos"}</span>
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Escribe para buscar clientes</p>
            )
          ) : null}
        </div>

        <div
          ref={stepTwoSectionRef}
          className={cn(
            "space-y-2 animate-fade-up-soft",
            !stepOneComplete ? ERP_ANIMATION_CLASSES.stepLocked : ERP_ANIMATION_CLASSES.stepUnlocked
          )}
        >
          <Label className="inline-flex items-center gap-2">
            <Truck className="h-4 w-4" />
            <span>Paso 2: ¿Cómo se entrega esta venta?</span>
          </Label>
          {!stepOneComplete ? (
            <p className="text-xs text-muted-foreground">Completa el paso 1 para habilitar la forma de entrega</p>
          ) : null}

          {!selectedCustomer ? (
            <p className="text-xs text-muted-foreground">Primero selecciona un cliente</p>
          ) : null}

          {showFulfillmentChooser ? (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 ui-fade-in-stagger dark:border-slate-700 dark:bg-slate-900/30">
              <p className="text-xs text-muted-foreground">
                Elige cómo se entregará esta venta. Esto habilita el paso de productos.
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  disabled={sellerFlowLocked}
                  onClick={() => handleSelectFulfillmentMode("carryout")}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors ui-interactive",
                    logisticMode === "carryout"
                      ? "border-emerald-500 bg-emerald-100/80 dark:border-emerald-500/50 dark:bg-emerald-500/20"
                      : "border-emerald-200 bg-white hover:bg-emerald-50/80 dark:border-emerald-500/30 dark:bg-slate-900/40",
                  )}
                >
                  <p className="font-medium inline-flex items-center gap-1.5 text-emerald-900 dark:text-emerald-100">
                    <Package className="h-4 w-4" />
                    Para llevar
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Cliente recoge — sin instalación ni envío</p>
                </button>
                <button
                  type="button"
                  disabled={sellerFlowLocked}
                  onClick={() => handleSelectFulfillmentMode("delivery")}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors ui-interactive",
                    logisticMode === "delivery"
                      ? "border-amber-500 bg-amber-100/80 dark:border-amber-500/50 dark:bg-amber-500/20"
                      : "border-amber-200 bg-white hover:bg-amber-50/80 dark:border-amber-500/30 dark:bg-slate-900/40",
                  )}
                >
                  <p className="font-medium inline-flex items-center gap-1.5 text-amber-900 dark:text-amber-100">
                    <Truck className="h-4 w-4" />
                    Con envío incluido
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Delivery con mensajero — sin instalación</p>
                </button>
                <button
                  type="button"
                  disabled={sellerFlowLocked}
                  onClick={() => handleSelectFulfillmentMode("installed")}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors ui-interactive",
                    logisticMode === "installed"
                      ? "border-sky-500 bg-sky-100/80 dark:border-sky-500/50 dark:bg-sky-500/20"
                      : "border-sky-200 bg-white hover:bg-sky-50/80 dark:border-sky-500/30 dark:bg-slate-900/40",
                  )}
                >
                  <p className="font-medium inline-flex items-center gap-1.5 text-sky-900 dark:text-sky-100">
                    <Wrench className="h-4 w-4" />
                    Instalado en vehículo
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Trabajo en taller — requiere vehículo del cliente</p>
                </button>
              </div>

              {logisticMode === "installed" ? (
                <div className="space-y-2">
                  <Label className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                    <CarFront className="h-4 w-4" />
                    Seleccionar vehículo
                  </Label>

                  {pendingVehicleTransfer ? (
                    <div className="rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50/90 dark:bg-amber-950/40 p-3.5 shadow-sm space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0">
                            <CarFront className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-xs text-amber-950 dark:text-amber-100">
                                Solicitud de Traspaso de Vehículo Pendiente
                              </p>
                              <Badge variant="outline" className="bg-amber-200/60 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 text-[10px] py-0 font-medium">
                                En revisión
                              </Badge>
                            </div>
                            <p className="text-xs text-amber-900/90 dark:text-amber-200/90 mt-0.5">
                              Vehículo <strong>{[pendingVehicleTransfer.brand, pendingVehicleTransfer.model, pendingVehicleTransfer.year].filter(Boolean).join(" ")}</strong> (Placa: <strong>{pendingVehicleTransfer.plate}</strong>, Chasis: <strong>{pendingVehicleTransfer.vin}</strong>)
                            </p>
                            <p className="text-[11px] text-amber-800/80 dark:text-amber-300/70 mt-0.5">
                              Dueño anterior: <strong>{pendingVehicleTransfer.previous_customer_name}</strong> ➔ Nuevo dueño: <strong>{pendingVehicleTransfer.target_customer_name}</strong>
                            </p>
                            {pendingVehicleTransfer.reason ? (
                              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 italic mt-0.5">
                                Motivo: "{pendingVehicleTransfer.reason}"
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {isSupervisorUser ? (
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-200/60 dark:border-amber-800/40">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isTransferringVehicle}
                            onClick={() => handleApproveDraftTransfer(false)}
                            className="h-8 text-xs text-rose-700 hover:text-rose-800 hover:bg-rose-50 border-rose-200 dark:border-rose-900"
                          >
                            Rechazar traspaso
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={isTransferringVehicle}
                            onClick={() => handleApproveDraftTransfer(true)}
                            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5 shadow-sm"
                          >
                            {isTransferringVehicle ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            Aprobar Traspaso de Vehículo
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-amber-200/60 dark:border-amber-800/40 text-[11px] text-amber-800 dark:text-amber-300">
                          <span>Esperando que Gerencia o Supervisión apruebe el traspaso en este borrador.</span>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setPendingVehicleTransfer(null);
                              persistDraftSnapshot({ pending_vehicle_transfer: null });
                              toast.info("Solicitud de traspaso cancelada");
                            }}
                            className="h-7 text-xs text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          >
                            Cancelar solicitud
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : null}

                  <div className={`grid gap-2 ${customerVehicles.length ? "sm:grid-cols-2" : ""}`}>
                    {customerVehicles.map((v) => {
                      const plate = v.plate || v.plate_number || v.number_plate || "Sin placa";
                      const vin = v.vin || v.chasis || v.chassis || "Sin chasis";
                      const color = v.color || v.vehicle_color || v.colour || "Sin color";
                      const catalogHint = formatVehicleIdentityHint(v.brand, v.year, v.model);
                      const vehicleOptionId = normalizeVehicleId(v.vehicle_id ?? v.id);
                      const isActiveVehicle = selectedVehicleOption === `vehicle:${vehicleOptionId}`;
                      const vehicleImg = getVehicleDisplayImage(v);
                      return (
                        <button
                          key={v.vehicle_id ?? v.id}
                          type="button"
                          disabled={sellerFlowLocked}
                          onClick={() => handleSelectVehicleFlow("registered", vehicleOptionId)}
                          className={cn(
                            "group relative rounded-xl border p-3 text-left transition-all ui-interactive flex items-center justify-between gap-2.5 overflow-hidden shadow-sm",
                            isActiveVehicle
                              ? "border-sky-500 bg-sky-100/90 dark:border-sky-500/50 dark:bg-sky-500/20 ring-2 ring-sky-500/40"
                              : "border-sky-200 bg-sky-50/80 hover:bg-sky-100/80 dark:border-sky-500/30 dark:bg-sky-500/10 dark:hover:bg-sky-500/20",
                          )}
                        >
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <p className="font-bold text-sky-950 dark:text-sky-100 inline-flex items-center gap-1.5 truncate">
                              <CarFront className="h-4 w-4 shrink-0 text-sky-700 dark:text-sky-300" />
                              {[v.brand, v.model, v.year].filter(Boolean).join(" ") || "Vehículo"}
                            </p>
                            {catalogHint ? (
                              <p className="text-[11px] text-sky-800/90 truncate">{catalogHint}</p>
                            ) : null}
                            <p className="text-xs font-semibold text-sky-900 dark:text-sky-200">{plate}</p>
                            <p className="text-[11px] text-sky-700 dark:text-sky-300/80 truncate">{vin} • {color}</p>
                          </div>

                          {vehicleImg?.src ? (
                            <div className="shrink-0 h-12 sm:h-14 w-20 sm:w-24 rounded-lg bg-white/80 dark:bg-zinc-900/80 border border-sky-200/60 dark:border-sky-700/40 flex items-center justify-center p-1 shadow-inner overflow-hidden group-hover:scale-105 transition-transform">
                              <img
                                src={vehicleImg.src}
                                alt={[v.brand, v.model].filter(Boolean).join(" ")}
                                className="max-h-full max-w-full object-contain drop-shadow-sm"
                                loading="lazy"
                              />
                            </div>
                          ) : null}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      disabled={sellerFlowLocked}
                      onClick={() => {
                        setShowNewVehicleDialog(true);
                        handleSelectVehicleFlow("new", "");
                      }}
                      className={cn(
                        "rounded-lg border p-3 text-left transition-colors ui-interactive",
                        selectedVehicleOption === "new"
                          ? "border-violet-500 bg-violet-100/80 dark:border-violet-500/50 dark:bg-violet-500/20"
                          : "border-violet-200 bg-violet-50/80 hover:bg-violet-100/80 dark:border-violet-500/30 dark:bg-violet-500/10 dark:hover:bg-violet-500/20",
                      )}
                    >
                      <p className="font-medium text-violet-900 dark:text-violet-100 inline-flex items-center gap-1.5">
                        <PlusCircle className="h-4 w-4 text-violet-700 dark:text-violet-300" />
                        Registrar nuevo vehículo
                      </p>
                      <p className="text-xs text-violet-800 mt-1">Agregar otro vehículo a este cliente</p>
                    </button>
                  </div>
                </div>
              ) : null}

              {logisticMode === "delivery" ? (
                <div className="grid gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3 sm:grid-cols-2 dark:border-amber-500/30 dark:bg-amber-500/10">
                  <div className="space-y-1.5">
                    <Label>Tipo de destino</Label>
                    <Select
                      value={deliveryDestinationType}
                      onValueChange={(value) => {
                        setDeliveryDestinationType(value);
                        persistDraftSnapshot({ deliveryDestinationType: value });
                      }}
                      disabled={sellerFlowLocked}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione destino" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="domicilio">A domicilio</SelectItem>
                        <SelectItem value="terminal_buses">A terminal de buses</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Costo de envío</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={deliveryCost}
                      onChange={(e) => setDeliveryCost(e.target.value)}
                      onBlur={() => persistDraftSnapshot({ deliveryCost })}
                      disabled={sellerFlowLocked}
                      placeholder="Tarifa cobrada al cliente"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Mensajero asignado</Label>
                    {messengerLoading ? (
                      <p className="text-xs text-muted-foreground">Cargando mensajeros...</p>
                    ) : messengerLoadFailed ? (
                      <p className="text-xs text-rose-700">
                        No se pudieron cargar los mensajeros. Revisa la conexión o contacta a sistemas.
                      </p>
                    ) : messengerOptions.length === 0 ? (
                      <p className="text-xs text-rose-700">No hay mensajeros configurados para esta sucursal.</p>
                    ) : (
                      <Select
                        value={selectedMessengerId}
                        onValueChange={(value) => {
                          const messenger = messengerOptions.find((row) => row.messenger_id === value);
                          if (messenger && messenger.status === "libre") {
                            toast.error("El mensajero está fuera de turno. Seleccione otro.");
                            return;
                          }
                          setSelectedMessengerId(value);
                          persistDraftSnapshot({ selectedMessengerId: value });
                        }}
                        disabled={sellerFlowLocked}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione mensajero" />
                        </SelectTrigger>
                        <SelectContent>
                          {messengerOptions.map((messenger) => {
                            const fullName = `${messenger.name || ""} ${messenger.last_name || ""}`.trim();
                            const statusLabel = messenger.status_label || messenger.status || "disponible";
                            return (
                              <SelectItem key={messenger.messenger_id} value={messenger.messenger_id}>
                                {fullName} — {statusLabel}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    )}
                    {(() => {
                      const activeMessenger = messengerOptions.find((row) => row.messenger_id === selectedMessengerId);
                      if (!activeMessenger || activeMessenger.status === "disponible") return null;
                      if (activeMessenger.status === "en_ruta") {
                        return (
                          <p className="text-xs text-amber-800">
                            El mensajero asignado está en ruta; puede continuar o elegir otro disponible.
                          </p>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {!showFulfillmentChooser && stepOneComplete && selectedCustomer && logisticMode === "carryout" ? (
            <div className={cn(CUSTOMER_VEHICLE_CARD_PATTERNS.shared.shell, CUSTOMER_VEHICLE_CARD_PATTERNS.carryout.shell)}>
              <div className={CUSTOMER_VEHICLE_CARD_PATTERNS.shared.split}>
                <div className="min-w-0 space-y-1.5">
                  <p className={CUSTOMER_VEHICLE_CARD_PATTERNS.carryout.title}>
                    <Package className="h-4 w-4 shrink-0 text-emerald-700" />
                    Para llevar
                  </p>
                  <p className="text-xs text-emerald-900/90">Cliente recoge — sin instalación ni envío</p>
                </div>
                <div className={CUSTOMER_VEHICLE_CARD_PATTERNS.shared.actions}>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 px-2.5 text-sm font-medium ui-interactive"
                    disabled={sellerFlowLocked}
                    onClick={handleReopenFulfillmentStep}
                  >
                    <RefreshCcw className="h-4 w-4 mr-1.5" />
                    Cambiar
                  </Button>
                  <Badge variant="outline" className={CUSTOMER_VEHICLE_CARD_PATTERNS.carryout.badge}>
                    Para llevar
                  </Badge>
                </div>
              </div>
            </div>
          ) : null}

          {!showFulfillmentChooser && stepOneComplete && selectedCustomer && logisticMode === "delivery" ? (
            <div className="space-y-3">
              <div className={cn(CUSTOMER_VEHICLE_CARD_PATTERNS.shared.shell, "border-amber-300 bg-amber-50/80 dark:border-amber-500/40 dark:bg-amber-500/10")}>
                <div className={CUSTOMER_VEHICLE_CARD_PATTERNS.shared.split}>
                  <div className="min-w-0 space-y-1.5">
                    <p className="font-semibold text-amber-900 dark:text-amber-100 inline-flex items-center gap-1.5">
                      <Truck className="h-4 w-4 shrink-0 text-amber-700" />
                      Con envío incluido
                    </p>
                    <p className="text-xs text-amber-900/90">Delivery con mensajero — sin instalación</p>
                  </div>
                  <div className={CUSTOMER_VEHICLE_CARD_PATTERNS.shared.actions}>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 px-2.5 text-sm font-medium ui-interactive"
                      disabled={sellerFlowLocked}
                      onClick={handleReopenFulfillmentStep}
                    >
                      <RefreshCcw className="h-4 w-4 mr-1.5" />
                      Cambiar
                    </Button>
                    <Badge variant="outline" className="border-amber-300 text-amber-800">
                      Envío
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3 sm:grid-cols-2 dark:border-amber-500/30 dark:bg-amber-500/10">
                <div className="space-y-1.5">
                  <Label>Tipo de destino</Label>
                  <Select
                    value={deliveryDestinationType}
                    onValueChange={(value) => {
                      setDeliveryDestinationType(value);
                      persistDraftSnapshot({ deliveryDestinationType: value });
                    }}
                    disabled={sellerFlowLocked}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione destino" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="domicilio">A domicilio</SelectItem>
                      <SelectItem value="terminal_buses">A terminal de buses</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Costo de envío</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={deliveryCost}
                    onChange={(e) => setDeliveryCost(e.target.value)}
                    onBlur={() => persistDraftSnapshot({ deliveryCost })}
                    disabled={sellerFlowLocked}
                    placeholder="Tarifa cobrada al cliente"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Mensajero asignado</Label>
                  {messengerLoading ? (
                    <p className="text-xs text-muted-foreground">Cargando mensajeros...</p>
                  ) : messengerLoadFailed ? (
                    <p className="text-xs text-rose-700">
                      No se pudieron cargar los mensajeros. Revisa la conexión o contacta a sistemas.
                    </p>
                  ) : messengerOptions.length === 0 ? (
                    <p className="text-xs text-rose-700">No hay mensajeros configurados para esta sucursal.</p>
                  ) : (
                    <Select
                      value={selectedMessengerId}
                      onValueChange={(value) => {
                        const messenger = messengerOptions.find((row) => row.messenger_id === value);
                        if (messenger && messenger.status === "libre") {
                          toast.error("El mensajero está fuera de turno. Seleccione otro.");
                          return;
                        }
                        setSelectedMessengerId(value);
                        persistDraftSnapshot({ selectedMessengerId: value });
                      }}
                      disabled={sellerFlowLocked}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione mensajero" />
                      </SelectTrigger>
                      <SelectContent>
                        {messengerOptions.map((messenger) => {
                          const fullName = `${messenger.name || ""} ${messenger.last_name || ""}`.trim();
                          const statusLabel = messenger.status_label || messenger.status || "disponible";
                          return (
                            <SelectItem key={messenger.messenger_id} value={messenger.messenger_id}>
                              {fullName} — {statusLabel}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {!showFulfillmentChooser && stepOneComplete && selectedCustomer && logisticMode === "installed" && selectedVehicleData ? (() => {
            const selImg = getVehicleDisplayImage(selectedVehicleData);
            const vLabel = [selectedVehicleData.brand, selectedVehicleData.model, selectedVehicleData.year].filter(Boolean).join(" ");
            return (
              <div className={cn("relative overflow-hidden group/cardveh", CUSTOMER_VEHICLE_CARD_PATTERNS.shared.shell, CUSTOMER_VEHICLE_CARD_PATTERNS.vehicle.shell, vehiclePulseActive && ERP_ANIMATION_CLASSES.pulse)}>
                {/* Marca de agua elegante del vehículo en el fondo de la tarjeta */}
                {selImg?.src && (
                  <div
                    aria-hidden="true"
                    className="absolute right-0 sm:right-4 top-1/2 -translate-y-1/2 h-full max-h-[82px] w-44 sm:w-60 opacity-15 dark:opacity-10 pointer-events-none select-none overflow-hidden flex items-center justify-end pr-1"
                  >
                    <img
                      src={selImg.src}
                      alt=""
                      className="h-full w-auto max-w-full object-contain object-right filter grayscale-[20%]"
                      loading="lazy"
                    />
                  </div>
                )}

                <div className="relative z-10 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 sm:gap-4">
                  <div className={cn(CUSTOMER_VEHICLE_CARD_PATTERNS.shared.info, "min-w-0")}>
                    <p className={CUSTOMER_VEHICLE_CARD_PATTERNS.vehicle.title}>
                      <Wrench className="h-4 w-4 shrink-0 text-sky-700 mt-0.5" />
                      <span className="min-w-0 whitespace-normal break-words">
                        Instalado — {vLabel || "Vehículo"}
                      </span>
                    </p>
                    <div className={CUSTOMER_VEHICLE_CARD_PATTERNS.vehicle.metaGrid}>
                      <p className="inline-flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-sky-700 shrink-0" />
                        <span className="truncate">{selectedVehicleData.plate || selectedVehicleData.plate_number || selectedVehicleData.number_plate || "Sin placa"}</span>
                      </p>
                      <p className="inline-flex items-center gap-1.5">
                        <Palette className="h-3.5 w-3.5 text-sky-700 shrink-0" />
                        <span className="truncate">{selectedVehicleData.color || selectedVehicleData.vehicle_color || selectedVehicleData.colour || "Sin color"}</span>
                      </p>
                      <p className="inline-flex items-center gap-1.5 sm:col-span-2">
                        <FileText className="h-3.5 w-3.5 text-sky-700 shrink-0" />
                        <span className="truncate">{selectedVehicleData.vin || selectedVehicleData.chasis || selectedVehicleData.chassis || "Sin chasis"}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
                    {selImg?.src && (
                      <div className="relative group/veh shrink-0">
                        <button
                          type="button"
                          aria-label="Ver imagen ampliada del vehículo"
                          className="h-11 w-18 sm:h-14 sm:w-24 rounded-lg bg-white/90 dark:bg-zinc-900/90 border border-sky-300/80 dark:border-sky-700/60 p-1 shadow-sm flex items-center justify-center overflow-hidden transition-all duration-200 hover:scale-105 hover:border-sky-500 hover:shadow-md cursor-zoom-in active:scale-95"
                        >
                          <img
                            src={selImg.src}
                            alt={vLabel}
                            className="max-h-full max-w-full object-contain drop-shadow-sm"
                            loading="lazy"
                          />
                        </button>
                        {/* Zoom flotante centrado y proporcionado al 100% sin recortes */}
                        <div className="fixed inset-x-4 bottom-24 sm:absolute sm:inset-x-auto sm:bottom-full sm:right-0 sm:w-[480px] sm:max-w-[calc(100vw-2rem)] z-50 pointer-events-none opacity-0 group-hover/veh:opacity-100 group-focus-within/veh:opacity-100 transition-all duration-300 mb-3 p-4 bg-white/95 dark:bg-zinc-950/95 rounded-2xl shadow-2xl border-2 border-sky-400/90 flex flex-col items-center gap-3 backdrop-blur-xl">
                          <div className="w-full bg-slate-50 dark:bg-zinc-900/90 rounded-xl p-4 flex items-center justify-center min-h-[180px] max-h-[260px] border border-slate-100 dark:border-zinc-800 overflow-hidden">
                            <img
                              src={selImg.src}
                              alt={vLabel}
                              className="max-h-[220px] max-w-full w-auto object-contain mx-auto drop-shadow-xl"
                            />
                          </div>
                          <div className="flex items-center justify-between w-full px-1 text-xs">
                            <p className="text-sm font-bold text-sky-950 dark:text-sky-100 truncate pr-2">{vLabel || "Vehículo"}</p>
                            <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider bg-sky-50 dark:bg-sky-950/60 px-2.5 py-0.5 rounded-full border border-sky-200 dark:border-sky-800 shrink-0">
                              Vista Ampliada 100%
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className={CUSTOMER_VEHICLE_CARD_PATTERNS.shared.actions}>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 px-2.5 text-xs font-medium ui-interactive"
                        disabled={sellerFlowLocked}
                        onClick={handleReopenFulfillmentStep}
                      >
                        <RefreshCcw className="h-3.5 w-3.5 mr-1" />
                        Cambiar
                      </Button>
                      <Badge variant="outline" className={CUSTOMER_VEHICLE_CARD_PATTERNS.vehicle.badge}>
                        Instalado
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            );
          })() : null}
        </div>

        <div
          ref={stepThreeSectionRef}
          className={cn(
            "space-y-2 animate-fade-up-soft",
            !stepTwoComplete ? ERP_ANIMATION_CLASSES.stepLocked : ERP_ANIMATION_CLASSES.stepUnlocked,
            stepThreeUnlockFlash && ERP_ANIMATION_CLASSES.unlock
          )}
        >
          <Label className="inline-flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span>Paso 3: Seleccionar productos</span>
          </Label>
          {!stepTwoComplete ? (
            <p className="text-xs text-muted-foreground">Selecciona cliente y forma de entrega para habilitar productos</p>
          ) : null}
          <div className="flex flex-col gap-2 mb-2 md:flex-row ui-fade-in-stagger">
              <div className="relative flex-1">
                <PackageSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, SKU o código escaneado..."
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    if (productListRef.current) {
                      productListRef.current.scrollTop = 0;
                    }
                  }}
                  onWheel={handleProductSearchWheel}
                  onKeyDown={handleProductSearchKeyDown}
                  ref={productSearchRef}
                  disabled={!stepTwoComplete}
                  className={cn("mb-0 pl-9", productSearch.trim() ? "pr-20" : "pr-12")}
                />
                {productSearch.trim() ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-10 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-full"
                    onClick={() => {
                      setProductSearch("");
                      productSearchRef.current?.focus();
                    }}
                    title="Borrar texto de búsqueda"
                    aria-label="Borrar texto de búsqueda"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2 text-sky-700 hover:bg-sky-500/10 hover:text-sky-800 dark:text-sky-300"
                  onClick={handleOpenBarcodeScanner}
                  disabled={!stepTwoComplete}
                  title="Escanear código de barras o QR"
                  aria-label="Escanear código de barras o QR"
                >
                  <ScanBarcode className="h-4 w-4" />
                </Button>
              </div>

            {selectedVehicleData ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-sky-50/90 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800 shadow-sm shrink-0">
                <CarFront className="h-4 w-4 text-sky-700 dark:text-sky-300" />
                <Label htmlFor="only-compatible-switch" className="text-xs font-semibold text-sky-950 dark:text-sky-200 cursor-pointer select-none">
                  Solo compatibles
                </Label>
                <Switch
                  id="only-compatible-switch"
                  checked={onlyCompatibleProducts}
                  onCheckedChange={setOnlyCompatibleProducts}
                />
              </div>
            ) : null}

            <Button
              type="button"
              variant="outline"
              onClick={handleOpenCatalogSearch}
              disabled={!selectedCustomer}
              className="shrink-0 ui-interactive"
            >
              <BookOpen className="h-4 w-4 mr-2" />
              Buscar desde Catálogo
            </Button>
          </div>
          {productSearch.trim() ? (
            <div ref={productListRef} className="max-h-72 space-y-2 overflow-y-auto pr-1 animate-fade-up-soft">
              {visibleProducts.map((p, index) => (
                (() => {
                  const normalizedSku = String(p.sku || "").toUpperCase();
                  const normalizedName = String(p.name || "").toLowerCase();
                  const normalizedCategory = String(p.category || "").toLowerCase();
                  const isServiceProduct =
                    normalizedSku.startsWith("SRV") ||
                    normalizedName.includes("servicio") ||
                    normalizedCategory.includes("servicio");
                  const stockStatus = getProductStockStatus(p, isServiceProduct);
                  const tone = getProductTone(stockStatus, isServiceProduct);
                  const tierUnitPrice = resolveProductTierPrice(p, activePriceTier);

                  return (
                <button
                  key={p.product_id}
                  data-index={index}
                  type="button"
                  className={cn(
                    "grid w-full grid-cols-[72px_minmax(0,1fr)] items-start gap-3 rounded-xl border p-3 text-left shadow-sm transition-colors ui-interactive ui-panel sm:grid-cols-[88px_minmax(0,1fr)] sm:p-2.5 group",
                    ERP_SEARCH_ROW.product,
                    tone.base,
                    tone.hover,
                    index === productHighlightIndex ? tone.selected : ""
                  )}
                  onClick={(event) => addToCart(p, { sourceElement: event.currentTarget })}
                  onMouseEnter={() => setProductHighlightIndex(index)}
                >
                  <div
                    className="row-span-2 h-[4.5rem] w-[4.5rem] sm:h-20 sm:w-20 sm:row-span-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      setQuickViewProduct(p);
                    }}
                  >
                    <ProductImageHoverZoom
                      src={p.images?.[0] || p.image}
                      alt={p.name}
                      className="h-full w-full"
                      onOpenQuickView={() => setQuickViewProduct(p)}
                      showEyeButton={true}
                    />
                  </div>
                  <div className="min-w-0 self-start">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn("text-[13px] font-semibold leading-tight whitespace-normal break-words flex-1", tone.title)}>
                        {p.name}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setQuickViewProduct(p);
                        }}
                        className="h-6 w-6 shrink-0 rounded-full border border-border/70 bg-background/80 hover:bg-primary hover:text-primary-foreground shadow-xs flex items-center justify-center text-muted-foreground hover:text-foreground transition-all opacity-80 hover:opacity-100 hover:scale-110"
                        title="Ver características y fotos del producto"
                        aria-label="Ver características y fotos del producto"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <p className={cn("text-[11px]", tone.sku)}>{p.sku}</p>
                      {selectedVehicleData && logisticMode === "installed" && (() => {
                        const comp = getProductVehicleCompatibility(p, selectedVehicleData);
                        if (!comp.isSpecificTint) return null;
                        return comp.isCompatible ? (
                          <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                            ✓ {comp.badge || "Compatible"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 opacity-75">
                            {comp.badge || "Otra categoría"}
                          </span>
                        );
                      })()}
                    </div>
                    {p.installation_type === "not_available" && (
                      <Badge variant="secondary" className="mt-2 text-[10px]">Solo para llevar</Badge>
                    )}

                    <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3">
                      {(() => {
                        const userBranchId = String(user?.branch_id || "");
                        const fallbackStockValue = getLocalStoreStockValue(p);
                        const hasFallbackStockValue = Number.isFinite(fallbackStockValue);
                        const fallbackThreshold = getProductStockThreshold(p);
                        const rawStockRows = inventoryByProductId.get(String(p.product_id || "")) || [];
                        const stockRows = rawStockRows.filter((row) => Number(row?.quantity || 0) > 0);

                        if (stockRows.length === 0) {
                          if (isServiceProduct) return <div className="min-h-[3.25rem]" />;

                          return (
                            <div className="flex min-h-[3.25rem] items-end">
                              {hasFallbackStockValue ? (
                                <div className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] leading-tight text-muted-foreground">
                                  <Package className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
                                  <span className="font-semibold">Disponible:</span>
                                  <span
                                    className={cn(
                                      "font-mono",
                                      fallbackStockValue <= 0
                                        ? "text-rose-800"
                                        : fallbackStockValue <= fallbackThreshold
                                          ? "text-amber-800"
                                          : "text-blue-900"
                                    )}
                                  >
                                    {fallbackStockValue}
                                  </span>
                                </div>
                              ) : (
                                <div className="text-[11px] leading-tight text-muted-foreground">
                                  Inventario no cargado
                                </div>
                              )}
                            </div>
                          );
                        }

                        const sellerStoreRows = [];
                        const otherStoreRows = [];
                        const otherWarehouseRows = [];

                        stockRows.forEach((row) => {
                          const wh = warehouseById.get(String(row.warehouse_id));
                          const branchId = String(wh?.branch_id || "");
                          if (!branchId) {
                            otherWarehouseRows.push({
                              name: String(wh?.name || row.warehouse_id || "Bodega"),
                              qty: Number(row.quantity || 0),
                            });
                            return;
                          }

                          if (userBranchId && branchId === userBranchId) {
                            sellerStoreRows.push({
                              name: String(wh?.name || row.warehouse_id || "Tienda"),
                              qty: Number(row.quantity || 0),
                            });
                            return;
                          }

                          otherStoreRows.push({
                            name: String(wh?.name || row.warehouse_id || "Tienda"),
                            qty: Number(row.quantity || 0),
                          });
                        });

                        const remoteStockRows = crossBranchByProductId.get(String(p.product_id || "")) || [];
                        remoteStockRows.forEach((row) => {
                          const branchLabel = String(row.branch_name || row.branch_id || "Sucursal");
                          const warehouseLabel = String(row.warehouse_name || row.warehouse_id || "Bodega");
                          otherStoreRows.push({
                            name: `${branchLabel} · ${warehouseLabel}`,
                            qty: Number(row.quantity || 0),
                          });
                        });

                        const sumQty = (rows) => rows.reduce((acc, row) => acc + Number(row.qty || 0), 0);

                        const renderRow = (label, qty, rows, icon, qtyClassName, options = {}) => {
                          const { showBreakdown = true, breakdownKey = "", interactiveBreakdown = false } = options;
                          const breakdownText = rows.map((row) => `${row.name}: ${row.qty}`).join(", ");
                          const canShowInteractiveBreakdown = interactiveBreakdown && rows.length > 0;
                          const isBreakdownVisible = canShowInteractiveBreakdown && isTouchDevice && activeStockBreakdownKey === breakdownKey;

                          return (
                            <div
                              className="relative flex items-center gap-1.5 whitespace-nowrap text-[11px] leading-tight"
                              title={!isTouchDevice && canShowInteractiveBreakdown ? breakdownText : undefined}
                              onPointerDown={() => startBreakdownLongPress(breakdownKey, canShowInteractiveBreakdown)}
                              onPointerUp={() => endBreakdownLongPress(breakdownKey)}
                              onPointerCancel={() => endBreakdownLongPress(breakdownKey)}
                              onPointerLeave={() => endBreakdownLongPress(breakdownKey)}
                            >
                              {icon}
                              <span className="font-semibold">{label}:</span>
                              <span className={cn("font-mono font-bold", qtyClassName)}>{qty}</span>
                              {showBreakdown && rows.length > 0 && (
                                <span className="truncate text-muted-foreground" title={rows.map((row) => `${row.name}: ${row.qty}`).join(" | ")}>
                                  ({rows.map((row) => `${row.name}: ${row.qty}`).join(", ")})
                                </span>
                              )}
                              {isBreakdownVisible ? (
                                <span className="pointer-events-none absolute left-0 top-full z-20 mt-1 max-w-[22rem] rounded-md border bg-background px-2 py-1 text-[11px] text-muted-foreground shadow-md">
                                  {breakdownText}
                                </span>
                              ) : null}
                            </div>
                          );
                        };

                        return (
                          <div className="space-y-1 text-xs">
                            {renderRow(
                              "Esta Tienda",
                              sumQty(sellerStoreRows),
                              sellerStoreRows,
                              <Building2 className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />,
                              "text-blue-900",
                              {
                                showBreakdown: false,
                              }
                            )}
                            {renderRow(
                              "Otras tiendas",
                              sumQty(otherStoreRows),
                              otherStoreRows,
                              <Building2 className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />,
                              "text-emerald-900",
                              {
                                showBreakdown: false,
                                breakdownKey: `${p.product_id}-other-stores`,
                                interactiveBreakdown: true,
                              }
                            )}
                            {renderRow(
                              "Otras bodegas",
                              sumQty(otherWarehouseRows),
                              otherWarehouseRows,
                              <Warehouse className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />,
                              "text-amber-900",
                              {
                                showBreakdown: false,
                                breakdownKey: `${p.product_id}-other-warehouses`,
                                interactiveBreakdown: true,
                              }
                            )}
                          </div>
                        );
                      })()}

                      <div className="flex h-full min-h-[3.25rem] flex-col items-end justify-end gap-0.5 whitespace-nowrap text-right">
                        {selectedVehicleOption === "carryout" && p.installation_type !== "not_available" && (p.installation_price || 0) > 0 ? (
                          <>
                            {/* Con instalación arriba (pequeño, muted) */}
                            <p className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                              <Wrench className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              <span className="font-mono">{formatCurrency(convertPrice(tierUnitPrice + (p.installation_price || 0)), currency)}</span>
                            </p>
                            {/* Para llevar abajo (grande, negrita = seleccionado) */}
                            <p className={cn("inline-flex items-center gap-1 font-mono text-[13px] font-extrabold", tone.emphasisPrice)}>
                              {isServiceProduct ? (
                                <Hand className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              ) : (
                                <Package className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              )}
                              <PriceTierCompare product={p} activeTier={activePriceTier} currency={currency} convertPrice={convertPrice} size="lg" />
                            </p>
                          </>
                        ) : (
                          <>
                            {/* Para llevar arriba */}
                            <p className={cn(
                              "inline-flex items-center gap-1 font-mono text-[11px]",
                              hasSelectedVehicle ? "text-muted-foreground" : cn("font-semibold", tone.emphasisPrice)
                            )}>
                              {isServiceProduct ? (
                                <Hand className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              ) : (
                                <Package className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              )}
                              <PriceTierCompare product={p} activeTier={activePriceTier} currency={currency} convertPrice={convertPrice} />
                            </p>
                            {/* Con instalación abajo */}
                            {p.installation_type !== "not_available" && (p.installation_price || 0) > 0 && (
                              <p className={cn(
                                "inline-flex items-center gap-1 font-mono text-[13px]",
                                hasSelectedVehicle ? cn("font-extrabold", tone.emphasisPrice) : "text-muted-foreground"
                              )}>
                                <Wrench className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                <span className="font-mono">{formatCurrency(convertPrice(tierUnitPrice + (p.installation_price || 0)), currency)}</span>
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
                  );
                })()
              ))}
              {filteredProducts.length > visibleProducts.length ? (
                <div className="py-2.5 px-3 text-center text-xs text-muted-foreground bg-muted/40 rounded-xl border border-dashed border-border/80">
                  Mostrando <strong>{visibleProducts.length}</strong> de <strong>{filteredProducts.length}</strong> productos encontrados. Escribe más letras o el modelo de auto (ej. <em>"halogeno yaris"</em>) para filtrar con precisión.
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Escribe para buscar productos</p>
          )}
        </div>
      </div>

      <div
        ref={stepFourSectionRef}
        className={cn(
          "relative min-h-[28rem] space-y-4 rounded-2xl transition-all duration-500",
          cartFlashActive ? "ring-2 ring-sky-300 shadow-[0_0_0_1px_rgba(125,211,252,0.35),0_18px_40px_rgba(56,189,248,0.12)]" : "",
          !stepTwoComplete ? ERP_ANIMATION_CLASSES.stepLocked : ERP_ANIMATION_CLASSES.stepUnlocked
        )}
      >
        {!stepTwoComplete ? (
          <p className="text-xs text-muted-foreground">Los pasos 4 y 5 se habilitan después de definir la forma de entrega</p>
        ) : null}
        {cartFlashActive ? (
          <div className="pointer-events-none absolute inset-x-3 top-10 h-28 rounded-3xl bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.98),rgba(186,230,253,0.34)_35%,rgba(255,255,255,0)_70%)] opacity-90 blur-sm" />
        ) : null}
        {isCommercialHouseSale ? (
          <div className="rounded-lg border border-violet-200 bg-violet-50/60 p-3 space-y-2">
            <p className="text-xs font-medium text-violet-900">Opciones Casa Comercial</p>
            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2 text-sm">
                <Checkbox
                  checked={commercialIncludeInstallation}
                  onCheckedChange={(checked) => setCommercialIncludeInstallation(Boolean(checked))}
                />
                Incluir instalación a domicilio
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <Checkbox
                  checked={commercialIncludeDelivery}
                  onCheckedChange={(checked) => setCommercialIncludeDelivery(Boolean(checked))}
                />
                Incluir delivery
              </label>
            </div>
          </div>
        ) : null}
        {needsPrecio2Approval ? (
          (() => {
            const p2 = getDialogMessage("pricing.precio2_banner");
            const statusText =
              precio2ApprovalStatus === "approved"
                ? p2.description_approved
                : precio2ApprovalStatus === "pending"
                  ? p2.description_pending
                  : precio2ApprovalStatus === "rejected"
                    ? p2.description_rejected
                    : p2.description_none;
            const btnLabel =
              precio2ApprovalStatus === "pending"
                ? (p2.primary_label_pending || "Esperando aprobación…")
                : precio2ApprovalStatus === "rejected"
                  ? (p2.primary_label_rejected || "Solicitar de nuevo")
                  : (p2.primary_label || "Solicitar Precio 2");
            return (
              <div
                className={cn(
                  "rounded-lg border p-3 flex flex-wrap items-center justify-between gap-2",
                  precio2ApprovalStatus === "approved"
                    ? "border-emerald-300 bg-emerald-50/80"
                    : precio2ApprovalStatus === "rejected"
                      ? "border-rose-300 bg-rose-50/80"
                      : "border-amber-300 bg-amber-50/80",
                )}
              >
                <p
                  className={cn(
                    "text-xs",
                    precio2ApprovalStatus === "approved"
                      ? "text-emerald-900"
                      : precio2ApprovalStatus === "rejected"
                        ? "text-rose-900"
                        : "text-amber-900",
                  )}
                >
                  {statusText}
                </p>
                {precio2ApprovalStatus !== "approved" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={requestPrecio2Approval}
                    disabled={requestingPrecio2Approval || precio2ApprovalStatus === "pending"}
                  >
                    {btnLabel}
                  </Button>
                ) : null}
              </div>
            );
          })()
        ) : null}
        <div className="flex items-center justify-between">
          <Label className="inline-flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            <span>{step4Label}</span>
          </Label>
          <button
            type="button"
            onClick={undoCartChange}
            disabled={cartHistory.current.length === 0}
            title="Deshacer último cambio en carrito"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <Undo2 className="h-3.5 w-3.5" />
            <span>Deshacer</span>
          </button>
        </div>
        <div className={cn(
          "animate-fade-up-soft",
          normalizedCartItems.length === 0
            ? ""
            : "max-h-72 space-y-2 overflow-y-auto pr-1"
        )}>
          {normalizedCartItems.length === 0 ? (
            <EmptyCartPlaceholder flowType={flowType} />
          ) : normalizedCartItems.map(item => {
            const itemNormalizedSku = String(item.sku || "").toUpperCase();
            const itemNormalizedName = String(item.product_name || "").toLowerCase();
            const isItemService = itemNormalizedSku.startsWith("SRV") || itemNormalizedName.includes("servicio");
            const sourceProduct = productsById.get(String(item.product_id)) || item;
            const stockStatus = getProductStockStatus(sourceProduct, isItemService);
            const tone = getProductTone(stockStatus, isItemService);
            const currentQuantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
            const maxStoreQuantityRaw = Number(getLocalStoreStockValue(sourceProduct));
            const maxStoreQuantity = Number.isFinite(maxStoreQuantityRaw)
              ? Math.max(0, Math.floor(maxStoreQuantityRaw))
              : null;
            const lineLock = isSupervisorUser
              ? { locked: false, deletable: true }
              : getSellerCartLineLockState(item.product_id, draftReview);
            const canDecreaseQuantity = !lineLock.locked && currentQuantity > 1;
            const canIncreaseQuantity = !lineLock.locked && (maxStoreQuantity === null ? true : currentQuantity < maxStoreQuantity);
            const canRemoveLine = lineLock.deletable;
            return (
            <div key={item.product_id} className={cn("grid grid-cols-[72px_minmax(0,1fr)] items-start gap-3 rounded-xl border p-3 shadow-sm ui-interactive ui-panel sm:grid-cols-[88px_minmax(0,1fr)] sm:p-2.5", tone.base)}>
              {item.image
                ? <img src={item.image} alt={item.product_name} className="mt-0.5 h-14 w-14 shrink-0 rounded-lg object-cover bg-muted/30" />
                : <div className="mt-0.5 flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-muted/40"><Package className="h-5 w-5 text-muted-foreground/30" /></div>
              }
              <div className="min-w-0 flex flex-col gap-1">
                {/* nombre + precio en la misma fila */}
                <div className="flex items-start justify-between gap-2">
                  <p className={cn("min-w-0 text-[13px] font-semibold leading-tight whitespace-normal break-words", tone.title)}>{item.product_name}</p>
                  {(() => {
                    const baseTotal = convertPrice(item.unit_price) * item.quantity * (1 - (item.discount || 0) / 100);
                    const installType = item.installation_type || "optional";
                    const wantsInstall = hasSelectedVehicle && (installType === "required" || Boolean(item.with_installation));
                    const installTotal = installType !== "not_available" && wantsInstall
                      ? convertPrice(item.installation_price || 0) * item.quantity
                      : 0;
                    const currentTotal = baseTotal + installTotal;
                    const previousTotals = (Array.isArray(item.price_edit_history) ? item.price_edit_history : [])
                      .map((value) => Number(value))
                      .filter((value) => Number.isFinite(value) && value > 0)
                      .filter((value) => Math.abs(value - Number(item.unit_price || 0)) >= 0.000001)
                      .slice(0, 2)
                      .map((value) => (
                        convertPrice(value) * item.quantity * (1 - (item.discount || 0) / 100)
                      ) + installTotal);

                    if (previousTotals.length === 0) {
                      return <ErpRollingCurrency value={currentTotal} currency={currency} className={cn("shrink-0 text-sm font-extrabold tracking-tight", tone.emphasisPrice)} />;
                    }

                    return (
                      <div className="shrink-0 text-right leading-tight">
                        {previousTotals.map((previousTotal, index) => (
                          <p
                            key={`${item.product_id}-price-history-${index}`}
                            className="font-mono text-[11px] text-muted-foreground line-through decoration-1"
                          >
                            {formatCurrency(previousTotal, currency)}
                          </p>
                        ))}
                        <ErpRollingCurrency
                          value={currentTotal}
                          currency={currency}
                          className={cn("text-sm font-extrabold tracking-tight", tone.emphasisPrice)}
                        />
                      </div>
                    );
                  })()}
                </div>
                {/* SKU + badges de estado */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={cn("text-[11px]", tone.sku)}>{item.sku || "N/A"}</span>
                  {(() => {
                    const itemTier = item.price_tier || detectPriceTier(sourceProduct, item.unit_price);
                    const tierLabel = item.price_tier_label || TIER_LABELS[itemTier];
                    if (!tierLabel || itemTier === TIER_PRECIO1) return null;
                    return (
                      <Badge variant="outline" className="border-violet-300 bg-violet-50/50 px-1.5 py-0 text-[10px] text-violet-800">
                        {tierLabel}
                      </Badge>
                    );
                  })()}
                  {hasSelectedVehicle && (() => {
                    const installType = item.installation_type || "optional";
                    if (installType === "not_available") return <Badge variant="outline" className="px-1.5 py-0 text-[10px]">Para llevar</Badge>;
                    if (installType === "required" || Boolean(item.with_installation)) return <Badge variant="outline" className="border-sky-300 bg-sky-50/50 px-1.5 py-0 text-[10px] text-sky-800">Instalado</Badge>;
                    return null;
                  })()}
                  {item.sample_status === "requested" && (
                    <Badge variant="outline" className="border-violet-300 bg-violet-50/50 px-1.5 py-0 text-[10px] text-violet-700">Muestra</Badge>
                  )}
                  {item.tint_window_plan && (
                    <Badge variant="outline" className="border-blue-300 bg-blue-50/70 text-blue-800 text-[10px] py-0 px-1.5 flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      Plan Ventanas (+${Number(item.materials_extra || 0).toFixed(2)} USD)
                    </Badge>
                  )}
                  {item.tint_window_plan?.requires_despolarizado && (
                    <Badge variant="outline" className="border-amber-300 bg-amber-50/70 text-amber-800 text-[10px] py-0 px-1.5 flex items-center gap-1">
                      <Scissors className="h-3 w-3" />
                      Despolarizado
                    </Badge>
                  )}
                  {item.tint_window_plan?.requires_remover && (
                    <Badge variant="outline" className="border-orange-300 bg-orange-50/70 text-orange-800 text-[10px] py-0 px-1.5 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      Removedor
                    </Badge>
                  )}
                </div>
                {/* stock disponible */}
                {(() => {
                  const cartItemProductId = String(item.product_id || "");
                  const cartStockRows = Array.isArray(inventory)
                    ? inventory.filter((row) => String(row?.product_id || "") === cartItemProductId && Number(row?.quantity || 0) > 0)
                    : [];
                  if (cartStockRows.length === 0) return null;
                  const userBranchId = String(user?.branch_id || "");
                  const sellerRows = [];
                  const otherWHRows = [];
                  cartStockRows.forEach((row) => {
                    const wh = warehouseById.get(String(row.warehouse_id));
                    const branchId = String(wh?.branch_id || "");
                    const entry = { name: String(wh?.name || row.warehouse_id || ""), qty: Number(row.quantity || 0) };
                    if (!branchId) { otherWHRows.push(entry); return; }
                    if (userBranchId && branchId === userBranchId) { sellerRows.push(entry); return; }
                    return;
                  });
                  const sumQty = (rows) => rows.reduce((acc, r) => acc + r.qty, 0);
                  return (
                    <div className="space-y-0.5 text-[11px]">
                      {sellerRows.length > 0 && (
                        <div className="flex items-center gap-1.5 whitespace-nowrap leading-tight">
                          <Building2 className="h-3 w-3 text-blue-700" aria-hidden="true" />
                          <span className="text-muted-foreground">Esta Tienda:</span>
                          <ErpRollingQuantity value={sumQty(sellerRows)} className="font-semibold text-blue-900" />
                        </div>
                      )}
                      {otherWHRows.length > 0 && (
                        <div
                          className="relative flex items-center gap-1.5 whitespace-nowrap leading-tight"
                          title={otherWHRows.map(r => `${r.name}: ${r.qty}`).join(", ")}
                          onPointerDown={() => startBreakdownLongPress(`cart-${item.product_id}-wh`, true)}
                          onPointerUp={() => endBreakdownLongPress(`cart-${item.product_id}-wh`)}
                          onPointerCancel={() => endBreakdownLongPress(`cart-${item.product_id}-wh`)}
                          onPointerLeave={() => endBreakdownLongPress(`cart-${item.product_id}-wh`)}
                        >
                          <Warehouse className="h-3 w-3 text-amber-700" aria-hidden="true" />
                          <span className="text-muted-foreground">Otras bodegas:</span>
                          <ErpRollingQuantity value={sumQty(otherWHRows)} className="font-semibold text-amber-900" />
                          {isTouchDevice && activeStockBreakdownKey === `cart-${item.product_id}-wh` && (
                            <span className="pointer-events-none absolute left-0 top-full z-20 mt-1 max-w-[22rem] rounded-md border bg-background px-2 py-1 text-[11px] text-muted-foreground shadow-md">
                              {otherWHRows.map(r => `${r.name}: ${r.qty}`).join(", ")}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
                {/* cantidad + acciones */}
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title="Restar unidad"
                      disabled={!canDecreaseQuantity}
                      onClick={() => changeCartItemQuantityBy(item.product_id, -1)}
                      onPointerDown={(e) => {
                        if (!canDecreaseQuantity) return;
                        if (e.pointerType !== "touch") return;
                        e.preventDefault();
                        startQuantityHold(item.product_id, -1);
                      }}
                      onPointerUp={(e) => {
                        if (e.pointerType !== "touch") return;
                        clearQuantityHold(item.product_id);
                      }}
                      onPointerCancel={(e) => {
                        if (e.pointerType !== "touch") return;
                        clearQuantityHold(item.product_id);
                      }}
                      onPointerLeave={(e) => {
                        if (e.pointerType !== "touch") return;
                        clearQuantityHold(item.product_id);
                      }}
                      className={cn(
                        "h-7 w-7 ui-interactive",
                        canDecreaseQuantity
                          ? "border-rose-300 bg-white/70 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                          : "border-slate-300 bg-slate-100 text-slate-400"
                      )}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <div
                      aria-label={`Cantidad ${item.product_name}`}
                      className="inline-flex h-7 min-w-[3.25rem] items-center justify-center rounded-md border border-input bg-background px-2 font-mono text-[11px] font-semibold"
                    >
                      <ErpRollingQuantity value={currentQuantity} className="text-[11px] font-semibold" />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title={canIncreaseQuantity ? "Sumar unidad" : "Cantidad máxima de tienda alcanzada"}
                      disabled={!canIncreaseQuantity}
                      onClick={() => changeCartItemQuantityBy(item.product_id, 1)}
                      onPointerDown={(e) => {
                        if (!canIncreaseQuantity) return;
                        if (e.pointerType !== "touch") return;
                        e.preventDefault();
                        startQuantityHold(item.product_id, 1);
                      }}
                      onPointerUp={(e) => {
                        if (e.pointerType !== "touch") return;
                        clearQuantityHold(item.product_id);
                      }}
                      onPointerCancel={(e) => {
                        if (e.pointerType !== "touch") return;
                        clearQuantityHold(item.product_id);
                      }}
                      onPointerLeave={(e) => {
                        if (e.pointerType !== "touch") return;
                        clearQuantityHold(item.product_id);
                      }}
                      className={cn(
                        "h-7 w-7 ui-interactive",
                        canIncreaseQuantity
                          ? "border-emerald-300 bg-white/70 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                          : "border-slate-300 bg-slate-100 text-slate-400"
                      )}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-1">
                    {canEditLinePrice ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        title={Number(item.price_edit_count || 0) >= 3 ? "Máximo 3 ediciones de precio" : "Editar precio"}
                        onClick={() => openPriceEditor(item)}
                        disabled={Number(item.price_edit_count || 0) >= 3}
                        className="h-7 w-7 text-sky-700 hover:bg-sky-100/70 hover:text-sky-800 ui-interactive"
                      >
                        <PencilLine className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                    {item.tint_window_plan ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Ajustar polarizado por ventana"
                        onClick={() => {
                          setTintDialogCartItem(item);
                          setTintDialogProduct(productsById.get(item.product_id) || item);
                          setTintDialogOpen(true);
                        }}
                        className="h-7 w-7 text-blue-700 hover:bg-blue-100/70 hover:text-blue-800 ui-interactive"
                      >
                        <Layers className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Solicitar muestra"
                      onClick={() => requestSampleForItem(item)}
                      className="h-7 w-7 text-violet-700 hover:bg-violet-100/70 hover:text-violet-800 ui-interactive"
                    >
                      <FlaskConical className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title={canRemoveLine ? "Eliminar del carrito" : "Línea bloqueada por supervisión"}
                      onClick={() => removeFromCart(item.product_id)}
                      disabled={!canRemoveLine}
                      className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive ui-interactive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            );
          })}
        </div>

        <Dialog
          open={priceEditorOpen}
          onOpenChange={(open) => {
            if (!open) {
              closePriceEditor();
              return;
            }
            setPriceEditorOpen(open);
          }}
        >
          <DialogContent className="max-w-sm">
            <ContextualDialogHeader
              variant={getDialogMessage("sale.edit_product_price").variant || "information"}
              size="hero"
              title={getDialogMessage("sale.edit_product_price").title}
              description={getDialogMessage("sale.edit_product_price", {
                product_name: priceEditorItem?.product_name || "Producto",
              }).description}
            />
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Modo de edición</Label>
                <Select
                  value={priceEditorMode}
                  onValueChange={(value) => {
                    setPriceEditorMode(value === "percent" ? "percent" : "amount");
                    playSelectionFeedbackSound();
                  }}
                >
                  <SelectTrigger className="ui-interactive">
                    <SelectValue placeholder="Selecciona modo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="amount" className="ui-interactive">Monto fijo</SelectItem>
                    <SelectItem value="percent" className="ui-interactive">Porcentaje sobre precio actual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {priceEditorMode === "amount" ? (
                <div className="space-y-1.5">
                  <Label>Monto en {currency}</Label>
                  <Input
                    ref={priceEditorAmountRef}
                    type="text"
                    inputMode="decimal"
                    value={priceEditorAmount}
                    onChange={(event) => setPriceEditorAmount(event.target.value)}
                    onFocus={(event) => event.target.select()}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      applyPriceEditor();
                    }}
                    placeholder={`Precio en ${currency}`}
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>Porcentaje (%)</Label>
                  <Input
                    ref={priceEditorPercentRef}
                    type="text"
                    inputMode="decimal"
                    value={priceEditorPercent}
                    onChange={(event) => setPriceEditorPercent(event.target.value)}
                    onFocus={(event) => event.target.select()}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      applyPriceEditor();
                    }}
                    placeholder="Ej: 10 o -5"
                  />
                </div>
              )}

              {priceEditorItem && salePricingContext?.allowed_price_tiers?.length ? (
                <div className="flex flex-wrap gap-2">
                  {salePricingContext.allowed_price_tiers.map((tier) => {
                    const sourceProduct = productsById.get(String(priceEditorItem.product_id));
                    const tierPrice = resolveProductTierPrice(sourceProduct, tier);
                    return (
                      <Button
                        key={`tier-${tier}`}
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const nextUnitPrice = currency === "NIO"
                            ? tierPrice
                            : tierPrice;
                          updateCartItem(priceEditorItem.product_id, "unit_price", nextUnitPrice, {
                            persist: true,
                            patch: {
                              original_unit_price: resolveProductTierPrice(sourceProduct, "precio1"),
                            },
                          });
                          setPriceEditorAmount(String(convertPrice(tierPrice)));
                          toast.success(`${TIER_LABELS[tier] || tier} aplicado`);
                        }}
                      >
                        {TIER_LABELS[tier] || tier}
                      </Button>
                    );
                  })}
                </div>
              ) : null}

              {priceEditorItem ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Precio actual: <ErpRollingCurrency value={convertPrice(priceEditorItem.unit_price || 0)} currency={currency} />
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ediciones usadas: {Math.max(0, Math.floor(Number(priceEditorItem.price_edit_count || 0)))}/3
                  </p>
                  {priceEditorPreview?.isValid ? (
                    <div className="space-y-1 rounded-md border border-emerald-200 bg-emerald-50/70 p-2">
                      <p className="text-[11px] font-medium text-emerald-800">Resumen monetario de la edición</p>
                      {priceEditorPreview.discountPerUnit > 0 ? (
                        <p className="text-[11px] text-emerald-700">
                          Descuento aplicado: <ErpRollingCurrency value={priceEditorPreview.discountPerUnit} currency={currency} prefix="-" />
                        </p>
                      ) : priceEditorPreview.increasePerUnit > 0 ? (
                        <p className="text-[11px] text-amber-700">
                          Incremento aplicado: <ErpRollingCurrency value={priceEditorPreview.increasePerUnit} currency={currency} prefix="+" />
                        </p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">
                          Sin cambio monetario.
                        </p>
                      )}
                      {priceEditorPreview.quantity > 1 ? (
                        <p className="text-[11px] text-muted-foreground">
                          Impacto total (x{priceEditorPreview.quantity}):{" "}
                          <ErpRollingCurrency
                            value={Math.abs(priceEditorPreview.deltaTotal)}
                            currency={currency}
                            prefix={priceEditorPreview.deltaTotal < 0 ? "-" : "+"}
                          />
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-[11px] text-amber-700">
                      Ingresa un valor válido para calcular el descuento monetario.
                    </p>
                  )}
                  {Array.isArray(priceEditorItem.price_edit_history) && priceEditorItem.price_edit_history.length > 0 ? (
                    <div className="space-y-1 rounded-md border border-slate-200 bg-slate-50 p-2">
                      <p className="text-[11px] font-medium text-slate-700">Historial de precios (más reciente primero)</p>
                      {priceEditorItem.price_edit_history
                        .map((value) => Number(value))
                        .filter((value) => Number.isFinite(value) && value > 0)
                        .slice(0, 3)
                        .map((value, index) => (
                          <p key={`price-editor-history-${index}`} className="font-mono text-[11px] text-muted-foreground line-through decoration-1">
                            {formatCurrency(convertPrice(value), currency)}
                          </p>
                        ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <ContextualDialogFooter variant={getDialogMessage("sale.edit_product_price").variant || "information"}>
              <Button
                type="button"
                variant="ghost"
                className={getStatusSecondaryButtonClass(getDialogMessage("sale.edit_product_price").variant || "information")}
                onClick={closePriceEditor}
              >
                {getDialogMessage("sale.edit_product_price").secondary_label || "Cancelar"}
              </Button>
              <Button
                type="button"
                className={getStatusPrimaryButtonClass(getDialogMessage("sale.edit_product_price").variant || "information")}
                onClick={applyPriceEditor}
              >
                {getDialogMessage("sale.edit_product_price").primary_label || "Aplicar"}
              </Button>
            </ContextualDialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={sendToCashierConfirmOpen}
          onOpenChange={(open) => {
            if (submittingToCashier) return;
            setSendToCashierConfirmOpen(open);
            if (!open) setPendingCashierPayload(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            {(() => {
              const msg = getDialogMessage("sale.send_to_cashier");
              const variant = msg.variant || "warning";
              const checklist = Array.isArray(msg.checklist) ? msg.checklist : [];
              return (
                <>
                  <ContextualDialogHeader
                    variant={variant}
                    size="hero"
                    title={msg.title}
                    description={msg.description}
                  />
                  {checklist.length > 0 ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100">
                      <ul className="list-disc space-y-1 pl-4 text-left">
                        {checklist.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <ContextualDialogFooter variant={variant}>
                    <Button
                      type="button"
                      variant="ghost"
                      className={getStatusSecondaryButtonClass(variant)}
                      disabled={submittingToCashier}
                      onClick={() => {
                        setSendToCashierConfirmOpen(false);
                        setPendingCashierPayload(null);
                      }}
                    >
                      {msg.secondary_label || "Revisar de nuevo"}
                    </Button>
                    <Button
                      type="button"
                      className={getStatusPrimaryButtonClass(variant)}
                      disabled={submittingToCashier || !pendingCashierPayload}
                      onClick={async () => {
                        try {
                          await executeSubmitToCashier(pendingCashierPayload);
                        } catch (error) {
                          const detail = error?.response?.data?.detail;
                          toast.error(
                            typeof detail === "string"
                              ? detail
                              : detail?.message || error?.message || "No se pudo enviar la factura a caja",
                          );
                        }
                      }}
                    >
                      {submittingToCashier
                        ? (msg.submitting_label || "Enviando…")
                        : (msg.primary_label || "Sí, enviar a caja")}
                    </Button>
                  </ContextualDialogFooter>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>

        <Dialog open={tierChangeConfirmOpen} onOpenChange={setTierChangeConfirmOpen}>
          <DialogContent className="sm:max-w-md">
            {(() => {
              const needsApproval = tierRequiresSupervisorApproval(pendingTierChange, user);
              const msg = getDialogMessage("sale.change_price_tier", {
                count: String(normalizedCartItems.length),
                tier: TIER_LABELS[pendingTierChange] || pendingTierChange || "",
              });
              const variant = needsApproval ? (msg.variant || "warning") : "question";
              const extra = isSupervisorPricingRole(user)
                ? (msg.description_supervisor || "")
                : needsApproval
                  ? (msg.description_precio2 || "")
                  : "";
              return (
                <>
                  <ContextualDialogHeader
                    variant={variant}
                    size="hero"
                    title={msg.title}
                    description={
                      <>
                        {msg.description}
                        {extra}
                      </>
                    }
                  />
                  <ContextualDialogFooter variant={variant}>
                    <Button
                      type="button"
                      variant="ghost"
                      className={getStatusSecondaryButtonClass(variant)}
                      onClick={() => { setTierChangeConfirmOpen(false); setPendingTierChange(null); }}
                    >
                      {msg.secondary_label || "Cancelar"}
                    </Button>
                    <Button
                      type="button"
                      className={getStatusPrimaryButtonClass(variant)}
                      onClick={() => applyActiveTierChange(pendingTierChange)}
                    >
                      {needsApproval
                        ? (msg.primary_label_precio2 || msg.primary_label || "Aplicar")
                        : (msg.primary_label || "Confirmar")}
                    </Button>
                  </ContextualDialogFooter>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>

        <div className="space-y-3 rounded-md border border-dashed border-input/70 bg-background/60 p-2.5">
          <Label className="inline-flex items-center gap-1.5 text-sm font-medium">
            <Tag className="h-3.5 w-3.5" />
            <span>Parámetros comerciales</span>
          </Label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3">
          <div
            className={cn(
              "space-y-1.5 rounded-md border p-2 transition-colors",
              appliedDiscounts.length > 0
                ? "border-emerald-300 bg-emerald-50/70"
                : "border-transparent bg-transparent"
            )}
          >
            <Label className="inline-flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" />
              <span>Código de descuento</span>
            </Label>
            <div className="flex gap-2">
              <Input
                value={discountCode}
                disabled={discountsBlockedByPayment || sellerParamsLocked}
                onChange={(e) => setDiscountCode(e.target.value)}
                placeholder="Ej: DESC10"
              />
              <Button type="button" disabled={discountsBlockedByPayment || sellerParamsLocked} onClick={applyDiscountCode}>Aplicar</Button>
            </div>
            {appliedDiscounts.length > 0 && (
              <div className="mt-2 space-y-1">
                {appliedDiscounts.map(d => (
                  <div key={d.code} className="flex items-center justify-between text-xs">
                    <span>{d.code} - {d.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={sellerParamsLocked}
                      onClick={() => removeDiscountCode(d.code)}
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div
            className={cn(
              "space-y-1.5 rounded-md border p-2 transition-colors",
              totals.discountAmount > 0
                ? "border-emerald-300 bg-emerald-50/70"
                : "border-transparent bg-transparent"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <Label className="inline-flex items-center gap-1.5">
                {globalDiscountMode === "fixed" ? <Banknote className="h-3.5 w-3.5" /> : <Percent className="h-3.5 w-3.5" />}
                <span>{globalDiscountMode === "fixed" ? "Descuento Global (Monto fijo)" : "Descuento Global (%)"}</span>
              </Label>
              <div className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white/60 px-2 py-1 text-[11px]">
                <span className={cn("font-semibold", globalDiscountMode === "percent" ? "text-emerald-700" : "text-slate-500")}>%</span>
                <Switch
                  checked={globalDiscountMode === "fixed"}
                  disabled={discountsBlockedByPayment || sellerParamsLocked}
                  onCheckedChange={(checked) => applyGlobalDiscountModeChange(checked ? "fixed" : "percent")}
                  aria-label="Cambiar tipo de descuento global"
                />
                <span className={cn("font-semibold", globalDiscountMode === "fixed" ? "text-emerald-700" : "text-slate-500")}>{currency}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={cn(
                  "h-9 w-9 ui-interactive",
                  discountsBlockedByPayment || globalDiscount <= 0
                    ? "border-slate-300 bg-slate-100 text-slate-400"
                    : "border-rose-300 bg-white/70 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                )}
                title={discountsBlockedByPayment ? "Descuento bloqueado por método de pago" : "Reducir descuento global"}
                disabled={discountsBlockedByPayment || sellerParamsLocked || globalDiscount <= 0}
                onClick={() => commitGlobalDiscountValue(globalDiscount - (globalDiscountMode === "fixed" ? 10 : 1))}
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <Input
                type="text"
                inputMode="decimal"
                disabled={discountsBlockedByPayment || sellerParamsLocked}
                value={globalDiscountDraft}
                onChange={(e) => handleGlobalDiscountInputChange(e.target.value)}
                onBlur={(e) => commitGlobalDiscountValue(e.target.value)}
                className="h-9 text-center font-mono text-sm font-semibold"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={cn(
                  "h-9 w-9 ui-interactive",
                  discountsBlockedByPayment || (globalDiscountMode === "percent" && globalDiscount >= 100)
                    ? "border-slate-300 bg-slate-100 text-slate-400"
                    : "border-emerald-300 bg-white/70 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                )}
                title={discountsBlockedByPayment ? "Descuento bloqueado por método de pago" : "Aumentar descuento global"}
                disabled={discountsBlockedByPayment || sellerParamsLocked || (globalDiscountMode === "percent" && globalDiscount >= 100)}
                onClick={() => commitGlobalDiscountValue(globalDiscount + (globalDiscountMode === "fixed" ? 10 : 1))}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-1.5 rounded-md border border-dashed border-input/70 bg-background/60 p-2.5">
          <Label className="inline-flex items-center gap-1.5">
            <Percent className="h-3.5 w-3.5" />
            <span>Aplicación de IVA</span>
          </Label>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={applyIVA}
                onCheckedChange={(v) => {
                  if (sellerParamsLocked) {
                    notifySellerParamsLocked();
                    return;
                  }
                  const nextValue = Boolean(v);
                  setApplyIVA(nextValue);
                  persistDraftSnapshot({ applyIVA: nextValue });
                }}
                disabled={sellerParamsLocked}
              />
              <span className="text-xs text-muted-foreground">
                Aplicar IVA ({Number(ivaRate || 15)}%)
              </span>
            </div>
            <Badge variant={applyIVA ? "default" : "secondary"} className="font-mono">
              {applyIVA ? `${Number(ivaRate || 15)}%` : "Sin IVA"}
            </Badge>
          </div>
        </div>

        <div className="space-y-1.5 rounded-md border border-dashed border-input/70 bg-background/60 p-2.5">
          <Label className="inline-flex items-center gap-1.5">
            <Percent className="h-3.5 w-3.5" />
            <span>Aplicar Retención IR</span>
          </Label>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={applyRetention}
                disabled={!totals.retentionThresholdMet || sellerParamsLocked}
                onCheckedChange={(v) => {
                  if (sellerParamsLocked) {
                    notifySellerParamsLocked();
                    return;
                  }
                  const next = Boolean(v);
                  if (next && !totals.retentionThresholdMet) {
                    toast.info("La retención IR requiere subtotal con descuentos >= C$1,000.00");
                    return;
                  }
                  setApplyRetention(next);
                  persistDraftSnapshot({ applyRetention: next, retentionRate });
                }}
              />
              <span className="text-xs text-muted-foreground">
                Retención sobre subtotal (desde C$1,000.00)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={!totals.retentionThresholdMet || sellerParamsLocked}
                onClick={() => {
                  if (sellerParamsLocked) {
                    notifySellerParamsLocked();
                    return;
                  }
                  setRetentionRate(1);
                  persistDraftSnapshot({ applyRetention, retentionRate: 1 });
                }}
                className={cn(
                  "rounded-md border px-2.5 py-0.5 text-xs font-mono font-semibold transition-colors",
                  !totals.retentionThresholdMet || sellerParamsLocked
                    ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                    : retentionRate === 1 && applyRetention
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background text-muted-foreground hover:bg-muted"
                )}
              >1%</button>
              <button
                type="button"
                disabled={!totals.retentionThresholdMet || sellerParamsLocked}
                onClick={() => {
                  if (sellerParamsLocked) {
                    notifySellerParamsLocked();
                    return;
                  }
                  setRetentionRate(2);
                  persistDraftSnapshot({ applyRetention, retentionRate: 2 });
                }}
                className={cn(
                  "rounded-md border px-2.5 py-0.5 text-xs font-mono font-semibold transition-colors",
                  !totals.retentionThresholdMet || sellerParamsLocked
                    ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                    : retentionRate === 2 && applyRetention
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background text-muted-foreground hover:bg-muted"
                )}
              >2%</button>
            </div>
          </div>
            {sellerParamsLocked ? (
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Retención IR definida por supervisión; no editable.
              </p>
            ) : !totals.retentionThresholdMet ? (
              <p className="text-xs text-amber-700">
                Subtotal actual para retención: {formatCurrency(totals.subtotalForRetentionNio, "NIO")} (mínimo C$1,000.00)
              </p>
            ) : null}
          </div>

        {!hideCurrencyField ? (
        <div>
          <Label>Moneda</Label>
          <Select
            value={currency}
            disabled={sellerParamsLocked}
            onValueChange={(value) => {
              applyCurrencyChange(value);
            }}
          >
            <SelectTrigger disabled={sellerParamsLocked}>
              <SelectValue placeholder="Seleccionar moneda" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NIO">C$ Córdobas</SelectItem>
              <SelectItem value="USD">US$ Dólares</SelectItem>
            </SelectContent>
          </Select>
        </div>
        ) : null}
        </div>

        <div
          className={cn(
            "space-y-1.5 rounded-md border p-2.5 transition-colors",
            discountsBlockedByPayment
              ? "border-rose-300 bg-rose-50/80"
              : "border-dashed border-input/70 bg-background/60",
          )}
        >
          <Label className="inline-flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5" />
            <span>{step5Label}</span>
          </Label>
          <Select
            value={normalizedPaymentMethod}
            disabled={sellerParamsLocked}
            onValueChange={(value) => {
              if (sellerParamsLocked) {
                notifySellerParamsLocked();
                return;
              }
              const nextMethod = String(value || "cash");
              setPaymentMethod(nextMethod);
              playSelectionFeedbackSound();
              const nextMixedPaymentMethods = nextMethod === "mixed" ? normalizedMixedPaymentMethods : [];
              if (nextMethod !== "mixed") {
                setMixedPaymentMethods([]);
              }
              persistDraftSnapshot({ paymentMethod: nextMethod, mixedPaymentMethods: nextMixedPaymentMethods });
              if (nextMethod === "card") {
                toast.info("Con tarjeta no aplican descuentos ni promociones");
              }
            }}
          >
            <SelectTrigger className="ui-interactive" disabled={sellerParamsLocked}>
              <SelectValue placeholder="Seleccionar método de pago" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(paymentOptionMeta).map(([value, meta]) => {
                const Icon = meta.icon;
                return (
                  <SelectItem key={value} value={value} className={`${meta.itemClassName} ui-interactive`}>
                    <span className="inline-flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${meta.className}`} />
                      <span>{meta.label}</span>
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {normalizedPaymentMethod === "mixed" && (
            <div className="space-y-2 rounded-md border border-slate-200 bg-white/80 p-2.5 animate-fade-up-soft">
              <p className="text-xs font-medium text-slate-700">Selecciona los métodos incluidos en el pago mixto</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {paymentMethodSelectionItems.map((method) => {
                  const meta = paymentOptionMeta[method];
                  const Icon = meta.icon;
                  const checked = normalizedMixedPaymentMethods.includes(method);
                  return (
                    <label
                      key={method}
                      className={cn(
                        "flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800",
                        sellerParamsLocked ? "cursor-not-allowed opacity-60" : "cursor-pointer ui-interactive",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={sellerParamsLocked}
                        onCheckedChange={(value) => handleMixedMethodToggle(method, Boolean(value))}
                      />
                      <Icon className={`h-4 w-4 ${meta.className}`} />
                      <span>{meta.label}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-slate-600">Métodos elegidos: {paymentMethodSummaryLabel}</p>
            </div>
          )}
          {sellerParamsLocked ? (
            <p className="text-xs text-amber-800 dark:text-amber-300">
              Método de pago definido por supervisión; no editable.
            </p>
          ) : discountsBlockedByPayment ? (
            <p className="text-xs font-medium text-rose-800">
              Este método bloquea descuentos y promociones en el cálculo final.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Este método permite aplicar descuentos y promociones.
            </p>
          )}
        </div>

        {normalizedPaymentMethod !== "credit" ? (
          <div ref={paymentPlanSectionRef} className="scroll-mt-24">
            <PaymentPlanEditor
              paymentMethod={normalizedPaymentMethod}
              mixedMethods={normalizedMixedPaymentMethods}
              lines={paymentPlanLines}
              onChangeLines={handlePaymentPlanLinesChange}
              onRemoveLine={handlePlanLineRemoved}
              exchangeRate={paymentExchangeRate}
              sellExchangeRate={exchangeRate}
              targetTotal={totals.total}
              disabled={sellerPaymentPlanBlocked}
              structureLocked={sellerPaymentPlanStructureLocked}
              totalChangedHint={planTotalChangedHint}
              submitAttention={paymentPlanSubmitAttention && normalizedPaymentMethod === "mixed"}
              submitAttentionMessage={paymentPlanSubmitAttentionMessage}
            />
          </div>
        ) : (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
            Crédito: plazo aprobado del cliente{" "}
            <span className="font-semibold">
              {resolveCustomerCreditDays(selectedCustomer) || "sin configurar"}
            </span>{" "}
            días. Techo C${Number(selectedCustomer?.credit_limit || 0).toFixed(2)}. Solo gerencia/supervisor modifica estos términos.
          </div>
        )}

        {extraFields}

        <div className="border-t pt-4 space-y-1">
          {(totals.totalDiscounts > 0 || totals.manualPriceDiscountTotal > 0) && (
            <SaleTotalsBreakdownRow label="Subtotal sin descuentos:" value={totals.subtotalWithoutDiscounts} currency={currency} className="text-sm" />
          )}
          {totals.manualPriceDiscountEntries.length > 0 && totals.manualPriceDiscountEntries.map((entry) => (
            <SaleTotalsBreakdownRow
              key={`manual-discount-${entry.productId}`}
              label={`Descuento Individual (${entry.productName}):`}
              value={entry.amount}
              currency={currency}
              prefix="-"
              className="text-sm text-green-600"
            />
          ))}
          {totals.discountFromCodes > 0 && (
            <SaleTotalsBreakdownRow label="Descuento Códigos:" value={totals.discountFromCodes} currency={currency} prefix="-" className="text-sm text-green-600" />
          )}
          {totals.discountAmount > 0 && (
            <SaleTotalsBreakdownRow
              label={globalDiscountMode === "fixed" ? "Descuento Global (Monto):" : "Descuento Global (%):"}
              value={totals.discountAmount}
              currency={currency}
              prefix="-"
              className="text-sm text-green-600"
            />
          )}
          {totals.discountsBlockedByPayment && totals.blockedDiscountsAmount > 0 && (
            <SaleTotalsBreakdownRow label="Descuentos removidos por método:" value={totals.blockedDiscountsAmount} currency={currency} className="text-sm text-amber-700" />
          )}
          <SaleTotalsBreakdownRow label="Subtotal:" value={totals.subtotalForRetention} currency={currency} className="text-sm" />
          {applyRetention && totals.retention > 0 && (
            <SaleTotalsBreakdownRow label={`Retención IR (${retentionRate}%):`} value={totals.retention} currency={currency} prefix="-" className="text-sm text-orange-600" />
          )}
          <SaleTotalsBreakdownRow label={`IVA (${ivaRate}%):`} value={totals.tax} currency={currency} className="text-sm" />
          {isDeliveryLogistics && totals.deliveryAmount > 0 ? (
            <SaleTotalsBreakdownRow label="Costo de envío:" value={totals.deliveryAmount} currency={currency} className="text-sm text-amber-800" />
          ) : null}
          <SaleTotalsBreakdownRow label="Total:" value={totals.total} currency={currency} className="text-lg font-bold" />
          <SavingsHighlightRow
            amount={totals.totalDiscounts + totals.manualPriceDiscountTotal}
            currency={currency}
            className="mt-2"
          />
        </div>

        <div>
          <Label>Notas</Label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={(e) => persistDraftSnapshot({ notes: e.target.value })}
          />
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleSubmit}
            disabled={
              submittingToCashier
              || (normalizedPaymentMethod !== "credit" && !isPaymentPlanReady)
            }
            className={cn(
              "flex-1",
              (normalizedPaymentMethod === "credit" || isPaymentPlanReady)
                && "bg-emerald-600 text-white hover:bg-emerald-700",
            )}
          >
            <ShieldCheck className="h-4 w-4 mr-2" />
            {submittingToCashier ? "Enviando…" : submitLabel}
          </Button>
        </div>
      </div>
      </div>

      <Dialog
        open={showNewVehicleDialog}
        onOpenChange={(open) => {
          setShowNewVehicleDialog(open);
          if (!open) {
            resetNewVehicleForm();
            if (vehicleFlowOption === "new") {
              setVehicleFlowOption(selectedVehicle ? "registered" : "registered");
              if (!selectedVehicle) {
                setIsVehiclePickerVisible(true);
              }
            }
          }
          persistDraftSnapshot({
            showNewVehicleDialog: open,
            vehicleFlowOption: open ? "new" : (selectedVehicle ? "registered" : "registered"),
            logisticMode: open ? "installed" : logisticMode,
            isVehiclePickerVisible: open ? true : !selectedVehicle,
            newVehicle: open ? newVehicle : {
              plate_prefix: "M",
              plate_number: "",
              brand: "",
              model: "",
              year: "",
              color: "",
              chasis: "",
            },
            useVehicleVinDecoder: open ? useVehicleVinDecoder : false,
          });
        }}
      >
        <DialogContent className="max-w-3xl max-h-[min(85vh,92dvh)] overflow-y-auto">
          <ContextualDialogHeader
            variant="information"
            size="inline"
            icon={PlusCircle}
            title="Registrar Vehículo"
          />
          <div className="space-y-3">
            {/* Banner de Escaneo OCR de Tarjeta de Circulación */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50/60 dark:bg-sky-950/30">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400">
                  <Camera className="h-4 w-4" />
                </div>
                <div>
                  <span className="font-bold text-xs text-sky-900 dark:text-sky-200 block">
                    Escaneo OCR de Tarjeta de Circulación
                  </span>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Lee Chasis (VIN), Placa, Color y auto-completa el vehículo
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => setShowSaleOcrModal(true)}
                className="h-8 gap-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md shadow-sky-600/20"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Escanear Tarjeta (OCR)
              </Button>
            </div>

            <div>
              <Label>Placa *</Label>
              <div className="flex gap-2">
                <Select
                  value={newVehicle.plate_prefix}
                  onValueChange={(v) => {
                    const nextVehicle = { ...newVehicle, plate_prefix: v, plate_number: "" };
                    setNewVehicle(nextVehicle);
                    persistDraftSnapshot({ newVehicle: nextVehicle });
                  }}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATE_PREFIXES.map(prefix => (
                      <SelectItem key={prefix} value={prefix}>{prefix}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={newVehicle.plate_number}
                  onChange={(e) => setNewVehicle({ ...newVehicle, plate_number: formatPlateNumber(newVehicle.plate_prefix, e.target.value) })}
                  onBlur={(e) => persistDraftSnapshot({
                    newVehicle: {
                      ...newVehicle,
                      plate_number: formatPlateNumber(newVehicle.plate_prefix, e.target.value),
                    },
                  })}
                  placeholder={newVehicle.plate_prefix === "M" ? "123 456" : "12345"}
                  className="flex-1 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="saleform-use-vehicle-vin-decoder"
                checked={useVehicleVinDecoder}
                onCheckedChange={(checked) => {
                  const nextValue = Boolean(checked);
                  setUseVehicleVinDecoder(nextValue);
                  persistDraftSnapshot({ useVehicleVinDecoder: nextValue });
                }}
              />
              <Label htmlFor="saleform-use-vehicle-vin-decoder">Usar decodificador VIN</Label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_0.8fr_1.9fr] gap-4">
              <div>
                <Label>Marca *</Label>
                <SearchableSelect
                  value={newVehicle.brand}
                  onChange={(v) => {
                    const nextVehicle = { ...newVehicle, brand: v, year: "", model: "", vehicle_cab_variant: "" };
                    setNewVehicle(nextVehicle);
                    persistDraftSnapshot({ newVehicle: nextVehicle });
                  }}
                  options={VEHICLE_CATALOG_BRANDS}
                  placeholder="Seleccionar marca"
                  searchPlaceholder="Buscar marca..."
                />
              </div>
              <div>
                <Label>Año *</Label>
                <SearchableSelect
                  value={String(newVehicle.year || "")}
                  onChange={(v) => {
                    const nextVehicle = { ...newVehicle, year: v, model: "", vehicle_cab_variant: "" };
                    setNewVehicle(nextVehicle);
                    persistDraftSnapshot({ newVehicle: nextVehicle });
                  }}
                  options={newVehicleYearOptions}
                  placeholder="Seleccionar año"
                  searchPlaceholder="Buscar año..."
                  disabled={!newVehicle.brand}
                />
              </div>
              <div>
                <Label>Modelo *</Label>
                <SearchableSelect
                  value={newVehicle.model}
                  onChange={(v) => {
                    const nextVehicle = { ...newVehicle, model: v, vehicle_cab_variant: "" };
                    setNewVehicle(nextVehicle);
                    persistDraftSnapshot({ newVehicle: nextVehicle });
                  }}
                  options={newVehicleModelOptions}
                  placeholder="Seleccionar modelo"
                  searchPlaceholder="Buscar modelo..."
                  disabled={!newVehicle.brand || !newVehicle.year}
                />
              </div>
            </div>

            {showNewVehicleCabVariant ? (
              <VehicleCabVariantSelect
                value={newVehicle.vehicle_cab_variant}
                onChange={(value) => {
                  const nextVehicle = { ...newVehicle, vehicle_cab_variant: value };
                  setNewVehicle(nextVehicle);
                  persistDraftSnapshot({ newVehicle: nextVehicle });
                }}
              />
            ) : null}

            <div>
              <Label>Color</Label>
              <Input
                list="saleform-new-vehicle-color-options"
                value={newVehicle.color}
                onChange={(e) => setNewVehicle({ ...newVehicle, color: e.target.value })}
                onBlur={(e) => persistDraftSnapshot({ newVehicle: { ...newVehicle, color: e.target.value } })}
                placeholder="Escribe para sugerencias de color"
              />
              <datalist id="saleform-new-vehicle-color-options">
                {VEHICLE_COLOR_SUGGESTIONS.map((color) => (
                  <option key={color} value={color} />
                ))}
              </datalist>
            </div>

            <div>
              <Label>CHASIS (VIN)</Label>
              <Input
                value={newVehicle.chasis}
                onChange={(e) => setNewVehicle({ ...newVehicle, chasis: formatChasis(e.target.value) })}
                onBlur={(e) => persistDraftSnapshot({
                  newVehicle: { ...newVehicle, chasis: formatChasis(e.target.value) },
                })}
                placeholder="1HGBH41JXMN109186"
                className="font-mono"
                maxLength={17}
              />
              {useVehicleVinDecoder && (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2"
                  onClick={decodeCustomerVehicleVin}
                  disabled={isDecodingVehicleVin || newVehicle.chasis.length !== 17}
                >
                  {isDecodingVehicleVin ? "Decodificando VIN..." : "Decodificar VIN"}
                </Button>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                17 caracteres alfanuméricos (sin I, O, Q, Ñ). {newVehicle.chasis.length}/17
              </p>
            </div>

            <Button
              onClick={createVehicleForSelectedCustomer}
              disabled={isSubmittingVehicle}
              className="w-full"
            >
              {isSubmittingVehicle ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <PlusCircle className="h-4 w-4 mr-2" />
              )}
              {isSubmittingVehicle ? "Registrando vehículo..." : "Registrar vehículo del cliente"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Conflicto de Propiedad y Traspaso de Vehículo */}
      <Dialog
        open={showVehicleConflictDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowVehicleConflictDialog(false);
          }
        }}
      >
        <DialogContent className="max-w-xl max-h-[min(90vh,92dvh)] overflow-y-auto border-2 border-amber-400 dark:border-amber-600 bg-white dark:bg-zinc-950">
          <ContextualDialogHeader
            variant="warning"
            size="inline"
            icon={ShieldAlert}
            title="Vehículo ya registrado con otro cliente/empresa"
            description="El número de placa o chasis ya existe en el sistema bajo otra titularidad."
          />

          <div className="space-y-4 pt-2">
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-950 dark:text-amber-100 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-sm">
                    {vehicleConflictData?.existing_vehicle?.brand} {vehicleConflictData?.existing_vehicle?.model} {vehicleConflictData?.existing_vehicle?.year}
                  </p>
                  <p className="font-mono text-xs">
                    Placa: <strong>{vehicleConflictData?.existing_vehicle?.plate || "N/A"}</strong> • Chasis: <strong>{vehicleConflictData?.existing_vehicle?.vin || "N/A"}</strong>
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60 space-y-1">
                <span className="text-[11px] font-bold uppercase text-slate-500 block">Propietario Actual Registrado</span>
                <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  {vehicleConflictData?.owner_info?.name || "Cliente Registrado"}
                </p>
                {vehicleConflictData?.owner_info?.tax_id ? (
                  <p className="text-slate-600 dark:text-slate-400">RUC/Cédula: {vehicleConflictData?.owner_info?.tax_id}</p>
                ) : null}
                {vehicleConflictData?.owner_info?.phone ? (
                  <p className="text-slate-600 dark:text-slate-400">Tel: {vehicleConflictData?.owner_info?.phone}</p>
                ) : null}
              </div>

              <div className="p-3 rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 space-y-1">
                <span className="text-[11px] font-bold uppercase text-sky-600 dark:text-sky-400 block">Nuevo Propietario Solicitado</span>
                <p className="font-bold text-sky-950 dark:text-sky-100 text-sm">
                  {selectedCustomer?.name || [selectedCustomer?.first_name, selectedCustomer?.last_name].filter(Boolean).join(" ") || "Cliente Actual"}
                </p>
                {selectedCustomer?.tax_id ? (
                  <p className="text-sky-800 dark:text-sky-300">RUC/Cédula: {selectedCustomer?.tax_id}</p>
                ) : null}
                {selectedCustomer?.phone ? (
                  <p className="text-sky-800 dark:text-sky-300">Tel: {selectedCustomer?.phone}</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Motivo del Traspaso / Cambio de Titularidad</Label>
              <Select
                value={vehicleTransferReason}
                onValueChange={(val) => setVehicleTransferReason(val)}
              >
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Seleccione motivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Compraventa / Traspaso de vehículo">Compraventa / Traspaso de vehículo</SelectItem>
                  <SelectItem value="Vehículo de empresa transferido / Reasignación">Vehículo de empresa transferido / Reasignación</SelectItem>
                  <SelectItem value="Corrección de titularidad de cliente">Corrección de titularidad de cliente</SelectItem>
                  <SelectItem value="Nuevo dueño particular">Nuevo dueño particular</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="pt-2 flex flex-col-reverse sm:flex-row items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowVehicleConflictDialog(false)}
                className="w-full sm:w-auto text-xs"
              >
                Cancelar
              </Button>

              {isSupervisorUser ? (
                <Button
                  type="button"
                  disabled={isTransferringVehicle}
                  onClick={handleExecuteSupervisorTransfer}
                  className="w-full sm:w-auto text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5 shadow-md shadow-emerald-600/20"
                >
                  {isTransferringVehicle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Aprobar y Traspasar Propietario Ahora
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleRequestSellerTransfer}
                  className="w-full sm:w-auto text-xs bg-amber-600 hover:bg-amber-500 text-white font-bold gap-1.5 shadow-md shadow-amber-600/20"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Solicitar Traspaso al Supervisor
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CirculationCardOcrScannerModal
        isOpen={showSaleOcrModal}
        onClose={() => setShowSaleOcrModal(false)}
        onApply={handleApplySaleOcr}
      />

      <Dialog
        open={showNewCustomer}
        onOpenChange={(open) => {
          setShowNewCustomer(open);
          if (!open) {
            resetNewCustomerForm();
          }
          persistDraftSnapshot({
            showNewCustomer: open,
            newCustomerTab: open ? newCustomerTab : "customer",
            newCustomer: open ? newCustomer : {
              first_name: "",
              last_name: "",
              customer_type: "natural",
              tax_id: "",
              email: "",
              phone_prefix: "+505",
              phone: "",
              address: "",
              credit_limit: 0,
              add_vehicle: false,
              plate_prefix: "M",
              plate_number: "",
              brand: "",
              model: "",
              year: "",
              color: "",
              chasis: "",
            },
            useVinDecoder: open ? useVinDecoder : false,
          });
        }}
      >
        <DialogContent className={`max-w-4xl max-h-[min(85vh,92dvh)] overflow-y-auto border-2 ${newCustomerTone.modal}`}>
          <ContextualDialogHeader
            variant="information"
            size="inline"
            icon={isNewCustomerCompany ? Building2 : UserPlus}
            title={isNewCustomerCompany ? "Nueva Empresa" : "Nuevo Cliente"}
            description={
              isNewCustomerCompany
                ? "Registra una nueva empresa y opcionalmente su vehículo"
                : "Registra un nuevo cliente y opcionalmente su vehículo"
            }
          />

          <CustomerVehicleFormTabs
            formData={newCustomer}
            onFormDataChange={(nextCustomer) => {
              setNewCustomer(nextCustomer);
              persistDraftSnapshot({ newCustomer: nextCustomer });
            }}
            activeTab={newCustomerTab}
            onActiveTabChange={(value) => {
              setNewCustomerTab(value);
              persistDraftSnapshot({ newCustomerTab: value });
            }}
            canManageCreditLimit={canManageCreditLimit}
            addVehicleLabel={isNewCustomerCompany ? "Registrar vehículo de la empresa" : "Registrar vehículo del cliente"}
            useVinDecoder={useVinDecoder}
            onUseVinDecoderChange={(value) => {
              setUseVinDecoder(value);
              persistDraftSnapshot({ useVinDecoder: value });
            }}
            isDecodingVin={isDecodingVin}
            onDecodeVin={decodeNewCustomerVin}
            yearOptions={newCustomerYearOptions}
            modelOptions={newCustomerModelOptions}
            platePrefixes={PLATE_PREFIXES}
            vehicleBrands={VEHICLE_CATALOG_BRANDS}
            colorSuggestions={VEHICLE_COLOR_SUGGESTIONS}
            formatPhone={formatPhone}
            formatCedula={formatCedula}
            formatRUC={formatRUC}
            formatChasis={formatChasis}
            formatPlateNumber={formatPlateNumber}
            rootClassName="space-y-2"
            tabsListClassName={`grid w-full grid-cols-2 ${newCustomerTone.tabsList}`}
            customerContentClassName={`space-y-3 mt-3 ${newCustomerTone.panel}`}
            vehicleContentClassName={`space-y-3 mt-3 ${newCustomerTone.panel}`}
            colorDatalistId="saleform-color-options"
            useVinCheckboxId="saleform-use-vin-decoder"
            persistOnChange
            onFormDataBlur={(nextCustomer) => persistDraftSnapshot({ newCustomer: nextCustomer })}
          />

          <Button
            onClick={createNewCustomer}
            disabled={isSubmittingCustomer}
            className="w-full mt-3"
          >
            {isSubmittingCustomer ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {newCustomer.add_vehicle
              ? (isNewCustomerCompany ? "Crear Empresa y Vehículo" : "Crear Cliente y Vehículo")
              : (isNewCustomerCompany ? "Crear Empresa" : "Crear Cliente")}
          </Button>
        </DialogContent>
      </Dialog>

      <ProductBarcodeScannerDialog
        open={showBarcodeScanner}
        onOpenChange={setShowBarcodeScanner}
        onScan={handleBarcodeScan}
        title="Escanear producto"
        description="Apunta al código de barras o QR. En móvil toca Activar cámara y permite el acceso."
      />

      <TintWindowMaterialDialog
        isOpen={tintDialogOpen}
        onClose={() => {
          setTintDialogOpen(false);
          setTintDialogProduct(null);
          setTintDialogCartItem(null);
        }}
        onApplyPlan={handleApplyTintPlan}
        vehicle={selectedVehicleData}
        product={tintDialogProduct || tintDialogCartItem}
        initialPlan={tintDialogCartItem?.tint_window_plan}
        currency={currency}
        exchangeRate={exchangeRate}
      />

      {/* Product Quick View Dialog */}
      <ProductQuickViewDialog
        open={Boolean(quickViewProduct)}
        onOpenChange={(open) => !open && setQuickViewProduct(null)}
        product={quickViewProduct}
        warehouses={warehouses}
        inventoryByWarehouse={inventoryByWarehouseQuickView}
        inventoryByProduct={inventoryByProductQuickView}
        onAddToCart={(product) => addToCart(product)}
        isWarehouseRole={false}
        userRole={user?.role}
        currency={currency}
        exchangeRate={exchangeRate}
      />
    </div>
  );
}
