import React, { useState, useEffect } from "react";
import axios from "axios";
import { getKDSStatusClass } from "../lib/utils";
import { Badge } from "../components/ui/badge";
import { Clock, User, Car, Wrench, CheckCircle } from "lucide-react";
import { API_BASE as API } from "@/lib/api";
import { getVehicleThumbnail } from "@/lib/vehicleThumbnail";

export function KDSPage() {
  const [orders, setOrders] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      const [ordersRes, vehiclesRes] = await Promise.all([
        axios.get(`${API}/kds/orders`, { withCredentials: true }),
        axios.get(`${API}/vehicles`, { withCredentials: true }),
      ]);
      setOrders(ordersRes.data);
      setVehicles(Array.isArray(vehiclesRes.data) ? vehiclesRes.data : []);
    } catch (error) {
      console.error("Error fetching KDS orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (orderId, newStatus) => {
    try {
      await axios.put(`${API}/work-orders/${orderId}`, { status: newStatus }, { withCredentials: true });
      fetchOrders();
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const getTimeElapsed = (createdAt) => {
    const now = new Date();
    const created = new Date(createdAt);
    const minutes = Math.floor((now - created) / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const getPriorityOrder = (priority) => {
    const order = { urgent: 0, high: 1, normal: 2, low: 3 };
    return order[priority] || 2;
  };

  const sortedOrders = [...orders].sort((a, b) => {
    const priorityDiff = getPriorityOrder(a.priority) - getPriorityOrder(b.priority);
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(a.created_at) - new Date(b.created_at);
  });

  const getOrderVehicle = (order) => {
    if (!order?.vehicle_id) return null;
    return vehicles.find((vehicle) => vehicle.vehicle_id === order.vehicle_id || vehicle.id === order.vehicle_id) || null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-xl text-muted-foreground">Cargando órdenes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="kds-page">
      {/* Stats bar */}
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-2 px-4 py-2 rounded-sm bg-green-500/20 text-green-600 dark:text-green-400">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>Nuevas: {orders.filter(o => o.status === "pending").length}</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-sm bg-yellow-500/20 text-yellow-600 dark:text-yellow-400">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span>En Proceso: {orders.filter(o => o.status === "in_progress").length}</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-sm bg-purple-500/20 text-purple-600 dark:text-purple-400">
          <div className="w-3 h-3 rounded-full bg-purple-500" />
          <span>Control Calidad: {orders.filter(o => o.status === "quality_check").length}</span>
        </div>
      </div>

      {/* Orders Grid */}
      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground">
          <CheckCircle className="h-16 w-16 mb-4" />
          <p className="text-2xl font-heading">No hay órdenes pendientes</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          {sortedOrders.map(order => (
            <div
              key={order.work_order_id}
              className={`rounded-md border-2 bg-card shadow-md overflow-hidden transition-all hover:shadow-lg ${getKDSStatusClass(order.status, order.created_at)}`}
              data-testid={`kds-order-${order.work_order_id}`}
            >
              {/* Header */}
              <div className="bg-card p-3 border-b">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-heading text-lg font-bold">
                    #{order.work_order_id.slice(-6).toUpperCase()}
                  </span>
                  <Badge
                    variant="outline"
                    className={
                      order.priority === "urgent" ? "border-red-500 text-red-500" :
                      order.priority === "high" ? "border-orange-500 text-orange-500" :
                      "border-muted-foreground"
                    }
                  >
                    {order.priority.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span className="font-mono">{getTimeElapsed(order.created_at)}</span>
                  <span className="text-xs">/ {order.estimated_time}min est.</span>
                </div>
              </div>

              {/* Content */}
              <div className="p-3 space-y-3">
                <img
                  src={getVehicleThumbnail(getOrderVehicle(order))}
                  alt="Vehículo"
                  className="w-full h-24 rounded-md object-cover bg-muted/30"
                />
                {/* Customer */}
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium truncate">{order.customer_name}</span>
                </div>

                {/* Vehicle */}
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm truncate">{order.vehicle_info}</span>
                </div>

                {/* Items */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Wrench className="h-4 w-4" />
                    <span className="text-xs uppercase tracking-wide">Trabajos:</span>
                  </div>
                  <ul className="pl-6 space-y-1">
                    {order.items.slice(0, 3).map((item, idx) => (
                      <li key={idx} className="text-sm">
                        • {item.description || item.product_name || "Trabajo"}
                      </li>
                    ))}
                    {order.items.length > 3 && (
                      <li className="text-sm text-muted-foreground">
                        +{order.items.length - 3} más...
                      </li>
                    )}
                  </ul>
                </div>

                {/* Technician */}
                {order.technician_name && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">Técnico:</p>
                    <p className="text-sm font-medium">{order.technician_name}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="p-2 bg-muted/50 flex gap-2">
                {order.status === "pending" && (
                  <button
                    onClick={() => updateStatus(order.work_order_id, "in_progress")}
                    className="flex-1 py-2 px-3 rounded-sm bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                    data-testid={`kds-start-${order.work_order_id}`}
                  >
                    INICIAR
                  </button>
                )}
                {order.status === "in_progress" && (
                  <button
                    onClick={() => updateStatus(order.work_order_id, "quality_check")}
                    className="flex-1 py-2 px-3 rounded-sm bg-yellow-500 text-white text-sm font-medium hover:bg-yellow-600 transition-colors"
                    data-testid={`kds-quality-${order.work_order_id}`}
                  >
                    CONTROL CALIDAD
                  </button>
                )}
                {order.status === "quality_check" && (
                  <div
                    className="flex-1 py-2 px-3 rounded-sm bg-purple-500/15 text-purple-700 dark:text-purple-300 text-sm font-medium text-center"
                    data-testid={`kds-qc-pending-${order.work_order_id}`}
                  >
                    PENDIENTE QC
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
