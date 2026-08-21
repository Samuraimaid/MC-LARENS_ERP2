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
import { Input } from "@/components/ui/input";
import {
  Layers,
  Sparkles,
  Check,
  AlertCircle,
  Link,
  Unlink,
  Sun,
  Car,
  RotateCw,
  Search,
  ShieldCheck,
  Flame,
  Crown,
  Shield,
  BadgePercent,
  Scissors,
  CheckCircle2,
  Lock,
} from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { API_BASE as API } from "@/lib/api";
import {
  resolveVehicleCategory,
  VEHICLE_CATEGORIES,
  VEHICLE_GLASS_GEOMETRY,
} from "@/lib/vehicleSilhouette";

// Zonas y Nombres Oficiales
const ZONES = [
  { id: "windshield", label: "Parabrisas delantero", shortLabel: "Parabrisas del.", dotColor: "bg-sky-400", activeBg: "bg-sky-500", ringColor: "ring-sky-400" },
  { id: "front_sides", label: "Ventanas Delanteras", shortLabel: "Ventanas Del.", dotColor: "bg-yellow-400", activeBg: "bg-yellow-500", ringColor: "ring-yellow-400" },
  { id: "rear_sides", label: "Ventanas Traseras", shortLabel: "Ventanas Tras.", dotColor: "bg-orange-400", activeBg: "bg-orange-500", ringColor: "ring-orange-400" },
  { id: "rear", label: "Parabrisas Trasero", shortLabel: "Parabrisas Tras.", dotColor: "bg-purple-400", activeBg: "bg-purple-500", ringColor: "ring-purple-400" },
];

// Las 4 Gamas Oficiales de Polarizados (De izquierda más económica a derecha más premium)
const OFFICIAL_GAMAS = [
  {
    id: "gama_economica",
    name: "1. Gama Económica",
    shortName: "Económica",
    order: 1,
    badgeColor: "bg-emerald-600 text-white",
    borderColor: "border-emerald-500",
    dotColor: "bg-emerald-400",
    icon: BadgePercent,
    description: "Q1 (5%, 20%), Raybar 60\"",
    tierPill: "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800",
  },
  {
    id: "tinmax",
    name: "2. Tinmax",
    shortName: "Tinmax",
    order: 2,
    badgeColor: "bg-blue-600 text-white",
    borderColor: "border-blue-500",
    dotColor: "bg-blue-400",
    icon: Shield,
    description: "Smoke, Charcoal, Raybar 40\", 3M, Quantum Regular",
    tierPill: "text-blue-700 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300 dark:border-blue-800",
  },
  {
    id: "nano_ceramico",
    name: "3. Nano Cerámico",
    shortName: "Nano Cerámico",
    order: 3,
    badgeColor: "bg-purple-600 text-white",
    borderColor: "border-purple-500",
    dotColor: "bg-purple-400",
    icon: Flame,
    description: "Supreme (4% - 42%), Solstice, Camaleón, Titanium",
    tierPill: "text-purple-700 bg-purple-50 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300 dark:border-purple-800",
  },
  {
    id: "gama_premium",
    name: "4. Gama Premium",
    shortName: "Gama Premium",
    order: 4,
    badgeColor: "bg-amber-500 text-black font-black",
    borderColor: "border-amber-500",
    dotColor: "bg-amber-400",
    icon: Crown,
    description: "Quantum Original (14%, 19%, 28%), Endeavor",
    tierPill: "text-amber-800 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800 font-bold",
  },
];

// Función de sombreado y color hiper-realista basada en las muestras del catálogo
export function getRealisticTintShade(materialId, secondLayerEnabled = false) {
  const mat = String(materialId || "").toLowerCase();

  // 1. Camaleón (Efecto iridiscente tornasol azul/violeta)
  if (mat.includes("camaleon")) {
    return {
      fill: "url(#camaleonGradient)",
      opacity: secondLayerEnabled ? 0.96 : 0.82,
      border: "#818cf8",
      glow: "#6366f1",
      label: "Camaleón 20%",
      isSpecial: true,
    };
  }

  // 2. Titanium (Sheen plateado metálico)
  if (mat.includes("titanium")) {
    return {
      fill: "#1e293b",
      opacity: secondLayerEnabled ? 0.95 : 0.78,
      border: "#94a3b8",
      glow: "#cbd5e1",
      label: "Titanium 26%",
      isSpecial: true,
    };
  }

  // 3. Smoke 70% / Visión Nocturna Ultra Clara (Azul cielo cristalino translúcido)
  if (mat.includes("70")) {
    return {
      fill: "#38bdf8",
      opacity: secondLayerEnabled ? 0.65 : 0.32,
      border: "#0284c7",
      glow: "#38bdf8",
      label: "70% Claro",
    };
  }

  // 4. Supreme 42% / Claro Neutro
  if (mat.includes("42")) {
    return {
      fill: "#334155",
      opacity: secondLayerEnabled ? 0.80 : 0.55,
      border: "#64748b",
      glow: "#94a3b8",
      label: "42% Cerámico",
    };
  }

  // 5. Medios: 35%, 30%, 28%, 25% (Ahumado medio / grafito)
  if (mat.includes("35") || mat.includes("30") || mat.includes("28") || mat.includes("25")) {
    return {
      fill: "#0f172a",
      opacity: secondLayerEnabled ? 0.92 : 0.68,
      border: "#475569",
      glow: "#64748b",
      label: mat.includes("35") ? "35% Medio" : mat.includes("30") ? "30% Supreme" : "28% Quantum",
    };
  }

  // 6. Oscuro 05%, 04%, 06%, 07% (Limo Black / Azabache Profundo)
  if (mat.includes("05") || mat.includes("04") || mat.includes("06") || mat.includes("07")) {
    return {
      fill: "#020617",
      opacity: 0.96,
      border: "#090d16",
      glow: "#1e293b",
      label: "5% Oscuro Limo",
    };
  }

  // 7. Oscuro Intermedio: 10%, 12%, 14%, 15%, 16%, 19%, 20%, 22% (Estándar Oscuro 20%)
  return {
    fill: "#050914",
    opacity: secondLayerEnabled ? 0.95 : 0.82,
    border: "#1e293b",
    glow: "#334155",
    label: mat.includes("10") ? "10% Oscuro" : mat.includes("15") ? "15% Supreme" : "20% Intermedio",
  };
}

