import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE as API } from "@/lib/api";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import DocumentAuditPanel from "@/components/sales/DocumentAuditPanel";
import { TIER_LABELS } from "@/lib/priceTiers";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

export function DocumentSnapshotView({ docType = "sale", docId: docIdProp, onBack }) {
  const navigate = useNavigate();
  const params = useParams();
  const docId = docIdProp || params.saleId || params.quotationId;
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!docId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError("");
    const path = docType === "quotation"
      ? `${API}/quotations/${docId}`
      : `${API}/sales/${docId}`;
    axios.get(path, { withCredentials: true })
      .then((res) => {
        if (!cancelled) setDoc(res.data || null);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.detail || "No se pudo cargar el documento");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [docId, docType]);

  const handleBack = () => {
    if (typeof onBack === "function") onBack();
    else navigate(-1);
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="p-6 text-center">
        <p className="text-destructive">{error || "Documento no encontrado"}</p>
        <Button variant="outline" className="mt-4" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
      </div>
    );
  }

  const title = docType === "quotation"
    ? doc.quotation_id
    : (doc.invoice_number || doc.sale_id);
  const tierLabel = doc.active_price_tier_label
    || TIER_LABELS[doc.active_price_tier]
    || doc.pricing_profile;

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
        <Badge variant="secondary" className="text-xs uppercase">
          Solo lectura
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            {docType === "quotation" ? "Cotización" : "Factura"}
            {" "}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground">Cliente</p>
              <p className="font-medium">{doc.customer_name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Vendedor</p>
              <p className="font-medium">{doc.salesperson_name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Fecha</p>
              <p className="font-medium">{formatDate(doc.created_at)}</p>
            </div>
            {tierLabel ? (
              <div>
                <p className="text-muted-foreground">Rango de precios</p>
                <Badge variant="outline">{tierLabel}</Badge>
              </div>
            ) : null}
            {doc.discount_codes?.length ? (
              <div className="sm:col-span-2">
                <p className="text-muted-foreground">Códigos de descuento</p>
                <p>{doc.discount_codes.join(", ")}</p>
              </div>
            ) : null}
            {(doc.discount || doc.discount_percent) ? (
              <div>
                <p className="text-muted-foreground">Descuento global</p>
                <p>
                  {doc.discount_percent != null ? `${doc.discount_percent}%` : ""}
                  {doc.discount ? ` (${formatCurrency(doc.discount, doc.currency || "USD")})` : ""}
                </p>
              </div>
            ) : null}
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-2">Producto</th>
                  <th className="p-2 text-right">Cant.</th>
                  <th className="p-2 text-right">Precio</th>
                  <th className="p-2 text-right">Tier</th>
                  <th className="p-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {(doc.items || []).map((item, idx) => (
                  <tr key={item.product_id || idx} className="border-t">
                    <td className="p-2">{item.product_name}</td>
                    <td className="p-2 text-right">{item.quantity}</td>
                    <td className="p-2 text-right font-mono">{formatCurrency(item.unit_price, doc.currency || "USD")}</td>
                    <td className="p-2 text-right text-muted-foreground">
                      {item.price_tier_label || TIER_LABELS[item.price_tier] || "—"}
                    </td>
                    <td className="p-2 text-right font-mono">
                      {formatCurrency(item.subtotal ?? (item.unit_price * item.quantity), doc.currency || "USD")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <div className="space-y-1 text-right text-sm">
              <p>Subtotal: {formatCurrency(doc.subtotal, doc.currency || "USD")}</p>
              {doc.tax ? <p>IVA: {formatCurrency(doc.tax, doc.currency || "USD")}</p> : null}
              <p className={cn("text-base font-bold")}>Total: {formatCurrency(doc.total, doc.currency || "USD")}</p>
            </div>
          </div>

          {doc.notes ? (
            <div>
              <p className="text-muted-foreground">Notas</p>
              <p className="whitespace-pre-wrap">{doc.notes}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <DocumentAuditPanel
        events={doc.audit_events}
        activePriceTier={doc.active_price_tier}
        activePriceTierLabel={doc.active_price_tier_label}
      />
    </div>
  );
}