export const formatPhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
};

export const formatCedula = (value) => {
  const clean = String(value || "").replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  if (clean.length <= 3) return clean;
  if (clean.length <= 9) return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  return `${clean.slice(0, 3)}-${clean.slice(3, 9)}-${clean.slice(9, 14)}`;
};

export const formatRUC = (value) => {
  const clean = String(value || "").replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  return clean.slice(0, 14);
};

export const formatChasis = (value) => {
  const clean = String(value || "").replace(/[^0-9A-HJ-NPR-Za-hj-npr-z]/g, "").toUpperCase();
  return clean.slice(0, 17);
};

export const formatPlateNumber = (prefix, value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (prefix === "M") {
    if (digits.length <= 3) return digits;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)}`;
  }
  return digits.slice(0, 5);
};
