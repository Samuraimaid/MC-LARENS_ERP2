import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { formatCurrency, cn } from "@/lib/utils";
import { formatCategoryLabel, getProductBrandLogo } from "@/lib/branding";
import { uploadsToGcsUrl, getProductImageUrl } from "@/lib/productImage";
import { sanitizeProductCopy, isUniversalProduct } from "@/lib/sanitizeCopy";
import { getRelatedProducts, getFrequentlyBoughtTogether } from "@/lib/productRecommendations";
import ProductCarouselSection from "@/components/products/ProductCarouselSection";
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
  Layers,
  X,
  Download,
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
  allProducts = [],
  warehouses = [],
  inventoryByWarehouse = {},
  inventoryByProduct = {},
  onAddToCart,
  onAddToQuote,
  onAddMultipleToCart,
  onAddMultipleToQuote,
  onSendWhatsApp,
  onOpenProduct,
  isWarehouseRole = false,
  userRole = "",
  currency = "NIO",
  exchangeRate = 36.5,
}) {
  const [activeProduct, setActiveProduct] = useState(product);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [failedImages, setFailedImages] = useState({});
  const [srcOverrides, setSrcOverrides] = useState({});
  const touchStartXRef = useRef(null);

  // Sync active product with prop
  useEffect(() => {
    setActiveProduct(product);
    setSelectedImageIndex(0);
    setIsFullscreen(false);
    setFailedImages({});
    setSrcOverrides({});
  }, [product]);

  const displayProduct = activeProduct || product;

  // Recommendations
  const relatedProducts = useMemo(() => {
    return getRelatedProducts(displayProduct, allProducts);
  }, [displayProduct, allProducts]);

  const fbtItems = useMemo(() => {
    return getFrequentlyBoughtTogether(displayProduct, allProducts);
  }, [displayProduct, allProducts]);

  // FBT Multi-selection state
  const [fbtSelectedIds, setFbtSelectedIds] = useState(new Set());

  useEffect(() => {
    const ids = new Set(
      fbtItems.map((item) => String(item.product?.product_id || item.product?.id || item.product?._id || item.product?.sku || ""))
    );
    setFbtSelectedIds(ids);
  }, [fbtItems]);

  const handleToggleFbtSelect = (productId, p) => {
    setFbtSelectedIds((prev) => {
      const next = new Set(prev);
      const id = String(productId || p?.product_id || p?.sku || "");
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllFbt = (selectAll) => {
    if (selectAll) {
      const ids = new Set(
        fbtItems.map((item) => String(item.product?.product_id || item.product?.id || item.product?._id || item.product?.sku || ""))
      );
      setFbtSelectedIds(ids);
    } else {
      setFbtSelectedIds(new Set());
    }
  };

  const handleOpenProductInQuickView = (targetProduct) => {
    setActiveProduct(targetProduct);
    setSelectedImageIndex(0);
    setIsFullscreen(false);
    setFailedImages({});
    setSrcOverrides({});
    onOpenProduct?.(targetProduct);
  };

  const handleAddSelection = (selectedProds, actionType) => {
    if (!Array.isArray(selectedProds) || selectedProds.length === 0) return;
    if (actionType === "sale") {
      if (onAddMultipleToCart) {
        onAddMultipleToCart(selectedProds);
      } else if (onAddToCart) {
        selectedProds.forEach((p) => onAddToCart(p));
      }
    } else if (actionType === "quote") {
      if (onAddMultipleToQuote) {
        onAddMultipleToQuote(selectedProds);
      } else if (onAddToQuote) {
        selectedProds.forEach((p) => onAddToQuote(p));
      }
    }
  };

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
  const rawImages = Array.isArray(displayProduct?.images) && displayProduct.images.length > 0
    ? displayProduct.images
    : displayProduct?.image_url
      ? [displayProduct.image_url]
      : displayProduct?.image
        ? [displayProduct.image]
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

  if (!displayProduct) return null;

  const brandLogo = getProductBrandLogo(displayProduct.brand);
  const IconComponent = getCategoryIcon(displayProduct.category);

  const getDualPrices = (priceVal) => {
    const usd = Number(priceVal) || 0;
    const rate = Number(exchangeRate) || 36.5;
    const nio = usd * rate;
    return {
      usdFormatted: formatCurrency(usd, "USD"),
      nioFormatted: formatCurrency(nio, "NIO"),
    };
  };

  const dualPrice = getDualPrices(displayProduct.precio1 ?? displayProduct.price ?? 0);

  const compatibility = displayProduct.compatibility || {};
  const compatTypes = Array.isArray(compatibility.vehicle_types)
    ? compatibility.vehicle_types
    : Array.isArray(displayProduct.vehicle_types)
      ? displayProduct.vehicle_types
      : [];
  const compatBrands = Array.isArray(compatibility.brands) ? compatibility.brands : [];
  const compatModels = Array.isArray(compatibility.models) ? compatibility.models : [];
  const isUniversal = isUniversalProduct(displayProduct);
  const compatTexto = displayProduct.compatibilidad_texto || compatibility.texto || null;

  // Stock calculations
  const rawStock = inventoryByProduct[displayProduct.product_id] ?? null;
  const stockRows = inventoryByWarehouse[displayProduct.product_id] || [];
  const totalStock = rawStock !== null ? rawStock : stockRows.reduce((sum, row) => sum + (row.quantity || 0), 0);

  const cleanDescription = sanitizeProductCopy(displayProduct.description || displayProduct.descripcion || "");

  // Split DS18-style description into overview + feature bullets (see ZR1000.1D pilot)
  const featureMarker = "Características principales:";
  const descParts = (() => {
    const raw = cleanDescription || "";
    const idx = raw.indexOf(featureMarker);
    if (idx === -1) {
      const fromArray = Array.isArray(displayProduct.features)
        ? displayProduct.features.map((f) => String(f).trim()).filter(Boolean)
        : [];
      return { overview: raw, features: fromArray };
    }
    const overview = raw.slice(0, idx).trim();
    const rest = raw.slice(idx + featureMarker.length);
    const features = rest
      .split("\n")
      .map((l) => l.replace(/^[•\-\*\s]+/, "").trim())
      .filter(Boolean);
    return { overview, features };
  })();

  const manualDocs = (() => {
    const media = Array.isArray(displayProduct.media) ? displayProduct.media : [];
    const docs = [];
    for (const m of media) {
      if (!m || typeof m !== "object") continue;
      const url = m.url || m.src || "";
      const isDoc =
        m.type === "document" ||
        String(url).toLowerCase().includes(".pdf") ||
        String(m.filename || "").toLowerCase().endsWith(".pdf");
      if (isDoc && url) docs.push({ url, title: m.title || "Manual del producto (PDF)" });
    }
    return docs;
  })();

  const specsEntries =
    displayProduct.specs && typeof displayProduct.specs === "object"
      ? Object.entries(displayProduct.specs).filter(([, val]) => val != null && typeof val !== "object")
      : [];

  const validImageCount = images.filter((_, idx) => !failedImages[idx]).length;
  const showGalleryNav = validImageCount >= 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!w-[min(100vw-0.5rem,1480px)] !max-w-[1480px] !h-[min(100dvh-0.5rem,980px)] !max-h-[min(100dvh-0.5rem,980px)] !rounded-xl sm:!rounded-2xl flex flex-col !p-0 !gap-0 overflow-hidden border bg-card shadow-2xl">
        {/* Header */}
        <div className="p-5 pb-3 pr-14 sm:pr-16 border-b bg-muted/20">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono text-[11px] font-semibold bg-background">
                  {displayProduct.sku || "Sin SKU"}
                </Badge>
                {displayProduct.brand && (
                  <Badge variant="secondary" className="text-[11px] font-bold">
                    {displayProduct.brand}
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
              <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground leading-snug">
                {sanitizeProductCopy(displayProduct.name || "Detalle de Producto")}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground flex items-center gap-2">
                <IconComponent className="h-3.5 w-3.5 text-primary" />
                <span>{formatCategoryLabel(displayProduct.category)}</span>
                {displayProduct.subcategory && (
                  <>
                    <span>•</span>
                    <span>{displayProduct.subcategory}</span>
                  </>
                )}
              </DialogDescription>
            </div>

            {brandLogo && (
              <img
                src={brandLogo}
                alt={displayProduct.brand}
                className="h-11 sm:h-12 max-w-[140px] sm:max-w-[160px] object-contain opacity-95 shrink-0 mr-1 hidden sm:block"
              />
            )}
          </div>
        </div>

        {/* Scrollable Body */}
        <ScrollArea className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-5 space-y-6">
            {/* Gallery + Primary Highlights Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Image Gallery (Left Column) */}
              <div className="md:col-span-6 space-y-3">
                {/* Main Image Box */}
                <div
                  onClick={() => currentImage && !failedImages[selectedImageIndex] && setIsFullscreen(true)}
                  className={cn(
                    "relative aspect-[4/3] w-full rounded-xl border bg-muted/20 overflow-hidden select-none transition-all group",
                    currentImage && !failedImages[selectedImageIndex]
                      ? "cursor-zoom-in hover:border-primary/50 hover:shadow-lg"
                      : "cursor-default"
                  )}
                  title={currentImage && !failedImages[selectedImageIndex] ? "Clic para ampliar carrusel en pantalla completa" : undefined}
                >
                  <div className="absolute inset-0 flex items-center justify-center p-3 overflow-hidden">
                  {currentImage && !failedImages[selectedImageIndex] ? (
                    <>
                      <img
                        src={resolveDisplaySrc(currentImage, selectedImageIndex)}
                        alt={displayProduct.name || "Foto del producto"}
                        onError={() => handleImageError(selectedImageIndex, currentImage)}
                        className="max-h-full max-w-full h-full w-full object-contain object-center transition-transform duration-200 group-hover:scale-[1.02]"
                      />
                      {/* Floating Lightbox Open Hint */}
                      <div className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-md p-1.5 backdrop-blur-xs flex items-center gap-1 text-[11px] font-medium shadow-md transition-opacity opacity-80 group-hover:opacity-100">
                        <Maximize2 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Ampliar</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-muted-foreground gap-2 p-6 text-center">
                      <Package className="h-12 w-12 stroke-[1.2]" />
                      <span className="text-xs font-medium">Sin imagen disponible</span>
                    </div>
                  )}
                  </div>

                  {/* Previous / Next Overlay Controls in Dialog */}
                  {showGalleryNav && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          prevImage();
                        }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 hover:bg-background border shadow-md flex items-center justify-center text-foreground transition-opacity opacity-70 hover:opacity-100 cursor-pointer"
                        aria-label="Foto anterior"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          nextImage();
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 hover:bg-background border shadow-md flex items-center justify-center text-foreground transition-opacity opacity-70 hover:opacity-100 cursor-pointer"
                        aria-label="Siguiente foto"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>

                {/* Thumbnail Strip (Under Main Photo - DS18 Style) */}
                {images.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 select-none">
                    {images.map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedImageIndex(idx)}
                        className={cn(
                          "relative h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-lg overflow-hidden border-2 bg-muted/30 transition-all p-1 flex items-center justify-center cursor-pointer",
                          selectedImageIndex === idx
                            ? "border-primary ring-2 ring-primary/30 scale-105 shadow-sm"
                            : "border-border/60 hover:border-border opacity-70 hover:opacity-100"
                        )}
                        aria-label={`Ver foto ${idx + 1}`}
                      >
                        {!failedImages[idx] ? (
                          <img
                            src={resolveDisplaySrc(img, idx)}
                            alt={`Miniatura ${idx + 1}`}
                            onError={() => handleImageError(idx, img)}
                            className="max-h-full max-w-full w-auto h-auto object-contain"
                          />
                        ) : (
                          <Package className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Price, Stock & Highlights (Right Column) */}
              <div className="md:col-span-6 space-y-4">
                {/* Price Box */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 space-y-2">
                  <div className="text-xs font-semibold text-primary uppercase tracking-wider">
                    Precio de Lista
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-2xl sm:text-3xl font-black font-mono text-foreground tracking-tight">
                      {dualPrice.usdFormatted}
                    </span>
                    <span className="text-sm sm:text-base font-bold font-mono text-muted-foreground">
                      ≈ {dualPrice.nioFormatted}
                    </span>
                  </div>

                  {/* Multi-tier Prices if Leadership/Sales */}
                  {(displayProduct.precio2 || displayProduct.precio_vip || displayProduct.precio_casa_comercial) && (
                    <div className="pt-2 border-t border-border/50 grid grid-cols-3 gap-2 text-[11px]">
                      {displayProduct.precio2 ? (
                        <div className="p-1.5 rounded bg-background/60 border">
                          <div className="text-muted-foreground font-medium text-[10px]">Taller</div>
                          <div className="font-mono font-bold">{getDualPrices(displayProduct.precio2).usdFormatted}</div>
                        </div>
                      ) : null}
                      {displayProduct.precio_vip ? (
                        <div className="p-1.5 rounded bg-background/60 border">
                          <div className="text-muted-foreground font-medium text-[10px]">VIP</div>
                          <div className="font-mono font-bold">{getDualPrices(displayProduct.precio_vip).usdFormatted}</div>
                        </div>
                      ) : null}
                      {displayProduct.precio_casa_comercial ? (
                        <div className="p-1.5 rounded bg-background/60 border">
                          <div className="text-muted-foreground font-medium text-[10px]">Distribuidor</div>
                          <div className="font-mono font-bold">{getDualPrices(displayProduct.precio_casa_comercial).usdFormatted}</div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>

                {/* Key Attributes Pills */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50 space-y-0.5">
                    <span className="text-muted-foreground font-medium text-[11px]">Categoría</span>
                    <div className="font-semibold text-foreground truncate">
                      {formatCategoryLabel(displayProduct.category)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50 space-y-0.5">
                    <span className="text-muted-foreground font-medium text-[11px]">Subcategoría</span>
                    <div className="font-semibold text-foreground truncate">
                      {displayProduct.subcategory || "General"}
                    </div>
                  </div>
                  {displayProduct.garantia && (
                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50 space-y-0.5">
                      <span className="text-muted-foreground font-medium text-[11px]">Garantía</span>
                      <div className="font-semibold text-foreground">
                        {displayProduct.garantia}
                      </div>
                    </div>
                  )}
                  {displayProduct.potencia && (
                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50 space-y-0.5">
                      <span className="text-muted-foreground font-medium text-[11px]">Potencia</span>
                      <div className="font-semibold text-foreground font-mono">
                        {displayProduct.potencia}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* DS18-style detail accordions + compatibility */}
            <div className="space-y-4 pt-2 border-t border-border/60">
              {(descParts.features.length > 0 || specsEntries.length > 0 || descParts.overview || cleanDescription) && (
                <Accordion type="multiple" defaultValue={["features", "specs", "overview"]} className="w-full rounded-xl border border-border/60 bg-muted/10 px-3">
                  {descParts.features.length > 0 && (
                    <AccordionItem value="features" className="border-border/50">
                      <AccordionTrigger className="text-xs font-bold uppercase tracking-wider text-muted-foreground hover:no-underline py-3">
                        Características principales
                      </AccordionTrigger>
                      <AccordionContent>
                        <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm text-foreground/90">
                          {descParts.features.map((f, i) => (
                            <li key={i}>{f}</li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {(specsEntries.length > 0 || manualDocs.length > 0) && (
                    <AccordionItem value="specs" className="border-border/50">
                      <AccordionTrigger className="text-xs font-bold uppercase tracking-wider text-muted-foreground hover:no-underline py-3">
                        Ficha técnica y manual
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3">
                        {manualDocs.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {manualDocs.map((doc, i) => (
                              <Button key={i} variant="outline" size="sm" className="h-8 gap-1.5 text-xs" asChild>
                                <a href={doc.url} target="_blank" rel="noopener noreferrer">
                                  <Download className="h-3.5 w-3.5" />
                                  {doc.title || "Descargar manual (PDF)"}
                                </a>
                              </Button>
                            ))}
                          </div>
                        )}
                        {specsEntries.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {specsEntries.map(([key, val]) => (
                              <div key={key} className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] p-2 rounded-lg bg-muted/20 border border-border/40 gap-2 items-start">
                                <span className="text-muted-foreground font-medium break-words">{key}</span>
                                <span className="font-semibold text-foreground text-right break-words">{String(val)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {(descParts.overview || (!descParts.features.length && cleanDescription)) && (
                    <AccordionItem value="overview" className="border-border/50 border-b-0">
                      <AccordionTrigger className="text-xs font-bold uppercase tracking-wider text-muted-foreground hover:no-underline py-3">
                        Descripción del producto
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="text-xs sm:text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap break-words bg-muted/20 p-3 rounded-xl border border-border/50 font-sans max-w-full overflow-x-hidden">
                          {descParts.overview || cleanDescription}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}
                </Accordion>
              )}

              {/* Vehicle Compatibility Section */}
              <div className="p-3 bg-muted/20 rounded-xl border border-border/60 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
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
              {displayProduct.installation_type && displayProduct.installation_type !== "not_available" && (
                <div className="p-3 bg-muted/20 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-start gap-2.5">
                    <Wrench className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold text-foreground">
                        Instalación {displayProduct.installation_type === "required" ? "Requerida" : "Opcional"}
                      </div>
                      {displayProduct.installation_time_minutes ? (
                        <div className="text-muted-foreground flex flex-col gap-0.5 mt-1">
                          <div className="flex items-center gap-1.5 font-medium text-foreground/90">
                            <Clock className="h-3.5 w-3.5 text-primary" />
                            <span>Tiempo aproximado: ~{displayProduct.installation_time_minutes} min</span>
                          </div>
                          <span className="text-[11px] text-amber-700 dark:text-amber-400">
                            * Los tiempos pueden variar dependiendo del estado del vehículo y si es necesario despolarizar.
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {displayProduct.installation_price ? (
                    <div className="text-right">
                      <div className="text-[11px] text-muted-foreground">Mano de Obra</div>
                      <div className="font-mono font-bold text-foreground">
                        +{getDualPrices(displayProduct.installation_price).usdFormatted}
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground">
                        ≈ {getDualPrices(displayProduct.installation_price).nioFormatted}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Warehouse Breakdown */}
              {stockRows.length > 0 && (
                <div className="space-y-2 p-3 bg-muted/20 rounded-xl border border-border/50">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-primary" />
                    Disponibilidad por Sucursal
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    {stockRows.map((wh) => (
                      <div key={wh.warehouse_id} className="p-2 rounded-lg bg-background border flex justify-between items-center">
                        <span className="font-medium text-muted-foreground">{wh.warehouse_name || wh.warehouse_id}</span>
                        <span className={cn("font-mono font-bold", (wh.quantity || 0) > 0 ? "text-emerald-600" : "text-muted-foreground")}>
                          {wh.quantity || 0} unid.
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Frequently Bought Together / Completá el sistema Carousel (DS18 Style) */}
              {fbtItems.length > 0 && (
                <ProductCarouselSection
                  title="Se venden juntos"
                  subtitle="Completá el sistema con estos accesorios y complementos recomendados"
                  icon={Sparkles}
                  items={fbtItems}
                  enableMultiSelect={true}
                  selectedIds={fbtSelectedIds}
                  onToggleSelect={handleToggleFbtSelect}
                  onSelectAll={handleSelectAllFbt}
                  onAddOne={(p, action) => (action === "sale" ? onAddToCart?.(p) : onAddToQuote?.(p))}
                  onAddSelection={handleAddSelection}
                  onOpenProduct={handleOpenProductInQuickView}
                  effectiveUsdNioRate={exchangeRate}
                  isWarehouseRole={isWarehouseRole}
                  currency={currency}
                />
              )}

              {/* Related Products Carousel (DS18 Style) */}
              {relatedProducts.length > 0 && (
                <ProductCarouselSection
                  title="Productos relacionados"
                  subtitle="Opciones y variantes de la misma marca y categoría"
                  icon={Layers}
                  items={relatedProducts}
                  enableMultiSelect={false}
                  onAddOne={(p, action) => (action === "sale" ? onAddToCart?.(p) : onAddToQuote?.(p))}
                  onOpenProduct={handleOpenProductInQuickView}
                  effectiveUsdNioRate={exchangeRate}
                  isWarehouseRole={isWarehouseRole}
                  currency={currency}
                />
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
                  onSendWhatsApp(displayProduct);
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
                  onAddToQuote(displayProduct);
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
                  onAddToCart(displayProduct);
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
            className="fixed inset-0 z-[100] bg-white backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 select-none animate-in fade-in duration-200"
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
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted text-foreground">
                    {displayProduct.sku || "SKU"}
                  </span>
                  {displayProduct.brand && (
                    <span className="text-xs font-bold text-muted-foreground">
                      {displayProduct.brand}
                    </span>
                  )}
                </div>
                <h3 className="text-sm sm:text-base font-semibold text-foreground truncate mt-0.5">
                  {displayProduct.name || "Producto"}
                </h3>
              </div>

              {/* Counter and Close button */}
              <div className="flex items-center gap-3 shrink-0">
                {showGalleryNav && (
                  <span className="bg-muted text-foreground text-xs font-mono font-semibold px-3 py-1 rounded-full shadow-sm border">
                    {selectedImageIndex + 1} / {images.length}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setIsFullscreen(false)}
                  className="h-11 w-11 rounded-full bg-muted hover:bg-muted/80 active:bg-muted/60 text-foreground border flex items-center justify-center transition-colors shadow-md cursor-pointer"
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
              {showGalleryNav && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    prevImage();
                  }}
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-background/90 hover:bg-background active:scale-95 border shadow-lg text-foreground flex items-center justify-center transition-all cursor-pointer group"
                  aria-label="Imagen anterior"
                >
                  <ChevronLeft className="h-7 w-7 sm:h-8 sm:w-8 group-hover:-translate-x-0.5 transition-transform" />
                </button>
              )}

              {/* Main Fullscreen Image */}
              <div className="absolute inset-0 flex items-center justify-center p-4 overflow-hidden pointer-events-none">
              <img
                src={resolveDisplaySrc(currentImage, selectedImageIndex)}
                alt={displayProduct.name || "Producto"}
                className="max-w-[95vw] max-h-[75vh] w-auto h-auto object-contain object-center drop-shadow-md select-none pointer-events-auto"
                style={{ aspectRatio: "auto" }}
                onClick={(e) => e.stopPropagation()}
              />
              </div>

              {/* Next Button */}
              {showGalleryNav && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    nextImage();
                  }}
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-background/90 hover:bg-background active:scale-95 border shadow-lg text-foreground flex items-center justify-center transition-all cursor-pointer group"
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
