import React, { useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Checkbox } from "../ui/checkbox";
import { Scissors, Car, CheckCircle2, AlertCircle, Layers } from "lucide-react";

export function TechnicianTintJobView({ order, onUpdateWindowStatus }) {
  const tintPlan = order.tint_window_plan || order.windows || {};
  const windows = tintPlan.windows || tintPlan || {};
  const sunstrips = tintPlan.sunstrips || {};
  const cuts = order.cuts || [];
  const cuttingStatus = order.cutting_status || (order.cut_order_id ? "cut_ready" : "pending_cut");
  const isMaterialReady = cuttingStatus === "cut_ready" || cuttingStatus === "delivered";

  // Estado local para checklist de ventanas instaladas
  const [completedWindows, setCompletedWindows] = useState({});

  const toggleWindow = (winKey) => {
    const updated = { ...completedWindows, [winKey]: !completedWindows[winKey] };
    setCompletedWindows(updated);
    if (onUpdateWindowStatus) {
      onUpdateWindowStatus(updated);
    }
  };

  const windowEntries = [
    {
      key: "windshield",
      label: "Parabrisas Delantero",
      data: windows.windshield,
      meters: "1.50m x 40\"",
    },
    {
      key: "front_sides",
      label: "Laterales Delanteros",
      data: windows.front_sides,
      meters: "1.00m x 20\"",
    },
    {
      key: "rear_sides",
      label: "Laterales Traseros",
      data: windows.rear_sides,
      meters: "1.00m x 20\"",
    },
    {
      key: "rear",
      label: "Vidrio Trasero (Luneta)",
      data: windows.rear,
      meters: windows.rear?.empalme_2x20 ? "2x 1.00m (Empalme)" : "1.50m x 40\"",
    },
  ];

  return (
    <div className="space-y-4 text-xs">
      {/* Alerta de Estado del Material Cortado */}
      <div
        className={`p-3 rounded-xl border flex items-center justify-between ${
          isMaterialReady
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
            : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-lg ${isMaterialReady ? "bg-emerald-500/20" : "bg-amber-500/20"}`}>
            <Scissors className="h-4 w-4" />
          </div>
          <div>
            <p className="font-bold text-sm">
              {isMaterialReady ? "Material Cortado y Listo ✓" : "Esperando Corte en Mesa"}
            </p>
            <p className="text-[11px] opacity-80">
              {isMaterialReady
                ? `Pliegos despachados por mesa de corte (${order.total_cutting_meters || order.total_meters || 0}m)`
                : "El coordinador está preparando los pliegos en mesa de corte"}
            </p>
          </div>
        </div>

        <Badge variant={isMaterialReady ? "default" : "outline"} className={isMaterialReady ? "bg-emerald-600 text-white font-semibold" : "border-amber-500 text-amber-600"}>
          {isMaterialReady ? "Listo p/ Montaje" : "En Corte"}
        </Badge>
      </div>

      {/* Croquis Visual y Resumen de Cristales */}
      <div className="bg-muted/40 p-3.5 rounded-xl border space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-bold flex items-center gap-1.5 text-foreground">
            <Car className="h-4 w-4 text-primary" />
            Croquis y Materiales por Cristal
          </span>
          <span className="text-[11px] text-muted-foreground">Check al instalar</span>
        </div>

        <div className="space-y-2">
          {windowEntries.map(({ key, label, data, meters }) => {
            if (!data || data.material_id === "none" || data.material_id === "sin_polarizado") {
              return null;
            }
            const isDone = Boolean(completedWindows[key]);

            return (
              <div
                key={key}
                onClick={() => toggleWindow(key)}
                className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                  isDone
                    ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-800 dark:text-emerald-200"
                    : "bg-background hover:border-primary/50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Checkbox checked={isDone} onCheckedChange={() => toggleWindow(key)} />
                  <div>
                    <p className={`font-semibold ${isDone ? "line-through opacity-70" : ""}`}>
                      {label}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {data.material_name || data.material_id} • <span className="font-mono">{meters}</span>
                    </p>
                  </div>
                </div>

                <Badge variant={isDone ? "default" : "secondary"} className={isDone ? "bg-emerald-600 text-white text-[10px]" : "text-[10px]"}>
                  {isDone ? "Instalado ✓" : "Pendiente"}
                </Badge>
              </div>
            );
          })}

          {/* Banda Solar Superior */}
          {sunstrips?.windshield_top?.enabled && (
            <div
              onClick={() => toggleWindow("sunstrip_top")}
              className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer ${
                completedWindows["sunstrip_top"] ? "bg-emerald-500/10 border-emerald-500/40" : "bg-background"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Checkbox checked={Boolean(completedWindows["sunstrip_top"])} onCheckedChange={() => toggleWindow("sunstrip_top")} />
                <div>
                  <p className="font-semibold">Banda Frontal Superior</p>
                  <p className="text-[11px] text-muted-foreground">
                    {sunstrips.windshield_top.material_name || "Franja Solar"} • <span className="font-mono">0.50m x 20"</span>
                  </p>
                </div>
              </div>
              <Badge variant={completedWindows["sunstrip_top"] ? "default" : "secondary"} className="text-[10px]">
                {completedWindows["sunstrip_top"] ? "Instalado ✓" : "0.50m"}
              </Badge>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TechnicianTintJobView;
