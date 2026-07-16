import React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowRight,
  Car,
  Clock,
  Heart,
  ShieldCheck,
  User,
  Wrench,
} from "lucide-react";

function staffLabel(person) {
  return person?.display_name
    || [person?.nombre, person?.apellido].filter(Boolean).join(" ")
    || "N/A";
}

function formatMinutes(value) {
  if (value == null || Number.isNaN(Number(value))) return null;
  return `${Number(value)} min`;
}

function formatNio(value) {
  if (value == null || Number.isNaN(Number(value))) return "N/A";
  return `C$ ${Number(value).toLocaleString("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function TimelineStep({ step, isLast }) {
  const icons = {
    caja: User,
    bodega: ShieldCheck,
    taller: Wrench,
    qc: ShieldCheck,
  };
  const Icon = icons[step.step] || ArrowRight;
  const actor = step.actor || "N/A";

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div className="flex min-w-0 flex-col items-center gap-1 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary/30 bg-primary/5 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {step.label}
        </p>
        <p className="max-w-[14ch] truncate text-xs font-medium">{actor}</p>
      </div>
      {!isLast ? (
        <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
      ) : null}
    </div>
  );
}

export default function SaleOperationalAuditPanel({ audit }) {
  if (!audit) return null;

  const vehiculo = audit.vehiculo;
  const timeline = audit.timeline || [];
  const waitLabel = formatMinutes(audit.tiempo_espera_instalacion);
  const shopLabel = formatMinutes(audit.tiempo_ejecucion_taller);

  return (
    <div className="mx-auto w-full max-w-[80ch] space-y-4">
      <Card className="overflow-hidden border-slate-200/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <Wrench className="h-5 w-5 text-primary" />
            Línea de tiempo del taller e historial de garantía
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {vehiculo ? (
            <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2">
              <div className="flex items-start gap-3 sm:col-span-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-background shadow-sm">
                  <Car className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="text-2xl font-bold leading-tight tracking-tight">
                    {[vehiculo.marca, vehiculo.modelo].filter(Boolean).join(" ") || "Vehículo"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {[vehiculo.anio, vehiculo.placa].filter(Boolean).join(" · ") || "Sin placa"}
                  </p>
                  {vehiculo.vin ? (
                    <p className="font-mono text-xs text-muted-foreground">VIN {vehiculo.vin}</p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Venta de mostrador — sin vehículo ni flujo de taller registrado.
            </p>
          )}

          {timeline.length > 0 ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              {timeline.map((step, idx) => (
                <TimelineStep
                  key={`${step.step}-${idx}`}
                  step={step}
                  isLast={idx === timeline.length - 1}
                />
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {waitLabel ? (
              <Badge variant="secondary" className="gap-1 px-3 py-1 text-sm font-semibold">
                <Clock className="h-3.5 w-3.5" />
                Espera pre-instalación: {waitLabel}
              </Badge>
            ) : null}
            {shopLabel ? (
              <Badge variant="outline" className="gap-1 px-3 py-1 text-sm font-semibold">
                <Clock className="h-3.5 w-3.5" />
                Tiempo en taller: {shopLabel}
              </Badge>
            ) : null}
          </div>

          {audit.has_workshop_flow ? (
            <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <p>Bodega: {staffLabel(audit.despachado_por_bodega)}</p>
              <p>Taller recibió: {staffLabel(audit.recibido_por_taller)}</p>
              <p>Instaló: {staffLabel(audit.instalado_por)}</p>
              <p>QC Gate: {staffLabel(audit.control_calidad_por)}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-emerald-200/70 shadow-sm dark:border-emerald-900/40">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <Heart className="h-5 w-5 text-emerald-600" />
            Estadísticas de cliente (fidelización)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border bg-background p-4 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Visitas totales
              </p>
              <p className="mt-2 text-4xl font-bold tabular-nums leading-none">
                {audit.total_visitas_historicas ?? 0}
              </p>
            </div>
            <div className="rounded-xl border bg-background p-4 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Compra promedio
              </p>
              <p className={cn("mt-2 text-3xl font-bold tabular-nums leading-none")}>
                {formatNio(audit.ticket_promedio_nio)}
              </p>
            </div>
            <div className="rounded-xl border bg-background p-4 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Servicio favorito
              </p>
              <p className="mt-2 text-2xl font-bold leading-tight">
                {audit.servicio_favorito || "N/A"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}