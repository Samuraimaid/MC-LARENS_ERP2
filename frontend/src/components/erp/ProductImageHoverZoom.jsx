import React, { useState, useRef } from "react";
import { Eye, Package } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ProductImageHoverZoom({
  src,
  alt = "Producto",
  onOpenQuickView,
  className = "",
  imageClassName = "",
  badge = null,
  showEyeButton = false,
  enableHoverPreview = true,
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [previewPos, setPreviewPos] = useState({ top: 0, left: 0 });
  const containerRef = useRef(null);

  const handleMouseEnter = () => {
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
        "relative rounded-xl overflow-hidden bg-muted/40 border flex items-center justify-center group select-none transition-all duration-200",
        className
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Base Image */}
      {src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className={cn(
            "w-full h-full object-contain p-1 transition-transform duration-300 ease-out group-hover:scale-110",
            imageClassName
          )}
        />
      ) : (
        <div className="flex flex-col items-center justify-center text-muted-foreground text-xs gap-1.5 p-2">
          <Package className="h-6 w-6 opacity-40" />
          <span className="text-[10px]">Sin imagen</span>
        </div>
      )}

      {/* Floating Badge (e.g. Stock) */}
      {badge && <div className="absolute top-2 left-2 z-10">{badge}</div>}

      {/* Quick View Eye Button (Only rendered if explicitly showEyeButton=true) */}
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
      {src && enableHoverPreview && isHovered && (
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
