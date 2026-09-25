/**
 * Settings search helpers (U4 — video 04).
 * Match sections/rows by query; highlight path/label spans.
 */

export function normalizeSettingsQuery(query) {
  return String(query || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function settingsTextMatches(text, query) {
  const q = normalizeSettingsQuery(query);
  if (!q) return true;
  const hay = normalizeSettingsQuery(text);
  return hay.includes(q);
}

export function settingsKeywordsMatch(keywords = [], query) {
  const q = normalizeSettingsQuery(query);
  if (!q) return true;
  return keywords.some((kw) => settingsTextMatches(kw, q));
}

/**
 * Split text into [{ text, match }] for highlight rendering.
 */
export function highlightSettingsMatch(text, query) {
  const raw = String(text ?? "");
  const q = String(query || "").trim();
  if (!q || !raw) return [{ text: raw, match: false }];

  const normHay = normalizeSettingsQuery(raw);
  const normQ = normalizeSettingsQuery(q);
  const idx = normHay.indexOf(normQ);
  if (idx < 0) return [{ text: raw, match: false }];

  // Map normalized index back roughly by walking original (accent-tolerant).
  let origStart = 0;
  let normPos = 0;
  while (normPos < idx && origStart < raw.length) {
    const ch = raw[origStart];
    const n = normalizeSettingsQuery(ch);
    if (n) normPos += n.length;
    origStart += 1;
  }
  let origEnd = origStart;
  let matchedNorm = 0;
  while (matchedNorm < normQ.length && origEnd < raw.length) {
    const ch = raw[origEnd];
    const n = normalizeSettingsQuery(ch);
    if (n) matchedNorm += n.length;
    origEnd += 1;
  }

  const parts = [];
  if (origStart > 0) parts.push({ text: raw.slice(0, origStart), match: false });
  parts.push({ text: raw.slice(origStart, origEnd), match: true });
  if (origEnd < raw.length) parts.push({ text: raw.slice(origEnd), match: false });
  return parts;
}
