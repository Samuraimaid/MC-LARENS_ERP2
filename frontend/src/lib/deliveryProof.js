const PUBLIC_BASE = "https://mclarenerp.com";

export function buildDeliveryProofUrl(proofImageId, proofUrl) {
  if (proofUrl) return proofUrl;
  if (!proofImageId) return "";
  const id = String(proofImageId).replace(/^\//, "");
  return `${PUBLIC_BASE}/api/deliveries/media/${id}`;
}

export function buildCustomerProofWhatsAppUrl({ proofImageId, proofUrl, customerName }) {
  const url = buildDeliveryProofUrl(proofImageId, proofUrl);
  if (!url) return null;
  const greeting = customerName ? `Hola ${customerName}, ` : "Hola, ";
  const text = `${greeting}adjuntamos la confirmación física y geo-localizada de la entrega de los accesorios de su auto: ${url}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}