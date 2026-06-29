import React, { useState, useEffect } from "react";
import axios from "axios";
// removed unused formatDate import
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
// Checkbox removed (not used)
import { ScrollArea } from "../components/ui/scroll-area";
// Separator removed (not used)
import { Progress } from "../components/ui/progress";
import { toast } from "sonner";
import { 
  Package, Search, Clock, CheckCircle2, Play, User, 
  Truck, Timer, TrendingUp, RefreshCw, FileText, Eraser, Trash2
} from "lucide-react";
import { API_BASE as API } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { canPurgeOperationalQueue } from "@/lib/queuePurgeAccess";

const STATUS_CONFIG = {
  pending: { label: "Pendiente", color: "bg-yellow-500", icon: Clock },
  in_progress: { label: "En Proceso", color: "bg-blue-500", icon: Play },
  completed: { label: "Completado", color: "bg-green-500", icon: CheckCircle2 },
  cancelled: { label: "Anulado", color: "bg-slate-500", icon: Clock },
};

const DEFAULT_STATUS_CONFIG = {
  label: "Desconocido",
  color: "bg-gray-500",
  icon: Clock,
};

const DEFAULT_PRIORITY_CONFIG = {
  label: "Normal",
  color: "bg-blue-400",
};

const PRIORITY_CONFIG = {
  low: { label: "Baja", color: "bg-gray-400" },
  normal: { label: "Normal", color: "bg-blue-400" },
  high: { label: "Alta", color: "bg-orange-500" },
  urgent: { label: "Urgente", color: "bg-red-500" }
};

const DISPATCH_TYPE_LABELS = {
  sale: "Venta",
  sample_out: "Muestra",
  sample_return: "Devolución",
};

const DISPATCH_TYPE_BADGES = {
  sale: "bg-green-600 text-white",
  sample_out: "bg-yellow-500 text-white",
  sample_return: "bg-red-600 text-white",
};

