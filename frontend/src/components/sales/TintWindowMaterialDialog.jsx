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
  Shield,
  Plus,
  Trash2,
  Car,
} from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

// Zonas y Nombres Oficiales
const ZONES = [
  { id: "windshield", label: "Parabrisas delantero", shortLabel: "Parabrisas del.", color: "sky" },
  { id: "front_sides", label: "Ventanas Delanteras", shortLabel: "Ventanas Del.", color: "amber" },
  { id: "rear_sides", label: "Ventanas Traseras", shortLabel: "Ventanas Tras.", color: "orange" },
  { id: "rear", label: "Parabrisas Trasero", shortLabel: "Parabrisas Tras.", color: "purple" },
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
          `/api/tint/window-config?vehicle_id=${vehicleId}&allow_override=true`
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
          // Defaults recomendados
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
        const res = await axios.post("/api/tint/window-plan/quote", planPayload);
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
            material_name: quoteData.rolls_consumed.find((r) => r.zone === "windshield" && r.layer === 1)?.material_name,
            size_band: quoteData.vehicle_size_bands?.windshield,
            override_size_band: overrideFlags.windshield,
            second_layer: secondLayers.windshield.enabled ? secondLayers.windshield : null,
          },
          front_sides: {
            material_id: selectedMaterials.front_sides,
            material_name: quoteData.rolls_consumed.find((r) => r.zone === "front_sides" && r.layer === 1)?.material_name,
            size_band: quoteData.vehicle_size_bands?.front_sides,
            override_size_band: overrideFlags.front_sides,
            second_layer: secondLayers.front_sides.enabled ? secondLayers.front_sides : null,
          },
          rear_sides: {
            material_id: selectedMaterials.rear_sides,
            material_name: quoteData.rolls_consumed.find((r) => r.zone === "rear_sides" && r.layer === 1)?.material_name,
            size_band: quoteData.vehicle_size_bands?.rear_sides,
            override_size_band: overrideFlags.rear_sides,
            second_layer: secondLayers.rear_sides.enabled ? secondLayers.rear_sides : null,
          },
          rear: {
            material_id: selectedMaterials.rear,
            material_name: quoteData.rolls_consumed.find((r) => r.zone === "rear" && r.layer === 1)?.material_name,
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
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
        {/* Encabezado */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 px-6 py-3.5 text-white shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 border border-blue-400/30">
                <Layers className="h-5 w-5 text-blue-300" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                  Seleccionador de Materiales de Polarizado
                  <Badge variant="outline" className="border-blue-400/40 text-blue-200 text-[10px] uppercase font-mono">
                    Personalizado
                  </Badge>
                </DialogTitle>
                <p className="text-xs text-blue-200/80">
                  {vehicle ? `${vehicle.brand} ${vehicle.model} (${vehicle.year || "S/A"})` : "Vehículo Asignado"} ·{" "}
                  Bandas: {config?.vehicle_size_bands?.windshield || "≤40\""} / {config?.vehicle_size_bands?.front_sides || "≤20\""}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase text-blue-300 font-mono block">Recargo Materiales</span>
              <span className="text-xl font-bold text-white">
                +${quoteData?.materials_extra_total?.toFixed(2) || "0.00"}{" "}
                <span className="text-xs font-normal text-blue-200">USD</span>
              </span>
            </div>
          </div>
        </div>

        {/* Cuerpo: Diagrama Interactivo de Auto AZUL + Selector de Material */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-0 overflow-y-auto min-h-0 flex-1">
          {/* Lado Izquierdo (5 cols): Diagrama Vectorial con Carrocería AZUL */}
          <div className="md:col-span-5 border-r border-zinc-200 dark:border-zinc-800 p-5 flex flex-col items-center justify-between bg-zinc-50/60 dark:bg-zinc-900/40 select-none">
            <div className="text-center w-full">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block">
                Esquema del Vehículo
              </span>
              <span className="text-[11px] text-muted-foreground">
                Toca cualquier cristal para cambiar material o agregar 2da capa / bandas
              </span>
            </div>

            {/* SVG Diagram: Carrocería AZUL METÁLICO */}
            <div className="relative w-44 h-76 my-2 select-none">
              <svg viewBox="0 0 200 360" className="w-full h-full drop-shadow-xl">
                {/* Sombras / Ruedas */}
                <rect x="18" y="55" width="14" height="42" rx="6" fill="#0f172a" />
                <rect x="168" y="55" width="14" height="42" rx="6" fill="#0f172a" />
                <rect x="18" y="245" width="14" height="42" rx="6" fill="#0f172a" />
                <rect x="168" y="245" width="14" height="42" rx="6" fill="#0f172a" />

                {/* Espejos Retrovisores */}
                <ellipse cx="25" cy="115" rx="8" ry="12" fill="#1e3a8a" stroke="#1d4ed8" strokeWidth="1.5" />
                <ellipse cx="175" cy="115" rx="8" ry="12" fill="#1e3a8a" stroke="#1d4ed8" strokeWidth="1.5" />

                {/* CARROCERÍA AZUL METÁLICO */}
                <path
                  d="M40,65 C40,25 70,15 100,15 C130,15 160,25 160,65 L165,130 C168,170 168,230 165,280 C160,330 130,345 100,345 C70,345 40,330 35,280 C32,230 32,170 35,130 Z"
                  fill="url(#blueCarGradient)"
                  stroke="#1e40af"
                  strokeWidth="2.5"
                />

                {/* Líneas de Capó y Maletero */}
                <path d="M55,60 C70,45 130,45 145,60" fill="none" stroke="#60a5fa" strokeWidth="1.5" opacity="0.6" />
                <path d="M50,290 C70,310 130,310 150,290" fill="none" stroke="#1e3a8a" strokeWidth="1.5" opacity="0.8" />

                {/* GRADIENTES */}
                <defs>
                  <linearGradient id="blueCarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#1e3a8a" />
                    <stop offset="40%" stopColor="#2563eb" />
                    <stop offset="70%" stopColor="#1d4ed8" />
                    <stop offset="100%" stopColor="#1e3a8a" />
                  </linearGradient>
                  {/* Parabrisas delantero */}
                  <linearGradient id="glassWindshield" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#0284c7" stopOpacity="0.95" />
                  </linearGradient>
                  {/* Ventanas Delanteras */}
                  <linearGradient id="glassFrontSides" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#fde047" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#eab308" stopOpacity="0.95" />
                  </linearGradient>
                  {/* Ventanas Traseras */}
                  <linearGradient id="glassRearSides" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#fb923c" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#f97316" stopOpacity="0.95" />
                  </linearGradient>
                  {/* Parabrisas Trasero */}
                  <linearGradient id="glassRear" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#c084fc" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#9333ea" stopOpacity="0.95" />
                  </linearGradient>
                </defs>

                {/* 1. PARABRISAS DELANTERO */}
                <path
                  d="M56,80 L144,80 L136,130 L64,130 Z"
                  fill="url(#glassWindshield)"
                  stroke={activeZone === "windshield" ? "#ffffff" : "#0369a1"}
                  strokeWidth={activeZone === "windshield" ? "3.5" : "1.5"}
                  className="cursor-pointer transition-all hover:opacity-90"
                  onClick={() => setActiveZone("windshield")}
                />
                {/* Banda Superior Parabrisas */}
                {sunstrips.windshield_top?.enabled && (
                  <path d="M56,80 L144,80 L142,92 L58,92 Z" fill="#090d16" opacity="0.88" />
                )}
                {/* Banda Inferior Parabrisas */}
                {sunstrips.windshield_bottom?.enabled && (
                  <path d="M63,120 L137,120 L136,130 L64,130 Z" fill="#090d16" opacity="0.88" />
                )}
                {/* Texto Parabrisas */}
                <text x="100" y="104" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="bold" className="pointer-events-none select-none drop-shadow">
                  Parabrisas del.
                </text>
                <text x="100" y="116" textAnchor="middle" fill="#e0f2fe" fontSize="7.5" fontWeight="600" className="pointer-events-none select-none">
                  {selectedMaterials.windshield?.includes("70") ? "70%" : selectedMaterials.windshield?.includes("35") ? "35%" : "20%"}
                  {secondLayers.windshield?.enabled ? " + 2da" : ""}
                </text>

                {/* 2. VENTANAS DELANTERAS (Front Sides) */}
                <path
                  d="M48,135 L62,135 L60,190 L46,190 Z"
                  fill="url(#glassFrontSides)"
                  stroke={activeZone === "front_sides" ? "#ffffff" : "#ca8a04"}
                  strokeWidth={activeZone === "front_sides" ? "3.5" : "1.5"}
                  className="cursor-pointer transition-all hover:opacity-90"
                  onClick={() => setActiveZone("front_sides")}
                />
                <path
                  d="M138,135 L152,135 L154,190 L140,190 Z"
                  fill="url(#glassFrontSides)"
                  stroke={activeZone === "front_sides" ? "#ffffff" : "#ca8a04"}
                  strokeWidth={activeZone === "front_sides" ? "3.5" : "1.5"}
                  className="cursor-pointer transition-all hover:opacity-90"
                  onClick={() => setActiveZone("front_sides")}
                />

                {/* 3. VENTANAS TRASERAS (Rear Sides) */}
                <path
                  d="M46,195 L60,195 L58,245 L44,245 Z"
                  fill="url(#glassRearSides)"
                  stroke={activeZone === "rear_sides" ? "#ffffff" : "#ea580c"}
                  strokeWidth={activeZone === "rear_sides" ? "3.5" : "1.5"}
                  className="cursor-pointer transition-all hover:opacity-90"
                  onClick={() => setActiveZone("rear_sides")}
                />
                <path
                  d="M140,195 L154,195 L156,245 L142,245 Z"
                  fill="url(#glassRearSides)"
                  stroke={activeZone === "rear_sides" ? "#ffffff" : "#ea580c"}
                  strokeWidth={activeZone === "rear_sides" ? "3.5" : "1.5"}
                  className="cursor-pointer transition-all hover:opacity-90"
                  onClick={() => setActiveZone("rear_sides")}
                />

                {/* 4. PARABRISAS TRASERO (Rear) */}
                <path
                  d="M66,252 L134,252 L128,290 L72,290 Z"
                  fill="url(#glassRear)"
                  stroke={activeZone === "rear" ? "#ffffff" : "#7e22ce"}
                  strokeWidth={activeZone === "rear" ? "3.5" : "1.5"}
                  className="cursor-pointer transition-all hover:opacity-90"
                  onClick={() => setActiveZone("rear")}
                />
                {/* Banda Superior Trasera */}
                {sunstrips.rear_top?.enabled && (
                  <path d="M66,252 L134,252 L133,260 L67,260 Z" fill="#090d16" opacity="0.88" />
                )}
                {/* Banda Inferior Trasera */}
                {sunstrips.rear_bottom?.enabled && (
                  <path d="M71,282 L129,282 L128,290 L72,290 Z" fill="#090d16" opacity="0.88" />
                )}
                {/* Texto Parabrisas Trasero */}
                <text x="100" y="270" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="bold" className="pointer-events-none select-none drop-shadow">
                  Parabrisas Tras.
                </text>
                <text x="100" y="282" textAnchor="middle" fill="#f3e8ff" fontSize="7.5" fontWeight="600" className="pointer-events-none select-none">
                  {selectedMaterials.rear?.includes("70") ? "70%" : selectedMaterials.rear?.includes("35") ? "35%" : "20%"}
                  {secondLayers.rear?.enabled ? " + 2da" : ""}
                </text>
              </svg>
            </div>

            {/* Leyenda de Colores con Nombres Oficiales */}
            <div className="grid grid-cols-2 gap-1.5 text-[10px] w-full max-w-xs font-medium pt-1 border-t border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => setActiveZone("windshield")}>
                <span className="h-2.5 w-2.5 rounded-full bg-sky-400 ring-1 ring-sky-600" />
                <span className="text-zinc-700 dark:text-zinc-300">Parabrisas delantero</span>
              </div>
              <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => setActiveZone("front_sides")}>
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-400 ring-1 ring-yellow-600" />
                <span className="text-zinc-700 dark:text-zinc-300">Ventanas Delanteras</span>
              </div>
              <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => setActiveZone("rear_sides")}>
                <span className="h-2.5 w-2.5 rounded-full bg-orange-400 ring-1 ring-orange-600" />
                <span className="text-zinc-700 dark:text-zinc-300">Ventanas Traseras</span>
              </div>
              <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => setActiveZone("rear")}>
                <span className="h-2.5 w-2.5 rounded-full bg-purple-400 ring-1 ring-purple-600" />
                <span className="text-zinc-700 dark:text-zinc-300">Parabrisas Trasero</span>
              </div>
            </div>
          </div>

          {/* Lado Derecho (7 cols): Selección de Material, 2da Capa y Bandas */}
          <div className="md:col-span-7 p-5 flex flex-col justify-between space-y-3 overflow-y-auto">
            <div>
              {/* Selector de Pestañas de Zona */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-zinc-200 dark:border-zinc-800 pb-2.5 mb-3">
                <div className="flex flex-wrap gap-1">
                  {ZONES.map((z) => (
                    <button
                      key={z.id}
                      type="button"
                      onClick={() => setActiveZone(z.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                        activeZone === z.id
                          ? "bg-primary text-white shadow-sm"
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
                  size="xs"
                  onClick={() => handleApplyAll(selectedMaterials[activeZone])}
                  className="text-[10px] h-6 px-2 text-zinc-600 dark:text-zinc-400"
                  title="Aplicar el material de esta zona a todo el vehículo"
                >
                  <Sparkles className="h-3 w-3 mr-1 text-amber-500" />
                  Aplicar a todos
                </Button>
              </div>

              {/* Título de la Zona y Control de Vinculación de Laterales */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div>
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                    {activeZoneLabel}
                    {secondLayers[activeZone]?.enabled && (
                      <Badge className="bg-amber-600 text-white text-[9px] px-1.5 py-0">
                        + Doble Capa
                      </Badge>
                    )}
                  </h4>
                  <span className="text-[11px] text-muted-foreground">
                    Rollo requerido:{" "}
                    <strong className="text-zinc-800 dark:text-zinc-200 font-mono">
                      {activeZoneConfig?.size_band_info?.name || "Estándar"}
                    </strong>
                  </span>
                </div>

                {/* Toggle de Vinculación de Laterales (Delanteras + Traseras) */}
                {(activeZone === "front_sides" || activeZone === "rear_sides") && (
                  <div className="flex items-center gap-1.5 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-lg px-2.5 py-1">
                    {linkSides ? (
                      <Link className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Unlink className="h-3.5 w-3.5 text-zinc-400" />
                    )}
                    <span className="text-[11px] font-medium text-blue-900 dark:text-blue-200">
                      Vincular Ventanas Laterales
                    </span>
                    <Switch
                      checked={linkSides}
                      onCheckedChange={(checked) => {
                        setLinkSides(checked);
                        if (checked) {
                          // Al vincular, igualar traseras con delanteras
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

              {/* Lista de Films / Materiales Disponibles (Capa 1) */}
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {activeMaterials.map((mat) => {
                  const isSelected = selectedMaterials[activeZone] === mat.material_id;
                  return (
                    <div
                      key={mat.material_id}
                      onClick={() => handleSelectMaterial(activeZone, mat.material_id)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 dark:border-blue-500 shadow-sm"
                          : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900/50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                            isSelected
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-zinc-400 bg-transparent"
                          }`}
                        >
                          {isSelected && <Check className="h-2.5 w-2.5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-zinc-900 dark:text-white">
                              {mat.name}
                            </span>
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-mono">
                              {mat.family}
                            </Badge>
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            Stock: {mat.virtual_qty} u
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`text-xs font-bold ${
                            mat.price_extra_usd > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-zinc-500"
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
                {/* Control 2da Capa (Doble Polarizado) */}
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

                  {/* Selector de material para 2da Capa */}
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

                {/* Controles de Bandas de Sol (Solo para Parabrisas Delantero y Parabrisas Trasero) */}
                {(activeZone === "windshield" || activeZone === "rear") && (
                  <div className="rounded-lg border border-sky-200/70 bg-sky-50/40 dark:border-sky-900/50 dark:bg-sky-950/20 p-2.5 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Sun className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                      <span className="text-xs font-bold text-sky-900 dark:text-sky-200">
                        Bandas de Sol (Viseras) en {activeZoneLabel}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {/* Banda Superior */}
                      <div className="flex items-center justify-between bg-white dark:bg-zinc-900 rounded-md border p-2">
                        <div>
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200 text-[11px] block">
                            Banda Superior
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

                      {/* Banda Inferior */}
                      <div className="flex items-center justify-between bg-white dark:bg-zinc-900 rounded-md border p-2">
                        <div>
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200 text-[11px] block">
                            Banda Inferior
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
