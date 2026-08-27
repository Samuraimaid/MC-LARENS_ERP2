import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const OFFICIAL_BRANDS = [
  { id: "ds18", name: "DS18 Audio", logo: "/brands/ds18.png" },
  { id: "fox", name: "FOX Shox", logo: "/brands/fox.png" },
  { id: "pioneer", name: "Pioneer", logo: "/brands/pioneer.jpg" },
  { id: "solargard", name: "Solar Gard", logo: "/brands/solargard.png" },
  { id: "3m", name: "3M Automotive", logo: "/brands/3m.png" },
  { id: "keko", name: "KEKO Accesorios", logo: "/brands/keko.jpg" },
  { id: "auxbeam", name: "AUXBEAM", logo: "/brands/auxbeam.jpg" },
  { id: "dlaa", name: "DLAA", logo: "/brands/dlaa.png" },
];

/**
 * BrandMosaicLoader Component
 * Modern automotive brand mosaic loading screen displaying official partner brands:
 * DS18, FOX, Pioneer, Solar Gard, 3M, KEKO, AUXBEAM, DLAA.
 * 
 * @param {Object} props
 * @param {'fullscreen' | 'modal' | 'inline' | 'mini'} [props.variant='modal']
 * @param {number} [props.progress] - Optional 0 to 100 progress percentage
 * @param {string} [props.statusText='Cargando catálogo e inventario...']
 * @param {string} [props.className]
 */
export default function BrandMosaicLoader({
  variant = "modal",
  progress,
  statusText = "Cargando catálogo e inventario...",
  className = "",
}) {
  const isManual = typeof progress === "number" && !isNaN(progress);
  const clampedProgress = isManual ? Math.max(0, Math.min(100, progress)) : null;

  const [activeHighlightIdx, setActiveHighlightIdx] = useState(0);

  // Automatic wave animation across the mosaic tiles
  useEffect(() => {
    if (isManual) return undefined;
    const interval = setInterval(() => {
      setActiveHighlightIdx((prev) => (prev + 1) % OFFICIAL_BRANDS.length);
    }, 450);
    return () => clearInterval(interval);
  }, [isManual]);

  // If manual progress is provided, calculate highlighted tiles
  const getIsTileHighlighted = (index) => {
    if (isManual) {
      const targetIdx = Math.min(
        OFFICIAL_BRANDS.length - 1,
        Math.floor((clampedProgress / 100) * OFFICIAL_BRANDS.length)
      );
      return index <= targetIdx;
    }
    return (
      index === activeHighlightIdx ||
      index === (activeHighlightIdx + 1) % OFFICIAL_BRANDS.length
    );
  };

  const [failedImages, setFailedImages] = useState({});

  const handleImageError = (brandId) => {
    setFailedImages((prev) => ({ ...prev, [brandId]: true }));
  };

  // 1. MINI TOPBAR VARIANT
  if (variant === "mini") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2.5 rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-400 shadow-sm backdrop-blur-md animate-fade-in dark:border-sky-500/40 dark:bg-sky-950/40",
          className
        )}
      >
        <div className="flex items-center -space-x-1.5 overflow-hidden">
          {OFFICIAL_BRANDS.slice(0, 3).map((brand) => (
            <div
              key={brand.id}
              className="h-4 w-4 rounded-full bg-white p-0.5 border border-sky-400 flex items-center justify-center overflow-hidden"
            >
              {!failedImages[brand.id] ? (
                <img
                  src={brand.logo}
                  alt={brand.name}
                  className="max-h-full max-w-full object-contain"
                  onError={() => handleImageError(brand.id)}
                />
              ) : (
                <span className="text-[7px] font-black text-slate-800">{brand.name.slice(0, 2)}</span>
              )}
            </div>
          ))}
        </div>
        <span className="truncate">{statusText}</span>
      </div>
    );
  }

  // 2. MAIN MOSAIC CARD (MODAL / FULLSCREEN / INLINE)
  const cardContent = (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center p-6 sm:p-8 text-center select-none max-w-xl w-full",
        variant === "modal" && "rounded-3xl border border-white/15 bg-slate-950/90 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/95",
        variant === "fullscreen" && "rounded-3xl border border-white/15 bg-slate-950/95 p-8 sm:p-10 shadow-2xl backdrop-blur-3xl",
        className
      )}
    >
      {/* Brand Header */}
      <div className="flex flex-col items-center gap-1 mb-6">
        <h2 className="font-heading text-2xl sm:text-3xl font-black italic tracking-wide text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-yellow-400 to-amber-500 drop-shadow">
          MUNDO DE ACCESORIOS
        </h2>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-500/10 px-3.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-sky-400 shadow-sm">
          <span>★</span> Distribuidores Oficiales <span>★</span>
        </div>
      </div>

      {/* 🧱 8-Brand Mosaic Grid */}
      <div className="grid grid-cols-4 gap-2.5 sm:gap-3 w-full mb-6">
        {OFFICIAL_BRANDS.map((brand, idx) => {
          const isHighlighted = getIsTileHighlighted(idx);
          const hasError = failedImages[brand.id];
          return (
            <div
              key={brand.id}
              title={brand.name}
              className={cn(
                "relative flex h-16 sm:h-20 items-center justify-center rounded-2xl bg-white p-2 shadow-md transition-all duration-300 overflow-hidden border-2",
                isHighlighted
                  ? "border-sky-400 shadow-[0_0_18px_rgba(0,210,255,0.6)] scale-[1.04] -translate-y-0.5"
                  : "border-transparent opacity-85 hover:opacity-100"
              )}
            >
              {!hasError ? (
                <img
                  src={brand.logo}
                  alt={brand.name}
                  className="max-h-full max-w-full object-contain drop-shadow-sm transition-transform duration-300"
                  style={isHighlighted ? { transform: "scale(1.08)" } : undefined}
                  onError={() => handleImageError(brand.id)}
                  loading="eager"
                />
              ) : (
                <span className="font-black text-slate-900 text-xs sm:text-sm tracking-tight px-1 select-none">
                  {brand.name}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Status & Progress Bar */}
      <div className="w-full flex flex-col items-center gap-2">
        <div className="flex items-center gap-1.5 text-sm sm:text-base font-bold text-sky-400">
          <span>{statusText}</span>
          <span className="inline-flex">
            <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
            <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
            <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
          </span>
        </div>

        <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden border border-white/5 shadow-inner">
          <div
            className={cn(
              "h-full rounded-full bg-gradient-to-r from-sky-400 via-yellow-400 to-amber-500 shadow-[0_0_10px_rgba(0,210,255,0.8)]",
              !isManual ? "w-3/4 animate-pulse" : "transition-all duration-150"
            )}
            style={isManual ? { width: `${clampedProgress}%` } : undefined}
          />
        </div>

        <div className="font-mono text-xs text-slate-400 tracking-wider">
          {isManual
            ? `SINCRONIZANDO MARCAS (${Math.round(clampedProgress)}%)`
            : "SINCRONIZANDO MARCAS Y PRODUCTOS"}
        </div>
      </div>
    </div>
  );

  if (variant === "fullscreen") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xl animate-fade-in">
        {cardContent}
      </div>
    );
  }

  return cardContent;
}
