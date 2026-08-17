import React, { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Car,
  Layers,
  Sparkles,
  Check,
  AlertCircle,
  ShieldCheck,
  ChevronRight,
  Info,
} from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

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
  const [allowOverride, setAllowOverride] = useState(true);
  const [activeZone, setActiveZone] = useState("windshield");

  // Estado del plan por zona
  const [selectedMaterials, setSelectedMaterials] = useState({
    windshield: "std_20",
    front_sides: "std_20",
    rear_sides: "std_20",
    rear: "std_20",
  });

  const [overrideFlags, setOverrideFlags] = useState({
    windshield: false,
    front_sides: false,
    rear_sides: false,
    rear: false,
  });

  const [quoteData, setQuoteData] = useState(null);

  // Cargar configuración de materiales y tallas de cristal para el vehículo
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

        // Si hay plan previo, restaurarlo
        if (initialPlan?.windows) {
          const mats = {};
          const ovs = {};
          Object.keys(initialPlan.windows).forEach((z) => {
            mats[z] = initialPlan.windows[z]?.material_id || "std_20";
            ovs[z] = Boolean(initialPlan.windows[z]?.override_size_band);
          });
          setSelectedMaterials(mats);
          setOverrideFlags(ovs);
        } else {
          // Defaults: estándar 70% parabrisas/laterales del., 55%/20% traseros
          setSelectedMaterials({
            windshield: "std_70",
            front_sides: "std_70",
            rear_sides: "std_20",
            rear: "std_20",
          });
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

  // Cotizar plan en tiempo real cada vez que cambia un material
  useEffect(() => {
    if (!isOpen || !config) return;

    const computeQuote = async () => {
      const planPayload = {
        vehicle_id: vehicle?.vehicle_id || vehicle?.id || null,
        windows: {
          windshield: {
            material_id: selectedMaterials.windshield,
            override_size_band: overrideFlags.windshield,
          },
          front_sides: {
            material_id: selectedMaterials.front_sides,
            override_size_band: overrideFlags.front_sides,
          },
          rear_sides: {
            material_id: selectedMaterials.rear_sides,
            override_size_band: overrideFlags.rear_sides,
          },
          rear: {
            material_id: selectedMaterials.rear,
            override_size_band: overrideFlags.rear,
          },
        },
      };

      try {
        const res = await axios.post("/api/tint/window-plan/quote", planPayload);
        setQuoteData(res.data);
      } catch (err) {
        console.warn("Quote error", err?.response?.data);
      }
    };

    computeQuote();
  }, [isOpen, config, selectedMaterials, overrideFlags, vehicle]);

  // Manejar selección de material (laterales comparten material automáticamente)
  const handleSelectMaterial = (zone, materialId) => {
    setSelectedMaterials((prev) => {
      if (zone === "front_sides" || zone === "rear_sides") {
        return { ...prev, front_sides: materialId, rear_sides: materialId };
      }
      return { ...prev, [zone]: materialId };
    });
  };

  const handleApply = () => {
    if (!quoteData?.valid) {
      toast.error(quoteData?.error || "Plan de polarizado incompleto o inválido");
      return;
    }

    onApplyPlan({
      tint_window_plan: {
        windows: {
          windshield: {
            material_id: selectedMaterials.windshield,
            material_name: quoteData.rolls_consumed.find((r) => r.zone === "windshield")?.material_name,
            size_band: quoteData.vehicle_size_bands?.windshield,
            override_size_band: overrideFlags.windshield,
          },
          front_sides: {
            material_id: selectedMaterials.front_sides,
            material_name: quoteData.rolls_consumed.find((r) => r.zone === "front_sides")?.material_name,
            size_band: quoteData.vehicle_size_bands?.front_sides,
            override_size_band: overrideFlags.front_sides,
          },
          rear_sides: {
            material_id: selectedMaterials.rear_sides,
            material_name: quoteData.rolls_consumed.find((r) => r.zone === "rear_sides")?.material_name,
            size_band: quoteData.vehicle_size_bands?.rear_sides,
            override_size_band: overrideFlags.rear_sides,
          },
          rear: {
            material_id: selectedMaterials.rear,
            material_name: quoteData.rolls_consumed.find((r) => r.zone === "rear")?.material_name,
            size_band: quoteData.vehicle_size_bands?.rear,
            override_size_band: overrideFlags.rear,
          },
        },
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
        {/* Encabezado */}
        <div className="bg-gradient-to-r from-blue-900/90 via-indigo-900/80 to-blue-950 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 border border-blue-400/30">
                <Layers className="h-5 w-5 text-blue-300" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                  Seleccionador de Materiales de Polarizado
                  <Badge variant="outline" className="border-blue-400/40 text-blue-200 text-[10px] uppercase font-mono">
                    MVP Taller
                  </Badge>
                </DialogTitle>
                <p className="text-xs text-blue-200/80">
                  {vehicle ? `${vehicle.brand} ${vehicle.model} (${vehicle.year || "S/A"})` : "Vehículo General"} ·{" "}
                  Bandas: {config?.vehicle_size_bands?.windshield || "≤40\""} / {config?.vehicle_size_bands?.front_sides || "≤20\""}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase text-blue-300 font-mono block">Recargo Material</span>
              <span className="text-xl font-bold text-white">
                +${quoteData?.materials_extra_total?.toFixed(2) || "0.00"}{" "}
                <span className="text-xs font-normal text-blue-200">USD</span>
              </span>
            </div>
          </div>
        </div>

        {/* Cuerpo: Diagrama Interactivo de Auto AZUL + Selector de Material */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-0">
          {/* Lado Izquierdo (5 cols): Diagrama Vectorial con Carrocería AZUL */}
          <div className="md:col-span-5 border-r border-zinc-200 dark:border-zinc-800 p-6 flex flex-col items-center justify-center bg-zinc-50/50 dark:bg-zinc-900/30">
            <div className="text-center mb-3">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block">
                Vista Superior del Vehículo
              </span>
              <span className="text-[11px] text-muted-foreground">
                Toca cualquier cristal para configurar su material
              </span>
            </div>

            {/* SVG Diagram: Carrocería AZUL METÁLICO (#2563eb / #1d4ed8) */}
            <div className="relative w-48 h-80 select-none">
              <svg viewBox="0 0 200 360" className="w-full h-full drop-shadow-xl">
                {/* Sombras / Ruedas */}
                <rect x="18" y="55" width="14" height="42" rx="6" fill="#0f172a" />
                <rect x="168" y="55" width="14" height="42" rx="6" fill="#0f172a" />
                <rect x="18" y="245" width="14" height="42" rx="6" fill="#0f172a" />
                <rect x="168" y="245" width="14" height="42" rx="6" fill="#0f172a" />

                {/* Espejos Retrovisores */}
                <ellipse cx="25" cy="115" rx="8" ry="12" fill="#1e3a8a" stroke="#1d4ed8" strokeWidth="1.5" />
                <ellipse cx="175" cy="115" rx="8" ry="12" fill="#1e3a8a" stroke="#1d4ed8" strokeWidth="1.5" />

                {/* CARROCERÍA AZUL (Cambiada de verde a azul elegante) */}
                <path
                  d="M40,65 C40,25 70,15 100,15 C130,15 160,25 160,65 L165,130 C168,170 168,230 165,280 C160,330 130,345 100,345 C70,345 40,330 35,280 C32,230 32,170 35,130 Z"
                  fill="url(#blueCarGradient)"
                  stroke="#1e40af"
                  strokeWidth="2.5"
                />

                {/* Capó / Techo líneas decorativas */}
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
                  {/* Gradiente Parabrisas (Azul Cielo) */}
                  <linearGradient id="glassWindshield" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#0284c7" stopOpacity="0.9" />
                  </linearGradient>
                  {/* Gradiente Laterales Delanteros (Amarillo / Ambar) */}
                  <linearGradient id="glassFrontSides" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#fde047" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#eab308" stopOpacity="0.9" />
                  </linearGradient>
                  {/* Gradiente Laterales Traseros (Naranja) */}
                  <linearGradient id="glassRearSides" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#fb923c" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#f97316" stopOpacity="0.9" />
                  </linearGradient>
                  {/* Gradiente Traseros (Morado / Violeta) */}
                  <linearGradient id="glassRear" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#c084fc" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#9333ea" stopOpacity="0.9" />
                  </linearGradient>
                </defs>

                {/* 1. PARABRISAS (Windshield) */}
                <path
                  d="M56,80 L144,80 L136,130 L64,130 Z"
                  fill="url(#glassWindshield)"
                  stroke={activeZone === "windshield" ? "#ffffff" : "#0369a1"}
                  strokeWidth={activeZone === "windshield" ? "3" : "1.5"}
                  className="cursor-pointer transition-all hover:opacity-90"
                  onClick={() => setActiveZone("windshield")}
                />
                <text x="100" y="105" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold" className="pointer-events-none select-none drop-shadow">
                  Parabrisas
                </text>
                <text x="100" y="118" textAnchor="middle" fill="#e0f2fe" fontSize="8" fontWeight="600" className="pointer-events-none select-none">
                  {selectedMaterials.windshield?.includes("70") ? "70%" : selectedMaterials.windshield?.includes("35") ? "35%" : "20%"}
                </text>

                {/* 2. LATERALES DELANTEROS (Front Sides) */}
                {/* Izquierdo */}
                <path
                  d="M48,135 L62,135 L60,190 L46,190 Z"
                  fill="url(#glassFrontSides)"
                  stroke={activeZone === "front_sides" ? "#ffffff" : "#ca8a04"}
                  strokeWidth={activeZone === "front_sides" ? "3" : "1.5"}
                  className="cursor-pointer transition-all hover:opacity-90"
                  onClick={() => setActiveZone("front_sides")}
                />
                {/* Derecho */}
                <path
                  d="M138,135 L152,135 L154,190 L140,190 Z"
                  fill="url(#glassFrontSides)"
                  stroke={activeZone === "front_sides" ? "#ffffff" : "#ca8a04"}
                  strokeWidth={activeZone === "front_sides" ? "3" : "1.5"}
                  className="cursor-pointer transition-all hover:opacity-90"
                  onClick={() => setActiveZone("front_sides")}
                />

                {/* 3. LATERALES TRASEROS (Rear Sides) */}
                {/* Izquierdo */}
                <path
                  d="M46,195 L60,195 L58,245 L44,245 Z"
                  fill="url(#glassRearSides)"
                  stroke={activeZone === "rear_sides" ? "#ffffff" : "#ea580c"}
                  strokeWidth={activeZone === "rear_sides" ? "3" : "1.5"}
                  className="cursor-pointer transition-all hover:opacity-90"
                  onClick={() => setActiveZone("rear_sides")}
                />
                {/* Derecho */}
                <path
                  d="M140,195 L154,195 L156,245 L142,245 Z"
                  fill="url(#glassRearSides)"
                  stroke={activeZone === "rear_sides" ? "#ffffff" : "#ea580c"}
                  strokeWidth={activeZone === "rear_sides" ? "3" : "1.5"}
                  className="cursor-pointer transition-all hover:opacity-90"
                  onClick={() => setActiveZone("rear_sides")}
                />

                {/* 4. TRASERO / MEDALLÓN (Rear) */}
                <path
                  d="M66,252 L134,252 L128,290 L72,290 Z"
                  fill="url(#glassRear)"
                  stroke={activeZone === "rear" ? "#ffffff" : "#7e22ce"}
                  strokeWidth={activeZone === "rear" ? "3" : "1.5"}
                  className="cursor-pointer transition-all hover:opacity-90"
                  onClick={() => setActiveZone("rear")}
                />
                <text x="100" y="272" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold" className="pointer-events-none select-none drop-shadow">
                  Traseros
                </text>
                <text x="100" y="284" textAnchor="middle" fill="#f3e8ff" fontSize="8" fontWeight="600" className="pointer-events-none select-none">
                  {selectedMaterials.rear?.includes("70") ? "70%" : selectedMaterials.rear?.includes("35") ? "35%" : "20%"}
                </text>
              </svg>
            </div>

            {/* Leyenda de Colores */}
            <div className="mt-3 grid grid-cols-2 gap-1.5 text-[10px] w-full max-w-xs font-medium">
              <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => setActiveZone("windshield")}>
                <span className="h-2.5 w-2.5 rounded-full bg-sky-400 ring-1 ring-sky-600" />
                <span className="text-zinc-600 dark:text-zinc-400">Parabrisas</span>
              </div>
              <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => setActiveZone("front_sides")}>
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-400 ring-1 ring-yellow-600" />
                <span className="text-zinc-600 dark:text-zinc-400">Lat. Delanteros</span>
              </div>
              <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => setActiveZone("rear_sides")}>
                <span className="h-2.5 w-2.5 rounded-full bg-orange-400 ring-1 ring-orange-600" />
                <span className="text-zinc-600 dark:text-zinc-400">Lat. Traseros</span>
              </div>
              <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => setActiveZone("rear")}>
                <span className="h-2.5 w-2.5 rounded-full bg-purple-400 ring-1 ring-purple-600" />
                <span className="text-zinc-600 dark:text-zinc-400">Medallón Trasero</span>
              </div>
            </div>
          </div>

          {/* Lado Derecho (7 cols): Selección de Material para la Zona Activa */}
          <div className="md:col-span-7 p-6 flex flex-col justify-between space-y-4">
            <div>
              {/* Selector de Pestañas de Zona */}
              <div className="flex flex-wrap gap-1.5 border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-4">
                {[
                  { id: "windshield", label: "Parabrisas", badgeColor: "bg-sky-500/10 text-sky-600" },
                  { id: "front_sides", label: "Lat. Delanteros", badgeColor: "bg-yellow-500/10 text-yellow-600" },
                  { id: "rear_sides", label: "Lat. Traseros", badgeColor: "bg-orange-500/10 text-orange-600" },
                  { id: "rear", label: "Traseros", badgeColor: "bg-purple-500/10 text-purple-600" },
                ].map((z) => (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => setActiveZone(z.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeZone === z.id
                        ? "bg-primary text-white shadow-sm"
                        : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {z.label}
                  </button>
                ))}
              </div>

              {/* Título de la Zona Activa y Banda */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-white capitalize">
                    {activeZone === "windshield"
                      ? "Parabrisas Frontal"
                      : activeZone === "front_sides"
                      ? "Laterales Delanteros (Conductor + Copiloto)"
                      : activeZone === "rear_sides"
                      ? "Laterales Traseros (Pasajeros)"
                      : "Medallón / Cristal Trasero"}
                  </h4>
                  <span className="text-[11px] text-muted-foreground">
                    Talla requerida de rollo:{" "}
                    <strong className="text-zinc-800 dark:text-zinc-200 font-mono">
                      {activeZoneConfig?.size_band_info?.name || "Estándar"}
                    </strong>
                  </span>
                </div>

                {(activeZone === "front_sides" || activeZone === "rear_sides") && (
                  <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30">
                    Laterales comparten film
                  </Badge>
                )}
              </div>

              {/* Lista de Films / Materiales Disponibles */}
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {activeMaterials.map((mat) => {
                  const isSelected = selectedMaterials[activeZone] === mat.material_id;
                  return (
                    <div
                      key={mat.material_id}
                      onClick={() => handleSelectMaterial(activeZone, mat.material_id)}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 dark:border-blue-500 shadow-sm"
                          : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-5 w-5 rounded-full border flex items-center justify-center ${
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
                            <Badge
                              variant="secondary"
                              className="text-[9px] px-1.5 py-0 font-mono"
                            >
                              {mat.family}
                            </Badge>
                            {mat.is_override && (
                              <Badge className="text-[9px] px-1.5 py-0 bg-purple-600 text-white">
                                Rollo Mayor
                              </Badge>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            SKU: {mat.sku} · Stock Virtual: {mat.virtual_qty} u
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
            </div>

            {/* Resumen del Plan y Desglose */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/50 text-xs">
              <div className="flex items-center justify-between font-semibold text-zinc-700 dark:text-zinc-300 pb-1.5 border-b border-zinc-200 dark:border-zinc-800">
                <span>Desglose de Recargo por Materiales:</span>
                <span className="text-primary font-mono">
                  +${quoteData?.materials_extra_total?.toFixed(2) || "0.00"} USD
                </span>
              </div>
              <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                {(quoteData?.price_breakdown || []).map((b, i) => (
                  <div key={i} className="flex justify-between">
                    <span>{b.group_label} ({b.material_name}):</span>
                    <span className="font-mono text-zinc-700 dark:text-zinc-300">
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
        <DialogFooter className="bg-zinc-100/80 dark:bg-zinc-900/80 px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {quoteData?.valid ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> Plan válido para facturación en taller
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
