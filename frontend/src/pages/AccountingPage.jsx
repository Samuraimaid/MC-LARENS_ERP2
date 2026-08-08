import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { formatCurrency, formatDate } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { ContextualDialogHeader } from "../components/ui/contextual-dialog-header";
import { toast } from "sonner";
import {
  Calculator, RefreshCw, Wallet, AlertTriangle, Download, Plus, CheckCircle2,
  XCircle, Banknote, Receipt, FileSpreadsheet, Printer,
} from "lucide-react";
import { API_BASE as API } from "@/lib/api";
import { ACCOUNTING_TAB_OPTIONS, PETTY_CASH_CATEGORY_OPTIONS, PETTY_CASH_STATUS_LABELS } from "@/lib/pettyCash";

const downloadBlob = (response, filename) => {
  const blob = new Blob([response.data], { type: response.headers["content-type"] });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};

export function AccountingPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = ACCOUNTING_TAB_OPTIONS.some((tab) => tab.id === searchParams.get("tab"))
    ? searchParams.get("tab")
    : "resumen";

  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(user?.branch_id || "branch_main");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [fund, setFund] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [payments, setPayments] = useState([]);
  const [reconciliation, setReconciliation] = useState(null);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [showReplenishDialog, setShowReplenishDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const [expenseForm, setExpenseForm] = useState({
    category: "insumos_limpieza",
    description: "",
    beneficiary: "",
    amount: "",
    payment_method: "cash",
    received_by: "",
    notes: "",
  });
  const [replenishForm, setReplenishForm] = useState({ amount: "", reference: "", notes: "" });

  const canApprove = ["gerencia"].includes((user?.role || "").toLowerCase());
  const canPay = ["gerencia", "cajero", "supervisor"].includes((user?.role || "").toLowerCase());
  const branchQuery = () => ({ branch_id: selectedBranchId });
  const dateQuery = () => ({
    ...branchQuery(),
    ...(startDate ? { start_date: startDate } : {}),
    ...(endDate ? { end_date: endDate } : {}),
  });

  const handleTabChange = (nextTab) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", nextTab);
    setSearchParams(params, { replace: true });
  };

  const fetchBranches = async () => {
    try {
      const response = await axios.get(`${API}/branches`, { withCredentials: true });
      const rows = Array.isArray(response.data) ? response.data : [];
      setBranches(rows);
      if (!selectedBranchId && rows[0]?.branch_id) {
        setSelectedBranchId(rows[0].branch_id);
      }
    } catch (error) {
      toast.error("No se pudieron cargar las sucursales");
    }
  };

  const fetchSummary = async () => {
    const response = await axios.get(`${API}/accounting/summary`, {
      withCredentials: true,
      params: dateQuery(),
    });
    setSummary(response.data);
  };

  const fetchFund = async () => {
    const response = await axios.get(`${API}/petty-cash/fund`, {
      withCredentials: true,
      params: branchQuery(),
    });
    setFund(response.data);
  };

  const fetchExpenses = async () => {
    const response = await axios.get(`${API}/petty-cash/expenses`, {
      withCredentials: true,
      params: { ...branchQuery(), ...(startDate ? { start_date: startDate } : {}), ...(endDate ? { end_date: endDate } : {}) },
    });
    setExpenses(Array.isArray(response.data) ? response.data : []);
  };

  const fetchPurchases = async () => {
    const response = await axios.get(`${API}/accounting/purchases-expenses`, {
      withCredentials: true,
      params: dateQuery(),
    });
    setPurchases(Array.isArray(response.data) ? response.data : []);
  };

  const fetchPayments = async () => {
    const response = await axios.get(`${API}/accounting/payments`, {
      withCredentials: true,
      params: dateQuery(),
    });
    setPayments(Array.isArray(response.data) ? response.data : []);
  };

  const fetchReconciliation = async () => {
    const response = await axios.get(`${API}/petty-cash/reconciliation`, {
      withCredentials: true,
      params: branchQuery(),
    });
    setReconciliation(response.data);
  };

  const refreshAll = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchSummary(),
        fetchFund(),
        fetchExpenses(),
        fetchPurchases(),
        fetchPayments(),
        fetchReconciliation(),
      ]);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al cargar contabilidad");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    if (!selectedBranchId) return;
    refreshAll();
  }, [selectedBranchId, startDate, endDate]);

  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.branch_id === selectedBranchId) || null,
    [branches, selectedBranchId]
  );

  const createExpense = async (submit = false) => {
    if (!expenseForm.description.trim() || !expenseForm.beneficiary.trim() || !expenseForm.amount) {
      toast.error("Completa concepto, beneficiario y monto");
      return;
    }
    setSaving(true);
    try {
      await axios.post(
        `${API}/petty-cash/expenses`,
        {
          branch_id: selectedBranchId,
          category: expenseForm.category,
          description: expenseForm.description.trim(),
          beneficiary: expenseForm.beneficiary.trim(),
          amount: Number(expenseForm.amount),
          payment_method: expenseForm.payment_method,
          received_by: expenseForm.received_by.trim() || expenseForm.beneficiary.trim(),
          notes: expenseForm.notes.trim(),
          submit,
        },
        { withCredentials: true }
      );
      toast.success(submit ? "Gasto enviado a flujo de aprobación" : "Gasto guardado en borrador");
      setShowExpenseDialog(false);
      setExpenseForm({
        category: "insumos_limpieza",
        description: "",
        beneficiary: "",
        amount: "",
        payment_method: "cash",
        received_by: "",
        notes: "",
      });
      await refreshAll();
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo registrar el gasto");
    } finally {
      setSaving(false);
    }
  };

  const createReplenishment = async () => {
    if (!replenishForm.amount || Number(replenishForm.amount) <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }
    setSaving(true);
    try {
      await axios.post(
        `${API}/petty-cash/replenishments`,
        {
          branch_id: selectedBranchId,
          amount: Number(replenishForm.amount),
          reference: replenishForm.reference,
          notes: replenishForm.notes,
        },
        { withCredentials: true }
      );
      toast.success("Reposición de fondo registrada");
      setShowReplenishDialog(false);
      setReplenishForm({ amount: "", reference: "", notes: "" });
      await refreshAll();
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo registrar la reposición");
    } finally {
      setSaving(false);
    }
  };

  const expenseAction = async (expenseId, action) => {
    try {
      await axios.post(`${API}/petty-cash/expenses/${expenseId}/${action}`, {}, { withCredentials: true });
      toast.success(`Gasto ${action === "approve" ? "aprobado" : action === "pay" ? "pagado" : "actualizado"}`);
      await refreshAll();
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo completar la acción");
    }
  };

  const printExpensePdf = async (expenseId, voucherNumber) => {
    try {
      const response = await axios.get(`${API}/print/petty-cash-pdf/${expenseId}`, {
        withCredentials: true,
        responseType: "blob",
      });
      downloadBlob(response, `caja_chica_${voucherNumber || expenseId}.pdf`);
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo generar el comprobante");
    }
  };

  const exportAccounting = async () => {
    try {
      const response = await axios.get(`${API}/accounting/export`, {
        withCredentials: true,
        params: { ...dateQuery(), format: "xlsx" },
        responseType: "blob",
      });
      downloadBlob(response, `contabilidad_${selectedBranchId}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Exportación contable descargada");
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo exportar");
    }
  };

  const fundData = fund?.fund || {};
  const settingsData = fund?.settings || {};

  return (
    <div className="p-6 space-y-6 animate-fade-up-soft" data-testid="accounting-page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight flex items-center gap-2">
            <Calculator className="h-8 w-8" />
            Contabilidad
          </h1>
          <p className="text-muted-foreground">
            Seguimiento de compras, gastos, pagos y caja chica por sucursal
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={refreshAll} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button variant="outline" onClick={exportAccounting}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Sucursal</Label>
              <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                <SelectTrigger><SelectValue placeholder="Sucursal" /></SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.branch_id} value={branch.branch_id}>
                      {branch.name || branch.branch_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Desde</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Hasta</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="flex items-end">
              <p className="text-sm text-muted-foreground">
                {selectedBranch?.name ? `Operando: ${selectedBranch.name}` : selectedBranchId}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {(fundData.low_balance_alert || fundData.monthly_cap_alert) ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5" />
          <div>
            {fundData.low_balance_alert ? <p>Alerta: saldo de caja chica bajo ({formatCurrency(fundData.balance)}).</p> : null}
            {fundData.monthly_cap_alert ? <p>Alerta: tope mensual de caja chica alcanzado o superado.</p> : null}
          </div>
        </div>
      ) : null}

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-md border bg-card p-1.5 lg:grid-cols-5">
          {ACCOUNTING_TAB_OPTIONS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="rounded-full text-sm">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="resumen" className="space-y-4 mt-0">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Ventas del período</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">{formatCurrency(summary?.sales_total || 0)}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Pagos recibidos</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">{formatCurrency(summary?.payments_total || 0)}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Compras y gastos</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">{formatCurrency(summary?.purchases_expenses_total || 0)}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Crédito pendiente</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">{formatCurrency(summary?.credit_pending_total || 0)}</CardContent>
            </Card>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" />Caja chica</CardTitle>
                <CardDescription>Fondo autorizado y saldo disponible</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Fondo base</span><strong>{formatCurrency(fundData.fund_amount || 0)}</strong></div>
                <div className="flex justify-between"><span>Reposiciones</span><strong>{formatCurrency(fundData.replenished_total || 0)}</strong></div>
                <div className="flex justify-between"><span>Gastado</span><strong>{formatCurrency(fundData.spent_total || 0)}</strong></div>
                <div className="flex justify-between border-t pt-2"><span>Saldo disponible</span><strong>{formatCurrency(fundData.balance || 0)}</strong></div>
                <div className="flex justify-between"><span>Gasto del mes</span><span>{formatCurrency(fundData.spent_month || 0)} / {formatCurrency(fundData.monthly_cap || 0)}</span></div>
                <div className="flex justify-between"><span>Aprobación requerida sobre</span><span>{formatCurrency(settingsData.requires_approval_above || 0)}</span></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" />Flujo del período</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Gastos caja chica</span><span>{summary?.petty_cash_expenses_count || 0} · {formatCurrency(summary?.petty_cash_spent || 0)}</span></div>
                <div className="flex justify-between"><span>Egresos de caja</span><span>{summary?.cash_session_expenses_count || 0} · {formatCurrency(summary?.cash_session_expenses || 0)}</span></div>
                <div className="flex justify-between"><span>Pagos registrados</span><span>{summary?.payments_count || 0}</span></div>
                <div className="flex justify-between"><span>Cuentas al crédito abiertas</span><span>{summary?.credit_accounts || 0}</span></div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="caja-chica" className="space-y-4 mt-0">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowExpenseDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo gasto
            </Button>
            <Button variant="outline" onClick={() => setShowReplenishDialog(true)}>
              <Banknote className="h-4 w-4 mr-2" />
              Reponer fondo
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Gastos de caja chica</CardTitle>
              <CardDescription>Borrador → aprobación (si aplica) → pago → comprobante PDF</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Comprobante</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Beneficiario</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Sin gastos registrados</TableCell></TableRow>
                  ) : expenses.map((row) => (
                    <TableRow key={row.expense_id}>
                      <TableCell className="font-medium">{row.voucher_number}</TableCell>
                      <TableCell>{formatDate(row.created_at)}</TableCell>
                      <TableCell>{PETTY_CASH_CATEGORY_OPTIONS.find((c) => c.id === row.category)?.label || row.category}</TableCell>
                      <TableCell>{row.description}</TableCell>
                      <TableCell>{row.beneficiary}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.amount)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{PETTY_CASH_STATUS_LABELS[row.status] || row.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        {row.status === "draft" ? (
                          <Button size="sm" variant="outline" onClick={() => expenseAction(row.expense_id, "submit")}>Enviar</Button>
                        ) : null}
                        {row.status === "pending_approval" && canApprove ? (
                          <>
                            <Button size="sm" onClick={() => expenseAction(row.expense_id, "approve")}>Aprobar</Button>
                            <Button size="sm" variant="destructive" onClick={() => expenseAction(row.expense_id, "reject")}>Rechazar</Button>
                          </>
                        ) : null}
                        {row.status === "approved" && canPay ? (
                          <Button size="sm" onClick={() => expenseAction(row.expense_id, "pay")}>Pagar</Button>
                        ) : null}
                        {row.status === "paid" ? (
                          <Button size="sm" variant="outline" onClick={() => printExpensePdf(row.expense_id, row.voucher_number)}>
                            <Printer className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compras-gastos" className="space-y-4 mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Compras y gastos</CardTitle>
              <CardDescription>Caja chica + egresos de sesión de caja</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fuente</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Referencia</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Beneficiario</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Sin movimientos en el período</TableCell></TableRow>
                  ) : purchases.map((row) => (
                    <TableRow key={`${row.source}-${row.id}`}>
                      <TableCell>{row.source === "petty_cash" ? "Caja chica" : "Caja sesión"}</TableCell>
                      <TableCell>{formatDate(row.date)}</TableCell>
                      <TableCell>{row.voucher_number || row.id}</TableCell>
                      <TableCell>{row.category}</TableCell>
                      <TableCell>{row.description}</TableCell>
                      <TableCell>{row.beneficiary}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pagos" className="space-y-4 mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Pagos y cobros</CardTitle>
              <CardDescription>Abonos a crédito y cobros en caja</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fuente</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Referencia</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sin pagos en el período</TableCell></TableRow>
                  ) : payments.map((row) => (
                    <TableRow key={`${row.source}-${row.id}`}>
                      <TableCell>{row.source === "credit_payment" ? "Abono crédito" : "Cobro caja"}</TableCell>
                      <TableCell>{formatDate(row.date)}</TableCell>
                      <TableCell>{row.reference}</TableCell>
                      <TableCell>{row.description}</TableCell>
                      <TableCell>{row.payment_method || "—"}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conciliacion" className="space-y-4 mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Conciliación semanal de caja chica</CardTitle>
              <CardDescription>
                Semana {reconciliation?.week_start} → {reconciliation?.week_end}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Saldo inicial</p><p className="text-lg font-semibold">{formatCurrency(reconciliation?.opening_balance || 0)}</p></div>
                <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Gastos semana</p><p className="text-lg font-semibold">{formatCurrency(reconciliation?.expenses_total || 0)}</p></div>
                <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Reposiciones</p><p className="text-lg font-semibold">{formatCurrency(reconciliation?.replenishments_total || 0)}</p></div>
                <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Saldo final</p><p className="text-lg font-semibold">{formatCurrency(reconciliation?.closing_balance || 0)}</p></div>
              </div>
              <div>
                <h3 className="font-medium mb-2">Por categoría</h3>
                <div className="space-y-2">
                  {(reconciliation?.by_category || []).map((row) => (
                    <div key={row.category} className="flex justify-between rounded-md border px-3 py-2 text-sm">
                      <span>{row.category}</span>
                      <strong>{formatCurrency(row.amount)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showExpenseDialog} onOpenChange={setShowExpenseDialog}>
        <DialogContent className="max-w-lg">
          <ContextualDialogHeader
            variant="information"
            size="inline"
            title="Nuevo gasto de caja chica"
            description="Insumos, viáticos, adelantos, bonos y alimentación"
          />
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={expenseForm.category} onValueChange={(value) => setExpenseForm((prev) => ({ ...prev, category: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PETTY_CASH_CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Beneficiario</Label><Input value={expenseForm.beneficiary} onChange={(e) => setExpenseForm((p) => ({ ...p, beneficiary: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Concepto</Label><Input value={expenseForm.description} onChange={(e) => setExpenseForm((p) => ({ ...p, description: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Monto</Label><Input type="number" min="0" step="0.01" value={expenseForm.amount} onChange={(e) => setExpenseForm((p) => ({ ...p, amount: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Notas</Label><Textarea value={expenseForm.notes} onChange={(e) => setExpenseForm((p) => ({ ...p, notes: e.target.value }))} /></div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" disabled={saving} onClick={() => createExpense(false)}>Guardar borrador</Button>
              <Button disabled={saving} onClick={() => createExpense(true)}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Enviar a aprobación
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showReplenishDialog} onOpenChange={setShowReplenishDialog}>
        <DialogContent>
          <ContextualDialogHeader
            variant="success"
            size="inline"
            title="Reponer fondo de caja chica"
            description="Registra la reposición del fondo autorizado"
          />
          <div className="space-y-3">
            <div className="space-y-2"><Label>Monto</Label><Input type="number" min="0" step="0.01" value={replenishForm.amount} onChange={(e) => setReplenishForm((p) => ({ ...p, amount: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Referencia</Label><Input value={replenishForm.reference} onChange={(e) => setReplenishForm((p) => ({ ...p, reference: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Notas</Label><Textarea value={replenishForm.notes} onChange={(e) => setReplenishForm((p) => ({ ...p, notes: e.target.value }))} /></div>
            <Button disabled={saving} onClick={createReplenishment}>Registrar reposición</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}