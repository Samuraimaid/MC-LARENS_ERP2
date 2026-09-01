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
  findMatchingVehicleBlueprint,
  getVehicleImageUrl,
  VEHICLE_CATEGORIES,
  VEHICLE_GLASS_GEOMETRY,
  LATERAL_GLASS_GEOMETRY,
} from "@/lib/vehicleSilhouette";
import { detectTintPlanFromProduct } from "@/lib/tintPlanResolver";




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

// 31 Materiales Oficiales Completos para Carga Instantánea, Resiliencia y Modo Offline
export const ALL_OFFICIAL_TINT_MATERIALS = [
  {
    "material_id": "q1_05_40",
    "id": "q1_05_40",
    "name": "Q1 5%-40\"",
    "brand": "Q1",
    "family": "Q1",
    "gama": "gama_economica",
    "gama_id": "gama_economica",
    "gama_label": "Gama Económica",
    "vlt": 5,
    "ir_rejection_pct": 15,
    "uv_rejection_pct": 95,
    "tech_type": "Económico 40\"",
    "description": "Línea económica accesible con privacidad del 5% y medida de 40 pulgadas.",
    "extra_price": 0,
    "is_default": true
  },
  {
    "material_id": "q1_20_40",
    "id": "q1_20_40",
    "name": "Q1 20%-40\"",
    "brand": "Q1",
    "family": "Q1",
    "gama": "gama_economica",
    "gama_id": "gama_economica",
    "gama_label": "Gama Económica",
    "vlt": 20,
    "ir_rejection_pct": 15,
    "uv_rejection_pct": 95,
    "tech_type": "Económico 40\"",
    "description": "Línea económica accesible con tono intermedio del 20% y medida de 40 pulgadas.",
    "extra_price": 0,
    "is_default": false
  },
  {
    "material_id": "raybar_05_60",
    "id": "raybar_05_60",
    "name": "Raybar 5%-60\" (Caja Roja y Blanca)",
    "brand": "Raybar",
    "family": "Raybar",
    "gama": "gama_economica",
    "gama_id": "gama_economica",
    "gama_label": "Gama Económica",
    "vlt": 5,
    "ir_rejection_pct": 20,
    "uv_rejection_pct": 95,
    "tech_type": "Económico 60\"",
    "description": "Película económica en rollo ancho de 60 pulgadas para cristales grandes y camionetas.",
    "extra_price": 0,
    "is_default": false
  },
  {
    "material_id": "std_05",
    "id": "std_05",
    "name": "Smoke 5%-20\"",
    "brand": "Solar Gard",
    "family": "Smoke",
    "gama": "tinmax",
    "gama_id": "tinmax",
    "gama_label": "Tinmax",
    "vlt": 5,
    "ir_rejection_pct": 99,
    "uv_rejection_pct": 99,
    "tech_type": "HP High Performance",
    "description": "Máximo control térmico (99% IR) y total privacidad en rollo de 20 pulgadas.",
    "extra_price": 0,
    "is_default": false
  },
  {
    "material_id": "std_20",
    "id": "std_20",
    "name": "Smoke 20%-20\"",
    "brand": "Solar Gard",
    "family": "Smoke",
    "gama": "tinmax",
    "gama_id": "tinmax",
    "gama_label": "Tinmax",
    "vlt": 20,
    "ir_rejection_pct": 40,
    "uv_rejection_pct": 99,
    "tech_type": "Tono Intermedio",
    "description": "Tonalidad intermedia más popular y versátil en rollo de 20 pulgadas.",
    "extra_price": 0,
    "is_default": true
  },
  {
    "material_id": "std_35",
    "id": "std_35",
    "name": "Smoke 35%-20\" y 40\"",
    "brand": "Solar Gard",
    "family": "Smoke",
    "gama": "tinmax",
    "gama_id": "tinmax",
    "gama_label": "Tinmax",
    "vlt": 35,
    "ir_rejection_pct": 20,
    "uv_rejection_pct": 99,
    "tech_type": "NR (Non-Reflective)",
    "description": "Claridad óptica superior (100% visibilidad nocturna) en 20\" y 40\".",
    "extra_price": 0,
    "is_default": false
  },
  {
    "material_id": "std_70",
    "id": "std_70",
    "name": "Smoke 70% (Claro)",
    "brand": "Solar Gard",
    "family": "Smoke",
    "gama": "tinmax",
    "gama_id": "tinmax",
    "gama_label": "Tinmax",
    "vlt": 70,
    "ir_rejection_pct": 20,
    "uv_rejection_pct": 99,
    "tech_type": "Estándar Claro",
    "description": "Transparencia total para parabrisas delantero y visión nocturna.",
    "extra_price": 0,
    "is_default": true
  },
  {
    "material_id": "raybar_05_40",
    "id": "raybar_05_40",
    "name": "Raybar 5%-40\"",
    "brand": "Raybar",
    "family": "Raybar",
    "gama": "tinmax",
    "gama_id": "tinmax",
    "gama_label": "Tinmax",
    "vlt": 5,
    "ir_rejection_pct": 25,
    "uv_rejection_pct": 98,
    "tech_type": "Estándar 40\"",
    "description": "Película Tinmax Raybar de 40 pulgadas tono oscuro 5%.",
    "extra_price": 0,
    "is_default": false
  },
  {
    "material_id": "sg_quantum_reg_25",
    "id": "sg_quantum_reg_25",
    "name": "Quantum Regular 25%-40\"",
    "brand": "Solar Gard",
    "family": "Quantum Regular",
    "gama": "tinmax",
    "gama_id": "tinmax",
    "gama_label": "Tinmax",
    "vlt": 25,
    "ir_rejection_pct": 64,
    "uv_rejection_pct": 99,
    "tech_type": "Metalizada Sputtered",
    "description": "Sin tintes: tono que jamás se degrada ni se torna morado con los años.",
    "extra_price": 0,
    "is_default": false
  },
  {
    "material_id": "sg_quantum_reg_10",
    "id": "sg_quantum_reg_10",
    "name": "Quantum Regular 10%-40\" (Oscuro)",
    "brand": "Solar Gard",
    "family": "Quantum Regular",
    "gama": "tinmax",
    "gama_id": "tinmax",
    "gama_label": "Tinmax",
    "vlt": 10,
    "ir_rejection_pct": 72,
    "uv_rejection_pct": 99,
    "tech_type": "Metalizada Sputtered",
    "description": "Nitidez superior al polarizado convencional y alto rechazo térmico.",
    "extra_price": 0,
    "is_default": false
  },
  {
    "material_id": "3m_nano_20",
    "id": "3m_nano_20",
    "name": "3M 20%-40\" y 20\"",
    "brand": "3M",
    "family": "3M Nano",
    "gama": "tinmax",
    "gama_id": "tinmax",
    "gama_label": "Tinmax",
    "vlt": 20,
    "ir_rejection_pct": 62,
    "uv_rejection_pct": 99,
    "tech_type": "3M Series",
    "description": "Look uniforme, deportivo y elegante: balance perfecto entre privacidad y seguridad.",
    "extra_price": 0,
    "is_default": false
  },
  {
    "material_id": "sg_charcoal_07",
    "id": "sg_charcoal_07",
    "name": "Charcoal 7%-40\"",
    "brand": "Solar Gard",
    "family": "Charcoal",
    "gama": "tinmax",
    "gama_id": "tinmax",
    "gama_label": "Tinmax",
    "vlt": 7,
    "ir_rejection_pct": 60,
    "uv_rejection_pct": 99,
    "tech_type": "HC Hard Coated",
    "description": "Negro profundo resistente a rayaduras en rollo de 40 pulgadas.",
    "extra_price": 0,
    "is_default": false
  },
  {
    "material_id": "sg_charcoal_22",
    "id": "sg_charcoal_22",
    "name": "Charcoal 22%-20\"",
    "brand": "Solar Gard",
    "family": "Charcoal",
    "gama": "tinmax",
    "gama_id": "tinmax",
    "gama_label": "Tinmax",
    "vlt": 22,
    "ir_rejection_pct": 55,
    "uv_rejection_pct": 99,
    "tech_type": "HC Hard Coated",
    "description": "Tono intermedio 22% en rollo de 20 pulgadas para ventanas laterales.",
    "extra_price": 0,
    "is_default": false
  },
  {
    "material_id": "sg_charcoal_06",
    "id": "sg_charcoal_06",
    "name": "Charcoal 6% (HP)",
    "brand": "Solar Gard",
    "family": "Charcoal",
    "gama": "tinmax",
    "gama_id": "tinmax",
    "gama_label": "Tinmax",
    "vlt": 6,
    "ir_rejection_pct": 65,
    "uv_rejection_pct": 99,
    "tech_type": "HP Carbón",
    "description": "Ultra oscura: máxima privacidad, estética agresiva y cero interferencia electrónica.",
    "extra_price": 0,
    "is_default": false
  },
  {
    "material_id": "sg_charcoal_35",
    "id": "sg_charcoal_35",
    "name": "Charcoal 35% (HC)",
    "brand": "Solar Gard",
    "family": "Charcoal",
    "gama": "tinmax",
    "gama_id": "tinmax",
    "gama_label": "Tinmax",
    "vlt": 35,
    "ir_rejection_pct": 50,
    "uv_rejection_pct": 99,
    "tech_type": "HC Hard Coated",
    "description": "Tono claro con tecnología de carbón: visibilidad nocturna impecable y elegancia.",
    "extra_price": 0,
    "is_default": false
  },
  {
    "material_id": "sg_galaxie_12",
    "id": "sg_galaxie_12",
    "name": "Galaxie 12%",
    "brand": "Solar Gard",
    "family": "Galaxie",
    "gama": "tinmax",
    "gama_id": "tinmax",
    "gama_label": "Tinmax",
    "vlt": 12,
    "ir_rejection_pct": 30,
    "uv_rejection_pct": 99,
    "tech_type": "Estándar Deportivo",
    "description": "Punto dulce deportivo: auto oscuro y deportivo a precio accesible.",
    "extra_price": 0,
    "is_default": false
  },
  {
    "material_id": "sg_supreme_04",
    "id": "sg_supreme_04",
    "name": "Supreme 4%-20\"",
    "brand": "Solar Gard",
    "family": "Nano Cerámico Supreme",
    "gama": "nano_ceramico",
    "gama_id": "nano_ceramico",
    "gama_label": "Nano Cerámico",
    "vlt": 4,
    "ir_rejection_pct": 90,
    "uv_rejection_pct": 99,
    "tech_type": "Nano Cerámico",
    "description": "Privacidad extrema y 90% rechazo infrarrojo. Tecnología multicapa en 20 pulgadas.",
    "extra_price": 45,
    "is_default": false
  },
  {
    "material_id": "sg_supreme_10",
    "id": "sg_supreme_10",
    "name": "Supreme 10%-20\"",
    "brand": "Solar Gard",
    "family": "Nano Cerámico Supreme",
    "gama": "nano_ceramico",
    "gama_id": "nano_ceramico",
    "gama_label": "Nano Cerámico",
    "vlt": 10,
    "ir_rejection_pct": 90,
    "uv_rejection_pct": 99,
    "tech_type": "Nano Cerámico",
    "description": "Elegancia y confort con 90% IR. Control solar superior en rollo de 20 pulgadas.",
    "extra_price": 45,
    "is_default": false
  },
  {
    "material_id": "sg_supreme_15",
    "id": "sg_supreme_15",
    "name": "Supreme 15%-30\"",
    "brand": "Solar Gard",
    "family": "Nano Cerámico Supreme",
    "gama": "nano_ceramico",
    "gama_id": "nano_ceramico",
    "gama_label": "Nano Cerámico",
    "vlt": 15,
    "ir_rejection_pct": 55,
    "uv_rejection_pct": 99,
    "tech_type": "Nano Cerámico 30\"",
    "description": "Rollo especial de 30 pulgadas Supreme 15% con alto rechazo infrarrojo.",
    "extra_price": 45,
    "is_default": false
  },
  {
    "material_id": "sg_supreme_16",
    "id": "sg_supreme_16",
    "name": "Supreme 16%-20\" y 40\"",
    "brand": "Solar Gard",
    "family": "Nano Cerámico Supreme",
    "gama": "nano_ceramico",
    "gama_id": "nano_ceramico",
    "gama_label": "Nano Cerámico",
    "vlt": 16,
    "ir_rejection_pct": 50,
    "uv_rejection_pct": 99,
    "tech_type": "HP High Performance",
    "description": "Claridad superior y estilo elegante en rollos versátiles de 20 y 40 pulgadas.",
    "extra_price": 45,
    "is_default": false
  },
  {
    "material_id": "sg_supreme_22",
    "id": "sg_supreme_22",
    "name": "Supreme 22%-20\"",
    "brand": "Solar Gard",
    "family": "Nano Cerámico Supreme",
    "gama": "nano_ceramico",
    "gama_id": "nano_ceramico",
    "gama_label": "Nano Cerámico",
    "vlt": 22,
    "ir_rejection_pct": 45,
    "uv_rejection_pct": 99,
    "tech_type": "Nano Cerámico",
    "description": "Gama media clara en 20 pulgadas: visibilidad, confort y look ejecutivo.",
    "extra_price": 45,
    "is_default": false
  },
  {
    "material_id": "sg_supreme_30",
    "id": "sg_supreme_30",
    "name": "Supreme 30%-40\"",
    "brand": "Solar Gard",
    "family": "Nano Cerámico Supreme",
    "gama": "nano_ceramico",
    "gama_id": "nano_ceramico",
    "gama_label": "Nano Cerámico",
    "vlt": 30,
    "ir_rejection_pct": 45,
    "uv_rejection_pct": 99,
    "tech_type": "Nano Cerámico 40\"",
    "description": "Tono 30% en rollo de 40 pulgadas con rechazo térmico superior.",
    "extra_price": 45,
    "is_default": false
  },
  {
    "material_id": "sg_supreme_42",
    "id": "sg_supreme_42",
    "name": "Supreme 42%-20\" y 40\"",
    "brand": "Solar Gard",
    "family": "Nano Cerámico Supreme",
    "gama": "nano_ceramico",
    "gama_id": "nano_ceramico",
    "gama_label": "Nano Cerámico",
    "vlt": 42,
    "ir_rejection_pct": 35,
    "uv_rejection_pct": 99,
    "tech_type": "Nano Cerámico",
    "description": "Acabado ultra claro con protección solar y visión transparente en 20\" y 40\".",
    "extra_price": 45,
    "is_default": false
  },
  {
    "material_id": "sg_solstice_05",
    "id": "sg_solstice_05",
    "name": "Solstice 5%-40\" y 20\"",
    "brand": "Solar Gard",
    "family": "Endeavor Solstice",
    "gama": "nano_ceramico",
    "gama_id": "nano_ceramico",
    "gama_label": "Nano Cerámico",
    "vlt": 5,
    "ir_rejection_pct": 72,
    "uv_rejection_pct": 99,
    "tech_type": "Híbrida Metalizada",
    "description": "Arquitectura híbrida metalizada para climas hostiles y sol directo en 20\" y 40\".",
    "extra_price": 45,
    "is_default": false
  },
  {
    "material_id": "sg_camaleon_20",
    "id": "sg_camaleon_20",
    "name": "Camaleón 20%",
    "brand": "Solar Gard",
    "family": "Camaleón",
    "gama": "nano_ceramico",
    "gama_id": "nano_ceramico",
    "gama_label": "Nano Cerámico",
    "vlt": 20,
    "ir_rejection_pct": 88,
    "uv_rejection_pct": 99,
    "tech_type": "Multicapa Tornasol",
    "description": "Efecto tornasol dinámico de alta gama que cambia de color según la luz solar.",
    "extra_price": 45,
    "is_default": false
  },
  {
    "material_id": "sg_titanium_26",
    "id": "sg_titanium_26",
    "name": "Titanium 26%",
    "brand": "Solar Gard",
    "family": "Titanium",
    "gama": "nano_ceramico",
    "gama_id": "nano_ceramico",
    "gama_label": "Nano Cerámico",
    "vlt": 26,
    "ir_rejection_pct": 80,
    "uv_rejection_pct": 99,
    "tech_type": "Barrera Titanio",
    "description": "Blindaje térmico profesional basado en partículas de titanio al vacío.",
    "extra_price": 45,
    "is_default": false
  },
  {
    "material_id": "sg_quantum_orig_14",
    "id": "sg_quantum_orig_14",
    "name": "Quantum Original 14%-40\" y 20\"",
    "brand": "Solar Gard",
    "family": "Quantum Original",
    "gama": "gama_premium",
    "gama_id": "gama_premium",
    "gama_label": "Gama Premium",
    "vlt": 14,
    "ir_rejection_pct": 70,
    "uv_rejection_pct": 99,
    "tech_type": "Metalizada Sputtered",
    "description": "Película 100% metalizada por pulverización catódica en 20\" y 40\".",
    "extra_price": 80,
    "is_default": false
  },
  {
    "material_id": "sg_quantum_orig_19",
    "id": "sg_quantum_orig_19",
    "name": "Quantum Original 19%-40\" y 20\"",
    "brand": "Solar Gard",
    "family": "Quantum Original",
    "gama": "gama_premium",
    "gama_id": "gama_premium",
    "gama_label": "Gama Premium",
    "vlt": 19,
    "ir_rejection_pct": 80,
    "uv_rejection_pct": 99,
    "tech_type": "Metalizada Sputtered",
    "description": "Punto medio perfecto (80% IR): excelente privacidad sin perder visión nocturna.",
    "extra_price": 80,
    "is_default": false
  },
  {
    "material_id": "sg_quantum_orig_28",
    "id": "sg_quantum_orig_28",
    "name": "Quantum Original 28%-40\" y 20\"",
    "brand": "Solar Gard",
    "family": "Quantum Original",
    "gama": "gama_premium",
    "gama_id": "gama_premium",
    "gama_label": "Gama Premium",
    "vlt": 28,
    "ir_rejection_pct": 72,
    "uv_rejection_pct": 99,
    "tech_type": "HP High Performance",
    "description": "Tono claro y sutil: 72% IR sin oscurecer el auto en 20\" y 40\".",
    "extra_price": 80,
    "is_default": false
  },
  {
    "material_id": "sg_endeavor_05",
    "id": "sg_endeavor_05",
    "name": "Endeavor 5%-20\"",
    "brand": "Solar Gard",
    "family": "Endeavor",
    "gama": "gama_premium",
    "gama_id": "gama_premium",
    "gama_label": "Gama Premium",
    "vlt": 5,
    "ir_rejection_pct": 70,
    "uv_rejection_pct": 99,
    "tech_type": "Gama Intermedia-Alta",
    "description": "Privacidad absoluta, oscuridad profunda y rendimiento térmico en 20\".",
    "extra_price": 80,
    "is_default": false
  },
  {
    "material_id": "sg_endeavor_35",
    "id": "sg_endeavor_35",
    "name": "Endeavor 35%-40\"",
    "brand": "Solar Gard",
    "family": "Endeavor",
    "gama": "gama_premium",
    "gama_id": "gama_premium",
    "gama_label": "Gama Premium",
    "vlt": 35,
    "ir_rejection_pct": 60,
    "uv_rejection_pct": 99,
    "tech_type": "Gama Intermedia-Alta",
    "description": "Tono claro, sutil y elegante con visibilidad nocturna impecable en 40\".",
    "extra_price": 80,
    "is_default": false
  }
];

