/**
 * U15 — Password / PIN coaching helpers (video 15).
 * Strength ≈ entropy; length beats symbols. Coach passphrases.
 * Do NOT lead with “must have symbol” rules.
 * Spanish checklist + meter: Débil → Regular → Casi → Fuerte.
 */

/** @typedef {{ id: string, label: string, ok: boolean, soft?: boolean }} ChecklistItem */
/** @typedef {{ score: number, level: 'empty'|'weak'|'fair'|'almost'|'strong', label: string, tip: string, percent: number, items: ChecklistItem[], entropy?: number }} StrengthResult */

const WEAK_SEQUENCES = [
  "0123456789",
  "9876543210",
  "1234567890",
  "0987654321",
];

const COMMON_WEAK = new Set([
  "password",
  "password1",
  "12345678",
  "123456789",
  "qwerty",
  "qwertyui",
  "admin",
  "admin123",
  "letmein",
  "welcome",
  "mclaren",
  "mclarens",
  "nicaragua",
]);

function charClasses(value) {
  const v = String(value ?? "");
  return {
    lower: /[a-záéíóúüñ]/.test(v),
    upper: /[A-ZÁÉÍÓÚÜÑ]/.test(v),
    digit: /\d/.test(v),
    other: /[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ0-9\s]/.test(v),
    space: /\s/.test(v),
  };
}

function classCount(value) {
  const c = charClasses(value);
  // Spaces count toward passphrase variety (length/entropy), not as a “symbol rule”.
  return [c.lower, c.upper, c.digit, c.other || c.space].filter(Boolean).length;
}

function wordLikeCount(value) {
  const parts = String(value ?? "")
    .trim()
    .split(/[\s\-_.]+/)
    .filter((p) => p.length >= 2);
  return parts.length;
}

/** Rough entropy bits ≈ len * log2(charset). */
export function estimateEntropyBits(value) {
  const v = String(value ?? "");
  if (!v) return 0;
  const c = charClasses(v);
  let charset = 0;
  if (c.lower) charset += 26;
  if (c.upper) charset += 26;
  if (c.digit) charset += 10;
  if (c.other) charset += 20;
  if (c.space) charset += 1;
  if (charset < 10) charset = Math.max(charset, new Set(v).size || 1);
  return Math.round(v.length * Math.log2(charset || 2) * 10) / 10;
}

function looksSequentialDigits(digits) {
  const d = String(digits ?? "");
  if (d.length < 3) return false;
  for (const seq of WEAK_SEQUENCES) {
    if (seq.includes(d)) return true;
  }
  let up = true;
  let down = true;
  for (let i = 1; i < d.length; i += 1) {
    const a = Number(d[i - 1]);
    const b = Number(d[i]);
    if (b !== a + 1) up = false;
    if (b !== a - 1) down = false;
  }
  return up || down;
}

function allSameChar(value) {
  const v = String(value ?? "");
  if (v.length < 2) return false;
  return [...v].every((ch) => ch === v[0]);
}

function constructiveHint({ len, words, classes, entropy, common, sequential, same }) {
  if (common || same) return "Evitá palabras o patrones obvios; probá una frase propia.";
  if (sequential) return "Esa secuencia es fácil de adivinar — mezclá el orden.";
  if (len < 8) return "+ largo: llegá al menos a 8 caracteres.";
  if (len < 12 && words < 2) return "+ largo o + palabras: una frase corta suele bastar.";
  if (len < 12) return "+ largo: 12+ caracteres mejoran la entropía más que un símbolo.";
  if (words < 3 && len < 16) return "+ palabras: uní 3–4 palabras fáciles de recordar.";
  if (classes < 2 && entropy < 50) return "+ variedad suave: letras y números (sin obsesionarte con símbolos).";
  if (entropy < 60) return "+ largo: un par de caracteres más ya ayuda.";
  return "Excelente: longitud y variedad suficientes.";
}

/**
 * Password coaching: entropy/length first; symbols are never the lead tip.
 * Meter labels: Débil → Regular → Casi → Fuerte.
 * @param {string} value
 * @returns {StrengthResult}
 */
