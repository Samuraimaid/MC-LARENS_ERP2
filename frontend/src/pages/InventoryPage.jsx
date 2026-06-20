import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { formatCurrency } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Textarea } from "../components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
// Checkbox imported previously but not used; removed to reduce lint warnings
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { ScrollArea } from "../components/ui/scroll-area";
import { toast } from "sonner";
import { 
  Plus, Search, Package, AlertTriangle, ArrowRightLeft, RefreshCw, 
  Image, Car, Wrench, Clock, DollarSign, X, Edit, Eye, Upload, Download, FileSpreadsheet
} from "lucide-react";
import { API_BASE as API } from "@/lib/api";
import { useAuth } from "../context/AuthContext";

export function InventoryPage() {
  const { hasPermission, user } = useAuth();
  const canViewInventory = hasPermission("inventory", "view");
  const canCreateInventory = hasPermission("inventory", "create");
  const canEditInventory = hasPermission("inventory", "edit");
  const isWarehouseRole = ["bodega", "bodegas"].includes(String(user?.role || "").toLowerCase());
  const [inventory, setInventory] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [categories, setCategories] = useState({});
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showLowStock, setShowLowStock] = useState(false);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showAddStock, setShowAddStock] = useState(false);
  const [showProductDetail, setShowProductDetail] = useState(null);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [waProduct, setWaProduct] = useState(null);
  const [waSearch, setWaSearch] = useState("");
  const [waResults, setWaResults] = useState([]);
  const [waSelectedCustomer, setWaSelectedCustomer] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showImportCSV, setShowImportCSV] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importWarehouse, setImportWarehouse] = useState("");
  const [importInitialStock, setImportInitialStock] = useState(10);
  const [kardexMovements, setKardexMovements] = useState([]);
  const [kardexLoading, setKardexLoading] = useState(false);
  const [kardexProductId, setKardexProductId] = useState("all");
  const [kardexProductSearch, setKardexProductSearch] = useState("");
  const [kardexWarehouseId, setKardexWarehouseId] = useState("all");
  const [kardexReason, setKardexReason] = useState("all");
  const [kardexActorId, setKardexActorId] = useState("all");
  const [kardexUserSearch, setKardexUserSearch] = useState("");
  const [kardexStart, setKardexStart] = useState("");
  const [kardexEnd, setKardexEnd] = useState("");
  const [exportingKardex, setExportingKardex] = useState(false);
  const [warrantyRequests, setWarrantyRequests] = useState([]);
  const [transferRequests, setTransferRequests] = useState([]);
  const [kardexUsers, setKardexUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [showWarrantyDialog, setShowWarrantyDialog] = useState(false);
  const [warrantyForm, setWarrantyForm] = useState({
    product_id: "",
    warehouse_id: "",
    scope: "partial",
    affected_quantity: 1,
    replacement_quantity: 1,
    notes: "",
  });

  // New product form with all fields
  const [newProduct, setNewProduct] = useState({
    sku: "",
    name: "",
    description: "",
    category: "",
    subcategory: "",
    brand: "",
    price: "",
    precio1: "",
    precio2: "",
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
  });

  // Transfer form
  const [transfer, setTransfer] = useState({
    product_id: "",
    from_warehouse: "",
    to_warehouse: "",
    quantity: 1,
  });

  const [addStock, setAddStock] = useState({
    product_id: "",
    warehouse_id: "",
    quantity: 1,
  });

  // Image URL input
  const [newImageUrl, setNewImageUrl] = useState("");

  // Compatibility inputs
  const [newBrand, setNewBrand] = useState("");
  const [newModel, setNewModel] = useState("");

  const fetchData = useCallback(async () => {
    if (!canViewInventory) {
      setInventory([]);
      setProducts([]);
      setWarehouses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedWarehouse !== "all") params.append("warehouse_id", selectedWarehouse);
      if (showLowStock) params.append("low_stock", "true");
      if (selectedCategory !== "all") params.append("category", selectedCategory);

      const [invRes, productsRes, warehousesRes, branchesRes, usersRes] = await Promise.all([
        axios.get(`${API}/inventory?${params}`, { withCredentials: true }),
        axios.get(`${API}/products?${selectedCategory !== 'all' ? `category=${selectedCategory}` : ''}`, { withCredentials: true }),
        axios.get(`${API}/warehouses`, { withCredentials: true }),
        axios.get(`${API}/branches`, { withCredentials: true }).catch(() => ({ data: [] })),
        axios.get(`${API}/auth/pin/users`, { withCredentials: true }).catch(() => ({ data: [] })),
      ]);
      setInventory(invRes.data);
      setProducts(productsRes.data);
      setWarehouses(warehousesRes.data);
      setBranches(Array.isArray(branchesRes.data) ? branchesRes.data : []);
      setKardexUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
    } catch (error) {
      toast.error("Error al cargar inventario");
    } finally {
      setLoading(false);
    }
  }, [selectedWarehouse, showLowStock, selectedCategory, canViewInventory]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/categories`, { withCredentials: true });
      setCategories(res.data.categories);
      setVehicleTypes(res.data.vehicle_types);
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchCategories();
  }, [fetchData, fetchCategories]);

  const fetchKardex = useCallback(async () => {
    if (!canViewInventory) {
      setKardexMovements([]);
      return;
    }

    setKardexLoading(true);
    try {
      const params = new URLSearchParams();
      if (kardexProductId !== "all") params.append("product_id", kardexProductId);
      if (kardexWarehouseId !== "all") params.append("warehouse_id", kardexWarehouseId);
      if (kardexReason !== "all") params.append("reason", kardexReason);
      if (kardexActorId !== "all") params.append("actor_id", kardexActorId);
      if (kardexStart) params.append("start", `${kardexStart}T00:00:00`);
      if (kardexEnd) params.append("end", `${kardexEnd}T23:59:59`);
      params.append("limit", "300");

      const res = await axios.get(`${API}/inventory/movements?${params.toString()}`, {
        withCredentials: true,
      });
      setKardexMovements(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      toast.error("Error al cargar kardex");
    } finally {
      setKardexLoading(false);
    }
  }, [canViewInventory, kardexActorId, kardexEnd, kardexProductId, kardexReason, kardexStart, kardexWarehouseId]);

  const fetchOperationalRequests = useCallback(async () => {
    if (!canViewInventory) {
      setWarrantyRequests([]);
      setTransferRequests([]);
      return;
    }
    try {
      const [warrantyRes, transferRes] = await Promise.all([
        axios.get(`${API}/inventory/warranty-requests`, { withCredentials: true }).catch(() => ({ data: [] })),
        axios.get(`${API}/inventory/transfer-requests`, { withCredentials: true }).catch(() => ({ data: [] })),
      ]);
      setWarrantyRequests(Array.isArray(warrantyRes.data) ? warrantyRes.data : []);
      setTransferRequests(Array.isArray(transferRes.data) ? transferRes.data : []);
    } catch (error) {
      // silent fallback
    }
  }, [canViewInventory]);

  useEffect(() => {
    fetchKardex();
  }, [fetchKardex]);

  useEffect(() => {
    fetchOperationalRequests();
  }, [fetchOperationalRequests]);

  const buildKardexParams = () => {
    const params = new URLSearchParams();
    if (kardexProductId !== "all") params.append("product_id", kardexProductId);
    if (kardexWarehouseId !== "all") params.append("warehouse_id", kardexWarehouseId);
    if (kardexReason !== "all") params.append("reason", kardexReason);
    if (kardexActorId !== "all") params.append("actor_id", kardexActorId);
    if (kardexStart) params.append("start", `${kardexStart}T00:00:00`);
    if (kardexEnd) params.append("end", `${kardexEnd}T23:59:59`);
    return params;
  };

  const exportKardex = async (format) => {
    if (!canViewInventory) {
      toast.error("No tienes permiso para exportar kardex");
      return;
    }
    setExportingKardex(true);
    try {
      const params = buildKardexParams();
      params.append("format", format);
      const response = await axios.get(`${API}/inventory/movements/export?${params.toString()}`, {
        withCredentials: true,
        responseType: "blob",
      });
      const mime = {
        csv: "text/csv",
        excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        pdf: "application/pdf",
      };
      const ext = { csv: "csv", excel: "xlsx", pdf: "pdf" };
      const blob = new Blob([response.data], { type: mime[format] || "application/octet-stream" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `kardex_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${ext[format] || "dat"}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Exportación ${format.toUpperCase()} completada`);
    } catch (error) {
      toast.error("Error al exportar kardex");
    } finally {
      setExportingKardex(false);
    }
  };

  const createWarrantyRequest = async () => {
    if (!canEditInventory) {
      toast.error("No tienes permiso para gestionar garantías");
      return;
    }
    if (!warrantyForm.product_id || !warrantyForm.warehouse_id) {
      toast.error("Selecciona producto y bodega");
      return;
    }
    try {
      await axios.post(`${API}/inventory/warranty-requests`, {
        product_id: warrantyForm.product_id,
        warehouse_id: warrantyForm.warehouse_id,
        scope: warrantyForm.scope,
        affected_quantity: Number(warrantyForm.affected_quantity || 0),
        replacement_quantity: Number(warrantyForm.replacement_quantity || 0),
        notes: warrantyForm.notes,
      }, { withCredentials: true });
      toast.success("Solicitud de garantía creada");
      setShowWarrantyDialog(false);
      setWarrantyForm({
        product_id: "",
        warehouse_id: "",
        scope: "partial",
        affected_quantity: 1,
        replacement_quantity: 1,
        notes: "",
      });
      fetchOperationalRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al crear solicitud de garantía");
    }
  };

  const approveWarrantyRequest = async (requestId) => {
    try {
      await axios.put(`${API}/inventory/warranty-requests/${requestId}/approve`, null, { withCredentials: true });
      toast.success("Solicitud de garantía aprobada");
      fetchOperationalRequests();
      fetchKardex();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al aprobar solicitud");
    }
  };

  const rejectWarrantyRequest = async (requestId) => {
    try {
      await axios.put(`${API}/inventory/warranty-requests/${requestId}/reject`, null, {
        withCredentials: true,
        params: { reason: "Rechazada desde kardex" },
      });
      toast.success("Solicitud de garantía rechazada");
      fetchOperationalRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al rechazar solicitud");
    }
  };

  const approveTransferRequest = async (requestId) => {
    try {
      await axios.put(`${API}/inventory/transfer-requests/${requestId}/approve`, null, { withCredentials: true });
      toast.success("Traslado aprobado");
      fetchOperationalRequests();
      fetchKardex();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al aprobar traslado");
    }
  };

  const rejectTransferRequest = async (requestId) => {
    try {
      await axios.put(`${API}/inventory/transfer-requests/${requestId}/reject`, null, {
        withCredentials: true,
        params: { reason: "Rechazado desde kardex" },
      });
      toast.success("Traslado rechazado");
      fetchOperationalRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al rechazar traslado");
    }
  };

  const resetProductForm = () => {
    setNewProduct({
      sku: "",
      name: "",
      description: "",
      category: "",
      subcategory: "",
      brand: "",
      price: "",
      precio1: "",
      precio2: "",
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
    });
    setNewImageUrl("");
    setNewBrand("");
    setNewModel("");
  };

  const createProduct = async () => {
    if (!canCreateInventory) {
      toast.error("No tienes permiso para crear productos");
      return;
    }
    if (!newProduct.sku || !newProduct.name || !newProduct.category || !newProduct.price) {
      toast.error("Completa los campos obligatorios: SKU, Nombre, Categoría, Precio");
      return;
    }
    try {
      const basePrice = parseFloat(newProduct.price) || 0;
      const tier1 = parseFloat(newProduct.precio1 || newProduct.price) || basePrice;
      const tier2 = parseFloat(newProduct.precio2) || roundTo2(tier1 * 1.05);
      const tier3 = parseFloat(newProduct.precio3) || roundTo2(tier1 * 1.1);
      const payload = {
        ...newProduct,
        price: tier1,
        precio1: tier1,
        precio2: tier2,
        precio3: tier3,
        cost: parseFloat(newProduct.cost) || 0,
        warranty_months: parseInt(newProduct.warranty_months) || 12,
        installation_price: parseFloat(newProduct.installation_price) || 0,
        installation_time_minutes: parseInt(newProduct.installation_time_minutes) || 0,
        low_stock_threshold: Math.max(1, parseInt(newProduct.low_stock_threshold, 10) || 5),
        initial_stock: Math.max(0, parseInt(newProduct.initial_stock, 10) || 0),
        initial_warehouse_id: newProduct.initial_warehouse_id || "",
        installation_type: newProduct.installation_type || "optional",
        hourly_rate: newProduct.hourly_rate ? parseFloat(newProduct.hourly_rate) : null,
        compatibility: newProduct.compatibility.brands.length > 0 || 
                       newProduct.compatibility.vehicle_types.length > 0 ||
                       newProduct.compatibility.year_from
          ? {
              brands: newProduct.compatibility.brands,
              models: newProduct.compatibility.models,
              year_from: newProduct.compatibility.year_from ? parseInt(newProduct.compatibility.year_from) : null,
              year_to: newProduct.compatibility.year_to ? parseInt(newProduct.compatibility.year_to) : null,
              vehicle_types: newProduct.compatibility.vehicle_types
            }
          : null
      };
      await axios.post(`${API}/products`, payload, { withCredentials: true });
      toast.success("Producto creado exitosamente");
      setShowNewProduct(false);
      resetProductForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al crear producto");
    }
  };

  const updateProduct = async () => {
    if (!canEditInventory) {
      toast.error("No tienes permiso para editar productos");
      return;
    }
    if (!editingProduct) return;
    try {
      const tier1 = parseFloat(editingProduct.precio1 || editingProduct.price) || 0;
      const tier2 = parseFloat(editingProduct.precio2) || roundTo2(tier1 * 1.05);
      const tier3 = parseFloat(editingProduct.precio3) || roundTo2(tier1 * 1.1);
      const payload = {
        name: editingProduct.name,
        description: editingProduct.description,
        price: tier1,
        precio1: tier1,
        precio2: tier2,
        precio3: tier3,
        cost: parseFloat(editingProduct.cost) || 0,
        category: editingProduct.category,
        subcategory: editingProduct.subcategory,
        brand: editingProduct.brand,
        product_type: editingProduct.product_type,
        images: editingProduct.images,
        compatibility: editingProduct.compatibility,
        installation_required: editingProduct.installation_required,
        installation_type: editingProduct.installation_type || "optional",
        installation_price: parseFloat(editingProduct.installation_price) || 0,
        installation_time_minutes: parseInt(editingProduct.installation_time_minutes) || 0,
        low_stock_threshold: Math.max(1, parseInt(editingProduct.low_stock_threshold, 10) || 5),
        warranty_months: parseInt(editingProduct.warranty_months) || 12,
        hourly_rate: editingProduct.hourly_rate ? parseFloat(editingProduct.hourly_rate) : null,
      };
      await axios.put(`${API}/products/${editingProduct.product_id}`, payload, { withCredentials: true });
      toast.success("Producto actualizado");
      setEditingProduct(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al actualizar producto");
    }
  };

  const executeTransfer = async () => {
    if (!canEditInventory) {
      toast.error("No tienes permiso para transferir inventario");
      return;
    }
    if (transfer.from_warehouse === transfer.to_warehouse) {
      toast.error("Las bodegas deben ser diferentes");
      return;
    }
    try {
      await axios.post(`${API}/inventory/transfer`, null, {
        params: {
          product_id: transfer.product_id,
          from_warehouse: transfer.from_warehouse,
          to_warehouse: transfer.to_warehouse,
          quantity: transfer.quantity,
        },
        withCredentials: true,
      });
      toast.success("Transferencia realizada");
      setShowTransfer(false);
      setTransfer({ product_id: "", from_warehouse: "", to_warehouse: "", quantity: 1 });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error en transferencia");
    }
  };

  const executeAddStock = async () => {
    if (!canEditInventory) {
      toast.error("No tienes permiso para agregar inventario");
      return;
    }
    if (!addStock.product_id || !addStock.warehouse_id) {
      toast.error("Selecciona producto y bodega");
      return;
    }
    const qty = Math.max(1, parseInt(addStock.quantity, 10) || 0);

    try {
      await axios.post(`${API}/inventory/add-stock`, null, {
        withCredentials: true,
        params: {
          product_id: addStock.product_id,
          warehouse_id: addStock.warehouse_id,
          quantity: qty,
        },
      });
      toast.success("Inventario agregado");
      setShowAddStock(false);
      setAddStock({ product_id: "", warehouse_id: "", quantity: 1 });
      fetchData();
      fetchKardex();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al agregar inventario");
    }
  };

  const roundTo2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

  const addImageUrl = () => {
    if (newImageUrl && !newProduct.images.includes(newImageUrl)) {
      setNewProduct({
        ...newProduct,
        images: [...newProduct.images, newImageUrl]
      });
      setNewImageUrl("");
    }
  };

  const removeImage = (url) => {
    setNewProduct({
      ...newProduct,
      images: newProduct.images.filter(img => img !== url)
    });
  };

  const addCompatibilityBrand = () => {
    if (newBrand && !newProduct.compatibility.brands.includes(newBrand)) {
      setNewProduct({
        ...newProduct,
        compatibility: {
          ...newProduct.compatibility,
          brands: [...newProduct.compatibility.brands, newBrand]
        }
      });
      setNewBrand("");
    }
  };

  const addCompatibilityModel = () => {
    if (newModel && !newProduct.compatibility.models.includes(newModel)) {
      setNewProduct({
        ...newProduct,
        compatibility: {
          ...newProduct.compatibility,
          models: [...newProduct.compatibility.models, newModel]
        }
      });
      setNewModel("");
    }
  };

  const toggleVehicleType = (type) => {
    const current = newProduct.compatibility.vehicle_types;
    const updated = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type];
    setNewProduct({
      ...newProduct,
      compatibility: {
        ...newProduct.compatibility,
        vehicle_types: updated
      }
    });
  };

  // CSV Import functions
  const downloadTemplate = async () => {
    try {
      const response = await axios.get(`${API}/products/import/template`, {
        withCredentials: true,
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'plantilla_productos.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Plantilla descargada");
    } catch (error) {
      console.error("Error downloading template:", error);
      // Fallback: open direct URL
      window.open(`${API}/products/import/template`, '_blank');
      toast.info("Descarga iniciada en nueva pestaña");
    }
  };

  const handleImportCSV = async () => {
    if (!canCreateInventory) {
      toast.error("No tienes permiso para importar productos");
      return;
    }
    if (!importFile) {
      toast.error("Selecciona un archivo CSV");
      return;
    }
    if (!importWarehouse) {
      toast.error("Selecciona una bodega destino");
      return;
    }
    
    setImportLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      
      const response = await axios.post(
        `${API}/products/import/csv?warehouse_id=${importWarehouse}&initial_stock=${importInitialStock}`,
        formData,
        {
          withCredentials: true,
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      );
      
      toast.success(`Importados: ${response.data.imported} productos`);
      if (response.data.errors?.length > 0) {
        toast.warning(`${response.data.errors.length} errores encontrados`);
        console.log("Import errors:", response.data.errors);
      }
      
      setShowImportCSV(false);
      setImportFile(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al importar productos");
    } finally {
      setImportLoading(false);
    }
  };

  const seedDemoProducts = async () => {
    if (!canCreateInventory) {
      toast.error("No tienes permiso para crear productos demo");
      return;
    }
    try {
      const warehouseId = warehouses[0]?.warehouse_id || "wh_main";
      const response = await axios.post(`${API}/products/seed-demo?warehouse_id=${warehouseId}`, null, {
        withCredentials: true
      });
      toast.success(`Creados ${response.data.created} productos de demostración`);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al crear productos demo");
    }
  };

  const filteredInventory = inventory.filter(item => {
    const product = item.product || {};
    return (
      product.name?.toLowerCase().includes(search.toLowerCase()) ||
      product.sku?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const getCategoryName = (key) => categories[key]?.name || key;
  const getSubcategories = (catKey) => categories[catKey]?.subcategories || [];
  const getReasonLabel = (reason) => {
    const map = {
      sale: "Venta",
      manual_update: "Ajuste manual",
      transfer_out: "Transferencia salida",
      transfer_in: "Transferencia entrada",
      transfer_request_out: "Solicitud traslado salida",
      transfer_request_in: "Solicitud traslado entrada",
      warranty_replacement_out: "Garantía reposición salida",
      return_approved_in: "Devolución aprobada",
      sample_dispatch_out: "Muestra entregada",
      sample_dispatch_return: "Muestra devuelta",
      initial_stock_import: "Stock inicial importación",
      initial_stock_seed: "Stock inicial demo",
    };
    return map[reason] || reason || "-";
  };

  const formatDateTime = (value) => {
    if (!value) return "-";
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  };

  const getProductLabelById = (productId) => {
    const product = products.find((p) => p.product_id === productId);
    if (!product) return productId || "-";
    return `${product.name} (${product.sku || "sin-sku"})`;
  };

  const getWarehouseLabelById = (warehouseId) => {
    const warehouse = warehouses.find((w) => w.warehouse_id === warehouseId);
    return warehouse?.name || warehouseId || "-";
  };

  const getBranchLabelById = (branchId) => {
    if (!branchId) return "Sin sucursal";
    const branch = branches.find((item) => item.branch_id === branchId);
    return branch?.name || branchId;
  };

  const getRoleLabel = (role) => {
    if (!role) return "sin_rol";
    const map = {
      gerencia: "Gerencia",
      supervisor: "Supervisor",
      bodegas: "Bodegas",
      recursos_humanos: "Recursos Humanos",
      programador: "Programador",
      tecnico: "Técnico",
      cajero: "Cajero",
    };
    return map[role] || role;
  };

  const kardexUsersFiltered = kardexUsers
    .filter((user) => {
      const term = kardexUserSearch.trim().toLowerCase();
      if (!term) return true;
      const branchName = getBranchLabelById(user.branch_id).toLowerCase();
      return (
        (user.name || "").toLowerCase().includes(term) ||
        (user.role || "").toLowerCase().includes(term) ||
        branchName.includes(term)
      );
    })
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "es", { sensitivity: "base" }));

  const kardexProductsFiltered = products
    .filter((product) => {
      const term = kardexProductSearch.trim().toLowerCase();
      if (!term) return true;
      return (
        (product.name || "").toLowerCase().includes(term) ||
        (product.sku || "").toLowerCase().includes(term)
      );
    })
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "es", { sensitivity: "base" }));

  return (
    <div className="p-6 space-y-6" data-testid="inventory-page">
      {!canViewInventory ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">No tienes permiso para ver inventario.</p>
          </CardContent>
        </Card>
      ) : (
      <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Inventario</h1>
          <p className="text-muted-foreground">Gestión de productos y stock en bodegas</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Import CSV Dialog */}
          {!isWarehouseRole ? (
          <Dialog open={showImportCSV} onOpenChange={setShowImportCSV}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="import-csv-btn" disabled={!canCreateInventory}>
                <Upload className="h-4 w-4 mr-2" />
                Importar CSV
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Importar Productos desde CSV</DialogTitle>
                <DialogDescription>
                  Sube un archivo CSV con los productos a importar
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={downloadTemplate} className="flex-1" data-testid="download-template-btn">
                    <Download className="h-4 w-4 mr-2" />
                    Descargar Plantilla
                  </Button>
                  <Button variant="secondary" onClick={seedDemoProducts} className="flex-1" data-testid="seed-demo-btn" disabled={!canCreateInventory}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Cargar Demo
                  </Button>
                </div>
                
                <div>
                  <Label>Archivo CSV</Label>
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    data-testid="csv-file-input"
                  />
                </div>
                
                <div>
                  <Label>Bodega Destino</Label>
                  <Select value={importWarehouse} onValueChange={setImportWarehouse}>
                    <SelectTrigger data-testid="import-warehouse-select">
                      <SelectValue placeholder="Seleccionar bodega" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map(w => (
                        <SelectItem key={w.warehouse_id} value={w.warehouse_id}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Stock Inicial</Label>
                  <Input
                    type="number"
                    min="0"
                    value={importInitialStock}
                    onChange={(e) => setImportInitialStock(parseInt(e.target.value) || 0)}
                    data-testid="import-stock-input"
                  />
                </div>
                
                <Button 
                  onClick={handleImportCSV} 
                  className="w-full" 
                    disabled={!canCreateInventory || importLoading || !importFile}
                  data-testid="execute-import-btn"
                >
                  {importLoading ? (
                    <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Importando...</>
                  ) : (
                    <><Upload className="h-4 w-4 mr-2" /> Importar Productos</>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          ) : null}

          {!isWarehouseRole ? (
          <Dialog open={showTransfer} onOpenChange={setShowTransfer}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="transfer-btn" disabled={!canEditInventory}>
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                Transferir
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Transferir Inventario</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Producto</Label>
                  <Select value={transfer.product_id} onValueChange={(v) => setTransfer({ ...transfer, product_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar producto" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map(p => (
                        <SelectItem key={p.product_id} value={p.product_id}>
                          {p.name} ({p.sku})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Desde Bodega</Label>
                    <Select value={transfer.from_warehouse} onValueChange={(v) => setTransfer({ ...transfer, from_warehouse: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Origen" />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.map(w => (
                          <SelectItem key={w.warehouse_id} value={w.warehouse_id}>{w.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Hacia Bodega</Label>
                    <Select value={transfer.to_warehouse} onValueChange={(v) => setTransfer({ ...transfer, to_warehouse: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Destino" />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.map(w => (
                          <SelectItem key={w.warehouse_id} value={w.warehouse_id}>{w.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Cantidad</Label>
                  <Input
                    type="number"
                    min="1"
                    value={transfer.quantity}
                    onChange={(e) => setTransfer({ ...transfer, quantity: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <Button onClick={executeTransfer} className="w-full" data-testid="execute-transfer-btn" disabled={!canEditInventory}>
                  Ejecutar Transferencia
                </Button>
              </div>
              </DialogContent>
          </Dialog>
          ) : null}

          <Dialog open={showAddStock} onOpenChange={setShowAddStock}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="add-stock-btn" disabled={!canEditInventory}>
                <Plus className="h-4 w-4 mr-2" />
                Agregar Inventario
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ingreso de Inventario</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Producto</Label>
                  <Select value={addStock.product_id} onValueChange={(v) => setAddStock({ ...addStock, product_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar producto" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.product_id} value={p.product_id}>
                          {p.name} ({p.sku || "sin-sku"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Bodega destino</Label>
                  <Select value={addStock.warehouse_id} onValueChange={(v) => setAddStock({ ...addStock, warehouse_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar bodega" />
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
                  <Label>Cantidad a agregar</Label>
                  <Input
                    type="number"
                    min="1"
                    value={addStock.quantity}
                    onChange={(e) => setAddStock({ ...addStock, quantity: parseInt(e.target.value, 10) || 1 })}
                  />
                </div>

                <Button onClick={executeAddStock} className="w-full" disabled={!canEditInventory}>
                  Confirmar Ingreso
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          {!isWarehouseRole ? (
          <Dialog open={showNewProduct} onOpenChange={(open) => { setShowNewProduct(open); if (!open) resetProductForm(); }}>
            <DialogTrigger asChild>
              <Button data-testid="new-product-btn" disabled={!canCreateInventory}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Producto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
              <DialogHeader>
                <DialogTitle>Nuevo Producto</DialogTitle>
                <DialogDescription>Completa la información del producto o servicio</DialogDescription>
              </DialogHeader>
              <ScrollArea className="h-[70vh] pr-4">
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
                      <div>
                        <Label>SKU *</Label>
                        <Input
                          value={newProduct.sku}
                          onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                          placeholder="PRD-001"
                          data-testid="product-sku"
                        />
                      </div>
                      <div>
                        <Label>Nombre *</Label>
                        <Input
                          value={newProduct.name}
                          onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                          placeholder="Nombre del producto"
                          data-testid="product-name"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label>Descripción</Label>
                      <Textarea
                        value={newProduct.description}
                        onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                        placeholder="Descripción detallada del producto..."
                        rows={3}
                      />
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Tipo *</Label>
                        <Select 
                          value={newProduct.product_type} 
                          onValueChange={(v) => setNewProduct({ ...newProduct, product_type: v })}
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
                        <Label>Categoría *</Label>
                        <Select 
                          value={newProduct.category} 
                          onValueChange={(v) => setNewProduct({
                            ...newProduct,
                            category: v,
                            subcategory: "",
                            installation_type: v === "polarizados" ? "required" : newProduct.installation_type,
                            installation_required: v === "polarizados" ? true : newProduct.installation_required,
                          })}
                        >
                          <SelectTrigger data-testid="product-category">
                            <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(categories).map(([key, cat]) => (
                              <SelectItem key={key} value={key}>{cat.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Subcategoría</Label>
                        <Select 
                          value={newProduct.subcategory} 
                          onValueChange={(v) => setNewProduct({ ...newProduct, subcategory: v })}
                          disabled={!newProduct.category}
                        >
                          <SelectTrigger data-testid="product-subcategory">
                            <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                          <SelectContent>
                            {getSubcategories(newProduct.category).map(sub => (
                              <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <Label>Marca</Label>
                        <Input
                          value={newProduct.brand}
                          onChange={(e) => setNewProduct({ ...newProduct, brand: e.target.value })}
                          placeholder="Marca del producto"
                        />
                      </div>
                      <div>
                        <Label>Garantía (meses)</Label>
                        <Input
                          type="number"
                          value={newProduct.warranty_months}
                          onChange={(e) => setNewProduct({ ...newProduct, warranty_months: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Umbral stock bajo</Label>
                        <Input
                          type="number"
                          min="1"
                          value={newProduct.low_stock_threshold}
                          onChange={(e) => setNewProduct({ ...newProduct, low_stock_threshold: e.target.value })}
                          placeholder="5"
                        />
                      </div>
                      <div>
                        <Label>Alta inicial</Label>
                        <Input
                          type="number"
                          min="0"
                          value={newProduct.initial_stock}
                          onChange={(e) => setNewProduct({ ...newProduct, initial_stock: e.target.value })}
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Bodega para alta inicial</Label>
                      <Select
                        value={newProduct.initial_warehouse_id}
                        onValueChange={(v) => setNewProduct({ ...newProduct, initial_warehouse_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar bodega (opcional)" />
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
                    
                    {newProduct.category === "polarizados" && (
                      <div>
                        <Label>Tipo de Polarizado</Label>
                        <Input
                          value={newProduct.polarizado_type}
                          onChange={(e) => setNewProduct({ ...newProduct, polarizado_type: e.target.value })}
                          placeholder="Ej: Premium, Cerámico, Espejo"
                        />
                      </div>
                    )}
                  </TabsContent>
                  
                  {/* Pricing Tab */}
                  <TabsContent value="pricing" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Precio Base *</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="number"
                            step="0.01"
                            value={newProduct.price}
                            onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value, precio1: e.target.value || newProduct.precio1 })}
                            placeholder="0.00"
                            className="pl-9"
                            data-testid="product-price"
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Costo</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="number"
                            step="0.01"
                            value={newProduct.cost}
                            onChange={(e) => setNewProduct({ ...newProduct, cost: e.target.value })}
                            placeholder="0.00"
                            className="pl-9"
                          />
                        </div>
                      </div>
                    </div>

                    {newProduct.installation_type !== "not_available" && (
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label>Precio 1 (Instalado)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={newProduct.precio1}
                            onChange={(e) => setNewProduct({ ...newProduct, precio1: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <Label>Precio 2 (Instalado)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={newProduct.precio2}
                            onChange={(e) => setNewProduct({ ...newProduct, precio2: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <Label>Precio 3 (Instalado)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={newProduct.precio3}
                            onChange={(e) => setNewProduct({ ...newProduct, precio3: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    )}
                    
                    {newProduct.product_type === "service_hourly" && (
                      <div>
                        <Label>Tarifa por Hora</Label>
                        <div className="relative">
                          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="number"
                            step="0.01"
                            value={newProduct.hourly_rate}
                            onChange={(e) => setNewProduct({ ...newProduct, hourly_rate: e.target.value })}
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
                          value={newProduct.installation_type} 
                          onValueChange={(v) => setNewProduct({ 
                            ...newProduct, 
                            installation_type: v,
                            installation_required: v === "required"
                          })}
                          disabled={newProduct.category === "polarizados"}
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
                          {newProduct.category === "polarizados" && "Polarizados se vende únicamente con instalación obligatoria"}
                          {newProduct.installation_type === "required" && "El producto debe ser instalado obligatoriamente"}
                          {newProduct.installation_type === "optional" && "El cliente puede elegir si desea instalación"}
                          {newProduct.installation_type === "not_available" && "Producto solo para llevar. Requiere autorización del gerente para instalar"}
                        </p>
                      </div>
                      
                      {newProduct.installation_type !== "not_available" && (
                        <div className="grid grid-cols-2 gap-4 mt-4">
                          <div>
                            <Label>Precio de Instalación</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={newProduct.installation_price}
                              onChange={(e) => setNewProduct({ ...newProduct, installation_price: e.target.value })}
                              placeholder="0.00"
                            />
                          </div>
                          <div>
                            <Label>Tiempo Estimado (minutos)</Label>
                            <Input
                              type="number"
                              value={newProduct.installation_time_minutes}
                              onChange={(e) => setNewProduct({ ...newProduct, installation_time_minutes: e.target.value })}
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
                              {newProduct.compatibility.brands.map(brand => (
                                <Badge key={brand} variant="secondary" className="gap-1">
                                  {brand}
                                  <X className="h-3 w-3 cursor-pointer" onClick={() => setNewProduct({
                                    ...newProduct,
                                    compatibility: {
                                      ...newProduct.compatibility,
                                      brands: newProduct.compatibility.brands.filter(b => b !== brand)
                                    }
                                  })} />
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
                              {newProduct.compatibility.models.map(model => (
                                <Badge key={model} variant="secondary" className="gap-1">
                                  {model}
                                  <X className="h-3 w-3 cursor-pointer" onClick={() => setNewProduct({
                                    ...newProduct,
                                    compatibility: {
                                      ...newProduct.compatibility,
                                      models: newProduct.compatibility.models.filter(m => m !== model)
                                    }
                                  })} />
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
                              value={newProduct.compatibility.year_from || ""}
                              onChange={(e) => setNewProduct({
                                ...newProduct,
                                compatibility: { ...newProduct.compatibility, year_from: e.target.value }
                              })}
                              placeholder="2015"
                            />
                          </div>
                          <div>
                            <Label>Año Hasta</Label>
                            <Input
                              type="number"
                              value={newProduct.compatibility.year_to || ""}
                              onChange={(e) => setNewProduct({
                                ...newProduct,
                                compatibility: { ...newProduct.compatibility, year_to: e.target.value }
                              })}
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
                                variant={newProduct.compatibility.vehicle_types.includes(type) ? "default" : "outline"}
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
                    <div>
                      <Label>Imágenes del Producto</Label>
                      <div className="flex gap-2 mt-2">
                        <Input
                          value={newImageUrl}
                          onChange={(e) => setNewImageUrl(e.target.value)}
                          placeholder="https://ejemplo.com/imagen.jpg"
                          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addImageUrl())}
                        />
                        <Button type="button" onClick={addImageUrl}>
                          <Image className="h-4 w-4 mr-2" />
                          Agregar
                        </Button>
                      </div>
                    </div>
                    
                    {newProduct.images.length > 0 && (
                      <div className="grid grid-cols-3 gap-4">
                        {newProduct.images.map((url, idx) => (
                          <div key={idx} className="relative group">
                            <img
                              src={url}
                              alt={`Producto ${idx + 1}`}
                              className="w-full h-32 object-cover rounded-lg border"
                              onError={(e) => e.target.src = 'https://via.placeholder.com/150?text=Error'}
                            />
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition"
                              onClick={() => removeImage(url)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
                
                <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                  <Button variant="outline" onClick={() => { setShowNewProduct(false); resetProductForm(); }}>
                    Cancelar
                  </Button>
                  <Button onClick={createProduct} data-testid="save-product-btn" disabled={!canCreateInventory}>
                    Crear Producto
                  </Button>
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
          ) : null}
        </div>
      </div>

      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="inventory">Inventario</TabsTrigger>
          <TabsTrigger value="kardex">Kardex</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-4 mt-0">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">TOTAL PRODUCTOS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold">{products.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">EN INVENTARIO</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold">{inventory.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">STOCK BAJO</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold text-red-500">
              {inventory.filter(i => i.quantity <= i.min_stock).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">BODEGAS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold">{warehouses.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="search-inventory"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-52" data-testid="filter-category">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las Categorías</SelectItem>
            {Object.entries(categories).map(([key, cat]) => (
              <SelectItem key={key} value={key}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
          <SelectTrigger className="w-48" data-testid="filter-warehouse">
            <SelectValue placeholder="Bodega" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las Bodegas</SelectItem>
            {warehouses.map(w => (
              <SelectItem key={w.warehouse_id} value={w.warehouse_id}>{w.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={showLowStock ? "default" : "outline"}
          onClick={() => setShowLowStock(!showLowStock)}
          data-testid="filter-low-stock"
        >
          <AlertTriangle className="h-4 w-4 mr-2" />
          Stock Bajo
        </Button>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Inventory Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Bodega</TableHead>
                <TableHead className="text-center">Stock</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filteredInventory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No hay inventario para mostrar
                  </TableCell>
                </TableRow>
              ) : (
                filteredInventory.map(item => {
                  const product = item.product || {};
                  const isLow = item.quantity <= item.min_stock;
                  const warehouse = warehouses.find(w => w.warehouse_id === item.warehouse_id);
                  
                  return (
                    <TableRow key={item.inventory_id} data-testid={`inv-row-${item.inventory_id}`}>
                      <TableCell className="font-mono">{product.sku || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {product.images?.[0] && (
                            <img src={product.images[0]} alt="" className="w-8 h-8 rounded object-cover" />
                          )}
                          <span className="font-medium">{product.name || "Desconocido"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline">{getCategoryName(product.category)}</Badge>
                          {product.subcategory && (
                            <span className="text-xs text-muted-foreground">{product.subcategory}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={product.product_type === "service" || product.product_type === "service_hourly" ? "secondary" : "default"}>
                          {product.product_type === "service" ? "Servicio" : 
                           product.product_type === "service_hourly" ? "Por Hora" : "Producto"}
                        </Badge>
                      </TableCell>
                      <TableCell>{warehouse?.name || item.warehouse_id}</TableCell>
                      <TableCell className="text-center">
                        <span className={`font-mono font-bold ${isLow ? "text-red-500" : ""}`}>
                          {item.quantity}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(product.price || 0)}
                      </TableCell>
                      <TableCell>
                        {isLow ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Bajo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-600">OK</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setShowProductDetail(product)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => setEditingProduct(product)}
                            disabled={!canEditInventory}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { setWaProduct(product); setShowWhatsApp(true); setWaSearch(''); setWaResults([]); setWaSelectedCustomer(null); }}
                          >
                            <ArrowRightLeft className="h-4 w-4" title="Enviar por WhatsApp" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </TabsContent>

      <TabsContent value="kardex" className="space-y-4 mt-0">

      <Card>
        <CardHeader>
          <CardTitle>Kardex de Inventario</CardTitle>
          <CardDescription>Trazabilidad de entradas, salidas y ajustes de stock.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Select value={kardexProductId} onValueChange={setKardexProductId}>
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Producto" />
              </SelectTrigger>
              <SelectContent>
                <div className="p-2">
                  <Input
                    value={kardexProductSearch}
                    onChange={(e) => setKardexProductSearch(e.target.value)}
                    placeholder="Buscar producto o SKU"
                  />
                </div>
                <SelectItem value="all">Todos los productos</SelectItem>
                {kardexProductsFiltered.map((p) => (
                  <SelectItem key={p.product_id} value={p.product_id}>
                    {p.name} ({p.sku || "sin-sku"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={kardexWarehouseId} onValueChange={setKardexWarehouseId}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Bodega" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las bodegas</SelectItem>
                {warehouses.map((w) => (
                  <SelectItem key={w.warehouse_id} value={w.warehouse_id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={kardexReason} onValueChange={setKardexReason}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Motivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los motivos</SelectItem>
                <SelectItem value="sale">Venta</SelectItem>
                <SelectItem value="manual_update">Ajuste manual</SelectItem>
                <SelectItem value="transfer_out">Transferencia salida</SelectItem>
                <SelectItem value="transfer_in">Transferencia entrada</SelectItem>
                <SelectItem value="transfer_request_out">Solicitud traslado salida</SelectItem>
                <SelectItem value="transfer_request_in">Solicitud traslado entrada</SelectItem>
                <SelectItem value="return_approved_in">Devolución aprobada</SelectItem>
                <SelectItem value="sample_dispatch_out">Muestra entregada</SelectItem>
                <SelectItem value="sample_dispatch_return">Muestra devuelta</SelectItem>
                <SelectItem value="initial_stock_import">Stock inicial importación</SelectItem>
                <SelectItem value="initial_stock_seed">Stock inicial demo</SelectItem>
              </SelectContent>
            </Select>

            <Select value={kardexActorId} onValueChange={setKardexActorId}>
              <SelectTrigger className="w-80">
                <SelectValue placeholder="Usuario" />
              </SelectTrigger>
              <SelectContent>
                <div className="p-2">
                  <Input
                    value={kardexUserSearch}
                    onChange={(e) => setKardexUserSearch(e.target.value)}
                    placeholder="Buscar usuario, rol o sucursal"
                  />
                </div>
                <SelectItem value="all">Todos los usuarios</SelectItem>
                {kardexUsersFiltered.map((user) => (
                  <SelectItem key={user.user_id} value={user.user_id}>
                    {`${user.name || user.user_id} - ${getRoleLabel(user.role)} - ${getBranchLabelById(user.branch_id)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input type="date" value={kardexStart} onChange={(e) => setKardexStart(e.target.value)} className="w-44" />
            <Input type="date" value={kardexEnd} onChange={(e) => setKardexEnd(e.target.value)} className="w-44" />
            <Button variant="outline" onClick={fetchKardex}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualizar
            </Button>
            <Button variant="outline" onClick={() => exportKardex("csv")} disabled={exportingKardex}>
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button variant="outline" onClick={() => exportKardex("excel")} disabled={exportingKardex}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </Button>
            <Button variant="outline" onClick={() => exportKardex("pdf")} disabled={exportingKardex}>
              <Download className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Dialog open={showWarrantyDialog} onOpenChange={setShowWarrantyDialog}>
              <DialogTrigger asChild>
                <Button disabled={!canEditInventory}>
                  <Plus className="h-4 w-4 mr-2" />
                  Solicitud Garantía
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nueva Solicitud de Garantía</DialogTitle>
                  <DialogDescription>
                    Registra garantías parciales o totales para mantener trazabilidad en kardex.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Producto</Label>
                    <Select
                      value={warrantyForm.product_id}
                      onValueChange={(value) => setWarrantyForm((prev) => ({ ...prev, product_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar producto" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.product_id} value={p.product_id}>
                            {p.name} ({p.sku || "sin-sku"})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Bodega</Label>
                    <Select
                      value={warrantyForm.warehouse_id}
                      onValueChange={(value) => setWarrantyForm((prev) => ({ ...prev, warehouse_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar bodega" />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.map((w) => (
                          <SelectItem key={w.warehouse_id} value={w.warehouse_id}>{w.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label>Alcance</Label>
                      <Select
                        value={warrantyForm.scope}
                        onValueChange={(value) => setWarrantyForm((prev) => ({ ...prev, scope: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="partial">Parcial</SelectItem>
                          <SelectItem value="total">Total</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Cantidad afectada</Label>
                      <Input
                        type="number"
                        min="1"
                        value={warrantyForm.affected_quantity}
                        onChange={(e) => setWarrantyForm((prev) => ({ ...prev, affected_quantity: Number(e.target.value || 1) }))}
                      />
                    </div>
                    <div>
                      <Label>Cantidad reposición</Label>
                      <Input
                        type="number"
                        min="1"
                        value={warrantyForm.replacement_quantity}
                        onChange={(e) => setWarrantyForm((prev) => ({ ...prev, replacement_quantity: Number(e.target.value || 1) }))}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Notas</Label>
                    <Textarea
                      rows={3}
                      value={warrantyForm.notes}
                      onChange={(e) => setWarrantyForm((prev) => ({ ...prev, notes: e.target.value }))}
                      placeholder="Detalle de la garantía"
                    />
                  </div>

                  <Button onClick={createWarrantyRequest} disabled={!canEditInventory} className="w-full">
                    Crear Solicitud
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : null}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Solicitudes de Garantía</CardTitle>
                <CardDescription>Parciales y totales con aprobación/rechazo desde kardex.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-auto">
                  {warrantyRequests.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin solicitudes de garantía</p>
                  ) : (
                    warrantyRequests.slice(0, 20).map((req) => (
                      <div key={req.request_id} className="border rounded-md p-2 text-sm space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{getProductLabelById(req.product_id)}</span>
                          <Badge variant={req.status === "pending" ? "secondary" : req.status === "approved" ? "default" : "destructive"}>
                            {req.status || "-"}
                          </Badge>
                        </div>
                        <div className="text-muted-foreground">
                          {getWarehouseLabelById(req.warehouse_id)} · {req.scope || "partial"} · afectada {req.affected_quantity} · reposición {req.replacement_quantity}
                        </div>
                        <div className="text-xs text-muted-foreground">{formatDateTime(req.created_at)}</div>
                        {req.status === "pending" && canEditInventory && (
                          <div className="flex gap-2 pt-1">
                            <Button size="sm" onClick={() => approveWarrantyRequest(req.request_id)}>Aprobar</Button>
                            <Button size="sm" variant="outline" onClick={() => rejectWarrantyRequest(req.request_id)}>Rechazar</Button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Solicitudes de Traslado</CardTitle>
                <CardDescription>Aprobación/rechazo operativo desde el mismo módulo.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-auto">
                  {transferRequests.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin solicitudes de traslado</p>
                  ) : (
                    transferRequests.slice(0, 20).map((req) => (
                      <div key={req.request_id} className="border rounded-md p-2 text-sm space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{getProductLabelById(req.product_id)}</span>
                          <Badge variant={req.status === "pending" ? "secondary" : req.status === "approved" ? "default" : "destructive"}>
                            {req.status || "-"}
                          </Badge>
                        </div>
                        <div className="text-muted-foreground">
                          {getWarehouseLabelById(req.source_warehouse_id)} → {getWarehouseLabelById(req.target_warehouse_id)} · cant. {req.quantity}
                        </div>
                        <div className="text-xs text-muted-foreground">{formatDateTime(req.created_at)}</div>
                        {req.status === "pending" && canEditInventory && (
                          <div className="flex gap-2 pt-1">
                            <Button size="sm" onClick={() => approveTransferRequest(req.request_id)}>Aprobar</Button>
                            <Button size="sm" variant="outline" onClick={() => rejectTransferRequest(req.request_id)}>Rechazar</Button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Bodega</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead className="text-right">Movimiento</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Referencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kardexLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : kardexMovements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                    Sin movimientos para los filtros seleccionados
                  </TableCell>
                </TableRow>
              ) : (
                kardexMovements.map((movement) => (
                  <TableRow key={movement.movement_id || `${movement.product_id}-${movement.created_at}`}>
                    <TableCell>{movement.created_at ? new Date(movement.created_at).toLocaleString() : "-"}</TableCell>
                    <TableCell>{getProductLabelById(movement.product_id)}</TableCell>
                    <TableCell>{getWarehouseLabelById(movement.warehouse_id)}</TableCell>
                    <TableCell>{getReasonLabel(movement.reason)}</TableCell>
                    <TableCell className="text-right">
                      <span className={`font-mono font-semibold ${Number(movement.quantity_change) >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {Number(movement.quantity_change) >= 0 ? "+" : ""}
                        {movement.quantity_change}
                      </span>
                    </TableCell>
                    <TableCell>{movement.actor_name || movement.actor_id || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{movement.reference_id || "-"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </TabsContent>
      </Tabs>

      {/* Product Detail Dialog */}
      <Dialog open={!!showProductDetail} onOpenChange={() => setShowProductDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{showProductDetail?.name}</DialogTitle>
          </DialogHeader>
          {showProductDetail && (
            <div className="space-y-4">
              {showProductDetail.images?.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {showProductDetail.images.map((img, idx) => (
                    <img key={idx} src={img} alt="" className="h-32 rounded-lg object-cover" />
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">SKU:</span> {showProductDetail.sku}</div>
                <div><span className="text-muted-foreground">Marca:</span> {showProductDetail.brand}</div>
                <div><span className="text-muted-foreground">Categoría:</span> {getCategoryName(showProductDetail.category)}</div>
                <div><span className="text-muted-foreground">Subcategoría:</span> {showProductDetail.subcategory || "-"}</div>
                <div><span className="text-muted-foreground">Precio:</span> {formatCurrency(showProductDetail.price)}</div>
                <div><span className="text-muted-foreground">Costo:</span> {formatCurrency(showProductDetail.cost)}</div>
                <div><span className="text-muted-foreground">Garantía:</span> {showProductDetail.warranty_months} meses</div>
                <div><span className="text-muted-foreground">Tipo:</span> {showProductDetail.product_type}</div>
              </div>
              {showProductDetail.description && (
                <div>
                  <span className="text-muted-foreground text-sm">Descripción:</span>
                  <p className="mt-1">{showProductDetail.description}</p>
                </div>
              )}
              {showProductDetail.compatibility && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Car className="h-4 w-4" /> Compatibilidad
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {showProductDetail.compatibility.brands?.length > 0 && (
                      <div><span className="text-muted-foreground">Marcas:</span> {showProductDetail.compatibility.brands.join(", ")}</div>
                    )}
                    {showProductDetail.compatibility.models?.length > 0 && (
                      <div><span className="text-muted-foreground">Modelos:</span> {showProductDetail.compatibility.models.join(", ")}</div>
                    )}
                    {showProductDetail.compatibility.year_from && (
                      <div><span className="text-muted-foreground">Años:</span> {showProductDetail.compatibility.year_from} - {showProductDetail.compatibility.year_to || "Actual"}</div>
                    )}
                    {showProductDetail.compatibility.vehicle_types?.length > 0 && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Tipos:</span> {showProductDetail.compatibility.vehicle_types.join(", ")}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {showProductDetail.installation_required && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Wrench className="h-4 w-4" /> Instalación
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Precio:</span> {formatCurrency(showProductDetail.installation_price)}</div>
                    <div><span className="text-muted-foreground">Tiempo:</span> {showProductDetail.installation_time_minutes} min</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* WhatsApp send dialog */}
      <Dialog open={showWhatsApp} onOpenChange={() => setShowWhatsApp(false)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Enviar producto por WhatsApp</DialogTitle>
            <DialogDescription>Selecciona el cliente al que deseas enviar la información</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Buscar cliente por nombre, teléfono, placa o VIN</Label>
              <Input value={waSearch} onChange={(e) => setWaSearch(e.target.value)} placeholder="Ej: placa, VIN, nombre o teléfono" />
              <div className="mt-2 flex gap-2">
                <Button onClick={async () => {
                  try {
                    const q = waSearch.trim();
                    if (!q) return;
                    const [custRes, vehRes] = await Promise.all([
                      axios.get(`${API}/customers?search=${encodeURIComponent(q)}`, { withCredentials: true }),
                      axios.get(`${API}/vehicles?search=${encodeURIComponent(q)}`, { withCredentials: true }),
                    ]);
                    const customers = Array.isArray(custRes.data) ? custRes.data : [];
                    const vehicles = Array.isArray(vehRes.data) ? vehRes.data : [];
                    // Map vehicles to their customers if possible
                    const vehMapped = vehicles.map(v => ({
                      type: 'vehicle',
                      id: v.vehicle_id,
                      label: `${v.plate || v.plate_number || 'Sin placa'} • ${v.brand || ''} ${v.model || ''}`,
                      customer_id: v.customer_id,
                      phone: v.phone || null,
                    }));
                    const custMapped = customers.map(c => ({ type: 'customer', id: c.customer_id, label: `${c.name} • ${c.phone || ''}`, phone: c.phone }));
                    setWaResults([...custMapped, ...vehMapped]);
                  } catch (e) {
                    toast.error('Error al buscar clientes/vehículos');
                  }
                }}>Buscar</Button>
                <Button variant="outline" onClick={() => { setWaSearch(''); setWaResults([]); setWaSelectedCustomer(null); }}>Limpiar</Button>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto border rounded p-2">
              {waResults.length === 0 ? (
                <div className="text-muted-foreground">No hay resultados</div>
              ) : waResults.map(r => (
                <div key={r.id} className={`p-2 rounded hover:bg-accent cursor-pointer flex items-center justify-between ${waSelectedCustomer?.id === r.id ? 'bg-accent' : ''}`} onClick={() => setWaSelectedCustomer(r)}>
                  <div>
                    <div className="font-medium">{r.label}</div>
                    <div className="text-xs text-muted-foreground">{r.type === 'vehicle' ? `Vehículo (${r.id})` : `Cliente (${r.id})`}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{r.phone || '-'}</div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowWhatsApp(false)}>Cancelar</Button>
              <Button onClick={() => {
                if (!waSelectedCustomer) { toast.error('Selecciona un cliente'); return; }
                // Build phone
                const raw = (waSelectedCustomer.phone || '').toString().replace(/[^0-9]/g, '');
                let digits = raw;
                if (!digits) { toast.error('No hay teléfono disponible para este cliente'); return; }
                if (digits.length === 8) digits = `505${digits}`;
                const url = `https://wa.me/${digits}?text=${encodeURIComponent(`Hola ${waSelectedCustomer.label.split(' • ')[0] || ''}, le comparto este producto: ${waProduct?.name || ''} (SKU: ${waProduct?.sku || ''}) Precio: ${formatCurrency(waProduct?.price || 0)}.`)}`;
                window.open(url, '_blank');
                setShowWhatsApp(false);
              }}>Enviar por WhatsApp</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Producto</DialogTitle>
          </DialogHeader>
          {editingProduct && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nombre</Label>
                  <Input
                    value={editingProduct.name}
                    onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Marca</Label>
                  <Input
                    value={editingProduct.brand}
                    onChange={(e) => setEditingProduct({ ...editingProduct, brand: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Precio</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingProduct.price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Costo</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingProduct.cost}
                    onChange={(e) => setEditingProduct({ ...editingProduct, cost: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Umbral stock bajo</Label>
                  <Input
                    type="number"
                    min="1"
                    value={editingProduct.low_stock_threshold ?? 5}
                    onChange={(e) => setEditingProduct({ ...editingProduct, low_stock_threshold: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Descripción</Label>
                <Textarea
                  value={editingProduct.description || ""}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingProduct(null)}>
                  Cancelar
                </Button>
                <Button onClick={updateProduct}>
                  Guardar Cambios
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </>
      )}
    </div>
  );
}
