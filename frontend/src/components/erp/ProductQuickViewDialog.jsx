import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency, cn } from "@/lib/utils";
import {
  Car,
  Wrench,
  Package,
  ShoppingCart,
  FileText,
  MessageSquare,
  ShieldCheck,
  Tag,
  Barcode,
  Layers,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Building2,
  Clock,
  DollarSign,
  Boxes,
  CheckCircle2,
  XCircle,
} from "lucide-react";

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
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    setSelectedImageIndex(0);
    setIsZoomed(false);
  }, [product?.product_id, open]);

  if (!product) return null;

  const getConvertedPrice = (priceVal) => {
    const base = Number(priceVal) || 0;
    const rate = Number(exchangeRate) || 36.5;
    if (currency === "USD") {
      return base;
    }
    return Number((base * rate).toFixed(2));
  };

  const formatProductPrice = (priceVal) => {
    return formatCurrency(getConvertedPrice(priceVal), currency);
  };

  // Gather all valid images
  const rawImages = Array.isArray(product.images) && product.images.length > 0
    ? product.images
    : product.image
      ? [product.image]
      : [];
  
  const images = rawImages.filter(Boolean);
  const currentImage = images[selectedImageIndex] || null;

  const compatibility = product.compatibility || {};
  const compatTypes = Array.isArray(compatibility.vehicle_types) ? compatibility.vehicle_types : [];
  const compatBrands = Array.isArray(compatibility.brands) ? compatibility.brands : [];
  const compatModels = Array.isArray(compatibility.models) ? compatibility.models : [];

  // Stock calculations
  const rawStock = inventoryByProduct[product.product_id] ?? null;
  const stockRows = inventoryByWarehouse[product.product_id] || [];
  const totalStock = rawStock !== null ? rawStock : stockRows.reduce((sum, row) => sum + (row.quantity || 0), 0);

  const prevImage = () => {
    setSelectedImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const nextImage = () => {
    setSelectedImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

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
                {formatProductPrice(product.precio1 ?? product.price ?? 0)}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Precio sugerido al cliente {currency === "NIO" ? `(US$ ${Number(product.precio1 ?? product.price ?? 0).toFixed(2)})` : ""}
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
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-muted/40 border flex items-center justify-center group select-none">
                {currentImage ? (
                  <img
                    src={currentImage}
                    alt={product.name || "Producto"}
                    className={cn(
                      "w-full h-full object-contain p-2 transition-transform duration-300",
                      isZoomed ? "scale-150 cursor-zoom-out" : "hover:scale-105 cursor-zoom-in"
                    )}
                    onClick={() => setIsZoomed(!isZoomed)}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-muted-foreground text-xs gap-2">
                    <Package className="h-10 w-10 stroke-[1.5] opacity-40" />
                    <span>Sin imagen disponible</span>
                  </div>
                )}

                {/* Floating image counter */}
                {images.length > 1 && (
                  <span className="absolute bottom-2 right-2 bg-black/70 backdrop-blur text-white text-[10px] font-semibold px-2 py-0.5 rounded-full shadow">
                    {selectedImageIndex + 1} / {images.length}
                  </span>
                )}

                {/* Left/Right controls */}
                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        prevImage();
                      }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 hover:bg-background border shadow-md flex items-center justify-center text-foreground transition-all opacity-0 group-hover:opacity-100"
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
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 hover:bg-background border shadow-md flex items-center justify-center text-foreground transition-all opacity-0 group-hover:opacity-100"
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
                        "relative h-16 w-16 shrink-0 rounded-lg overflow-hidden border-2 bg-muted/30 transition-all p-1",
                        selectedImageIndex === idx
                          ? "border-primary shadow-sm scale-105"
                          : "border-border/60 hover:border-border opacity-70 hover:opacity-100"
                      )}
                    >
                      <img src={img} alt={`Miniatura ${idx + 1}`} className="w-full h-full object-contain" />
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
                    Categoría: <strong className="ml-1 text-foreground">{product.category || "General"}</strong>
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
                  Tabla de Precios ({currency})
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-background border">
                    <div className="text-[11px] text-muted-foreground">Precio 1 (Base)</div>
                    <div className="font-mono font-bold text-foreground mt-0.5">
                      {formatProductPrice(product.precio1 ?? product.price ?? 0)}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-background border">
                    <div className="text-[11px] text-muted-foreground">Precio 2 (Taller)</div>
                    <div className="font-mono font-bold text-foreground mt-0.5">
                      {formatProductPrice(product.precio2 ?? product.price ?? 0)}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-background border">
                    <div className="text-[11px] text-muted-foreground">Precio VIP</div>
                    <div className="font-mono font-bold text-foreground mt-0.5">
                      {formatProductPrice(product.precio_vip ?? product.precio2 ?? product.price ?? 0)}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-background border">
                    <div className="text-[11px] text-muted-foreground">Casa Comercial</div>
                    <div className="font-mono font-bold text-foreground mt-0.5">
                      {formatProductPrice(product.precio_casa_comercial ?? product.precio3 ?? product.price ?? 0)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              {product.description && (
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Descripción del Producto
                  </div>
                  <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed bg-muted/10 p-3 rounded-lg border border-border/60">
                    {product.description}
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

                  {!compatBrands.length && !compatModels.length && !compatTypes.length && !compatibility.year_from && (
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
                        +{formatProductPrice(product.installation_price)}
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
      </DialogContent>
    </Dialog>
  );
}
