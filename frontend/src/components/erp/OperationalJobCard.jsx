import React, { useState } from "react";
import PropTypes from "prop-types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatDate, WORK_ORDER_STATUS } from "@/lib/utils";

import {
  ArrowLeftRight,
  Banknote,
  Building2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  GripVertical,
  Layers,
  Package,
  Palette,
  Phone,
  Trash2,
  Wrench,
  Zap,
} from "lucide-react";

const DEPARTMENT_META = {
  instalaciones: {
    label: "Instalación",
    icon: Wrench,
    tone: "border-rose-200 bg-rose-50/60 dark:border-rose-500/30 dark:bg-rose-500/10",
    badge: "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200",
  },
  electrico: {
    label: "Eléctrico",
    icon: Zap,
    tone: "border-indigo-200 bg-indigo-50/60 dark:border-indigo-500/30 dark:bg-indigo-500/10",
    badge: "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200",
  },
  polarizados: {
    label: "Polarizado",
    icon: Palette,
    tone: "border-fuchsia-200 bg-fuchsia-50/60 dark:border-fuchsia-500/30 dark:bg-fuchsia-500/10",
    badge: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-500/20 dark:text-fuchsia-200",
  },
};

const STATUS_TONES = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200",
  quality_check: "bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-200",
  pending_assignment: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
};

const SELLER_WORKFLOW_STEPS = [
  { key: "paid", label: "Pagado" },
  { key: "dispatch", label: "Despacho" },
  { key: "install", label: "Instalación" },
  { key: "done", label: "Listo" },
];

const BRANCH_LABELS = {
  branch_main: "Central",
  branch_north: "El Calvario",
  branch_south: "La Tigre",
};

export function resolveOperationalCardVariant({ role, profile } = {}) {
  const normalizedRole = String(role || "").toLowerCase();
  const normalizedProfile = String(profile || "").toLowerCase();

  if (normalizedRole === "cajero") {
    return "cajero";
  }
  if (["ventas", "jefe_vendedores", "jefe_tienda"].includes(normalizedRole)) {
    return "vendedor";
  }
  if (["gerencia", "supervisor", "recursos_humanos", "programador"].includes(normalizedRole)) {
    return "supervision";
  }
  if (normalizedRole === "coordinador_polarizados" || normalizedProfile === "polarizados") {
    return "coordinator_polarizados";
  }
  return "coordinator_instalaciones";
}

export function getOrderId(order, department) {
  return department === "polarizados" ? order.tint_order_id : order.work_order_id;
}

function getVehicleRecord(order, vehicles) {
  return (vehicles || []).find(
    (row) => row.vehicle_id === order.vehicle_id || row.id === order.vehicle_id
  );
}

export function getVehiclePlate(order, vehicle) {
  if (order?.vehicle_info?.plate) return String(order.vehicle_info.plate);
  if (vehicle?.plate) return String(vehicle.plate);
  if (typeof order?.vehicle_info === "string") {
    const match = order.vehicle_info.match(/\b[A-Z0-9]{3,}-?[A-Z0-9]{3,}\b/i);
    if (match) return match[0];
  }
  return null;
}

export function getVehicleShortLabel(order, vehicle) {
  const brand = order?.vehicle_info?.brand || vehicle?.brand || "";
  const model = order?.vehicle_info?.model || vehicle?.model || "";
  const short = `${brand} ${model}`.trim();
  if (short) return short;
  if (typeof order?.vehicle_info === "string" && order.vehicle_info) {
    return order.vehicle_info.split("·")[0].trim();
  }
  return "Sin vehículo";
}

function getAccessoriesList(order, department) {
  if (Array.isArray(order?.displayItems) && order.displayItems.length > 0) {
    return order.displayItems;
  }
  if (department === "polarizados") return order?.windows || order?.items || [];
  return order?.accessories || order?.items || [];
}

export function getJobCount(order, department) {
  const items = getAccessoriesList(order, department);
  if (!Array.isArray(items) || items.length === 0) return 0;
  if (department === "polarizados") return 1;
  return items.reduce((sum, item) => sum + Math.max(1, Number(item.quantity || 1)), 0);
}

