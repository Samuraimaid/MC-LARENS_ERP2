import React, { useEffect, useRef, useState } from "react";
import { BadgeCheck, XCircle, Lock, History, Loader2 } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

const WS_URL = "/ws/gerencia";

const tipoColor = {
  ANULACION: "bg-red-100 border-red-400",
  DESCUENTO_TARJETA: "bg-orange-100 border-orange-400",
  DEVOLUCION: "bg-blue-100 border-blue-400",
};

const tipoLabel = {
  ANULACION: "Anulación",
  DESCUENTO_TARJETA: "Descuento con Tarjeta",
  DEVOLUCION: "Devolución",
};

function impactoBadge(req) {
  if (req.tipo === "DESCUENTO_TARJETA") return `-$${req.monto_afectado.toFixed(2)} de comisión bancaria`;
  if (req.tipo === "ANULACION") return `Pérdida de venta: Folio ${req.sale_id}`;
  if (req.tipo === "DEVOLUCION") return `Retorno de stock: ${req.monto_afectado}`;
  return "";
}

function PinPad({ onSubmit, onCancel, loading }) {
  const [pin, setPin] = useState("");

  const handleNum = (digit) => {
    if (pin.length < 8) setPin((current) => current + digit);
  };

  const handleBack = () => setPin((current) => current.slice(0, -1));
  const handleOk = () => {
    if (pin.length === 8) onSubmit(pin);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="mb-2 font-mono text-2xl tracking-widest">{pin.replace(/./g, "•").padEnd(8, "_")}</div>
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((digit) => (
          <button
            key={digit}
            className="rounded bg-gray-200 p-4 text-xl hover:bg-gray-300"
            onClick={() => handleNum(String(digit))}
            disabled={loading || pin.length >= 8}
            type="button"
          >
            {digit}
          </button>
        ))}
        <button className="col-span-2 rounded bg-gray-300 p-2" onClick={handleBack} disabled={loading} type="button">
          Borrar
        </button>
        <button className="rounded bg-green-400 p-2" onClick={handleOk} disabled={loading || pin.length !== 8} type="button">
          {loading ? <Loader2 className="animate-spin" /> : "OK"}
        </button>
      </div>
      <button className="mt-2 text-sm text-gray-500" onClick={onCancel} disabled={loading} type="button">
        Cancelar
      </button>
    </div>
  );
}

