import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import { ArrowRightLeft, Download, RefreshCw } from "lucide-react";
import { API_BASE as API } from "@/lib/api";

const TRANSFER_IN_REASONS = new Set(["transfer_in", "transfer_request_in"]);
const TRANSFER_OUT_REASONS = new Set(["transfer_out", "transfer_request_out"]);

export function ProductTransfersPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [movements, setMovements] = useState([]);
  const [form, setForm] = useState({
    product_id: "",
    from_warehouse: "",
    to_warehouse: "",
    quantity: "1",
  });

  const isWarehouseRole = user?.role === "bodegas";

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [warehousesRes, inventoryRes, movementsRes] = await Promise.all([
        axios.get(`${API}/inventory/warehouses`, { withCredentials: true }),
        axios.get(`${API}/inventory`, { withCredentials: true }),
        axios.get(`${API}/inventory/movements?limit=300`, { withCredentials: true }),
      ]);

      const wh = Array.isArray(warehousesRes.data) ? warehousesRes.data : [];
      const inv = Array.isArray(inventoryRes.data) ? inventoryRes.data : [];
      const mov = Array.isArray(movementsRes.data) ? movementsRes.data : [];

      setWarehouses(wh);
      setInventory(inv);
      setMovements(mov);

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
      toast.success("Traslado realizado");
      setForm((prev) => ({ ...prev, product_id: "", quantity: "1" }));
      await fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo completar el traslado");
    } finally {
      setSubmitting(false);
    }
  };

  const warehouseLabel = (warehouseId) => {
    const found = warehouses.find((item) => item.warehouse_id === warehouseId);
    return found?.name || warehouseId || "-";
  };

  const movementSource = (movement) => movement?.metadata?.from_warehouse || movement?.from_warehouse || "-";
  const movementTarget = (movement) => movement?.metadata?.to_warehouse || movement?.to_warehouse || "-";

  return (
    <div className="space-y-6" data-testid="product-transfers-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Traslados de Productos</h1>
          <p className="text-muted-foreground">Trasladar y recibir productos entre bodegas</p>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Nuevo Traslado
          </CardTitle>
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

          <div className="mt-4 flex justify-end">
            <Button onClick={onTransfer} disabled={submitting || loading}>
              {submitting ? "Trasladando..." : "Trasladar Producto"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Productos Recibidos</CardTitle>
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
                  incoming.slice(0, 30).map((movement, index) => (
                    <TableRow key={`${movement.reference_id || movement.created_at}-${index}`}>
                      <TableCell>{String(movement.created_at || "").slice(0, 16).replace("T", " ")}</TableCell>
                      <TableCell>{movement.product_id}</TableCell>
                      <TableCell>{warehouseLabel(movementSource(movement))}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-green-600">+{Math.abs(Number(movement.quantity_change || 0))}</Badge>
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
            <CardTitle>Productos Trasladados</CardTitle>
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
                  outgoing.slice(0, 30).map((movement, index) => (
                    <TableRow key={`${movement.reference_id || movement.created_at}-${index}`}>
                      <TableCell>{String(movement.created_at || "").slice(0, 16).replace("T", " ")}</TableCell>
                      <TableCell>{movement.product_id}</TableCell>
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

      <div className="flex justify-end">
        <Button variant="outline" asChild>
          <a href={`${API}/inventory/movements/export?format=excel`}>
            <Download className="h-4 w-4 mr-2" />
            Exportar Kardex
          </a>
        </Button>
      </div>
    </div>
  );
}
