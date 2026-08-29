import React, { useState } from "react";
import { Eye, Package } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ProductImageHoverZoom({
  src,
  alt = "Producto",
  onOpenQuickView,
  className = "",
  imageClassName = "",
  badge = null,
  showEyeButton = true,
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={cn(
        "relative rounded-xl overflow-hidden bg-muted/40 border flex items-center justify-center group select-none",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Base Image */}
      {src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className={cn(
            "w-full h-full object-contain transition-transform duration-300 group-hover:scale-110",
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

      {/* Quick View Eye Button */}
      {showEyeButton && onOpenQuickView && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenQuickView();
          }}
          className={cn(
            "absolute top-2 right-2 z-20 h-7 w-7 rounded-full bg-background/90 hover:bg-primary hover:text-primary-foreground border shadow-md flex items-center justify-center text-foreground transition-all duration-200",
            "opacity-80 group-hover:opacity-100 group-hover:scale-110 hover:scale-125"
          )}
          title="Ver características completas y fotos"
          aria-label="Ver características completas y fotos"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Hover Floating Enlarged Zoom Overlay */}
      {src && isHovered && (
        <div className="pointer-events-none fixed z-50 hidden md:block rounded-2xl border-2 border-primary/30 bg-background/98 p-2 shadow-2xl backdrop-blur-md transition-all duration-200 animate-in fade-in zoom-in-95 w-64 h-64 overflow-hidden"
          style={{
            // Positioned intelligently nearby
            transform: "translate(80px, -40px)",
          }}
        >
          <img
            src={src}
            alt={alt}
            className="w-full h-full object-contain rounded-xl"
          />
          <div className="absolute bottom-2 left-2 right-2 bg-black/75 backdrop-blur text-white text-[10px] py-0.5 px-2 rounded-md truncate text-center">
            {alt}
          </div>
        </div>
      )}
    </div>
  );
}
