import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Activity,
  Battery,
  BatteryCharging,
  ChevronRight,
  Cloud,
  Cpu,
  Database,
  Folder,
  File,
  HardDrive,
  KeyRound,
  Loader2,
  Network,
  RefreshCw,
  Save,
  Server,
  Smartphone,
  Thermometer,
  Timer,
  Upload,
  Users,
  Wifi,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { VehicleThumbnailWatermark } from "@/components/erp/VehicleThumbnailWatermark";
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

function ThermometerGauge({ celsius, simulated = false }) {
  const temp = Number(celsius ?? 42);
  const pct = Math.min(100, (temp / 100) * 100);
  const hot = temp > 75;

  return (
    <div className={cn(
      "rounded-2xl border p-4",
      hot ? "border-rose-500/60 bg-rose-950/30" : "border-slate-700/80 bg-slate-900/80",
    )}
    >
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        <Thermometer className={cn("h-4 w-4", hot ? "text-rose-400" : "text-amber-400")} />
        CPU · Termómetro
        {simulated ? <span className="text-[10px] text-slate-500">estimado</span> : null}
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
            {temp}°C
          </p>
          {hot ? <p className="mt-1 text-sm font-semibold text-rose-300">Alerta térmica &gt; 75°C</p> : null}
        </div>
      </div>
    </div>
  );
}

function BatteryGauge({ pct = 100, status = "", onAc = true, autonomyMinutes = null }) {
  const level = Math.max(0, Math.min(100, Number(pct)));
  const discharging = !onAc || /descargando/i.test(status);
  const critical = discharging && level < 30;
  const warning = discharging && level < 100 && level >= 30;

  const Icon = onAc && !/descargando/i.test(status) ? BatteryCharging : Battery;

  return (
    <div className={cn(
      "rounded-2xl border p-4 transition-all",
      critical && "animate-pulse border-rose-500/70 bg-rose-950/40",
      warning && !critical && "animate-pulse border-amber-500/60 bg-amber-950/30",
      !critical && !warning && "border-slate-700/80 bg-slate-900/80",
    )}
    >
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        <Icon className={cn(
          "h-4 w-4",
          critical ? "text-rose-400" : warning ? "text-amber-400" : "text-emerald-400",
        )}
        />
        Energía · UPS / Host
      </div>
      <div className="flex items-end gap-4">
        <div className="relative h-14 w-24 rounded-lg border-2 border-slate-500 bg-slate-950 p-1">
          <div
            className={cn(
              "h-full rounded-sm transition-all duration-700",
              critical ? "bg-rose-500" : warning ? "bg-amber-400" : "bg-emerald-400",
            )}
            style={{ width: `${level}%` }}
          />
          <div className="absolute -right-2 top-1/2 h-5 w-1.5 -translate-y-1/2 rounded-r bg-slate-500" />
        </div>
        <div>
          <p className={cn(
            "font-mono text-4xl font-black",
            critical ? "text-rose-300" : warning ? "text-amber-300" : "text-emerald-300",
          )}
          >
            {level}%
          </p>
          <p className="mt-1 max-w-[200px] text-xs leading-snug text-slate-400">{status}</p>
          {discharging && autonomyMinutes != null ? (
            <p className={cn("mt-1 text-sm font-semibold", critical ? "text-rose-300" : "text-amber-300")}>
              Autonomía ~{autonomyMinutes} min
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function buildFleetVehicleFromDevice(device) {
  const fleet = device?.fleet_vehicle || {};
  return {
    brand: fleet.brand || device?.brand || "",
    model: fleet.model || device?.model || "",
    plate: fleet.plate_number || device?.plate_number || "",
    vehicle_type_slug: fleet.vehicle_type_slug || device?.vehicle_type_slug || "",
    thumbnail_slug: fleet.thumbnail_slug || device?.thumbnail_slug || "",
    classification_source: fleet.classification_source || "catalog",
  };
}

function MobileBackupCard({ device }) {
  const online = device?.status === "ONLINE";
  const signal = device?.signal_strength || "SIN SEÑAL";
  const fleetVehicle = buildFleetVehicleFromDevice(device);
  const fleetDisplay =
    device?.fleet_display
    || device?.fleet_vehicle?.fleet_display
    || (
      [fleetVehicle.brand, fleetVehicle.model].filter(Boolean).join(" ")
      + (fleetVehicle.plate ? ` - Placa: ${fleetVehicle.plate}` : "")
    )
    || "Vehículo en contingencia";
  const hasFleetSilhouette = Boolean(fleetVehicle.brand || fleetVehicle.model || fleetVehicle.vehicle_type_slug);

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl border p-5",
      online
        ? "border-emerald-400/60 bg-emerald-500/10 shadow-[0_0_28px_rgba(52,211,153,0.18)]"
        : "border-rose-500/50 bg-rose-950/30",
    )}
    >
      {hasFleetSilhouette ? (
        <VehicleThumbnailWatermark
          vehicle={fleetVehicle}
          positionClassName="right-[-4%] top-1/2 h-[78%] w-[52%] -translate-y-1/2"
          className="opacity-90"
        />
      ) : null}
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">
          <Smartphone className={cn("h-4 w-4", online ? "text-emerald-300" : "text-rose-400")} />
          Dispositivo móvil de contingencia
        </div>
        <div className="flex items-center gap-2">
          {hasFleetSilhouette && online ? (
            <div
              className="relative h-10 w-14 overflow-hidden rounded-md border border-emerald-400/30 bg-slate-900/70"
              aria-hidden="true"
            >
              <VehicleThumbnailWatermark
                vehicle={fleetVehicle}
                positionClassName="inset-0 h-full w-full"
                className="opacity-100"
              />
            </div>
          ) : null}
          <span className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
            online ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300",
          )}
          >
            {device?.status || "OFFLINE"}
          </span>
        </div>
      </div>
      <p className="relative z-10 mt-1 text-[11px] text-slate-500">Flota en calle · Portal /driver</p>
      <p className="relative z-10 mt-4 max-w-[85%] text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
        {fleetDisplay}
      </p>
      <p className="relative z-10 mt-2 font-mono text-sm text-slate-400">
        Contingencia · {device?.phone_number || "+505XXXX-XXXX"}
      </p>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl border border-slate-700/80 bg-slate-900/60 px-2 py-3">
          <p className="text-[10px] uppercase tracking-widest text-slate-500">Señal</p>
          <p className={cn("mt-1 text-sm font-bold", online ? "text-emerald-300" : "text-slate-400")}>{signal}</p>
        </div>
        <div className="rounded-xl border border-slate-700/80 bg-slate-900/60 px-2 py-3">
          <p className="text-[10px] uppercase tracking-widest text-slate-500">Último ping</p>
          <p className="mt-1 text-sm font-bold text-cyan-300">{device?.last_ping || "—"}</p>
        </div>
        <div className="rounded-xl border border-slate-700/80 bg-slate-900/60 px-2 py-3">
          <p className="text-[10px] uppercase tracking-widest text-slate-500">Jobs activos</p>
          <p className="mt-1 font-mono text-2xl font-black text-white">{device?.active_jobs ?? 0}</p>
        </div>
      </div>
    </div>
  );
}

