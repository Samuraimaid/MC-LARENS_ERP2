/**
 * U14 — sequential fuzzy match with matched letter indices for cyan highlight.
 * Match is case-insensitive; characters must appear in order (not necessarily contiguous).
 */

export function normalizeForFuzzy(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * @param {string} query
 * @param {string} text
 * @returns {{ score: number, indices: number[] } | null}
 */
export function fuzzyMatch(query, text) {
  const q = normalizeForFuzzy(query).trim();
  const raw = String(text || "");
  if (!q) {
    return { score: 0, indices: [] };
  }
  const hay = normalizeForFuzzy(raw);
  if (!hay) return null;

  const indices = [];
  let qi = 0;
  let score = 0;
  let lastMatch = -2;
  let consecutive = 0;

  for (let hi = 0; hi < hay.length && qi < q.length; hi += 1) {
    if (hay[hi] !== q[qi]) continue;
    indices.push(hi);
    if (hi === lastMatch + 1) {
      consecutive += 1;
      score += 8 + consecutive * 2;
    } else {
      consecutive = 0;
      score += 4;
    }
    // Prefer earlier matches and word-boundary hits
    if (hi === 0 || /[\s\-_/.(]/.test(hay[hi - 1])) score += 6;
    score -= hi * 0.05;
    lastMatch = hi;
    qi += 1;
  }

  if (qi < q.length) return null;
  // Bonus for covering more of the string tightly
  score += Math.max(0, 24 - (indices[indices.length - 1] - indices[0]));
  if (hay.startsWith(q)) score += 20;
  return { score, indices };
}

/**
 * Split `text` into segments for rendering matched letters.
 * @param {string} text
 * @param {number[]} indices
 * @returns {{ text: string, matched: boolean }[]}
 */
export function splitHighlighted(text, indices) {
  const raw = String(text || "");
  if (!raw) return [];
  const matched = new Set((indices || []).filter((i) => i >= 0 && i < raw.length));
  if (matched.size === 0) return [{ text: raw, matched: false }];

  const parts = [];
  let buf = "";
  let bufMatched = null;
  for (let i = 0; i < raw.length; i += 1) {
    const isMatch = matched.has(i);
    if (bufMatched === null) {
      bufMatched = isMatch;
      buf = raw[i];
      continue;
    }
    if (isMatch === bufMatched) {
      buf += raw[i];
    } else {
      parts.push({ text: buf, matched: bufMatched });
      buf = raw[i];
      bufMatched = isMatch;
    }
  }
  if (buf) parts.push({ text: buf, matched: Boolean(bufMatched) });
  return parts;
}

/**
 * Filter + rank items by fuzzy label (and optional keywords).
 * @template {{ id: string, label: string, keywords?: string[] }} T
 * @param {string} query
 * @param {T[]} items
 * @returns {(T & { score: number, indices: number[] })[]}
 */
export function fuzzyFilterItems(query, items) {
  const q = String(query || "").trim();
  if (!q) {
    return (items || []).map((item) => ({ ...item, score: 0, indices: [] }));
  }
  const out = [];
  for (const item of items || []) {
    const labelMatch = fuzzyMatch(q, item.label);
    let best = labelMatch;
    if (Array.isArray(item.keywords)) {
      for (const kw of item.keywords) {
        const m = fuzzyMatch(q, kw);
        if (m && (!best || m.score > best.score)) {
          // Keep highlight on the visible label when keyword wins
          best = labelMatch || { score: m.score, indices: [] };
          if (labelMatch) best = { ...labelMatch, score: Math.max(labelMatch.score, m.score) };
          else best = { score: m.score * 0.85, indices: [] };
        }
      }
    }
    if (best) out.push({ ...item, score: best.score, indices: best.indices });
  }
  out.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, "es"));
  return out;
}
