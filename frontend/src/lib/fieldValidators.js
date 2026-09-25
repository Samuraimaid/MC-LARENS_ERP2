/**
 * U12 — Spanish field validators for blur→live timing.
 * Each returns { valid, message }.
 */

export function requiredText(label = "Este campo") {
  return (value) => {
    const v = String(value ?? "").trim();
    if (!v) {
      return { valid: false, message: `${label} es obligatorio` };
    }
    return { valid: true };
  };
}

export function requiredSku(value) {
  const v = String(value ?? "").trim();
  if (!v) {
    return { valid: false, message: "El SKU es obligatorio" };
  }
  if (v.length < 2) {
    return { valid: false, message: "El SKU debe tener al menos 2 caracteres" };
  }
  return { valid: true };
}

export function requiredProductName(value) {
  const v = String(value ?? "").trim();
  if (!v) {
    return { valid: false, message: "El nombre es obligatorio" };
  }
  if (v.length < 2) {
    return { valid: false, message: "Escribe un nombre más descriptivo" };
  }
  return { valid: true };
}

/** Price: required, must be a finite number >= 0 (0 allowed for free/service edge). */
export function requiredPrice(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return { valid: false, message: "El precio es obligatorio" };
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return { valid: false, message: "Ingresa un precio válido" };
  }
  if (n < 0) {
    return { valid: false, message: "El precio no puede ser negativo" };
  }
  return { valid: true };
}

export function requiredPersonName(label = "El nombre") {
  return (value) => {
    const v = String(value ?? "").trim();
    if (!v) {
      return { valid: false, message: `${label} es obligatorio` };
    }
    if (v.length < 2) {
      return { valid: false, message: `${label} es demasiado corto` };
    }
    return { valid: true };
  };
}

/** Phone number part (without prefix). Empty = invalid when required. */
export function requiredPhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) {
    return { valid: false, message: "El teléfono es obligatorio" };
  }
  if (digits.length < 8) {
    return { valid: false, message: "El teléfono debe tener al menos 8 dígitos" };
  }
  return { valid: true };
}

/**
 * Email optional: empty is OK; if present must look like email.
 */
export function optionalEmail(value) {
  const v = String(value ?? "").trim();
  if (!v) return { valid: true };
  // Simple pragmatic check — not RFC-full.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
    return { valid: false, message: "Revisa el formato del email (ej. cliente@correo.com)" };
  }
  return { valid: true };
}

/** Selection required (e.g. customer picked). */
export function requiredSelection(label = "una opción") {
  return (value) => {
    if (value == null || value === "" || value === false) {
      return { valid: false, message: `Selecciona ${label}` };
    }
    return { valid: true };
  };
}
