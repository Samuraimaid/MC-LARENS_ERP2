import React, { useState, useEffect } from "react";
import axios from "axios";
import { formatDate } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { ScrollArea } from "../components/ui/scroll-area";
// Separator, Tabs, Slider not used here (kept out to reduce lint noise)
import { toast } from "sonner";
import { 
  Car, Search, Clock, CheckCircle2, Play, Plus,
  Palette, Sun, RefreshCw,
  Maximize2, Square, Star, CircleDot
} from "lucide-react";
import { API_BASE as API } from "@/lib/api";

const STATUS_CONFIG = {
  pending: { label: "Pendiente", color: "bg-yellow-500", icon: Clock },
  in_progress: { label: "En Proceso", color: "bg-blue-500", icon: Play },
  quality_check: { label: "Control Calidad", color: "bg-purple-500", icon: Star },
  completed: { label: "Completado", color: "bg-green-500", icon: CheckCircle2 }
};

const PRIORITY_CONFIG = {
  low: { label: "Baja", color: "bg-gray-400" },
  normal: { label: "Normal", color: "bg-blue-400" },
  high: { label: "Alta", color: "bg-orange-500" },
  urgent: { label: "Urgente", color: "bg-red-500" }
};

const WINDOW_ICONS = {
  frontal: Maximize2,
  trasero: Maximize2,
  lateral_conductor: Square,
  lateral_copiloto: Square,
  lateral_trasero_izq: Square,
  lateral_trasero_der: Square,
  franja_superior: () => <div className="w-5 h-2 bg-current rounded" />,
  franja_inferior: () => <div className="w-5 h-2 bg-current rounded" />,
  quemacocos: CircleDot
};

const SHADE_COLORS = {
  5: "#1a1a1a",
  15: "#2d2d2d",
  20: "#404040",
  35: "#595959",
  50: "#737373",
  70: "#999999"
};

