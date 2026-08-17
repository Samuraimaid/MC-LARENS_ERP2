import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { API_BASE as API } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
import { formatQuincenaLabel, getQuincenaIsoRange } from "@/lib/payrollPeriods";
import { TechnicianKioskNav } from "@/components/technician/TechnicianKioskNav";

const ROLES_LABEL = {
  instalaciones: "Instalador",
  instalador: "Instalador",
  electrico: "Eléctrico",
  polarizador: "Polarizador",
};
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  Palette,
  RefreshCw,
  Wrench,
  Zap,
} from "lucide-react";

const SUPERVISOR_ROLES = [
  "gerencia",
  "supervisor",
  "coordinador_instalaciones",
  "coordinador_polarizados",
];

const TECHNICIAN_ROLES = ["instalaciones", "electrico", "polarizador", "instalador"];

const DEPARTMENT_META = {
  instalaciones: {
    label: "Instalación",
    icon: Wrench,
    badge: "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200",
  },
  electrico: {
    label: "Eléctrico",
    icon: Zap,
    badge: "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200",
  },
  polarizados: {
    label: "Polarizado",
    icon: Palette,
    badge: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-500/20 dark:text-fuchsia-200",
  },
};

function todayIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function monthStartIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

const PERIOD_PRESETS = {
  current_quincena: () => getQuincenaIsoRange(new Date(), 0),
  previous_quincena: () => getQuincenaIsoRange(new Date(), -1),
  this_month: () => ({ dateFrom: monthStartIso(), dateTo: todayIso() }),
};

