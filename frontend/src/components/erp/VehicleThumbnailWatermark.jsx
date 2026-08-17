import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/context/ThemeContext";
import { getVehicleWatermarkUrl, getWatermarkConfidenceMultiplier } from "@/lib/vehicleThumbnail";

export function VehicleThumbnailWatermark({
  vehicle,
  className,
  opacityClassName,
  positionClassName = "right-[-2%] top-1/2 h-[72%] w-[58%] -translate-y-1/2",
}) {
  const { watermarkOpacity } = useTheme();

  const watermarkData = useMemo(() => {
    try {
      if (!vehicle) return { url: null, confidence: 0.65 };
      const url = getVehicleWatermarkUrl(vehicle);
      const confidence = getWatermarkConfidenceMultiplier(vehicle);
      return { url, confidence: Number.isFinite(confidence) ? confidence : 0.65 };
    } catch (_) {
      return { url: null, confidence: 0.65 };
    }
  }, [vehicle]);

  const resolvedOpacity = useMemo(() => {
    if (opacityClassName) return null;
    const base = Number.isFinite(watermarkOpacity) ? watermarkOpacity : 0.13;
    return Math.min(0.3, Math.max(0.04, base * watermarkData.confidence));
  }, [opacityClassName, watermarkOpacity, watermarkData.confidence]);

  if (!watermarkData.url) return null;

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      aria-hidden="true"
    >
      <div
        className={cn(
          "absolute bg-contain bg-right bg-no-repeat mix-blend-multiply dark:mix-blend-screen",
          opacityClassName,
          positionClassName
        )}
        style={{
          backgroundImage: `url("${watermarkData.url}")`,
          ...(resolvedOpacity != null ? { opacity: resolvedOpacity } : {}),
        }}
      />
    </div>
  );
}

export default VehicleThumbnailWatermark;