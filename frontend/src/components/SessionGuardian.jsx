import React, { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";

export default function SessionGuardian({ onUnlock, cajeroId }) {
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const resetTimer = () => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setLocked(true), 5 * 60 * 1000);
    };

    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("keydown", resetTimer);
    resetTimer();

    return () => {
      clearTimeout(timerRef.current);
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("keydown", resetTimer);
    };
  }, []);

  const handleUnlock = async () => {
    setLoading(true);
    try {
      const response = await fetch("/auth/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cajero_id: cajeroId, pin }),
      });
      if (!response.ok) throw new Error("PIN incorrecto");
      setLocked(false);
      setPin("");
      if (onUnlock) onUnlock();
    } catch {
      toast.error("PIN incorrecto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={locked}>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80" />
      <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex w-80 -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-bold">Sesión Bloqueada</h2>
        <input
          type="password"
          maxLength={4}
          className="mb-4 w-24 border-b-2 border-gray-400 text-center text-2xl"
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
          disabled={loading}
        />
        <button
          className="rounded bg-blue-600 px-4 py-2 text-white"
          onClick={handleUnlock}
          disabled={loading || pin.length !== 4}
          type="button"
        >
          {loading ? "Verificando..." : "Desbloquear"}
        </button>
      </Dialog.Content>
    </Dialog.Root>
  );
}
