import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
/* table UI not used here */
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import SearchableSelect from "@/components/ui/searchable-select";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import { Plus, Search, RefreshCw, CarFront, User, CalendarDays, Palette, FileText, ShoppingCart, ClipboardList, Pencil, Trash2, Building2 } from "lucide-react";
import { API_BASE as API } from "@/lib/api";
import { getVehicleThumbnail } from "@/lib/vehicleThumbnail";
import {
  getVehicleOptionsByBrandYear,
  getVehicleYearsByBrand,
  isValidVehicleSelection,
  VEHICLE_CATALOG_BRANDS,
  VEHICLE_COLOR_SUGGESTIONS,
} from "@/lib/vehicleCatalog";

export function VehiclesPage() {
  const [vehicles, setVehicles] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchFields, setSearchFields] = useState({ plate: true, vin: true, brand: true, model: true, customer: true });
  const [showFilters, setShowFilters] = useState(false);
  const [showNewVehicle, setShowNewVehicle] = useState(false);
  const [boardTab, setBoardTab] = useState("todos");

  const [formData, setFormData] = useState({
    customer_id: "",
    plate: "",
    vin: "",
    brand: "",
    model: "",
    year: "",
    color: "",
  });

  const navigate = useNavigate();
  const brandOptions = VEHICLE_CATALOG_BRANDS;
  const yearOptions = useMemo(() => getVehicleYearsByBrand(formData.brand), [formData.brand]);
  const modelOptions = useMemo(
    () => getVehicleOptionsByBrandYear(formData.brand, formData.year),
    [formData.brand, formData.year]
  );

  const normalize = (str = '') => {
    return String(str)
      .normalize('NFD') // separate diacritics
      .replace(/\p{Diacritic}/gu, '') // remove diacritics
      .replace(/\s+/g, ' ') // collapse spaces
      .trim()
      .toLowerCase();
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vehiclesRes, customersRes] = await Promise.all([
        axios.get(`${API}/vehicles`, { withCredentials: true }),
        axios.get(`${API}/customers`, { withCredentials: true }),
      ]);
      setVehicles(vehiclesRes.data);
      setCustomers(customersRes.data);
    } catch (error) {
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  };

  const createVehicle = async () => {
    if (!formData.customer_id || !formData.plate || !formData.brand || !formData.year || !formData.model) {
      toast.error("Completa los campos requeridos");
      return;
    }
    if (!isValidVehicleSelection(formData.brand, formData.year, formData.model)) {
      toast.error("Selecciona marca, año y modelo desde la lista");
      return;
    }
    try {
      await axios.post(`${API}/vehicles`, {
        ...formData,
        year: parseInt(formData.year),
      }, { withCredentials: true });
      toast.success("Vehículo registrado");
      setShowNewVehicle(false);
      setFormData({ customer_id: "", plate: "", vin: "", brand: "", model: "", year: "", color: "" });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al registrar");
    }
  };

  const getCustomerName = (customerId) => {
    const customer = customers.find(c => c.customer_id === customerId);
    return customer?.name || "Desconocido";
  };

  const getCustomer = (customerId) => customers.find(c => c.customer_id === customerId) || null;

  const normSearch = normalize(search);
  const filteredVehicles = vehicles.filter(v => {
    if (!normSearch) return true;
    const plate = v.plate ? normalize(v.plate) : '';
    const brand = v.brand ? normalize(v.brand) : '';
    const model = v.model ? normalize(v.model) : '';
    const vin = v.vin ? normalize(v.vin) : '';
    const customerName = normalize(getCustomerName(v.customer_id));
    return (
      (searchFields.plate && plate.includes(normSearch)) ||
      (searchFields.brand && brand.includes(normSearch)) ||
      (searchFields.model && model.includes(normSearch)) ||
      (searchFields.vin && vin.includes(normSearch)) ||
      (searchFields.customer && customerName.includes(normSearch))
    );
  });

  const createSaleFromVehicle = (customer, vehicle) => {
    if (typeof window === 'undefined') return;
    try {
      const DRAFT_LIST_KEY = 'draft_sale_tabs_v1';
      const getDraftKey = (id) => `draft_sale_v1_${id}`;
      const tabs = JSON.parse(window.localStorage.getItem(DRAFT_LIST_KEY) || '[]');
      const id = `sale_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
      const tab = { id, name: `Venta - ${customer.name || ''}`, updatedAt: new Date().toISOString() };
      const updated = Array.isArray(tabs) ? [...tabs, tab] : [tab];
      window.localStorage.setItem(DRAFT_LIST_KEY, JSON.stringify(updated));
      const draft = {
        selectedCustomerId: customer.customer_id,
        selectedVehicle: vehicle.vehicle_id,
        cartItems: [],
        updatedAt: new Date().toISOString(),
        currency: 'NIO',
        applyIVA: true,
        ivaRate: 15,
      };
      window.localStorage.setItem(getDraftKey(id), JSON.stringify(draft));
      window.localStorage.setItem('catalog_open_draft', 'sale');
      toast.success('Borrador creado. Abriendo Ventas...');
      navigate('/sales');
    } catch (e) {
      toast.error('No se pudo abrir la venta');
    }
  };

  const createQuotationFromVehicle = (customer, vehicle) => {
    if (typeof window === 'undefined') return;
    try {
      const DRAFT_LIST_KEY = 'draft_quote_tabs_v1';
      const getDraftKey = (id) => `draft_quote_v1_${id}`;
      const tabs = JSON.parse(window.localStorage.getItem(DRAFT_LIST_KEY) || '[]');
      const id = `quote_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
      const tab = { id, name: `Cotización - ${customer.name || ''}`, updatedAt: new Date().toISOString() };
      const updated = Array.isArray(tabs) ? [...tabs, tab] : [tab];
      window.localStorage.setItem(DRAFT_LIST_KEY, JSON.stringify(updated));
      const draft = {
        selectedCustomerId: customer.customer_id,
        selectedVehicle: vehicle.vehicle_id,
        cartItems: [],
        updatedAt: new Date().toISOString(),
        currency: 'NIO',
        applyIVA: true,
        ivaRate: 15,
      };
      window.localStorage.setItem(getDraftKey(id), JSON.stringify(draft));
      window.localStorage.setItem('catalog_open_draft', 'quote');
      toast.success('Borrador creado. Abriendo Cotizaciones...');
      navigate('/quotations');
    } catch (e) {
      toast.error('No se pudo abrir la cotización');
    }
  };

  return (
    <div className="p-6 space-y-6" data-testid="vehicles-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Vehículos</h1>
          <p className="text-muted-foreground">Registro de vehículos para garantías</p>
        </div>
        <Dialog open={showNewVehicle} onOpenChange={setShowNewVehicle}>
          <DialogTrigger asChild>
            <Button data-testid="new-vehicle-btn">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Vehículo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Registrar Vehículo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Cliente *</Label>
                <Select value={formData.customer_id} onValueChange={(v) => setFormData({ ...formData, customer_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map(c => (
                      <SelectItem key={c.customer_id} value={c.customer_id}>
                        {c.name} - {c.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Placa *</Label>
                  <Input
                    value={formData.plate}
                    onChange={(e) => setFormData({ ...formData, plate: e.target.value.toUpperCase() })}
                    placeholder="ABC-123"
                  />
                </div>
                <div>
                  <Label>VIN</Label>
                  <Input
                    value={formData.vin}
                    onChange={(e) => setFormData({ ...formData, vin: e.target.value.toUpperCase() })}
                    placeholder="Número de chasis"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_0.8fr_1.9fr] gap-4">
                <div>
                  <Label>Marca *</Label>
                  <SearchableSelect
                    value={formData.brand}
                    onChange={(v) => setFormData({ ...formData, brand: v, year: "", model: "" })}
                    options={brandOptions}
                    placeholder="Seleccionar marca"
                    searchPlaceholder="Buscar marca..."
                  />
                </div>
                <div>
                  <Label>Año *</Label>
                  <SearchableSelect
                    value={String(formData.year || "")}
                    onChange={(v) => setFormData({ ...formData, year: v, model: "" })}
                    options={yearOptions}
                    placeholder="Seleccionar año"
                    searchPlaceholder="Buscar año..."
                    disabled={!formData.brand}
                  />
                </div>
                <div>
                  <Label>Modelo *</Label>
                  <SearchableSelect
                    value={formData.model}
                    onChange={(v) => setFormData({ ...formData, model: v })}
                    options={modelOptions}
                    placeholder="Seleccionar modelo"
                    searchPlaceholder="Buscar modelo..."
                    disabled={!formData.brand || !formData.year}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Color</Label>
                  <Input
                    list="vehicle-color-options"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="Blanco"
                  />
                  <datalist id="vehicle-color-options">
                    {VEHICLE_COLOR_SUGGESTIONS.map((color) => (
                      <option key={color} value={color} />
                    ))}
                  </datalist>
                </div>
              </div>
              <Button onClick={createVehicle} className="w-full" data-testid="save-vehicle-btn">
                Registrar Vehículo
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por placa, marca o VIN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="search-vehicles"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(s => !s)}>
            Filtros
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setShowFilters(false); }}>
            Limpiar
          </Button>
        </div>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {showFilters && (
        <div className="p-3 border rounded bg-muted space-y-2 max-w-md">
          <div className="text-sm font-medium">Campos de búsqueda</div>
          <div className="flex gap-2 flex-wrap text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={searchFields.plate} onChange={(e)=> setSearchFields({...searchFields, plate: e.target.checked})} /> Placa</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={searchFields.vin} onChange={(e)=> setSearchFields({...searchFields, vin: e.target.checked})} /> Chasis (VIN)</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={searchFields.brand} onChange={(e)=> setSearchFields({...searchFields, brand: e.target.checked})} /> Marca</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={searchFields.model} onChange={(e)=> setSearchFields({...searchFields, model: e.target.checked})} /> Modelo</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={searchFields.customer} onChange={(e)=> setSearchFields({...searchFields, customer: e.target.checked})} /> Cliente</label>
          </div>
        </div>
      )}

      {/* Board tabs selector (mobile/tablet) */}
      <div className="xl:hidden">
        <Tabs value={boardTab} onValueChange={setBoardTab}>
          <TabsList className="grid h-11 w-full grid-cols-3 rounded-full border bg-card/95 p-1">
            <TabsTrigger value="todos" className="rounded-full text-[12px] leading-tight data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Todos ({filteredVehicles.length})
            </TabsTrigger>
            <TabsTrigger value="con-vin" className="rounded-full text-[12px] leading-tight data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Con VIN ({filteredVehicles.filter(v => v.vin).length})
            </TabsTrigger>
            <TabsTrigger value="sin-vin" className="rounded-full text-[12px] leading-tight data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Sin VIN ({filteredVehicles.filter(v => !v.vin).length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* 3-panel vehicle board */}
      <div className="grid gap-6 xl:grid-cols-3">
        {[
          { key: "todos", label: "TODOS LOS VEHÍCULOS", list: filteredVehicles },
          { key: "con-vin", label: "CON VIN / CHASIS", list: filteredVehicles.filter(v => v.vin) },
          { key: "sin-vin", label: "SIN VIN / CHASIS", list: filteredVehicles.filter(v => !v.vin) },
        ].map(({ key, label, list }) => (
          <Card key={key} className={cn("h-fit", boardTab !== key ? "hidden xl:block" : "")}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label} ({list.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="text-center py-8"><RefreshCw className="h-6 w-6 animate-spin mx-auto" /></div>
              ) : list.length === 0 ? (
                <div className="border border-dashed rounded-xl p-6 text-center text-sm text-muted-foreground">No hay vehículos registrados.</div>
              ) : (
                <div className="grid grid-cols-1 gap-4 ui-fade-in-stagger">
                  {list.map(vehicle => {
                    const customer = getCustomer(vehicle.customer_id);
                    const isCompany = customer?.customer_type === "empresa";
                    const cardTone = isCompany
                      ? "border-sky-200/80 bg-gradient-to-br from-sky-50 via-white to-blue-50"
                      : "border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-cyan-50";
                    const plateTone = isCompany
                      ? "border-sky-200 bg-sky-100 text-sky-800"
                      : "border-emerald-200 bg-emerald-100 text-emerald-800";

              return (
              <Card key={vehicle.vehicle_id} className={`group h-full overflow-hidden shadow-sm ui-panel animate-fade-up-soft ${cardTone}`}>
                <CardHeader className="gap-4 pb-4">
                  <img
                    src={getVehicleThumbnail(vehicle)}
                    alt={`${vehicle.brand || "Vehículo"} ${vehicle.model || ""}`.trim()}
                    className="mb-1 h-32 w-full rounded-md bg-muted/30 object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                  <CardTitle className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <Badge variant="outline" className={`font-mono font-bold text-lg py-1 px-2 ${plateTone}`}>{vehicle.plate}</Badge>
                      <div className="min-w-0 space-y-2">
                        <div className="inline-flex items-center gap-2 font-medium text-base">
                          <CarFront className={`h-4 w-4 shrink-0 icon-spring ${isCompany ? 'text-sky-700' : 'text-emerald-700'}`} />
                          <span className="truncate">{vehicle.brand} {vehicle.model}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5 text-slate-500 icon-spring" />
                            {vehicle.year || '-'}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Palette className="h-3.5 w-3.5 text-slate-500 icon-spring" />
                            {vehicle.color || '-'}
                          </span>
                          <span className="inline-flex min-w-0 items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5 shrink-0 text-slate-500 icon-spring" />
                            <span className="truncate">{vehicle.vin || 'Sin VIN/chasis'}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-1.5 pt-1 text-sm font-medium text-muted-foreground">
                      {isCompany ? (
                        <Building2 className="h-4 w-4 shrink-0 text-sky-600 icon-spring" />
                      ) : (
                        <User className="h-4 w-4 shrink-0 text-emerald-600 icon-spring" />
                      )}
                      <span className="max-w-[180px] truncate">{getCustomerName(vehicle.customer_id)}</span>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex h-full flex-col gap-4">
                  <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/70 px-3.5 py-3 text-sm font-medium text-slate-700">
                    <ClipboardList className={`h-4 w-4 icon-spring ${isCompany ? 'text-sky-700' : 'text-emerald-700'}`} />
                    <span>Acciones rápidas</span>
                  </div>
                  <div className="mt-auto flex flex-wrap items-center gap-2">
                      <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-700 ui-interactive" onClick={() => {
                        const customer = customers.find(c => c.customer_id === vehicle.customer_id) || { name: getCustomerName(vehicle.customer_id), customer_id: vehicle.customer_id };
                        createQuotationFromVehicle(customer, vehicle);
                      }}>
                        <FileText className="mr-2 h-4 w-4" />
                        Crear Cotización
                      </Button>
                      <Button size="sm" className="bg-green-600 text-white hover:bg-green-700 ui-interactive" onClick={() => {
                        const customer = customers.find(c => c.customer_id === vehicle.customer_id) || { name: getCustomerName(vehicle.customer_id), customer_id: vehicle.customer_id };
                        createSaleFromVehicle(customer, vehicle);
                      }}>
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        Crear Venta
                      </Button>
                      <Button size="sm" className="bg-yellow-400 text-black hover:bg-yellow-500 ui-interactive" onClick={async () => {
                        // pedir motivo obligatorio antes de la edición
                        const motivo = prompt('Motivo de la solicitud (obligatorio):', 'Actualizar color');
                        if (motivo === null) return;
                        if (!motivo.trim()) { toast.error('El motivo es obligatorio'); return; }
                        const newColor = prompt('Color', vehicle.color || '');
                        if (newColor === null) return;
                        const changes = { color: newColor };
                        try {
                          await axios.post(`${API}/approvals`, { type: 'edit_vehicle', payload: { vehicle_id: vehicle.vehicle_id, changes }, reason: motivo.trim() }, { withCredentials: true });
                          toast.success('Solicitud de edición enviada');
                        } catch (e) { toast.error(e.response?.data?.detail || 'Error'); }
                      }}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </Button>
                      <Button size="sm" variant="destructive" className="ui-interactive" onClick={async () => {
                        // pedir motivo obligatorio antes de solicitar eliminación
                        const motivo = prompt('Motivo para eliminar (obligatorio):', 'Vehículo duplicado');
                        if (motivo === null) return;
                        if (!motivo.trim()) { toast.error('El motivo es obligatorio'); return; }
                        if (!confirm('Enviar solicitud para eliminar este vehículo?')) return;
                        try {
                          await axios.post(`${API}/approvals`, { type: 'delete_vehicle', payload: { vehicle_id: vehicle.vehicle_id }, reason: motivo.trim() }, { withCredentials: true });
                          toast.success('Solicitud de eliminación enviada');
                        } catch (e) { toast.error(e.response?.data?.detail || 'Error'); }
                      }}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </Button>
                  </div>
                </CardContent>
              </Card>
              );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
