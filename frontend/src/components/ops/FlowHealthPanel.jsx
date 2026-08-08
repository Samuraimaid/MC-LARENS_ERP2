import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  PackageCheck,
  RefreshCw,
  Wrench,
  Palette,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { API_BASE as API } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const QUEUE_META = [
  {
    key: "cashier_open_invoices",
    label: "Caja abierta",
    icon: Wallet,
    route: "/cashier",
    warnAt: 5,
  },
  {
    key: "dispatch_active",
    label: "Despacho activo",
    icon: PackageCheck,
    route: "/dispatch",
    warnAt: 5,
  },
  {
    key: "work_orders_active",
    label: "OT activas",
    icon: Wrench,
    route: "/work-orders",
    warnAt: 8,
  },
  {
    key: "work_orders_unassigned",
    label: "OT sin asignar",
    icon: Wrench,
    route: "/coordinator/instalaciones",
    warnAt: 3,
  },
  {
    key: "work_orders_quality_check",
    label: "En QC",
    icon: ClipboardCheck,
    route: "/quality-control",
    warnAt: 3,
  },
  {
    key: "tint_active",
    label: "Polarizados activos",
    icon: Palette,
    route: "/tint-orders",
    warnAt: 3,
  },
];

function levelFor(count, warnAt) {
  if (count <= 0) return "ok";
  if (count >= warnAt) return "high";
  if (count >= Math.max(1, Math.floor(warnAt * 0.5))) return "medium";
  return "low";
}

function levelStyles(level) {
  if (level === "high") return "border-rose-200 bg-rose-50 text-rose-900";
  if (level === "medium") return "border-amber-200 bg-amber-50 text-amber-900";
  if (level === "low") return "border-sky-200 bg-sky-50 text-sky-900";
  return "border-emerald-200 bg-emerald-50 text-emerald-900";
}

/**
 * Operational flow health panel backed by GET /ops/flow-health.
 * Compact=true for dashboard widget; full for dedicated page.
 */
export function FlowHealthPanel({ compact = false, autoRefreshMs = 60000 }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const res = await axios.get(`${API}/ops/flow-health`, { withCredentials: true });
      setData(res.data || null);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const msg =
        typeof detail === "string"
          ? detail
          : err?.response?.status === 403
            ? "Sin permiso para ver salud del flujo"
            : "No se pudo cargar la salud del flujo";
      setError(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    if (!autoRefreshMs || autoRefreshMs < 5000) return undefined;
    const id = setInterval(load, autoRefreshMs);
    return () => clearInterval(id);
  }, [load, autoRefreshMs]);

  const queues = data?.queues || {};
  const alerts = data?.alerts || [];
  const byDept = queues.work_orders_by_department || {};
  const transitions = data?.recent_transitions || [];
  const healthy = Boolean(data?.healthy);

  return (
    <Card
      className="border-slate-200 bg-white/95 shadow-sm"
      data-testid="flow-health-panel"
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl bg-slate-900 p-2 text-white">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="font-heading text-xl text-slate-900">
                Salud del flujo
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Caja → despacho → OT / polarizados → QC
                {data?.generated_at
                  ? ` · actualizado ${new Date(data.generated_at).toLocaleTimeString()}`
                  : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data && (
              <Badge
                variant="outline"
                className={
                  healthy
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : "border-amber-300 bg-amber-50 text-amber-900"
                }
              >
                {healthy ? (
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Saludable
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> Atención
                  </span>
                )}
              </Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setLoading(true);
                load().then(() => toast.success("Salud del flujo actualizada"));
              }}
              disabled={loading}
              data-testid="flow-health-refresh"
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </div>
        ) : null}

        {loading && !data ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-6 justify-center">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Cargando colas operativas…
          </div>
        ) : (
          <>
            <div
              className={`grid gap-3 ${
                compact
                  ? "grid-cols-2 md:grid-cols-3"
                  : "grid-cols-2 md:grid-cols-3 xl:grid-cols-6"
              }`}
            >
              {QUEUE_META.map((item) => {
                const count = Number(queues[item.key] || 0);
                const level = levelFor(count, item.warnAt);
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => item.route && navigate(item.route)}
                    className={`rounded-xl border p-3 text-left transition hover:shadow-sm ${levelStyles(level)}`}
                    data-testid={`flow-health-queue-${item.key}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <Icon className="h-4 w-4 opacity-80" />
                      <span className="text-2xl font-bold tabular-nums">{count}</span>
                    </div>
                    <div className="text-xs font-medium leading-snug">{item.label}</div>
                  </button>
                );
              })}
            </div>

            {Object.keys(byDept).length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                  OT activas por departamento
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(byDept).map(([dept, n]) => (
                    <Badge
                      key={dept}
                      variant="outline"
                      className="capitalize border-slate-300 bg-white text-slate-700"
                    >
                      {dept}: {n}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {alerts.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wide text-slate-500">Alertas</div>
                {alerts.map((alert, idx) => (
                  <div
                    key={`${alert.code || "alert"}-${idx}`}
                    className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span className="font-medium">{alert.code}</span>
                    <span className="text-amber-800">· count {alert.count}</span>
                    <Badge variant="outline" className="ml-auto border-amber-300 bg-white">
                      {alert.level}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {!compact && transitions.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Transiciones recientes
                </div>
                <div className="max-h-56 overflow-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                  {transitions.slice(0, 15).map((tr) => (
                    <div
                      key={tr.transition_id || `${tr.entity_id}-${tr.created_at}`}
                      className="px-3 py-2 text-sm flex flex-wrap items-center gap-x-2 gap-y-1 bg-white"
                    >
                      <Badge variant="outline" className="capitalize">
                        {tr.entity_type}
                      </Badge>
                      <span className="font-mono text-xs text-slate-600">{tr.entity_id}</span>
                      <span className="text-slate-500">
                        {tr.from_status || "∅"} → <strong>{tr.to_status}</strong>
                      </span>
                      {tr.actor_name ? (
                        <span className="text-slate-400 text-xs">por {tr.actor_name}</span>
                      ) : null}
                      {tr.created_at ? (
                        <span className="ml-auto text-xs text-slate-400">
                          {new Date(tr.created_at).toLocaleString()}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default FlowHealthPanel;
