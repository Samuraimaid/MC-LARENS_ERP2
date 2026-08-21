import axios from "axios";
import { toast } from "sonner";
import { getRuntimeApiBase, getRuntimeOrigin, setRuntimeApiBase } from "@/lib/runtimeApi.js";

const HEARTBEAT_MS = 5000;
const FAILURE_THRESHOLD = 2;
const HEARTBEAT_PATH = "/currencies/usd-nio-dual";

let started = false;
let heartbeatTimer = null;
let localFailures = 0;
let activeMode = "local";
let contingencyToastId = null;

function readEnvList(key, fallback = []) {
  if (typeof window === "undefined") return fallback;
  const raw = window[key];
  if (!raw) return fallback;
  if (Array.isArray(raw)) return raw;
  return String(raw)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function detectLocalLanOrigin() {
  if (typeof window === "undefined" || !window.location) {
    return "http://127.0.0.1:3000";
  }
  const { hostname, port, protocol } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return `${protocol}//${hostname}${port ? `:${port}` : ""}`;
  }
  if (/^192\.168\./.test(hostname) || /^10\./.test(hostname)) {
    return `${protocol}//${hostname}${port ? `:${port}` : ""}`;
  }
  return window.location.origin;
}

function buildFailoverNodes() {
  const localOrigin = detectLocalLanOrigin();
  const tunnelMain = window.__FAILOVER_TUNNEL_MAIN__ || "https://mclarenerp.com";
  const tunnelNorth = window.__FAILOVER_TUNNEL_NORTH__ || "https://north.mclarenerp.com";
  const tunnelSouth = window.__FAILOVER_TUNNEL_SOUTH__ || "https://south.mclarenerp.com";
  const custom = readEnvList("__FAILOVER_TUNNELS__", []);

  const tunnels = custom.length
    ? custom
    : [tunnelMain, tunnelNorth, tunnelSouth].filter((value, index, arr) => arr.indexOf(value) === index);

  return [
    { id: "local-lan", label: "LAN local", origin: localOrigin, apiBase: `${localOrigin}/api` },
    ...tunnels.map((origin, index) => ({
      id: `tunnel-${index + 1}`,
      label: `Túnel ${index + 1}`,
      origin: String(origin).replace(/\/$/, ""),
      apiBase: `${String(origin).replace(/\/$/, "")}/api`,
    })),
  ];
}

async function probeNode(node) {
  const url = `${node.apiBase}${HEARTBEAT_PATH}`;
  const response = await axios.get(url, {
    timeout: 2800,
    withCredentials: true,
    validateStatus: (status) => status >= 200 && status < 500,
  });
  return response.status >= 200 && response.status < 400;
}

function applyNode(node, mode) {
  setRuntimeApiBase(node.apiBase);
  axios.defaults.baseURL = node.origin;
  activeMode = mode;
}

function showContingencyToast(node) {
  if (contingencyToastId) return;
  contingencyToastId = toast.warning(
    `Servidor local offline. Operando en modo de contingencia por Internet (${node.label}).`,
    { duration: Infinity },
  );
}

function hideContingencyToast() {
  if (!contingencyToastId) return;
  toast.dismiss(contingencyToastId);
  contingencyToastId = null;
}

async function heartbeatTick() {
  const nodes = buildFailoverNodes();
  const localNode = nodes[0];
  const tunnelNodes = nodes.slice(1);

  try {
    const localOk = await probeNode(localNode);
    if (localOk) {
      localFailures = 0;
      if (activeMode !== "local") {
        applyNode(localNode, "local");
        hideContingencyToast();
        toast.success("Servidor local restaurado. Tráfico devuelto a la red LAN.", { duration: 4000 });
      }
      return;
    }
    throw new Error("local heartbeat failed");
  } catch (_error) {
    localFailures += 1;
  }

  if (localFailures < FAILURE_THRESHOLD) {
    return;
  }

  for (const node of tunnelNodes) {
    try {
      const tunnelOk = await probeNode(node);
      if (!tunnelOk) continue;
      if (activeMode !== node.id) {
        applyNode(node, node.id);
        showContingencyToast(node);
      }
      return;
    } catch (_error) {
      // try next tunnel
    }
  }
}

export function startFailoverManager() {
  if (started || typeof window === "undefined") return;
  started = true;

  const nodes = buildFailoverNodes();
  applyNode(nodes[0], "local");

  axios.interceptors.request.use((config) => {
    const runtimeBase = getRuntimeApiBase();
    const origin = getRuntimeOrigin();
    if (typeof config.url === "string" && config.url.startsWith("/api/") && origin) {
      config.url = `${origin}${config.url}`;
    } else if (typeof config.url === "string" && config.url.startsWith("/api/")) {
      config.url = `${runtimeBase}${config.url.replace(/^\/api/, "")}`;
    }
    return config;
  });

  heartbeatTick().catch(() => {});
  heartbeatTimer = window.setInterval(() => {
    heartbeatTick().catch(() => {});
  }, HEARTBEAT_MS);
}

export function stopFailoverManager() {
  if (heartbeatTimer) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  started = false;
  hideContingencyToast();
}

export function getFailoverStatus() {
  return {
    activeMode,
    localFailures,
    apiBase: getRuntimeApiBase(),
    nodes: buildFailoverNodes(),
  };
}