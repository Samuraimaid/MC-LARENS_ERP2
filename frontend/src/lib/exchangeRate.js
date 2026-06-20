import axios from "axios";
import { API_BASE as API } from "@/lib/api";

export const DEFAULT_USD_NIO_RATE = 36.5;

export async function fetchEffectiveUsdNioRate(options = {}) {
  const withCredentials = options.withCredentials ?? true;
  const fallback = Number(options.fallback ?? DEFAULT_USD_NIO_RATE);

  try {
    const response = await axios.get(`${API}/currencies/usd-nio-effective`, {
      withCredentials,
    });
    const rate = Number(response?.data?.rate || 0);
    if (Number.isFinite(rate) && rate > 0) {
      return rate;
    }
  } catch {
    // Intentionally return fallback when endpoint is temporarily unavailable.
  }

  return Number.isFinite(fallback) && fallback > 0 ? fallback : DEFAULT_USD_NIO_RATE;
}
