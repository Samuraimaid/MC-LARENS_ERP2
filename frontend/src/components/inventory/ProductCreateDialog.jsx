import React, { useState, useRef, useCallback, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Plus, X, Image, Car, Wrench, Clock, DollarSign, Star, Trash2, RefreshCw, Package
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import ValidatedInput, { VALIDATION_SUCCESS_SHORT } from "@/components/common/ValidatedInput";
import { requiredSku, requiredProductName, requiredPrice } from "@/lib/fieldValidators";
import { buildProductPricePayload } from "@/lib/priceTiers";
import { formatCategoryLabel } from "@/lib/branding";
import { FileUploadQueue } from "@/components/uploads/FileUploadQueue";
import { API_BASE as API } from "@/lib/api";
import { humanApiError } from "@/lib/humanApiError";

const DEFAULT_NEW_PRODUCT = {
  sku: "",
  barcode: "",
  name: "",
  description: "",
  category: "",
  subcategory: "",
  brand: "",
  price: "",
  precio1: "",
  precio2: "",
  precio_vip: "",
  precio_casa_comercial: "",
  precio3: "",
  cost: "",
  product_type: "product",
  images: [],
  compatibility: {
    brands: [],
    models: [],
    year_from: null,
    year_to: null,
    vehicle_types: []
  },
  installation_required: false,
  installation_price: "",
  installation_time_minutes: "",
  installation_type: "optional",
  polarizado_type: "",
  window_options: [],
  hourly_rate: "",
  warranty_months: 12,
  low_stock_threshold: 5,
  initial_stock: 0,
  initial_warehouse_id: "",
  provision_all_warehouses: true,
  available_store_ids: [],
  source_warehouse_ids: [],
};

export default function ProductCreateDialog({
  open = false,
  onOpenChange,
  onProductCreated,
  categories = {},
  getSubcategories = () => [],
  vehicleTypes = [],
  warehouses = [],
  branches = [],
  canCreate = true,
  onOpenNewCategory = () => {},
}) {
  const [formData, setFormData] = useState(DEFAULT_NEW_PRODUCT);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [newModel, setNewModel] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationKey, setValidationKey] = useState(0);

  const skuRef = useRef(null);
  const nameRef = useRef(null);
  const priceRef = useRef(null);
  const uploadIndexRef = useRef(0);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      uploadIndexRef.current = formData.images.length || 0;
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    onOpenChange(false);
  };

  const resetForm = () => {
    setValidationKey((k) => k + 1);
    setFormData(DEFAULT_NEW_PRODUCT);
    setNewImageUrl("");
    setNewBrand("");
    setNewModel("");
  };

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const addCompatibilityBrand = () => {
    if (newBrand.trim() && !formData.compatibility.brands.includes(newBrand.trim())) {
      setFormData((prev) => ({
        ...prev,
        compatibility: {
          ...prev.compatibility,
          brands: [...prev.compatibility.brands, newBrand.trim()]
        }
      }));
      setNewBrand("");
    }
  };

  const addCompatibilityModel = () => {
    if (newModel.trim() && !formData.compatibility.models.includes(newModel.trim())) {
      setFormData((prev) => ({
        ...prev,
        compatibility: {
          ...prev.compatibility,
          models: [...prev.compatibility.models, newModel.trim()]
        }
      }));
      setNewModel("");
    }
  };

  const toggleVehicleType = (type) => {
    const current = formData.compatibility.vehicle_types;
    const updated = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type];
    setFormData((prev) => ({
      ...prev,
      compatibility: {
        ...prev.compatibility,
        vehicle_types: updated
      }
    }));
  };

  const addImageUrl = () => {
    if (newImageUrl && !formData.images.includes(newImageUrl)) {
      setFormData((prev) => ({
        ...prev,
        images: [...prev.images, newImageUrl]
      }));
      setNewImageUrl("");
    }
  };

  const removeProductImage = (url) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter(img => img !== url)
    }));
  };

  const setPrimaryImage = (url) => {
    setFormData((prev) => {
      const rest = prev.images.filter(img => img !== url);
      return { ...prev, images: [url, ...rest] };
    });
  };

  const handleUploadFile = useCallback(async (file, { onProgress } = {}) => {
    const currentSku = formData.sku || "";
    const startIndex = uploadIndexRef.current;
    uploadIndexRef.current = startIndex + 1;

    const body = new FormData();
    body.append("files", file);
    if (currentSku) body.append("sku", currentSku);
    body.append("start_index", String(startIndex));

    const res = await axios.post(`${API}/products/images/upload`, body, {
      headers: { "Content-Type": "multipart/form-data" },
      withCredentials: true,
      onUploadProgress: (evt) => {
        if (typeof onProgress === "function" && evt.total) {
          onProgress({ loaded: evt.loaded, total: evt.total });
        }
      },
    });
    return res.data;
  }, [formData.sku]);

  const handleFileDone = useCallback((result) => {
    const newUrls = result?.image_urls || [];
    if (!newUrls.length) return;
    setFormData((prev) => ({
      ...prev,
      images: [...(prev.images || []), ...newUrls],
    }));
  }, []);

  const handleItemRemove = useCallback((item) => {
    const urls = item?.result?.image_urls || [];
    if (!urls.length) return;
    const drop = new Set(urls);
    setFormData((prev) => ({
      ...prev,
      images: (prev.images || []).filter((u) => !drop.has(u)),
    }));
  }, []);

  const handleCreateProduct = async () => {
    if (!canCreate) {
      toast.error("No tienes permiso para crear productos");
      return;
    }
    skuRef.current?.markSubmitAttempted?.();
    nameRef.current?.markSubmitAttempted?.();
    priceRef.current?.markSubmitAttempted?.();

    if (!formData.sku || !formData.name || !formData.category || !formData.price) {
      toast.error("Completa los campos obligatorios: SKU, Nombre, Categoría, Precio");
      return;
    }

    setIsSubmitting(true);
    try {
      const tier1 = parseFloat(formData.precio1 || formData.price) || 0;
      const tierPayload = buildProductPricePayload(formData, { precio1: tier1 });
      const payload = {
        ...formData,
        ...tierPayload,
        cost: parseFloat(formData.cost) || 0,
        warranty_months: parseInt(formData.warranty_months, 10) || 12,
        installation_price: parseFloat(formData.installation_price) || 0,
        installation_time_minutes: parseInt(formData.installation_time_minutes, 10) || 0,
        low_stock_threshold: Math.max(1, parseInt(formData.low_stock_threshold, 10) || 5),
        initial_stock: Math.max(0, parseInt(formData.initial_stock, 10) || 0),
        initial_warehouse_id: formData.initial_warehouse_id || "",
        provision_all_warehouses: formData.provision_all_warehouses !== false,
        available_store_ids: formData.available_store_ids?.length ? formData.available_store_ids : branches.map(b => b.branch_id),
        source_warehouse_ids: formData.source_warehouse_ids?.length ? formData.source_warehouse_ids : warehouses.map(w => w.warehouse_id),
        barcode: String(formData.barcode || "").trim() || undefined,
        installation_type: formData.installation_type || "optional",
        hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
        compatibility: formData.compatibility.brands.length > 0 ||
          formData.compatibility.models.length > 0 ||
          formData.compatibility.year_from ||
          formData.compatibility.year_to ||
          formData.compatibility.vehicle_types.length > 0 ? {
            ...formData.compatibility,
            year_from: formData.compatibility.year_from ? parseInt(formData.compatibility.year_from, 10) : null,
            year_to: formData.compatibility.year_to ? parseInt(formData.compatibility.year_to, 10) : null,
          } : null,
      };

      const res = await axios.post(`${API}/products`, payload, { withCredentials: true });
      toast.success("Producto creado exitosamente");
      resetForm();
      onOpenChange(false);
      if (typeof onProductCreated === "function") {
        onProductCreated(res.data);
      }
    } catch (error) {
      toast.error(humanApiError(error, "Error al crear producto"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl max-h-[92vh] overflow-hidden p-4 sm:p-6"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="pb-2">
          <DialogTitle>Crear producto</DialogTitle>
          <DialogDescription>Completa la información del producto o servicio</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[72vh] pr-4">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Básico</TabsTrigger>
              <TabsTrigger value="pricing">Precios</TabsTrigger>
              <TabsTrigger value="compatibility">Compatibilidad</TabsTrigger>
              <TabsTrigger value="media">Imágenes</TabsTrigger>
            </TabsList>
            
            {/* Basic Info Tab */}
            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <ValidatedInput
                  ref={skuRef}
                  label="SKU"
                  requiredMark
                  value={formData.sku}
                  onChange={(e) => updateField("sku", e.target.value)}
                  validate={requiredSku}
                  resetKey={validationKey}
                  successLabel={VALIDATION_SUCCESS_SHORT}
                  placeholder="PRD-001"
                  data-testid="product-sku"
                />
                <div>
                  <Label>Código de barras</Label>
                  <Input
                    value={formData.barcode}
                    onChange={(e) => updateField("barcode", e.target.value)}
                    placeholder="EAN / UPC (opcional)"
                    data-testid="product-barcode"
                  />
                </div>
              </div>

              <ValidatedInput
                ref={nameRef}
                label="Nombre"
                requiredMark
                value={formData.name}
                onChange={(e) => updateField("name", e.target.value)}
                validate={requiredProductName}
                resetKey={validationKey}
                successLabel="Se ve bien"
                placeholder="Nombre del producto"
                data-testid="product-name"
              />
              
              <div>
                <Label>Descripción</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="Descripción detallada del producto..."
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Tipo *</Label>
                  <Select 
                    value={formData.product_type} 
                    onValueChange={(v) => updateField("product_type", v)}
                  >
                    <SelectTrigger data-testid="product-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="product">Producto Físico</SelectItem>
                      <SelectItem value="service">Servicio</SelectItem>
                      <SelectItem value="service_hourly">Servicio por Hora</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs">Categoría *</Label>
                    <button
                      type="button"
                      onClick={onOpenNewCategory}
                      className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-0.5"
                    >
                      <Plus className="h-3 w-3" /> Nueva
                    </button>
                  </div>
                  <Select 
                    value={formData.category} 
                    onValueChange={(v) => setFormData((prev) => ({
                      ...prev,
                      category: v,
                      subcategory: "",
                      installation_type: v === "polarizados" ? "required" : prev.installation_type,
                      installation_required: v === "polarizados" ? true : prev.installation_required,
                    }))}
                  >
                    <SelectTrigger data-testid="product-category">
                      <SelectValue placeholder="Seleccionar categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(categories).map(([key, cat]) => (
                        <SelectItem key={key} value={key}>{cat?.name || formatCategoryLabel(key)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Subcategoría</Label>
                  <Select 
                    value={formData.subcategory} 
                    onValueChange={(v) => updateField("subcategory", v)}
                    disabled={!formData.category}
                  >
                    <SelectTrigger data-testid="product-subcategory">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {getSubcategories(formData.category).map(sub => (
                        <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs">Marca</Label>
                  <Input
                    value={formData.brand}
                    onChange={(e) => updateField("brand", e.target.value)}
                    placeholder="Marca del producto"
                  />
                </div>
                <div>
                  <Label className="text-xs">Garantía (meses)</Label>
                  <Input
                    type="number"
                    value={formData.warranty_months}
                    onChange={(e) => updateField("warranty_months", e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Umbral stock bajo</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.low_stock_threshold}
                    onChange={(e) => updateField("low_stock_threshold", e.target.value)}
                    placeholder="5"
                  />
                </div>
              </div>

              {/* Multi-warehouse provisioning section */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-xs text-slate-900 dark:text-slate-100">Disponibilidad de Inventario en Bodegas</div>
                    <div className="text-[11px] text-muted-foreground">Crear producto disponible en todas las bodegas (con stock 0 inicial en las demás)</div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium bg-white dark:bg-slate-800 px-2.5 py-1 rounded-md border shadow-xs">
                    <input
                      type="checkbox"
                      checked={formData.provision_all_warehouses !== false}
                      onChange={(e) => updateField("provision_all_warehouses", e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span>Alta en todas las bodegas</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 border-t border-slate-200 dark:border-slate-800">
                  <div>
                    <Label className="text-xs">Bodega para alta inicial (opcional)</Label>
                    <Select
                      value={formData.initial_warehouse_id}
                      onValueChange={(v) => updateField("initial_warehouse_id", v)}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Seleccionar bodega inicial" />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.map((w) => (
                          <SelectItem key={w.warehouse_id} value={w.warehouse_id}>
                            {w.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Cantidad alta inicial</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.initial_stock}
                      onChange={(e) => updateField("initial_stock", e.target.value)}
                      placeholder="0"
                      className="h-9 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Branches & Source Warehouses matrix */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Tiendas autorizadas */}
                <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-900 dark:text-slate-100">Tiendas de Venta Autorizadas</Label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => updateField("available_store_ids", branches.map(b => b.branch_id))}
                        className="text-[11px] text-primary hover:underline font-semibold"
                      >
                        Todas
                      </button>
                      <span className="text-slate-300 dark:text-slate-700">|</span>
                      <button
                        type="button"
                        onClick={() => updateField("available_store_ids", [])}
                        className="text-[11px] text-muted-foreground hover:underline"
                      >
                        Ninguna
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {branches.map(b => {
                      const selectedStores = formData.available_store_ids || [];
                      const isChecked = selectedStores.length === 0 || selectedStores.includes(b.branch_id);
                      return (
                        <label key={b.branch_id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const base = selectedStores.length === 0 ? branches.map(x => x.branch_id) : selectedStores;
                              const next = e.target.checked
                                ? [...base, b.branch_id]
                                : base.filter(id => id !== b.branch_id);
                              updateField("available_store_ids", next);
                            }}
                            className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <span className="truncate">{b.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Bodegas de origen */}
                <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-900 dark:text-slate-100">Bodegas de Origen / Abastecimiento</Label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => updateField("source_warehouse_ids", warehouses.map(w => w.warehouse_id))}
                        className="text-[11px] text-primary hover:underline font-semibold"
                      >
                        Todas
                      </button>
                      <span className="text-slate-300 dark:text-slate-700">|</span>
                      <button
                        type="button"
                        onClick={() => updateField("source_warehouse_ids", [])}
                        className="text-[11px] text-muted-foreground hover:underline"
                      >
                        Ninguna
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {warehouses.map(w => {
                      const selectedWarehouses = formData.source_warehouse_ids || [];
                      const isChecked = selectedWarehouses.length === 0 || selectedWarehouses.includes(w.warehouse_id);
                      return (
                        <label key={w.warehouse_id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const base = selectedWarehouses.length === 0 ? warehouses.map(x => x.warehouse_id) : selectedWarehouses;
                              const next = e.target.checked
                                ? [...base, w.warehouse_id]
                                : base.filter(id => id !== w.warehouse_id);
                              updateField("source_warehouse_ids", next);
                            }}
                            className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <span className="truncate">{w.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
              
              {formData.category === "polarizados" && (
                <div>
                  <Label>Tipo de Polarizado</Label>
                  <Input
                    value={formData.polarizado_type}
                    onChange={(e) => updateField("polarizado_type", e.target.value)}
                    placeholder="Ej: Premium, Cerámico, Espejo"
                  />
                </div>
              )}
            </TabsContent>
            
            {/* Pricing Tab */}
            <TabsContent value="pricing" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="relative space-y-1">
                  <ValidatedInput
                    ref={priceRef}
                    label="Precio Base"
                    requiredMark
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData((prev) => ({
                      ...prev,
                      price: e.target.value,
                      precio1: e.target.value || prev.precio1
                    }))}
                    validate={requiredPrice}
                    resetKey={validationKey}
                    successLabel={VALIDATION_SUCCESS_SHORT}
                    placeholder="0.00"
                    inputClassName="pl-9"
                    data-testid="product-price"
                  />
                  <DollarSign className="pointer-events-none absolute left-3 top-[2.05rem] h-4 w-4 text-muted-foreground" aria-hidden />
                </div>
                <div>
                  <Label>Costo</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.cost}
                      onChange={(e) => updateField("cost", e.target.value)}
                      placeholder="0.00"
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              {formData.installation_type !== "not_available" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Precio 1</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.precio1}
                      onChange={(e) => updateField("precio1", e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label>Precio 2</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.precio2}
                      onChange={(e) => updateField("precio2", e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label>Precio VIP</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.precio_vip}
                      onChange={(e) => updateField("precio_vip", e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label>Precio Casa Comercial</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.precio_casa_comercial || formData.precio3}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        precio_casa_comercial: e.target.value,
                        precio3: e.target.value,
                      }))}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              )}
              
              {formData.product_type === "service_hourly" && (
                <div>
                  <Label>Tarifa por Hora</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.hourly_rate}
                      onChange={(e) => updateField("hourly_rate", e.target.value)}
                      placeholder="0.00"
                      className="pl-9"
                    />
                  </div>
                </div>
              )}
              
              <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                <div>
                  <Label>Tipo de Instalación</Label>
                  <Select 
                    value={formData.installation_type} 
                    onValueChange={(v) => setFormData((prev) => ({ 
                      ...prev, 
                      installation_type: v,
                      installation_required: v === "required"
                    }))}
                    disabled={formData.category === "polarizados"}
                  >
                    <SelectTrigger data-testid="installation-type-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="required">
                        <span className="flex items-center gap-2">
                          <Wrench className="h-4 w-4 text-green-600" />
                          Requiere Instalación
                        </span>
                      </SelectItem>
                      <SelectItem value="optional">
                        <span className="flex items-center gap-2">
                          <Wrench className="h-4 w-4 text-blue-600" />
                          Instalación Opcional
                        </span>
                      </SelectItem>
                      <SelectItem value="not_available">
                        <span className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-orange-600" />
                          Solo Para Llevar
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formData.category === "polarizados" && "Polarizados se vende únicamente con instalación obligatoria"}
                    {formData.installation_type === "required" && "El producto debe ser instalado obligatoriamente"}
                    {formData.installation_type === "optional" && "El cliente puede elegir si desea instalación"}
                    {formData.installation_type === "not_available" && "Producto solo para llevar. Requiere autorización del gerente para instalar"}
                  </p>
                </div>
                
                {formData.installation_type !== "not_available" && (
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <Label>Precio de Instalación</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.installation_price}
                        onChange={(e) => updateField("installation_price", e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label>Tiempo Estimado (minutos)</Label>
                      <Input
                        type="number"
                        value={formData.installation_time_minutes}
                        onChange={(e) => updateField("installation_time_minutes", e.target.value)}
                        placeholder="60"
                      />
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
            
            {/* Compatibility Tab */}
            <TabsContent value="compatibility" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Car className="h-4 w-4" />
                    Compatibilidad de Vehículos
                  </CardTitle>
                  <CardDescription>Deja vacío para compatibilidad universal</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Marcas Compatibles</Label>
                      <div className="flex gap-2">
                        <Input
                          value={newBrand}
                          onChange={(e) => setNewBrand(e.target.value)}
                          placeholder="Toyota, Nissan..."
                          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCompatibilityBrand())}
                        />
                        <Button type="button" size="sm" onClick={addCompatibilityBrand}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {formData.compatibility.brands.map(brand => (
                          <Badge key={brand} variant="secondary" className="gap-1">
                            {brand}
                            <X className="h-3 w-3 cursor-pointer" onClick={() => setFormData((prev) => ({
                              ...prev,
                              compatibility: {
                                ...prev.compatibility,
                                brands: prev.compatibility.brands.filter(b => b !== brand)
                              }
                            }))} />
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label>Modelos Compatibles</Label>
                      <div className="flex gap-2">
                        <Input
                          value={newModel}
                          onChange={(e) => setNewModel(e.target.value)}
                          placeholder="Hilux, Frontier..."
                          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCompatibilityModel())}
                        />
                        <Button type="button" size="sm" onClick={addCompatibilityModel}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {formData.compatibility.models.map(model => (
                          <Badge key={model} variant="secondary" className="gap-1">
                            {model}
                            <X className="h-3 w-3 cursor-pointer" onClick={() => setFormData((prev) => ({
                              ...prev,
                              compatibility: {
                                ...prev.compatibility,
                                models: prev.compatibility.models.filter(m => m !== model)
                              }
                            }))} />
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Año Desde</Label>
                      <Input
                        type="number"
                        value={formData.compatibility.year_from || ""}
                        onChange={(e) => setFormData((prev) => ({
                          ...prev,
                          compatibility: { ...prev.compatibility, year_from: e.target.value }
                        }))}
                        placeholder="2015"
                      />
                    </div>
                    <div>
                      <Label>Año Hasta</Label>
                      <Input
                        type="number"
                        value={formData.compatibility.year_to || ""}
                        onChange={(e) => setFormData((prev) => ({
                          ...prev,
                          compatibility: { ...prev.compatibility, year_to: e.target.value }
                        }))}
                        placeholder="2024"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label>Tipos de Vehículo</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {vehicleTypes.map(type => (
                        <Badge
                          key={type}
                          variant={formData.compatibility.vehicle_types.includes(type) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => toggleVehicleType(type)}
                        >
                          {type}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Media Tab */}
            <TabsContent value="media" className="space-y-4 mt-4">
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Cargar Imágenes del Producto</Label>
                <p className="text-xs text-muted-foreground">
                  Sube las fotos del producto desde tu equipo (se renombrarán automáticamente como <code className="bg-muted px-1 rounded">{'{SKU}_main'}</code> y <code className="bg-muted px-1 rounded">{'{SKU}_add_XX'}</code>) o añade enlaces directos.
                </p>

                <div className="space-y-3">
                  <FileUploadQueue
                    key={open ? "create-uploads-open" : "create-uploads-closed"}
                    accept="image/*"
                    multiple
                    compact
                    testId="inventory-create-uploads"
                    onUploadFile={handleUploadFile}
                    onFileDone={handleFileDone}
                    onItemRemove={handleItemRemove}
                  />

                  <div className="flex flex-1 gap-2">
                    <Input
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      placeholder="https://ejemplo.com/foto.jpg"
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addImageUrl())}
                    />
                    <Button type="button" variant="outline" onClick={addImageUrl}>
                      <Image className="h-4 w-4 mr-1.5" />
                      Agregar URL
                    </Button>
                  </div>
                </div>
              </div>
              
              {formData.images.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                    <span>Galería de Imágenes ({formData.images.length})</span>
                    <span>La primera imagen es la Principal</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-80 overflow-y-auto p-1 border rounded-lg bg-background/50">
                    {formData.images.map((url, idx) => (
                      <div key={idx} className="relative group rounded-lg overflow-hidden border bg-muted/20 transition hover:shadow-md">
                        <img
                          src={url}
                          alt={`Producto ${idx + 1}`}
                          className="w-full h-28 object-cover"
                          onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=Error'; }}
                        />
                        <div className="absolute top-1.5 left-1.5 flex gap-1">
                          {idx === 0 ? (
                            <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold px-1.5 py-0.5 shadow">
                              ⭐ Principal (main)
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-black/70 text-white text-[10px] font-normal px-1.5 py-0.5 backdrop-blur-sm">
                              Adicional #{idx} (add_{idx < 10 ? '0' + idx : idx})
                            </Badge>
                          )}
                        </div>
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                          {idx !== 0 && (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="h-7 text-xs px-2 shadow bg-white/90 hover:bg-white text-slate-800"
                              title="Hacer imagen principal"
                              onClick={() => setPrimaryImage(url)}
                            >
                              <Star className="h-3.5 w-3.5 mr-1 text-amber-500 fill-amber-500" />
                              Principal
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            className="h-7 w-7 shadow"
                            title="Eliminar imagen"
                            onClick={() => removeProductImage(url)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-6 border border-dashed rounded-lg text-center text-muted-foreground text-xs">
                  No hay imágenes agregadas aún. Selecciona archivos para cargar o ingresa una URL.
                </div>
              )}
            </TabsContent>
          </Tabs>
          
          <div className="flex justify-end gap-2 pt-4 border-t mt-4">
            <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleCreateProduct} data-testid="save-product-btn" disabled={!canCreate || isSubmitting}>
              {isSubmitting ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Guardando...</>
              ) : (
                "Crear producto"
              )}
            </Button>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
