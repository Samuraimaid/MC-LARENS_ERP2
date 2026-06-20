import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { API_BASE as API } from "@/lib/api";

const POLL_INTERVAL = 10000;

export default function ConnectivityBadge() {
  const [status, setStatus] = useState("unknown"); // unknown, ok, down
  const [checking, setChecking] = useState(false);

  const check = useCallback(async (signal) => {
    setChecking(true);
    try {
      await axios.get(`${API}/`, { timeout: 3000, signal });
      setStatus("ok");
    } catch (err) {
      setStatus("down");
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    check(controller.signal).catch(() => null);
    const id = setInterval(() => {
      const c = new AbortController();
      check(c.signal).catch(() => null);
    }, POLL_INTERVAL);
    return () => {
      controller.abort();
      clearInterval(id);
    };
  }, [check]);

  return (
    <div className="fixed left-4 bottom-4 z-50">
      <div className="flex items-center gap-3 bg-card/80 border border-border rounded-lg px-3 py-2 shadow-lg">
        <span className={`inline-block w-3 h-3 rounded-full ${status === 'ok' ? 'bg-emerald-500' : status === 'down' ? 'bg-destructive' : 'bg-yellow-400 animate-pulse'}`} />
        <div className="text-xs">
          {status === 'ok' && 'Servidor: conectado'}
          {status === 'down' && 'Servidor: desconectado'}
          {status === 'unknown' && (checking ? 'Comprobando...' : 'Verificando...')}
        </div>
        <button
          className="ml-2 text-xs px-2 py-1 rounded border border-border bg-background/80 hover:bg-background"
          onClick={() => { const c = new AbortController(); check(c.signal).catch(() => null); }}
          disabled={checking}
        >
          {checking ? '...' : 'Reintentar'}
        </button>
      </div>
    </div>
  );
}
