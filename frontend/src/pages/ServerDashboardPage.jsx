import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Activity,
  Cloud,
  Cpu,
  Database,
  HardDrive,
  Network,
  Server,
  Thermometer,
  Timer,
  Users,
  Wifi,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { buildApiUrl } from "@/lib/runtimeApi";
import { cn } from "@/lib/utils";

const DONUT_COLORS = {
  used: "#22d3ee",
  free: "#1e293b",
  hot: "#f43f5e",
  warn: "#f59e0b",
  ok: "#34d399",
};

function DonutGauge({ label, value, icon: Icon, alertHot = false, size = 140 }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, Number(value)));
  const data = [
    { name: "used", value: pct },
    { name: "free", value: Math.max(0, 100 - pct) },
  ];
  const stroke = alertHot && pct >= 75 ? DONUT_COLORS.hot : DONUT_COLORS.used;

  return (
    <div className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-4 shadow-lg shadow-cyan-950/20">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        <Icon className="h-4 w-4 text-cyan-400" />
        {label}
      </div>
      <div className="relative mx-auto" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={size * 0.36}
              outerRadius={size * 0.46}
              startAngle={90}
              endAngle={-270}
              stroke="none"
            >
              <Cell fill={stroke} />
              <Cell fill={DONUT_COLORS.free} />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("font-mono text-2xl font-black", alertHot && pct >= 75 ? "text-rose-400" : "text-white")}>
            {value == null ? "N/D" : `${pct}%`}
          </span>
        </div>
      </div>
    </div>
  );
}

function ThermometerGauge({ celsius }) {
  const temp = celsius == null ? null : Number(celsius);
  const pct = temp == null ? 0 : Math.min(100, (temp / 100) * 100);
  const hot = temp != null && temp > 75;

  return (
    <div className={cn(
      "rounded-2xl border p-4",
      hot ? "border-rose-500/60 bg-rose-950/30" : "border-slate-700/80 bg-slate-900/80",
    )}
    >
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        <Thermometer className={cn("h-4 w-4", hot ? "text-rose-400" : "text-amber-400")} />
        CPU · Termómetro
      </div>
      <div className="flex items-end gap-4">
        <div className="h-28 w-8 overflow-hidden rounded-full border border-slate-600 bg-slate-950">
          <div
            className={cn(
              "w-full transition-all duration-700",
              hot ? "bg-gradient-to-t from-rose-600 to-orange-400" : "bg-gradient-to-t from-cyan-600 to-emerald-400",
            )}
            style={{ height: `${pct}%`, marginTop: `${100 - pct}%` }}
          />
        </div>
        <div>
          <p className={cn("font-mono text-4xl font-black", hot ? "text-rose-300" : "text-white")}>
            {temp == null ? "N/D" : `${temp}°C`}
          </p>
          {hot ? <p className="mt-1 text-sm font-semibold text-rose-300">Alerta térmica &gt; 75°C</p> : null}
        </div>
      </div>
    </div>
  );
}