function getWindowCount(order) {
  const windows = order?.windows;
  if (!Array.isArray(windows) || windows.length === 0) return 0;
  return windows.length;
}

export function getElapsedMinutes(isoDate) {
  if (!isoDate) return 0;
  const start = new Date(isoDate);
  if (Number.isNaN(start.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - start.getTime()) / 60000));
}

export function getElapsedLabel(isoDate) {
  const minutes = getElapsedMinutes(isoDate);
  if (!minutes && isoDate) return "0m";
  if (!minutes) return null;
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function getCashierUrgencyState(sale) {
  const minutes = getElapsedMinutes(sale?.created_at);
  if (minutes >= 120) {
    return {
      level: "critical",
      minutes,
      shellClass: (active = false) => (
        active
          ? "border-rose-500 bg-rose-50/60 ring-2 ring-rose-500/35 dark:border-rose-500 dark:bg-rose-500/10"
          : "border-rose-400 bg-rose-50/40 hover:border-rose-500 dark:border-rose-500/50 dark:bg-rose-500/10"
      ),
      chipClass:
        "border-rose-400 bg-rose-50 text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200",
    };
  }
  if (minutes >= 60) {
    return {
      level: "warning",
      minutes,
      shellClass: (active = false) => (
        active
          ? "border-amber-500 bg-amber-50/50 ring-1 ring-amber-500/30 dark:border-amber-500/40"
          : "border-amber-300 bg-amber-50/30 hover:border-amber-400 dark:border-amber-500/40 dark:bg-amber-500/10"
      ),
      chipClass:
        "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200",
    };
  }
  return {
    level: "normal",
    minutes,
    shellClass: (active = false) => (
      active
        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
        : "hover:border-primary/40"
    ),
    chipClass: "border-border",
  };
}

function getWaitLabel(order) {
  return getElapsedLabel(order.submitted_for_qc_at || order.start_time || order.assigned_at || order.created_at);
}

export function formatInstallList(order, department, maxItems = 4) {
  const items = getAccessoriesList(order, department);
  if (!Array.isArray(items) || items.length === 0) {
    return department === "polarizados" ? "Polarizado sin detalle" : "Sin accesorios listados";
  }
  const labels = items.slice(0, maxItems).map((item) => {
    const qty = Math.max(1, Number(item.quantity || 1));
    const name =
      item.product_name
      || item.description
      || item.window_type
      || "Producto";
    return qty > 1 ? `${name} ×${qty}` : name;
  });
  const extra = items.length - maxItems;
  if (extra > 0) labels.push(`+${extra} más`);
  return labels.join(" · ");
}

function getInvoicedAt(order) {
  return order?.sale_invoiced_at || order?.sale_created_at || null;
}

function getDispatchAt(order) {
  return order?.accessories_delivered_at || order?.warehouse_dispatch_completed_at || null;
}

function TimeMetaRow({ invoicedAt, dispatchAt, awaitingWarehouse }) {
  const invoicedLabel = getElapsedLabel(invoicedAt);
  const dispatchLabel = getElapsedLabel(dispatchAt);

  return (
    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px]">
      {invoicedLabel ? (
        <span className={getUrgencyTone(invoicedLabel)}>
          Facturada hace {invoicedLabel}
        </span>
      ) : null}
      {awaitingWarehouse ? (
        <span className="text-amber-600 dark:text-amber-400">Despacho pendiente</span>
      ) : dispatchLabel ? (
        <span className="text-emerald-700 dark:text-emerald-300">
          Despachado hace {dispatchLabel}
        </span>
      ) : null}
    </div>
  );
}

