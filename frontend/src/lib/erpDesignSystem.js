/**
 * MC-LARENS ERP — Sistema visual unificado
 * ----------------------------------------
 * Reglas para pantallas y endpoints nuevos:
 * 1. Acciones: usar ERP_ACTION_BUTTONS (misma forma size="sm" variant="outline").
 * 2. Semántica de color: ERP_SEMANTIC_TONES — no hardcodear slate/emerald sueltos.
 * 3. Flujos multi-paso (venta, cotización, despacho…): SaleFlowStepProgress o buildSaleFlowSteps().
 * 4. Borradores: DraftBoardCard con ownerUserId para privacidad visual.
 * 5. Carrito vacío: EmptyCartPlaceholder.
 * 6. Ahorro/descuento destacado: SavingsHighlightRow (umbral 0.01).
 * 7. Modo oscuro: siempre pares light + dark: en cada token.
 * 8. Micro-feedback: ui-interactive + animate-erp-unlock / animate-erp-pulse.
 * 9. Montos/cantidades dinámicos: ErpRollingCurrency / ErpRollingQuantity (counter roll vertical).
 * 10. Moneda en montos: formatCurrency() / getCurrencySymbol() — NIO=C$, USD=US$.
 */

import { CarFront, CreditCard, Package, ShoppingCart, User } from "lucide-react";
import { cn } from "@/lib/utils";

/** Iconos contextuales por paso del flujo de venta/cotización */
export const ERP_SALE_FLOW_STEP_ICONS = {
  1: User,
  2: CarFront,
  3: Package,
  4: ShoppingCart,
  5: CreditCard,
};

import {
  ERP_DRAFT_SUPERVISOR_ROLES,
  isErpDraftSupervisor,
  isOwnErpDraft,
} from "@/lib/roleHome";

export { ERP_DRAFT_SUPERVISOR_ROLES, isErpDraftSupervisor, isOwnErpDraft };

/** Botones de barra de formulario embebido — misma geometría en todo el ERP */
export const ERP_ACTION_BUTTONS = {
  base: "ui-interactive h-8 gap-1.5 px-3 text-xs font-medium sm:h-9 sm:text-sm",
  refresh: "border-input bg-background text-foreground hover:bg-muted",
  create: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/20 dark:text-emerald-200",
  save: "border-violet-500/40 bg-violet-500/10 text-violet-800 hover:bg-violet-500/20 dark:text-violet-200",
  saveClear: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/20 dark:text-emerald-200",
  clear: "border-rose-500/40 bg-rose-500/10 text-rose-800 hover:bg-rose-500/20 dark:text-rose-200",
  iconCreate: "text-emerald-700 dark:text-emerald-300",
  iconSave: "text-violet-700 dark:text-violet-300",
  iconSaveClear: "text-emerald-700 dark:text-emerald-300",
};

export function erpActionButtonClass(action, extra = "") {
  const tone = ERP_ACTION_BUTTONS[action] || ERP_ACTION_BUTTONS.refresh;
  return cn(ERP_ACTION_BUTTONS.base, tone, extra);
}

export const ERP_SEMANTIC_TONES = {
  company: {
    row: "border-blue-200 bg-blue-50/70 hover:bg-blue-100/80 dark:border-blue-500/30 dark:bg-blue-500/10 dark:hover:bg-blue-500/20",
    rowActive: "ring-2 ring-blue-300 dark:ring-blue-500/50",
    title: "text-slate-900 dark:text-slate-100",
    meta: "text-slate-700 dark:text-slate-300",
    badge: "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-100",
  },
  customer: {
    row: "border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/80 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20",
    rowActive: "ring-2 ring-emerald-300 dark:ring-emerald-500/50",
    title: "text-slate-900 dark:text-slate-100",
    meta: "text-slate-700 dark:text-slate-300",
    badge: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-100",
  },
  savings: {
    shell: "rounded-lg border border-green-200 bg-green-50/90 px-3 py-2 dark:border-green-500/35 dark:bg-green-500/10",
    label: "text-green-800 dark:text-green-300",
    amount: "font-mono font-semibold text-green-700 dark:text-green-400",
  },
  draftOwn: "border-border",
  draftOther: "border-dashed border-amber-400/60 dark:border-amber-500/40",
  draftBlocked: "opacity-55 saturate-50 pointer-events-none border-amber-300/70 dark:border-amber-500/40",
  draftReleased: "border-violet-300/60 dark:border-violet-500/35",
  reviewBadge: "border-amber-400/60 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-100",
  releasedBadge: "border-violet-400/50 bg-violet-50 text-violet-900 dark:border-violet-500/35 dark:bg-violet-500/10 dark:text-violet-100",
  restrictedBanner: "rounded-lg border border-violet-300/70 bg-violet-50/80 px-3 py-2 text-xs text-violet-900 dark:border-violet-500/35 dark:bg-violet-500/10 dark:text-violet-100",
};