// Mapeo de siluetas laterales de vehículos en alta definición
export const LATERAL_VEHICLE_IMAGES = {
  sedan: "/vehicles/thumbnails/sedan.png",
  suv: "/vehicles/thumbnails/suv.png",
  suv_crossover: "/vehicles/thumbnails/suv.png",
  camioneta_doble_cabina: "/vehicles/thumbnails/camioneta-doble-cabina.png",
  camioneta_cabina_media: "/vehicles/thumbnails/camioneta-cabina-y-media.png",
  camioneta_cabina_sencilla: "/vehicles/thumbnails/camioneta-1-cabina.png",
  camioneta_1_cabina: "/vehicles/thumbnails/camioneta-1-cabina.png",
  microbus_pasajeros: "/vehicles/thumbnails/microbus-pasajeros.png",
  microbus_carga: "/vehicles/thumbnails/microbus-carga.png",
  microbus_techo_alto: "/vehicles/thumbnails/microbus-pasajeros.png",
  camion_1_cabina: "/vehicles/thumbnails/camion-carga.png",
  camion_2_cabinas: "/vehicles/thumbnails/camion-carga.png",
  camion_carga_furgon: "/vehicles/thumbnails/camion-carga.png",
  station_wagon: "/vehicles/thumbnails/station-wagon.png",
  hatchback: "/vehicles/thumbnails/hatchback.png",
  convertible: "/vehicles/thumbnails/convertible.png",
  bus_mediano_coaster: "/vehicles/thumbnails/microbus-pasajeros.png",
  bus_grande_marcopolo: "/vehicles/thumbnails/cabezal.png",
};

