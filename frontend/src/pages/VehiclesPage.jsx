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
import { Plus, Search, RefreshCw, CarFront, User, CalendarDays, Palette, FileText, ShoppingCart, ClipboardList, Pencil, Trash2, Building2, Download, Copy } from "lucide-react";
import { API_BASE as API } from "@/lib/api";
import { useListSelection } from "@/hooks/useListSelection";
import { useListScrollRestore } from "@/hooks/useListScrollRestore";
import { ListSelectionBar } from "@/components/lists/ListSelectionBar";
import { downloadCsv, copyTextToClipboard } from "@/components/lists/listBulkUtils";
import {
  getVehicleSelectOptionsByBrandYear,
  getVehicleYearsByBrand,
  getCatalogVehiclePayload,
  isPickupCatalogModel,
  isValidVehicleSelection,
  VEHICLE_CATALOG_BRANDS,
  VEHICLE_COLOR_SUGGESTIONS,
} from "@/lib/vehicleCatalog";
import { VehicleThumbnailWatermark } from "@/components/erp/VehicleThumbnailWatermark";
import { VehicleCabVariantSelect } from "@/components/erp/VehicleCabVariantSelect";
import { useListDensity } from "@/hooks/useListDensity";
import { ListDensityToggle } from "@/components/lists/ListDensityToggle";
import { DensityList, DensityListItem } from "@/components/lists/DensityListItem";
import { PullToRefresh } from "@/components/lists/PullToRefresh";
import { BackToTopButton } from "@/components/lists/BackToTopButton";
import EmptyState from "@/components/common/EmptyState";
import { humanApiError } from "@/lib/humanApiError";

