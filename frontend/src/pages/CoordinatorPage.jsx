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
  resolveOperationalCardVariant,
} from "@/components/erp/OperationalJobCard";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

import { expandOrdersToItemCards } from "@/lib/workOrderItemCards";
import { getTechnicianAvailability } from "@/lib/technicianAvailability";
import { canPurgeOperationalQueue } from "@/lib/queuePurgeAccess";
import { TechnicianAssignSelect } from "@/components/kds/TechnicianAssignSelect";
import { AttendanceSummaryBar } from "@/components/kds/AttendanceSummaryBar";
import {
  ClipboardList,
  Eraser,
  Palette,
  RefreshCw,
  Trash2,
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

function WorkloadLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
      <span className="font-medium text-foreground">Semáforo técnico</span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        Verde · libre (presente, sin trabajo)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        Amarillo · trabajando (1 trabajo)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-rose-500" />
        Rojo · ausente, almuerzo, salió o 2+ trabajos
      </span>
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
  onDelete,
  assigningId,
  deletingId,
  canPurgeQueue = false,
}) {
  const orderId = getOrderId(order, department);
  const cardKey = order.cardKey || orderId;
  const awaitingWarehouse = department !== "polarizados" && order.awaiting_warehouse_handoff;
  const isAssigning = assigningId === cardKey;
  const isDeleting = deletingId === cardKey;

  return (
    <OperationalAssignmentCard
      variant={cardVariant}
      order={order}
      department={department}
      vehicles={vehicles}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <TechnicianAssignSelect
          team={team}
          value={selectedTechnicianId || ""}
          onValueChange={onSelectTechnician}
          disabled={isAssigning || isDeleting}
          className="sm:flex-1"
        />
        <Button
          size="sm"
          className="gap-2 w-full sm:w-auto"
          disabled={!selectedTechnicianId || isAssigning || isDeleting || awaitingWarehouse}
          onClick={() => onAssign(order, department, selectedTechnicianId)}
        >
          <UserCheck className="h-4 w-4" />
          {isAssigning ? "Asignando…" : "Asignar"}
        </Button>
        {canPurgeQueue ? (
          <Button
            size="sm"
            variant="outline"
            className="gap-2 w-full sm:w-auto text-rose-700 border-rose-300 hover:bg-rose-50 dark:text-rose-300 dark:border-rose-500/40"
            disabled={isAssigning || isDeleting}
            onClick={() => onDelete(order, department)}
            data-testid={`delete-job-${orderId}`}
          >
            <Trash2 className="h-4 w-4" />
            {isDeleting ? "Eliminando…" : "Eliminar"}
          </Button>
        ) : null}
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
  const canPurgeQueue = canPurgeOperationalQueue(userRole);
  const profileConfig = PROFILE_CONFIG[profile] || PROFILE_CONFIG.instalaciones;

  if (!userCanAccessProfile(userRole, profileConfig.key)) {
    return <Navigate to={resolveProfileRedirect(userRole)} replace />;
  }

  const visibleTabs = useMemo(
    () => [...profileConfig.departments],
    [profileConfig.departments]
  );

  const [activeTab, setActiveTab] = useState(visibleTabs[0] || "instalaciones");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [boardData, setBoardData] = useState({ instalaciones: null, electrico: null, polarizados: null });
  const [vehicles, setVehicles] = useState([]);
  const [selections, setSelections] = useState({});
  const [assigningId, setAssigningId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [clearingDept, setClearingDept] = useState("");
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
    const cardKey = order.cardKey || orderId;
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
      const avail = getTechnicianAvailability(targetTech);
      if (!avail.assignable) {
        toast.error(`${targetTech.name} no está disponible (${avail.label})`);
        return false;
      }
      if (avail.level === "yellow") {
        toast.warning(
          `${targetTech.name} ya tiene un trabajo activo. Prioriza técnicos en verde cuando sea posible.`
        );
      }
    }

    setAssigningId(cardKey);
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
        delete next[cardKey];
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

  const handleDeleteOrder = async (order, department) => {
    if (!canPurgeQueue) {
      toast.error("Solo gerencia, supervisores o programadores pueden eliminar trabajos");
      return;
    }
    const orderId = getOrderId(order, department);
    const cardKey = order.cardKey || orderId;
    const label = department === "polarizados" ? "polarizado pendiente" : "trabajo pendiente";
    if (!window.confirm(`¿Eliminar este ${label} de la cola?`)) return;

    setDeletingId(cardKey);
    try {
      const endpoint =
        department === "polarizados"
          ? `${API}/tint-orders/${orderId}`
          : `${API}/work-orders/${orderId}`;
      await axios.delete(endpoint, { withCredentials: true });
      toast.success(department === "polarizados" ? "Polarizado eliminado" : "Trabajo eliminado");
      setSelections((prev) => {
        const next = { ...prev };
        delete next[cardKey];
        return next;
      });
      await loadBoard({ showSpinner: false });
    } catch (error) {
      const detail = error?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "No se pudo eliminar el trabajo");
    } finally {
      setDeletingId("");
    }
  };

  const handleClearQueue = async (department) => {
    if (!canPurgeQueue) {
      toast.error("Solo gerencia, supervisores o programadores pueden limpiar la cola");
      return;
    }
    const section = boardData[department] || {};
    const pendingCount = section?.counts?.pending || 0;
    if (!pendingCount) {
      toast.message("No hay trabajos pendientes para limpiar");
      return;
    }
    const deptLabel = DEPARTMENT_META[department]?.label || department;
    if (
      !window.confirm(
        `¿Limpiar los ${pendingCount} trabajos pendientes de ${deptLabel}? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }

    setClearingDept(department);
    try {
      const res = await axios.post(
        `${API}/coordinator/clear-queue`,
        {
          department,
          profile: profileConfig.key,
          branch_id: user?.branch_id || undefined,
        },
        { withCredentials: true }
      );
      toast.success(`Cola limpiada (${res?.data?.removed ?? 0} trabajos)`);
      await loadBoard({ showSpinner: false });
    } catch (error) {
      const detail = error?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "No se pudo limpiar la cola");
    } finally {
      setClearingDept("");
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
            const section = boardData[dept] || { pending: [], technicians: [], attendance_summary: {} };
            const team = section.technicians || [];
            const pendingCards = expandOrdersToItemCards(section.pending || [], dept);
            return (
              <TabsContent key={dept} value={dept} className="mt-4 space-y-4">
                <AttendanceSummaryBar summary={section.attendance_summary} />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    Asigne cada producto con el menú desplegable. El semáforo considera reloj marcador y carga de trabajo.
                  </p>
                  {canPurgeQueue ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 text-rose-700 border-rose-300 hover:bg-rose-50 dark:text-rose-300"
                      disabled={clearingDept === dept || !(section?.counts?.pending)}
                      onClick={() => handleClearQueue(dept)}
                      data-testid={`clear-queue-${dept}`}
                    >
                      <Eraser className="h-4 w-4" />
                      {clearingDept === dept ? "Limpiando…" : "Limpiar cola"}
                    </Button>
                  ) : null}
                </div>

                {pendingCards.length === 0 ? (
                  <Card>
                    <CardContent className="py-14 text-center text-muted-foreground">
                      No hay órdenes pendientes de asignación en {DEPARTMENT_META[dept].label}.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {pendingCards.map((order) => {
                      const orderKey = order.cardKey || getOrderId(order, dept);
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
                          onDelete={handleDeleteOrder}
                          assigningId={assigningId}
                          deletingId={deletingId}
                          canPurgeQueue={canPurgeQueue}
                        />
                      );
                    })}
                  </div>
                )}

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Seguimiento por técnico
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {team.map((tech) => {
                      const avail = getTechnicianAvailability(tech);
                      return (
                        <div
                          key={tech.user_id}
                          className={cn("rounded-md border p-3 text-sm", avail.badge)}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="font-medium flex items-center gap-2">
                              <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", avail.dot)} />
                              {tech.name}
                            </span>
                            <Badge variant="outline" className={avail.badge}>
                              {avail.label}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground mb-2">
                            {avail.attendanceLabel}
                            {avail.jobs > 0 ? ` · ${avail.jobs} activa${avail.jobs === 1 ? "" : "s"}` : ""}
                          </p>
                          <div>
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
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}