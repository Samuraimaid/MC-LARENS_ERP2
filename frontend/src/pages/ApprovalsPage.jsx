import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import { API_BASE as API } from "@/lib/api";
import { RefreshCw } from "lucide-react";

const APPROVAL_TYPE_PRECIO2 = "sale_precio2";

const SALE_REQUEST_APPROVE_ENDPOINTS = {
  pos_discount_card: (requestId) => `${API}/sales/requests/${requestId}/approve-pos-discount`,
  edit: (requestId) => `${API}/sales/requests/${requestId}/approve-edit`,
  cancel: (requestId) => `${API}/sales/requests/${requestId}/approve-cancel`,
};

function approvalTitle(item) {
  if (item?.source === "sale_request") {
    const invoice = item?.payload?.invoice_number || item?.payload?.sale_id;
    return `${item?.type_label || "Solicitud de factura"}${invoice ? ` · ${invoice}` : ""}`;
  }
  return item?.type_label || item?.type || "Solicitud";
}

export function ApprovalsPage({ active = true } = {}) {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!active) return;
    fetchApprovals();
  }, [active]);

  const fetchApprovals = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/approvals`, {
        withCredentials: true,
        params: { pending_only: true },
      });
      setApprovals(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      toast.error("Error al cargar aprobaciones");
    } finally {
      setLoading(false);
    }
  };

  const approve = async (item) => {
    const itemId = item?.approval_id;
    if (!itemId) return;
    setProcessingId(`${itemId}:approve`);
    try {
      if (item.source === "sale_request") {
        const buildEndpoint = SALE_REQUEST_APPROVE_ENDPOINTS[item.type];
        if (!buildEndpoint) {
          toast.error("Tipo de solicitud no soportado");
          return;
        }
        await axios.post(buildEndpoint(itemId), {}, { withCredentials: true });
        toast.success("Solicitud aprobada");
      } else {
        let body = null;
        if (item.type === APPROVAL_TYPE_PRECIO2) {
          const justification = window.prompt("Justificación de aprobación (obligatoria):", "");
          if (justification === null) {
            return;
          }
          if (!justification.trim()) {
            toast.error("La justificación es obligatoria para Precio 2");
            return;
          }
          body = { approver_justification: justification.trim() };
        }
        await axios.put(`${API}/approvals/${itemId}/approve`, body, { withCredentials: true });
        toast.success("Aprobado");
      }
      await fetchApprovals();
      window.dispatchEvent(new CustomEvent("notifications:changed"));
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error al aprobar");
    } finally {
      setProcessingId("");
    }
  };

  const reject = async (item) => {
    const itemId = item?.approval_id;
    if (!itemId) return;
    setProcessingId(`${itemId}:reject`);
    try {
      if (item.source === "sale_request") {
        await axios.post(`${API}/sales/requests/${itemId}/reject`, {}, { withCredentials: true });
        toast.success("Solicitud rechazada");
      } else {
        await axios.put(`${API}/approvals/${itemId}/reject`, null, { withCredentials: true });
        toast.success("Rechazado");
      }
      await fetchApprovals();
      window.dispatchEvent(new CustomEvent("notifications:changed"));
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error al rechazar");
    } finally {
      setProcessingId("");
    }
  };

  const openSale = (item) => {
    const saleId = item?.payload?.sale_id;
    if (!saleId) {
      toast.error("No se encontró sale_id en la solicitud");
      return;
    }
    navigate(`/sales?sale_id=${encodeURIComponent(saleId)}`);
  };

  const deleteApproval = async (id) => {
    const prev = approvals;
    setApprovals(approvals.filter((a) => a.approval_id !== id));
    try {
      await axios.delete(`${API}/approvals/${id}`, { withCredentials: true });
      toast.success("Aprobación eliminada");
    } catch (e) {
      toast.error("Error al eliminar aprobación");
      setApprovals(prev);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-heading text-xl font-semibold">Aprobaciones pendientes</h2>
          <p className="text-sm text-muted-foreground">
            Incluye solicitudes de caja (descuento + tarjeta), edición y anulación de facturas.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchApprovals} disabled={loading}>
          {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
          Actualizar
        </Button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Cargando solicitudes...</div>
      ) : approvals.length === 0 ? (
        <div className="text-sm text-muted-foreground">No hay solicitudes pendientes</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {approvals.map((item) => {
            const isSaleRequest = item.source === "sale_request";
            const isPosDiscount = item.type === "pos_discount_card";
            const busyApprove = processingId === `${item.approval_id}:approve`;
            const busyReject = processingId === `${item.approval_id}:reject`;

            return (
              <Card key={`${item.source || "approval"}-${item.approval_id}`}>
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={isPosDiscount ? "secondary" : "outline"}>
                          {item.type_label || item.type}
                        </Badge>
                        {isSaleRequest ? <Badge variant="outline">Factura</Badge> : null}
                      </div>
                      <div className="font-medium">{approvalTitle(item)}</div>
                      <div className="text-sm text-muted-foreground">
                        Solicitado por: {item.requester_name || item.requester_id || "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.created_at ? new Date(item.created_at).toLocaleString() : ""}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-semibold">Motivo</div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {item.reason || "—"}
                    </p>
                  </div>

                  {isSaleRequest ? (
                    <div className="text-xs text-muted-foreground rounded-md border bg-muted/30 p-2">
                      <div>Factura: {item?.payload?.invoice_number || "—"}</div>
                      <div>Sale ID: {item?.payload?.sale_id || "—"}</div>
                      {isPosDiscount ? (
                        <div className="mt-1 text-amber-800 dark:text-amber-200">
                          Emergencia en caja: autoriza cobro con tarjeta manteniendo descuento.
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <pre className="text-xs p-2 bg-muted rounded overflow-x-auto">
                      {JSON.stringify(item.payload, null, 2)}
                    </pre>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {isSaleRequest ? (
                      <Button type="button" variant="outline" size="sm" onClick={() => openSale(item)}>
                        Abrir factura
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      onClick={() => approve(item)}
                      disabled={busyApprove || busyReject}
                      className={isPosDiscount ? "bg-violet-600 hover:bg-violet-700" : ""}
                    >
                      {busyApprove ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
                      {isPosDiscount
                        ? "Aprobar descuento + tarjeta"
                        : item.type === APPROVAL_TYPE_PRECIO2
                          ? "Aprobar Precio 2"
                          : "Aprobar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => reject(item)}
                      disabled={busyApprove || busyReject}
                    >
                      {busyReject ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
                      Rechazar
                    </Button>
                    {!isSaleRequest && (item.status === "approved" || item.approved_at) ? (
                      <Button variant="ghost" size="sm" onClick={() => deleteApproval(item.approval_id)}>
                        Eliminar
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}