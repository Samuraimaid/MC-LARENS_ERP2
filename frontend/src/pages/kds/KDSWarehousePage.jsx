import React, { useCallback, useState } from "react";
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
import { CheckCircle, Clock, Eraser, Package, Play, Trash2, User } from "lucide-react";
import { canPurgeOperationalQueue } from "@/lib/queuePurgeAccess";

export function KDSWarehousePage() {
  const { user } = useAuth();
  const userRole = String(user?.role || "").toLowerCase();
  const canPurge = canPurgeOperationalQueue(userRole);

  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [clearing, setClearing] = useState(false);

  const fetchDispatches = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/kds/warehouse`, { withCredentials: true });
      setDispatches(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("KDS bodega:", error);
      toast.error("No se pudieron cargar los despachos");
    } finally {
      setLoading(false);
    }
  }, []);

  useKdsPolling(fetchDispatches);

  const startDispatch = async (dispatchId) => {
    setBusyId(dispatchId);
    try {
      await axios.put(`${API}/dispatch/${dispatchId}/start`, {}, { withCredentials: true });
      toast.success("Despacho iniciado");
      await fetchDispatches();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Error al iniciar despacho");
    } finally {
      setBusyId("");
    }
  };

  const isPendingPurgeable = (dispatch) =>
    dispatch.status === "pending" && !dispatch.started_at;

  const handleDelete = async (dispatch) => {
    if (!canPurge) return;
    if (!isPendingPurgeable(dispatch)) {
      toast.error("Solo se pueden eliminar despachos pendientes sin iniciar");
      return;
    }
    if (!window.confirm("¿Eliminar este despacho de la cola?")) return;

    setDeletingId(dispatch.dispatch_id);
    try {
      await axios.delete(`${API}/dispatch/${dispatch.dispatch_id}`, { withCredentials: true });
      toast.success("Despacho eliminado");
      await fetchDispatches();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudo eliminar");
    } finally {
      setDeletingId("");
    }
  };

  const handleClearQueue = async () => {
    if (!canPurge) return;
    const pendingCount = dispatches.filter(isPendingPurgeable).length;
    if (!pendingCount) {
      toast.message("No hay despachos pendientes para limpiar");
      return;
    }
    if (!window.confirm(`¿Limpiar los ${pendingCount} despachos pendientes?`)) return;

    setClearing(true);
    try {
      const res = await axios.post(
        `${API}/dispatch/clear-queue`,
        { branch_id: user?.branch_id || undefined, warehouse_id: user?.warehouse_id || undefined },
        { withCredentials: true }
      );
      toast.success(`Cola limpiada (${res?.data?.removed ?? 0} despachos)`);
      await fetchDispatches();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudo limpiar la cola");
    } finally {
      setClearing(false);
    }
  };

  const deliverItem = async (dispatchId, productId) => {
    const dispatcherId = user?.user_id;
    if (!dispatcherId) {
      toast.error("Usuario no identificado");
      return;
    }
    setBusyId(`${dispatchId}:${productId}`);
    try {
      const response = await axios.put(
        `${API}/dispatch/${dispatchId}/deliver-item`,
        { product_id: productId, dispatcher_id: dispatcherId },
        { withCredentials: true }
      );
      if (response.data?.all_completed) {
        toast.success("Despacho completado");
      } else {
        toast.success("Producto despachado");
      }
      await fetchDispatches();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Error al despachar producto");
    } finally {
      setBusyId("");
    }
  };

  const sorted = sortByPriorityThenAge(dispatches);
  const pending = dispatches.filter((d) => d.status === "pending").length;
  const inProgress = dispatches.filter((d) => d.status === "in_progress").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[75vh]">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="kds-warehouse-page">
      {canPurge ? (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-rose-700 border-rose-300 hover:bg-rose-50 dark:text-rose-300"
            disabled={clearing || pending === 0}
            onClick={handleClearQueue}
            data-testid="kds-dispatch-clear-queue"
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
            value: pending,
            tone: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300",
            dot: "bg-yellow-500",
          },
          {
            key: "progress",
            label: "En proceso",
            value: inProgress,
            tone: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
            dot: "bg-blue-500",
          },
          {
            key: "total",
            label: "Activos",
            value: dispatches.length,
            tone: "bg-muted/70 text-foreground",
            dot: "bg-primary",
          },
        ]}
      />

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground">
          <CheckCircle className="h-16 w-16 mb-4" />
          <p className="text-2xl font-heading">Sin despachos pendientes</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
          {sorted.map((dispatch) => {
            const items = dispatch.items || [];
            const delivered = items.filter((item) => item.delivered).length;
            const total = items.length;
            const progress = total > 0 ? Math.round((delivered / total) * 100) : 0;

            return (
              <div
                key={dispatch.dispatch_id}
                className={`rounded-md border-2 bg-card shadow-md overflow-hidden ${getKDSStatusClass(
                  dispatch.status,
                  dispatch.created_at
                )}`}
                data-testid={`kds-dispatch-${dispatch.dispatch_id}`}
              >
                <div className="p-3 border-b bg-card/90">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-heading text-lg font-bold truncate">
                      {dispatch.invoice_number || dispatch.reference_number || `#${dispatch.dispatch_id?.slice(-6)}`}
                    </span>
                    <Badge variant="outline" className={PRIORITY_BADGE[dispatch.priority] || PRIORITY_BADGE.normal}>
                      {(dispatch.priority || "normal").toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {getTimeElapsed(dispatch.created_at)}
                    </span>
                    <span className="inline-flex items-center gap-1 truncate">
                      <User className="h-4 w-4 shrink-0" />
                      {dispatch.customer_name || "Cliente"}
                    </span>
                  </div>
                  {dispatch.warehouse_name && (
                    <p className="text-xs text-muted-foreground mt-1">{dispatch.warehouse_name}</p>
                  )}
                </div>

                <div className="p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Package className="h-3.5 w-3.5" />
                      Productos
                    </span>
                    <span>
                      {delivered}/{total}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <ul className="space-y-1 max-h-40 overflow-y-auto">
                    {items.slice(0, 6).map((item) => (
                      <li
                        key={`${dispatch.dispatch_id}-${item.product_id}`}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className={item.delivered ? "line-through text-muted-foreground" : ""}>
                          {item.product_name || item.sku || item.product_id}
                          {item.quantity > 1 ? ` ×${item.quantity}` : ""}
                        </span>
                        {dispatch.status === "in_progress" && !item.delivered && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 text-xs shrink-0"
                            disabled={busyId === `${dispatch.dispatch_id}:${item.product_id}`}
                            onClick={() => deliverItem(dispatch.dispatch_id, item.product_id)}
                          >
                            OK
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-2 bg-muted/40 border-t flex gap-2">
                  {canPurge && isPendingPurgeable(dispatch) ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-rose-700 border-rose-300 hover:bg-rose-50 dark:text-rose-300"
                      disabled={
                        deletingId === dispatch.dispatch_id || busyId === dispatch.dispatch_id
                      }
                      onClick={() => handleDelete(dispatch)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                  {dispatch.status === "pending" && (
                    <Button
                      className="flex-1"
                      disabled={
                        busyId === dispatch.dispatch_id || deletingId === dispatch.dispatch_id
                      }
                      onClick={() => startDispatch(dispatch.dispatch_id)}
                      data-testid={`kds-dispatch-start-${dispatch.dispatch_id}`}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      INICIAR DESPACHO
                    </Button>
                  )}
                  {dispatch.status === "in_progress" && (
                    <p className="text-center text-sm font-medium text-blue-700 dark:text-blue-300 py-2">
                      Despachando… {progress}%
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