import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import axios from "axios";
import { getPriorityColor, WORK_ORDER_STATUS } from "../lib/utils";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Textarea } from "../components/ui/textarea";
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
  Star,
} from "lucide-react";
import { API_BASE as API } from "@/lib/api";

export function TechnicianMobilePage() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [qualityNotes, setQualityNotes] = useState("");
  const [qualityScore, setQualityScore] = useState(8);

  const fetchOrders = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/work-orders`, {
        withCredentials: true,
      });
      // Filter orders for current technician or unassigned
      const myOrders = response.data.filter(
        (o) => o.technician_id === user?.user_id || !o.technician_id
      );
      setOrders(myOrders);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchOrders();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchOrders, 60000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchOrders();
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      toast.error("Error al enviar");
    }
  };

  const completeWithQuality = async () => {
    if (!selectedOrder) return;
    try {
      await axios.put(
        `${API}/work-orders/${selectedOrder.work_order_id}`,
        {
          status: "completed",
          quality_score: qualityScore,
          quality_notes: qualityNotes,
        },
        { withCredentials: true }
      );
      toast.success("Orden completada");
      setShowQualityModal(false);
      setSelectedOrder(null);
      setQualityNotes("");
      setQualityScore(8);
      fetchOrders();
    } catch (error) {
      toast.error("Error al completar");
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
    (o) => o.technician_id === user?.user_id && o.status !== "completed" && o.status !== "delivered"
  );
  const availableOrders = orders.filter((o) => !o.technician_id && o.status === "pending");
  const completedToday = orders.filter(
    (o) =>
      o.technician_id === user?.user_id &&
      o.status === "completed" &&
      new Date(o.end_time).toDateString() === new Date().toDateString()
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20" data-testid="technician-mobile-page">
      {/* Header */}
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
              <p className="font-heading text-lg font-bold">Hola, {user?.name?.split(" ")[0]}</p>
              <p className="text-xs opacity-80">Técnico de Instalaciones</p>
            </div>
          </div>
          <div className="flex gap-2">
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

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 p-4">
        <Card className="bg-orange-500/10 border-orange-500/20">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-heading font-bold text-orange-500">{myActiveOrders.length}</p>
            <p className="text-xs text-muted-foreground">En Proceso</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/10 border-blue-500/20">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-heading font-bold text-blue-500">{availableOrders.length}</p>
            <p className="text-xs text-muted-foreground">Disponibles</p>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10 border-green-500/20">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-heading font-bold text-green-500">{completedToday.length}</p>
            <p className="text-xs text-muted-foreground">Hoy</p>
          </CardContent>
        </Card>
      </div>

      {/* Pull to refresh */}
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

      {/* My Active Orders */}
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

      {/* Available Orders */}
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
                      {order.items.length} trabajo(s) • Est. {order.estimated_time} min
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

      {/* Empty State */}
      {myActiveOrders.length === 0 && availableOrders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <CheckCircle className="h-16 w-16 mb-4 opacity-50" />
          <p className="text-lg">No hay órdenes pendientes</p>
          <p className="text-sm">¡Buen trabajo!</p>
        </div>
      )}

      {/* Order Detail Modal */}
      <Dialog open={!!selectedOrder && !showQualityModal} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-md mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Orden #{selectedOrder?.work_order_id.slice(-6).toUpperCase()}
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              {/* Customer & Vehicle */}
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

              {/* Work Items */}
              <div>
                <Label className="text-muted-foreground">Trabajos a Realizar:</Label>
                <ul className="mt-2 space-y-2">
                  {selectedOrder.items.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 p-2 bg-muted rounded-sm">
                      <CheckCircle className="h-4 w-4 mt-0.5 text-primary" />
                      <span>{item.description || "Instalación"}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Time Info */}
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

              {/* Actions */}
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
                  <Button
                    onClick={() => setShowQualityModal(true)}
                    className="w-full bg-green-600 hover:bg-green-700"
                    size="lg"
                  >
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Completar con Revisión
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Quality Check Modal */}
      <Dialog open={showQualityModal} onOpenChange={setShowQualityModal}>
        <DialogContent className="max-w-md mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Control de Calidad
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Quality Score */}
            <div>
              <Label>Puntuación de Calidad</Label>
              <div className="flex gap-1 mt-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                  <button
                    key={score}
                    onClick={() => setQualityScore(score)}
                    className={`flex-1 py-2 rounded-sm text-sm font-bold transition-colors ${
                      score <= qualityScore
                        ? score >= 8
                          ? "bg-green-500 text-white"
                          : score >= 5
                          ? "bg-yellow-500 text-white"
                          : "bg-red-500 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {score}
                  </button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {qualityScore >= 8
                  ? "✅ Excelente calidad"
                  : qualityScore >= 5
                  ? "⚠️ Calidad aceptable"
                  : "❌ Requiere revisión"}
              </p>
            </div>

            {/* Notes */}
            <div>
              <Label>Notas de Inspección</Label>
              <Textarea
                value={qualityNotes}
                onChange={(e) => setQualityNotes(e.target.value)}
                placeholder="Observaciones del trabajo realizado..."
                className="mt-2"
                rows={3}
              />
            </div>

            <Button onClick={completeWithQuality} className="w-full bg-green-600 hover:bg-green-700" size="lg">
              <CheckCircle className="h-5 w-5 mr-2" />
              Completar Orden
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
