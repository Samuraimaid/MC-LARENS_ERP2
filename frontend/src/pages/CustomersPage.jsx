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
/* table UI not required in this page currently */
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import SearchableSelect from "@/components/ui/searchable-select";
import CustomerVehicleFormTabs from "@/components/customers/CustomerVehicleFormTabs";
import { toast } from "sonner";
import { playCreationSuccessSound, playSelectionFeedbackSound } from "@/lib/uiSounds";
import { Plus, Search, User, Phone, Car, RefreshCw, Building2, ShieldCheck, Pencil, Trash2, Mail, CalendarDays, CarFront, MapPin, ListFilter } from "lucide-react";
import { API_BASE as API } from "@/lib/api";
import {
  getVehicleSelectOptionsByBrandYear,
  getVehicleYearsByBrand,
  isValidVehicleSelection,
  VEHICLE_CATALOG_BRANDS,
  VEHICLE_COLOR_SUGGESTIONS,
} from "@/lib/vehicleCatalog";
import {
  formatChasis,
  formatCedula,
  formatPhone,
  formatPlateNumber,
  formatRUC,
} from "@/lib/formatters";
import { PRICING_PROFILES } from "@/lib/priceTiers";

// Prefijos de placa Nicaragua
const PLATE_PREFIXES = [
  "M", "LE", "CH", "MY", "GR", "CZ", "MT", "BO", "CT", "RI", 
  "NS", "ES", "MZ", "JI", "RS", "AN", "AS", "TM", "ZC", "PN", 
  "EN", "CD", "MI", "OI"
];

