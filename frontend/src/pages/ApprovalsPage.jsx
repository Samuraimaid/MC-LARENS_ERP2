import React, { useState, useEffect } from "react";
import axios from "axios";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { API_BASE as API } from "@/lib/api";

export function ApprovalsPage() {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApprovals();
  }, []);

  const fetchApprovals = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/approvals`, { withCredentials: true });
      setApprovals(res.data || []);
    } catch (e) {
      toast.error("Error al cargar aprobaciones");
    } finally { setLoading(false); }
  };

  const approve = async (id) => {
    try {
      await axios.put(`${API}/approvals/${id}/approve`, null, { withCredentials: true });
      toast.success("Aprobado");
      fetchApprovals();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al aprobar");
    }
  };

  const reject = async (id) => {
    try {
      await axios.put(`${API}/approvals/${id}/reject`, null, { withCredentials: true });
      toast.success("Rechazado");
      fetchApprovals();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al rechazar");
    }
  };

  const deleteApproval = async (id) => {
    const prev = approvals;
    setApprovals(approvals.filter(a => a.approval_id !== id));
    try {
      await axios.delete(`${API}/approvals/${id}`, { withCredentials: true });
      toast.success('Aprobación eliminada');
    } catch (e) {
      toast.error('Error al eliminar aprobación');
      setApprovals(prev);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold">Aprobaciones</h1>
          <p className="text-muted-foreground">Solicitudes pendientes para revisión</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {loading ? (
          <div>Loading...</div>
        ) : approvals.length === 0 ? (
          <div>No hay solicitudes pendientes</div>
        ) : approvals.map(a => (
          <Card key={a.approval_id}>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">{a.type}</div>
                  <div className="font-medium">Solicitado por: {a.requester_name}</div>
                  <div className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div>
                  <div className="mt-2">
                    <div className="text-sm font-semibold">Motivo:</div>
                    <div className="text-xs text-muted-foreground mb-2">{a.reason || '-'}</div>
                  </div>
                  <pre className="text-xs mt-2 p-2 bg-muted rounded">{JSON.stringify(a.payload, null, 2)}</pre>
                </div>
                <div className="flex flex-col gap-2">
                  <Button onClick={() => approve(a.approval_id)}>Aprobar</Button>
                  <Button variant="outline" onClick={() => reject(a.approval_id)}>Rechazar</Button>
                  {(a.status === 'approved' || a.approved_at) && (
                    <Button variant="ghost" onClick={() => deleteApproval(a.approval_id)}>Eliminar</Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
