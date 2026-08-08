import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { formatCurrency, formatDate } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "../components/ui/dialog";
import {
  ContextualDialogFooter,
  ContextualDialogHeader,
  getStatusPrimaryButtonClass,
  getStatusSecondaryButtonClass,
} from "../components/ui/contextual-dialog-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";
import { 
  Search, RefreshCw, RotateCcw, CheckCircle2, XCircle, 
  Clock, Plus
} from "lucide-react";
import { API_BASE as API } from "@/lib/api";

const RETURN_STATUSES = {
  pending: { label: "Pendiente", color: "bg-yellow-500", icon: Clock },
  approved: { label: "Aprobado", color: "bg-blue-500", icon: CheckCircle2 },
  completed: { label: "Completado", color: "bg-green-500", icon: CheckCircle2 },
  rejected: { label: "Rechazado", color: "bg-red-500", icon: XCircle },
};

export function ReturnsPage() {
  const [returns, setReturns] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showNewReturn, setShowNewReturn] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [returnType, setReturnType] = useState("refund");
  const [returnNotes, setReturnNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(null);

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.append("status", filterStatus);
      
      const res = await axios.get(`${API}/returns?${params}`, { withCredentials: true });
      setReturns(res.data);
    } catch (error) {
      toast.error("Error al cargar devoluciones");
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  const fetchSales = async (searchTerm) => {
    if (!searchTerm || searchTerm.length < 3) return;
    try {
      const res = await axios.get(`${API}/sales?search=${searchTerm}`, { withCredentials: true });
      setSales(res.data.slice(0, 10));
    } catch (error) {
      console.error("Error fetching sales:", error);
    }
  };

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  const selectSale = (sale) => {
    setSelectedSale(sale);
    setReturnItems(sale.items.map(item => ({
      ...item,
      return_quantity: 0,
      reason: ""
    })));
  };

  const updateReturnQuantity = (index, quantity) => {
    const items = [...returnItems];
    items[index].return_quantity = Math.min(quantity, items[index].quantity);
    setReturnItems(items);
  };

  const updateReturnReason = (index, reason) => {
    const items = [...returnItems];
    items[index].reason = reason;
    setReturnItems(items);
  };

  const createReturn = async () => {
    const itemsToReturn = returnItems
      .filter(item => item.return_quantity > 0)
      .map(item => ({
        product_id: item.product_id,
        quantity: item.return_quantity,
        reason: item.reason
      }));

    if (itemsToReturn.length === 0) {
      toast.error("Selecciona al menos un producto para devolver");
      return;
    }

    try {
      await axios.post(`${API}/returns`, {
        sale_id: selectedSale.sale_id,
        items: itemsToReturn,
        return_type: returnType,
        notes: returnNotes || null
      }, { withCredentials: true });
      
      toast.success("Devolución creada exitosamente");
      setShowNewReturn(false);
      setSelectedSale(null);
      setReturnItems([]);
      setReturnNotes("");
      fetchReturns();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al crear devolución");
    }
  };

  const approveReturn = async (returnId) => {
    try {
      await axios.put(`${API}/returns/${returnId}/approve`, {}, { withCredentials: true });
      toast.success("Devolución aprobada y procesada");
      fetchReturns();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al aprobar");
    }
  };

  const rejectReturn = async (returnId) => {
    if (!rejectReason) {
      toast.error("Ingresa una razón para el rechazo");
      return;
    }
    try {
      await axios.put(`${API}/returns/${returnId}/reject?reason=${encodeURIComponent(rejectReason)}`, {}, { withCredentials: true });
      toast.success("Devolución rechazada");
      setShowReject(null);
      setRejectReason("");
      fetchReturns();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al rechazar");
    }
  };

  const filteredReturns = returns.filter(r =>
    r.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.invoice_number?.toLowerCase().includes(search.toLowerCase())
  );

  const getStats = () => ({
    pending: returns.filter(r => r.status === "pending").length,
    completed: returns.filter(r => r.status === "completed").length,
    rejected: returns.filter(r => r.status === "rejected").length,
    totalRefund: returns.filter(r => r.status === "completed").reduce((sum, r) => sum + r.total_refund, 0)
  });

  const stats = getStats();

  return (
    <div className="p-6 space-y-6" data-testid="returns-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Devoluciones</h1>
          <p className="text-muted-foreground">Gestión de devoluciones y reembolsos</p>
        </div>
        <Dialog open={showNewReturn} onOpenChange={setShowNewReturn}>
          <DialogTrigger asChild>
            <Button data-testid="new-return-btn">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Devolución
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <ContextualDialogHeader
              variant="information"
              size="inline"
              title="Nueva Devolución"
              description="Busca la factura y selecciona los productos a devolver"
            />
            
            {!selectedSale ? (
              <div className="space-y-4">
                <div>
                  <Label>Buscar Factura</Label>
                  <Input
                    placeholder="Número de factura o nombre del cliente..."
                    onChange={(e) => fetchSales(e.target.value)}
                    data-testid="search-sale"
                  />
                </div>
                {sales.length > 0 && (
                  <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                    {sales.map(sale => (
                      <div
                        key={sale.sale_id}
                        className="p-3 hover:bg-muted cursor-pointer"
                        onClick={() => selectSale(sale)}
                      >
                        <div className="flex justify-between">
                          <span className="font-mono font-medium">{sale.invoice_number}</span>
                          <span className="text-muted-foreground">{formatDate(sale.created_at)}</span>
                        </div>
                        <p className="text-sm">{sale.customer_name}</p>
                        <p className="text-sm font-medium">{formatCurrency(sale.total)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex justify-between mb-2">
                    <span className="font-mono">{selectedSale.invoice_number}</span>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedSale(null)}>
                      Cambiar
                    </Button>
                  </div>
                  <p className="text-sm">{selectedSale.customer_name}</p>
                  <p className="text-sm text-muted-foreground">{formatDate(selectedSale.created_at)}</p>
                </div>
                
                <div>
                  <Label>Productos a Devolver</Label>
                  <div className="border rounded-lg mt-2 divide-y">
                    {returnItems.map((item, idx) => (
                      <div key={item.product_id} className="p-3 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{item.product_name}</p>
                            <p className="text-sm text-muted-foreground">
                              Comprado: {item.quantity} × {formatCurrency(item.unit_price)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Label className="text-sm">Devolver:</Label>
                            <Input
                              type="number"
                              min="0"
                              max={item.quantity}
                              value={item.return_quantity}
                              onChange={(e) => updateReturnQuantity(idx, parseInt(e.target.value) || 0)}
                              className="w-20"
                            />
                          </div>
                        </div>
                        {item.return_quantity > 0 && (
                          <Input
                            placeholder="Razón de la devolución..."
                            value={item.reason}
                            onChange={(e) => updateReturnReason(idx, e.target.value)}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tipo de Devolución</Label>
                    <Select value={returnType} onValueChange={setReturnType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="refund">Reembolso</SelectItem>
                        <SelectItem value="exchange">Cambio de Producto</SelectItem>
                        <SelectItem value="store_credit">Crédito en Tienda</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Total Estimado</Label>
                    <div className="h-10 flex items-center font-mono font-bold text-lg">
                      {formatCurrency(
                        returnItems.reduce((sum, item) => 
                          sum + (item.return_quantity * item.unit_price * (1 - (item.discount || 0) / 100)), 0
                        ) * 1.12
                      )}
                    </div>
                  </div>
                </div>
                
                <div>
                  <Label>Notas</Label>
                  <Textarea
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    placeholder="Observaciones adicionales..."
                    rows={2}
                  />
                </div>
                
                <Button onClick={createReturn} className="w-full" data-testid="confirm-return-btn">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Crear Devolución
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              PENDIENTES
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold text-yellow-500">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              COMPLETADAS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold text-green-500">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              RECHAZADAS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold text-red-500">{stats.rejected}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              TOTAL REEMBOLSADO
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-2xl font-bold">{formatCurrency(stats.totalRefund)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(RETURN_STATUSES).map(([key, status]) => (
              <SelectItem key={key} value={key}>{status.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={fetchReturns}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Factura</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Productos</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Reembolso</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filteredReturns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No hay devoluciones
                  </TableCell>
                </TableRow>
              ) : (
                filteredReturns.map(ret => {
                  const status = RETURN_STATUSES[ret.status] || RETURN_STATUSES.pending;
                  const StatusIcon = status.icon;
                  
                  return (
                    <TableRow key={ret.return_id}>
                      <TableCell className="font-mono text-xs">{ret.return_id}</TableCell>
                      <TableCell className="font-mono">{ret.invoice_number}</TableCell>
                      <TableCell>{ret.customer_name}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {ret.items?.slice(0, 2).map((item, i) => (
                            <div key={i}>{item.quantity}× {item.product_name?.substring(0, 20)}</div>
                          ))}
                          {ret.items?.length > 2 && (
                            <div className="text-muted-foreground">+{ret.items.length - 2} más</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {ret.return_type === "refund" ? "Reembolso" : 
                           ret.return_type === "exchange" ? "Cambio" : "Crédito"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono font-medium">
                        {formatCurrency(ret.total_refund)}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${status.color} text-white gap-1`}>
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {ret.status === "pending" && (
                          <div className="flex gap-1">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => approveReturn(ret.return_id)}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setShowReject(ret)}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                        {ret.status === "completed" && ret.processed_by_name && (
                          <span className="text-xs text-muted-foreground">
                            Por: {ret.processed_by_name}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={!!showReject} onOpenChange={() => setShowReject(null)}>
        <DialogContent className="max-w-sm">
          <ContextualDialogHeader
            variant="error"
            size="hero"
            title="Rechazar Devolución"
            description="Indica la razón del rechazo. Esta acción quedará registrada."
          />
          <div className="space-y-4">
            <div>
              <Label>Razón del Rechazo</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explica por qué se rechaza esta devolución..."
                rows={3}
              />
            </div>
            <ContextualDialogFooter variant="error">
              <Button
                variant="ghost"
                className={getStatusSecondaryButtonClass("error")}
                onClick={() => setShowReject(null)}
              >
                Cancelar
              </Button>
              <Button
                className={getStatusPrimaryButtonClass("error")}
                onClick={() => rejectReturn(showReject?.return_id)}
              >
                Confirmar Rechazo
              </Button>
            </ContextualDialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
