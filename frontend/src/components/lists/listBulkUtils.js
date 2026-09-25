/**
 * Utilidades FE para acciones en lote (sin endpoints nuevos).
 */

export function downloadCsv(filename, headers, rows) {
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    headers.map(esc).join(","),
    ...rows.map((row) => row.map(esc).join(",")),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "export.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function copyTextToClipboard(text) {
  const value = text == null ? "" : String(text);
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }
  const ta = document.createElement("textarea");
  ta.value = value;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
    return true;
  } finally {
    ta.remove();
  }
}

export function openWhatsAppLinks(entries, { staggerMs = 600, maxOpen = 5 } = {}) {
  // entries: [{ phone, text }]
  const list = (Array.isArray(entries) ? entries : []).slice(0, maxOpen);
  list.forEach((entry, idx) => {
    const phone = String(entry.phone || "").replace(/[^0-9]/g, "");
    if (!phone) return;
    const text = encodeURIComponent(entry.text || "");
    const url = `https://wa.me/${phone}${text ? `?text=${text}` : ""}`;
    setTimeout(() => {
      window.open(url, "_blank", "noopener,noreferrer");
    }, idx * staggerMs);
  });
  return list.length;
}
