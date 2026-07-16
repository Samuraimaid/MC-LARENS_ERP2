import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import SaleOperationalAuditPanel from "@/components/sales/SaleOperationalAuditPanel";
import { ExternalLink, Loader2, Wrench } from "lucide-react";

export default function SaleOperationalAuditDialog({
  sale,
  open,
  onOpenChange,
}) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const saleId = sale?.sale_id;
  const invoiceLabel = sale?.invoice_number || saleId || "Factura";

  useEffect(() => {
    if (!open || !saleId) {
      setDetail(null);
      setError("");
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    axios.get(`${API}/sales/${saleId}`, { withCredentials: true })
      .then((res) => {
        if (!cancelled) setDetail(res.data || null);
      })
      .catch((err) => {
        if (!cancelled) {
          setDetail(null);
          setError(err?.response?.data?.detail || "No se pudo cargar la trazabilidad operativa");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [open, saleId]);

  const handleOpenFullView = () => {
    if (!saleId) return;
    onOpenChange(false);
    navigate(`/sales/view/${saleId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl gap-0 overflow-hidden p-0">
        <DialogHeader className="space-y-1 border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Wrench className="h-5 w-5 text-primary" />
            Trazabilidad operativa — {invoiceLabel}
          </DialogTitle>
          <DialogDescription>
            Línea de tiempo del taller, personal involucrado y estadísticas de fidelización del cliente.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-9rem)] px-6 py-4">
          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : null}

          {!loading && error ? (
            <p className="py-8 text-center text-sm text-destructive">{error}</p>
          ) : null}

          {!loading && !error ? (
            <SaleOperationalAuditPanel audit={detail?.operational_audit} />
          ) : null}
        </ScrollArea>

        <DialogFooter className="border-t px-6 py-4 sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button
            variant="secondary"
            className="gap-2"
            onClick={handleOpenFullView}
            disabled={!saleId}
          >
            <ExternalLink className="h-4 w-4" />
            Abrir visor completo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}