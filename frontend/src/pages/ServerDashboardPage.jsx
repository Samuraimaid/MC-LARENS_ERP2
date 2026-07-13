import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Activity, Cloud, Cpu, FolderTree, HardDrive, Thermometer, Users } from "lucide-react";
import { buildApiUrl } from "@/lib/runtimeApi";
import { cn } from "@/lib/utils";

function MetricBar({ label, value, icon: Icon, tone = "sky" }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, Number(value)));
  const toneClass = {
    sky: "from-sky-500 to-cyan-400",
    emerald: "from-emerald-500 to-lime-400",
    amber: "from-amber-500 to-orange-400",
    rose: "from-rose-500 to-pink-500",
  }[tone];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <div className="mb-3 flex items-center justify-between text-white/80">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em]">
          <Icon className="h-4 w-4" />
          {label}
        </div>
        <span className="font-mono text-lg text-white">{value == null ? "N/D" : `${pct}%`}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white/10">
        <div className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-700", toneClass)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatusLight({ label, healthy, detail }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/30 px-5 py-4">
      <span
        className={cn(
          "h-5 w-5 rounded-full shadow-lg",
          healthy ? "bg-emerald-400 shadow-emerald-500/60" : "bg-rose-500 shadow-rose-500/60 animate-pulse",
        )}
      />
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">{label}</p>
        <p className="text-base text-white">{detail}</p>
      </div>
    </div>
  );
}

