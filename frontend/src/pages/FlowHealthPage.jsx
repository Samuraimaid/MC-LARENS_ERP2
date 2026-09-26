import React from "react";
import { FlowHealthPanel } from "@/components/ops/FlowHealthPanel";

export function FlowHealthPage() {
  return (
    <div
      className="p-4 md:p-6 space-y-4 bg-gradient-to-br from-slate-100 via-blue-50 to-cyan-50 min-h-full rounded-xl"
      data-testid="flow-health-page"
    >
      <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm">
        <p className="mb-1 hidden text-xs uppercase tracking-[0.2em] text-slate-500 md:block">Operaciones</p>
        <h1 className="font-heading text-2xl mb-1 font-bold tracking-tight text-slate-900 md:mb-0 md:text-3xl">
          Salud del flujo
        </h1>
        <p className="mt-1 hidden max-w-3xl text-slate-600 md:block">
          Vista gerencial de cuellos de botella en caja, despacho, órdenes de trabajo,
          polarizados y control de calidad. Se actualiza automáticamente.
        </p>
      </div>
      <FlowHealthPanel compact={false} autoRefreshMs={30000} />
    </div>
  );
}

export default FlowHealthPage;
