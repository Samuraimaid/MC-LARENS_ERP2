import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { getStatusColor, getPriorityColor, WORK_ORDER_STATUS } from "../lib/utils";
import { API_BASE as API } from "@/lib/api";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";
import { Plus, Search, Wrench, Clock, Printer, RefreshCw } from "lucide-react";

const QC_APPROVER_ROLES = ["gerencia", "coordinador_instalaciones"];

export function WorkOrdersPage() {
  const { user } = useAuth();
  const canApproveCompleted = QC_APPROVER_ROLES.includes(
    String(user?.role || "").toLowerCase()
  );
  const [workOrders, setWorkOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [products, setProducts] = useState([]);
  const [, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [showDetails, setShowDetails] = useState(null);

  // New order form
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [priority, setPriority] = useState("normal");
  const [estimatedTime, setEstimatedTime] = useState(60);
  const [items, setItems] = useState([{ description: "", image: "" }]);
  const [notes, setNotes] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterStatus !== "all" ? `?status=${filterStatus}` : "";
      const [ordersRes, customersRes, usersRes, productsRes] = await Promise.all([
        axios.get(`${API}/work-orders${params}`, { withCredentials: true }),
        axios.get(`${API}/customers`, { withCredentials: true }),
        axios.get(`${API}/users`, { withCredentials: true }).catch(() => ({ data: [] })),
        axios.get(`${API}/products`, { withCredentials: true }).catch(() => ({ data: [] })),
      ]);
      setWorkOrders(ordersRes.data);
      setCustomers(customersRes.data);
      setTechnicians(usersRes.data.filter(u => u.role === "instalaciones"));
      setProducts(productsRes.data || []);
    } catch (error) {
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (selectedCustomer) {
      fetchVehicles(selectedCustomer);
    }
  }, [selectedCustomer]);

  const fetchVehicles = async (customerId) => {
    try {
      const response = await axios.get(`${API}/vehicles?customer_id=${customerId}`, { withCredentials: true });
      setVehicles(response.data);
    } catch (error) {
      console.error("Error fetching vehicles:", error);
    }
  };

  const createWorkOrder = async () => {
    if (!selectedCustomer || !selectedVehicle) {
      toast.error("Selecciona cliente y vehículo");
      return;
    }
    if (items.filter(i => i.description.trim()).length === 0) {
      toast.error("Agrega al menos un trabajo");
      return;
    }

    try {
      await axios.post(`${API}/work-orders`, {
        customer_id: selectedCustomer,
        vehicle_id: selectedVehicle,
        items: items.filter(i => i.description.trim()).map(i => ({ description: i.description, image: i.image })),
        priority,
        estimated_time: estimatedTime,
        notes,
      }, { withCredentials: true });

      toast.success("Orden de trabajo creada");
      setShowNewOrder(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al crear orden");
    }
  };

  const resetForm = () => {
    setSelectedCustomer("");
    setSelectedVehicle("");
    setPriority("normal");
    setEstimatedTime(60);
    setItems([{ description: "", image: "" }]);
    setNotes("");
  };

  const updateStatus = async (orderId, status, technicianId = null) => {
    try {
      await axios.put(`${API}/work-orders/${orderId}`, {
        status,
        technician_id: technicianId,
      }, { withCredentials: true });
      toast.success("Estado actualizado");
      fetchData();
      setShowDetails(null);
    } catch (error) {
      toast.error("Error al actualizar");
    }
  };

  const addItem = () => {
    setItems([...items, { description: "", image: "" }]);
  };

  const updateItem = (index, value, key = "description") => {
    const newItems = [...items];
    newItems[index][key] = value;
    setItems(newItems);
  };

  const removeItem = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const printWorkOrder = async (orderId) => {
    try {
      const response = await axios.get(`${API}/print/work-order/${orderId}`, {
        withCredentials: true,
        responseType: "text",
      });
      const printWindow = window.open("", "_blank");
      printWindow.document.write(`<pre style="font-family: monospace; font-size: 12px;">${response.data}</pre>`);
      printWindow.document.close();
      printWindow.print();
    } catch (error) {
      toast.error("Error al imprimir");
    }
  };

  const filteredOrders = workOrders.filter(order => {
    const query = search.toLowerCase();
    return (
      (order.work_order_id || "").toLowerCase().includes(query) ||
      (order.customer_name || "").toLowerCase().includes(query) ||
      (order.vehicle_info || "").toLowerCase().includes(query)
    );
  });

  return (
    <div className="p-6 space-y-6" data-testid="work-orders-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Órdenes de Trabajo</h1>
          <p className="text-muted-foreground">Gestión de instalaciones y servicios</p>
        </div>
        <Dialog open={showNewOrder} onOpenChange={setShowNewOrder}>
          <DialogTrigger asChild>
            <Button data-testid="new-work-order-btn">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Orden
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-6xl">
            <DialogHeader>
              <DialogTitle>Nueva Orden de Trabajo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Cliente</Label>
                  <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                    <SelectTrigger data-testid="wo-select-customer">
                      <SelectValue placeholder="Seleccionar cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map(c => (
                        <SelectItem key={c.customer_id} value={c.customer_id}>
                          {c.name} - {c.phone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Vehículo</Label>
                  <Select value={selectedVehicle} onValueChange={setSelectedVehicle} disabled={!selectedCustomer}>
                    <SelectTrigger data-testid="wo-select-vehicle">
                      <SelectValue placeholder={selectedCustomer ? "Seleccionar vehículo" : "Primero selecciona cliente"} />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.map(v => (
                        <SelectItem key={v.vehicle_id} value={v.vehicle_id}>
                          {v.brand} {v.model} {v.year} - {v.plate}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Prioridad</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger>
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
                <div>
                  <Label>Tiempo Estimado (minutos)</Label>
                  <Input
                    type="number"
                    value={estimatedTime}
                    onChange={(e) => setEstimatedTime(parseInt(e.target.value) || 60)}
                  />
                </div>
              </div>

              <div>
                <Label>Trabajos a Realizar</Label>
                <div className="space-y-2">
                  {items.map((item, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      {item.image ? (
                        <img src={item.image} alt={`item-${index}`} className="w-28 h-28 object-cover rounded" />
                      ) : (
                        <div className="w-28 h-28 bg-muted rounded" />
                      )}
                      <div className="flex-1 space-y-2">
                        <Input
                          value={item.description}
                          onChange={(e) => updateItem(index, e.target.value, "description")}
                          placeholder={`Trabajo ${index + 1}`}
                        />
                        <Input
                          value={item.image}
                          onChange={(e) => updateItem(index, e.target.value, "image")}
                          placeholder="URL de imagen (opcional)"
                        />
                        <div>
                          <Label className="text-sm">Asociar a producto (opcional)</Label>
                          <Select value={item.product_id ?? "__none__"} onValueChange={(val) => {
                            if (!val || val === "__none__") {
                              updateItem(index, "", "image");
                              updateItem(index, "", "product_id");
                              return;
                            }
                            const p = products.find(x => x.product_id === val);
                            updateItem(index, p?.images?.[0] || "", "image");
                            updateItem(index, val, "product_id");
                          }}>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar producto (opcional)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Ninguno</SelectItem>
                              {products.map(p => (
                                <SelectItem key={p.product_id} value={p.product_id}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        {items.length > 1 && (
                          <Button variant="ghost" size="icon" onClick={() => removeItem(index)}>×</Button>
                        )}
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addItem}>
                    + Agregar Trabajo
                  </Button>
                </div>
              </div>

              <div>
                <Label>Notas</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observaciones adicionales..."
                />
              </div>

              <Button onClick={createWorkOrder} className="w-full" data-testid="create-work-order-btn">
                Crear Orden de Trabajo
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar orden..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="search-work-orders"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48" data-testid="filter-wo-status">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendiente</SelectItem>
            <SelectItem value="in_progress">En Proceso</SelectItem>
            <SelectItem value="quality_check">Control Calidad</SelectItem>
            <SelectItem value="completed">Completado</SelectItem>
            <SelectItem value="delivered">Entregado</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Work Orders Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Orden</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Vehículo</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Técnico</TableHead>
                <TableHead>Tiempo</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No hay órdenes para mostrar
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map(order => {
                  const workOrderId = order.work_order_id || "";
                  const priorityLabel = order.priority ? order.priority.toUpperCase() : "N/A";
                  return (
                    <TableRow key={workOrderId || order.customer_name || Math.random()} data-testid={`wo-row-${workOrderId || "unknown"}`}>
                      <TableCell className="font-mono font-medium">
                        {workOrderId ? `#${workOrderId.slice(-6).toUpperCase()}` : "—"}
                      </TableCell>
                      <TableCell>{order.customer_name || "—"}</TableCell>
                      <TableCell className="text-sm">{order.vehicle_info || "—"}</TableCell>
                      <TableCell>
                        <Badge className={getPriorityColor(order.priority || "normal")}>
                          {priorityLabel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(order.status || "pending")}>
                          {WORK_ORDER_STATUS[order.status] || "Pendiente"}
                        </Badge>
                      </TableCell>
                      <TableCell>{order.technician_name || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3" />
                          {order.actual_time || order.estimated_time || 0} min
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setShowDetails(order)}
                            data-testid={`wo-details-${workOrderId || "unknown"}`}
                          >
                            <Wrench className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => workOrderId && printWorkOrder(workOrderId)}
                            data-testid={`wo-print-${workOrderId || "unknown"}`}
                          >
                            <Printer className="h-4 w-4" />
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

      {/* Details Dialog */}
      <Dialog open={!!showDetails} onOpenChange={() => setShowDetails(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Detalles de Orden {showDetails?.work_order_id ? `#${showDetails.work_order_id.slice(-6).toUpperCase()}` : "#—"}
            </DialogTitle>
          </DialogHeader>
          {showDetails && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Cliente</Label>
                  <p className="font-medium">{showDetails.customer_name || "—"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Vehículo</Label>
                  <p className="font-medium">{showDetails.vehicle_info || "—"}</p>
                </div>
              </div>
              
              <div>
                <Label className="text-muted-foreground">Trabajos</Label>
                <ul className="list-none mt-1 space-y-2">
                  {(showDetails.items || []).map((item, idx) => (
                    <li key={idx} className="flex items-center gap-3">
                      {item.image ? (
                        <img src={item.image} alt={`detalle-${idx}`} className="w-28 h-28 object-cover rounded" />
                      ) : (
                        <div className="w-16 h-16 bg-muted rounded" />
                      )}
                      <span>{item.description || "Trabajo"}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {showDetails.notes && (
                <div>
                  <Label className="text-muted-foreground">Notas</Label>
                  <p>{showDetails.notes}</p>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                {showDetails.status === "pending" && (
                  <Button onClick={() => updateStatus(showDetails.work_order_id, "in_progress")} className="flex-1">
                    Iniciar Trabajo
                  </Button>
                )}
                {showDetails.status === "in_progress" && (
                  <Button onClick={() => updateStatus(showDetails.work_order_id, "quality_check")} className="flex-1">
                    Enviar a Control
                  </Button>
                )}
                {showDetails.status === "quality_check" && canApproveCompleted && (
                  <Button onClick={() => updateStatus(showDetails.work_order_id, "completed")} className="flex-1">
                    Aprobar (Coordinador)
                  </Button>
                )}
                {showDetails.status === "quality_check" && !canApproveCompleted && (
                  <p className="flex-1 text-sm text-muted-foreground text-center py-2">
                    Pendiente de aprobación del coordinador de instalaciones
                  </p>
                )}
                {showDetails.status === "completed" && (
                  <Button onClick={() => updateStatus(showDetails.work_order_id, "delivered")} className="flex-1">
                    Entregar
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
