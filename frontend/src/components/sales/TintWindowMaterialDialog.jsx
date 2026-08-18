import React, { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Layers,
  Sparkles,
  Check,
  AlertCircle,
  Link,
  Unlink,
  Sun,
  Car,
} from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
import { API_BASE as API } from "@/lib/api";
import {
  resolveVehicleCategory,
  VEHICLE_CATEGORIES,
  VEHICLE_GLASS_GEOMETRY,
} from "@/lib/vehicleSilhouette";

// Zonas y Nombres Oficiales
const ZONES = [
  { id: "windshield", label: "Parabrisas delantero", shortLabel: "Parabrisas del." },
  { id: "front_sides", label: "Ventanas Delanteras", shortLabel: "Ventanas Del." },
  { id: "rear_sides", label: "Ventanas Traseras", shortLabel: "Ventanas Tras." },
  { id: "rear", label: "Parabrisas Trasero", shortLabel: "Parabrisas Tras." },
];

export default function TintWindowMaterialDialog({
  isOpen,
  onClose,
  onApplyPlan,
  vehicle = null,
  initialPlan = null,
  currency = "NIO",
  exchangeRate = 36.5,
}) {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(null);
  const [activeZone, setActiveZone] = useState("windshield");
  const [linkSides, setLinkSides] = useState(true);

  // Categoría de Vehículo Dinámica
  const detectedCategory = useMemo(() => resolveVehicleCategory(vehicle), [vehicle]);
  const [selectedVehicleType, setSelectedVehicleType] = useState(detectedCategory);

  useEffect(() => {
    if (vehicle) {
      setSelectedVehicleType(resolveVehicleCategory(vehicle));
    }
  }, [vehicle]);

  // Materiales Capa 1 (Base)
  const [selectedMaterials, setSelectedMaterials] = useState({
    windshield: "std_70",
    front_sides: "std_20",
    rear_sides: "std_20",
    rear: "std_20",
  });

  // Materiales Capa 2 (Doble Capa)
  const [secondLayers, setSecondLayers] = useState({
    windshield: { enabled: false, material_id: "carbon_20" },
    front_sides: { enabled: false, material_id: "carbon_20" },
    rear_sides: { enabled: false, material_id: "carbon_20" },
    rear: { enabled: false, material_id: "carbon_20" },
  });

  // Bandas de Sol (Sunstrips)
  const [sunstrips, setSunstrips] = useState({
    windshield_top: { enabled: false, material_id: "std_20" },
    windshield_bottom: { enabled: false, material_id: "std_20" },
    rear_top: { enabled: false, material_id: "std_20" },
    rear_bottom: { enabled: false, material_id: "std_20" },
  });

  const [overrideFlags, setOverrideFlags] = useState({
    windshield: false,
    front_sides: false,
    rear_sides: false,
    rear: false,
  });

  const [quoteData, setQuoteData] = useState(null);

  // Cargar configuración de materiales al abrir
  useEffect(() => {
    if (!isOpen) return;
    const fetchConfig = async () => {
      setLoading(true);
      try {
        const vehicleId = vehicle?.vehicle_id || vehicle?.id || "";
        const res = await axios.get(
          `${API}/tint/window-config`,
          {
            params: { vehicle_id: vehicleId, allow_override: true },
            withCredentials: true,
          }
        );
        setConfig(res.data);

        // Restaurar plan previo si existe
        if (initialPlan?.windows) {
          const mats = {};
          const ovs = {};
          const secs = {};
          Object.keys(initialPlan.windows).forEach((z) => {
            mats[z] = initialPlan.windows[z]?.material_id || "std_20";
            ovs[z] = Boolean(initialPlan.windows[z]?.override_size_band);
            if (initialPlan.windows[z]?.second_layer) {
              secs[z] = {
                enabled: Boolean(initialPlan.windows[z]?.second_layer?.enabled),
                material_id: initialPlan.windows[z]?.second_layer?.material_id || "carbon_20",
              };
            } else {
              secs[z] = { enabled: false, material_id: "carbon_20" };
            }
          });
          setSelectedMaterials(mats);
          setOverrideFlags(ovs);
          setSecondLayers((prev) => ({ ...prev, ...secs }));

          if (initialPlan.sunstrips) {
            setSunstrips((prev) => ({ ...prev, ...initialPlan.sunstrips }));
          }
          if (typeof initialPlan.link_sides === "boolean") {
            setLinkSides(initialPlan.link_sides);
          } else {
            setLinkSides(mats.front_sides === mats.rear_sides);
          }
        } else {
          setSelectedMaterials({
            windshield: "std_70",
            front_sides: "std_20",
            rear_sides: "std_20",
            rear: "std_20",
          });
          setLinkSides(true);
        }
      } catch (err) {
        console.error("Error loading tint window config", err);
        toast.error("No se pudo cargar la configuración de polarizados");
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, [isOpen, vehicle, initialPlan]);

  // Cotizar plan en tiempo real
  useEffect(() => {
    if (!isOpen || !config) return;

    const computeQuote = async () => {
      const planPayload = {
        vehicle_id: vehicle?.vehicle_id || vehicle?.id || null,
        link_sides: linkSides,
        windows: {
          windshield: {
            material_id: selectedMaterials.windshield,
            override_size_band: overrideFlags.windshield,
            second_layer: secondLayers.windshield,
          },
          front_sides: {
            material_id: selectedMaterials.front_sides,
            override_size_band: overrideFlags.front_sides,
            second_layer: secondLayers.front_sides,
          },
          rear_sides: {
            material_id: selectedMaterials.rear_sides,
            override_size_band: overrideFlags.rear_sides,
            second_layer: secondLayers.rear_sides,
          },
          rear: {
            material_id: selectedMaterials.rear,
            override_size_band: overrideFlags.rear,
            second_layer: secondLayers.rear,
          },
        },
        sunstrips: sunstrips,
      };

      try {
        const res = await axios.post(`${API}/tint/window-plan/quote`, planPayload, {
          withCredentials: true,
        });
        setQuoteData(res.data);
      } catch (err) {
        console.warn("Quote error", err?.response?.data);
      }
    };

    computeQuote();
  }, [isOpen, config, selectedMaterials, secondLayers, sunstrips, overrideFlags, linkSides, vehicle]);

  // Manejar selección de material base
  const handleSelectMaterial = (zone, materialId) => {
    setSelectedMaterials((prev) => {
      if (linkSides && (zone === "front_sides" || zone === "rear_sides")) {
        return { ...prev, front_sides: materialId, rear_sides: materialId };
      }
      return { ...prev, [zone]: materialId };
    });
  };

  // Manejar segunda capa
  const handleToggleSecondLayer = (zone, enabled) => {
    setSecondLayers((prev) => {
      const current = prev[zone] || { material_id: "carbon_20" };
      if (linkSides && (zone === "front_sides" || zone === "rear_sides")) {
        return {
          ...prev,
          front_sides: { ...current, enabled },
          rear_sides: { ...current, enabled },
        };
      }
      return {
        ...prev,
        [zone]: { ...current, enabled },
      };
    });
  };

  const handleSelectSecondLayerMaterial = (zone, materialId) => {
    setSecondLayers((prev) => {
      if (linkSides && (zone === "front_sides" || zone === "rear_sides")) {
        return {
          ...prev,
          front_sides: { ...prev.front_sides, material_id: materialId },
          rear_sides: { ...prev.rear_sides, material_id: materialId },
        };
      }
      return {
        ...prev,
        [zone]: { ...prev[zone], material_id: materialId },
      };
    });
  };

  // Manejar toggle de bandas de sol
  const handleToggleSunstrip = (stripKey, enabled) => {
    setSunstrips((prev) => ({
      ...prev,
      [stripKey]: { ...prev[stripKey], enabled },
    }));
  };

  // Aplicar material a todas las ventanas
  const handleApplyAll = (materialId) => {
    setSelectedMaterials({
      windshield: materialId,
      front_sides: materialId,
      rear_sides: materialId,
      rear: materialId,
    });
    toast.success("Material aplicado a todos los cristales");
  };

  // Confirmar y aplicar plan al carrito
  const handleApply = () => {
    if (!quoteData?.valid) {
      toast.error(quoteData?.error || "Plan de polarizado incompleto o inválido");
      return;
    }

    onApplyPlan({
      tint_window_plan: {
        link_sides: linkSides,
        windows: {
          windshield: {
            material_id: selectedMaterials.windshield,
            material_name: quoteData.rolls_consumed?.find((r) => r.zone === "windshield" && r.layer === 1)?.material_name,
            size_band: quoteData.vehicle_size_bands?.windshield,
            override_size_band: overrideFlags.windshield,
            second_layer: secondLayers.windshield.enabled ? secondLayers.windshield : null,
          },
          front_sides: {
            material_id: selectedMaterials.front_sides,
            material_name: quoteData.rolls_consumed?.find((r) => r.zone === "front_sides" && r.layer === 1)?.material_name,
            size_band: quoteData.vehicle_size_bands?.front_sides,
            override_size_band: overrideFlags.front_sides,
            second_layer: secondLayers.front_sides.enabled ? secondLayers.front_sides : null,
          },
          rear_sides: {
            material_id: selectedMaterials.rear_sides,
            material_name: quoteData.rolls_consumed?.find((r) => r.zone === "rear_sides" && r.layer === 1)?.material_name,
            size_band: quoteData.vehicle_size_bands?.rear_sides,
            override_size_band: overrideFlags.rear_sides,
            second_layer: secondLayers.rear_sides.enabled ? secondLayers.rear_sides : null,
          },
          rear: {
            material_id: selectedMaterials.rear,
            material_name: quoteData.rolls_consumed?.find((r) => r.zone === "rear" && r.layer === 1)?.material_name,
            size_band: quoteData.vehicle_size_bands?.rear,
            override_size_band: overrideFlags.rear,
            second_layer: secondLayers.rear.enabled ? secondLayers.rear : null,
          },
        },
        sunstrips: sunstrips,
        rolls_consumed: quoteData.rolls_consumed,
        materials_extra_total: quoteData.materials_extra_total,
        price_breakdown: quoteData.price_breakdown,
        vehicle_size_bands: quoteData.vehicle_size_bands,
      },
      materials_extra: quoteData.materials_extra_total,
    });

    onClose();
  };

  const activeZoneConfig = config?.zones?.[activeZone];
  const activeMaterials = activeZoneConfig?.materials || [];
  const activeZoneLabel = ZONES.find((z) => z.id === activeZone)?.label || active  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[98vw] sm:w-[96vw] max-w-6xl md:max-w-7xl max-h-[96dvh] h-[95dvh] md:h-[90vh] flex flex-col p-0 overflow-hidden bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl">
        {/* Encabezado Responsivo: En móvil es una sola línea ultra-compacta; en PC es el banner completo */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 px-3 py-2 sm:p-3.5 md:px-6 md:py-3.5 text-white shrink-0 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="flex h-7 w-7 sm:h-9 sm:w-9 md:h-10 md:w-10 items-center justify-center rounded-xl bg-blue-500/20 border border-blue-400/30 shrink-0">
                <Layers className="h-4 w-4 sm:h-5 sm:w-5 text-blue-300" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-xs sm:text-base md:text-lg font-bold text-white flex items-center gap-1.5 sm:gap-2 truncate">
                  <span>{vehicle ? `${vehicle.brand} ${vehicle.model} (${vehicle.year || "S/A"})` : "Seleccionador de Materiales"}</span>
                  <Badge variant="outline" className="border-blue-400/40 text-blue-200 text-[9px] sm:text-[10px] uppercase font-mono px-1 py-0 shrink-0">
                    {VEHICLE_CATEGORIES.find((c) => c.id === selectedVehicleType)?.shortLabel || "Personalizado"}
                  </Badge>
                </DialogTitle>
                <p className="hidden sm:block text-[11px] text-blue-200/90 truncate">
                  Bandas requeridas: {config?.vehicle_size_bands?.windshield || "≤40\""} / {config?.vehicle_size_bands?.front_sides || "≤20\""}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="hidden sm:block text-[10px] uppercase text-blue-300 font-mono">Recargo</span>
              <span className="text-sm sm:text-lg md:text-xl font-black text-white">
                +${quoteData?.materials_extra_total?.toFixed(2) || "0.00"}{" "}
                <span className="text-[10px] sm:text-xs font-medium text-blue-200">USD</span>
              </span>
            </div>
          </div>
        </div>

        {/* Cuerpo: Diagrama Interactivo de Auto Dinámico + Selector de Material */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-0 overflow-y-auto min-h-0 flex-1">
          {/* Lado Izquierdo (5 cols en PC / Arriba en Móvil): Diagrama Interactivo SVG */}
          <div className="md:col-span-5 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 p-2 sm:p-3 lg:p-4 flex flex-col items-center justify-between bg-zinc-50/70 dark:bg-zinc-900/50 select-none">
            {/* Header del Vehículo sin redundancias: Modelo fijo detectado automáticamente */}
            <div className="w-full flex items-center justify-between px-1 pb-1">
              <span className="text-[11px] sm:text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider truncate flex items-center gap-1.5">
                <Car className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                {VEHICLE_CATEGORIES.find((c) => c.id === selectedVehicleType)?.label || "Camioneta Doble Cabina"}
              </span>

              {/* Selector sutil de cambio manual solo si es necesario */}
              <select
                value={selectedVehicleType}
                onChange={(e) => setSelectedVehicleType(e.target.value)}
                className="text-[10px] sm:text-xs bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md px-1.5 py-0.5 text-zinc-700 dark:text-zinc-300 cursor-pointer"
                title="Cambiar tipo de carrocería si difiere del detectado"
              >
                {VEHICLE_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.shortLabel}
                  </option>
                ))}
              </select>
            </div>

            {/* Canvas del Vehículo: Imagen Real Superior + Capa SVG con Vidrios y Franjas Táctiles */}
            <div className="relative w-44 h-[195px] sm:w-52 sm:h-[230px] md:w-72 md:h-[420px] lg:w-80 lg:h-[460px] xl:w-96 xl:h-[490px] my-auto select-none flex items-center justify-center shrink-0">
              {/* 1. Imagen Top-Down Realista de la Carrocería */}
              <img
                src={VEHICLE_CATEGORIES.find((c) => c.id === selectedVehicleType)?.image || "/vehicles/clean_camioneta_doble_cabina.png"}
                alt="Vehículo Top-Down"
                className="absolute inset-0 w-full h-full object-contain pointer-events-none drop-shadow-lg transition-all duration-300"
              />

              {/* 2. Capa SVG Interactiva de Cristales */}
              {(() => {
                const geom = VEHICLE_GLASS_GEOMETRY[selectedVehicleType] || VEHICLE_GLASS_GEOMETRY.camioneta_doble_cabina || VEHICLE_GLASS_GEOMETRY.sedan;

                const getShade = (zoneKey) => {
                  const mat = String(selectedMaterials[zoneKey] || "").toLowerCase();
                  if (mat.includes("70")) return { fill: "#38bdf8", opacity: 0.45, border: "#0284c7" };
                  if (mat.includes("35")) return { fill: "#1e293b", opacity: 0.70, border: "#475569" };
                  if (mat.includes("05")) return { fill: "#020617", opacity: 0.95, border: "#0f172a" };
                  return { fill: "#090d16", opacity: 0.85, border: "#1e293b" };
                };

                const shadeWindshield = getShade("windshield");
                const shadeFrontSides = getShade("front_sides");
                const shadeRearSides = getShade("rear_sides");
                const shadeRear = getShade("rear");

                return (
                  <svg viewBox="0 0 200 360" className="absolute inset-0 w-full h-full select-none">
                    <defs>
                      <filter id="neonGlowActive" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#38bdf8" floodOpacity="0.9" />
                      </filter>
                      <filter id="neonGlowYellow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#eab308" floodOpacity="0.9" />
                      </filter>
                      <filter id="neonGlowOrange" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#f97316" floodOpacity="0.9" />
                      </filter>
                      <filter id="neonGlowPurple" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#a855f7" floodOpacity="0.9" />
                      </filter>
                    </defs>

                    {/* 1. PARABRISAS DELANTERO */}
                    <path
                      d={geom.windshield.d}
                      fill={shadeWindshield.fill}
                      fillOpacity={shadeWindshield.opacity}
                      stroke={activeZone === "windshield" ? "#38bdf8" : shadeWindshield.border}
                      strokeWidth={activeZone === "windshield" ? "3.5" : "1.5"}
                      filter={activeZone === "windshield" ? "url(#neonGlowActive)" : undefined}
                      className="cursor-pointer transition-all hover:opacity-90"
                      onClick={() => setActiveZone("windshield")}
                    />

                    {/* Banda Superior Parabrisas (Visera Techo - Táctil) */}
                    {geom.windshield.topStrip && (
                      <path
                        d={geom.windshield.topStrip}
                        fill={sunstrips.windshield_top?.enabled ? "#020617" : "transparent"}
                        fillOpacity={sunstrips.windshield_top?.enabled ? 0.95 : 0.01}
                        stroke={sunstrips.windshield_top?.enabled ? "#38bdf8" : "rgba(255,255,255,0.2)"}
                        strokeWidth={sunstrips.windshield_top?.enabled ? "1.5" : "0.5"}
                        strokeDasharray={sunstrips.windshield_top?.enabled ? undefined : "2,2"}
                        className="cursor-pointer transition-all hover:opacity-80"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveZone("windshield");
                          handleToggleSunstrip("windshield_top", !sunstrips.windshield_top?.enabled);
                        }}
                      />
                    )}

                    {/* Banda Inferior Parabrisas (Base Capó - Táctil) */}
                    {geom.windshield.bottomStrip && (
                      <path
                        d={geom.windshield.bottomStrip}
                        fill={sunstrips.windshield_bottom?.enabled ? "#020617" : "transparent"}
                        fillOpacity={sunstrips.windshield_bottom?.enabled ? 0.95 : 0.01}
                        stroke={sunstrips.windshield_bottom?.enabled ? "#38bdf8" : "rgba(255,255,255,0.2)"}
                        strokeWidth={sunstrips.windshield_bottom?.enabled ? "1.5" : "0.5"}
                        strokeDasharray={sunstrips.windshield_bottom?.enabled ? undefined : "2,2"}
                        className="cursor-pointer transition-all hover:opacity-80"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveZone("windshield");
                          handleToggleSunstrip("windshield_bottom", !sunstrips.windshield_bottom?.enabled);
                        }}
                      />
                    )}

                    {/* Textos Parabrisas */}
                    <text
                      x="100"
                      y={geom.windshield.textY}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="7.5"
                      fontWeight="bold"
                      className="pointer-events-none select-none drop-shadow"
                    >
                      Parabrisas del.
                    </text>
                    <text
                      x="100"
                      y={geom.windshield.subY}
                      textAnchor="middle"
                      fill="#e0f2fe"
                      fontSize="7"
                      fontWeight="600"
                      className="pointer-events-none select-none"
                    >
                      {selectedMaterials.windshield?.includes("70")
                        ? "70%"
                        : selectedMaterials.windshield?.includes("35")
                        ? "35%"
                        : "20%"}
                      {secondLayers.windshield?.enabled ? " + 2da" : ""}
                    </text>

                    {/* 2. VENTANAS DELANTERAS */}
                    {geom.front_sides.map((p, idx) => (
                      <path
                        key={`fs-${idx}`}
                        d={p.d}
                        fill={shadeFrontSides.fill}
                        fillOpacity={shadeFrontSides.opacity}
                        stroke={activeZone === "front_sides" ? "#eab308" : shadeFrontSides.border}
                        strokeWidth={activeZone === "front_sides" ? "3.5" : "1.5"}
                        filter={activeZone === "front_sides" ? "url(#neonGlowYellow)" : undefined}
                        className="cursor-pointer transition-all hover:opacity-90"
                        onClick={() => setActiveZone("front_sides")}
                      />
                    ))}

                    {/* 3. VENTANAS TRASERAS */}
                    {geom.rear_sides.map((p, idx) => (
                      <path
                        key={`rs-${idx}`}
                        d={p.d}
                        fill={shadeRearSides.fill}
                        fillOpacity={shadeRearSides.opacity}
                        stroke={activeZone === "rear_sides" ? "#f97316" : shadeRearSides.border}
                        strokeWidth={activeZone === "rear_sides" ? "3.5" : "1.5"}
                        filter={activeZone === "rear_sides" ? "url(#neonGlowOrange)" : undefined}
                        className="cursor-pointer transition-all hover:opacity-90"
                        onClick={() => setActiveZone("rear_sides")}
                      />
                    ))}

                    {/* 4. PARABRISAS TRASERO */}
                    <path
                      d={geom.rear.d}
                      fill={shadeRear.fill}
                      fillOpacity={shadeRear.opacity}
                      stroke={activeZone === "rear" ? "#a855f7" : shadeRear.border}
                      strokeWidth={activeZone === "rear" ? "3.5" : "1.5"}
                      filter={activeZone === "rear" ? "url(#neonGlowPurple)" : undefined}
                      className="cursor-pointer transition-all hover:opacity-90"
                      onClick={() => setActiveZone("rear")}
                    />

                    {/* Banda Superior Trasera (Táctil) */}
                    {geom.rear.topStrip && (
                      <path
                        d={geom.rear.topStrip}
                        fill={sunstrips.rear_top?.enabled ? "#020617" : "transparent"}
                        fillOpacity={sunstrips.rear_top?.enabled ? 0.95 : 0.01}
                        stroke={sunstrips.rear_top?.enabled ? "#a855f7" : "rgba(255,255,255,0.2)"}
                        strokeWidth={sunstrips.rear_top?.enabled ? "1.5" : "0.5"}
                        strokeDasharray={sunstrips.rear_top?.enabled ? undefined : "2,2"}
                        className="cursor-pointer transition-all hover:opacity-80"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveZone("rear");
                          handleToggleSunstrip("rear_top", !sunstrips.rear_top?.enabled);
                        }}
                      />
                    )}

                    {/* Banda Inferior Trasera (Táctil) */}
                    {geom.rear.bottomStrip && (
                      <path
                        d={geom.rear.bottomStrip}
                        fill={sunstrips.rear_bottom?.enabled ? "#020617" : "transparent"}
                        fillOpacity={sunstrips.rear_bottom?.enabled ? 0.95 : 0.01}
                        stroke={sunstrips.rear_bottom?.enabled ? "#a855f7" : "rgba(255,255,255,0.2)"}
                        strokeWidth={sunstrips.rear_bottom?.enabled ? "1.5" : "0.5"}
                        strokeDasharray={sunstrips.rear_bottom?.enabled ? undefined : "2,2"}
                        className="cursor-pointer transition-all hover:opacity-80"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveZone("rear");
                          handleToggleSunstrip("rear_bottom", !sunstrips.rear_bottom?.enabled);
                        }}
                      />
                    )}

                    {/* Textos Trasero */}
                    <text
                      x="100"
                      y={geom.rear.textY}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="7.5"
                      fontWeight="bold"
                      className="pointer-events-none select-none drop-shadow"
                    >
                      Parabrisas Tras.
                    </text>
                    <text
                      x="100"
                      y={geom.rear.subY}
                      textAnchor="middle"
                      fill="#f3e8ff"
                      fontSize="7"
                      fontWeight="600"
                      className="pointer-events-none select-none"
                    >
                      {selectedMaterials.rear?.includes("70")
                        ? "70%"
                        : selectedMaterials.rear?.includes("35")
                        ? "35%"
                        : "20%"}
                      {secondLayers.rear?.enabled ? " + 2da" : ""}
                    </text>
                  </svg>
                );
              })()}
            </div>

            {/* Leyenda de Colores Interactiva y Táctil */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-2 gap-1 text-[9px] sm:text-[10px] w-full max-w-sm md:max-w-xs font-medium pt-1 border-t border-zinc-200 dark:border-zinc-800">
              <div
                className={`flex items-center gap-1.5 cursor-pointer p-1 rounded-md transition-all ${
                  activeZone === "windshield" ? "bg-sky-100 dark:bg-sky-950/60 font-bold text-sky-800 dark:text-sky-300 ring-1 ring-sky-400" : ""
                }`}
                onClick={() => setActiveZone("windshield")}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-sky-400 ring-1 ring-sky-600 shrink-0" />
                <span className="truncate">Parabrisas del.</span>
              </div>
              <div
                className={`flex items-center gap-1.5 cursor-pointer p-1 rounded-md transition-all ${
                  activeZone === "front_sides" ? "bg-yellow-100 dark:bg-yellow-950/60 font-bold text-yellow-800 dark:text-yellow-300 ring-1 ring-yellow-400" : ""
                }`}
                onClick={() => setActiveZone("front_sides")}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-400 ring-1 ring-yellow-600 shrink-0" />
                <span className="truncate">Ventanas Del.</span>
              </div>
              <div
                className={`flex items-center gap-1.5 cursor-pointer p-1 rounded-md transition-all ${
                  activeZone === "rear_sides" ? "bg-orange-100 dark:bg-orange-950/60 font-bold text-orange-800 dark:text-orange-300 ring-1 ring-orange-400" : ""
                }`}
                onClick={() => setActiveZone("rear_sides")}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-orange-400 ring-1 ring-orange-600 shrink-0" />
                <span className="truncate">Ventanas Tras.</span>
              </div>
              <div
                className={`flex items-center gap-1.5 cursor-pointer p-1 rounded-md transition-all ${
                  activeZone === "rear" ? "bg-purple-100 dark:bg-purple-950/60 font-bold text-purple-800 dark:text-purple-300 ring-1 ring-purple-400" : ""
                }`}
                onClick={() => setActiveZone("rear")}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-purple-400 ring-1 ring-purple-600 shrink-0" />
                <span className="truncate">Parabrisas Tras.</span>
              </div>
            </div>
          </div>

          {/* Lado Derecho (7 cols en PC / Abajo en Móvil): Lista de Materiales de la Zona Activa */}
          <div className="md:col-span-7 p-2 sm:p-4 lg:p-5 flex flex-col justify-between space-y-2.5 overflow-y-auto">
            <div>
              {/* Barra de Control de la Zona Activa (Reemplaza los botones redundantes) */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`h-3 w-3 rounded-full shrink-0 ${
                      activeZone === "windshield"
                        ? "bg-sky-400"
                        : activeZone === "front_sides"
                        ? "bg-yellow-400"
                        : activeZone === "rear_sides"
                        ? "bg-orange-400"
                        : "bg-purple-400"
                    }`}
                  />
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-1.5 truncate">
                      {activeZoneLabel}
                      {secondLayers[activeZone]?.enabled && (
                        <Badge className="bg-amber-600 text-white text-[9px] px-1.5 py-0 font-mono">
                          + Doble Capa
                        </Badge>
                      )}
                    </h4>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Botón rápido Aplicar a Todos */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleApplyAll(selectedMaterials[activeZone])}
                    className="text-[10px] sm:text-xs h-7 px-2 text-zinc-700 dark:text-zinc-300 font-semibold"
                    title="Aplicar el material de este cristal a todo el vehículo"
                  >
                    <Sparkles className="h-3 w-3 mr-1 text-amber-500" />
                    Aplicar a todos
                  </Button>
                </div>
              </div>

              {/* Controles Rápidos: Vincular Laterales y Doble Capa */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {(activeZone === "front_sides" || activeZone === "rear_sides") && (
                  <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/80 rounded-lg px-2 py-1">
                    {linkSides ? (
                      <Link className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Unlink className="h-3 w-3 text-zinc-400" />
                    )}
                    <span className="text-[10px] sm:text-[11px] font-semibold text-blue-900 dark:text-blue-200">
                      Vincular Laterales
                    </span>
                    <Switch
                      checked={linkSides}
                      onCheckedChange={(checked) => {
                        setLinkSides(checked);
                        if (checked) {
                          setSelectedMaterials((prev) => ({
                            ...prev,
                            rear_sides: prev.front_sides,
                          }));
                          toast.info("Ventanas laterales vinculadas con el mismo material");
                        } else {
                          toast.info("Ventanas laterales desvinculadas");
                        }
                      }}
                      className="scale-75"
                    />
                  </div>
                )}

                {/* Toggle compacto de 2da Capa */}
                <div className="flex items-center gap-1.5 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 rounded-lg px-2 py-1">
                  <Sparkles className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                  <span className="text-[10px] sm:text-[11px] font-semibold text-amber-900 dark:text-amber-200">
                    2da Capa
                  </span>
                  <Switch
                    checked={Boolean(secondLayers[activeZone]?.enabled)}
                    onCheckedChange={(checked) => handleToggleSecondLayer(activeZone, checked)}
                    className="scale-75"
                  />
                </div>

                {/* Franjas / Viseras rápidas si es Parabrisas */}
                {(activeZone === "windshield" || activeZone === "rear") && (
                  <div className="flex items-center gap-1.5 bg-sky-50/80 dark:bg-sky-950/40 border border-sky-200/80 dark:border-sky-800/60 rounded-lg px-2 py-1">
                    <Sun className="h-3 w-3 text-sky-600 dark:text-sky-400" />
                    <span className="text-[10px] sm:text-[11px] font-semibold text-sky-900 dark:text-sky-200">
                      Visera Techo
                    </span>
                    <Switch
                      checked={Boolean(sunstrips[`${activeZone}_top`]?.enabled)}
                      onCheckedChange={(checked) => handleToggleSunstrip(`${activeZone}_top`, checked)}
                      className="scale-75"
                    />
                  </div>
                )}
              </div>

              {/* Selector de Material 2da Capa (si está activada) */}
              {secondLayers[activeZone]?.enabled && (
                <div className="mb-2 p-2 rounded-lg bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-center justify-between gap-2">
                  <Label className="text-[10px] sm:text-[11px] font-bold text-amber-900 dark:text-amber-200">
                    Material 2da Capa:
                  </Label>
                  <select
                    value={secondLayers[activeZone]?.material_id || "carbon_20"}
                    onChange={(e) => handleSelectSecondLayerMaterial(activeZone, e.target.value)}
                    className="text-[11px] rounded-md border border-amber-300 dark:border-amber-800 bg-white dark:bg-zinc-900 px-2 py-1 text-zinc-900 dark:text-white"
                  >
                    {activeMaterials.map((m) => (
                      <option key={m.material_id} value={m.material_id}>
                        {m.name} ({m.price_extra_usd > 0 ? `+$${m.price_extra_usd.toFixed(2)} USD` : "Estándar"})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Lista de Films / Materiales Disponibles (Capa 1) */}
              <div className="space-y-1.5 max-h-56 sm:max-h-64 lg:max-h-72 overflow-y-auto pr-1">
                {activeMaterials.map((mat) => {
                  const isSelected = selectedMaterials[activeZone] === mat.material_id;
                  return (
                    <div
                      key={mat.material_id}
                      onClick={() => handleSelectMaterial(activeZone, mat.material_id)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? "border-blue-600 bg-blue-50/70 dark:bg-blue-950/50 dark:border-blue-500 shadow-sm ring-1 ring-blue-500/40 font-bold"
                          : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900/50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-zinc-400 bg-transparent"
                          }`}
                        >
                          {isSelected && <Check className="h-2.5 w-2.5" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] sm:text-xs text-zinc-900 dark:text-white truncate">
                              {mat.name}
                            </span>
                            <Badge variant="secondary" className="text-[9px] px-1 py-0 font-mono shrink-0">
                              {mat.family}
                            </Badge>
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono block truncate">
                            Stock: {mat.virtual_qty} u
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`text-xs ${
                            mat.price_extra_usd > 0
                              ? "text-emerald-600 dark:text-emerald-400 font-mono font-bold text-xs sm:text-sm"
                              : "text-zinc-500 font-medium text-[11px]"
                          }`}
                        >
                          {mat.price_extra_usd > 0
                            ? `+$${mat.price_extra_usd.toFixed(2)} USD`
                            : "Incluido"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Resumen del Plan y Desglose de Precios */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-2 dark:border-zinc-800 dark:bg-zinc-900/50 text-[11px] shrink-0">
              <div className="flex items-center justify-between font-semibold text-zinc-700 dark:text-zinc-300 pb-1 border-b border-zinc-200 dark:border-zinc-800">
                <span>Recargo Total:</span>
                <span className="text-primary font-mono font-bold">
                  +${quoteData?.materials_extra_total?.toFixed(2) || "0.00"} USD
                </span>
              </div>
              <div className="mt-1 space-y-0.5 max-h-14 overflow-y-auto text-[10px] text-muted-foreground pr-1">
                {(quoteData?.price_breakdown || []).map((b, i) => (
                  <div key={i} className="flex justify-between items-center py-0.5">
                    <span className="truncate pr-2">
                      {b.group_label} ({b.material_name}):
                    </span>
                    <span className="font-mono text-zinc-800 dark:text-zinc-200 font-medium shrink-0">
                      +${b.price_extra_usd.toFixed(2)} USD
                    </span>
                  </div>
                ))}
                {(!quoteData?.price_breakdown || quoteData.price_breakdown.length === 0) && (
                  <div className="text-zinc-500 italic">Sin recargos adicionales (Films Estándar).</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Responsivo */}
        <DialogFooter className="bg-zinc-100/90 dark:bg-zinc-900/90 px-3.5 sm:px-6 py-2 sm:py-2.5 border-t border-zinc-200 dark:border-zinc-800 flex flex-col-reverse sm:flex-row items-center justify-between gap-2 shrink-0">
          <div className="text-[11px] sm:text-xs text-muted-foreground w-full sm:w-auto text-center sm:text-left">
            {quoteData?.valid ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center justify-center sm:justify-start gap-1">
                <Check className="h-3.5 w-3.5" /> Plan completo y validado
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center justify-center sm:justify-start gap-1">
                <AlertCircle className="h-3.5 w-3.5" /> {quoteData?.error || "Verifique selección"}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={onClose} size="sm" className="flex-1 sm:flex-initial h-8 text-xs">
              Cancelar
            </Button>
            <Button
              onClick={handleApply}
              disabled={!quoteData?.valid}
              size="sm"
              className="flex-1 sm:flex-initial h-8 text-xs bg-primary hover:bg-primary/90 text-white font-bold"
            >
              Aplicar al Carrito (+${quoteData?.materials_extra_total?.toFixed(2) || "0.00"} USD)
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

TintWindowMaterialDialog.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onApplyPlan: PropTypes.func.isRequired,
  vehicle: PropTypes.object,
  initialPlan: PropTypes.object,
  currency: PropTypes.string,
  exchangeRate: PropTypes.number,
};
