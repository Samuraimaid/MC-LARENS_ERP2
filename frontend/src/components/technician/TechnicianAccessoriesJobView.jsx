import React, { useState } from "react";
import { Badge } from "../ui/badge";
import { Checkbox } from "../ui/checkbox";
import { Wrench, PackageCheck, AlertCircle, CheckCircle2, FileText } from "lucide-react";

export function TechnicianAccessoriesJobView({ order, onUpdateTasks }) {
  const items = order.items || [];
  const [completedTasks, setCompletedTasks] = useState({});

  const toggleTask = (idx) => {
    const updated = { ...completedTasks, [idx]: !completedTasks[idx] };
    setCompletedTasks(updated);
    if (onUpdateTasks) onUpdateTasks(updated);
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Resumen de Accesorios a Instalar */}
      <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-rose-800 dark:text-rose-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-rose-600" />
          <span className="font-bold">Módulo de Instalación de Accesorios</span>
        </div>
        <Badge variant="outline" className="border-rose-300 text-rose-700 dark:text-rose-300">
          {items.length} accesorio{items.length === 1 ? "" : "s"}
        </Badge>
      </div>

      {/* Lista de Accesorios y Checklist de Montaje */}
      <div className="space-y-2">
        <p className="font-bold text-foreground flex items-center gap-1.5">
          <PackageCheck className="h-4 w-4 text-primary" />
          Checklist de Montaje y Fijación
        </p>

        {items.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground border rounded-lg bg-muted/20">
            No hay accesorios específicos listados en esta orden.
          </div>
        ) : (
          items.map((item, idx) => {
            const isDone = Boolean(completedTasks[idx]);
            return (
              <div
                key={idx}
                onClick={() => toggleTask(idx)}
                className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                  isDone
                    ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-800 dark:text-emerald-200"
                    : "bg-background hover:border-primary/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Checkbox checked={isDone} onCheckedChange={() => toggleTask(idx)} />
                  <div>
                    <p className={`font-semibold ${isDone ? "line-through opacity-70" : ""}`}>
                      {item.product_name || item.name || `Accesorio #${idx + 1}`}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Cant: {item.quantity || 1} • {item.notes || "Fijación y ajuste según manual"}
                    </p>
                  </div>
                </div>

                <Badge variant={isDone ? "default" : "secondary"} className={isDone ? "bg-emerald-600 text-white text-[10px]" : "text-[10px]"}>
                  {isDone ? "Montado ✓" : "Pendiente"}
                </Badge>
              </div>
            );
          })
        )}
      </div>

      {/* Notas y Control de Calidad Pre-Entrega */}
      <div className="p-3 bg-muted/40 rounded-xl border space-y-2">
        <p className="font-semibold text-foreground flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-primary" />
          Revisión de Seguridad Taller
        </p>
        <ul className="list-disc list-inside text-[11px] text-muted-foreground space-y-1">
          <li>Verificar torque de tornillería y fijación de soportes.</li>
          <li>Comprobar holguras y que no existan roces con carrocería.</li>
          <li>Limpiar zona de trabajo y retirar empaques/protectores.</li>
        </ul>
      </div>
    </div>
  );
}

export default TechnicianAccessoriesJobView;
