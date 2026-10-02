import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Trash2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { ContextualDialogHeader } from "@/components/ui/contextual-dialog-header";
import { DestructiveConfirmDialog } from "@/components/destructive";
import SearchableSelect from "@/components/ui/searchable-select";
import CustomerVehicleFormTabs from "@/components/customers/CustomerVehicleFormTabs";
import { API_BASE as API } from "@/lib/api";
import { humanApiError } from "@/lib/humanApiError";
import { formatCurrency } from "@/lib/utils";
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
import { playCreationSuccessSound, playSelectionFeedbackSound } from "@/lib/uiSounds";

// Prefijos de placa Nicaragua
const PLATE_PREFIXES = [
  "M", "LE", "CH", "MY", "GR", "CZ", "MT", "BO", "CT", "RI", 
  "NS", "ES", "MZ", "JI", "RS", "AN", "AS", "TM", "ZC", "PN", 
  "EN", "CD", "MI", "OI"
];

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

const DEFAULT_FORM_DATA = {
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
};

const DEFAULT_VEHICLE_FORM = {
  plate_prefix: "M",
  plate_number: "",
  vin: "",
  brand: "",
  model: "",
  year: "",
  color: "",
};

export default function CustomerDialog({
  open = false,
  onOpenChange,
  customer = null, // null for create, object for edit
  onCustomerSaved,
  canCreate = true,
  canEdit = true,
  canDelete = false,
  canManageCreditLimit = false,
  canManagePricingProfile = false,
}) {
  const isEditing = Boolean(customer?.customer_id);
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);
  const [activeTab, setActiveTab] = useState("customer");
  const [validationResetKey, setValidationResetKey] = useState(0);
  const [validationSubmitSignal, setValidationSubmitSignal] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Credit limit authorization
  const [showCreditAuth, setShowCreditAuth] = useState(false);
  const [creditAuthCode, setCreditAuthCode] = useState("");
  const [pendingCreditLimit, setPendingCreditLimit] = useState(0);

  // Vehicle management inside edit modal
  const [customerVehicles, setCustomerVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [isAddingVehicle, setIsAddingVehicle] = useState(false);
  const [showDeleteVehicle, setShowDeleteVehicle] = useState(false);
  const [useVinDecoderNewVehicle, setUseVinDecoderNewVehicle] = useState(false);
  const [useVinDecoderEditVehicle, setUseVinDecoderEditVehicle] = useState(false);
  const [isDecodingVinNewVehicle, setIsDecodingVinNewVehicle] = useState(false);
  const [isDecodingVinEditVehicle, setIsDecodingVinEditVehicle] = useState(false);
  const [vehicleForm, setVehicleForm] = useState(DEFAULT_VEHICLE_FORM);

  const resetLocalForm = () => {
    setValidationResetKey((k) => k + 1);
    setFormData(DEFAULT_FORM_DATA);
    setVehicleForm(DEFAULT_VEHICLE_FORM);
    setCustomerVehicles([]);
    setSelectedVehicleId("");
    setIsAddingVehicle(false);
    setActiveTab("customer");
    setCreditAuthCode("");
    setPendingCreditLimit(0);
    setUseVinDecoderNewVehicle(false);
    setUseVinDecoderEditVehicle(false);
  };

  const setVehicleFormFromVehicle = (vehicle) => {
    if (!vehicle) return;
    const rawPlate = vehicle.plate || "";
    let prefix = "M";
    let number = "";
    if (rawPlate.startsWith("M ")) {
      prefix = "M";
      number = rawPlate.replace(/^M\s*/, "");
    } else {
      const parts = rawPlate.split(" ");
      if (parts.length > 1 && PLATE_PREFIXES.includes(parts[0])) {
        prefix = parts[0];
        number = parts.slice(1).join(" ");
      } else {
        number = rawPlate;
      }
    }
    setVehicleForm({
      plate_prefix: prefix,
      plate_number: number,
      vin: formatChasis(vehicle.vin || ""),
      brand: vehicle.brand || "",
      model: vehicle.model || "",
      year: vehicle.year ? String(vehicle.year) : "",
      color: vehicle.color || "",
    });
  };

  // Sync state when dialog opens or customer prop changes
  useEffect(() => {
    if (open) {
      if (customer?.customer_id) {
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
        setCreditAuthCode("");
        setPendingCreditLimit(0);

        // Fetch customer vehicles
        axios
          .get(`${API}/vehicles?customer_id=${customer.customer_id}`, { withCredentials: true })
          .then((res) => {
            const vehicles = Array.isArray(res.data) ? res.data : [];
            setCustomerVehicles(vehicles);
            if (vehicles.length > 0) {
              setSelectedVehicleId(vehicles[0].vehicle_id);
              setVehicleFormFromVehicle(vehicles[0]);
              setIsAddingVehicle(false);
            } else {
              setSelectedVehicleId("");
              setIsAddingVehicle(true);
              setVehicleForm(DEFAULT_VEHICLE_FORM);
            }
          })
          .catch(() => {
            setCustomerVehicles([]);
            setSelectedVehicleId("");
          });
      } else {
        resetLocalForm();
      }
    }
  }, [open, customer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedVehicleId || !customerVehicles.length) return;
    const vehicle = customerVehicles.find((v) => v.vehicle_id === selectedVehicleId);
    if (vehicle) {
      setVehicleFormFromVehicle(vehicle);
    }
  }, [selectedVehicleId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const decodeNewVehicleVin = async () => {
    const vin = formatChasis(formData.chasis || "");
    if (vin.length !== 17) {
      toast.error("Ingresa un VIN válido de 17 caracteres");
      return;
    }
    try {
      setIsDecodingVinNewVehicle(true);
      const response = await axios.get(`${API}/vehicles/decode-vin`, {
        params: { vin },
        withCredentials: true,
      });
      const decoded = response.data;
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
    const vin = formatChasis(vehicleForm.vin || "");
    if (vin.length !== 17) {
      toast.error("Ingresa un VIN válido de 17 caracteres");
      return;
    }
    try {
      setIsDecodingVinEditVehicle(true);
      const response = await axios.get(`${API}/vehicles/decode-vin`, {
        params: { vin },
        withCredentials: true,
      });
      const decoded = response.data;
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

  const requestCreditAuthorization = async () => {
    try {
      const response = await axios.post(`${API}/auth/manager/generate-code`, null, {
        params: { reason: "Autorización de límite de crédito" },
        withCredentials: true,
      });
      toast.success(`Código generado: ${response.data.code}`);
      setCreditAuthCode(response.data.code);
    } catch (error) {
      toast.error("Error al generar código. ¿Eres gerente?");
    }
  };

  const handleSaveCustomer = async () => {
    if (isEditing && !canEdit) {
      toast.error("No tienes permiso para editar clientes");
      return;
    }
    if (!isEditing && !canCreate) {
      toast.error("No tienes permiso para crear clientes");
      return;
    }

    setValidationSubmitSignal((n) => n + 1);
    const isCompany = formData.customer_type === "empresa";
    const nameMissing = !String(formData.first_name || "").trim();
    const lastMissing = !isCompany && !String(formData.last_name || "").trim();
    const phoneMissing = !String(formData.phone || "").trim();
    if (nameMissing || lastMissing || phoneMissing) {
      toast.error(
        isCompany
          ? "Nombre de empresa y teléfono son requeridos"
          : "Nombres, apellidos y teléfono son requeridos"
      );
      return;
    }

    if (formData.customer_type === "empresa" && !String(formData.tax_id || "").trim()) {
      toast.error("El RUC es requerido para registrar una empresa");
      return;
    }

    if (formData.credit_limit > 0 && !canManageCreditLimit) {
      if (!creditAuthCode) {
        setShowCreditAuth(true);
        setPendingCreditLimit(formData.credit_limit);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const fullName = `${formData.first_name} ${formData.last_name}`.trim();
      const fullPhone = `${formData.phone_prefix}-${formData.phone}`;

      const customerPayload = {
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

      if (isEditing) {
        await axios.put(`${API}/customers/${customer.customer_id}`, customerPayload, {
          withCredentials: true,
        });
        toast.success("Cliente actualizado exitosamente");
      } else {
        const customerRes = await axios.post(`${API}/customers`, customerPayload, {
          withCredentials: true,
        });
        const customerId = customerRes.data.customer_id;
        toast.success("Cliente creado exitosamente");
        playCreationSuccessSound();

        // Create vehicle if selected
        if (formData.add_vehicle && formData.brand && formData.model) {
          if (!formData.year) {
            toast.error("Selecciona el año del vehículo");
          } else if (!isValidVehicleSelection(formData.brand, formData.year, formData.model)) {
            toast.error("Marca, año y modelo deben seleccionarse desde la lista");
          } else {
            const plateFormatted =
              formData.plate_prefix === "M"
                ? `M ${formData.plate_number}`
                : `${formData.plate_prefix} ${formData.plate_number}`;

            const vehicleData = {
              customer_id: customerId,
              plate: plateFormatted,
              brand: formData.brand,
              model: formData.model,
              year: parseInt(formData.year, 10) || new Date().getFullYear(),
              color: formData.color || null,
              vin: formData.chasis || null,
              vehicle_type: "sedan",
            };

            await axios.post(`${API}/vehicles`, vehicleData, { withCredentials: true }).catch(() => {});
          }
        }
      }

      onOpenChange(false);
      resetLocalForm();
      if (typeof onCustomerSaved === "function") {
        onCustomerSaved();
      }
    } catch (error) {
      toast.error(humanApiError(error, "No se pudo guardar el cliente — revisa los datos"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateVehicleInEdit = async () => {
    if (!canCreate) {
      toast.error("No tienes permiso para crear vehículos");
      return;
    }
    if (!customer?.customer_id) return;
    if (!vehicleForm.brand || !vehicleForm.year || !vehicleForm.model || !vehicleForm.plate_number) {
      toast.error("Completa placa, marca, año y modelo");
      return;
    }
    if (!isValidVehicleSelection(vehicleForm.brand, vehicleForm.year, vehicleForm.model)) {
      toast.error("Marca, año y modelo deben seleccionarse desde la lista");
      return;
    }
    try {
      const plateFormatted =
        vehicleForm.plate_prefix === "M"
          ? `M ${vehicleForm.plate_number}`
          : `${vehicleForm.plate_prefix} ${vehicleForm.plate_number}`;

      const payload = {
        customer_id: customer.customer_id,
        plate: plateFormatted,
        brand: vehicleForm.brand,
        model: vehicleForm.model,
        year: parseInt(vehicleForm.year, 10) || new Date().getFullYear(),
        color: vehicleForm.color || null,
        vin: vehicleForm.vin || null,
        vehicle_type: "sedan",
      };

      const response = await axios.post(`${API}/vehicles`, payload, { withCredentials: true });
      const newVehicle = response.data;
      toast.success("Vehículo agregado");
      playCreationSuccessSound();
      setCustomerVehicles((prev) => [newVehicle, ...prev]);
      if (newVehicle?.vehicle_id) {
        setSelectedVehicleId(newVehicle.vehicle_id);
        setIsAddingVehicle(false);
      }
    } catch (error) {
      toast.error(humanApiError(error, "No se pudo agregar el vehículo"));
    }
  };

  const handleUpdateVehicleInEdit = async () => {
    if (!canEdit) {
      toast.error("No tienes permiso para editar vehículos");
      return;
    }
    if (!selectedVehicleId) return;
    if (!vehicleForm.brand || !vehicleForm.year || !vehicleForm.model || !vehicleForm.plate_number) {
      toast.error("Completa placa, marca, año y modelo");
      return;
    }
    if (!isValidVehicleSelection(vehicleForm.brand, vehicleForm.year, vehicleForm.model)) {
      toast.error("Marca, año y modelo deben seleccionarse desde la lista");
      return;
    }
    try {
      const plateFormatted =
        vehicleForm.plate_prefix === "M"
          ? `M ${vehicleForm.plate_number}`
          : `${vehicleForm.plate_prefix} ${vehicleForm.plate_number}`;

      const changes = {
        plate: plateFormatted,
        vin: vehicleForm.vin || null,
        brand: vehicleForm.brand,
        model: vehicleForm.model,
        year: parseInt(vehicleForm.year, 10) || new Date().getFullYear(),
        color: vehicleForm.color || null,
      };

      const motivo = prompt("Ingrese el motivo de la solicitud (obligatorio):", "Corrección de datos");
      if (motivo === null) return;
      if (!motivo.trim()) {
        toast.error("El motivo es obligatorio");
        return;
      }
      await axios.post(
        `${API}/approvals`,
        {
          type: "edit_vehicle",
          payload: { vehicle_id: selectedVehicleId, changes },
          reason: motivo.trim(),
        },
        { withCredentials: true }
      );

      toast.success("Solicitud enviada para aprobación");
    } catch (error) {
      toast.error(humanApiError(error, "No se pudo enviar la solicitud"));
    }
  };

  const handleDeleteVehicleInEdit = async ({ reason } = {}) => {
    if (!canDelete) {
      toast.error("No tienes permiso para eliminar vehículos");
      return;
    }
    if (!selectedVehicleId) return;
    const motivoDel = String(reason || "").trim();
    if (!motivoDel) {
      toast.error("El motivo es obligatorio");
      return;
    }
    try {
      await axios.post(
        `${API}/approvals`,
        {
          type: "delete_vehicle",
          payload: { vehicle_id: selectedVehicleId },
          reason: motivoDel,
        },
        { withCredentials: true }
      );

      toast.success("Solicitud de eliminación enviada para aprobación");
      setShowDeleteVehicle(false);
    } catch (error) {
      toast.error(humanApiError(error, "No se pudo solicitar la eliminación"));
    }
  };

  const pendingDeleteVehiclePlate = (() => {
    const v = customerVehicles.find((x) => x.vehicle_id === selectedVehicleId);
    return String(v?.plate || "").trim();
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <ContextualDialogHeader
          variant="information"
          size="inline"
          title={isEditing ? "Editar Cliente" : "Nuevo Cliente"}
          description={
            isEditing
              ? "Actualiza los datos del cliente"
              : "Registra un nuevo cliente y opcionalmente su vehículo"
          }
        />

        <CustomerVehicleFormTabs
          formData={formData}
          onFormDataChange={setFormData}
          validationResetKey={validationResetKey}
          validationSubmitSignal={validationSubmitSignal}
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
                      {customerVehicles.map((vehicle) => (
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
                      setVehicleForm(DEFAULT_VEHICLE_FORM);
                    }}
                    disabled={!canCreate}
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
                      disabled={!canDelete}
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
                      onValueChange={(v) =>
                        setVehicleForm({ ...vehicleForm, plate_prefix: v, plate_number: "" })
                      }
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PLATE_PREFIXES.map((prefix) => (
                          <SelectItem key={prefix} value={prefix}>
                            {prefix}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={vehicleForm.plate_number}
                      onChange={(e) =>
                        setVehicleForm({
                          ...vehicleForm,
                          plate_number: formatPlateNumber(vehicleForm.plate_prefix, e.target.value),
                        })
                      }
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
                  onClick={isAddingVehicle ? handleCreateVehicleInEdit : handleUpdateVehicleInEdit}
                  disabled={
                    (isAddingVehicle && !canCreate) ||
                    (!isAddingVehicle && (!selectedVehicleId || !canEdit))
                  }
                >
                  {isAddingVehicle ? "Agregar vehículo" : "Guardar vehículo"}
                </Button>
              </>
            )}
          </div>
        )}

        <DestructiveConfirmDialog
          open={showDeleteVehicle}
          onOpenChange={setShowDeleteVehicle}
          title="Eliminar vehículo"
          description={
            pendingDeleteVehiclePlate
              ? `Se enviará una solicitud de aprobación para eliminar el vehículo «${pendingDeleteVehiclePlate}». Escribí la placa exacta para confirmar.`
              : "Se enviará una solicitud de aprobación para eliminar el vehículo seleccionado."
          }
          confirmVerb="Eliminar vehículo"
          cancelVerb="Conservar vehículo"
          requireReason
          reasonLabel="Motivo (obligatorio)"
          reasonPlaceholder="Ej. Vehículo duplicado"
          defaultReason="Vehículo duplicado"
          requireTypedPhrase={pendingDeleteVehiclePlate || selectedVehicleId || "ELIMINAR"}
          footnote="No hay soft-delete de vehículo en UI: va por aprobación. Sin papelera multi-día."
          onConfirm={async ({ reason } = {}) => {
            await handleDeleteVehicleInEdit({ reason });
          }}
          testId="customers-delete-vehicle"
        />

        {/* Credit Authorization Dialog */}
        <Dialog open={showCreditAuth} onOpenChange={setShowCreditAuth}>
          <DialogContent>
            <ContextualDialogHeader
              variant="warning"
              size="hero"
              icon={ShieldCheck}
              title="Autorización de Crédito"
              description={`Se requiere autorización del gerente para asignar límite de crédito de ${formatCurrency(pendingCreditLimit)}`}
            />
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
                  onClick={() => { setShowCreditAuth(false); handleSaveCustomer(); }}
                  disabled={!creditAuthCode}
                  className="flex-1"
                >
                  Asignar límite de crédito
                </Button>
              </div>
              <Button 
                variant="ghost" 
                onClick={() => { setFormData((prev) => ({ ...prev, credit_limit: 0 })); setShowCreditAuth(false); }}
                className="w-full"
              >
                Continuar sin límite de crédito
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="flex justify-end gap-2 pt-4 border-t mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSaveCustomer} disabled={isSubmitting} data-testid="save-customer-btn">
            {isEditing ? "Guardar Cambios" : "Crear Cliente"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
