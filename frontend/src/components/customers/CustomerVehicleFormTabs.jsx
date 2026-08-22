import React, { useState } from "react";
import { Building2, Car, User, Camera, Sparkles } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import SearchableSelect from "@/components/ui/searchable-select";
import { VehicleCabVariantSelect } from "@/components/erp/VehicleCabVariantSelect";
import { isPickupCatalogModel } from "@/lib/vehicleCatalog";
import { PRICING_PROFILES } from "@/lib/priceTiers";
import CirculationCardOcrScannerModal from "@/components/vehicles/CirculationCardOcrScannerModal";

export default function CustomerVehicleFormTabs({
  formData,
  onFormDataChange,
  activeTab,
  onActiveTabChange,
  canManageCreditLimit,
  canManagePricingProfile = false,
  disableAddVehicle = false,
  addVehicleLabel = "Registrar vehículo del cliente",
  useVinDecoder = false,
  onUseVinDecoderChange,
  isDecodingVin = false,
  onDecodeVin,
  yearOptions = [],
  modelOptions = [],
  platePrefixes = [],
  vehicleBrands = [],
  colorSuggestions = [],
  formatPhone,
  formatCedula,
  formatRUC,
  formatChasis,
  formatPlateNumber,
  rootClassName = "",
  tabsListClassName = "",
  customerContentClassName = "space-y-4 mt-4",
  vehicleContentClassName = "space-y-4 mt-4",
  customerTypeTestId,
  firstNameTestId = "first-name",
  lastNameTestId = "last-name",
  phoneTestId = "phone",
  creditLimitTestId,
  platePrefixTestId,
  plateNumberTestId,
  vehicleChasisTestId,
  colorDatalistId = "customer-vehicle-color-options",
  addVehicleCheckboxId = "add-vehicle",
  useVinCheckboxId = "use-vin-decoder-new-vehicle",
  persistOnChange = false,
  onFormDataBlur,
}) {
  const [showOcrModal, setShowOcrModal] = useState(false);


  const updateForm = (patch) => {
    const next = { ...formData, ...patch };
    onFormDataChange(next);
    if (persistOnChange && onFormDataBlur) {
      onFormDataBlur(next);
    }
    return next;
  };

  const handleApplyOcr = (extractedData) => {
    if (!extractedData) return;
    const updates = {};
    if (extractedData.plate_prefix) updates.plate_prefix = extractedData.plate_prefix;
    if (extractedData.plate_number) updates.plate_number = extractedData.plate_number;
    if (extractedData.chasis) updates.chasis = extractedData.chasis;
    if (extractedData.brand) updates.brand = extractedData.brand;
    if (extractedData.model) updates.model = extractedData.model;
    if (extractedData.year) updates.year = extractedData.year;
    if (extractedData.color) updates.color = extractedData.color;
    updateForm(updates);
    setShowOcrModal(false);
  };

  const commitForm = () => {
    if (onFormDataBlur) {
      onFormDataBlur(formData);
    }
  };

  const isCompany = formData.customer_type === "empresa";
  const showCabVariant = isPickupCatalogModel(formData.brand, formData.model);


  return (
    <Tabs
      value={activeTab}
      onValueChange={onActiveTabChange}
      className={rootClassName}
    >
      <TabsList className={tabsListClassName || "grid w-full grid-cols-2"}>
        <TabsTrigger value="customer">
          <User className="h-4 w-4 mr-2" />
          Datos del Cliente
        </TabsTrigger>
        <TabsTrigger value="vehicle" disabled={!formData.add_vehicle}>
          <Car className="h-4 w-4 mr-2" />
          Vehículo
        </TabsTrigger>
      </TabsList>

      <TabsContent value="customer" className="mt-3 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
          {/* Columna 1: Tipo de Cliente */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Tipo de Cliente *</Label>
            <Select
              value={formData.customer_type}
              onValueChange={(value) => updateForm({ customer_type: value, tax_id: "" })}
            >
              <SelectTrigger data-testid={customerTypeTestId} className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="natural">
                  <span className="flex items-center gap-2 text-xs">
                    <User className="h-3.5 w-3.5" /> Persona Natural
                  </span>
                </SelectItem>
                <SelectItem value="empresa">
                  <span className="flex items-center gap-2 text-xs">
                    <Building2 className="h-3.5 w-3.5" /> Empresa
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Columna 2: Cédula o RUC */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{isCompany ? "RUC *" : "Cédula"}</Label>
              <span className="text-[10px] text-muted-foreground">
                {isCompany ? "Formato: J0000000000000" : "Formato: 001-000000-0000A"}
              </span>
            </div>
            <Input
              value={formData.tax_id}
              onChange={(e) =>
                updateForm({
                  tax_id: isCompany ? formatRUC(e.target.value) : formatCedula(e.target.value),
                })
              }
              onBlur={commitForm}
              placeholder={isCompany ? "J0000000000000" : "001-000000-0000A"}
              required={isCompany}
              className="h-9 font-mono text-xs"
              data-testid="tax-id"
            />
          </div>

          {/* Nombres / Empresa */}
          {isCompany ? (
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Nombre de la Empresa *</Label>
              <Input
                value={formData.first_name}
                onChange={(e) => updateForm({ first_name: e.target.value, last_name: "" })}
                onBlur={commitForm}
                placeholder="Empresa S.A."
                className="h-9 text-xs"
                data-testid={firstNameTestId}
              />
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Nombres *</Label>
                <Input
                  value={formData.first_name}
                  onChange={(e) => updateForm({ first_name: e.target.value })}
                  onBlur={commitForm}
                  placeholder="Juan Carlos"
                  className="h-9 text-xs"
                  data-testid={firstNameTestId}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Apellidos *</Label>
                <Input
                  value={formData.last_name}
                  onChange={(e) => updateForm({ last_name: e.target.value })}
                  onBlur={commitForm}
                  placeholder="Pérez López"
                  className="h-9 text-xs"
                  data-testid={lastNameTestId}
                />
              </div>
            </>
          )}

          {/* Teléfono */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Teléfono *</Label>
              <span className="text-[10px] text-muted-foreground">+505-0000-0000</span>
            </div>
            <div className="flex gap-2">
              <Select
                value={formData.phone_prefix}
                onValueChange={(value) => updateForm({ phone_prefix: value })}
              >
                <SelectTrigger className="w-24 h-9 text-xs">
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
                onChange={(e) => updateForm({ phone: formatPhone(e.target.value) })}
                onBlur={commitForm}
                placeholder="0000-0000"
                className="flex-1 h-9 font-mono text-xs"
                data-testid={phoneTestId}
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Email <span className="text-muted-foreground text-[10px] font-normal">(opcional)</span>
            </Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => updateForm({ email: e.target.value })}
              onBlur={commitForm}
              placeholder="cliente@email.com"
              className="h-9 text-xs"
            />
          </div>

          {/* Dirección */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Dirección <span className="text-muted-foreground text-[10px] font-normal">(opcional)</span>
            </Label>
            <Input
              value={formData.address}
              onChange={(e) => updateForm({ address: e.target.value })}
              onBlur={commitForm}
              placeholder="Dirección del cliente"
              className="h-9 text-xs"
            />
          </div>

          {/* Límite de Crédito o Perfil de Precios */}
          {canManageCreditLimit ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Límite de Crédito (C$)</Label>
              <Input
                type="number"
                min="0"
                value={formData.credit_limit}
                onChange={(e) => updateForm({ credit_limit: e.target.value })}
                onBlur={commitForm}
                placeholder="0.00"
                className="h-9 font-mono text-xs"
                data-testid={creditLimitTestId}
              />
            </div>
          ) : canManagePricingProfile ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Perfil de precios</Label>
              <Select
                value={formData.pricing_profile || "standard"}
                onValueChange={(value) => updateForm({ pricing_profile: value })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Seleccionar perfil" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRICING_PROFILES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {canManageCreditLimit && canManagePricingProfile ? (
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Perfil de precios</Label>
              <Select
                value={formData.pricing_profile || "standard"}
                onValueChange={(value) => updateForm({ pricing_profile: value })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Seleccionar perfil" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRICING_PROFILES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        {/* Checkbox de Registro de Vehículo en Banner Compacto */}
        <div className="flex items-center space-x-2.5 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <Checkbox
            id={addVehicleCheckboxId}
            checked={formData.add_vehicle}
            disabled={disableAddVehicle}
            onCheckedChange={(checked) => {
              if (disableAddVehicle) return;
              const enabled = Boolean(checked);
              updateForm({ add_vehicle: enabled });
              if (enabled) {
                onActiveTabChange("vehicle");
              }
            }}
          />
          <Label htmlFor={addVehicleCheckboxId} className="cursor-pointer text-xs font-medium text-zinc-800 dark:text-zinc-200">
            {addVehicleLabel}
          </Label>
        </div>
      </TabsContent>

      <TabsContent value="vehicle" className="mt-3 space-y-3">
        {/* Banner de Escaneo OCR de Tarjeta de Circulación */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50/60 dark:bg-sky-950/30">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400">
              <Camera className="h-3.5 w-3.5" />
            </div>
            <div>
              <span className="font-bold text-xs text-sky-900 dark:text-sky-200 block">
                Escaneo OCR de Tarjeta de Circulación
              </span>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                Lee Chasis (VIN), Placa, Marca y Color automáticamente
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => setShowOcrModal(true)}
            className="h-7 px-2.5 gap-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-[11px] shadow-sm shadow-sky-600/20"
          >
            <Sparkles className="h-3 w-3" />
            Escanear Tarjeta (OCR)
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
          {/* Placa */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Placa *</Label>
              <span className="text-[10px] text-muted-foreground">
                {formData.plate_prefix === "M" ? "M 123 456" : `${formData.plate_prefix || "M"} 12345`}
              </span>
            </div>
            <div className="flex gap-2">
              <Select
                value={formData.plate_prefix}
                onValueChange={(value) => updateForm({ plate_prefix: value, plate_number: "" })}
              >
                <SelectTrigger className="w-24 h-9 text-xs" data-testid={platePrefixTestId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {platePrefixes.map((prefix) => (
                    <SelectItem key={prefix} value={prefix}>
                      {prefix}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={formData.plate_number}
                onChange={(e) =>
                  updateForm({ plate_number: formatPlateNumber(formData.plate_prefix, e.target.value) })
                }
                onBlur={commitForm}
                placeholder={formData.plate_prefix === "M" ? "123 456" : "12345"}
                className="flex-1 h-9 font-mono text-xs"
                data-testid={plateNumberTestId}
              />
            </div>
          </div>

          {/* Chasis VIN */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">CHASIS (VIN)</Label>
              <span className="text-[10px] text-muted-foreground">{formData.chasis?.length || 0}/17 caracteres</span>
            </div>
            <div className="flex gap-2">
              <Input
                value={formData.chasis}
                onChange={(e) => updateForm({ chasis: formatChasis(e.target.value) })}
                onBlur={commitForm}
                placeholder="1HGBH41JXMN109186"
                className="flex-1 h-9 font-mono text-xs uppercase"
                maxLength={17}
                data-testid={vehicleChasisTestId}
              />
              {useVinDecoder && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 px-2.5 text-xs whitespace-nowrap"
                  onClick={onDecodeVin}
                  disabled={isDecodingVin || formData.chasis?.length !== 17}
                >
                  {isDecodingVin ? "Decodificando..." : "Decodificar"}
                </Button>
              )}
            </div>
          </div>

          {/* Marca */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Marca *</Label>
            <SearchableSelect
              value={formData.brand}
              onChange={(value) => updateForm({ brand: value, year: "", model: "", vehicle_cab_variant: "" })}
              options={vehicleBrands}
              placeholder="Seleccionar marca"
              searchPlaceholder="Buscar marca..."
              className="h-9 text-xs"
            />
          </div>

          {/* Año y Modelo en 2 sub-columnas */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Año *</Label>
              <SearchableSelect
                value={String(formData.year || "")}
                onChange={(value) => updateForm({ year: value, model: "", vehicle_cab_variant: "" })}
                options={yearOptions}
                placeholder="Año"
                searchPlaceholder="Buscar..."
                disabled={!formData.brand}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Modelo *</Label>
              <SearchableSelect
                value={formData.model}
                onChange={(value) => updateForm({ model: value, vehicle_cab_variant: "" })}
                options={modelOptions}
                placeholder="Modelo"
                searchPlaceholder="Buscar..."
                disabled={!formData.brand || !formData.year}
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Color</Label>
            <Input
              list={colorDatalistId}
              value={formData.color}
              onChange={(e) => updateForm({ color: e.target.value })}
              onBlur={commitForm}
              placeholder="Escribe para sugerencias de color"
              className="h-9 text-xs"
            />
            <datalist id={colorDatalistId}>
              {colorSuggestions.map((color) => (
                <option key={color} value={color} />
              ))}
            </datalist>
          </div>

          {/* Variante de Cabina (si aplica) o Decodificador VIN Checkbox */}
          <div className="space-y-1.5 flex flex-col justify-end">
            {showCabVariant ? (
              <VehicleCabVariantSelect
                value={formData.vehicle_cab_variant}
                onChange={(value) => updateForm({ vehicle_cab_variant: value })}
              />
            ) : (
              <div className="flex items-center gap-2 h-9 px-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <Checkbox
                  id={useVinCheckboxId}
                  checked={useVinDecoder}
                  onCheckedChange={(checked) => onUseVinDecoderChange(Boolean(checked))}
                />
                <Label htmlFor={useVinCheckboxId} className="text-xs cursor-pointer">Usar decodificador VIN automático</Label>
              </div>
            )}
          </div>
        </div>
      </TabsContent>

      <CirculationCardOcrScannerModal
        isOpen={showOcrModal}
        onClose={() => setShowOcrModal(false)}
        onApply={handleApplyOcr}
      />
    </Tabs>

  );
}
