import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { API_BASE as API } from "@/lib/api";
import { cn, formatDate, WORK_ORDER_STATUS } from "@/lib/utils";
import {
  getOrderId,
  OperationalAssignmentCard,
  OperationalJobCard,
  resolveOperationalCardVariant,
} from "@/components/erp/OperationalJobCard";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import {
  ClipboardList,
  LayoutGrid,
  List,
  Palette,
  RefreshCw,
  User,
  UserCheck,
  Wrench,
  Zap,
} from "lucide-react";

const DEPARTMENT_META = {
  instalaciones: {
    label: "Instalaciones",
    icon: Wrench,
    tone: "border-rose-200 bg-rose-50/60 dark:border-rose-500/30 dark:bg-rose-500/10",
    badge: "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200",
    column: "border-rose-300/60 bg-rose-50/40 dark:border-rose-500/25 dark:bg-rose-500/5",
  },
  electrico: {
    label: "Eléctrico",
    icon: Zap,
    tone: "border-indigo-200 bg-indigo-50/60 dark:border-indigo-500/30 dark:bg-indigo-500/10",
    badge: "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200",
    column: "border-indigo-300/60 bg-indigo-50/40 dark:border-indigo-500/25 dark:bg-indigo-500/5",
  },
  polarizados: {
    label: "Polarizados",
    icon: Palette,
    tone: "border-fuchsia-200 bg-fuchsia-50/60 dark:border-fuchsia-500/30 dark:bg-fuchsia-500/10",
    badge: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-500/20 dark:text-fuchsia-200",
    column: "border-fuchsia-300/60 bg-fuchsia-50/40 dark:border-fuchsia-500/25 dark:bg-fuchsia-500/5",
  },
};

const SEMAPHORE_STYLES = {
  green: {
    label: "Sin trabajo",
    dot: "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.55)]",
    bar: "bg-emerald-500",
    badge: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200",
    columnAccent: "border-emerald-400/45",
  },
  yellow: {
    label: "Trabajando",
    dot: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.55)]",
    bar: "bg-amber-400",
    badge: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200",
    columnAccent: "border-amber-400/50",
  },
  red: {
    label: "2+ trabajos",
    dot: "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.55)]",
    bar: "bg-rose-500",
    badge: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200",
    columnAccent: "border-rose-400/55",
  },
};

const PROFILE_CONFIG = {
  instalaciones: {
    key: "instalaciones",
    title: "Coordinación de Instalaciones",
    description: "Perfil independiente para asignar accesorios, instalación mecánica y eléctrica.",
    departments: ["instalaciones", "electrico"],
    headerIcon: Wrench,
    testId: "coordinator-instalaciones-page",
  },
  polarizados: {
    key: "polarizados",
    title: "Coordinación de Polarizados",
    description: "Perfil independiente para asignar órdenes de polarizado al equipo.",
    departments: ["polarizados"],
    headerIcon: Palette,
    testId: "coordinator-polarizados-page",
  },
};

function getWorkloadSemaphore(activeJobs) {
  const jobs = Math.max(0, Number(activeJobs) || 0);
  let level = "green";
  if (jobs >= 2) {
    level = "red";
  } else if (jobs === 1) {
    level = "yellow";
  }
  const percent = jobs === 0 ? 0 : jobs === 1 ? 50 : 100;
  return {
    level,
    jobs,
    percent,
    ...SEMAPHORE_STYLES[level],
  };
}

function userCanAccessProfile(role, profileKey) {
  const normalized = String(role || "").toLowerCase();
  if (["gerencia", "supervisor"].includes(normalized)) return true;
  if (profileKey === "instalaciones") return normalized === "coordinador_instalaciones";
  if (profileKey === "polarizados") return normalized === "coordinador_polarizados";
  return false;
}

function resolveProfileRedirect(role) {
  const normalized = String(role || "").toLowerCase();
  if (normalized === "coordinador_polarizados") return "/coordinator/polarizados";
  if (normalized === "coordinador_instalaciones") return "/coordinator/instalaciones";
  return "/coordinator/instalaciones";
}

