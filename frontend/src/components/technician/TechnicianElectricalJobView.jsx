import React, { useState } from "react";
import { Badge } from "../ui/badge";
import { Checkbox } from "../ui/checkbox";
import { Zap, Activity, CheckCircle2, ShieldAlert, Cpu } from "lucide-react";

export function TechnicianElectricalJobView({ order, onUpdateCheckpoints }) {
  const items = order.items || [];
  const [completedPoints, setCompletedPoints] = useState({});

  const electricalChecks = [
    { id: "battery_disconnect", label: "Desconexión de Batería / Aislamiento de Borne Negativo" },
    { id: "harness_routing", label: "Enrutado de Arneses y Fijación con Cintillos Térmicos" },
    { id: "fuse_installation", label: "Instalación de Portafusible y Fusible Dedicado Calibrado" },
    { id: "ground_check", label: "Verificación de Punto de Masa / Tierra sin Pintura ni Óxido" },
    { id: "voltage_test", label: "Prueba de Voltaje con Multímetro (12V Constante / Accesorios)" },
    { id: "module_functional_test", label: "Prueba Funcional del Sistema (Luces/Radio/Alarma/Cámara)" },
  ];

  const toggleCheck = (id) => {
    const updated = { ...completedPoints, [id]: !completedPoints[id] };
    setCompletedPoints(updated);
    if (onUpdateCheckpoints) onUpdateCheckpoints(updated);
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Banner de Módulo Eléctrico */}
      <div className="p-3 bg-indigo-500/10 border border-indigo-500/25 rounded-xl text-indigo-800 dark:text-indigo-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-indigo-600" />
          <span className="font-bold">Módulo Eléctrico y Diagnóstico</span>
        </div>
        <Badge variant="outline" className="border-indigo-300 text-indigo-700 dark:text-indigo-300">
          Circuito 12V
        </Badge>
      </div>

      {/* Componentes a Conectar */}
      {items.length > 0 && (
        <div className="p-3 bg-muted/40 rounded-xl border space-y-1.5">
          <p className="font-semibold text-foreground flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5 text-primary" />
            Equipos Eléctricos a Conectar
          </p>
          <div className="divide-y divide-border/60">
            {items.map((it, idx) => (
              <div key={idx} className="py-1.5 flex justify-between items-center text-[11px]">
                <span className="font-medium">{it.product_name || it.name || "Equipo"}</span>
                <span className="text-muted-foreground">x{it.quantity || 1}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Puntos de Verificación Eléctrica */}
      <div className="space-y-2">
        <p className="font-bold text-foreground flex items-center gap-1.5">
          <Activity className="h-4 w-4 text-primary" />
          Puntos de Control de Seguridad Eléctrica
        </p>

        {electricalChecks.map(({ id, label }) => {
          const isDone = Boolean(completedPoints[id]);
          return (
            <div
              key={id}
              onClick={() => toggleCheck(id)}
              className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                isDone
                  ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-800 dark:text-emerald-200"
                  : "bg-background hover:border-primary/50"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Checkbox checked={isDone} onCheckedChange={() => toggleCheck(id)} />
                <span className={`font-medium ${isDone ? "line-through opacity-70" : ""}`}>
                  {label}
                </span>
              </div>
              <Badge variant={isDone ? "default" : "secondary"} className={isDone ? "bg-emerald-600 text-white text-[10px]" : "text-[10px]"}>
                {isDone ? "OK ✓" : "Pendiente"}
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TechnicianElectricalJobView;