export function TintOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [materials, setMaterials] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [technicians, setTechnicians] = useState([]);

  // New order form
  const [newOrder, setNewOrder] = useState({
    customer_id: "",
    vehicle_id: "",
    priority: "normal",
    notes: "",
    windows: []
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ordersRes, materialsRes, customersRes, vehiclesRes, techRes] = await Promise.all([
        axios.get(`${API}/tint-orders`, { withCredentials: true }),
        axios.get(`${API}/tint-orders/materials/list`, { withCredentials: true }),
        axios.get(`${API}/customers`, { withCredentials: true }),
        axios.get(`${API}/vehicles`, { withCredentials: true }),
        axios.get(`${API}/dispatch/dispatchers/list`, { withCredentials: true }).catch(() => ({ data: [] }))
      ]);
      setOrders(ordersRes.data);
      setMaterials(materialsRes.data);
      setCustomers(customersRes.data);
      setVehicles(vehiclesRes.data);
      setTechnicians(techRes.data.filter(t => t.role === "instalaciones" || t.role === "supervisor" || t.role === "gerencia"));
    } catch (error) {
      toast.error("Error al cargar órdenes de polarizado");
    } finally {
      setLoading(false);
    }
  };

  const createOrder = async () => {
    if (!newOrder.customer_id || !newOrder.vehicle_id || newOrder.windows.length === 0) {
      toast.error("Completa todos los campos requeridos");
      return;
    }

    try {
      await axios.post(`${API}/tint-orders`, newOrder, { withCredentials: true });
      toast.success("Orden de polarizado creada");
      setShowNewOrder(false);
      resetNewOrder();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al crear orden");
    }
  };

  const startOrder = async (orderId) => {
    try {
      await axios.put(`${API}/tint-orders/${orderId}/start`, {}, { withCredentials: true });
      toast.success("Orden iniciada");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al iniciar orden");
    }
  };

  const updateWindow = async (orderId, windowType, data) => {
    try {
      await axios.put(`${API}/tint-orders/${orderId}/window`, {
        window_type: windowType,
        ...data
      }, { withCredentials: true });
      toast.success("Ventana actualizada");
      
      // Refresh the order
      const updated = await axios.get(`${API}/tint-orders/${orderId}`, { withCredentials: true });
      setSelectedOrder(updated.data);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al actualizar ventana");
    }
  };

  const completeOrder = async (orderId, rating, materialUsed) => {
    try {
      await axios.put(`${API}/tint-orders/${orderId}/complete?quality_rating=${rating}&total_material=${materialUsed}`, {}, { withCredentials: true });
      toast.success("Orden completada");
      setShowDetails(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al completar orden");
    }
  };

  const resetNewOrder = () => {
    setNewOrder({
      customer_id: "",
      vehicle_id: "",
      priority: "normal",
      notes: "",
      windows: []
    });
  };

  const toggleWindow = (windowType) => {
    const exists = newOrder.windows.find(w => w.window_type === windowType);
    if (exists) {
      setNewOrder({
        ...newOrder,
        windows: newOrder.windows.filter(w => w.window_type !== windowType)
      });
    } else {
      setNewOrder({
        ...newOrder,
        windows: [...newOrder.windows, {
          window_type: windowType,
          material: "ceramic",
          shade_percentage: 20
        }]
      });
    }
  };

  const updateWindowSpec = (windowType, field, value) => {
    setNewOrder({
      ...newOrder,
      windows: newOrder.windows.map(w => 
        w.window_type === windowType ? { ...w, [field]: value } : w
      )
    });
  };

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
                         o.tint_order_id?.toLowerCase().includes(search.toLowerCase()) ||
                         o.vehicle_info?.plate?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === "all" || o.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const customerVehicles = vehicles.filter(v => v.customer_id === newOrder.customer_id);

  const pendingCount = orders.filter(o => o.status === "pending").length;
  const inProgressCount = orders.filter(o => o.status === "in_progress").length;
  const qualityCheckCount = orders.filter(o => o.status === "quality_check").length;

  return (
    <div className="space-y-6" data-testid="tint-orders-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Órdenes de Polarizado</h1>
          <p className="text-muted-foreground">Gestión de trabajos de polarizado de vidrios</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <Button onClick={() => setShowNewOrder(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Orden
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
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">EN PROCESO</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold">{inProgressCount}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">CONTROL CALIDAD</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold">{qualityCheckCount}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">COMPLETADOS HOY</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold">
              {orders.filter(o => o.status === "completed" && new Date(o.completed_at).toDateString() === new Date().toDateString()).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, orden o placa..."
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
            <SelectItem value="quality_check">Control Calidad</SelectItem>
            <SelectItem value="completed">Completados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Orders List */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Orden</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Vehículo</TableHead>
                <TableHead>Vidrios</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    <Sun className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    No hay órdenes de polarizado
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map(order => {
                  const statusConfig = STATUS_CONFIG[order.status];
                  const priorityConfig = PRIORITY_CONFIG[order.priority];
                  const completedWindows = order.windows?.filter(w => w.status === "completed").length || 0;
                  const totalWindows = order.windows?.length || 0;
                  
                  return (
                    <TableRow key={order.tint_order_id} className="cursor-pointer hover:bg-accent/50">
                      <TableCell className="font-mono font-medium">
                        {order.tint_order_id}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{order.customer_name}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Car className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{order.vehicle_info?.plate}</p>
                            <p className="text-xs text-muted-foreground">
                              {order.vehicle_info?.brand} {order.vehicle_info?.model} {order.vehicle_info?.year}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono">{completedWindows}/{totalWindows}</span>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${priorityConfig.color} text-white`}>
                          {priorityConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${statusConfig.color} text-white`}>
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          {order.status === "pending" && (
                            <Button 
                              size="sm" 
                              onClick={() => startOrder(order.tint_order_id)}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              <Play className="h-4 w-4 mr-1" />
                              Iniciar
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setSelectedOrder(order);
                              setShowDetails(true);
                            }}
                          >
                            Ver Detalles
                          </Button>
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

      {/* New Order Dialog */}
      <Dialog open={showNewOrder} onOpenChange={setShowNewOrder}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sun className="h-5 w-5" />
              Nueva Orden de Polarizado
            </DialogTitle>
            <DialogDescription>
              Configura los detalles del trabajo de polarizado
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Customer & Vehicle */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cliente *</Label>
                <Select value={newOrder.customer_id} onValueChange={(v) => setNewOrder({ ...newOrder, customer_id: v, vehicle_id: "" })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map(c => (
                      <SelectItem key={c.customer_id} value={c.customer_id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Vehículo *</Label>
                <Select 
                  value={newOrder.vehicle_id} 
                  onValueChange={(v) => setNewOrder({ ...newOrder, vehicle_id: v })}
                  disabled={!newOrder.customer_id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar vehículo" />
                  </SelectTrigger>
                  <SelectContent>
                    {customerVehicles.map(v => (
                      <SelectItem key={v.vehicle_id} value={v.vehicle_id}>
                        {v.plate} - {v.brand} {v.model} ({v.year})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Priority */}
            <div>
              <Label>Prioridad</Label>
              <Select value={newOrder.priority} onValueChange={(v) => setNewOrder({ ...newOrder, priority: v })}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baja</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Window Selection */}
            <div>
              <Label className="text-base font-medium">Vidrios a Polarizar *</Label>
              <p className="text-sm text-muted-foreground mb-3">Selecciona los vidrios y configura el material</p>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {materials?.window_types?.map(wt => {
                  const isSelected = newOrder.windows.some(w => w.window_type === wt.id);
                  const windowSpec = newOrder.windows.find(w => w.window_type === wt.id);
                  const IconComp = WINDOW_ICONS[wt.id];
                  
                  return (
                    <Card 
                      key={wt.id} 
                      className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-accent/50'}`}
                      onClick={() => toggleWindow(wt.id)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start gap-3 mb-2">
                          <Checkbox checked={isSelected} className="mt-1" />
                          {wt.images?.[0] ? (
                            <img src={wt.images[0]} alt={wt.name} className="w-28 h-28 object-cover rounded" />
                          ) : (
                            <div className="w-16 h-16 rounded bg-gray-100 flex items-center justify-center">
                              {IconComp ? <IconComp className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                            </div>
                          )}
                          <div className="flex-1">
                            <span className="font-medium text-sm">{wt.name}</span>
                            {wt.description && <p className="text-xs text-muted-foreground">{wt.description}</p>}
                          </div>
                        </div>
                        
                        {isSelected && (
                          <div className="space-y-2 mt-3 pt-3 border-t" onClick={e => e.stopPropagation()}>
                            <Select 
                              value={windowSpec?.material || "ceramic"} 
                              onValueChange={(v) => updateWindowSpec(wt.id, "material", v)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {materials?.materials?.map(m => (
                                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            
                            <Select 
                              value={String(windowSpec?.shade_percentage || 20)} 
                              onValueChange={(v) => updateWindowSpec(wt.id, "shade_percentage", parseInt(v))}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {materials?.shade_options?.map(shade => (
                                  <SelectItem key={shade} value={String(shade)}>
                                    <div className="flex items-center gap-2">
                                      <div 
                                        className="w-4 h-4 rounded border" 
                                        style={{ backgroundColor: SHADE_COLORS[shade] }}
                                      />
                                      {shade}%
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label>Notas</Label>
              <Input
                value={newOrder.notes}
                onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })}
                placeholder="Observaciones o instrucciones especiales..."
              />
            </div>

            <Button onClick={createOrder} className="w-full" disabled={newOrder.windows.length === 0}>
              Crear Orden de Polarizado
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Order Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sun className="h-5 w-5" />
              {selectedOrder?.tint_order_id}
            </DialogTitle>
            <DialogDescription>
              {selectedOrder?.customer_name} · {selectedOrder?.vehicle_info?.plate} - {selectedOrder?.vehicle_info?.brand} {selectedOrder?.vehicle_info?.model}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <TintOrderDetails 
              order={selectedOrder}
              technicians={technicians}
              materials={materials}
              onUpdateWindow={updateWindow}
              onComplete={completeOrder}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Tint Order Details Component
function TintOrderDetails({ order, technicians, materials, onUpdateWindow, onComplete }) {
  const [qualityRating, setQualityRating] = useState(5);
  const [materialUsed, setMaterialUsed] = useState(0);

  // allWindowsCompleted not used; removed to silence lint

  return (
    <div className="space-y-6">
      {/* Status */}
      <div className="flex items-center justify-between p-3 bg-accent/30 rounded-lg">
        <div className="flex items-center gap-3">
          <Badge className={`${STATUS_CONFIG[order.status]?.color} text-white`}>
            {STATUS_CONFIG[order.status]?.label}
          </Badge>
          <Badge className={`${PRIORITY_CONFIG[order.priority]?.color} text-white`}>
            {PRIORITY_CONFIG[order.priority]?.label}
          </Badge>
        </div>
        <div className="text-sm text-muted-foreground">
          Creado: {formatDate(order.created_at)}
        </div>
      </div>

      {/* Vehicle Info */}
      <Card className="bg-accent/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Car className="h-10 w-10 text-primary" />
            <div>
              <p className="font-heading text-xl font-bold">{order.vehicle_info?.plate}</p>
              <p className="text-muted-foreground">
                {order.vehicle_info?.brand} {order.vehicle_info?.model} ({order.vehicle_info?.year}) - {order.vehicle_info?.color}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Windows */}
      <div>
        <Label className="text-base font-medium">Vidrios</Label>
        <ScrollArea className="h-[300px] mt-2">
          <div className="space-y-3">
            {order.windows?.map((window, index) => (
              <TintWindowCard
                key={index}
                window={window}
                technicians={technicians}
                materials={materials}
                canEdit={order.status === "in_progress"}
                onUpdate={(data) => onUpdateWindow(order.tint_order_id, window.window_type, data)}
              />
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Quality Check & Complete */}
      {order.status === "quality_check" && (
        <Card className="border-purple-200 bg-purple-50 dark:bg-purple-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-purple-600" />
              Control de Calidad
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Calificación de Calidad</Label>
              <div className="flex items-center gap-2 mt-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <Button
                    key={star}
                    variant={qualityRating >= star ? "default" : "outline"}
                    size="sm"
                    onClick={() => setQualityRating(star)}
                    className={qualityRating >= star ? "bg-yellow-500 hover:bg-yellow-600" : ""}
                  >
                    <Star className="h-4 w-4" fill={qualityRating >= star ? "currentColor" : "none"} />
                  </Button>
                ))}
                <span className="ml-2 text-muted-foreground">{qualityRating}/5</span>
              </div>
            </div>

            <div>
              <Label>Material Total Utilizado (metros)</Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={materialUsed}
                onChange={(e) => setMaterialUsed(parseFloat(e.target.value) || 0)}
                className="w-32"
              />
            </div>

            <Button 
              onClick={() => onComplete(order.tint_order_id, qualityRating, materialUsed)}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Aprobar y Completar Orden
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {order.notes && (
        <div>
          <Label className="text-muted-foreground">Notas:</Label>
          <p className="text-sm mt-1">{order.notes}</p>
        </div>
      )}
    </div>
  );
}

// Tint Window Card Component
function TintWindowCard({ window, technicians, materials, canEdit, onUpdate }) {
  const [selectedTechnician, setSelectedTechnician] = useState(window.technician_id || "");
  
  const windowType = materials?.window_types?.find(w => w.id === window.window_type);
  const materialInfo = materials?.materials?.find(m => m.id === window.material);

  const markComplete = () => {
    if (!selectedTechnician) {
      return;
    }
    onUpdate({ status: "completed", technician_id: selectedTechnician });
  };

  return (
    <Card className={`${window.status === "completed" ? 'bg-green-50 border-green-200 dark:bg-green-950/20' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
              {windowType?.images?.[0] || materialInfo?.image ? (
                <img
                  src={windowType?.images?.[0] || materialInfo?.image}
                  alt={windowType?.name || materialInfo?.name}
                  className="w-12 h-12 object-cover rounded"
                />
              ) : (
                <div 
                  className="w-8 h-8 rounded flex items-center justify-center"
                  style={{ backgroundColor: SHADE_COLORS[window.shade_percentage] || "#666" }}
                >
                  <Palette className="h-4 w-4 text-white" />
                </div>
              )}
              <div>
                <p className="font-medium">{windowType?.name || window.window_type}</p>
                <p className="text-sm text-muted-foreground">
                  {materialInfo?.name || window.material} · {window.shade_percentage}%
                </p>
              </div>
            </div>

          {window.status === "completed" ? (
            <div className="text-right">
              <Badge className="bg-green-500 text-white">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Completado
              </Badge>
              {window.technician_id && (
                <p className="text-xs text-muted-foreground mt-1">
                  Por: {window.technician_id}
                </p>
              )}
            </div>
          ) : canEdit ? (
            <div className="flex items-center gap-2">
              <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Técnico" />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={markComplete}
                disabled={!selectedTechnician}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle2 className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Badge variant="outline" className="text-yellow-600">
              Pendiente
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
