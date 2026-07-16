import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { API_BASE as API } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, FileText, Receipt, ClipboardList } from "lucide-react";

const TYPE_ICONS = {
  sale: Receipt,
  credit: FileText,
  quotation: ClipboardList,
};

const TYPE_LABELS = {
  sale: "Factura",
  credit: "Crédito",
  quotation: "Cotización",
};

export function UniversalSearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
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

  const openResult = (row) => {
    if (row.url) navigate(row.url);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-12">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Buscador ERP</h1>
        <p className="text-sm text-muted-foreground">
          Facturas, cotizaciones, créditos, clientes, placas, vendedores y más
        </p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-12 pl-12 pr-4 text-base shadow-sm"
          placeholder="Nº factura, cliente, cotización, placa, vendedor..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
        />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Desde</label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Hasta</label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9" />
        </div>
        <Button onClick={() => runSearch()} disabled={loading}>
          {loading ? "Buscando..." : "Buscar"}
        </Button>
      </div>

      {searched && !loading && results.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">Sin resultados para esta búsqueda.</p>
      ) : null}

      <div className="space-y-2">
        {results.map((row) => {
          const Icon = TYPE_ICONS[row.type] || FileText;
          return (
            <Card
              key={`${row.type}-${row.id}`}
              className="cursor-pointer transition-colors hover:bg-muted/40"
              onClick={() => openResult(row)}
            >
              <CardContent className="flex items-start gap-3 p-4">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{row.title}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {TYPE_LABELS[row.type] || row.type}
                    </Badge>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{row.subtitle}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(row.date)}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}