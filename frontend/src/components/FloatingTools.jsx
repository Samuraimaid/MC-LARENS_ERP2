import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { ArrowLeftRight } from "lucide-react";
import { API_BASE as API } from "@/lib/api";

const DEFAULT_RATE = 36.5;

export function FloatingTools({ activeTool, onClose }) {
  const [position, setPosition] = useState({ x: 24, y: 120 });
  const dragOffset = useRef(null);
  const [fxAmount, setFxAmount] = useState("1");
  const [fxFrom, setFxFrom] = useState("USD");
  const [fxTo, setFxTo] = useState("NIO");
  const [fxRate, setFxRate] = useState(DEFAULT_RATE);
  const [fxResult, setFxResult] = useState("");
  const [fxError, setFxError] = useState("");
  const [rateLoading, setRateLoading] = useState(false);

  const handlePointerDown = (event) => {
    if (event.button !== 0) return;
    dragOffset.current = {
      x: event.clientX - position.x,
      y: event.clientY - position.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (!dragOffset.current) return;
    const nextX = Math.max(12, event.clientX - dragOffset.current.x);
    const nextY = Math.max(12, event.clientY - dragOffset.current.y);
    setPosition({ x: nextX, y: nextY });
  };

  const handlePointerUp = (event) => {
    dragOffset.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const fetchDashboardRate = useCallback(async () => {
    setRateLoading(true);
    setFxError("");
    try {
      const response = await axios.get(`${API}/currencies/rates?base=USD`, {
        withCredentials: true,
      });
      const nioRate = response.data?.rates?.NIO;
      setFxRate(nioRate || DEFAULT_RATE);
    } catch (error) {
      console.error("FX rate error:", error);
      setFxRate(DEFAULT_RATE);
      setFxError("Usando tasa por defecto del dashboard");
    } finally {
      setRateLoading(false);
    }
  }, []);

  const computeConversion = useCallback(() => {
    const amount = parseFloat(fxAmount);
    if (Number.isNaN(amount)) {
      setFxResult("");
      return;
    }
    if (fxFrom === fxTo) {
      setFxResult(amount);
      return;
    }
    if (fxFrom === "USD" && fxTo === "NIO") {
      setFxResult(amount * fxRate);
      return;
    }
    if (fxFrom === "NIO" && fxTo === "USD") {
      setFxResult(amount / fxRate);
      return;
    }
    setFxResult("");
  }, [fxAmount, fxFrom, fxTo, fxRate]);

  useEffect(() => {
    if (activeTool) {
      fetchDashboardRate();
    }
  }, [activeTool, fetchDashboardRate]);

  useEffect(() => {
    computeConversion();
  }, [computeConversion]);

  if (!activeTool) return null;

  return (
    <div
      className="fixed z-50"
      style={{ left: position.x, top: position.y }}
    >
      <div className="w-[360px] rounded-xl border border-border bg-background/95 text-foreground shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <div
            className="flex flex-1 items-center gap-2 text-sm font-semibold cursor-move"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            Calculadora de Divisas
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
        <div className="space-y-3 p-4">
            <div>
              <Label className="text-xs">Monto</Label>
              <input
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={fxAmount}
                onChange={(event) => setFxAmount(event.target.value)}
                inputMode="decimal"
              />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-xs">De</Label>
                <select
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
                  value={fxFrom}
                  onChange={(event) => setFxFrom(event.target.value)}
                >
                  <option value="USD">USD</option>
                  <option value="NIO">NIO</option>
                </select>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10"
                onClick={() => {
                  setFxFrom(fxTo);
                  setFxTo(fxFrom);
                }}
                aria-label="Intercambiar divisas"
              >
                <ArrowLeftRight className="h-4 w-4" />
              </Button>
              <div className="flex-1">
                <Label className="text-xs">A</Label>
                <select
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
                  value={fxTo}
                  onChange={(event) => setFxTo(event.target.value)}
                >
                  <option value="NIO">NIO</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
            <div className="rounded-md border border-border bg-muted/60 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Tasa</span>
                <span>{rateLoading ? "..." : fxRate.toFixed(4)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between font-semibold">
                <span>Resultado</span>
                <span>
                  {fxResult !== "" && fxResult !== null
                    ? new Intl.NumberFormat("es-NI", {
                        style: "currency",
                        currency: fxTo,
                      }).format(fxResult)
                    : "-"}
                </span>
              </div>
              {fxError && <div className="mt-2 text-xs text-destructive">{fxError}</div>}
            </div>
          </div>
      </div>
    </div>
  );
}
