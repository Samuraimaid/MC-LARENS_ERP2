import axios from "axios";
import { API_BASE as API } from "@/lib/api";

export const DEFAULT_USD_NIO_RATE = 36.5;
export const DEFAULT_USD_NIO_BUY_RATE = 36.62;
export const DEFAULT_USD_NIO_SELL_RATE = 37.15;

export async function fetchEffectiveUsdNioRate(options = {}) {
  const withCredentials = options.withCredentials ?? true;
  const fallback = Number(options.fallback ?? DEFAULT_USD_NIO_SELL_RATE);

  try {
    const response = await axios.get(`${API}/currencies/usd-nio-effective`, {
      withCredentials,
    });
    const rate = Number(response?.data?.sell_rate || response?.data?.rate || 0);
    if (Number.isFinite(rate) && rate > 0) {
      return rate;
    }
  } catch {
    // Intentionally return fallback when endpoint is temporarily unavailable.
  }

  return Number.isFinite(fallback) && fallback > 0 ? fallback : DEFAULT_USD_NIO_SELL_RATE;
}

export async function fetchUsdNioDualRates(options = {}) {
  const withCredentials = options.withCredentials ?? true;
  const fallbackBuy = Number(options.fallbackBuy ?? DEFAULT_USD_NIO_BUY_RATE);
  const fallbackSell = Number(options.fallbackSell ?? DEFAULT_USD_NIO_SELL_RATE);

  try {
    const response = await axios.get(`${API}/currencies/usd-nio-dual`, {
      withCredentials,
    });
    const buyRate = Number(response?.data?.buy_rate || 0);
    const sellRate = Number(response?.data?.sell_rate || response?.data?.rate || 0);
    if (Number.isFinite(buyRate) && buyRate > 0 && Number.isFinite(sellRate) && sellRate > 0) {
      return {
        buyRate,
        sellRate,
        source: response?.data?.source || "api",
        buySource: response?.data?.buy_source || "api",
        sellSource: response?.data?.sell_source || "api",
      };
    }
  } catch {
    // Fall through to defaults.
  }

  return {
    buyRate: Number.isFinite(fallbackBuy) && fallbackBuy > 0 ? fallbackBuy : DEFAULT_USD_NIO_BUY_RATE,
    sellRate: Number.isFinite(fallbackSell) && fallbackSell > 0 ? fallbackSell : DEFAULT_USD_NIO_SELL_RATE,
    source: "fallback",
    buySource: "fallback",
    sellSource: "fallback",
  };
}