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
  const activeZoneLabel = ZONES.find((z) => z.id === activeZone)?.label || activeZone;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[96vw] max-w-6xl md:max-w-7xl max-h-[95vh] h-[92vh] flex flex-col p-0 overflow-hidden bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl">
        {/* Encabezado */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 p-3.5 sm:p-5 md:px-6 md:py-4 text-white shrink-0 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-blue-500/20 border border-blue-400/30">
                <Layers className="h-5 w-5 sm:h-6 sm:w-6 text-blue-300" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  Seleccionador de Materiales
                  <Badge variant="outline" className="border-blue-400/40 text-blue-200 text-[10px] sm:text-xs uppercase font-mono px-1.5 py-0.5">
                    Personalizado
                  </Badge>
                </DialogTitle>
                <p className="text-[11px] sm:text-xs text-blue-200/90 mt-0.5">
                  {vehicle ? `${vehicle.brand} ${vehicle.model} (${vehicle.year || "S/A"})` : "Vehículo Asignado"} ·{" "}
                  Bandas: {config?.vehicle_size_bands?.windshield || "≤40\""} / {config?.vehicle_size_bands?.front_sides || "≤20\""}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] sm:text-[11px] uppercase text-blue-300 font-mono block">Recargo Materiales</span>
              <span className="text-xl sm:text-2xl font-black text-white">
                +${quoteData?.materials_extra_total?.toFixed(2) || "0.00"}{" "}
                <span className="text-xs sm:text-sm font-medium text-blue-200">USD</span>
              </span>
            </div>
          </div>
        </div>

        {/* Cuerpo: Diagrama Interactivo de Auto Dinámico + Selector de Material */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-0 overflow-y-auto min-h-0 flex-1">
          {/* Lado Izquierdo (5 cols): Diagrama Vectorial con Carrocería Real Dinámica */}
          <div className="md:col-span-5 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 p-3.5 sm:p-5 lg:p-6 flex flex-col items-center justify-between bg-zinc-50/70 dark:bg-zinc-900/50 select-none">
            <div className="text-center w-full space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider truncate">
                  Modelo: {VEHICLE_CATEGORIES.find((c) => c.id === selectedVehicleType)?.shortLabel || "Sedán"}
                </span>
                
                {/* Desplegable directo de modelos */}
                <select
                  value={selectedVehicleType}
                  onChange={(e) => setSelectedVehicleType(e.target.value)}
                  className="text-xs font-semibold bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2.5 py-1 text-blue-700 dark:text-blue-300 cursor-pointer shadow-xs focus:ring-2 focus:ring-blue-500"
                >
                  {VEHICLE_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selector Rápido de Silueta / Tipo de Carrocería Scrollable */}
              <div className="flex items-center gap-1.5 p-1.5 bg-zinc-200/70 dark:bg-zinc-800/80 rounded-xl overflow-x-auto max-w-full scrollbar-thin">
                {VEHICLE_CATEGORIES.map((cat) => {
                  const isCur = selectedVehicleType === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedVehicleType(cat.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all shrink-0 ${
                        isCur
                          ? "bg-white text-blue-700 dark:bg-zinc-900 dark:text-blue-300 shadow-sm ring-1 ring-blue-500/30 font-bold"
                          : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                      }`}
                      title={cat.label}
                    >
                      {cat.shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Canvas del Vehículo: Imagen Real Superior Grande + SVG Glass Overlays */}
            <div className="relative w-64 h-[380px] sm:w-72 sm:h-[420px] md:w-72 md:h-[440px] lg:w-80 lg:h-[480px] xl:w-96 xl:h-[510px] my-auto select-none flex items-center justify-center">
              {/* 1. Imagen Top-Down Realista de la Carrocería */}
              <img
                src={VEHICLE_CATEGORIES.find((c) => c.id === selectedVehicleType)?.image || "/vehicles/clean_sedan.png"}
                alt="Vehículo Top-Down"
                className="absolute inset-0 w-full h-full object-contain pointer-events-none drop-shadow-lg transition-all duration-300"
              />

              {/* 2. Capa SVG Interactiva de Cristales */}
              {(() => {
                const geom = VEHICLE_GLASS_GEOMETRY[selectedVehicleType] || VEHICLE_GLASS_GEOMETRY.sedan;

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
                    {/* Banda Superior Parabrisas */}
                    {sunstrips.windshield_top?.enabled && geom.windshield.topStrip && (
                      <path d={geom.windshield.topStrip} fill="#020617" opacity="0.95" />
                    )}
                    {/* Banda Inferior Parabrisas */}
                    {sunstrips.windshield_bottom?.enabled && geom.windshield.bottomStrip && (
                      <path d={geom.windshield.bottomStrip} fill="#020617" opacity="0.95" />
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
                    {/* Banda Superior Trasera */}
                    {sunstrips.rear_top?.enabled && geom.rear.topStrip && (
                      <path d={geom.rear.topStrip} fill="#020617" opacity="0.95" />
                    )}
                    {/* Banda Inferior Trasera */}
                    {sunstrips.rear_bottom?.enabled && geom.rear.bottomStrip && (
                      <path d={geom.rear.bottomStrip} fill="#020617" opacity="0.95" />
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

            {/* Leyenda de Colores con Nombres Oficiales */}
            <div className="grid grid-cols-2 gap-1.5 text-[10px] w-full max-w-xs font-medium pt-1 border-t border-zinc-200 dark:border-zinc-800">
              <div
                className={`flex items-center gap-1.5 cursor-pointer p-1 rounded-md transition-all ${
                  activeZone === "windshield" ? "bg-sky-100 dark:bg-sky-950/60 font-bold text-sky-800 dark:text-sky-300" : ""
                }`}
                onClick={() => setActiveZone("windshield")}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-sky-400 ring-1 ring-sky-600 shrink-0" />
                <span className="text-zinc-700 dark:text-zinc-300">Parabrisas delantero</span>
              </div>
              <div
                className={`flex items-center gap-1.5 cursor-pointer p-1 rounded-md transition-all ${
                  activeZone === "front_sides" ? "bg-yellow-100 dark:bg-yellow-950/60 font-bold text-yellow-800 dark:text-yellow-300" : ""
                }`}
                onClick={() => setActiveZone("front_sides")}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-400 ring-1 ring-yellow-600 shrink-0" />
                <span className="text-zinc-700 dark:text-zinc-300">Ventanas Delanteras</span>
              </div>
              <div
                className={`flex items-center gap-1.5 cursor-pointer p-1 rounded-md transition-all ${
                  activeZone === "rear_sides" ? "bg-orange-100 dark:bg-orange-950/60 font-bold text-orange-800 dark:text-orange-300" : ""
                }`}
                onClick={() => setActiveZone("rear_sides")}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-orange-400 ring-1 ring-orange-600 shrink-0" />
                <span className="text-zinc-700 dark:text-zinc-300">Ventanas Traseras</span>
              </div>
              <div
                className={`flex items-center gap-1.5 cursor-pointer p-1 rounded-md transition-all ${
                  activeZone === "rear" ? "bg-purple-100 dark:bg-purple-950/60 font-bold text-purple-800 dark:text-purple-300" : ""
                }`}
                onClick={() => setActiveZone("rear")}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-purple-400 ring-1 ring-purple-600 shrink-0" />
                <span className="text-zinc-700 dark:text-zinc-300">Parabrisas Trasero</span>
              </div>
            </div>
          </div>

          {/* Lado Derecho (7 cols): Selección de Material, 2da Capa y Bandas */}
          <div className="md:col-span-7 p-3.5 sm:p-5 lg:p-6 flex flex-col justify-between space-y-4 overflow-y-auto">
            <div>
              {/* Selector de Pestañas de Zona */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-3.5">
                <div className="flex flex-wrap gap-1.5">
                  {ZONES.map((z) => (
                    <button
                      key={z.id}
                      type="button"
                      onClick={() => setActiveZone(z.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        activeZone === z.id
                          ? "bg-blue-600 text-white shadow-sm ring-1 ring-blue-500"
                          : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {z.shortLabel}
                    </button>
                  ))}
                </div>

                {/* Botón rápido Aplicar a Todos */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleApplyAll(selectedMaterials[activeZone])}
                  className="text-xs h-7 px-2.5 text-zinc-700 dark:text-zinc-300 font-semibold"
                  title="Aplicar el material de esta zona a todo el vehículo"
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
                  Aplicar a todos
                </Button>
              </div>

              {/* Título de la Zona y Control de Vinculación de Laterales */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    {activeZoneLabel}
                    {secondLayers[activeZone]?.enabled && (
                      <Badge className="bg-amber-600 text-white text-[10px] px-2 py-0.5">
                        + Doble Capa
                      </Badge>
                    )}
                  </h4>
                  <span className="text-xs text-muted-foreground">
                    Rollo requerido:{" "}
                    <strong className="text-zinc-800 dark:text-zinc-200 font-mono">
                      {activeZoneConfig?.size_band_info?.name || "Estándar"}
                    </strong>
                  </span>
                </div>

                {/* Toggle de Vinculación de Laterales */}
                {(activeZone === "front_sides" || activeZone === "rear_sides") && (
                  <div className="flex items-center gap-2 bg-blue-50/90 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/80 rounded-xl px-3 py-1.5 shadow-2xs">
                    {linkSides ? (
                      <Link className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Unlink className="h-4 w-4 text-zinc-400" />
                    )}
                    <span className="text-xs font-semibold text-blue-900 dark:text-blue-200">
                      Vincular Ventanas Laterales
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
                          toast.info("Ventanas laterales desvinculadas: puedes asignar materiales diferentes");
                        }
                      }}
                      className="scale-75"
                    />
                  </div>
                )}
              </div>

              {/* Lista de Films / Materiales Disponibles (Capa 1) con mayor visibilidad */}
              <div className="space-y-2 max-h-56 lg:max-h-64 overflow-y-auto pr-1">
                {activeMaterials.map((mat) => {
                  const isSelected = selectedMaterials[activeZone] === mat.material_id;
                  return (
                    <div
                      key={mat.material_id}
                      onClick={() => handleSelectMaterial(activeZone, mat.material_id)}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? "border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 dark:border-blue-500 shadow-sm ring-1 ring-blue-500/30"
                          : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-4.5 w-4.5 rounded-full border flex items-center justify-center ${
                            isSelected
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-zinc-400 bg-transparent"
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-zinc-900 dark:text-white">
                              {mat.name}
                            </span>
                            <Badge variant="secondary" className="text-[10px] px-2 py-0.5 font-mono">
                              {mat.family}
                            </Badge>
                          </div>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            Stock Disponible: {mat.virtual_qty} u
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`text-xs font-bold ${
                            mat.price_extra_usd > 0
                              ? "text-emerald-600 dark:text-emerald-400 font-mono text-sm"
                              : "text-zinc-500 font-medium"
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

              {/* SECCIÓN ADICIONAL: Segunda Capa y Bandas de Sol */}
              <div className="mt-3 pt-2.5 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                {/* Control 2da Capa */}
                <div className="rounded-lg border border-amber-200/70 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/20 p-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <div>
                        <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                          Segunda Capa de Material (Doble Capa)
                        </span>
                        <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80">
                          Instala una segunda lámina sobre {activeZoneLabel}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={Boolean(secondLayers[activeZone]?.enabled)}
                      onCheckedChange={(checked) => handleToggleSecondLayer(activeZone, checked)}
                      className="scale-75"
                    />
                  </div>

                  {secondLayers[activeZone]?.enabled && (
                    <div className="mt-2 pt-2 border-t border-amber-200/50 dark:border-amber-900/40 flex items-center justify-between gap-2">
                      <Label className="text-[11px] text-amber-900 dark:text-amber-200">
                        Material de 2da Capa:
                      </Label>
                      <select
                        value={secondLayers[activeZone]?.material_id || "carbon_20"}
                        onChange={(e) => handleSelectSecondLayerMaterial(activeZone, e.target.value)}
                        className="text-xs rounded-md border border-amber-300 dark:border-amber-800 bg-white dark:bg-zinc-900 px-2 py-1 text-zinc-900 dark:text-white"
                      >
                        {activeMaterials.map((m) => (
                          <option key={m.material_id} value={m.material_id}>
                            {m.name} ({m.price_extra_usd > 0 ? `+$${m.price_extra_usd.toFixed(2)} USD` : "Estándar"})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Controles de Bandas de Sol */}
                {(activeZone === "windshield" || activeZone === "rear") && (
                  <div className="rounded-lg border border-sky-200/70 bg-sky-50/40 dark:border-sky-900/50 dark:bg-sky-950/20 p-2.5 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Sun className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                      <span className="text-xs font-bold text-sky-900 dark:text-sky-200">
                        Bandas de Sol (Viseras) en {activeZoneLabel}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center justify-between bg-white dark:bg-zinc-900 rounded-md border p-2">
                        <div>
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200 text-[11px] block">
                            {activeZone === "windshield" ? "Banda Superior (Visera Techo)" : "Banda Superior (Línea Techo)"}
                          </span>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                            +$10.00 USD
                          </span>
                        </div>
                        <Switch
                          checked={Boolean(sunstrips[`${activeZone}_top`]?.enabled)}
                          onCheckedChange={(checked) => handleToggleSunstrip(`${activeZone}_top`, checked)}
                          className="scale-75"
                        />
                      </div>

                      <div className="flex items-center justify-between bg-white dark:bg-zinc-900 rounded-md border p-2">
                        <div>
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200 text-[11px] block">
                            {activeZone === "windshield" ? "Banda Inferior (Base Capó)" : "Banda Inferior (Línea Bumper)"}
                          </span>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                            +$10.00 USD
                          </span>
                        </div>
                        <Switch
                          checked={Boolean(sunstrips[`${activeZone}_bottom`]?.enabled)}
                          onCheckedChange={(checked) => handleToggleSunstrip(`${activeZone}_bottom`, checked)}
                          className="scale-75"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Resumen del Plan y Desglose de Precios */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/50 text-xs shrink-0">
              <div className="flex items-center justify-between font-semibold text-zinc-700 dark:text-zinc-300 pb-1 border-b border-zinc-200 dark:border-zinc-800">
                <span>Desglose de Recargo Total:</span>
                <span className="text-primary font-mono font-bold">
                  +${quoteData?.materials_extra_total?.toFixed(2) || "0.00"} USD
                </span>
              </div>
              <div className="mt-1.5 space-y-0.5 max-h-20 overflow-y-auto text-[11px] text-muted-foreground pr-1">
                {(quoteData?.price_breakdown || []).map((b, i) => (
                  <div key={i} className="flex justify-between items-center py-0.5">
                    <span>
                      {b.group_label} ({b.material_name}):
                    </span>
                    <span className="font-mono text-zinc-800 dark:text-zinc-200 font-medium">
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

        {/* Footer */}
        <DialogFooter className="bg-zinc-100/90 dark:bg-zinc-900/90 px-6 py-2.5 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <div className="text-xs text-muted-foreground">
            {quoteData?.valid ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> Plan completo y validado
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" /> {quoteData?.error || "Verifique selección"}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} size="sm">
              Cancelar
            </Button>
            <Button
              onClick={handleApply}
              disabled={!quoteData?.valid}
              size="sm"
              className="bg-primary hover:bg-primary/90 text-white font-bold"
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
