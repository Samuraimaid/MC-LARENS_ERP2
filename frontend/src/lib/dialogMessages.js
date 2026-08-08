import axios from "axios";
import { API_BASE as API } from "@/lib/api";

/** Fallback catalog (mirrors backend defaults) when API is unavailable */
export const DEFAULT_DIALOG_MESSAGES = {
  "sale.send_to_cashier": {
    category: "Ventas",
    label: "Enviar factura a caja (vendedor)",
    variant: "warning",
    title: "¿Enviar factura a caja?",
    description:
      "Antes de enviar, verifica productos, compatibilidades (vehículo/instalación), montos y descuentos. Una vez enviada a caja, cualquier modificación requiere aprobación de supervisión o gerencia.",
    checklist: [
      "Productos y cantidades correctas",
      "Compatibilidad con el vehículo / instalación",
      "Precios, totales y descuentos revisados",
      "Método de pago y plan de cobro en orden",
    ],
    primary_label: "Sí, enviar a caja",
    secondary_label: "Revisar de nuevo",
    submitting_label: "Enviando…",
  },
  "sale.change_price_tier": {
    category: "Ventas",
    label: "Cambiar rango de precios",
    variant: "warning",
    title: "Cambiar rango de precios",
    description: "Se actualizarán {count} línea(s) al rango {tier}.",
    description_supervisor: " Este cambio quedará registrado en auditoría.",
    description_precio2:
      " Precio 2 no es libre para vendedores de piso: después de aplicarlo debes solicitar y obtener aprobación de supervisión o gerencia (con motivo) antes de facturar.",
    primary_label: "Confirmar",
    primary_label_precio2: "Aplicar (requiere aprobación)",
    secondary_label: "Cancelar",
  },
  "sale.edit_product_price": {
    category: "Ventas",
    label: "Editar precio del producto",
    variant: "information",
    title: "Editar precio del producto",
    description: "{product_name}",
    primary_label: "Aplicar",
    secondary_label: "Cancelar",
  },
  "sale.clear_form": {
    category: "Ventas",
    label: "Limpiar formulario de venta",
    variant: "warning",
    title: "¿Limpiar formulario?",
    description:
      "Se borrarán todos los datos ingresados en la venta actual. Esta acción no se puede deshacer.",
    primary_label: "Sí, limpiar",
    secondary_label: "Cancelar",
  },
  "sale.print_receipt": {
    category: "Ventas",
    label: "Imprimir comprobante (post-caja)",
    variant: "information",
    title: "Imprimir comprobante",
    description_seller: "El vendedor solo puede emitir voucher térmico 80mm (no fiscal).",
    description_other: "Elige el formato de impresión para la venta seleccionada.",
    primary_label: "Voucher térmico 80mm",
    secondary_label: "PDF membretado",
    tertiary_label: "Comprobante de abono",
  },
  "sale.transfer_request": {
    category: "Ventas",
    label: "Solicitar traslado de stock",
    variant: "information",
    title: "Solicitar Traslado",
    description: "{product_name} no tiene stock en esta bodega pero está disponible en otras.",
    primary_label: "Solicitar Traslado",
    secondary_label: "Cancelar",
  },
  "sale.manager_auth": {
    category: "Ventas",
    label: "Autorización de gerente (instalación)",
    variant: "warning",
    title: "Autorización de Gerente Requerida",
    description:
      "Los siguientes productos son Solo para llevar y requieren autorización del gerente para ser instalados.",
    primary_label: "Confirmar Venta",
    secondary_label: "Generar Código (Gerente)",
  },
  "quote.clear_form": {
    category: "Cotizaciones",
    label: "Limpiar formulario de cotización",
    variant: "warning",
    title: "¿Limpiar formulario?",
    description:
      "Se borrarán todos los datos ingresados en la cotización actual. Esta acción no se puede deshacer.",
    primary_label: "Sí, limpiar",
    secondary_label: "Cancelar",
  },
  "customer.delete_vehicle": {
    category: "Clientes",
    label: "Eliminar vehículo",
    variant: "error",
    title: "Eliminar vehículo",
    description: "Esta acción no se puede deshacer. ¿Deseas eliminar el vehículo seleccionado?",
    primary_label: "Eliminar",
    secondary_label: "Cancelar",
  },
  "customer.credit_auth": {
    category: "Clientes",
    label: "Autorización de crédito",
    variant: "warning",
    title: "Autorización de Crédito",
    description: "Se requiere autorización del gerente para asignar límite de crédito de {amount}",
    primary_label: "Confirmar",
    secondary_label: "Generar Código (Gerente)",
  },
  "returns.reject": {
    category: "Devoluciones",
    label: "Rechazar devolución",
    variant: "error",
    title: "Rechazar Devolución",
    description: "Indica la razón del rechazo. Esta acción quedará registrada.",
    primary_label: "Confirmar Rechazo",
    secondary_label: "Cancelar",
  },
  "catalog.select_draft": {
    category: "Catálogo",
    label: "Seleccionar borrador",
    variant: "question",
    title: "Selecciona el borrador",
    description: "Elige dónde agregar el producto antes de continuar.",
    primary_label: "Nuevo borrador",
    secondary_label: "Cancelar",
  },
  "catalog.whatsapp": {
    category: "Catálogo",
    label: "Enviar por WhatsApp",
    variant: "information",
    title: "Enviar por WhatsApp",
    description: "Selecciona un cliente o usa el envío por lotes.",
    primary_label: "Enviar",
    secondary_label: "Cancelar",
  },
  "driver.proof_delivery": {
    category: "Entregas",
    label: "Foto-evidencia de entrega",
    variant: "warning",
    title: "Foto-evidencia obligatoria",
    description:
      "Capture la entrega con la cámara del celular. Se estampará marca de agua con fecha/hora y GPS del dispositivo.",
    primary_label: "Confirmar entrega",
    secondary_label: "Cancelar",
  },
  "pricing.precio2_banner": {
    category: "Ventas",
    label: "Banner Precio 2 (estados)",
    variant: "warning",
    title: "Precio 2",
    description_none:
      "Hay líneas con Precio 2. Los vendedores de piso deben solicitar y obtener aprobación de supervisión/gerencia antes de facturar.",
    description_pending:
      "Solicitud de Precio 2 pendiente. Espera la aprobación de supervisión o gerencia (no puedes facturar aún).",
    description_approved: "Precio 2 autorizado por supervisión/gerencia. Ya puedes facturar.",
    description_rejected:
      "La solicitud de Precio 2 fue rechazada. Vuelve a Precio 1 o solicita de nuevo con otro motivo.",
    primary_label: "Solicitar Precio 2",
    primary_label_pending: "Esperando aprobación…",
    primary_label_rejected: "Solicitar de nuevo",
  },
  "pricing.precio2_hint": {
    category: "Ventas",
    label: "Aviso selector de rango (Precio 2)",
    variant: "warning",
    title: "Precio 2 requiere aprobación",
    description:
      "* Precio 2 no es libre para vendedores de piso: al usarlo debes solicitar y obtener aprobación de supervisión o gerencia (con motivo) antes de facturar.",
  },
};

