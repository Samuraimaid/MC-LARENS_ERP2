import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { formatCurrency, cn } from "../lib/utils";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent } from "../components/ui/dialog";
import { ContextualDialogHeader } from "../components/ui/contextual-dialog-header";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { DestructiveConfirmDialog } from "@/components/destructive";
import CustomerDialog from "@/components/customers/CustomerDialog";
import { Plus, Search, User, Phone, Car, RefreshCw, Building2, ShieldCheck, Pencil, Trash2, Mail, CalendarDays, CarFront, MapPin, ListFilter, Download, Copy, MessageCircle } from "lucide-react";
import { API_BASE as API } from "@/lib/api";
import { useListSelection } from "@/hooks/useListSelection";
import { useListScrollRestore } from "@/hooks/useListScrollRestore";
import { ListSelectionBar } from "@/components/lists/ListSelectionBar";
import { downloadCsv, copyTextToClipboard, openWhatsAppLinks } from "@/components/lists/listBulkUtils";
import { PRICING_PROFILES } from "@/lib/priceTiers";
import { useListDensity } from "@/hooks/useListDensity";
import { ListDensityToggle } from "@/components/lists/ListDensityToggle";
import { DensityList, DensityListItem } from "@/components/lists/DensityListItem";
import { PullToRefresh } from "@/components/lists/PullToRefresh";
import EmptyState from "@/components/common/EmptyState";
import { humanApiError } from "@/lib/humanApiError";
import { BackToTopButton } from "@/components/lists/BackToTopButton";