export function DispatchPage() {
  const { user } = useAuth();
  const userRole = String(user?.role || "").toLowerCase();
  const canPurge = canPurgeOperationalQueue(userRole);

  const [dispatches, setDispatches] = useState([]);
  const [dispatchers, setDispatchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");
  const [clearing, setClearing] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedDispatch, setSelectedDispatch] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [stats, setStats] = useState(null);
  const [elapsedTime, setElapsedTime] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    // Update elapsed time every second
    const interval = setInterval(() => {
      setElapsedTime(prev => {
        const updated = { ...prev };
        dispatches.filter(d => d.status === "in_progress").forEach(d => {
          if (d.started_at) {
            const start = new Date(d.started_at);
            const now = new Date();
            updated[d.dispatch_id] = Math.max(0, Math.floor((now - start) / 1000));
          }
        });
        return updated;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [dispatches]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dispatchRes, dispatchersRes, statsRes] = await Promise.all([
        axios.get(`${API}/dispatch`, { withCredentials: true }),
        axios.get(`${API}/dispatch/dispatchers/list`, { withCredentials: true }),
        axios.get(`${API}/dispatch/stats/performance`, { withCredentials: true }).catch(() => ({ data: null }))
      ]);
      setDispatches(dispatchRes.data);
      let dispatcherList = Array.isArray(dispatchersRes.data) ? dispatchersRes.data : [];
      if (dispatcherList.length === 0) {
        try {
          const pinUsersRes = await axios.get(`${API}/auth/pin/users`, { withCredentials: true });
          const pinUsers = Array.isArray(pinUsersRes.data) ? pinUsersRes.data : [];
          dispatcherList = pinUsers
            .filter(u => (u.role || "").toLowerCase().includes("bodega") || (u.name || "").toLowerCase().includes("despachador"))
            .map(u => ({ id: u.user_id || u.name, name: u.name, role: u.role }))
            .filter(u => u.id && u.name);
        } catch (pinErr) {
          dispatcherList = [];
        }
      }
      const defaultDispatchers = [
        { id: "Despachador 1", name: "Despachador 1", role: "bodegas" },
        { id: "Despachador 2", name: "Despachador 2", role: "bodegas" },
        { id: "Despachador 3", name: "Despachador 3", role: "bodegas" },
        { id: "Despachador 4", name: "Despachador 4", role: "bodegas" },
        { id: "Despachador 5", name: "Despachador 5", role: "bodegas" },
      ];
      const merged = [...dispatcherList, ...defaultDispatchers];
      const seen = new Set();
      dispatcherList = merged.filter((d) => {
        const key = `${(d.name || "").toLowerCase()}|${d.id || ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setDispatchers(dispatcherList);
      setStats(statsRes.data);
    } catch (error) {
      // If unauthorized, show a clearer message and avoid ambiguous error toast
      if (error.response?.status === 401) {
        toast.error("No autenticado. Inicia sesión para ver los despachos.");
        setDispatches([]);
        setDispatchers([]);
        setStats(null);
      } else {
        toast.error("Error al cargar despachos");
      }
    } finally {
      setLoading(false);
    }
  };

  const startDispatch = async (dispatchId) => {
    try {
      await axios.put(`${API}/dispatch/${dispatchId}/start`, {}, { withCredentials: true });
      toast.success("Despacho iniciado");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al iniciar despacho");
    }
  };

  const isPendingPurgeable = (dispatch) =>
    dispatch.status === "pending" && !dispatch.started_at;

  const handleDeleteDispatch = async (dispatchId) => {
    if (!canPurge) {
      toast.error("Solo gerencia, supervisores o programadores pueden eliminar despachos");
      return;
    }
    if (!window.confirm("¿Eliminar este despacho pendiente de la cola?")) return;

    setDeletingId(dispatchId);
    try {
      await axios.delete(`${API}/dispatch/${dispatchId}`, { withCredentials: true });
      toast.success("Despacho eliminado");
      if (selectedDispatch?.dispatch_id === dispatchId) {
        setShowDetails(false);
        setSelectedDispatch(null);
      }
      await fetchData();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudo eliminar el despacho");
    } finally {
      setDeletingId("");
    }
  };

  const handleClearQueue = async () => {
    if (!canPurge) {
      toast.error("Solo gerencia, supervisores o programadores pueden limpiar la cola");
      return;
    }
    const pendingCount = dispatches.filter(isPendingPurgeable).length;
    if (!pendingCount) {
      toast.message("No hay despachos pendientes para limpiar");
      return;
    }
    if (!window.confirm(`¿Limpiar los ${pendingCount} despachos pendientes? Esta acción no se puede deshacer.`)) {
      return;
    }

    setClearing(true);
    try {
      const res = await axios.post(
        `${API}/dispatch/clear-queue`,
        { branch_id: user?.branch_id || undefined, warehouse_id: user?.warehouse_id || undefined },
        { withCredentials: true }
      );
      toast.success(`Cola limpiada (${res?.data?.removed ?? 0} despachos)`);
      await fetchData();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudo limpiar la cola");
    } finally {
      setClearing(false);
    }
  };

  const deliverItem = async (dispatchId, productId, dispatcherId) => {
    if (!dispatcherId) {
      toast.error("Selecciona un despachador");
      return;
    }
    try {
      const response = await axios.put(`${API}/dispatch/${dispatchId}/deliver-item`, {
        product_id: productId,
        dispatcher_id: dispatcherId
      }, { withCredentials: true });
      
      toast.success("Producto entregado");
      
      if (response.data.all_completed) {
        toast.success("¡Despacho completado!");
        setShowDetails(false);
      }
      
      fetchData();
      
      // Refresh selected dispatch
      const updated = await axios.get(`${API}/dispatch/${dispatchId}`, { withCredentials: true });
      setSelectedDispatch(updated.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al entregar producto");
    }
  };

  const filteredDispatches = dispatches.filter(d => {
    const searchLower = search.toLowerCase();
    const matchesSearch = d.invoice_number?.toLowerCase().includes(searchLower) ||
                         d.reference_number?.toLowerCase().includes(searchLower) ||
                         d.customer_name?.toLowerCase().includes(searchLower) ||
                         d.dispatch_id?.toLowerCase().includes(searchLower);
    const matchesStatus = filterStatus === "all" || d.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = dispatches.filter(d => d.status === "pending").length;
  const inProgressCount = dispatches.filter(d => d.status === "in_progress").length;
  const completedToday = dispatches.filter((d) => {
    if (d.status !== "completed" || !d.completed_at) return false;
    const completedAt = new Date(d.completed_at);
    return !Number.isNaN(completedAt.getTime()) &&
      completedAt.toDateString() === new Date().toDateString();
  }).length;

  const formatTime = (seconds) => {
    const totalSeconds = Math.max(0, Math.floor(seconds || 0));
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-6" data-testid="dispatch-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Despacho de Bodega</h1>
          <p className="text-muted-foreground">Gestión de entregas y despachos</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canPurge ? (
            <Button
              onClick={handleClearQueue}
              variant="outline"
              size="sm"
              className="gap-2 text-rose-700 border-rose-300 hover:bg-rose-50 dark:text-rose-300"
              disabled={clearing || pendingCount === 0}
              data-testid="dispatch-clear-queue"
            >
              <Eraser className="h-4 w-4" />
              {clearing ? "Limpiando…" : "Limpiar cola"}
            </Button>
          ) : null}
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">PENDIENTES</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold">{pendingCount}</div>
            <p className="text-xs text-muted-foreground">Por despachar</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">EN PROCESO</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold">{inProgressCount}</div>
            <p className="text-xs text-muted-foreground">Despachando</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">COMPLETADOS HOY</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold">{completedToday}</div>
            <p className="text-xs text-muted-foreground">Entregados</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">TIEMPO PROMEDIO</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold">
              {formatTime(stats?.average_time_minutes || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Últimos 30 días</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por factura o cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendientes</SelectItem>
            <SelectItem value="in_progress">En Proceso</SelectItem>
            <SelectItem value="completed">Completados</SelectItem>
            <SelectItem value="cancelled">Anulados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Dispatch List */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Orden</TableHead>
                <TableHead>Factura</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Tiempo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filteredDispatches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    No hay despachos
                  </TableCell>
                </TableRow>
              ) : (
                filteredDispatches.map(dispatch => {
                  const statusConfig =
                    STATUS_CONFIG[dispatch.status] || DEFAULT_STATUS_CONFIG;
                  const priorityConfig =
                    PRIORITY_CONFIG[dispatch.priority] || DEFAULT_PRIORITY_CONFIG;
                  const deliveredCount = dispatch.items?.filter(i => i.delivered).length || 0;
                  const totalItems = dispatch.items?.length || 0;
                  const progress = totalItems > 0 ? (deliveredCount / totalItems) * 100 : 0;
                  const elapsed = elapsedTime[dispatch.dispatch_id] || 0;
                  
                  return (
                    <TableRow key={dispatch.dispatch_id} className="cursor-pointer hover:bg-accent/50">
                      <TableCell className="font-mono font-medium">
                        {dispatch.dispatch_id}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          {dispatch.invoice_number}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={DISPATCH_TYPE_BADGES[dispatch.dispatch_type] || "bg-green-600 text-white"}>
                          {DISPATCH_TYPE_LABELS[dispatch.dispatch_type] || "Venta"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {dispatch.requested_by_name || "—"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono">{deliveredCount}/{totalItems}</span>
                          <Progress value={progress} className="w-16 h-2" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${priorityConfig.color} text-white`}>
                          {priorityConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${statusConfig.color} text-white`}>
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {dispatch.status === "in_progress" && (
                          <span className="text-blue-600 font-mono flex items-center gap-1">
                            <Timer className="h-4 w-4" />
                            {formatTime(elapsed)}
                          </span>
                        )}
                        {dispatch.status === "completed" && (
                          <span className="text-green-600 font-mono">
                            {formatTime(dispatch.total_time_minutes)}
                          </span>
                        )}
                        {dispatch.status === "pending" && (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          {canPurge && isPendingPurgeable(dispatch) ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-rose-700 border-rose-300 hover:bg-rose-50 dark:text-rose-300"
                              disabled={deletingId === dispatch.dispatch_id}
                              onClick={() => handleDeleteDispatch(dispatch.dispatch_id)}
                              data-testid={`delete-dispatch-${dispatch.dispatch_id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : null}
                          {dispatch.status === "pending" && (
                            <Button 
                              size="sm" 
                              onClick={() => startDispatch(dispatch.dispatch_id)}
                              className="bg-blue-600 hover:bg-blue-700"
                              disabled={deletingId === dispatch.dispatch_id}
                            >
                              <Play className="h-4 w-4 mr-1" />
                              Iniciar
                            </Button>
                          )}
                          {dispatch.status !== "pending" && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                setSelectedDispatch(dispatch);
                                setShowDetails(true);
                              }}
                            >
                              Ver Detalles
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Performance Stats */}
      {stats && stats.dispatchers?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Rendimiento de Despachadores
            </CardTitle>
            <CardDescription>Últimos 30 días</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {stats.dispatchers.map(dispatcher => (
                <Card key={dispatcher.name} className="bg-accent/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-full">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{dispatcher.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {dispatcher.completed} despachos · {formatTime(dispatcher.avg_time)} promedio
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dispatch Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Despacho {selectedDispatch?.dispatch_id}
            </DialogTitle>
            <DialogDescription>
              Referencia: {selectedDispatch?.reference_number || selectedDispatch?.invoice_number} ·
              Tipo: {DISPATCH_TYPE_LABELS[selectedDispatch?.dispatch_type] || "Venta"} ·
              Vendedor: {selectedDispatch?.requested_by_name || "—"}
            </DialogDescription>
          </DialogHeader>

          {selectedDispatch && (
            <div className="space-y-4">
              {/* Status and Timer */}
              <div className="flex items-center justify-between p-3 bg-accent/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge
                    className={`${(STATUS_CONFIG[selectedDispatch.status] || DEFAULT_STATUS_CONFIG).color} text-white`}
                  >
                    {(STATUS_CONFIG[selectedDispatch.status] || DEFAULT_STATUS_CONFIG).label}
                  </Badge>
                  <Badge
                    className={`${(PRIORITY_CONFIG[selectedDispatch.priority] || DEFAULT_PRIORITY_CONFIG).color} text-white`}
                  >
                    {(PRIORITY_CONFIG[selectedDispatch.priority] || DEFAULT_PRIORITY_CONFIG).label}
                  </Badge>
                </div>
                {selectedDispatch.status === "in_progress" && (
                  <div className="flex items-center gap-2 text-lg font-mono">
                    <Timer className="h-5 w-5 text-blue-500" />
                    <span className="text-blue-600">
                      {formatTime(elapsedTime[selectedDispatch.dispatch_id] || 0)}
                    </span>
                  </div>
                )}
                {selectedDispatch.status === "completed" && (
                  <div className="flex items-center gap-2 text-lg font-mono text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    {formatTime(selectedDispatch.total_time_minutes)}
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <Label className="text-base font-medium">Productos a Despachar</Label>
                <ScrollArea className="h-[300px] border rounded-lg">
                  <div className="p-4 space-y-3">
                    {selectedDispatch.items?.map((item, index) => (
                      <DispatchItemCard
                        key={index}
                        item={item}
                        dispatchers={dispatchers}
                        onDeliver={(dispatcherId) => deliverItem(selectedDispatch.dispatch_id, item.product_id, dispatcherId)}
                        canDeliver={selectedDispatch.status === "in_progress"}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Dispatchers involved */}
              {selectedDispatch.dispatchers?.length > 0 && (
                <div>
                  <Label className="text-sm text-muted-foreground">Despachadores:</Label>
                  <div className="flex gap-2 mt-1">
                    {selectedDispatch.dispatchers.map(d => (
                      <Badge key={d} variant="outline">{d}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Dispatch Item Card Component
function DispatchItemCard({ item, dispatchers, onDeliver, canDeliver }) {
  const [selectedDispatcher, setSelectedDispatcher] = useState("");

  return (
    <div className={`p-3 rounded-lg border ${item.delivered ? 'bg-green-50 border-green-200 dark:bg-green-950/20' : 'bg-background'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${item.delivered ? 'bg-green-100' : 'bg-orange-100'}`}>
            <Package className={`h-5 w-5 ${item.delivered ? 'text-green-600' : 'text-orange-600'}`} />
          </div>
          {item.product_image ? (
            <img
              src={item.product_image}
              alt={item.product_name}
              className="h-10 w-10 rounded object-cover border"
            />
          ) : (
            <div className="h-10 w-10 rounded border bg-muted" />
          )}
          <div>
            <p className="font-medium">{item.product_name}</p>
            <p className="text-xs text-muted-foreground">
              Código: {item.product_sku || item.product_id || "—"}
            </p>
            <p className="text-sm text-muted-foreground">Cantidad: {item.quantity}</p>
          </div>
        </div>

        {item.delivered ? (
          <div className="text-right">
            <Badge className="bg-green-500 text-white">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Entregado
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">
              Por: {item.delivered_by}
            </p>
          </div>
        ) : canDeliver ? (
          <div className="flex items-center gap-2">
            <Select value={selectedDispatcher} onValueChange={setSelectedDispatcher}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Despachador" />
              </SelectTrigger>
              <SelectContent>
                {dispatchers.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              size="sm" 
              onClick={() => onDeliver(selectedDispatcher)}
              disabled={!selectedDispatcher}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Entregar
            </Button>
          </div>
        ) : (
          <Badge variant="outline" className="text-orange-600">
            Pendiente
          </Badge>
        )}
      </div>
    </div>
  );
}
