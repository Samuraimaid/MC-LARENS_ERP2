import React, { useState, useEffect } from "react";
import axios from "axios";
import { formatCurrency, formatDate } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { ContextualDialogHeader } from "../components/ui/contextual-dialog-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Progress } from "../components/ui/progress";
import { toast } from "sonner";
import { 
  Search, RefreshCw, DollarSign, AlertTriangle,
  CheckCircle2, FileText, Receipt
} from "lucide-react";
import { API_BASE as API } from "@/lib/api";

export function CreditsPage() {
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showPayment, setShowPayment] = useState(null);
  const [showHistory, setShowHistory] = useState(null);
  
  // Payment form
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  useEffect(() => {
    fetchCredits();
  }, []);

  const fetchCredits = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/credit/pending`, { withCredentials: true });
      setCredits(res.data);
    } catch (error) {
      toast.error("Error al cargar créditos pendientes");
    } finally {
      setLoading(false);
    }
  };

  const registerPayment = async () => {
    if (!showPayment || !paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }
    
    const amount = parseFloat(paymentAmount);
    if (amount > showPayment.amount_pending) {
      toast.error(`El monto no puede exceder el pendiente: ${formatCurrency(showPayment.amount_pending)}`);
      return;
    }
    
    try {
      await axios.post(`${API}/credit/payment`, {
        sale_id: showPayment.sale_id,
        amount,
        payment_method: paymentMethod,
        reference: paymentReference || null,
        notes: paymentNotes || null,
      }, { withCredentials: true });
      
      toast.success("Pago registrado exitosamente");
      setShowPayment(null);
      resetPaymentForm();
      fetchCredits();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al registrar pago");
    }
  };

  const resetPaymentForm = () => {
    setPaymentAmount("");
    setPaymentMethod("cash");
    setPaymentReference("");
    setPaymentNotes("");
  };

  const filteredCredits = credits.filter(c => {
    const searchLower = search.toLowerCase();
    return (
      c.customer_name?.toLowerCase().includes(searchLower) ||
      c.invoice_number?.toLowerCase().includes(searchLower)
    );
  });

  const getStats = () => {
    const totalPending = credits.reduce((sum, c) => sum + (c.amount_pending || 0), 0);
    const totalPaid = credits.reduce((sum, c) => sum + (c.amount_paid || 0), 0);
    const overdue = credits.filter(c => {
      if (!c.credit_due_date) return false;
      return new Date(c.credit_due_date) < new Date();
    });
    const overdueAmount = overdue.reduce((sum, c) => sum + (c.amount_pending || 0), 0);
    
    return {
      total: credits.length,
      totalPending,
      totalPaid,
      overdue: overdue.length,
      overdueAmount,
    };
  };

  const stats = getStats();

  const isOverdue = (credit) => {
    if (!credit.credit_due_date) return false;
    return new Date(credit.credit_due_date) < new Date();
  };

  const getDaysUntilDue = (credit) => {
    if (!credit.credit_due_date) return null;
    const due = new Date(credit.credit_due_date);
    const now = new Date();
    const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div className="p-6 space-y-6" data-testid="credits-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Cuentas por Cobrar</h1>
          <p className="text-muted-foreground">Gestión de ventas a crédito y pagos parciales</p>
        </div>
        <Button variant="outline" onClick={fetchCredits}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              CRÉDITOS ACTIVOS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-yellow-500" />
              TOTAL PENDIENTE
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold text-yellow-500">
              {formatCurrency(stats.totalPending)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              TOTAL COBRADO
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold text-green-500">
              {formatCurrency(stats.totalPaid)}
            </div>
          </CardContent>
        </Card>
        <Card className={stats.overdue > 0 ? "border-red-500/50" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              VENCIDOS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold text-red-500">{stats.overdue}</div>
            {stats.overdueAmount > 0 && (
              <p className="text-sm text-red-500">{formatCurrency(stats.overdueAmount)}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente o factura..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="search-credits"
          />
        </div>
      </div>

      {/* Credits Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Factura</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Pagado</TableHead>
                <TableHead>Pendiente</TableHead>
                <TableHead>Progreso</TableHead>
                <TableHead>Vencimiento</TableHead>
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
              ) : filteredCredits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No hay créditos pendientes
                  </TableCell>
                </TableRow>
              ) : (
                filteredCredits.map(credit => {
                  const overdue = isOverdue(credit);
                  const daysUntilDue = getDaysUntilDue(credit);
                  const progress = credit.total > 0 ? (credit.amount_paid / credit.total) * 100 : 0;
                  
                  return (
                    <TableRow 
                      key={credit.sale_id} 
                      className={overdue ? "bg-red-500/5" : ""}
                      data-testid={`credit-row-${credit.sale_id}`}
                    >
                      <TableCell className="font-mono">{credit.invoice_number}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{credit.customer_name}</p>
                          {credit.customer?.phone && (
                            <p className="text-sm text-muted-foreground">{credit.customer.phone}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono font-medium">
                        {formatCurrency(credit.total)}
                      </TableCell>
                      <TableCell className="font-mono text-green-600">
                        {formatCurrency(credit.amount_paid)}
                      </TableCell>
                      <TableCell className="font-mono text-yellow-600 font-medium">
                        {formatCurrency(credit.amount_pending)}
                      </TableCell>
                      <TableCell>
                        <div className="w-24">
                          <Progress value={progress} className="h-2" />
                          <p className="text-xs text-muted-foreground text-center mt-1">
                            {progress.toFixed(0)}%
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {credit.credit_due_date ? (
                          <div className={overdue ? "text-red-500" : ""}>
                            <p className="text-sm">{formatDate(credit.credit_due_date)}</p>
                            {overdue ? (
                              <Badge variant="destructive" className="text-xs">
                                Vencido
                              </Badge>
                            ) : daysUntilDue !== null && daysUntilDue <= 7 ? (
                              <Badge variant="outline" className="text-xs text-yellow-600">
                                {daysUntilDue} días
                              </Badge>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => setShowPayment(credit)}
                            data-testid={`pay-btn-${credit.sale_id}`}
                          >
                            <DollarSign className="h-4 w-4 mr-1" />
                            Pagar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowHistory(credit)}
                          >
                            <Receipt className="h-4 w-4" />
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

      {/* Register Payment Dialog */}
      <Dialog open={!!showPayment} onOpenChange={() => { setShowPayment(null); resetPaymentForm(); }}>
        <DialogContent>
          <ContextualDialogHeader
            variant="success"
            size="inline"
            title="Registrar Pago"
            description={`Factura ${showPayment?.invoice_number || ""} — ${showPayment?.customer_name || ""}`}
          />
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Factura:</span>
                <span className="font-mono">{formatCurrency(showPayment?.total || 0)}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>Pagado:</span>
                <span className="font-mono">{formatCurrency(showPayment?.amount_paid || 0)}</span>
              </div>
              <div className="flex justify-between font-medium text-yellow-600">
                <span>Pendiente:</span>
                <span className="font-mono">{formatCurrency(showPayment?.amount_pending || 0)}</span>
              </div>
            </div>
            
            <div>
              <Label>Monto a Pagar *</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  max={showPayment?.amount_pending}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  className="pl-9"
                  data-testid="payment-amount"
                />
              </div>
              <div className="flex gap-2 mt-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setPaymentAmount(showPayment?.amount_pending?.toString() || "")}
                >
                  Pagar todo
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setPaymentAmount((showPayment?.amount_pending / 2)?.toFixed(2) || "")}
                >
                  50%
                </Button>
              </div>
            </div>
            
            <div>
              <Label>Método de Pago</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger data-testid="payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                  <SelectItem value="card">Tarjeta</SelectItem>
                  <SelectItem value="check">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Referencia (opcional)</Label>
              <Input
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Número de transacción, cheque, etc."
              />
            </div>
            
            <div>
              <Label>Notas (opcional)</Label>
              <Textarea
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Observaciones del pago..."
                rows={2}
              />
            </div>
            
            <Button onClick={registerPayment} className="w-full" data-testid="confirm-payment-btn">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Registrar Pago
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment History Dialog */}
      <Dialog open={!!showHistory} onOpenChange={() => setShowHistory(null)}>
        <DialogContent className="max-w-lg">
          <ContextualDialogHeader
            variant="information"
            size="inline"
            title="Historial de Pagos"
            description={`Factura ${showHistory?.invoice_number || ""} — ${showHistory?.customer_name || ""}`}
          />
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total:</span>
                <span className="font-mono">{formatCurrency(showHistory?.total || 0)}</span>
              </div>
              <Progress value={showHistory?.total ? (showHistory.amount_paid / showHistory.total) * 100 : 0} className="h-2" />
            </div>
            
            {showHistory?.payments?.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {showHistory.payments.map((payment, idx) => (
                  <div key={idx} className="p-3 border rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-green-600">{formatCurrency(payment.amount)}</p>
                        <p className="text-sm text-muted-foreground">
                          {payment.payment_method === "cash" && "Efectivo"}
                          {payment.payment_method === "transfer" && "Transferencia"}
                          {payment.payment_method === "card" && "Tarjeta"}
                          {payment.payment_method === "check" && "Cheque"}
                        </p>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        <p>{formatDate(payment.created_at)}</p>
                        <p>{payment.received_by_name}</p>
                      </div>
                    </div>
                    {payment.reference && (
                      <p className="text-sm mt-1">Ref: {payment.reference}</p>
                    )}
                    {payment.notes && (
                      <p className="text-sm text-muted-foreground mt-1">{payment.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                No hay pagos registrados
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
