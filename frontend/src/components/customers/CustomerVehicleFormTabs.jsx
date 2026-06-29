import React from "react";
import { Building2, Car, User } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import SearchableSelect from "@/components/ui/searchable-select";
import { VehicleCabVariantSelect } from "@/components/erp/VehicleCabVariantSelect";
import { isPickupCatalogModel } from "@/lib/vehicleCatalog";

export default function CustomerVehicleFormTabs({
  formData,
  onFormDataChange,
  activeTab,
  onActiveTabChange,
  canManageCreditLimit,
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
  const updateForm = (patch) => {
    const next = { ...formData, ...patch };
    onFormDataChange(next);
    if (persistOnChange && onFormDataBlur) {
      onFormDataBlur(next);
    }
    return next;
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

      <TabsContent value="customer" className={customerContentClassName}>
        <div>
          <Label>Tipo de Cliente *</Label>
          <Select
            value={formData.customer_type}
            onValueChange={(value) => updateForm({ customer_type: value, tax_id: "" })}
          >
            <SelectTrigger data-testid={customerTypeTestId}>
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

        {isCompany ? (
          <div className="space-y-2">
            <Label>Nombre de la Empresa *</Label>
            <Input
              value={formData.first_name}
              onChange={(e) => updateForm({ first_name: e.target.value, last_name: "" })}
              onBlur={commitForm}
              placeholder="Empresa S.A."
              data-testid={firstNameTestId}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombres *</Label>
              <Input
                value={formData.first_name}
                onChange={(e) => updateForm({ first_name: e.target.value })}
                onBlur={commitForm}
                placeholder="Juan Carlos"
                data-testid={firstNameTestId}
              />
            </div>
            <div className="space-y-2">
              <Label>Apellidos *</Label>
              <Input
                value={formData.last_name}
                onChange={(e) => updateForm({ last_name: e.target.value })}
                onBlur={commitForm}
                placeholder="Pérez López"
                data-testid={lastNameTestId}
              />
            </div>
          </div>
        )}

        <div>
          <Label>{isCompany ? "RUC *" : "Cédula"}</Label>
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
            data-testid="tax-id"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {isCompany ? "Formato: J0000000000000" : "Formato: 001-000000-0000A"}
          </p>
        </div>

        <div>
          <Label>Teléfono *</Label>
          <div className="flex gap-2">
            <Select
              value={formData.phone_prefix}
              onValueChange={(value) => updateForm({ phone_prefix: value })}
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
              onChange={(e) => updateForm({ phone: formatPhone(e.target.value) })}
              onBlur={commitForm}
              placeholder="0000-0000"
              className="flex-1"
              data-testid={phoneTestId}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">Formato: +505-0000-0000</p>
        </div>

        <div>
          <Label>
            Email <span className="text-muted-foreground text-xs">(opcional)</span>
          </Label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => updateForm({ email: e.target.value })}
            onBlur={commitForm}
            placeholder="cliente@email.com"
          />
        </div>

        <div>
          <Label>
            Dirección <span className="text-muted-foreground text-xs">(opcional)</span>
          </Label>
          <Input
            value={formData.address}
            onChange={(e) => updateForm({ address: e.target.value })}
            onBlur={commitForm}
            placeholder="Dirección del cliente"
          />
        </div>

        {canManageCreditLimit ? (
          <div>
            <Label>Límite de Crédito (C$)</Label>
            <Input
              type="number"
              min="0"
              value={formData.credit_limit}
              onChange={(e) => updateForm({ credit_limit: e.target.value })}
              onBlur={commitForm}
              placeholder="0.00"
              data-testid={creditLimitTestId}
            />
          </div>
        ) : null}

        <div className="flex items-center space-x-2 pt-2 border-t">
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
          <Label htmlFor={addVehicleCheckboxId} className="cursor-pointer">
            {addVehicleLabel}
          </Label>
        </div>
      </TabsContent>

      <TabsContent value="vehicle" className={vehicleContentClassName}>
        <div>
          <Label>Placa *</Label>
          <div className="flex gap-2">
            <Select
              value={formData.plate_prefix}
              onValueChange={(value) => updateForm({ plate_prefix: value, plate_number: "" })}
            >
              <SelectTrigger className="w-24" data-testid={platePrefixTestId}>
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
              className="flex-1 font-mono"
              data-testid={plateNumberTestId}
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
            id={useVinCheckboxId}
            checked={useVinDecoder}
            onCheckedChange={(checked) => onUseVinDecoderChange(Boolean(checked))}
          />
          <Label htmlFor={useVinCheckboxId}>Usar decodificador VIN</Label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_0.8fr_1.9fr] gap-4">
          <div>
            <Label>Marca *</Label>
            <SearchableSelect
              value={formData.brand}
              onChange={(value) => updateForm({ brand: value, year: "", model: "", vehicle_cab_variant: "" })}
              options={vehicleBrands}
              placeholder="Seleccionar marca"
              searchPlaceholder="Buscar marca..."
            />
          </div>

          <div>
            <Label>Año *</Label>
            <SearchableSelect
              value={String(formData.year || "")}
              onChange={(value) => updateForm({ year: value, model: "", vehicle_cab_variant: "" })}
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
              onChange={(value) => updateForm({ model: value, vehicle_cab_variant: "" })}
              options={modelOptions}
              placeholder="Seleccionar modelo"
              searchPlaceholder="Buscar modelo..."
              disabled={!formData.brand || !formData.year}
            />
          </div>
        </div>

        {showCabVariant ? (
          <VehicleCabVariantSelect
            value={formData.vehicle_cab_variant}
            onChange={(value) => updateForm({ vehicle_cab_variant: value })}
          />
        ) : null}

        <div>
          <Label>Color</Label>
          <Input
            list={colorDatalistId}
            value={formData.color}
            onChange={(e) => updateForm({ color: e.target.value })}
            onBlur={commitForm}
            placeholder="Escribe para sugerencias de color"
          />
          <datalist id={colorDatalistId}>
            {colorSuggestions.map((color) => (
              <option key={color} value={color} />
            ))}
          </datalist>
        </div>

        <div>
          <Label>CHASIS (VIN)</Label>
          <Input
            value={formData.chasis}
            onChange={(e) => updateForm({ chasis: formatChasis(e.target.value) })}
            onBlur={commitForm}
            placeholder="1HGBH41JXMN109186"
            className="font-mono"
            maxLength={17}
            data-testid={vehicleChasisTestId}
          />
          {useVinDecoder ? (
            <Button
              type="button"
              variant="outline"
              className="mt-2"
              onClick={onDecodeVin}
              disabled={isDecodingVin || formData.chasis.length !== 17}
            >
              {isDecodingVin ? "Decodificando VIN..." : "Decodificar VIN"}
            </Button>
          ) : null}
          <p className="text-xs text-muted-foreground mt-1">
            17 caracteres alfanuméricos (sin I, O, Q, Ñ). {formData.chasis.length}/17
          </p>
        </div>
      </TabsContent>
    </Tabs>
  );
}
