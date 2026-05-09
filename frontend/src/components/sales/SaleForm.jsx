import React, { useCallback, useMemo, useState, useEffect, useRef } from "react";
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
  Undo2,
  User,
  UserSearch,
  UserPlus,
  Warehouse,
  Wrench,
  PackageSearch,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  getVehicleOptionsByBrandYear,
  getVehicleYearsByBrand,
  isValidVehicleSelection,
  VEHICLE_CATALOG_BRANDS,
  VEHICLE_COLOR_SUGGESTIONS,
} from "@/lib/vehicleCatalog";
import {
  getPaymentMethodSummaryLabel,
  normalizePaymentMethodCode,
  normalizePaymentMethodList,
  paymentMethodsAllowDiscounts,
} from "@/lib/paymentMethods";
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

// Formatear teléfono Nicaragua
const formatPhone = (value) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
};

// Formatear cédula Nicaragua (001-000000-0000A)
const formatCedula = (value) => {
  const clean = value.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  if (clean.length <= 3) return clean;
  if (clean.length <= 9) return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  return `${clean.slice(0, 3)}-${clean.slice(3, 9)}-${clean.slice(9, 14)}`;
};

// Formatear RUC Nicaragua (J0000000000000)
const formatRUC = (value) => {
  const clean = value.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  return clean.slice(0, 14);
};

// Formatear CHASIS (17 dígitos alfanuméricos sin I, O, Q, Ñ)
const formatChasis = (value) => {
  const clean = value.replace(/[^0-9A-HJ-NPR-Za-hj-npr-z]/g, "").toUpperCase();
  return clean.slice(0, 17);
};

const normalizeGlobalDiscountMode = (value) => (value === "fixed" ? "fixed" : "percent");

const clampGlobalDiscountValue = (value, mode = "percent") => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  if (mode === "fixed") {
    return Math.max(0, Number(numericValue.toFixed(2)));
  }
  return Math.max(0, Math.min(100, Math.round(numericValue)));
};

