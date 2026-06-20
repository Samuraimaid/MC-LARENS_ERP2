const COLOR_MAP = {
  blanco: "#f3f4f6",
  negra: "#111827",
  negro: "#111827",
  gris: "#6b7280",
  plateado: "#9ca3af",
  plata: "#9ca3af",
  azul: "#1d4ed8",
  rojo: "#dc2626",
  vino: "#7f1d1d",
  verde: "#15803d",
  amarillo: "#facc15",
  dorado: "#d4af37",
  naranja: "#ea580c",
  cafe: "#78350f",
  marron: "#78350f",
  beige: "#d6d3d1",
};

function normalizeColor(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function colorToHex(color) {
  const normalized = normalizeColor(color);
  if (!normalized) return "#6b7280";

  for (const [name, hex] of Object.entries(COLOR_MAP)) {
    if (normalized.includes(name)) return hex;
  }

  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized)) {
    return normalized;
  }

  return "#6b7280";
}

function toDataUri(svg) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function buildVehicleSvg({ brand = "Vehículo", model = "", color = "" }) {
  const fill = colorToHex(color);
  const label = `${brand} ${model}`.trim().slice(0, 28) || "Vehículo";

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1f2937"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#bg)"/>
  <g transform="translate(60,95)">
    <path d="M88 130h338c18 0 27-10 31-23l14-41c4-11 8-16 16-20l40-20c9-5 8-16-3-19l-50-13c-20-5-38-8-61-8H249c-34 0-50 8-66 24l-43 43H93c-9 0-16 7-16 16v45c0 8 5 16 11 16z" fill="${fill}"/>
    <circle cx="180" cy="148" r="31" fill="#0b1220"/>
    <circle cx="180" cy="148" r="16" fill="#9ca3af"/>
    <circle cx="438" cy="148" r="31" fill="#0b1220"/>
    <circle cx="438" cy="148" r="16" fill="#9ca3af"/>
    <rect x="210" y="34" width="166" height="45" rx="8" fill="#94a3b8" opacity="0.48"/>
    <rect x="386" y="44" width="60" height="35" rx="7" fill="#94a3b8" opacity="0.45"/>
    <rect x="116" y="72" width="30" height="12" rx="4" fill="#f59e0b"/>
  </g>
  <text x="32" y="316" fill="#e5e7eb" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="700">${label}</text>
  <text x="32" y="342" fill="#93c5fd" font-family="Inter, Arial, sans-serif" font-size="18">Color: ${color || "No especificado"}</text>
</svg>`;

  return toDataUri(svg);
}

export function getVehicleThumbnail(vehicle) {
  if (!vehicle) return buildVehicleSvg({});

  const explicit =
    vehicle.thumbnail_url ||
    vehicle.vehicle_thumbnail ||
    vehicle.image_url ||
    vehicle.image ||
    vehicle.photo_url ||
    null;

  if (explicit && typeof explicit === "string") return explicit;

  return buildVehicleSvg({
    brand: vehicle.brand || "Vehículo",
    model: vehicle.model || "",
    color: vehicle.color || vehicle.vehicle_color || "",
  });
}
