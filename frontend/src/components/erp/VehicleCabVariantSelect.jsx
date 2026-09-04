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
  showLabel = true,
}) {
  return (
    <div className={className}>
      {showLabel && (
        <div className="flex items-center justify-between min-h-[18px] mb-1.5">
          <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Tipo de cabina *</Label>
        </div>
      )}
      <Select value={value || ""} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="h-9 text-xs">
          <SelectValue placeholder="Seleccionar cabina" />
        </SelectTrigger>
        <SelectContent>
          {VEHICLE_CAB_VARIANTS.map((option) => (
            <SelectItem key={option.value} value={option.value} className="text-xs">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}