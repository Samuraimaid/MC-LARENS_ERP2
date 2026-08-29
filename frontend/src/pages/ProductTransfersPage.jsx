import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { toast } from "sonner";
import { ArrowRightLeft, Download, RefreshCw, Truck, CheckCircle2, AlertCircle, Clock, ShieldCheck } from "lucide-react";
import { API_BASE as API } from "@/lib/api";

const TRANSFER_IN_REASONS = new Set(["transfer_in", "transfer_request_in", "transfer_received"]);
const TRANSFER_OUT_REASONS = new Set(["transfer_out", "transfer_request_out", "transfer_shipped"]);

export function ProductTransfersPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [movements, setMovements] = useState([]);
  const [transferRequests, setTransferRequests] = useState([]);
  const [activeTab, setActiveTab] = useState("requests");
  const [form, setForm] = useState({
    product_id: "",
    from_warehouse: "",
    to_warehouse: "",
    quantity: "1",
    reason: "",
    transfer_mode: "two_step", // two_step (solicitud/tránsito) o direct (inmediato)
  });

  const isWarehouseRole = user?.role === "bodegas";
  const isSupervisorOrAdmin = ["admin", "gerencia", "supervisor", "jefe_tienda"].includes(user?.role);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [warehousesRes, inventoryRes, movementsRes, requestsRes] = await Promise.all([
        axios.get(`${API}/inventory/warehouses`, { withCredentials: true }),
        axios.get(`${API}/inventory`, { withCredentials: true }),
        axios.get(`${API}/inventory/movements?limit=300`, { withCredentials: true }),
        axios.get(`${API}/inventory/transfer-requests`, { withCredentials: true }).catch(() => ({ data: [] })),
      ]);

      const wh = Array.isArray(warehousesRes.data) ? warehousesRes.data : [];
      const inv = Array.isArray(inventoryRes.data) ? inventoryRes.data : [];
      const mov = Array.isArray(movementsRes.data) ? movementsRes.data : [];
      const reqs = Array.isArray(requestsRes.data) ? requestsRes.data : [];

      setWarehouses(wh);
      setInventory(inv);
      setMovements(mov);
      setTransferRequests(reqs);

      const defaultFrom = isWarehouseRole ? (user?.warehouse_id || "") : (form.from_warehouse || user?.warehouse_id || "");
      setForm((prev) => ({
        ...prev,
        from_warehouse: defaultFrom,
        to_warehouse: prev.to_warehouse || wh.find((item) => item.warehouse_id !== defaultFrom)?.warehouse_id || "",
      }));
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al cargar traslados");
    } finally {
      setLoading(false);
    }
  }, [form.from_warehouse, isWarehouseRole, user?.warehouse_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const inventoryOptions = useMemo(() => {
    const fromWarehouse = form.from_warehouse;
    const filtered = inventory.filter((item) => {
      if (!item?.product_id) return false;
      if (fromWarehouse && item.warehouse_id !== fromWarehouse) return false;
      return Number(item.quantity || 0) > 0;
    });
    return filtered.sort((a, b) => String(a.product?.name || a.product_id).localeCompare(String(b.product?.name || b.product_id)));
  }, [inventory, form.from_warehouse]);

  const incoming = useMemo(
    () => movements.filter((movement) => TRANSFER_IN_REASONS.has(String(movement?.reason || ""))),
    [movements]
  );

  const outgoing = useMemo(
    () => movements.filter((movement) => TRANSFER_OUT_REASONS.has(String(movement?.reason || ""))),
    [movements]
  );

  const inTransitRequests = useMemo(
    () => transferRequests.filter((req) => req.status === "shipped"),
    [transferRequests]
  );

  const pendingRequests = useMemo(
    () => transferRequests.filter((req) => req.status === "pending" || req.status === "approved"),
    [transferRequests]
  );

  const completedRequests = useMemo(
    () => transferRequests.filter((req) => req.status === "received" || req.status === "rejected"),
    [transferRequests]
  );

  const warehouseLabel = (warehouseId) => {
    const found = warehouses.find((item) => item.warehouse_id === warehouseId);
    return found?.name || warehouseId || "-";
  };

  const movementSource = (movement) => movement?.metadata?.from_warehouse || movement?.from_warehouse || "-";
  const movementTarget = (movement) => movement?.metadata?.to_warehouse || movement?.to_warehouse || "-";

  const onTransfer = async () => {
    const quantityNum = Number(form.quantity || 0);
    if (!form.product_id || !form.from_warehouse || !form.to_warehouse || quantityNum <= 0) {
      toast.error("Completa producto, bodega origen, destino y cantidad válida");
      return;
    }
    if (form.from_warehouse === form.to_warehouse) {
      toast.error("La bodega origen y destino deben ser diferentes");
      return;
    }

    setSubmitting(true);
    try {
      if (form.transfer_mode === "two_step") {
        // Solicitud formal de traslado en 2 pasos
        await axios.post(
          `${API}/inventory/transfer-request`,
          {
            product_id: form.product_id,
            from_warehouse_id: form.from_warehouse,
            to_warehouse_id: form.to_warehouse,
            quantity: quantityNum,
            reason: form.reason || "Traslado operativo entre bodegas",
          },
          { withCredentials: true }
        );
        toast.success("Solicitud de traslado registrada con estado En Tránsito seguro");
      } else {
        // Traslado directo
        await axios.post(
          `${API}/inventory/transfer`,
          null,
          {
            params: {
              product_id: form.product_id,
              from_warehouse: form.from_warehouse,
              to_warehouse: form.to_warehouse,
              quantity: quantityNum,
            },
            withCredentials: true,
          }
        );
        toast.success("Traslado directo realizado exitosamente");
      }

      setForm((prev) => ({ ...prev, product_id: "", quantity: "1", reason: "" }));
      await fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo procesar el traslado");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (requestId) => {
    setActionLoading(true);
    try {
      await axios.put(`${API}/inventory/transfer-requests/${requestId}/approve`, null, { withCredentials: true });
      toast.success("Traslado aprobado para despacho");
      await fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al aprobar traslado");
    } finally {
      setActionLoading(false);
    }
  };

  const handleShip = async (requestId) => {
    setActionLoading(true);
    try {
      await axios.put(`${API}/inventory/transfer-requests/${requestId}/ship`, null, { withCredentials: true });
      toast.success("Mercancía despachada. Pasó a estado En Tránsito.");
      await fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al despachar mercancía");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReceive = async (requestId) => {
    setActionLoading(true);
    try {
      await axios.put(`${API}/inventory/transfer-requests/${requestId}/receive`, null, { withCredentials: true });
      toast.success("Recepción confirmada. Stock ingresado en bodega de destino.");
      await fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al confirmar recepción");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="product-transfers-page">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Gestión de Traslados e Inventario en Tránsito</h1>
          <p className="text-muted-foreground">Control blindado de envíos, traslados inter-sucursales y recepción en destino</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <Button variant="outline" asChild>
            <a href={`${API}/inventory/movements/export?format=excel`}>
              <Download className="h-4 w-4 mr-2" />
              Kardex
            </a>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full">
          <TabsTrigger value="requests" className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            <span>Nuevo Traslado</span>
          </TabsTrigger>
          <TabsTrigger value="in_transit" className="flex items-center gap-2 relative">
            <Truck className="h-4 w-4" />
            <span>En Tránsito</span>
            {inTransitRequests.length > 0 && (
              <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-xs">
                {inTransitRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>Por Despachar ({pendingRequests.length})</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>Historial y Kardex</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: NUEVO TRASLADO */}
        <TabsContent value="requests" className="space-y-4 pt-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-primary" />
                Registrar Solicitud / Envío de Mercadería
              </CardTitle>
              <CardDescription>
                El modo seguro descuenta de origen al despachar y solo ingresa a destino al confirmar la recepción física.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <Label>Bodega Origen</Label>
                  <Select
                    value={form.from_warehouse}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, from_warehouse: value, product_id: "" }))}
                    disabled={isWarehouseRole}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((warehouse) => (
                        <SelectItem key={warehouse.warehouse_id} value={warehouse.warehouse_id}>
                          {warehouse.name || warehouse.warehouse_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Producto</Label>
                  <Select
                    value={form.product_id}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, product_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona producto" />
                    </SelectTrigger>
                    <SelectContent>
                      {inventoryOptions.map((item) => (
                        <SelectItem key={`${item.product_id}-${item.warehouse_id}`} value={item.product_id}>
                          {(item.product?.name || item.product_id)} · Stock: {item.quantity}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Bodega Destino</Label>
                  <Select
                    value={form.to_warehouse}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, to_warehouse: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses
                        .filter((warehouse) => warehouse.warehouse_id !== form.from_warehouse)
                        .map((warehouse) => (
                          <SelectItem key={warehouse.warehouse_id} value={warehouse.warehouse_id}>
                            {warehouse.name || warehouse.warehouse_id}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Cantidad</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.quantity}
                    onChange={(event) => setForm((prev) => ({ ...prev, quantity: event.target.value }))}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 mt-4">
                <div>
                  <Label>Motivo / Observaciones del Envío</Label>
                  <Input
                    placeholder="Ej. Reabastecimiento de mostrador, pedido de cliente..."
                    value={form.reason}
                    onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
                  />
                </div>
                {isSupervisorOrAdmin && (
                  <div>
                    <Label>Modalidad de Traslado</Label>
                    <Select
                      value={form.transfer_mode}
                      onValueChange={(val) => setForm((prev) => ({ ...prev, transfer_mode: val }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="two_step">En 2 Pasos con Estado En Tránsito (Recomendado)</SelectItem>
                        <SelectItem value="direct">Traslado Inmediato Directo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <Button onClick={onTransfer} disabled={submitting || loading}>
                  {submitting ? "Procesando..." : form.transfer_mode === "two_step" ? "Registrar Envío en Tránsito" : "Trasladar Inmediatamente"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: EN TRÁNSITO */}
        <TabsContent value="in_transit" className="space-y-4 pt-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-amber-500" />
                Cargas en Ruta de Transporte (En Tránsito)
              </CardTitle>
              <CardDescription>
                La mercancía ya fue descontada de origen y está viajando hacia la bodega destino. Pulsa "Confirmar Recepción" al verificar físicamente los bultos.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha Despacho</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Despachado Por</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inTransitRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No hay mercancía en tránsito en este momento.
                      </TableCell>
                    </TableRow>
                  ) : (
                    inTransitRequests.map((req) => (
                      <TableRow key={req.request_id}>
                        <TableCell>{String(req.shipped_at || req.created_at || "").slice(0, 16).replace("T", " ")}</TableCell>
                        <TableCell className="font-medium">{req.product_id}</TableCell>
                        <TableCell>{warehouseLabel(req.from_warehouse_id)}</TableCell>
                        <TableCell className="font-semibold text-primary">{warehouseLabel(req.to_warehouse_id)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-base font-bold">{req.quantity}</Badge>
                        </TableCell>
                        <TableCell>{req.shipped_by_name || req.requested_by_name || "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => handleReceive(req.request_id)}
                            disabled={actionLoading}
                          >
                            <ShieldCheck className="h-4 w-4 mr-1" />
                            Confirmar Recepción
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: POR DESPACHAR / PENDIENTES */}
        <TabsContent value="pending" className="space-y-4 pt-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" />
                Solicitudes de Traslado Pendientes de Despacho
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No hay solicitudes pendientes por despachar.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pendingRequests.map((req) => (
                      <TableRow key={req.request_id}>
                        <TableCell>{String(req.created_at || "").slice(0, 16).replace("T", " ")}</TableCell>
                        <TableCell className="font-medium">{req.product_id}</TableCell>
                        <TableCell>{warehouseLabel(req.from_warehouse_id)}</TableCell>
                        <TableCell>{warehouseLabel(req.to_warehouse_id)}</TableCell>
                        <TableCell><Badge variant="secondary">{req.quantity}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={req.status === "approved" ? "default" : "outline"}>
                            {req.status === "approved" ? "Aprobado para despacho" : "Pendiente de aprobación"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {req.status === "pending" && isSupervisorOrAdmin ? (
                            <Button size="sm" variant="outline" onClick={() => handleApprove(req.request_id)} disabled={actionLoading}>
                              Aprobar
                            </Button>
                          ) : req.status === "approved" ? (
                            <Button size="sm" onClick={() => handleShip(req.request_id)} disabled={actionLoading}>
                              <Truck className="h-4 w-4 mr-1" />
                              Despachar
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">En espera de supervisor</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: HISTORIAL */}
        <TabsContent value="history" className="space-y-4 pt-2">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Últimos Ingresos / Recepciones</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Desde</TableHead>
                      <TableHead>Cant.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incoming.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sin recepciones</TableCell>
                      </TableRow>
                    ) : (
                      incoming.slice(0, 20).map((movement, index) => (
                        <TableRow key={`${movement.reference_id || movement.created_at}-${index}`}>
                          <TableCell>{String(movement.created_at || "").slice(0, 16).replace("T", " ")}</TableCell>
                          <TableCell className="font-medium">{movement.product_id}</TableCell>
                          <TableCell>{warehouseLabel(movementSource(movement))}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-emerald-600">+{Math.abs(Number(movement.quantity_change || 0))}</Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Últimas Salidas / Despachos</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Hacia</TableHead>
                      <TableHead>Cant.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outgoing.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sin salidas</TableCell>
                      </TableRow>
                    ) : (
                      outgoing.slice(0, 20).map((movement, index) => (
                        <TableRow key={`${movement.reference_id || movement.created_at}-${index}`}>
                          <TableCell>{String(movement.created_at || "").slice(0, 16).replace("T", " ")}</TableCell>
                          <TableCell className="font-medium">{movement.product_id}</TableCell>
                          <TableCell>{warehouseLabel(movementTarget(movement))}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-orange-600">-{Math.abs(Number(movement.quantity_change || 0))}</Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
