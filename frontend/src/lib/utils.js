import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount, currency = "NIO") {
  return new Intl.NumberFormat("es-NI", {
    style: "currency",
    currency: currency,
  }).format(amount);
}

export function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("es-GT", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatShortDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("es-GT", {
    month: "short",
    day: "numeric",
  }).format(date);
}

export function getStatusColor(status) {
  const colors = {
    pending: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
    in_progress: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
    quality_check: "bg-purple-500/20 text-purple-600 dark:text-purple-400",
    completed: "bg-green-500/20 text-green-600 dark:text-green-400",
    delivered: "bg-gray-500/20 text-gray-600 dark:text-gray-400",
    paid: "bg-green-500/20 text-green-600 dark:text-green-400",
    partial: "bg-orange-500/20 text-orange-600 dark:text-orange-400",
    approved: "bg-green-500/20 text-green-600 dark:text-green-400",
    rejected: "bg-red-500/20 text-red-600 dark:text-red-400",
    converted: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
  };
  return colors[status] || "bg-gray-500/20 text-gray-600 dark:text-gray-400";
}

export function getPriorityColor(priority) {
  const colors = {
    low: "bg-gray-500/20 text-gray-600 dark:text-gray-400",
    normal: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
    high: "bg-orange-500/20 text-orange-600 dark:text-orange-400",
    urgent: "bg-red-500/20 text-red-600 dark:text-red-400",
  };
  return colors[priority] || colors.normal;
}

export function getKDSStatusClass(status, createdAt) {
  const now = new Date();
  const created = new Date(createdAt);
  const minutesElapsed = (now - created) / 60000;
  
  if (status === "pending") {
    if (minutesElapsed > 30) return "kds-late";
    return "kds-new";
  }
  if (status === "in_progress") return "kds-prep";
  if (status === "quality_check") return "kds-prep";
  return "kds-done";
}

export const ROLES = {
  gerencia: { label: "Gerencia", color: "bg-purple-500" },
  supervisor: { label: "Supervisor", color: "bg-blue-500" },
  cajero: { label: "Cajero", color: "bg-emerald-500" },
  ventas: { label: "Ventas", color: "bg-green-500" },
  electrico: { label: "Eléctrico", color: "bg-indigo-500" },
  polarizador: { label: "Polarizador", color: "bg-pink-500" },
  transporte: { label: "Transporte", color: "bg-orange-500" },
  bodegas: { label: "Bodegas", color: "bg-yellow-500" },
  instalaciones: { label: "Instalaciones", color: "bg-red-500" },
};

export const PAYMENT_TYPES = {
  cash: "Contado",
  credit: "Crédito",
  stripe: "Tarjeta",
};

export const WORK_ORDER_STATUS = {
  pending: "Pendiente",
  in_progress: "En Proceso",
  quality_check: "Control Calidad",
  completed: "Completado",
  delivered: "Entregado",
};