function WorkloadTrafficLight({ activeJobs, showBar = true }) {
  const sem = getWorkloadSemaphore(activeJobs);
  return (
    <div className="space-y-1.5" title={`${sem.jobs} trabajo(s) activo(s) · ${sem.label}`}>
      <div className="flex items-center gap-2">
        <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", sem.dot)} aria-hidden />
        <span className="text-[11px] text-muted-foreground">{sem.label}</span>
        <span className="text-[11px] font-medium ml-auto tabular-nums">
          {sem.jobs} activa{sem.jobs === 1 ? "" : "s"}
        </span>
      </div>
      {showBar ? (
        <div className="h-1.5 w-full rounded-full bg-muted/80 overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-500", sem.bar)}
            style={{ width: `${sem.percent}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function WorkloadLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
      <span className="font-medium text-foreground">Semáforo de carga</span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        Verde · sin trabajo (0)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        Amarillo · trabajando (1)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-rose-500" />
        Rojo · 2 o más trabajos
      </span>
    </div>
  );
}

function buildDragPayload(order, department) {
  return JSON.stringify({
    orderId: getOrderId(order, department),
    department,
    orderKind: department === "polarizados" ? "tint" : "work",
  });
}

function KanbanColumn({
  title,
  subtitle,
  count,
  toneClass,
  workload,
  children,
  dropTargetId,
  isDropTarget,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
}) {
  const sem = workload ? getWorkloadSemaphore(workload.jobs) : null;

  return (
    <div
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-lg border min-h-[420px] max-h-[72vh]",
        toneClass,
        sem?.columnAccent,
        isDropTarget && isDragOver && "ring-2 ring-primary/50 bg-primary/5",
        sem?.level === "red" && "shadow-sm shadow-rose-500/10"
      )}
      onDragOver={isDropTarget ? onDragOver : undefined}
      onDragLeave={isDropTarget ? onDragLeave : undefined}
      onDrop={isDropTarget ? onDrop : undefined}
      data-drop-target={dropTargetId}
      data-workload-level={sem?.level}
    >
      <div className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur px-3 py-3 rounded-t-lg">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex items-center gap-2">
            {sem ? <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", sem.dot)} aria-hidden /> : null}
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{title}</p>
              {subtitle ? <p className="text-xs text-muted-foreground truncate">{subtitle}</p> : null}
            </div>
          </div>
          <Badge variant="secondary">{count}</Badge>
        </div>
        {workload ? (
          <div className="mt-2">
            <WorkloadTrafficLight activeJobs={workload.jobs} />
          </div>
        ) : null}
        {isDropTarget ? (
          <p className="text-[11px] text-muted-foreground mt-1">Soltar aquí para asignar</p>
        ) : null}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">{children}</div>
    </div>
  );
}

function DepartmentKanban({
  department,
  board,
  vehicles,
  cardVariant,
  assigningId,
  draggingPayload,
  setDraggingPayload,
  dropTargetId,
  setDropTargetId,
  onAssignToTechnician,
}) {
  const meta = DEPARTMENT_META[department];
  const pending = board?.pending || [];
  const technicians = useMemo(
    () =>
      [...(board?.technicians || [])].sort(
        (a, b) =>
          (a.active_jobs || 0) - (b.active_jobs || 0)
          || String(a.name || "").localeCompare(String(b.name || ""), "es")
      ),
    [board?.technicians]
  );

  const handleDragStart = (order) => (event) => {
    const payload = buildDragPayload(order, department);
    event.dataTransfer.setData("application/json", payload);
    event.dataTransfer.effectAllowed = "move";
    setDraggingPayload(payload);
  };

  const handleDragEnd = () => {
    setDraggingPayload("");
    setDropTargetId("");
  };

  const handleColumnDragOver = (technicianId) => (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetId(technicianId);
  };

  const handleColumnDrop = (technicianId) => async (event) => {
    event.preventDefault();
    setDropTargetId("");
    const raw = event.dataTransfer.getData("application/json") || draggingPayload;
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      if (data.department !== department) return;
      const order =
        pending.find((row) => getOrderId(row, department) === data.orderId)
        || technicians
          .flatMap((tech) => tech.orders || [])
          .find((row) => getOrderId(row, department) === data.orderId);
      if (!order) return;
      await onAssignToTechnician(order, department, technicianId);
    } catch {
      toast.error("No se pudo procesar la asignación por arrastre");
    } finally {
      setDraggingPayload("");
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Arrastra cada tarjeta desde <strong>Sin asignar</strong> hacia la columna del técnico.
        Las columnas con semáforo <strong className="text-emerald-600 dark:text-emerald-400">verde</strong> tienen más capacidad disponible.
      </p>
      <div className="flex gap-4 overflow-x-auto pb-2">
        <KanbanColumn
          title="Sin asignar"
          subtitle="Cola de coordinación"
          count={pending.length}
          toneClass="border-dashed border-muted-foreground/30 bg-muted/20"
          dropTargetId="pending"
          isDropTarget={false}
        >
          {pending.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Sin trabajos pendientes</p>
          ) : (
            pending.map((order) => {
              const orderId = getOrderId(order, department);
              return (
                <OperationalJobCard
                  key={orderId}
                  variant={cardVariant}
                  order={order}
                  department={department}
                  vehicles={vehicles}
                  columnContext="pending"
                  compact
                  draggable={!(department !== "polarizados" && order.awaiting_warehouse_handoff)}
                  isDragging={draggingPayload.includes(orderId)}
                  onDragStart={
                    department !== "polarizados" && order.awaiting_warehouse_handoff
                      ? undefined
                      : handleDragStart(order)
                  }
                  onDragEnd={handleDragEnd}
                />
              );
            })
          )}
        </KanbanColumn>

        {technicians.map((tech) => {
          const techId = tech.user_id;
          const orders = tech.orders || [];
          const isAssigningHere = assigningId && orders.some((o) => getOrderId(o, department) === assigningId);
          return (
            <KanbanColumn
              key={techId}
              title={tech.name}
              subtitle={`${tech.active_jobs || 0} activa${(tech.active_jobs || 0) === 1 ? "" : "s"}`}
              count={orders.length}
              toneClass={meta.column}
              workload={{ jobs: tech.active_jobs || 0 }}
              dropTargetId={techId}
              isDropTarget
              isDragOver={dropTargetId === techId}
              onDragOver={handleColumnDragOver(techId)}
              onDragLeave={() => setDropTargetId("")}
              onDrop={handleColumnDrop(techId)}
            >
              {isAssigningHere ? (
                <div className="text-xs text-muted-foreground text-center py-2 animate-pulse">Asignando…</div>
              ) : null}
              {orders.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Sin trabajos asignados</p>
              ) : (
                orders.map((order) => {
                  const orderId = getOrderId(order, department);
                  return (
                    <OperationalJobCard
                      key={orderId}
                      variant={cardVariant}
                      order={order}
                      department={department}
                      vehicles={vehicles}
                      columnContext="assigned"
                      compact
                      draggable
                      isDragging={draggingPayload.includes(orderId)}
                      onDragStart={handleDragStart(order)}
                      onDragEnd={handleDragEnd}
                    />
                  );
                })
              )}
            </KanbanColumn>
          );
        })}
      </div>
    </div>
  );
}

function AssignmentListCard({
  order,
  department,
  vehicles,
  cardVariant,
  team,
  selectedTechnicianId,
  onSelectTechnician,
  onAssign,
  assigningId,
}) {
  const orderId = getOrderId(order, department);
  const awaitingWarehouse = department !== "polarizados" && order.awaiting_warehouse_handoff;
  const isAssigning = assigningId === orderId;

  return (
    <OperationalAssignmentCard
      variant={cardVariant}
      order={order}
      department={department}
      vehicles={vehicles}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select value={selectedTechnicianId || ""} onValueChange={onSelectTechnician} disabled={isAssigning}>
          <SelectTrigger className="w-full sm:flex-1">
            <SelectValue placeholder="Seleccionar técnico" />
          </SelectTrigger>
          <SelectContent>
            {[...team]
              .sort((a, b) => (a.active_jobs || 0) - (b.active_jobs || 0))
              .map((member) => {
                const sem = getWorkloadSemaphore(member.active_jobs || 0);
                return (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    <span className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full shrink-0", sem.dot)} />
                      {member.name} · {member.active_jobs || 0} activa{(member.active_jobs || 0) === 1 ? "" : "s"}
                    </span>
                  </SelectItem>
                );
              })}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          className="gap-2 w-full sm:w-auto"
          disabled={!selectedTechnicianId || isAssigning || awaitingWarehouse}
          onClick={() => onAssign(order, department, selectedTechnicianId)}
        >
          <UserCheck className="h-4 w-4" />
          {isAssigning ? "Asignando…" : "Asignar"}
        </Button>
      </div>
    </OperationalAssignmentCard>
  );
}

export function CoordinatorIndexRedirect() {
  const { user } = useAuth();
  return <Navigate to={resolveProfileRedirect(user?.role)} replace />;
}

export function CoordinatorInstalacionesPage() {
  return <CoordinatorPage profile="instalaciones" />;
}

export function CoordinatorPolarizadosPage() {
  return <CoordinatorPage profile="polarizados" />;
}

export function CoordinatorPage({ profile = "instalaciones" }) {
  const { user } = useAuth();
  const userRole = String(user?.role || "").toLowerCase();
  const profileConfig = PROFILE_CONFIG[profile] || PROFILE_CONFIG.instalaciones;

  if (!userCanAccessProfile(userRole, profileConfig.key)) {
    return <Navigate to={resolveProfileRedirect(userRole)} replace />;
  }

  const visibleTabs = useMemo(
    () => [...profileConfig.departments],
    [profileConfig.departments]
  );

  const [activeTab, setActiveTab] = useState(visibleTabs[0] || "instalaciones");
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === "undefined") return "kanban";
    return window.matchMedia("(max-width: 767px)").matches ? "list" : "kanban";
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [boardData, setBoardData] = useState({ instalaciones: null, electrico: null, polarizados: null });
  const [vehicles, setVehicles] = useState([]);
  const [selections, setSelections] = useState({});
  const [assigningId, setAssigningId] = useState("");
  const [draggingPayload, setDraggingPayload] = useState("");
  const [dropTargetId, setDropTargetId] = useState("");
  const [lastRefreshedAt, setLastRefreshedAt] = useState("");

  const loadBoard = useCallback(async ({ showSpinner = true } = {}) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);
    try {
      const branchId = user?.branch_id || undefined;
      const [boardRes, vehiclesRes] = await Promise.all([
        axios.get(`${API}/coordinator/board`, {
          withCredentials: true,
          params: { branch_id: branchId, profile: profileConfig.key },
        }),
        axios.get(`${API}/vehicles`, { withCredentials: true }).catch(() => ({ data: [] })),
      ]);

      const departments = boardRes?.data?.departments || {};
      setBoardData({
        instalaciones: departments.instalaciones || { pending: [], technicians: [], counts: {} },
        electrico: departments.electrico || { pending: [], technicians: [], counts: {} },
        polarizados: departments.polarizados || { pending: [], technicians: [], counts: {} },
      });
      setVehicles(Array.isArray(vehiclesRes?.data) ? vehiclesRes.data : []);
      setLastRefreshedAt(boardRes?.data?.refreshed_at || new Date().toISOString());
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudo cargar el tablero de coordinación");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profileConfig.key, user?.branch_id]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    const intervalId = window.setInterval(() => loadBoard({ showSpinner: false }), 15000);
    return () => window.clearInterval(intervalId);
  }, [loadBoard]);

  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0] || "instalaciones");
    }
  }, [activeTab, visibleTabs]);

  const handleAssignToTechnician = async (order, department, technicianId) => {
    if (!technicianId) {
      toast.error("Selecciona un técnico");
      return false;
    }

    const orderId = getOrderId(order, department);
    const currentTechId =
      department === "polarizados"
        ? order.assigned_technician_id
        : order.technician_id;
    if (String(currentTechId || "") === String(technicianId)) {
      return true;
    }

    if (department !== "polarizados" && order.awaiting_warehouse_handoff) {
      toast.error("Este trabajo aún espera despacho de bodega");
      return false;
    }

    const section = boardData[department];
    const targetTech = (section?.technicians || []).find(
      (row) => String(row.user_id) === String(technicianId)
    );
    if (targetTech && !currentTechId) {
      const sem = getWorkloadSemaphore(targetTech.active_jobs || 0);
      if (sem.level === "red") {
        toast.warning(
          `${targetTech.name} tiene ${sem.jobs} trabajos activos. Prioriza técnicos en verde (sin trabajo) o amarillo (1 trabajo).`
        );
      }
    }

    setAssigningId(orderId);
    try {
      if (department === "polarizados") {
        await axios.put(
          `${API}/tint-orders/${orderId}/assign`,
          {},
          { withCredentials: true, params: { technician_id: technicianId } }
        );
      } else {
        await axios.put(
          `${API}/work-orders/${orderId}`,
          { technician_id: technicianId },
          { withCredentials: true }
        );
      }
      toast.success(
        currentTechId ? "Trabajo reasignado correctamente" : "Trabajo asignado correctamente"
      );
      setSelections((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
      await loadBoard({ showSpinner: false });
      return true;
    } catch (error) {
      const detail = error?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "No se pudo asignar el trabajo");
      return false;
    } finally {
      setAssigningId("");
    }
  };

  const totals = useMemo(() => {
    let pending = 0;
    let assigned = 0;
    visibleTabs.forEach((dept) => {
      const section = boardData[dept] || {};
      pending += section?.counts?.pending || 0;
      assigned += section?.counts?.assigned || 0;
    });
    return { pending, assigned };
  }, [boardData, visibleTabs]);

  const refreshLabel = lastRefreshedAt
    ? `Actualizado ${formatDate(lastRefreshedAt)}`
    : "";

  const cardVariant = useMemo(
    () => resolveOperationalCardVariant({ role: userRole, profile: profileConfig.key }),
    [userRole, profileConfig.key]
  );

  const HeaderIcon = profileConfig.headerIcon || ClipboardList;

  return (
    <div className="p-6 space-y-6" data-testid={profileConfig.testId}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <HeaderIcon className="h-7 w-7 text-primary" />
            {profileConfig.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {profileConfig.description}
          </p>
          {refreshLabel ? (
            <p className="text-xs text-muted-foreground mt-1">{refreshLabel} · auto cada 15s</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border p-1 bg-muted/30">
            <Button
              type="button"
              size="sm"
              variant={viewMode === "kanban" ? "default" : "ghost"}
              className="gap-2"
              onClick={() => setViewMode("kanban")}
            >
              <LayoutGrid className="h-4 w-4" />
              Tablero
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === "list" ? "default" : "ghost"}
              className="gap-2"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
              Lista
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => loadBoard({ showSpinner: false })}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            Actualizar
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {visibleTabs.map((dept) => {
          const meta = DEPARTMENT_META[dept];
          const Icon = meta.icon;
          const section = boardData[dept] || {};
          return (
            <div
              key={dept}
              className={cn("flex items-center gap-2 rounded-md border px-4 py-2 text-sm", meta.tone)}
            >
              <Icon className="h-4 w-4" />
              <span className="font-medium">{meta.label}</span>
              <Badge variant="secondary">{section?.counts?.pending || 0} pend.</Badge>
              <Badge variant="outline">{section?.counts?.assigned || 0} en curso</Badge>
            </div>
          );
        })}
        <div className="flex items-center gap-2 rounded-md border px-4 py-2 text-sm bg-muted/40">
          <span className="font-medium">Total</span>
          <Badge>{totals.pending} pend.</Badge>
          <Badge variant="outline">{totals.assigned} en curso</Badge>
        </div>
      </div>

      <WorkloadLegend />

      {loading ? (
        <div className="py-20 text-center text-muted-foreground">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3" />
          Cargando tablero de coordinación…
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            {visibleTabs.map((dept) => {
              const meta = DEPARTMENT_META[dept];
              const Icon = meta.icon;
              const section = boardData[dept] || {};
              return (
                <TabsTrigger key={dept} value={dept} className="gap-2">
                  <Icon className="h-4 w-4" />
                  {meta.label}
                  {(section?.counts?.pending || 0) > 0 ? (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                      {section.counts.pending}
                    </Badge>
                  ) : null}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {visibleTabs.map((dept) => {
            const section = boardData[dept] || { pending: [], technicians: [] };
            const team = [...(section.technicians || [])].sort(
              (a, b) =>
                (a.active_jobs || 0) - (b.active_jobs || 0)
                || String(a.name || "").localeCompare(String(b.name || ""), "es")
            );
            return (
              <TabsContent key={dept} value={dept} className="mt-4">
                {viewMode === "kanban" ? (
                  <DepartmentKanban
                    department={dept}
                    board={section}
                    vehicles={vehicles}
                    cardVariant={cardVariant}
                    assigningId={assigningId}
                    draggingPayload={draggingPayload}
                    setDraggingPayload={setDraggingPayload}
                    dropTargetId={dropTargetId}
                    setDropTargetId={setDropTargetId}
                    onAssignToTechnician={handleAssignToTechnician}
                  />
                ) : section.pending.length === 0 ? (
                  <Card>
                    <CardContent className="py-14 text-center text-muted-foreground">
                      No hay órdenes pendientes de asignación en {DEPARTMENT_META[dept].label}.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {section.pending.map((order) => {
                      const orderKey = getOrderId(order, dept);
                      return (
                        <AssignmentListCard
                          key={orderKey}
                          order={order}
                          department={dept}
                          vehicles={vehicles}
                          cardVariant={cardVariant}
                          team={team}
                          selectedTechnicianId={selections[orderKey] || ""}
                          onSelectTechnician={(techId) =>
                            setSelections((prev) => ({ ...prev, [orderKey]: techId }))
                          }
                          onAssign={handleAssignToTechnician}
                          assigningId={assigningId}
                        />
                      );
                    })}
                  </div>
                )}

                {viewMode === "kanban" ? (
                  <Card className="mt-4">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Seguimiento por técnico
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {team.map((tech) => {
                        const sem = getWorkloadSemaphore(tech.active_jobs || 0);
                        return (
                        <div
                          key={tech.user_id}
                          className={cn("rounded-md border p-3 text-sm", sem.columnAccent)}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="font-medium">{tech.name}</span>
                            <Badge variant="outline" className={sem.badge}>
                              {sem.label}
                            </Badge>
                          </div>
                          <WorkloadTrafficLight activeJobs={tech.active_jobs || 0} />
                          <div className="mt-3">
                          {(tech.orders || []).length === 0 ? (
                            <p className="text-xs text-muted-foreground">Sin trabajos en curso</p>
                          ) : (
                            <ul className="space-y-1 text-xs text-muted-foreground">
                              {(tech.orders || []).map((order) => {
                                const orderId = getOrderId(order, dept);
                                const statusKey = String(order.status || "pending");
                                return (
                                  <li key={orderId} className="flex justify-between gap-2">
                                    <span className="truncate">{order.invoice_number || orderId}</span>
                                    <span>{WORK_ORDER_STATUS[statusKey] || statusKey}</span>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                          </div>
                        </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                ) : null}
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}