import React, { useCallback, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { API_BASE as API } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useKdsPolling } from "@/hooks/useKdsPolling";
import { getKDSStatusClass } from "@/lib/utils";
import { getTimeElapsed, PRIORITY_BADGE, sortByPriorityThenAge } from "@/lib/kdsHelpers";
import { KDSStatsBar } from "@/components/kds/KDSStatsBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Car, CheckCircle, Clock, Eraser, Palette, Scissors, Trash2, User } from "lucide-react";
import { canPurgeOperationalQueue } from "@/lib/queuePurgeAccess";

const WINDOW_LABELS = {
  frontal: "Frontal",
  trasero: "Trasero",
  lateral_conductor: "Lat. conductor",
  lateral_copiloto: "Lat. copiloto",
  lateral_trasero_izq: "Lat. tras. izq.",
  lateral_trasero_der: "Lat. tras. der.",
  franja_superior: "Franja superior",
  franja_inferior: "Franja inferior",
  quemacocos: "Quemacocos",
};

function normalizeTintStatus(status) {
  if (status === "pending_assignment") return "pending";
  return status;
}

export function KDSTintPage() {
  const { user } = useAuth();
  const userRole = String(user?.role || "").toLowerCase();
  const canPurge = canPurgeOperationalQueue(userRole);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [clearing, setClearing] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/kds/tint-orders`, { withCredentials: true });
      setOrders(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("KDS polarizados:", error);
      toast.error("No se pudieron cargar órdenes de polarizado");
    } finally {
      setLoading(false);
    }
  }, []);

  useKdsPolling(fetchOrders);

  const startOrder = async (orderId) => {
    setBusyId(orderId);
    try {
      await axios.put(`${API}/tint-orders/${orderId}/start`, {}, { withCredentials: true });
      toast.success("Orden iniciada");
      await fetchOrders();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Error al iniciar orden");
    } finally {
      setBusyId("");
    }
  };

  const isPendingUnassigned = (order) =>
    order.assignment_status === "pending_assignment"
    && ["pending", "pending_assignment"].includes(order.status)
    && !order.assigned_technician_id;

  const handleDelete = async (order) => {
    if (!canPurge) return;
    if (!isPendingUnassigned(order)) {
      toast.error("Solo se pueden eliminar polarizados pendientes sin asignar");
      return;
    }
    if (!window.confirm("¿Eliminar este polarizado de la cola?")) return;

    setDeletingId(order.tint_order_id);
    try {
      await axios.delete(`${API}/tint-orders/${order.tint_order_id}`, { withCredentials: true });
      toast.success("Polarizado eliminado");
      await fetchOrders();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudo eliminar");
    } finally {
      setDeletingId("");
    }
  };

  const handleClearQueue = async () => {
    if (!canPurge) return;
    const pendingCount = orders.filter(isPendingUnassigned).length;
    if (!pendingCount) {
      toast.message("No hay polarizados pendientes para limpiar");
      return;
    }
    if (!window.confirm(`¿Limpiar los ${pendingCount} polarizados pendientes?`)) return;

    setClearing(true);
    try {
      const res = await axios.post(
        `${API}/coordinator/clear-queue`,
        {
          department: "polarizados",
          profile: "polarizados",
          branch_id: user?.branch_id || undefined,
        },
        { withCredentials: true }
      );
      toast.success(`Cola limpiada (${res?.data?.removed ?? 0} polarizados)`);
      await fetchOrders();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudo limpiar la cola");
    } finally {
      setClearing(false);
    }
  };

  const completeWindow = async (orderId, windowType) => {
    const technicianId = user?.user_id;
    if (!technicianId) {
      toast.error("Usuario no identificado");
      return;
    }
    setBusyId(`${orderId}:${windowType}`);
    try {
      await axios.put(
        `${API}/tint-orders/${orderId}/window`,
        { window_type: windowType, status: "completed", technician_id: technicianId },
        { withCredentials: true }
      );
      toast.success("Ventana completada");
      await fetchOrders();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Error al completar ventana");
    } finally {
      setBusyId("");
    }
  };

  const sortedOrders = useMemo(() => sortByPriorityThenAge(orders), [orders]);

  const stats = useMemo(
    () => ({
      pending: orders.filter((o) => ["pending", "pending_assignment"].includes(o.status)).length,
      inProgress: orders.filter((o) => o.status === "in_progress").length,
      qc: orders.filter((o) => o.status === "quality_check").length,
    }),
    [orders]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[75vh]">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="kds-tint-page">
      {canPurge ? (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-rose-700 border-rose-300 hover:bg-rose-50 dark:text-rose-300"
            disabled={clearing || stats.pending === 0}
            onClick={handleClearQueue}
            data-testid="kds-tint-clear-queue"
          >
            <Eraser className="h-4 w-4" />
            {clearing ? "Limpiando…" : "Limpiar cola"}
          </Button>
        </div>
      ) : null}

      <KDSStatsBar
        items={[
          {
            key: "pending",
            label: "Pendientes",
            value: stats.pending,
            tone: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300",
            dot: "bg-yellow-500",
          },
          {
            key: "progress",
            label: "En proceso",
            value: stats.inProgress,
            tone: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
            dot: "bg-blue-500",
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

      {sortedOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground">
          <CheckCircle className="h-16 w-16 mb-4" />
          <p className="text-2xl font-heading">Sin órdenes de polarizado</p>
          <p className="text-sm mt-2">Solo aplica en Mundo de Accesorios</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
          {sortedOrders.map((order) => {
            const windows = order.windows || [];
            const completedWindows = windows.filter((w) => w.status === "completed").length;
            const totalWindows = windows.length;
            const visualStatus = normalizeTintStatus(order.status);

            return (
              <div
                key={order.tint_order_id}
                className={`rounded-md border-2 bg-card shadow-md overflow-hidden ${getKDSStatusClass(
                  visualStatus,
                  order.created_at
                )}`}
                data-testid={`kds-tint-${order.tint_order_id}`}
              >
                <div className="p-3 border-b">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-heading text-lg font-bold inline-flex items-center gap-2">
                      <Palette className="h-5 w-5 text-fuchsia-500" />
                      #{order.tint_order_id?.slice(-6)?.toUpperCase()}
                    </span>
                    <Badge variant="outline" className={PRIORITY_BADGE[order.priority] || PRIORITY_BADGE.normal}>
                      {(order.priority || "normal").toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {getTimeElapsed(order.created_at)}
                    </span>
                    <span className="inline-flex items-center gap-1 truncate">
                      <User className="h-4 w-4 shrink-0" />
                      {order.customer_name || "Cliente"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm mt-1 truncate">
                    <Car className="h-4 w-4 text-muted-foreground shrink-0" />
                    {order.vehicle_info || order.vehicle_description || "Vehículo"}
                  </div>
                  {order.assigned_technician_name && (
                    <p className="text-xs mt-2">Polarizador: {order.assigned_technician_name}</p>
                  )}
                  {order.cutting_status && (
                    <div className="mt-2">
                      <Badge
                        variant="secondary"
                        className={`text-[11px] font-medium flex items-center gap-1 w-fit ${
                          order.cutting_status === "cut_ready"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                            : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                        }`}
                      >
                        <Scissors className="h-3 w-3" />
                        {order.cutting_status === "cut_ready" ? "Material Cortado ✓" : "En Mesa de Corte"}
                      </Badge>
                    </div>
                  )}
                </div>

                <div className="p-3 space-y-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Ventanas {completedWindows}/{totalWindows}
                  </p>
                  <ul className="space-y-1 max-h-44 overflow-y-auto">
                    {windows.map((window) => (
                      <li
                        key={`${order.tint_order_id}-${window.window_type}`}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className={window.status === "completed" ? "line-through text-muted-foreground" : ""}>
                          {WINDOW_LABELS[window.window_type] || window.window_type}
                        </span>
                        {order.status === "in_progress" && window.status !== "completed" && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 text-xs shrink-0"
                            disabled={busyId === `${order.tint_order_id}:${window.window_type}`}
                            onClick={() => completeWindow(order.tint_order_id, window.window_type)}
                          >
                            OK
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-2 bg-muted/40 border-t flex gap-2">
                  {canPurge && isPendingUnassigned(order) ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-rose-700 border-rose-300 hover:bg-rose-50 dark:text-rose-300"
                      disabled={
                        deletingId === order.tint_order_id || busyId === order.tint_order_id
                      }
                      onClick={() => handleDelete(order)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                  {["pending", "pending_assignment"].includes(order.status) && (
                    <Button
                      className="flex-1"
                      disabled={
                        busyId === order.tint_order_id || deletingId === order.tint_order_id
                      }
                      onClick={() => startOrder(order.tint_order_id)}
                    >
                      INICIAR POLARIZADO
                    </Button>
                  )}
                  {order.status === "in_progress" && (
                    <p className="text-center text-sm font-medium text-blue-700 dark:text-blue-300 py-2">
                      En proceso… {completedWindows}/{totalWindows} ventanas
                    </p>
                  )}
                  {order.status === "quality_check" && (
                    <p className="text-center text-sm font-medium text-purple-700 dark:text-purple-300 py-2">
                      PENDIENTE CONTROL DE CALIDAD
                    </p>
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