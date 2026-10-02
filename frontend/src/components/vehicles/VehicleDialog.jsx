import React, { useState, useMemo, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ContextualDialogHeader } from "@/components/ui/contextual-dialog-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SearchableSelect from "@/components/ui/searchable-select";
import { API_BASE as API } from "@/lib/api";
import { humanApiError } from "@/lib/humanApiError";
import {
  getVehicleSelectOptionsByBrandYear,
  getVehicleYearsByBrand,
  getCatalogVehiclePayload,
  isPickupCatalogModel,
  isValidVehicleSelection,
  VEHICLE_CATALOG_BRANDS,
  VEHICLE_COLOR_SUGGESTIONS,
} from "@/lib/vehicleCatalog";
import { VehicleCabVariantSelect } from "@/components/erp/VehicleCabVariantSelect";
import { playCreationSuccessSound } from "@/lib/uiSounds";

const DEFAULT_FORM_DATA = {
  customer_id: "",
  plate: "",
  vin: "",
  brand: "",
  model: "",
  year: "",
  color: "",
  vehicle_cab_variant: "",
};

export default function VehicleDialog({
  open = false,
  onOpenChange,
  customers = [],
  onVehicleSaved,
}) {
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setFormData(DEFAULT_FORM_DATA);
    }
  }, [open]);

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

  const handleSaveVehicle = async () => {
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

    setIsSubmitting(true);
    try {
      const catalogVehicle = getCatalogVehiclePayload(formData.brand, formData.model, {
        vehicleCabVariant: formData.vehicle_cab_variant,
      }) || {};

      await axios.post(
        `${API}/vehicles`,
        {
          ...formData,
          year: parseInt(formData.year, 10) || new Date().getFullYear(),
          ...catalogVehicle,
        },
        { withCredentials: true }
      );

      toast.success("Vehículo registrado exitosamente");
      playCreationSuccessSound();
      onOpenChange(false);
      setFormData(DEFAULT_FORM_DATA);
      if (typeof onVehicleSaved === "function") {
        onVehicleSaved();
      }
    } catch (error) {
      toast.error(humanApiError(error, "No se pudo registrar el vehículo — revisa los datos e inténtalo de nuevo"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <ContextualDialogHeader
          variant="information"
          size="inline"
          title="Crear vehículo"
          description="Registra un nuevo vehículo asignado a un cliente para seguimiento de garantías y servicios."
        />
        <div className="space-y-4 pt-2">
          <div>
            <Label>Cliente *</Label>
            <Select
              value={formData.customer_id}
              onValueChange={(v) => setFormData({ ...formData, customer_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar cliente" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.customer_id} value={c.customer_id}>
                    {c.name} - {c.phone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                onChange={(v) =>
                  setFormData({
                    ...formData,
                    brand: v,
                    year: "",
                    model: "",
                    vehicle_cab_variant: "",
                  })
                }
                options={brandOptions}
                placeholder="Seleccionar marca"
                searchPlaceholder="Buscar marca..."
              />
            </div>
            <div>
              <Label>Año *</Label>
              <SearchableSelect
                value={String(formData.year || "")}
                onChange={(v) =>
                  setFormData({
                    ...formData,
                    year: v,
                    model: "",
                    vehicle_cab_variant: "",
                  })
                }
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
                onChange={(v) =>
                  setFormData({
                    ...formData,
                    model: v,
                    vehicle_cab_variant: "",
                  })
                }
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Color</Label>
              <Input
                list="vehicle-color-options-modal"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                placeholder="Blanco"
              />
              <datalist id="vehicle-color-options-modal">
                {VEHICLE_COLOR_SUGGESTIONS.map((color) => (
                  <option key={color} value={color} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleSaveVehicle} disabled={isSubmitting} data-testid="save-vehicle-btn">
              {isSubmitting ? "Registrando..." : "Crear vehículo"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
