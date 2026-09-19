import React, { useState, useEffect, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency, cn } from "@/lib/utils";
import { formatCategoryLabel, getProductBrandLogo } from "@/lib/branding";
import { uploadsToGcsUrl, getProductImageUrl } from "@/lib/productImage";
import { sanitizeProductCopy, isUniversalProduct } from "@/lib/sanitizeCopy";
import {
  Car,
  Wrench,
  Package,
  ShoppingCart,
  FileText,
  MessageSquare,
  ShieldCheck,
  Tag,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Building2,
  Clock,
  DollarSign,
  CheckCircle2,
  XCircle,
  Sparkles,
  Volume2,
  Lightbulb,
  Shield,
  Droplet,
  X,
} from "lucide-react";

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

export default function ProductQuickViewDialog({
  open,
  onOpenChange,
  product,
  warehouses = [],
  inventoryByWarehouse = {},
  inventoryByProduct = {},
  onAddToCart,
  onAddToQuote,
  onSendWhatsApp,
  isWarehouseRole = false,
  userRole = "",
  currency = "NIO",
  exchangeRate = 36.5,
}) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [failedImages, setFailedImages] = useState({});
  const [srcOverrides, setSrcOverrides] = useState({});
  const touchStartXRef = useRef(null);

  useEffect(() => {
    setSelectedImageIndex(0);
    setIsFullscreen(false);
    setFailedImages({});
    setSrcOverrides({});
  }, [product]);

  const resolveDisplaySrc = (url, idx) => {
    if (srcOverrides[idx]) return srcOverrides[idx];
    return url;
  };

  const handleImageError = (idx, url) => {
    if (
      url &&
      typeof url === "string" &&
      url.startsWith("/uploads/") &&
      !srcOverrides[idx]
    ) {
      const gcs = uploadsToGcsUrl(url);
      if (gcs) {
        setSrcOverrides((prev) => ({ ...prev, [idx]: gcs }));
        return;
      }
    }
    setFailedImages((prev) => ({ ...prev, [idx]: true }));
  };

  // Gather all valid images from product
  const rawImages = Array.isArray(product?.images) && product.images.length > 0
    ? product.images
    : product?.image_url
      ? [product.image_url]
      : product?.image
        ? [product.image]
        : [];
  
  const images = rawImages.filter(Boolean);
  const currentImage = images[selectedImageIndex] || null;

  const prevImage = useCallback(() => {
    if (!images.length) return;
    setSelectedImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  }, [images.length]);

  const nextImage = useCallback(() => {
    if (!images.length) return;
    setSelectedImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  }, [images.length]);

  // Keyboard navigation for fullscreen lightbox
  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsFullscreen(false);
      } else if (e.key === "ArrowLeft") {
        prevImage();
      } else if (e.key === "ArrowRight") {
        nextImage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, prevImage, nextImage]);

  // Touch swipe support for fullscreen lightbox
  const handleTouchStart = (e) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartXRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartXRef.current - touchEndX;
    touchStartXRef.current = null;

    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        nextImage();
      } else {
        prevImage();
      }
    }
  };

  if (!product) return null;

  const brandLogo = getProductBrandLogo(product.brand);
  const IconComponent = getCategoryIcon(product.category);

  const getDualPrices = (priceVal) => {
    const usd = Number(priceVal) || 0;
    const rate = Number(exchangeRate) || 36.5;
    const nio = usd * rate;
    return {
      usdFormatted: formatCurrency(usd, "USD"),
      nioFormatted: formatCurrency(nio, "NIO"),
    };
  };

  const dualPrice = getDualPrices(product.precio1 ?? product.price ?? 0);

  const compatibility = product.compatibility || {};
  const compatTypes = Array.isArray(compatibility.vehicle_types)
    ? compatibility.vehicle_types
    : Array.isArray(product.vehicle_types)
      ? product.vehicle_types
      : [];
  const compatBrands = Array.isArray(compatibility.brands) ? compatibility.brands : [];
  const compatModels = Array.isArray(compatibility.models) ? compatibility.models : [];
  const isUniversal = isUniversalProduct(product);
  const compatTexto = product.compatibilidad_texto || compatibility.texto || null;

  // Stock calculations
  const rawStock = inventoryByProduct[product.product_id] ?? null;
  const stockRows = inventoryByWarehouse[product.product_id] || [];
  const totalStock = rawStock !== null ? rawStock : stockRows.reduce((sum, row) => sum + (row.quantity || 0), 0);

  const cleanDescription = sanitizeProductCopy(product.description || product.descripcion || "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-2xl border bg-card shadow-2xl">
        {/* Header */}
        <div className="p-5 pb-3 border-b bg-muted/20">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1 min-w-0 flex-1 pr-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono text-[11px] font-semibold bg-background">
                  {product.sku || "Sin SKU"}
                </Badge>
                {product.brand && (
                  <Badge variant="secondary" className="text-[11px] font-bold">
                    {product.brand}
                  </Badge>
                )}
                {isUniversal && (
                  <Badge className="bg-emerald-600/90 text-white text-[11px] font-semibold gap-1">
                    <Sparkles className="h-3 w-3" />
                    Universal
                  </Badge>
                )}
                {totalStock > 0 ? (
                  <Badge className="bg-emerald-600/90 text-white text-[11px] font-semibold gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Stock: {totalStock} unid.
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground text-[11px] gap-1">
                    <XCircle className="h-3 w-3" />
                    Sin stock físico
                  </Badge>
                )}
              </div>
              <DialogTitle className="text-xl font-bold tracking-tight text-foreground leading-snug">
                {product.name || "Detalle del Producto"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Código ID: <span className="font-mono">{product.product_id || product.id || "-"}</span>
                {product.barcode ? ` • Código de barras: ${product.barcode}` : ""}
              </DialogDescription>
            </div>

            <div className="text-right">
              <div className="text-2xl font-black text-primary font-mono">
                {dualPrice.usdFormatted}
              </div>
              <div className="text-xs font-mono text-muted-foreground font-medium">
                ≈ {dualPrice.nioFormatted}
              </div>
            </div>
          </div>
        </div>

        {/* Body content */}
        <ScrollArea className="flex-1 overflow-y-auto p-6">
          <div className="grid gap-6 md:grid-cols-[340px_1fr]">
            {/* Gallery Column */}
            <div className="space-y-3">
              {/* Main preview box */}
              <div
                className="relative aspect-[4/3] w-full rounded-xl overflow-hidden bg-muted/30 border border-border/70 flex items-center justify-center group select-none cursor-pointer"
                onClick={() => {
                  if (currentImage && !failedImages[selectedImageIndex]) {
                    setIsFullscreen(true);
                  }
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (currentImage && !failedImages[selectedImageIndex]) {
                      setIsFullscreen(true);
                    }
                  }
                }}
                title="Toca para ver pantalla completa"
              >
                {currentImage && !failedImages[selectedImageIndex] ? (
                  <>
                    <img
                      src={resolveDisplaySrc(currentImage, selectedImageIndex)}
                      alt={product.name || "Producto"}
                      onError={() => handleImageError(selectedImageIndex, currentImage)}
                      className="max-w-full max-h-full w-auto h-auto object-contain object-center p-2 transition-opacity group-hover:opacity-90"
                      style={{ aspectRatio: "auto" }}
                    />
                    {/* Hover indicator for desktop full-view */}
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                      <div className="bg-black/75 backdrop-blur-xs text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
                        <Maximize2 className="h-3.5 w-3.5" />
                        Pantalla completa
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-linear-to-b from-muted/40 to-muted/10">
                    {brandLogo ? (
                      <div className="flex flex-col items-center justify-center gap-2 max-w-[85%]">
                        <img
                          src={brandLogo}
                          alt={product.brand || "Marca"}
                          className="max-h-16 max-w-[160px] object-contain opacity-90 drop-shadow-sm"
                        />
                        <span className="text-xs font-semibold text-foreground/80 font-mono">
                          {product.brand}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <div className="h-12 w-12 rounded-2xl bg-background/80 border border-border/60 shadow-xs flex items-center justify-center text-primary/80">
                          <IconComponent className="h-6 w-6" />
                        </div>
                        {product.brand ? (
                          <span className="text-xs font-bold tracking-tight text-foreground/90 font-mono">
                            {product.brand}
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-muted-foreground">
                            MCLARENS
                          </span>
                        )}
                        {product.category && (
                          <span className="text-[10px] text-muted-foreground/70">
                            {formatCategoryLabel(product.category)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Floating image counter */}
                {images.length > 1 && (
                  <span className="absolute bottom-2 right-2 bg-black/75 backdrop-blur-xs text-white text-[10px] font-semibold px-2 py-0.5 rounded-full shadow">
                    {selectedImageIndex + 1} / {images.length}
                  </span>
                )}

                {/* Left/Right controls on dialog preview */}
                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        prevImage();
                      }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/90 hover:bg-background border shadow-md flex items-center justify-center text-foreground transition-all opacity-0 group-hover:opacity-100"
                      aria-label="Imagen anterior"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        nextImage();
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/90 hover:bg-background border shadow-md flex items-center justify-center text-foreground transition-all opacity-0 group-hover:opacity-100"
                      aria-label="Siguiente imagen"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>

              {/* Thumbnails strip */}
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1 max-w-full">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedImageIndex(idx)}
                      className={cn(
                        "relative h-16 w-16 shrink-0 rounded-lg overflow-hidden border-2 bg-muted/30 transition-all p-1 flex items-center justify-center",
                        selectedImageIndex === idx
                          ? "border-primary shadow-sm ring-2 ring-primary/30"
                          : "border-border/60 hover:border-border opacity-70 hover:opacity-100"
                      )}
                    >
                      {!failedImages[idx] ? (
                        <img
                          src={resolveDisplaySrc(img, idx)}
                          alt={`Miniatura ${idx + 1}`}
                          onError={() => handleImageError(idx, img)}
                          className="max-w-full max-h-full w-auto h-auto object-contain"
                        />
                      ) : (
                        <Package className="h-5 w-5 text-muted-foreground/60" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Stock by Warehouse Summary */}
              {stockRows.length > 0 && (
                <div className="p-3 bg-muted/20 rounded-xl border space-y-2">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    Existencias en Bodegas
                  </div>
                  <div className="space-y-1 text-xs">
                    {stockRows.map((entry) => {
                      const wh = warehouses.find((w) => w.warehouse_id === entry.warehouse_id);
                      const name = wh?.name || entry.warehouse_id || "Bodega";
                      return (
                        <div key={entry.warehouse_id} className="flex justify-between items-center py-0.5 border-b last:border-0 border-border/40">
                          <span className="text-muted-foreground">{name}:</span>
                          <span className="font-mono font-bold text-foreground">{entry.quantity || 0} unidades</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Specifications & Details Column */}
            <div className="space-y-5">
              {/* Categorization & Badges */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5" />
                  Clasificación y Tipo
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="text-xs font-medium">
                    Categoría: <strong className="ml-1 text-foreground">{formatCategoryLabel(product.category) || "General"}</strong>
                  </Badge>
                  {product.subcategory && (
                    <Badge variant="secondary" className="text-xs">
                      Subcategoría: <strong className="ml-1 text-foreground">{product.subcategory}</strong>
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    Tipo: {product.product_type === "service" ? "Servicio" : product.product_type === "service_hourly" ? "Servicio por Hora" : "Producto Físico"}
                  </Badge>
                  <Badge variant="outline" className="text-xs gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    Garantía: {product.warranty_months || 0} meses
                  </Badge>
                </div>
              </div>

              {/* Tier Prices Grid */}
              <div className="space-y-2 bg-muted/20 p-3.5 rounded-xl border">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" />
                  Tabla de Precios (USD / NIO)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-background border">
                    <div className="text-[11px] text-muted-foreground">Precio 1 (Base)</div>
                    <div className="font-mono font-bold text-foreground mt-0.5">
                      {getDualPrices(product.precio1 ?? product.price ?? 0).usdFormatted}
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground">
                      ≈ {getDualPrices(product.precio1 ?? product.price ?? 0).nioFormatted}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-background border">
                    <div className="text-[11px] text-muted-foreground">Precio 2 (Taller)</div>
                    <div className="font-mono font-bold text-foreground mt-0.5">
                      {getDualPrices(product.precio2 ?? product.price ?? 0).usdFormatted}
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground">
                      ≈ {getDualPrices(product.precio2 ?? product.price ?? 0).nioFormatted}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-background border">
                    <div className="text-[11px] text-muted-foreground">Precio VIP</div>
                    <div className="font-mono font-bold text-foreground mt-0.5">
                      {getDualPrices(product.precio_vip ?? product.precio2 ?? product.price ?? 0).usdFormatted}
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground">
                      ≈ {getDualPrices(product.precio_vip ?? product.precio2 ?? product.price ?? 0).nioFormatted}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-background border">
                    <div className="text-[11px] text-muted-foreground">Casa Comercial</div>
                    <div className="font-mono font-bold text-foreground mt-0.5">
                      {getDualPrices(product.precio_casa_comercial ?? product.precio3 ?? product.price ?? 0).usdFormatted}
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground">
                      ≈ {getDualPrices(product.precio_casa_comercial ?? product.precio3 ?? product.price ?? 0).nioFormatted}
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              {cleanDescription && (
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Descripción del Producto
                  </div>
                  <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed bg-muted/10 p-3 rounded-lg border border-border/60 whitespace-pre-line">
                    {cleanDescription}
                  </p>
                </div>
              )}

              {/* Vehicle Compatibility */}
              <div className="space-y-2 bg-muted/20 p-3.5 rounded-xl border">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Car className="h-3.5 w-3.5" />
                  Compatibilidad Vehicular
                </div>
                <div className="space-y-2 text-xs">
                  {isUniversal && (
                    <div>
                      <Badge className="bg-emerald-600/90 text-white text-[11px] py-0.5 px-2.5 font-semibold gap-1">
                        <Sparkles className="h-3 w-3" />
                        Universal (Compatible con todo vehículo)
                      </Badge>
                    </div>
                  )}

                  {compatTexto && (
                    <div className="p-2 rounded bg-background border border-border/50 text-foreground/90">
                      <span className="text-muted-foreground font-medium mr-1.5">Detalle de aplicación:</span>
                      {compatTexto}
                    </div>
                  )}

                  {compatBrands.length > 0 && (
                    <div>
                      <span className="text-muted-foreground font-medium">Marcas:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {compatBrands.map((b) => (
                          <Badge key={b} variant="secondary" className="text-[11px] py-0 px-2 font-semibold">
                            {b}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {compatModels.length > 0 && (
                    <div>
                      <span className="text-muted-foreground font-medium">Modelos:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {compatModels.map((m) => (
                          <Badge key={m} variant="outline" className="text-[11px] py-0 px-2">
                            {m}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {(compatibility.year_from || compatibility.year_to) && (
                    <div>
                      <span className="text-muted-foreground font-medium">Rango de Años:</span>
                      <span className="ml-2 font-mono font-bold text-foreground">
                        {compatibility.year_from || "-"} - {compatibility.year_to || "Actual"}
                      </span>
                    </div>
                  )}

                  {compatTypes.length > 0 && (
                    <div>
                      <span className="text-muted-foreground font-medium">Tipos de Carrocería:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {compatTypes.map((t) => (
                          <Badge key={t} variant="outline" className="text-[11px] py-0 px-2">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {!isUniversal && !compatTexto && !compatBrands.length && !compatModels.length && !compatTypes.length && !compatibility.year_from && !compatibility.year_to && (
                    <div className="text-xs text-muted-foreground italic">
                      Universal o sin restricciones específicas de modelo.
                    </div>
                  )}
                </div>
              </div>

              {/* Installation Details */}
              {product.installation_type && product.installation_type !== "not_available" && (
                <div className="p-3 bg-muted/20 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-start gap-2.5">
                    <Wrench className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold text-foreground">
                        Instalación {product.installation_type === "required" ? "Requerida" : "Opcional"}
                      </div>
                      {product.installation_time_minutes ? (
                        <div className="text-muted-foreground flex flex-col gap-0.5 mt-1">
                          <div className="flex items-center gap-1.5 font-medium text-foreground/90">
                            <Clock className="h-3.5 w-3.5 text-primary" />
                            <span>Tiempo aproximado: ~{product.installation_time_minutes} min</span>
                          </div>
                          <span className="text-[11px] text-amber-700 dark:text-amber-400">
                            * Los tiempos pueden variar dependiendo del estado del vehículo y si es necesario despolarizar.
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {product.installation_price ? (
                    <div className="text-right">
                      <div className="text-[11px] text-muted-foreground">Mano de Obra</div>
                      <div className="font-mono font-bold text-foreground">
                        +{getDualPrices(product.installation_price).usdFormatted}
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground">
                        ≈ {getDualPrices(product.installation_price).nioFormatted}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="p-4 border-t bg-muted/30 flex flex-wrap items-center justify-between gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>

          <div className="flex flex-wrap gap-2 items-center">
            {!isWarehouseRole && onSendWhatsApp && (
              <Button
                variant="outline"
                className="text-emerald-700 dark:text-emerald-400 border-emerald-600/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 gap-1.5"
                onClick={() => {
                  onSendWhatsApp(product);
                  onOpenChange(false);
                }}
              >
                <MessageSquare className="h-4 w-4" />
                Enviar por WhatsApp
              </Button>
            )}
            {onAddToQuote && (
              <Button
                className="bg-blue-600 text-white hover:bg-blue-700 gap-1.5"
                onClick={() => {
                  onAddToQuote(product);
                  onOpenChange(false);
                }}
              >
                <FileText className="h-4 w-4" />
                Agregar a Cotización
              </Button>
            )}
            {onAddToCart && (
              <Button
                className="bg-emerald-600 text-white hover:bg-emerald-700 gap-1.5 font-semibold"
                onClick={() => {
                  onAddToCart(product);
                  onOpenChange(false);
                }}
              >
                <ShoppingCart className="h-4 w-4" />
                Agregar a Venta
              </Button>
            )}
          </div>
        </div>

        {/* Fullscreen Lightbox Carousel Overlay */}
        {isFullscreen && currentImage && !failedImages[selectedImageIndex] && (
          <div
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 select-none animate-in fade-in duration-200"
            onClick={() => setIsFullscreen(false)}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            role="dialog"
            aria-modal="true"
            aria-label="Vista de carrusel en pantalla completa"
          >
            {/* Top Toolbar in Lightbox */}
            <div
              className="flex items-center justify-between w-full max-w-7xl mx-auto z-10 gap-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="min-w-0 flex-1 pr-4">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-white/10 text-white/90">
                    {product.sku || "SKU"}
                  </span>
                  {product.brand && (
                    <span className="text-xs font-bold text-white/80">
                      {product.brand}
                    </span>
                  )}
                </div>
                <h3 className="text-sm sm:text-base font-semibold text-white truncate mt-0.5">
                  {product.name || "Producto"}
                </h3>
              </div>

              {/* Counter and Close button */}
              <div className="flex items-center gap-3 shrink-0">
                {images.length > 1 && (
                  <span className="bg-white/15 text-white text-xs font-mono font-semibold px-3 py-1 rounded-full shadow-sm">
                    {selectedImageIndex + 1} / {images.length}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setIsFullscreen(false)}
                  className="h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white flex items-center justify-center transition-colors shadow-md cursor-pointer"
                  aria-label="Cerrar pantalla completa"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Center Image Container with Carousel Controls */}
            <div
              className="relative flex-1 flex items-center justify-center w-full max-w-7xl mx-auto my-2 min-h-0 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Prev Button */}
              {images.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    prevImage();
                  }}
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-black/60 hover:bg-black/85 active:scale-95 border border-white/20 text-white flex items-center justify-center transition-all shadow-2xl backdrop-blur-xs cursor-pointer group"
                  aria-label="Imagen anterior"
                >
                  <ChevronLeft className="h-7 w-7 sm:h-8 sm:w-8 group-hover:-translate-x-0.5 transition-transform" />
                </button>
              )}

              {/* Main Fullscreen Image */}
              <img
                src={resolveDisplaySrc(currentImage, selectedImageIndex)}
                alt={product.name || "Producto"}
                className="max-w-[95vw] max-h-[75vh] w-auto h-auto object-contain object-center drop-shadow-2xl select-none"
                style={{ aspectRatio: "auto" }}
                onClick={(e) => e.stopPropagation()}
              />

              {/* Next Button */}
              {images.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    nextImage();
                  }}
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-black/60 hover:bg-black/85 active:scale-95 border border-white/20 text-white flex items-center justify-center transition-all shadow-2xl backdrop-blur-xs cursor-pointer group"
                  aria-label="Siguiente imagen"
                >
                  <ChevronRight className="h-7 w-7 sm:h-8 sm:w-8 group-hover:translate-x-0.5 transition-transform" />
                </button>
              )}
            </div>

            {/* Bottom Thumbnail Strip in Lightbox */}
            {images.length > 1 ? (
              <div
                className="flex items-center justify-center gap-2 overflow-x-auto py-2 px-4 max-w-full z-10"
                onClick={(e) => e.stopPropagation()}
              >
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedImageIndex(idx)}
                    className={cn(
                      "relative h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-lg overflow-hidden border-2 bg-black/40 transition-all p-1 flex items-center justify-center cursor-pointer",
                      selectedImageIndex === idx
                        ? "border-primary ring-2 ring-primary/50 shadow-lg scale-105"
                        : "border-white/20 hover:border-white/50 opacity-60 hover:opacity-100"
                    )}
                  >
                    {!failedImages[idx] ? (
                      <img
                        src={resolveDisplaySrc(img, idx)}
                        alt={`Miniatura ${idx + 1}`}
                        onError={() => handleImageError(idx, img)}
                        className="max-w-full max-h-full w-auto h-auto object-contain"
                      />
                    ) : (
                      <Package className="h-5 w-5 text-white/50" />
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center text-xs text-white/60 py-1">
                Toca fuera o presiona Escape para salir
              </div>
            )}
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