function isCloudflareHealthy(cloudflare) {
  return cloudflare?.tunnel_status === "ONLINE" || cloudflare?.env_configured === true;
}

function isAtlasHealthy(atlas) {
  return atlas?.status === "CONNECTED" || atlas?.env_configured === true || atlas?.ping_healthy === true;
}

function isTeraboxHealthy(terabox) {
  return (
    terabox?.remote_session_active === true
    || terabox?.status === "CONNECTED"
  );
}

function teraboxStatusLabel(terabox) {
  if (terabox?.remote_session_active || terabox?.status === "CONNECTED") return "CONECTADO";
  if (terabox?.needs_browser_session || terabox?.status === "PENDING_SESSION") return "PENDIENTE SESIÓN";
  if (terabox?.env_configured) return "CREDENCIALES OK";
  return terabox?.status || "DESCONECTADO";
}

function CloudProgressBar({ label, used, total, unit, lastSync, folders = [], tone = "cyan", healthy = true }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const toneBar = tone === "violet" ? "from-violet-500 to-fuchsia-400" : "from-cyan-500 to-sky-400";

  return (
    <div className={cn(
      "rounded-2xl border bg-slate-900/80 p-5 space-y-3",
      healthy ? "border-emerald-500/40" : "border-slate-700/80",
    )}
    >
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

function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** idx).toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function formatModified(value) {
  if (!value) return "—";
  const asNum = Number(value);
  if (!Number.isNaN(asNum) && asNum > 1_000_000_000) {
    return new Date(asNum * 1000).toLocaleString("es-NI");
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString("es-NI");
}

const TERABOX_COOKIE_KEYS = ["jstoken", "ndus", "csrfToken", "browserid"];

function parseTeraboxCookiePaste(raw) {
  const text = String(raw || "").trim();
  if (!text) return {};

  const out = {};
  const assign = (name, value) => {
    const key = String(name || "").trim();
    const val = String(value || "").trim();
    if (TERABOX_COOKIE_KEYS.includes(key) && val) out[key] = val;
  };

  if (text.startsWith("[") || text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text);
      const rows = Array.isArray(parsed) ? parsed : (parsed.cookies || []);
      rows.forEach((row) => assign(row?.name || row?.key, row?.value));
      if (Object.keys(out).length) return out;
    } catch {
      /* intentar formato texto */
    }
  }

  text.split(/[;\n]/).forEach((part) => {
    const eq = part.indexOf("=");
    if (eq < 1) return;
    assign(part.slice(0, eq), part.slice(eq + 1));
  });
  return out;
}