export function CustomersPage() {
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
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [customerTypeFilter, setCustomerTypeFilter] = useState("all");
  const [boardTab, setBoardTab] = useState("todos");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [activeTab, setActiveTab] = useState("customer");
  const [isEditing, setIsEditing] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState(null);
  
  // Credit limit authorization
  const [showCreditAuth, setShowCreditAuth] = useState(false);
  const [creditAuthCode, setCreditAuthCode] = useState("");
  const [pendingCreditLimit, setPendingCreditLimit] = useState(0);

  const [formData, setFormData] = useState({
    // Customer fields
    first_name: "",
    last_name: "",
    customer_type: "natural", // natural or empresa
    tax_id: "", // Cédula or RUC
    email: "",
    phone_prefix: "+505",
    phone: "",
    address: "",
    credit_limit: 0,
    pricing_profile: "standard",
    // Vehicle fields (optional)
    add_vehicle: false,
    plate_prefix: "M",
    plate_number: "",
    brand: "",
    model: "",
    year: "",
    color: "",
    chasis: "",
  });

  const [customerVehicles, setCustomerVehicles] = useState([]);
  const [allVehicles, setAllVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [isAddingVehicle, setIsAddingVehicle] = useState(false);
  const [showDeleteVehicle, setShowDeleteVehicle] = useState(false);
  const [showVehiclesModal, setShowVehiclesModal] = useState(false);
  const [modalVehicles, setModalVehicles] = useState([]);
  const [modalCustomer, setModalCustomer] = useState(null);
  const [showVehicleActionModal, setShowVehicleActionModal] = useState(false);
  const [actionVehicle, setActionVehicle] = useState(null);
  const [actionCustomer, setActionCustomer] = useState(null);
  const [useVinDecoderNewVehicle, setUseVinDecoderNewVehicle] = useState(false);
  const [useVinDecoderEditVehicle, setUseVinDecoderEditVehicle] = useState(false);
  const [isDecodingVinNewVehicle, setIsDecodingVinNewVehicle] = useState(false);
  const [isDecodingVinEditVehicle, setIsDecodingVinEditVehicle] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({
    plate_prefix: "M",
    plate_number: "",
    vin: "",
    brand: "",
    model: "",
    year: "",
    color: "",
  });
  const formYearOptions = useMemo(
    () => getVehicleYearsByBrand(formData.brand),
    [formData.brand]
  );
  const formBrandModelOptions = useMemo(
    () => getVehicleSelectOptionsByBrandYear(formData.brand, formData.year),
    [formData.brand, formData.year]
  );
  const editYearOptions = useMemo(
    () => getVehicleYearsByBrand(vehicleForm.brand),
    [vehicleForm.brand]
  );
  const editBrandModelOptions = useMemo(
    () => getVehicleSelectOptionsByBrandYear(vehicleForm.brand, vehicleForm.year),
    [vehicleForm.brand, vehicleForm.year]
  );

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

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/customers`, { withCredentials: true });
      setCustomers(response.data);
    } catch (error) {
      toast.error("Error al cargar clientes");
    } finally {
      setLoading(false);
    }
  };

  const decodeVin = async (vinInput) => {
    const vin = formatChasis(vinInput || "");
    if (vin.length !== 17) {
      throw new Error("Ingresa un VIN válido de 17 caracteres");
    }
    const response = await axios.get(`${API}/vehicles/decode-vin`, {
      params: { vin },
      withCredentials: true,
    });
    return response.data;
  };

  const resetForm = () => {
    setFormData({
      first_name: "",
      last_name: "",
      customer_type: "natural",
      tax_id: "",
      email: "",
      phone_prefix: "+505",
      phone: "",
      address: "",
      credit_limit: 0,
      pricing_profile: "standard",
      add_vehicle: false,
      plate_prefix: "M",
      plate_number: "",
      brand: "",
      model: "",
      year: "",
      color: "",
      chasis: "",
    });
    setActiveTab("customer");
    setIsEditing(false);
    setEditingCustomerId(null);
    setCustomerVehicles([]);
    setSelectedVehicleId("");
    setIsAddingVehicle(false);
    setUseVinDecoderNewVehicle(false);
    setUseVinDecoderEditVehicle(false);
    setIsDecodingVinNewVehicle(false);
    setIsDecodingVinEditVehicle(false);
    setVehicleForm({
      plate_prefix: "M",
      plate_number: "",
      vin: "",
      brand: "",
      model: "",
      year: "",
      color: "",
    });
  };

  const splitPhone = (value) => {
    const raw = (value || "").toString().replace(/\s/g, "");
    if (!raw) return { prefix: "+505", number: "" };
    const match = raw.match(/^(\+?\d+)[-]?(.+)$/);
    if (match) {
      let prefix = match[1] || "+505";
      let number = match[2] || "";
      if (!prefix.startsWith("+")) prefix = `+${prefix}`;
      number = formatPhone(number.replace(/[^0-9]/g, ""));
      return { prefix, number };
    }
    return { prefix: "+505", number: formatPhone(raw.replace(/[^0-9]/g, "")) };
  };

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

  const parsePlate = (plate) => {
    const raw = (plate || "").toString().trim();
    if (!raw) return { prefix: "M", number: "" };
    const parts = raw.split(" ");
    const prefix = parts[0]?.toUpperCase() || "M";
    const numberRaw = parts.slice(1).join(" ");
    return {
      prefix: PLATE_PREFIXES.includes(prefix) ? prefix : "M",
      number: formatPlateNumber(prefix, numberRaw),
    };
  };

  const setVehicleFormFromVehicle = useCallback((vehicle) => {
    const { prefix, number } = parsePlate(vehicle?.plate);
    setVehicleForm({
      plate_prefix: prefix,
      plate_number: number,
      vin: vehicle?.vin || "",
      brand: vehicle?.brand || "",
      model: vehicle?.model || "",
      year: vehicle?.year ? String(vehicle.year) : "",
      color: vehicle?.color || "",
    });
  }, []);

  const openEditCustomer = async (customer) => {
    if (!canEditCustomers) {
      toast.error("No tienes permiso para editar clientes");
      return;
    }
    const { prefix, number } = splitPhone(customer.phone);
    const nameParts = (customer.name || "").trim().split(" ");
    setFormData({
      first_name: customer.first_name || nameParts[0] || "",
      last_name: customer.last_name || nameParts.slice(1).join(" "),
      customer_type: customer.customer_type || "natural",
      tax_id: customer.tax_id || "",
      email: customer.email || "",
      phone_prefix: prefix,
      phone: number,
      address: customer.address || "",
      credit_limit: customer.credit_limit || 0,
      pricing_profile: customer.pricing_profile || "standard",
      add_vehicle: false,
      plate_prefix: "M",
      plate_number: "",
      brand: "",
      model: "",
      year: "",
      color: "",
      chasis: "",
    });
    setActiveTab("customer");
    setIsEditing(true);
    setEditingCustomerId(customer.customer_id);
    setCreditAuthCode("");
    setPendingCreditLimit(0);
    setShowNewCustomer(true);
    setIsAddingVehicle(false);

    try {
      const vehiclesRes = await axios.get(
        `${API}/vehicles?customer_id=${customer.customer_id}`,
        { withCredentials: true }
      );
      const vehicles = Array.isArray(vehiclesRes.data) ? vehiclesRes.data : [];
      setCustomerVehicles(vehicles);
      const firstVehicle = vehicles[0];
      if (firstVehicle?.vehicle_id) {
        setSelectedVehicleId(firstVehicle.vehicle_id);
        setVehicleFormFromVehicle(firstVehicle);
        setUseVinDecoderEditVehicle(false);
      } else {
        setSelectedVehicleId("");
        setIsAddingVehicle(true);
        setVehicleForm({
          plate_prefix: "M",
          plate_number: "",
          vin: "",
          brand: "",
          model: "",
          year: "",
          color: "",
        });
        setUseVinDecoderEditVehicle(false);
      }
    } catch (error) {
      setCustomerVehicles([]);
      setSelectedVehicleId("");
      toast.error("Error al cargar vehículos del cliente");
    }
  };

  useEffect(() => {
    if (!selectedVehicleId) return;
    setIsAddingVehicle(false);
    setUseVinDecoderEditVehicle(false);
    const vehicle = customerVehicles.find(v => v.vehicle_id === selectedVehicleId);
    if (vehicle) {
      setVehicleFormFromVehicle(vehicle);
    }
  }, [selectedVehicleId, customerVehicles, setVehicleFormFromVehicle]);

  const updateVehicle = async () => {
    if (!canEditCustomers) {
      toast.error("No tienes permiso para editar vehículos");
      return;
    }
    if (isAddingVehicle || !selectedVehicleId) return;
    if (!vehicleForm.brand || !vehicleForm.year || !vehicleForm.model) {
      toast.error("Selecciona marca, año y modelo");
      return;
    }
    if (!isValidVehicleSelection(vehicleForm.brand, vehicleForm.year, vehicleForm.model)) {
      toast.error("Marca, año y modelo deben seleccionarse desde la lista");
      return;
    }
    try {
      const plateFormatted = vehicleForm.plate_prefix === "M"
        ? `M ${vehicleForm.plate_number}`
        : `${vehicleForm.plate_prefix} ${vehicleForm.plate_number}`;

      const changes = {
        plate: plateFormatted,
        vin: vehicleForm.vin || null,
        brand: vehicleForm.brand,
        model: vehicleForm.model,
        year: parseInt(vehicleForm.year) || new Date().getFullYear(),
        color: vehicleForm.color || null,
      };

      // Create an approval request instead of updating directly
      // pedir motivo obligatorio para la solicitud
      const motivo = prompt('Ingrese el motivo de la solicitud (obligatorio):', 'Corrección de datos');
      if (motivo === null) return; // usuario canceló
      if (!motivo.trim()) { toast.error('El motivo es obligatorio'); return; }
      await axios.post(`${API}/approvals`, {
        type: 'edit_vehicle',
        payload: { vehicle_id: selectedVehicleId, changes },
        reason: motivo.trim()
      }, { withCredentials: true });

      toast.success("Solicitud enviada para aprobación");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al solicitar aprobación");
    }
  };

  const createVehicle = async () => {
    if (!canCreateCustomers) {
      toast.error("No tienes permiso para crear vehículos");
      return;
    }
    if (!editingCustomerId) return;
    if (!vehicleForm.brand || !vehicleForm.year || !vehicleForm.model || !vehicleForm.plate_number) {
      toast.error("Completa placa, marca, año y modelo");
      return;
    }
    if (!isValidVehicleSelection(vehicleForm.brand, vehicleForm.year, vehicleForm.model)) {
      toast.error("Marca, año y modelo deben seleccionarse desde la lista");
      return;
    }
    try {
      const plateFormatted = vehicleForm.plate_prefix === "M"
        ? `M ${vehicleForm.plate_number}`
        : `${vehicleForm.plate_prefix} ${vehicleForm.plate_number}`;

      const payload = {
        customer_id: editingCustomerId,
        plate: plateFormatted,
        brand: vehicleForm.brand,
        model: vehicleForm.model,
        year: parseInt(vehicleForm.year) || new Date().getFullYear(),
        color: vehicleForm.color || null,
        vin: vehicleForm.vin || null,
        vehicle_type: "sedan",
      };

      const response = await axios.post(`${API}/vehicles`, payload, { withCredentials: true });
      const newVehicle = response.data;
      toast.success("Vehículo agregado");
      playCreationSuccessSound();
      setCustomerVehicles(prev => [newVehicle, ...prev]);
      if (newVehicle?.vehicle_id) {
        setSelectedVehicleId(newVehicle.vehicle_id);
        setIsAddingVehicle(false);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al agregar vehículo");
    }
  };

  const decodeNewVehicleVin = async () => {
    try {
      setIsDecodingVinNewVehicle(true);
      const decoded = await decodeVin(formData.chasis);
      setFormData((prev) => ({
        ...prev,
        chasis: formatChasis(decoded?.vin || prev.chasis),
        brand: decoded?.brand || prev.brand,
        model: decoded?.model || prev.model,
        year: decoded?.year ? String(decoded.year) : prev.year,
      }));
      toast.success("VIN decodificado");
    } catch (error) {
      toast.error(error.response?.data?.detail || error.message || "No se pudo decodificar el VIN");
    } finally {
      setIsDecodingVinNewVehicle(false);
    }
  };

  const decodeEditVehicleVin = async () => {
    try {
      setIsDecodingVinEditVehicle(true);
      const decoded = await decodeVin(vehicleForm.vin);
      setVehicleForm((prev) => ({
        ...prev,
        vin: formatChasis(decoded?.vin || prev.vin),
        brand: decoded?.brand || prev.brand,
        model: decoded?.model || prev.model,
        year: decoded?.year ? String(decoded.year) : prev.year,
      }));
      toast.success("VIN decodificado");
    } catch (error) {
      toast.error(error.response?.data?.detail || error.message || "No se pudo decodificar el VIN");
    } finally {
      setIsDecodingVinEditVehicle(false);
    }
  };

  const deleteVehicle = async () => {
    if (!canDeleteCustomers) {
      toast.error("No tienes permiso para eliminar vehículos");
      return;
    }
    if (!selectedVehicleId) return;
    try {
      // pedir motivo obligatorio para la eliminación
      const motivoDel = prompt('Ingrese el motivo para eliminar el vehículo (obligatorio):', 'Vehículo duplicado');
      if (motivoDel === null) return;
      if (!motivoDel.trim()) { toast.error('El motivo es obligatorio'); return; }
      // Create an approval request to delete the vehicle
      await axios.post(`${API}/approvals`, {
        type: 'delete_vehicle',
        payload: { vehicle_id: selectedVehicleId },
        reason: motivoDel.trim()
      }, { withCredentials: true });

      toast.success("Solicitud de eliminación enviada para aprobación");
      // keep local state; refresh after approval
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al solicitar eliminación");
    }
  };

  const requestCreditAuthorization = async () => {
    try {
      const response = await axios.post(`${API}/auth/manager/generate-code`, null, {
        params: { reason: "Autorización de límite de crédito" },
        withCredentials: true
      });
      toast.success(`Código generado: ${response.data.code}`);
      setCreditAuthCode(response.data.code);
    } catch (error) {
      toast.error("Error al generar código. ¿Eres gerente?");
    }
  };

  const saveCustomer = async () => {
    if (isEditing && !canEditCustomers) {
      toast.error("No tienes permiso para editar clientes");
      return;
    }
    if (!isEditing && !canCreateCustomers) {
      toast.error("No tienes permiso para crear clientes");
      return;
    }
    if (!formData.first_name || !formData.last_name || !formData.phone) {
      toast.error("Nombres, apellidos y teléfono son requeridos");
      return;
    }

    if (formData.customer_type === "empresa" && !String(formData.tax_id || "").trim()) {
      toast.error("El RUC es requerido para registrar una empresa");
      return;
    }

    // Check if trying to set credit limit > 0 without being manager
    if (formData.credit_limit > 0 && !canManageCreditLimit) {
      if (!creditAuthCode) {
        setShowCreditAuth(true);
        setPendingCreditLimit(formData.credit_limit);
        return;
      }
    }

    if (isEditing) {
      await updateCustomer();
    } else {
      await createCustomer();
    }
  };

  const createCustomer = async () => {
    if (!canCreateCustomers) {
      toast.error("No tienes permiso para crear clientes");
      return;
    }
    try {
      // Build customer data
      const fullName = `${formData.first_name} ${formData.last_name}`;
      const fullPhone = `${formData.phone_prefix}-${formData.phone}`;
      
      const customerData = {
        name: fullName,
        first_name: formData.first_name,
        last_name: formData.last_name,
        customer_type: formData.customer_type,
        tax_id: formData.tax_id,
        email: formData.email || null,
        phone: fullPhone,
        address: formData.address || null,
        credit_limit: parseFloat(formData.credit_limit) || 0,
        credit_auth_code: creditAuthCode || null,
        ...(canManagePricingProfile ? { pricing_profile: formData.pricing_profile || "standard" } : {}),
      };

      const customerRes = await axios.post(`${API}/customers`, customerData, { withCredentials: true });
      const customerId = customerRes.data.customer_id;
      
      toast.success("Cliente creado exitosamente");
      playCreationSuccessSound();

      // Create vehicle if requested
      if (formData.add_vehicle && formData.brand && formData.model) {
        if (!formData.year) {
          toast.error("Selecciona el año del vehículo");
          return;
        }
        if (!isValidVehicleSelection(formData.brand, formData.year, formData.model)) {
          toast.error("Marca, año y modelo deben seleccionarse desde la lista");
          return;
        }
        try {
          const plateFormatted = formData.plate_prefix === "M"
            ? `M ${formData.plate_number}`
            : `${formData.plate_prefix} ${formData.plate_number}`;
          
          const vehicleData = {
            customer_id: customerId,
            plate: plateFormatted,
            brand: formData.brand,
            model: formData.model,
            year: parseInt(formData.year) || new Date().getFullYear(),
            color: formData.color || null,
            vin: formData.chasis || null, // Backend uses 'vin' field
            vehicle_type: "sedan", // Default
          };

          await axios.post(`${API}/vehicles`, vehicleData, { withCredentials: true });
          toast.success("Vehículo registrado");
          playCreationSuccessSound();
        } catch (error) {
          toast.error("Cliente creado pero error al registrar vehículo");
        }
      }

      setShowNewCustomer(false);
      resetForm();
      setCreditAuthCode("");
      fetchCustomers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al crear cliente");
    }
  };

  const updateCustomer = async () => {
    if (!canEditCustomers) {
      toast.error("No tienes permiso para editar clientes");
      return;
    }
    if (!editingCustomerId) return;
    try {
      const fullName = `${formData.first_name} ${formData.last_name}`.trim();
      const fullPhone = `${formData.phone_prefix}-${formData.phone}`;

      const customerData = {
        name: fullName,
        first_name: formData.first_name,
        last_name: formData.last_name,
        customer_type: formData.customer_type,
        tax_id: formData.tax_id,
        email: formData.email || null,
        phone: fullPhone,
        address: formData.address || null,
        credit_limit: parseFloat(formData.credit_limit) || 0,
        credit_auth_code: creditAuthCode || null,
        ...(canManagePricingProfile ? { pricing_profile: formData.pricing_profile || "standard" } : {}),
      };

      // Instead of updating directly, create an approval request
      const motivo = prompt('Motivo de la solicitud (obligatorio):', 'Actualización de datos del cliente');
      if (motivo === null) return;
      if (!motivo.trim()) { toast.error('El motivo es obligatorio'); return; }
      await axios.post(`${API}/approvals`, { type: 'edit_customer', payload: { customer_id: editingCustomerId, changes: customerData }, reason: motivo.trim() }, { withCredentials: true });
      toast.success('Solicitud de actualización enviada para aprobación');
      setShowNewCustomer(false);
      resetForm();
      setCreditAuthCode("");
      fetchCustomers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al solicitar actualización");
    }
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

  return (
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
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">Clientes</h1>
          <p className="text-sm text-muted-foreground sm:text-base">Gestión de clientes y créditos</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-nowrap sm:justify-end">
          <Button variant="outline" onClick={fetchCustomers} className="col-span-2 h-9 px-3 sm:col-auto sm:px-4">
            <RefreshCw className="h-4 w-4" />
          </Button>
            <Dialog open={showNewCustomer} onOpenChange={(open) => { setShowNewCustomer(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button data-testid="new-customer-btn" disabled={!canCreateCustomers} className="h-9 w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{isEditing ? "Editar Cliente" : "Nuevo Cliente"}</DialogTitle>
                <DialogDescription>
                  {isEditing
                    ? "Actualiza los datos del cliente"
                    : "Registra un nuevo cliente y opcionalmente su vehículo"}
                </DialogDescription>
              </DialogHeader>
              
              <CustomerVehicleFormTabs
                formData={formData}
                onFormDataChange={setFormData}
                activeTab={activeTab}
                onActiveTabChange={setActiveTab}
                canManageCreditLimit={canManageCreditLimit}
                canManagePricingProfile={canManagePricingProfile}
                disableAddVehicle={isEditing}
                addVehicleLabel="Registrar vehículo del cliente"
                useVinDecoder={useVinDecoderNewVehicle}
                onUseVinDecoderChange={setUseVinDecoderNewVehicle}
                isDecodingVin={isDecodingVinNewVehicle}
                onDecodeVin={decodeNewVehicleVin}
                yearOptions={formYearOptions}
                modelOptions={formBrandModelOptions}
                platePrefixes={PLATE_PREFIXES}
                vehicleBrands={VEHICLE_CATALOG_BRANDS}
                colorSuggestions={VEHICLE_COLOR_SUGGESTIONS}
                formatPhone={formatPhone}
                formatCedula={formatCedula}
                formatRUC={formatRUC}
                formatChasis={formatChasis}
                formatPlateNumber={formatPlateNumber}
                customerTypeTestId="customer-type"
                phoneTestId="phone"
                creditLimitTestId="credit-limit"
                platePrefixTestId="plate-prefix"
                plateNumberTestId="plate-number"
                vehicleChasisTestId="vehicle-chasis"
                colorDatalistId="customers-color-options"
                addVehicleCheckboxId="add-vehicle"
                useVinCheckboxId="use-vin-decoder-new-vehicle"
              />

              {isEditing && (
                <div className="mt-4 space-y-4 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base">Vehículo del cliente</Label>
                    <span className="text-xs text-muted-foreground">
                      {customerVehicles.length} registrado(s)
                    </span>
                  </div>

                  {customerVehicles.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Este cliente no tiene vehículos registrados.
                    </p>
                  ) : (
                    <>
                      <div>
                        <Label>Seleccionar vehículo</Label>
                        <Select
                          value={selectedVehicleId}
                          onValueChange={(value) => {
                            setSelectedVehicleId(value);
                            playSelectionFeedbackSound();
                          }}
                          disabled={isAddingVehicle}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar vehículo" />
                          </SelectTrigger>
                          <SelectContent>
                            {customerVehicles.map(vehicle => (
                              <SelectItem key={vehicle.vehicle_id} value={vehicle.vehicle_id}>
                                {vehicle.plate} · {vehicle.brand} {vehicle.model}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsAddingVehicle(true);
                            setSelectedVehicleId("");
                            setUseVinDecoderEditVehicle(false);
                            setVehicleForm({
                              plate_prefix: "M",
                              plate_number: "",
                              vin: "",
                              brand: "",
                              model: "",
                              year: "",
                              color: "",
                            });
                          }}
                          disabled={!canCreateCustomers}
                        >
                          Agregar nuevo vehículo
                        </Button>
                        {isAddingVehicle && customerVehicles.length > 0 && (
                          <Button
                            variant="ghost"
                            onClick={() => {
                              const firstVehicle = customerVehicles[0];
                              if (firstVehicle?.vehicle_id) {
                                setSelectedVehicleId(firstVehicle.vehicle_id);
                              }
                              setUseVinDecoderEditVehicle(false);
                              setIsAddingVehicle(false);
                            }}
                          >
                            Cancelar
                          </Button>
                        )}
                        {!isAddingVehicle && selectedVehicleId && (
                          <Button
                            variant="destructive"
                            onClick={() => setShowDeleteVehicle(true)}
                            disabled={!canDeleteCustomers}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Eliminar vehículo
                          </Button>
                        )}
                      </div>

                      <div>
                        <Label>Placa</Label>
                        <div className="flex gap-2">
                          <Select 
                            value={vehicleForm.plate_prefix} 
                            onValueChange={(v) => setVehicleForm({ ...vehicleForm, plate_prefix: v, plate_number: "" })}
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
                            value={vehicleForm.plate_number}
                            onChange={(e) => setVehicleForm({
                              ...vehicleForm,
                              plate_number: formatPlateNumber(vehicleForm.plate_prefix, e.target.value)
                            })}
                            placeholder={vehicleForm.plate_prefix === "M" ? "123 456" : "12345"}
                            className="flex-1 font-mono"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="use-vin-decoder-edit-vehicle"
                          checked={useVinDecoderEditVehicle}
                          onCheckedChange={(checked) => setUseVinDecoderEditVehicle(Boolean(checked))}
                        />
                        <Label htmlFor="use-vin-decoder-edit-vehicle">Usar decodificador VIN</Label>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-[1fr_0.8fr_1.9fr] gap-4">
                        <div>
                          <Label>Marca</Label>
                          <SearchableSelect
                            value={vehicleForm.brand}
                            onChange={(v) => setVehicleForm({ ...vehicleForm, brand: v, year: "", model: "" })}
                            options={VEHICLE_CATALOG_BRANDS}
                            placeholder="Seleccionar marca"
                            searchPlaceholder="Buscar marca..."
                          />
                        </div>

                        <div>
                          <Label>Año</Label>
                          <SearchableSelect
                            value={String(vehicleForm.year || "")}
                            onChange={(v) => setVehicleForm({ ...vehicleForm, year: v, model: "" })}
                            options={editYearOptions}
                            placeholder="Seleccionar año"
                            searchPlaceholder="Buscar año..."
                            disabled={!vehicleForm.brand}
                          />
                        </div>

                        <div>
                          <Label>Modelo</Label>
                          <SearchableSelect
                            value={vehicleForm.model}
                            onChange={(v) => setVehicleForm({ ...vehicleForm, model: v })}
                            options={editBrandModelOptions}
                            placeholder="Seleccionar modelo"
                            searchPlaceholder="Buscar modelo..."
                            disabled={!vehicleForm.brand || !vehicleForm.year}
                          />
                        </div>
                      </div>

                      <div>
                        <Label>Color</Label>
                        <Input
                          list="customers-edit-color-options"
                          value={vehicleForm.color}
                          onChange={(e) => setVehicleForm({ ...vehicleForm, color: e.target.value })}
                          placeholder="Escribe para sugerencias de color"
                        />
                        <datalist id="customers-edit-color-options">
                          {VEHICLE_COLOR_SUGGESTIONS.map((color) => (
                            <option key={color} value={color} />
                          ))}
                        </datalist>
                      </div>

                      <div>
                        <Label>CHASIS (VIN)</Label>
                        <Input
                          value={vehicleForm.vin}
                          onChange={(e) => setVehicleForm({ ...vehicleForm, vin: formatChasis(e.target.value) })}
                          placeholder="1HGBH41JXMN109186"
                          className="font-mono"
                          maxLength={17}
                        />
                        {useVinDecoderEditVehicle && (
                          <Button
                            type="button"
                            variant="outline"
                            className="mt-2"
                            onClick={decodeEditVehicleVin}
                            disabled={isDecodingVinEditVehicle || vehicleForm.vin.length !== 17}
                          >
                            {isDecodingVinEditVehicle ? "Decodificando VIN..." : "Decodificar VIN"}
                          </Button>
                        )}
                      </div>

                      <Button
                        variant="outline"
                        onClick={isAddingVehicle ? createVehicle : updateVehicle}
                        disabled={(isAddingVehicle && !canCreateCustomers) || (!isAddingVehicle && (!selectedVehicleId || !canEditCustomers))}
                      >
                        {isAddingVehicle ? "Agregar vehículo" : "Guardar vehículo"}
                      </Button>
                    </>
                  )}
                </div>
              )}

              <Dialog open={showDeleteVehicle} onOpenChange={setShowDeleteVehicle}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Eliminar vehículo</DialogTitle>
                    <DialogDescription>
                      Esta acción no se puede deshacer. ¿Deseas eliminar el vehículo seleccionado?
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setShowDeleteVehicle(false)}>
                      Cancelar
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={!canDeleteCustomers}
                      onClick={async () => {
                        await deleteVehicle();
                        setShowDeleteVehicle(false);
                      }}
                    >
                      Eliminar
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Button onClick={saveCustomer} className="w-full mt-4" data-testid="save-customer-btn" disabled={isEditing ? !canEditCustomers : !canCreateCustomers}>
                {isEditing ? "Guardar Cambios" : (formData.add_vehicle ? "Crear Cliente y Vehículo" : "Crear Cliente")}
              </Button>
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={() => setShowManageTemplates(true)} className="h-9 w-full sm:w-auto">
            <span className="sm:hidden">Plantillas</span>
            <span className="hidden sm:inline">Plantillas WA</span>
          </Button>
          <Dialog open={showManageTemplates} onOpenChange={setShowManageTemplates}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Administrar Plantillas WhatsApp</DialogTitle>
                <DialogDescription>Editar, agregar o eliminar plantillas disponibles.</DialogDescription>
              </DialogHeader>
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

      <Card>
        <CardHeader>
          <CardTitle>Filtros rápidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <div className="flex w-full min-w-[300px] items-center gap-2">
              <Label className="inline-flex w-32 shrink-0 items-center gap-1 text-sm text-muted-foreground">
                <Search className="h-3.5 w-3.5" />
                Buscar cliente
              </Label>
              <div className="relative min-w-0 flex-1 max-w-xl">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Nombre, teléfono, email o cédula"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 text-sm"
                  data-testid="search-customers"
                />
              </div>
            </div>

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
                <div className="border border-dashed rounded-xl p-6 text-center text-sm text-muted-foreground">No se encontraron clientes.</div>
              ) : (
                <div className="grid grid-cols-1 gap-4 ui-fade-in-stagger">
                  {list.map(customer => {
                    const isCompany = customer.customer_type === "empresa";
                    const customerVehiclesCount = (vehiclesByCustomer[customer.customer_id] || []).length;
              const cardTone = isCompany
                ? "border-sky-200/80 bg-gradient-to-br from-sky-50 via-white to-blue-50"
                : "border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-cyan-50";
              const badgeTone = isCompany
                ? "border-sky-200 bg-sky-100 text-sky-800"
                : "border-emerald-200 bg-emerald-100 text-emerald-800";
              const vehiclesCountTone = customerVehiclesCount === 0
                ? "bg-slate-100 text-slate-700"
                : isCompany
                  ? "bg-sky-100 text-sky-800"
                  : "bg-emerald-100 text-emerald-800";

              return (
              <Card key={customer.customer_id} className={`group h-full shadow-sm ui-panel animate-fade-up-soft ${cardTone}`}>
                <CardHeader className="gap-4 pb-4">
                  <CardTitle className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="inline-flex items-center gap-2 text-lg font-semibold">
                        {isCompany ? (
                          <Building2 className="h-5 w-5 shrink-0 text-sky-700 icon-spring" />
                        ) : (
                          <User className="h-5 w-5 shrink-0 text-emerald-700 icon-spring" />
                        )}
                        <span className="truncate">{customer.name}</span>
                      </div>
                      <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4 shrink-0 text-slate-500 icon-spring" />
                        <span>{customer.phone || '-'}</span>
                      </div>
                      <div className="inline-flex items-start gap-2 text-sm text-muted-foreground">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 icon-spring" />
                        <span className="break-words">{customer.address || '-'}</span>
                      </div>
                      <Badge variant="outline" className={`w-fit ${badgeTone}`}>
                        {isCompany ? (
                          <><Building2 className="mr-1 h-3 w-3 icon-spring" /> Empresa</>
                        ) : (
                          <><User className="mr-1 h-3 w-3 icon-spring" /> Persona natural</>
                        )}
                      </Badge>
                    </div>
                    <div className="pt-1 text-right text-xs text-muted-foreground">{customer.tax_id || '-'}</div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex h-full flex-col gap-3">
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
                  <div className="mt-auto flex flex-col gap-3 pt-2">
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
                      {user?.role !== "bodegas" && (
                        <Button variant="outline" size="icon" title="Contactar por WhatsApp" className="ui-interactive" onClick={() => sendWhatsAppWithTemplate(customer)}>
                          <Phone className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" title="Editar cliente" className="ui-interactive" onClick={() => openEditCustomer(customer)} disabled={!canEditCustomers}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="icon" title="Eliminar cliente" className="ui-interactive" disabled={!canDeleteCustomers} onClick={async () => {
                        const motivo = prompt('Motivo para eliminar el cliente (obligatorio):', 'Cliente inactivo');
                        if (motivo === null) return;
                        if (!motivo.trim()) { toast.error('El motivo es obligatorio'); return; }
                        try {
                          await axios.post(`${API}/approvals`, { type: 'delete_customer', payload: { customer_id: customer.customer_id }, reason: motivo.trim() }, { withCredentials: true });
                          toast.success('Solicitud de eliminación enviada');
                        } catch (e) { toast.error(e.response?.data?.detail || 'Error al solicitar eliminación'); }
                      }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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

      {/* Vehicles Modal */}
      <Dialog open={showVehiclesModal} onOpenChange={setShowVehiclesModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Vehículos registrados de {modalCustomer?.name || 'este cliente'}</DialogTitle>
            <DialogDescription>
              Revisa el detalle del vehículo y lanza acciones rápidas con este cliente y vehículo.
            </DialogDescription>
          </DialogHeader>
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
          <DialogHeader>
            <DialogTitle>Acciones del vehículo</DialogTitle>
            <DialogDescription>
              Crear una venta o cotización usando los datos prellenados del cliente y vehículo.
            </DialogDescription>
          </DialogHeader>
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

      {/* WhatsApp Preview Dialog */}
      <Dialog open={showWaPreview} onOpenChange={setShowWaPreview}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Vista previa mensaje WhatsApp</DialogTitle>
            <DialogDescription>Revisa el mensaje antes de abrir WhatsApp.</DialogDescription>
          </DialogHeader>
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
              }}>Enviar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Credit Authorization Dialog */}
      <Dialog open={showCreditAuth} onOpenChange={setShowCreditAuth}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-orange-500" />
              Autorización de Crédito
            </DialogTitle>
            <DialogDescription>
              Se requiere autorización del gerente para asignar límite de crédito de {formatCurrency(pendingCreditLimit)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Código de Autorización</Label>
              <Input
                value={creditAuthCode}
                onChange={(e) => setCreditAuthCode(e.target.value.toUpperCase())}
                placeholder="Código del gerente"
                className="font-mono"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={requestCreditAuthorization} className="flex-1">
                Generar Código (Gerente)
              </Button>
              <Button 
                onClick={() => { setShowCreditAuth(false); saveCustomer(); }}
                disabled={!creditAuthCode}
                className="flex-1"
              >
                Confirmar
              </Button>
            </div>
            <Button 
              variant="ghost" 
              onClick={() => { setFormData({...formData, credit_limit: 0}); setShowCreditAuth(false); }}
              className="w-full"
            >
              Continuar sin límite de crédito
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </>
      )}
    </div>
  );
}
