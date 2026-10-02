import React, { useState, useMemo, useRef, useEffect } from "react";
import { Search, ChevronDown, Check, X, Package, Box } from "lucide-react";
import { cn } from "@/lib/utils";
import { productMatchesSearch } from "@/lib/productLookup";
import { formatCategoryLabel, getProductBrandLogo } from "@/lib/branding";
import ProductThumb from "@/components/products/ProductThumb";
import { Badge } from "@/components/ui/badge";

export default function ProductCatalogSelect({
  products = [],
  value = "",
  onChange,
  placeholder = "Seleccionar producto...",
  disabled = false,
  className = "",
  showStockForWarehouseId = null,
  inventoryMap = {},
  allowClear = false,
  "data-testid": testId,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const selectedProduct = useMemo(() => {
    if (!value) return null;
    return products.find((p) => p.product_id === value) || null;
  }, [products, value]);

  const filteredProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) {
      return products.slice(0, 40);
    }
    const matched = products.filter((p) => productMatchesSearch(p, q));
    
    // Sort by relevance
    const scored = matched.map((p) => {
      const sku = String(p.sku || "").toLowerCase();
      const name = String(p.name || "").toLowerCase();
      const brand = String(p.brand || "").toLowerCase();
      let score = 0;
      if (sku === q) score = 100;
      else if (sku.startsWith(q)) score = 80;
      else if (sku.includes(q)) score = 60;
      else if (name.startsWith(q)) score = 50;
      else if (name.includes(q)) score = 40;
      else if (brand.includes(q)) score = 30;
      else score = 10;
      return { product: p, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 50).map((r) => r.product);
  }, [products, searchTerm]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Auto focus input when opened
  useEffect(() => {
    if (isOpen) {
      setSearchTerm("");
      setHighlightedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const handleSelect = (product) => {
    onChange(product ? product.product_id : "", product);
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredProducts.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredProducts[highlightedIndex]) {
        handleSelect(filteredProducts[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  const getProductStock = (productId) => {
    if (!showStockForWarehouseId) return null;
    const invKey = `${productId}_${showStockForWarehouseId}`;
    return inventoryMap[invKey] ?? 0;
  };

  return (
    <div className={cn("relative w-full", className)} ref={containerRef} onKeyDown={handleKeyDown}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        data-testid={testId}
        className={cn(
          "flex items-center justify-between w-full h-10 px-3 py-2 text-sm rounded-md border text-left",
          "bg-white dark:bg-slate-900 border-input shadow-xs transition-colors",
          "hover:bg-slate-50 dark:hover:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-primary/40",
          disabled && "opacity-50 cursor-not-allowed",
          isOpen && "ring-2 ring-primary/40 border-primary"
        )}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {selectedProduct ? (
            <>
              <ProductThumb
                product={selectedProduct}
                size="sm"
                className="h-6 w-6 rounded shrink-0"
              />
              <span className="font-mono font-semibold text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 shrink-0">
                {selectedProduct.sku || "SIN-SKU"}
              </span>
              <span className="truncate font-medium text-slate-900 dark:text-slate-100">
                {selectedProduct.name}
              </span>
              {selectedProduct.brand && (
                <span className="text-[11px] text-muted-foreground shrink-0 hidden sm:inline">
                  · {selectedProduct.brand}
                </span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Search className="h-4 w-4 shrink-0 opacity-50" />
              <span className="truncate">{placeholder}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-2">
          {allowClear && selectedProduct && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(null);
              }}
              className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
        </div>
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[320px] sm:min-w-[420px] rounded-lg border bg-white dark:bg-slate-900 p-2 shadow-xl animate-in fade-in-0 zoom-in-95">
          {/* Search Input */}
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setHighlightedIndex(0);
              }}
              placeholder="Buscar por nombre, SKU, marca (DLAA, Fox, Auxbeam)..."
              className="w-full h-9 pl-8 pr-3 text-xs rounded-md bg-slate-100 dark:bg-slate-800/80 border-0 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Results List */}
          <div ref={listRef} className="max-h-64 overflow-y-auto space-y-1 pr-1">
            {filteredProducts.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                <Box className="h-6 w-6 mx-auto mb-1 opacity-40" />
                No se encontraron productos coincidentes con "{searchTerm}"
              </div>
            ) : (
              filteredProducts.map((p, index) => {
                const isSelected = p.product_id === value;
                const isHighlighted = index === highlightedIndex;
                const stock = getProductStock(p.product_id);

                return (
                  <div
                    key={p.product_id}
                    onClick={() => handleSelect(p)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={cn(
                      "flex items-center gap-2.5 p-2 rounded-md text-xs cursor-pointer transition-colors",
                      isHighlighted ? "bg-slate-100 dark:bg-slate-800" : "hover:bg-slate-50 dark:hover:bg-slate-800/50",
                      isSelected && "bg-primary/10 dark:bg-primary/20 font-medium"
                    )}
                  >
                    <ProductThumb
                      product={p}
                      size="sm"
                      className="h-8 w-8 rounded shrink-0"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-[11px] px-1 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700/80 text-slate-800 dark:text-slate-200">
                          {p.sku || "SIN-SKU"}
                        </span>
                        {p.brand && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1 font-semibold uppercase">
                            {p.brand}
                          </Badge>
                        )}
                        <span className="truncate text-slate-900 dark:text-slate-100">
                          {p.name}
                        </span>
                      </div>

                      <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5 truncate">
                        <span>{formatCategoryLabel(p.category)}</span>
                        {p.subcategory && <span>· {p.subcategory}</span>}
                        {stock !== null && (
                          <span className={cn(
                            "font-medium",
                            stock > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                          )}>
                            · Stock: {stock} u.
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="h-4 w-4 text-primary shrink-0 ml-1" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
