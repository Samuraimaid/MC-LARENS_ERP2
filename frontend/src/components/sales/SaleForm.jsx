import React, { useCallback, useMemo, useState, useEffect, useRef } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SearchableSelect from "@/components/ui/searchable-select";
import { cn, formatCurrency } from "@/lib/utils";
import { API_BASE as API } from "@/lib/api";
import {
  Building2,
  BookOpen,
  Car,
  CarFront,
  FileText,
  MapPin,
  Package,
  Phone,
  PlusCircle,
  RefreshCcw,
  ShieldCheck,
  ShoppingCart,
  User,
  UserPlus,
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
  flowType = "sale",
  step4Label = "Paso 4: Carrito del Cliente",
}) {
  const { user } = useAuth();
  const [selectedCustomer, setSelectedCustomer] = useState(initialData.selectedCustomer || null);
  const [selectedVehicle, setSelectedVehicle] = useState(initialData.selectedVehicle || "");
  const [selectedWarehouse, setSelectedWarehouse] = useState(initialData.selectedWarehouse || "");
  const [cartItems, setCartItems] = useState(initialData.cartItems || []);
  const [globalDiscount, setGlobalDiscount] = useState(initialData.globalDiscount || 0);
  const [notes, setNotes] = useState(initialData.notes || "");
  const [applyIVA, setApplyIVA] = useState(initialData.applyIVA ?? true);
  const [ivaRate, setIvaRate] = useState(initialData.ivaRate ?? defaultIvaRate);
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
  const [useVehicleVinDecoder, setUseVehicleVinDecoder] = useState(false);
  const [isDecodingVehicleVin, setIsDecodingVehicleVin] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [pendingCustomerId, setPendingCustomerId] = useState(null);
  const draftSnapshotRef = useRef(null);
  const customerSearchRef = useRef(null);
  const productSearchRef = useRef(null);
  const customerListRef = useRef(null);
  const productListRef = useRef(null);
  const [customerHighlightIndex, setCustomerHighlightIndex] = useState(0);
  const [productHighlightIndex, setProductHighlightIndex] = useState(0);
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

  const isCompanyQuotation = isQuotationFlow && Boolean(selectedCustomer) && isCompanyCustomer(selectedCustomer);

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
    if (!isQuotationFlow || !selectedCustomer) return;

    if (isCompanyCustomer(selectedCustomer)) {
      if (!applyIVA) {
        setApplyIVA(true);
      }
      if (ivaRate !== defaultIvaRate) {
        setIvaRate(defaultIvaRate);
      }
      return;
    }

    if (applyIVA) {
      setApplyIVA(false);
    }
    if (ivaRate !== defaultIvaRate) {
      setIvaRate(defaultIvaRate);
    }
  }, [isQuotationFlow, selectedCustomer, isCompanyCustomer, applyIVA, ivaRate, defaultIvaRate]);

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
      setGlobalDiscount(draft?.globalDiscount || 0);
      setNotes(draft?.notes || "");
      setApplyIVA(draft?.applyIVA ?? true);
      setIvaRate(defaultIvaRate);
      setCurrency(draft?.currency || "NIO");
      setCustomerSearch(draft?.customerSearch || "");
      setProductSearch(draft?.productSearch || "");
      setAppliedDiscounts(draft?.appliedDiscounts || []);
      setVehicleFlowOption(draft?.vehicleFlowOption || "carryout");
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
  }, [draftKey, normalizeVehicleId, defaultIvaRate]);

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
    }))
  ), [cartItems]);

  const addToCart = (product) => {
    const existing = normalizedCartItems.find(item => item.product_id === product.product_id);
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
          discount: 0,
          installation_type: installationType,
          installation_price: installationPrice,
          with_installation: hasSelectedVehicle ? withInstallation : false,
        },
      ];
    }
    setCartItems(nextCartItems);
    persistDraftSnapshot({ cartItems: nextCartItems });
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
    if (!discountCode) return;
    const codes = {
      "DESC10": { type: "percent", value: 10, name: "10% de descuento" },
      "DESC20": { type: "percent", value: 20, name: "20% de descuento" },
      "FIJO100": { type: "fixed", value: 100, name: "C$100 de descuento" },
    };
    const code = codes[discountCode.toUpperCase()];
    if (!code) return;
    if (appliedDiscounts.find(d => d.code === discountCode.toUpperCase())) return;
    const nextAppliedDiscounts = [...appliedDiscounts, { ...code, code: discountCode.toUpperCase() }];
    setAppliedDiscounts(nextAppliedDiscounts);
    setDiscountCode("");
    persistDraftSnapshot({ appliedDiscounts: nextAppliedDiscounts, discountCode: "" });
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
    const subtotal = normalizedCartItems.reduce((sum, item) => {
      const priceInCurrency = convertPrice(item.unit_price);
      let lineTotal = priceInCurrency * item.quantity * (1 - (item.discount || 0) / 100);
      const installType = item.installation_type || "optional";
      const wantsInstall = hasSelectedVehicle && (installType === "required" || Boolean(item.with_installation));
      if (installType !== "not_available" && wantsInstall) {
        const installPrice = convertPrice(item.installation_price || 0);
        lineTotal += installPrice * item.quantity;
      }
      return sum + lineTotal;
    }, 0);

    let discountFromCodes = 0;
    appliedDiscounts.forEach(d => {
      if (d.type === "percent") {
        discountFromCodes += subtotal * (d.value / 100);
      } else if (d.type === "fixed") {
        const fixedInCurrency = currency === "USD" ? d.value / exchangeRate : d.value;
        discountFromCodes += fixedInCurrency;
      }
    });

    const discountAmount = subtotal * (globalDiscount / 100);
    const subtotalAfterDiscounts = subtotal - discountFromCodes - discountAmount;
    const tax = applyIVA ? subtotalAfterDiscounts * (ivaRate / 100) : 0;
    const total = subtotalAfterDiscounts + tax;
    return { subtotal, tax, discountAmount, discountFromCodes, total };
  })();

  const handleSubmit = async () => {
    const payload = {
      customer_id: selectedCustomer?.customer_id || selectedCustomer,
      vehicle_id: selectedVehicle,
      warehouse_id: selectedWarehouse,
      items: normalizedCartItems.map(i => ({
        product_id: i.product_id,
        quantity: i.quantity,
        discount: i.discount,
        unit_price: i.unit_price,
        product_name: i.product_name,
        with_installation: hasSelectedVehicle && (i.installation_type === "required" || Boolean(i.with_installation)),
      })),
      discount: globalDiscount,
      currency,
      apply_iva: applyIVA,
      iva_rate: ivaRate,
      exchange_rate: exchangeRate,
      discount_codes: appliedDiscounts.map(d => d.code),
      applied_discounts: appliedDiscounts,
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
      globalDiscount,
      notes,
      applyIVA,
      ivaRate,
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
    globalDiscount,
    notes,
    applyIVA,
    ivaRate,
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

  const handleSelectCustomer = useCallback((customer) => {
    setSelectedCustomer(customer);
    setPendingCustomerId(null);
    setCustomerSearch("");
    setSelectedVehicle("");
    setVehicleFlowOption("carryout");
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
    setCustomerSearch("");
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
    const nextCartItems = normalizedCartItems.map(item => item.product_id === productId ? { ...item, [field]: value } : item);
    setCartItems(nextCartItems);
    if (options.persist) {
      persistDraftSnapshot({ cartItems: nextCartItems });
    }
    return nextCartItems;
  }, [normalizedCartItems, persistDraftSnapshot]);

  const removeFromCart = useCallback((productId) => {
    const nextCartItems = normalizedCartItems.filter(i => i.product_id !== productId);
    setCartItems(nextCartItems);
    persistDraftSnapshot({ cartItems: nextCartItems });
  }, [normalizedCartItems, persistDraftSnapshot]);

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

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="space-y-4">
        <div>
          <Label className="inline-flex items-center gap-2">
            <User className="h-4 w-4" />
            <span>Paso 1: Agregar Cliente/Empresa o buscar en la lista</span>
          </Label>
          {!selectedCustomer ? (
            <div className="flex items-center gap-2 mb-2">
              <Input
                placeholder="Buscar por nombre, teléfono o cédula..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                onKeyDown={handleCustomerSearchKeyDown}
                ref={customerSearchRef}
                className="mb-0"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowNewCustomer(true);
                  persistDraftSnapshot({ showNewCustomer: true });
                }}
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Nuevo Registro
              </Button>
            </div>
          ) : null}
          {selectedCustomer ? (
            <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 shadow-sm ui-panel animate-fade-up-soft">
              <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                <p className="inline-flex min-w-0 items-center gap-2 font-semibold text-emerald-900">
                  {isCompanyCustomer(selectedCustomer) ? <Building2 className="h-4 w-4 text-blue-700" /> : <User className="h-4 w-4 text-emerald-700" />}
                  <span className="truncate">{selectedCustomer.name}</span>
                  <Badge variant="outline" className="shrink-0 text-[10px] uppercase tracking-wide">
                    {isCompanyCustomer(selectedCustomer) ? "Empresa" : "Cliente"}
                  </Badge>
                  <Badge variant="outline" className="shrink-0 border-sky-300 bg-white/70 text-[10px] uppercase tracking-wide text-sky-900">
                    Vehiculo
                  </Badge>
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 px-4 text-sm font-medium"
                  onClick={handleClearSelectedCustomer}
                >
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Cambiar
                </Button>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-emerald-900/90">
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
                          <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-700">
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
          {!(vehicleFlowOption === "registered" && selectedVehicleData) ? (
            <div className={`grid gap-2 ui-fade-in-stagger ${selectedCustomer ? "sm:grid-cols-2" : ""}`}>
              <button
                type="button"
                disabled={!selectedCustomer}
                onClick={() => handleSelectVehicleFlow("carryout", "")}
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
                    onClick={() => handleSelectVehicleFlow("registered", vehicleOptionId)}
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

          {vehicleFlowOption === "registered" && selectedVehicleData ? (
            <div className="rounded-xl border border-sky-200 bg-sky-50/80 px-3.5 py-2.5 shadow-sm ui-panel animate-fade-up-soft">
              <div className="grid grid-cols-[1fr_auto] items-center gap-2.5">
                <p className="inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold leading-tight text-sky-900">
                  <CarFront className="h-4 w-4 shrink-0 text-sky-700" />
                  {[selectedVehicleData.brand, selectedVehicleData.model, selectedVehicleData.year].filter(Boolean).join(" ") || "Vehículo seleccionado"}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 px-2.5 text-sm font-medium ui-interactive"
                  onClick={() => handleSelectVehicleFlow("carryout", "")}
                >
                  <RefreshCcw className="h-4 w-4 mr-1.5" />
                  Cambiar
                </Button>
              </div>

              <div className="mt-1.5 space-y-1 text-[11px] text-sky-900/90">
                <div className="grid grid-cols-2 gap-x-5 gap-y-0.5">
                  <p className="inline-flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-sky-700" />
                    {selectedVehicleData.plate || selectedVehicleData.plate_number || selectedVehicleData.number_plate || "Sin placa"}
                  </p>
                  <p className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-sky-700" />
                    {selectedVehicleData.color || selectedVehicleData.vehicle_color || selectedVehicleData.colour || "Sin color"}
                  </p>
                </div>
                <p className="inline-flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-sky-700" />
                  <span className="truncate">{selectedVehicleData.vin || selectedVehicleData.chasis || selectedVehicleData.chassis || "Sin chasis"}</span>
                </p>
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
              className="mb-0"
            />
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
                <button
                  key={p.product_id}
                  data-index={index}
                  type="button"
                  className={cn(
                    "grid w-full grid-cols-[88px_1fr_auto] items-center gap-3 rounded-xl border border-sky-200 bg-sky-50/70 p-2.5 text-left shadow-sm transition-colors ui-interactive ui-panel",
                    "hover:border-sky-300 hover:bg-sky-100/80",
                    index === productHighlightIndex ? "border-sky-500 bg-sky-100/90 ring-2 ring-sky-200" : ""
                  )}
                  onClick={() => addToCart(p)}
                  onMouseEnter={() => setProductHighlightIndex(index)}
                >
                  {p.images?.[0] ? <img src={p.images[0]} alt={p.name} className="h-20 w-20 rounded-lg object-cover bg-muted/30" /> : <div className="h-20 w-20 rounded-lg bg-muted/50" />}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-sky-950">{p.name}</p>
                    <p className="mt-0.5 text-xs text-sky-800/75">{p.sku}</p>
                    {p.installation_type === "not_available" && (
                      <Badge variant="secondary" className="mt-2 text-[10px]">Solo para llevar</Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <p className={hasSelectedVehicle ? "font-mono text-xs text-muted-foreground" : "font-mono text-sm font-semibold text-sky-950"}>
                      Sin instalación {formatCurrency(convertPrice(p.price), currency)}
                    </p>
                    {p.installation_type !== "not_available" && (p.installation_price || 0) > 0 && (
                      <p className={hasSelectedVehicle ? "font-mono text-sm font-semibold text-sky-950" : "font-mono text-xs text-muted-foreground"}>
                        Con instalación {formatCurrency(convertPrice(p.price + (p.installation_price || 0)), currency)}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Escribe para buscar productos</p>
          )}
        </div>
      </div>

      <div className="space-y-4 animate-fade-up-soft">
        <Label className="inline-flex items-center gap-2">
          <ShoppingCart className="h-4 w-4" />
          <span>{step4Label}</span>
        </Label>
        <div className={cn(
          "animate-fade-up-soft",
          normalizedCartItems.length === 0
            ? "rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center text-sm text-muted-foreground"
            : "max-h-72 space-y-2 overflow-y-auto pr-1"
        )}>
          {normalizedCartItems.length === 0 ? "Sin productos" : normalizedCartItems.map(item => (
            <div key={item.product_id} className="grid grid-cols-[88px_1fr_auto] items-center gap-3 rounded-xl border border-sky-200 bg-sky-50/70 p-2.5 shadow-sm ui-interactive ui-panel">
              {item.image ? <img src={item.image} alt={item.product_name} className="h-20 w-20 rounded-lg object-cover bg-muted/30" /> : <div className="h-20 w-20 rounded-lg bg-muted/50" />}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-sky-950">{item.product_name}</p>
                <p className="text-xs text-muted-foreground">Código: {item.sku || "N/A"}</p>
                <p className="text-xs text-sky-800/75">
                  {hasSelectedVehicle && (item.installation_type === "required" || item.with_installation) ? "Precio instalado" : "Precio para llevar"}
                </p>
                {item.sample_status === "requested" && (
                  <p className="text-xs font-medium text-blue-600">Muestra solicitada</p>
                )}
                <div className="mt-1.5 flex gap-2">
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={item.quantity}
                    onChange={(e) => updateCartItem(item.product_id, "quantity", Math.max(0.01, parseFloat(e.target.value) || 0.01))}
                    onBlur={(e) => updateCartItem(item.product_id, "quantity", Math.max(0.01, parseFloat(e.target.value) || 0.01), { persist: true })}
                    className="h-7 w-20 text-xs"
                  />
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={item.discount}
                    onChange={(e) => updateCartItem(item.product_id, "discount", parseFloat(e.target.value) || 0)}
                    onBlur={(e) => updateCartItem(item.product_id, "discount", parseFloat(e.target.value) || 0, { persist: true })}
                    className="h-7 w-20 text-xs"
                    placeholder="Desc %"
                  />
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {(() => {
                  const baseTotal = convertPrice(item.unit_price) * item.quantity * (1 - (item.discount || 0) / 100);
                  const installType = item.installation_type || "optional";
                  const wantsInstall = hasSelectedVehicle && (installType === "required" || Boolean(item.with_installation));
                  const installTotal = installType !== "not_available" && wantsInstall
                    ? convertPrice(item.installation_price || 0) * item.quantity
                    : 0;
                  return (
                    <p className="font-mono text-sm font-semibold text-sky-950">{formatCurrency(baseTotal + installTotal, currency)}</p>
                  );
                })()}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => requestSampleForItem(item)}
                    className="bg-white/70 ui-interactive"
                  >
                    Solicitar muestra
                  </Button>
                  <Button variant="ghost" size="sm" className="ui-interactive" onClick={() => removeFromCart(item.product_id)}>×</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {normalizedCartItems.length > 0 && (
          <div className="space-y-2">
            {normalizedCartItems.map(item => {
              if (item.installation_type === "optional") {
                return (
                  <div key={`${item.product_id}-install`} className="flex items-center justify-between text-xs">
                    <span>{item.product_name}</span>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={hasSelectedVehicle && Boolean(item.with_installation)}
                        onCheckedChange={(checked) => updateCartItem(item.product_id, "with_installation", Boolean(checked), { persist: true })}
                        disabled={!hasSelectedVehicle}
                      />
                      <span className={!hasSelectedVehicle ? "text-muted-foreground" : ""}>
                        Instalar (+{formatCurrency(convertPrice(item.installation_price || 0), currency)})
                      </span>
                    </div>
                  </div>
                );
              }

              if (item.installation_type === "required") {
                return (
                  <div key={`${item.product_id}-install`} className="flex items-center justify-between text-xs">
                    <span>{item.product_name}</span>
                    <Badge>Instalación requerida</Badge>
                  </div>
                );
              }

              return (
                <div key={`${item.product_id}-install`} className="flex items-center justify-between text-xs">
                  <span>{item.product_name}</span>
                  <Badge variant="secondary">Solo para llevar</Badge>
                </div>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Código de Descuento</Label>
            <div className="flex gap-2">
              <Input value={discountCode} onChange={(e) => setDiscountCode(e.target.value)} placeholder="Ej: DESC10" />
              <Button type="button" onClick={applyDiscountCode}>Aplicar</Button>
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
          <div className="flex items-end gap-2">
            <Checkbox
              checked={applyIVA}
              onCheckedChange={(v) => {
                if (isCompanyQuotation) return;
                const nextValue = Boolean(v);
                setApplyIVA(nextValue);
                persistDraftSnapshot({ applyIVA: nextValue });
              }}
              disabled={isCompanyQuotation}
            />
            <Label>{isCompanyQuotation ? "Aplicar IVA (obligatorio empresa)" : "Aplicar IVA"}</Label>
            <Input
              type="number"
              min="0"
              max="30"
              value={ivaRate}
              onChange={(e) => setIvaRate(parseFloat(e.target.value) || 0)}
              onBlur={(e) => persistDraftSnapshot({ ivaRate: parseFloat(e.target.value) || 0 })}
              className="w-20"
              disabled={isCompanyQuotation}
            />
          </div>
        </div>

        {isQuotationFlow && selectedCustomer && !isCompanyQuotation ? (
          <p className="text-xs text-muted-foreground">
            Para cliente persona natural, el IVA inicia desactivado y puedes aplicarlo manualmente si lo necesitas.
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Descuento Global (%)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={globalDiscount}
              onChange={(e) => setGlobalDiscount(parseFloat(e.target.value) || 0)}
              onBlur={(e) => persistDraftSnapshot({ globalDiscount: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div>
            <Label>Bodega</Label>
            <Select
              value={selectedWarehouse}
              onValueChange={(value) => {
                setSelectedWarehouse(value);
                persistDraftSnapshot({ selectedWarehouse: value });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar bodega" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map(w => <SelectItem key={w.warehouse_id} value={w.warehouse_id}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Moneda</Label>
          <Select
            value={currency}
            onValueChange={(value) => {
              setCurrency(value);
              persistDraftSnapshot({ currency: value });
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

        {extraFields}

        <div className="border-t pt-4 space-y-1">
          <div className="flex justify-between text-sm"><span>Subtotal:</span><span className="font-mono">{formatCurrency(totals.subtotal, currency)}</span></div>
          <div className="flex justify-between text-sm"><span>IVA ({ivaRate}%):</span><span className="font-mono">{formatCurrency(totals.tax, currency)}</span></div>
          {totals.discountFromCodes > 0 && <div className="flex justify-between text-sm text-green-600"><span>Descuento Códigos:</span><span className="font-mono">-{formatCurrency(totals.discountFromCodes, currency)}</span></div>}
          {totals.discountAmount > 0 && <div className="flex justify-between text-sm text-green-600"><span>Descuento Global:</span><span className="font-mono">-{formatCurrency(totals.discountAmount, currency)}</span></div>}
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

          <Tabs
            value={newCustomerTab}
            onValueChange={(value) => {
              setNewCustomerTab(value);
              persistDraftSnapshot({ newCustomerTab: value });
            }}
            className="space-y-2"
          >
            <TabsList className={`grid w-full grid-cols-2 ${newCustomerTone.tabsList}`}>
              <TabsTrigger value="customer">
                <User className="h-4 w-4 mr-2" />
                Datos del Cliente
              </TabsTrigger>
              <TabsTrigger value="vehicle" disabled={!newCustomer.add_vehicle}>
                <Car className="h-4 w-4 mr-2" />
                Vehículo
              </TabsTrigger>
            </TabsList>

            <TabsContent value="customer" className={`space-y-3 mt-3 ${newCustomerTone.panel}`}>
              <div>
                <Label>Tipo de Cliente *</Label>
                <Select
                  value={newCustomer.customer_type}
                  onValueChange={(v) => {
                    const nextCustomer = { ...newCustomer, customer_type: v, tax_id: "" };
                    setNewCustomer(nextCustomer);
                    persistDraftSnapshot({ newCustomer: nextCustomer });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="natural">
                      <span className="flex items-center gap-2">
                        <User className="h-4 w-4" /> Persona Natural
                      </span>
                    </SelectItem>
                    <SelectItem value="empresa">
                      <span className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" /> Empresa
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nombres *</Label>
                  <Input
                    value={newCustomer.first_name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, first_name: e.target.value })}
                    onBlur={(e) => persistDraftSnapshot({ newCustomer: { ...newCustomer, first_name: e.target.value } })}
                    placeholder="Juan Carlos"
                  />
                </div>
                <div>
                  <Label>Apellidos *</Label>
                  <Input
                    value={newCustomer.last_name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, last_name: e.target.value })}
                    onBlur={(e) => persistDraftSnapshot({ newCustomer: { ...newCustomer, last_name: e.target.value } })}
                    placeholder="Pérez López"
                  />
                </div>
              </div>

              <div>
                <Label>{newCustomer.customer_type === "natural" ? "Cédula" : "RUC *"}</Label>
                <Input
                  value={newCustomer.tax_id}
                  onChange={(e) => setNewCustomer({
                    ...newCustomer,
                    tax_id: newCustomer.customer_type === "natural"
                      ? formatCedula(e.target.value)
                      : formatRUC(e.target.value),
                  })}
                  onBlur={(e) => persistDraftSnapshot({
                    newCustomer: {
                      ...newCustomer,
                      tax_id: newCustomer.customer_type === "natural"
                        ? formatCedula(e.target.value)
                        : formatRUC(e.target.value),
                    },
                  })}
                  placeholder={newCustomer.customer_type === "natural" ? "001-000000-0000A" : "J0000000000000"}
                  required={isNewCustomerCompany}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {newCustomer.customer_type === "natural"
                    ? "Formato: 001-000000-0000A"
                    : "Formato: J0000000000000"}
                </p>
              </div>

              <div>
                <Label>Teléfono *</Label>
                <div className="flex gap-2">
                  <Select
                    value={newCustomer.phone_prefix}
                    onValueChange={(v) => {
                      const nextCustomer = { ...newCustomer, phone_prefix: v };
                      setNewCustomer(nextCustomer);
                      persistDraftSnapshot({ newCustomer: nextCustomer });
                    }}
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="+505">+505</SelectItem>
                      <SelectItem value="+1">+1</SelectItem>
                      <SelectItem value="+52">+52</SelectItem>
                      <SelectItem value="+57">+57</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: formatPhone(e.target.value) })}
                    onBlur={(e) => persistDraftSnapshot({
                      newCustomer: { ...newCustomer, phone: formatPhone(e.target.value) },
                    })}
                    placeholder="0000-0000"
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Formato: +505-0000-0000</p>
              </div>

              <div>
                <Label>Email <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                  onBlur={(e) => persistDraftSnapshot({ newCustomer: { ...newCustomer, email: e.target.value } })}
                  placeholder="cliente@email.com"
                />
              </div>

              <div>
                <Label>Dirección <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                  onBlur={(e) => persistDraftSnapshot({ newCustomer: { ...newCustomer, address: e.target.value } })}
                  placeholder="Dirección del cliente"
                />
              </div>

              {canManageCreditLimit ? (
                <div>
                  <Label>Límite de Crédito (C$)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={newCustomer.credit_limit}
                    onChange={(e) => setNewCustomer({ ...newCustomer, credit_limit: e.target.value })}
                    onBlur={(e) => persistDraftSnapshot({ newCustomer: { ...newCustomer, credit_limit: e.target.value } })}
                    placeholder="0.00"
                  />
                </div>
              ) : null}

              <div className="flex items-center space-x-2 pt-2 border-t">
                <Checkbox
                  id="add-vehicle"
                  checked={newCustomer.add_vehicle}
                  onCheckedChange={(checked) => {
                    const nextChecked = Boolean(checked);
                    const nextTab = nextChecked ? "vehicle" : "customer";
                    const nextCustomer = { ...newCustomer, add_vehicle: nextChecked };
                    setNewCustomer(nextCustomer);
                    if (nextChecked) {
                      setNewCustomerTab("vehicle");
                    }
                    persistDraftSnapshot({ newCustomer: nextCustomer, newCustomerTab: nextTab });
                  }}
                />
                <Label htmlFor="add-vehicle" className="cursor-pointer">
                  {isNewCustomerCompany ? "Registrar vehículo de la empresa" : "Registrar vehículo del cliente"}
                </Label>
              </div>
            </TabsContent>

            <TabsContent value="vehicle" className={`space-y-3 mt-3 ${newCustomerTone.panel}`}>
              <div>
                <Label>Placa *</Label>
                <div className="flex gap-2">
                  <Select
                    value={newCustomer.plate_prefix}
                    onValueChange={(v) => {
                      const nextCustomer = { ...newCustomer, plate_prefix: v, plate_number: "" };
                      setNewCustomer(nextCustomer);
                      persistDraftSnapshot({ newCustomer: nextCustomer });
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
                    value={newCustomer.plate_number}
                    onChange={(e) => setNewCustomer({
                      ...newCustomer,
                      plate_number: formatPlateNumber(newCustomer.plate_prefix, e.target.value),
                    })}
                    onBlur={(e) => persistDraftSnapshot({
                      newCustomer: {
                        ...newCustomer,
                        plate_number: formatPlateNumber(newCustomer.plate_prefix, e.target.value),
                      },
                    })}
                    placeholder={newCustomer.plate_prefix === "M" ? "123 456" : "12345"}
                    className="flex-1 font-mono"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {newCustomer.plate_prefix === "M"
                    ? "Formato: M 123 456 (6 dígitos)"
                    : `Formato: ${newCustomer.plate_prefix} 12345 (4-5 dígitos)`}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="saleform-use-vin-decoder"
                  checked={useVinDecoder}
                  onCheckedChange={(checked) => {
                    const nextValue = Boolean(checked);
                    setUseVinDecoder(nextValue);
                    persistDraftSnapshot({ useVinDecoder: nextValue });
                  }}
                />
                <Label htmlFor="saleform-use-vin-decoder">Usar decodificador VIN</Label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_0.8fr_1.9fr] gap-4">
                <div>
                  <Label>Marca *</Label>
                  <SearchableSelect
                    value={newCustomer.brand}
                    onChange={(v) => {
                      const nextCustomer = { ...newCustomer, brand: v, year: "", model: "" };
                      setNewCustomer(nextCustomer);
                      persistDraftSnapshot({ newCustomer: nextCustomer });
                    }}
                    options={VEHICLE_CATALOG_BRANDS}
                    placeholder="Seleccionar marca"
                    searchPlaceholder="Buscar marca..."
                  />
                </div>
                <div>
                  <Label>Año *</Label>
                  <SearchableSelect
                    value={String(newCustomer.year || "")}
                    onChange={(v) => {
                      const nextCustomer = { ...newCustomer, year: v, model: "" };
                      setNewCustomer(nextCustomer);
                      persistDraftSnapshot({ newCustomer: nextCustomer });
                    }}
                    options={newCustomerYearOptions}
                    placeholder="Seleccionar año"
                    searchPlaceholder="Buscar año..."
                    disabled={!newCustomer.brand}
                  />
                </div>
                <div>
                  <Label>Modelo *</Label>
                  <SearchableSelect
                    value={newCustomer.model}
                    onChange={(v) => {
                      const nextCustomer = { ...newCustomer, model: v };
                      setNewCustomer(nextCustomer);
                      persistDraftSnapshot({ newCustomer: nextCustomer });
                    }}
                    options={newCustomerModelOptions}
                    placeholder="Seleccionar modelo"
                    searchPlaceholder="Buscar modelo..."
                    disabled={!newCustomer.brand || !newCustomer.year}
                  />
                </div>
              </div>

              <div>
                <Label>Color</Label>
                <Input
                  list="saleform-color-options"
                  value={newCustomer.color}
                  onChange={(e) => setNewCustomer({ ...newCustomer, color: e.target.value })}
                  onBlur={(e) => persistDraftSnapshot({ newCustomer: { ...newCustomer, color: e.target.value } })}
                  placeholder="Escribe para sugerencias de color"
                />
                <datalist id="saleform-color-options">
                  {VEHICLE_COLOR_SUGGESTIONS.map((color) => (
                    <option key={color} value={color} />
                  ))}
                </datalist>
              </div>

              <div>
                <Label>CHASIS (VIN)</Label>
                <Input
                  value={newCustomer.chasis}
                  onChange={(e) => setNewCustomer({ ...newCustomer, chasis: formatChasis(e.target.value) })}
                  onBlur={(e) => persistDraftSnapshot({
                    newCustomer: { ...newCustomer, chasis: formatChasis(e.target.value) },
                  })}
                  placeholder="1HGBH41JXMN109186"
                  className="font-mono"
                  maxLength={17}
                />
                {useVinDecoder && (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-2"
                    onClick={decodeNewCustomerVin}
                    disabled={isDecodingVin || newCustomer.chasis.length !== 17}
                  >
                    {isDecodingVin ? "Decodificando VIN..." : "Decodificar VIN"}
                  </Button>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  17 caracteres alfanuméricos (sin I, O, Q, Ñ). {newCustomer.chasis.length}/17
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <Button onClick={createNewCustomer} className="w-full mt-3">
            {newCustomer.add_vehicle ? "Crear Cliente y Vehículo" : "Crear Cliente"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
