import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Checkbox } from "../components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";
import { Download, Copy } from "lucide-react";
import { API_BASE as API } from "@/lib/api";
import { useListDensity } from "@/hooks/useListDensity";
import { ListDensityToggle } from "@/components/lists/ListDensityToggle";
import { BackToTopButton } from "@/components/lists/BackToTopButton";
import { ListSelectionBar } from "@/components/lists/ListSelectionBar";
import { useListSelection } from "@/hooks/useListSelection";
import { useListScrollRestore } from "@/hooks/useListScrollRestore";
import { downloadCsv, copyTextToClipboard } from "@/components/lists/listBulkUtils";

const STATUS_LABELS = {
  requested: "Solicitada",
  delivered: "Entregada",
  return_requested: "Devolución solicitada",
  returned: "Devuelta",
  consumed: "Comprada",
  cancelled: "Cancelada",
};

const STATUS_COLORS = {
  requested: "bg-blue-500",
  delivered: "bg-amber-500",
  return_requested: "bg-purple-500",
  returned: "bg-green-500",
  consumed: "bg-green-600",
  cancelled: "bg-gray-500",
};

export function SamplesPage() {
  const { density: listDensity, setDensity: setListDensity, tokens: densityTok } = useListDensity();
  const selection = useListSelection();
  useListScrollRestore({ pageKey: "samples" });

  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchSamples = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/samples`, { withCredentials: true });
      setSamples(response.data || []);
    } catch (error) {
      toast.error("No se pudieron cargar las muestras");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSamples();
  }, []);

  const requestReturn = async (sampleId) => {
    try {
      await axios.post(`${API}/samples/${sampleId}/return`, {}, { withCredentials: true });
      toast.success("Devolución solicitada");
      fetchSamples();
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo solicitar devolución");
    }
  };

  const filtered = useMemo(() => {
    return samples.filter((s) => {
      const matchesStatus = statusFilter === "all" || s.status === statusFilter;
      const query = search.toLowerCase();
      const matchesSearch =
        (s.customer_name || "").toLowerCase().includes(query) ||
        (s.product_name || "").toLowerCase().includes(query) ||
        (s.sample_id || "").toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [samples, search, statusFilter]);

  const visibleIds = filtered.map((s) => s.sample_id);
  const selectedRows = filtered.filter((s) => selection.isSelected(s.sample_id));

  const exportCsv = () => {
    const rowsSrc = selectedRows.length ? selectedRows : filtered;
    if (!rowsSrc.length) {
      toast.error("No hay muestras para exportar");
      return;
    }
    downloadCsv(
      `muestras_${new Date().toISOString().slice(0, 10)}.csv`,
      ["sample_id", "cliente", "producto", "bodega", "estado"],
      rowsSrc.map((s) => [s.sample_id, s.customer_name, s.product_name, s.warehouse_id, s.status])
    );
    toast.success(`CSV exportado (${rowsSrc.length})`);
  };

  const copyIds = async () => {
    if (!selectedRows.length) {
      toast.error("Selecciona al menos una muestra");
      return;
    }
    try {
      await copyTextToClipboard(selectedRows.map((s) => s.sample_id).join(", "));
      toast.success("IDs copiados");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const bulkRequestReturn = async () => {
    const targets = selectedRows.filter((s) => s.status === "delivered");
    if (!targets.length) {
      toast.error("Ninguna seleccionada está en estado Entregada");
      return;
    }
    if (!confirm(`Solicitar devolución de ${targets.length} muestra(s)?`)) return;
    let ok = 0;
    for (const s of targets) {
      try {
        await axios.post(`${API}/samples/${s.sample_id}/return`, {}, { withCredentials: true });
        ok += 1;
      } catch {
        /* continue */
      }
    }
    toast.success(`${ok} devolución(es) solicitada(s)`);
    selection.clear();
    fetchSamples();
  };

  return (
    <div className="space-y-6" data-testid="samples-page">
      <div className="flex justify-end mb-2">
        <ListDensityToggle value={listDensity} onChange={setListDensity} testId="samples-list-density" />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Muestras</h1>
          <p className="text-muted-foreground">Control de muestras solicitadas y devoluciones a bodega</p>
        </div>
        <Button variant="outline" onClick={fetchSamples} disabled={loading}>
          Actualizar
        </Button>
      </div>

      <ListSelectionBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por cliente, producto o ID..."
        selectedCount={selection.count}
        visibleCount={visibleIds.length}
        allVisibleSelected={selection.allVisibleSelected(visibleIds)}
        someVisibleSelected={selection.someVisibleSelected(visibleIds)}
        onSelectAll={() => selection.toggleAllVisible(visibleIds)}
        onDeselectAll={selection.clear}
        testId="samples-selection-bar"
      >
        <Button type="button" size="sm" className="h-8" disabled={!selectedRows.some((s) => s.status === "delivered")} onClick={bulkRequestReturn}>
          Devolver lote
        </Button>
        <Button type="button" variant="secondary" size="sm" className="h-8" onClick={exportCsv}>
          <Download className="h-4 w-4 mr-1" />
          CSV
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8" disabled={selection.count === 0} onClick={copyIds}>
          <Copy className="h-4 w-4 mr-1" />
          Copiar IDs
        </Button>
      </ListSelectionBar>

      <Card>
        <CardHeader>
          <CardTitle>Listado de muestras</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 mb-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="requested">Solicitada</SelectItem>
                <SelectItem value="delivered">Entregada</SelectItem>
                <SelectItem value="return_requested">Devolución solicitada</SelectItem>
                <SelectItem value="returned">Devuelta</SelectItem>
                <SelectItem value="consumed">Comprada</SelectItem>
                <SelectItem value="cancelled">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow className={densityTok.tableRow}>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selection.allVisibleSelected(visibleIds) ? true : selection.someVisibleSelected(visibleIds) ? "indeterminate" : false}
                    onCheckedChange={() => selection.toggleAllVisible(visibleIds)}
                    aria-label="Seleccionar todos"
                  />
                </TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Bodega</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow className={densityTok.tableRow}>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow className={densityTok.tableRow}>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Sin registros
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((sample) => (
                  <TableRow className={densityTok.tableRow} key={sample.sample_id} data-selected={selection.isSelected(sample.sample_id) ? "true" : "false"}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selection.isSelected(sample.sample_id)}
                        onCheckedChange={() => selection.toggle(sample.sample_id)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{sample.sample_id}</TableCell>
                    <TableCell>{sample.customer_name || "N/A"}</TableCell>
                    <TableCell>{sample.product_name || "N/A"}</TableCell>
                    <TableCell>{sample.warehouse_id || "N/A"}</TableCell>
                    <TableCell>
                      <Badge className={`${STATUS_COLORS[sample.status] || "bg-gray-500"} text-white`}>
                        {STATUS_LABELS[sample.status] || sample.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {sample.status === "delivered" && (
                        <Button size="sm" onClick={() => requestReturn(sample.sample_id)}>
                          Solicitar devolución
                        </Button>
                      )}
                      {sample.status === "return_requested" && (
                        <span className="text-xs text-muted-foreground">En devolución</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <BackToTopButton />
    </div>
  );
}
