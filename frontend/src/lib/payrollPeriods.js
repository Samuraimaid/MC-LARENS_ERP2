/** Quincena técnica: cortes día 9 y 24 (9-24, luego 25-8). */

function addMonths(year, month, delta) {
  month += delta;
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  while (month < 1) {
    month += 12;
    year -= 1;
  }
  return { year, month };
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

export function toIsoDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function boundsPayroll924(reference) {
  const day = reference.getDate();
  const year = reference.getFullYear();
  const month = reference.getMonth() + 1;

  if (day >= 9 && day <= 24) {
    return {
      start: new Date(year, month - 1, 9),
      end: new Date(year, month - 1, 24),
    };
  }
  if (day >= 25) {
    const next = addMonths(year, month, 1);
    return {
      start: new Date(year, month - 1, 25),
      end: new Date(next.year, next.month - 1, 8),
    };
  }
  const prev = addMonths(year, month, -1);
  return {
    start: new Date(prev.year, prev.month - 1, 25),
    end: new Date(year, month - 1, 8),
  };
}

function shiftReference(reference, offset) {
  if (offset === 0) return new Date(reference);
  const { start, end } = boundsPayroll924(reference);
  if (offset < 0) {
    const d = new Date(start);
    d.setDate(d.getDate() - 1);
    return d;
  }
  const d = new Date(end);
  d.setDate(d.getDate() + 1);
  return d;
}

export function getQuincenaBounds(reference = new Date(), offset = 0) {
  const ref = shiftReference(reference, offset);
  return boundsPayroll924(ref);
}

export function getQuincenaIsoRange(reference = new Date(), offset = 0) {
  const { start, end } = getQuincenaBounds(reference, offset);
  return { dateFrom: toIsoDate(start), dateTo: toIsoDate(end), start, end };
}

const MONTHS_ES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

export function formatQuincenaLabel(start, end) {
  const sm = MONTHS_ES[start.getMonth()];
  const em = MONTHS_ES[end.getMonth()];
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}-${end.getDate()} ${sm} ${start.getFullYear()}`;
  }
  return `${start.getDate()} ${sm} - ${end.getDate()} ${em} ${end.getFullYear()}`;
}