function QrPanel({ url }) {
  const qrSrc = useMemo(() => {
    const encoded = encodeURIComponent(url || "");
    return `https://api.qrserver.com/v1/create-qr-code/?size=480x480&margin=12&data=${encoded}`;
  }, [url]);

  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-white/15 bg-white p-6 shadow-2xl">
      <img src={qrSrc} alt="QR de conexión ERP" className="h-[min(42vh,420px)] w-[min(42vh,420px)] object-contain" />
      <p className="mt-4 text-center text-sm font-medium text-slate-600">Escanea para abrir el ERP en tu teléfono o laptop</p>
    </div>
  );
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (bytes >= 1024 ** 4) return `${(bytes / 1024 ** 4).toFixed(2)} TB`;
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${bytes} B`;
}

export function ServerDashboardPage() {
  const [payload, setPayload] = useState(null);
  const [teraboxOverview, setTeraboxOverview] = useState(null);
  const [expandedFolder, setExpandedFolder] = useState(null);
  const [error, setError] = useState("");
  const [clock, setClock] = useState(() => new Date());

  const loadDashboard = useCallback(async () => {
    try {
      const [dashboardRes, teraboxRes] = await Promise.all([
        axios.get(buildApiUrl("/server-appliance/dashboard"), { timeout: 5000 }),
        axios.get(buildApiUrl("/server-appliance/terabox/overview"), { timeout: 8000, withCredentials: true }).catch(() => ({ data: null })),
      ]);
      setPayload(dashboardRes.data);
      setTeraboxOverview(teraboxRes.data || null);
      setError("");
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "No se pudo cargar el dashboard del servidor");
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    const metricsTimer = window.setInterval(loadDashboard, 5000);
    const clockTimer = window.setInterval(() => setClock(new Date()), 1000);
    return () => {
      window.clearInterval(metricsTimer);
      window.clearInterval(clockTimer);
    };
  }, [loadDashboard]);

  useEffect(() => {
    const root = document.documentElement;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    root.classList.add("server-dashboard-kiosk");
    return () => {
      document.body.style.overflow = previous;
      root.classList.remove("server-dashboard-kiosk");
    };
  }, []);

  const accessUrl = payload?.access?.url || (typeof window !== "undefined" ? window.location.origin : "");
  const nodeName = payload?.node?.node_name || payload?.node?.node_id || "Nodo ERP";
  const nodeType = payload?.node?.node_type || "SUCURSAL";
  const profileLabel =
    nodeType === "BODEGA_PURA"
      ? "Perfil Bodega Pura"
      : nodeType === "CASA_MATRIZ"
        ? "Perfil Casa Matriz"
        : "Perfil Sucursal";
  const metrics = payload?.metrics || {};
  const delta = payload?.delta || {};

  return (
    <div
      className="fixed inset-0 z-[120] overflow-hidden bg-[radial-gradient(circle_at_top,#0f172a,#020617)] text-white"
      data-testid="server-dashboard-page"
    >
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:48px_48px]" />

      <div className="relative flex h-full flex-col p-6 lg:p-8">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300/80">Centro de Mando · Black Box</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight lg:text-5xl">{nodeName}</h1>
            <p className="mt-2 text-lg text-white/70">
              {profileLabel} · {clock.toLocaleString("es-NI")}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-right">
            <p className="text-xs uppercase tracking-[0.25em] text-white/60">Usuarios activos</p>
            <p className="font-mono text-4xl font-bold text-cyan-300">{metrics.active_users ?? 0}</p>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="flex min-h-0 flex-col justify-center rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200/80">Acceso LAN del ERP</p>
            <p className="break-all font-mono text-[clamp(2rem,6vw,4.5rem)] font-black leading-none text-white">{accessUrl}</p>
            {error ? <p className="mt-4 text-rose-300">{error}</p> : null}
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <MetricBar label="CPU" value={metrics.cpu_percent} icon={Cpu} tone="sky" />
              <MetricBar label="RAM" value={metrics.memory?.percent} icon={Activity} tone="emerald" />
              <MetricBar label="Disco Uploads" value={metrics.disk_uploads?.percent} icon={HardDrive} tone="amber" />
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-5 py-4">
                <div className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-white/60">
                  <Thermometer className="h-4 w-4" />
                  Temperatura
                </div>
                <p className="mt-2 font-mono text-3xl">{metrics.temperature_c == null ? "N/D" : `${metrics.temperature_c}°C`}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-5 py-4">
                <div className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-white/60">
                  <Users className="h-4 w-4" />
                  Sesiones ERP
                </div>
                <p className="mt-2 font-mono text-3xl">{metrics.active_users ?? 0}</p>
              </div>
            </div>
          </section>

          <section className="grid min-h-0 grid-rows-[auto_1fr] gap-6">
            <QrPanel url={accessUrl} />
            <div className="grid gap-3 overflow-auto">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-white/60">Semáforos Delta & Nube</p>
              <StatusLight
                label="Red Local / Mongo"
                healthy={delta.local_database?.healthy !== false}
                detail={delta.local_database?.healthy === false ? "Base local con fallas" : "Operación local estable"}
              />
              <StatusLight
                label="Túnel Cloudflare"
                healthy={delta.cloudflare_tunnel?.healthy === true}
                detail={
                  delta.cloudflare_tunnel?.healthy
                    ? `Activo · ${delta.cloudflare_tunnel?.latency_ms ?? "?"} ms`
                    : "Túnel no responde"
                }
              />
              <StatusLight
                label="MongoDB Atlas"
                healthy={delta.mongodb_atlas?.healthy !== false}
                detail={
                  delta.mongodb_atlas?.enabled
                    ? `${delta.mongodb_atlas?.percent ?? "?"}% del cupo 512 MB`
                    : "Atlas no configurado en este nodo"
                }
              />
              <StatusLight
                label="USB Respaldo"
                healthy={(delta.hardware_alerts || []).every((item) => item.code !== "usb_disconnected")}
                detail={
                  (delta.hardware_alerts || []).find((item) => item.code === "usb_disconnected")
                    ? "Disco USB desconectado"
                    : `Libre ${Math.round((metrics.disk_usb?.free_bytes || 0) / (1024 ** 3))} GB`
                }
              />
              <StatusLight
                label="TeraBox Cold Backup"
                healthy={delta.terabox?.connected === true && delta.terabox?.last_upload_status === "success"}
                detail={delta.terabox?.indicator || "Sin datos TeraBox"}
              />
              {teraboxOverview ? (
                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-5 py-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-100">
                    <Cloud className="h-4 w-4" />
                    Espacio TeraBox ({teraboxOverview.used_percentage ?? 0}% usado)
                  </div>
                  <MetricBar
                    label="Nube TeraBox"
                    value={teraboxOverview.used_percentage}
                    icon={Cloud}
                    tone="sky"
                  />
                  <div className="grid grid-cols-3 gap-2 text-xs text-white/80">
                    <div><span className="block text-white/50">Total</span>{formatBytes(teraboxOverview.total_space_bytes)}</div>
                    <div><span className="block text-white/50">Usado</span>{formatBytes(teraboxOverview.used_space_bytes)}</div>
                    <div><span className="block text-white/50">Libre</span>{formatBytes(teraboxOverview.available_space_bytes)}</div>
                  </div>
                  <div className="space-y-2">
                    <p className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/60">
                      <FolderTree className="h-3.5 w-3.5" />
                      Árbol de carpetas raíz
                    </p>
                    {(teraboxOverview.folders || []).map((folder) => (
                      <button
                        key={folder.name}
                        type="button"
                        onClick={() => setExpandedFolder((prev) => (prev === folder.name ? null : folder.name))}
                        className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-left transition hover:bg-black/30"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-mono text-sm">{folder.name}</span>
                          <span className="text-xs text-white/60">{formatBytes(folder.size_bytes)}</span>
                        </div>
                        {expandedFolder === folder.name ? (
                          <div className="mt-2 space-y-1 text-xs text-white/70">
                            <p>Remoto: {folder.remote_path}</p>
                            <p>Local: {folder.local_mirror}</p>
                            <p>Estado: {folder.status} · {folder.share_percent ?? 0}% del espejo local</p>
                          </div>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <StatusLight
                label="Modo Emergencia Standby"
                healthy={!delta.emergency_standby?.active}
                detail={
                  delta.emergency_standby?.active
                    ? `Absorbiendo ${delta.emergency_standby?.emergency_host_for}`
                    : "Operación normal por sucursal local"
                }
              />
              {(delta.hardware_alerts || []).length > 0 ? (
                <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-5 py-4 text-rose-100">
                  <p className="font-semibold uppercase tracking-[0.2em]">Alertas hardware</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {(delta.hardware_alerts || []).map((alert) => (
                      <li key={alert.code}>• {alert.message}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}