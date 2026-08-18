import React, { useState, useEffect } from "react";
import { Server, Wifi, CheckCircle2, AlertCircle, RefreshCw, X, Smartphone } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
import { getRuntimeApiBase, setRuntimeApiBase } from "../../lib/runtimeApi";
import { isCapacitorNative } from "../../lib/env";

export default function ServerConnectionDialog({ isOpen, onClose }) {
  const [currentBase, setCurrentBase] = useState("");
  const [inputUrl, setInputUrl] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const defaultCloudUrl = "https://mclarens-erp-836176703716.us-central1.run.app/api";

  useEffect(() => {
    if (isOpen) {
      const base = getRuntimeApiBase();
      setCurrentBase(base);
      setInputUrl(base.startsWith("http") ? base : defaultCloudUrl);
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async (urlToTest) => {
    const rawTarget = (urlToTest || inputUrl).trim().replace(/\/$/, "");
    if (!rawTarget || (!rawTarget.startsWith("http://") && !rawTarget.startsWith("https://"))) {
      toast.error("Ingresa una URL válida (ej. https://... o http://192.168.1.50:8001/api)");
      return;
    }

    setTesting(true);
    setTestResult(null);
    const start = performance.now();

    const normalizedApi = rawTarget.endsWith("/api") ? rawTarget : `${rawTarget}/api`;
    const urlsToTry = [
      `${normalizedApi}/health`,
      `${normalizedApi}/`,
      normalizedApi,
      `${normalizedApi}/auth/csrf-token`,
      rawTarget,
    ];

    let lastError = null;
    for (const url of urlsToTry) {
      try {
        const res = await axios.get(url, { timeout: 5000 });
        if (res.status >= 200 && res.status < 400) {
          const elapsed = Math.round(performance.now() - start);
          setTestResult({
            success: true,
            status: res.status,
            latency: elapsed,
            data: res.data,
          });
          toast.success(`Conexión exitosa (${elapsed}ms)`);
          setTesting(false);
          return;
        }
      } catch (err) {
        lastError = err;
      }
    }

    setTestResult({
      success: false,
      error: lastError?.message || "No responde el servidor",
    });
    toast.error("No se pudo conectar con el servidor indicado");
    setTesting(false);
  };

  const handleApply = (urlToSave) => {
    const target = (urlToSave || inputUrl).trim().replace(/\/$/, "");
    if (!target) return;
    const finalUrl = target.endsWith("/api") ? target : `${target}/api`;
    setRuntimeApiBase(finalUrl);
    setCurrentBase(finalUrl);
    toast.success("Servidor actualizado correctamente");
    onClose();
  };

  const handleResetToCloud = () => {
    setInputUrl(defaultCloudUrl);
    handleApply(defaultCloudUrl);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
        {/* Cabecera */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-1.5">
                Configuración del Servidor
                {isCapacitorNative() && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <Smartphone className="h-3 w-3" /> App Móvil
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Selecciona la conexión a Cloud Run o red LAN local
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-4 space-y-4 text-xs">
          {/* Servidor Actual */}
          <div className="p-3 rounded-xl bg-zinc-100/70 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800">
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block mb-1">
              Servidor Activo
            </span>
            <span className="font-mono text-zinc-800 dark:text-zinc-200 break-all select-all font-medium text-[11px]">
              {currentBase || "/api (Same-origin)"}
            </span>
          </div>

          {/* Campo de Entrada */}
          <div className="space-y-1.5">
            <label className="font-semibold text-zinc-700 dark:text-zinc-300 block">
              URL del Backend API:
            </label>
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="https://mclarens-erp-xxx.run.app/api o http://192.168.1.xxx:8001/api"
              className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-mono focus:outline-none focus:ring-2 focus:ring-sky-500 text-zinc-900 dark:text-zinc-100"
            />
          </div>

          {/* Presets Rápidos */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
              Conexiones Rápidas:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setInputUrl(defaultCloudUrl);
                  handleTestConnection(defaultCloudUrl);
                }}
                className="p-2 rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50/50 dark:bg-sky-950/30 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-sky-900 dark:text-sky-200 text-left transition"
              >
                <div className="font-bold text-[11px] flex items-center gap-1">
                  <Wifi className="h-3 w-3 text-sky-600" /> Servidor Nube
                </div>
                <div className="text-[9px] text-zinc-500 dark:text-zinc-400 truncate">
                  Cloud Run Oficial
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  const lanUrl = "http://192.168.1.50:8001/api";
                  setInputUrl(lanUrl);
                  handleTestConnection(lanUrl);
                }}
                className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-200 text-left transition"
              >
                <div className="font-bold text-[11px] flex items-center gap-1">
                  <Server className="h-3 w-3 text-amber-500" /> Red LAN Sucursal
                </div>
                <div className="text-[9px] text-zinc-500 dark:text-zinc-400 truncate">
                  Mini PC / Servidor Local
                </div>
              </button>
            </div>
          </div>

          {/* Resultado de la Prueba */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border flex items-center gap-2.5 ${
                testResult.success
                  ? "bg-emerald-50/70 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-300"
                  : "bg-rose-50/70 border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-300"
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
              )}
              <div className="text-[11px]">
                {testResult.success ? (
                  <div>
                    <span className="font-bold block">Conexión Verificada</span>
                    <span className="text-[10px] opacity-90">
                      Respuesta en {testResult.latency} ms | Servidor activo
                    </span>
                  </div>
                ) : (
                  <div>
                    <span className="font-bold block">Fallo de Conexión</span>
                    <span className="text-[10px] opacity-90">{testResult.error}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleResetToCloud}
            className="text-[11px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline font-medium"
          >
            Restaurar Nube
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={testing}
              onClick={() => handleTestConnection()}
              className="px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 font-semibold text-xs text-zinc-700 dark:text-zinc-200 flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${testing ? "animate-spin" : ""}`} />
              Probar
            </button>

            <button
              type="button"
              onClick={() => handleApply()}
              className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 font-bold text-xs text-white shadow-md shadow-sky-600/20 transition"
            >
              Guardar y Conectar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