function CloudProgressBar({ label, used, total, unit, lastSync, folders = [], tone = "cyan" }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const toneBar = tone === "violet" ? "from-violet-500 to-fuchsia-400" : "from-cyan-500 to-sky-400";

  return (
    <div className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">{label}</p>
        <span className="font-mono text-sm text-slate-400">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-800">
        <div className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-700", toneBar)} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-sm text-slate-400">
        {used?.toFixed?.(1) ?? used} / {total} {unit}
        {lastSync ? ` · Última sync: ${new Date(lastSync).toLocaleString("es-NI")}` : ""}
      </p>
      {folders.length > 0 ? (
        <ul className="space-y-1 text-xs text-slate-500">
          {folders.map((f) => (
            <li key={f.name} className="flex justify-between gap-2">
              <span>{f.name}</span>
              <span>{f.status || "ok"}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function DeltaMeshMap({ nodes = [], atlasOnline = false }) {
  const positions = {
    branch_main: "col-start-2 row-start-2",
    branch_north: "col-start-1 row-start-1",
    branch_south: "col-start-3 row-start-3",
  };

  return (
    <div className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300/90">
        <Network className="h-4 w-4" />
        Mapa Delta Mesh · Flujo hacia Atlas
      </div>
      <div className="relative grid grid-cols-3 grid-rows-3 gap-3 min-h-[280px]">
        <div className={cn(
          "col-start-2 row-start-1 flex flex-col items-center justify-center rounded-xl border px-3 py-4 text-center",
          atlasOnline ? "border-emerald-500/50 bg-emerald-500/10" : "border-rose-500/40 bg-rose-500/10",
        )}
        >
          <Database className="h-6 w-6 mb-1 text-violet-300" />
          <p className="text-xs font-bold uppercase tracking-wider">MongoDB Atlas</p>
          <p className="text-[10px] text-slate-400">Clúster central</p>
        </div>

        {nodes.map((node) => {
          const online = node.status === "online";
          return (
            <div
              key={node.branch_id}
              className={cn(
                "relative flex flex-col items-center justify-center rounded-xl border px-3 py-4 text-center transition-all",
                positions[node.branch_id] || "",
                online
                  ? "border-emerald-400/60 bg-emerald-500/15 shadow-[0_0_24px_rgba(52,211,153,0.25)]"
                  : "border-rose-500/50 bg-rose-950/40 animate-pulse",
                node.is_local_node && "ring-2 ring-cyan-400/50",
              )}
            >
              <Wifi className={cn("h-5 w-5 mb-1", online ? "text-emerald-300" : "text-rose-400")} />
              <p className="text-xs font-bold leading-tight">{node.label}</p>
              <p className="text-[10px] uppercase text-slate-400 mt-1">{online ? "Online" : "Offline"}</p>
              <p className="text-[10px] font-mono text-slate-500 mt-1">
                {node.latency_ms != null ? `${node.latency_ms} ms` : "—"}
                {node.last_sync_seconds_ago != null ? ` · sync ${node.last_sync_seconds_ago}s` : ""}
              </p>
              <p className="text-[10px] text-cyan-300/80 mt-1">
                ⇄ {node.packets_flow ?? 0} pkt/5m
              </p>
              {online ? (
                <span className="pointer-events-none absolute -top-1 right-2 text-emerald-400 text-lg animate-pulse">→</span>
              ) : null}
            </div>
          );
        })}

        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-40" aria-hidden>
          <line x1="50%" y1="22%" x2="50%" y2="38%" stroke="#34d399" strokeWidth="2" strokeDasharray="6 4" />
          <line x1="28%" y1="28%" x2="45%" y2="42%" stroke="#22d3ee" strokeWidth="2" strokeDasharray="6 4" />
          <line x1="72%" y1="72%" x2="55%" y2="58%" stroke="#22d3ee" strokeWidth="2" strokeDasharray="6 4" />
        </svg>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Kardex ciego, ventas y deliveries fluyen por Cloudflare Tunnel hacia el clúster Atlas en tiempo real.
      </p>
    </div>
  );
}

function QrPanel({ url }) {
  const qrSrc = useMemo(() => {
    const encoded = encodeURIComponent(url || "");
    return `https://api.qrserver.com/v1/create-qr-code/?size=420x420&margin=10&data=${encoded}`;
  }, [url]);

  return (
    <div className="flex flex-col items-center rounded-2xl border border-slate-600 bg-white p-4 shadow-2xl">
      <img src={qrSrc} alt="QR acceso ERP" className="h-48 w-48 object-contain sm:h-56 sm:w-56" />
      <p className="mt-2 text-center text-xs font-medium text-slate-600">Escaneo rápido para empleados</p>
    </div>
  );
}

function formatUptime(hours) {
  if (hours == null) return "N/D";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

export function ServerDashboardPage() {
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState("");
  const [clock, setClock] = useState(() => new Date());

  const loadDashboard = useCallback(async () => {
    try {
      const response = await axios.get(buildApiUrl("/server-appliance/dashboard"), { timeout: 8000 });
      setPayload(response.data);
      setError("");
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "No se pudo cargar el HyperVisor");
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    const metricsTimer = window.setInterval(loadDashboard, 4000);
    const clockTimer = window.setInterval(() => setClock(new Date()), 1000);
    return () => {
      window.clearInterval(metricsTimer);
      window.clearInterval(clockTimer);
    };
  }, [loadDashboard]);

  useEffect(() => {
    document.documentElement.classList.add("server-dashboard-kiosk");
    return () => document.documentElement.classList.remove("server-dashboard-kiosk");
  }, []);

  const hw = payload?.hardware || {};
  const lan = payload?.local_lan || {};
  const cloud = payload?.cloud_services || {};
  const mesh = payload?.delta_mesh_network || [];
  const accessUrl = lan.access_url || payload?.access?.url || "";
  const nodeName = payload?.node?.node_name || "Nodo ERP";

  return (
    <div
      className="min-h-screen overflow-y-auto bg-slate-950 text-white"
      data-testid="server-dashboard-page"
    >
      <div className="pointer-events-none fixed inset-0 opacity-20 [background-image:linear-gradient(rgba(34,211,238,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.06)_1px,transparent_1px)] [background-size:40px_40px]" />

      <div className="relative mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-400/90">
              HyperVisor Global · Servidor y Red Delta
            </p>
            <h1 className="mt-2 flex items-center gap-3 text-3xl font-black tracking-tight sm:text-4xl">
              <Server className="h-8 w-8 text-cyan-400" />
              {nodeName}
            </h1>
            <p className="mt-1 text-sm text-slate-400">{clock.toLocaleString("es-NI")}</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-right">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Actualización</p>
            <p className="font-mono text-sm text-emerald-400">cada 4s</p>
          </div>
        </header>

        {error ? (
          <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-rose-200">{error}</div>
        ) : null}

        {/* SECCIÓN 1 — Impacto */}
        <section className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr_0.6fr_0.6fr]">
          <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-slate-900 to-slate-950 p-5 lg:col-span-1">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300/80">IP de acceso LAN</p>
            <p className="mt-2 break-all font-mono text-[clamp(1.5rem,4vw,3.2rem)] font-black leading-none text-white">
              {accessUrl || "192.168.1.26:3000"}
            </p>
            <p className="mt-2 text-sm text-slate-400">Dirección fija del ERP en la red local</p>
          </div>
          <QrPanel url={accessUrl} />
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5 flex flex-col justify-center">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
              <Users className="h-4 w-4 text-cyan-400" />
              Usuarios en línea
            </div>
            <p className="mt-2 font-mono text-5xl font-black text-cyan-300">{lan.active_users_count ?? 0}</p>
            <p className="text-xs text-slate-500 mt-1">{lan.active_connections ?? 0} conexiones TCP</p>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5 flex flex-col justify-center">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
              <Timer className="h-4 w-4 text-emerald-400" />
              Uptime servidor
            </div>
            <p className="mt-2 font-mono text-4xl font-black text-emerald-300">{formatUptime(hw.uptime_hours)}</p>
            <p className="text-xs text-slate-500 mt-1">Reinicio automático programado 03:00 AM</p>
          </div>
        </section>

        {/* SECCIÓN 2 — Hardware */}
        <section>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.28em] text-slate-400">Tablero hardware real-time</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DonutGauge label="CPU" value={hw.cpu_usage_pct} icon={Cpu} />
            <DonutGauge label="RAM" value={hw.ram_usage_pct} icon={Activity} />
            <DonutGauge label="Disco uploads" value={hw.disk_uploads_pct} icon={HardDrive} />
            <ThermometerGauge celsius={hw.cpu_temp_c} />
          </div>
        </section>

        {/* SECCIÓN 3 — Mesh */}
        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <DeltaMeshMap
            nodes={mesh}
            atlasOnline={cloud.mongodb_atlas?.status === "CONNECTED"}
          />
          <div className="space-y-3">
            <div className={cn(
              "rounded-xl border px-4 py-3",
              cloud.cloudflare?.tunnel_status === "ONLINE"
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-rose-500/40 bg-rose-500/10",
            )}
            >
              <p className="text-xs uppercase tracking-widest text-slate-400">Cloudflare Tunnel</p>
              <p className="text-lg font-bold">{cloud.cloudflare?.tunnel_status || "OFFLINE"}</p>
              <p className="text-sm text-slate-400">
                {cloud.cloudflare?.bandwidth_kbps ?? 0} kbps · {cloud.cloudflare?.latency_ms ?? "—"} ms
              </p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3">
              <p className="text-xs uppercase tracking-widest text-slate-400">USB Respaldo</p>
              <p className={cn(
                "text-lg font-bold",
                lan.usb_backup_status === "CONNECTED" ? "text-emerald-400" : "text-rose-400",
              )}
              >
                {lan.usb_backup_status || "DISCONNECTED"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3">
              <p className="text-xs uppercase tracking-widest text-slate-400">LAN</p>
              <p className="font-mono text-sm">{lan.lan_ip}:{lan.frontend_port}</p>
            </div>
          </div>
        </section>

        {/* SECCIÓN 4 — Nube */}
        <section>
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.28em] text-slate-400">
            <Cloud className="h-4 w-4" />
            Semáforos de almacenamiento en nube
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <CloudProgressBar
              label="MongoDB Atlas"
              used={cloud.mongodb_atlas?.size_used_mb ?? 0}
              total={cloud.mongodb_atlas?.size_total_mb ?? 512}
              unit="MB"
              tone="violet"
            />
            <CloudProgressBar
              label="TeraBox Cold Backup"
              used={cloud.terabox?.storage_used_gb ?? 0}
              total={cloud.terabox?.storage_total_gb ?? 1024}
              unit="GB"
              lastSync={cloud.terabox?.last_backup_time}
              folders={cloud.terabox?.folders || []}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            TeraBox sync: {cloud.terabox?.sync_success_pct ?? 0}% · Estado {cloud.terabox?.status || "DISCONNECTED"}
          </p>
        </section>
      </div>
    </div>
  );
}