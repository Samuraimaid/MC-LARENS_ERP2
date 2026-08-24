import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import axios from "axios";
import { getPriorityColor, WORK_ORDER_STATUS } from "../lib/utils";
import { formatQuincenaLabel } from "../lib/payrollPeriods";
import { TechnicianKioskNav } from "../components/technician/TechnicianKioskNav";
import { audioAlerts } from "../lib/audioAlerts";
import { TechnicianTintJobView } from "../components/technician/TechnicianTintJobView";
import { TechnicianAccessoriesJobView } from "../components/technician/TechnicianAccessoriesJobView";
import { TechnicianElectricalJobView } from "../components/technician/TechnicianElectricalJobView";

const ROLE_LABELS = {
  instalaciones: "Instalador",
  instalador: "Instalador",
  electrico: "Eléctrico",
  polarizador: "Polarizador",
};
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import {
  Wrench,
  Clock,
  Car,
  User,
  Play,
  CheckCircle,
  ClipboardCheck,
  RefreshCw,
  Sun,
  Moon,
  LogOut,
  ChevronRight,
  Timer,
  ClipboardList,
  CalendarRange,
  Bell,
  Volume2,
  Scissors,
  Zap,
} from "lucide-react";
import { API_BASE as API } from "@/lib/api";

export function TechnicianMobilePage() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [orders, setOrders] = useState([]);
  const [commissionSummary, setCommissionSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const prevOrdersCountRef = useRef(null);

  const handleTestSound = () => {
    audioAlerts.playNewJobChime();
    toast.info("Alerta sonora y vibración activadas correctamente", { icon: "🔔" });
  };

  const fetchOrders = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/work-orders/technician/pending`, {
        withCredentials: true,
      });
      const payload = response.data || {};
      const list = payload.orders || [];
      const myOrders = list.filter(
        (o) => o.technician_id === user?.user_id || !o.technician_id
      );

      // Reproducir sonido si llegaron nuevas órdenes asignadas
      if (prevOrdersCountRef.current !== null && myOrders.length > prevOrdersCountRef.current) {
        audioAlerts.playNewJobChime();
        toast.info("¡Nuevo trabajo disponible en taller!", { icon: "🔔" });
      }
      prevOrdersCountRef.current = myOrders.length;
      setOrders(myOrders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      try {
        const fallback = await axios.get(`${API}/work-orders`, { withCredentials: true });
        const myOrders = (fallback.data || []).filter(
          (o) => o.technician_id === user?.user_id || !o.technician_id
        );
        if (prevOrdersCountRef.current !== null && myOrders.length > prevOrdersCountRef.current) {
          audioAlerts.playNewJobChime();
        }
        prevOrdersCountRef.current = myOrders.length;
        setOrders(myOrders);
      } catch {
        toast.error("No se pudieron cargar las órdenes");
      }
    }
  }, [user]);

  const fetchCommissionSummary = useCallback(async () => {
    try {
      const response = await axios.get(
        `${API}/technician/completed-jobs?period=current_quincena`,
        { withCredentials: true }
      );
      setCommissionSummary(response.data?.summary || null);
    } catch (error) {
      console.error("Error fetching commission summary:", error);
      setCommissionSummary(null);
    }
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([fetchOrders(), fetchCommissionSummary()]);
    setLoading(false);
    setRefreshing(false);
  }, [fetchOrders, fetchCommissionSummary]);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 60000);
    return () => clearInterval(interval);
  }, [loadAll]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadAll();
  };

  const claimOrder = async (orderId) => {
    try {
      await axios.put(
        `${API}/work-orders/${orderId}`,
        { technician_id: user.user_id, status: "pending" },
        { withCredentials: true }
      );
      toast.success("Orden asignada");
      fetchOrders();
    } catch {
      toast.error("Error al asignar orden");
    }
  };

  const startOrder = async (orderId) => {
    try {
      await axios.put(
        `${API}/work-orders/${orderId}`,
        { status: "in_progress" },
        { withCredentials: true }
      );
      toast.success("Trabajo iniciado");
      fetchOrders();
    } catch {
      toast.error("Error al iniciar");
    }
  };

  const sendToQualityCheck = async (orderId) => {
    try {
      await axios.put(
        `${API}/work-orders/${orderId}`,
        { status: "quality_check" },
        { withCredentials: true }
      );
      toast.success("Enviado a control de calidad");
      fetchOrders();
      setSelectedOrder(null);
    } catch {
      toast.error("Error al enviar");
    }
  };

  const getTimeElapsed = (startTime) => {
    if (!startTime) return null;
    const start = new Date(startTime);
    const now = new Date();
    const minutes = Math.floor((now - start) / 60000);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "pending":
        return <Clock className="h-5 w-5" />;
      case "in_progress":
        return <Play className="h-5 w-5" />;
      case "quality_check":
        return <ClipboardCheck className="h-5 w-5" />;
      case "completed":
        return <CheckCircle className="h-5 w-5" />;
      default:
        return <Wrench className="h-5 w-5" />;
    }
  };

  const myActiveOrders = orders.filter(
    (o) =>
      o.technician_id === user?.user_id &&
      o.status !== "completed" &&
      o.status !== "delivered"
  );
  const availableOrders = orders.filter(
    (o) => !o.technician_id && o.status === "pending"
  );
  const completedToday = orders.filter(
    (o) =>
      o.technician_id === user?.user_id &&
      o.status === "completed" &&
      o.end_time &&
      new Date(o.end_time).toDateString() === new Date().toDateString()
  );

  const quincenaLabel =
    commissionSummary?.quincena_label ||
    (commissionSummary?.quincena_start && commissionSummary?.quincena_end
      ? formatQuincenaLabel(
          new Date(`${commissionSummary.quincena_start}T12:00:00`),
          new Date(`${commissionSummary.quincena_end}T12:00:00`)
        )
      : "Quincena actual");

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24" data-testid="technician-mobile-page">
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground p-4 safe-area-top">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-primary-foreground/20">
              <AvatarImage src={user?.picture} />
              <AvatarFallback className="bg-primary-foreground/20">
                {user?.name?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-heading text-lg font-bold">
                Hola, {user?.name?.split(" ")[0]}
              </p>
              <p className="text-xs opacity-80">
                {ROLE_LABELS[user?.role] || "Técnico"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleTestSound}
              className="text-primary-foreground hover:bg-primary-foreground/20"
              title="Probar sonido de notificación"
            >
              <Bell className="h-5 w-5 text-amber-300" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="text-primary-foreground hover:bg-primary-foreground/20"
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="text-primary-foreground hover:bg-primary-foreground/20"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="px-4 pt-4">
        <Card className="border-violet-200 bg-violet-50/80 dark:border-violet-500/30 dark:bg-violet-500/10">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CalendarRange className="h-3.5 w-3.5" />
                  Quincena (corte 9 y 24)
                </p>
                <p className="text-sm font-medium mt-0.5">{quincenaLabel}</p>
                <p className="text-3xl font-bold text-violet-700 dark:text-violet-300 mt-1">
                  {commissionSummary?.quincena_total ?? 0}
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    trabajos QC
                  </span>
                </p>
                {commissionSummary?.previous_quincena_total != null ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    Quincena anterior: {commissionSummary.previous_quincena_total} trabajos
                  </p>
                ) : null}
              </div>
              <Button variant="secondary" size="sm" asChild>
                <Link to="/my-completed-jobs">
                  <ClipboardList className="h-4 w-4 mr-1" />
                  Detalle
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-2 p-4">
        <Card className="bg-orange-500/10 border-orange-500/20">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-heading font-bold text-orange-500">
              {myActiveOrders.length}
            </p>
            <p className="text-xs text-muted-foreground">En Proceso</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/10 border-blue-500/20">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-heading font-bold text-blue-500">
              {availableOrders.length}
            </p>
            <p className="text-xs text-muted-foreground">Disponibles</p>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10 border-green-500/20">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-heading font-bold text-green-500">
              {commissionSummary?.today ?? completedToday.length}
            </p>
            <p className="text-xs text-muted-foreground">Hoy</p>
          </CardContent>
        </Card>
      </div>

      <div className="px-4 mb-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="w-full"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Actualizando..." : "Actualizar"}
        </Button>
      </div>

      {myActiveOrders.length > 0 && (
        <section className="px-4 mb-6">
          <h2 className="font-heading text-lg font-bold mb-3 flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            Mis Órdenes Activas
          </h2>
          <div className="space-y-3">
            {myActiveOrders.map((order) => (
              <Card
                key={order.work_order_id}
                className="overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
                onClick={() => setSelectedOrder(order)}
                data-testid={`order-${order.work_order_id}`}
              >
                <div
                  className={`h-1 ${
                    order.status === "in_progress"
                      ? "bg-orange-500"
                      : order.status === "quality_check"
                      ? "bg-purple-500"
                      : "bg-blue-500"
                  }`}
                />
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(order.status)}
                      <span className="font-mono font-bold">
                        #{order.work_order_id.slice(-6).toUpperCase()}
                      </span>
                    </div>
                    <Badge className={getPriorityColor(order.priority)}>
                      {order.priority.toUpperCase()}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span>{order.customer_name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Car className="h-4 w-4" />
                      <span className="truncate">{order.vehicle_info}</span>
                    </div>
                    {order.start_time && (
                      <div className="flex items-center gap-2 text-orange-500">
                        <Timer className="h-4 w-4" />
                        <span>Tiempo: {getTimeElapsed(order.start_time)}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t">
                    <Badge variant="outline">{WORK_ORDER_STATUS[order.status]}</Badge>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {availableOrders.length > 0 && (
        <section className="px-4 mb-6">
          <h2 className="font-heading text-lg font-bold mb-3 flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" />
            Órdenes Disponibles
          </h2>
          <div className="space-y-3">
            {availableOrders.map((order) => (
              <Card key={order.work_order_id} className="overflow-hidden">
                <div className="h-1 bg-blue-500" />
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-mono font-bold">
                      #{order.work_order_id.slice(-6).toUpperCase()}
                    </span>
                    <Badge className={getPriorityColor(order.priority)}>
                      {order.priority.toUpperCase()}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-sm mb-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Car className="h-4 w-4" />
                      <span className="truncate">{order.vehicle_info}</span>
                    </div>
                    <p className="text-muted-foreground">
                      {(order.items || []).length} trabajo(s)
                      {order.estimated_time ? ` · Est. ${order.estimated_time} min` : ""}
                    </p>
                  </div>

                  <Button
                    onClick={() => claimOrder(order.work_order_id)}
                    className="w-full"
                    data-testid={`claim-${order.work_order_id}`}
                  >
                    Tomar Orden
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {myActiveOrders.length === 0 && availableOrders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <CheckCircle className="h-16 w-16 mb-4 opacity-50" />
          <p className="text-lg">No hay órdenes pendientes</p>
          <p className="text-sm">¡Buen trabajo!</p>
        </div>
      )}

      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-md mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Orden #{selectedOrder?.work_order_id.slice(-6).toUpperCase()}
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{selectedOrder.customer_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedOrder.vehicle_info}</span>
                </div>
              </div>

              {/* Vista Especializada según Perfil / Tipo de Trabajo */}
              {selectedOrder.department === "polarizados" || user?.role === "polarizador" || selectedOrder.tint_window_plan ? (
                <TechnicianTintJobView order={selectedOrder} />
              ) : selectedOrder.department === "electrico" || user?.role === "electrico" ? (
                <TechnicianElectricalJobView order={selectedOrder} />
              ) : (
                <TechnicianAccessoriesJobView order={selectedOrder} />
              )}

              {selectedOrder.start_time && (
                <div className="flex items-center gap-2 p-3 bg-orange-500/10 rounded-sm">
                  <Timer className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="text-sm font-medium">Tiempo transcurrido</p>
                    <p className="text-lg font-heading font-bold text-orange-500">
                      {getTimeElapsed(selectedOrder.start_time)}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2 pt-4">
                {selectedOrder.status === "pending" && (
                  <Button
                    onClick={() => startOrder(selectedOrder.work_order_id)}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="h-5 w-5 mr-2" />
                    Iniciar Trabajo
                  </Button>
                )}

                {selectedOrder.status === "in_progress" && (
                  <Button
                    onClick={() => sendToQualityCheck(selectedOrder.work_order_id)}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                    size="lg"
                  >
                    <ClipboardCheck className="h-5 w-5 mr-2" />
                    Enviar a Control de Calidad
                  </Button>
                )}

                {selectedOrder.status === "quality_check" && (
                  <div className="rounded-lg border border-purple-300/60 bg-purple-50/80 p-4 text-center dark:border-purple-500/30 dark:bg-purple-500/10">
                    <ClipboardCheck className="h-6 w-6 mx-auto mb-2 text-purple-600" />
                    <p className="font-medium text-sm">En control de calidad</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      El coordinador revisará y aprobará el trabajo.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <TechnicianKioskNav />
    </div>
  );
}

export default TechnicianMobilePage;