function getUrgencyTone(label) {
  if (!label) return "text-muted-foreground";
  const hoursMatch = label.match(/(\d+)h/);
  const hours = hoursMatch ? Number(hoursMatch[1]) : 0;
  const minutesOnly = !hoursMatch && label.endsWith("m") ? Number(label.replace("m", "")) : 0;
  const totalMinutes = hours * 60 + minutesOnly;
  if (totalMinutes >= 120) return "text-rose-600 dark:text-rose-400";
  if (totalMinutes >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

function getTechnicianName(order, department) {
  if (department === "polarizados") {
    return order.assigned_technician_name || order.technician_name || null;
  }
  return order.technician_name || null;
}

function getPrimaryReference(order, department) {
  return order.invoice_number || getOrderId(order, department) || "Sin referencia";
}

function getSellerWorkflowProgress(sale) {
  const workflow = String(sale?.workflow_state || "").toLowerCase();
  const payment = String(sale?.payment_status || sale?.status || "").toLowerCase();
  const dispatch = String(sale?.warehouse_dispatch_status || "").toLowerCase();

  if (payment !== "paid" && workflow === "awaiting_payment") {
    return { step: 0, label: "Pendiente de pago en caja", activeKey: "paid" };
  }
  if (workflow === "fulfilled") {
    return { step: 3, label: "Servicio completado", activeKey: "done" };
  }
  if (workflow === "ready_for_delivery") {
    return { step: 3, label: "Listo para entrega", activeKey: "done" };
  }
  if (
    workflow === "installation_pending"
    || workflow === "accessories_ready_for_installation"
    || dispatch === "completed"
  ) {
    return { step: 2, label: "En instalación / polarizado", activeKey: "install" };
  }
  if (workflow === "dispatch_pending" || workflow === "dispatch_in_progress" || dispatch === "pending") {
    return { step: 1, label: "Preparando despacho de bodega", activeKey: "dispatch" };
  }
  return { step: 1, label: "En proceso operativo", activeKey: "dispatch" };
}

function MetaChip({ children, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium",
        className
      )}
    >
      {children}
    </span>
  );
}

function CardShell({
  order,
  department,
  meta,
  compact,
  draggable,
  isDragging,
  onDragStart,
  onDragEnd,
  children,
  testId,
}) {
  return (
    <Card
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "overflow-hidden transition-shadow",
        meta.tone,
        draggable && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50 ring-2 ring-primary/40",
        compact ? "shadow-sm" : ""
      )}
      data-testid={testId}
    >
      <CardContent className={cn("flex gap-2", compact ? "p-3" : "p-4")}>
        {draggable ? (
          <GripVertical className="h-4 w-4 shrink-0 self-center text-muted-foreground" />
        ) : null}
        <div className="min-w-0 flex-1 space-y-1.5">{children}</div>
      </CardContent>
    </Card>
  );
}

