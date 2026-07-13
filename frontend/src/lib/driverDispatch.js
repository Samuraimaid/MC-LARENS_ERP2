import axios from "axios";
import { API_BASE as API } from "@/lib/api";

export async function fetchWhatsAppDispatch(jobId, driverId = null) {
  const params = new URLSearchParams();
  if (driverId) params.set("driver_id", driverId);
  const qs = params.toString();
  const url = `${API}/hr/drivers/whatsapp-dispatch/${encodeURIComponent(jobId)}${qs ? `?${qs}` : ""}`;
  const response = await axios.get(url, { withCredentials: true });
  return response.data;
}

export function openWhatsAppDispatch(data) {
  const waUrl = data?.whatsapp_url;
  if (!waUrl) {
    throw new Error("No hay número de WhatsApp configurado para el conductor");
  }
  window.open(waUrl, "_blank", "noopener,noreferrer");
}

export function buildSaleJobId(saleId) {
  return `sale:${saleId}`;
}

export function buildTransferJobId(requestId) {
  return `transfer:${requestId}`;
}