import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { formatDate } from "../lib/utils";
import { API_BASE as API } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { ScrollArea } from "../components/ui/scroll-area";
import { toast } from "sonner";
import { 
  ClipboardCheck, Star, RefreshCw, CheckCircle2, XCircle, 
  TrendingUp, Users, AlertTriangle, Eye, Sparkles
} from "lucide-react";

// Star Rating Component
function StarRating({ value, onChange, disabled = false }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => !disabled && onChange(star)}
          disabled={disabled}
          className={`p-1 transition-colors ${disabled ? "cursor-default" : "cursor-pointer hover:scale-110"}`}
        >
          <Star
            className={`h-6 w-6 ${
              star <= value
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export function QualityControlPage() {
  const [activeTab, setActiveTab] = useState("pending");
  const [pendingOrders, setPendingOrders] = useState([]);
  const [qcRecords, setQcRecords] = useState([]);
  const [technicianStats, setTechnicianStats] = useState([]);
  const [checklistTemplate, setChecklistTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // QC Form state
  const [showQCForm, setShowQCForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [qcForm, setQcForm] = useState({
    overall_rating: 3,
    cleanliness_rating: 3,
    functionality_rating: 3,
    finish_rating: 3,
    safety_rating: 3,
    checklist: [],
    comments: "",
    approved: false
  });
  const [submitting, setSubmitting] = useState(false);
  
  // Detail view
  const [showDetail, setShowDetail] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pendingRes, qcRes, statsRes, templateRes] = await Promise.all([
        axios.get(`${API}/quality-control/pending`, { withCredentials: true }),
        axios.get(`${API}/quality-control`, { withCredentials: true }),
        axios.get(`${API}/quality-control/stats/technicians`, { withCredentials: true }),
        axios.get(`${API}/quality-control/checklist-template`, { withCredentials: true })
      ]);
      
      setPendingOrders(pendingRes.data);
      setQcRecords(qcRes.data);
      setTechnicianStats(statsRes.data);
      setChecklistTemplate(templateRes.data);
    } catch (error) {
      toast.error("Error al cargar datos de control de calidad");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openQCForm = (order) => {
    setSelectedOrder(order);
    
    // Initialize checklist from template
    const initialChecklist = [];
    if (checklistTemplate?.categories) {
      checklistTemplate.categories.forEach(cat => {
        cat.items.forEach(item => {
          initialChecklist.push({
            category: cat.name,
            item_name: item,
            passed: true,
            notes: ""
          });
        });
      });
    }
    
    setQcForm({
      overall_rating: 3,
      cleanliness_rating: 3,
      functionality_rating: 3,
      finish_rating: 3,
      safety_rating: 3,
      checklist: initialChecklist,
      comments: "",
      approved: false
    });
    setShowQCForm(true);
  };

  const updateChecklistItem = (index, field, value) => {
    const newChecklist = [...qcForm.checklist];
    newChecklist[index] = { ...newChecklist[index], [field]: value };
    setQcForm({ ...qcForm, checklist: newChecklist });
  };

  const submitQC = async () => {
    if (!selectedOrder) return;
    
    setSubmitting(true);
    try {
      await axios.post(`${API}/quality-control`, {
        work_order_id: selectedOrder.work_order_id,
        overall_rating: qcForm.overall_rating,
        cleanliness_rating: qcForm.cleanliness_rating,
        functionality_rating: qcForm.functionality_rating,
        finish_rating: qcForm.finish_rating,
        safety_rating: qcForm.safety_rating,
        checklist: qcForm.checklist,
        comments: qcForm.comments,
        approved: qcForm.approved,
        photos: []
      }, { withCredentials: true });
      
      toast.success(qcForm.approved ? "Inspección aprobada" : "Inspección registrada - Requiere correcciones");
      setShowQCForm(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al guardar inspección");
    } finally {
      setSubmitting(false);
    }
  };

  const getAverageRating = () => {
    return (
      (qcForm.overall_rating + qcForm.cleanliness_rating + qcForm.functionality_rating + 
       qcForm.finish_rating + qcForm.safety_rating) / 5
    ).toFixed(1);
  };

  const getPassedCount = () => {
    return qcForm.checklist.filter(item => item.passed).length;
  };

  return (
    <div className="p-6 space-y-6" data-testid="quality-control-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Control de Calidad</h1>
          <p className="text-muted-foreground">
            Aprobación final de instalaciones y trabajos eléctricos por el coordinador
          </p>
        </div>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">PENDIENTES</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold text-orange-500">{pendingOrders.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">INSPECCIONADOS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold">{qcRecords.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">APROBADOS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold text-green-500">
              {qcRecords.filter(qc => qc.approved).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">RATING PROMEDIO</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold flex items-center gap-2">
              {qcRecords.length > 0 
                ? (qcRecords.reduce((sum, qc) => sum + (qc.average_rating || qc.overall_rating), 0) / qcRecords.length).toFixed(1)
                : "N/A"}
              <Star className="h-6 w-6 fill-yellow-400 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Pendientes ({pendingOrders.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Historial
          </TabsTrigger>
          <TabsTrigger value="technicians" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Rendimiento
          </TabsTrigger>
        </TabsList>

        {/* Pending Tab */}
        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Órdenes Pendientes de Inspección</CardTitle>
              <CardDescription>Instalaciones completadas esperando control de calidad</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : pendingOrders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p>No hay órdenes pendientes de inspección</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Orden</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Vehículo</TableHead>
                      <TableHead>Técnico</TableHead>
                      <TableHead>Completada</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingOrders.map(order => (
                      <TableRow key={order.work_order_id} data-testid={`pending-${order.work_order_id}`}>
                        <TableCell className="font-mono">{order.work_order_id}</TableCell>
                        <TableCell>{order.customer_name}</TableCell>
                        <TableCell>{order.vehicle_info}</TableCell>
                        <TableCell>{order.technician_name || "Sin asignar"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {order.end_time ? formatDate(order.end_time) : "-"}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" onClick={() => openQCForm(order)} data-testid={`inspect-${order.work_order_id}`}>
                            <ClipboardCheck className="h-4 w-4 mr-2" />
                            Inspeccionar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Inspecciones</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Orden</TableHead>
                    <TableHead>Técnico</TableHead>
                    <TableHead>Inspector</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {qcRecords.map(qc => (
                    <TableRow key={qc.qc_id}>
                      <TableCell className="font-mono text-xs">{qc.qc_id}</TableCell>
                      <TableCell className="font-mono text-xs">{qc.work_order_id}</TableCell>
                      <TableCell>{qc.technician_name}</TableCell>
                      <TableCell>{qc.inspector_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-mono">{qc.average_rating || qc.overall_rating}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {qc.approved ? (
                          <Badge className="bg-green-500">Aprobado</Badge>
                        ) : (
                          <Badge variant="destructive">Rechazado</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(qc.created_at)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => setShowDetail(qc)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Technicians Performance Tab */}
        <TabsContent value="technicians">
          <Card>
            <CardHeader>
              <CardTitle>Rendimiento por Técnico</CardTitle>
              <CardDescription>Estadísticas de calidad por instalador</CardDescription>
            </CardHeader>
            <CardContent>
              {technicianStats.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4" />
                  <p>No hay datos de rendimiento aún</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Técnico</TableHead>
                      <TableHead className="text-center">Inspecciones</TableHead>
                      <TableHead className="text-center">Aprobados</TableHead>
                      <TableHead className="text-center">Rechazados</TableHead>
                      <TableHead className="text-center">% Aprobación</TableHead>
                      <TableHead className="text-center">Rating Promedio</TableHead>
                      <TableHead>Detalles</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {technicianStats.map((tech, idx) => (
                      <TableRow key={tech.technician_id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {idx === 0 && <Sparkles className="h-4 w-4 text-yellow-500" />}
                            <span className="font-medium">{tech.technician_name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono">{tech.total_inspections}</TableCell>
                        <TableCell className="text-center font-mono text-green-600">{tech.approved_count}</TableCell>
                        <TableCell className="text-center font-mono text-red-600">{tech.rejected_count}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={tech.approval_rate >= 80 ? "default" : tech.approval_rate >= 60 ? "secondary" : "destructive"}>
                            {tech.approval_rate}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span className="font-mono font-bold">{tech.average_rating}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-muted-foreground">
                            <div>Limpieza: {tech.ratings?.cleanliness}</div>
                            <div>Funcionamiento: {tech.ratings?.functionality}</div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* QC Form Dialog */}
      <Dialog open={showQCForm} onOpenChange={setShowQCForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Inspección de Calidad</DialogTitle>
            <DialogDescription>
              {selectedOrder && `Orden: ${selectedOrder.work_order_id} - ${selectedOrder.customer_name}`}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[70vh] pr-4">
            <div className="space-y-6">
              {/* Order Info */}
              {selectedOrder && (
                <Card className="bg-muted/30">
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><span className="text-muted-foreground">Vehículo:</span> {selectedOrder.vehicle_info}</div>
                      <div><span className="text-muted-foreground">Técnico:</span> {selectedOrder.technician_name || "Sin asignar"}</div>
                      <div><span className="text-muted-foreground">Tiempo:</span> {selectedOrder.actual_time || selectedOrder.estimated_time} min</div>
                      <div><span className="text-muted-foreground">Items:</span> {selectedOrder.items?.length || 0}</div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Ratings */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label className="mb-2 block">Calificación General</Label>
                  <StarRating value={qcForm.overall_rating} onChange={(v) => setQcForm({...qcForm, overall_rating: v})} />
                </div>
                <div>
                  <Label className="mb-2 block">Limpieza</Label>
                  <StarRating value={qcForm.cleanliness_rating} onChange={(v) => setQcForm({...qcForm, cleanliness_rating: v})} />
                </div>
                <div>
                  <Label className="mb-2 block">Funcionamiento</Label>
                  <StarRating value={qcForm.functionality_rating} onChange={(v) => setQcForm({...qcForm, functionality_rating: v})} />
                </div>
                <div>
                  <Label className="mb-2 block">Acabados</Label>
                  <StarRating value={qcForm.finish_rating} onChange={(v) => setQcForm({...qcForm, finish_rating: v})} />
                </div>
                <div>
                  <Label className="mb-2 block">Seguridad</Label>
                  <StarRating value={qcForm.safety_rating} onChange={(v) => setQcForm({...qcForm, safety_rating: v})} />
                </div>
                <div className="flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Promedio</p>
                    <p className="text-3xl font-bold">{getAverageRating()}</p>
                  </div>
                </div>
              </div>

              {/* Checklist */}
              <div>
                <Label className="mb-3 block">Lista de Verificación ({getPassedCount()}/{qcForm.checklist.length})</Label>
                {checklistTemplate?.categories.map((category, catIdx) => (
                  <div key={catIdx} className="mb-4">
                    <h4 className="font-medium text-sm mb-2">{category.name}</h4>
                    <div className="space-y-2 pl-4">
                      {category.items.map((item, itemIdx) => {
                        const checklistIndex = qcForm.checklist.findIndex(
                          c => c.category === category.name && c.item_name === item
                        );
                        const checklistItem = qcForm.checklist[checklistIndex];
                        
                        return (
                          <div key={itemIdx} className="flex items-center gap-3">
                            <Checkbox
                              checked={checklistItem?.passed ?? true}
                              onCheckedChange={(checked) => updateChecklistItem(checklistIndex, "passed", checked)}
                            />
                            <span className={`text-sm ${!checklistItem?.passed ? "text-red-500" : ""}`}>
                              {item}
                            </span>
                            {!checklistItem?.passed && (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Comments */}
              <div>
                <Label className="mb-2 block">Comentarios / Observaciones</Label>
                <Textarea
                  value={qcForm.comments}
                  onChange={(e) => setQcForm({...qcForm, comments: e.target.value})}
                  placeholder="Ingresa observaciones o notas adicionales..."
                  rows={4}
                />
              </div>

              {/* Approval */}
              <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/30">
                <Checkbox
                  id="approved"
                  checked={qcForm.approved}
                  onCheckedChange={(checked) => setQcForm({...qcForm, approved: checked})}
                />
                <Label htmlFor="approved" className="cursor-pointer">
                  <span className="font-medium">Aprobar Instalación</span>
                  <p className="text-sm text-muted-foreground">
                    Marcar como aprobada y cambiar estado a Completada
                  </p>
                </Label>
              </div>
            </div>
          </ScrollArea>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowQCForm(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={submitQC} 
              disabled={submitting}
              className={qcForm.approved ? "bg-green-600 hover:bg-green-700" : ""}
              data-testid="submit-qc"
            >
              {submitting ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : qcForm.approved ? (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              {qcForm.approved ? "Aprobar" : "Registrar (No Aprobado)"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail View Dialog */}
      <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle de Inspección</DialogTitle>
          </DialogHeader>
          {showDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">ID:</span> {showDetail.qc_id}</div>
                <div><span className="text-muted-foreground">Orden:</span> {showDetail.work_order_id}</div>
                <div><span className="text-muted-foreground">Técnico:</span> {showDetail.technician_name}</div>
                <div><span className="text-muted-foreground">Inspector:</span> {showDetail.inspector_name}</div>
                <div><span className="text-muted-foreground">Fecha:</span> {formatDate(showDetail.created_at)}</div>
                <div>
                  <span className="text-muted-foreground">Estado:</span>{" "}
                  {showDetail.approved ? (
                    <Badge className="bg-green-500">Aprobado</Badge>
                  ) : (
                    <Badge variant="destructive">Rechazado</Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-5 gap-4 p-4 bg-muted/30 rounded-lg">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">General</p>
                  <div className="flex items-center justify-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-bold">{showDetail.overall_rating}</span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Limpieza</p>
                  <div className="flex items-center justify-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-bold">{showDetail.cleanliness_rating}</span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Función</p>
                  <div className="flex items-center justify-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-bold">{showDetail.functionality_rating}</span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Acabados</p>
                  <div className="flex items-center justify-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-bold">{showDetail.finish_rating}</span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Seguridad</p>
                  <div className="flex items-center justify-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-bold">{showDetail.safety_rating}</span>
                  </div>
                </div>
              </div>

              {showDetail.comments && (
                <div>
                  <Label className="text-muted-foreground">Comentarios:</Label>
                  <p className="mt-1">{showDetail.comments}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
