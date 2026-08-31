import axios from "axios";
import { API_BASE as API } from "@/lib/api";

export const DEFAULT_IVA_RATE = 15;

export async function fetchEffectiveIvaRate(options = {}) {
  const withCredentials = options.withCredentials ?? true;
  const fallback = Number(options.fallback ?? DEFAULT_IVA_RATE);

  try {
    const response = await axios.get(`${API}/settings/billing/iva/public`, {
      withCredentials,
    });
    const ivaRate = Number(response?.data?.iva_rate || 0);
    if (Number.isFinite(ivaRate) && ivaRate > 0) {
      return ivaRate;
    }
  } catch {
    // Fallback when endpoint is unavailable.
  }

  return Number.isFinite(fallback) && fallback > 0 ? fallback : DEFAULT_IVA_RATE;
}

export async function fetchEffectiveBillingTaxSettings(options = {}) {
  const withCredentials = options.withCredentials ?? true;
  try {
    const response = await axios.get(`${API}/settings/billing/iva/public`, {
      withCredentials,
    });
    return {
      ivaRate: Number(response?.data?.iva_rate) || DEFAULT_IVA_RATE,
      taxesEnabled: Boolean(response?.data?.taxes_enabled),
    };
  } catch {
    return {
      ivaRate: DEFAULT_IVA_RATE,
      taxesEnabled: false,
    };
  }
}
