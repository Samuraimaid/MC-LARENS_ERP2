import React, { useState, useEffect } from "react";
import axios from "axios";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { API_BASE as API } from "@/lib/api";
import { useNavigate } from "react-router-dom";

export function NotificationsPage() {
  const [notes, setNotes] = useState([]);
  const [processingAction, setProcessingAction] = useState("");
  const navigate = useNavigate();

  useEffect(() => { fetchNotes(); }, []);

  const fetchNotes = async () => {
    try {
      const res = await axios.get(`${API}/notifications`, { withCredentials: true });
      // already filtered by backend for recipient
      setNotes(res.data || []);
    } catch (e) {
      toast.error("Error al cargar notificaciones");
    }
  };

  const markRead = async (id) => {
    // Optimistic update: mark locally first, update badge via event, then call API
    const prev = notes;
    setNotes(notes.map(n => n.notification_id === id ? { ...n, read: true } : n));
    // notify other components (Sidebar) to refresh unread badge
    try {
      window.dispatchEvent(new CustomEvent('notifications:changed'));
    } catch (_) { /* ignore cross-window dispatch errors */ }
    try {
      await axios.put(`${API}/notifications/${id}/read`, null, { withCredentials: true });
      // refresh list to ensure server state
      fetchNotes();
    } catch (e) {
      toast.error("Error al marcar leída");
      setNotes(prev);
      try { window.dispatchEvent(new CustomEvent('notifications:changed')); } catch(_) { /* ignore */ }
    }
  };

  const deleteNote = async (id) => {
    const prev = notes;
    setNotes(notes.filter(n => n.notification_id !== id));
    try {
      await axios.delete(`${API}/notifications/${id}`, { withCredentials: true });
      try { window.dispatchEvent(new CustomEvent('notifications:changed')); } catch (_) { /* ignore cross-window dispatch errors */ }
      toast.success('Notificación eliminada');
    } catch (e) {
      toast.error('Error al eliminar notificación');
      setNotes(prev);
    }
  };

  const approveSaleRequest = async (notification, actionType) => {
    const metadata = notification?.metadata || {};
    const requestId = metadata.request_id;
    if (!requestId) {
      toast.error("La notificación no tiene request_id");
      return;
    }
    setProcessingAction(requestId + actionType);
    try {
      const endpoint = actionType === "edit"
        ? `${API}/sales/requests/${requestId}/approve-edit`
        : `${API}/sales/requests/${requestId}/approve-cancel`;
      await axios.post(endpoint, {}, { withCredentials: true });
      toast.success(actionType === "edit" ? "Solicitud de edición aprobada" : "Solicitud de anulación aprobada");
      await fetchNotes();
      try { window.dispatchEvent(new CustomEvent('notifications:changed')); } catch (_) { /* ignore */ }
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo procesar la solicitud");
    } finally {
      setProcessingAction("");
    }
  };

  const openSaleFromNotification = (notification) => {
    const saleId = notification?.metadata?.sale_id;
    if (!saleId) {
      toast.error("No se encontró sale_id en esta notificación");
      return;
    }
    navigate(`/sales?sale_id=${encodeURIComponent(saleId)}`);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold">Notificaciones</h1>
          <p className="text-muted-foreground">Centro de notificaciones</p>
        </div>
      </div>

      <div className="space-y-3">
        {notes.length === 0 ? (
          <div className="text-muted-foreground">No hay notificaciones</div>
        ) : notes.map(n => {
          const requestType = n?.metadata?.type;
          const isSaleRequest = requestType === "sale_edit_request" || requestType === "sale_cancel_request";
          const requestStatus = String(n?.metadata?.request_status || "pending").toLowerCase();
          const canProcessRequest = isSaleRequest && !n.read && requestStatus === "pending";
          return (
          <Card key={n.notification_id}>
            <CardContent className="flex items-center justify-between">
              <div>
                <div className="font-medium">{n.message}</div>
                <div className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</div>
                {n?.metadata?.invoice_number ? (
                  <div className="text-xs text-muted-foreground">Factura: {n.metadata.invoice_number}</div>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                {!n.read && <Button variant="outline" onClick={() => markRead(n.notification_id)}>Marcar leída</Button>}
                {canProcessRequest && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => openSaleFromNotification(n)}
                    >
                      Abrir factura
                    </Button>
                    {requestType === "sale_edit_request" ? (
                      <Button
                        onClick={() => approveSaleRequest(n, "edit")}
                        disabled={processingAction === `${n?.metadata?.request_id}edit`}
                      >
                        Aprobar edición
                      </Button>
                    ) : (
                      <Button
                        variant="destructive"
                        onClick={() => approveSaleRequest(n, "cancel")}
                        disabled={processingAction === `${n?.metadata?.request_id}cancel`}
                      >
                        Aprobar anulación
                      </Button>
                    )}
                  </>
                )}
                {n.read && <Button variant="ghost" onClick={() => deleteNote(n.notification_id)}>Eliminar</Button>}
              </div>
            </CardContent>
          </Card>
          );
        })}
      </div>
    </div>
  );
}