// Formatear placa según prefijo
const formatPlateNumber = (prefix, value) => {
  const digits = value.replace(/\D/g, "");
  if (prefix === "M") {
    if (digits.length <= 3) return digits;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)}`;
  }
  return digits.slice(0, 5);
};

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
  step5Label = "Paso 5: Metodo de Pago",
  currencyValue = null,
  onCurrencyChange = null,
  hideCurrencyField = false,
}) {
  const { user } = useAuth();
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
  const [paymentMethod, setPaymentMethod] = useState(initialData.paymentMethod || initialData.payment_type || "cash");
  const [notes, setNotes] = useState(initialData.notes || "");
  const [applyIVA, setApplyIVA] = useState(initialData.applyIVA ?? true);
  const [ivaRate, setIvaRate] = useState(initialData.ivaRate ?? defaultIvaRate);
  const [applyRetention, setApplyRetention] = useState(initialData.applyRetention ?? false);
  const [retentionRate, setRetentionRate] = useState(initialData.retentionRate ?? 2);
  const [mixedPaymentMethods, setMixedPaymentMethods] = useState(
    normalizePaymentMethodList(initialData.mixedPaymentMethods || initialData.mixed_payment_methods || [])
  );
  const [currency, setCurrency] = useState(initialData.currency || "NIO");
  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
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
  const didSmoothScrollRef = useRef(false);
  const longPressTimerRef = useRef(null);
  const longPressHideTimerRef = useRef(null);
  const quantityHoldTimersRef = useRef(new Map());
  const [activeStockBreakdownKey, setActiveStockBreakdownKey] = useState(null);
  const [customerHighlightIndex, setCustomerHighlightIndex] = useState(0);
  const [productHighlightIndex, setProductHighlightIndex] = useState(0);
  const [priceEditorOpen, setPriceEditorOpen] = useState(false);
  const [priceEditorItemId, setPriceEditorItemId] = useState(null);
  const [priceEditorMode, setPriceEditorMode] = useState("amount");
  const [priceEditorAmount, setPriceEditorAmount] = useState("");
  const [priceEditorPercent, setPriceEditorPercent] = useState("0");
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
  });
  const [newVehicle, setNewVehicle] = useState({
    plate_prefix: "M",
    plate_number: "",
    brand: "",
    model: "",
    year: "",
    color: "",
    chasis: "",
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
      label: "Credito",
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

  function applyCurrencyChange(nextCurrency) {
    if (isCurrencyControlled && typeof onCurrencyChange === "function") {
      onCurrencyChange(nextCurrency);
    }
    setCurrency(nextCurrency);
    persistDraftSnapshot({ currency: nextCurrency });
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

  const isCompanyCustomer = useCallback((customer) => {
    const type = String(customer?.customer_type || "").toLowerCase();
    return type === "empresa" || type === "company" || type === "juridica" || type === "juridico";
  }, []);

  const isCompanyCustomerFlow = Boolean(selectedCustomer) && isCompanyCustomer(selectedCustomer);

  const newCustomerTone = isNewCustomerCompany
    ? {
      modal: "border-blue-400 bg-blue-100/80",
      tabsList: "bg-blue-100/90",
      panel: "border border-blue-200 bg-blue-50/85 rounded-md p-3",
    }
    : {
      modal: "border-emerald-400 bg-emerald-100/80",
      tabsList: "bg-emerald-100/90",
      panel: "border border-emerald-200 bg-emerald-50/85 rounded-md p-3",
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
    () => getVehicleOptionsByBrandYear(newCustomer.brand, newCustomer.year),
    [newCustomer.brand, newCustomer.year]
  );

  const newVehicleYearOptions = useMemo(
    () => getVehicleYearsByBrand(newVehicle.brand),
    [newVehicle.brand]
  );

  const newVehicleModelOptions = useMemo(
    () => getVehicleOptionsByBrandYear(newVehicle.brand, newVehicle.year),
    [newVehicle.brand, newVehicle.year]
  );

  useEffect(() => {
    if (!draftLoaded) return;
    if (pendingCustomerId && !selectedCustomer) {
      return;
    }
    const normalizedSelectedVehicle = normalizeVehicleId(selectedVehicle);
    const hasRestorableVehicle = Boolean(normalizedSelectedVehicle);

    if (hasRestorableVehicle && localVehicles.length === 0) {
      return;
    }

    if (!selectedCustomer) {
      setVehicleFlowOption("carryout");
      setSelectedVehicle("");
      return;
    }
    if (customerVehicles.length === 0) {
      if (hasRestorableVehicle) {
        return;
      }
      setVehicleFlowOption("carryout");
      setSelectedVehicle("");
      return;
    }
    if (normalizedSelectedVehicle && customerVehicles.some(v => normalizeVehicleId(v.vehicle_id ?? v.id) === normalizedSelectedVehicle)) {
      if (vehicleFlowOption !== "registered") {
        setVehicleFlowOption("registered");
      }
      return;
    }
    if (vehicleFlowOption === "registered") {
      setVehicleFlowOption("carryout");
    }
  }, [draftLoaded, pendingCustomerId, selectedCustomer, customerVehicles, localVehicles.length, normalizeVehicleId, selectedVehicle, vehicleFlowOption]);

  useEffect(() => {
    if (vehicleFlowOption === "carryout") {
      setSelectedVehicle("");
      setCartItems(prev => prev.map(item => ({ ...item, with_installation: false })));
    }
  }, [vehicleFlowOption]);

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
      setGlobalDiscount(clampGlobalDiscountValue(draft?.globalDiscount || 0, restoredGlobalDiscountMode));
      setNotes(draft?.notes || "");
      setApplyIVA(draft?.applyIVA ?? true);
        setApplyRetention(draft?.applyRetention ?? false);
        setRetentionRate(draft?.retentionRate ?? 2);
      setIvaRate(defaultIvaRate);
      applyCurrencyChange(draft?.currency || "NIO");
      setCustomerSearch(draft?.customerSearch || "");
      setProductSearch(draft?.productSearch || "");
      setAppliedDiscounts(draft?.appliedDiscounts || []);
      setVehicleFlowOption(draft?.vehicleFlowOption || "carryout");
      if (draft?.vehicleFlowOption) {
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

  const addToCart = (product) => {
    const localStock = getLocalStoreStockValue(product);
    if (localStock <= 0) {
      toast.error("Sin existencias en tu tienda", {
        description: `"${product.name}" no tiene existencias disponibles en tu tienda y no puede ser agregado al carrito.`,
        duration: 4000,
      });
      return;
    }
    const existing = normalizedCartItems.find(item => item.product_id === product.product_id);
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
        },
      ];
    }
    setCartItems(nextCartItems);
    persistDraftSnapshot({ cartItems: nextCartItems });
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
    if (discountsBlockedByPayment) {
      toast.error("Con este metodo de pago no aplican descuentos ni promociones");
      return;
    }
    const normalizedCode = String(discountCode || "").trim().toUpperCase();
    if (!normalizedCode) {
      toast.error("Ingresa un codigo de descuento");
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
      }));
      toast.success("VIN decodificado");
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo decodificar el VIN");
    } finally {
      setIsDecodingVin(false);
    }
  };

  const createNewCustomer = async () => {
    if (!newCustomer.first_name || !newCustomer.phone) {
      toast.error("Nombre y teléfono son requeridos");
      return;
    }

    if (isNewCustomerCompany && !String(newCustomer.tax_id || "").trim()) {
      toast.error("El RUC es requerido para registrar una empresa");
      return;
    }

    try {
      const fullPhone = `${newCustomer.phone_prefix}-${newCustomer.phone}`;
      const customerData = {
        name: `${newCustomer.first_name} ${newCustomer.last_name}`.trim(),
        first_name: newCustomer.first_name,
        last_name: newCustomer.last_name,
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

      if (newCustomer.add_vehicle && newCustomer.brand && newCustomer.model) {
        if (!newCustomer.year) {
          toast.error("Selecciona el año del vehículo");
          return;
        }
        if (!isValidVehicleSelection(newCustomer.brand, newCustomer.year, newCustomer.model)) {
          toast.error("Marca, año y modelo deben seleccionarse desde la lista");
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
          vehicle_type: "sedan",
        };

        await axios.post(`${API}/vehicles`, vehicleData, { withCredentials: true });
        toast.success("Vehículo registrado");
        playCreationSuccessSound();

        const vehiclesRes = await axios.get(`${API}/vehicles`, { withCredentials: true });
        setLocalVehicles(vehiclesRes.data);
      }

      const customersRes = await axios.get(`${API}/customers`, { withCredentials: true });
      setLocalCustomers(customersRes.data);
      const created = customersRes.data.find(c => c.customer_id === customerId);
      if (created) {
        setSelectedCustomer(created);
      }

      resetNewCustomerForm();
      setShowNewCustomer(false);
      if (typeof onDataRefresh === "function") {
        onDataRefresh();
      }
      persistDraftSnapshot({
        selectedCustomerId: customerId,
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
        vehicle_type: "sedan",
      };

      const response = await axios.post(`${API}/vehicles`, vehicleData, { withCredentials: true });
      const createdVehicleId = response?.data?.vehicle_id;

      const vehiclesRes = await axios.get(`${API}/vehicles`, { withCredentials: true });
      setLocalVehicles(vehiclesRes.data);
      if (typeof onDataRefresh === "function") {
        onDataRefresh();
      }

      setVehicleFlowOption("registered");
      if (createdVehicleId) {
        setSelectedVehicle(normalizeVehicleId(createdVehicleId));
      }
      setShowNewVehicleDialog(false);
      resetNewVehicleForm();
      persistDraftSnapshot({
        vehicleFlowOption: "registered",
        selectedVehicle: normalizeVehicleId(createdVehicleId),
        showNewVehicleDialog: false,
        newVehicle: {
          plate_prefix: "M",
          plate_number: "",
          brand: "",
          model: "",
          year: "",
          color: "",
          chasis: "",
        },
        useVehicleVinDecoder: false,
      });
      toast.success("Vehículo registrado para el cliente");
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo registrar el vehículo");
    }
  };

  const convertPrice = (priceUSD) => {
    if (currency === "NIO") {
      return priceUSD * exchangeRate;
    }
    return priceUSD;
  };

  const totals = (() => {
    const lineBreakdown = normalizedCartItems.map((item) => {
      const effectiveItemDiscount = discountsBlockedByPayment ? 0 : (item.discount || 0);
      const unitPriceInCurrency = convertPrice(item.unit_price);
      const originalUnitPrice = Number(item.original_unit_price || item.unit_price || 0);
      const originalUnitPriceInCurrency = convertPrice(originalUnitPrice);
      const currentLineBase = unitPriceInCurrency * item.quantity * (1 - effectiveItemDiscount / 100);
      const originalLineBase = originalUnitPriceInCurrency * item.quantity * (1 - effectiveItemDiscount / 100);
      const installType = item.installation_type || "optional";
      const wantsInstall = hasSelectedVehicle && (installType === "required" || Boolean(item.with_installation));
      const installTotal = installType !== "not_available" && wantsInstall
        ? convertPrice(item.installation_price || 0) * item.quantity
        : 0;
      const manualPriceDiscount = Math.max(0, originalLineBase - currentLineBase);
      return {
        item,
        originalLineTotal: originalLineBase + installTotal,
        manualPriceDiscount,
      };
    });

    const subtotalWithoutDiscounts = lineBreakdown.reduce((sum, row) => sum + row.originalLineTotal, 0);
    const manualPriceDiscountEntries = lineBreakdown
      .filter((row) => row.manualPriceDiscount > 0.000001)
      .map((row) => ({
        productId: row.item.product_id,
        productName: row.item.product_name || "Producto",
        amount: row.manualPriceDiscount,
      }));
    const manualPriceDiscountTotal = manualPriceDiscountEntries.reduce((sum, row) => sum + row.amount, 0);
    const subtotalAfterItemPriceDiscounts = subtotalWithoutDiscounts - manualPriceDiscountTotal;

    let discountFromCodesRaw = 0;
    appliedDiscounts.forEach(d => {
      if (d.type === "percent") {
        discountFromCodesRaw += subtotalAfterItemPriceDiscounts * (d.value / 100);
      } else if (d.type === "fixed") {
        const fixedInCurrency = currency === "USD" ? d.value / exchangeRate : d.value;
        discountFromCodesRaw += fixedInCurrency;
      }
    });

    const requestedGlobalDiscountRaw = Math.max(0, Number(globalDiscount) || 0);
    const discountAmountRaw = globalDiscountMode === "fixed"
      ? Math.min(requestedGlobalDiscountRaw, subtotalAfterItemPriceDiscounts)
      : subtotalAfterItemPriceDiscounts * (requestedGlobalDiscountRaw / 100);
    const totalDiscountsRaw = discountFromCodesRaw + discountAmountRaw;
    const discountFromCodes = discountsBlockedByPayment ? 0 : discountFromCodesRaw;
    const discountAmount = discountsBlockedByPayment ? 0 : discountAmountRaw;
    const totalDiscounts = discountFromCodes + discountAmount;
    const blockedDiscountsAmount = discountsBlockedByPayment ? totalDiscountsRaw : 0;
    const subtotalForRetention = subtotalAfterItemPriceDiscounts - totalDiscounts;
    const shouldApplyRetention = isCompanyCustomerFlow && applyRetention;
    const retention = shouldApplyRetention ? subtotalForRetention * (retentionRate / 100) : 0;
    const tax = applyIVA ? subtotalForRetention * (ivaRate / 100) : 0;
    const total = subtotalForRetention + tax - retention;
    const globalDiscountEffectivePercent = subtotalAfterItemPriceDiscounts > 0
      ? (discountAmountRaw / subtotalAfterItemPriceDiscounts) * 100
      : 0;
    return {
      subtotalWithoutDiscounts,
      manualPriceDiscountEntries,
      manualPriceDiscountTotal,
      subtotalForRetention,
      tax,
      discountAmount,
      globalDiscountEffectivePercent,
      discountFromCodes,
      totalDiscounts,
      blockedDiscountsAmount,
      discountsBlockedByPayment,
      retention,
      total,
    };
  })();

  const handleSubmit = async () => {
    const payloadPaymentMethod = normalizedPaymentMethod;
    const payloadMixedPaymentMethods = normalizedPaymentMethod === "mixed" ? normalizedMixedPaymentMethods : [];
    if (normalizedPaymentMethod === "mixed" && payloadMixedPaymentMethods.length === 0) {
      toast.error("Selecciona al menos un método para el pago mixto");
      return;
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
        product_name: i.product_name,
        with_installation: hasSelectedVehicle && (i.installation_type === "required" || Boolean(i.with_installation)),
      })),
      discount: payloadDiscountPercent,
      payment_type: payloadPaymentMethod,
      payment_method: payloadPaymentMethod,
      mixed_payment_methods: payloadMixedPaymentMethods,
      credit_days: payloadPaymentMethod === "credit" ? 30 : null,
      currency,
      apply_iva: applyIVA,
      iva_rate: ivaRate,
      apply_retention: isCompanyCustomerFlow && applyRetention,
      retention_rate: (isCompanyCustomerFlow && applyRetention) ? retentionRate / 100 : 0,
      retention_amount: totals.retention,
      exchange_rate: exchangeRate,
      discount_codes: payloadDiscountCodes,
      applied_discounts: payloadAppliedDiscounts,
      discounts_blocked_by_method: totals.discountsBlockedByPayment,
      total_amount: totals.total,
      notes,
    };
    try {
      const result = onSubmit && onSubmit(payload);
      if (result && typeof result.then === "function") {
        await result;
      }
      if (draftKey && typeof window !== "undefined") {
        window.localStorage.removeItem(draftKey);
        if (typeof onDraftClear === "function") {
          onDraftClear();
        }
      }
    } catch (error) {
      // Keep draft on error
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
    const snapshot = buildDraftSnapshot(overrides);
    const snapshotEmpty = !snapshot?.selectedCustomerId
      && (!snapshot?.cartItems || snapshot.cartItems.length === 0)
      && !snapshot?.notes
      && !snapshot?.customerSearch
      && !snapshot?.productSearch
      && !snapshot?.globalDiscount
      && (snapshot?.globalDiscountMode || "percent") === "percent"
      && (snapshot?.paymentMethod || "cash") === "cash"
      && (!snapshot?.mixedPaymentMethods || snapshot.mixedPaymentMethods.length === 0)
      && (!snapshot?.appliedDiscounts || snapshot.appliedDiscounts.length === 0)
      && !hasNestedDraftData(snapshot);

    if (snapshotEmpty) {
      window.localStorage.removeItem(draftKey);
      draftSnapshotRef.current = null;
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
  }, [buildDraftSnapshot, draftKey, hasNestedDraftData, onDraftPersist, onDraftSaveStateChange]);

  const applyGlobalDiscountChange = useCallback((nextValue) => {
    const normalizedValue = clampGlobalDiscountValue(nextValue, globalDiscountMode);
    setGlobalDiscount(normalizedValue);
    persistDraftSnapshot({ globalDiscount: normalizedValue });
  }, [globalDiscountMode, persistDraftSnapshot]);

  const applyGlobalDiscountModeChange = useCallback((nextModeValue) => {
    const nextMode = normalizeGlobalDiscountMode(nextModeValue);
    const normalizedValue = clampGlobalDiscountValue(globalDiscount, nextMode);
    setGlobalDiscountMode(nextMode);
    setGlobalDiscount(normalizedValue);
    playSelectionFeedbackSound();
    persistDraftSnapshot({
      globalDiscountMode: nextMode,
      globalDiscount: normalizedValue,
    });
  }, [globalDiscount, persistDraftSnapshot]);

  const undoCartChange = useCallback(() => {
    if (cartHistory.current.length === 0) return;
    const [{ snapshot: prev, label }, ...rest] = cartHistory.current;
    cartHistory.current = rest;
    setCartItems(prev);
    persistDraftSnapshot({ cartItems: prev });
    playUndoSound();
    toast.info(label || "Acción deshecha");
  }, [persistDraftSnapshot]);

  const handleSelectCustomer = useCallback((customer) => {
    setSelectedCustomer(customer);
    setPendingCustomerId(null);
    setCustomerSearch("");
    setSelectedVehicle("");
    setVehicleFlowOption("carryout");
    setIsVehiclePickerVisible(true);
    playSelectionFeedbackSound();
    persistDraftSnapshot({
      selectedCustomerId: customer?.customer_id || null,
      customerSearch: "",
      selectedVehicle: "",
      vehicleFlowOption: "carryout",
    });
  }, [persistDraftSnapshot]);

  const handleClearSelectedCustomer = useCallback(() => {
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
    });
    setTimeout(() => customerSearchRef.current?.focus(), 0);
  }, [persistDraftSnapshot]);

  const handleSelectVehicleFlow = useCallback((nextFlowOption, nextVehicleId = "") => {
    const normalizedVehicleId = normalizeVehicleId(nextVehicleId);
    const nextCartItems = nextFlowOption === "carryout"
      ? normalizedCartItems.map((item) => ({ ...item, with_installation: false }))
      : normalizedCartItems;
    setVehicleFlowOption(nextFlowOption);
    setSelectedVehicle(normalizedVehicleId);
    playSelectionFeedbackSound();
    if (nextFlowOption === "carryout") {
      setCartItems(nextCartItems);
    }
    persistDraftSnapshot({
      vehicleFlowOption: nextFlowOption,
      selectedVehicle: normalizedVehicleId,
      cartItems: nextCartItems,
      showNewVehicleDialog: nextFlowOption === "new",
    });
  }, [normalizeVehicleId, normalizedCartItems, persistDraftSnapshot]);

  const updateCartItem = useCallback((productId, field, value, options = {}) => {
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
  }, [normalizedCartItems, persistDraftSnapshot, pushCartHistory]);

  const removeFromCart = useCallback((productId) => {
    const item = normalizedCartItems.find(i => i.product_id === productId);
    const name = item?.product_name || "producto";
    pushCartHistory([...normalizedCartItems], `Se restauró "${name}" al carrito`);
    const nextCartItems = normalizedCartItems.filter(i => i.product_id !== productId);
    setCartItems(nextCartItems);
    playCartRemoveSound();
    persistDraftSnapshot({ cartItems: nextCartItems });
  }, [normalizedCartItems, persistDraftSnapshot, pushCartHistory]);

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
  }, [convertPrice]);

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

    updateCartItem(
      priceEditorItem.product_id,
      "unit_price",
      roundedNextUnitPrice,
      {
        persist: true,
        patch: {
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
      toast.error("Selecciona un cliente antes de buscar desde catalogo");
      return;
    }

    if (typeof onOpenCatalogSearch === "function") {
      onOpenCatalogSearch(snapshot);
      return;
    }

    if (draftKey && typeof window !== "undefined") {
      window.localStorage.setItem(draftKey, JSON.stringify(snapshot));
      window.localStorage.setItem("catalog_open_draft", "sale");
      window.location.href = "/catalog";
      return;
    }

    toast.error("No se pudo abrir catalogo porque no hay un borrador activo");
  }, [buildDraftSnapshot, draftKey, onOpenCatalogSearch]);

  const isSnapshotEmpty = (snapshot) => {
    if (!snapshot) return true;
    return !snapshot.selectedCustomerId
      && (!snapshot.cartItems || snapshot.cartItems.length === 0)
      && !snapshot.notes
      && !snapshot.customerSearch
      && !snapshot.productSearch
      && !snapshot.globalDiscount
      && (snapshot?.globalDiscountMode || "percent") === "percent"
      && (snapshot?.paymentMethod || "cash") === "cash"
      && (!snapshot.appliedDiscounts || snapshot.appliedDiscounts.length === 0)
      && !hasNestedDraftData(snapshot);
  };

  useEffect(() => {
    if (!draftKey || typeof window === "undefined") return undefined;
    return () => {
      // If draft was explicitly cleared (key removed), do not resurrect stale data on unmount.
      if (window.localStorage.getItem(draftKey) === null) {
        return;
      }
      if (draftSnapshotRef.current) {
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
    const searchLower = productSearch.toLowerCase();
    return products.filter(p =>
      p.name?.toLowerCase().includes(searchLower) ||
      p.sku?.toLowerCase().includes(searchLower)
    );
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

  const getProductTone = useCallback((stockStatus, isServiceProduct) => {
    if (isServiceProduct) {
      return {
        base: "border-blue-200 bg-blue-50/70",
        hover: "hover:border-blue-300 hover:bg-blue-100/80",
        selected: "border-blue-500 bg-blue-100/90 ring-2 ring-blue-200",
        title: "text-blue-950",
        sku: "text-blue-800/75",
        emphasisPrice: "text-blue-950",
      };
    }

    const toneByStatus = {
      in_stock: {
        base: "border-emerald-200 bg-emerald-50/70",
        hover: "hover:border-emerald-300 hover:bg-emerald-100/80",
        selected: "border-emerald-500 bg-emerald-100/90 ring-2 ring-emerald-200",
        title: "text-emerald-950",
        sku: "text-emerald-800/75",
        emphasisPrice: "text-emerald-950",
      },
      low_stock: {
        base: "border-amber-200 bg-amber-50/70",
        hover: "hover:border-amber-300 hover:bg-amber-100/80",
        selected: "border-amber-500 bg-amber-100/90 ring-2 ring-amber-200",
        title: "text-amber-950",
        sku: "text-amber-800/75",
        emphasisPrice: "text-amber-950",
      },
      out_of_stock: {
        base: "border-rose-200 bg-rose-50/70",
        hover: "hover:border-rose-300 hover:bg-rose-100/80",
        selected: "border-rose-500 bg-rose-100/90 ring-2 ring-rose-200",
        title: "text-rose-950",
        sku: "text-rose-800/75",
        emphasisPrice: "text-rose-950",
      },
    };

    return toneByStatus[stockStatus] || toneByStatus.in_stock;
  }, []);

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
      if (item) addToCart(item);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setProductSearch("");
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
    const stepTwoDone = Boolean(vehicleFlowOption);
    if (!stepOneDone || !stepTwoDone) {
      didSmoothScrollRef.current = false;
      return;
    }
    if (didSmoothScrollRef.current) return;

    const leftPane = leftPaneRef.current;
    if (!leftPane) return;
    didSmoothScrollRef.current = true;

    if (typeof leftPane.scrollTo === "function") {
      leftPane.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [selectedCustomer?.customer_id, vehicleFlowOption]);

  useEffect(() => {
    return () => clearBreakdownTimers();
  }, [clearBreakdownTimers]);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:gap-6">
      <div ref={leftPaneRef} className="space-y-4">
        <div>
          <Label className="inline-flex items-center gap-2">
            <User className="h-4 w-4" />
            <span>Paso 1: Agregar Cliente/Empresa o buscar en la lista</span>
          </Label>
          {!selectedCustomer ? (
            <div className="flex items-center gap-2 mb-2">
              <div className="relative flex-1">
                <UserSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, teléfono o cédula..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  onKeyDown={handleCustomerSearchKeyDown}
                  ref={customerSearchRef}
                  className="mb-0 pl-9"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowNewCustomer(true);
                  persistDraftSnapshot({ showNewCustomer: true });
                }}
                title="Nuevo Registro"
                className={cn(isPortraitOrientation ? "w-8 px-0" : "")}
              >
                {isPortraitOrientation ? (
                  <>
                    <UserPlus className="h-4 w-4" />
                    <span className="sr-only">Nuevo Registro</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Nuevo Registro
                  </>
                )}
              </Button>
            </div>
          ) : null}
          {selectedCustomer ? (
            <div className={cn("mb-3", CUSTOMER_VEHICLE_CARD_PATTERNS.shared.shell, CUSTOMER_VEHICLE_CARD_PATTERNS.customer.shell)}>
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
              <div ref={customerListRef} className="border rounded-sm max-h-64 overflow-y-auto p-2 animate-fade-up-soft">
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
                      const rowTone = isCompany
                        ? "border-blue-200 bg-blue-50/70 hover:bg-blue-100/80"
                        : "border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/80";
                      const activeTone = isCompany ? "ring-2 ring-blue-300" : "ring-2 ring-emerald-300";
                      return (
                        <button
                          key={c.customer_id}
                          data-index={index}
                          type="button"
                          className={`w-full rounded-lg border p-2.5 text-left transition-colors ui-interactive ${rowTone} ${isHighlighted ? activeTone : ""}`}
                          onClick={() => handleSelectCustomer(c)}
                          onMouseEnter={() => setCustomerHighlightIndex(index)}
                        >
                          <p className="text-sm font-semibold inline-flex items-center gap-1.5 text-slate-900">
                            {isCompany ? <Building2 className="h-4 w-4 text-blue-700" /> : <User className="h-4 w-4 text-emerald-700" />}
                            {c.name}
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">({typeLabel})</span>
                          </p>
                          <div className="mt-1.5 grid gap-x-3 gap-y-1 text-[11px] text-slate-700 sm:grid-cols-2">
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

        <div className="space-y-2 animate-fade-up-soft">
          <Label className="inline-flex items-center gap-2">
            <CarFront className="h-4 w-4" />
            <span>Paso 2: Seleccionar opción de vehículo</span>
          </Label>
          {isVehiclePickerVisible ? (
            <div className={`grid gap-2 ui-fade-in-stagger ${selectedCustomer ? "sm:grid-cols-2" : ""}`}>
              <button
                type="button"
                disabled={!selectedCustomer}
                onClick={() => {
                  setIsVehiclePickerVisible(false);
                  handleSelectVehicleFlow("carryout", "");
                }}
                className={`rounded-lg border p-3 text-left transition-colors ui-interactive ${selectedVehicleOption === "carryout"
                  ? "border-emerald-500 bg-emerald-100/80"
                  : "border-emerald-200 bg-emerald-50/80 hover:bg-emerald-100/80"} ${!selectedCustomer ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <p className="font-medium text-emerald-900 inline-flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-emerald-700" />
                  Producto para llevar
                </p>
                <p className="text-xs text-emerald-800 mt-1">Venta sin instalación ni vehículo registrado</p>
              </button>

              {customerVehicles.map((v) => {
                const plate = v.plate || v.plate_number || v.number_plate || "Sin placa";
                const vin = v.vin || v.chasis || v.chassis || "Sin chasis";
                const color = v.color || v.vehicle_color || v.colour || "Sin color";
                const vehicleOptionId = normalizeVehicleId(v.vehicle_id ?? v.id);
                const isActiveVehicle = selectedVehicleOption === `vehicle:${vehicleOptionId}`;
                return (
                  <button
                    key={v.vehicle_id ?? v.id}
                    type="button"
                    disabled={!selectedCustomer}
                    onClick={() => {
                      setIsVehiclePickerVisible(false);
                      handleSelectVehicleFlow("registered", vehicleOptionId);
                    }}
                    className={`rounded-lg border p-3 text-left transition-colors ui-interactive ${isActiveVehicle
                      ? "border-sky-500 bg-sky-100/80"
                      : "border-sky-200 bg-sky-50/80 hover:bg-sky-100/80"} ${!selectedCustomer ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <p className="font-medium text-sky-900 inline-flex items-center gap-1.5">
                      <CarFront className="h-4 w-4 text-sky-700" />
                      {[v.brand, v.model, v.year].filter(Boolean).join(" ") || "Vehículo"}
                    </p>
                    <p className="text-xs text-sky-800 mt-1">{plate}</p>
                    <p className="text-[11px] text-sky-700 mt-0.5">{vin} • {color}</p>
                  </button>
                );
              })}

              <button
                type="button"
                disabled={!selectedCustomer}
                onClick={() => {
                  setIsVehiclePickerVisible(false);
                  setShowNewVehicleDialog(true);
                  handleSelectVehicleFlow("new", "");
                }}
                className={`rounded-lg border p-3 text-left transition-colors ui-interactive ${selectedVehicleOption === "new"
                  ? "border-violet-500 bg-violet-100/80"
                  : "border-violet-200 bg-violet-50/80 hover:bg-violet-100/80"} ${!selectedCustomer ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <p className="font-medium text-violet-900 inline-flex items-center gap-1.5">
                  <PlusCircle className="h-4 w-4 text-violet-700" />
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
            <div className={cn(CUSTOMER_VEHICLE_CARD_PATTERNS.shared.shell, CUSTOMER_VEHICLE_CARD_PATTERNS.vehicle.shell)}>
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
        </div>

        <div className="space-y-2 animate-fade-up-soft">
          <Label className="inline-flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span>Paso 3: Seleccionar productos</span>
          </Label>
          <div className="flex flex-col gap-2 mb-2 md:flex-row ui-fade-in-stagger">
              <div className="relative flex-1">
                <PackageSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre o SKU..."
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
                  className="mb-0 pl-9"
                />
              </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleOpenCatalogSearch}
              disabled={!selectedCustomer}
              className="shrink-0 ui-interactive"
            >
              <BookOpen className="h-4 w-4 mr-2" />
              Buscar desde Catalogo
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
                    tone.base,
                    tone.hover,
                    index === productHighlightIndex ? tone.selected : ""
                  )}
                  onClick={() => addToCart(p)}
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
                              <span className={cn("font-mono", qtyClassName)}>{qty}</span>
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
                              <span>{formatCurrency(convertPrice(p.price + (p.installation_price || 0)), currency)}</span>
                            </p>
                            {/* Para llevar abajo (grande, negrita = seleccionado) */}
                            <p className={cn("inline-flex items-center gap-1 font-mono text-[13px] font-extrabold", tone.emphasisPrice)}>
                              {isServiceProduct ? (
                                <Hand className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              ) : (
                                <Package className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              )}
                              <span>{formatCurrency(convertPrice(p.price), currency)}</span>
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
                              <span>{formatCurrency(convertPrice(p.price), currency)}</span>
                            </p>
                            {/* Con instalación abajo */}
                            {p.installation_type !== "not_available" && (p.installation_price || 0) > 0 && (
                              <p className={cn(
                                "inline-flex items-center gap-1 font-mono text-[13px]",
                                hasSelectedVehicle ? cn("font-extrabold", tone.emphasisPrice) : "text-muted-foreground"
                              )}>
                                <Wrench className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                <span>{formatCurrency(convertPrice(p.price + (p.installation_price || 0)), currency)}</span>
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

      <div className="space-y-4 animate-fade-up-soft">
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
            ? "rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center text-sm text-muted-foreground"
            : "max-h-72 space-y-2 overflow-y-auto pr-1"
        )}>
          {normalizedCartItems.length === 0 ? "Sin productos" : normalizedCartItems.map(item => {
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
            const canDecreaseQuantity = currentQuantity > 1;
            const canIncreaseQuantity = maxStoreQuantity === null ? true : currentQuantity < maxStoreQuantity;
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
                      return <p className={cn("shrink-0 font-mono text-sm font-extrabold tracking-tight", tone.emphasisPrice)}>{formatCurrency(currentTotal, currency)}</p>;
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
                        <p className={cn("font-mono text-sm font-extrabold tracking-tight", tone.emphasisPrice)}>
                          {formatCurrency(currentTotal, currency)}
                        </p>
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
                          <span className="font-mono font-semibold text-blue-900">{sumQty(sellerRows)}</span>
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
                          <span className="font-mono font-semibold text-amber-900">{sumQty(otherWHRows)}</span>
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
                      {currentQuantity}
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
                      title="Eliminar del carrito"
                      onClick={() => removeFromCart(item.product_id)}
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
                    type="number"
                    step="0.01"
                    min="0"
                    value={priceEditorAmount}
                    onChange={(event) => setPriceEditorAmount(event.target.value)}
                    placeholder={`Precio en ${currency}`}
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>Porcentaje (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={priceEditorPercent}
                    onChange={(event) => setPriceEditorPercent(event.target.value)}
                    placeholder="Ej: 10 o -5"
                  />
                </div>
              )}

              {priceEditorItem ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Precio actual: {formatCurrency(convertPrice(priceEditorItem.unit_price || 0), currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ediciones usadas: {Math.max(0, Math.floor(Number(priceEditorItem.price_edit_count || 0)))}/3
                  </p>
                  {priceEditorPreview?.isValid ? (
                    <div className="space-y-1 rounded-md border border-emerald-200 bg-emerald-50/70 p-2">
                      <p className="text-[11px] font-medium text-emerald-800">Resumen monetario de la edición</p>
                      {priceEditorPreview.discountPerUnit > 0 ? (
                        <p className="text-[11px] text-emerald-700">
                          Descuento aplicado: -{formatCurrency(priceEditorPreview.discountPerUnit, currency)}
                        </p>
                      ) : priceEditorPreview.increasePerUnit > 0 ? (
                        <p className="text-[11px] text-amber-700">
                          Incremento aplicado: +{formatCurrency(priceEditorPreview.increasePerUnit, currency)}
                        </p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">
                          Sin cambio monetario.
                        </p>
                      )}
                      {priceEditorPreview.quantity > 1 ? (
                        <p className="text-[11px] text-muted-foreground">
                          Impacto total (x{priceEditorPreview.quantity}): {priceEditorPreview.deltaTotal < 0 ? "-" : "+"}{formatCurrency(Math.abs(priceEditorPreview.deltaTotal), currency)}
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

        <div className="space-y-1.5 rounded-md border border-dashed border-input/70 bg-background/60 p-2.5">
          <Label className="inline-flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5" />
            <span>{step5Label}</span>
          </Label>
          <Select
            value={normalizedPaymentMethod}
            onValueChange={(value) => {
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
            <SelectTrigger className="ui-interactive">
              <SelectValue placeholder="Seleccionar metodo de pago" />
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
            <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-2.5 animate-fade-up-soft">
              <p className="text-xs font-medium text-slate-700">Selecciona los métodos incluidos en el pago mixto</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {paymentMethodSelectionItems.map((method) => {
                  const meta = paymentOptionMeta[method];
                  const Icon = meta.icon;
                  const checked = normalizedMixedPaymentMethods.includes(method);
                  return (
                    <label key={method} className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 ui-interactive">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => {
                          const nextChecked = Boolean(value);
                          const nextMethods = nextChecked
                            ? Array.from(new Set([...normalizedMixedPaymentMethods, method]))
                            : normalizedMixedPaymentMethods.filter((item) => item !== method);
                          setMixedPaymentMethods(nextMethods);
                          playSelectionFeedbackSound();
                          persistDraftSnapshot({ mixedPaymentMethods: nextMethods });
                        }}
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
          {discountsBlockedByPayment ? (
            <p className="text-xs text-amber-700">
              Este metodo bloquea descuentos y promociones en el calculo final.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Este metodo permite aplicar descuentos y promociones.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3">
          <div className="space-y-1.5">
            <Label className="inline-flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" />
              <span>Código de descuento</span>
            </Label>
            <div className="flex gap-2">
              <Input
                value={discountCode}
                disabled={discountsBlockedByPayment}
                onChange={(e) => setDiscountCode(e.target.value)}
                placeholder="Ej: DESC10"
              />
              <Button type="button" disabled={discountsBlockedByPayment} onClick={applyDiscountCode}>Aplicar</Button>
            </div>
            {appliedDiscounts.length > 0 && (
              <div className="mt-2 space-y-1">
                {appliedDiscounts.map(d => (
                  <div key={d.code} className="flex items-center justify-between text-xs">
                    <span>{d.code} - {d.name}</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeDiscountCode(d.code)}>×</Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label className="inline-flex items-center gap-1.5">
                {globalDiscountMode === "fixed" ? <Banknote className="h-3.5 w-3.5" /> : <Percent className="h-3.5 w-3.5" />}
                <span>{globalDiscountMode === "fixed" ? "Descuento Global (Monto fijo)" : "Descuento Global (%)"}</span>
              </Label>
              <div className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white/60 px-2 py-1 text-[11px]">
                <span className={cn("font-semibold", globalDiscountMode === "percent" ? "text-emerald-700" : "text-slate-500")}>%</span>
                <Switch
                  checked={globalDiscountMode === "fixed"}
                  disabled={discountsBlockedByPayment}
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
                disabled={discountsBlockedByPayment || globalDiscount <= 0}
                onClick={() => applyGlobalDiscountChange(globalDiscount - (globalDiscountMode === "fixed" ? 10 : 1))}
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <Input
                type="number"
                min="0"
                max={globalDiscountMode === "percent" ? "100" : undefined}
                inputMode="numeric"
                disabled={discountsBlockedByPayment}
                value={globalDiscount}
                onChange={(e) => applyGlobalDiscountChange(e.target.value)}
                onBlur={(e) => applyGlobalDiscountChange(e.target.value)}
                step={globalDiscountMode === "fixed" ? "10" : "1"}
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
                disabled={discountsBlockedByPayment || (globalDiscountMode === "percent" && globalDiscount >= 100)}
                onClick={() => applyGlobalDiscountChange(globalDiscount + (globalDiscountMode === "fixed" ? 10 : 1))}
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
                  if (isCompanyCustomerFlow) return;
                  const nextValue = Boolean(v);
                  setApplyIVA(nextValue);
                  persistDraftSnapshot({ applyIVA: nextValue });
                }}
                disabled={isCompanyCustomerFlow}
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
                  onCheckedChange={(v) => {
                    const next = Boolean(v);
                    setApplyRetention(next);
                    persistDraftSnapshot({ applyRetention: next, retentionRate });
                  }}
                />
                <span className="text-xs text-muted-foreground">Retención sobre subtotal</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setRetentionRate(1);
                    persistDraftSnapshot({ applyRetention, retentionRate: 1 });
                  }}
                  className={cn(
                    "rounded-md border px-2.5 py-0.5 text-xs font-mono font-semibold transition-colors",
                    retentionRate === 1 && applyRetention
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background text-muted-foreground hover:bg-muted"
                  )}
                >1%</button>
                <button
                  type="button"
                  onClick={() => {
                    setRetentionRate(2);
                    persistDraftSnapshot({ applyRetention, retentionRate: 2 });
                  }}
                  className={cn(
                    "rounded-md border px-2.5 py-0.5 text-xs font-mono font-semibold transition-colors",
                    retentionRate === 2 && applyRetention
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background text-muted-foreground hover:bg-muted"
                  )}
                >2%</button>
              </div>
            </div>
          </div>
        )}

        {!hideCurrencyField ? (
        <div>
          <Label>Moneda</Label>
          <Select
            value={currency}
            onValueChange={(value) => {
              applyCurrencyChange(value);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar moneda" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NIO">C$ Córdobas</SelectItem>
              <SelectItem value="USD">USD Dólares</SelectItem>
            </SelectContent>
          </Select>
        </div>
        ) : null}

        {extraFields}

        <div className="border-t pt-4 space-y-1">
          {(totals.totalDiscounts > 0 || totals.manualPriceDiscountTotal > 0) && (
            <div className="flex justify-between text-sm"><span>Subtotal sin descuentos:</span><span className="font-mono">{formatCurrency(totals.subtotalWithoutDiscounts, currency)}</span></div>
          )}
          {totals.manualPriceDiscountEntries.length > 0 && totals.manualPriceDiscountEntries.map((entry) => (
            <div key={`manual-discount-${entry.productId}`} className="flex justify-between text-sm text-green-600">
              <span>Descuento Individual ({entry.productName}):</span>
              <span className="font-mono">-{formatCurrency(entry.amount, currency)}</span>
            </div>
          ))}
          {totals.discountFromCodes > 0 && (
            <div className="flex justify-between text-sm text-green-600"><span>Descuento Códigos:</span><span className="font-mono">-{formatCurrency(totals.discountFromCodes, currency)}</span></div>
          )}
          {totals.discountAmount > 0 && (
            <div className="flex justify-between text-sm text-green-600"><span>{globalDiscountMode === "fixed" ? "Descuento Global (Monto):" : "Descuento Global (%):"}</span><span className="font-mono">-{formatCurrency(totals.discountAmount, currency)}</span></div>
          )}
          {totals.discountsBlockedByPayment && totals.blockedDiscountsAmount > 0 && (
            <div className="flex justify-between text-sm text-amber-700"><span>Descuentos removidos por metodo:</span><span className="font-mono">{formatCurrency(totals.blockedDiscountsAmount, currency)}</span></div>
          )}
          <div className="flex justify-between text-sm"><span>Subtotal:</span><span className="font-mono">{formatCurrency(totals.subtotalForRetention, currency)}</span></div>
          {applyRetention && totals.retention > 0 && (
            <div className="flex justify-between text-sm text-orange-600"><span>Retención IR ({retentionRate}%):</span><span className="font-mono">-{formatCurrency(totals.retention, currency)}</span></div>
          )}
          <div className="flex justify-between text-sm"><span>IVA ({ivaRate}%):</span><span className="font-mono">{formatCurrency(totals.tax, currency)}</span></div>
          <div className="flex justify-between text-lg font-bold"><span>Total:</span><span className="font-mono">{formatCurrency(totals.total, currency)}</span></div>
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
                    const nextVehicle = { ...newVehicle, brand: v, year: "", model: "" };
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
                    const nextVehicle = { ...newVehicle, year: v, model: "" };
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
                    const nextVehicle = { ...newVehicle, model: v };
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
            {newCustomer.add_vehicle ? "Crear Cliente y Vehículo" : "Crear Cliente"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
