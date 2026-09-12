import React, { useState, useRef, useEffect } from "react";
import { Eye, Package, Sparkles, Volume2, Lightbulb, Shield, Wrench, Droplet } from "lucide-react";
import { cn } from "@/lib/utils";
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

export default function ProductImageHoverZoom({
  src,
  alt = "Producto",
  brand = "",
  category = "",
  onOpenQuickView,
  className = "",
  imageClassName = "",
  badge = null,
  showEyeButton = false,
  enableHoverPreview = true,
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [previewPos, setPreviewPos] = useState({ top: 0, left: 0 });
  const containerRef = useRef(null);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const brandLogo = getProductBrandLogo(brand);
  const IconComponent = getCategoryIcon(category);
  const isImageValid = Boolean(src && !hasError);

  const handleMouseEnter = () => {
    if (!isImageValid) return;
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      const previewWidth = 240;
      const previewHeight = 240;

      let left = rect.right + 12;
      let top = rect.top - 15;

      // If overflows on right, place on left of the thumbnail
      if (left + previewWidth > viewportWidth - 16) {
        left = Math.max(16, rect.left - previewWidth - 12);
      }

      // Clamp vertical position within viewport
      if (top + previewHeight > viewportHeight - 16) {
        top = Math.max(16, viewportHeight - previewHeight - 16);
      }
      if (top < 16) {
        top = 16;
      }

      setPreviewPos({ top, left });
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative rounded-xl overflow-hidden bg-muted/30 border border-border/70 flex items-center justify-center group select-none transition-all duration-200",
        className
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Base Image or Styled Fallback */}
      {isImageValid ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setHasError(true)}
          className={cn(
            "w-full h-full object-contain p-1 transition-transform duration-300 ease-out group-hover:scale-110",
            imageClassName
          )}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-linear-to-b from-muted/40 to-muted/10">
          {brandLogo ? (
            <div className="flex flex-col items-center justify-center gap-1.5 max-w-[85%]">
              <img
                src={brandLogo}
                alt={brand || "Marca"}
                className="max-h-12 max-w-[120px] object-contain opacity-85 group-hover:opacity-100 group-hover:scale-105 transition-all drop-shadow-xs"
              />
              <span className="text-[10px] font-medium text-muted-foreground/80 line-clamp-1">
                {brand}
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-1 text-muted-foreground">
              <div className="h-10 w-10 rounded-xl bg-background/80 border border-border/60 shadow-xs flex items-center justify-center text-primary/80 group-hover:scale-110 transition-transform">
                <IconComponent className="h-5 w-5" />
              </div>
              {brand ? (
                <span className="text-[11px] font-bold tracking-tight text-foreground/90 font-mono mt-0.5">
                  {brand}
                </span>
              ) : (
                <span className="text-[10px] font-medium text-muted-foreground">
                  MCLARENS
                </span>
              )}
              {category && (
                <span className="text-[9px] text-muted-foreground/70 max-w-[140px] truncate">
                  {formatCategoryLabel(category)}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Floating Badge (e.g. Stock) */}
      {badge && <div className="absolute top-2 left-2 z-10">{badge}</div>}

      {/* Quick View Eye Button */}
      {showEyeButton && onOpenQuickView && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenQuickView();
          }}
          className={cn(
            "absolute top-1.5 right-1.5 z-20 h-6 w-6 rounded-full bg-background/90 hover:bg-primary hover:text-primary-foreground border shadow-xs flex items-center justify-center text-foreground transition-all duration-200",
            "opacity-0 group-hover:opacity-100 group-hover:scale-105 hover:scale-115"
          )}
          title="Ver detalles completos del producto"
          aria-label="Ver detalles completos del producto"
        >
          <Eye className="h-3 w-3" />
        </button>
      )}

      {/* Hover Floating Enlarged Zoom Overlay */}
      {isImageValid && enableHoverPreview && isHovered && (
        <div
          className="pointer-events-none fixed z-50 hidden md:flex flex-col rounded-2xl border border-sky-400/40 dark:border-sky-600/40 bg-white/98 dark:bg-zinc-950/98 p-2.5 shadow-2xl backdrop-blur-xl transition-all duration-200 animate-in fade-in-0 zoom-in-95 w-60 h-60 overflow-hidden"
          style={{
            top: `${previewPos.top}px`,
            left: `${previewPos.left}px`,
          }}
        >
          <div className="relative flex-1 w-full h-full rounded-xl overflow-hidden bg-slate-50 dark:bg-zinc-900/80 flex items-center justify-center p-2">
            <img
              src={src}
              alt={alt}
              className="max-w-full max-h-full object-contain drop-shadow-md"
            />
          </div>
          <div className="mt-1.5 bg-slate-900/85 dark:bg-zinc-900/90 backdrop-blur text-white text-[11px] font-medium py-1 px-2.5 rounded-lg truncate text-center shadow-xs">
            {alt}
          </div>
        </div>
      )}
    </div>
  );
}

