import { DEFAULT_USD_NIO_SELL_RATE } from "@/lib/exchangeRate";
import { formatCurrency, normalizeCurrencyCode } from "@/lib/utils";

export function getDocumentExchangeRate(doc) {
  const rate = Number(doc?.exchange_rate ?? doc?.tipo_cambio_usd_nio ?? doc?.tipo_cambio ?? 0);
  if (Number.isFinite(rate) && rate > 0) return rate;
  return DEFAULT_USD_NIO_SELL_RATE;
}

export function getDocumentSettlementCurrency(doc) {
  return normalizeCurrencyCode(doc?.currency || "NIO");
}

/** Sales line items are stored in USD; quotation lines follow settlement currency. */
export function areDocumentLineItemsInUsd(doc, docType = "sale") {
  if (docType === "quotation") {
    return getDocumentSettlementCurrency(doc) === "USD";
  }
  return true;
}

export function formatDualCurrency(usdAmount, nioAmount) {
  const usd = Number(usdAmount) || 0;
  const nio = Number(nioAmount) || 0;
  return `${formatCurrency(usd, "USD")} (${formatCurrency(nio, "NIO")})`;
}

export function usdAndNioFromUsdBase(amountUsd, rate) {
  const usd = Number(amountUsd) || 0;
  const safeRate = Number(rate) > 0 ? Number(rate) : DEFAULT_USD_NIO_SELL_RATE;
  return { usd, nio: usd * safeRate };
}

export function usdAndNioFromNioBase(amountNio, rate) {
  const nio = Number(amountNio) || 0;
  const safeRate = Number(rate) > 0 ? Number(rate) : DEFAULT_USD_NIO_SELL_RATE;
  return { usd: nio / safeRate, nio };
}

export function formatDocumentLineAmount(amount, doc, docType = "sale") {
  const rate = getDocumentExchangeRate(doc);
  if (areDocumentLineItemsInUsd(doc, docType)) {
    const { usd, nio } = usdAndNioFromUsdBase(amount, rate);
    return formatDualCurrency(usd, nio);
  }
  const { usd, nio } = usdAndNioFromNioBase(amount, rate);
  return formatDualCurrency(usd, nio);
}

export function formatDocumentSettlementAmount(amount, doc) {
  const rate = getDocumentExchangeRate(doc);
  const currency = getDocumentSettlementCurrency(doc);
  if (currency === "USD") {
    const { usd, nio } = usdAndNioFromUsdBase(amount, rate);
    return formatDualCurrency(usd, nio);
  }
  const { usd, nio } = usdAndNioFromNioBase(amount, rate);
  return formatDualCurrency(usd, nio);
}

export function formatDocumentExchangeRateLabel(doc) {
  const rate = getDocumentExchangeRate(doc);
  const currency = getDocumentSettlementCurrency(doc);
  const formatted = new Intl.NumberFormat("es-NI", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(rate);
  return `Tasa aplicada: 1 US$ = C$${formatted} · Moneda de cobro: ${currency === "NIO" ? "Córdobas" : "Dólares"}`;
}