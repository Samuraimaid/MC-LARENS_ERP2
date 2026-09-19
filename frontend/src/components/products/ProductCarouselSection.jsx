import React, { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency, cn } from "@/lib/utils";
import { usdAndNioFromUsdBase } from "@/lib/documentCurrency";
import { sanitizeProductCopy } from "@/lib/sanitizeCopy";
import { getProductImageUrl } from "@/lib/productImage";
import ProductThumb from "@/components/products/ProductThumb";
import {
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  FileText,
  Package,
  Layers,
  Sparkles,
  CheckCheck,
} from "lucide-react";

/**
 * Product Carousel Section for QuickView and Detail Views (DS18 Style)
 * Supports single-item browsing & multi-item bundle selection (Se venden juntos).
 */
export default function ProductCarouselSection({
  title = "Productos relacionados",
  subtitle = "",
  icon: Icon = Layers,
  items = [], // Array of products OR { product, isBundleItem, defaultQty }
  enableMultiSelect = false,
  selectedIds = [], // Array or Set of product_ids / SKUs
  onToggleSelect,
  onSelectAll,
  onAddOne,
  onAddSelection,
  onOpenProduct,
  effectiveUsdNioRate = 36.5,
  isWarehouseRole = false,
  currency = "USD",
  className = "",
}) {
  const scrollContainerRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Normalize items to { product, isBundleItem, defaultQty }
  const normalizedItems = (Array.isArray(items) ? items : []).map((item) => {
    if (item && item.product) {
      return item;
    }
    return {
      product: item,
      isBundleItem: false,
      defaultQty: 1,
    };
  });

  const getProductId = (p) => String(p?.product_id || p?.id || p?._id || p?.sku || "");

  const isSelected = (p) => {
    const id = getProductId(p);
    const sku = (p?.sku || "").toLowerCase();
    if (selectedIds instanceof Set) {
      return selectedIds.has(id) || selectedIds.has(sku);
    }
    if (Array.isArray(selectedIds)) {
      return selectedIds.includes(id) || selectedIds.includes(sku);
    }
    return false;
  };

  const selectedProducts = normalizedItems
    .filter((item) => isSelected(item.product))
    .map((item) => item.product);

  const totalBundlePriceUsd = selectedProducts.reduce((acc, p) => acc + (Number(p?.price) || 0), 0);
  const dualBundlePrices = usdAndNioFromUsdBase(totalBundlePriceUsd, effectiveUsdNioRate);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  const scrollByAmount = (direction) => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = direction === "left" ? -280 : 280;
    scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    // Update affordances after smooth scroll starts
    window.setTimeout(handleScroll, 280);
  };

  useEffect(() => {
    handleScroll();
    const el = scrollContainerRef.current;
    if (!el) return undefined;
    const onResize = () => handleScroll();
    window.addEventListener("resize", onResize);
    // Recalculate once layout settles
    const t = window.setTimeout(handleScroll, 50);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(t);
    };
  }, [normalizedItems.length]);

  const allSelected = normalizedItems.length > 0 && normalizedItems.every((item) => isSelected(item.product));

  if (normalizedItems.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-3 pt-4 border-t border-border/60 w-full", className)}>
      {/* Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
              <span>{title}</span>
              <Badge variant="outline" className="text-[10px] font-mono py-0 px-1.5 h-4.5 bg-muted/40">
                {normalizedItems.length}
              </Badge>
            </h4>
            {subtitle && (
              <p className="text-[11px] text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Carousel Navigation Arrow Controls (Desktop) */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full bg-background/80 hover:bg-muted"
            onClick={() => scrollByAmount("left")}
            disabled={!canScrollLeft}
            title="Desplazar a la izquierda"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full bg-background/80 hover:bg-muted"
            onClick={() => scrollByAmount("right")}
            disabled={!canScrollRight}
            title="Desplazar a la derecha"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Multi-Select Action Banner (for FBT / Se venden juntos) */}
      {enableMultiSelect && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-muted/40 border border-border/60">
          <div className="flex items-center gap-2.5">
            <Checkbox
              id="select-all-fbt"
              checked={allSelected}
              onCheckedChange={(checked) => onSelectAll?.(Boolean(checked))}
              className="h-4 w-4"
            />
            <label htmlFor="select-all-fbt" className="text-xs font-semibold cursor-pointer select-none text-foreground">
              Seleccionar todos ({selectedProducts.length}/{normalizedItems.length})
            </label>
            {selectedProducts.length > 0 && (
              <div className="hidden sm:inline-flex items-center gap-1.5 pl-2 border-l border-border/60 text-xs font-mono">
                <span className="text-muted-foreground">Total:</span>
                <span className="font-bold text-primary">{formatCurrency(dualBundlePrices.usd, "USD")}</span>
                <span className="text-[11px] text-muted-foreground">≈ {formatCurrency(dualBundlePrices.nio, "NIO")}</span>
              </div>
            )}
          </div>

          {/* Action Buttons for Selection */}
          <div className="flex flex-wrap items-center gap-2">
            {onAddSelection && (
              <Button
                type="button"
                size="sm"
                className="bg-emerald-600 text-white hover:bg-emerald-700 h-8 px-3 text-xs font-semibold gap-1.5 shadow-sm"
                disabled={selectedProducts.length === 0}
                onClick={() => onAddSelection(selectedProducts, "sale")}
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                Agregar selección a la venta ({selectedProducts.length})
              </Button>
            )}
            {onAddSelection && !isWarehouseRole && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 px-3 text-xs font-semibold gap-1.5 border-blue-600/30 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                disabled={selectedProducts.length === 0}
                onClick={() => onAddSelection(selectedProducts, "quote")}
              >
                <FileText className="h-3.5 w-3.5" />
                A Cotización
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Horizontal Carousel Track + side arrows */}
      <div className="relative group/carousel">
        <button
          type="button"
          onClick={() => scrollByAmount("left")}
          disabled={!canScrollLeft}
          aria-label="Desplazar carrusel a la izquierda"
          className={cn(
            "absolute left-0 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full border bg-background/95 shadow-lg flex items-center justify-center transition-opacity",
            canScrollLeft ? "opacity-100 hover:bg-muted cursor-pointer" : "opacity-30 cursor-not-allowed"
          )}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => scrollByAmount("right")}
          disabled={!canScrollRight}
          aria-label="Desplazar carrusel a la derecha"
          className={cn(
            "absolute right-0 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full border bg-background/95 shadow-lg flex items-center justify-center transition-opacity",
            canScrollRight ? "opacity-100 hover:bg-muted cursor-pointer" : "opacity-30 cursor-not-allowed"
          )}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex gap-3 overflow-x-auto pb-2 pt-1 px-8 scroll-smooth snap-x snap-mandatory scrollbar-thin select-none"
        style={{ scrollbarWidth: "thin" }}
      >
        {normalizedItems.map(({ product, isBundleItem, defaultQty }) => {
          if (!product) return null;
          const pId = getProductId(product);
          const checked = isSelected(product);
          const dualPrices = usdAndNioFromUsdBase(product.price || 0, effectiveUsdNioRate);
          const cleanName = sanitizeProductCopy(product.name || "Producto");

          return (
            <div
              key={pId}
              onClick={() => onOpenProduct?.(product)}
              className={cn(
                "relative shrink-0 w-[220px] sm:w-[240px] snap-start rounded-xl border bg-card p-2.5 transition-all flex flex-col justify-between cursor-pointer hover:shadow-md hover:border-primary/50 group",
                enableMultiSelect && checked ? "border-primary/60 ring-1 ring-primary/40 bg-primary/5" : "border-border/60"
              )}
            >
              {/* Top Row: Checkbox or Bundle Badge */}
              <div className="flex items-center justify-between gap-1 mb-1.5 min-h-[22px]">
                {enableMultiSelect ? (
                  <div
                    className="flex items-center gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      id={`cb-${pId}`}
                      checked={checked}
                      onCheckedChange={() => onToggleSelect?.(pId, product)}
                      className="h-4 w-4"
                    />
                    {isBundleItem && (
                      <Badge className="bg-amber-500/90 text-white text-[9px] py-0 px-1 font-semibold uppercase">
                        Bundle
                      </Badge>
                    )}
                  </div>
                ) : (
                  <div>
                    {product.brand && (
                      <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-medium truncate max-w-[120px]">
                        {product.brand}
                      </Badge>
                    )}
                  </div>
                )}

                <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[90px]" title={product.sku}>
                  {product.sku || "Sin SKU"}
                </span>
              </div>

              {/* Product Thumbnail Container — imagen llena el área */}
              <div className="relative aspect-square w-full rounded-lg bg-muted/20 overflow-hidden mb-2 border border-border/40">
                <ProductThumb
                  product={product}
                  size="full"
                  className="absolute inset-0 h-full w-full"
                  imgClassName="h-full w-full object-contain object-center p-1 transition-transform group-hover:scale-105"
                />
              </div>

              {/* Product Info */}
              <div className="space-y-1 flex-1 flex flex-col justify-between">
                <h5
                  className="text-xs font-semibold text-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors"
                  title={cleanName}
                >
                  {cleanName}
                </h5>

                {/* Price Display */}
                <div className="pt-1.5">
                  <div className="text-sm font-black font-mono text-primary">
                    {formatCurrency(dualPrices.usd, "USD")}
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground">
                    ≈ {formatCurrency(dualPrices.nio, "NIO")}
                  </div>
                </div>

                {/* Individual Action Buttons */}
                <div
                  className="flex items-center gap-1 pt-2 border-t border-border/40 mt-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  {onAddOne && (
                    <Button
                      type="button"
                      size="sm"
                      className="flex-1 h-7 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1 px-1.5"
                      onClick={() => onAddOne(product, "sale")}
                      title="Agregar producto individual a venta"
                    >
                      <ShoppingCart className="h-3 w-3" />
                      <span>+ Venta</span>
                    </Button>
                  )}
                  {onAddOne && !isWarehouseRole && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] font-semibold px-2 text-blue-600 border-blue-600/30 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                      onClick={() => onAddOne(product, "quote")}
                      title="Agregar producto a cotización"
                    >
                      <FileText className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
