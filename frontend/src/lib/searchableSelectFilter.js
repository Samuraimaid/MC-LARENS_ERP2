export function normalizeSearchText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

export function scoreSearchableOption(option, rawQuery) {
  const query = normalizeSearchText(rawQuery);
  if (!query) return 1;

  const label = normalizeSearchText(option?.label);
  const value = normalizeSearchText(option?.value);
  const hint = normalizeSearchText(option?.hint);

  if (!label && !value && !hint) return 0;

  if (label === query || value === query) return 1000;
  if (label.startsWith(query)) return 900;
  if (value.startsWith(query)) return 850;

  const labelWords = label.split(/[^a-z0-9]+/).filter(Boolean);
  if (labelWords.some((word) => word.startsWith(query))) return 800;
  if (label.includes(query)) return 700;
  if (value.includes(query)) return 650;

  let labelIdx = 0;
  let matchesSubsequence = true;
  for (const ch of query) {
    labelIdx = label.indexOf(ch, labelIdx);
    if (labelIdx === -1) {
      matchesSubsequence = false;
      break;
    }
    labelIdx += 1;
  }
  if (matchesSubsequence) return 500;

  if (hint.includes(query)) return 300;

  return 0;
}

export function filterSearchableOptions(options = [], rawQuery = "") {
  const query = normalizeSearchText(rawQuery);
  if (!query) return [...options];

  return options
    .map((option, index) => ({
      option,
      index,
      score: scoreSearchableOption(option, query),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => (
      right.score - left.score
      || String(left.option?.label || "").localeCompare(String(right.option?.label || ""), "es")
      || left.index - right.index
    ))
    .map((entry) => entry.option);
}