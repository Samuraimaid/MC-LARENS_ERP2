import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { API_BASE as API } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useKdsPolling } from "@/hooks/useKdsPolling";
import { getKDSStatusClass } from "@/lib/utils";
import { getTimeElapsed, PRIORITY_BADGE, sortByPriorityThenAge } from "@/lib/kdsHelpers";
import { expandOrdersToItemCards } from "@/lib/workOrderItemCards";
import { KDSStatsBar } from "@/components/kds/KDSStatsBar";
import { VehicleThumbnailWatermark } from "@/components/erp/VehicleThumbnailWatermark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Car, CheckCircle, Clock, Eraser, Trash2, User, Wrench, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { canPurgeOperationalQueue } from "@/lib/queuePurgeAccess";

const DEPARTMENTS = [
  { id: "instalaciones", label: "Instalaciones", icon: Wrench },
  { id: "electrico", label: "Eléctrico", icon: Zap },
];

function getItemLabel(item) {
  if (!item) return "Trabajo";
  const qty = Math.max(1, Number(item.quantity || 1));
  const name = item.description || item.product_name || "Producto";
  return qty > 1 ? `${name} ×${qty}` : name;
}

export function KDSInstallationsPage() {
  const { user } = useAuth();
  const userRole = String(user?.role || "").toLowerCase();
  const canClear = canPurgeOperationalQueue(userRole);

  const [department, setDepartment] = useState("instalaciones");
  const [orders, setOrders] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [clearing, setClearing] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const [ordersRes, vehiclesRes] = await Promise.all([
        axios.get(`${API}/kds/orders`, {
          withCredentials: true,
          params: { department },
        }),
        axios.get(`${API}/vehicles`, { withCredentials: true }),
      ]);
      setOrders(Array.isArray(ordersRes.data) ? ordersRes.data : []);
      setVehicles(Array.isArray(vehiclesRes.data) ? vehiclesRes.data : []);
    } catch (error) {
      console.error("KDS instalaciones:", error);
    } finally {
      setLoading(false);
    }
  }, [department]);

  useKdsPolling(fetchOrders);

  useEffect(() => {
    setLoading(true);
  }, [department]);

  const updateStatus = async (orderId, newStatus) => {
    setBusyId(orderId);
    try {
      await axios.put(`${API}/work-orders/${orderId}`, { status: newStatus }, { withCredentials: true });
      await fetchOrders();
    } catch (error) {
      console.error("KDS status:", error);
    } finally {
      setBusyId("");
    }
  };

  const handleDelete = async (order) => {
    const orderId = order.work_order_id;
    if (!canClear) return;
    if (order.status !== "pending" || order.assignment_status !== "pending_assignment") {
      toast.error("Solo se pueden eliminar trabajos pendientes sin asignar");
      return;
    }
    if (!window.confirm("¿Eliminar este trabajo de la cola?")) return;

    setDeletingId(orderId);
    try {
      await axios.delete(`${API}/work-orders/${orderId}`, { withCredentials: true });
      toast.success("Trabajo eliminado");
      await fetchOrders();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudo eliminar");
    } finally {
      setDeletingId("");
    }
  };

  const handleClearQueue = async () => {
    if (!canClear) return;
    const pendingCount = orders.filter(
      (o) => o.status === "pending" && o.assignment_status === "pending_assignment"
    ).length;
    if (!pendingCount) {
      toast.message("No hay trabajos pendientes para limpiar");
      return;
    }
    const deptLabel = DEPARTMENTS.find((d) => d.id === department)?.label || department;
    if (
      !window.confirm(
        `¿Limpiar los ${pendingCount} trabajos pendientes de ${deptLabel}?`
      )
    ) {
      return;
    }

    setClearing(true);
    try {
      const res = await axios.post(
        `${API}/coordinator/clear-queue`,
        { department, profile: "instalaciones", branch_id: user?.branch_id || undefined },
        { withCredentials: true }
      );
      toast.success(`Cola limpiada (${res?.data?.removed ?? 0} trabajos)`);
      await fetchOrders();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudo limpiar la cola");
    } finally {
      setClearing(false);
    }
  };

  const itemCards = useMemo(
    () => sortByPriorityThenAge(expandOrdersToItemCards(orders, department)),
    [orders, department]
  );

  const getOrderVehicle = (order) => {
    if (!order?.vehicle_id) return null;
    return (
      vehicles.find(
        (vehicle) => vehicle.vehicle_id === order.vehicle_id || vehicle.id === order.vehicle_id
      ) || null
    );
  };

  const stats = useMemo(() => {
    return {
      pending: orders.filter((o) => o.status === "pending").length,
      inProgress: orders.filter((o) => o.status === "in_progress").length,
      qc: orders.filter((o) => o.status === "quality_check").length,
    };
  }, [orders]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[75vh]">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="kds-installations-page">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {DEPARTMENTS.map((dept) => {
            const Icon = dept.icon;
            const active = department === dept.id;
            return (
              <Button
                key={dept.id}
                variant={active ? "default" : "outline"}
                onClick={() => {
                  setLoading(true);
                  setDepartment(dept.id);
                }}
                data-testid={`kds-dept-${dept.id}`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {dept.label}
              </Button>
            );
          })}
        </div>
        {canClear ? (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-rose-700 border-rose-300 hover:bg-rose-50 dark:text-rose-300"
            disabled={clearing || stats.pending === 0}
            onClick={handleClearQueue}
            data-testid="kds-clear-queue"
          >
            <Eraser className="h-4 w-4" />
            {clearing ? "Limpiando…" : "Limpiar cola"}
          </Button>
        ) : null}
      </div>

      <KDSStatsBar
        items={[
          {
            key: "new",
            label: "Nuevas",
            value: stats.pending,
            tone: "bg-green-500/20 text-green-700 dark:text-green-300",
            dot: "bg-green-500",
          },
          {
            key: "prep",
            label: "En proceso",
            value: stats.inProgress,
            tone: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300",
            dot: "bg-yellow-500",
          },
          {
            key: "qc",
            label: "Control calidad",
            value: stats.qc,
            tone: "bg-purple-500/20 text-purple-700 dark:text-purple-300",
            dot: "bg-purple-500",
          },
        ]}
      />

      {itemCards.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground">
          <CheckCircle className="h-16 w-16 mb-4" />
          <p className="text-2xl font-heading">No hay órdenes en {department}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          {itemCards.map((order) => {
            const cardKey = order.cardKey || order.work_order_id;
            const displayItem = order.displayItem || (order.items || [])[0];
            const isPendingUnassigned =
              order.status === "pending" && order.assignment_status === "pending_assignment";

            return (
              <div
                key={cardKey}
                className={cn(
                  "relative rounded-md border-2 bg-card shadow-md overflow-hidden transition-all hover:shadow-lg",
                  getKDSStatusClass(order.status, order.created_at)
                )}
                data-testid={`kds-order-${order.work_order_id}`}
              >
                <VehicleThumbnailWatermark vehicle={getOrderVehicle(order)} />
                <div className="bg-card p-3 border-b">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-heading text-lg font-bold">
                      #{order.work_order_id.slice(-6).toUpperCase()}
                    </span>
                    <Badge variant="outline" className={PRIORITY_BADGE[order.priority] || PRIORITY_BADGE.normal}>
                      {(order.priority || "normal").toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span className="font-mono">{getTimeElapsed(order.created_at)}</span>
                  </div>
                </div>

                <div className="relative p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium truncate">{order.customer_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm truncate">{order.vehicle_info}</span>
                  </div>
                  <p className="text-sm font-medium leading-snug">
                    {getItemLabel(displayItem)}
                  </p>
                  {order.splitLabel ? (
                    <p className="text-xs text-muted-foreground">Producto {order.splitLabel}</p>
                  ) : null}
                  {order.technician_name && (
                    <p className="text-xs border-t pt-2">
                      Técnico: <span className="font-medium">{order.technician_name}</span>
                    </p>
                  )}
                </div>

                <div className="p-2 bg-muted/50 flex gap-2">
                  {canClear && isPendingUnassigned ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-rose-700 border-rose-300 hover:bg-rose-50 dark:text-rose-300"
                      disabled={deletingId === order.work_order_id || busyId === order.work_order_id}
                      onClick={() => handleDelete(order)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                  {order.status === "pending" && (
                    <Button
                      className="flex-1"
                      disabled={busyId === order.work_order_id || deletingId === order.work_order_id}
                      onClick={() => updateStatus(order.work_order_id, "in_progress")}
                    >
                      INICIAR
                    </Button>
                  )}
                  {order.status === "in_progress" && (
                    <Button
                      className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white"
                      disabled={busyId === order.work_order_id}
                      onClick={() => updateStatus(order.work_order_id, "quality_check")}
                    >
                      A CONTROL CALIDAD
                    </Button>
                  )}
                  {order.status === "quality_check" && (
                    <div className="flex-1 py-2 text-center text-sm font-medium text-purple-700 dark:text-purple-300">
                      PENDIENTE QC
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}