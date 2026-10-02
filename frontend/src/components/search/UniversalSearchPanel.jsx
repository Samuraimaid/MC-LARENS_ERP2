import React, { useCallback, useEffect, useState, useMemo } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { API_BASE as API } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Search, FileText, Receipt, ClipboardList, X, Filter, 
  Calendar, ArrowRight, Sparkles, Building2, User, Car
} from "lucide-react";

const TYPE_CONFIG = {
  sale: {
    icon: Receipt,
    label: "Factura",
    badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
    borderClass: "hover:border-blue-500/50",
  },
  credit: {
    icon: FileText,
    label: "Crédito",
    badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
    borderClass: "hover:border-purple-500/50",
  },
  quotation: {
    icon: ClipboardList,
    label: "Cotización",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    borderClass: "hover:border-amber-500/50",
  },
};

export default function UniversalSearchPanel({ embedded = false, className }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const runSearch = useCallback(async (qOverride) => {
    const q = String(qOverride ?? query).trim();
    if (!q && !dateFrom && !dateTo) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const response = await axios.get(`${API}/search/unified`, {
        params: {
          q: q || undefined,
          from: dateFrom || undefined,
          to: dateTo || undefined,
          limit: 50,
        },
        withCredentials: true,
      });
      setResults(response.data?.results || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, dateFrom, dateTo]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) runSearch();
    }, 350);
    return () => clearTimeout(timer);
  }, [query, dateFrom, dateTo, runSearch]);

  const filteredResults = useMemo(() => {
    if (typeFilter === "all") return results;
    return results.filter((r) => r.type === typeFilter);
  }, [results, typeFilter]);

  const countsByType = useMemo(() => {
    const counts = { all: results.length, sale: 0, quotation: 0, credit: 0 };
    results.forEach((r) => {
      if (counts[r.type] !== undefined) counts[r.type]++;
    });
    return counts;
  }, [results]);

  const openResult = (row) => {
    if (row.url) navigate(row.url);
  };

  const handleClear = () => {
    setQuery("");
    setDateFrom("");
    setDateTo("");
    setResults([]);
    setSearched(false);
  };

  return (
    <div
      className={cn(
        embedded ? "mx-auto max-w-4xl space-y-4 p-2 sm:p-4" : "mx-auto max-w-4xl space-y-6 p-4 pb-12",
        className
      )}
    >
      {/* Header */}
      {!embedded ? (
        <div className="space-y-1.5 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-2">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Motor de Búsqueda Comercial</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-microgramma">Buscador ERP</h1>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-lg mx-auto">
            Búsqueda instantánea de facturas, cotizaciones, créditos, clientes, placas y vendedores
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight font-microgramma flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" />
              Buscador Unificado
            </h2>
            <p className="text-xs text-muted-foreground">
              Facturas, cotizaciones, créditos, clientes, vehículos y vendedores
            </p>
          </div>
          {searched && (
            <span className="text-xs font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md border border-border/80">
              {results.length} coincidencia{results.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
      )}

      {/* Main Search Input Box */}
      <div className="relative group">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-primary/20 opacity-0 group-focus-within:opacity-100 blur-md transition-opacity duration-300 pointer-events-none" />
        <div className="relative flex items-center rounded-2xl border border-border/80 dark:border-slate-800/90 bg-card/80 dark:bg-slate-950/80 backdrop-blur-xl shadow-lg shadow-black/5 transition-all group-focus-within:border-primary/50 group-focus-within:ring-2 group-focus-within:ring-primary/20">
          <Search className="ml-4 h-5 w-5 shrink-0 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            className="h-12 sm:h-13 border-0 bg-transparent px-3 text-sm sm:text-base focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/70"
            placeholder="Nº factura, cliente, cotización, placa, vendedor, chasis..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") runSearch();
              if (e.key === "Escape") handleClear();
            }}
            autoFocus
          />
          <div className="flex items-center gap-1.5 pr-3">
            {loading && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-1" />
            )}
            {query && !loading && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
                onClick={handleClear}
                title="Limpiar búsqueda (Esc)"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-muted/80 text-muted-foreground border border-border/80 shadow-xs">
              ↵ Enter
            </kbd>
          </div>
        </div>
      </div>

      {/* Quick Type Filter Tabs & Date Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Type pills */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-muted/40 dark:bg-slate-950/60 rounded-xl border border-border/80 dark:border-slate-800/80">
          {[
            { key: "all", label: "Todos", count: countsByType.all },
            { key: "sale", label: "Facturas", count: countsByType.sale },
            { key: "quotation", label: "Cotizaciones", count: countsByType.quotation },
            { key: "credit", label: "Créditos", count: countsByType.credit },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setTypeFilter(tab.key)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all duration-150",
                typeFilter === tab.key
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <span>{tab.label}</span>
              {searched && tab.count > 0 && (
                <span className={cn(
                  "px-1.5 py-0.2 rounded-full text-[9px] font-mono leading-none",
                  typeFilter === tab.key ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Date Filter & Action */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-card/60 dark:bg-slate-950/60 border border-border/80 dark:border-slate-800/80 rounded-xl px-2.5 py-1 text-xs">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-transparent border-0 text-xs focus:outline-hidden text-foreground w-[110px]"
              title="Fecha inicial"
            />
            <span className="text-muted-foreground/60 text-[10px]">→</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-transparent border-0 text-xs focus:outline-hidden text-foreground w-[110px]"
              title="Fecha final"
            />
          </div>
          <Button
            size="sm"
            onClick={() => runSearch()}
            disabled={loading}
            className="h-8 rounded-xl px-3 font-semibold shadow-xs"
          >
            {loading ? "Buscando…" : "Filtrar"}
          </Button>
        </div>
      </div>

      {/* Results Container */}
      {searched && !loading && filteredResults.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 dark:border-slate-800/80 bg-muted/10 p-8 text-center space-y-2">
          <Search className="h-8 w-8 text-muted-foreground/40 mx-auto" />
          <p className="text-sm font-semibold text-foreground">Sin resultados encontrados</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Verifica que el número de factura, cotización o nombre del cliente esté escrito correctamente.
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        {filteredResults.map((row) => {
          const config = TYPE_CONFIG[row.type] || {
            icon: FileText,
            label: row.type,
            badgeClass: "bg-muted text-muted-foreground",
            borderClass: "hover:border-primary/50",
          };
          const Icon = config.icon;

          return (
            <div
              key={`${row.type}-${row.id}`}
              onClick={() => openResult(row)}
              className={cn(
                "group relative flex items-center justify-between gap-3 p-3.5 rounded-xl border border-border/80 dark:border-slate-800/80 bg-card/60 dark:bg-slate-950/60 backdrop-blur-md cursor-pointer transition-all duration-200",
                "hover:bg-accent/40 hover:shadow-md hover:scale-[1.005]",
                config.borderClass
              )}
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className={cn(
                  "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-transform duration-200 group-hover:scale-110",
                  config.badgeClass
                )}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-foreground tracking-tight group-hover:text-primary transition-colors">
                      {row.title}
                    </span>
                    <Badge variant="outline" className={cn("text-[10px] font-semibold uppercase px-1.5 py-0", config.badgeClass)}>
                      {config.label}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground mt-0.5 font-medium">
                    {row.subtitle}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground/80 font-mono">
                    <span>{formatDate(row.date)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-semibold text-primary group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                  Ver detalle
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}