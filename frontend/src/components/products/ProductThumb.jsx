import React, { useState, useEffect } from "react";
import { Package, Sparkles, Volume2, Lightbulb, Shield, Wrench, Droplet } from "lucide-react";
import { cn } from "@/lib/utils";
import { getProductImageUrl, uploadsToGcsUrl, brandInitials } from "@/lib/productImage";
import { getProductBrandLogo, formatCategoryLabel } from "@/lib/branding";

function getCategoryIcon(category) {
  const cat = String(category || "").toLowerCase();
  if (cat.includes("audio") || cat.includes("multimedia")) return Volume2;
  if (cat.includes("iluminacion") || cat.includes("faros") || cat.includes("led")) return Lightbulb;
  if (cat.includes("detailing") || cat.includes("cuidado") || cat.includes("limpieza")) return Sparkles;
  if (cat.includes("suspension") || cat.includes("alzas") || cat.includes("amortiguador")) return Wrench;
  if (cat.includes("lubricante") || cat.includes("fluido") || cat.includes("aceite")) return Droplet;
  if (cat.includes("4x4") || cat.includes("exterior") || cat.includes("defensa")) return Shield;
  return Package;
}

const SIZE_VARIANTS = {
  sm: "h-10 w-10 min-w-[2.5rem] rounded-md text-[11px]",
  md: "h-14 w-14 min-w-[3.5rem] sm:h-16 sm:w-16 rounded-lg text-xs",
  lg: "h-20 w-20 min-w-[5rem] sm:h-24 sm:w-24 rounded-xl text-sm",
  full: "w-full h-full rounded-xl text-sm",
  auto: "rounded-lg text-xs",
};

export default function ProductThumb({
  product = null,
  src = null,
  alt = "",
  brand = "",
  category = "",
  className = "",
  imgClassName = "",
  size = "md",
  retryGcs = true,
  showInitials = true,
  badge = null,
  onClick = null,
  loading = "lazy",
}) {
  const resolvedSrc = src || getProductImageUrl(product);
  const resolvedBrand = brand || product?.brand || "";
  const resolvedCategory = category || product?.category || "";
  const resolvedAlt = alt || product?.name || "Producto";

  const [currentSrc, setCurrentSrc] = useState(resolvedSrc);
  const [hasError, setHasError] = useState(false);
  const [triedGcsFallback, setTriedGcsFallback] = useState(false);

  useEffect(() => {
    setCurrentSrc(resolvedSrc);
    setHasError(!resolvedSrc);
    setTriedGcsFallback(false);
  }, [resolvedSrc]);

  const handleError = () => {
    if (
      retryGcs &&
      !triedGcsFallback &&
      currentSrc &&
      typeof currentSrc === "string" &&
      currentSrc.startsWith("/uploads/")
    ) {
      const gcsFallback = uploadsToGcsUrl(currentSrc);
      if (gcsFallback && gcsFallback !== currentSrc) {
        setTriedGcsFallback(true);
        setCurrentSrc(gcsFallback);
        return;
      }
    }
    setHasError(true);
  };

  const brandLogo = getProductBrandLogo(resolvedBrand);
  const IconComponent = getCategoryIcon(resolvedCategory);
  const initials = brandInitials(resolvedBrand);
  const sizeClass = SIZE_VARIANTS[size] || SIZE_VARIANTS.md;
  const isInteractive = typeof onClick === "function";

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative overflow-hidden bg-muted/30 dark:bg-muted/15 border border-border/70 flex items-center justify-center select-none shrink-0 transition-colors",
        sizeClass,
        isInteractive ? "cursor-pointer hover:border-primary/60 hover:shadow-xs" : "",
        className
      )}
    >
      {!hasError && currentSrc ? (
        <img
          src={currentSrc}
          alt={resolvedAlt}
          loading={loading}
          onError={handleError}
          className={cn("w-full h-full object-contain p-1", imgClassName)}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center p-1 text-center bg-linear-to-b from-muted/40 to-muted/10">
          {brandLogo ? (
            <div className="flex flex-col items-center justify-center max-w-[85%] max-h-[85%]">
              <img
                src={brandLogo}
                alt={resolvedBrand || "Marca"}
                className="max-h-full max-w-full object-contain opacity-85 drop-shadow-xs"
              />
            </div>
          ) : showInitials && initials && initials !== "?" ? (
            <div className="flex flex-col items-center justify-center gap-0.5 text-muted-foreground">
              <span className="font-mono font-black tracking-wider text-foreground/80 leading-none">
                {initials}
              </span>
              {size !== "sm" && resolvedBrand && (
                <span className="text-[9px] font-medium text-muted-foreground/80 line-clamp-1 max-w-[90%] truncate">
                  {resolvedBrand}
                </span>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-muted-foreground/60">
              <IconComponent className="h-4 w-4" />
            </div>
          )}
        </div>
      )}

      {badge && <div className="absolute top-1 left-1 z-10">{badge}</div>}
    </div>
  );
}
