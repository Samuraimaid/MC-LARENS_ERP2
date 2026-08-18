import React, { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import {
  Truck,
  Navigation,
  RefreshCw,
  MapPin,
  Phone,
  Battery,
  Zap,
  Clock,
  User,
  Shield,
  Activity,
  Maximize2,
} from "lucide-react";
import { API_BASE as API } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export function LiveFleetTrackingRadar({ branchId = null, height = "480px" }) {
  const [fleet, setFleet] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [lastSync, setLastSync] = useState(new Date());

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersGroupRef = useRef({});

  const fetchFleet = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await axios.get(`${API}/delivery/live-fleet`, { withCredentials: true });
      const list = res.data?.fleet || [];
      const filtered = branchId ? list.filter((d) => !d.branch_id || d.branch_id === branchId) : list;
      setFleet(filtered);
      setLastSync(new Date());
    } catch (err) {
      if (!silent) {
        toast.error("Error al obtener telemetría de flota en vivo");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [branchId]);

  // Initial Fetch & Polling every 7 seconds
  useEffect(() => {
    fetchFleet(false);
    const interval = setInterval(() => fetchFleet(true), 7000);
    return () => clearInterval(interval);
  }, [fetchFleet]);

  // Leaflet Map Initialization
  useEffect(() => {
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const initMap = () => {
      if (!window.L || !mapContainerRef.current || mapInstanceRef.current) return;

      const map = window.L.map(mapContainerRef.current, {
        center: [12.1364, -86.2514], // Managua default
        zoom: 12,
        zoomControl: true,
      });

      window.L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
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

  // Update Markers on Map when Fleet updates
  useEffect(() => {
    if (!window.L || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const currentMarkers = markersGroupRef.current;

    fleet.forEach((driver) => {
      const { driver_id, latitude, longitude, driver_name, speed, is_online, vehicle_plate } = driver;
      if (!latitude || !longitude) return;

      const markerColor = is_online ? (speed > 3 ? "#0284c7" : "#10b981") : "#64748b";
      const iconHtml = `
        <div style="position: relative; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;">
          ${is_online && speed > 3 ? '<div style="position: absolute; width: 38px; height: 38px; background: rgba(2, 132, 199, 0.3); border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>' : ''}
          <div style="width: 28px; height: 28px; background: ${markerColor}; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 8px rgba(0,0,0,0.3); border: 2px solid #ffffff;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>
          </div>
        </div>
      `;

      const customIcon = window.L.divIcon({
        className: "driver-fleet-pin",
        html: iconHtml,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });

      if (currentMarkers[driver_id]) {
        currentMarkers[driver_id].setLatLng([latitude, longitude]);
        currentMarkers[driver_id].setIcon(customIcon);
      } else {
        const marker = window.L.marker([latitude, longitude], { icon: customIcon }).addTo(map);
        marker.on("click", () => setSelectedDriver(driver));
        marker.bindPopup(`<b>${driver_name}</b><br>Placa: ${vehicle_plate || "N/A"}<br>Velocidad: ${(speed || 0).toFixed(0)} km/h`);
        currentMarkers[driver_id] = marker;
      }
    });
  }, [fleet]);

  const focusDriver = (driver) => {
    setSelectedDriver(driver);
    if (mapInstanceRef.current && driver.latitude && driver.longitude) {
      mapInstanceRef.current.flyTo([driver.latitude, driver.longitude], 16, { duration: 1.2 });
    }
  };

  const activeCount = fleet.filter((d) => d.is_online).length;

  return (
    <div className="space-y-4">
      {/* Top Telemetry Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              Radar GPS de Flota en Vivo
              <Badge className="bg-emerald-600 text-white font-mono text-[10px] py-0">
                {activeCount} En Línea
              </Badge>
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Supervisión de choferes, repartidores y traslados inter-sucursal en tiempo real
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-zinc-400">
            Sincronizado: {lastSync.toLocaleTimeString()}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchFleet(false)}
            disabled={loading}
            className="h-8 gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Main Map + Driver Drawer Container */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
        {/* Map View */}
        <div
          className="relative rounded-2xl overflow-hidden border border-slate-300 dark:border-zinc-800 shadow-md"
          style={{ height }}
        >
          <div ref={mapContainerRef} className="w-full h-full z-0" />
        </div>

        {/* Fleet List / Selected Driver Details */}
        <div className="space-y-3 overflow-y-auto" style={{ maxHeight: height }}>
          {fleet.length === 0 ? (
            <div className="p-6 rounded-2xl border border-dashed border-slate-300 dark:border-zinc-800 text-center text-zinc-400 text-xs">
              No hay choferes o repartidores reportando en este momento.
            </div>
          ) : (
            fleet.map((drv) => {
              const isSelected = selectedDriver?.driver_id === drv.driver_id;
              const hasGps = Boolean(drv.latitude && drv.longitude);

              return (
                <Card
                  key={drv.driver_id}
                  onClick={() => focusDriver(drv)}
                  className={`cursor-pointer transition-all duration-200 border ${
                    isSelected
                      ? "border-sky-500 bg-sky-50/50 dark:bg-sky-950/30 shadow-md ring-1 ring-sky-500"
                      : "hover:border-slate-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900"
                  }`}
                >
                  <CardContent className="p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            drv.is_online ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                          }`}
                        />
                        <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                          {drv.driver_name}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          drv.is_online ? "text-emerald-700 border-emerald-300" : "text-zinc-500"
                        }`}
                      >
                        {drv.is_online ? "Activo" : "Sin señal"}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                      <span className="font-mono">{drv.vehicle_plate || "Placa N/D"}</span>
                      {hasGps ? (
                        <span className="font-semibold text-sky-600 dark:text-sky-400">
                          {(drv.speed || 0).toFixed(0)} km/h
                        </span>
                      ) : (
                        <span className="text-amber-500">Sin GPS</span>
                      )}
                    </div>

                    {drv.active_job_ids?.length > 0 ? (
                      <div className="pt-1 text-[10px] text-zinc-500 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                        <span>{drv.active_job_ids.length} pedidos en ruta</span>
                        <Navigation className="h-3 w-3 text-sky-500" />
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
