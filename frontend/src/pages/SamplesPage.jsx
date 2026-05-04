import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";
import { API_BASE as API } from "@/lib/api";

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

  return (
    <div className="space-y-6" data-testid="samples-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Muestras</h1>
          <p className="text-muted-foreground">Control de muestras solicitadas y devoluciones a bodega</p>
        </div>
        <Button variant="outline" onClick={fetchSamples} disabled={loading}>
          Actualizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado de muestras</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 mb-4">
            <Input
              placeholder="Buscar por cliente, producto o ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
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
              <TableRow>
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
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Sin registros
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((sample) => (
                  <TableRow key={sample.sample_id}>
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
    </div>
  );
}
