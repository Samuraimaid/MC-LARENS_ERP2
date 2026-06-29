import axios from "axios";
import { API_BASE as API } from "@/lib/api";

export async function fetchPosVoucherPrinterStatus() {
  const response = await axios.get(`${API}/print/pos-voucher-printer/status`, {
    withCredentials: true,
  });
  return response.data;
}

export async function printSellerVoucherPos(saleId) {
  const response = await axios.post(
    `${API}/print/seller-voucher/${saleId}/pos`,
    {},
    { withCredentials: true },
  );
  return response.data;
}

export async function openSellerVoucherPreviewPdf(saleId) {
  const response = await axios.get(`${API}/print/seller-voucher/${saleId}/preview-pdf`, {
    withCredentials: true,
    responseType: "blob",
  });
  const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
  window.open(blobUrl, "_blank");
  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60 * 1000);
}

export function normalizeVoucherScanCode(raw = "") {
  let value = String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
  if (value.startsWith("*") && value.endsWith("*")) {
    value = value.slice(1, -1).trim();
  }
  return value;
}

export function isValidVoucherScanCode(raw = "") {
  return /^INV-\d{8}-\d{4}$/i.test(normalizeVoucherScanCode(raw));
}