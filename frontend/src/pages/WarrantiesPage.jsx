import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { formatDate } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Progress } from "../components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { toast } from "sonner";
import { 
  Search, RefreshCw, Shield, Car, Package, 
  CheckCircle2, Clock, Plus, XCircle, Barcode, FileText, Download, Copy } from "lucide-react";
import { API_BASE as API } from "@/lib/api";
import { useListDensity } from "@/hooks/useListDensity";
import { ListDensityToggle } from "@/components/lists/ListDensityToggle";
import { BackToTopButton } from "@/components/lists/BackToTopButton";
import { Checkbox } from "@/components/ui/checkbox";
import { ListSelectionBar } from "@/components/lists/ListSelectionBar";
import { useListSelection } from "@/hooks/useListSelection";
import { useListScrollRestore } from "@/hooks/useListScrollRestore";
import { downloadCsv, copyTextToClipboard } from "@/components/lists/listBulkUtils";

const CLAIM_STATUSES = {
  pending: { label: "Pendiente", color: "bg-yellow-500", icon: Clock },
  approved: { label: "Aprobado", color: "bg-blue-500", icon: CheckCircle2 },
  in_repair: { label: "En Reparación", color: "bg-purple-500", icon: Package },
  completed: { label: "Completado", color: "bg-green-500", icon: CheckCircle2 },
  denied: { label: "Denegado", color: "bg-red-500", icon: XCircle },
};