function CoordinatorInstalacionesBody({ order, department, columnContext, vehicle }) {
  const awaitingWarehouse = department !== "polarizados" && order.awaiting_warehouse_handoff;
  const statusKey = String(order.status || "pending").toLowerCase();
  const technicianName = getTechnicianName(order, department);
  const plate = getVehiclePlate(order, vehicle);
  const isAssignedColumn = columnContext === "assigned";
  const installList = formatInstallList(order, department);

  return (
    <>
      <div className="flex items-center gap-2 min-w-0">
        <p className="text-sm font-semibold truncate">
          {getPrimaryReference(order, department)}
          {plate ? <span className="font-mono text-xs text-muted-foreground"> · {plate}</span> : null}
        </p>
        {isAssignedColumn ? (
          <Badge className={cn("shrink-0 text-[10px]", STATUS_TONES[statusKey] || STATUS_TONES.pending)}>
            {WORK_ORDER_STATUS[statusKey] || statusKey}
          </Badge>
        ) : awaitingWarehouse ? (
          <Badge variant="outline" className="shrink-0 border-amber-400 text-amber-700 dark:text-amber-300 text-[10px]">
            <Package className="h-3 w-3 mr-1" />
            Bodega
          </Badge>
        ) : (
          <Badge variant="outline" className="shrink-0 border-emerald-400 text-emerald-700 dark:text-emerald-300 text-[10px]">
            Asignable
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground truncate">
        {order.customer_name || "Sin cliente"} · {getVehicleShortLabel(order, vehicle)}
      </p>
      <p className="text-[11px] text-muted-foreground truncate">
        Vendedor: {order.salesperson_name || "—"}
        {isAssignedColumn && technicianName ? ` · Téc: ${technicianName}` : ""}
      </p>
      <p className="text-[11px] text-foreground/90 line-clamp-2 leading-snug">{installList}</p>
      {order.splitLabel ? (
        <p className="text-[10px] text-muted-foreground">Producto {order.splitLabel}</p>
      ) : null}
      <TimeMetaRow
        invoicedAt={getInvoicedAt(order)}
        dispatchAt={getDispatchAt(order)}
        awaitingWarehouse={awaitingWarehouse}
      />
    </>
  );
}

function CoordinatorPolarizadosBody({ order, department, columnContext, vehicle }) {
  const waitLabel = getWaitLabel(order);
  const statusKey = String(order.status || "pending").toLowerCase();
  const technicianName = getTechnicianName(order, department);
  const plate = getVehiclePlate(order, vehicle);
  const windowCount = getWindowCount(order);
  const isAssignedColumn = columnContext === "assigned";

  return (
    <>
      <div className="flex items-center gap-2 min-w-0">
        <p className="text-sm font-semibold truncate">
          {getPrimaryReference(order, department)}
          {plate ? <span className="font-mono text-xs text-muted-foreground"> · {plate}</span> : null}
        </p>
        {isAssignedColumn ? (
          <Badge className={cn("shrink-0 text-[10px]", STATUS_TONES[statusKey] || STATUS_TONES.pending)}>
            {WORK_ORDER_STATUS[statusKey] || statusKey}
          </Badge>
        ) : (
          <Badge variant="outline" className="shrink-0 border-fuchsia-400 text-fuchsia-700 dark:text-fuchsia-300 text-[10px]">
            Sin asignar
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground truncate">
        {order.customer_name || "Sin cliente"} · {getVehicleShortLabel(order, vehicle)}
      </p>
      <p className="text-[11px] text-muted-foreground truncate">
        Vendedor: {order.salesperson_name || "—"}
        {isAssignedColumn && technicianName ? ` · Polarizador: ${technicianName}` : ""}
      </p>
      <p className="text-[11px] text-foreground/90 line-clamp-2 leading-snug">
        {formatInstallList(order, department)}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <MetaChip className={DEPARTMENT_META.polarizados.badge}>1 vehículo</MetaChip>
        {windowCount > 0 ? (
          <MetaChip className="border-border bg-background/70">
            {windowCount} ventana{windowCount === 1 ? "" : "s"}
          </MetaChip>
        ) : null}
        {waitLabel ? (
          <MetaChip className={cn("border-transparent bg-transparent px-0", getUrgencyTone(waitLabel))}>
            En cola {waitLabel}
          </MetaChip>
        ) : null}
      </div>
      <TimeMetaRow invoicedAt={getInvoicedAt(order)} dispatchAt={getDispatchAt(order)} awaitingWarehouse={false} />
    </>
  );
}

function SupervisionBody({ order, department, columnContext, vehicle }) {
  const meta = DEPARTMENT_META[department] || DEPARTMENT_META.instalaciones;
  const DeptIcon = meta.icon;
  const jobCount = getJobCount(order, department);
  const waitLabel = getWaitLabel(order);
  const statusKey = String(order.status || "pending").toLowerCase();
  const technicianName = getTechnicianName(order, department);
  const plate = getVehiclePlate(order, vehicle);
  const branchLabel = BRANCH_LABELS[order.branch_id] || order.branch_id;
  const orderId = getOrderId(order, department);
  const awaitingWarehouse = department !== "polarizados" && order.awaiting_warehouse_handoff;
  const invoicedLabel = getElapsedLabel(getInvoicedAt(order));
  const dispatchLabel = getElapsedLabel(getDispatchAt(order));
  const paidLabel = getElapsedLabel(order.sale_paid_at);

  return (
    <>
      <div className="flex items-center gap-2 min-w-0">
        <p className="text-sm font-semibold truncate">{getPrimaryReference(order, department)}</p>
        {branchLabel ? (
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {branchLabel}
          </Badge>
        ) : null}
      </div>
      <p className="text-[10px] font-mono text-muted-foreground truncate">{orderId}</p>
      <p className="text-xs truncate">
        <span className="font-medium text-foreground">{order.customer_name || "Sin cliente"}</span>
        <span className="text-muted-foreground">
          {plate ? ` · ${plate}` : ""} · {getVehicleShortLabel(order, vehicle)}
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <MetaChip className={meta.badge}>
          <DeptIcon className="h-3 w-3 mr-1" />
          {meta.label}
        </MetaChip>
        <MetaChip className={STATUS_TONES[statusKey] || STATUS_TONES.pending}>
          {WORK_ORDER_STATUS[statusKey] || statusKey}
        </MetaChip>
        {awaitingWarehouse ? (
          <MetaChip className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200">
            Espera bodega
          </MetaChip>
        ) : null}
        {jobCount > 0 ? (
          <MetaChip className="border-border bg-background/70">
            {department === "polarizados" ? "1 vehículo" : `${jobCount} trabajos`}
          </MetaChip>
        ) : null}
        {order.estimated_time ? (
          <MetaChip className="border-border bg-background/70">~{order.estimated_time} min</MetaChip>
        ) : null}
      </div>
      <p className="text-[11px] text-muted-foreground truncate">
        Vendedor: {order.salesperson_name || "—"}
        {technicianName ? ` · Técnico: ${technicianName}` : columnContext === "pending" ? " · Sin asignar" : ""}
      </p>
      <p className="text-[11px] text-foreground/90 line-clamp-3 leading-snug">
        {formatInstallList(order, department, 6)}
      </p>
      <p className="text-[11px] text-muted-foreground">
        {invoicedLabel ? `Facturada hace ${invoicedLabel}` : null}
        {paidLabel ? `${invoicedLabel ? " · " : ""}Pagada hace ${paidLabel}` : null}
        {dispatchLabel ? ` · Despachada hace ${dispatchLabel}` : awaitingWarehouse ? " · Despacho pendiente" : ""}
        {waitLabel ? ` · En proceso ${waitLabel}` : ""}
      </p>
    </>
  );
}

const PAYMENT_TYPE_LABELS = {
  cash: "Efectivo",
  efectivo: "Efectivo",
  transfer: "Transferencia",
  transferencia: "Transferencia",
  card: "Tarjeta",
  tarjeta: "Tarjeta",
  credit: "Crédito",
  credito: "Crédito",
  mixed: "Mixto",
  mixto: "Mixto",
};

export function getCashierPaymentIcon(paymentType) {
  const key = String(paymentType || "").toLowerCase();
  if (["card", "tarjeta"].includes(key)) return CreditCard;
  if (["transfer", "transferencia"].includes(key)) return ArrowLeftRight;
  if (["mixed", "mixto"].includes(key)) return Layers;
  if (["credit", "credito"].includes(key)) return CreditCard;
  return Banknote;
}

function CajeroPaymentProgress({ sale }) {
  const total = Number(sale?.total_legal || sale?.net_to_collect || 0);
  const paid = Number(sale?.amount_paid || 0);
  const pending = Number(sale?.amount_pending || 0);
  if (total <= 0 || paid <= 0 || pending <= 0) return null;
  const pct = Math.min(100, Math.round((paid / total) * 100));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Pagado C${paid.toFixed(2)}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function CajeroItemsList({ sale }) {
  const [expanded, setExpanded] = useState(false);
  const items = Array.isArray(sale?.items_detail) ? sale.items_detail : [];
  const itemCount = Number(sale?.item_count || items.length || 0);
  if (!itemCount) {
    return <p className="text-[11px] text-foreground/90 leading-snug">Sin detalle de artículos</p>;
  }
  const visibleItems = expanded ? items : items.slice(0, 3);
  const hiddenCount = Math.max(0, items.length - 3);

  return (
    <div className="space-y-1">
      <ul className="text-[11px] text-foreground/90 leading-snug space-y-0.5">
        {(visibleItems.length ? visibleItems : [{ name: sale?.items_preview || "Artículos", quantity: itemCount }]).map((item, idx) => (
          <li key={`${item.name}-${idx}`} className="truncate">
            {item.name}
            {Number(item.quantity || 1) > 1 ? ` ×${item.quantity}` : ""}
          </li>
        ))}
      </ul>
      {hiddenCount > 0 ? (
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
          onClick={(event) => {
            event.stopPropagation();
            setExpanded((prev) => !prev);
          }}
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              Ver menos
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              Ver {hiddenCount} artículo{hiddenCount === 1 ? "" : "s"} más
            </>
          )}
        </button>
      ) : null}
    </div>
  );
}

function CajeroBody({
  sale,
  totalLabel,
  showBranchBadge = false,
  onQuickCollect,
  quickCollectBusy = false,
  quickCollectSaleId = "",
  canPurgeInvoice = false,
  onPurgeInvoice = null,
  purgeBusySaleId = "",
}) {
  const waitingLabel = getElapsedLabel(sale?.created_at);
  const urgency = getCashierUrgencyState(sale);
  const paymentKey = String(sale?.payment_type || sale?.payment_method || "").toLowerCase();
  const PaymentIcon = getCashierPaymentIcon(paymentKey);
  const paymentLabel = PAYMENT_TYPE_LABELS[paymentKey] || sale?.payment_type || sale?.payment_method || "Por definir";
  const isPartial = Number(sale?.amount_paid || 0) > 0 && Number(sale?.amount_pending || 0) > 0;
  const hasDiscount = Number(sale?.discounts_applied_amount || 0) > 0;
  const plate = sale?.vehicle_plate || getVehiclePlate(sale, null);
  const isCredit = paymentKey === "credito" || paymentKey === "credit";
  const isMixedPayment = paymentKey === "mixed" || paymentKey === "mixto";
  const canQuickCollect = Boolean(onQuickCollect) && Number(sale?.amount_pending || 0) > 0 && !isMixedPayment;
  const isCollecting = quickCollectBusy && quickCollectSaleId === sale?.sale_id;
  const isPurging = purgeBusySaleId === sale?.sale_id;
  const showPurgeButton = canPurgeInvoice && typeof onPurgeInvoice === "function";

  return (
    <>
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-sm font-semibold truncate">{sale?.invoice_number || sale?.sale_id}</p>
            {showBranchBadge && sale?.branch_name ? (
              <Badge variant="outline" className="shrink-0 text-[9px] px-1.5 py-0">
                <Building2 className="h-2.5 w-2.5 mr-0.5" />
                {sale.branch_name}
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {sale?.customer_name || "Cliente"}
            {plate ? <span className="font-mono"> · {plate}</span> : null}
          </p>
          {sale?.customer_phone ? (
            <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
              <Phone className="h-3 w-3 shrink-0" />
              <a
                href={`tel:${sale.customer_phone}`}
                className="hover:text-primary hover:underline"
                onClick={(event) => event.stopPropagation()}
              >
                {sale.customer_phone}
              </a>
            </p>
          ) : null}
        </div>
        <div className="text-right shrink-0 flex flex-col items-end gap-1">
          {showPurgeButton ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-rose-700 hover:text-rose-800 hover:bg-rose-50"
              disabled={Boolean(purgeBusySaleId)}
              title="Eliminar factura de caja"
              data-testid={`cashier-purge-invoice-${sale?.sale_id}`}
              onClick={(event) => {
                event.stopPropagation();
                onPurgeInvoice(sale);
              }}
            >
              <Trash2 className={cn("h-3.5 w-3.5", isPurging && "animate-pulse")} />
            </Button>
          ) : null}
          <div>
            <div className="inline-flex items-center gap-1 text-muted-foreground mb-0.5">
              <PaymentIcon className="h-3.5 w-3.5" title={paymentLabel} />
              <span className="text-[10px]">{paymentLabel}</span>
            </div>
            <p className="text-base font-bold tabular-nums text-primary">
              {totalLabel || `C$${Number(sale?.amount_pending || 0).toFixed(2)}`}
            </p>
            <p className="text-[10px] text-muted-foreground">Pendiente</p>
          </div>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground truncate">
        Vendedor: {sale?.salesperson_name || "—"}
        {sale?.item_count ? ` · ${sale.item_count} artículo${sale.item_count === 1 ? "" : "s"}` : ""}
      </p>
      <CajeroItemsList sale={sale} />
      <CajeroPaymentProgress sale={sale} />
      <div className="flex flex-wrap items-center gap-1.5">
        {waitingLabel ? (
          <MetaChip className={cn(urgency.chipClass, urgency.level === "normal" && getUrgencyTone(waitingLabel))}>
            {urgency.level === "critical" ? "Urgente · " : ""}
            En caja hace {waitingLabel}
          </MetaChip>
        ) : null}
        {sale?.needs_warehouse_dispatch ? (
          <MetaChip className="border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-500/40 dark:bg-orange-500/15 dark:text-orange-200">
            Despacho bodega pendiente
          </MetaChip>
        ) : null}
        {isCredit ? (
          <MetaChip className="border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-200">
            Crédito
          </MetaChip>
        ) : null}
        {isPartial ? (
          <MetaChip className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200">
            Pago parcial C${Number(sale.amount_paid).toFixed(2)}
          </MetaChip>
        ) : null}
        {hasDiscount ? (
          <MetaChip className="border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-500/40 dark:bg-violet-500/15 dark:text-violet-200">
            Desc. C${Number(sale.discounts_applied_amount).toFixed(2)}
          </MetaChip>
        ) : null}
        {sale?.has_installation ? (
          <MetaChip className="border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-200">
            Con instalación
          </MetaChip>
        ) : null}
      </div>
      {canQuickCollect ? (
        <Button
          type="button"
          size="sm"
          className="w-full h-8 text-xs"
          disabled={quickCollectBusy}
          onClick={(event) => {
            event.stopPropagation();
            onQuickCollect(sale);
          }}
        >
          {isCollecting ? "Cobrando..." : `Cobrar total C$${Number(sale.amount_pending || 0).toFixed(2)}`}
        </Button>
      ) : null}
    </>
  );
}

function SellerBody({ order, sale, vehicle, totalLabel }) {
  const source = sale || order || {};
  const workflow = getSellerWorkflowProgress(source);
  const plate = getVehiclePlate(source, vehicle);
  const customer = source.customer_name || "Sin cliente";
  const invoice = source.invoice_number || source.sale_id || "Sin factura";

  return (
    <>
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{invoice}</p>
          <p className="text-xs text-muted-foreground truncate">
            {customer}
            {plate ? ` · ${plate}` : ""}
          </p>
        </div>
        {totalLabel ? (
          <p className="text-sm font-semibold shrink-0 tabular-nums">{totalLabel}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        {SELLER_WORKFLOW_STEPS.map((step, index) => {
          const active = index <= workflow.step;
          return (
            <React.Fragment key={step.key}>
              <span
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  active ? "bg-emerald-500" : "bg-muted"
                )}
                title={step.label}
              />
            </React.Fragment>
          );
        })}
      </div>
      <p className="text-xs font-medium text-foreground">{workflow.label}</p>
      {source.created_at ? (
        <p className="text-[11px] text-muted-foreground">{formatDate(source.created_at)}</p>
      ) : null}
    </>
  );
}

function renderOperationalBody({
  variant,
  order,
  sale,
  department,
  vehicles,
  columnContext,
  totalLabel,
  showBranchBadge,
  onQuickCollect,
  quickCollectBusy,
  quickCollectSaleId,
  canPurgeInvoice,
  onPurgeInvoice,
  purgeBusySaleId,
}) {
  const vehicle = getVehicleRecord(order || sale, vehicles);

  if (variant === "coordinator_instalaciones") {
    return (
      <CoordinatorInstalacionesBody
        order={order}
        department={department}
        columnContext={columnContext}
        vehicle={vehicle}
      />
    );
  }
  if (variant === "coordinator_polarizados") {
    return (
      <CoordinatorPolarizadosBody
        order={order}
        department={department}
        columnContext={columnContext}
        vehicle={vehicle}
      />
    );
  }
  if (variant === "supervision") {
    return (
      <SupervisionBody
        order={order}
        department={department}
        columnContext={columnContext}
        vehicle={vehicle}
      />
    );
  }
  if (variant === "cajero") {
    return (
      <CajeroBody
        sale={sale}
        totalLabel={totalLabel}
        showBranchBadge={showBranchBadge}
        onQuickCollect={onQuickCollect}
        quickCollectBusy={quickCollectBusy}
        quickCollectSaleId={quickCollectSaleId}
        canPurgeInvoice={canPurgeInvoice}
        onPurgeInvoice={onPurgeInvoice}
        purgeBusySaleId={purgeBusySaleId}
      />
    );
  }
  return <SellerBody order={order} sale={sale} vehicle={vehicle} totalLabel={totalLabel} />;
}

export function OperationalJobCard({
  variant,
  order,
  sale = null,
  department = "instalaciones",
  vehicles = [],
  columnContext = "pending",
  compact = true,
  embedded = false,
  draggable = false,
  isDragging = false,
  onDragStart,
  onDragEnd,
  totalLabel = null,
  showBranchBadge = false,
  onQuickCollect = null,
  quickCollectBusy = false,
  quickCollectSaleId = "",
  canPurgeInvoice = false,
  onPurgeInvoice = null,
  purgeBusySaleId = "",
  className,
}) {
  const meta =
    variant === "cajero"
      ? {
          tone: "border-amber-200 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-500/10",
        }
      : DEPARTMENT_META[department] || DEPARTMENT_META.instalaciones;
  const orderId = order ? getOrderId(order, department) : sale?.sale_id;
  const body = renderOperationalBody({
    variant,
    order,
    sale,
    department,
    vehicles,
    columnContext,
    totalLabel,
    showBranchBadge,
    onQuickCollect,
    quickCollectBusy,
    quickCollectSaleId,
    canPurgeInvoice,
    onPurgeInvoice,
    purgeBusySaleId,
  });

  if (embedded) {
    return <div className={cn("space-y-1.5", className)}>{body}</div>;
  }

  return (
    <div className={className}>
      <CardShell
        order={order}
        department={department}
        meta={meta}
        compact={compact}
        draggable={draggable}
        isDragging={isDragging}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        testId={orderId ? `op-card-${orderId}` : "op-card-sale"}
      >
        {body}
      </CardShell>
    </div>
  );
}

OperationalJobCard.propTypes = {
  variant: PropTypes.oneOf([
    "coordinator_instalaciones",
    "coordinator_polarizados",
    "supervision",
    "vendedor",
    "cajero",
  ]).isRequired,
  order: PropTypes.object,
  sale: PropTypes.object,
  department: PropTypes.string,
  vehicles: PropTypes.array,
  columnContext: PropTypes.oneOf(["pending", "assigned", "list"]),
  compact: PropTypes.bool,
  embedded: PropTypes.bool,
  draggable: PropTypes.bool,
  isDragging: PropTypes.bool,
  onDragStart: PropTypes.func,
  onDragEnd: PropTypes.func,
  totalLabel: PropTypes.string,
  showBranchBadge: PropTypes.bool,
  onQuickCollect: PropTypes.func,
  quickCollectBusy: PropTypes.bool,
  quickCollectSaleId: PropTypes.string,
  canPurgeInvoice: PropTypes.bool,
  onPurgeInvoice: PropTypes.func,
  purgeBusySaleId: PropTypes.string,
  className: PropTypes.string,
};

export function OperationalAssignmentCard({
  variant,
  order,
  department,
  vehicles = [],
  children,
}) {
  const meta = DEPARTMENT_META[department] || DEPARTMENT_META.instalaciones;
  const vehicle = getVehicleRecord(order, vehicles);
  const orderId = getOrderId(order, department);
  const jobCount = getJobCount(order, department);
  const plate = getVehiclePlate(order, vehicle);

  const summary =
    variant === "coordinator_polarizados"
      ? `1 vehículo${getWindowCount(order) ? ` · ${getWindowCount(order)} ventanas` : ""}`
      : `${jobCount || 0} trabajo${jobCount === 1 ? "" : "s"}`;

  return (
    <Card className={cn("overflow-hidden", meta.tone)}>
      <CardContent className="space-y-3 p-3 sm:p-4">
        <OperationalJobCard
          variant={variant}
          order={order}
          department={department}
          vehicles={vehicles}
          columnContext="list"
          embedded
        />
        {variant === "supervision" ? (
          <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
            <MetaChip className="border-border bg-background/70">{summary}</MetaChip>
            {plate ? <MetaChip className="border-border bg-background/70 font-mono">{plate}</MetaChip> : null}
          </div>
        ) : null}
        <div data-testid={`op-assign-${orderId}`}>{children}</div>
      </CardContent>
    </Card>
  );
}

OperationalAssignmentCard.propTypes = {
  variant: PropTypes.string.isRequired,
  order: PropTypes.object.isRequired,
  department: PropTypes.string.isRequired,
  vehicles: PropTypes.array,
  children: PropTypes.node,
};