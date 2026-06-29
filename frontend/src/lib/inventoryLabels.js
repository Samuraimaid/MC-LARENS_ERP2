import axios from "axios";
import { API_BASE as API } from "@/lib/api";

export async function fetchLabelConfig() {
  const response = await axios.get(`${API}/inventory/labels/config`, { withCredentials: true });
  return response.data;
}

export async function fetchLabelPrinterStatus() {
  const response = await axios.get(`${API}/inventory/labels/printer-status`, { withCredentials: true });
  return response.data;
}

export async function previewInventoryLabels(payload) {
  const response = await axios.post(`${API}/inventory/labels/preview`, payload, {
    withCredentials: true,
    responseType: "blob",
  });
  return response.data;
}

export async function printInventoryLabels(payload) {
  const outputFormat = payload?.output_format || "pdf";
  const isDirect = ["usb", "direct", "usb_direct"].includes(outputFormat);
  const response = await axios.post(`${API}/inventory/labels/print`, payload, {
    withCredentials: true,
    responseType: isDirect ? "json" : "blob",
  });
  return response;
}

export function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

export function openBlobInNewTab(blob) {
  const url = window.URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);
}