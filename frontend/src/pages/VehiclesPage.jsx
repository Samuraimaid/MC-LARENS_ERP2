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
import SearchableSelect from "@/components/ui/searchable-select";
import { toast } from "sonner";
import { Plus, Search, RefreshCw } from "lucide-react";
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

      {/* Vehicles Cards */}
      <div>
        {loading ? (
          <div className="text-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto" />
          </div>
        ) : filteredVehicles.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No hay vehículos registrados</div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {filteredVehicles.map(vehicle => (
              <Card key={vehicle.vehicle_id}>
                <CardHeader>
                  <img
                    src={getVehicleThumbnail(vehicle)}
                    alt={`${vehicle.brand || "Vehículo"} ${vehicle.model || ""}`.trim()}
                    className="w-full h-32 rounded-md object-cover bg-muted/30 mb-3"
                  />
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="font-mono font-bold text-lg py-1 px-2">{vehicle.plate}</Badge>
                      <div>
                        <div className="font-medium text-base">{vehicle.brand} {vehicle.model}</div>
                        <div className="text-xs text-muted-foreground">{vehicle.year} • {vehicle.color || '-'}{vehicle.vin ? ` • ${vehicle.vin}` : ''}</div>
                      </div>
                    </div>
                    <div className="text-sm font-medium text-muted-foreground">{getCustomerName(vehicle.customer_id)}</div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => {
                        const customer = customers.find(c => c.customer_id === vehicle.customer_id) || { name: getCustomerName(vehicle.customer_id), customer_id: vehicle.customer_id };
                        createQuotationFromVehicle(customer, vehicle);
                      }}>Crear Cotización</Button>
                      <Button size="sm" className="bg-green-600 text-white hover:bg-green-700" onClick={() => {
                        const customer = customers.find(c => c.customer_id === vehicle.customer_id) || { name: getCustomerName(vehicle.customer_id), customer_id: vehicle.customer_id };
                        createSaleFromVehicle(customer, vehicle);
                      }}>Crear Venta</Button>
                      <Button size="sm" className="bg-yellow-400 text-black hover:bg-yellow-500" onClick={async () => {
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
                      }}>Editar</Button>
                      <Button size="sm" variant="destructive" onClick={async () => {
                        // pedir motivo obligatorio antes de solicitar eliminación
                        const motivo = prompt('Motivo para eliminar (obligatorio):', 'Vehículo duplicado');
                        if (motivo === null) return;
                        if (!motivo.trim()) { toast.error('El motivo es obligatorio'); return; }
                        if (!confirm('Enviar solicitud para eliminar este vehículo?')) return;
                        try {
                          await axios.post(`${API}/approvals`, { type: 'delete_vehicle', payload: { vehicle_id: vehicle.vehicle_id }, reason: motivo.trim() }, { withCredentials: true });
                          toast.success('Solicitud de eliminación enviada');
                        } catch (e) { toast.error(e.response?.data?.detail || 'Error'); }
                      }}>Eliminar</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