let cacheByKey = { ...DEFAULT_DIALOG_MESSAGES };
let cacheLoadedAt = 0;
let inflight = null;

export function interpolateDialogText(template, vars = {}) {
  if (template == null) return "";
  return String(template).replace(/\{(\w+)\}/g, (_, name) => {
    if (vars[name] == null) return "";
    return String(vars[name]);
  });
}

export function getDialogMessageSync(key, vars = {}) {
  const base = cacheByKey[key] || DEFAULT_DIALOG_MESSAGES[key] || {};
  const resolved = { key, ...base };
  for (const [field, value] of Object.entries(resolved)) {
    if (typeof value === "string") {
      resolved[field] = interpolateDialogText(value, vars);
    }
  }
  if (Array.isArray(base.checklist)) {
    resolved.checklist = base.checklist.map((line) => interpolateDialogText(line, vars));
  }
  return resolved;
}

export function getDialogMessagesCache() {
  return cacheByKey;
}

export async function loadDialogMessages({ force = false } = {}) {
  const staleMs = 60_000;
  if (!force && cacheLoadedAt && Date.now() - cacheLoadedAt < staleMs) {
    return cacheByKey;
  }
  if (inflight && !force) return inflight;

  inflight = axios
    .get(`${API}/settings/dialog-messages`, { withCredentials: true })
    .then((response) => {
      const byKey = response.data?.by_key || {};
      cacheByKey = { ...DEFAULT_DIALOG_MESSAGES, ...byKey };
      cacheLoadedAt = Date.now();
      return cacheByKey;
    })
    .catch(() => {
      cacheByKey = { ...DEFAULT_DIALOG_MESSAGES };
      cacheLoadedAt = Date.now();
      return cacheByKey;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function seedDialogMessagesCache(byKey) {
  if (!byKey || typeof byKey !== "object") return;
  cacheByKey = { ...DEFAULT_DIALOG_MESSAGES, ...byKey };
  cacheLoadedAt = Date.now();
}