export function CustomersPage() {
  const { density: listDensity, setDensity: setListDensity, tokens: densityTok } = useListDensity();
  const selection = useListSelection();
  const scrollRestore = useListScrollRestore({ pageKey: "customers" });

  const { user, hasPermission } = useAuth();
  const normalizedUserRole = String(user?.role || "").toLowerCase();
  const canManageCreditLimit = ["gerencia", "recursos_humanos", "admin"].includes(normalizedUserRole);
  const canManagePricingProfile = ["gerencia", "supervisor"].includes(normalizedUserRole);
  const canViewCustomers = hasPermission("customers", "view");
  const canCreateCustomers = hasPermission("customers", "create");
  const canEditCustomers = hasPermission("customers", "edit");
  const canDeleteCustomers = hasPermission("customers", "delete");
  const canCreateSales = hasPermission("sales", "create");
  const canCreateQuotations = hasPermission("quotations", "create");
  const [pendingDeleteCustomer, setPendingDeleteCustomer] = useState(null);
  const [deleteCustomerBusy, setDeleteCustomerBusy] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [customerTypeFilter, setCustomerTypeFilter] = useState("all");
  const [boardTab, setBoardTab] = useState("todos");

  // Customer Dialog (Create & Edit)
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);

  // Customer Vehicles modal & actions
  const [allVehicles, setAllVehicles] = useState([]);
  const [showVehiclesModal, setShowVehiclesModal] = useState(false);
  const [modalVehicles, setModalVehicles] = useState([]);
  const [modalCustomer, setModalCustomer] = useState(null);
  const [showVehicleActionModal, setShowVehicleActionModal] = useState(false);
  const [actionVehicle, setActionVehicle] = useState(null);
  const [actionCustomer, setActionCustomer] = useState(null);

  useEffect(() => {
    fetchCustomers();
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      const res = await axios.get(`${API}/vehicles`, { withCredentials: true });
      setAllVehicles(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      // ignore; vehicles may be empty
    }
  };

  const fetchCustomers = async (opts) => {
    const silent = Boolean(opts && typeof opts === "object" && opts.silent);
    if (!silent) setLoading(true);
    try {
      const response = await axios.get(`${API}/customers`, { withCredentials: true });
      setCustomers(response.data);
    } catch (error) {
      toast.error("Error al cargar clientes");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const softRefresh = () => fetchCustomers({ silent: true });



  const normalize = (str = '') => {
    return String(str)
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  };

  const formatShortDate = (iso) => {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '-';
      return d.toLocaleDateString();
    } catch (e) {
      return '-';
    }
  };

  const contactWhatsApp = (customer) => {
    // contactWhatsApp now accepts optional message as second arg
    const raw = (customer.phone || '').trim();
    let digits = raw.replace(/[^0-9]/g, '');
    if (!digits) { toast.error('Teléfono no disponible'); return; }
    // If local 8-digit number, assume Nicaragua +505
    if (digits.length === 8) digits = `505${digits}`;
    // If starts with a leading 0 (e.g., 0XXXXXXXX), strip it and assume local
    if (digits.length === 9 && digits.startsWith('0')) digits = `505${digits.slice(1)}`;
    // If still short, fallback to provided digits
    const displayPhone = `+${digits}`;
    const confirmMsg = `Abrir WhatsApp para ${customer.name || ''} (${displayPhone})?`;
    if (!confirm(confirmMsg)) return;
    let message = '';
    // if caller passed a prebuilt message in customer._wa_message use it
    if (customer._wa_message) message = customer._wa_message;
    if (!message) message = `Hola ${customer.name || ''}, le escribo desde McLarenS Autoparts. ¿En qué puedo ayudarle hoy?`;
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // WhatsApp templates (editable)
  const [waTemplates, setWaTemplates] = React.useState([
    { id: 'followup', label: 'Seguimiento', text: 'Hola {name}, le escribo para dar seguimiento a su solicitud anterior. ¿Necesita ayuda adicional?' },
    { id: 'promo', label: 'Recordatorio promoción', text: 'Hola {name}, tenemos una promoción especial esta semana en repuestos y accesorios. ¿Le interesa recibir detalles?' },
    { id: 'unavailable', label: 'Artículos no disponibles', text: 'Hola {name}, durante su visita no estaban disponibles estos artículos: {items}. ¿Desea que le avisemos cuando lleguen?' },
    { id: 'new-arrivals', label: 'Artículos recién llegados', text: 'Hola {name}, acaban de llegar nuevos artículos que podrían interesarle. ¿Desea que le comparta las novedades?' },
    { id: 'custom', label: 'Otro (personalizar)', text: '' }
  ]);

  const [waTemplateByCustomer, setWaTemplateByCustomer] = React.useState({});
  const [waCustomByCustomer, setWaCustomByCustomer] = React.useState({});
  const [showWaPreview, setShowWaPreview] = React.useState(false);
  const [waPreviewMessage, setWaPreviewMessage] = React.useState('');
  const [waPreviewCustomer, setWaPreviewCustomer] = React.useState(null);
  const [showManageTemplates, setShowManageTemplates] = React.useState(false);

  const getTemplateForCustomer = (customerId) => waTemplateByCustomer[customerId] || 'followup';

  const setTemplateForCustomer = (customerId, tplId) => {
    setWaTemplateByCustomer(prev => ({ ...prev, [customerId]: tplId }));
  };

  const editCustomMessageForCustomer = (customerId) => {
    const current = waCustomByCustomer[customerId] || '';
    const val = prompt('Mensaje personalizado para WhatsApp:', current);
    if (val === null) return;
    setWaCustomByCustomer(prev => ({ ...prev, [customerId]: val }));
  };

  const sendWhatsAppWithTemplate = (customer) => {
    const tplId = getTemplateForCustomer(customer.customer_id);
    const tpl = waTemplates.find(t => t.id === tplId) || waTemplates[0];
    let text = '';
    if (tpl.id === 'custom') {
      text = waCustomByCustomer[customer.customer_id] || `Hola ${customer.name || ''}, le escribo desde McLarenS Autoparts.`;
    } else {
      text = tpl.text.replace('{name}', customer.name || '').replace('{items}', '');
    }
    // open preview modal
    setWaPreviewMessage(text);
    setWaPreviewCustomer(customer);
    setShowWaPreview(true);
  };

  const sendVehicleFollowup = (customer, vehicle) => {
    const tplId = getTemplateForCustomer(customer.customer_id);
    const tpl = waTemplates.find(t => t.id === tplId) || waTemplates[0];
    const vehicleLabel = [vehicle.plate, vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(' • ');
    const vehicleContext = vehicle.vin ? `${vehicleLabel}\nVIN/Chasis: ${vehicle.vin}` : vehicleLabel;
    let text = '';
    if (tpl.id === 'custom') {
      text = waCustomByCustomer[customer.customer_id] || `Hola ${customer.name || ''}, le escribo desde McLarenS Autoparts para dar seguimiento a su vehículo.`;
    } else {
      text = tpl.text.replace('{name}', customer.name || '').replace('{items}', '');
    }
    setWaPreviewMessage(`${text}\n\nVehículo relacionado:\n${vehicleContext}`.trim());
    setWaPreviewCustomer(customer);
    setShowVehiclesModal(false);
    setShowWaPreview(true);
  };

  // Manage templates helpers
  const addTemplate = () => {
    const id = `tpl_${Date.now()}`;
    setWaTemplates(prev => [...prev, { id, label: 'Nueva plantilla', text: '' }]);
  };
  const updateTemplate = (id, changes) => {
    setWaTemplates(prev => prev.map(t => t.id === id ? { ...t, ...changes } : t));
  };
  const deleteTemplate = (id) => {
    setWaTemplates(prev => prev.filter(t => t.id !== id));
  };

  const openEditCustomer = (customer) => {
    if (!canEditCustomers) {
      toast.error("No tienes permiso para editar clientes");
      return;
    }
    scrollRestore.save();
    setEditingCustomer(customer);
    setShowCustomerDialog(true);
  };

  const normSearch = normalize(search);
  const filteredCustomers = customers.filter(c => {
    const customerType = c.customer_type === "empresa" ? "empresa" : "natural";
    if (customerTypeFilter !== "all" && customerType !== customerTypeFilter) return false;
    if (!normSearch) return true;
    const name = normalize(c.name || '');
    const phone = normalize(c.phone || '');
    const email = normalize(c.email || '');
    const tax = normalize(c.tax_id || '');
    return (
      name.includes(normSearch) ||
      phone.includes(normSearch) ||
      email.includes(normSearch) ||
      tax.includes(normSearch)
    );
  });

  const matchingCustomerIds = filteredCustomers.map((c) => c.customer_id);
  const visibleCustomerIds = matchingCustomerIds; // sin paginación: visible = matching
  const selectedCustomers = filteredCustomers.filter((c) => selection.isSelected(c.customer_id));

  const exportSelectedCustomersCsv = () => {
    const rowsSrc = selectedCustomers.length ? selectedCustomers : filteredCustomers;
    if (!rowsSrc.length) {
      toast.error("No hay clientes para exportar");
      return;
    }
    downloadCsv(
      `clientes_${new Date().toISOString().slice(0, 10)}.csv`,
      ["customer_id", "nombre", "tipo", "telefono", "email", "cedula_ruc", "direccion"],
      rowsSrc.map((c) => [
        c.customer_id,
        c.name,
        c.customer_type === "empresa" ? "empresa" : "natural",
        c.phone,
        c.email,
        c.tax_id,
        c.address,
      ])
    );
    toast.success(`CSV exportado (${rowsSrc.length})`);
  };

  const copySelectedPhones = async () => {
    if (!selectedCustomers.length) {
      toast.error("Selecciona al menos un cliente");
      return;
    }
    const phones = selectedCustomers.map((c) => c.phone).filter(Boolean);
    if (!phones.length) {
      toast.error("Los seleccionados no tienen teléfono");
      return;
    }
    try {
      await copyTextToClipboard(phones.join(", "));
      toast.success("Teléfonos copiados");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const bulkWhatsAppSelected = () => {
    if (!selectedCustomers.length) {
      toast.error("Selecciona al menos un cliente");
      return;
    }
    const withPhone = selectedCustomers.filter((c) => c.phone);
    if (!withPhone.length) {
      toast.error("Ningún seleccionado tiene teléfono");
      return;
    }
    const entries = withPhone.map((customer) => {
      const tplId = getTemplateForCustomer(customer.customer_id);
      const tpl = waTemplates.find((t) => t.id === tplId) || waTemplates[0];
      let text = "";
      if (tpl.id === "custom") {
        text = waCustomByCustomer[customer.customer_id] || `Hola ${customer.name || ""}, le escribo desde McLarenS Autoparts.`;
      } else {
        text = tpl.text.replace("{name}", customer.name || "").replace("{items}", "");
      }
      return { phone: customer.phone, text };
    });
    const n = openWhatsAppLinks(entries, { maxOpen: 5 });
    toast.success(`Abriendo WhatsApp (${n}${withPhone.length > 5 ? ` de ${withPhone.length}` : ""})`);
    if (withPhone.length > 5) {
      toast.message("Se abrieron máximo 5 chats; el resto queda seleccionado.");
    }
  };

  // map vehicles by customer
  const vehiclesByCustomer = allVehicles.reduce((acc, v) => {
    const cid = v.customer_id || 'unknown';
    acc[cid] = acc[cid] || [];
    acc[cid].push(v);
    return acc;
  }, {});

  const navigate = useNavigate();

  const openVehicleActions = (vehicle, customer) => {
    if (!(canCreateSales || canCreateQuotations || canEditCustomers || canDeleteCustomers)) {
      toast.error("No tienes acciones disponibles para este vehículo");
      return;
    }
    setActionVehicle(vehicle);
    setActionCustomer(customer);
    setShowVehicleActionModal(true);
  };

  const openCustomerVehiclesModal = (customer) => {
    scrollRestore.save();
    const list = vehiclesByCustomer[customer.customer_id] || [];
    setModalCustomer(customer);
    setModalVehicles(list);
    setShowVehiclesModal(true);
  };

  const createSaleFromVehicle = (customer, vehicle) => {
    if (!canCreateSales) {
      toast.error("No tienes permiso para crear ventas");
      return;
    }
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
      setShowVehicleActionModal(false);
      toast.success('Borrador creado. Abriendo Ventas...');
      navigate('/sales');
    } catch (e) {
      toast.error('No se pudo abrir la venta');
    }
  };

  const createQuotationFromVehicle = (customer, vehicle) => {
    if (!canCreateQuotations) {
      toast.error("No tienes permiso para crear cotizaciones");
      return;
    }
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
      setShowVehicleActionModal(false);
      toast.success('Borrador creado. Abriendo Cotizaciones...');
      navigate('/quotations');
    } catch (e) {
      toast.error('No se pudo abrir la cotización');
    }
  };


  const confirmDeleteCustomer = async ({ reason } = {}) => {
    const customer = pendingDeleteCustomer;
    if (!customer) return;
    const motivo = String(reason || "").trim();
    if (!motivo) {
      toast.error("El motivo es obligatorio");
      return;
    }
    setDeleteCustomerBusy(true);
    try {
      await axios.post(
        `${API}/approvals`,
        { type: "delete_customer", payload: { customer_id: customer.customer_id }, reason: motivo },
        { withCredentials: true },
      );
      toast.success("Solicitud de eliminación enviada");
      setPendingDeleteCustomer(null);
    } catch (e) {
      toast.error(humanApiError(e, "No se pudo solicitar la eliminación — inténtalo de nuevo"));
    } finally {
      setDeleteCustomerBusy(false);
    }
  };

  return (
    <PullToRefresh onRefresh={softRefresh} testId="customers-pull-to-refresh">
    <div className="p-6 space-y-6" data-testid="customers-page">
      {!canViewCustomers ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">No tienes permiso para ver clientes.</p>
          </CardContent>
        </Card>
      ) : (
      <>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl mb-1 font-bold tracking-tight md:mb-0 md:text-3xl">Clientes</h1>
          <p className="hidden text-sm text-muted-foreground md:block md:text-base">Gestión de clientes y créditos</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-nowrap sm:justify-end">
          <Button variant="outline" onClick={fetchCustomers} className="col-span-2 h-9 px-3 sm:col-auto sm:px-4">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            data-testid="new-customer-btn"
            disabled={!canCreateCustomers}
            onClick={() => {
              scrollRestore.save();
              setEditingCustomer(null);
              setShowCustomerDialog(true);
            }}
            className="h-9 w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Crear cliente
          </Button>
          <CustomerDialog
            open={showCustomerDialog}
            onOpenChange={(open) => {
              setShowCustomerDialog(open);
              if (!open) {
                setEditingCustomer(null);
                scrollRestore.restore();
              }
            }}
            customer={editingCustomer}
            onCustomerSaved={() => fetchCustomers({ silent: true })}
            canCreate={canCreateCustomers}
            canEdit={canEditCustomers}
            canDelete={canDeleteCustomers}
            canManageCreditLimit={canManageCreditLimit}
            canManagePricingProfile={canManagePricingProfile}
          />
          <Button variant="outline" onClick={() => setShowManageTemplates(true)} className="h-9 w-full sm:w-auto">
            <span className="sm:hidden">Plantillas</span>
            <span className="hidden sm:inline">Plantillas WA</span>
          </Button>
          <Dialog open={showManageTemplates} onOpenChange={setShowManageTemplates}>
            <DialogContent className="max-w-2xl">
              <ContextualDialogHeader
                variant="information"
                size="inline"
                title="Administrar Plantillas WhatsApp"
                description="Editar, agregar o eliminar plantillas disponibles."
              />
              <div className="space-y-3">
                {waTemplates.map(t => (
                  <div key={t.id} className="p-2 border rounded">
                    <div className="flex items-center gap-2">
                      <Input value={t.label} onChange={(e) => updateTemplate(t.id, { label: e.target.value })} />
                      <Button variant="destructive" onClick={() => deleteTemplate(t.id)}>Eliminar</Button>
                    </div>
                    <div className="mt-2">
                      <Label>Texto (use {`{name}`} y {`{items}`} como variables)</Label>
                      <textarea className="w-full h-24 p-2 border rounded" value={t.text} onChange={(e) => updateTemplate(t.id, { text: e.target.value })} />
                    </div>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button onClick={addTemplate}>Agregar plantilla</Button>
                  <Button variant="ghost" onClick={() => setShowManageTemplates(false)}>Cerrar</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <ListSelectionBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Nombre, teléfono, email o cédula"
        searchTestId="search-customers"
        selectedCount={selection.count}
        visibleCount={visibleCustomerIds.length}
        matchingCount={matchingCustomerIds.length}
        allVisibleSelected={selection.allVisibleSelected(visibleCustomerIds)}
        someVisibleSelected={selection.someVisibleSelected(visibleCustomerIds)}
        allMatchingSelected={selection.allVisibleSelected(matchingCustomerIds)}
        onSelectAll={() => selection.toggleAllVisible(visibleCustomerIds)}
        onSelectMatching={() => selection.selectMatching(matchingCustomerIds)}
        onDeselectAll={selection.clear}
        testId="customers-selection-bar"
      >
        {user?.role !== "bodegas" && (
          <Button type="button" size="sm" className="h-8 bg-green-600 hover:bg-green-700 text-white" disabled={selection.count === 0} onClick={bulkWhatsAppSelected}>
            <MessageCircle className="h-4 w-4 mr-1" />
            WhatsApp lote
          </Button>
        )}
        <Button type="button" variant="secondary" size="sm" className="h-8" onClick={exportSelectedCustomersCsv}>
          <Download className="h-4 w-4 mr-1" />
          CSV
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8" disabled={selection.count === 0} onClick={copySelectedPhones}>
          <Copy className="h-4 w-4 mr-1" />
          Copiar teléfonos
        </Button>
      </ListSelectionBar>

      <Card>
        <CardHeader>
          <CardTitle>Filtros rápidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <div className="flex w-full min-w-[300px] items-center gap-2 sm:w-auto sm:min-w-[320px]">
              <Label className="inline-flex w-32 shrink-0 items-center gap-1 text-sm text-muted-foreground">
                <ListFilter className="h-3.5 w-3.5" />
                Tipo de cliente
              </Label>
              <Select value={customerTypeFilter} onValueChange={setCustomerTypeFilter}>
                <SelectTrigger className="min-w-0 flex-1 sm:w-52 sm:flex-none">
                  <div className="flex min-w-0 items-center gap-2">
                    {customerTypeFilter === "empresa" ? (
                      <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate">
                      {customerTypeFilter === "all"
                        ? "Todos los clientes"
                        : customerTypeFilter === "natural"
                          ? "Persona natural"
                          : "Empresa"}
                    </span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los clientes</SelectItem>
                  <SelectItem value="natural">Persona natural</SelectItem>
                  <SelectItem value="empresa">Empresa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <ListDensityToggle value={listDensity} onChange={setListDensity} testId="customers-list-density" />
      </div>

      {/* Board tabs selector (mobile/tablet) */}
      <div className="xl:hidden">
        <Tabs value={boardTab} onValueChange={setBoardTab}>
          <TabsList className="grid h-11 w-full grid-cols-3 rounded-full border bg-card/95 p-1">
            <TabsTrigger value="todos" className="rounded-full text-[12px] leading-tight data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Todos ({filteredCustomers.length})
            </TabsTrigger>
            <TabsTrigger value="personas" className="rounded-full text-[12px] leading-tight data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Personas ({filteredCustomers.filter(c => c.customer_type !== "empresa").length})
            </TabsTrigger>
            <TabsTrigger value="empresas" className="rounded-full text-[12px] leading-tight data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Empresas ({filteredCustomers.filter(c => c.customer_type === "empresa").length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* 3-panel customer board */}
      <div className="grid gap-6 xl:grid-cols-3">
        {[
          { key: "todos", label: "TODOS LOS CLIENTES", list: filteredCustomers },
          { key: "personas", label: "PERSONA NATURAL", list: filteredCustomers.filter(c => c.customer_type !== "empresa") },
          { key: "empresas", label: "EMPRESAS", list: filteredCustomers.filter(c => c.customer_type === "empresa") },
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
                  icon={User}
                  title={search.trim() ? "Ningún cliente coincide con la búsqueda" : "Aún no hay clientes"}
                  description={
                    search.trim()
                      ? "Prueba otro nombre, teléfono o cédula. Si es un cliente nuevo, regístralo para venderle."
                      : "El primer paso es registrar un cliente con nombre y teléfono. Luego podrás asociar vehículos y crear ventas."
                  }
                  actionLabel={canCreateCustomers ? "Crear cliente" : undefined}
                  onAction={canCreateCustomers ? () => setShowNewCustomer(true) : undefined}
                  testId={`customers-empty-${key}`}
                  actionTestId="customers-empty-create"
                  className="py-8"
                />
              ) : (
                <DensityList density={listDensity} className="ui-fade-in-stagger" testId={`customers-density-list-${key}`}>
                  {list.map(customer => {
                    const isCompany = customer.customer_type === "empresa";
                    const customerVehiclesCount = (vehiclesByCustomer[customer.customer_id] || []).length;
              const badgeTone = isCompany
                ? "border-sky-200 bg-sky-100 text-sky-800"
                : "border-emerald-200 bg-emerald-100 text-emerald-800";
              const vehiclesCountTone = customerVehiclesCount === 0
                ? "bg-slate-100 text-slate-700"
                : isCompany
                  ? "bg-sky-100 text-sky-800"
                  : "bg-emerald-100 text-emerald-800";

              return (
              <DensityListItem
                key={customer.customer_id}
                density={listDensity}
                testId={`customer-row-${customer.customer_id}`}
                selectable
                selected={selection.isSelected(customer.customer_id)}
                onSelectChange={(_checked, meta) =>
                  selection.toggleWithRange(customer.customer_id, {
                    shiftKey: !!meta?.shiftKey,
                    orderedIds: matchingCustomerIds,
                  })
                }
                contextMenuItems={[
                  {
                    id: "edit",
                    label: "Editar cliente",
                    icon: Pencil,
                    onClick: () => openEditCustomer(customer),
                    disabled: !canEditCustomers,
                  },
                  {
                    id: "vehicles",
                    label: "Ver vehículos registrados",
                    icon: CarFront,
                    onClick: () => openCustomerVehiclesModal(customer),
                  },
                  {
                    id: "whatsapp",
                    label: "Contactar por WhatsApp",
                    icon: Phone,
                    onClick: () => sendWhatsAppWithTemplate(customer),
                    disabled: user?.role === "bodegas" || !customer.phone,
                  },
                  {
                    id: "copy-phone",
                    label: "Copiar teléfono",
                    icon: Copy,
                    onClick: () => {
                      if (customer.phone) {
                        navigator.clipboard?.writeText(customer.phone);
                        toast.success("Teléfono copiado al portapapeles");
                      }
                    },
                    disabled: !customer.phone,
                  },
                  {
                    id: "delete",
                    label: "Eliminar cliente",
                    icon: Trash2,
                    variant: "destructive",
                    separatorBefore: true,
                    onClick: () => setPendingDeleteCustomer(customer),
                    disabled: !canDeleteCustomers,
                  },
                ]}
                mediaFallback={
                  isCompany ? (
                    <Building2 className={`${densityTok.mediaIcon} text-sky-700 icon-spring`} />
                  ) : (
                    <User className={`${densityTok.mediaIcon} text-emerald-700 icon-spring`} />
                  )
                }
                primary={customer.name}
                secondary={`${customer.phone || "-"} · ${customer.address || "-"}`}
                meta={
                  <span className="inline-flex items-center gap-2">
                    <Badge variant="outline" className={`w-fit ${badgeTone}`}>
                      {isCompany ? "Empresa" : "Persona natural"}
                    </Badge>
                    <span>{customer.tax_id || "-"}</span>
                  </span>
                }
                trailing={
                  <div className="flex flex-wrap items-center gap-1">
                    {user?.role !== "bodegas" && (
                      <Button variant="outline" size="icon" title="Contactar por WhatsApp" className="ui-interactive h-8 w-8" onClick={() => sendWhatsAppWithTemplate(customer)}>
                        <Phone className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" title="Editar cliente" className="ui-interactive h-8 w-8" onClick={() => openEditCustomer(customer)} disabled={!canEditCustomers}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="icon" title="Eliminar cliente" className="ui-interactive h-8 w-8" disabled={!canDeleteCustomers} onClick={() => setPendingDeleteCustomer(customer)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                }
              >
                <div className="flex flex-col gap-3">
                  <div className="inline-flex items-start gap-2 text-sm break-words">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 icon-spring" />
                    <span>{customer.email || '-'}</span>
                  </div>
                  <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays className="h-4 w-4 shrink-0 text-slate-500 icon-spring" />
                    <span>Última compra: {formatShortDate(customer.last_purchase_date)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white/70 px-3.5 py-3">
                    <button type="button" className="inline-flex items-center gap-2 text-left text-sm font-medium text-slate-700 ui-interactive" onClick={() => openCustomerVehiclesModal(customer)}>
                      <CarFront className={`h-4 w-4 shrink-0 icon-spring ${isCompany ? 'text-sky-700' : 'text-emerald-700'}`} />
                      <span className="underline decoration-dotted underline-offset-4">Vehículos registrados</span>
                    </button>
                    <div className={`rounded-full px-3 py-1 text-sm font-semibold ${vehiclesCountTone}`}>
                      {customerVehiclesCount}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-1">
                      <Select value={getTemplateForCustomer(customer.customer_id)} onValueChange={(v) => setTemplateForCustomer(customer.customer_id, v)}>
                        <SelectTrigger className="h-8 min-w-[180px] flex-1 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {waTemplates.map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="icon" title="Editar mensaje" className="ui-interactive" onClick={() => editCustomMessageForCustomer(customer.customer_id)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
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

      {/* Vehicles Modal */}
      <Dialog open={showVehiclesModal} onOpenChange={(open) => {
        setShowVehiclesModal(open);
        if (!open) scrollRestore.restore();
      }}>
        <DialogContent className="max-w-xl">
          <ContextualDialogHeader
            variant="information"
            size="inline"
            title={`Vehículos de ${modalCustomer?.name || "este cliente"}`}
            description="Revisa el detalle del vehículo y lanza acciones rápidas con este cliente y vehículo."
          />
          <div className="grid gap-2 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 text-xs text-slate-700 md:grid-cols-2">
            <div>
              <span className="font-medium">Última compra:</span> {formatShortDate(modalCustomer?.last_purchase_date)}
            </div>
            <div>
              <span className="font-medium">Notas:</span> {String(modalCustomer?.notes || modalCustomer?.note || '-').trim() || '-'}
            </div>
          </div>
          <div className="space-y-2">
            {modalVehicles.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-sm text-muted-foreground">
                Este cliente no tiene vehículos registrados.
              </div>
            ) : modalVehicles.map(v => (
              <Card key={v.vehicle_id} className="border-slate-200/80 bg-white/90 shadow-sm">
                <CardContent className="space-y-3 py-4">
                  <div>
                    <div className="font-medium">{v.plate} — {v.brand} {v.model}</div>
                    <div className="text-xs text-muted-foreground">{v.year || '-'} • {v.color || '-'} • {v.vin || '-'}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" className="bg-green-600 text-white hover:bg-green-700 ui-interactive" onClick={() => createSaleFromVehicle(modalCustomer, v)} disabled={!canCreateSales}>
                      Facturar con este vehículo
                    </Button>
                    <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-700 ui-interactive" onClick={() => createQuotationFromVehicle(modalCustomer, v)} disabled={!canCreateQuotations}>
                      Crear cotización
                    </Button>
                    <Button size="sm" variant="outline" className="ui-interactive" onClick={() => sendVehicleFollowup(modalCustomer, v)}>
                      Mensaje de seguimiento
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Vehicle Action Modal: crear venta / cotización con datos prellenados */}
      <Dialog open={showVehicleActionModal} onOpenChange={setShowVehicleActionModal}>
          <DialogContent className="max-w-lg">
          <ContextualDialogHeader
            variant="question"
            size="inline"
            title="Acciones del vehículo"
            description="Crear una venta o cotización usando los datos prellenados del cliente y vehículo."
          />
          {actionVehicle && actionCustomer && (
            <div className="space-y-4">
              <div>
                <div className="font-medium">{actionVehicle.plate} — {actionVehicle.brand} {actionVehicle.model}</div>
                <div className="text-xs text-muted-foreground">{actionVehicle.year || '-'} • {actionVehicle.color || '-'} • {actionVehicle.vin || actionVehicle.vin || '-'}</div>
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => createQuotationFromVehicle(actionCustomer, actionVehicle)} disabled={!canCreateQuotations}>
                  Crear Cotización
                </Button>
                <Button className="bg-green-600 text-white hover:bg-green-700" onClick={() => createSaleFromVehicle(actionCustomer, actionVehicle)} disabled={!canCreateSales}>
                  Crear Venta
                </Button>
                <Button className="bg-yellow-400 text-black hover:bg-yellow-500" disabled={!canEditCustomers} onClick={async () => {
                  const motivo = prompt('Motivo de la solicitud (obligatorio):', 'Corrección de datos');
                  if (motivo === null) return;
                  if (!motivo.trim()) { toast.error('El motivo es obligatorio'); return; }
                  try {
                    await axios.post(`${API}/approvals`, { type: 'edit_vehicle', payload: { vehicle_id: actionVehicle.vehicle_id, changes: {} }, reason: motivo.trim() }, { withCredentials: true });
                    toast.success('Solicitud de edición enviada');
                    setShowVehicleActionModal(false);
                  } catch (e) { toast.error(e.response?.data?.detail || 'Error'); }
                }}>
                  Editar
                </Button>
                <Button variant="destructive" disabled={!canDeleteCustomers} onClick={async () => {
                  const motivoDel = prompt('Motivo para eliminar el vehículo (obligatorio):', 'Vehículo duplicado');
                  if (motivoDel === null) return;
                  if (!motivoDel.trim()) { toast.error('El motivo es obligatorio'); return; }
                  try {
                    await axios.post(`${API}/approvals`, { type: 'delete_vehicle', payload: { vehicle_id: actionVehicle.vehicle_id }, reason: motivoDel.trim() }, { withCredentials: true });
                    toast.success('Solicitud de eliminación enviada');
                    setShowVehicleActionModal(false);
                  } catch (e) { toast.error(e.response?.data?.detail || 'Error'); }
                }}>
                  Eliminar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      
      <DestructiveConfirmDialog
        open={!!pendingDeleteCustomer}
        onOpenChange={(open) => { if (!open) setPendingDeleteCustomer(null); }}
        title="Eliminar cliente"
        description={
          pendingDeleteCustomer
            ? `Se enviará una solicitud de aprobación para eliminar a «${pendingDeleteCustomer.name}». Esta acción no se puede deshacer desde aquí.`
            : undefined
        }
        confirmVerb="Eliminar cliente"
        cancelVerb="Conservar cliente"
        requireReason
        defaultReason="Cliente inactivo"
        reasonPlaceholder="Motivo de la eliminación…"
        onConfirm={confirmDeleteCustomer}
        loading={deleteCustomerBusy}
        footnote="No hay periodo de gracia multi-día en el API de clientes; la eliminación pasa por aprobación de gerencia."
        testId="customer-delete-confirm"
      />

      {/* WhatsApp Preview Dialog */}
      <Dialog open={showWaPreview} onOpenChange={setShowWaPreview}>
        <DialogContent className="max-w-md">
          <ContextualDialogHeader
            variant="information"
            size="inline"
            title="Vista previa mensaje WhatsApp"
            description="Revisa el mensaje antes de abrir WhatsApp."
          />
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">A: {waPreviewCustomer?.name || '-'}</div>
            <pre className="whitespace-pre-wrap p-2 border rounded bg-muted">{waPreviewMessage}</pre>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowWaPreview(false)}>Cancelar</Button>
              <Button onClick={() => {
                if (!waPreviewCustomer) return;
                // attach message to customer and call contact
                const custWithMsg = { ...waPreviewCustomer, _wa_message: waPreviewMessage };
                contactWhatsApp(custWithMsg);
                setShowWaPreview(false);
              }}>Abrir WhatsApp</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      </>
      )}
      <BackToTopButton />
    </div>
    </PullToRefresh>
  );
}
