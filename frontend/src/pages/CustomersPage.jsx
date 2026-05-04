import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { formatCurrency } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
/* table UI not required in this page currently */
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import SearchableSelect from "@/components/ui/searchable-select";
import { toast } from "sonner";
import { Plus, Search, User, Phone, Car, RefreshCw, Building2, ShieldCheck, Pencil, Trash2 } from "lucide-react";
import { API_BASE as API } from "@/lib/api";
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

// Formatear teléfono Nicaragua
const formatPhone = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
};

// Formatear cédula Nicaragua (001-000000-0000A)
const formatCedula = (value) => {
  const clean = value.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  if (clean.length <= 3) return clean;
  if (clean.length <= 9) return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  return `${clean.slice(0, 3)}-${clean.slice(3, 9)}-${clean.slice(9, 14)}`;
};

// Formatear RUC Nicaragua (J0000000000000)
const formatRUC = (value) => {
  const clean = value.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  return clean.slice(0, 14);
};

// Formatear CHASIS (17 dígitos alfanuméricos sin I, O, Q, Ñ)
const formatChasis = (value) => {
  const clean = value.replace(/[^0-9A-HJ-NPR-Za-hj-npr-z]/g, '').toUpperCase();
  return clean.slice(0, 17);
};

// Formatear placa según prefijo
const formatPlateNumber = (prefix, value) => {
  const digits = value.replace(/\D/g, '');
  if (prefix === "M") {
    // M 123 456 (6 dígitos en grupos de 3)
    if (digits.length <= 3) return digits;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)}`;
  } else {
    // Otras: 4 o 5 dígitos
    return digits.slice(0, 5);
  }
};

export function CustomersPage() {
  const { user, hasPermission } = useAuth();
  const normalizedUserRole = String(user?.role || "").toLowerCase();
  const canManageCreditLimit = ["gerencia", "recursos_humanos", "admin"].includes(normalizedUserRole);
  const canViewCustomers = hasPermission("customers", "view");
  const canCreateCustomers = hasPermission("customers", "create");
  const canEditCustomers = hasPermission("customers", "edit");
  const canDeleteCustomers = hasPermission("customers", "delete");
  const canCreateSales = hasPermission("sales", "create");
  const canCreateQuotations = hasPermission("quotations", "create");
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
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
    () => getVehicleOptionsByBrandYear(formData.brand, formData.year),
    [formData.brand, formData.year]
  );
  const editYearOptions = useMemo(
    () => getVehicleYearsByBrand(vehicleForm.brand),
    [vehicleForm.brand]
  );
  const editBrandModelOptions = useMemo(
    () => getVehicleOptionsByBrandYear(vehicleForm.brand, vehicleForm.year),
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
      };

      const customerRes = await axios.post(`${API}/customers`, customerData, { withCredentials: true });
      const customerId = customerRes.data.customer_id;
      
      toast.success("Cliente creado exitosamente");

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">Gestión de clientes y créditos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchCustomers}>
            <RefreshCw className="h-4 w-4" />
          </Button>
            <Dialog open={showNewCustomer} onOpenChange={(open) => { setShowNewCustomer(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button data-testid="new-customer-btn" disabled={!canCreateCustomers}>
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
              
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="customer">
                    <User className="h-4 w-4 mr-2" />
                    Datos del Cliente
                  </TabsTrigger>
                  <TabsTrigger value="vehicle" disabled={!formData.add_vehicle}>
                    <Car className="h-4 w-4 mr-2" />
                    Vehículo
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="customer" className="space-y-4 mt-4">
                  {/* Customer Type */}
                  <div>
                    <Label>Tipo de Cliente *</Label>
                    <Select 
                      value={formData.customer_type} 
                      onValueChange={(v) => setFormData({ ...formData, customer_type: v, tax_id: "" })}
                    >
                      <SelectTrigger data-testid="customer-type">
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

                  {/* Names */}
                  <div className="grid grid-cols-2 gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <Label>Nombres *</Label>
                      <Input
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        placeholder="Juan Carlos"
                        data-testid="first-name"
                      />
                    </div>
                    <div>
                      <Label>Apellidos *</Label>
                      <Input
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        placeholder="Pérez López"
                        data-testid="last-name"
                      />
                    </div>
                  </div>

                  {/* Tax ID */}
                  <div>
                    <Label>{formData.customer_type === "natural" ? "Cédula" : "RUC *"}</Label>
                    <Input
                      value={formData.tax_id}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        tax_id: formData.customer_type === "natural" 
                          ? formatCedula(e.target.value) 
                          : formatRUC(e.target.value)
                      })}
                      placeholder={formData.customer_type === "natural" ? "001-000000-0000A" : "J0000000000000"}
                      data-testid="tax-id"
                      required={formData.customer_type === "empresa"}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {formData.customer_type === "natural" 
                        ? "Formato: 001-000000-0000A" 
                        : "Formato: J0000000000000"}
                    </p>
                  </div>

                  {/* Phone */}
                  <div>
                    <Label>Teléfono *</Label>
                    <div className="flex gap-2">
                      <Select 
                        value={formData.phone_prefix} 
                        onValueChange={(v) => setFormData({ ...formData, phone_prefix: v })}
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
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                        placeholder="0000-0000"
                        className="flex-1"
                        data-testid="phone"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Formato: +505-0000-0000</p>
                  </div>

                  {/* Email (optional) */}
                  <div>
                    <Label>Email <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="cliente@email.com"
                    />
                  </div>

                  {/* Address (optional) */}
                  <div>
                    <Label>Dirección <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                    <Input
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Dirección del cliente"
                    />
                  </div>

                  {/* Credit Limit */}
                  {canManageCreditLimit ? (
                    <div>
                      <Label>Límite de Crédito (C$)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={formData.credit_limit}
                        onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                        placeholder="0.00"
                        data-testid="credit-limit"
                      />
                    </div>
                  ) : null}

                  {/* Add Vehicle Checkbox */}
                  <div className="flex items-center space-x-2 pt-2 border-t">
                    <Checkbox
                      id="add-vehicle"
                      checked={formData.add_vehicle}
                      disabled={isEditing}
                      onCheckedChange={(checked) => {
                        if (isEditing) return;
                        setFormData({ ...formData, add_vehicle: checked });
                        if (checked) setActiveTab("vehicle");
                      }}
                    />
                    <Label htmlFor="add-vehicle" className="cursor-pointer">
                      Registrar vehículo del cliente
                    </Label>
                  </div>
                </TabsContent>

                <TabsContent value="vehicle" className="space-y-4 mt-4">
                  {/* Plate */}
                  <div>
                    <Label>Placa *</Label>
                    <div className="flex gap-2">
                      <Select 
                        value={formData.plate_prefix} 
                        onValueChange={(v) => setFormData({ ...formData, plate_prefix: v, plate_number: "" })}
                      >
                        <SelectTrigger className="w-24" data-testid="plate-prefix">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PLATE_PREFIXES.map(prefix => (
                            <SelectItem key={prefix} value={prefix}>{prefix}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={formData.plate_number}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          plate_number: formatPlateNumber(formData.plate_prefix, e.target.value)
                        })}
                        placeholder={formData.plate_prefix === "M" ? "123 456" : "12345"}
                        className="flex-1 font-mono"
                        data-testid="plate-number"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formData.plate_prefix === "M" 
                        ? "Formato: M 123 456 (6 dígitos)" 
                        : `Formato: ${formData.plate_prefix} 12345 (4-5 dígitos)`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="use-vin-decoder-new-vehicle"
                      checked={useVinDecoderNewVehicle}
                      onCheckedChange={(checked) => setUseVinDecoderNewVehicle(Boolean(checked))}
                    />
                    <Label htmlFor="use-vin-decoder-new-vehicle">Usar decodificador VIN</Label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[1fr_0.8fr_1.9fr] gap-4">
                    <div>
                      <Label>Marca *</Label>
                      <SearchableSelect
                        value={formData.brand}
                        onChange={(v) => setFormData({ ...formData, brand: v, year: "", model: "" })}
                        options={VEHICLE_CATALOG_BRANDS}
                        placeholder="Seleccionar marca"
                        searchPlaceholder="Buscar marca..."
                      />
                    </div>

                    <div>
                      <Label>Año *</Label>
                      <SearchableSelect
                        value={String(formData.year || "")}
                        onChange={(v) => setFormData({ ...formData, year: v, model: "" })}
                        options={formYearOptions}
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
                        options={formBrandModelOptions}
                        placeholder="Seleccionar modelo"
                        searchPlaceholder="Buscar modelo..."
                        disabled={!formData.brand || !formData.year}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Color</Label>
                    <Input
                      list="customers-color-options"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      placeholder="Escribe para sugerencias de color"
                    />
                    <datalist id="customers-color-options">
                      {VEHICLE_COLOR_SUGGESTIONS.map((color) => (
                        <option key={color} value={color} />
                      ))}
                    </datalist>
                  </div>

                  {/* Chasis */}
                  <div>
                    <Label>CHASIS (VIN)</Label>
                    <Input
                      value={formData.chasis}
                      onChange={(e) => setFormData({ ...formData, chasis: formatChasis(e.target.value) })}
                      placeholder="1HGBH41JXMN109186"
                      className="font-mono"
                      maxLength={17}
                      data-testid="vehicle-chasis"
                    />
                    {useVinDecoderNewVehicle && (
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-2"
                        onClick={decodeNewVehicleVin}
                        disabled={isDecodingVinNewVehicle || formData.chasis.length !== 17}
                      >
                        {isDecodingVinNewVehicle ? "Decodificando VIN..." : "Decodificar VIN"}
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      17 caracteres alfanuméricos (sin I, O, Q, Ñ). {formData.chasis.length}/17
                    </p>
                  </div>
                </TabsContent>
              </Tabs>

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
                        <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId} disabled={isAddingVehicle}>
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
          <Button variant="outline" onClick={() => setShowManageTemplates(true)}>
            Plantillas WA
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

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, teléfono, email o cédula..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="search-customers"
        />
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">TOTAL CLIENTES</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold">{customers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">CON CRÉDITO</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold text-blue-500">
              {customers.filter(c => c.credit_limit > 0).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">PERSONA NATURAL</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold text-green-500">
              {customers.filter(c => c.customer_type !== "empresa").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">EMPRESAS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold text-purple-500">
              {customers.filter(c => c.customer_type === "empresa").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customers Cards */}
      <div>
        {loading ? (
          <div className="text-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto" />
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No se encontraron clientes</div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {filteredCustomers.map(customer => (
              <Card key={customer.customer_id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div>
                      <div className="text-lg font-semibold">{customer.name}</div>
                      <div className="text-sm text-muted-foreground">{customer.phone || '-'}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">{customer.tax_id || '-'}</div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-2 text-sm">{customer.email || '-'}</div>
                  <div className="mb-2 text-sm text-muted-foreground">Última compra: {formatShortDate(customer.last_purchase_date)}</div>
                  <div className="flex gap-2 flex-wrap mb-3">
                    {(() => {
                      const list = vehiclesByCustomer[customer.customer_id] || [];
                      if (!list.length) return <div className="text-xs text-muted-foreground">Sin vehículos</div>;
                      const maxShow = 4;
                      return (
                        <>
                          {list.slice(0, maxShow).map(v => (
                            <button key={v.vehicle_id} onClick={() => openVehicleActions(v, customer)} className="p-0 m-0">
                              <Badge variant="outline" className="font-mono cursor-pointer text-lg py-1 px-2">{v.plate} • {v.brand} {v.model} {v.year ? `• ${v.year}` : ''}{v.color ? ` • ${v.color}` : ''}{v.vin ? ` • ${v.vin}` : ''}</Badge>
                            </button>
                          ))}
                          {list.length > maxShow && (
                            <Button variant="ghost" size="sm" onClick={() => { setModalVehicles(list); setShowVehiclesModal(true); }}>
                              +{list.length - maxShow} más
                            </Button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Badge variant={customer.customer_type === "empresa" ? "default" : "secondary"}>
                        {customer.customer_type === "empresa" ? (
                          <><Building2 className="h-3 w-3 mr-1" /> Empresa</>
                        ) : (
                          <><User className="h-3 w-3 mr-1" /> Natural</>
                        )}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1">
                                      <Select value={getTemplateForCustomer(customer.customer_id)} onValueChange={(v) => setTemplateForCustomer(customer.customer_id, v)}>
                                        <SelectTrigger className="w-48 h-8 text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {waTemplates.map(t => (
                                            <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <Button variant="outline" size="icon" title="Editar mensaje" onClick={() => editCustomMessageForCustomer(customer.customer_id)}>
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                    </div>
                                    {user?.role !== "bodegas" && (
                                      <Button variant="outline" size="icon" title="Contactar por WhatsApp" onClick={() => sendWhatsAppWithTemplate(customer)}>
                                        <Phone className="h-4 w-4" />
                                      </Button>
                                    )}
                                    <Button variant="ghost" size="icon" title="Editar cliente" onClick={() => openEditCustomer(customer)} disabled={!canEditCustomers}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="destructive" size="icon" title="Eliminar cliente" disabled={!canDeleteCustomers} onClick={async () => {
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
            ))}
          </div>
        )}
      </div>

      {/* Vehicles Modal */}
      <Dialog open={showVehiclesModal} onOpenChange={setShowVehiclesModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Vehículos del cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {modalVehicles.map(v => (
              <Card key={v.vehicle_id}>
                <CardContent className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{v.plate} — {v.brand} {v.model}</div>
                    <div className="text-xs text-muted-foreground">{v.year} • {v.color || '-'} • {v.vin || '-'}</div>
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
