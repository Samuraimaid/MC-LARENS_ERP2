import React from "react";
import { FlowHealthPanel } from "@/components/ops/FlowHealthPanel";

export function FlowHealthPage() {
  return (
    <div
      className="p-4 md:p-6 space-y-4 bg-gradient-to-br from-slate-100 via-blue-50 to-cyan-50 min-h-full rounded-xl"
      data-testid="flow-health-page"
    >
      <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-1">Operaciones</p>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">
          Salud del flujo
        </h1>
        <p className="text-slate-600 mt-1 max-w-3xl">
          Vista gerencial de cuellos de botella en caja, despacho, órdenes de trabajo,
          polarizados y control de calidad. Se actualiza automáticamente.
        </p>
      </div>
      <FlowHealthPanel compact={false} autoRefreshMs={30000} />
    </div>
  );
}

export default FlowHealthPage;
