import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Checkbox } from "../components/ui/checkbox";
import { Label } from "../components/ui/label";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "../lib/utils";
import { API_BASE as API } from "@/lib/api";
import { fetchEffectiveUsdNioRate, DEFAULT_USD_NIO_RATE } from "@/lib/exchangeRate";
import { saveServerDraft, setServerDraftActive } from "@/lib/serverDrafts";

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

const getProductImage = (product) => product?.images?.[0] || product?.image_url || null;
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
  const isWarehouseRole = user?.role === "bodegas";
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState({});
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [customersById, setCustomersById] = useState({});
  const [customersList, setCustomersList] = useState([]);
  const [inventoryByProduct, setInventoryByProduct] = useState({});
  const [inventoryByWarehouse, setInventoryByWarehouse] = useState({});
  const [warehousesById, setWarehousesById] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [subcategory, setSubcategory] = useState("all");
  const [productType, setProductType] = useState("all");
  const [vehicleType, setVehicleType] = useState("all");
  const [stayInCatalog, setStayInCatalog] = useState(false);
  const [sourceContext, setSourceContext] = useState(null);
  const [vehiclesById, setVehiclesById] = useState({});
  const [effectiveUsdNioRate, setEffectiveUsdNioRate] = useState(DEFAULT_USD_NIO_RATE);
  const [draftDialog, setDraftDialog] = useState({
    open: false,
    type: null,
    product: null,
    choices: [],
  });

  const resolveDraftTargetPath = (type) => {
    const config = DRAFT_CONFIG[type];
    if (!config) return "/sales";

    if (type === "sale" && sourceContext?.source === "sale-form") {
      const returnPath = sourceContext?.returnPath;
      if (typeof returnPath === "string" && returnPath.startsWith("/")) {
        return returnPath;
      }
    }

    return config.targetPath;
  };

  const fetchCatalog = async () => {
    setLoading(true);
    try {
      const [productsRes, categoriesRes, customersRes, inventoryRes, warehousesRes, vehiclesRes] = await Promise.all([
        axios.get(`${API}/products`, { withCredentials: true }),
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
      const custList = (customersRes.data || [])
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
    const raw = window.localStorage.getItem(CATALOG_SOURCE_CONTEXT_KEY);
    const parsed = parseJson(raw, null);
    if (!parsed || parsed.source !== "sale-form") {
      setSourceContext(null);
      return;
    }

    const createdAtTs = Number(parsed.createdAtTs || 0);
    if (!createdAtTs || Date.now() - createdAtTs > CONTEXT_MAX_AGE_MS) {
      window.localStorage.removeItem(CATALOG_SOURCE_CONTEXT_KEY);
      setSourceContext(null);
      return;
    }

    setSourceContext(parsed);
  }, []);

  const selectedContextVehicle = useMemo(() => {
    if (!sourceContext) return null;
    if (sourceContext.selectedVehicle && vehiclesById[sourceContext.selectedVehicle]) {
      return vehiclesById[sourceContext.selectedVehicle];
    }
    if (sourceContext.vehicle && sourceContext.vehicle.vehicle_id) {
      return sourceContext.vehicle;
    }
    return null;
  }, [sourceContext, vehiclesById]);

  const contextCustomerName = useMemo(() => {
    if (!sourceContext?.selectedCustomerId) return null;
    return sourceContext.customerName || customersById[sourceContext.selectedCustomerId] || null;
  }, [sourceContext, customersById]);

  const enforceVehicleCompatibility = Boolean(sourceContext?.source === "sale-form" && selectedContextVehicle);

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
    return products.filter((product) => {
      const matchesSearch =
        !query ||
        (product.name || "").toLowerCase().includes(query) ||
        (product.sku || "").toLowerCase().includes(query) ||
        (product.brand || "").toLowerCase().includes(query) ||
        (product.category || "").toLowerCase().includes(query) ||
        (product.subcategory || "").toLowerCase().includes(query);
      const matchesCategory = category === "all" || product.category === category;
      const matchesSubcategory = subcategory === "all" || product.subcategory === subcategory;
      const matchesType = productType === "all" || product.product_type === productType;
      const types = getCompatibilityTypes(product);
      const matchesVehicleType = vehicleType === "all" || (Array.isArray(types) && types.includes(vehicleType));
      const matchesSaleVehicle = !enforceVehicleCompatibility || isProductCompatibleWithVehicle(product, selectedContextVehicle);
      return matchesSearch && matchesCategory && matchesSubcategory && matchesType && matchesVehicleType && matchesSaleVehicle;
    });
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

  const getDraftTabs = (type) => {
    if (typeof window === "undefined") return [];
    const config = DRAFT_CONFIG[type];
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
    const config = DRAFT_CONFIG[type];
    if (!config) return null;
    const draftKey = `${config.prefix}${draftId}`;
    return parseJson(window.localStorage.getItem(draftKey), null);
  };

  const addProductToDraft = async (type, product, options = {}) => {
    if (typeof window === "undefined") return;
    const config = DRAFT_CONFIG[type];
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

  return (
    <div className="space-y-6" data-testid="catalog-page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Catálogo</h1>
          <p className="text-muted-foreground">Cards con detalle, compatibilidad y acciones rápidas</p>
        </div>
        <Button variant="outline" onClick={fetchCatalog} disabled={loading}>
          Actualizar
        </Button>
      </div>

      {sourceContext?.source === "sale-form" && (
        <Card>
          <CardHeader>
            <CardTitle>Contexto de venta activo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Todo producto agregado a venta se enviará al borrador de origen sin volver a pedir selección.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Borrador: {sourceContext.draftName || sourceContext.draftId}</Badge>
              <Badge variant="outline">Cliente: {contextCustomerName || "Sin cliente"}</Badge>
              <Badge variant="outline">
                Vehículo: {selectedContextVehicle
                  ? `${selectedContextVehicle.brand || ""} ${selectedContextVehicle.model || ""} ${selectedContextVehicle.year || ""}`.trim() || "Sin detalle"
                  : "Sin vehículo"}
              </Badge>
              {enforceVehicleCompatibility && (
                <Badge className="bg-emerald-600 text-white">Compatibilidad activa por vehículo</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Filtros rápidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="Buscar por SKU, nombre, marca..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="min-w-[220px] max-w-sm"
            />
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.keys(categories || {}).map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={subcategory} onValueChange={setSubcategory}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Subcategoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {availableSubcategories.map((sub) => (
                  <SelectItem key={sub} value={sub}>
                    {sub}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={productType} onValueChange={setProductType}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Tipo de producto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="product">Producto</SelectItem>
                <SelectItem value="service">Servicio</SelectItem>
              </SelectContent>
            </Select>
            <Select value={vehicleType} onValueChange={setVehicleType}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Tipo de vehículo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {vehicleTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                id="stay-in-catalog"
                checked={stayInCatalog}
                onCheckedChange={(value) => setStayInCatalog(Boolean(value))}
              />
              <Label htmlFor="stay-in-catalog" className="text-sm text-muted-foreground">
                Permanecer en catálogo al agregar
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">Cargando...</CardContent>
        </Card>
      ) : filteredProducts.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">Sin resultados</CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {filteredProducts.map((product) => {
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

            return (
              <Card key={product.product_id || product.sku} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="grid gap-4 md:grid-cols-[280px,1fr]">
                    <div className="bg-muted/30 flex items-center justify-center min-h-[220px]">
                      {image ? (
                        <img
                          src={image}
                          alt={product.name || "Producto"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="text-sm text-muted-foreground">Sin imagen</div>
                      )}
                    </div>
                    <div className="p-5 space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <h3 className="text-xl font-semibold">{product.name || "Producto"}</h3>
                          <p className="text-sm text-muted-foreground">{product.sku || "Sin SKU"} • {product.brand || "Sin marca"}</p>
                          <div className="text-xs text-muted-foreground">Garantía: {product.warranty_months || 0} meses</div>
                          {stock !== null ? (
                            <div className="text-xs text-muted-foreground">Stock: {stock}</div>
                          ) : null}
                          {stockByWarehouse.length > 0 ? (
                            <div className="text-xs text-muted-foreground">
                              Bodegas: {stockByWarehouse.slice(0, 3).map((entry) => {
                                const name = warehousesById[entry.warehouse_id] || entry.warehouse_id || "Bodega";
                                return `${name} (${entry.quantity})`;
                              }).join(" · ")}
                              {stockByWarehouse.length > 3 ? " · ..." : ""}
                            </div>
                          ) : null}
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">{formatCurrency(product.price || 0)}</div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{product.category || "Sin categoría"}</Badge>
                        {product.subcategory ? <Badge variant="secondary">{product.subcategory}</Badge> : null}
                        <Badge variant="outline">{product.product_type === "service" ? "Servicio" : "Producto"}</Badge>
                        {product.installation_type ? (
                          <Badge variant="outline">
                            Instalación: {product.installation_type === "required" ? "Requerida" : product.installation_type === "optional" ? "Opcional" : "No aplica"}
                          </Badge>
                        ) : null}
                        {product.installation_price ? (
                          <Badge variant="outline">Instalación {formatCurrency(product.installation_price || 0)}</Badge>
                        ) : null}
                      </div>

                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {product.description || "Sin descripción"}
                      </p>

                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-muted-foreground">Compatibilidad</div>
                        <div className="flex flex-wrap gap-2">
                          {(compatibility?.brands || []).map((brand) => (
                            <Badge key={brand} variant="secondary">{brand}</Badge>
                          ))}
                          {(compatibility?.models || []).map((model) => (
                            <Badge key={model} variant="outline">{model}</Badge>
                          ))}
                          {(compatTypes || []).map((type) => (
                            <Badge key={type} variant="outline">{type}</Badge>
                          ))}
                          {(compatibility?.year_from || compatibility?.year_to) && (
                            <Badge variant="outline">
                              {compatibility.year_from || "-"} - {compatibility.year_to || "Actual"}
                            </Badge>
                          )}
                          {!compatibility?.brands?.length && !compatibility?.models?.length && !compatTypes?.length && !compatibility?.year_from && !compatibility?.year_to && (
                            <Badge variant="outline">Sin datos de compatibilidad</Badge>
                          )}
                        </div>
                      </div>

                      {promos.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {promos.map((promo) => (
                            <Badge key={promo} className="bg-amber-500 text-white">{promo}</Badge>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-3 items-center">
                        <Button className="bg-green-600 text-white hover:bg-green-700" onClick={() => handleAddClick("sale", product)}>
                          Agregar a venta
                        </Button>
                        <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => handleAddClick("quote", product)}>
                          Agregar a cotización
                        </Button>
                        {!isWarehouseRole && (
                          <Button className="bg-white text-green-700 border border-green-600 hover:bg-green-50" onClick={() => openWhatsAppDialog(product)}>
                            Enviar por WhatsApp
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={draftDialog.open}
        onOpenChange={(open) =>
          setDraftDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Selecciona el borrador</DialogTitle>
            <DialogDescription>
              Elige dónde agregar el producto antes de continuar.
            </DialogDescription>
          </DialogHeader>
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
          <DialogHeader>
            <DialogTitle>Enviar por WhatsApp</DialogTitle>
            <DialogDescription>Selecciona un cliente o usa el envío por lotes.</DialogDescription>
          </DialogHeader>
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
    </div>
  );
}