function buildTeraboxSessionPayload(form) {
  const session = {};
  const pasted = parseTeraboxCookiePaste(form.cookie_paste);
  TERABOX_COOKIE_KEYS.forEach((key) => {
    const value = String(form[key] || pasted[key] || "").trim();
    if (value) session[key] = value;
  });
  return session;
}

function TeraBoxManagementPanel({ defaultRoot = "/MCLarensERP" }) {
  const [creds, setCreds] = useState(null);
  const [credsError, setCredsError] = useState("");
  const [form, setForm] = useState({
    username: "",
    password: "",
    root_folder: defaultRoot,
    remote_folder: "/MCLarensERP/cold-backups",
    share_url: "",
    jstoken: "",
    ndus: "",
    csrfToken: "",
    browserid: "",
    cookie_paste: "",
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [currentPath, setCurrentPath] = useState(defaultRoot);
  const [filesPayload, setFilesPayload] = useState(null);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState("");
  const [backupRunning, setBackupRunning] = useState(false);
  const [backupResult, setBackupResult] = useState(null);
  const [backupError, setBackupError] = useState("");

  const loadCredentials = useCallback(async () => {
    try {
      const response = await axios.get(buildApiUrl("/server-appliance/terabox/credentials"), {
        withCredentials: true,
        timeout: 25000,
      });
      setCreds(response.data);
      setCredsError("");
      setForm((prev) => ({
        ...prev,
        username: "",
        password: "",
        root_folder: response.data?.root_folder || prev.root_folder,
        remote_folder: response.data?.remote_folder || prev.remote_folder,
        share_url: response.data?.share_url || prev.share_url,
      }));
      if (response.data?.root_folder) {
        setCurrentPath(response.data.root_folder);
      }
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setCredsError(typeof detail === "string" ? detail : err?.message || "Sin acceso a credenciales TeraBox");
    }
  }, []);

  const loadFiles = useCallback(async (path) => {
    setFilesLoading(true);
    setFilesError("");
    try {
      const response = await axios.get(buildApiUrl("/server-appliance/terabox/files"), {
        params: { path },
        withCredentials: true,
        timeout: 20000,
      });
      setFilesPayload(response.data);
      setCurrentPath(response.data?.path || path);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setFilesError(typeof detail === "string" ? detail : err?.message || "No se pudo listar TeraBox");
      setFilesPayload(null);
    } finally {
      setFilesLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadCredentials();
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [loadCredentials]);

  useEffect(() => {
    if (!credsError && creds) {
      loadFiles(currentPath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recargar al cambiar ruta en explorador
  }, [creds, credsError, currentPath]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const payload = {};
      if (form.username.trim()) payload.username = form.username.trim();
      if (form.password.trim()) payload.password = form.password.trim();
      const session = buildTeraboxSessionPayload(form);
      if (Object.keys(session).length) payload.session = session;
      const response = await axios.post(
        buildApiUrl("/server-appliance/terabox/credentials/test"),
        payload,
        { withCredentials: true, timeout: 20000 },
      );
      setTestResult(response.data);
    } catch (err) {
      setTestResult({
        connected: false,
        message: err?.response?.data?.detail || err?.message || "Prueba fallida",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setTestResult(null);
    try {
      const payload = {
        root_folder: form.root_folder.trim(),
        remote_folder: form.remote_folder.trim(),
        share_url: form.share_url.trim(),
      };
      if (form.username.trim()) payload.username = form.username.trim();
      if (form.password.trim()) payload.password = form.password.trim();
      const session = buildTeraboxSessionPayload(form);
      if (Object.keys(session).length) payload.session = session;
      const response = await axios.put(
        buildApiUrl("/server-appliance/terabox/credentials"),
        payload,
        { withCredentials: true, timeout: 20000 },
      );
      setTestResult({ connected: response.data?.connected, message: response.data?.message });
      setForm((prev) => ({ ...prev, password: "" }));
      await loadCredentials();
      await loadFiles(form.root_folder.trim() || currentPath);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setTestResult({
        connected: false,
        message: typeof detail === "string" ? detail : err?.message || "No se guardaron las credenciales",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBackup = async () => {
    setBackupRunning(true);
    setBackupError("");
    setBackupResult(null);
    try {
      const response = await axios.post(
        buildApiUrl("/server-appliance/backup/run"),
        {},
        { withCredentials: true, timeout: 960000 },
      );
      setBackupResult(response.data);
      await loadFiles(form.remote_folder.trim() || currentPath);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (detail && typeof detail === "object") {
        setBackupError(detail.message || detail.stderr || "Respaldo falló");
      } else {
        setBackupError(typeof detail === "string" ? detail : err?.message || "Respaldo falló");
      }
    } finally {
      setBackupRunning(false);
    }
  };

  const pathSegments = useMemo(() => {
    const normalized = (currentPath || "/").replace(/\/+$/, "") || "/";
    if (normalized === "/") return [{ label: "/", path: "/" }];
    const parts = normalized.split("/").filter(Boolean);
    const crumbs = [{ label: "/", path: "/" }];
    let acc = "";
    parts.forEach((part) => {
      acc += `/${part}`;
      crumbs.push({ label: part, path: acc });
    });
    return crumbs;
  }, [currentPath]);

  const entries = filesPayload?.entries || [];
  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
      return String(a.name).localeCompare(String(b.name), "es");
    });
  }, [entries]);

  const connected = creds?.connected ?? testResult?.connected;

  return (
    <div className="space-y-4 rounded-2xl border border-cyan-500/25 bg-slate-900/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
            <Cloud className="h-4 w-4" />
            TeraBox · Credenciales y explorador
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Gestione la cuenta de respaldo y navegue archivos sin salir del ERP
          </p>
        </div>
        <span className={cn(
          "rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider",
          connected ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300",
        )}
        >
          {connected ? "Conectado" : "Desconectado"}
        </span>
      </div>

      {credsError ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          {credsError} — inicie sesión como gerencia o programador.
        </div>
      ) : (
        <>
          {creds?.configured && !creds?.session_configured ? (
            <div className="rounded-xl border border-amber-500/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
              <p className="font-semibold">TeraBox cierra la página si detecta F12 — no use DevTools en terabox.com</p>
              <p className="mt-1 text-xs text-amber-200/90">
                Cookie-Editor solo funciona <strong>estando en la pestaña terabox.com</strong> (no en about:blank).
                Cierre el aviso «Got it» de la extensión, abra terabox.com, inicie sesión, y recién ahí clic en el icono de la extensión.
              </p>
              <ol className="mt-2 list-decimal space-y-2 pl-5 text-xs text-amber-200/90">
                <li>
                  <strong>Recomendado — Firefox:</strong> instale Firefox, abra terabox.com, inicie sesión, F12 → Almacenamiento → Cookies →
                  www.terabox.com (Firefox no suele bloquear DevTools).
                </li>
                <li>
                  <strong>Cookie-Editor en Chrome:</strong> pestaña <strong>terabox.com</strong> con sesión iniciada → icono extensión → Export → pegar JSON abajo.
                  No abra F12.
                </li>
                <li>
                  <strong>Script automático (Windows):</strong> inicie sesión en terabox.com en Chrome, cierre Chrome, luego en PowerShell:{" "}
                  <code className="block mt-1 rounded bg-slate-900 px-2 py-1 text-[10px] text-cyan-200">
                    pip install browser-cookie3
                    <br />
                    python backend/scripts/export_chrome_terabox_cookies.py --test
                  </code>
                </li>
                <li>
                  <strong>Chrome datos de sitios:</strong> tras iniciar sesión en terabox.com, otra pestaña →{" "}
                  <code className="rounded bg-slate-900 px-1 text-cyan-200">chrome://settings/siteData</code> → buscar terabox.
                </li>
              </ol>
            </div>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-slate-700/80 bg-slate-950/60 p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                <KeyRound className="h-4 w-4 text-cyan-400" />
                Credenciales de acceso
              </p>
              <p className="text-xs text-slate-500">
                Cuenta actual: {creds?.username_masked || "no configurada"}
              </p>
              <label className="block text-xs text-slate-400">
                Usuario / correo
                <input
                  type="email"
                  value={form.username}
                  onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                  placeholder={creds?.username_masked || "cuenta@terabox.com"}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                />
              </label>
              <label className="block text-xs text-slate-400">
                Contraseña (dejar vacío para no cambiar)
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="••••••••"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs text-slate-400">
                  Carpeta raíz
                  <input
                    type="text"
                    value={form.root_folder}
                    onChange={(e) => setForm((prev) => ({ ...prev, root_folder: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                  />
                </label>
                <label className="block text-xs text-slate-400">
                  Carpeta respaldos
                  <input
                    type="text"
                    value={form.remote_folder}
                    onChange={(e) => setForm((prev) => ({ ...prev, remote_folder: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                  />
                </label>
              </div>
              <label className="block text-xs text-slate-400">
                URL de compartido (opcional)
                <input
                  type="url"
                  value={form.share_url}
                  onChange={(e) => setForm((prev) => ({ ...prev, share_url: e.target.value }))}
                  placeholder="https://1024terabox.com/s/..."
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                />
              </label>
              <div className="rounded-lg border border-violet-500/30 bg-violet-950/20 p-3 space-y-2">
                <p className="text-xs font-semibold text-violet-200">Sesión del navegador (requerida si TeraBox pide verificación)</p>
                <p className="text-[11px] text-slate-400">
                  Cookies de <strong className="text-violet-200">www.terabox.com</strong>, no de localhost.
                  Estado actual: {creds?.session_configured ? "cookies guardadas" : "sin cookies"}
                </p>
                <label className="block text-[11px] text-slate-400">
                  Pegado rápido (JSON de Cookie-Editor o texto ndus=...; jstoken=...)
                  <textarea
                    value={form.cookie_paste}
                    onChange={(e) => setForm((prev) => ({ ...prev, cookie_paste: e.target.value }))}
                    rows={3}
                    placeholder='[{"name":"ndus","value":"..."},{"name":"jstoken","value":"..."}]'
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-[11px] text-white outline-none focus:border-violet-400"
                  />
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    type="text"
                    value={form.ndus}
                    onChange={(e) => setForm((prev) => ({ ...prev, ndus: e.target.value }))}
                    placeholder="ndus"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-violet-400"
                  />
                  <input
                    type="text"
                    value={form.jstoken}
                    onChange={(e) => setForm((prev) => ({ ...prev, jstoken: e.target.value }))}
                    placeholder="jstoken"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-violet-400"
                  />
                  <input
                    type="text"
                    value={form.csrfToken}
                    onChange={(e) => setForm((prev) => ({ ...prev, csrfToken: e.target.value }))}
                    placeholder="csrfToken"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-violet-400"
                  />
                  <input
                    type="text"
                    value={form.browserid}
                    onChange={(e) => setForm((prev) => ({ ...prev, browserid: e.target.value }))}
                    placeholder="browserid"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-violet-400"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing || saving}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                >
                  {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Probar conexión
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || testing}
                  className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/50 bg-cyan-500/15 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Guardar credenciales
                </button>
              </div>
              {testResult ? (
                <p className={cn("text-xs", testResult.connected ? "text-emerald-300" : "text-rose-300")}>
                  {testResult.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-3 rounded-xl border border-slate-700/80 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  <Folder className="h-4 w-4 text-cyan-400" />
                  Explorador de archivos
                </p>
                <button
                  type="button"
                  onClick={() => loadFiles(currentPath)}
                  disabled={filesLoading}
                  className="rounded-lg border border-slate-600 p-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                  title="Actualizar listado"
                >
                  <RefreshCw className={cn("h-4 w-4", filesLoading && "animate-spin")} />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1 text-xs text-slate-400">
                {pathSegments.map((crumb, idx) => (
                  <span key={crumb.path} className="inline-flex items-center gap-1">
                    {idx > 0 ? <ChevronRight className="h-3 w-3 text-slate-600" /> : null}
                    <button
                      type="button"
                      onClick={() => setCurrentPath(crumb.path)}
                      className="rounded px-1 py-0.5 font-mono hover:bg-slate-800 hover:text-cyan-300"
                    >
                      {crumb.label}
                    </button>
                  </span>
                ))}
              </div>
              {filesPayload?.source === "local_fallback" ? (
                <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
                  Estos archivos están solo en el servidor local — aún no aparecen en la web de TeraBox.
                  {filesPayload.remote_error ? ` Error remoto: ${filesPayload.remote_error}` : ""}
                </div>
              ) : null}
              {filesPayload?.message ? (
                <p className="text-[11px] text-slate-500">
                  {filesPayload.message}
                  {filesPayload.source && filesPayload.source !== "local_fallback"
                    ? ` · fuente: ${filesPayload.source}`
                    : ""}
                </p>
              ) : null}
              {filesError ? (
                <p className="text-xs text-rose-300">{filesError}</p>
              ) : (
                <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-900 text-slate-500">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Nombre</th>
                        <th className="px-3 py-2 font-semibold">Tamaño</th>
                        <th className="px-3 py-2 font-semibold">Modificado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedEntries.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-3 py-6 text-center text-slate-500">
                            {filesLoading ? "Cargando..." : "Carpeta vacía o sin acceso remoto"}
                          </td>
                        </tr>
                      ) : (
                        sortedEntries.map((entry) => {
                          const entryPath = entry.path || `${currentPath.replace(/\/$/, "")}/${entry.name}`;
                          return (
                            <tr
                              key={`${entryPath}-${entry.name}`}
                              className="border-t border-slate-800/80 hover:bg-slate-900/80"
                            >
                              <td className="px-3 py-2">
                                <button
                                  type="button"
                                  disabled={!entry.is_dir}
                                  onClick={() => entry.is_dir && setCurrentPath(entryPath)}
                                  className={cn(
                                    "inline-flex items-center gap-2 text-left",
                                    entry.is_dir ? "text-cyan-300 hover:underline" : "text-slate-300",
                                  )}
                                >
                                  {entry.is_dir ? <Folder className="h-3.5 w-3.5" /> : <File className="h-3.5 w-3.5" />}
                                  {entry.name}
                                </button>
                              </td>
                              <td className="px-3 py-2 font-mono text-slate-400">
                                {entry.is_dir ? "—" : formatBytes(entry.size_bytes)}
                              </td>
                              <td className="px-3 py-2 text-slate-500">{formatModified(entry.modified_at)}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-emerald-200">Respaldo completo del ERP</p>
                <p className="text-xs text-slate-400">
                  MongoDB + uploads → archivo .tar.gz → copia local, USB y TeraBox en segundo plano
                </p>
              </div>
              <button
                type="button"
                onClick={handleBackup}
                disabled={backupRunning}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-50"
              >
                {backupRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {backupRunning ? "Respaldando..." : "Ejecutar respaldo ahora"}
              </button>
            </div>
            {backupError ? <p className="mt-2 text-xs text-rose-300">{backupError}</p> : null}
            {backupResult ? (
              <div className="mt-2 space-y-1 text-xs">
                <p className={backupResult.terabox_upload?.last_upload_status === "success" ? "text-emerald-300" : "text-amber-300"}>
                  {backupResult.message}
                  {backupResult.latest_archive ? ` · ${backupResult.latest_archive}` : ""}
                  {backupResult.latest_size_bytes ? ` (${formatBytes(backupResult.latest_size_bytes)})` : ""}
                </p>
                {backupResult.terabox_upload ? (
                  <p className={backupResult.terabox_upload.last_upload_status === "success" ? "text-emerald-300" : "text-rose-300"}>
                    TeraBox: {backupResult.terabox_upload.message || backupResult.terabox_upload.last_upload_status}
                    {backupResult.terabox_upload.last_remote_path ? ` → ${backupResult.terabox_upload.last_remote_path}` : ""}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
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
  const mobile = payload?.mobile_backup_device || {};
  const accessUrl = lan.access_url || payload?.access?.url || "";
  const nodeName = payload?.node?.node_name || "Nodo ERP";
  const cfHealthy = isCloudflareHealthy(cloud.cloudflare);
  const atlasHealthy = isAtlasHealthy(cloud.mongodb_atlas);
  const teraboxHealthy = isTeraboxHealthy(cloud.terabox);

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
            <p className="mt-2 whitespace-nowrap font-mono text-[clamp(1.25rem,3.5vw,2.8rem)] font-black leading-none text-white">
              {accessUrl || "Detectando IP LAN..."}
            </p>
            <p className="mt-2 text-sm text-slate-400">
              Dirección fija del ERP en la red local
              {lan.lan_ip_source ? ` · origen: ${lan.lan_ip_source}` : ""}
            </p>
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

        {/* SECCIÓN 2 — Hardware + Energía */}
        <section className="space-y-4">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.28em] text-slate-400">Tablero hardware real-time</p>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <DonutGauge label="CPU" value={hw.cpu_usage_pct} icon={Cpu} />
              <DonutGauge label="RAM" value={hw.ram_usage_pct} icon={Activity} />
              <DonutGauge label="Disco uploads" value={hw.disk_uploads_pct} icon={HardDrive} />
              <ThermometerGauge celsius={hw.cpu_temp_c} simulated={hw.cpu_temp_simulated} />
              <BatteryGauge
                pct={hw.battery_pct ?? 100}
                status={hw.battery_status}
                onAc={hw.battery_on_ac !== false}
                autonomyMinutes={hw.battery_autonomy_minutes}
              />
            </div>
          </div>
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.28em] text-slate-400">
              Flota en calle · contingencia móvil
            </p>
            <MobileBackupCard device={mobile} />
          </div>
        </section>

        {/* SECCIÓN 3 — Mesh */}
        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <DeltaMeshMap
            nodes={mesh}
            atlasOnline={atlasHealthy}
          />
          <div className="space-y-3">
            <div className={cn(
              "rounded-xl border px-4 py-3",
              cfHealthy
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-rose-500/40 bg-rose-500/10",
            )}
            >
              <p className="text-xs uppercase tracking-widest text-slate-400">Cloudflare Tunnel</p>
              <p className={cn("text-lg font-bold", cfHealthy ? "text-emerald-300" : "text-rose-300")}>
                {cfHealthy ? "ONLINE" : (cloud.cloudflare?.tunnel_status || "OFFLINE")}
              </p>
              <p className="text-sm text-slate-400">
                {cloud.cloudflare?.bandwidth_kbps ?? 0} kbps · {cloud.cloudflare?.latency_ms ?? "—"} ms
                {cloud.cloudflare?.env_configured ? " · token .env OK" : ""}
              </p>
            </div>
            <div className={cn(
              "rounded-xl border px-4 py-3",
              atlasHealthy
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-rose-500/40 bg-rose-500/10",
            )}
            >
              <p className="text-xs uppercase tracking-widest text-slate-400">MongoDB Atlas</p>
              <p className={cn("text-lg font-bold", atlasHealthy ? "text-emerald-300" : "text-rose-300")}>
                {atlasHealthy ? "CONNECTED" : (cloud.mongodb_atlas?.status || "DISCONNECTED")}
              </p>
              <p className="text-sm text-slate-400">
                {cloud.mongodb_atlas?.size_used_mb ?? 0} / {cloud.mongodb_atlas?.size_total_mb ?? 512} MB
                {cloud.mongodb_atlas?.env_configured ? " · URI .env OK" : ""}
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
              healthy={atlasHealthy}
            />
            <CloudProgressBar
              label="TeraBox Cold Backup"
              used={cloud.terabox?.storage_used_gb ?? 0}
              total={cloud.terabox?.storage_total_gb ?? 1024}
              unit="GB"
              lastSync={cloud.terabox?.last_backup_time}
              folders={cloud.terabox?.folders || []}
              healthy={teraboxHealthy}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Atlas modo: {cloud.mongodb_atlas?.cluster_mode || "n/d"}
            {" · "}
            TeraBox sync: {cloud.terabox?.sync_success_pct ?? 0}%
            {" · "}
            Estado {teraboxStatusLabel(cloud.terabox)}
          </p>
        </section>

        {/* SECCIÓN 5 — TeraBox gestión */}
        <section>
          <TeraBoxManagementPanel />
        </section>
      </div>
    </div>
  );
}