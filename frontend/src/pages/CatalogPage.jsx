import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { ContextualDialogFooter, ContextualDialogHeader } from "../components/ui/contextual-dialog-header";
import { Checkbox } from "../components/ui/checkbox";
import { Label } from "../components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import {
  Eye,
  CarFront,
  ListFilter,
  Pin,
  Search,
  Shapes,
  Tags,
  ShoppingCart,
  FileText,
  MessageSquare,
  Boxes,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  SlidersHorizontal,
  Sparkles,
  ScanBarcode,
  Eraser,
  ArrowUp,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatCurrency, formatDate, cn } from "../lib/utils";
import { usdAndNioFromUsdBase, formatDualCurrency } from "@/lib/documentCurrency";
import { usesRestrictedNavigation } from "@/lib/roleHome";
import { API_BASE as API } from "@/lib/api";
import { fetchEffectiveUsdNioRate, DEFAULT_USD_NIO_RATE } from "@/lib/exchangeRate";
import { saveServerDraft, setServerDraftActive } from "@/lib/serverDrafts";
import { formatCategoryLabel } from "@/lib/branding";
import ProductQuickViewDialog from "@/components/erp/ProductQuickViewDialog";
import ProductBarcodeScannerDialog from "@/components/erp/ProductBarcodeScannerDialog";
import ProductImageHoverZoom from "@/components/erp/ProductImageHoverZoom";
import ProductThumb from "@/components/products/ProductThumb";
import { getProductImageUrl } from "@/lib/productImage";
import { productMatchesSearch } from "@/lib/productLookup";
import { sanitizeProductCopy, isUniversalProduct } from "@/lib/sanitizeCopy";
import {
  getVehicleBombillos,
  getBombilloCompatStatus,
  sortProductsByBombilloCompat,
  bombilloCompatRowClass,
} from "@/lib/bombilloCompat";

const DRAFT_CONFIG = {
  sale: {
    listKey: "draft_sale_tabs_v1",
    activeKey: "draft_sale_active_v1",
    prefix: "draft_sale_v1_",
    idPrefix: "sale_",
    namePrefix: "Venta",
    flag: "sale",
    targetPath: "/sales",
  },
  quote: {
    listKey: "draft_quote_tabs_v1",
    activeKey: "draft_quote_active_v1",
    prefix: "draft_quote_v1_",
    idPrefix: "quote_",
    namePrefix: "Cotización",
    flag: "quote",
    targetPath: "/quotations",
  },
};

const parseJson = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
};

const getProductImage = (product) => getProductImageUrl(product);
const CATALOG_SOURCE_CONTEXT_KEY = "catalog_source_context_v1";
const CONTEXT_MAX_AGE_MS = 2 * 60 * 60 * 1000;