export function WarrantiesPage() {
  const { density: listDensity, setDensity: setListDensity, tokens: densityTok } = useListDensity();
  const selection = useListSelection();
  const scrollRestore = useListScrollRestore({ pageKey: "warranties" });

  const [claims, setClaims] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showNewClaim, setShowNewClaim] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [vehicleWarranties, setVehicleWarranties] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [issueDescription, setIssueDescription] = useState("");
  const [showVehicleDetail, setShowVehicleDetail] = useState(null);
  const [scanCode, setScanCode] = useState("");
  const [invoiceLookup, setInvoiceLookup] = useState(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [claimType, setClaimType] = useState("replacement");

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.append("status", filterStatus);
      
      const res = await axios.get(`${API}/warranties/claims?${params}`, { withCredentials: true });
      setClaims(res.data);
    } catch (error) {
      toast.error("Error al cargar reclamos");
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  const searchVehicles = async (term) => {
    if (!term || term.length < 2) return;
    try {
      const res = await axios.get(`${API}/vehicles?search=${term}`, { withCredentials: true });
      setVehicles(res.data.slice(0, 10));
    } catch (error) {
      console.error("Error:", error);
    }
  };

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  const selectVehicle = async (vehicle) => {
    setSelectedVehicle(vehicle);
    try {
      const res = await axios.get(`${API}/warranties/vehicle/${vehicle.vehicle_id}`, { withCredentials: true });
      setVehicleWarranties(res.data);
    } catch (error) {
      toast.error("Error al cargar garantías del vehículo");
    }
  };



  const lookupInvoiceByScan = async (rawCode = scanCode) => {
    const code = String(rawCode || "").trim();
    if (!code) {
      toast.error("Ingresa o escanea un código de factura");
      return;
    }
    setScanLoading(true);
    try {
      const res = await axios.get(`${API}/warranties/lookup`, {
        params: { code },
        withCredentials: true,
      });
      setInvoiceLookup(res.data);
      setSelectedProduct(null);
      setIssueDescription("");
      toast.success(`Factura ${res.data?.invoice_number || ""} localizada`);
    } catch (error) {
      setInvoiceLookup(null);
      toast.error(error.response?.data?.detail || "No se encontró la factura");
    } finally {
      setScanLoading(false);
    }
  };

  const createClaimFromLookup = async (productRow) => {
    if (!invoiceLookup || !productRow) return;
    if (!issueDescription.trim()) {
      toast.error("Describe el problema antes de registrar el reclamo");
      return;
    }
    try {
      await axios.post(
        `${API}/warranties/claim`,
        {
          sale_id: invoiceLookup.sale_id,
          product_id: productRow.product_id,
          vehicle_id: invoiceLookup.vehicle?.vehicle_id || null,
          issue_description: issueDescription,
          claim_type: claimType,
          warehouse_id: productRow.warehouse_id || null,
          quantity: 1,
        },
        { withCredentials: true },
      );
      toast.success("Reclamo registrado con ajuste de inventario");
      setIssueDescription("");
      setSelectedProduct(null);
      setInvoiceLookup(null);
      setScanCode("");
      fetchClaims();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al crear reclamo");
    }
  };

  const createClaim = async () => {
    if (!selectedProduct || !issueDescription) {
      toast.error("Selecciona un producto y describe el problema");
      return;
    }

    try {
      await axios.post(
        `${API}/warranties/claim`,
        {
          sale_id: selectedProduct.sale_id,
          product_id: selectedProduct.product_id,
          vehicle_id: selectedVehicle?.vehicle_id || null,
          issue_description: issueDescription,
          claim_type: claimType,
          warehouse_id: selectedProduct.warehouse_id || null,
          quantity: 1,
        },
        { withCredentials: true },
      );
      
      toast.success("Reclamo de garantía creado");
      setShowNewClaim(false);
      setSelectedVehicle(null);
      setVehicleWarranties(null);
      setSelectedProduct(null);
      setIssueDescription("");
      fetchClaims();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al crear reclamo");
    }
  };

  const updateClaimStatus = async (claimId, status, resolution = null) => {
    try {
      const updates = { status };
      if (resolution) updates.resolution = resolution;
      
      await axios.put(`${API}/warranties/claims/${claimId}`, updates, { withCredentials: true });
      toast.success("Reclamo actualizado");
      fetchClaims();
    } catch (error) {
      toast.error("Error al actualizar reclamo");
    }
  };

  const filteredClaims = claims.filter(c =>
    c.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.product_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.vehicle_info?.toLowerCase().includes(search.toLowerCase())
  );

  const visibleIds = filteredClaims.map((item) => item.claim_id);
  const selectedRows = filteredClaims.filter((item) => selection.isSelected(item.claim_id));
  const exportSelectedCsv = () => {
    const rowsSrc = selectedRows.length ? selectedRows : filteredClaims;
    if (!rowsSrc.length) { toast.error("No hay filas para exportar"); return; }
    downloadCsv(
      `garantias_${new Date().toISOString().slice(0, 10)}.csv`,
      ["claim_id","cliente","vehiculo","producto","estado"],
      rowsSrc.map((c) => [c.claim_id, c.customer_name, c.vehicle_plate || c.vehicle_id, c.product_name, c.status])
    );
    toast.success(`CSV exportado (${rowsSrc.length})`);
  };
  const copySelectedIds = async () => {
    if (!selectedRows.length) { toast.error("Selecciona al menos una fila"); return; }
    try {
      await copyTextToClipboard(selectedRows.map((item) => item.claim_id).filter(Boolean).join(", "));
      toast.success("IDs copiados");
    } catch {
      toast.error("No se pudo copiar");
    }
  };


  const getStats = () => ({
    pending: claims.filter(c => c.status === "pending").length,
    in_repair: claims.filter(c => c.status === "in_repair").length,
    completed: claims.filter(c => c.status === "completed").length,
    denied: claims.filter(c => c.status === "denied").length,
  });

  const stats = getStats();

  return (
    <div className="p-6 space-y-6" data-testid="warranties-page">
      <div className="flex justify-end mb-2">
        <ListDensityToggle value={listDensity} onChange={setListDensity} testId="warranties-list-density" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl mb-1 font-bold tracking-tight md:mb-0 md:text-3xl">Garantías</h1>
          <p className="hidden text-muted-foreground md:block">Gestión de garantías y reclamos</p>
        </div>
        <Dialog open={showNewClaim} onOpenChange={setShowNewClaim}>
          <DialogTrigger asChild>
            <Button data-testid="new-claim-btn">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Reclamo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nuevo Reclamo de Garantía</DialogTitle>
              <DialogDescription>Busca el vehículo y selecciona el producto en garantía</DialogDescription>
            </DialogHeader>
            
            {!selectedVehicle ? (
              <div className="space-y-4">
                <div>
                  <Label>Buscar Vehículo</Label>
                  <Input
                    placeholder="Placa, marca o modelo..."
                    onChange={(e) => searchVehicles(e.target.value)}
                  />
                </div>
                {vehicles.length > 0 && (
                  <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                    {vehicles.map(v => (
                      <div
                        key={v.vehicle_id}
                        className="p-3 hover:bg-muted cursor-pointer flex items-center gap-3"
                        onClick={() => selectVehicle(v)}
                      >
                        <Car className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{v.brand} {v.model} {v.year}</p>
                          <p className="text-sm text-muted-foreground">Placa: {v.plate}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Car className="h-8 w-8" />
                    <div>
                      <p className="font-medium">
                        {selectedVehicle.brand} {selectedVehicle.model} {selectedVehicle.year}
                      </p>
                      <p className="text-sm text-muted-foreground">Placa: {selectedVehicle.plate}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => {
                    setSelectedVehicle(null);
                    setVehicleWarranties(null);
                    setSelectedProduct(null);
                  }}>
                    Cambiar
                  </Button>
                </div>

                {vehicleWarranties && (
                  <>
                    <div>
                      <Label>Productos con Garantía Activa</Label>
                      <div className="border rounded-lg mt-2 divide-y max-h-48 overflow-y-auto">
                        {vehicleWarranties.warranty_items
                          .filter(item => item.is_warranty_active)
                          .map((item, idx) => (
                            <div
                              key={idx}
                              className={`p-3 cursor-pointer hover:bg-muted ${
                                selectedProduct?.product_id === item.product_id && 
                                selectedProduct?.sale_id === item.sale_id 
                                  ? 'bg-primary/10 border-l-4 border-primary' 
                                  : ''
                              }`}
                              onClick={() => setSelectedProduct(item)}
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium">{item.product_name}</p>
                                  <p className="text-sm text-muted-foreground">
                                    Factura: {item.invoice_number}
                                  </p>
                                </div>
                                <Badge variant="outline" className="text-green-600">
                                  {item.days_remaining} días restantes
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Comprado: {formatDate(item.purchase_date)}
                              </p>
                            </div>
                          ))}
                        {vehicleWarranties.warranty_items.filter(i => i.is_warranty_active).length === 0 && (
                          <div className="p-4 text-center text-muted-foreground">
                            No hay productos con garantía activa
                          </div>
                        )}
                      </div>
                    </div>

                    {selectedProduct && (
                      <div>
                        <Label>Descripción del Problema *</Label>
                        <Textarea
                          value={issueDescription}
                          onChange={(e) => setIssueDescription(e.target.value)}
                          placeholder="Describe el problema o defecto del producto..."
                          rows={3}
                        />
                      </div>
                    )}

                    <Button 
                      onClick={createClaim} 
                      className="w-full"
                      disabled={!selectedProduct || !issueDescription}
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      Crear Reclamo de Garantía
                    </Button>
                  </>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Barcode className="h-5 w-5" />
            Búsqueda rápida por escáner
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 md:flex-row">
            <Input
              value={scanCode}
              onChange={(e) => setScanCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") lookupInvoiceByScan(e.currentTarget.value);
              }}
              placeholder="Escanea barcode o QR (INV-YYYYMMDD-#### / JSON / URL)"
              data-testid="warranty-scan-input"
            />
            <Button onClick={() => lookupInvoiceByScan()} disabled={scanLoading}>
              <Search className="h-4 w-4 mr-2" />
              {scanLoading ? "Buscando..." : "Buscar factura"}
            </Button>
          </div>

          {invoiceLookup ? (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {invoiceLookup.invoice_number}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Cliente: {invoiceLookup.customer?.name || "—"} · Venta: {formatDate(invoiceLookup.created_at)}
                  </p>
                </div>
                <Badge variant="outline">{invoiceLookup.eligible_count} productos en garantía</Badge>
              </div>

              <div className="space-y-2">
                <Label>Tipo de reclamo</Label>
                <Select value={claimType} onValueChange={setClaimType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="replacement">Cambio físico (reemplazo)</SelectItem>
                    <SelectItem value="repair">Reparación (sin stock)</SelectItem>
                    <SelectItem value="devolucion">Devolución</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Descripción del problema</Label>
                <Textarea
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  placeholder="Detalle del defecto o falla..."
                  rows={2}
                />
              </div>

              <div className="divide-y rounded-md border bg-background">
                {(invoiceLookup.eligible_items || []).map((item) => (
                  <div key={`${item.sale_id}-${item.product_id}`} className="flex flex-wrap items-center justify-between gap-2 p-3">
                    <div>
                      <p className="font-medium">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.installation_note ? `${item.installation_note} · ` : ""}
                        Garantía: {item.warranty_months} meses · {item.days_remaining} días restantes
                      </p>
                    </div>
                    <Button size="sm" onClick={() => createClaimFromLookup(item)}>
                      <Shield className="h-4 w-4 mr-1" />
                      Registrar reclamo
                    </Button>
                  </div>
                ))}
                {(invoiceLookup.eligible_items || []).length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">No hay productos con garantía vigente en esta factura.</p>
                ) : null}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4 text-purple-500" />
              EN REPARACIÓN
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold text-purple-500">{stats.in_repair}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              COMPLETADOS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold text-green-500">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              DENEGADOS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold text-red-500">{stats.denied}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <ListSelectionBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar..."
        selectedCount={selection.count}
        visibleCount={visibleIds.length}
        allVisibleSelected={selection.allVisibleSelected(visibleIds)}
        someVisibleSelected={selection.someVisibleSelected(visibleIds)}
        onSelectAll={() => selection.toggleAllVisible(visibleIds)}
        onDeselectAll={selection.clear}
        testId="warranties-selection-bar"
      >
        <Button type="button" variant="secondary" size="sm" className="h-8" onClick={exportSelectedCsv}>
          <Download className="h-4 w-4 mr-1" /> CSV
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8" disabled={selection.count === 0} onClick={copySelectedIds}>
          <Copy className="h-4 w-4 mr-1" /> Copiar IDs
        </Button>
      </ListSelectionBar>

      <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(CLAIM_STATUSES).map(([key, status]) => (
              <SelectItem key={key} value={key}>{status.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={fetchClaims}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Claims Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className={densityTok.tableRow}>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selection.allVisibleSelected(visibleIds) ? true : selection.someVisibleSelected(visibleIds) ? "indeterminate" : false}
                    onCheckedChange={() => selection.toggleAllVisible(visibleIds)}
                  />
                </TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Vehículo</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Problema</TableHead>
                <TableHead>Garantía</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow className={densityTok.tableRow}>
                  <TableCell colSpan={9} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filteredClaims.length === 0 ? (
                <TableRow className={densityTok.tableRow}>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No hay reclamos de garantía
                  </TableCell>
                </TableRow>
              ) : (
                filteredClaims.map(claim => {
                  const status = CLAIM_STATUSES[claim.status] || CLAIM_STATUSES.pending;
                  const StatusIcon = status.icon;
                  const warrantyEnd = new Date(claim.warranty_end_date);
                  const isExpired = warrantyEnd < new Date();
                  
                  return (
                    <TableRow className={densityTok.tableRow} key={claim.claim_id}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selection.isSelected(claim.claim_id)} onCheckedChange={() => selection.toggle(claim.claim_id)} />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{claim.claim_id}</TableCell>
                      <TableCell>{claim.customer_name}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{claim.vehicle_info}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p className="font-medium">{claim.product_name}</p>
                          <p className="text-muted-foreground">{claim.invoice_number}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm max-w-xs truncate" title={claim.issue_description}>
                          {claim.issue_description}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <p>Vence: {formatDate(claim.warranty_end_date)}</p>
                          {isExpired && (
                            <Badge variant="destructive" className="text-xs mt-1">Vencida</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${status.color} text-white gap-1`}>
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select 
                          value={claim.status} 
                          onValueChange={(v) => updateClaimStatus(claim.claim_id, v)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pendiente</SelectItem>
                            <SelectItem value="approved">Aprobar</SelectItem>
                            <SelectItem value="in_repair">En Reparación</SelectItem>
                            <SelectItem value="completed">Completar</SelectItem>
                            <SelectItem value="denied">Denegar</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Vehicle Warranty Detail Dialog */}
      <Dialog open={!!showVehicleDetail} onOpenChange={() => setShowVehicleDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Historial de Garantías</DialogTitle>
          </DialogHeader>
          {showVehicleDetail && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg flex items-center gap-4">
                <Car className="h-10 w-10" />
                <div>
                  <p className="font-medium text-lg">
                    {showVehicleDetail.vehicle.brand} {showVehicleDetail.vehicle.model} {showVehicleDetail.vehicle.year}
                  </p>
                  <p className="text-muted-foreground">Placa: {showVehicleDetail.vehicle.plate}</p>
                  {showVehicleDetail.customer && (
                    <p className="text-sm">Cliente: {showVehicleDetail.customer.name}</p>
                  )}
                </div>
              </div>

              <Tabs defaultValue="active">
                <TabsList>
                  <TabsTrigger value="active">Garantías Activas</TabsTrigger>
                  <TabsTrigger value="expired">Vencidas</TabsTrigger>
                  <TabsTrigger value="claims">Reclamos</TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="space-y-2">
                  {showVehicleDetail.warranty_items
                    .filter(i => i.is_warranty_active)
                    .map((item, idx) => (
                      <Card key={idx}>
                        <CardContent className="p-4">
                          <div className="flex justify-between">
                            <div>
                              <p className="font-medium">{item.product_name}</p>
                              <p className="text-sm text-muted-foreground">
                                Factura: {item.invoice_number} | Comprado: {formatDate(item.purchase_date)}
                              </p>
                            </div>
                            <div className="text-right">
                              <Badge variant="outline" className="text-green-600">
                                {item.days_remaining} días
                              </Badge>
                              <p className="text-xs text-muted-foreground mt-1">
                                Vence: {formatDate(item.warranty_end_date)}
                              </p>
                            </div>
                          </div>
                          <Progress 
                            value={(item.days_remaining / (item.warranty_months * 30)) * 100} 
                            className="h-1 mt-2" 
                          />
                        </CardContent>
                      </Card>
                    ))}
                  {showVehicleDetail.warranty_items.filter(i => i.is_warranty_active).length === 0 && (
                    <p className="text-center text-muted-foreground py-4">
                      No hay garantías activas
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="expired" className="space-y-2">
                  {showVehicleDetail.warranty_items
                    .filter(i => !i.is_warranty_active)
                    .map((item, idx) => (
                      <Card key={idx}>
                        <CardContent className="p-4">
                          <div className="flex justify-between">
                            <div>
                              <p className="font-medium">{item.product_name}</p>
                              <p className="text-sm text-muted-foreground">
                                Factura: {item.invoice_number}
                              </p>
                            </div>
                            <Badge variant="secondary">Vencida</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </TabsContent>

                <TabsContent value="claims" className="space-y-2">
                  {showVehicleDetail.claims?.map((claim, idx) => {
                    const status = CLAIM_STATUSES[claim.status];
                    return (
                      <Card key={idx}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{claim.product_name}</p>
                              <p className="text-sm text-muted-foreground">
                                {claim.issue_description}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Fecha: {formatDate(claim.claim_date)}
                              </p>
                            </div>
                            <Badge className={`${status?.color} text-white`}>
                              {status?.label}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  {(!showVehicleDetail.claims || showVehicleDetail.claims.length === 0) && (
                    <p className="text-center text-muted-foreground py-4">
                      No hay reclamos
                    </p>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <BackToTopButton />
    </div>
  );
}
