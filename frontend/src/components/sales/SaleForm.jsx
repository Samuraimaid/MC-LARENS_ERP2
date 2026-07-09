import React, { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SearchableSelect from "@/components/ui/searchable-select";
import { cn, formatCurrency } from "@/lib/utils";
import { CUSTOMER_VEHICLE_CARD_PATTERNS } from "@/lib/cardPatterns";
import { API_BASE as API } from "@/lib/api";
import {
  Building2,
  BookOpen,
  Car,
  CarFront,
  CreditCard,
  FileText,
  FlaskConical,
  Hand,
  MapPin,
  Minus,
  Banknote,
  Palette,
  Package,
  Phone,
  Plus,
  PlusCircle,
  Percent,
  PencilLine,
  ArrowRightLeft,
  BadgeAlert,
  RefreshCcw,
  ShieldCheck,
  ShoppingCart,
  Tag,
  Trash2,
  Truck,
  Undo2,
  User,
  UserSearch,
  UserPlus,
  Warehouse,
  Wrench,
  PackageSearch,
  ScanBarcode,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  formatVehicleIdentityHint,
  getVehicleSelectOptionsByBrandYear,
  getVehicleYearsByBrand,
  getCatalogVehiclePayload,
  isPickupCatalogModel,
  isValidVehicleSelection,
  VEHICLE_CATALOG_BRANDS,
  VEHICLE_COLOR_SUGGESTIONS,
} from "@/lib/vehicleCatalog";
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
  vehicles = [],
  initialData = {},
  onSubmit,
  submitLabel = "Crear",
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
  const isSupervisorUser = isErpDraftSupervisor(user?.role);
  const isSellerRole = String(user?.role || "").toLowerCase() === "ventas";
  const sellerReleasedRestricted = isDraftReleasedWithRestrictions(draftReview) && !isSupervisorUser;
  const sellerParamsLocked = sellerReleasedRestricted;
  const sellerFlowLocked = sellerParamsLocked || (!isSupervisorUser && isDraftBlockedForSeller(draftReview));
  const sellerPaymentPlanBlocked = !isSupervisorUser && isDraftBlockedForSeller(draftReview);
  const sellerPaymentPlanStructureLocked = sellerReleasedRestricted;

  const notifySellerFlowLocked = useCallback(() => {
    toast.error("No puedes modificar cliente, vehículo ni opción para llevar en este borrador.");
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
    initialData.applyIVA ?? defaultApplyIvaForCustomer(initialData.selectedCustomer),
  );
  const [ivaRate, setIvaRate] = useState(initialData.ivaRate ?? defaultIvaRate);
  const [applyRetention, setApplyRetention] = useState(initialData.applyRetention ?? false);
  const [retentionRate, setRetentionRate] = useState(initialData.retentionRate ?? 2);
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
  const [logisticMode, setLogisticMode] = useState("carryout");
  const [deliveryDestinationType, setDeliveryDestinationType] = useState("domicilio");
  const [deliveryCost, setDeliveryCost] = useState("");
  const [selectedMessengerId, setSelectedMessengerId] = useState("");
  const [messengerOptions, setMessengerOptions] = useState([]);
  const [messengerLoading, setMessengerLoading] = useState(false);
  const [isVehiclePickerVisible, setIsVehiclePickerVisible] = useState(true);
  const [useVehicleVinDecoder, setUseVehicleVinDecoder] = useState(false);
  const [isDecodingVehicleVin, setIsDecodingVehicleVin] = useState(false);
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
    return localVehicles.filter((v) => normalizeCustomerId(v.customer_id) === selectedCustomerId);
  }, [localVehicles, normalizeCustomerId, selectedCustomer]);

  const normalizeVehicleId = useCallback((value) => {
    if (value === null || value === undefined || value === "") return "";
    return String(value);
  }, []);

  const customerVehicleCountById = useMemo(() => {
    const counts = {};
    localVehicles.forEach((vehicle) => {
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
  const stepTwoComplete = stepOneComplete && !isVehiclePickerVisible;

  const triggerVehiclePulse = useCallback(() => {
    setVehiclePulseActive(true);
    window.setTimeout(() => setVehiclePulseActive(false), 2000);
  }, []);

  const applyNewlyCreatedVehicleSelection = useCallback((vehicleId, vehicleRecord = null) => {
    const normalizedId = normalizeVehicleId(vehicleId);
    if (!normalizedId) return;
    recentlyCreatedVehicleIdRef.current = normalizedId;
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
    if (selectedVehicleOption === "carryout") {
      return "border-emerald-300 bg-emerald-50 text-emerald-900";
    }
    if (selectedVehicleOption === "new") {
      return "border-violet-300 bg-violet-50 text-violet-900";
    }
    if (selectedVehicleOption.startsWith("vehicle:")) {
      return "border-sky-300 bg-sky-50 text-sky-900";
    }
    return "";
  }, [selectedVehicleOption]);

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
      if (vehicleFlowOption !== "carryout" || selectedVehicle) {
        setVehicleFlowOption("carryout");
        setSelectedVehicle("");
      }
      return;
    }
    if (customerVehicles.length === 0) {
      if (hasRestorableVehicle || isVehiclePickerVisible) {
        return;
      }
      if (vehicleFlowOption !== "carryout" || selectedVehicle) {
        setVehicleFlowOption("carryout");
        setSelectedVehicle("");
      }
      return;
    }
    if (normalizedSelectedVehicle && customerVehicles.some(v => normalizeVehicleId(v.vehicle_id ?? v.id) === normalizedSelectedVehicle)) {
      if (vehicleFlowOption !== "registered") {
        setVehicleFlowOption("registered");
      }
      return;
    }
    if (isVehiclePickerVisible) {
      return;
    }
    if (vehicleFlowOption === "registered" && !normalizedSelectedVehicle) {
      setVehicleFlowOption("carryout");
    }
  }, [draftLoaded, pendingCustomerId, selectedCustomer, customerVehicles, isVehiclePickerVisible, localVehicles.length, normalizeVehicleId, selectedVehicle, vehicleFlowOption]);

  useEffect(() => {
    if (vehicleFlowOption === "carryout") {
      setSelectedVehicle("");
      setCartItems(prev => prev.map(item => ({ ...item, with_installation: false })));
    }
  }, [vehicleFlowOption]);

  useEffect(() => {
    if (!user?.branch_id) return undefined;
    let cancelled = false;
    (async () => {
      setMessengerLoading(true);
      try {
        const response = await axios.get(`${API}/hr/messengers/status`, { withCredentials: true });
        const branches = response.data?.branches || [];
        const branchRow = branches.find((row) => String(row.branch_id) === String(user.branch_id));
        const messengers = branchRow?.messengers || [];
        if (cancelled) return;
        setMessengerOptions(messengers);
        const preferred = messengers.find((row) => row.status === "disponible") || messengers[0];
        if (preferred?.messenger_id) {
          setSelectedMessengerId((current) => current || preferred.messenger_id);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error("No se pudo cargar mensajeros de la sucursal");
        }
      } finally {
        if (!cancelled) setMessengerLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.branch_id]);

  useEffect(() => {
    if (!selectedCustomer) return;

    if (isCompanyCustomer(selectedCustomer)) {
      if (!applyIVA) {
        setApplyIVA(true);
      }
      if (ivaRate !== 15) {
        setIvaRate(15);
      }
    }
  }, [selectedCustomer, isCompanyCustomer, applyIVA, ivaRate]);

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
      setApplyIVA(
        draft?.applyIVA ?? defaultApplyIvaForCustomer(restoredCustomer || selectedCustomer),
      );
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
      setLogisticMode(
        draft?.logisticMode
        || (draft?.delivery_info?.is_delivery ? "delivery" : (draft?.selectedVehicle ? "installed" : "carryout")),
      );
      setDeliveryDestinationType(draft?.deliveryDestinationType || draft?.delivery_info?.destination_type || "domicilio");
      setDeliveryCost(
        draft?.deliveryCost != null
          ? String(draft.deliveryCost)
          : String(draft?.delivery_info?.delivery_cost || ""),
      );
      setSelectedMessengerId(draft?.selectedMessengerId || draft?.delivery_info?.messenger_id || "");
      if (typeof draft?.isVehiclePickerVisible === "boolean") {
        setIsVehiclePickerVisible(draft.isVehiclePickerVisible);
      } else if (draft?.vehicleFlowOption) {
        setIsVehiclePickerVisible(false);
      }
      setShowNewCustomer(Boolean(draft?.showNewCustomer));
      setShowNewVehicleDialog(Boolean(draft?.showNewVehicleDialog));
      setNewCustomerTab(draft?.newCustomerTab || "customer");
      setUseVinDecoder(Boolean(draft?.useVinDecoder));
      setUseVehicleVinDecoder(Boolean(draft?.useVehicleVinDecoder));
      setNewCustomer((prev) => ({ ...prev, ...(draft?.newCustomer || {}) }));
      setNewVehicle((prev) => ({ ...prev, ...(draft?.newVehicle || {}) }));
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
          unit_price: product.price,
          original_unit_price: product.price,
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
    const nextAppliedDiscounts = appliedDiscounts.filter(d => d.code !== code);
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

      const response = await axios.post(`${API}/customers`, customerData, { withCredentials: true });
      const customerId = response.data.customer_id;
      toast.success("Cliente creado exitosamente");
      playCreationSuccessSound();

      let createdVehicleId = null;
      if (newCustomer.add_vehicle && newCustomer.brand && newCustomer.model) {
        if (!newCustomer.year) {
          toast.error("Selecciona el año del vehículo");
          return;
        }
        if (!isValidVehicleSelection(newCustomer.brand, newCustomer.year, newCustomer.model)) {
          toast.error("Marca, año y modelo deben seleccionarse desde la lista");
          return;
        }
        if (isPickupCatalogModel(newCustomer.brand, newCustomer.model) && !newCustomer.vehicle_cab_variant) {
          toast.error("Selecciona el tipo de cabina para esta camioneta");
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
          year: parseInt(newCustomer.year) || new Date().getFullYear(),
          color: newCustomer.color || null,
          vin: newCustomer.chasis || null,
          ...(getCatalogVehiclePayload(newCustomer.brand, newCustomer.model, {
            vehicleCabVariant: newCustomer.vehicle_cab_variant,
          }) || {}),
        };

        const vehicleResponse = await axios.post(`${API}/vehicles`, vehicleData, { withCredentials: true });
        createdVehicleId = vehicleResponse?.data?.vehicle_id;
        toast.success("Vehículo registrado");
        playCreationSuccessSound();

        if (createdVehicleId) {
          applyNewlyCreatedVehicleSelection(createdVehicleId, vehicleResponse?.data);
        }

        const vehiclesRes = await axios.get(`${API}/vehicles`, { withCredentials: true });
        setLocalVehicles(vehiclesRes.data);
      }

      const customersRes = await axios.get(`${API}/customers`, { withCredentials: true });
      setLocalCustomers(customersRes.data);
      const created = customersRes.data.find(c => c.customer_id === customerId);
      if (created) {
        setSelectedCustomer(created);
        if (!newCustomer.add_vehicle) {
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
      toast.error(error.response?.data?.detail || "No se pudo registrar el vehículo");
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
    const linesForMethod = paymentPlanLines.filter(
      (line) => normalizePaymentMethodCode(line.metodo) === method,
    );
    if (linesForMethod.length > 1) {
      toast.error("Quita las líneas adicionales de este método antes de desmarcarlo");
      return;
    }
    const nextMethods = normalizedMixedPaymentMethods.filter((item) => item !== method);
    const nextLines = paymentPlanLines.filter(
      (line) => normalizePaymentMethodCode(line.metodo) !== method,
    );
    setMixedPaymentMethods(nextMethods);
    setPaymentPlanLines(nextMethods.length ? nextLines : []);
    playSelectionFeedbackSound();
    persistDraftSnapshot({ mixedPaymentMethods: nextMethods });
  };

  const handlePlanLineRemoved = (removedLine, nextLines) => {
    if (normalizedPaymentMethod !== "mixed" || !removedLine) return;
    const method = normalizePaymentMethodCode(removedLine.metodo);
    const remainingForMethod = nextLines.filter(
      (line) => normalizePaymentMethodCode(line.metodo) === method,
    ).length;
    if (remainingForMethod > 0) return;
    const nextMethods = normalizedMixedPaymentMethods.filter((item) => item !== method);
    setMixedPaymentMethods(nextMethods);
    if (!nextMethods.length) {
      setPaymentPlanLines([]);
    }
    persistDraftSnapshot({ mixedPaymentMethods: nextMethods });
  };

  const handleSubmit = async () => {
    if (!logisticMode) {
      toast.error("Selecciona una opción logística: Para llevar, Instalado o Delivery");
      return;
    }
    if (logisticMode === "delivery") {
      const parsedDeliveryCost = Number(deliveryCost);
      if (!Number.isFinite(parsedDeliveryCost) || parsedDeliveryCost <= 0) {
        toast.error("Ingrese el costo de envío mayor a cero");
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
    };
    try {
      const result = onSubmit && onSubmit(payload);
      let submissionResult = result;
      if (result && typeof result.then === "function") {
        submissionResult = await result;
      }
      if (submissionResult?.ok !== true) return;
      if (draftKey && typeof window !== "undefined") {
        window.localStorage.removeItem(draftKey);
        if (typeof onDraftClear === "function") {
          onDraftClear();
        }
      }
    } catch (error) {
      throw error;
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
    const nextApplyIva = defaultApplyIvaForCustomer(customer);
    setSelectedCustomer(customer);
    setPendingCustomerId(null);
    setCustomerSearch("");
    setSelectedVehicle("");
    setVehicleFlowOption("carryout");
    setIsVehiclePickerVisible(true);
    setApplyIVA(nextApplyIva);
    playSelectionFeedbackSound();
    persistDraftSnapshot({
      selectedCustomerId: customer?.customer_id || null,
      customerSearch: "",
      selectedVehicle: "",
      vehicleFlowOption: "carryout",
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
    setIsVehiclePickerVisible(true);
    setCustomerSearch("");
    playSelectionFeedbackSound();
    persistDraftSnapshot({
      selectedCustomerId: null,
      selectedVehicle: "",
      vehicleFlowOption: "carryout",
      customerSearch: "",
      cartItems: [],
      appliedDiscounts: [],
      productSearch: "",
    });
    setTimeout(() => customerSearchRef.current?.focus(), 0);
  }, [notifySellerFlowLocked, persistDraftSnapshot, resetSaleFlowForCustomerChange, sellerFlowLocked]);

  const handleSelectLogisticMode = useCallback((nextMode) => {
    if (sellerFlowLocked) {
      notifySellerFlowLocked();
      return;
    }
    setLogisticMode(nextMode);
    if (nextMode === "installed") {
      if (selectedVehicle) {
        if (vehicleFlowOption !== "registered") {
          setVehicleFlowOption("registered");
          setIsVehiclePickerVisible(false);
        }
      } else if (customerVehicles.length > 0) {
        const firstVehicleId = normalizeVehicleId(customerVehicles[0].vehicle_id ?? customerVehicles[0].id);
        setVehicleFlowOption("registered");
        setSelectedVehicle(firstVehicleId);
        setIsVehiclePickerVisible(false);
      } else {
        setIsVehiclePickerVisible(true);
        toast.info("Selecciona un vehículo para venta instalada");
      }
    } else if (nextMode === "carryout" || nextMode === "delivery") {
      if (vehicleFlowOption !== "carryout" || selectedVehicle) {
        setVehicleFlowOption("carryout");
        setSelectedVehicle("");
        setIsVehiclePickerVisible(false);
        setCartItems((prev) => prev.map((item) => ({ ...item, with_installation: false })));
      }
    }
    persistDraftSnapshot({ logisticMode: nextMode });
    playSelectionFeedbackSound();
  }, [
    customerVehicles,
    normalizeVehicleId,
    notifySellerFlowLocked,
    persistDraftSnapshot,
    selectedVehicle,
    sellerFlowLocked,
    vehicleFlowOption,
  ]);

  const handleSelectVehicleFlow = useCallback((nextFlowOption, nextVehicleId = "") => {
    if (sellerFlowLocked) {
      notifySellerFlowLocked();
      return;
    }
    const normalizedVehicleId = normalizeVehicleId(nextVehicleId);
    const pendingCreatedVehicle = normalizeVehicleId(recentlyCreatedVehicleIdRef.current);
    if (
      nextFlowOption === "carryout"
      || (normalizedVehicleId && normalizedVehicleId !== pendingCreatedVehicle)
    ) {
      recentlyCreatedVehicleIdRef.current = "";
    }
    const nextCartItems = nextFlowOption === "carryout"
      ? normalizedCartItems.map((item) => ({ ...item, with_installation: false }))
      : normalizedCartItems;
    setVehicleFlowOption(nextFlowOption);
    setSelectedVehicle(normalizedVehicleId);
    if (nextFlowOption === "registered") {
      setLogisticMode("installed");
    } else if (nextFlowOption === "carryout") {
      setLogisticMode((current) => (current === "delivery" ? "delivery" : "carryout"));
    }
    if (nextFlowOption !== "new") {
      setIsVehiclePickerVisible(false);
    }
    playSelectionFeedbackSound();
    if (nextFlowOption === "carryout") {
      setCartItems(nextCartItems);
    }
    if (nextFlowOption === "registered" && normalizedVehicleId) {
      triggerVehiclePulse();
    }
    persistDraftSnapshot({
      vehicleFlowOption: nextFlowOption,
      selectedVehicle: normalizedVehicleId,
      cartItems: nextCartItems,
      showNewVehicleDialog: nextFlowOption === "new",
      logisticMode: nextFlowOption === "registered" ? "installed" : (logisticMode === "delivery" ? "delivery" : "carryout"),
    });
  }, [logisticMode, normalizeVehicleId, normalizedCartItems, notifySellerFlowLocked, persistDraftSnapshot, sellerFlowLocked, triggerVehiclePulse]);

  const updateCartItem = useCallback((productId, field, value, options = {}) => {
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
  }, [draftReview, isSupervisorUser, normalizedCartItems, persistDraftSnapshot, pushCartHistory]);

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
    if (!isSupervisorUser) {
      toast.error("Solo supervisores y gerencia pueden modificar precios.");
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
  }, [convertPrice, isSupervisorUser]);

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
    if (!customerSearch) return localCustomers;
    const searchLower = customerSearch.toLowerCase();
    return localCustomers.filter(c =>
      c.name?.toLowerCase().includes(searchLower) ||
      c.phone?.includes(customerSearch) ||
      c.tax_id?.includes(customerSearch)
    );
  }, [localCustomers, customerSearch]);

  const filteredProducts = useMemo(() => {
    if (!productSearch) return products;
    return products.filter((product) => productMatchesSearch(product, productSearch));
  }, [products, productSearch]);

  const warehouseById = useMemo(
    () => new Map((warehouses || []).map((warehouse) => [String(warehouse.warehouse_id), warehouse])),
    [warehouses]
  );

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

    const productRows = Array.isArray(inventory)
      ? inventory.filter((row) => String(row?.product_id || "") === normalizedProductId)
      : [];

    if (productRows.length === 0) {
      return getFallbackProductStock(product);
    }

    const userBranchId = String(user?.branch_id || "");
    if (userBranchId) {
      return productRows.reduce((total, row) => {
        const warehouse = warehouseById.get(String(row?.warehouse_id || ""));
        const branchId = String(warehouse?.branch_id || "");
        if (branchId !== userBranchId) return total;
        return total + Number(row?.quantity || 0);
      }, 0);
    }

    // If seller has no assigned branch, we cannot infer "local store" stock reliably.
    // Keep tone policy strict to seller store only by treating local stock as zero.
    return 0;
  }, [getFallbackProductStock, inventory, user?.branch_id, warehouseById]);

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
  }, [productSearch, filteredProducts.length]);

  useEffect(() => {
    const list = customerListRef.current;
    if (!list) return;
    const item = list.querySelector(`[data-index="${customerHighlightIndex}"]`);
    if (item) item.scrollIntoView({ block: "nearest" });
  }, [customerHighlightIndex, customerSearch]);

  useEffect(() => {
    const list = productListRef.current;
    if (!list) return;
    const item = list.querySelector(`[data-index="${productHighlightIndex}"]`);
    if (item) item.scrollIntoView({ block: "nearest" });
  }, [productHighlightIndex, productSearch]);

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
    const stepTwoSelected = stepOneDone && !isVehiclePickerVisible;

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
  }, [selectedCustomer?.customer_id, isVehiclePickerVisible]);

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
        <div className={ERP_SEMANTIC_TONES.restrictedBanner}>
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
                </div>
              </div>
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
            <CarFront className="h-4 w-4" />
            <span>Paso 2: Seleccionar opción de vehículo</span>
          </Label>
          {!stepOneComplete ? (
            <p className="text-xs text-muted-foreground">Completa el paso 1 para habilitar la selección de vehículo</p>
          ) : null}
          {isVehiclePickerVisible ? (
            <div className={`grid gap-2 ui-fade-in-stagger ${selectedCustomer ? "sm:grid-cols-2" : ""}`}>
              <button
                type="button"
                disabled={!selectedCustomer || sellerFlowLocked}
                onClick={() => {
                  setIsVehiclePickerVisible(false);
                  handleSelectVehicleFlow("carryout", "");
                }}
                className={`rounded-lg border p-3 text-left transition-colors ui-interactive ${selectedVehicleOption === "carryout"
                  ? "border-emerald-500 bg-emerald-100/80 dark:border-emerald-500/50 dark:bg-emerald-500/20"
                  : "border-emerald-200 bg-emerald-50/80 hover:bg-emerald-100/80 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20"} ${!selectedCustomer ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <p className="font-medium text-emerald-900 dark:text-emerald-100 inline-flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                  Producto para llevar
                </p>
                <p className="text-xs text-emerald-800 dark:text-emerald-200/90 mt-1">Venta sin instalación ni vehículo registrado</p>
              </button>

              {customerVehicles.map((v) => {
                const plate = v.plate || v.plate_number || v.number_plate || "Sin placa";
                const vin = v.vin || v.chasis || v.chassis || "Sin chasis";
                const color = v.color || v.vehicle_color || v.colour || "Sin color";
                const catalogHint = formatVehicleIdentityHint(v.brand, v.year, v.model);
                const vehicleOptionId = normalizeVehicleId(v.vehicle_id ?? v.id);
                const isActiveVehicle = selectedVehicleOption === `vehicle:${vehicleOptionId}`;
                return (
                  <button
                    key={v.vehicle_id ?? v.id}
                    type="button"
                    disabled={!selectedCustomer || sellerFlowLocked}
                    onClick={() => {
                      setIsVehiclePickerVisible(false);
                      handleSelectVehicleFlow("registered", vehicleOptionId);
                    }}
                    className={`rounded-lg border p-3 text-left transition-colors ui-interactive ${isActiveVehicle
                      ? "border-sky-500 bg-sky-100/80 dark:border-sky-500/50 dark:bg-sky-500/20"
                      : "border-sky-200 bg-sky-50/80 hover:bg-sky-100/80 dark:border-sky-500/30 dark:bg-sky-500/10 dark:hover:bg-sky-500/20"} ${!selectedCustomer ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <p className="font-medium text-sky-900 dark:text-sky-100 inline-flex items-center gap-1.5">
                      <CarFront className="h-4 w-4 text-sky-700 dark:text-sky-300" />
                      {[v.brand, v.model, v.year].filter(Boolean).join(" ") || "Vehículo"}
                    </p>
                    {catalogHint ? (
                      <p className="text-[11px] text-sky-800/90 mt-1">{catalogHint}</p>
                    ) : null}
                    <p className="text-xs text-sky-800 mt-1">{plate}</p>
                    <p className="text-[11px] text-sky-700 mt-0.5">{vin} • {color}</p>
                  </button>
                );
              })}

              <button
                type="button"
                disabled={!selectedCustomer || sellerFlowLocked}
                onClick={() => {
                  setIsVehiclePickerVisible(false);
                  setShowNewVehicleDialog(true);
                  handleSelectVehicleFlow("new", "");
                }}
                className={`rounded-lg border p-3 text-left transition-colors ui-interactive ${selectedVehicleOption === "new"
                  ? "border-violet-500 bg-violet-100/80 dark:border-violet-500/50 dark:bg-violet-500/20"
                  : "border-violet-200 bg-violet-50/80 hover:bg-violet-100/80 dark:border-violet-500/30 dark:bg-violet-500/10 dark:hover:bg-violet-500/20"} ${!selectedCustomer ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <p className="font-medium text-violet-900 dark:text-violet-100 inline-flex items-center gap-1.5">
                  <PlusCircle className="h-4 w-4 text-violet-700 dark:text-violet-300" />
                  Registrar nuevo vehículo
                </p>
                <p className="text-xs text-violet-800 mt-1">Agregar otro vehículo a este cliente</p>
              </button>
            </div>
          ) : null}

          {!selectedCustomer ? (
            <p className="text-xs text-muted-foreground">Primero selecciona un cliente para ver sus opciones de vehículo</p>
          ) : null}

          {vehicleFlowOption === "carryout" && (
            <p className="text-xs text-muted-foreground">
              Venta configurada como producto para llevar. No se aplicará instalación.
            </p>
          )}

          {!isVehiclePickerVisible && vehicleFlowOption === "carryout" && selectedCustomer ? (
            <div className={cn(CUSTOMER_VEHICLE_CARD_PATTERNS.shared.shell, CUSTOMER_VEHICLE_CARD_PATTERNS.carryout.shell)}>
              <div className={CUSTOMER_VEHICLE_CARD_PATTERNS.shared.split}>
                <div className="min-w-0 space-y-1.5">
                  <p className={CUSTOMER_VEHICLE_CARD_PATTERNS.carryout.title}>
                    <Package className="h-4 w-4 shrink-0 text-emerald-700" />
                    Producto para llevar
                  </p>
                  <p className="text-xs text-emerald-900/90">Venta sin instalación ni vehículo registrado</p>
                </div>
                <div className={CUSTOMER_VEHICLE_CARD_PATTERNS.shared.actions}>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 px-2.5 text-sm font-medium ui-interactive"
                    disabled={sellerFlowLocked}
                    onClick={() => setIsVehiclePickerVisible(true)}
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

          {!isVehiclePickerVisible && vehicleFlowOption === "registered" && selectedVehicleData ? (
            <div className={cn(CUSTOMER_VEHICLE_CARD_PATTERNS.shared.shell, CUSTOMER_VEHICLE_CARD_PATTERNS.vehicle.shell, vehiclePulseActive && ERP_ANIMATION_CLASSES.pulse)}>
              <div className={CUSTOMER_VEHICLE_CARD_PATTERNS.shared.split}>
                <div className={CUSTOMER_VEHICLE_CARD_PATTERNS.shared.info}>
                  <p className={CUSTOMER_VEHICLE_CARD_PATTERNS.vehicle.title}>
                    <CarFront className="h-4 w-4 shrink-0 text-sky-700" />
                    <span className="min-w-0 whitespace-normal break-words">{[selectedVehicleData.brand, selectedVehicleData.model, selectedVehicleData.year].filter(Boolean).join(" ") || "Vehículo seleccionado"}</span>
                  </p>

                  <div className={CUSTOMER_VEHICLE_CARD_PATTERNS.vehicle.metaGrid}>
                    <p className="inline-flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-sky-700" />
                      {selectedVehicleData.plate || selectedVehicleData.plate_number || selectedVehicleData.number_plate || "Sin placa"}
                    </p>
                    <p className="inline-flex items-center gap-1.5">
                      <Palette className="h-3.5 w-3.5 text-sky-700" />
                      {selectedVehicleData.color || selectedVehicleData.vehicle_color || selectedVehicleData.colour || "Sin color"}
                    </p>
                    <p className="inline-flex items-center gap-1.5 sm:col-span-2">
                      <FileText className="h-3.5 w-3.5 text-sky-700" />
                      <span className="truncate">{selectedVehicleData.vin || selectedVehicleData.chasis || selectedVehicleData.chassis || "Sin chasis"}</span>
                    </p>
                  </div>
                </div>

                <div className={CUSTOMER_VEHICLE_CARD_PATTERNS.shared.actions}>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 px-2.5 text-sm font-medium ui-interactive"
                    disabled={sellerFlowLocked}
                    onClick={() => {
                      setIsVehiclePickerVisible(true);
                      handleSelectVehicleFlow("carryout", "");
                    }}
                  >
                    <RefreshCcw className="h-4 w-4 mr-1.5" />
                    Cambiar
                  </Button>
                  <Badge variant="outline" className={CUSTOMER_VEHICLE_CARD_PATTERNS.vehicle.badge}>
                    Vehículo
                  </Badge>
                </div>
              </div>
            </div>
          ) : null}

          {stepOneComplete && selectedCustomer ? (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/30">
              <Label className="inline-flex items-center gap-2">
                <Truck className="h-4 w-4" />
                <span>Opción logística (obligatoria)</span>
              </Label>
              <div className="grid gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  disabled={sellerFlowLocked}
                  onClick={() => handleSelectLogisticMode("carryout")}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors ui-interactive",
                    logisticMode === "carryout"
                      ? "border-emerald-500 bg-emerald-100/80 dark:border-emerald-500/50 dark:bg-emerald-500/20"
                      : "border-emerald-200 bg-white hover:bg-emerald-50/80 dark:border-emerald-500/30 dark:bg-slate-900/40",
                  )}
                >
                  <p className="font-medium inline-flex items-center gap-1.5">
                    <Package className="h-4 w-4" />
                    Para llevar
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Venta sin instalación en vehículo</p>
                </button>
                <button
                  type="button"
                  disabled={sellerFlowLocked}
                  onClick={() => handleSelectLogisticMode("installed")}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors ui-interactive",
                    logisticMode === "installed"
                      ? "border-sky-500 bg-sky-100/80 dark:border-sky-500/50 dark:bg-sky-500/20"
                      : "border-sky-200 bg-white hover:bg-sky-50/80 dark:border-sky-500/30 dark:bg-slate-900/40",
                  )}
                >
                  <p className="font-medium inline-flex items-center gap-1.5">
                    <Wrench className="h-4 w-4" />
                    Instalado
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Requiere vehículo registrado</p>
                </button>
                <button
                  type="button"
                  disabled={sellerFlowLocked}
                  onClick={() => handleSelectLogisticMode("delivery")}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors ui-interactive",
                    logisticMode === "delivery"
                      ? "border-amber-500 bg-amber-100/80 dark:border-amber-500/50 dark:bg-amber-500/20"
                      : "border-amber-200 bg-white hover:bg-amber-50/80 dark:border-amber-500/30 dark:bg-slate-900/40",
                  )}
                >
                  <p className="font-medium inline-flex items-center gap-1.5">
                    <Truck className="h-4 w-4" />
                    Con envío incluido
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Delivery con mensajero asignado</p>
                </button>
              </div>

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
            <p className="text-xs text-muted-foreground">Selecciona cliente y opción de vehículo para habilitar productos</p>
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
                  className="mb-0 pl-9 pr-12"
                />
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
              {filteredProducts.map((p, index) => (
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

                  return (
                <button
                  key={p.product_id}
                  data-index={index}
                  type="button"
                  className={cn(
                    "grid w-full grid-cols-[72px_minmax(0,1fr)] items-start gap-3 rounded-xl border p-3 text-left shadow-sm transition-colors ui-interactive ui-panel sm:grid-cols-[88px_minmax(0,1fr)] sm:p-2.5",
                    ERP_SEARCH_ROW.product,
                    tone.base,
                    tone.hover,
                    index === productHighlightIndex ? tone.selected : ""
                  )}
                  onClick={(event) => addToCart(p, { sourceElement: event.currentTarget })}
                  onMouseEnter={() => setProductHighlightIndex(index)}
                >
                  {p.images?.[0] ? <img src={p.images[0]} alt={p.name} className="row-span-2 h-[4.5rem] w-[4.5rem] rounded-lg object-cover bg-muted/30 sm:h-20 sm:w-20 sm:row-span-1" /> : <div className="row-span-2 h-[4.5rem] w-[4.5rem] rounded-lg bg-muted/50 sm:h-20 sm:w-20 sm:row-span-1" />}
                  <div className="min-w-0 self-start">
                    <p className={cn("text-[13px] font-semibold leading-tight whitespace-normal break-words", tone.title)}>{p.name}</p>
                    <p className={cn("mt-0.5 text-[11px]", tone.sku)}>{p.sku}</p>
                    {p.installation_type === "not_available" && (
                      <Badge variant="secondary" className="mt-2 text-[10px]">Solo para llevar</Badge>
                    )}

                    <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3">
                      {(() => {
                        const userBranchId = String(user?.branch_id || "");
                        const fallbackStockValue = getLocalStoreStockValue(p);
                        const hasFallbackStockValue = Number.isFinite(fallbackStockValue);
                        const fallbackThreshold = getProductStockThreshold(p);
                        const stockRows = Array.isArray(inventory)
                          ? inventory.filter((row) => String(row?.product_id || "") === String(p.product_id || "") && Number(row?.quantity || 0) > 0)
                          : [];

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

                        const warehouseById = new Map((warehouses || []).map((wh) => [String(wh.warehouse_id), wh]));

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
                              <ErpRollingQuantity value={qty} className={cn(qtyClassName)} />
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
                              <ErpRollingCurrency value={convertPrice(p.price + (p.installation_price || 0))} currency={currency} />
                            </p>
                            {/* Para llevar abajo (grande, negrita = seleccionado) */}
                            <p className={cn("inline-flex items-center gap-1 font-mono text-[13px] font-extrabold", tone.emphasisPrice)}>
                              {isServiceProduct ? (
                                <Hand className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              ) : (
                                <Package className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              )}
                              <ErpRollingCurrency value={convertPrice(p.price)} currency={currency} />
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
                              <ErpRollingCurrency value={convertPrice(p.price)} currency={currency} />
                            </p>
                            {/* Con instalación abajo */}
                            {p.installation_type !== "not_available" && (p.installation_price || 0) > 0 && (
                              <p className={cn(
                                "inline-flex items-center gap-1 font-mono text-[13px]",
                                hasSelectedVehicle ? cn("font-extrabold", tone.emphasisPrice) : "text-muted-foreground"
                              )}>
                                <Wrench className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                <ErpRollingCurrency value={convertPrice(p.price + (p.installation_price || 0))} currency={currency} />
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
          <p className="text-xs text-muted-foreground">Los pasos 4 y 5 se habilitan después de seleccionar la opción de vehículo</p>
        ) : null}
        {cartFlashActive ? (
          <div className="pointer-events-none absolute inset-x-3 top-10 h-28 rounded-3xl bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.98),rgba(186,230,253,0.34)_35%,rgba(255,255,255,0)_70%)] opacity-90 blur-sm" />
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
            const canEditLinePrice = isSupervisorUser;
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
                  {hasSelectedVehicle && (() => {
                    const installType = item.installation_type || "optional";
                    if (installType === "not_available") return <Badge variant="outline" className="px-1.5 py-0 text-[10px]">Para llevar</Badge>;
                    if (installType === "required" || Boolean(item.with_installation)) return <Badge variant="outline" className="border-sky-300 bg-sky-50/50 px-1.5 py-0 text-[10px] text-sky-800">Instalado</Badge>;
                    return null;
                  })()}
                  {item.sample_status === "requested" && (
                    <Badge variant="outline" className="border-violet-300 bg-violet-50/50 px-1.5 py-0 text-[10px] text-violet-700">Muestra</Badge>
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
            <DialogHeader>
              <DialogTitle>Editar precio del producto</DialogTitle>
              <DialogDescription>
                {priceEditorItem?.product_name || "Producto"}
              </DialogDescription>
            </DialogHeader>
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
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closePriceEditor}>Cancelar</Button>
              <Button type="button" onClick={applyPriceEditor}>Aplicar precio</Button>
            </div>
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

        {selectedCustomer && !isCompanyCustomerFlow ? (
          <p className="text-xs text-muted-foreground">
            Para cliente persona natural, el IVA es opcional.
          </p>
        ) : null}

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
                  if (isCompanyCustomerFlow) return;
                  const nextValue = Boolean(v);
                  setApplyIVA(nextValue);
                  persistDraftSnapshot({ applyIVA: nextValue });
                }}
                disabled={isCompanyCustomerFlow || sellerParamsLocked}
              />
              <span className="text-xs text-muted-foreground">
                {isCompanyCustomerFlow ? "Aplicación obligatoria para empresa" : "Aplicar IVA"}
              </span>
            </div>
            <Badge variant="secondary" className="font-mono">15% fijo</Badge>
          </div>
        </div>

        {isCompanyCustomerFlow && (
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
                  Retención sobre subtotal (habilita desde C$1,000.00 después de descuentos)
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
        )}

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
          <Button onClick={handleSubmit} className="flex-1">
            <ShieldCheck className="h-4 w-4 mr-2" />
            {submitLabel}
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
              setVehicleFlowOption(selectedVehicle ? "registered" : "carryout");
            }
          }
          persistDraftSnapshot({
            showNewVehicleDialog: open,
            vehicleFlowOption: open ? "new" : (selectedVehicle ? "registered" : "carryout"),
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
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="inline-flex items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              <span>Registrar Vehículo</span>
            </DialogTitle>
            <DialogDescription>
              Registra un nuevo vehículo para el cliente seleccionado usando marca, año y modelo del catálogo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
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

            <Button onClick={createVehicleForSelectedCustomer} className="w-full">
              <PlusCircle className="h-4 w-4 mr-2" />
              Registrar vehículo del cliente
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
        <DialogContent className={`max-w-4xl max-h-[85vh] overflow-y-auto border-2 ${newCustomerTone.modal}`}>
          <DialogHeader>
            <DialogTitle className="inline-flex items-center gap-2">
              {isNewCustomerCompany ? (
                <>
                  <Building2 className="h-4 w-4" />
                  <PlusCircle className="h-4 w-4" />
                </>
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              <span>{isNewCustomerCompany ? "Nueva Empresa" : "Nuevo Cliente"}</span>
            </DialogTitle>
            <DialogDescription>
              {isNewCustomerCompany
                ? "Registra una nueva empresa y opcionalmente su vehículo"
                : "Registra un nuevo cliente y opcionalmente su vehículo"}
            </DialogDescription>
          </DialogHeader>

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

          <Button onClick={createNewCustomer} className="w-full mt-3">
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
    </div>
  );
}
