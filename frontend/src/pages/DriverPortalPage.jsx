import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Camera, CheckCircle2, Clock, MapPin, Package, RefreshCw, Truck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { API_BASE as API } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ContextualDialogFooter, ContextualDialogHeader } from "@/components/ui/contextual-dialog-header";
import { cn } from "@/lib/utils";
import {
  getCameraContextError,
  INSECURE_CAMERA_NETWORK_ALERT,
  isSecureCameraContext,
} from "@/lib/cameraAccess";

function JobCard({ job, driverType, onAction, busy, requiresProof }) {
  const isTransfer = job.job_type === "transfer_request" || driverType === "inter_branch_haul";
  const status = String(job.status || "").toLowerCase();

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          {isTransfer ? <Package className="h-4 w-4 text-amber-600" /> : <Truck className="h-4 w-4 text-sky-600" />}
          {job.title || job.entity_id}
        </CardTitle>
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{status}</p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {isTransfer ? (
          <>
            <p><span className="font-medium">Origen:</span> {job.from_warehouse_id}</p>
            <p><span className="font-medium">Destino:</span> {job.to_warehouse_id}</p>
            <p><span className="font-medium">Producto:</span> {job.product_id} × {job.quantity}</p>
          </>
        ) : (
          <>
            <p className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 shrink-0" />{job.destination_label || "Entrega"}</p>
            <p><span className="font-medium">Cliente:</span> {job.customer_name || "N/D"}</p>
            {job.delivery_address ? <p className="text-muted-foreground">{job.delivery_address}</p> : null}
          </>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          {isTransfer ? (
            <>
              {status === "approved" ? (
                <Button size="sm" disabled={busy} onClick={() => onAction(job, "salida_origen")}>Salida de Origen</Button>
              ) : null}
              {status === "shipped" ? (
                <>
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction(job, "en_transito")}>En Tránsito</Button>
                  <Button size="sm" disabled={busy} onClick={() => onAction(job, "recibido")}>Confirmar Recepción</Button>
                </>
              ) : null}
            </>
          ) : (
            status !== "entregado" && status !== "delivered" ? (
              <Button size="sm" disabled={busy} onClick={() => onAction(job, requiresProof ? "proof" : "entregado")}>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                {requiresProof ? "Liquidar con foto" : "Marcar Entregado"}
              </Button>
            ) : null
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function captureGeolocation() {
  return new Promise((resolve, reject) => {
    if (!navigator?.geolocation) {
      reject(new Error("Geolocalización no disponible en este dispositivo"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

export function DriverPortalPage() {
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";
  const [jobsPayload, setJobsPayload] = useState(null);
  const [deepLinkJob, setDeepLinkJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyJobId, setBusyJobId] = useState("");
  const [notes, setNotes] = useState("");
  const [proofJob, setProofJob] = useState(null);
  const [proofFile, setProofFile] = useState(null);
  const [liveGpsEnabled, setLiveGpsEnabled] = useState(true);
  const [lastGpsPing, setLastGpsPing] = useState(null);
  const [gpsSpeed, setGpsSpeed] = useState(0);
  const fileInputRef = useRef(null);
  const cameraContextError = getCameraContextError();
  const cameraBlocked = !isSecureCameraContext() || Boolean(cameraContextError);

  // Background Live GPS ping loop
  useEffect(() => {
    if (!user || !liveGpsEnabled) return;

    let watchId = null;

    const transmitLocation = async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const spd = (pos.coords.speed || 0) * 3.6; // convert m/s to km/h
      const heading = pos.coords.heading || 0;
      const accuracy = pos.coords.accuracy || 0;

      setGpsSpeed(spd);
      setLastGpsPing(new Date());

      const activeJobIds = (jobsPayload?.active || jobsPayload?.jobs || [])
        .filter((j) => String(j.status || "").toLowerCase() !== "entregado" && String(j.status || "").toLowerCase() !== "delivered")
        .map((j) => j.job_id || j.entity_id);

      try {
        await axios.post(
          `${API}/delivery/driver-location`,
          {
            driver_id: user.user_id || user.username,
            driver_name: `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.username,
            latitude: lat,
            longitude: lng,
            speed: spd,
            heading,
            accuracy,
            active_job_ids: activeJobIds,
            branch_id: user.branch_id,
          },
          { withCredentials: true }
        );
      } catch (err) {
        // silent retry
      }
    };

    if (navigator?.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => transmitLocation(pos),
        () => {},
        { enableHighAccuracy: true, timeout: 10000 }
      );

      watchId = navigator.geolocation.watchPosition(
        (pos) => transmitLocation(pos),
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
      );
    }

    return () => {
      if (watchId !== null && navigator?.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [user, liveGpsEnabled, jobsPayload]);

  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"][data-driver-portal]');
    if (!link) {
      const manifest = document.createElement("link");
      manifest.rel = "manifest";
      manifest.href = "/driver-manifest.json";
      manifest.setAttribute("data-driver-portal", "1");
      document.head.appendChild(manifest);
    }
    document.title = "MC-LARENS Conductor";
  }, []);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/hr/drivers/portal/jobs`, { withCredentials: true });
      setJobsPayload(response.data);
    } catch (error) {
      if (error?.response?.status === 401) {
        navigate(`/login?next=${encodeURIComponent(`/driver${token ? `?token=${token}` : ""}`)}`);
        return;
      }
      toast.error(error?.response?.data?.detail || "No se pudieron cargar las tareas");
    } finally {
      setLoading(false);
    }
  }, [navigate, token]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(`/driver${token ? `?token=${token}` : ""}`)}`);
      return;
    }
    (async () => {
      if (token) {
        try {
          const deep = await axios.get(`${API}/hr/drivers/deep-link/${encodeURIComponent(token)}`);
          setDeepLinkJob(deep.data?.job || null);
          await axios.post(`${API}/hr/drivers/portal/consume-token`, { token }, { withCredentials: true });
        } catch (error) {
          toast.error(error?.response?.data?.detail || "Enlace expirado o inválido");
        }
      }
      await loadJobs();
    })();
  }, [user, authLoading, token, loadJobs, navigate]);

  const driverType = jobsPayload?.driver_type || "delivery_last_mile";
  const requiresProof = driverType === "delivery_last_mile";
  const sections = useMemo(() => {
    const pending = jobsPayload?.pending || [];
    const active = jobsPayload?.active || [];
    const completed = jobsPayload?.completed || [];
    if (deepLinkJob && ![...pending, ...active, ...completed].some((j) => j.job_id === deepLinkJob.job_id)) {
      return { focus: deepLinkJob, pending, active, completed };
    }
    return { focus: deepLinkJob, pending, active, completed };
  }, [jobsPayload, deepLinkJob]);

  const resetProofDialog = () => {
    setProofJob(null);
    setProofFile(null);
    setGpsCoords(null);
    setGpsLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openProofDialog = async (job) => {
    const contextError = getCameraContextError();
    if (contextError) {
      toast.error(contextError, { duration: 12000 });
      return;
    }
    setProofJob(job);
    setProofFile(null);
    setGpsCoords(null);
    setGpsLoading(true);
    try {
      const coords = await captureGeolocation();
      setGpsCoords(coords);
    } catch (error) {
      toast.error(error?.message || "No se pudo obtener GPS. Active ubicación en el celular.");
    } finally {
      setGpsLoading(false);
    }
  };

  const submitProofDelivery = async () => {
    if (!proofJob || !proofFile) {
      toast.error("Tome la foto de evidencia con la cámara");
      return;
    }
    if (!gpsCoords) {
      toast.error("Espere la captura de coordenadas GPS");
      return;
    }

    setBusyJobId(proofJob.job_id);
    const form = new FormData();
    form.append("proof_image", proofFile);
    form.append("latitude", String(gpsCoords.latitude));
    form.append("longitude", String(gpsCoords.longitude));
    if (notes) form.append("notes", notes);

    try {
      await axios.post(
        `${API}/hr/drivers/portal/jobs/${encodeURIComponent(proofJob.job_id)}/complete-delivery`,
        form,
        { withCredentials: true, headers: { "Content-Type": "multipart/form-data" } },
      );
      toast.success("Entrega liquidada con evidencia geo-localizada");
      setNotes("");
      resetProofDialog();
      await loadJobs();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudo liquidar la entrega");
    } finally {
      setBusyJobId("");
    }
  };

  const handleAction = async (job, action) => {
    if (action === "proof") {
      await openProofDialog(job);
      return;
    }

    setBusyJobId(job.job_id);
    const entityId = job.entity_id || (job.job_id || "").split(":").pop();
    try {
      const isTransfer = job.job_type === "transfer_request";
      if (isTransfer) {
        if (action === "salida_origen" || action === "ship" || action === "shipped") {
          await axios.put(`${API}/inventory/transfer-requests/${entityId}/ship`, null, { withCredentials: true });
        } else if (action === "recibido" || action === "receive" || action === "received") {
          await axios.put(`${API}/inventory/transfer-requests/${entityId}/receive`, null, { withCredentials: true });
        } else {
          await axios.put(
            `${API}/hr/drivers/portal/jobs/${encodeURIComponent(job.job_id)}/status`,
            { action, status: action, job_type: job.job_type, notes: notes || null },
            { withCredentials: true },
          );
        }
      } else {
        await axios.put(
          `${API}/hr/drivers/portal/jobs/${encodeURIComponent(job.job_id)}/status`,
          { action, status: action, job_type: job.job_type, notes: notes || null },
          { withCredentials: true },
        );
      }
      toast.success("Estado actualizado");
      setNotes("");
      await loadJobs();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudo actualizar la tarea");
    } finally {
      setBusyJobId("");
    }
  };

  if (authLoading || (!user && !loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white pb-10">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/90 backdrop-blur px-4 py-4">
        <div className="mx-auto max-w-lg flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-cyan-300/80">Portal Conductor</p>
            <h1 className="text-lg font-bold">{user?.name || "Conductor"}</h1>
            <p className="text-xs text-white/60">
              {driverType === "inter_branch_haul" ? "Traslados inter-sucursal" : "Delivery última milla"}
            </p>
          </div>
          <Button size="icon" variant="ghost" onClick={loadJobs} disabled={loading}>
            <RefreshCw className={cn("h-5 w-5", loading && "animate-spin")} />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pt-4 space-y-4">
        {/* Live GPS Telemetry Status Card */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="flex items-center gap-2.5">
            <span className={`relative flex h-3 w-3`}>
              {liveGpsEnabled ? <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /> : null}
              <span className={`relative inline-flex rounded-full h-3 w-3 ${liveGpsEnabled ? "bg-emerald-500" : "bg-slate-500"}`} />
            </span>
            <div>
              <p className="text-xs font-bold text-white">
                {liveGpsEnabled ? "GPS en Vivo Transmitiendo" : "GPS Pausado"}
              </p>
              <p className="text-[10px] text-white/50 font-mono">
                {lastGpsPing ? `Último ping: ${lastGpsPing.toLocaleTimeString()} • ${gpsSpeed.toFixed(0)} km/h` : "Conectando satélites..."}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant={liveGpsEnabled ? "outline" : "default"}
            onClick={() => setLiveGpsEnabled(!liveGpsEnabled)}
            className="text-xs h-7 border-slate-700 hover:bg-slate-800"
          >
            {liveGpsEnabled ? "Pausar" : "Transmitir"}
          </Button>
        </div>

        {cameraBlocked ? (
          <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {cameraContextError || INSECURE_CAMERA_NETWORK_ALERT}
          </div>
        ) : null}
        {sections.focus ? (
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-amber-300">Tarea del enlace</p>
            <JobCard job={sections.focus} driverType={driverType} onAction={handleAction} busy={busyJobId === sections.focus.job_id} requiresProof={requiresProof} />
          </section>
        ) : null}

        <section>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-white/60">
            <Clock className="h-3.5 w-3.5" /> Pendientes ({sections.pending.length})
          </p>
          <div className="space-y-3">
            {sections.pending.map((job) => (
              <JobCard key={job.job_id} job={job} driverType={driverType} onAction={handleAction} busy={busyJobId === job.job_id} requiresProof={requiresProof} />
            ))}
            {!loading && sections.pending.length === 0 ? <p className="text-sm text-white/50">Sin pendientes</p> : null}
          </div>
        </section>

        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-sky-300">En curso ({sections.active.length})</p>
          <div className="space-y-3">
            {sections.active.map((job) => (
              <JobCard key={job.job_id} job={job} driverType={driverType} onAction={handleAction} busy={busyJobId === job.job_id} requiresProof={requiresProof} />
            ))}
          </div>
        </section>

        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">Completados</p>
          <div className="space-y-3">
            {sections.completed.slice(0, 10).map((job) => (
              <JobCard key={job.job_id} job={job} driverType={driverType} onAction={handleAction} busy={false} requiresProof={requiresProof} />
            ))}
          </div>
        </section>

        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-xs text-white/60 mb-2">Notas opcionales para la próxima acción</p>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="bg-slate-900 border-white/10 text-white" />
        </div>
      </main>

      <Dialog open={Boolean(proofJob)} onOpenChange={(open) => { if (!open) resetProofDialog(); }}>
        <DialogContent className="max-w-md">
          <ContextualDialogHeader
            variant="warning"
            size="hero"
            icon={Camera}
            title="Foto-evidencia obligatoria"
            description="Capture la entrega con la cámara del celular. Se estampará marca de agua con fecha/hora y GPS del dispositivo."
          />
          <div className="space-y-4">
            <div>
              <Label className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Coordenadas GPS
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                {gpsLoading ? "Capturando ubicación..." : gpsCoords
                  ? `LAT ${gpsCoords.latitude.toFixed(4)} / LON ${gpsCoords.longitude.toFixed(4)}`
                  : "GPS pendiente — active ubicación"}
              </p>
            </div>
            {cameraBlocked ? (
              <div className="rounded-lg border border-amber-300/50 bg-amber-50/90 px-3 py-2 text-sm text-amber-950">
                {cameraContextError || INSECURE_CAMERA_NETWORK_ALERT}
              </div>
            ) : (
              <div>
                <Label htmlFor="proof-camera">Foto en el mostrador o terminal</Label>
                <input
                  id="proof-camera"
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="mt-2 block w-full text-sm"
                  onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                />
                {proofFile ? <p className="text-xs text-muted-foreground mt-1">{proofFile.name}</p> : null}
              </div>
            )}
          </div>
          <ContextualDialogFooter>
            <Button variant="outline" onClick={resetProofDialog}>Cancelar</Button>
            <Button onClick={submitProofDelivery} disabled={cameraBlocked || !proofFile || !gpsCoords || gpsLoading || busyJobId}>
              Confirmar entrega
            </Button>
          </ContextualDialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}