const normalizeText = (value) =>
  (value || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const getCompatibilityTypes = (product) => {
  const compatibility = product?.compatibility || {};
  return compatibility.vehicle_types || product?.vehicle_types || [];
};

const hasStructuredCompatibility = (product) => {
  const compatibility = product?.compatibility || {};
  const brands = Array.isArray(compatibility.brands) ? compatibility.brands : [];
  const models = Array.isArray(compatibility.models) ? compatibility.models : [];
  const types = Array.isArray(compatibility.vehicle_types)
    ? compatibility.vehicle_types
    : Array.isArray(product?.vehicle_types)
      ? product.vehicle_types
      : [];
  const hasYearRange = compatibility.year_from || compatibility.year_to;
  return brands.length > 0 || models.length > 0 || types.length > 0 || Boolean(hasYearRange);
};

const isProductCompatibleWithVehicle = (product, vehicle) => {
  if (!vehicle) return true;
  if (isUniversalProduct(product)) return true;
  if (!hasStructuredCompatibility(product)) return true;

  const compatibility = product?.compatibility || {};
  const vehicleBrand = normalizeText(vehicle.brand);
  const vehicleModel = normalizeText(vehicle.model);
  const vehicleType = normalizeText(vehicle.vehicle_type || vehicle.type || vehicle.body_type || "");
  const vehicleYear = Number(vehicle.year);

  const brands = Array.isArray(compatibility.brands)
    ? compatibility.brands.map(normalizeText).filter(Boolean)
    : [];
  if (brands.length > 0 && vehicleBrand && !brands.includes(vehicleBrand)) {
    return false;
  }

  const models = Array.isArray(compatibility.models)
    ? compatibility.models.map(normalizeText).filter(Boolean)
    : [];
  if (models.length > 0 && vehicleModel) {
    const modelMatches = models.some((model) => model === vehicleModel || vehicleModel.includes(model) || model.includes(vehicleModel));
    if (!modelMatches) return false;
  }

  const types = Array.isArray(compatibility.vehicle_types)
    ? compatibility.vehicle_types.map(normalizeText).filter(Boolean)
    : Array.isArray(product?.vehicle_types)
      ? product.vehicle_types.map(normalizeText).filter(Boolean)
      : [];
  if (types.length > 0 && vehicleType && !types.includes(vehicleType)) {
    return false;
  }

  if (!Number.isNaN(vehicleYear) && (compatibility.year_from || compatibility.year_to)) {
    const yearFrom = Number(compatibility.year_from || 0);
    const yearTo = Number(compatibility.year_to || 9999);
    if (vehicleYear < yearFrom || vehicleYear > yearTo) {
      return false;
    }
  }

  return true;
};

export function CatalogPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Redirect restricted seller roles on standalone /catalog route to workbench catalog tab
  useEffect(() => {
    if (usesRestrictedNavigation(user?.role) && location.pathname === "/catalog") {
      const qs = location.search ? `?${location.search.replace(/^\?/, "")}&tab=catalog` : "?tab=catalog";
      navigate(`/workbench${qs}`, { replace: true });
    }
  }, [user?.role, location.pathname, location.search, navigate]);

  const userDraftScopeToken = useMemo(() => {
    const raw = user?.user_id || user?.pin_user_id || user?.username || "anon";
    return String(raw).replace(/[^a-zA-Z0-9_-]/g, "_");
  }, [user?.pin_user_id, user?.user_id, user?.username]);
  const isWarehouseRole = user?.role === "bodegas";
  const [boardTab, setBoardTab] = useState("todos");
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState({});
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [customersById, setCustomersById] = useState({});
  const [customersList, setCustomersList] = useState([]);
  const [inventoryByProduct, setInventoryByProduct] = useState({});
  const [inventoryByWarehouse, setInventoryByWarehouse] = useState({});
  const [warehouses, setWarehouses] = useState([]);
  const [warehousesById, setWarehousesById] = useState({});
  const [quickViewProduct, setQuickViewProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [subcategory, setSubcategory] = useState("all");
  const [productType, setProductType] = useState("all");
  const [vehicleType, setVehicleType] = useState("all");
  const [stayInCatalog, setStayInCatalog] = useState(false);
  const [sourceContext, setSourceContext] = useState(null);
  const [pickCartTick, setPickCartTick] = useState(0);
  const [vehiclesById, setVehiclesById] = useState({});
  const [effectiveUsdNioRate, setEffectiveUsdNioRate] = useState(DEFAULT_USD_NIO_RATE);
  const [visibleCount, setVisibleCount] = useState(30);
  const [showFilters, setShowFilters] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const searchWrapRef = useRef(null);
  const loadMoreRef = useRef(null);
  const searchInputRef = useRef(null);
  /** Select-all on focus: defer mouse focus to mouseup so caret isn't fought. */
  const selectAllOnMouseUpRef = useRef(false);
  const [draftDialog, setDraftDialog] = useState({
    open: false,
    type: null,
    product: null,
    choices: [],
  });

  const modeParam = searchParams.get("mode");
  const compatParam = searchParams.get("compat");
  const isSalePickMode = modeParam === "sale-pick" || modeParam === "quote-pick" || compatParam === "1";

  useEffect(() => {
    setVisibleCount(30);
  }, [search, category, subcategory, productType, vehicleType, boardTab]);

  const applySearchValue = useCallback((value) => {
    const next = String(value ?? "");
    setSearch(next);
    setShowAutocomplete(Boolean(next.trim()));
  }, []);

  const clearAllFilters = useCallback(() => {
    setSearch("");
    setCategory("all");
    setSubcategory("all");
    setProductType("all");
    setVehicleType("all");
    setShowAutocomplete(false);
    setVisibleCount(30);
  }, []);

  const hasActiveFilters =
    Boolean(search.trim()) ||
    category !== "all" ||
    subcategory !== "all" ||
    productType !== "all" ||
    vehicleType !== "all";

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onDocClick = (event) => {
      if (!searchWrapRef.current) return;
      if (!searchWrapRef.current.contains(event.target)) {
        setShowAutocomplete(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const getDraftConfig = (type) => {
    const base = DRAFT_CONFIG[type];
    if (!base) return null;
    return {
      ...base,
      listKey: `${base.listKey}_${userDraftScopeToken}`,
      activeKey: `${base.activeKey}_${userDraftScopeToken}`,
      prefix: `${base.prefix}${userDraftScopeToken}_`,
    };
  };

  const resolveDraftTargetPath = (type) => {
    if (type === "quote" || sourceContext?.source === "quote-form") {
      return "/workbench?tab=quotations";
    }
    return "/workbench?tab=sales";
  };

  const fetchCatalog = async () => {
    setLoading(true);
    try {
      const [productsRes, categoriesRes, customersRes, inventoryRes, warehousesRes, vehiclesRes] = await Promise.all([
        axios.get(`${API}/products?limit=10000`, { withCredentials: true }),
        axios.get(`${API}/categories`, { withCredentials: true }),
        axios.get(`${API}/customers`, { withCredentials: true }).catch(() => ({ data: [] })),
        axios.get(`${API}/inventory`, { withCredentials: true }).catch(() => ({ data: [] })),
        axios.get(`${API}/warehouses`, { withCredentials: true }).catch(() => ({ data: [] })),
        axios.get(`${API}/vehicles`, { withCredentials: true }).catch(() => ({ data: [] })),
      ]);
      setProducts(productsRes.data || []);
      setCategories(categoriesRes?.data?.categories || {});
      setVehicleTypes(categoriesRes?.data?.vehicle_types || []);
      const customerMap = {};
      const custList = customersRes.data || [];
      custList.forEach((customer) => {
        if (customer?.customer_id) {
          customerMap[customer.customer_id] = customer.name || customer.customer_id;
        }
      });
      setCustomersById(customerMap);
      setCustomersList(custList || []);
      const inventoryMap = {};
      const inventoryWarehouseMap = {};
      (inventoryRes.data || []).forEach((item) => {
        const productId = item.product_id;
        if (!productId) return;
        inventoryMap[productId] = (inventoryMap[productId] || 0) + (item.quantity || 0);
        inventoryWarehouseMap[productId] = inventoryWarehouseMap[productId] || [];
        inventoryWarehouseMap[productId].push({
          warehouse_id: item.warehouse_id,
          quantity: item.quantity || 0,
        });
      });
      setInventoryByProduct(inventoryMap);
      setInventoryByWarehouse(inventoryWarehouseMap);

      setWarehouses(warehousesRes.data || []);
      const warehouseMap = {};
      (warehousesRes.data || []).forEach((wh) => {
        if (wh?.warehouse_id) {
          warehouseMap[wh.warehouse_id] = wh.name || wh.label || wh.warehouse_id;
        }
      });
      setWarehousesById(warehouseMap);

      const vehicleMap = {};
      (vehiclesRes.data || []).forEach((vehicle) => {
        if (vehicle?.vehicle_id) {
          vehicleMap[vehicle.vehicle_id] = vehicle;
        }
      });
      setVehiclesById(vehicleMap);
    } catch (error) {
      toast.error("No se pudo cargar el catálogo");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isSalePickMode) {
      // In normal browse mode, do not enforce any active vehicle context
      setSourceContext(null);
      return;
    }

    const raw = window.localStorage.getItem(CATALOG_SOURCE_CONTEXT_KEY);
    const parsed = parseJson(raw, null);
    if (!parsed || (parsed.source !== "sale-form" && parsed.source !== "quote-form")) {
      setSourceContext(null);
      return;
    }

    const createdAtTs = Number(parsed.createdAtTs || 0);
    if (!createdAtTs || Date.now() - createdAtTs > CONTEXT_MAX_AGE_MS) {
      window.localStorage.removeItem(CATALOG_SOURCE_CONTEXT_KEY);
      setSourceContext(null);
      return;
    }

    // Auto-clean if draftId no longer exists
    const draftListKey = parsed.source === "quote-form" ? "draft_quote_tabs_v1" : "draft_sale_tabs_v1";
    const draftTabsRaw = window.localStorage.getItem(`${draftListKey}_${userDraftScopeToken}`);
    const draftTabsList = parseJson(draftTabsRaw, []);
    if (parsed.draftId && Array.isArray(draftTabsList) && draftTabsList.length > 0 && !draftTabsList.some((t) => t.id === parsed.draftId)) {
      window.localStorage.removeItem(CATALOG_SOURCE_CONTEXT_KEY);
      setSourceContext(null);
      return;
    }

    setSourceContext(parsed);
  }, [isSalePickMode, userDraftScopeToken]);

  const selectedContextVehicle = useMemo(() => {
    if (!isSalePickMode || !sourceContext) return null;
    if (sourceContext.selectedVehicle && vehiclesById[sourceContext.selectedVehicle]) {
      return vehiclesById[sourceContext.selectedVehicle];
    }
    if (sourceContext.vehicle && sourceContext.vehicle.vehicle_id) {
      return sourceContext.vehicle;
    }
    return null;
  }, [isSalePickMode, sourceContext, vehiclesById]);

  const selectedContextBombillos = useMemo(
    () => (selectedContextVehicle ? getVehicleBombillos(selectedContextVehicle) : null),
    [selectedContextVehicle]
  );

  const contextCustomerName = useMemo(() => {
    if (!sourceContext?.selectedCustomerId) return null;
    return sourceContext.customerName || customersById[sourceContext.selectedCustomerId] || null;
  }, [sourceContext, customersById]);

  const enforceVehicleCompatibility = Boolean(isSalePickMode && sourceContext && selectedContextVehicle);

  useEffect(() => {
    let mounted = true;
    const refreshRate = async () => {
      const rate = await fetchEffectiveUsdNioRate({ withCredentials: true, fallback: DEFAULT_USD_NIO_RATE });
      if (mounted) {
        setEffectiveUsdNioRate(rate);
      }
    };

    refreshRate();
    const intervalId = window.setInterval(refreshRate, 30000);
    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const availableSubcategories = useMemo(() => {
    if (category === "all") return [];
    const subs = categories?.[category] || [];
    return Array.isArray(subs) ? subs : [];
  }, [categories, category]);

  useEffect(() => {
    if (subcategory !== "all" && !availableSubcategories.includes(subcategory)) {
      setSubcategory("all");
    }
  }, [availableSubcategories, subcategory]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matched = products.filter((product) => {
      const matchesSearch = productMatchesSearch(product, search);
      const matchesCategory = category === "all" || product.category === category;
      const matchesSubcategory = subcategory === "all" || product.subcategory === subcategory;
      const matchesType = productType === "all" || product.product_type === productType;
      const types = getCompatibilityTypes(product);
      const matchesVehicleType = vehicleType === "all" || (Array.isArray(types) && types.includes(vehicleType));
      const matchesSaleVehicle = !enforceVehicleCompatibility || isProductCompatibleWithVehicle(product, selectedContextVehicle);
      return matchesSearch && matchesCategory && matchesSubcategory && matchesType && matchesVehicleType && matchesSaleVehicle;
    });
    return sortProductsByBombilloCompat(matched, selectedContextVehicle, query);
  }, [
    products,
    search,
    category,
    subcategory,
    productType,
    vehicleType,
    enforceVehicleCompatibility,
    selectedContextVehicle,
  ]);

  const conStockCount = useMemo(
    () => filteredProducts.filter((p) => (inventoryByProduct[p.product_id] ?? 0) > 0).length,
    [filteredProducts, inventoryByProduct]
  );

  const sinStockCount = useMemo(
    () => filteredProducts.filter((p) => (inventoryByProduct[p.product_id] ?? 0) === 0).length,
    [filteredProducts, inventoryByProduct]
  );

  const currentActiveList = useMemo(() => {
    if (boardTab === "con-stock") {
      return filteredProducts.filter((p) => (inventoryByProduct[p.product_id] ?? 0) > 0);
    }
    if (boardTab === "sin-stock") {
      return filteredProducts.filter((p) => (inventoryByProduct[p.product_id] ?? 0) === 0);
    }
    return filteredProducts;
  }, [filteredProducts, boardTab, inventoryByProduct]);

  const autocompleteSuggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 1) return [];
    const tokens = q.split(/\s+/).filter(Boolean);
    const primary = tokens[0] || q;
    const scored = [];
    for (const product of filteredProducts) {
      const sku = String(product.sku || "").toLowerCase();
      const name = String(product.name || "").toLowerCase();
      const brand = String(product.brand || "").toLowerCase();
      let score = 0;
      if (sku === q || sku === primary) score = 100;
      else if (sku.startsWith(primary)) score = 80;
      else if (sku.includes(primary)) score = 60;
      else if (name.startsWith(primary)) score = 50;
      else if (name.includes(primary)) score = 40;
      else if (brand.includes(primary)) score = 30;
      else score = 10; // already AND-matched in filteredProducts (e.g. multi-term)
      scored.push({ product, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 10).map((row) => row.product);
  }, [filteredProducts, search]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node) return undefined;
    if (currentActiveList.length <= visibleCount) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((prev) => Math.min(prev + 30, currentActiveList.length));
        }
      },
      { root: null, rootMargin: "240px", threshold: 0 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [currentActiveList.length, visibleCount, boardTab, search, category, subcategory, productType, vehicleType]);


  const getDraftTabs = (type) => {
    if (typeof window === "undefined") return [];
    const config = getDraftConfig(type);
    if (!config) return [];
    const list = parseJson(window.localStorage.getItem(config.listKey), []);
    if (!Array.isArray(list)) return [];
    return list.filter((tab) => {
      if (!tab?.id) return false;
      const hasSnapshot = Boolean(window.localStorage.getItem(`${config.prefix}${tab.id}`));
      return hasSnapshot;
    });
  };

  const computeDraftTotal = (draft) => {
    if (!draft) return 0;
    const currencyDraft = draft.currency || "NIO";
    const rate = effectiveUsdNioRate;
    const convertPrice = (priceUSD) => (currencyDraft === "NIO" ? priceUSD * rate : priceUSD);
    const items = Array.isArray(draft.cartItems) ? draft.cartItems : [];

    const subtotal = items.reduce((sum, item) => {
      const priceInCurrency = convertPrice(item.unit_price || 0);
      let lineTotal = priceInCurrency * (item.quantity || 0) * (1 - (item.discount || 0) / 100);
      const installType = item.installation_type || "optional";
      const wantsInstall = installType === "required" || Boolean(item.with_installation);
      if (installType !== "not_available" && wantsInstall) {
        const installPrice = convertPrice(item.installation_price || 0);
        lineTotal += installPrice * (item.quantity || 0);
      }
      return sum + lineTotal;
    }, 0);

    let discountFromCodes = 0;
    const applied = Array.isArray(draft.appliedDiscounts) ? draft.appliedDiscounts : [];
    applied.forEach((d) => {
      if (d.type === "percent") {
        discountFromCodes += subtotal * (d.value / 100);
      } else if (d.type === "fixed") {
        const fixedInCurrency = currencyDraft === "USD" ? d.value / rate : d.value;
        discountFromCodes += fixedInCurrency;
      }
    });

    const globalDiscountAmount = subtotal * ((draft.globalDiscount || 0) / 100);
    const subtotalAfterDiscounts = subtotal - discountFromCodes - globalDiscountAmount;
    const tax = draft.applyIVA === false ? 0 : subtotalAfterDiscounts * ((draft.ivaRate || 12) / 100);
    return subtotalAfterDiscounts + tax;
  };

  const getDraftSnapshot = (type, draftId) => {
    if (typeof window === "undefined") return null;
    const config = getDraftConfig(type);
    if (!config) return null;
    const draftKey = `${config.prefix}${draftId}`;
    return parseJson(window.localStorage.getItem(draftKey), null);
  };

  const addProductToDraft = async (type, product, options = {}) => {
    if (typeof window === "undefined") return;
    const config = getDraftConfig(type);
    if (!config) return;

    const { forcedDraftId = null, forceNew = false, navigate = true } = options;

    const list = parseJson(window.localStorage.getItem(config.listKey), []);
    let activeId = window.localStorage.getItem(config.activeKey);

    const listIds = Array.isArray(list) ? list.map((tab) => tab.id) : [];
    if (forcedDraftId && listIds.includes(forcedDraftId)) {
      activeId = forcedDraftId;
    } else if (forceNew) {
      activeId = null;
    } else if (!activeId || !listIds.includes(activeId)) {
      activeId = listIds[0] || null;
    }

    let updatedList = Array.isArray(list) ? [...list] : [];
    if (!activeId) {
      const id = `${config.idPrefix}${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      const name = `${config.namePrefix} ${updatedList.length + 1}`;
      const newTab = { id, name, updatedAt: new Date().toISOString() };
      updatedList = [...updatedList, newTab];
      activeId = id;
    }

    const draftKey = `${config.prefix}${activeId}`;
    const existingDraft = parseJson(window.localStorage.getItem(draftKey), {});
    const sourceCustomerId = sourceContext?.selectedCustomerId || null;
    const sourceVehicleId = sourceContext?.selectedVehicle || "";
    const cartItems = Array.isArray(existingDraft.cartItems) ? [...existingDraft.cartItems] : [];
    const productId = product.product_id || product.sku || product.id;
    const existingIndex = cartItems.findIndex((item) => item.product_id === productId);
    const image = getProductImage(product);
    const installationType = product.installation_type || "optional";
    const installationPrice = product.installation_price || 0;
    const withInstallation = installationType === "required";

    if (existingIndex >= 0) {
      cartItems[existingIndex] = {
        ...cartItems[existingIndex],
        quantity: (cartItems[existingIndex].quantity || 1) + 1,
      };
    } else {
      cartItems.push({
        product_id: productId,
        product_name: product.name,
        image,
        quantity: 1,
        unit_price: product.price || 0,
        discount: 0,
        installation_type: installationType,
        installation_price: installationPrice,
        with_installation: withInstallation,
      });
    }

    const draftSnapshot = {
      selectedCustomerId: existingDraft.selectedCustomerId || sourceCustomerId,
      selectedVehicle: existingDraft.selectedVehicle || sourceVehicleId,
      selectedWarehouse: existingDraft.selectedWarehouse || "",
      cartItems,
      globalDiscount: existingDraft.globalDiscount || 0,
      notes: existingDraft.notes || "",
      applyIVA: existingDraft.applyIVA ?? true,
      ivaRate: existingDraft.ivaRate ?? 12,
      currency: existingDraft.currency || "NIO",
      exchangeRate: effectiveUsdNioRate,
      appliedDiscounts: existingDraft.appliedDiscounts || [],
      customerSearch: existingDraft.customerSearch || "",
      productSearch: existingDraft.productSearch || "",
      updatedAt: new Date().toISOString(),
    };

    updatedList = updatedList.map((tab) =>
      tab.id === activeId ? { ...tab, updatedAt: draftSnapshot.updatedAt } : tab
    );
    const activeTab = updatedList.find((tab) => tab.id === activeId) || null;

    window.localStorage.setItem(config.listKey, JSON.stringify(updatedList));
    window.localStorage.setItem(config.activeKey, activeId);
    window.localStorage.setItem(draftKey, JSON.stringify(draftSnapshot));
    try {
      await saveServerDraft(type === "quote" ? "quotation" : type, activeId, {
        name: activeTab?.name || `${config.namePrefix} ${updatedList.length}`,
        snapshot: draftSnapshot,
      });
      await setServerDraftActive(type === "quote" ? "quotation" : type, activeId);
    } catch (error) {
      // keep catalog workflow functional if remote draft sync fails
    }
    if (navigate) {
      const targetPath = resolveDraftTargetPath(type);
      window.localStorage.setItem("catalog_open_draft", config.flag);
      window.location.href = targetPath;
      return;
    }
    toast.success(`${product.name || "Producto"} agregado al borrador`);
    setPickCartTick((n) => n + 1);
  };

  const handleAddClick = (type, product) => {
    if (type === "sale" && sourceContext?.source === "sale-form" && sourceContext?.draftId) {
      addProductToDraft(type, product, {
        forcedDraftId: sourceContext.draftId,
        navigate: !stayInCatalog,
      });
      return;
    }

    const choices = getDraftTabs(type);
    if (choices.length > 1) {
      setDraftDialog({
        open: true,
        type,
        product,
        choices,
      });
      return;
    }
    addProductToDraft(type, product, { navigate: !stayInCatalog });
  };

  const addMultipleProductsToDraft = async (type, productsToAdd, options = {}) => {
    if (typeof window === "undefined" || !Array.isArray(productsToAdd) || productsToAdd.length === 0) return;
    const config = getDraftConfig(type);
    if (!config) return;

    const { forcedDraftId = null, forceNew = false, navigate = true } = options;

    const list = parseJson(window.localStorage.getItem(config.listKey), []);
    let activeId = window.localStorage.getItem(config.activeKey);

    const listIds = Array.isArray(list) ? list.map((tab) => tab.id) : [];
    if (forcedDraftId && listIds.includes(forcedDraftId)) {
      activeId = forcedDraftId;
    } else if (forceNew) {
      activeId = null;
    } else if (!activeId || !listIds.includes(activeId)) {
      activeId = listIds[0] || null;
    }

    let updatedList = Array.isArray(list) ? [...list] : [];
    if (!activeId) {
      const id = `${config.idPrefix}${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      const name = `${config.namePrefix} ${updatedList.length + 1}`;
      const newTab = { id, name, updatedAt: new Date().toISOString() };
      updatedList = [...updatedList, newTab];
      activeId = id;
    }

    const draftKey = `${config.prefix}${activeId}`;
    const existingDraft = parseJson(window.localStorage.getItem(draftKey), {});
    const sourceCustomerId = sourceContext?.selectedCustomerId || null;
    const sourceVehicleId = sourceContext?.selectedVehicle || "";
    const cartItems = Array.isArray(existingDraft.cartItems) ? [...existingDraft.cartItems] : [];

    productsToAdd.forEach((product) => {
      const productId = product.product_id || product.sku || product.id;
      const existingIndex = cartItems.findIndex((item) => item.product_id === productId);
      const image = getProductImage(product);
      const installationType = product.installation_type || "optional";
      const installationPrice = product.installation_price || 0;
      const withInstallation = installationType === "required";

      if (existingIndex >= 0) {
        cartItems[existingIndex] = {
          ...cartItems[existingIndex],
          quantity: (cartItems[existingIndex].quantity || 1) + 1,
        };
      } else {
        cartItems.push({
          product_id: productId,
          product_name: product.name,
          image,
          quantity: 1,
          unit_price: product.price || 0,
          discount: 0,
          installation_type: installationType,
          installation_price: installationPrice,
          with_installation: withInstallation,
        });
      }
    });

    const draftSnapshot = {
      selectedCustomerId: existingDraft.selectedCustomerId || sourceCustomerId,
      selectedVehicle: existingDraft.selectedVehicle || sourceVehicleId,
      selectedWarehouse: existingDraft.selectedWarehouse || "",
      cartItems,
      globalDiscount: existingDraft.globalDiscount || 0,
      notes: existingDraft.notes || "",
      applyIVA: existingDraft.applyIVA ?? true,
      ivaRate: existingDraft.ivaRate ?? 12,
      currency: existingDraft.currency || "NIO",
      exchangeRate: effectiveUsdNioRate,
      appliedDiscounts: existingDraft.appliedDiscounts || [],
      customerSearch: existingDraft.customerSearch || "",
      productSearch: existingDraft.productSearch || "",
      updatedAt: new Date().toISOString(),
    };

    updatedList = updatedList.map((tab) =>
      tab.id === activeId ? { ...tab, updatedAt: draftSnapshot.updatedAt } : tab
    );
    const activeTab = updatedList.find((tab) => tab.id === activeId) || null;

    window.localStorage.setItem(config.listKey, JSON.stringify(updatedList));
    window.localStorage.setItem(config.activeKey, activeId);
    window.localStorage.setItem(draftKey, JSON.stringify(draftSnapshot));
    try {
      await saveServerDraft(type === "quote" ? "quotation" : type, activeId, {
        name: activeTab?.name || `${config.namePrefix} ${updatedList.length}`,
        snapshot: draftSnapshot,
      });
      await setServerDraftActive(type === "quote" ? "quotation" : type, activeId);
    } catch (error) {
      // keep catalog workflow functional if remote draft sync fails
    }
    if (navigate) {
      const targetPath = resolveDraftTargetPath(type);
      window.localStorage.setItem("catalog_open_draft", config.flag);
      window.location.href = targetPath;
      return;
    }
    toast.success(`${productsToAdd.length} productos agregados al borrador`);
  };

  const handleAddMultipleClick = (type, productsToAdd) => {
    if (!Array.isArray(productsToAdd) || productsToAdd.length === 0) return;
    if (type === "sale" && sourceContext?.source === "sale-form" && sourceContext?.draftId) {
      addMultipleProductsToDraft(type, productsToAdd, {
        forcedDraftId: sourceContext.draftId,
        navigate: !stayInCatalog,
      });
      return;
    }

    addMultipleProductsToDraft(type, productsToAdd, { navigate: !stayInCatalog });
  };

  // WhatsApp send modal
  const [whatsappDialog, setWhatsappDialog] = useState({ open: false, product: null, batch: false, selectedClient: null, batchText: '' });

  const openWhatsAppDialog = (product) => {
    setWhatsappDialog({ open: true, product, batch: false, selectedClient: null, batchText: '' });
  };

  const sendWhatsAppMessage = (product) => {
    if (!product) return;
    // only precio1 can be sent
    const priceToSend = product.precio1 ?? product.price ?? 0;
    const name = product.name || product.sku || 'Artículo';
    const message = `*${name}*%0APrecio: ${formatCurrency(priceToSend)}%0ASKU: ${product.sku || ''}%0Ahttps://your-pos.example/product/${product.product_id || product.sku || ''}`;

    if (whatsappDialog.batch) {
      // for batch, open a generic message link (user can paste to many chats)
      const url = `https://wa.me/?text=${encodeURIComponent(decodeURIComponent(message))}`;
      window.open(url, '_blank');
      setWhatsappDialog({ open: false, product: null, batch: false, selectedClient: null, batchText: '' });
      return;
    }

    const client = customersList.find((c) => c.customer_id === whatsappDialog.selectedClient);
    // If client has phone, try to open direct chat; otherwise open generic message
    let url;
    if (client && client.phone) {
      // Phone normalized to digits only
      const phoneDigits = (client.phone || '').replace(/\D/g, '');
      url = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(decodeURIComponent(message))}`;
    } else {
      url = `https://wa.me/?text=${encodeURIComponent(decodeURIComponent(message))}`;
    }
    window.open(url, '_blank');
    setWhatsappDialog({ open: false, product: null, batch: false, selectedClient: null, batchText: '' });
  };

  const pickModeDraftType = sourceContext?.source === "quote-form" ? "quote" : "sale";
  const pickModeCart = useMemo(() => {
    if (!isSalePickMode || !sourceContext?.draftId) return null;
    return getDraftSnapshot(pickModeDraftType, sourceContext.draftId);
  }, [isSalePickMode, sourceContext, pickCartTick, pickModeDraftType]);
  const pickModeCartItems = Array.isArray(pickModeCart?.cartItems) ? pickModeCart.cartItems : [];
  const pickModeCartTotal = useMemo(
    () => computeDraftTotal(pickModeCart),
    [pickModeCart, effectiveUsdNioRate]
  );

  return (
    <div className="space-y-6" data-testid="catalog-page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl mb-1 font-bold tracking-tight md:mb-0 md:text-3xl">Catálogo</h1>
          <p className="hidden text-muted-foreground md:block">Cards con detalle, compatibilidad y acciones rápidas</p>
        </div>
        <Button variant="outline" onClick={fetchCatalog} disabled={loading}>
          Actualizar
        </Button>
      </div>

      {isSalePickMode && sourceContext && (
        <Card className="border-emerald-500/30 bg-emerald-500/10 shadow-sm animate-fade-up-soft">
          <CardContent className="p-3.5 sm:p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-emerald-600 text-white font-semibold text-xs">
                  Modo Selección: {sourceContext.source === "quote-form" ? "Cotización" : "Venta"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Al pulsar "Agregar", el producto se asigna de inmediato al borrador activo.
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-xs font-mono">
                  Borrador: {sourceContext.draftName || sourceContext.draftId}
                </Badge>
                {contextCustomerName && (
                  <Badge variant="outline" className="text-xs">
                    Cliente: {contextCustomerName}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  Vehículo: {selectedContextVehicle
                    ? `${selectedContextVehicle.brand || ""} ${selectedContextVehicle.model || ""} ${selectedContextVehicle.year || ""}`.trim() || "Sin detalle"
                    : "Sin vehículo"}
                </Badge>
                {enforceVehicleCompatibility ? (
                  <Badge className="bg-emerald-700 text-white text-[11px] gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Filtrado por compatibilidad de vehículo
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[11px]">
                    Catálogo completo
                  </Badge>
                )}
                {selectedContextVehicle && selectedContextBombillos && !selectedContextBombillos.hasData ? (
                  <Badge variant="outline" className="text-[11px] text-amber-800 border-amber-300 bg-amber-50">
                    Sin ficha de bombillos para este vehículo
                  </Badge>
                ) : null}
                {selectedContextVehicle && selectedContextBombillos?.hasData ? (
                  <Badge variant="outline" className="text-[11px] text-emerald-800 border-emerald-300 bg-emerald-50">
                    Bombillos: {[...selectedContextBombillos.sizes].join(", ")}
                  </Badge>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0 self-end md:self-center pt-1 md:pt-0">
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-8 bg-background/80 hover:bg-background"
                onClick={() => {
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev);
                    next.delete("mode");
                    next.delete("compat");
                    return next;
                  });
                }}
              >
                Ver catálogo completo
              </Button>
              <Button
                size="sm"
                className="bg-primary text-primary-foreground text-xs h-8 gap-1.5 font-semibold shadow-sm"
                onClick={() => {
                  const target = sourceContext.source === "quote-form" ? "/workbench?tab=quotations" : "/workbench?tab=sales";
                  navigate(target);
                }}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {sourceContext.source === "quote-form" ? "Volver a cotización" : "Volver a la venta"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div
        className={cn(
          isSalePickMode && sourceContext
            ? "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:gap-4 lg:items-start"
            : undefined
        )}
      >
        <div className="min-w-0 space-y-6">
      <div className="sticky top-0 z-20 -mx-1 px-1 pt-2 sm:pt-3 pb-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border/50 overflow-visible">
        <Card className="shadow-sm overflow-visible">
          <CardContent className="p-4 sm:p-5 space-y-3 overflow-visible">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1 py-0.5" ref={searchWrapRef}>
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
                <Input
                  ref={searchInputRef}
                  placeholder="Buscar SKU, nombre, marca…"
                  value={search}
                  onChange={(event) => applySearchValue(event.target.value)}
                  onInput={(event) => applySearchValue(event.target.value)}
                  onPaste={(event) => {
                    const pasted = event.clipboardData?.getData("text") ?? "";
                    // Apply pasted text immediately (don't wait for delayed onChange)
                    if (pasted) {
                      applySearchValue(pasted);
                    }
                  }}
                  onMouseDown={(event) => {
                    selectAllOnMouseUpRef.current = document.activeElement !== event.currentTarget;
                  }}
                  onFocus={(event) => {
                    setShowAutocomplete(Boolean(search.trim()));
                    if (!selectAllOnMouseUpRef.current) {
                      event.target.select();
                    }
                  }}
                  onMouseUp={(event) => {
                    if (!selectAllOnMouseUpRef.current) return;
                    selectAllOnMouseUpRef.current = false;
                    event.target.select();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setShowAutocomplete(false);
                      return;
                    }
                    if (event.key === "Enter") {
                      // Close suggestions; keep grid filter for current query (no accidental QV/submit)
                      event.preventDefault();
                      setShowAutocomplete(false);
                      event.currentTarget.blur();
                    }
                  }}
                  className="pl-10 pr-24 text-sm h-12 py-2.5"
                  autoComplete="off"
                />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {search ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      title="Limpiar búsqueda"
                      onClick={() => applySearchValue("")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    title="Escanear código de barras o QR"
                    aria-label="Escanear código de barras o QR"
                    onClick={() => setShowBarcodeScanner(true)}
                  >
                    <ScanBarcode className="h-4 w-4" />
                  </Button>
                </div>

                {showAutocomplete && autocompleteSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-40 rounded-xl border bg-popover shadow-lg overflow-hidden max-h-80 overflow-y-auto">
                    {autocompleteSuggestions.map((product) => (
                      <button
                        key={product.product_id || product.sku}
                        type="button"
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/70 transition-colors border-b border-border/40 last:border-0"
                        onClick={() => {
                          applySearchValue(product.sku || product.name || "");
                          setQuickViewProduct(product);
                          setShowAutocomplete(false);
                        }}
                      >
                        <div className="h-10 w-10 shrink-0 rounded-md overflow-hidden border bg-muted/30">
                          <ProductThumb product={product} size="full" className="h-full w-full" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-mono text-muted-foreground">{product.sku || "Sin SKU"}</div>
                          <div className="text-sm font-medium truncate">{sanitizeProductCopy(product.name || "Producto", { fallback: product.sku || "Producto" })}</div>
                          {product.brand ? (
                            <div className="text-[11px] text-muted-foreground truncate">{product.brand}</div>
                          ) : null}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant={showFilters ? "default" : "outline"}
                  size="sm"
                  className="h-9 gap-1.5"
                  onClick={() => setShowFilters((v) => !v)}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filtros
                  {showFilters ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5"
                  disabled={!hasActiveFilters}
                  onClick={clearAllFilters}
                  title="Limpiar búsqueda y filtros"
                >
                  <Eraser className="h-3.5 w-3.5" />
                  Limpiar
                </Button>
                {hasActiveFilters ? (
                  <Badge variant="secondary" className="text-[11px]">
                    {filteredProducts.length} resultados
                  </Badge>
                ) : null}
              </div>
            </div>

            {showFilters ? (
              <div className="flex flex-wrap gap-3 pt-1 border-t border-border/50">
                <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:min-w-[280px]">
                  <Label className="inline-flex w-28 shrink-0 items-center gap-1 text-sm text-muted-foreground">
                    <Tags className="h-3.5 w-3.5" />
                    Categoría
                  </Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="min-w-0 flex-1 sm:w-52 sm:flex-none">
                      <div className="flex min-w-0 items-center gap-2">
                        <Tags className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{formatCategoryLabel(category)}</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las categorías</SelectItem>
                      {Object.keys(categories || {}).map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {formatCategoryLabel(cat)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:min-w-[280px]">
                  <Label className="inline-flex w-28 shrink-0 items-center gap-1 text-sm text-muted-foreground">
                    <Shapes className="h-3.5 w-3.5" />
                    Subcategoría
                  </Label>
                  <Select value={subcategory} onValueChange={setSubcategory}>
                    <SelectTrigger className="min-w-0 flex-1 sm:w-52 sm:flex-none">
                      <div className="flex min-w-0 items-center gap-2">
                        <Shapes className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{subcategory === "all" ? "Todas las subcategorías" : subcategory}</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las subcategorías</SelectItem>
                      {availableSubcategories.map((sub) => (
                        <SelectItem key={sub} value={sub}>
                          {sub}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:min-w-[280px]">
                  <Label className="inline-flex w-28 shrink-0 items-center gap-1 text-sm text-muted-foreground">
                    <ListFilter className="h-3.5 w-3.5" />
                    Tipo
                  </Label>
                  <Select value={productType} onValueChange={setProductType}>
                    <SelectTrigger className="min-w-0 flex-1 sm:w-52 sm:flex-none">
                      <div className="flex min-w-0 items-center gap-2">
                        <ListFilter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">
                          {productType === "all" ? "Todos los tipos" : productType === "product" ? "Producto" : "Servicio"}
                        </span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los tipos</SelectItem>
                      <SelectItem value="product">Producto</SelectItem>
                      <SelectItem value="service">Servicio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:min-w-[280px]">
                  <Label className="inline-flex w-28 shrink-0 items-center gap-1 text-sm text-muted-foreground">
                    <CarFront className="h-3.5 w-3.5" />
                    Vehículo
                  </Label>
                  <Select value={vehicleType} onValueChange={setVehicleType}>
                    <SelectTrigger className="min-w-0 flex-1 sm:w-52 sm:flex-none">
                      <div className="flex min-w-0 items-center gap-2">
                        <CarFront className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{vehicleType === "all" ? "Todos los vehículos" : vehicleType}</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los vehículos</SelectItem>
                      {vehicleTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    id="stay-in-catalog"
                    checked={stayInCatalog}
                    onCheckedChange={(value) => setStayInCatalog(Boolean(value))}
                  />
                  <Label htmlFor="stay-in-catalog" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                    <Pin className="h-3.5 w-3.5" />
                    Permanecer en catálogo al agregar
                  </Label>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">Cargando...</CardContent>
        </Card>
      ) : filteredProducts.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">Sin resultados</CardContent>
        </Card>
      ) : (
        <>
          {/* PillSwitch / Segmented tabs selector */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-muted/40 p-2 rounded-2xl border">
            <div className="inline-flex items-center p-1 rounded-xl bg-background/90 border shadow-sm gap-1">
              <button
                type="button"
                onClick={() => setBoardTab("todos")}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-2",
                  boardTab === "todos"
                    ? "bg-primary text-primary-foreground shadow-sm font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Boxes className="h-3.5 w-3.5" />
                <span>Todos</span>
                <Badge
                  variant={boardTab === "todos" ? "secondary" : "outline"}
                  className="text-[10px] px-1.5 py-0 h-4 min-w-[20px] justify-center"
                >
                  {filteredProducts.length}
                </Badge>
              </button>

              <button
                type="button"
                onClick={() => setBoardTab("con-stock")}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-2",
                  boardTab === "con-stock"
                    ? "bg-emerald-600 text-white shadow-sm font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Con stock</span>
                <Badge
                  variant={boardTab === "con-stock" ? "secondary" : "outline"}
                  className="text-[10px] px-1.5 py-0 h-4 min-w-[20px] justify-center"
                >
                  {conStockCount}
                </Badge>
              </button>

              <button
                type="button"
                onClick={() => setBoardTab("sin-stock")}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-2",
                  boardTab === "sin-stock"
                    ? "bg-slate-700 text-white shadow-sm font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <span className="h-2 w-2 rounded-full bg-slate-400" />
                <span>Sin stock</span>
                <Badge
                  variant={boardTab === "sin-stock" ? "secondary" : "outline"}
                  className="text-[10px] px-1.5 py-0 h-4 min-w-[20px] justify-center"
                >
                  {sinStockCount}
                </Badge>
              </button>
            </div>

            <div className="text-xs text-muted-foreground pr-2 font-medium">
              Mostrando <strong className="text-foreground">{Math.min(visibleCount, currentActiveList.length)}</strong> de{" "}
              <strong className="text-foreground">{currentActiveList.length}</strong> productos
            </div>
          </div>

          {/* Single column spacious product list */}
          {currentActiveList.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Sin productos en esta sección ({boardTab === "con-stock" ? "No hay con stock" : "No hay sin stock"}).
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {currentActiveList.slice(0, visibleCount).map((product) => {
                const compatibility = product?.compatibility || {};
                const compatTypes = getCompatibilityTypes(product);
                const image = getProductImage(product);
                const stock = inventoryByProduct[product.product_id] ?? null;
                const stockByWarehouse = inventoryByWarehouse[product.product_id] || [];
                const promos = Array.isArray(product?.promotions)
                  ? product.promotions
                  : product?.promo_label
                    ? [product.promo_label]
                    : [];
                const bombilloStatus = selectedContextVehicle
                  ? getBombilloCompatStatus(product, selectedContextVehicle, { query: search })
                  : null;

                return (
                  <Card
                    key={product.product_id || product.sku}
                    className={cn(
                      "overflow-hidden hover:shadow-md transition-all duration-200 border-border/80",
                      bombilloCompatRowClass(bombilloStatus)
                    )}
                  >
                    <CardContent className="p-0">
                      <div className="grid gap-5 md:grid-cols-[240px,1fr]">
                        {/* Image column */}
                        <div className="p-3.5 bg-muted/20 border-b md:border-b-0 md:border-r flex items-center justify-center min-h-[200px] max-h-[260px]">
                          <ProductImageHoverZoom
                            product={product}
                            src={image}
                            alt={product.name || "Producto"}
                            brand={product.brand}
                            category={product.category}
                            className="w-full h-full min-h-[190px] max-h-[230px]"
                            onOpenQuickView={() => setQuickViewProduct(product)}
                            badge={
                              stock !== null && stock > 0 ? (
                                <Badge className="bg-emerald-600/90 backdrop-blur text-white text-[11px] font-semibold shadow-sm">
                                  Stock: {stock}
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-background/90 backdrop-blur text-muted-foreground text-[11px] border">
                                  Sin stock
                                </Badge>
                              )
                            }
                          />
                        </div>

                        {/* Details column */}
                        <div className="p-5 space-y-3.5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1 space-y-1">
                              <h3 className="text-lg sm:text-xl font-bold tracking-tight text-foreground leading-snug">
                                {product.name || "Producto"}
                              </h3>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground font-mono">
                                <span>SKU: {product.sku || "Sin SKU"}</span>
                                <span>•</span>
                                <span className="font-semibold text-foreground">{product.brand || "Sin marca"}</span>
                                <span>•</span>
                                <span>Garantía: {product.warranty_months || 0} meses</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xl sm:text-2xl font-black text-primary font-mono">
                                {formatCurrency(usdAndNioFromUsdBase(product.price || 0, effectiveUsdNioRate).usd, "USD")}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono font-medium">
                                ≈ {formatCurrency(usdAndNioFromUsdBase(product.price || 0, effectiveUsdNioRate).nio, "NIO")}
                              </div>
                            </div>
                          </div>

                          {/* Categories and types */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className="text-xs font-normal">
                              {formatCategoryLabel(product.category) || "Sin categoría"}
                            </Badge>
                            {product.subcategory ? (
                              <Badge variant="secondary" className="text-xs">
                                {product.subcategory}
                              </Badge>
                            ) : null}
                            <Badge variant="outline" className="text-xs">
                              {product.product_type === "service" ? "Servicio" : "Producto"}
                            </Badge>
                            {bombilloStatus === "compatible" ? (
                              <Badge className="bg-emerald-600 text-white text-xs font-semibold">
                                Compatible
                              </Badge>
                            ) : null}
                            {bombilloStatus === "incompatible" ? (
                              <Badge variant="secondary" className="text-xs text-slate-600">
                                Otro socket
                              </Badge>
                            ) : null}
                            {product.installation_type && product.installation_type !== "not_available" ? (
                              <Badge variant="outline" className="text-xs">
                                Instalación: {product.installation_type === "required" ? "Requerida" : "Opcional"}
                                {product.installation_price ? ` (${formatCurrency(product.installation_price, "USD")})` : ""}
                              </Badge>
                            ) : null}
                          </div>

                          {/* Description */}
                          {sanitizeProductCopy(product.description || "") ? (
                            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed line-clamp-2">
                              {sanitizeProductCopy(product.description)}
                            </p>
                          ) : null}

                          {/* Compatibility */}
                          <div className="space-y-1.5 bg-muted/20 p-2.5 rounded-lg border border-border/50">
                            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                              Compatibilidad
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {isUniversalProduct(product) && (
                                <Badge variant="default" className="bg-emerald-600/90 hover:bg-emerald-600 text-white text-[11px] py-0 px-2 font-semibold gap-1">
                                  <Sparkles className="h-3 w-3" />
                                  Universal
                                </Badge>
                              )}
                              {(product.compatibilidad_texto || compatibility?.texto) && (
                                <Badge variant="secondary" className="text-[11px] py-0 px-2 font-medium">
                                  {product.compatibilidad_texto || compatibility.texto}
                                </Badge>
                              )}
                              {(compatibility?.brands || []).map((brand) => (
                                <Badge key={brand} variant="secondary" className="text-[11px] py-0 px-2 font-medium">
                                  {brand}
                                </Badge>
                              ))}
                              {(compatibility?.models || []).map((model) => (
                                <Badge key={model} variant="outline" className="text-[11px] py-0 px-2">
                                  {model}
                                </Badge>
                              ))}
                              {(compatTypes || []).map((type) => (
                                <Badge key={type} variant="outline" className="text-[11px] py-0 px-2">
                                  {type}
                                </Badge>
                              ))}
                              {(compatibility?.year_from || compatibility?.year_to) && (
                                <Badge variant="outline" className="text-[11px] py-0 px-2">
                                  {compatibility.year_from || "-"} - {compatibility.year_to || "Actual"}
                                </Badge>
                              )}
                              {!isUniversalProduct(product) && !(product.compatibilidad_texto || compatibility?.texto) && !compatibility?.brands?.length && !compatibility?.models?.length && !compatTypes?.length && !compatibility?.year_from && !compatibility?.year_to && (
                                <span className="text-xs text-muted-foreground italic">Sin datos de compatibilidad</span>
                              )}
                            </div>
                          </div>

                          {/* Warehouse Breakdown */}
                          {stockByWarehouse.length > 0 && (
                            <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-1.5">
                              <span className="font-medium">Bodegas:</span>
                              {stockByWarehouse.map((entry) => {
                                const name = warehousesById[entry.warehouse_id] || entry.warehouse_id || "Bodega";
                                return (
                                  <Badge key={entry.warehouse_id} variant="outline" className="text-[11px] py-0">
                                    {name}: {entry.quantity}
                                  </Badge>
                                );
                              })}
                            </div>
                          )}

                          {/* Promotions */}
                          {promos.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {promos.map((promo) => (
                                <Badge key={promo} className="bg-amber-500 text-white text-xs">
                                  {promo}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex flex-wrap gap-2.5 items-center pt-1 border-t border-border/40">
                            <Button
                              variant="outline"
                              className="h-9 px-3 text-xs font-semibold gap-1.5 hover:bg-primary hover:text-primary-foreground transition-all"
                              onClick={() => setQuickViewProduct(product)}
                              title="Ver características completas y fotos"
                            >
                              <Eye className="h-3.5 w-3.5 text-primary" />
                              Ver Detalle
                            </Button>
                            <Button
                              className="bg-emerald-600 text-white hover:bg-emerald-700 h-9 px-4 text-xs font-semibold gap-1.5"
                              onClick={() => handleAddClick("sale", product)}
                            >
                              <ShoppingCart className="h-3.5 w-3.5" />
                              Agregar a venta
                            </Button>
                            <Button
                              className="bg-blue-600 text-white hover:bg-blue-700 h-9 px-4 text-xs font-semibold gap-1.5"
                              onClick={() => handleAddClick("quote", product)}
                            >
                              <FileText className="h-3.5 w-3.5" />
                              Agregar a cotización
                            </Button>
                            {!isWarehouseRole && (
                              <Button
                                variant="outline"
                                className="text-emerald-700 dark:text-emerald-400 border-emerald-600/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 h-9 px-3.5 text-xs font-semibold gap-1.5"
                                onClick={() => openWhatsAppDialog(product)}
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                                WhatsApp
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {currentActiveList.length > visibleCount ? (
                <div ref={loadMoreRef} className="text-center pt-3 pb-8 text-xs text-muted-foreground">
                  Cargando más productos… ({visibleCount} de {currentActiveList.length})
                </div>
              ) : currentActiveList.length > 0 ? (
                <div className="text-center pt-2 pb-6 text-xs text-muted-foreground">
                  Fin de resultados ({currentActiveList.length})
                </div>
              ) : null}
            </div>
          )}
        </>
      )}
        </div>

        {isSalePickMode && sourceContext ? (
          <aside className="hidden lg:block lg:sticky lg:top-24 self-start">
            <Card className="border-emerald-500/30 shadow-md overflow-hidden">
              <CardHeader className="py-3 px-4 bg-emerald-500/10 border-b border-emerald-500/20">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                  Carrito del cliente
                </CardTitle>
                <p className="text-[11px] text-muted-foreground font-normal mt-1">
                  {contextCustomerName || "Sin cliente"} · {sourceContext.draftName || sourceContext.draftId}
                </p>
              </CardHeader>
              <CardContent className="p-3 space-y-3 max-h-[min(70vh,640px)] overflow-y-auto">
                {pickModeCartItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    Agrega productos desde el catálogo. El carrito se actualiza al instante.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {pickModeCartItems.map((item, idx) => (
                      <li
                        key={`${item.product_id || item.sku || "line"}-${idx}`}
                        className="rounded-lg border bg-card px-2.5 py-2 text-xs"
                      >
                        <div className="font-medium leading-snug line-clamp-2">
                          {item.name || item.sku || "Producto"}
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2 text-muted-foreground">
                          <span className="font-mono">×{item.quantity || 1}</span>
                          <span className="font-semibold text-foreground">
                            {formatCurrency(
                              (Number(item.unit_price) || 0) * (Number(item.quantity) || 1),
                              pickModeCart?.currency || "USD"
                            )}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="border-t pt-2 flex items-center justify-between text-sm font-semibold">
                  <span>Total</span>
                  <span className="font-mono">
                    {formatCurrency(pickModeCartTotal || 0, pickModeCart?.currency || "NIO")}
                  </span>
                </div>
                <Button
                  className="w-full h-9 text-xs font-semibold gap-1.5"
                  onClick={() => {
                    const target =
                      sourceContext.source === "quote-form"
                        ? "/workbench?tab=quotations"
                        : "/workbench?tab=sales";
                    navigate(target);
                  }}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {sourceContext.source === "quote-form" ? "Volver a cotización" : "Volver a la venta"}
                </Button>
              </CardContent>
            </Card>
          </aside>
        ) : null}
      </div>

      <Dialog
        open={draftDialog.open}
        onOpenChange={(open) =>
          setDraftDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent className="max-w-xl">
          <ContextualDialogHeader
            variant="question"
            size="hero"
            title="Selecciona el borrador"
            description="Elige dónde agregar el producto antes de continuar."
          />
          <div className="space-y-2">
            {draftDialog.choices.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className="w-full text-left border rounded-md px-3 py-2 hover:bg-accent"
                onClick={() => {
                  addProductToDraft(draftDialog.type, draftDialog.product, {
                    forcedDraftId: tab.id,
                    navigate: !stayInCatalog,
                  });
                  setDraftDialog({ open: false, type: null, product: null, choices: [] });
                }}
              >
                <div className="font-medium">{tab.name || tab.id}</div>
                {(() => {
                  const draft = getDraftSnapshot(draftDialog.type, tab.id);
                  const customerName = draft?.selectedCustomerId
                    ? customersById[draft.selectedCustomerId]
                    : null;
                  const total = draft ? computeDraftTotal(draft) : 0;
                  return (
                    <div className="text-xs text-muted-foreground">
                      {customerName ? `Cliente: ${customerName}` : "Cliente: sin asignar"}
                      {" • "}
                      Total: {formatCurrency(total || 0, draft?.currency || "NIO")}
                      {tab.updatedAt ? ` • ${formatDate(tab.updatedAt)}` : ""}
                    </div>
                  );
                })()}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                addProductToDraft(draftDialog.type, draftDialog.product, {
                  forceNew: true,
                  navigate: !stayInCatalog,
                });
                setDraftDialog({ open: false, type: null, product: null, choices: [] });
              }}
            >
              Nuevo borrador
            </Button>
            <Button
              variant="ghost"
              onClick={() => setDraftDialog({ open: false, type: null, product: null, choices: [] })}
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* WhatsApp send dialog */}
      <Dialog open={whatsappDialog.open && !isWarehouseRole} onOpenChange={(open) => setWhatsappDialog((prev) => ({ ...prev, open }))}>
        <DialogContent className="max-w-sm">
          <ContextualDialogHeader
            variant="information"
            size="hero"
            title="Enviar por WhatsApp"
            description="Selecciona un cliente o usa el envío por lotes."
          />
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input id="wa-single" type="radio" name="wa_mode" checked={!whatsappDialog.batch} onChange={() => setWhatsappDialog((s) => ({ ...s, batch: false }))} />
              <label htmlFor="wa-single" className="text-sm">Enviar a un cliente</label>
            </div>
            {!whatsappDialog.batch && (
              <div>
                <Select value={whatsappDialog.selectedClient ?? "__none__"} onValueChange={(v) => setWhatsappDialog((s) => ({ ...s, selectedClient: v }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">-- sin cliente --</SelectItem>
                    {customersList.filter(c => c && c.customer_id).map((c) => (
                      <SelectItem key={String(c.customer_id)} value={String(c.customer_id)}>{c.name || c.customer_id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input id="wa-batch" type="radio" name="wa_mode" checked={whatsappDialog.batch} onChange={() => setWhatsappDialog((s) => ({ ...s, batch: true }))} />
              <label htmlFor="wa-batch" className="text-sm">Enviar por lotes (mensaje genérico)</label>
            </div>
            {whatsappDialog.batch && (
              <div>
                <Label className="text-xs">Notas para lote</Label>
                <Input value={whatsappDialog.batchText} onChange={(e) => setWhatsappDialog((s) => ({ ...s, batchText: e.target.value }))} placeholder="Texto adicional para incluir en el mensaje (opcional)" />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setWhatsappDialog({ open: false, product: null, batch: false, selectedClient: null, batchText: '' })}>Cancelar</Button>
            <Button onClick={() => sendWhatsAppMessage(whatsappDialog.product)}>Enviar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Quick View Dialog */}
            {showScrollTop ? (
        <Button
          type="button"
          size="icon"
          className="fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full shadow-lg"
          title="Ir al buscador"
          onClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
            searchInputRef.current?.focus?.();
          }}
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      ) : null}

      <ProductBarcodeScannerDialog
        open={showBarcodeScanner}
        onOpenChange={setShowBarcodeScanner}
        onScan={(code) => {
          const value = String(code || "").trim();
          if (!value) return;
          applySearchValue(value);
          setShowBarcodeScanner(false);
          setShowAutocomplete(true);
        }}
        title="Escanear producto"
        description="Apunta al código de barras o QR. El código se usa como búsqueda en el catálogo."
      />

<ProductQuickViewDialog
        open={Boolean(quickViewProduct)}
        onOpenChange={(open) => !open && setQuickViewProduct(null)}
        product={quickViewProduct}
        allProducts={products}
        warehouses={warehouses}
        inventoryByWarehouse={inventoryByWarehouse}
        inventoryByProduct={inventoryByProduct}
        onAddToCart={(p) => handleAddClick("sale", p)}
        onAddToQuote={(p) => handleAddClick("quote", p)}
        onAddMultipleToCart={(items) => handleAddMultipleClick("sale", items)}
        onAddMultipleToQuote={(items) => handleAddMultipleClick("quote", items)}
        onSendWhatsApp={(p) => openWhatsAppDialog(p)}
        onOpenProduct={(p) => setQuickViewProduct(p)}
        isWarehouseRole={isWarehouseRole}
        userRole={user?.role}
        currency="USD"
        exchangeRate={effectiveUsdNioRate}
      />
    </div>
  );
}