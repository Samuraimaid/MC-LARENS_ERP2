import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { formatCurrency, ROLES } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { ContextualDialogHeader } from "../components/ui/contextual-dialog-header";
import {
  Package,
  Download,
  AlertTriangle,
  RefreshCw,
  ArrowRightLeft,
  Edit,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { toast } from "sonner";
import { API_BASE as API } from "@/lib/api";
import { fetchEffectiveUsdNioRate, DEFAULT_USD_NIO_RATE } from "@/lib/exchangeRate";
import { FlowHealthPanel } from "@/components/ops/FlowHealthPanel";

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isWarehouseRole = user?.role === "bodegas";
  const canSeeFlowHealth = ["gerencia", "supervisor", "programador", "jefe_tienda"].includes(
    String(user?.role || "").toLowerCase()
  );

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [rolesMap, setRolesMap] = useState(ROLES);

  const [exchangeRate, setExchangeRate] = useState(DEFAULT_USD_NIO_RATE);
  const [showRateDialog, setShowRateDialog] = useState(false);
  const [newRate, setNewRate] = useState("");
  const [ratePeriod, setRatePeriod] = useState("day");
  const [chartRange, setChartRange] = useState("day");

  useEffect(() => {
    fetchStats();
    fetchExchangeRate();
    (async () => {
      try {
        const res = await axios.get(`${API}/roles`, { withCredentials: true });
        if (res?.data) setRolesMap(res.data);
      } catch {
        // fallback a ROLES local
      }
    })();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/stats`, {
        withCredentials: true,
      });
      setStats(response.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExchangeRate = async () => {
    const rate = await fetchEffectiveUsdNioRate({ withCredentials: true, fallback: DEFAULT_USD_NIO_RATE });
    setExchangeRate(rate);
  };

  const updateExchangeRate = async () => {
    if (!newRate || Number.isNaN(parseFloat(newRate))) {
      toast.error("Ingresa una tasa válida");
      return;
    }

    try {
      await axios.put(
        `${API}/currencies/rates`,
        {
          from_currency: "USD",
          to_currency: "NIO",
          rate: parseFloat(newRate),
        },
        { withCredentials: true }
      );

      setExchangeRate(parseFloat(newRate));
      toast.success(`Tipo de cambio actualizado a ${newRate}`);
      setShowRateDialog(false);
      setNewRate("");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al actualizar tipo de cambio");
    }
  };

  const seedData = async () => {
    setSeeding(true);
    try {
      const response = await axios.post(`${API}/seed`, {}, { withCredentials: true });
      const seeded = response?.data?.seeded || {};
      const customers = seeded.customers || 0;
      const vehicles = seeded.vehicles || 0;
      toast.success(`Datos de prueba creados: ${customers} clientes y ${vehicles} vehículos`);
      fetchStats();
    } catch {
      toast.error("Error al crear datos de prueba");
    } finally {
      setSeeding(false);
    }
  };

  const downloadExcelBackup = async () => {
    setBackingUp(true);
    try {
      const response = await axios.get(`${API}/backup/excel`, {
        withCredentials: true,
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `erp_full_backup_${new Date().toISOString().replace(/[:.]/g, "-")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Respaldo Excel descargado");
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudo descargar respaldo");
    } finally {
      setBackingUp(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gradient-to-br from-slate-100 via-blue-50 to-cyan-50 rounded-xl">
        <RefreshCw className="h-8 w-8 animate-spin text-sky-700" />
      </div>
    );
  }

  const rangeMultiplier = chartRange === "week" ? 7 : chartRange === "month" ? 30 : 1;
  const kpi = {
    sales: (stats?.sales_today?.count || 0) * rangeMultiplier,
    workOrders: (stats?.pending_work_orders || 0) * rangeMultiplier,
    deliveries: (stats?.pending_deliveries || 0) * rangeMultiplier,
    returns: (stats?.returns_today || 0) * rangeMultiplier,
    lowStock: stats?.low_stock_items || 0,
  };

  const lineData = [
    { name: "Ventas", actual: kpi.sales, target: Math.max(1, Math.round(kpi.sales * 0.9)) },
    { name: "Órdenes", actual: kpi.workOrders, target: Math.max(1, Math.round(kpi.workOrders * 0.85)) },
    { name: "Entregas", actual: kpi.deliveries, target: Math.max(1, Math.round(kpi.deliveries * 0.8)) },
    { name: "Devol.", actual: kpi.returns, target: Math.max(1, Math.round(kpi.returns * 0.75)) },
  ];

  const barData = [
    { name: "Ventas", value: kpi.sales, threshold: 12 },
    { name: "Órdenes", value: kpi.workOrders, threshold: 10 },
    { name: "Entregas", value: kpi.deliveries, threshold: 8 },
    { name: "Devol.", value: kpi.returns, threshold: 6 },
    { name: "Stock", value: kpi.lowStock, threshold: 4 },
  ];

  const getBarColor = (item) => {
    if (item.value <= 0) return "#94a3b8";
    if (item.value >= item.threshold) return "#ef4444";
    if (item.value >= item.threshold * 0.6) return "#f59e0b";
    return "#0ea5e9";
  };

  const avgActual = lineData.reduce((acc, cur) => acc + cur.actual, 0) / lineData.length;
  const avgTarget = lineData.reduce((acc, cur) => acc + cur.target, 0) / lineData.length;
  const actualLineColor = avgActual > avgTarget ? "#ef4444" : "#0ea5e9";

  const alerts = [
    {
      id: "deliveries",
      label: "Entregas pendientes",
      value: stats?.pending_deliveries || 0,
      note: "Revisar rutas y prioridades de despacho",
      route: "/dispatch",
      level: (stats?.pending_deliveries || 0) > 8 ? "alta" : "media",
    },
    {
      id: "workOrders",
      label: "Órdenes de trabajo",
      value: stats?.pending_work_orders || 0,
      note: "Evaluar capacidad del equipo técnico",
      route: "/work-orders",
      level: (stats?.pending_work_orders || 0) > 10 ? "alta" : "media",
    },
    {
      id: "stock",
      label: "Productos en stock bajo",
      value: stats?.low_stock_items || 0,
      note: "Ajustar reposición en inventario",
      route: "/inventory",
      level: (stats?.low_stock_items || 0) > 0 ? "alta" : "baja",
    },
    {
      id: "returns",
      label: "Devoluciones",
      value: stats?.returns_today || 0,
      note: "Validar causas y acciones correctivas",
      route: "/returns",
      level: (stats?.returns_today || 0) > 4 ? "media" : "baja",
    },
  ];

  const rangeButtons = [
    { key: "day", label: "Hoy" },
    { key: "week", label: "Semana" },
    { key: "month", label: "Mes" },
  ];

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-slate-100 via-blue-50 to-cyan-50 min-h-full rounded-xl" data-testid="dashboard-page">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
        <div className="absolute inset-y-0 left-0 w-2 bg-gradient-to-b from-sky-600 via-indigo-600 to-slate-800" />
        <div className="p-5 md:p-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-1">Control Center</p>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
            <div className="text-slate-600 flex items-center gap-2 mt-1">
              <span>Bienvenido, {user?.name}</span>
              <Badge variant="outline" className="capitalize border-slate-300 text-slate-700 bg-slate-50">
                {(rolesMap && rolesMap[user?.role]?.label) || ROLES[user?.role]?.label || user?.role}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="border-sky-200 text-sky-800 hover:bg-sky-50"
              onClick={downloadExcelBackup}
              disabled={backingUp}
              data-testid="download-backup-btn"
            >
              {backingUp ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Descargar Respaldo
            </Button>
            <Button
              variant="outline"
              className="border-indigo-200 text-indigo-800 hover:bg-indigo-50"
              onClick={seedData}
              disabled={seeding}
              data-testid="seed-data-btn"
            >
              {seeding ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Package className="h-4 w-4 mr-2" />}
              Cargar Datos Prueba
            </Button>
          </div>
        </div>
      </div>

      {canSeeFlowHealth ? (
        <div className="space-y-2">
          <FlowHealthPanel compact autoRefreshMs={45000} />
          <div className="flex justify-end">
            <Button
              variant="link"
              className="text-sky-800"
              onClick={() => navigate("/ops/flow-health")}
              data-testid="flow-health-open-full"
            >
              Ver panel completo de salud del flujo
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 lg:col-span-9 border-slate-200 bg-white/90 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="font-heading text-2xl font-black tracking-[0.02em] text-slate-900">Actividad Operativa</CardTitle>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">KPI y Tendencias en Tiempo Real</p>
              </div>
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                {rangeButtons.map((item) => (
                  <Button
                    key={item.key}
                    variant={chartRange === item.key ? "default" : "ghost"}
                    size="sm"
                    className={chartRange === item.key ? "bg-slate-900 text-white hover:bg-slate-800" : "text-slate-600"}
                    onClick={() => setChartRange(item.key)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 h-72">
                <div className="text-sm font-semibold text-slate-700 mb-2">Tendencia Comparativa</div>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={lineData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dbe5f0" />
                    <XAxis dataKey="name" tick={{ fill: "#475569", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#475569", fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="actual" stroke={actualLineColor} strokeWidth={3} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="target" stroke="#6366f1" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 h-72">
                <div className="text-sm font-semibold text-slate-700 mb-2">Distribución Operativa</div>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={barData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dbe5f0" />
                    <XAxis dataKey="name" tick={{ fill: "#475569", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#475569", fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {barData.map((entry) => (
                        <Cell key={entry.name} fill={getBarColor(entry)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-12 lg:col-span-3 border-slate-200 bg-slate-900 text-slate-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-xl font-black tracking-[0.02em] text-slate-100">Centro de Alertas</CardTitle>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Resumen Operativo</p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {alerts.map((alert) => (
              <button
                key={alert.id}
                type="button"
                onClick={() => navigate(alert.route)}
                className="w-full text-left rounded-md border border-slate-700 p-2.5 bg-slate-800/60 hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-slate-200 text-xs uppercase tracking-wide">{alert.label}</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] border-none ${
                      alert.level === "alta"
                        ? "bg-rose-500/20 text-rose-300"
                        : alert.level === "media"
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-emerald-500/20 text-emerald-300"
                    }`}
                  >
                    {alert.level}
                  </Badge>
                </div>
                <div className="text-xl font-semibold mt-1">{alert.value}</div>
                <div className="text-[11px] text-slate-400 mt-1">{alert.note}</div>
              </button>
            ))}

            <div className="rounded-md border border-slate-700 p-3 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Ingreso del día</span>
                <span className="font-semibold">{formatCurrency(stats?.sales_today?.total || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Crédito pendiente</span>
                <span className="font-semibold">{formatCurrency(stats?.credit_pending || 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Tipo de cambio</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold flex items-center gap-1">
                    <ArrowRightLeft className="h-3 w-3" />
                    {exchangeRate.toFixed(2)}
                  </span>
                  <Dialog open={showRateDialog} onOpenChange={setShowRateDialog}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-5 w-5 text-slate-300 hover:text-white" title="Editar tipo de cambio">
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <ContextualDialogHeader
                        variant="warning"
                        size="inline"
                        title="Actualizar Tipo de Cambio"
                        description="Define la nueva tasa NIO por 1 USD."
                      />
                      <div className="space-y-4">
                        <div>
                          <Label>Nueva Tasa (NIO por 1 USD)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={newRate}
                            onChange={(e) => setNewRate(e.target.value)}
                            placeholder={exchangeRate.toString()}
                          />
                        </div>
                        <div>
                          <Label>Período de Vigencia</Label>
                          <Select value={ratePeriod} onValueChange={setRatePeriod}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="day">Solo Hoy</SelectItem>
                              <SelectItem value="week">Esta Semana</SelectItem>
                              <SelectItem value="month">Este Mes</SelectItem>
                              <SelectItem value="year">Este Año</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button onClick={updateExchangeRate} className="w-full">Actualizar Tipo de Cambio</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