export default function GerenteApprovalPanel() {
  const [online, setOnline] = useState(false);
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [modal, setModal] = useState({ open: false, req: null });
  const [loading, setLoading] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL.replace(/^http/, "ws"));
    wsRef.current = ws;
    ws.onopen = () => setOnline(true);
    ws.onclose = () => setOnline(false);
    ws.onerror = () => setOnline(false);
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "approval_request") {
        setPending((prev) => [message.data, ...prev]);
      }
    };

    return () => ws.close();
  }, []);

  const aprobar = async (req, pin) => {
    setLoading(true);
    try {
      const response = await fetch(`/approvals/resolve/${req.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved", pin }),
      });
      if (!response.ok) throw new Error("Error de autorización");
      const data = await response.json();
      toast.success(`Autorización enviada exitosamente a ${req.cajero_id}`);
      setPending((prev) => prev.filter((item) => item.id !== req.id));
      setHistory((prev) => [{ ...req, status: "approved", token: data.token_autorizacion }, ...prev].slice(0, 5));
    } catch {
      toast.error("PIN incorrecto o error de red");
    } finally {
      setLoading(false);
      setModal({ open: false, req: null });
    }
  };

  const rechazar = async (req) => {
    setLoading(true);
    try {
      await fetch(`/approvals/resolve/${req.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected", pin: "00000000" }),
      });
      setPending((prev) => prev.filter((item) => item.id !== req.id));
      setHistory((prev) => [{ ...req, status: "rejected" }, ...prev].slice(0, 5));
    } finally {
      setLoading(false);
    }
  };

  const bloqueoRapido = async () => {
    setLoading(true);
    for (const req of pending) {
      await rechazar(req);
    }
    toast("Todas las solicitudes han sido rechazadas");
    setLoading(false);
  };

  const revertir = async (req) => {
    toast("Decisión revertida (simulado)");
    setHistory((prev) => prev.filter((item) => item.id !== req.id));
    setPending((prev) => [req, ...prev]);
  };

  return (
    <div className="mx-auto max-w-2xl p-4">
      <div className="mb-4 flex items-center gap-2">
        <span className={clsx("h-3 w-3 rounded-full", online ? "bg-green-500" : "bg-red-400")} />
        <span className="text-sm">{online ? "En línea para alertas" : "Desconectado"}</span>
        <button
          className="ml-auto flex items-center gap-1 text-red-600 hover:underline"
          onClick={bloqueoRapido}
          disabled={loading || pending.length === 0}
          type="button"
        >
          <Lock size={16} /> Bloqueo Rápido
        </button>
      </div>

      <div className="space-y-4">
        <AnimatePresence>
          {pending.map((req) => (
            <motion.div
              key={req.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className={clsx("flex flex-col gap-2 rounded border-l-4 p-4 shadow", tipoColor[req.tipo] || "border-gray-400 bg-gray-100")}>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{tipoLabel[req.tipo] || req.tipo}</span>
                  <span className="ml-auto text-xs text-gray-500">Folio: {req.sale_id}</span>
                </div>
                <div className="text-sm text-gray-700">
                  Cajero: <b>{req.cajero_id}</b>
                </div>
                <div className="text-sm italic">Justificación: {req.justificacion}</div>
                <span className="mt-1 inline-block rounded border bg-white px-2 py-1 font-mono text-xs">{impactoBadge(req)}</span>
                <div className="mt-2 flex gap-2">
                  <Dialog.Root open={modal.open && modal.req?.id === req.id} onOpenChange={(open) => setModal({ open, req: open ? req : null })}>
                    <Dialog.Trigger asChild>
                      <button className="flex items-center gap-1 rounded bg-green-500 px-3 py-1 text-white hover:bg-green-600" disabled={loading} type="button">
                        <BadgeCheck size={16} /> Aprobar
                      </button>
                    </Dialog.Trigger>
                    <Dialog.Portal>
                      <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
                      <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-80 -translate-x-1/2 -translate-y-1/2 rounded bg-white p-6 shadow-lg">
                        <h2 className="mb-2 text-lg font-bold">Ingrese PIN de Gerente</h2>
                        <PinPad onSubmit={(pin) => aprobar(req, pin)} onCancel={() => setModal({ open: false, req: null })} loading={loading} />
                      </Dialog.Content>
                    </Dialog.Portal>
                  </Dialog.Root>
                  <button
                    className="flex items-center gap-1 rounded bg-red-500 px-3 py-1 text-white hover:bg-red-600"
                    onClick={() => rechazar(req)}
                    disabled={loading}
                    type="button"
                  >
                    <XCircle size={16} /> Rechazar
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="mt-8">
        <button className="flex items-center gap-1 text-blue-600 hover:underline" onClick={() => setShowHistory((value) => !value)} type="button">
          <History size={16} /> Historial de Decisiones
        </button>
        <AnimatePresence>
          {showHistory && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-2 space-y-2">
                {history.length === 0 && <div className="text-sm text-gray-400">Sin historial reciente.</div>}
                {history.map((entry) => (
                  <div
                    key={entry.id}
                    className={clsx(
                      "flex items-center gap-2 rounded border-l-4 p-3",
                      entry.status === "approved" ? "border-green-400 bg-green-50" : "border-red-400 bg-red-50"
                    )}
                  >
                    <span className="font-bold">{tipoLabel[entry.tipo] || entry.tipo}</span>
                    <span className="text-xs text-gray-500">Folio: {entry.sale_id}</span>
                    <span className="ml-auto text-xs">{entry.status === "approved" ? "Aprobada" : "Rechazada"}</span>
                    <button className="ml-2 text-xs text-blue-600 underline" onClick={() => revertir(entry)} disabled={loading} type="button">
                      Revertir
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