const PRODUCT_TONE_MAP = {
  service: {
    base: "border-blue-200 bg-blue-50/70 dark:border-blue-500/30 dark:bg-blue-500/10",
    hover: "hover:border-blue-300 hover:bg-blue-100/80 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/15",
    selected: "border-blue-500 bg-blue-100/90 ring-2 ring-blue-200 dark:border-blue-500/50 dark:bg-blue-500/20 dark:ring-blue-500/30",
    title: "text-blue-950 dark:text-blue-100",
    sku: "text-blue-800/75 dark:text-blue-200/70",
    emphasisPrice: "text-blue-950 dark:text-blue-100",
  },
  in_stock: {
    base: "border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/30 dark:bg-emerald-500/10",
    hover: "hover:border-emerald-300 hover:bg-emerald-100/80 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-500/15",
    selected: "border-emerald-500 bg-emerald-100/90 ring-2 ring-emerald-200 dark:border-emerald-500/50 dark:bg-emerald-500/20 dark:ring-emerald-500/30",
    title: "text-emerald-950 dark:text-emerald-100",
    sku: "text-emerald-800/75 dark:text-emerald-200/70",
    emphasisPrice: "text-emerald-950 dark:text-emerald-100",
  },
  low_stock: {
    base: "border-amber-200 bg-amber-50/70 dark:border-amber-500/30 dark:bg-amber-500/10",
    hover: "hover:border-amber-300 hover:bg-amber-100/80 dark:hover:border-amber-500/40 dark:hover:bg-amber-500/15",
    selected: "border-amber-500 bg-amber-100/90 ring-2 ring-amber-200 dark:border-amber-500/50 dark:bg-amber-500/20 dark:ring-amber-500/30",
    title: "text-amber-950 dark:text-amber-100",
    sku: "text-amber-800/75 dark:text-amber-200/70",
    emphasisPrice: "text-amber-950 dark:text-amber-100",
  },
  out_of_stock: {
    base: "border-rose-200 bg-rose-50/70 dark:border-rose-500/30 dark:bg-rose-500/10",
    hover: "hover:border-rose-300 hover:bg-rose-100/80 dark:hover:border-rose-500/40 dark:hover:bg-rose-500/15",
    selected: "border-rose-500 bg-rose-100/90 ring-2 ring-rose-200 dark:border-rose-500/50 dark:bg-rose-500/20 dark:ring-rose-500/30",
    title: "text-rose-950 dark:text-rose-100",
    sku: "text-rose-800/75 dark:text-rose-200/70",
    emphasisPrice: "text-rose-950 dark:text-rose-100",
  },
};

export function getErpProductTone(stockStatus, isServiceProduct = false) {
  if (isServiceProduct) return PRODUCT_TONE_MAP.service;
  return PRODUCT_TONE_MAP[stockStatus] || PRODUCT_TONE_MAP.in_stock;
}

export function getErpCustomerSearchRowTone(isCompany, isHighlighted = false) {
  const tone = isCompany ? ERP_SEMANTIC_TONES.company : ERP_SEMANTIC_TONES.customer;
  return {
    row: cn("w-full min-h-[4.5rem] rounded-lg border p-2.5 text-left transition-all duration-300 ui-interactive", tone.row, isHighlighted ? tone.rowActive : ""),
    title: tone.title,
    meta: tone.meta,
    badge: tone.badge,
  };
}

export function buildSaleFlowSteps({
  stepOneComplete,
  stepTwoComplete,
  cartCount = 0,
  step4Label = "Carrito",
  step5Label = "Pago",
}) {
  const hasCart = cartCount > 0;
  const flowReadyForProducts = Boolean(stepOneComplete && stepTwoComplete);
  const productsComplete = flowReadyForProducts && hasCart;
  const cartAndPaymentReady = productsComplete;

  return [
    {
      id: 1,
      label: "Cliente",
      done: stepOneComplete,
      active: !stepOneComplete,
      locked: false,
    },
    {
      id: 2,
      label: "Vehículo",
      done: stepTwoComplete,
      active: stepOneComplete && !stepTwoComplete,
      locked: !stepOneComplete,
    },
    {
      id: 3,
      label: "Productos",
      done: productsComplete,
      active: flowReadyForProducts && !hasCart,
      locked: !flowReadyForProducts,
    },
    {
      id: 4,
      label: step4Label.replace(/^Paso \d+:\s*/i, "").split(" ")[0] || "Carrito",
      done: cartAndPaymentReady,
      active: false,
      locked: !flowReadyForProducts,
    },
    {
      id: 5,
      label: step5Label.replace(/^Paso \d+:\s*/i, "").split(" ")[0] || "Pago",
      done: false,
      active: cartAndPaymentReady,
      locked: !cartAndPaymentReady,
    },
  ];
}

export function formatErpRelativeTime(isoDate, nowMs = Date.now()) {
  if (!isoDate) return null;
  const parsed = new Date(isoDate).getTime();
  if (!Number.isFinite(parsed)) return null;
  const diffMs = Math.max(0, nowMs - parsed);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

export const ERP_ANIMATION_CLASSES = {
  unlock: "animate-erp-unlock transition-all duration-500",
  pulse: "animate-erp-pulse",
  stepLocked: "pointer-events-none opacity-50 transition-opacity duration-500",
  stepUnlocked: "opacity-100 transition-opacity duration-500",
};

export const ERP_SEARCH_ROW = {
  customer: "min-h-[4.5rem]",
  product: "min-h-[5.5rem]",
};