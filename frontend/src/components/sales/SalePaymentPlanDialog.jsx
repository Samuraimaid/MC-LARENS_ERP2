import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { API_BASE as API } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PaymentPlanEditor from "@/components/sales/PaymentPlanEditor";
import {
  buildDefaultPlanLine,
  buildMixedPaymentPlan,
  buildSinglePaymentPlan,
  finalizePlanLinesForSubmit,
  validatePlanAgainstTotal,
} from "@/lib/plannedPaymentPlan";
import { normalizePaymentMethodCode, normalizePaymentMethodList } from "@/lib/paymentMethods";

function mapPlanLines(sale) {
  const existing = sale?.planned_payment_plan?.lines;
  if (Array.isArray(existing) && existing.length) {
    return existing.map((line) => ({
      metodo: line.metodo || "cash",
      moneda: line.moneda || "NIO",
      monto_origen: line.monto_origen ?? "",
    }));
  }
  const method = normalizePaymentMethodCode(sale?.payment_type || sale?.payment_method || "cash");
  return [buildDefaultPlanLine(method, sale?.currency || "NIO")];
}

export default function SalePaymentPlanDialog({
  sale,
  open,
  onOpenChange,
  onSaved,
}) {
  const paymentMethod = normalizePaymentMethodCode(sale?.payment_type || sale?.payment_method || "cash");
  const mixedMethods = useMemo(
    () => normalizePaymentMethodList(sale?.mixed_payment_methods || []),
    [sale?.mixed_payment_methods],
  );
  const targetTotal = useMemo(
    () => Number(sale?.net_to_collect ?? sale?.total ?? 0),
    [sale?.net_to_collect, sale?.total],
  );
  const exchangeRate = Number(sale?.exchange_rate || 36.5);

  const [lines, setLines] = useState([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !sale?.sale_id) return;
    setLines(mapPlanLines(sale));
    setReason("");
  }, [open, sale?.sale_id, sale?.planned_payment_plan, sale?.payment_type, sale?.payment_method, sale?.currency]);

  const canSave = paymentMethod !== "credit"
    && String(sale?.payment_status || "").toLowerCase() !== "paid"
    && targetTotal > 0;

  const handleSave = async () => {
    if (!sale?.sale_id) return;
    const trimmedReason = String(reason || "").trim();
    if (trimmedReason.length < 10) {
      toast.error("Indica una razón de al menos 10 caracteres");
      return;
    }
    const finalizedLines = finalizePlanLinesForSubmit(lines, exchangeRate, targetTotal);
    const validation = validatePlanAgainstTotal(finalizedLines, exchangeRate, targetTotal);
    if (!validation.ok) {
      toast.error(validation.message);
      return;
    }
    const planLinesForPayload = validation.adjustedLines || finalizedLines;
    const plannedPaymentPlan = paymentMethod === "mixed"
      ? buildMixedPaymentPlan({
        methods: mixedMethods,
        lines: planLinesForPayload,
        total: targetTotal,
        exchangeRate,
        currency: sale?.currency || "NIO",
      })
      : buildSinglePaymentPlan({
        method: paymentMethod,
        total: targetTotal,
        currency: sale?.currency || "NIO",
        exchangeRate,
      });

    setBusy(true);
    try {
      const response = await axios.patch(
        `${API}/sales/${sale.sale_id}/payment-plan`,
        {
          planned_payment_plan: plannedPaymentPlan,
          mixed_payment_methods: paymentMethod === "mixed" ? mixedMethods : [],
          reason: trimmedReason,
        },
        { withCredentials: true },
      );
      toast.success("Plan de cobro actualizado");
      onSaved?.(response.data);
      onOpenChange?.(false);
    } catch (error) {
      const detail = error?.response?.data?.detail;
      if (detail?.message) {
        toast.error(detail.message);
      } else if (typeof detail === "string") {
        toast.error(detail);
      } else {
        toast.error("No se pudo actualizar el plan de cobro");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Plan de cobro — {sale?.invoice_number || "Factura"}</DialogTitle>
          <DialogDescription>
            {sale?.customer_name || "Cliente"}
            {" · "}
            Total a cobrar: C$ {targetTotal.toFixed(2)}
          </DialogDescription>
        </DialogHeader>

        {!canSave ? (
          <p className="text-sm text-muted-foreground">
            Esta factura no admite edición de plan (crédito o ya pagada).
          </p>
        ) : (
          <div className="space-y-4">
            <PaymentPlanEditor
              paymentMethod={paymentMethod}
              mixedMethods={mixedMethods}
              lines={lines}
              onChangeLines={setLines}
              exchangeRate={exchangeRate}
              targetTotal={targetTotal}
            />
            <div className="space-y-1">
              <Label className="text-xs">Razón del cambio (auditoría)</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Mínimo 10 caracteres"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)}>
            Cancelar
          </Button>
          {canSave ? (
            <Button type="button" onClick={handleSave} disabled={busy}>
              {busy ? "Guardando..." : "Guardar plan"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}