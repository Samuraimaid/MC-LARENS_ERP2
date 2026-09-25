/**
 * U11 — map raw API `detail` / English errors to plain Spanish toasts
 * that hand the user a fix when possible.
 */

const DEFAULT_ES = "Eso no se pudo completar — inténtalo de nuevo";

/** @type {Array<[RegExp|string, string]>} */
const DETAIL_MAP = [
  [/sku already exists/i, "Ese SKU ya existe — usa otro código o edita el producto existente."],
  [/product not found/i, "No encontramos ese producto. Revisa el SKU o créalo en Inventario."],
  [/customer not found/i, "No encontramos ese cliente. ¿Quieres registrarlo?"],
  [/vehicle not found/i, "No encontramos ese vehículo. Revisa la placa o regístralo."],
  [/warehouse not found/i, "No encontramos esa bodega. Elige otra bodega e inténtalo de nuevo."],
  [/sale not found/i, "No encontramos esa venta. Actualiza la lista e inténtalo de nuevo."],
  [/approval already processed/i, "Esa solicitud ya fue procesada. Actualiza la lista."],
  [/approval not found/i, "No encontramos esa solicitud de aprobación. Actualiza la lista."],
  [/invalid session/i, "Tu sesión expiró — vuelve a iniciar sesión."],
  [/insufficient.?stock|stock insuficiente|not enough stock/i, "No hay stock suficiente. Revisa existencias o elige otra bodega."],
  [/duplicate|already exists|ya existe/i, "Ese registro ya existe — revisa los datos o edita el existente."],
  [/permission|forbidden|not allowed|no tienes permiso|unauthorized/i, "No tienes permiso para esta acción. Pide ayuda a un gerente."],
  [/invalid input|validation error|unprocessable/i, "Revisa los campos marcados e inténtalo de nuevo."],
  [/network error|failed to fetch|timeout|econnrefused/i, "Sin conexión con el servidor — revisa la red e inténtalo de nuevo."],
  [/^error$/i, DEFAULT_ES],
  [/^ERROR:?\s*operation failed$/i, DEFAULT_ES],
  [/operation failed/i, DEFAULT_ES],
];

function normalizeDetail(detail) {
  if (detail == null) return "";
  if (typeof detail === "string") return detail.trim();
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          return item.msg || item.message || item.error || "";
        }
        return "";
      })
      .filter(Boolean)
      .join("; ");
  }
  if (typeof detail === "object") {
    if (typeof detail.message === "string" && detail.message.trim()) return detail.message.trim();
    if (typeof detail.error === "string" && detail.error.trim()) return detail.error.trim();
    if (typeof detail.detail === "string" && detail.detail.trim()) return detail.detail.trim();
    try {
      return JSON.stringify(detail);
    } catch {
      return "";
    }
  }
  return String(detail);
}

function looksEnglishOrRaw(text) {
  if (!text) return true;
  if (/^(ERROR|Exception|Traceback|TypeError|ValueError|KeyError)\b/i.test(text)) return true;
  if (/\b(not found|already exists|invalid|forbidden|unauthorized|failed|required)\b/i.test(text)) {
    return true;
  }
  // Mostly ASCII technical jargon without Spanish accents/common words
  if (/^[A-Za-z0-9 _\-.:/"']+$/.test(text) && /\b(error|failed|invalid|not)\b/i.test(text)) {
    return true;
  }
  return false;
}

/**
 * @param {unknown} errorOrDetail — axios error, response detail, or string
 * @param {string} [fallback] — Spanish fallback when nothing maps
 * @returns {string}
 */
export function humanApiError(errorOrDetail, fallback = DEFAULT_ES) {
  let raw = "";
  if (errorOrDetail && typeof errorOrDetail === "object" && errorOrDetail.response) {
    raw = normalizeDetail(errorOrDetail.response?.data?.detail ?? errorOrDetail.response?.data?.message);
    if (!raw && typeof errorOrDetail.message === "string") raw = errorOrDetail.message;
  } else if (errorOrDetail && typeof errorOrDetail === "object" && "detail" in errorOrDetail) {
    raw = normalizeDetail(errorOrDetail.detail);
  } else {
    raw = normalizeDetail(errorOrDetail);
  }

  if (!raw) return fallback || DEFAULT_ES;

  for (const [pattern, message] of DETAIL_MAP) {
    if (pattern instanceof RegExp) {
      if (pattern.test(raw)) return message;
    } else if (String(raw).toLowerCase().includes(String(pattern).toLowerCase())) {
      return message;
    }
  }

  // Already friendly Spanish — keep it
  if (!looksEnglishOrRaw(raw) && raw.length < 220) {
    return raw;
  }

  return fallback || DEFAULT_ES;
}

export const HUMAN_API_ERROR_DEFAULT = DEFAULT_ES;
