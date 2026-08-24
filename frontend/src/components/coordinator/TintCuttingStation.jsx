import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API_BASE as API } from "@/lib/api";
import { toast } from "sonner";
import {
  Scissors,
  Printer,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Car,
  Clock,
  User,
  PackageOpen,
  RefreshCw,
  Search,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Label } from "../ui/label";
import { audioAlerts } from "../../lib/audioAlerts";

export function TintCuttingStation() {
  const [orders, setOrders] = useState([]);
  const [activeRolls, setActiveRolls] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("pending"); // "pending" | "history" | "rolls"
  const [searchTerm, setSearchTerm] = useState("");

  // Modal para agregar metros (+0.5m)
  const [adjustOrder, setAdjustOrder] = useState(null);
  const [adjustMaterial, setAdjustMaterial] = useState("");
  const [adjustWidth, setAdjustWidth] = useState(20);
  const [adjustMeters, setAdjustMeters] = useState(0.50);
  const [adjustReason, setAdjustReason] = useState("");
  const [savingAdjust, setSavingAdjust] = useState(false);

  // Modal para abrir nuevo rollo desde bodega
  const [openRollData, setOpenRollData] = useState(null);
  const [openingRoll, setOpeningRoll] = useState(false);

  // Asignación de polarizador por orden
  const [assignedTechs, setAssignedTechs] = useState({});

  const fetchData = useCallback(async () => {
    try {
      const [resOrders, resRolls, resTechs] = await Promise.allSettled([
        axios.get(`${API}/tint-cutting/orders`, { withCredentials: true }),
        axios.get(`${API}/tint-cutting/active-rolls`, { withCredentials: true }),
        axios.get(`${API}/users?role=polarizador`, { withCredentials: true }),
      ]);

      if (resOrders.status === "fulfilled") {
        setOrders(resOrders.value.data || []);
      }
      if (resRolls.status === "fulfilled") {
        setActiveRolls(resRolls.value.data || []);
      }
      if (resTechs.status === "fulfilled") {
        const list = Array.isArray(resTechs.value.data) ? resTechs.value.data : resTechs.value.data?.users || [];
        setTechnicians(list);
      }
    } catch (err) {
      console.error("Error fetching cutting station data:", err);
      toast.error("Error cargando datos de la mesa de corte");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Agregar metros adicionales (+0.5m)
  const handleOpenAddMeters = (order) => {
    setAdjustOrder(order);
    const firstRoll = (order.roll_summary || [])[0] || {};
    setAdjustMaterial(firstRoll.material_id || "");
    setAdjustWidth(firstRoll.roll_width_inches || 20);
    setAdjustMeters(0.50);
    setAdjustReason("");
  };

  const handleSaveAddMeters = async () => {
    if (!adjustReason.trim()) {
      toast.error("Ingresa el motivo del metraje adicional");
      return;
    }
    setSavingAdjust(true);
    try {
      const res = await axios.post(
        `${API}/tint-cutting/orders/${adjustOrder.cut_order_id}/add-meters`,
        {
          material_id: adjustMaterial,
          roll_width_inches: parseInt(adjustWidth, 10),
          meters: parseFloat(adjustMeters),
          reason: adjustReason,
        },
        { withCredentials: true }
      );
      toast.success(res.data.message || "Metros agregados exitosamente");
      setAdjustOrder(null);
      fetchData();
    } catch (err) {
      console.error("Error adding meters:", err);
      toast.error(err.response?.data?.detail || "Error agregando metraje a la orden");
    } finally {
      setSavingAdjust(false);
    }
  };

  // Despachar orden de corte a polarizador
  const handleDispatch = async (order) => {
    const selectedTechId = assignedTechs[order.cut_order_id] || order.assigned_technician_id;
    const selectedTech = technicians.find((t) => (t.user_id || t.id) === selectedTechId);

    try {
      const res = await axios.post(
        `${API}/tint-cutting/orders/${order.cut_order_id}/dispatch`,
        {
          assigned_technician_id: selectedTechId || null,
          assigned_technician_name: selectedTech?.name || null,
        },
        { withCredentials: true }
      );

      audioAlerts.playMaterialReadyChime();
      toast.success(`Orden #${order.cut_order_id} despachada correctamente.`);
      fetchData();
    } catch (err) {
      console.error("Error dispatching order:", err);
      toast.error(err.response?.data?.detail || "Error despachando orden de corte");
    }
  };

  // Abrir nuevo rollo desde bodega sellada
  const handleConfirmOpenNewRoll = async () => {
    if (!openRollData) return;
    setOpeningRoll(true);
    try {
      const res = await axios.post(
        `${API}/tint-cutting/active-rolls/open-new`,
        {
          material_id: openRollData.material_id,
          roll_width_inches: openRollData.roll_width_inches,
        },
        { withCredentials: true }
      );
      toast.success(res.data.message || "Nuevo rollo abierto en taller");
      setOpenRollData(null);
      fetchData();
    } catch (err) {
      console.error("Error opening new roll:", err);
      toast.error(err.response?.data?.detail || "Error abriendo nuevo rollo");
    } finally {
      setOpeningRoll(false);
    }
  };

  // Imprimir voucher térmico con croquis
  const handlePrintVoucher = (cutOrderId) => {
    const printUrl = `${API}/tint-cutting/orders/${cutOrderId}/voucher/html?autoprint=true`;
    window.open(printUrl, "_blank", "width=420,height=700,menubar=no,toolbar=no");
  };

  const filteredOrders = orders.filter((o) => {
    if (activeTab === "pending") return o.status === "pending_cut";
    if (activeTab === "history") return o.status !== "pending_cut";
    return true;
  }).filter((o) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (o.cut_order_id || "").toLowerCase().includes(term) ||
      (o.invoice_number || "").toLowerCase().includes(term) ||
      (o.customer_name || "").toLowerCase().includes(term) ||
      (o.vehicle_info?.plate || "").toLowerCase().includes(term) ||
      (o.vehicle_info?.brand || "").toLowerCase().includes(term) ||
      (o.vehicle_info?.model || "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header y Filtros */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-4 rounded-xl border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/20">
            <Scissors className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Mesa de Corte de Polarizados</h2>
            <p className="text-sm text-muted-foreground">
              Despacho de metrajes exactos en múltiplos de 0.50m con croquis vehicular
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant={activeTab === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("pending")}
            className="flex items-center gap-1.5"
          >
            <Clock className="h-4 w-4" />
            Pendientes ({orders.filter((o) => o.status === "pending_cut").length})
          </Button>

          <Button
            variant={activeTab === "rolls" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("rolls")}
            className="flex items-center gap-1.5"
          >
            <Layers className="h-4 w-4" />
            Rollos en Uso
          </Button>

          <Button
            variant={activeTab === "history" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("history")}
            className="flex items-center gap-1.5"
          >
            <CheckCircle2 className="h-4 w-4" />
            Despachadas
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Actualizar"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* VISTA 1 & 2: LISTA DE ÓRDENES (PENDIENTES O HISTORIAL) */}
      {activeTab !== "rolls" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por #Orden, Factura, Cliente, Placa o Vehículo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
              Cargando órdenes de corte...
            </div>
          ) : filteredOrders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Scissors className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No hay órdenes de corte en esta sección</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Las órdenes se generan automáticamente cuando el cliente paga en caja.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredOrders.map((order) => {
                const veh = order.vehicle_info || {};
                const isPending = order.status === "pending_cut";

                return (
                  <Card
                    key={order.cut_order_id}
                    className={`border transition-all ${
                      isPending ? "border-amber-500/40 shadow-sm hover:border-amber-500" : "opacity-90"
                    }`}
                  >
                    <CardHeader className="pb-3 bg-muted/30 border-b">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-base text-primary">
                              #{order.cut_order_id}
                            </span>
                            <Badge variant={isPending ? "outline" : "secondary"} className={isPending ? "bg-amber-500/10 text-amber-600 border-amber-500/30" : ""}>
                              {isPending ? "✂️ Pendiente de Corte" : "✓ Material Despachado"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Factura: <span className="font-semibold text-foreground">#{order.invoice_number || "S/F"}</span> • {order.customer_name || "Cliente Mostrador"}
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="text-lg font-extrabold text-foreground">
                            {order.total_meters?.toFixed(2)} m
                          </span>
                          <p className="text-[11px] text-muted-foreground">Total Despacho</p>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-4 space-y-4">
                      {/* Información del Vehículo */}
                      <div className="flex items-center justify-between text-xs bg-muted/40 p-2.5 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Car className="h-4 w-4 text-primary" />
                          <span className="font-semibold">
                            {veh.brand} {veh.model} {veh.year}
                          </span>
                        </div>
                        <Badge variant="outline" className="font-mono text-xs">
                          {veh.plate || "SIN PLACA"}
                        </Badge>
                      </div>

                      {/* Desglose de Pliegos a Cortar */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground uppercase">
                          <span>Pliegos / Cristales a Cortar</span>
                          <span>Ancho y Longitud</span>
                        </div>
                        <div className="divide-y border rounded-lg overflow-hidden bg-background text-xs">
                          {(order.cuts || []).map((cut, idx) => (
                            <div key={idx} className="p-2.5 flex justify-between items-center">
                              <div>
                                <p className="font-semibold text-foreground">{cut.zone_label}</p>
                                <p className="text-muted-foreground text-[11px]">{cut.material_name}</p>
                              </div>
                              <div className="text-right">
                                <Badge variant="secondary" className="font-mono font-bold">
                                  {cut.meters?.toFixed(2)}m × {cut.roll_width_label}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Historial de Ajustes (+0.5m) */}
                      {(order.adjustments || []).length > 0 && (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 text-xs text-amber-700 dark:text-amber-300">
                          <p className="font-semibold mb-1">Adiciones por Merma / Repetición:</p>
                          {order.adjustments.map((adj, i) => (
                            <div key={i} className="flex justify-between items-center text-[11px]">
                              <span>+ {adj.meters?.toFixed(2)}m ({adj.reason})</span>
                              <span className="text-muted-foreground">{adj.user_name}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Asignación y Acciones */}
                      <div className="pt-2 flex flex-col sm:flex-row gap-2 items-center justify-between border-t">
                        {isPending ? (
                          <div className="w-full sm:w-1/2">
                            <Label className="text-[11px] text-muted-foreground">Asignar Polarizador:</Label>
                            <select
                              className="w-full h-8 text-xs rounded-md border bg-background px-2"
                              value={assignedTechs[order.cut_order_id] || order.assigned_technician_id || ""}
                              onChange={(e) =>
                                setAssignedTechs({
                                  ...assignedTechs,
                                  [order.cut_order_id]: e.target.value,
                                })
                              }
                            >
                              <option value="">Seleccionar Polarizador...</option>
                              {technicians.map((t) => (
                                <option key={t.user_id || t.id} value={t.user_id || t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            <span>Polarizador: </span>
                            <span className="font-semibold text-foreground">
                              {order.assigned_technician_name || "Asignado en taller"}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePrintVoucher(order.cut_order_id)}
                            title="Imprimir Voucher Térmico 80mm con Croquis"
                            className="flex items-center gap-1"
                          >
                            <Printer className="h-3.5 w-3.5" />
                            <span className="text-xs">Ticket</span>
                          </Button>

                          {isPending && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenAddMeters(order)}
                                className="text-amber-600 border-amber-500/30 hover:bg-amber-500/10 flex items-center gap-1"
                                title="Agregar +0.5m por ajuste o repetición"
                              >
                                <PlusCircle className="h-3.5 w-3.5" />
                                <span className="text-xs">+0.5m</span>
                              </Button>

                              <Button
                                size="sm"
                                onClick={() => handleDispatch(order)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1"
                              >
                                <Scissors className="h-3.5 w-3.5" />
                                <span className="text-xs font-semibold">Cortado ✓</span>
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VISTA 3: INVENTARIO DUAL DE ROLLOS EN USO */}
      {activeTab === "rolls" && (
        <div className="space-y-4">
          <div className="bg-muted/40 p-4 rounded-xl border flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm">Rollos Activos en Taller (Metros Restantes)</h3>
              <p className="text-xs text-muted-foreground">
                Cada material tiene 1 rollo activo en uso. Cuando se agota, abre un nuevo rollo desde bodega sellada.
              </p>
            </div>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
              Inventario Separado de Bodega
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {activeRolls.map((roll) => {
              const remaining = roll.remaining_meters || 0;
              const total = roll.initial_length_meters || 30.0;
              const pct = Math.max(0, Math.min(100, Math.round((remaining / total) * 100)));
              const isLow = roll.low_stock_warning || remaining <= 2.0;

              return (
                <Card key={roll.roll_id} className={`border ${isLow ? "border-red-500/50 bg-red-500/5" : ""}`}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-sm leading-snug">{roll.material_name}</h4>
                        <Badge variant="secondary" className="font-mono text-[11px] mt-1">
                          {roll.roll_width_label}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <span className={`text-xl font-black font-mono ${isLow ? "text-red-500" : "text-foreground"}`}>
                          {remaining.toFixed(2)}m
                        </span>
                        <p className="text-[10px] text-muted-foreground">de {total.toFixed(0)}m</p>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {/* Barra de Progreso */}
                    <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          isLow ? "bg-red-500" : pct < 30 ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Despachado: {roll.total_dispatched_meters?.toFixed(2)}m</span>
                      {isLow && (
                        <span className="text-red-500 font-semibold flex items-center gap-1 text-[11px]">
                          <AlertTriangle className="h-3.5 w-3.5" /> Rollo Casi Agotado
                        </span>
                      )}
                    </div>

                    <Button
                      variant={isLow ? "default" : "outline"}
                      size="sm"
                      onClick={() => setOpenRollData(roll)}
                      className={`w-full text-xs font-semibold ${
                        isLow ? "bg-red-600 hover:bg-red-700 text-white" : ""
                      }`}
                    >
                      <PackageOpen className="h-3.5 w-3.5 mr-1.5" />
                      Abrir Nuevo Rollo de Bodega
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* DIALOG: AGREGAR METROS (+0.5M) */}
      <Dialog open={!!adjustOrder} onOpenChange={(open) => !open && setAdjustOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <PlusCircle className="h-5 w-5 text-amber-500" />
              Agregar Metraje Adicional por Merma / Repetición
            </DialogTitle>
          </DialogHeader>

          {adjustOrder && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1">
                <p>
                  <span className="text-muted-foreground">Orden:</span> <strong className="font-mono font-bold">#{adjustOrder.cut_order_id}</strong>
                </p>
                <p>
                  <span className="text-muted-foreground">Vehículo:</span> {adjustOrder.vehicle_info?.brand} {adjustOrder.vehicle_info?.model}
                </p>
              </div>

              <div>
                <Label className="text-xs">Seleccionar Material a Adicionar:</Label>
                <select
                  className="w-full h-9 text-xs rounded-md border bg-background px-2.5 mt-1"
                  value={adjustMaterial}
                  onChange={(e) => setAdjustMaterial(e.target.value)}
                >
                  {(adjustOrder.roll_summary || []).map((r) => (
                    <option key={r.key || r.material_id} value={r.material_id}>
                      {r.material_name} ({r.roll_width_label})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Ancho del Rollo:</Label>
                  <select
                    className="w-full h-9 text-xs rounded-md border bg-background px-2.5 mt-1"
                    value={adjustWidth}
                    onChange={(e) => setAdjustWidth(parseInt(e.target.value, 10))}
                  >
                    <option value={20}>Rollo 20"</option>
                    <option value={36}>Rollo 36"</option>
                    <option value={40}>Rollo 40"</option>
                  </select>
                </div>

                <div>
                  <Label className="text-xs">Metros a Agregar:</Label>
                  <select
                    className="w-full h-9 text-xs rounded-md border bg-background px-2.5 mt-1 font-mono font-bold"
                    value={adjustMeters}
                    onChange={(e) => setAdjustMeters(parseFloat(e.target.value))}
                  >
                    <option value={0.50}>+ 0.50 Metros</option>
                    <option value={1.00}>+ 1.00 Metros</option>
                    <option value={1.50}>+ 1.50 Metros</option>
                    <option value={2.00}>+ 2.00 Metros</option>
                  </select>
                </div>
              </div>

              <div>
                <Label className="text-xs">Motivo de la Adición (Requerido):</Label>
                <Input
                  placeholder="Ej: Repetición por burbuja en vidrio copiloto..."
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAdjustOrder(null)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSaveAddMeters}
              disabled={savingAdjust || !adjustReason.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
            >
              {savingAdjust ? "Guardando..." : "Confirmar +0.5m"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: ABRIR NUEVO ROLLO DESDE BODEGA */}
      <Dialog open={!!openRollData} onOpenChange={(open) => !open && setOpenRollData(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <PackageOpen className="h-5 w-5 text-emerald-500" />
              Abrir Nuevo Rollo desde Bodega
            </DialogTitle>
          </DialogHeader>

          {openRollData && (
            <div className="space-y-3 py-2 text-xs">
              <p className="text-muted-foreground">
                Se restará <strong>1 Rollo Sellado</strong> del inventario de Bodega y se cargarán <strong>30.00 metros</strong> al inventario activo de Taller para:
              </p>

              <div className="p-3 bg-muted rounded-lg font-semibold space-y-1">
                <p className="text-sm font-bold text-foreground">{openRollData.material_name}</p>
                <p className="text-muted-foreground">{openRollData.roll_width_label}</p>
              </div>

              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-700 dark:text-emerald-300">
                ✓ El rollo anterior pasará a estado cerrado y el nuevo quedará listo para despachos.
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpenRollData(null)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmOpenNewRoll}
              disabled={openingRoll}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {openingRoll ? "Abriendo Rollo..." : "Confirmar Apertura"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TintCuttingStation;
