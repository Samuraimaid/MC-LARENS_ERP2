import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { formatCurrency } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { ContextualDialogHeader } from "../components/ui/contextual-dialog-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { toast } from "sonner";
import { 
  Truck, Search, RefreshCw, MapPin, Phone, User,
  Clock, CheckCircle2, XCircle, AlertCircle, Play, Navigation, Activity
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LiveFleetTrackingRadar } from "@/components/delivery/LiveFleetTrackingRadar";
import { API_BASE as API } from "@/lib/api";

const DELIVERY_STATUSES = {
  pending: { label: "Pendiente", color: "bg-yellow-500", icon: Clock },
  assigned: { label: "Asignado", color: "bg-blue-500", icon: User },
  in_transit: { label: "En Tránsito", color: "bg-purple-500", icon: Navigation },
  delivered: { label: "Entregado", color: "bg-green-500", icon: CheckCircle2 },
  failed: { label: "Fallido", color: "bg-red-500", icon: XCircle },
};

export function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [activeTab, setActiveTab] = useState("list");
  const [showAssign, setShowAssign] = useState(null);
  const [showUpdate, setShowUpdate] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState("");
  const [updateNotes, setUpdateNotes] = useState("");
  const [updateStatus, setUpdateStatus] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.append("status", filterStatus);

      const [deliveriesRes, driversRes] = await Promise.all([
        axios.get(`${API}/deliveries?${params}`, { withCredentials: true }),
        axios.get(`${API}/deliveries/drivers`, { withCredentials: true }),
      ]);
      setDeliveries(deliveriesRes.data);
      setDrivers(driversRes.data);
    } catch (error) {
      toast.error("Error al cargar entregas");
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const assignDriver = async () => {
    if (!showAssign || !selectedDriver) return;
    try {
      await axios.post(
        `${API}/deliveries/${showAssign.sale_id}/assign?driver_id=${selectedDriver}`,
        {},
        { withCredentials: true }
      );
      toast.success("Conductor asignado");
      setShowAssign(null);
      setSelectedDriver("");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al asignar conductor");
    }
  };

  const updateDelivery = async () => {
    if (!showUpdate || !updateStatus) return;
    try {
      await axios.put(
        `${API}/deliveries/${showUpdate.sale_id}`,
        {
          status: updateStatus,
          notes: updateNotes || null,
        },
        { withCredentials: true }
      );
      toast.success("Entrega actualizada");
      setShowUpdate(null);
      setUpdateStatus("");
      setUpdateNotes("");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al actualizar entrega");
    }
  };

  const startDelivery = async (delivery) => {
    try {
      await axios.put(
        `${API}/deliveries/${delivery.sale_id}`,
        { status: "in_transit" },
        { withCredentials: true }
      );
      toast.success("Entrega iniciada");
      fetchData();
    } catch (error) {
      toast.error("Error al iniciar entrega");
    }
  };

  const completeDelivery = async (delivery) => {
    try {
      await axios.put(
        `${API}/deliveries/${delivery.sale_id}`,
        { status: "delivered" },
        { withCredentials: true }
      );
      toast.success("Entrega completada");
      fetchData();
    } catch (error) {
      toast.error("Error al completar entrega");
    }
  };

  const filteredDeliveries = deliveries.filter(d => {
    const searchLower = search.toLowerCase();
    return (
      d.customer_name?.toLowerCase().includes(searchLower) ||
      d.invoice_number?.toLowerCase().includes(searchLower) ||
      d.delivery_address?.toLowerCase().includes(searchLower)
    );
  });

  const getStats = () => {
    return {
      pending: deliveries.filter(d => d.delivery_status === "pending").length,
      assigned: deliveries.filter(d => d.delivery_status === "assigned").length,
      in_transit: deliveries.filter(d => d.delivery_status === "in_transit").length,
      delivered: deliveries.filter(d => d.delivery_status === "delivered").length,
    };
  };

  const stats = getStats();

  return (
    <div className="p-6 space-y-6" data-testid="deliveries-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Entregas y Logística</h1>
          <p className="text-muted-foreground">Gestión de entregas a domicilio y monitoreo GPS de flota en tiempo real</p>
        </div>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="list" className="gap-2">
            <Truck className="h-4 w-4" />
            Pedidos de Entrega
          </TabsTrigger>
          <TabsTrigger value="radar" className="gap-2">
            <Activity className="h-4 w-4 text-sky-500" />
            Radar GPS en Vivo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="radar" className="space-y-4">
          <LiveFleetTrackingRadar height="620px" />
        </TabsContent>

        <TabsContent value="list" className="space-y-6">
          {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="cursor-pointer hover:border-primary/50 transition" onClick={() => setFilterStatus("pending")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              PENDIENTES
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold text-yellow-500">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition" onClick={() => setFilterStatus("assigned")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <User className="h-4 w-4 text-blue-500" />
              ASIGNADAS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold text-blue-500">{stats.assigned}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition" onClick={() => setFilterStatus("in_transit")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Truck className="h-4 w-4 text-purple-500" />
              EN TRÁNSITO
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold text-purple-500">{stats.in_transit}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition" onClick={() => setFilterStatus("delivered")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              ENTREGADAS HOY
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold text-green-500">{stats.delivered}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, factura o dirección..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="search-deliveries"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48" data-testid="filter-status">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los Estados</SelectItem>
            {Object.entries(DELIVERY_STATUSES).map(([key, status]) => (
              <SelectItem key={key} value={key}>{status.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Deliveries Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Factura</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>Conductor</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filteredDeliveries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No hay entregas para mostrar
                  </TableCell>
                </TableRow>
              ) : (
                filteredDeliveries.map(delivery => {
                  const status = DELIVERY_STATUSES[delivery.delivery_status] || DELIVERY_STATUSES.pending;
                  const StatusIcon = status.icon;
                  
                  return (
                    <TableRow key={delivery.sale_id} data-testid={`delivery-row-${delivery.sale_id}`}>
                      <TableCell className="font-mono">{delivery.invoice_number}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{delivery.customer_name}</p>
                          {delivery.customer?.phone && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {delivery.customer.phone}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-start gap-1 max-w-xs">
                          <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                          <span className="text-sm">{delivery.delivery_address || "Sin dirección"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {delivery.delivery_driver_name ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback>{delivery.delivery_driver_name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{delivery.delivery_driver_name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Sin asignar</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono font-medium">
                        {formatCurrency(delivery.total)}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${status.color} text-white gap-1`}>
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {delivery.delivery_status === "pending" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowAssign(delivery)}
                              data-testid={`assign-btn-${delivery.sale_id}`}
                            >
                              <User className="h-4 w-4 mr-1" />
                              Asignar
                            </Button>
                          )}
                          {delivery.delivery_status === "assigned" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => startDelivery(delivery)}
                              data-testid={`start-btn-${delivery.sale_id}`}
                            >
                              <Play className="h-4 w-4 mr-1" />
                              Iniciar
                            </Button>
                          )}
                          {delivery.delivery_status === "in_transit" && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => completeDelivery(delivery)}
                              data-testid={`complete-btn-${delivery.sale_id}`}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Entregar
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setShowUpdate(delivery);
                              setUpdateStatus(delivery.delivery_status);
                            }}
                          >
                            <AlertCircle className="h-4 w-4" />
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
      </TabsContent>
      </Tabs>

      {/* Assign Driver Dialog */}
      <Dialog open={!!showAssign} onOpenChange={() => setShowAssign(null)}>
        <DialogContent>
          <ContextualDialogHeader
            variant="information"
            size="inline"
            title="Asignar Conductor"
            description="Selecciona el conductor que realizará esta entrega."
          />
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium">{showAssign?.customer_name}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <MapPin className="h-3 w-3" />
                {showAssign?.delivery_address}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Factura: {showAssign?.invoice_number}
              </p>
            </div>
            
            <div>
              <Label>Seleccionar Conductor</Label>
              <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                <SelectTrigger data-testid="select-driver">
                  <SelectValue placeholder="Seleccionar conductor" />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map(driver => (
                    <SelectItem key={driver.user_id} value={driver.user_id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={driver.picture} />
                          <AvatarFallback>{driver.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        {driver.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Button onClick={assignDriver} className="w-full" data-testid="confirm-assign-btn">
              <Truck className="h-4 w-4 mr-2" />
              Asignar Conductor
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Update Status Dialog */}
      <Dialog open={!!showUpdate} onOpenChange={() => setShowUpdate(null)}>
        <DialogContent>
          <ContextualDialogHeader
            variant="question"
            size="inline"
            title="Actualizar Estado de Entrega"
            description="Cambia el estado y, si aplica, agrega notas del recorrido."
          />
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium">{showUpdate?.customer_name}</p>
              <p className="text-sm text-muted-foreground">
                Factura: {showUpdate?.invoice_number}
              </p>
            </div>
            
            <div>
              <Label>Nuevo Estado</Label>
              <Select value={updateStatus} onValueChange={setUpdateStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DELIVERY_STATUSES).map(([key, status]) => (
                    <SelectItem key={key} value={key}>{status.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Notas (opcional)</Label>
              <Textarea
                value={updateNotes}
                onChange={(e) => setUpdateNotes(e.target.value)}
                placeholder="Agregar notas sobre la entrega..."
                rows={3}
              />
            </div>
            
            <Button onClick={updateDelivery} className="w-full">
              Actualizar Estado
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