export function assessPassword(value) {
  const v = String(value ?? "");
  const emptyItems = [
    { id: "len8", label: "Al menos 8 caracteres", ok: false },
    { id: "len12", label: "12 o más caracteres (mejor)", ok: false, soft: true },
    { id: "passphrase", label: "Varias palabras (frase)", ok: false, soft: true },
    { id: "variety", label: "Letras y números (u otros)", ok: false, soft: true },
    { id: "notCommon", label: "Nada obvio ni repetido", ok: false, soft: true },
  ];

  if (!v) {
    return {
      score: 0,
      level: "empty",
      label: "Escribe una contraseña",
      tip: "Priorizá longitud: una frase de varias palabras suele ganar a un solo símbolo.",
      percent: 0,
      items: emptyItems,
      entropy: 0,
    };
  }

  const len = v.length;
  const classes = classCount(v);
  const words = wordLikeCount(v);
  const entropy = estimateEntropyBits(v);
  const common = COMMON_WEAK.has(v.toLowerCase().replace(/\s+/g, ""));
  const digitOnly = /^\d+$/.test(v);
  const sequential = digitOnly && looksSequentialDigits(v);
  const same = allSameChar(v.replace(/\s/g, ""));

  const items = [
    { id: "len8", label: "Al menos 8 caracteres", ok: len >= 8 },
    { id: "len12", label: "12 o más caracteres (mejor)", ok: len >= 12, soft: true },
    {
      id: "passphrase",
      label: "Varias palabras (frase)",
      ok: words >= 3 || (words >= 2 && len >= 12),
      soft: true,
    },
    {
      id: "variety",
      label: "Letras y números (u otros)",
      ok: classes >= 2,
      soft: true,
    },
    {
      id: "notCommon",
      label: "Nada obvio ni repetido",
      ok: !common && !sequential && !same,
      soft: true,
    },
  ];

  // Score 0–4 from length + entropy (symbols never required).
  let score = 0;
  if (len >= 8) score += 1;
  if (len >= 12 || (words >= 3 && len >= 10)) score += 1;
  if (entropy >= 40 || (len >= 10 && classes >= 2) || words >= 3) score += 1;
  if (entropy >= 60 || (len >= 16 && words >= 3) || (len >= 14 && classes >= 2)) score += 1;
  if (common || same || (sequential && len <= 12)) {
    score = Math.min(score, 1);
  }

  /** @type {StrengthResult['level']} */
  let level = "weak";
  /** Meter coach labels (video 15): Débil → Regular → Casi → Fuerte */
  let label = "Débil";

  if (score <= 1) {
    level = "weak";
    label = "Débil";
  } else if (score === 2) {
    level = "fair";
    label = "Regular";
  } else if (score === 3) {
    level = "almost";
    label = "Casi";
  } else {
    level = "strong";
    label = "Fuerte";
  }

  const tip = constructiveHint({ len, words, classes, entropy, common, sequential, same });
  const percent = Math.min(100, Math.round((score / 4) * 100));

  return { score, level, label, tip, percent, items, entropy };
}

/**
 * PIN coaching aligned with ERP backend (login 8 / kiosk·attendance 4).
 * Soft tips for weak patterns — no new backend policy.
 * @param {string} value
 * @param {{ length?: number, label?: string }} [opts]
 * @returns {StrengthResult}
 */
export function assessPin(value, opts = {}) {
  const target = Number(opts.length) > 0 ? Number(opts.length) : 8;
  const pinLabel = opts.label || `PIN de ${target} dígitos`;
  const raw = String(value ?? "");
  const digits = raw.replace(/\D/g, "");
  const len = digits.length;
  const onlyDigits = raw.length === 0 || /^\d*$/.test(raw);
  const exact = len === target;
  const sequential = looksSequentialDigits(digits);
  const same = allSameChar(digits);

  const items = [
    { id: "digitsOnly", label: "Solo números", ok: onlyDigits && len > 0 },
    { id: "length", label: `${target} dígitos exactos`, ok: exact },
    {
      id: "notSequential",
      label: "Evita secuencias tipo 1234…",
      ok: len === 0 ? false : !sequential,
      soft: true,
    },
    {
      id: "notSame",
      label: "Evita repetir el mismo dígito",
      ok: len === 0 ? false : !same,
      soft: true,
    },
  ];

  let score = 0;
  if (onlyDigits && len > 0) score += 1;
  if (exact) score += 2;
  if (exact && !sequential && !same) score += 1;
  if (exact && (sequential || same)) score = Math.min(score, 2);

  /** @type {StrengthResult['level']} */
  let level = "empty";
  let label = `Escribe el ${pinLabel}`;
  let tip = `El sistema pide exactamente ${target} dígitos numéricos.`;
  let percent = 0;

  if (len === 0) {
    level = "empty";
    percent = 0;
  } else if (!exact) {
    level = "weak";
    label = "Débil";
    tip =
      len < target
        ? `+ dígitos: completá hasta ${target} (${len}/${target}).`
        : `Dejá solo ${target} dígitos.`;
    percent = Math.min(90, Math.round((Math.min(len, target) / target) * 70));
    score = Math.min(score, 1);
  } else if (sequential || same) {
    level = "fair";
    label = "Regular";
    tip = sequential
      ? "Ese PIN es predecible — mezclá el orden (+ variedad)."
      : "Repetir el mismo dígito es débil — mezclá otros números.";
    percent = 55;
  } else {
    level = "strong";
    label = "Fuerte";
    tip = `${target} dígitos válidos. Listo para guardar.`;
    percent = 100;
    score = 4;
  }

  return { score, level, label, tip, percent, items };
}

export function meterBarClass(level) {
  switch (level) {
    case "strong":
      return "bg-emerald-500";
    case "almost":
      return "bg-teal-500";
    case "fair":
      return "bg-amber-500";
    case "weak":
      return "bg-rose-500";
    default:
      return "bg-muted";
  }
}

export function meterTextClass(level) {
  switch (level) {
    case "strong":
      return "text-emerald-700 dark:text-emerald-400";
    case "almost":
      return "text-teal-700 dark:text-teal-400";
    case "fair":
      return "text-amber-700 dark:text-amber-400";
    case "weak":
      return "text-rose-700 dark:text-rose-400";
    default:
      return "text-muted-foreground";
  }
}