export function TechnicianCompletedJobsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const [technicians, setTechnicians] = useState([]);
  const [selectedTechnician, setSelectedTechnician] = useState("");
  const initialQuincena = getQuincenaIsoRange(new Date(), 0);
  const [dateFrom, setDateFrom] = useState(initialQuincena.dateFrom);
  const [dateTo, setDateTo] = useState(initialQuincena.dateTo);
  const [periodPreset, setPeriodPreset] = useState("current_quincena");

  const isSupervisor = SUPERVISOR_ROLES.includes(String(user?.role || "").toLowerCase());
  const isTechnicianKiosk = TECHNICIAN_ROLES.includes(String(user?.role || "").toLowerCase());

  const fetchTechnicians = useCallback(async () => {
    if (!isSupervisor) return;
    try {
      const response = await axios.get(`${API}/users`, { withCredentials: true });
      const list = (response.data || []).filter((u) =>
        TECHNICIAN_ROLES.includes(String(u.role || "").toLowerCase())
      );
      setTechnicians(list);
    } catch {
      setTechnicians([]);
    }
  }, [isSupervisor]);

  const fetchJobs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      if (isSupervisor && selectedTechnician) {
        params.set("technician_id", selectedTechnician);
      }
      const query = params.toString() ? `?${params.toString()}` : "";
      const response = await axios.get(`${API}/technician/completed-jobs${query}`, {
        withCredentials: true,
      });
      setData(response.data);
    } catch (error) {
      const detail = error?.response?.data?.detail;
      toast.error(detail || "Error al cargar trabajos realizados");
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateFrom, dateTo, isSupervisor, selectedTechnician]);

  useEffect(() => {
    fetchTechnicians();
  }, [fetchTechnicians]);

  useEffect(() => {
    setLoading(true);
    fetchJobs();
  }, [fetchJobs]);

  const summary = data?.summary || {};
  const jobs = data?.jobs || [];

  const applyPreset = (presetKey) => {
    const preset = PERIOD_PRESETS[presetKey];
    if (!preset) return;
    const { dateFrom: from, dateTo: to } = preset();
    setPeriodPreset(presetKey);
    setDateFrom(from);
    setDateTo(to);
  };

  const quincenaLabel =
    summary.quincena_label ||
    (summary.quincena_start && summary.quincena_end
      ? formatQuincenaLabel(
          new Date(`${summary.quincena_start}T12:00:00`),
          new Date(`${summary.quincena_end}T12:00:00`)
        )
      : null);

  const summaryCards = useMemo(() => {
    const cards = [
      {
        key: "quincena",
        label: quincenaLabel ? `Quincena ${quincenaLabel}` : "Quincena actual",
        value: summary.quincena_total ?? summary.total ?? 0,
        tone: "border-violet-200 bg-violet-50/70 dark:border-violet-500/30 dark:bg-violet-500/10",
        valueTone: "text-violet-700 dark:text-violet-300",
      },
      {
        key: "today",
        label: "Hoy",
        value: summary.today ?? 0,
        tone: "border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/30 dark:bg-emerald-500/10",
        valueTone: "text-emerald-700 dark:text-emerald-300",
      },
      {
        key: "prev_quincena",
        label: summary.previous_quincena_label
          ? `Ant. ${summary.previous_quincena_label}`
          : "Quincena anterior",
        value: summary.previous_quincena_total ?? 0,
        tone: "border-slate-200 bg-slate-50/70 dark:border-slate-500/30 dark:bg-slate-500/10",
        valueTone: "text-slate-700 dark:text-slate-300",
      },
      {
        key: "total",
        label: "En el filtro",
        value: summary.total ?? 0,
        tone: "border-blue-200 bg-blue-50/70 dark:border-blue-500/30 dark:bg-blue-500/10",
        valueTone: "text-blue-700 dark:text-blue-300",
      },
    ];

    if (summary.tint_vehicles > 0 || String(user?.role) === "polarizador") {
      cards.push({
        key: "vehicles",
        label: "Vehículos polarizados",
        value: summary.tint_vehicles ?? 0,
        tone: "border-fuchsia-200 bg-fuchsia-50/70 dark:border-fuchsia-500/30 dark:bg-fuchsia-500/10",
        valueTone: "text-fuchsia-700 dark:text-fuchsia-300",
      });
    }

    return cards;
  }, [summary, user?.role, quincenaLabel]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchJobs();
  };

  const roleLabel = ROLES_LABEL[data?.technician_role] || data?.technician_role || user?.role;

  return (
    <div
      className={cn(
        "space-y-6 p-4 md:p-6",
        isTechnicianKiosk && "pb-24"
      )}
      data-testid="technician-completed-jobs-page"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-primary" />
            Mis Trabajos Realizados
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Conteo de trabajos QC aprobados · quincena con corte día 9 y 24.
            {data?.technician_name ? (
              <span className="ml-1 font-medium text-foreground">
                {data.technician_name}
                {roleLabel ? ` · ${roleLabel}` : ""}
              </span>
            ) : null}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className={erpActionButtonClass("refresh")}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          Actualizar
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={periodPreset === "current_quincena" ? "default" : "outline"}
              onClick={() => applyPreset("current_quincena")}
            >
              Quincena actual
            </Button>
            <Button
              type="button"
              size="sm"
              variant={periodPreset === "previous_quincena" ? "default" : "outline"}
              onClick={() => applyPreset("previous_quincena")}
            >
              Quincena anterior
            </Button>
            <Button
              type="button"
              size="sm"
              variant={periodPreset === "this_month" ? "default" : "outline"}
              onClick={() => applyPreset("this_month")}
            >
              Este mes
            </Button>
          </div>
          <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="date-from">Desde</Label>
            <Input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setPeriodPreset("custom");
                setDateFrom(e.target.value);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date-to">Hasta</Label>
            <Input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(e) => {
                setPeriodPreset("custom");
                setDateTo(e.target.value);
              }}
            />
          </div>
          {isSupervisor ? (
            <div className="space-y-1.5 min-w-[220px]">
              <Label>Técnico</Label>
              <Select
                value={selectedTechnician || "__self__"}
                onValueChange={(value) =>
                  setSelectedTechnician(value === "__self__" ? "" : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Mi historial" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__self__">Mi historial</SelectItem>
                  {technicians.map((tech) => (
                    <SelectItem key={tech.user_id} value={tech.user_id}>
                      {tech.name} ({ROLES_LABEL[tech.role] || tech.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.key} className={cn("border", card.tone)}>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <p className={cn("text-3xl font-bold mt-1", card.valueTone)}>{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {summary.by_department ? (
        <div className="flex flex-wrap gap-2">
          {Object.entries(summary.by_department)
            .filter(([, count]) => count > 0)
            .map(([dept, count]) => {
              const meta = DEPARTMENT_META[dept] || DEPARTMENT_META.instalaciones;
              const Icon = meta.icon;
              return (
                <Badge key={dept} variant="outline" className={cn("gap-1.5 px-3 py-1", meta.badge)}>
                  <Icon className="h-3.5 w-3.5" />
                  {meta.label}: {count}
                </Badge>
              );
            })}
        </div>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Detalle de trabajos ({jobs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
            </div>
          ) : jobs.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              No hay trabajos completados en el período seleccionado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Vehículo</TableHead>
                    <TableHead className="text-right">Unidades</TableHead>
                    <TableHead className="text-right">Calidad</TableHead>
                    <TableHead>Aprobación</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => {
                    const dept = job.department || "instalaciones";
                    const meta = DEPARTMENT_META[dept] || DEPARTMENT_META.instalaciones;
                    const Icon = meta.icon;
                    const units =
                      job.job_type === "tint_order"
                        ? job.vehicle_count || 1
                        : job.item_count || 1;
                    const quality =
                      job.quality_score ?? job.quality_rating ?? "—";
                    const approvalLabel =
                      job.job_type === "work_order"
                        ? job.qc_approved_by_name
                          ? `Coord. ${job.qc_approved_by_name}`
                          : "Aprobado QC"
                        : "Completado";

                    return (
                      <TableRow key={`${job.job_type}-${job.job_id}`}>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(job.completed_at)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("gap-1", meta.badge)}>
                            <Icon className="h-3 w-3" />
                            {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{job.job_id}</TableCell>
                        <TableCell>{job.customer_name || "—"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {typeof job.vehicle_info === "string"
                            ? job.vehicle_info
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">{units}</TableCell>
                        <TableCell className="text-right">{quality}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {approvalLabel}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {isTechnicianKiosk ? <TechnicianKioskNav /> : null}
    </div>
  );
}

export default TechnicianCompletedJobsPage;