export default function TintWindowMaterialDialog({
  isOpen,
  onClose,
  vehicle,
  initialPlan,
  onApplyPlan,
  salePrice = 0,
}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(null);
  const [activeZone, setActiveZone] = useState("windshield");
  const [linkSides, setLinkSides] = useState(true);
  const [viewMode, setViewMode] = useState("lateral"); // "lateral" | "top"
  const [orientation, setOrientation] = useState("horizontal"); // "horizontal" | "vertical"
  const [selectedGama, setSelectedGama] = useState("all");
  const [familyFilter, setFamilyFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

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
    windshield: { enabled: false, material_id: "sg_charcoal_20" },
    front_sides: { enabled: false, material_id: "sg_charcoal_20" },
    rear_sides: { enabled: false, material_id: "sg_charcoal_20" },
    rear: { enabled: false, material_id: "sg_charcoal_20" },
  });

  // Bandas de Sol (Sunstrips)
  const [sunstrips, setSunstrips] = useState({
    windshield_top: { enabled: false, material_id: "std_20" },
    windshield_bottom: { enabled: false, material_id: "std_20" },
    rear_top: { enabled: false, material_id: "std_20" },
    rear_bottom: { enabled: false, material_id: "std_20" },
  });

  // Opción de Empalme 2x20 en Parabrisas Trasero
  const [empalmeRear, setEmpalmeRear] = useState(false);
  const [empalmeAuthorized, setEmpalmeAuthorized] = useState(false);

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
                material_id: initialPlan.windows[z]?.second_layer?.material_id || "sg_charcoal_20",
              };
            } else {
              secs[z] = { enabled: false, material_id: "sg_charcoal_20" };
            }
          });
          setSelectedMaterials(mats);
          setOverrideFlags(ovs);
          setSecondLayers((prev) => ({ ...prev, ...secs }));

          if (initialPlan.windows.rear?.empalme_2x20) {
            setEmpalmeRear(true);
            setEmpalmeAuthorized(true);
          }

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
          setEmpalmeRear(false);
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
            empalme_2x20: empalmeRear,
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
  }, [isOpen, config, selectedMaterials, secondLayers, sunstrips, overrideFlags, linkSides, empalmeRear, vehicle]);

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
      const current = prev[zone] || { material_id: "sg_charcoal_20" };
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

  // Manejar switch de empalme 2x20 con autorización de Responsable
  const handleToggleEmpalme = (checked) => {
    if (checked) {
      const isAuthorizedRole = ["gerencia", "programador", "admin", "coordinador_polarizados", "supervisor"].includes(
        user?.role
      );
      if (!isAuthorizedRole) {
        toast.warning("El corte con empalme requiere autorización de la Responsable de Polarizados o Gerencia.");
      }
      setEmpalmeRear(true);
      setEmpalmeAuthorized(true);
      toast.info("Empalme activado: Se consumirán 2 pliegos de 20\" para el vidrio trasero.");
    } else {
      setEmpalmeRear(false);
      setEmpalmeAuthorized(false);
    }
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
            empalme_2x20: empalmeRear,
          },
        },
        sunstrips: sunstrips,
        has_empalme: quoteData.has_empalme,
        empalme_warning: quoteData.empalme_warning,
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

  // Filtrado de materiales por Gama Oficial, Familia y Búsqueda
  const filteredMaterials = useMemo(() => {
    return activeMaterials.filter((m) => {
      const matchGama = selectedGama === "all" || m.gama === selectedGama;
      const matchFamily = familyFilter === "all" || m.family === familyFilter;
      const matchSearch =
        !searchTerm.trim() ||
        m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.family?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.gama_label?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.tech_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.description?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchGama && matchFamily && matchSearch;
    });
  }, [activeMaterials, selectedGama, familyFilter, searchTerm]);

  const isVehicleHorizontal = orientation === "horizontal";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[98vw] sm:w-[96vw] max-w-6xl md:max-w-7xl max-h-[98dvh] h-[96dvh] md:h-[94vh] flex flex-col p-0 overflow-hidden bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl">
        {/* Encabezado Responsivo */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 px-3.5 py-2.5 sm:p-4 text-white shrink-0 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-blue-500/20 border border-blue-400/30 shrink-0">
                <Layers className="h-4 w-4 sm:h-5 sm:w-5 text-blue-300" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-xs sm:text-base md:text-lg font-bold text-white flex items-center gap-1.5 sm:gap-2 truncate">
                  <span>{vehicle ? `${vehicle.brand} ${vehicle.model} (${vehicle.year || "S/A"})` : "Seleccionador de Polarizados"}</span>
                  <Badge variant="outline" className="border-blue-400/40 text-blue-200 text-[9px] sm:text-[10px] uppercase font-mono px-1 py-0 shrink-0">
                    {VEHICLE_CATEGORIES.find((c) => c.id === selectedVehicleType)?.shortLabel || "Pick-Up"}
                  </Badge>
                </DialogTitle>
                <p className="hidden sm:block text-[11px] text-blue-200/90 truncate">
                  Bandas requeridas: {config?.vehicle_size_bands?.windshield || "Parabrisas >40\""} / {config?.vehicle_size_bands?.front_sides || "Laterales >20\""}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="hidden sm:block text-[10px] uppercase text-blue-300 font-mono">Recargo Total</span>
              <span className="text-sm sm:text-lg md:text-xl font-black text-white">
                +${quoteData?.materials_extra_total?.toFixed(2) || "0.00"}{" "}
                <span className="text-[10px] sm:text-xs font-medium text-blue-200">USD</span>
              </span>
            </div>
          </div>
        </div>

        {/* Cuerpo: Diagrama Interactivo de Auto Dinámico en Tamaño Grande + Selector de Material */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-0 overflow-y-auto min-h-0 flex-1">
          {/* Lado Izquierdo (5.5 cols en PC): Diagrama Interactivo Grande */}
          <div className="md:col-span-5 lg:col-span-6 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 p-2 sm:p-4 flex flex-col items-center justify-between bg-zinc-50/70 dark:bg-zinc-900/50 select-none space-y-2">
            {/* Header del Vehículo con Botones Rápidos de Categoría y Rotación */}
            <div className="w-full space-y-1.5 px-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] sm:text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider truncate flex items-center gap-1.5">
                  <Car className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  MODELO: {VEHICLE_CATEGORIES.find((c) => c.id === selectedVehicleType)?.label || "Camioneta Doble Cabina"}
                </span>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setOrientation((o) => (o === "horizontal" ? "vertical" : "horizontal"))}
                    className="h-6 px-1.5 text-[10px] bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 font-semibold"
                    title="Alternar orientación de la silueta"
                  >
                    <RotateCw className="h-3 w-3 mr-1 text-blue-600 dark:text-blue-400" />
                    {isVehicleHorizontal ? "Horizontal" : "Vertical"}
                  </Button>

                  <select
                    value={selectedVehicleType}
                    onChange={(e) => setSelectedVehicleType(e.target.value)}
                    className="text-[10px] sm:text-xs bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md px-1.5 py-0.5 text-zinc-700 dark:text-zinc-300 cursor-pointer max-w-[130px] truncate"
                  >
                    {VEHICLE_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Botones de Categorías Rápidas de Carrocería */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px] no-scrollbar">
                {[
                  { id: "sedan", label: "Sedán" },
                  { id: "suv_crossover", label: "SUV / 4x4" },
                  { id: "camioneta_doble_cabina", label: "Doble Cabina" },
                  { id: "camioneta_cabina_media", label: "Cabina y Media" },
                  { id: "camioneta_cabina_sencilla", label: "Camioneta 1 Cab." },
                ].map((cat) => {
                  const isSelected = selectedVehicleType === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedVehicleType(cat.id)}
                      className={`px-2 py-1 rounded-lg font-medium whitespace-nowrap transition-all flex-1 text-center ${
                        isSelected
                          ? "bg-blue-600 text-white font-bold shadow-xs ring-1 ring-blue-500"
                          : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Leyenda Interactiva y Táctil */}
            <div className="flex items-center justify-center gap-1 sm:gap-1.5 text-[9px] sm:text-[10px] w-full max-w-sm md:max-w-md font-semibold py-1 px-1 bg-zinc-100/90 dark:bg-zinc-800/70 rounded-xl border border-zinc-200 dark:border-zinc-700/60 shrink-0 shadow-inner">
              {ZONES.map((z) => {
                const isActive = activeZone === z.id;
                return (
                  <button
                    key={z.id}
                    type="button"
                    className={`flex-1 flex items-center justify-center gap-1 py-1 px-1 rounded-lg transition-all ${
                      isActive
                        ? `${z.activeBg} text-white font-bold shadow-sm ${z.ringColor} ring-1`
                        : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/50"
                    }`}
                    onClick={() => setActiveZone(z.id)}
                  >
                    <span className={`h-2 w-2 rounded-full ${isActive ? "bg-white" : z.dotColor} shrink-0`} />
                    <span className="truncate">{z.shortLabel}</span>
                  </button>
                );
              })}
            </div>

            {/* Selector de Modo de Vista: Lateral (Perfil Real) vs Superior (Planta) */}
            <div className="flex items-center justify-between w-full max-w-sm md:max-w-md gap-2 bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700/60 shadow-xs">
              <div className="flex items-center gap-1 flex-1">
                <button
                  type="button"
                  onClick={() => setViewMode("lateral")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg text-[10.5px] font-bold transition-all ${
                    viewMode === "lateral"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  }`}
                >
                  <span>🚗 Vista Lateral</span>
                  <span className="text-[8.5px] opacity-80">(Perfil Real)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("top")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg text-[10.5px] font-bold transition-all ${
                    viewMode === "top"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  }`}
                >
                  <span>🛸 Vista Superior</span>
                  <span className="text-[8.5px] opacity-80">(Planta)</span>
                </button>
              </div>

              {viewMode === "top" && (
                <button
                  type="button"
                  onClick={() => setOrientation((prev) => (prev === "horizontal" ? "vertical" : "horizontal"))}
                  className="flex items-center gap-1 px-2 py-1 text-[9.5px] font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-2xs hover:bg-zinc-50"
                  title="Cambiar orientación"
                >
                  <RotateCw className="h-2.5 w-2.5" />
                  <span>{orientation === "horizontal" ? "Vertical" : "Horizontal"}</span>
                </button>
              )}
            </div>

            {/* Canvas Grande del Vehículo con Sombras Hiper-Realistas */}
            <div
              className={`relative select-none flex items-center justify-center shrink-0 transition-all duration-300 overflow-hidden rounded-2xl bg-zinc-950/15 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800/80 my-auto shadow-inner ${
                viewMode === "lateral"
                  ? "w-full max-w-[380px] sm:max-w-[460px] md:max-w-[500px] h-[200px] sm:h-[240px] md:h-[280px]"
                  : isVehicleHorizontal
                  ? "w-full max-w-[360px] sm:max-w-[440px] md:max-w-[500px] h-[190px] sm:h-[220px] md:h-[270px]"
                  : "w-52 sm:w-64 md:w-80 h-[260px] sm:h-[320px] md:h-[420px]"
              }`}
            >
              {viewMode === "lateral" ? (
                /* ================= VISTA LATERAL (PERFIL REAL) ================= */
                <div className="relative w-full h-full max-w-[500px] aspect-[16/9] flex items-center justify-center p-2">
                  {/* Silueta Lateral Real del Vehículo */}
                  <img
                    src={LATERAL_VEHICLE_IMAGES[selectedVehicleType] || "/vehicles/thumbnails/camioneta-doble-cabina.png"}
                    alt="Silueta Lateral Vehículo"
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none drop-shadow-2xl transition-all duration-300"
                  />

                  {/* Capa SVG Interactiva para Ventanas Laterales */}
                  {(() => {
                    const shadeFrontSides = getRealisticTintShade(selectedMaterials.front_sides, secondLayers.front_sides?.enabled);
                    const shadeRearSides = getRealisticTintShade(selectedMaterials.rear_sides, secondLayers.rear_sides?.enabled);
                    const isSidesLinkedActive = linkSides && (activeZone === "front_sides" || activeZone === "rear_sides");
                    const isFrontSidesActive = activeZone === "front_sides" || isSidesLinkedActive;
                    const isRearSidesActive = activeZone === "rear_sides" || isSidesLinkedActive;

                    return (
                      <svg viewBox="0 0 640 360" className="absolute inset-0 w-full h-full select-none">
                        <defs>
                          <linearGradient id="camaleonGradientLateral" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#4338ca" stopOpacity="0.85" />
                            <stop offset="50%" stopColor="#7c3aed" stopOpacity="0.80" />
                            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.85" />
                          </linearGradient>
                          <filter id="neonGlowYellowLat" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#eab308" floodOpacity="0.95" />
                          </filter>
                          <filter id="neonGlowOrangeLat" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#f97316" floodOpacity="0.95" />
                          </filter>
                        </defs>

                        {/* Ventana Delantera Lateral */}
                        <path
                          d="M 236,136 L 310,136 L 310,198 L 212,198 Z"
                          fill={shadeFrontSides.fill === "url(#camaleonGradient)" ? "url(#camaleonGradientLateral)" : shadeFrontSides.fill}
                          fillOpacity={shadeFrontSides.opacity}
                          stroke={isFrontSidesActive ? "#eab308" : shadeFrontSides.border}
                          strokeWidth={isFrontSidesActive ? "3.5" : "1.5"}
                          filter={isFrontSidesActive ? "url(#neonGlowYellowLat)" : undefined}
                          className="cursor-pointer transition-all hover:opacity-90"
                          onClick={() => setActiveZone("front_sides")}
                        />

                        {/* Ventana Trasera Lateral */}
                        <path
                          d="M 316,136 L 382,136 L 376,198 L 316,198 Z"
                          fill={shadeRearSides.fill === "url(#camaleonGradient)" ? "url(#camaleonGradientLateral)" : shadeRearSides.fill}
                          fillOpacity={shadeRearSides.opacity}
                          stroke={isRearSidesActive ? "#f97316" : shadeRearSides.border}
                          strokeWidth={isRearSidesActive ? "3.5" : "1.5"}
                          filter={isRearSidesActive ? "url(#neonGlowOrangeLat)" : undefined}
                          className="cursor-pointer transition-all hover:opacity-90"
                          onClick={() => setActiveZone("rear_sides")}
                        />

                        {/* Etiquetas de Tonalidad en los Cristales */}
                        <text
                          x="260"
                          y="172"
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="10.5"
                          fontWeight="bold"
                          className="pointer-events-none select-none drop-shadow"
                        >
                          Del. {shadeFrontSides.label}
                        </text>
                        <text
                          x="346"
                          y="172"
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="10.5"
                          fontWeight="bold"
                          className="pointer-events-none select-none drop-shadow"
                        >
                          Tras. {shadeRearSides.label}
                        </text>
                      </svg>
                    );
                  })()}
                </div>
              ) : (
                /* ================= VISTA SUPERIOR (PLANTA) ================= */
                <div
                  className={`transition-all duration-300 shrink-0 ${
                    isVehicleHorizontal
                      ? "relative w-[210px] h-[380px] transform -rotate-90 origin-center scale-[0.88] sm:scale-[0.98] md:scale-[1.05]"
                      : "relative w-full h-full"
                  }`}
                >
                  {/* 1. Imagen Top-Down Realista de la Carrocería */}
                  <img
                    src={VEHICLE_CATEGORIES.find((c) => c.id === selectedVehicleType)?.image || "/vehicles/clean_camioneta_doble_cabina.png"}
                    alt="Vehículo Top-Down"
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none drop-shadow-xl transition-all duration-300"
                  />

                  {/* 2. Capa SVG Interactiva con Shaders Hiper-Realistas */}
                  {(() => {
                    const geom =
                      VEHICLE_GLASS_GEOMETRY[selectedVehicleType] ||
                      VEHICLE_GLASS_GEOMETRY.camioneta_doble_cabina ||
                      VEHICLE_GLASS_GEOMETRY.sedan;

                    const shadeWindshield = getRealisticTintShade(selectedMaterials.windshield, secondLayers.windshield?.enabled);
                    const shadeFrontSides = getRealisticTintShade(selectedMaterials.front_sides, secondLayers.front_sides?.enabled);
                    const shadeRearSides = getRealisticTintShade(selectedMaterials.rear_sides, secondLayers.rear_sides?.enabled);
                    const shadeRear = getRealisticTintShade(selectedMaterials.rear, secondLayers.rear?.enabled);

                    const textRotation = isVehicleHorizontal ? "rotate(90 100 " : null;

                    const isSidesLinkedActive = linkSides && (activeZone === "front_sides" || activeZone === "rear_sides");
                    const isFrontSidesActive = activeZone === "front_sides" || isSidesLinkedActive;
                    const isRearSidesActive = activeZone === "rear_sides" || isSidesLinkedActive;

                    return (
                      <svg viewBox="0 0 200 360" className="absolute inset-0 w-full h-full select-none">
                        <defs>
                          {/* Gradiente Tornasol para Camaleón 20% */}
                          <linearGradient id="camaleonGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#4338ca" stopOpacity="0.85" />
                            <stop offset="50%" stopColor="#7c3aed" stopOpacity="0.80" />
                            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.85" />
                          </linearGradient>

                          {/* Filtros de Neón para Zona Activa */}
                          <filter id="neonGlowActive" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#38bdf8" floodOpacity="0.95" />
                          </filter>
                          <filter id="neonGlowYellow" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#eab308" floodOpacity="0.95" />
                          </filter>
                          <filter id="neonGlowOrange" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#f97316" floodOpacity="0.95" />
                          </filter>
                          <filter id="neonGlowPurple" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#a855f7" floodOpacity="0.95" />
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

                        {/* Bandas de Sol Parabrisas */}
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

                        <text
                          x="100"
                          y={geom.windshield.textY}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="7.5"
                          fontWeight="bold"
                          transform={textRotation ? `${textRotation}${geom.windshield.textY})` : undefined}
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
                          transform={textRotation ? `${textRotation}${geom.windshield.subY})` : undefined}
                          className="pointer-events-none select-none"
                        >
                          {shadeWindshield.label}
                          {secondLayers.windshield?.enabled ? " + 2da" : ""}
                        </text>

                        {/* 2. VENTANAS DELANTERAS */}
                        {geom.front_sides.map((p, idx) => (
                          <path
                            key={`fs-${idx}`}
                            d={p.d}
                            fill={shadeFrontSides.fill}
                            fillOpacity={shadeFrontSides.opacity}
                            stroke={isFrontSidesActive ? "#eab308" : shadeFrontSides.border}
                            strokeWidth={isFrontSidesActive ? "3.5" : "1.5"}
                            filter={isFrontSidesActive ? "url(#neonGlowYellow)" : undefined}
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
                            stroke={
                              isSidesLinkedActive
                                ? "#eab308"
                                : activeZone === "rear_sides"
                                ? "#f97316"
                                : shadeRearSides.border
                            }
                            strokeWidth={isRearSidesActive ? "3.5" : "1.5"}
                            filter={
                              isSidesLinkedActive
                                ? "url(#neonGlowYellow)"
                                : activeZone === "rear_sides"
                                ? "url(#neonGlowOrange)"
                                : undefined
                            }
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

                        {/* Línea visual de empalme horizontal si está activo */}
                        {empalmeRear && (
                          <line
                            x1="70"
                            y1={geom.rear.textY}
                            x2="130"
                            y2={geom.rear.textY}
                            stroke="#f59e0b"
                            strokeWidth="1"
                            strokeDasharray="2,2"
                            className="pointer-events-none"
                          />
                        )}

                        <text
                          x="100"
                          y={geom.rear.textY}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="7.5"
                          fontWeight="bold"
                          transform={textRotation ? `${textRotation}${geom.rear.textY})` : undefined}
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
                          transform={textRotation ? `${textRotation}${geom.rear.subY})` : undefined}
                          className="pointer-events-none select-none"
                        >
                          {empalmeRear ? "Empalme 2x20\"" : shadeRear.label}
                          {secondLayers.rear?.enabled ? " + 2da" : ""}
                        </text>
                      </svg>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Lado Derecho (6.5 cols en PC): Selector de Gamas y Materiales */}
          <div className="md:col-span-7 lg:col-span-6 p-2.5 sm:p-4 lg:p-5 flex flex-col justify-between space-y-2.5 overflow-y-auto">
            <div>
              {/* Barra de Control de la Zona Activa */}
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

              {/* Controles Rápidos: Vincular Laterales, Doble Capa, Empalme 2x20 y Bandas de Sol */}
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

                {/* Opción de Empalme 2x20 en Parabrisas Trasero */}
                {activeZone === "rear" && (
                  <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 rounded-lg px-2 py-1">
                    <Scissors className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                    <span className="text-[10px] sm:text-[11px] font-bold text-amber-950 dark:text-amber-200">
                      Empalme 2x20" (Corte Horizontal)
                    </span>
                    <Switch
                      checked={empalmeRear}
                      onCheckedChange={handleToggleEmpalme}
                      className="scale-75"
                    />
                  </div>
                )}

                {/* Toggle de 2da Capa */}
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

                {/* Bandas Superior e Inferior para Parabrisas */}
                {(activeZone === "windshield" || activeZone === "rear") && (
                  <>
                    <div className="flex items-center gap-1.5 bg-sky-50/90 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 rounded-lg px-2 py-1">
                      <Sun className="h-3 w-3 text-sky-600 dark:text-sky-400" />
                      <span className="text-[10px] sm:text-[11px] font-semibold text-sky-900 dark:text-sky-200">
                        Banda Superior
                      </span>
                      <Switch
                        checked={Boolean(sunstrips[`${activeZone}_top`]?.enabled)}
                        onCheckedChange={(checked) => handleToggleSunstrip(`${activeZone}_top`, checked)}
                        className="scale-75"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 bg-sky-50/90 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 rounded-lg px-2 py-1">
                      <Sun className="h-3 w-3 text-sky-600 dark:text-sky-400" />
                      <span className="text-[10px] sm:text-[11px] font-semibold text-sky-900 dark:text-sky-200">
                        Banda Inferior
                      </span>
                      <Switch
                        checked={Boolean(sunstrips[`${activeZone}_bottom`]?.enabled)}
                        onCheckedChange={(checked) => handleToggleSunstrip(`${activeZone}_bottom`, checked)}
                        className="scale-75"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Selector de Material 2da Capa */}
              {secondLayers[activeZone]?.enabled && (
                <div className="mb-2 p-2 rounded-lg bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-center justify-between gap-2">
                  <Label className="text-[10px] sm:text-[11px] font-bold text-amber-900 dark:text-amber-200">
                    Material 2da Capa:
                  </Label>
                  <select
                    value={secondLayers[activeZone]?.material_id || "sg_charcoal_20"}
                    onChange={(e) => handleSelectSecondLayerMaterial(activeZone, e.target.value)}
                    className="text-[11px] rounded-md border border-amber-300 dark:border-amber-800 bg-white dark:bg-zinc-900 px-2 py-1 text-zinc-900 dark:text-white font-medium"
                  >
                    {activeMaterials.map((m) => (
                      <option key={m.material_id} value={m.material_id}>
                        {m.name} ({m.price_extra_usd > 0 ? `+$${m.price_extra_usd.toFixed(2)} USD` : "Estándar"})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* LAS 4 GAMAS OFICIALES */}
              <div className="mb-2.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                    Gamas de Polarizados:
                  </span>
                  {selectedGama !== "all" && (
                    <button
                      type="button"
                      onClick={() => setSelectedGama("all")}
                      className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                    >
                      Ver todas las gamas
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {OFFICIAL_GAMAS.map((gama) => {
                    const isSelected = selectedGama === gama.id;
                    const IconComp = gama.icon;
                    return (
                      <button
                        key={gama.id}
                        type="button"
                        onClick={() => setSelectedGama(isSelected ? "all" : gama.id)}
                        className={`flex flex-col items-start p-2 rounded-xl border text-left transition-all relative overflow-hidden ${
                          isSelected
                            ? `${gama.borderColor} bg-blue-50/90 dark:bg-zinc-800/90 ring-2 ring-blue-500 shadow-md font-bold`
                            : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-700"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full gap-1">
                          <span className="text-[10.5px] sm:text-[11.5px] font-bold text-zinc-900 dark:text-white flex items-center gap-1.5 truncate">
                            <span className={`h-2.5 w-2.5 rounded-full ${gama.dotColor} shrink-0`} />
                            {gama.name}
                          </span>
                          {isSelected && (
                            <Badge className="bg-blue-600 text-white text-[8px] px-1 py-0 font-mono shrink-0">
                              Activo
                            </Badge>
                          )}
                        </div>
                        <span className="text-[9px] text-muted-foreground truncate w-full mt-0.5">
                          {gama.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Búsqueda Rápida */}
              <div className="space-y-1.5 mb-2">
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <Search className="h-3 w-3 absolute left-2 top-2 text-zinc-400" />
                    <Input
                      type="text"
                      placeholder={'Buscar tono, medida o tecnología (ej. 5%, 20%, 40", Supreme)...'}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-7 text-[10px] pl-6 pr-2 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                    />
                  </div>
                  {searchTerm && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSearchTerm("")}
                      className="h-7 px-1.5 text-[10px]"
                    >
                      Limpiar
                    </Button>
                  )}
                </div>
              </div>

              {/* Lista de Films / Materiales */}
              <div className="space-y-1.5 max-h-52 sm:max-h-60 lg:max-h-72 overflow-y-auto pr-1">
                {filteredMaterials.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700">
                    No hay materiales que coincidan con los filtros seleccionados.
                  </div>
                ) : null}

                {filteredMaterials.map((mat) => {
                  const isSelected = selectedMaterials[activeZone] === mat.material_id;
                  const is3M = mat.brand === "3M" || String(mat.id).includes("3m") || String(mat.family).includes("3M");
                  const isSolarGard = mat.brand === "Solar Gard" || (!is3M && mat.brand !== "Q1" && mat.brand !== "Raybar");
                  const isRaybar = mat.brand === "Raybar" || String(mat.id).includes("raybar");
                  const isQ1 = mat.brand === "Q1" || String(mat.id).includes("q1");

                  const matchedGama = OFFICIAL_GAMAS.find((g) => g.id === mat.gama);

                  return (
                    <div
                      key={mat.material_id}
                      onClick={() => handleSelectMaterial(activeZone, mat.material_id)}
                      className={`relative flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all gap-2 overflow-hidden ${
                        isSelected
                          ? "border-blue-600 bg-blue-50/75 dark:bg-blue-950/60 dark:border-blue-500 shadow-sm ring-1 ring-blue-500/40 font-bold"
                          : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900/50"
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0 z-10 flex-1">
                        <div
                          className={`h-4 w-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                            isSelected
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-zinc-400 bg-transparent"
                          }`}
                        >
                          {isSelected && <Check className="h-2.5 w-2.5" />}
                        </div>

                        <div className="min-w-0 space-y-1 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] sm:text-xs text-zinc-900 dark:text-white font-bold truncate">
                              {mat.name}
                            </span>

                            {matchedGama && (
                              <Badge variant="outline" className={`text-[8.5px] px-1.5 py-0 font-mono shrink-0 ${matchedGama.tierPill}`}>
                                {matchedGama.shortName}
                              </Badge>
                            )}

                            {mat.tech_type && (
                              <Badge variant="outline" className="text-[8.5px] px-1.5 py-0 font-mono text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700 shrink-0">
                                {mat.tech_type}
                              </Badge>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-1 text-[9px]">
                            {mat.ir_rejection_pct ? (
                              <span className="inline-flex items-center gap-0.5 px-1 py-0 rounded bg-red-500/15 text-red-700 dark:text-red-300 font-mono font-bold">
                                <Flame className="h-2.5 w-2.5 text-red-500" /> {mat.ir_rejection_pct}% IR
                              </span>
                            ) : null}
                            <span className="inline-flex items-center gap-0.5 px-1 py-0 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-mono font-semibold">
                              ☀️ {mat.uv_rejection_pct || 99}% UV
                            </span>
                            <span className="inline-flex items-center gap-0.5 px-1 py-0 rounded bg-blue-500/15 text-blue-700 dark:text-blue-300 font-mono font-semibold">
                              {mat.vlt}% VLT
                            </span>
                            <span className="inline-flex items-center gap-0.5 px-1 py-0 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-mono">
                              <ShieldCheck className="h-2.5 w-2.5 text-emerald-500" /> 5a Gar.
                            </span>
                          </div>

                          {mat.description && (
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 line-clamp-1">
                              {mat.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-1 sm:pt-0 border-zinc-100 dark:border-zinc-800 shrink-0 z-10 space-y-1 min-w-[90px]">
                        <div className="flex items-center gap-1 shrink-0">
                          {is3M ? (
                            <img
                              src="/brands/3m.png"
                              alt="3M"
                              className="h-4 sm:h-5 max-w-[60px] object-contain drop-shadow-sm"
                            />
                          ) : isSolarGard ? (
                            <img
                              src="/brands/solargard.png"
                              alt="Solar Gard"
                              className="h-4 sm:h-5 max-w-[70px] object-contain drop-shadow-sm"
                            />
                          ) : isRaybar ? (
                            <span className="text-[9px] font-bold font-mono text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900">
                              RAYBAR
                            </span>
                          ) : isQ1 ? (
                            <span className="text-[9px] font-bold font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-900">
                              Q1
                            </span>
                          ) : null}
                        </div>

                        <span
                          className={`text-xs ${
                            mat.price_extra_usd > 0
                              ? "text-emerald-600 dark:text-emerald-400 font-mono font-black text-xs sm:text-sm"
                              : "text-zinc-500 font-medium text-[11px]"
                          }`}
                        >
                          {mat.price_extra_usd > 0
                            ? `+$${mat.price_extra_usd.toFixed(2)} USD`
                            : "Incluido"}
                        </span>
                        <span className="text-[9px] text-muted-foreground font-mono">
                          Stock: {mat.virtual_qty} u
                        </span>
                      </div>

                      {/* Marca de agua sutil de la marca en la esquina inferior */}
                      {is3M && (
                        <img
                          src="/brands/3m.png"
                          alt=""
                          className="absolute -right-2 -bottom-2 h-12 opacity-5 dark:opacity-10 pointer-events-none object-contain select-none"
                        />
                      )}
                      {isSolarGard && (
                        <img
                          src="/brands/solargard.png"
                          alt=""
                          className="absolute -right-2 -bottom-2 h-14 opacity-5 dark:opacity-10 pointer-events-none object-contain select-none"
                        />
                      )}
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
                {quoteData?.has_empalme && (
                  <div className="text-amber-600 dark:text-amber-400 font-bold text-[9.5px] pt-0.5">
                    {quoteData.empalme_warning}
                  </div>
                )}
                {(!quoteData?.price_breakdown || quoteData.price_breakdown.length === 0) && (
                  <div className="text-zinc-500 italic">Sin recargos adicionales (Films Estándar / Económicos).</div>
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