export function VehiclesPage() {
  const { density: listDensity, setDensity: setListDensity, tokens: densityTok } = useListDensity();
  const selection = useListSelection();
  const scrollRestore = useListScrollRestore({ pageKey: "vehicles", searchQuery: undefined });

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
    vehicle_cab_variant: "",
  });

  const navigate = useNavigate();
  const brandOptions = VEHICLE_CATALOG_BRANDS;
  const yearOptions = useMemo(() => getVehicleYearsByBrand(formData.brand), [formData.brand]);
  const modelOptions = useMemo(
    () => getVehicleSelectOptionsByBrandYear(formData.brand, formData.year),
    [formData.brand, formData.year]
  );
  const showCabVariant = useMemo(
    () => isPickupCatalogModel(formData.brand, formData.model),
    [formData.brand, formData.model]
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

  const fetchData = async (opts) => {
    const silent = Boolean(opts && typeof opts === "object" && opts.silent);
    if (!silent) setLoading(true);
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
      if (!silent) setLoading(false);
    }
  };

  const softRefresh = () => fetchData({ silent: true });

  const createVehicle = async () => {
    if (!formData.customer_id || !formData.plate || !formData.brand || !formData.year || !formData.model) {
      toast.error("Completa los campos requeridos");
      return;
    }
    if (!isValidVehicleSelection(formData.brand, formData.year, formData.model)) {
      toast.error("Selecciona marca, año y modelo desde la lista");
      return;
    }
    if (showCabVariant && !formData.vehicle_cab_variant) {
      toast.error("Selecciona el tipo de cabina para esta camioneta");
      return;
    }
    try {
      const catalogVehicle = getCatalogVehiclePayload(formData.brand, formData.model, {
        vehicleCabVariant: formData.vehicle_cab_variant,
      }) || {};
      await axios.post(`${API}/vehicles`, {
        ...formData,
        year: parseInt(formData.year),
        ...catalogVehicle,
      }, { withCredentials: true });
      toast.success("Vehículo registrado");
      setShowNewVehicle(false);
      setFormData({ customer_id: "", plate: "", vin: "", brand: "", model: "", year: "", color: "", vehicle_cab_variant: "" });
      fetchData();
    } catch (error) {
      toast.error(humanApiError(error, "No se pudo registrar el vehículo — revisa placa y datos e inténtalo de nuevo"));
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

  const matchingVehicleIds = filteredVehicles.map((v) => v.vehicle_id);
  const visibleVehicleIds = matchingVehicleIds; // sin paginación: visible = matching
  const selectedVehicles = filteredVehicles.filter((v) => selection.isSelected(v.vehicle_id));

  const exportSelectedVehiclesCsv = () => {
    const rowsSrc = selectedVehicles.length ? selectedVehicles : filteredVehicles;
    if (!rowsSrc.length) {
      toast.error("No hay vehículos para exportar");
      return;
    }
    downloadCsv(
      `vehiculos_${new Date().toISOString().slice(0, 10)}.csv`,
      ["vehicle_id", "placa", "marca", "modelo", "año", "color", "vin", "cliente"],
      rowsSrc.map((v) => [
        v.vehicle_id,
        v.plate,
        v.brand,
        v.model,
        v.year,
        v.color,
        v.vin,
        getCustomerName(v.customer_id),
      ])
    );
    toast.success(`CSV exportado (${rowsSrc.length})`);
  };

  const copySelectedPlates = async () => {
    const rowsSrc = selectedVehicles.length ? selectedVehicles : [];
    if (!rowsSrc.length) {
      toast.error("Selecciona al menos un vehículo");
      return;
    }
    try {
      await copyTextToClipboard(rowsSrc.map((v) => v.plate).filter(Boolean).join(", "));
      toast.success("Placas copiadas");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

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
    <PullToRefresh onRefresh={softRefresh} testId="vehicles-pull-to-refresh">
    <div className="p-6 space-y-6" data-testid="vehicles-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl mb-1 font-bold tracking-tight md:mb-0 md:text-3xl">Vehículos</h1>
          <p className="hidden text-muted-foreground md:block">Registro de vehículos para garantías</p>
        </div>
        <Dialog open={showNewVehicle} onOpenChange={(open) => {
          if (open) scrollRestore.save();
          setShowNewVehicle(open);
          if (!open) scrollRestore.restore();
        }}>
          <DialogTrigger asChild>
            <Button data-testid="new-vehicle-btn">
              <Plus className="h-4 w-4 mr-2" />
              Crear vehículo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear vehículo</DialogTitle>
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
                    onChange={(v) => setFormData({ ...formData, brand: v, year: "", model: "", vehicle_cab_variant: "" })}
                    options={brandOptions}
                    placeholder="Seleccionar marca"
                    searchPlaceholder="Buscar marca..."
                  />
                </div>
                <div>
                  <Label>Año *</Label>
                  <SearchableSelect
                    value={String(formData.year || "")}
                    onChange={(v) => setFormData({ ...formData, year: v, model: "", vehicle_cab_variant: "" })}
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
                    onChange={(v) => setFormData({ ...formData, model: v, vehicle_cab_variant: "" })}
                    options={modelOptions}
                    placeholder="Seleccionar modelo"
                    searchPlaceholder="Buscar modelo..."
                    disabled={!formData.brand || !formData.year}
                  />
                </div>
              </div>
              {showCabVariant && (
                <VehicleCabVariantSelect
                  value={formData.vehicle_cab_variant}
                  onChange={(value) => setFormData({ ...formData, vehicle_cab_variant: value })}
                />
              )}
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
                Crear vehículo
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <ListSelectionBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por placa, marca o VIN..."
        searchTestId="search-vehicles"
        selectedCount={selection.count}
        visibleCount={visibleVehicleIds.length}
        matchingCount={matchingVehicleIds.length}
        allVisibleSelected={selection.allVisibleSelected(visibleVehicleIds)}
        someVisibleSelected={selection.someVisibleSelected(visibleVehicleIds)}
        allMatchingSelected={selection.allVisibleSelected(matchingVehicleIds)}
        onSelectAll={() => selection.toggleAllVisible(visibleVehicleIds)}
        onSelectMatching={() => selection.selectMatching(matchingVehicleIds)}
        onDeselectAll={selection.clear}
        testId="vehicles-selection-bar"
        trailing={
          <div className="flex flex-wrap items-center gap-1.5">
            <Button variant="outline" size="sm" className="h-8" onClick={() => setShowFilters((s) => !s)}>
              Filtros
            </Button>
            <Button variant="ghost" size="sm" className="h-8" onClick={() => { setSearch(""); setShowFilters(false); }}>
              Limpiar
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={fetchData} title="Actualizar">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8"
              disabled={selection.count === 0 && filteredVehicles.length === 0}
              onClick={exportSelectedVehiclesCsv}
              title={selection.count ? "Exportar seleccionados CSV" : "Exportar resultados filtrados CSV"}
            >
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              disabled={selection.count === 0}
              onClick={copySelectedPlates}
            >
              <Copy className="h-4 w-4 mr-1" />
              Copiar placas
            </Button>
          </div>
        }
      />

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

      <div className="flex justify-end">
        <ListDensityToggle value={listDensity} onChange={setListDensity} testId="vehicles-list-density" />
      </div>

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
                <EmptyState
                  icon={CarFront}
                  title={search.trim() ? "Ningún vehículo coincide con la búsqueda" : "Aún no hay vehículos"}
                  description={
                    search.trim()
                      ? "Prueba otra placa, VIN o cliente. Si el vehículo no está, regístralo para garantías y ventas."
                      : "El primer paso es registrar un vehículo con placa, marca y modelo vinculado a un cliente."
                  }
                  actionLabel="Crear vehículo"
                  onAction={() => setShowNewVehicle(true)}
                  testId={`vehicles-empty-${key}`}
                  actionTestId="vehicles-empty-create"
                  className="py-8"
                />
              ) : (
                <DensityList density={listDensity} className="ui-fade-in-stagger" testId={`vehicles-density-list-${key}`}>
                  {list.map(vehicle => {
                    const customer = getCustomer(vehicle.customer_id);
                    const isCompany = customer?.customer_type === "empresa";
                    const plateTone = isCompany
                      ? "border-sky-200 bg-sky-100 text-sky-800"
                      : "border-emerald-200 bg-emerald-100 text-emerald-800";

              return (
              <DensityListItem
                key={vehicle.vehicle_id}
                density={listDensity}
                testId={`vehicle-row-${vehicle.vehicle_id}`}
                selectable
                selected={selection.isSelected(vehicle.vehicle_id)}
                onSelectChange={(_checked, meta) =>
                  selection.toggleWithRange(vehicle.vehicle_id, {
                    shiftKey: !!meta?.shiftKey,
                    orderedIds: matchingVehicleIds,
                  })
                }
                mediaFallback={<CarFront className={`${densityTok.mediaIcon} ${isCompany ? 'text-sky-700' : 'text-emerald-700'} icon-spring`} />}
                primary={
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className={`font-mono font-bold ${plateTone}`}>{vehicle.plate}</Badge>
                    <span className="truncate">{vehicle.brand} {vehicle.model}</span>
                  </span>
                }
                secondary={`${vehicle.year || "-"} · ${vehicle.color || "-"} · ${vehicle.vin || "Sin VIN/chasis"}`}
                meta={
                  <span className="inline-flex items-center gap-1.5">
                    {isCompany ? <Building2 className="h-3.5 w-3.5 text-sky-600" /> : <User className="h-3.5 w-3.5 text-emerald-600" />}
                    <span className="truncate">{getCustomerName(vehicle.customer_id)}</span>
                  </span>
                }
              >
                  <div className="flex flex-wrap items-center gap-2">
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
                        } catch (e) { toast.error(humanApiError(e, "Eso no se pudo completar — inténtalo de nuevo")); }
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
                        } catch (e) { toast.error(humanApiError(e, "Eso no se pudo completar — inténtalo de nuevo")); }
                      }}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </Button>
                  </div>
              </DensityListItem>
              );
                    })}
                </DensityList>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      <BackToTopButton />
    </div>
    </PullToRefresh>
  );
}
