import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_BASE as API } from "@/lib/api";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { toast } from "sonner";
import { Download, RefreshCw } from "lucide-react";
import { DriversManagementTab } from "../components/hr/DriversManagementTab";

const ROLE_LABELS = {
  gerencia: "Gerencia",
  supervisor: "Supervisor",
  recursos_humanos: "Recursos Humanos",
  bodegas: "Bodegas",
  instalaciones: "Instalaciones",
  tecnico: "Técnico",
  electrico: "Eléctrico",
  polarizador: "Polarizador",
  publicidad: "Publicidad",
  programador: "Programador",
};

export function HumanResourcesPage() {
  const { user, hasPermission } = useAuth();
  const canView = hasPermission("human_resources", "view");
  const canEdit = hasPermission("human_resources", "edit");
  const canViewOwn = Boolean(user);
  const canAccessPage = canView || canViewOwn;

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [branches, setBranches] = useState([]);
  const [users, setUsers] = useState([]);
  const [clockEvents, setClockEvents] = useState([]);
  const [personnelActions, setPersonnelActions] = useState([]);
  const [toolAudits, setToolAudits] = useState([]);
  const [toolSchedule, setToolSchedule] = useState([]);
  const [attendanceIncidents, setAttendanceIncidents] = useState([]);
  const [settingsAudit, setSettingsAudit] = useState([]);
  const [biweeklyRows, setBiweeklyRows] = useState([]);
  const [biweeklyRange, setBiweeklyRange] = useState({ start_date: "", end_date: "" });
  const [biweeklyBranchId, setBiweeklyBranchId] = useState("all");
  const [biweeklySummary, setBiweeklySummary] = useState(null);
  const [selectedBiweeklyRow, setSelectedBiweeklyRow] = useState(null);
  const [myOverview, setMyOverview] = useState(null);
  const [payrollAdjustments, setPayrollAdjustments] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [payStubs, setPayStubs] = useState([]);
  const [myPayStubs, setMyPayStubs] = useState([]);
  const [payStubForm, setPayStubForm] = useState({
    user_id: "",
    period_start: "",
    period_end: "",
  });

  const [attendanceSettingsForm, setAttendanceSettingsForm] = useState({
    scope: "global",
    branch_id: "",
    time_format: "12h",
    kiosk_theme_mode: "system",
    entry_start: "08:00",
    entry_tolerance_minutes: 10,
    late_arrival_deduction_enabled: true,
    late_arrival_deduction_amount: 50,
    late_arrival_deduction_currency: "NIO",
    lunch_out_start: "10:00",
    lunch_out_end: "16:00",
    lunch_break_minutes: 40,
    weekday_shift_end: "17:30",
    saturday_shift_end: "16:00",
    anti_double_touch_seconds: 20,
  });

  const [clockPin, setClockPin] = useState("");
  const [clockNotes, setClockNotes] = useState("");

  const [adjustmentForm, setAdjustmentForm] = useState({
    user_id: "",
    adjustment_type: "horas_extras",
    amount: "",
    notes: "",
  });

  const [leaveForm, setLeaveForm] = useState({
    user_id: "",
    leave_type: "vacaciones",
    start_date: "",
    end_date: "",
    notes: "",
  });

  const [personnelForm, setPersonnelForm] = useState({
    action_type: "contratacion",
    user_id: "",
    employee_name: "",
    old_role: "",
    new_role: "",
    notes: "",
  });

  const [expenseForm, setExpenseForm] = useState({
    category: "operativo",
    description: "",
    amount: "",
    branch_id: "",
  });

  const [poForm, setPoForm] = useState({
    supplier: "",
    item_name: "",
    quantity: "1",
    unit_cost: "",
    notes: "",
  });

  const [toolAssignForm, setToolAssignForm] = useState({
    technician_id: "",
    category: "instalador",
    tool_name: "",
    serial: "",
    unit_cost: "",
  });

  const [toolAuditForm, setToolAuditForm] = useState({
    technician_id: "",
    found_serials: "",
  });

  const getRoleLabel = (role) => ROLE_LABELS[role] || role || "sin_rol";
  const getBranchLabel = (branchId) => branches.find((b) => b.branch_id === branchId)?.name || branchId || "Sin sucursal";
  const formatHours = (value) => `${Number(value || 0).toFixed(2)} h`;
  const formatDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString();
  };
  const formatDelta = (value, suffix = "") => {
    const number = Number(value || 0);
    const sign = number > 0 ? "+" : "";
    return `${sign}${number}${suffix}`;
  };
  const getUserLabel = (userId) => {
    const user = users.find((u) => u.user_id === userId);
    if (!user) return userId || "-";
    return `${user.name || user.user_id} - ${getRoleLabel(user.role)} - ${getBranchLabel(user.branch_id)}`;
  };

  const technicianUsers = useMemo(
    () => users.filter((u) => ["instalaciones", "tecnico", "electrico", "polarizador", "bodegas"].includes(u.role)),
    [users],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [myOverviewRes, myPayStubsRes] = await Promise.all([
        axios.get(`${API}/hr/my/overview`, { withCredentials: true }).catch(() => ({ data: null })),
        axios.get(`${API}/hr/pay-stubs/mine`, { withCredentials: true }).catch(() => ({ data: [] })),
      ]);
      setMyOverview(myOverviewRes.data || null);
      setMyPayStubs(Array.isArray(myPayStubsRes.data) ? myPayStubsRes.data : []);

      if (!canView) {
        return;
      }

      const [
        summaryRes,
        branchesRes,
        usersRes,
        clockRes,
        personnelRes,
        auditsRes,
        scheduleRes,
        incidentsRes,
        settingsRes,
        settingsAuditRes,
        biweeklyRes,
        payrollAdjustmentsRes,
        leavesRes,
        payStubsRes,
      ] = await Promise.all([
        axios.get(`${API}/hr/summary`, { withCredentials: true }).catch(() => ({ data: null })),
        axios.get(`${API}/branches`, { withCredentials: true }).catch(() => ({ data: [] })),
        axios.get(`${API}/auth/pin/users`, { withCredentials: true }).catch(() => ({ data: [] })),
        axios.get(`${API}/hr/timeclock/events?limit=120`, { withCredentials: true }).catch(() => ({ data: [] })),
        axios.get(`${API}/hr/personnel-actions?limit=120`, { withCredentials: true }).catch(() => ({ data: [] })),
        axios.get(`${API}/hr/tools/audits?limit=120`, { withCredentials: true }).catch(() => ({ data: [] })),
        axios.get(`${API}/hr/tools/audit-schedule`, { withCredentials: true }).catch(() => ({ data: [] })),
        axios.get(`${API}/hr/attendance/incidents?limit=120`, { withCredentials: true }).catch(() => ({ data: [] })),
        axios.get(`${API}/hr/attendance/settings`, { withCredentials: true }).catch(() => ({ data: null })),
        axios.get(`${API}/hr/attendance/settings/audit?limit=60`, { withCredentials: true }).catch(() => ({ data: [] })),
        axios.get(`${API}/hr/attendance/reports/biweekly`, { withCredentials: true }).catch(() => ({ data: { rows: [], summary: null } })),
        axios.get(`${API}/hr/payroll-adjustments?limit=200`, { withCredentials: true }).catch(() => ({ data: [] })),
        axios.get(`${API}/hr/leaves?limit=200`, { withCredentials: true }).catch(() => ({ data: [] })),
        axios.get(`${API}/hr/pay-stubs?limit=120`, { withCredentials: true }).catch(() => ({ data: [] })),
      ]);

      setSummary(summaryRes.data || null);
      setBranches(Array.isArray(branchesRes.data) ? branchesRes.data : []);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
      setClockEvents(Array.isArray(clockRes.data) ? clockRes.data : []);
      setPersonnelActions(Array.isArray(personnelRes.data) ? personnelRes.data : []);
      setToolAudits(Array.isArray(auditsRes.data) ? auditsRes.data : []);
      setToolSchedule(Array.isArray(scheduleRes.data) ? scheduleRes.data : []);
      setAttendanceIncidents(Array.isArray(incidentsRes.data) ? incidentsRes.data : []);
      setSettingsAudit(Array.isArray(settingsAuditRes.data) ? settingsAuditRes.data : []);
      setBiweeklyRows(Array.isArray(biweeklyRes.data?.rows) ? biweeklyRes.data.rows : []);
      setBiweeklySummary(biweeklyRes.data?.summary || null);
      setBiweeklyRange({
        start_date: biweeklyRes.data?.start_date || "",
        end_date: biweeklyRes.data?.end_date || "",
      });
      setPayrollAdjustments(Array.isArray(payrollAdjustmentsRes.data) ? payrollAdjustmentsRes.data : []);
      setLeaves(Array.isArray(leavesRes.data) ? leavesRes.data : []);
      setPayStubs(Array.isArray(payStubsRes.data) ? payStubsRes.data : []);

      const effectiveSettings = settingsRes.data?.effective;
      if (effectiveSettings) {
        setAttendanceSettingsForm((prev) => ({
          ...prev,
          ...effectiveSettings,
        }));
      }
    } catch (error) {
      toast.error("Error al cargar módulo de RRHH");
    } finally {
      setLoading(false);
    }
  }, [canView]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const registerPunch = async (eventType) => {
    if (!clockPin || clockPin.length !== 4) {
      toast.error("Ingresa un PIN válido de 4 dígitos");
      return;
    }
    try {
      await axios.post(`${API}/hr/timeclock/punch`, {
        pin: clockPin,
        event_type: eventType,
        notes: clockNotes,
      }, { withCredentials: true });
      toast.success("Marcación registrada");
      setClockNotes("");
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al registrar marcación");
    }
  };

  const createAdjustment = async () => {
    try {
      await axios.post(`${API}/hr/payroll-adjustments`, {
        ...adjustmentForm,
        amount: Number(adjustmentForm.amount || 0),
      }, { withCredentials: true });
      toast.success("Ajuste de nómina registrado");
      setAdjustmentForm({ user_id: "", adjustment_type: "horas_extras", amount: "", notes: "" });
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al registrar ajuste");
    }
  };

  const createLeave = async () => {
    try {
      await axios.post(`${API}/hr/leaves`, leaveForm, { withCredentials: true });
      toast.success("Vacación/permiso/subsidio registrado");
      setLeaveForm({ user_id: "", leave_type: "vacaciones", start_date: "", end_date: "", notes: "" });
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al registrar ausencia");
    }
  };

  const createPersonnelAction = async () => {
    try {
      await axios.post(`${API}/hr/personnel-actions`, personnelForm, { withCredentials: true });
      toast.success("Movimiento de personal registrado");
      setPersonnelForm({ action_type: "contratacion", user_id: "", employee_name: "", old_role: "", new_role: "", notes: "" });
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al registrar movimiento");
    }
  };

  const createExpense = async () => {
    try {
      await axios.post(`${API}/hr/operational-expenses`, {
        ...expenseForm,
        amount: Number(expenseForm.amount || 0),
      }, { withCredentials: true });
      toast.success("Gasto operativo registrado");
      setExpenseForm({ category: "operativo", description: "", amount: "", branch_id: "" });
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al registrar gasto");
    }
  };

  const createPurchaseOrder = async () => {
    try {
      await axios.post(`${API}/hr/purchase-orders`, {
        supplier: poForm.supplier,
        notes: poForm.notes,
        items: [{
          item_name: poForm.item_name,
          quantity: Number(poForm.quantity || 0),
          unit_cost: Number(poForm.unit_cost || 0),
        }],
      }, { withCredentials: true });
      toast.success("Orden de compra registrada");
      setPoForm({ supplier: "", item_name: "", quantity: "1", unit_cost: "", notes: "" });
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al registrar orden de compra");
    }
  };

  const assignTool = async () => {
    try {
      await axios.post(`${API}/hr/tools/assignments`, {
        ...toolAssignForm,
        technician_name: users.find((u) => u.user_id === toolAssignForm.technician_id)?.name,
        unit_cost: Number(toolAssignForm.unit_cost || 0),
      }, { withCredentials: true });
      toast.success("Herramienta asignada");
      setToolAssignForm({ technician_id: "", category: "instalador", tool_name: "", serial: "", unit_cost: "" });
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al asignar herramienta");
    }
  };

  const runAudit = async () => {
    try {
      const foundSerials = toolAuditForm.found_serials
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      await axios.post(`${API}/hr/tools/audits`, {
        technician_id: toolAuditForm.technician_id,
        technician_name: users.find((u) => u.user_id === toolAuditForm.technician_id)?.name,
        found_serials: foundSerials,
      }, { withCredentials: true });
      toast.success("Auditoría quincenal registrada");
      setToolAuditForm({ technician_id: "", found_serials: "" });
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al registrar auditoría");
    }
  };

  const applyDeductions = async (auditId) => {
    try {
      await axios.put(`${API}/hr/tools/audits/${auditId}/apply-deductions`, null, { withCredentials: true });
      toast.success("Descuentos por herramientas faltantes aplicados");
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al aplicar descuentos");
    }
  };

  const saveAttendanceSettings = async () => {
    try {
      const payload = {
        scope: attendanceSettingsForm.scope,
        branch_id: attendanceSettingsForm.scope === "branch" ? attendanceSettingsForm.branch_id : null,
        settings: {
          time_format: attendanceSettingsForm.time_format,
          kiosk_theme_mode: attendanceSettingsForm.kiosk_theme_mode,
          entry_start: attendanceSettingsForm.entry_start,
          entry_tolerance_minutes: Number(attendanceSettingsForm.entry_tolerance_minutes || 10),
          late_arrival_deduction_enabled: Boolean(attendanceSettingsForm.late_arrival_deduction_enabled),
          late_arrival_deduction_amount: Number(attendanceSettingsForm.late_arrival_deduction_amount || 0),
          late_arrival_deduction_currency: String(attendanceSettingsForm.late_arrival_deduction_currency || "NIO").toUpperCase(),
          lunch_out_start: attendanceSettingsForm.lunch_out_start,
          lunch_out_end: attendanceSettingsForm.lunch_out_end,
          lunch_break_minutes: Number(attendanceSettingsForm.lunch_break_minutes || 40),
          weekday_shift_end: attendanceSettingsForm.weekday_shift_end,
          saturday_shift_end: attendanceSettingsForm.saturday_shift_end,
          anti_double_touch_seconds: Number(attendanceSettingsForm.anti_double_touch_seconds || 20),
        },
      };
      await axios.put(`${API}/hr/attendance/settings`, payload, { withCredentials: true });
      toast.success("Configuración de asistencia guardada");
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo guardar la configuración");
    }
  };

  const loadBiweeklyReport = async () => {
    try {
      const params = {};
      if (biweeklyRange.start_date) params.start_date = biweeklyRange.start_date;
      if (biweeklyRange.end_date) params.end_date = biweeklyRange.end_date;
      if (biweeklyBranchId && biweeklyBranchId !== "all") params.branch_id = biweeklyBranchId;
      const response = await axios.get(`${API}/hr/attendance/reports/biweekly`, { params, withCredentials: true });
      setBiweeklyRows(Array.isArray(response.data?.rows) ? response.data.rows : []);
      setBiweeklySummary(response.data?.summary || null);
      setBiweeklyRange({
        start_date: response.data?.start_date || biweeklyRange.start_date,
        end_date: response.data?.end_date || biweeklyRange.end_date,
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo cargar el reporte quincenal");
    }
  };

  const processPayStub = async () => {
    if (!payStubForm.user_id) {
      toast.error("Selecciona un empleado");
      return;
    }
    try {
      const payload = {
        user_id: payStubForm.user_id,
        force_reprocess: true,
      };
      if (payStubForm.period_start) payload.period_start = payStubForm.period_start;
      if (payStubForm.period_end) payload.period_end = payStubForm.period_end;
      await axios.post(`${API}/hr/pay-stubs`, payload, { withCredentials: true });
      toast.success("Nómina procesada y comprobante generado");
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo procesar la nómina");
    }
  };

  const downloadPayStubPdf = (stubId) => {
    if (!stubId) return;
    window.open(`${API}/hr/pay-stubs/${stubId}/pdf`, "_blank");
  };

  const exportBiweeklyReport = (format = "csv") => {
    const params = new URLSearchParams();
    if (biweeklyRange.start_date) params.set("start_date", biweeklyRange.start_date);
    if (biweeklyRange.end_date) params.set("end_date", biweeklyRange.end_date);
    if (biweeklyBranchId && biweeklyBranchId !== "all") params.set("branch_id", biweeklyBranchId);
    params.set("format", format);
    window.open(`${API}/hr/attendance/reports/biweekly/export?${params.toString()}`, "_blank");
  };

  const getComplianceVariant = (status) => {
    if (status === "verde") return "outline";
    if (status === "amarillo") return "secondary";
    if (status === "rojo") return "destructive";
    return "outline";
  };

  if (!canAccessPage) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            No tienes permiso para acceder al módulo de Recursos Humanos.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="human-resources-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Recursos Humanos</h1>
          <p className="text-muted-foreground">
            {canView
              ? "Control laboral, nómina, personal y herramientas técnicas"
              : "Mi expediente laboral: incidencias, amonestaciones, comisiones y vacaciones"}
          </p>
        </div>
        <Button variant="outline" onClick={loadData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {canView ? (
        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Marcaciones mes</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{summary?.clock_events ?? 0}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Ajustes nómina</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{Number(summary?.payroll_adjustments_total || 0).toFixed(2)}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Gastos operativos</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{Number(summary?.operational_expenses_total || 0).toFixed(2)}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Auditorías pendientes</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{summary?.pending_tool_audits ?? 0}</div></CardContent></Card>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Mis incidencias</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{myOverview?.incidents?.length ?? 0}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Mis amonestaciones</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{myOverview?.sanctions?.length ?? 0}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Vacaciones disponibles</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{myOverview?.vacations?.available_days ?? 0} días</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Comisión estimada</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{Number(myOverview?.sales_commissions?.estimated_commission || 0).toFixed(2)}</div></CardContent></Card>
        </div>
      )}

      <Tabs defaultValue={canView ? "timeclock" : "my"} className="space-y-4">
        <TabsList className={`grid w-full ${canView ? "grid-cols-8" : "grid-cols-1"}`}>
          {canView && (
            <>
              <TabsTrigger value="timeclock">Marcador</TabsTrigger>
              <TabsTrigger value="payroll">Nómina</TabsTrigger>
              <TabsTrigger value="personnel">Personal</TabsTrigger>
              <TabsTrigger value="drivers">Conductores</TabsTrigger>
              <TabsTrigger value="operations">Operativos</TabsTrigger>
              <TabsTrigger value="tools">Herramientas</TabsTrigger>
              <TabsTrigger value="schedule">Auditoría 2x mes</TabsTrigger>
            </>
          )}
          <TabsTrigger value="my">Mi expediente</TabsTrigger>
        </TabsList>

        {canView && <TabsContent value="timeclock" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reloj marcador por PIN</CardTitle>
              <CardDescription>Entrada laboral, salida almuerzo, entrada almuerzo y salida laboral.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div><Label>PIN (4 dígitos)</Label><Input value={clockPin} onChange={(e) => setClockPin(e.target.value.replace(/\D/g, '').slice(0, 4))} maxLength={4} /></div>
                <div className="md:col-span-2"><Label>Notas</Label><Input value={clockNotes} onChange={(e) => setClockNotes(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Button onClick={() => registerPunch("clock_in")} disabled={!canEdit}>Entrada laboral</Button>
                <Button onClick={() => registerPunch("lunch_out")} disabled={!canEdit}>Salida almuerzo</Button>
                <Button onClick={() => registerPunch("lunch_in")} disabled={!canEdit}>Entrada almuerzo</Button>
                <Button onClick={() => registerPunch("clock_out")} disabled={!canEdit}>Salida laboral</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Configuración de asistencia (global o por sucursal)</CardTitle>
              <CardDescription>Define formato 12h/24h, tolerancias, horarios y anti doble toque para kiosco.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <Label>Ámbito</Label>
                  <Select value={attendanceSettingsForm.scope} onValueChange={(v) => setAttendanceSettingsForm({ ...attendanceSettingsForm, scope: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">Global</SelectItem>
                      <SelectItem value="branch">Por sucursal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Sucursal</Label>
                  <Select
                    value={attendanceSettingsForm.branch_id || "none"}
                    onValueChange={(v) => setAttendanceSettingsForm({ ...attendanceSettingsForm, branch_id: v === "none" ? "" : v })}
                    disabled={attendanceSettingsForm.scope !== "branch"}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Seleccionar</SelectItem>
                      {branches.map((branch) => <SelectItem key={branch.branch_id} value={branch.branch_id}>{branch.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Formato hora</Label>
                  <Select value={attendanceSettingsForm.time_format} onValueChange={(v) => setAttendanceSettingsForm({ ...attendanceSettingsForm, time_format: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24h">24h</SelectItem>
                      <SelectItem value="12h">12h</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tema kiosco</Label>
                  <Select value={attendanceSettingsForm.kiosk_theme_mode || "system"} onValueChange={(v) => setAttendanceSettingsForm({ ...attendanceSettingsForm, kiosk_theme_mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="system">Sistema</SelectItem>
                      <SelectItem value="light">Claro</SelectItem>
                      <SelectItem value="dark">Oscuro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Anti doble toque (seg)</Label>
                  <Input type="number" value={attendanceSettingsForm.anti_double_touch_seconds} onChange={(e) => setAttendanceSettingsForm({ ...attendanceSettingsForm, anti_double_touch_seconds: e.target.value })} />
                </div>
                <div><Label>Entrada</Label><Input value={attendanceSettingsForm.entry_start} onChange={(e) => setAttendanceSettingsForm({ ...attendanceSettingsForm, entry_start: e.target.value })} /></div>
                <div><Label>Tolerancia (min)</Label><Input type="number" value={attendanceSettingsForm.entry_tolerance_minutes} onChange={(e) => setAttendanceSettingsForm({ ...attendanceSettingsForm, entry_tolerance_minutes: e.target.value })} /></div>
                <div>
                  <Label>Deducción por tardanza</Label>
                  <Select
                    value={attendanceSettingsForm.late_arrival_deduction_enabled ? "enabled" : "disabled"}
                    onValueChange={(v) => setAttendanceSettingsForm({ ...attendanceSettingsForm, late_arrival_deduction_enabled: v === "enabled" })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="enabled">Activa</SelectItem>
                      <SelectItem value="disabled">Inactiva</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Monto deducción tardanza</Label>
                  <Input
                    type="number"
                    value={attendanceSettingsForm.late_arrival_deduction_amount}
                    onChange={(e) => setAttendanceSettingsForm({ ...attendanceSettingsForm, late_arrival_deduction_amount: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Moneda deducción</Label>
                  <Input
                    value={attendanceSettingsForm.late_arrival_deduction_currency}
                    onChange={(e) => setAttendanceSettingsForm({ ...attendanceSettingsForm, late_arrival_deduction_currency: e.target.value.toUpperCase().slice(0, 6) })}
                  />
                </div>
                <div><Label>Inicio almuerzo</Label><Input value={attendanceSettingsForm.lunch_out_start} onChange={(e) => setAttendanceSettingsForm({ ...attendanceSettingsForm, lunch_out_start: e.target.value })} /></div>
                <div><Label>Fin almuerzo</Label><Input value={attendanceSettingsForm.lunch_out_end} onChange={(e) => setAttendanceSettingsForm({ ...attendanceSettingsForm, lunch_out_end: e.target.value })} /></div>
                <div><Label>Duración almuerzo máx. (min)</Label><Input type="number" value={attendanceSettingsForm.lunch_break_minutes} onChange={(e) => setAttendanceSettingsForm({ ...attendanceSettingsForm, lunch_break_minutes: e.target.value })} /></div>
                <div><Label>Salida L-V</Label><Input value={attendanceSettingsForm.weekday_shift_end} onChange={(e) => setAttendanceSettingsForm({ ...attendanceSettingsForm, weekday_shift_end: e.target.value })} /></div>
                <div><Label>Salida sábado</Label><Input value={attendanceSettingsForm.saturday_shift_end} onChange={(e) => setAttendanceSettingsForm({ ...attendanceSettingsForm, saturday_shift_end: e.target.value })} /></div>
              </div>
              <div className="text-sm text-muted-foreground">
                Vista previa kiosco: {new Date().toLocaleTimeString("es-NI", { hour12: attendanceSettingsForm.time_format === "12h" })}
              </div>
              <Button onClick={saveAttendanceSettings} disabled={!canEdit}>Guardar configuración</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reporte quincenal de asistencia</CardTitle>
              <CardDescription>Tardanzas, ausencias y horas extra estimadas con exportación CSV, Excel y PDF (global o por sucursal).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                <div><Label>Inicio</Label><Input type="date" value={biweeklyRange.start_date} onChange={(e) => setBiweeklyRange({ ...biweeklyRange, start_date: e.target.value })} /></div>
                <div><Label>Fin</Label><Input type="date" value={biweeklyRange.end_date} onChange={(e) => setBiweeklyRange({ ...biweeklyRange, end_date: e.target.value })} /></div>
                <div>
                  <Label>Sucursal</Label>
                  <Select value={biweeklyBranchId} onValueChange={setBiweeklyBranchId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las sucursales</SelectItem>
                      {branches.map((branch) => (
                        <SelectItem key={branch.branch_id} value={branch.branch_id}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end"><Button variant="outline" onClick={loadBiweeklyReport}>Cargar reporte</Button></div>
                <div className="flex items-end"><Button onClick={() => exportBiweeklyReport("csv")} className="gap-2"><Download className="h-4 w-4" /> Exportar CSV</Button></div>
                <div className="flex items-end"><Button variant="outline" onClick={() => exportBiweeklyReport("excel")} className="gap-2"><Download className="h-4 w-4" /> Excel</Button></div>
                <div className="flex items-end"><Button variant="outline" onClick={() => exportBiweeklyReport("pdf")} className="gap-2"><Download className="h-4 w-4" /> PDF</Button></div>
              </div>

              {biweeklySummary && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Horas quincena</CardTitle></CardHeader><CardContent><div className="text-xl font-semibold">{formatHours(biweeklySummary.total_worked_hours)}</div></CardContent></Card>
                  <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Minutos tarde</CardTitle></CardHeader><CardContent><div className="text-xl font-semibold">{biweeklySummary.total_late_minutes ?? 0}</div></CardContent></Card>
                  <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Exceso almuerzo (min)</CardTitle></CardHeader><CardContent><div className="text-xl font-semibold">{biweeklySummary.total_lunch_over_minutes ?? 0}</div></CardContent></Card>
                  <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Ausencias</CardTitle></CardHeader><CardContent><div className="text-xl font-semibold">{biweeklySummary.total_absences ?? 0}</div></CardContent></Card>
                </div>
              )}

              {biweeklySummary?.compliance_counts && (
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Verde: {biweeklySummary.compliance_counts.verde ?? 0}</Badge>
                  <Badge variant="secondary">Amarillo: {biweeklySummary.compliance_counts.amarillo ?? 0}</Badge>
                  <Badge variant="destructive">Rojo: {biweeklySummary.compliance_counts.rojo ?? 0}</Badge>
                </div>
              )}

              {Array.isArray(biweeklySummary?.alerts) && biweeklySummary.alerts.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Alertas automáticas</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {biweeklySummary.alerts.slice(0, 8).map((alert, index) => (
                      <div key={`${alert.user_id || index}-${index}`} className="flex items-center justify-between gap-2 border rounded-md px-3 py-2">
                        <span className="text-sm">{alert.message}</span>
                        <Badge variant={getComplianceVariant(alert.severity)}>{alert.severity}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Table>
                <TableHeader><TableRow><TableHead>Usuario</TableHead><TableHead>Semáforo</TableHead><TableHead>Horas Semana</TableHead><TableHead>Horas Quincena</TableHead><TableHead>Δ Horas</TableHead><TableHead>Min tardanza</TableHead><TableHead>Δ Tardanza</TableHead><TableHead>Ausencias</TableHead><TableHead>Exceso almuerzo (min)</TableHead><TableHead>Δ Almuerzo</TableHead><TableHead>Horas extra (min)</TableHead><TableHead>Detalle</TableHead></TableRow></TableHeader>
                <TableBody>
                  {biweeklyRows.slice(0, 30).map((row) => (
                    <TableRow key={row.user_id}>
                      <TableCell>{getUserLabel(row.user_id)}</TableCell>
                      <TableCell><Badge variant={getComplianceVariant(row.compliance_status)}>{row.compliance_status || "-"}</Badge></TableCell>
                      <TableCell className="text-xs max-w-[260px]">{row.worked_hours_weekly_text || "-"}</TableCell>
                      <TableCell>{formatHours(row.worked_hours_biweekly)}</TableCell>
                      <TableCell>{formatDelta(row.compare_worked_hours_biweekly_delta, " h")}</TableCell>
                      <TableCell>{row.late_minutes || 0}</TableCell>
                      <TableCell>{formatDelta(row.compare_late_minutes_delta, " min")}</TableCell>
                      <TableCell>{row.absences}</TableCell>
                      <TableCell>{row.lunch_over_minutes || 0}</TableCell>
                      <TableCell>{formatDelta(row.compare_lunch_over_minutes_delta, " min")}</TableCell>
                      <TableCell>{row.estimated_overtime_minutes}</TableCell>
                      <TableCell><Button size="sm" variant="outline" onClick={() => setSelectedBiweeklyRow(row)}>Ver día a día</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {Array.isArray(biweeklySummary?.top_incidents) && biweeklySummary.top_incidents.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Top incidencias del periodo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader><TableRow><TableHead>Colaborador</TableHead><TableHead>Semáforo</TableHead><TableHead>Min tardanza</TableHead><TableHead>Exceso almuerzo</TableHead><TableHead>Ausencias</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {biweeklySummary.top_incidents.map((item, index) => (
                          <TableRow key={`${item.user_id || index}-incident`}>
                            <TableCell>{item.user_name || getUserLabel(item.user_id)}</TableCell>
                            <TableCell><Badge variant={getComplianceVariant(item.compliance_status)}>{item.compliance_status || "-"}</Badge></TableCell>
                            <TableCell>{item.late_minutes ?? 0}</TableCell>
                            <TableCell>{item.lunch_over_minutes ?? 0}</TableCell>
                            <TableCell>{item.absences ?? 0}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Incidencias automáticas de asistencia</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Usuario</TableHead><TableHead>Tipo</TableHead><TableHead>Detalle</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
                <TableBody>
                  {attendanceIncidents.slice(0, 30).map((item) => (
                    <TableRow key={item.incident_id}>
                      <TableCell>{item.created_at ? new Date(item.created_at).toLocaleString() : "-"}</TableCell>
                      <TableCell>{getUserLabel(item.user_id)}</TableCell>
                      <TableCell>{item.incident_type}</TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell><Badge variant={item.status === "open" ? "destructive" : "outline"}>{item.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Auditoría de cambios de configuración</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Ámbito</TableHead><TableHead>Sucursal</TableHead><TableHead>Usuario</TableHead></TableRow></TableHeader>
                <TableBody>
                  {settingsAudit.slice(0, 20).map((item) => (
                    <TableRow key={item.audit_id}>
                      <TableCell>{item.changed_at ? new Date(item.changed_at).toLocaleString() : "-"}</TableCell>
                      <TableCell>{item.scope}</TableCell>
                      <TableCell>{item.branch_id ? getBranchLabel(item.branch_id) : "Global"}</TableCell>
                      <TableCell>{item.changed_by}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Últimas marcaciones</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Usuario</TableHead><TableHead>Evento</TableHead><TableHead>Notas</TableHead></TableRow></TableHeader>
                <TableBody>
                  {clockEvents.slice(0, 20).map((item) => (
                    <TableRow key={item.clock_id}>
                      <TableCell>{item.created_at ? new Date(item.created_at).toLocaleString() : "-"}</TableCell>
                      <TableCell>{getUserLabel(item.user_id)}</TableCell>
                      <TableCell>{item.event_type}</TableCell>
                      <TableCell>{item.notes || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>}

        {canView && <TabsContent value="payroll" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Novedades de nómina</CardTitle><CardDescription>Horas extras, viáticos, subsidios, penalizaciones, multas, bonificaciones y sanciones.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <Label>Usuario</Label>
                  <Select value={adjustmentForm.user_id} onValueChange={(v) => setAdjustmentForm({ ...adjustmentForm, user_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>{users.map((u) => <SelectItem key={u.user_id} value={u.user_id}>{getUserLabel(u.user_id)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={adjustmentForm.adjustment_type} onValueChange={(v) => setAdjustmentForm({ ...adjustmentForm, adjustment_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[
                        "horas_extras", "viatico", "subsidio", "bonificacion", "penalizacion", "multa", "sancion",
                      ].map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Monto</Label><Input type="number" value={adjustmentForm.amount} onChange={(e) => setAdjustmentForm({ ...adjustmentForm, amount: e.target.value })} /></div>
                <div><Label>Notas</Label><Input value={adjustmentForm.notes} onChange={(e) => setAdjustmentForm({ ...adjustmentForm, notes: e.target.value })} /></div>
              </div>
              <Button onClick={createAdjustment} disabled={!canEdit}>Registrar ajuste</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Vacaciones / Permisos / Subsidios</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div>
                  <Label>Usuario</Label>
                  <Select value={leaveForm.user_id} onValueChange={(v) => setLeaveForm({ ...leaveForm, user_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>{users.map((u) => <SelectItem key={u.user_id} value={u.user_id}>{getUserLabel(u.user_id)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={leaveForm.leave_type} onValueChange={(v) => setLeaveForm({ ...leaveForm, leave_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vacaciones">vacaciones</SelectItem>
                      <SelectItem value="permiso">permiso</SelectItem>
                      <SelectItem value="subsidio">subsidio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Inicio</Label><Input type="date" value={leaveForm.start_date} onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })} /></div>
                <div><Label>Fin</Label><Input type="date" value={leaveForm.end_date} onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })} /></div>
                <div><Label>Notas</Label><Input value={leaveForm.notes} onChange={(e) => setLeaveForm({ ...leaveForm, notes: e.target.value })} /></div>
              </div>
              <Button onClick={createLeave} disabled={!canEdit}>Registrar ausencia</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Procesar nómina y comprobantes</CardTitle>
              <CardDescription>Genera colillas de pago con salario base, comisiones, INSS y deducciones.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <Label>Empleado</Label>
                  <Select value={payStubForm.user_id} onValueChange={(v) => setPayStubForm({ ...payStubForm, user_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>{users.map((u) => <SelectItem key={u.user_id} value={u.user_id}>{getUserLabel(u.user_id)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Inicio periodo</Label><Input type="date" value={payStubForm.period_start} onChange={(e) => setPayStubForm({ ...payStubForm, period_start: e.target.value })} /></div>
                <div><Label>Fin periodo</Label><Input type="date" value={payStubForm.period_end} onChange={(e) => setPayStubForm({ ...payStubForm, period_end: e.target.value })} /></div>
                <div className="flex items-end">
                  <Button onClick={processPayStub} disabled={!canEdit} className="w-full">Procesar nómina</Button>
                </div>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>Empleado</TableHead><TableHead>Periodo</TableHead><TableHead>Bruto</TableHead><TableHead>INSS</TableHead><TableHead>Neto</TableHead><TableHead>PDF</TableHead></TableRow></TableHeader>
                <TableBody>
                  {payStubs.slice(0, 30).map((item) => (
                    <TableRow key={item.stub_id}>
                      <TableCell>{item.user_name || getUserLabel(item.user_id)}</TableCell>
                      <TableCell>{item.period_label || `${item.period_start} - ${item.period_end}`}</TableCell>
                      <TableCell>{Number(item.gross_earnings || 0).toFixed(2)}</TableCell>
                      <TableCell>{Number(item.inss_amount || 0).toFixed(2)}</TableCell>
                      <TableCell>{Number(item.net_pay || 0).toFixed(2)}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => downloadPayStubPdf(item.stub_id)}>
                          <Download className="h-4 w-4 mr-1" />
                          PDF
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Ajustes de nómina registrados</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Empleado</TableHead><TableHead>Tipo</TableHead><TableHead>Monto</TableHead><TableHead>Notas</TableHead></TableRow></TableHeader>
                <TableBody>
                  {payrollAdjustments.slice(0, 30).map((item) => (
                    <TableRow key={item.adjustment_id}>
                      <TableCell>{formatDateTime(item.effective_date || item.created_at)}</TableCell>
                      <TableCell>{getUserLabel(item.user_id)}</TableCell>
                      <TableCell>{item.adjustment_type}</TableCell>
                      <TableCell>{Number(item.amount || 0).toFixed(2)}</TableCell>
                      <TableCell>{item.notes || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Ausencias / permisos registrados</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Empleado</TableHead><TableHead>Tipo</TableHead><TableHead>Inicio</TableHead><TableHead>Fin</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
                <TableBody>
                  {leaves.slice(0, 30).map((item) => (
                    <TableRow key={item.leave_id}>
                      <TableCell>{getUserLabel(item.user_id)}</TableCell>
                      <TableCell>{item.leave_type}</TableCell>
                      <TableCell>{item.start_date}</TableCell>
                      <TableCell>{item.end_date}</TableCell>
                      <TableCell>{item.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>}

        {canView && <TabsContent value="personnel" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Contrataciones / Despidos / Ascensos / Sanciones</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <div>
                  <Label>Acción</Label>
                  <Select value={personnelForm.action_type} onValueChange={(v) => setPersonnelForm({ ...personnelForm, action_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contratacion">contratación</SelectItem>
                      <SelectItem value="despido">despido</SelectItem>
                      <SelectItem value="ascenso">ascenso</SelectItem>
                      <SelectItem value="sancion">sanción</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Usuario ID</Label><Input value={personnelForm.user_id} onChange={(e) => setPersonnelForm({ ...personnelForm, user_id: e.target.value })} /></div>
                <div><Label>Nombre empleado</Label><Input value={personnelForm.employee_name} onChange={(e) => setPersonnelForm({ ...personnelForm, employee_name: e.target.value })} /></div>
                <div><Label>Rol anterior</Label><Input value={personnelForm.old_role} onChange={(e) => setPersonnelForm({ ...personnelForm, old_role: e.target.value })} /></div>
                <div><Label>Rol nuevo</Label><Input value={personnelForm.new_role} onChange={(e) => setPersonnelForm({ ...personnelForm, new_role: e.target.value })} /></div>
                <div><Label>Notas</Label><Input value={personnelForm.notes} onChange={(e) => setPersonnelForm({ ...personnelForm, notes: e.target.value })} /></div>
              </div>
              <Button onClick={createPersonnelAction} disabled={!canEdit}>Registrar movimiento de personal</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Histórico de movimientos</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Acción</TableHead><TableHead>Empleado</TableHead><TableHead>Cambio</TableHead></TableRow></TableHeader>
                <TableBody>
                  {personnelActions.slice(0, 20).map((item) => (
                    <TableRow key={item.action_id}>
                      <TableCell>{item.created_at ? new Date(item.created_at).toLocaleString() : "-"}</TableCell>
                      <TableCell>{item.action_type}</TableCell>
                      <TableCell>{item.employee_name || item.user_id || "-"}</TableCell>
                      <TableCell>{`${item.old_role || "-"} → ${item.new_role || "-"}`}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>}

        {canView && (
          <TabsContent value="drivers" className="space-y-4">
            <DriversManagementTab
              users={users}
              branches={branches}
              canEdit={canEdit}
              getUserLabel={getUserLabel}
              getBranchLabel={getBranchLabel}
            />
          </TabsContent>
        )}

        {canView && <TabsContent value="operations" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Gastos operativos</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div><Label>Categoría</Label><Input value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })} /></div>
                <div><Label>Descripción</Label><Input value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} /></div>
                <div><Label>Monto</Label><Input type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} /></div>
                <div>
                  <Label>Sucursal</Label>
                  <Select value={expenseForm.branch_id || "none"} onValueChange={(v) => setExpenseForm({ ...expenseForm, branch_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin sucursal</SelectItem>
                      {branches.map((branch) => <SelectItem key={branch.branch_id} value={branch.branch_id}>{branch.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={createExpense} disabled={!canEdit}>Registrar gasto</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Órdenes de compra de insumos</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div><Label>Proveedor</Label><Input value={poForm.supplier} onChange={(e) => setPoForm({ ...poForm, supplier: e.target.value })} /></div>
                <div><Label>Insumo</Label><Input value={poForm.item_name} onChange={(e) => setPoForm({ ...poForm, item_name: e.target.value })} /></div>
                <div><Label>Cantidad</Label><Input type="number" value={poForm.quantity} onChange={(e) => setPoForm({ ...poForm, quantity: e.target.value })} /></div>
                <div><Label>Costo unitario</Label><Input type="number" value={poForm.unit_cost} onChange={(e) => setPoForm({ ...poForm, unit_cost: e.target.value })} /></div>
                <div><Label>Notas</Label><Input value={poForm.notes} onChange={(e) => setPoForm({ ...poForm, notes: e.target.value })} /></div>
              </div>
              <Button onClick={createPurchaseOrder} disabled={!canEdit}>Registrar orden</Button>
            </CardContent>
          </Card>
        </TabsContent>}

        {canView && <TabsContent value="tools" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Inventario de herramientas por técnico</CardTitle><CardDescription>Instalador, eléctrico y polarizador.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div>
                  <Label>Técnico</Label>
                  <Select value={toolAssignForm.technician_id} onValueChange={(v) => setToolAssignForm({ ...toolAssignForm, technician_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {technicianUsers.map((u) => <SelectItem key={u.user_id} value={u.user_id}>{getUserLabel(u.user_id)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo técnico</Label>
                  <Select value={toolAssignForm.category} onValueChange={(v) => setToolAssignForm({ ...toolAssignForm, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instalador">instalador</SelectItem>
                      <SelectItem value="electrico">eléctrico</SelectItem>
                      <SelectItem value="polarizador">polarizador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Herramienta</Label><Input value={toolAssignForm.tool_name} onChange={(e) => setToolAssignForm({ ...toolAssignForm, tool_name: e.target.value })} /></div>
                <div><Label>Serial</Label><Input value={toolAssignForm.serial} onChange={(e) => setToolAssignForm({ ...toolAssignForm, serial: e.target.value })} /></div>
                <div><Label>Costo</Label><Input type="number" value={toolAssignForm.unit_cost} onChange={(e) => setToolAssignForm({ ...toolAssignForm, unit_cost: e.target.value })} /></div>
              </div>
              <Button onClick={assignTool} disabled={!canEdit}>Asignar herramienta</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Auditoría quincenal y descuentos automáticos</CardTitle><CardDescription>Las herramientas faltantes se descuentan del salario al aplicar deducciones.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>Técnico</Label>
                  <Select value={toolAuditForm.technician_id} onValueChange={(v) => setToolAuditForm({ ...toolAuditForm, technician_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {technicianUsers.map((u) => <SelectItem key={u.user_id} value={u.user_id}>{getUserLabel(u.user_id)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label>Seriales encontrados (separados por coma)</Label>
                  <Textarea rows={2} value={toolAuditForm.found_serials} onChange={(e) => setToolAuditForm({ ...toolAuditForm, found_serials: e.target.value })} />
                </div>
              </div>
              <Button onClick={runAudit} disabled={!canEdit}>Registrar auditoría</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Auditorías recientes</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Técnico</TableHead><TableHead>Faltantes</TableHead><TableHead>Monto faltante</TableHead><TableHead>Estado</TableHead><TableHead>Acción</TableHead></TableRow></TableHeader>
                <TableBody>
                  {toolAudits.slice(0, 20).map((item) => (
                    <TableRow key={item.audit_id}>
                      <TableCell>{item.created_at ? new Date(item.created_at).toLocaleString() : "-"}</TableCell>
                      <TableCell>{getUserLabel(item.technician_id)}</TableCell>
                      <TableCell>{item.missing_count}</TableCell>
                      <TableCell>{Number(item.missing_cost_total || 0).toFixed(2)}</TableCell>
                      <TableCell><Badge variant={item.status === "pending_deduction" ? "destructive" : "outline"}>{item.status}</Badge></TableCell>
                      <TableCell>
                        {item.status === "pending_deduction" ? (
                          <Button size="sm" onClick={() => applyDeductions(item.audit_id)} disabled={!canEdit}>Aplicar descuentos</Button>
                        ) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>}

        {canView && <TabsContent value="schedule" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Programación de auditorías (2 veces al mes)</CardTitle><CardDescription>Control quincenal por técnico: próximos vencimientos y retrasos.</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Técnico</TableHead><TableHead>Rol</TableHead><TableHead>Última auditoría</TableHead><TableHead>Próxima auditoría</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
                <TableBody>
                  {toolSchedule.map((item) => (
                    <TableRow key={item.technician_id}>
                      <TableCell>{getUserLabel(item.technician_id)}</TableCell>
                      <TableCell>{getRoleLabel(item.role)}</TableCell>
                      <TableCell>{item.last_audit_at ? new Date(item.last_audit_at).toLocaleString() : "-"}</TableCell>
                      <TableCell>{item.next_due_at ? new Date(item.next_due_at).toLocaleString() : "-"}</TableCell>
                      <TableCell>
                        <Badge variant={item.overdue ? "destructive" : "outline"}>{item.overdue ? "Vencida" : "Al día"}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>}

        <TabsContent value="my" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Mi expediente</CardTitle>
              <CardDescription>Consulta tus incidencias, amonestaciones, vacaciones y comisiones estimadas.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Incidencias</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{myOverview?.incidents?.length ?? 0}</div></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Amonestaciones</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{myOverview?.sanctions?.length ?? 0}</div></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Vacaciones disponibles</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{myOverview?.vacations?.available_days ?? 0} días</div></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Comisión estimada</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{Number(myOverview?.sales_commissions?.estimated_commission || 0).toFixed(2)}</div></CardContent></Card>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Mis incidencias de asistencia</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Tipo</TableHead><TableHead>Detalle</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(myOverview?.incidents || []).slice(0, 30).map((item) => (
                    <TableRow key={item.incident_id}>
                      <TableCell>{formatDateTime(item.created_at)}</TableCell>
                      <TableCell>{item.incident_type || "-"}</TableCell>
                      <TableCell>{item.description || "-"}</TableCell>
                      <TableCell><Badge variant={item.status === "open" ? "destructive" : "outline"}>{item.status || "-"}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Mis notificaciones</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Categoría</TableHead><TableHead>Título</TableHead><TableHead>Mensaje</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(myOverview?.notifications || []).slice(0, 30).map((item) => (
                    <TableRow key={item.notification_id || `${item.created_at}-${item.title}`}>
                      <TableCell>{formatDateTime(item.created_at)}</TableCell>
                      <TableCell>{item.category || "-"}</TableCell>
                      <TableCell>{item.title || "-"}</TableCell>
                      <TableCell>{item.message || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Mis comprobantes de pago</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Periodo</TableHead><TableHead>Bruto</TableHead><TableHead>INSS</TableHead><TableHead>Neto</TableHead><TableHead>PDF</TableHead></TableRow></TableHeader>
                <TableBody>
                  {myPayStubs.slice(0, 20).map((item) => (
                    <TableRow key={item.stub_id}>
                      <TableCell>{item.period_label || `${item.period_start} - ${item.period_end}`}</TableCell>
                      <TableCell>{Number(item.gross_earnings || 0).toFixed(2)}</TableCell>
                      <TableCell>{Number(item.inss_amount || 0).toFixed(2)}</TableCell>
                      <TableCell>{Number(item.net_pay || 0).toFixed(2)}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => downloadPayStubPdf(item.stub_id)}>
                          <Download className="h-4 w-4 mr-1" />
                          PDF
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Mis deducciones y ajustes de nómina</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Tipo</TableHead><TableHead>Monto</TableHead><TableHead>Moneda</TableHead><TableHead>Detalle</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(myOverview?.payroll_adjustments || []).slice(0, 30).map((item) => (
                    <TableRow key={item.adjustment_id || `${item.created_at}-${item.adjustment_type}`}>
                      <TableCell>{formatDateTime(item.created_at || item.effective_date)}</TableCell>
                      <TableCell>{item.adjustment_type || "-"}</TableCell>
                      <TableCell>{Number(item.amount || 0).toFixed(2)}</TableCell>
                      <TableCell>{item.currency || "NIO"}</TableCell>
                      <TableCell>{item.notes || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Mis amonestaciones</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Tipo</TableHead><TableHead>Detalle</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(myOverview?.sanctions || []).slice(0, 30).map((item) => (
                    <TableRow key={item.action_id}>
                      <TableCell>{formatDateTime(item.created_at)}</TableCell>
                      <TableCell>{item.action_type || "-"}</TableCell>
                      <TableCell>{item.notes || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Mis comisiones de ventas</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="border rounded-md px-3 py-2 text-sm">Tasa: {(Number(myOverview?.sales_commissions?.commission_rate || 0) * 100).toFixed(2)}%</div>
                <div className="border rounded-md px-3 py-2 text-sm">Total ventas: {Number(myOverview?.sales_commissions?.total_sales || 0).toFixed(2)}</div>
                <div className="border rounded-md px-3 py-2 text-sm">Comisión estimada: {Number(myOverview?.sales_commissions?.estimated_commission || 0).toFixed(2)}</div>
                <div className="border rounded-md px-3 py-2 text-sm">Ventas registradas: {myOverview?.sales_commissions?.sales_count ?? 0}</div>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>ID Venta</TableHead><TableHead>Total</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(myOverview?.sales_commissions?.recent_sales || []).slice(0, 20).map((item) => (
                    <TableRow key={item.sale_id || `${item.created_at}-${item.total}`}>
                      <TableCell>{formatDateTime(item.created_at)}</TableCell>
                      <TableCell>{item.sale_id || "-"}</TableCell>
                      <TableCell>{Number(item.total || 0).toFixed(2)}</TableCell>
                      <TableCell>{item.status || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Mis vacaciones</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="border rounded-md px-3 py-2 text-sm">Asignadas: {myOverview?.vacations?.allowance_days ?? 0} días</div>
                <div className="border rounded-md px-3 py-2 text-sm">Usadas: {myOverview?.vacations?.used_days ?? 0} días</div>
                <div className="border rounded-md px-3 py-2 text-sm">Disponibles: {myOverview?.vacations?.available_days ?? 0} días</div>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>Inicio</TableHead><TableHead>Fin</TableHead><TableHead>Estado</TableHead><TableHead>Notas</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(myOverview?.vacations?.records || []).slice(0, 20).map((item, index) => (
                    <TableRow key={`${item.start_date || index}-${item.end_date || index}`}>
                      <TableCell>{item.start_date || "-"}</TableCell>
                      <TableCell>{item.end_date || "-"}</TableCell>
                      <TableCell>{item.status || "-"}</TableCell>
                      <TableCell>{item.notes || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(selectedBiweeklyRow)} onOpenChange={(open) => !open && setSelectedBiweeklyRow(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Detalle diario de asistencia</DialogTitle>
            <DialogDescription>
              {selectedBiweeklyRow ? `${selectedBiweeklyRow.user_name || selectedBiweeklyRow.user_id} · Semáforo ${selectedBiweeklyRow.compliance_status || "-"}` : "-"}
            </DialogDescription>
          </DialogHeader>
          {selectedBiweeklyRow && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <div className="border rounded-md px-3 py-2">Horas quincena: {formatHours(selectedBiweeklyRow.worked_hours_biweekly)}</div>
                <div className="border rounded-md px-3 py-2">Min tardanza: {selectedBiweeklyRow.late_minutes || 0}</div>
                <div className="border rounded-md px-3 py-2">Exceso almuerzo: {selectedBiweeklyRow.lunch_over_minutes || 0}</div>
                <div className="border rounded-md px-3 py-2">Ausencias: {selectedBiweeklyRow.absences || 0}</div>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Entrada</TableHead><TableHead>Salida almuerzo</TableHead><TableHead>Entrada almuerzo</TableHead><TableHead>Salida</TableHead><TableHead>Horas</TableHead><TableHead>Tarde (min)</TableHead><TableHead>Exceso almuerzo</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(selectedBiweeklyRow.daily_details || []).map((item, index) => (
                    <TableRow key={`${item.date || index}-${index}`}>
                      <TableCell>{item.date || "-"}</TableCell>
                      <TableCell>{formatDateTime(item.clock_in)}</TableCell>
                      <TableCell>{formatDateTime(item.lunch_out)}</TableCell>
                      <TableCell>{formatDateTime(item.lunch_in)}</TableCell>
                      <TableCell>{formatDateTime(item.clock_out)}</TableCell>
                      <TableCell>{formatHours(item.worked_hours)}</TableCell>
                      <TableCell>{item.late_minutes || 0}</TableCell>
                      <TableCell>{item.lunch_over_minutes || 0}</TableCell>
                      <TableCell><Badge variant={item.status === "ausente" ? "destructive" : "outline"}>{item.status || "-"}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {loading && <p className="text-sm text-muted-foreground">Cargando módulo de RRHH...</p>}
    </div>
  );
}
