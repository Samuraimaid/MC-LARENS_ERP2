import React from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VEHICLE_CAB_VARIANTS } from "@/lib/vehicleCabVariant";

export function VehicleCabVariantSelect({
  value,
  onChange,
  disabled = false,
  className = "",
  hint = "Selecciona el tipo de cabina para mostrar la silueta correcta.",
}) {
  return (
    <div className={className}>
      <Label>Tipo de cabina *</Label>
      <Select value={value || ""} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder="Seleccionar cabina" />
        </SelectTrigger>
        <SelectContent>
          {VEHICLE_CAB_VARIANTS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground mt-1">{hint}</p>
    </div>
  );
}