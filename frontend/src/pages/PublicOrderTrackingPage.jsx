import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import {
  Car,
  CheckCircle2,
  Clock,
  MapPin,
  Navigation,
  Phone,
  ShieldCheck,
  Sparkles,
  Truck,
  Wrench,
  AlertCircle,
  RefreshCw,
  MessageCircle,
  ExternalLink,
  Layers,
} from "lucide-react";
import { API_BASE as API } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

// Simple dynamic Leaflet map viewer or interactive canvas for real-time delivery GPS
function LiveDeliveryMap({ driverLive, branch }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  const lat = driverLive?.latitude || 12.1364;
  const lng = driverLive?.longitude || -86.2514;
  const speed = driverLive?.speed || 0;

  useEffect(() => {
    // Inject Leaflet CSS if not already present
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // Function to initialize map when window.L is available
    const initMap = () => {
      if (!window.L || !mapContainerRef.current || mapInstanceRef.current) return;

      const map = window.L.map(mapContainerRef.current, {
        center: [lat, lng],
        zoom: 15,
        zoomControl: true,
      });

      window.L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
      }).addTo(map);

      // Custom Delivery Icon
      const deliveryIcon = window.L.divIcon({
        className: "custom-delivery-pin",
        html: `
          <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 44px; height: 44px; background: rgba(14, 165, 233, 0.3); border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="width: 32px; height: 32px; background: #0284c7; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.5); border: 2px solid #ffffff;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>
            </div>
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });

      const marker = window.L.marker([lat, lng], { icon: deliveryIcon }).addTo(map);
      marker.bindPopup(`<b>${driverLive?.driver_name || "Repartidor en Ruta"}</b><br>Velocidad: ${speed.toFixed(0)} km/h`).openPopup();

      mapInstanceRef.current = map;
      markerRef.current = marker;
    };

    if (!window.L) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.onload = initMap;
      document.body.appendChild(script);
    } else {
      initMap();
    }
  }, []);

  // Update marker position dynamically
  useEffect(() => {
    if (markerRef.current && mapInstanceRef.current && lat && lng) {
      markerRef.current.setLatLng([lat, lng]);
      mapInstanceRef.current.panTo([lat, lng], { animate: true, duration: 1 });
    }
  }, [lat, lng]);

  return (
    <div className="relative w-full h-72 rounded-2xl overflow-hidden border border-sky-300 dark:border-sky-800 shadow-md">
      <div ref={mapContainerRef} className="w-full h-full z-0" />
      {/* Live Badge Overlay */}
      <div className="absolute top-3 left-3 z-10 bg-black/80 backdrop-blur-md text-white px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-semibold shadow-lg">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
        Repartidor en vivo ({speed.toFixed(0)} km/h)
      </div>
      <div className="absolute bottom-3 right-3 z-10 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md px-3 py-1 rounded-lg text-[11px] text-zinc-600 dark:text-zinc-300 shadow">
        {driverLive?.driver_name || "Chofer Asignado"}
      </div>
    </div>
  );
}

export function PublicOrderTrackingPage() {
  const { trackingId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const fetchTracking = useCallback(async (isSilent = false) => {
    if (!trackingId) return;
    if (!isSilent) setLoading(true);
    try {
      const res = await axios.get(`${API}/public/tracking/${trackingId}`);
      setData(res.data);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Error loading tracking:", err);
      setError(err.response?.data?.detail || "No se pudo encontrar la orden solicitada");
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [trackingId]);

  // Initial load
  useEffect(() => {
    fetchTracking(false);
  }, [fetchTracking]);

  // Polling every 6 seconds if in transit to update driver position smoothly
  useEffect(() => {
    if (data?.current_stage === "in_transit" || data?.is_delivery) {
      const interval = setInterval(() => {
        fetchTracking(true);
      }, 6000);
      return () => clearInterval(interval);
    }
  }, [data?.current_stage, data?.is_delivery, fetchTracking]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 rounded-2xl bg-sky-600/10 dark:bg-sky-400/10 flex items-center justify-center animate-bounce mb-4">
          <Car className="h-8 w-8 text-sky-600 dark:text-sky-400" />
        </div>
        <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
          Cargando estado de su vehículo...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center mb-4">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
          Orden no encontrada
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mb-6">
          {error || "El código escaneado no corresponde a una orden activa o ha sido archivada."}
        </p>
        <Button onClick={() => fetchTracking(false)} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" /> Reintentar
        </Button>
      </div>
    );
  }

  const v = data.vehicle;
  const isDelivery = data.is_delivery;
  const hasDriverGps = Boolean(data.driver_live?.latitude && data.driver_live?.longitude);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 py-6 px-4 sm:px-6">
      <div className="max-w-xl mx-auto space-y-5">
        
        {/* Brand Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-300 text-xs font-bold tracking-wider uppercase mb-1">
            <Sparkles className="h-3.5 w-3.5" />
            MC-LARENS Trazabilidad En Vivo
          </div>
          <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">
            Seguimiento de su Vehículo
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Factura / Orden: <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">{data.invoice_number}</span>
          </p>
        </div>

        {/* Live Status Hero Card */}
        <Card className="border-sky-200 dark:border-sky-900/50 shadow-xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-500" />
          <CardContent className="pt-5 pb-6 space-y-4">
            
            {/* Current Stage Badge */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Estado Actual
                </span>
              </div>
              <Badge variant="outline" className="text-[11px] font-mono text-zinc-500">
                Act. {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </Badge>
            </div>

            {/* Vehicle Profile Card */}
            {v ? (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/60 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                    <Car className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                      {v.brand} {v.model} {v.year}
                    </h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200">
                        {v.plate || "SIN PLACA"}
                      </span>
                      {v.color ? (
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 capitalize">
                          • {v.color}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                {v.version_level ? (
                  <Badge className="bg-sky-600 text-white uppercase text-[10px]">
                    {v.version_level}
                  </Badge>
                ) : null}
              </div>
            ) : null}

            {/* Stage Progress Timeline */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                Progreso del Trabajo
              </h3>
              <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-zinc-800">
                {data.timeline?.map((step, idx) => {
                  const isCurrent = step.current;
                  const isCompleted = step.completed;

                  return (
                    <div key={step.id} className="relative flex items-start gap-3">
                      {/* Step Indicator Dot */}
                      <div
                        className={`absolute -left-6 top-0.5 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all ${
                          isCurrent
                            ? "bg-sky-600 text-white border-sky-400 shadow-md shadow-sky-500/30 scale-110"
                            : isCompleted
                            ? "bg-emerald-500 text-white border-emerald-500"
                            : "bg-slate-100 dark:bg-zinc-800 text-zinc-400 border-slate-300 dark:border-zinc-700"
                        }`}
                      >
                        {isCompleted && !isCurrent ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          idx + 1
                        )}
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p
                            className={`text-xs font-bold ${
                              isCurrent
                                ? "text-sky-600 dark:text-sky-400 text-sm"
                                : isCompleted
                                ? "text-zinc-900 dark:text-zinc-100"
                                : "text-zinc-400 dark:text-zinc-600"
                            }`}
                          >
                            {step.label}
                          </p>
                          {isCurrent ? (
                            <Badge className="bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800 text-[10px] py-0">
                              En curso
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live Delivery GPS Section (Estilo "PedidosYa") */}
            {isDelivery ? (
              <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                      Ubicación de su Entrega en Vivo
                    </h3>
                  </div>
                  <Badge variant="outline" className="text-[11px] text-sky-600 dark:text-sky-400 border-sky-300">
                    {data.destination_label || "A Domicilio"}
                  </Badge>
                </div>

                {hasDriverGps ? (
                  <LiveDeliveryMap driverLive={data.driver_live} branch={data.branch} />
                ) : (
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-3">
                    <Clock className="h-5 w-5 shrink-0" />
                    <p>El repartidor asignado iniciará ruta en breve. El mapa en vivo se activará automáticamente.</p>
                  </div>
                )}
              </div>
            ) : null}

            {/* Items Included */}
            {data.items?.length > 0 ? (
              <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 space-y-2">
                <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  Servicios y Productos
                </h3>
                <div className="divide-y divide-slate-100 dark:divide-zinc-800/80 rounded-xl bg-slate-50/50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800 px-3 py-1">
                  {data.items.map((it, i) => (
                    <div key={i} className="py-2 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                          {it.product_name}
                        </span>
                        {it.tint_coverage ? (
                          <span className="text-[11px] text-sky-600 dark:text-sky-400 block">
                            Cobertura: {it.tint_coverage}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <span className="text-zinc-500 font-mono">x{it.quantity}</span>
                        {it.with_installation ? (
                          <Badge variant="outline" className="text-[9px] ml-2 text-emerald-600 border-emerald-300">
                            Instalado
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Branch Contact & WhatsApp Support */}
            <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  {data.branch?.name || "MC-LARENS Sucursal Principal"}
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {data.branch?.address || "Managua, Nicaragua"}
                </p>
              </div>
              <a
                href={`https://wa.me/${String(data.branch?.phone || "").replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Hola, quisiera consultar sobre el estado de mi vehículo (Orden: ${data.invoice_number})`)}`}
                target="_blank"
                rel="noreferrer"
              >
                <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20">
                  <MessageCircle className="h-4 w-4" />
                  Contactar por WhatsApp
                </Button>
              </a>
            </div>

          </CardContent>
        </Card>

        {/* Footer Guarantee */}
        <div className="text-center text-xs text-zinc-400 dark:text-zinc-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>Garantía Oficial y Calidad Certificada MC-LARENS</span>
        </div>

      </div>
    </div>
  );
}
