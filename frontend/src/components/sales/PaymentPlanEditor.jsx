import React, { useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  applyMixedPlanLinePatch,
  absorbPlanRoundingDifference,
  buildDefaultPlanLine,
  canAddMixedPlanLine,
  computeLineAmountNio,
  computePlanRoundingTolerance,
  computePlanTotalNio,
  normalizePlanLineAmounts,
  planLineIdentity,
  validatePlanAgainstTotal,
  isPlanLineAmountEmpty,
  validatePlanLineUniqueness,
} from "@/lib/plannedPaymentPlan";
import { getPaymentMethodSummaryLabel } from "@/lib/paymentMethods";

const METHOD_LABELS = {
  cash: "Efectivo",
  transfer: "Transferencia",
  card: "Tarjeta",
};

function wouldDuplicateLine(lines, index, patch) {
  const candidate = { ...lines[index], ...patch };
  const key = planLineIdentity(candidate);
  return lines.some((line, rowIndex) => rowIndex !== index && planLineIdentity(line) === key);
}

export default function PaymentPlanEditor({
  paymentMethod = "cash",
  mixedMethods = [],
  lines = [],
  onChangeLines,
  onRemoveLine,
  exchangeRate = 36.5,
  sellExchangeRate = null,
  targetTotal = 0,
  disabled = false,
  structureLocked = false,
  totalChangedHint = false,
  submitAttention = false,
  submitAttentionMessage = "",
}) {
  const isMixed = paymentMethod === "mixed";
  const pricingRate = Number(sellExchangeRate || exchangeRate) || 36.5;
  const plannedTotal = useMemo(() => computePlanTotalNio(lines, exchangeRate), [lines, exchangeRate]);
  const roundingTolerance = useMemo(
    () => computePlanRoundingTolerance(lines, exchangeRate),
    [lines, exchangeRate],
  );
  const validation = useMemo(
    () => validatePlanAgainstTotal(lines, exchangeRate, targetTotal),
    [lines, exchangeRate, targetTotal],
  );
  const uniqueness = useMemo(() => validatePlanLineUniqueness(lines), [lines]);
  const canAddLine = isMixed && canAddMixedPlanLine(lines, mixedMethods);
  const mixedMethodsReady = !isMixed || mixedMethods.length > 0;
  const canValidatePlan = mixedMethodsReady && lines.length > 0;

  const commitLines = (nextLines) => {
    const unique = validatePlanLineUniqueness(nextLines);
    if (!unique.ok) {
      toast.error(unique.message);
      return;
    }
    const normalized = normalizePlanLineAmounts(nextLines);
    const absorbed = absorbPlanRoundingDifference(normalized, exchangeRate, targetTotal);
    onChangeLines?.(absorbed);
  };

  const isAmountOnlyPatch = (patch) => (
    Object.keys(patch).length === 1 && Object.prototype.hasOwnProperty.call(patch, "monto_origen")
  );

  const updateLine = (index, patch) => {
    if (wouldDuplicateLine(lines, index, patch)) {
      toast.error("Ya existe una línea con ese método y moneda");
      return;
    }
    if (isAmountOnlyPatch(patch)) {
      onChangeLines?.(lines.map((line, rowIndex) => (
        rowIndex === index ? { ...line, monto_origen: patch.monto_origen } : line
      )));
      return;
    }
    const nextLines = isMixed
      ? applyMixedPlanLinePatch(lines, index, patch, exchangeRate, targetTotal)
      : lines.map((line, rowIndex) => (rowIndex === index ? { ...line, ...patch } : line));
    commitLines(nextLines);
  };

  const finalizeAmountLine = (index) => {
    const line = lines[index];
    if (!line || isPlanLineAmountEmpty(line)) return;
    const nextLines = isMixed
      ? applyMixedPlanLinePatch(
        lines,
        index,
        { monto_origen: line.monto_origen },
        exchangeRate,
        targetTotal,
      )
      : lines;
    commitLines(nextLines);
  };

  const addLine = () => {
    if (!canAddLine) return;
    const currencies = ["NIO", "USD"];
    let created = null;
    for (const method of mixedMethods) {
      for (const currency of currencies) {
        const exists = lines.some((line) => planLineIdentity(line) === `${method}|${currency}`);
        if (!exists) {
          created = buildDefaultPlanLine(method, currency);
          break;
        }
      }
      if (created) break;
    }
    if (!created) {
      toast.error("No hay combinaciones método/moneda disponibles");
      return;
    }
    commitLines([...lines, created]);
  };

  const removeLine = (index) => {
    if (lines.length <= 1) return;
    const removed = lines[index];
    const nextLines = lines.filter((_, rowIndex) => rowIndex !== index);
    onChangeLines?.(nextLines);
    onRemoveLine?.(removed, nextLines);
  };

  const showTotalChangedHint = totalChangedHint
    && !validation.ok
    && lines.some((line) => !isPlanLineAmountEmpty(line));

  const attentionMessage = submitAttentionMessage
    || "Ajusta los montos del plan de cobro para que cuadren con el total antes de enviar la factura a caja.";

  if (isMixed && !mixedMethods.length) {
    return (
      <div className={cn(
        "space-y-3 rounded-md border border-sky-200 bg-sky-50/70 p-3",
        submitAttention && "ring-2 ring-rose-500 ring-offset-2",
      )}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <TooltipProvider delayDuration={0}>
              <Tooltip open={submitAttention}>
                <TooltipTrigger asChild>
                  <p className="text-sm font-medium text-sky-950">Plan de cobro acordado (obligatorio)</p>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-center">
                  {attentionMessage}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <p className="text-xs text-sky-900/80">
              Selecciona al menos un método de pago mixto arriba para configurar el plan.
            </p>
          </div>
          <div className="text-right text-xs">
            <div>TC compra (pagos US$): <span className="font-mono">{Number(exchangeRate || 0).toFixed(4)}</span></div>
            <div>TC venta (precios): <span className="font-mono">{Number(pricingRate || 0).toFixed(4)}</span></div>
            <div>Importe: <span className="font-semibold">C$ {Number(targetTotal || 0).toFixed(2)}</span></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "space-y-3 rounded-md border border-sky-200 bg-sky-50/70 p-3",
      submitAttention && "ring-2 ring-rose-500 ring-offset-2",
    )}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <TooltipProvider delayDuration={0}>
            <Tooltip open={submitAttention}>
              <TooltipTrigger asChild>
                <p className="text-sm font-medium text-sky-950">Plan de cobro acordado (obligatorio)</p>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-center">
                {attentionMessage}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <p className="text-xs text-sky-900/80">
            Montos con máximo 2 decimales. Tolerancia de redondeo ±C$ {roundingTolerance.toFixed(2)}.
            Cambios posteriores solo por gerencia/supervisor.
          </p>
        </div>
        <div className="text-right text-xs">
          <div>TC compra (pagos US$): <span className="font-mono">{Number(exchangeRate || 0).toFixed(4)}</span></div>
          <div>TC venta (precios): <span className="font-mono">{Number(pricingRate || 0).toFixed(4)}</span></div>
          <div>Importe: <span className="font-semibold">C$ {Number(targetTotal || 0).toFixed(2)}</span></div>
        </div>
      </div>

      {!isMixed ? (
        <p className="text-xs text-muted-foreground">
          Método: {getPaymentMethodSummaryLabel(paymentMethod, mixedMethods)}
        </p>
      ) : null}

      {showTotalChangedHint ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
          El importe cambió; revisa y ajusta el plan de cobro para que cuadre con el total.
        </p>
      ) : null}

      <div className="space-y-2">
        {lines.map((line, index) => {
          const amountNio = computeLineAmountNio(line, exchangeRate);
          const sharePercent = targetTotal > 0 && amountNio > 0
            ? (amountNio / targetTotal) * 100
            : 0;
          return (
            <div key={`plan-line-${index}`} className="grid grid-cols-1 gap-2 rounded-md border bg-white p-2 md:grid-cols-5">
              {isMixed ? (
                <div className="space-y-1">
                  <Label className="text-xs">Método</Label>
                  <select
                    className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                    value={line.metodo}
                    disabled={disabled || structureLocked}
                    onChange={(e) => updateLine(index, { metodo: e.target.value })}
                  >
                    {mixedMethods.map((method) => (
                      <option key={method} value={method}>{METHOD_LABELS[method] || method}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs">Método</Label>
                  <Input value={METHOD_LABELS[line.metodo] || line.metodo} disabled />
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Moneda</Label>
                <select
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  value={line.moneda}
                  disabled={disabled || structureLocked}
                  onChange={(e) => updateLine(index, { moneda: e.target.value })}
                >
                  <option value="NIO">Córdobas (NIO)</option>
                  <option value="USD">Dólares (USD)</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Monto</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={line.monto_origen}
                  disabled={disabled}
                  onChange={(e) => updateLine(index, { monto_origen: e.target.value })}
                  onBlur={() => finalizeAmountLine(index)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Equiv. NIO</Label>
                <Input value={amountNio.toFixed(2)} disabled />
                {sharePercent > 0 ? (
                  <p className="text-[10px] font-medium text-sky-800">
                    {sharePercent.toFixed(1)}% del total
                  </p>
                ) : null}
              </div>
              <div className="flex items-end">
                {isMixed && lines.length > 1 ? (
                  <Button type="button" variant="outline" size="sm" disabled={disabled || structureLocked} onClick={() => removeLine(index)}>
                    Quitar
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {isMixed && canAddLine ? (
        <Button type="button" variant="outline" size="sm" disabled={disabled || structureLocked} onClick={addLine}>
          Agregar línea
        </Button>
      ) : null}

      {canValidatePlan ? (
        <div className={`text-sm font-medium ${validation.ok && uniqueness.ok ? "text-emerald-700" : "text-red-700"}`}>
          Plan actual: C$ {plannedTotal.toFixed(2)}
          {!uniqueness.ok ? ` · ${uniqueness.message}` : !validation.ok ? ` · ${validation.message}` : " · Cuadra con el total"}
        </div>
      ) : (
        <p className="text-sm text-sky-900">Configura los montos del plan de cobro.</p>
      )}
      {isMixed ? (
        <p className="text-xs text-muted-foreground">
          Al ingresar un monto, la siguiente línea vacía se completa con el faltante para cuadrar el total.
          No se repite la misma combinación de método y moneda.
          En tarjeta el vendedor solo declara monto; banco, tipo y referencia los registra caja.
        </p>
      ) : null}
    </div>
  );
}