export const DEFAULT_TINT_CONFIG = {
  zones: {
    windshield: {
      zone: "windshield",
      label: "Parabrisas delantero",
      materials: ALL_OFFICIAL_TINT_MATERIALS,
    },
    front_sides: {
      zone: "front_sides",
      label: "Ventanas Delanteras",
      materials: ALL_OFFICIAL_TINT_MATERIALS,
    },
    rear_sides: {
      zone: "rear_sides",
      label: "Ventanas Traseras",
      materials: ALL_OFFICIAL_TINT_MATERIALS,
    },
    rear: {
      zone: "rear",
      label: "Parabrisas Trasero",
      materials: ALL_OFFICIAL_TINT_MATERIALS,
    },
  },
  sunstrip_pricing: {
    windshield_top: 15,
    windshield_bottom: 15,
    rear_top: 15,
    rear_bottom: 15,
  },
  policy: {
    max_materials_per_vehicle: 4,
    default_link_sides: true,
    second_layer_policy: { allow_second_layer: true },
  },
};


// Función de sombreado y color hiper-realista basada en las muestras del catálogo
export function getRealisticTintShade(materialId, secondLayerEnabled = false) {
  if (!materialId || materialId === "none" || materialId === "sin_polarizado" || materialId === "no_incluido") {
    return {
      fill: "rgba(220, 240, 255, 0.05)",
      opacity: 0.15,
      border: "#64748b",
      glow: "#94a3b8",
      label: "Sin polarizar",
      isNone: true,
    };
  }
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
  product,
  initialPlan,
  onApplyPlan,
  salePrice = 0,
  currency = "USD",
  exchangeRate = 36.5,
}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(DEFAULT_TINT_CONFIG);
  const [activeZone, setActiveZone] = useState("windshield");
  const [linkSides, setLinkSides] = useState(true);
  const [viewMode, setViewMode] = useState("lateral"); // "lateral" | "top"
  const [orientation, setOrientation] = useState("vertical"); // "horizontal" | "vertical"
  const [selectedGama, setSelectedGama] = useState("all");
  const [preselectedMeta, setPreselectedMeta] = useState(null);
  const [isUnlocked, setIsUnlocked] = useState(false);

  // Determinar zonas permitidas según alcance del producto
  const allowedZones = useMemo(() => {
    if (isUnlocked || !preselectedMeta?.allowedZones) {
      return ["windshield", "front_sides", "rear_sides", "rear"];
    }
    return preselectedMeta.allowedZones;
  }, [isUnlocked, preselectedMeta]);

  const isSunstripOnly = Boolean(preselectedMeta?.isSunstripOnly && !isUnlocked);

  const isZoneAllowed = (zoneKey) => {
    return isUnlocked || allowedZones.includes(zoneKey);
  };

  const [familyFilter, setFamilyFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Categoría de Vehículo Dinámica & Plano de Ingeniería Específico
  const matchedBlueprint = useMemo(() => findMatchingVehicleBlueprint(vehicle), [vehicle]);
  const detectedCategory = useMemo(() => resolveVehicleCategory(vehicle), [vehicle]);
  const [selectedVehicleType, setSelectedVehicleType] = useState(detectedCategory);
  const [customBlueprintGeom, setCustomBlueprintGeom] = useState(null);

  useEffect(() => {
    if (vehicle) {
      setSelectedVehicleType(resolveVehicleCategory(vehicle));
    }
  }, [vehicle]);

  useEffect(() => {
    if (!matchedBlueprint?.lateral_image) {
      setCustomBlueprintGeom(null);
      return;
    }
    const bpSlug = matchedBlueprint.lateral_image.split("/").pop().replace("_lat.png", "");
    if (!bpSlug) return;

    let isMounted = true;
    import("@/data/vehicle_window_geometry_index.json")
      .then((mod) => {
        if (isMounted) {
          const geom = (mod.default?.geometries || mod.geometries || {})[bpSlug];
          if (geom) setCustomBlueprintGeom(geom);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [matchedBlueprint]);


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

  // Helper para restaurar datos en el estado
  const applyLoadedPlan = (plan) => {
    if (!plan?.windows) return;
    const mats = {};
    const ovs = {};
    const secs = {};
    Object.keys(plan.windows).forEach((z) => {
      mats[z] = plan.windows[z]?.material_id || "std_20";
      ovs[z] = Boolean(plan.windows[z]?.override_size_band);
      if (plan.windows[z]?.second_layer) {
        secs[z] = {
          enabled: Boolean(plan.windows[z]?.second_layer?.enabled),
          material_id: plan.windows[z]?.second_layer?.material_id || "sg_charcoal_20",
        };
      } else {
        secs[z] = { enabled: false, material_id: "sg_charcoal_20" };
      }
    });
    setSelectedMaterials(mats);
    setOverrideFlags(ovs);
    setSecondLayers((prev) => ({ ...prev, ...secs }));

    if (plan.windows.rear?.empalme_2x20) {
      setEmpalmeRear(true);
      setEmpalmeAuthorized(true);
    }

    if (plan.sunstrips) {
      setSunstrips((prev) => ({ ...prev, ...plan.sunstrips }));
    }
    if (typeof plan.link_sides === "boolean") {
      setLinkSides(plan.link_sides);
    } else {
      setLinkSides(mats.front_sides === mats.rear_sides);
    }
  };

  // Cargar configuración de materiales al abrir y preseleccionar según producto o borrador previo
  useEffect(() => {
    if (!isOpen) return;
    setIsUnlocked(false);
    const vehicleKey = vehicle?.vehicle_id || vehicle?.id || vehicle?.plate || "default";

    // 1. Restaurar de initialPlan (si estamos editando una línea existente en el carrito)
    if (initialPlan?.windows) {
      applyLoadedPlan(initialPlan);
      if (initialPlan.sunstrips?.windshield_top?.enabled) {
        setActiveZone("windshield");
        setViewMode("top");
      }
      setPreselectedMeta(null);
    } else if (product) {
      // 2. Preselección INTELIGENTE según el producto clickeado en Catálogo/POS (ej. Franja Superior, Vidrios Delanteros, etc.)
      const preselected = detectTintPlanFromProduct(product, vehicle);
      if (preselected) {
        setPreselectedMeta(preselected);
        if (preselected.selectedMaterials) {
          setSelectedMaterials(preselected.selectedMaterials);
        }
        if (preselected.sunstrips) {
          setSunstrips(preselected.sunstrips);
        }
        if (preselected.activeZone) {
          setActiveZone(preselected.activeZone);
        }
        if (preselected.viewMode) {
          setViewMode(preselected.viewMode);
        }
        if (preselected.selectedGama) {
          setSelectedGama(preselected.selectedGama);
        }
        if (typeof preselected.linkSides === "boolean") {
          setLinkSides(preselected.linkSides);
        }
      }
    } else {
      // 3. Fallback a borrador guardado en localStorage o default completo
      setPreselectedMeta(null);
      try {
        const savedDraft = localStorage.getItem(`mclarens_tint_draft_${vehicleKey}`);
        if (savedDraft) {
          const parsed = JSON.parse(savedDraft);
          applyLoadedPlan(parsed);
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
      } catch (e) {
        // Fallback default
      }
    }

    // 4. Cargar configuración actualizada del backend de forma silenciosa y resiliente
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
        if (res.data && res.data.zones) {
          setConfig(res.data);
        }
      } catch (err) {
        // Usar catálogo fallback embebido sin molestar con toast
        console.info("Usando catálogo de polarizados offline/embebido");
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, [isOpen, vehicle, initialPlan, product]);


  // Persistencia Dinámica en Tiempo Real (Auto-Save Reactivo en cada cambio)
  useEffect(() => {
    if (!isOpen) return;
    const vehicleKey = vehicle?.vehicle_id || vehicle?.id || vehicle?.plate || "default";
    const draftPayload = {
      vehicle_id: vehicleKey,
      selectedVehicleType,
      windows: {
        windshield: {
          material_id: isZoneAllowed("windshield") ? selectedMaterials.windshield : "none",
          override_size_band: overrideFlags.windshield,
          second_layer: isZoneAllowed("windshield") ? secondLayers.windshield : { enabled: false },
        },
        front_sides: {
          material_id: isZoneAllowed("front_sides") ? selectedMaterials.front_sides : "none",
          override_size_band: overrideFlags.front_sides,
          second_layer: isZoneAllowed("front_sides") ? secondLayers.front_sides : { enabled: false },
        },
        rear_sides: {
          material_id: isZoneAllowed("rear_sides") ? selectedMaterials.rear_sides : "none",
          override_size_band: overrideFlags.rear_sides,
          second_layer: isZoneAllowed("rear_sides") ? secondLayers.rear_sides : { enabled: false },
        },
        rear: {
          material_id: isZoneAllowed("rear") ? selectedMaterials.rear : "none",
          override_size_band: overrideFlags.rear,
          second_layer: isZoneAllowed("rear") ? secondLayers.rear : { enabled: false },
          empalme_2x20: empalmeRear,
        },
      },
      sunstrips,
      link_sides: linkSides,
      updated_at: Date.now(),
    };

    try {
      localStorage.setItem(`mclarens_tint_draft_${vehicleKey}`, JSON.stringify(draftPayload));
    } catch (e) {
      // ignore
    }
  }, [selectedMaterials, secondLayers, sunstrips, empalmeRear, linkSides, overrideFlags, isOpen, vehicle, selectedVehicleType, isUnlocked, allowedZones]);


  // Cotizar plan en tiempo real (Protección estricta: solo zonas contratadas)
  useEffect(() => {
    if (!isOpen || !config) return;

    const computeQuote = async () => {
      const planPayload = {
        vehicle_id: vehicle?.vehicle_id || vehicle?.id || null,
        link_sides: linkSides,
        windows: {
          windshield: {
            material_id: isZoneAllowed("windshield") ? selectedMaterials.windshield : "none",
            override_size_band: overrideFlags.windshield,
            second_layer: isZoneAllowed("windshield") ? secondLayers.windshield : { enabled: false },
          },
          front_sides: {
            material_id: isZoneAllowed("front_sides") ? selectedMaterials.front_sides : "none",
            override_size_band: overrideFlags.front_sides,
            second_layer: isZoneAllowed("front_sides") ? secondLayers.front_sides : { enabled: false },
          },
          rear_sides: {
            material_id: isZoneAllowed("rear_sides") ? selectedMaterials.rear_sides : "none",
            override_size_band: overrideFlags.rear_sides,
            second_layer: isZoneAllowed("rear_sides") ? secondLayers.rear_sides : { enabled: false },
          },
          rear: {
            material_id: isZoneAllowed("rear") ? selectedMaterials.rear : "none",
            override_size_band: overrideFlags.rear,
            second_layer: isZoneAllowed("rear") ? secondLayers.rear : { enabled: false },
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
  }, [isOpen, config, selectedMaterials, secondLayers, sunstrips, overrideFlags, linkSides, empalmeRear, vehicle, isUnlocked, allowedZones]);

  // Manejar selección de material base o de banda
  const handleSelectMaterial = (zone, materialId) => {
    if (isSunstripOnly) {
      setSunstrips((prev) => ({
        ...prev,
        windshield_top: { enabled: true, material_id: materialId },
      }));
      const matName = config?.materials?.find((m) => m.id === materialId)?.name || materialId;
      toast.success(`Film de Banda Frontal configurado a: ${matName}`);
      return;
    }

    if (!isZoneAllowed(zone)) {
      toast.warning(`La zona seleccionada no está contratada en este servicio.`);
      return;
    }

    setSelectedMaterials((prev) => {
      if (linkSides && (zone === "front_sides" || zone === "rear_sides")) {
        const next = { ...prev };
        if (isZoneAllowed("front_sides")) next.front_sides = materialId;
        if (isZoneAllowed("rear_sides")) next.rear_sides = materialId;
        return next;
      }
      return { ...prev, [zone]: materialId };
    });
  };

  // Manejar segunda capa
  const handleToggleSecondLayer = (zone, enabled) => {
    if (!isZoneAllowed(zone)) {
      toast.warning(`La zona seleccionada no está contratada en este servicio.`);
      return;
    }
    setSecondLayers((prev) => {
      const current = prev[zone] || { material_id: "sg_charcoal_20" };
      if (linkSides && (zone === "front_sides" || zone === "rear_sides")) {
        const next = { ...prev };
        if (isZoneAllowed("front_sides")) next.front_sides = { ...current, enabled };
        if (isZoneAllowed("rear_sides")) next.rear_sides = { ...current, enabled };
        return next;
      }
      return {
        ...prev,
        [zone]: { ...current, enabled },
      };
    });
  };

  const handleSelectSecondLayerMaterial = (zone, materialId) => {
    if (!isZoneAllowed(zone)) return;
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

  // Aplicar material a todas las ventanas contratadas / permitidas
  const handleApplyAll = (materialId) => {
    if (isSunstripOnly) {
      setSunstrips((prev) => ({
        ...prev,
        windshield_top: { enabled: true, material_id: materialId },
      }));
      toast.success("Material aplicado a la Banda Frontal");
      return;
    }

    setSelectedMaterials((prev) => {
      const next = { ...prev };
      allowedZones.forEach((z) => {
        next[z] = materialId;
      });
      return next;
    });
    toast.success(`Material aplicado a las zonas contratadas (${allowedZones.length})`);
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
        is_unlocked: isUnlocked,
        windows: {
          windshield: {
            material_id: isZoneAllowed("windshield") ? selectedMaterials.windshield : "none",
            material_name: isZoneAllowed("windshield")
              ? quoteData.rolls_consumed?.find((r) => r.zone === "windshield" && r.layer === 1)?.material_name || "Sin polarizar"
              : "No contratado",
            size_band: quoteData.vehicle_size_bands?.windshield,
            override_size_band: overrideFlags.windshield,
            second_layer: isZoneAllowed("windshield") && secondLayers.windshield.enabled ? secondLayers.windshield : null,
          },
          front_sides: {
            material_id: isZoneAllowed("front_sides") ? selectedMaterials.front_sides : "none",
            material_name: isZoneAllowed("front_sides")
              ? quoteData.rolls_consumed?.find((r) => r.zone === "front_sides" && r.layer === 1)?.material_name || "Sin polarizar"
              : "No contratado",
            size_band: quoteData.vehicle_size_bands?.front_sides,
            override_size_band: overrideFlags.front_sides,
            second_layer: isZoneAllowed("front_sides") && secondLayers.front_sides.enabled ? secondLayers.front_sides : null,
          },
          rear_sides: {
            material_id: isZoneAllowed("rear_sides") ? selectedMaterials.rear_sides : "none",
            material_name: isZoneAllowed("rear_sides")
              ? quoteData.rolls_consumed?.find((r) => r.zone === "rear_sides" && r.layer === 1)?.material_name || "Sin polarizar"
              : "No contratado",
            size_band: quoteData.vehicle_size_bands?.rear_sides,
            override_size_band: overrideFlags.rear_sides,
            second_layer: isZoneAllowed("rear_sides") && secondLayers.rear_sides.enabled ? secondLayers.rear_sides : null,
          },
          rear: {
            material_id: isZoneAllowed("rear") ? selectedMaterials.rear : "none",
            material_name: isZoneAllowed("rear")
              ? quoteData.rolls_consumed?.find((r) => r.zone === "rear" && r.layer === 1)?.material_name || "Sin polarizar"
              : "No contratado",
            size_band: quoteData.vehicle_size_bands?.rear,
            override_size_band: overrideFlags.rear,
            second_layer: isZoneAllowed("rear") && secondLayers.rear.enabled ? secondLayers.rear : null,
            empalme_2x20: empalmeRear,
          },
        },
        sunstrips: sunstrips,
        sunstrip_only: isSunstripOnly,
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
  const allZoneMaterials = Object.values(config?.zones || {}).flatMap((z) => z?.materials || []);
  const uniqueAllMaterials = Array.from(new Map(allZoneMaterials.map((m) => [m.id || m.material_id, m])).values());
  const activeMaterials = (activeZoneConfig?.materials && activeZoneConfig.materials.length > 0)
    ? activeZoneConfig.materials
    : (uniqueAllMaterials.length > 0 ? uniqueAllMaterials : ALL_OFFICIAL_TINT_MATERIALS);
  const activeZoneLabel = ZONES.find((z) => z.id === activeZone)?.label || activeZone;

  // Filtrado de materiales por Gama Oficial, Familia y Búsqueda Inteligente Multi-Gama
  const { filteredMaterials, searchMatchedInOtherGama } = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    // Helper de coincidencia de gama
    const isGamaMatch = (m, targetGama) => {
      const mGama = m.gama || m.gama_id || "";
      if (targetGama === "all") return true;
      if (mGama === targetGama) return true;
      if (targetGama === "gama_economica" && (mGama === "economica" || mGama === "gama_economica")) return true;
      if (targetGama === "gama_premium" && (mGama === "premium" || mGama === "gama_premium")) return true;
      if (targetGama === "nano_ceramico" && (mGama === "nano_ceramico" || mGama === "nano_ceramica" || mGama === "ceramico" || mGama === "ceramica")) return true;
      if (targetGama === "tinmax" && mGama === "tinmax") return true;
      return false;
    };

    // Helper de búsqueda por texto / tono / marca / id
    const isSearchMatch = (m) => {
      if (!term) return true;
      return (
        m.name?.toLowerCase().includes(term) ||
        m.brand?.toLowerCase().includes(term) ||
        m.family?.toLowerCase().includes(term) ||
        m.gama_label?.toLowerCase().includes(term) ||
        m.tech_type?.toLowerCase().includes(term) ||
        m.description?.toLowerCase().includes(term) ||
        String(m.vlt || "").includes(term) ||
        String(m.id || "").toLowerCase().includes(term) ||
        String(m.material_id || "").toLowerCase().includes(term)
      );
    };

    const isFamilyMatch = (m) => {
      return familyFilter === "all" || m.family === familyFilter;
    };

    // Si no hay término de búsqueda, respetar estrictamente la gama seleccionada
    if (!term) {
      const filtered = activeMaterials.filter((m) => isGamaMatch(m, selectedGama) && isFamilyMatch(m));
      return { filteredMaterials: filtered, searchMatchedInOtherGama: false };
    }

    // Si hay término de búsqueda:
    const strictMatches = activeMaterials.filter((m) => isGamaMatch(m, selectedGama) && isSearchMatch(m) && isFamilyMatch(m));
    
    // Si la gama seleccionada no era "all" pero arrojó 0 resultados, buscar en todas las gamas
    if (strictMatches.length === 0 && selectedGama !== "all") {
      const allGamaMatches = activeMaterials.filter((m) => isSearchMatch(m) && isFamilyMatch(m));
      if (allGamaMatches.length > 0) {
        return {
          filteredMaterials: allGamaMatches,
          searchMatchedInOtherGama: true,
        };
      }
    }

    return {
      filteredMaterials: strictMatches,
      searchMatchedInOtherGama: false,
    };
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
                  {product && (
                    <Badge className="bg-amber-400/25 text-amber-200 border-amber-300/40 text-[9px] sm:text-[10px] px-1.5 py-0 flex items-center gap-1 shrink-0 shadow-xs font-semibold">
                      <Sparkles className="h-3 w-3 text-amber-300 animate-pulse" />
                      <span>Preseleccionado: {product.name}</span>
                    </Badge>
                  )}

                </DialogTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="hidden sm:block text-[11px] text-blue-200/90 truncate">
                    Bandas requeridas: {config?.vehicle_size_bands?.windshield || "Parabrisas >40\""} / {config?.vehicle_size_bands?.front_sides || "Laterales >20\""}
                  </p>
                  {preselectedMeta?.badgeNote && (
                    <span className="text-[10px] text-amber-300 font-bold bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-500/30">
                      ⚡ {preselectedMeta.badgeNote}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isUnlocked && (allowedZones.length < 4 || isSunstripOnly) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsUnlocked(true);
                    toast.info("Modo personalizado activado: Todas las ventanas desbloqueadas.");
                  }}
                  className="h-7 px-2 text-[10px] bg-white/10 hover:bg-white/20 text-white border-white/20 hover:border-white/40 shadow-xs"
                  title="Desbloquear todas las zonas para cotizar cristales adicionales"
                >
                  <Lock className="h-3 w-3 mr-1 text-amber-300" />
                  <span>Desbloquear Todo</span>
                </Button>
              )}
              {isUnlocked && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsUnlocked(false);
                    if (preselectedMeta) {
                      if (preselectedMeta.selectedMaterials) setSelectedMaterials(preselectedMeta.selectedMaterials);
                      if (preselectedMeta.sunstrips) setSunstrips(preselectedMeta.sunstrips);
                    }
                    toast.info("Bloqueo reactivado para el producto seleccionado.");
                  }}
                  className="h-7 px-2 text-[10px] bg-amber-500/20 text-amber-200 border-amber-400/40 hover:bg-amber-500/30 shadow-xs"
                >
                  <Check className="h-3 w-3 mr-1 text-amber-300" />
                  <span>Restringir a Producto</span>
                </Button>
              )}
              <div className="text-right shrink-0">
                <span className="hidden sm:block text-[10px] uppercase text-blue-300 font-mono">Recargo Total</span>
                <span className="text-sm sm:text-lg md:text-xl font-black text-white">
                  +${quoteData?.materials_extra_total?.toFixed(2) || "0.00"}{" "}
                  <span className="text-[10px] sm:text-xs font-medium text-blue-200">USD</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Cuerpo: Diagrama Interactivo de Auto Dinámico en Tamaño Grande + Selector de Material */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-0 overflow-y-auto min-h-0 flex-1">
          {/* Lado Izquierdo (5.5 cols en PC): Diagrama Interactivo Grande */}
          <div className="md:col-span-5 lg:col-span-6 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 p-2 sm:p-4 flex flex-col items-center justify-between bg-zinc-50/70 dark:bg-zinc-900/50 select-none space-y-2">


            {/* Leyenda Interactiva y Táctil */}
            <div className="flex items-center justify-center gap-1 sm:gap-1.5 text-[9px] sm:text-[10px] w-full max-w-sm md:max-w-md font-semibold py-1 px-1 bg-zinc-100/90 dark:bg-zinc-800/70 rounded-xl border border-zinc-200 dark:border-zinc-700/60 shrink-0 shadow-inner">
              {ZONES.map((z) => {
                const isActive = activeZone === z.id;
                const allowed = isZoneAllowed(z.id) || (z.id === "windshield" && isSunstripOnly);
                return (
                  <button
                    key={z.id}
                    type="button"
                    disabled={!allowed}
                    className={`flex-1 flex items-center justify-center gap-1 py-1 px-1 rounded-lg transition-all ${
                      !allowed
                        ? "opacity-35 cursor-not-allowed bg-zinc-200/40 dark:bg-zinc-800/40 text-zinc-400 border border-dashed border-zinc-300 dark:border-zinc-700"
                        : isActive
                        ? `${z.activeBg} text-white font-bold shadow-sm ${z.ringColor} ring-1`
                        : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/50"
                    }`}
                    onClick={() => {
                      if (!allowed) {
                        toast.info(`Zona bloqueada: ${z.label} no está incluida en ${product?.name || "este servicio"}.`);
                        return;
                      }
                      setActiveZone(z.id);
                    }}
                    title={!allowed ? `${z.label} (Bloqueado / No contratado)` : z.label}
                  >
                    {!allowed ? (
                      <Lock className="h-2.5 w-2.5 text-zinc-400 shrink-0" />
                    ) : (
                      <span className={`h-2 w-2 rounded-full ${isActive ? "bg-white" : z.dotColor} shrink-0`} />
                    )}
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
                  onClick={() => setOrientation((prev) => (prev === "vertical" ? "horizontal" : "vertical"))}
                  className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-2xs hover:bg-zinc-50"
                  title="Cambiar orientación de vista de planta"
                >
                  <RotateCw className="h-3 w-3" />
                  <span>{orientation === "vertical" ? "Girar Horizontal" : "Girar Vertical"}</span>
                </button>
              )}

            </div>

            {/* Canvas Grande del Vehículo con Sombras Hiper-Realistas */}
            <div
              className={`relative select-none flex items-center justify-center shrink-0 transition-all duration-300 overflow-hidden rounded-2xl bg-zinc-950/15 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800/80 my-auto shadow-inner w-full ${
                viewMode === "lateral"
                  ? "max-w-[540px] h-[240px] sm:h-[280px] md:h-[320px]"
                  : isVehicleHorizontal
                  ? "max-w-[540px] h-[240px] sm:h-[280px] md:h-[320px]"
                  : "w-56 sm:w-72 md:w-80 h-[300px] sm:h-[360px] md:h-[440px]"
              }`}
            >
              {viewMode === "lateral" ? (
                /* ================= VISTA LATERAL (PERFIL REAL) ================= */
                <div className="relative w-full h-full max-w-[540px] aspect-[16/9] flex items-center justify-center p-2">
                  {/* Silueta Lateral Real del Vehículo */}
                  <img
                    src={getVehicleImageUrl(matchedBlueprint?.lateral_image) || LATERAL_VEHICLE_IMAGES[selectedVehicleType] || "/vehicles/thumbnails/camioneta-doble-cabina.png"}
                    alt="Silueta Lateral Vehículo"
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none drop-shadow-2xl transition-all duration-300"
                  />

                  {/* Indicador de Banda de Sol Frontal Activa en Vista Lateral */}
                  {sunstrips.windshield_top?.enabled && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveZone("windshield");
                        setViewMode("top");
                      }}
                      className="absolute top-2 left-2 z-10 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-sky-500/25 border border-sky-400/60 text-[10px] font-bold text-sky-100 backdrop-blur-xs shadow-md hover:bg-sky-500/40 transition-all cursor-pointer"
                      title="Banda Frontal Superior Activa. Toca para ver en vista de planta."
                    >
                      <Sun className="h-3.5 w-3.5 text-yellow-300 animate-spin" style={{ animationDuration: "12s" }} />
                      <span>Banda Frontal ON ✓</span>
                    </button>
                  )}

                  {/* Indicador de Banda de Sol Trasera Activa en Vista Lateral */}
                  {sunstrips.rear_top?.enabled && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveZone("rear");
                        setViewMode("top");
                      }}
                      className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-purple-500/25 border border-purple-400/60 text-[10px] font-bold text-purple-100 backdrop-blur-xs shadow-md hover:bg-purple-500/40 transition-all cursor-pointer"
                      title="Banda Trasera Superior Activa. Toca para ver en vista de planta."
                    >
                      <Sun className="h-3.5 w-3.5 text-purple-300" />
                      <span>Banda Trasera ON ✓</span>
                    </button>
                  )}

                  {/* Capa SVG Interactiva para Ventanas Laterales */}

                  {(() => {
                    const shadeFrontSides = getRealisticTintShade(selectedMaterials.front_sides, secondLayers.front_sides?.enabled);
                    const shadeRearSides = getRealisticTintShade(selectedMaterials.rear_sides, secondLayers.rear_sides?.enabled);
                    const isSidesLinkedActive = linkSides && (activeZone === "front_sides" || activeZone === "rear_sides");
                    const isFrontSidesActive = activeZone === "front_sides" || isSidesLinkedActive;
                    const isRearSidesActive = activeZone === "rear_sides" || isSidesLinkedActive;
                    const latGeom =
                      customBlueprintGeom ||
                      LATERAL_GLASS_GEOMETRY[selectedVehicleType] ||
                      LATERAL_GLASS_GEOMETRY.camioneta_doble_cabina;



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
                        {latGeom.front && (
                          <path
                            d={latGeom.front}
                            fill={
                              !isZoneAllowed("front_sides")
                                ? "rgba(220, 240, 255, 0.04)"
                                : shadeFrontSides.fill === "url(#camaleonGradient)"
                                ? "url(#camaleonGradientLateral)"
                                : shadeFrontSides.fill
                            }
                            fillOpacity={!isZoneAllowed("front_sides") ? 0.12 : shadeFrontSides.opacity}
                            stroke={
                              !isZoneAllowed("front_sides")
                                ? "rgba(148, 163, 184, 0.35)"
                                : isFrontSidesActive
                                ? "#eab308"
                                : shadeFrontSides.border
                            }
                            strokeWidth={isFrontSidesActive && isZoneAllowed("front_sides") ? "3.5" : "1.5"}
                            strokeDasharray={!isZoneAllowed("front_sides") ? "4 3" : undefined}
                            filter={isFrontSidesActive && isZoneAllowed("front_sides") ? "url(#neonGlowYellowLat)" : undefined}
                            className={!isZoneAllowed("front_sides") ? "cursor-not-allowed opacity-45" : "cursor-pointer transition-all hover:opacity-90"}
                            onClick={() => {
                              if (!isZoneAllowed("front_sides")) {
                                toast.info(`Ventanas delanteras no contratadas en este paquete.`);
                                return;
                              }
                              setActiveZone("front_sides");
                            }}
                          />
                        )}

                        {/* Ventana Trasera Lateral */}
                        {latGeom.rear && (
                          <path
                            d={latGeom.rear}
                            fill={
                              !isZoneAllowed("rear_sides")
                                ? "rgba(220, 240, 255, 0.04)"
                                : shadeRearSides.fill === "url(#camaleonGradient)"
                                ? "url(#camaleonGradientLateral)"
                                : shadeRearSides.fill
                            }
                            fillOpacity={!isZoneAllowed("rear_sides") ? 0.12 : shadeRearSides.opacity}
                            stroke={
                              !isZoneAllowed("rear_sides")
                                ? "rgba(148, 163, 184, 0.35)"
                                : isRearSidesActive
                                ? "#f97316"
                                : shadeRearSides.border
                            }
                            strokeWidth={isRearSidesActive && isZoneAllowed("rear_sides") ? "3.5" : "1.5"}
                            strokeDasharray={!isZoneAllowed("rear_sides") ? "4 3" : undefined}
                            filter={isRearSidesActive && isZoneAllowed("rear_sides") ? "url(#neonGlowOrangeLat)" : undefined}
                            className={!isZoneAllowed("rear_sides") ? "cursor-not-allowed opacity-45" : "cursor-pointer transition-all hover:opacity-90"}
                            onClick={() => {
                              if (!isZoneAllowed("rear_sides")) {
                                toast.info(`Ventanas traseras no contratadas en este paquete.`);
                                return;
                              }
                              setActiveZone("rear_sides");
                            }}
                          />
                        )}

                        {/* Etiquetas de Tonalidad en los Cristales */}
                        {latGeom.frontText && (
                          <text
                            x={latGeom.frontText.x}
                            y={latGeom.frontText.y}
                            textAnchor="middle"
                            fill={!isZoneAllowed("front_sides") ? "#94a3b8" : "#ffffff"}
                            fontSize="10.5"
                            fontWeight="bold"
                            className="pointer-events-none select-none drop-shadow"
                          >
                            Del. {!isZoneAllowed("front_sides") ? "Bloqueado" : shadeFrontSides.label}
                          </text>
                        )}
                        {latGeom.rearText && latGeom.rearText.x > 0 && (
                          <text
                            x={latGeom.rearText.x}
                            y={latGeom.rearText.y}
                            textAnchor="middle"
                            fill={!isZoneAllowed("rear_sides") ? "#94a3b8" : "#ffffff"}
                            fontSize="10.5"
                            fontWeight="bold"
                            className="pointer-events-none select-none drop-shadow"
                          >
                            Tras. {!isZoneAllowed("rear_sides") ? "Bloqueado" : shadeRearSides.label}
                          </text>
                        )}

                      </svg>
                    );
                  })()}
                </div>
              ) : (
                /* ================= VISTA SUPERIOR (PLANTA) ================= */
                <div
                  className={`transition-all duration-300 shrink-0 ${
                    isVehicleHorizontal
                      ? "relative w-[210px] h-[380px] transform -rotate-90 origin-center scale-[1.0] sm:scale-[1.12] md:scale-[1.20]"
                      : "relative w-full h-full"
                  }`}
                >
                  {/* 1. Imagen Top-Down Realista de la Carrocería */}
                  <img
                    src={getVehicleImageUrl(matchedBlueprint?.top_image) || VEHICLE_CATEGORIES.find((c) => c.id === selectedVehicleType)?.image || "/vehicles/clean_camioneta_doble_cabina.png"}
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
                          fill={
                            !isZoneAllowed("windshield") && !isSunstripOnly
                              ? "rgba(220, 240, 255, 0.04)"
                              : isSunstripOnly
                              ? "rgba(220, 240, 255, 0.05)"
                              : shadeWindshield.fill
                          }
                          fillOpacity={
                            !isZoneAllowed("windshield") && !isSunstripOnly
                              ? 0.12
                              : isSunstripOnly
                              ? 0.18
                              : shadeWindshield.opacity
                          }
                          stroke={
                            !isZoneAllowed("windshield") && !isSunstripOnly
                              ? "rgba(148, 163, 184, 0.35)"
                              : activeZone === "windshield"
                              ? "#38bdf8"
                              : shadeWindshield.border
                          }
                          strokeWidth={activeZone === "windshield" ? "3.5" : "1.5"}
                          strokeDasharray={!isZoneAllowed("windshield") && !isSunstripOnly ? "4 3" : undefined}
                          filter={activeZone === "windshield" ? "url(#neonGlowActive)" : undefined}
                          className={
                            !isZoneAllowed("windshield") && !isSunstripOnly
                              ? "cursor-not-allowed opacity-45"
                              : "cursor-pointer transition-all hover:opacity-90"
                          }
                          onClick={() => {
                            if (!isZoneAllowed("windshield") && !isSunstripOnly) {
                              toast.info("Parabrisas delantero no contratado en este servicio.");
                              return;
                            }
                            setActiveZone("windshield");
                          }}
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
                              if (isSunstripOnly) {
                                toast.info("La Banda Frontal Superior es el servicio contratado.");
                                return;
                              }
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
                              if (isSunstripOnly) {
                                toast.warning("La banda inferior no está incluida en el servicio de Franja Superior.");
                                return;
                              }
                              setActiveZone("windshield");
                              handleToggleSunstrip("windshield_bottom", !sunstrips.windshield_bottom?.enabled);
                            }}
                          />
                        )}

                        <text
                          x="100"
                          y={geom.windshield.textY}
                          textAnchor="middle"
                          fill={!isZoneAllowed("windshield") && !isSunstripOnly ? "#94a3b8" : "#ffffff"}
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
                          fill={!isZoneAllowed("windshield") && !isSunstripOnly ? "#94a3b8" : "#e0f2fe"}
                          fontSize="7"
                          fontWeight="600"
                          transform={textRotation ? `${textRotation}${geom.windshield.subY})` : undefined}
                          className="pointer-events-none select-none"
                        >
                          {!isZoneAllowed("windshield") && !isSunstripOnly
                            ? "Bloqueado"
                            : isSunstripOnly
                            ? "Solo Banda Frontal"
                            : `${shadeWindshield.label}${secondLayers.windshield?.enabled ? " + 2da" : ""}`}
                        </text>

                        {/* 2. VENTANAS DELANTERAS */}
                        {geom.front_sides.map((p, idx) => (
                          <path
                            key={`fs-${idx}`}
                            d={p.d}
                            fill={!isZoneAllowed("front_sides") ? "rgba(220, 240, 255, 0.04)" : shadeFrontSides.fill}
                            fillOpacity={!isZoneAllowed("front_sides") ? 0.12 : shadeFrontSides.opacity}
                            stroke={
                              !isZoneAllowed("front_sides")
                                ? "rgba(148, 163, 184, 0.35)"
                                : isFrontSidesActive
                                ? "#eab308"
                                : shadeFrontSides.border
                            }
                            strokeWidth={isFrontSidesActive && isZoneAllowed("front_sides") ? "3.5" : "1.5"}
                            strokeDasharray={!isZoneAllowed("front_sides") ? "4 3" : undefined}
                            filter={isFrontSidesActive && isZoneAllowed("front_sides") ? "url(#neonGlowYellow)" : undefined}
                            className={!isZoneAllowed("front_sides") ? "cursor-not-allowed opacity-45" : "cursor-pointer transition-all hover:opacity-90"}
                            onClick={() => {
                              if (!isZoneAllowed("front_sides")) {
                                toast.info("Ventanas delanteras no contratadas en este servicio.");
                                return;
                              }
                              setActiveZone("front_sides");
                            }}
                          />
                        ))}

                        {/* 3. VENTANAS TRASERAS */}
                        {geom.rear_sides.map((p, idx) => (
                          <path
                            key={`rs-${idx}`}
                            d={p.d}
                            fill={!isZoneAllowed("rear_sides") ? "rgba(220, 240, 255, 0.04)" : shadeRearSides.fill}
                            fillOpacity={!isZoneAllowed("rear_sides") ? 0.12 : shadeRearSides.opacity}
                            stroke={
                              !isZoneAllowed("rear_sides")
                                ? "rgba(148, 163, 184, 0.35)"
                                : isSidesLinkedActive
                                ? "#eab308"
                                : activeZone === "rear_sides"
                                ? "#f97316"
                                : shadeRearSides.border
                            }
                            strokeWidth={isRearSidesActive && isZoneAllowed("rear_sides") ? "3.5" : "1.5"}
                            strokeDasharray={!isZoneAllowed("rear_sides") ? "4 3" : undefined}
                            filter={
                              isSidesLinkedActive && isZoneAllowed("rear_sides")
                                ? "url(#neonGlowYellow)"
                                : activeZone === "rear_sides" && isZoneAllowed("rear_sides")
                                ? "url(#neonGlowOrange)"
                                : undefined
                            }
                            className={!isZoneAllowed("rear_sides") ? "cursor-not-allowed opacity-45" : "cursor-pointer transition-all hover:opacity-90"}
                            onClick={() => {
                              if (!isZoneAllowed("rear_sides")) {
                                toast.info("Ventanas traseras no contratadas en este servicio.");
                                return;
                              }
                              setActiveZone("rear_sides");
                            }}
                          />
                        ))}

                        {/* 4. PARABRISAS TRASERO */}
                        <path
                          d={geom.rear.d}
                          fill={!isZoneAllowed("rear") ? "rgba(220, 240, 255, 0.04)" : shadeRear.fill}
                          fillOpacity={!isZoneAllowed("rear") ? 0.12 : shadeRear.opacity}
                          stroke={
                            !isZoneAllowed("rear")
                              ? "rgba(148, 163, 184, 0.35)"
                              : activeZone === "rear"
                              ? "#a855f7"
                              : shadeRear.border
                          }
                          strokeWidth={activeZone === "rear" && isZoneAllowed("rear") ? "3.5" : "1.5"}
                          strokeDasharray={!isZoneAllowed("rear") ? "4 3" : undefined}
                          filter={activeZone === "rear" && isZoneAllowed("rear") ? "url(#neonGlowPurple)" : undefined}
                          className={!isZoneAllowed("rear") ? "cursor-not-allowed opacity-45" : "cursor-pointer transition-all hover:opacity-90"}
                          onClick={() => {
                            if (!isZoneAllowed("rear")) {
                              toast.info("Parabrisas trasero no contratado en este servicio.");
                              return;
                            }
                            setActiveZone("rear");
                          }}
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
                          fill={!isZoneAllowed("rear") ? "#94a3b8" : "#ffffff"}
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
                          fill={!isZoneAllowed("rear") ? "#94a3b8" : "#f3e8ff"}
                          fontSize="7"
                          fontWeight="600"
                          transform={textRotation ? `${textRotation}${geom.rear.subY})` : undefined}
                          className="pointer-events-none select-none"
                        >
                          {!isZoneAllowed("rear")
                            ? "Bloqueado"
                            : empalmeRear
                            ? "Empalme 2x20\""
                            : `${shadeRear.label}${secondLayers.rear?.enabled ? " + 2da" : ""}`}
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
                      isSunstripOnly
                        ? "bg-amber-400 animate-pulse"
                        : activeZone === "windshield"
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
                      {isSunstripOnly ? "☀️ Film para Banda Frontal Superior" : activeZoneLabel}
                      {isSunstripOnly && (
                        <Badge className="bg-amber-500 text-white text-[9px] px-1.5 py-0 font-mono">
                          Banda Frontal
                        </Badge>
                      )}
                      {!isSunstripOnly && secondLayers[activeZone]?.enabled && (
                        <Badge className="bg-amber-600 text-white text-[9px] px-1.5 py-0 font-mono">
                          + Doble Capa
                        </Badge>
                      )}
                    </h4>
                  </div>
                </div>

                {!isSunstripOnly && allowedZones.length > 1 && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleApplyAll(selectedMaterials[activeZone])}
                      className="text-[10px] sm:text-xs h-7 px-2 text-zinc-700 dark:text-zinc-300 font-semibold"
                      title="Aplicar el material de este cristal a todas las zonas contratadas"
                    >
                      <Sparkles className="h-3 w-3 mr-1 text-amber-500" />
                      Aplicar a contratados
                    </Button>
                  </div>
                )}
              </div>

              {/* Controles Rápidos: Vincular Laterales, Doble Capa, Empalme 2x20 y Bandas de Sol */}
              {!isSunstripOnly && (
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
              )}

              {/* Selector de Material 2da Capa */}
              {!isSunstripOnly && secondLayers[activeZone]?.enabled && (
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

              {/* Notificación de Búsqueda Inteligente si se encontró en otra gama */}
              {searchMatchedInOtherGama && (
                <div className="mb-2 p-2 rounded-lg bg-blue-50/90 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center justify-between text-[10.5px] text-blue-900 dark:text-blue-200">
                  <div className="flex items-center gap-1.5 truncate">
                    <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="truncate">
                      No hay resultados en la gama actual. Mostrando <b>{filteredMaterials.length}</b> resultado(s) de otras gamas para <b>&quot;{searchTerm}&quot;</b>:
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedGama("all")}
                    className="ml-2 underline font-bold shrink-0 hover:text-blue-700 dark:hover:text-blue-300 text-[10px]"
                  >
                    Ver todas
                  </button>
                </div>
              )}

              {/* Lista de Films / Materiales */}
              <div className="space-y-1.5 max-h-52 sm:max-h-60 lg:max-h-72 overflow-y-auto pr-1">
                {filteredMaterials.length === 0 ? (
                  <div className="p-4 text-center space-y-1 text-xs text-muted-foreground bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700">
                    <p>No hay materiales que coincidan con los filtros seleccionados.</p>
                    {searchTerm && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSearchTerm("");
                          setSelectedGama("all");
                        }}
                        className="text-[11px] h-7 text-blue-600 dark:text-blue-400 font-semibold"
                      >
                        Limpiar filtros y ver catálogo completo
                      </Button>
                    )}
                  </div>
                ) : null}

                {filteredMaterials.map((mat) => {
                  const matId = mat.material_id || mat.id;
                  const isSelected = isSunstripOnly
                    ? sunstrips.windshield_top?.material_id === matId
                    : selectedMaterials[activeZone] === matId;
                  const is3M = mat.brand === "3M" || String(matId).includes("3m") || String(mat.family).includes("3M");
                  const isSolarGard = mat.brand === "Solar Gard" || (!is3M && mat.brand !== "Q1" && mat.brand !== "Raybar");
                  const isRaybar = mat.brand === "Raybar" || String(matId).includes("raybar");

                  const isQ1 = mat.brand === "Q1" || String(matId).includes("q1");

                  const matchedGama = OFFICIAL_GAMAS.find((g) => g.id === (mat.gama || mat.gama_id));

                  return (
                    <div
                      key={matId}
                      onClick={() => handleSelectMaterial(activeZone, matId)}
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
  product: PropTypes.object,
  initialPlan: PropTypes.object,
  currency: PropTypes.string,
  exchangeRate: PropTypes.number,
};

