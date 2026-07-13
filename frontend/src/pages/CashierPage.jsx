import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { API_BASE as API } from "@/lib/api";
import { useAuth } from "../context/AuthContext";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Textarea } from "../components/ui/textarea";
import { ArrowDown, ArrowUp, Barcode, CheckCircle2, ClipboardCheck, CreditCard, Download, FileText, Lock, Power, RefreshCw, Search, ShieldAlert, Trash2, Unlock, UserCircle2, Volume2, VolumeX, Wallet } from "lucide-react";
import { canPurgeOperationalQueue } from "@/lib/queuePurgeAccess";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { isValidVoucherScanCode, normalizeVoucherScanCode } from "@/lib/voucherPrinter";
import { planToCollectForm } from "@/lib/plannedPaymentPlan";
import {
  fetchUsdNioDualRates,
  DEFAULT_USD_NIO_BUY_RATE,
  DEFAULT_USD_NIO_SELL_RATE,
} from "@/lib/exchangeRate";
import { OperationalJobCard, getCashierUrgencyState } from "@/components/erp/OperationalJobCard";
import ErpFormToolbar, { ErpToolbarButton } from "@/components/erp/ErpFormToolbar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import DriverWhatsAppDispatchButton from "@/components/drivers/DriverWhatsAppDispatchButton";
import { buildSaleJobId } from "@/lib/driverDispatch";
import {
  buildDualCurrencyPagos,
  canSubmitCashierCollect,
  CASHIER_QUICK_BILLS_NIO,
  computeDualCurrencyTotals,
  computeTotalCashChangeNio,
  dualCurrencyAmountFromPlan,
  formatCashierMoney,
  formatUsdMoney,
  isCashOrTransferMethod,
  isCashSingleCollect,
} from "@/lib/cashierCollect";

const NIO_BILLS = [1000, 500, 200, 100, 50, 20, 10, 5, 1];
const NIO_COINS = [10, 5, 1, 0.5, 0.25, 0.1, 0.05];
const USD_BILLS = [100, 50, 20, 10, 5, 1];
const USD_COINS = [1, 0.5, 0.25, 0.1, 0.05, 0.01];
const CASHIER_SHIFT_KEY = "cashier.shift.state.v2";

function resolveSalePrintFormat(sale, collectResponse) {
  if (collectResponse?.print_format) return collectResponse.print_format;
  if (sale?.print_format) return sale.print_format;
  const iva = Number(sale?.iva_amount || sale?.tax || 0);
  return iva > 0.009 ? "letter" : "thermal80";
}

async function printInvoiceAfterCollect(sale, collectResponse) {
  const saleId = sale?.sale_id;
  if (!saleId) return;
  const fullyPaid = String(collectResponse?.sale_payment_status || "").toLowerCase() === "paid";
  if (!fullyPaid) return;

  const printFormat = resolveSalePrintFormat(sale, collectResponse);
  try {
    if (printFormat === "letter") {
      window.open(`${API}/print/invoice-pdf/${saleId}`, "_blank");
      return;
    }
    await axios.post(`${API}/print/thermal-invoice/${saleId}/pos`, {}, { withCredentials: true });
    toast.success("Comprobante termico enviado a impresora");
  } catch (error) {
    const detail = error?.response?.data?.detail;
    toast.error(typeof detail === "string" ? detail : "No se pudo imprimir el comprobante");
  }
}
const CASHIER_URGENT_SOUND_KEY = "cashier.urgent.sound.enabled";
const CARD_BANKS = [
  "BAC",
  "BANPRO",
  "LAFISE",
  "BDF",
  "AVZ",
  "FICOHSA",
  "BANCENTRO",
  "PROCREDIT",
  "Otro",
];

function isCardMethod(method) {
  return ["card", "tarjeta"].includes(String(method || "").toLowerCase());
}

function buildDefaultPaymentRow() {
  return {
    metodo: "cash",
    moneda: "NIO",
    monto_origen: "",
    referencia_bancaria: "",
    card_type: "",
    bank_name: "",
    transaction_number: "",
  };
}

function mapSalePaymentMethod(sale) {
  const key = String(sale?.payment_type || sale?.payment_method || "cash").toLowerCase();
  if (["transfer", "transferencia"].includes(key)) return "transfer";
  if (["card", "tarjeta"].includes(key)) return "card";
  return "cash";
}

function isSaleCredit(sale) {
  const key = String(sale?.payment_type || "").toLowerCase();
  return key === "credito" || key === "credit";
}

function isSalePartial(sale) {
  return Number(sale?.amount_paid || 0) > 0 && Number(sale?.amount_pending || 0) > 0;
}

function matchesInvoiceFilters(sale, filters) {
  if (filters.urgent && getCashierUrgencyState(sale).level !== "critical") return false;
  if (filters.installation && !sale?.has_installation) return false;
  if (filters.credit && !isSaleCredit(sale)) return false;
  if (filters.partial && !isSalePartial(sale)) return false;
  return true;
}

function playUrgentCashierAlert() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const gain = ctx.createGain();
    gain.gain.value = 0.07;
    gain.connect(ctx.destination);
    [880, 660].forEach((freq, index) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      const startAt = ctx.currentTime + index * 0.18;
      osc.start(startAt);
      osc.stop(startAt + 0.14);
    });
  } catch {
    // ignore audio failures
  }
}

function loadUrgentSoundPreference() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(CASHIER_URGENT_SOUND_KEY) !== "false";
}
const FALLBACK_CANCEL_COMMON_REASONS = [
  "Error de digitación en factura",
  "Precio o descuento aplicado incorrectamente",
  "Cliente desistió de la compra",
  "Pago rechazado o no confirmado",
  "Producto sin disponibilidad real",
  "Factura duplicada",
  "Datos fiscales del cliente incorrectos",
  "Otro Justifique",
];

function getSystemCajaId(branchId) {
  const dateToken = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const branchToken = String(branchId || "main").toLowerCase().replace(/[^a-z0-9]/g, "");
  return `caja-${branchToken || "main"}-${dateToken}`;
}

function loadShiftState() {
  if (typeof window === "undefined") {
    return { openedSessionId: "", sessionId: "", locked: false };
  }
  try {
    const raw = window.localStorage.getItem(CASHIER_SHIFT_KEY);
    if (!raw) return { openedSessionId: "", sessionId: "", locked: false };
    const parsed = JSON.parse(raw);
    return {
      openedSessionId: String(parsed?.openedSessionId || ""),
      sessionId: String(parsed?.sessionId || ""),
      locked: Boolean(parsed?.locked),
    };
  } catch {
    return { openedSessionId: "", sessionId: "", locked: false };
  }
}

function buildDefaultDenominations() {
  const createRows = (moneda, tipo, values) => values.map((valor) => ({ moneda, tipo, valor_nominal: valor, cantidad: 0 }));
  return [
    ...createRows("NIO", "billete", NIO_BILLS),
    ...createRows("NIO", "moneda", NIO_COINS),
    ...createRows("USD", "billete", USD_BILLS),
    ...createRows("USD", "moneda", USD_COINS),
  ];
}

function toMoney(value) {
  return Number(value || 0).toFixed(2);
}

function CashierInvoiceItems({ sale, compact = false }) {
  const items = Array.isArray(sale?.items_detail) ? sale.items_detail : [];
  const itemCount = Number(sale?.item_count || items.length || 0);
  const hasInstallation = Number(sale?.installation_item_count || 0) > 0 || Boolean(sale?.has_installation);

  if (!itemCount && !sale?.items_preview) {
    return (
      <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>
        Sin artículos registrados en esta factura
      </p>
    );
  }

  const displayItems = items.length
    ? items
    : [{ name: sale?.items_preview || "Artículos", quantity: itemCount }];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p
          className={cn(
            "font-semibold uppercase tracking-wide text-muted-foreground",
            compact ? "text-[10px]" : "text-xs",
          )}
        >
          Artículos de la factura
        </p>
        {itemCount > 0 ? (
          <span className={cn("text-muted-foreground tabular-nums", compact ? "text-[10px]" : "text-xs")}>
            {itemCount} artículo{itemCount === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>
      <ul className={cn("space-y-1.5", compact ? "text-xs" : "text-sm")}>
        {displayItems.map((item, idx) => {
          const qty = Number(item.quantity || 1);
          const unitPrice = Number(item.unit_price || 0);
          const originalUnit = Number(item.original_unit_price || unitPrice);
          const hasOriginalDiscount = originalUnit > unitPrice + 0.009;
          const priceDiscount = Number(item.price_discount || 0);
          const linePctDiscount = Number(item.line_pct_discount || 0);
          const discountPct = Number(item.discount_pct || 0);
          const installationLine = Number(item.installation_line_total || 0);
          const lineNet = Number(item.line_net_total || item.line_total || 0);

          return (
            <li
              key={`${item.name}-${idx}`}
              className="rounded-md border border-border/60 bg-background/70 px-2.5 py-2 space-y-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug break-words">{item.name}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                    {qty > 1 ? <span>Cant. {qty}</span> : null}
                    {item.with_installation ? (
                      <Badge variant="outline" className="h-4 px-1.5 text-[9px] font-normal">
                        Con instalación
                      </Badge>
                    ) : null}
                  </div>
                </div>
                {lineNet > 0 ? (
                  <span className="shrink-0 tabular-nums font-semibold">{formatCashierMoney(lineNet)}</span>
                ) : null}
              </div>

              <div className="space-y-0.5 text-[10px] text-muted-foreground">
                <p className="tabular-nums">
                  {hasOriginalDiscount ? (
                    <>
                      <span className="line-through">{formatCashierMoney(originalUnit)}</span>
                      {" "}
                      <span className="text-foreground font-medium">{formatCashierMoney(unitPrice)}</span>
                      {" c/u"}
                    </>
                  ) : (
                    <span className="text-foreground font-medium">{formatCashierMoney(unitPrice)} c/u</span>
                  )}
                </p>
                {priceDiscount > 0.009 ? (
                  <p className="text-violet-600 dark:text-violet-400 tabular-nums">
                    Descuento precio: -{formatCashierMoney(priceDiscount)}
                  </p>
                ) : null}
                {linePctDiscount > 0.009 ? (
                  <p className="text-violet-600 dark:text-violet-400 tabular-nums">
                    Descuento línea {discountPct % 1 === 0 ? discountPct.toFixed(0) : discountPct.toFixed(1)}%: -{formatCashierMoney(linePctDiscount)}
                  </p>
                ) : null}
                {installationLine > 0.009 ? (
                  <p className="tabular-nums">
                    Instalación: {formatCashierMoney(installationLine)}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {hasInstallation ? (
        <p className="text-[10px] text-amber-800 dark:text-amber-200">
          Esta factura incluye artículos con instalación.
        </p>
      ) : null}
    </div>
  );
}

function CashierLegalBreakdown({ sale, compact = false }) {
  if (!sale) return null;

  const itemCount = Number(sale.item_count || sale.items_detail?.length || 0);
  const retention = Number(sale.retention_amount || 0);
  const discount = Number(sale.discounts_applied_amount || 0);
  const rows = [
    { key: "subtotal", label: "Subtotal", value: sale.subtotal },
    { key: "iva", label: "IVA", value: sale.iva_amount },
    ...(discount > 0
      ? [{ key: "discount", label: "Descuento", value: discount, negative: true }]
      : []),
    ...(retention > 0
      ? [{
          key: "retention",
          label: sale.retention_rate ? `Retención (${sale.retention_rate}%)` : "Retención",
          value: retention,
          negative: true,
        }]
      : []),
    { key: "total", label: "Total legal", value: sale.total_legal, strong: true },
    { key: "paid", label: "Pagado", value: sale.amount_paid },
    { key: "pending", label: "Pendiente", value: sale.amount_pending, highlight: true },
  ];

  const table = (
    <div className="space-y-1.5">
      {rows.map((row) => (
        <div
          key={row.key}
          className={cn(
            "flex items-center justify-between",
            compact ? "text-xs" : "text-sm",
            row.highlight && "border-t pt-2 mt-1 font-semibold text-primary",
          )}
        >
          <span className={row.strong || row.highlight ? "font-medium text-foreground" : "text-muted-foreground"}>
            {row.label}
          </span>
          <span
            className={cn(
              "tabular-nums",
              row.negative && "text-violet-600 dark:text-violet-400",
              row.highlight && "text-primary",
              row.strong && "font-semibold",
            )}
          >
            {row.negative ? "-" : ""}
            {formatCashierMoney(Math.abs(Number(row.value || 0)))}
          </span>
        </div>
      ))}
    </div>
  );

  const breakdownContent = (
    <div className="space-y-4">
      <CashierInvoiceItems sale={sale} compact={compact} />
      <div className="space-y-2 border-t pt-3">
        <p
          className={cn(
            "font-semibold uppercase tracking-wide text-muted-foreground",
            compact ? "text-[10px]" : "text-xs",
          )}
        >
          Totales legales
        </p>
        {table}
      </div>
    </div>
  );

  if (compact) {
    return (
      <Accordion type="single" collapsible>
        <AccordionItem value="legal-breakdown" className="rounded-md border bg-muted/15 px-3">
          <AccordionTrigger className="py-2 text-xs font-medium hover:no-underline">
            Ver artículos y desglose{itemCount > 0 ? ` (${itemCount})` : ""}
          </AccordionTrigger>
          <AccordionContent className="pb-3">{breakdownContent}</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  }

  return (
    <div className="rounded-md border bg-muted/20 p-3 space-y-4">
      <CashierInvoiceItems sale={sale} compact={compact} />
      <div className="space-y-2 border-t pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Desglose legal
        </p>
        {table}
      </div>
    </div>
  );
}

function CashierAmountHero({ sale, amountToCollect, cashChange, showCashChange }) {
  const pending = Number(sale?.amount_pending || 0);
  const paid = Number(sale?.amount_paid || 0);

  return (
    <div className="rounded-xl border border-primary/25 bg-gradient-to-br from-primary/10 via-background to-background p-4 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            A cobrar ahora
          </p>
          <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight text-primary sm:text-5xl">
            {formatCashierMoney(amountToCollect)}
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground space-y-0.5">
          <p>Pendiente total <span className="font-semibold text-foreground tabular-nums">{formatCashierMoney(pending)}</span></p>
          {paid > 0 ? (
            <p>Ya pagado <span className="font-medium text-foreground tabular-nums">{formatCashierMoney(paid)}</span></p>
          ) : null}
        </div>
      </div>

      {showCashChange ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="rounded-lg border bg-background/80 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Recibido</p>
            <p className="text-2xl font-semibold tabular-nums">{formatCashierMoney(cashChange.received)}</p>
          </div>
          <div
            className={cn(
              "rounded-lg border px-3 py-2.5",
              cashChange.isValid
                ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30"
                : "border-amber-300 bg-amber-50 dark:bg-amber-950/30",
            )}
          >
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Cambio</p>
            <p
              className={cn(
                "text-2xl font-bold tabular-nums",
                cashChange.isValid ? "text-emerald-700 dark:text-emerald-300" : "text-amber-800 dark:text-amber-200",
              )}
            >
              {cashChange.isValid
                ? formatCashierMoney(cashChange.change)
                : `Faltan ${formatCashierMoney(cashChange.shortfall)}`}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function differenceToneClass(value) {
  const amount = Number(value || 0);
  if (amount > 0) return "text-emerald-600 dark:text-emerald-400";
  if (amount < 0) return "text-rose-600 dark:text-rose-400";
  return "text-muted-foreground";
}

function toSignedMoney(value, currencyPrefix = "") {
  const amount = Number(value || 0);
  const sign = amount > 0 ? "+" : amount < 0 ? "-" : "";
  return `${sign}${currencyPrefix}${Math.abs(amount).toFixed(2)}`;
}

function downloadBlob(response, filename) {
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export function CashierPage() {
  const [searchParams] = useSearchParams();
  const preselectedSaleId = String(searchParams.get("sale_id") || "").trim();
  const pendingPreselectRef = useRef(preselectedSaleId);
  const { user } = useAuth();
  const isCashier = String(user?.role || "").toLowerCase() === "cajero";
  const canCancelInvoice = ["gerencia", "recursos_humanos"].includes(String(user?.role || "").toLowerCase());
  const canPurgeCashierInvoices = canPurgeOperationalQueue(user?.role);
  const canViewManagement = useMemo(() => ["gerencia", "supervisor"].includes(user?.role), [user?.role]);
  const initialShift = useMemo(() => loadShiftState(), []);

  const [sessionId, setSessionId] = useState(initialShift.sessionId);
  const [openedSessionId, setOpenedSessionId] = useState(initialShift.openedSessionId);
  const [isLocked, setIsLocked] = useState(initialShift.locked);
  const [unlockPin, setUnlockPin] = useState("");
  const [lockOverlayTone, setLockOverlayTone] = useState("warning");

  const [tipoCambio, setTipoCambio] = useState(String(DEFAULT_USD_NIO_BUY_RATE));
  const [sellTipoCambio, setSellTipoCambio] = useState(String(DEFAULT_USD_NIO_SELL_RATE));
  const [openingNotes, setOpeningNotes] = useState("");
  const [closingNotes, setClosingNotes] = useState("");
  const [openDenominations, setOpenDenominations] = useState(() => buildDefaultDenominations());

  const [activeTab, setActiveTab] = useState("cotizacion");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [voucherScanInput, setVoucherScanInput] = useState("");
  const [collectDialogOpen, setCollectDialogOpen] = useState(false);
  const [deliveryDispatchJobId, setDeliveryDispatchJobId] = useState("");
  const [collectDialogSale, setCollectDialogSale] = useState(null);
  const voucherScanRef = useRef(null);
  const [invoiceRows, setInvoiceRows] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState("");
  const prefillCollectSaleRef = useRef("");
  const urgentSoundPlayedRef = useRef(new Set());
  const [invoiceFilters, setInvoiceFilters] = useState({
    urgent: false,
    installation: false,
    credit: false,
    partial: false,
  });
  const [urgentSoundEnabled, setUrgentSoundEnabled] = useState(loadUrgentSoundPreference);
  const [quickCollectSaleId, setQuickCollectSaleId] = useState("");

  const [collectForm, setCollectForm] = useState({
    mode: "single",
    amount: "",
    received_amount: "",
    nio_amount: "",
    usd_amount: "",
    received_nio: "",
    received_usd: "",
    payment_method: "cash",
    reference: "",
    notes: "",
    force_remove_discount: false,
    justification: "",
    card_type: "",
    bank_name: "",
    transaction_number: "",
    pagos: [buildDefaultPaymentRow()],
  });

  const [abonoSearch, setAbonoSearch] = useState("");
  const [abonoCustomers, setAbonoCustomers] = useState([]);
  const [abonosLoading, setAbonosLoading] = useState(false);
  const [selectedAbonoCustomerId, setSelectedAbonoCustomerId] = useState("");
  const [selectedAbonoSaleId, setSelectedAbonoSaleId] = useState("");
  const [posDiscountAuthStatus, setPosDiscountAuthStatus] = useState("none");
  const [posDiscountAuthBusy, setPosDiscountAuthBusy] = useState(false);

  const [cancelForm, setCancelForm] = useState({ motivo: "", justificacion_interna: "", autorizado_por: "" });
  const [cancelReasons, setCancelReasons] = useState(FALLBACK_CANCEL_COMMON_REASONS);

  const [movementForm, setMovementForm] = useState({
    tipo: "entrada",
    moneda: "NIO",
    referencia: "",
    observaciones: "",
    denominaciones: buildDefaultDenominations(),
  });

  const [busy, setBusy] = useState({
    open: false,
    close: false,
    lock: false,
    preview: false,
    report: false,
    excel: false,
    collect: false,
    cancel: false,
    movement: false,
    clearQueue: false,
  });
  const [purgeBusySaleId, setPurgeBusySaleId] = useState("");
  const [previewSummary, setPreviewSummary] = useState(null);
  const [showPreviewPanel, setShowPreviewPanel] = useState(false);
  const [previewPanelPos, setPreviewPanelPos] = useState({ x: 24, y: 130 });
  const previewDragOffset = useRef(null);

  const systemCajaId = useMemo(() => getSystemCajaId(user?.branch_id), [user?.branch_id]);
  const [sessionSyncing, setSessionSyncing] = useState(false);
  const [serverActiveSession, setServerActiveSession] = useState(null);

  const applyActiveSession = (activeSessionId) => {
    const normalized = String(activeSessionId || "").trim();
    if (!normalized) return false;
    setSessionId(normalized);
    setOpenedSessionId(normalized);
    setIsLocked(false);
    return true;
  };

  const clearLocalSessionState = () => {
    setSessionId("");
    setOpenedSessionId("");
    setIsLocked(false);
    setSelectedSaleId("");
    setServerActiveSession(null);
  };

  const syncCashSessionFromServer = async ({ silent = false } = {}) => {
    if (!user?.branch_id) return null;
    setSessionSyncing(true);
    try {
      const res = await axios.get(`${API}/caja/sesion-activa`, {
        withCredentials: true,
        params: { caja_id: systemCajaId },
      });
      const active = Boolean(res?.data?.active);
      const session = res?.data?.session || null;
      const serverSessionId = String(session?.session_id || "").trim();
      setServerActiveSession(active ? session : null);

      if (active && serverSessionId) {
        applyActiveSession(serverSessionId);
        if (!silent) {
          toast.success(`Sesión de caja retomada: ${serverSessionId}`);
        }
        return session;
      }

      if (sessionId || openedSessionId) {
        clearLocalSessionState();
        if (!silent) {
          toast.info("No hay sesión abierta en el servidor; se limpió el estado local.");
        }
      }
      return null;
    } catch (error) {
      if (!silent) {
        toast.error(error?.response?.data?.detail || "No se pudo sincronizar la sesión de caja");
      }
      return null;
    } finally {
      setSessionSyncing(false);
    }
  };

  useEffect(() => {
    if (!user?.branch_id) return;
    syncCashSessionFromServer({ silent: true });
  }, [user?.branch_id, systemCajaId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      CASHIER_SHIFT_KEY,
      JSON.stringify({ openedSessionId, sessionId, locked: isLocked })
    );
    window.dispatchEvent(new Event("cashier:shift-updated"));
  }, [openedSessionId, sessionId, isLocked]);

  useEffect(() => {
    let mounted = true;
    const loadRateFromManagementSource = async () => {
      const rates = await fetchUsdNioDualRates({
        withCredentials: true,
        fallbackBuy: DEFAULT_USD_NIO_BUY_RATE,
        fallbackSell: DEFAULT_USD_NIO_SELL_RATE,
      });
      if (mounted) {
        setTipoCambio(String(rates.buyRate));
        setSellTipoCambio(String(rates.sellRate));
      }
    };
    loadRateFromManagementSource();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadCancelReasons = async () => {
      try {
        const res = await axios.get(`${API}/settings/billing/cancel-reasons/public`, { withCredentials: true });
        const reasons = Array.isArray(res?.data?.reasons) ? res.data.reasons : [];
        const normalized = reasons
          .map((row) => String(row?.reason || "").trim())
          .filter(Boolean);
        if (mounted && normalized.length) {
          setCancelReasons(normalized);
        }
      } catch {
        // Fallback silently to built-in defaults
      }
    };
    loadCancelReasons();
    return () => {
      mounted = false;
    };
  }, []);

  const isSessionOpenedHere = useMemo(() => {
    const active = String(sessionId || "").trim();
    return Boolean(active) && Boolean(openedSessionId) && active === openedSessionId;
  }, [sessionId, openedSessionId]);

  const diffNio = Number(previewSummary?.difference_by_currency?.NIO || 0);
  const diffUsd = Number(previewSummary?.difference_by_currency?.USD || 0);

  const activePageToneClass = useMemo(() => {
    if (!isSessionOpenedHere) return "bg-background";
    const toneByTab = {
      cotizacion: "bg-blue-50 dark:bg-blue-950/30",
      credito: "bg-purple-50 dark:bg-purple-950/30",
      pagadas: "bg-emerald-50 dark:bg-emerald-950/30",
      abonos: "bg-violet-50 dark:bg-violet-950/30",
    };
    return toneByTab[activeTab] || "bg-background";
  }, [activeTab, isSessionOpenedHere]);

  const cashTabsListClass = "flex h-auto min-w-0 flex-1 gap-1 overflow-x-auto rounded-lg border bg-muted/30 p-1 touch-pan-x";
  const cashTabTriggerBaseClass =
    "group min-w-max shrink-0 inline-flex items-center justify-center gap-1 rounded-md border border-transparent px-2.5 py-1 text-xs font-semibold transition-all duration-150 hover:bg-background/80 data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:shadow-sm";

  const cashierTabToneClass = {
    cotizacion:
      "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200/80 dark:border-blue-500/30 dark:bg-blue-950/40 dark:text-blue-200 dark:hover:bg-blue-900/50 data-[state=active]:bg-blue-200 data-[state=active]:text-blue-900 dark:data-[state=active]:bg-blue-800/60 dark:data-[state=active]:text-blue-100",
    credito:
      "bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200/80 dark:border-purple-500/30 dark:bg-purple-950/40 dark:text-purple-200 dark:hover:bg-purple-900/50 data-[state=active]:bg-purple-200 data-[state=active]:text-purple-900 dark:data-[state=active]:bg-purple-800/60 dark:data-[state=active]:text-purple-100",
    pagadas:
      "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200/80 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-900/50 data-[state=active]:bg-emerald-200 data-[state=active]:text-emerald-900 dark:data-[state=active]:bg-emerald-800/60 dark:data-[state=active]:text-emerald-100",
    abonos:
      "bg-violet-50 text-violet-700 hover:bg-violet-100 border-violet-200/80 dark:border-violet-500/30 dark:bg-violet-950/40 dark:text-violet-200 dark:hover:bg-violet-900/50 data-[state=active]:bg-violet-200 data-[state=active]:text-violet-900 dark:data-[state=active]:bg-violet-800/60 dark:data-[state=active]:text-violet-100",
  };

  const resolveUsdNioRate = async () => {
    const rates = await fetchUsdNioDualRates({
      withCredentials: true,
      fallbackBuy: Number(tipoCambio || DEFAULT_USD_NIO_BUY_RATE),
      fallbackSell: Number(sellTipoCambio || DEFAULT_USD_NIO_SELL_RATE),
    });
    setTipoCambio(String(rates.buyRate));
    setSellTipoCambio(String(rates.sellRate));
    return rates.buyRate;
  };

  const updateOpenQty = (targetRow, value) => {
    const qty = Math.max(0, Number.parseInt(String(value || "0"), 10) || 0);
    setOpenDenominations((prev) => prev.map((item) => (
      item.moneda === targetRow.moneda && item.tipo === targetRow.tipo && item.valor_nominal === targetRow.valor_nominal
        ? { ...item, cantidad: qty }
        : item
    )));
  };

  const updateMovementQty = (targetRow, value) => {
    const qty = Math.max(0, Number.parseInt(String(value || "0"), 10) || 0);
    setMovementForm((prev) => ({
      ...prev,
      denominaciones: prev.denominaciones.map((item) => (
        item.moneda === targetRow.moneda && item.tipo === targetRow.tipo && item.valor_nominal === targetRow.valor_nominal
          ? { ...item, cantidad: qty }
          : item
      )),
    }));
  };

  const openingTotals = useMemo(() => {
    const summary = { NIO: 0, USD: 0 };
    for (const row of openDenominations) {
      summary[row.moneda] += Number(row.valor_nominal) * Number(row.cantidad || 0);
    }
    return { NIO: Number(summary.NIO.toFixed(2)), USD: Number(summary.USD.toFixed(2)) };
  }, [openDenominations]);

  const groupedOpening = useMemo(
    () => ({
      nioBills: openDenominations.filter((d) => d.moneda === "NIO" && d.tipo === "billete"),
      nioCoins: openDenominations.filter((d) => d.moneda === "NIO" && d.tipo === "moneda"),
      usdBills: openDenominations.filter((d) => d.moneda === "USD" && d.tipo === "billete"),
      usdCoins: openDenominations.filter((d) => d.moneda === "USD" && d.tipo === "moneda"),
    }),
    [openDenominations]
  );

  const movementRowsByCurrency = useMemo(() => {
    const rows = movementForm.denominaciones.filter((r) => r.moneda === movementForm.moneda);
    const bills = rows.filter((r) => r.tipo === "billete");
    const coins = rows.filter((r) => r.tipo === "moneda");
    const total = rows.reduce((acc, row) => acc + Number(row.valor_nominal) * Number(row.cantidad || 0), 0);
    return { bills, coins, total: Number(total.toFixed(2)) };
  }, [movementForm.denominaciones, movementForm.moneda]);

  const displayInvoiceRows = useMemo(() => {
    if (activeTab !== "cotizacion") return invoiceRows;
    return [...invoiceRows].sort(
      (a, b) => getCashierUrgencyState(b).minutes - getCashierUrgencyState(a).minutes,
    );
  }, [invoiceRows, activeTab]);

  const filteredInvoiceRows = useMemo(() => {
    if (activeTab !== "cotizacion") return displayInvoiceRows;
    const hasActiveFilters = Object.values(invoiceFilters).some(Boolean);
    if (!hasActiveFilters) return displayInvoiceRows;
    return displayInvoiceRows.filter((row) => matchesInvoiceFilters(row, invoiceFilters));
  }, [displayInvoiceRows, invoiceFilters, activeTab]);

  const openInvoiceStats = useMemo(() => {
    const total = invoiceRows.length;
    const urgent = invoiceRows.filter((row) => getCashierUrgencyState(row).level === "critical").length;
    return { total, urgent };
  }, [invoiceRows]);

  const selectedSale = useMemo(() => invoiceRows.find((row) => row.sale_id === selectedSaleId) || null, [invoiceRows, selectedSaleId]);

  const selectedAbonoCustomer = useMemo(
    () => abonoCustomers.find((row) => row.customer_id === selectedAbonoCustomerId) || null,
    [abonoCustomers, selectedAbonoCustomerId],
  );

  const selectedAbonoSale = useMemo(() => {
    if (!selectedAbonoCustomer || !selectedAbonoSaleId) return null;
    return (selectedAbonoCustomer.pending_sales || []).find((row) => row.sale_id === selectedAbonoSaleId) || null;
  }, [selectedAbonoCustomer, selectedAbonoSaleId]);

  const activeCollectSale = useMemo(() => {
    if (collectDialogOpen && collectDialogSale) return collectDialogSale;
    if (activeTab === "abonos" && selectedAbonoSale) {
      return {
        ...selectedAbonoSale,
        customer_name: selectedAbonoCustomer?.customer_name,
        customer_phone: selectedAbonoCustomer?.customer_phone,
      };
    }
    return selectedSale;
  }, [activeTab, selectedAbonoSale, selectedAbonoCustomer, selectedSale, collectDialogOpen, collectDialogSale]);

  const prefillCollectAmount = (sale, options = {}) => {
    const { force = false } = options;
    if (!sale?.sale_id) return;
    if (!force && prefillCollectSaleRef.current === sale.sale_id) return;
    prefillCollectSaleRef.current = sale.sale_id;
    const pending = Number(sale.amount_pending || 0);
    const planned = planToCollectForm(sale.planned_payment_plan, pending);
    const dualAmounts = dualCurrencyAmountFromPlan(sale.planned_payment_plan, pending);
    if (planned) {
      setCollectForm((prev) => ({
        ...prev,
        ...planned,
        ...dualAmounts,
        received_amount: "",
        received_nio: "",
        received_usd: "",
        reference: prev.reference,
        notes: prev.notes,
        force_remove_discount: prev.force_remove_discount,
        justification: prev.justification,
        card_type: prev.card_type,
        bank_name: prev.bank_name,
        transaction_number: prev.transaction_number,
      }));
      return;
    }
    const paymentMethod = mapSalePaymentMethod(sale);
    setCollectForm((prev) => ({
      ...prev,
      amount: pending > 0 ? String(pending) : "",
      nio_amount: pending > 0 ? String(pending) : "",
      usd_amount: "",
      received_amount: "",
      received_nio: "",
      received_usd: "",
      payment_method: paymentMethod,
      mode: String(sale?.payment_type || sale?.payment_method || "").toLowerCase() === "mixed" ? "mixed" : "single",
    }));
  };

  const requestSaleEdit = async (sale, reason) => {
    if (!sale?.sale_id) return;
    const trimmed = String(reason || "").trim();
    if (trimmed.length < 10) {
      toast.error("Indica una razón de al menos 10 caracteres");
      return;
    }
    try {
      await axios.post(
        `${API}/sales/${sale.sale_id}/requests/edit`,
        { reason: trimmed },
        { withCredentials: true },
      );
      toast.success("Solicitud de edición enviada a gerencia/supervisor");
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudo enviar la solicitud de edición");
    }
  };

  const openCollectDialogForSale = (sale) => {
    if (!sale?.sale_id) return;
    if (!requireOpenedAndUnlockedSession()) return;
    setActiveTab("cotizacion");
    setSelectedSaleId(sale.sale_id);
    setCollectDialogSale(sale);
    prefillCollectAmount(sale, { force: true });
    setCollectDialogOpen(true);
  };

  const handleVoucherScan = async (rawCode) => {
    const code = normalizeVoucherScanCode(rawCode);
    if (!code) return;
    if (!isValidVoucherScanCode(code)) {
      toast.error("Código inválido. Escanea el voucher (INV-YYYYMMDD-####)");
      return;
    }
    try {
      const res = await axios.get(`${API}/caja/facturas/lookup`, {
        withCredentials: true,
        params: { code },
      });
      const row = res?.data?.row;
      if (!row?.sale_id) {
        toast.error("Factura no encontrada");
        return;
      }
      openCollectDialogForSale(row);
      setVoucherScanInput("");
      toast.success(`Factura ${row.invoice_number} lista para cobro`);
    } catch (error) {
      const detail = error?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "No se encontró la factura escaneada");
    }
  };

  useEffect(() => {
    if (activeTab === "abonos") {
      if (selectedAbonoSale) prefillCollectAmount(selectedAbonoSale);
      return;
    }
    if (selectedSale) prefillCollectAmount(selectedSale);
  }, [activeTab, selectedSaleId, selectedAbonoSaleId, invoiceRows, selectedSale, selectedAbonoSale]);

  const authRequiredForCollect = useMemo(() => {
    if (!activeCollectSale) return false;
    if (activeCollectSale.pos_discount_authorized || posDiscountAuthStatus === "approved") return false;
    const discount = Number(activeCollectSale.discounts_applied_amount || 0);
    const cardInMixed = collectForm.mode === "mixed" && collectForm.pagos.some((p) => isCardMethod(p.metodo));
    const cardSingle = collectForm.mode === "single" && isCardMethod(collectForm.payment_method);
    return discount > 0 && (cardInMixed || cardSingle) && !collectForm.force_remove_discount;
  }, [activeCollectSale, collectForm, posDiscountAuthStatus]);

  const refreshPosDiscountAuthStatus = async (saleId) => {
    if (!saleId) {
      setPosDiscountAuthStatus("none");
      return;
    }
    try {
      const res = await axios.get(
        `${API}/caja/facturas/${saleId}/estado-autorizacion-descuento-tarjeta`,
        { withCredentials: true },
      );
      setPosDiscountAuthStatus(String(res?.data?.status || "none"));
    } catch {
      setPosDiscountAuthStatus("none");
    }
  };

  useEffect(() => {
    const saleId = activeCollectSale?.sale_id;
    if (!saleId) {
      setPosDiscountAuthStatus("none");
      return;
    }
    if (activeCollectSale?.pos_discount_authorized) {
      setPosDiscountAuthStatus("approved");
      return;
    }
    if (activeCollectSale?.pos_discount_request_status === "pending") {
      setPosDiscountAuthStatus("pending");
    }
    refreshPosDiscountAuthStatus(saleId);
  }, [activeCollectSale?.sale_id, activeCollectSale?.pos_discount_authorized, activeCollectSale?.pos_discount_request_status]);

  useEffect(() => {
    if (!authRequiredForCollect || posDiscountAuthStatus !== "pending") return undefined;
    const saleId = activeCollectSale?.sale_id;
    if (!saleId) return undefined;
    const intervalId = window.setInterval(() => {
      refreshPosDiscountAuthStatus(saleId);
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, [authRequiredForCollect, posDiscountAuthStatus, activeCollectSale?.sale_id]);

  const loadAbonoCustomers = async (searchValue = abonoSearch) => {
    setAbonosLoading(true);
    try {
      const res = await axios.get(`${API}/caja/clientes-pendientes`, {
        withCredentials: true,
        params: {
          search: searchValue,
          branch_id: user?.branch_id || undefined,
          limit: 80,
        },
      });
      const rows = Array.isArray(res?.data?.customers) ? res.data.customers : [];
      setAbonoCustomers(rows);
      if (!rows.find((row) => row.customer_id === selectedAbonoCustomerId)) {
        setSelectedAbonoCustomerId(rows[0]?.customer_id || "");
        setSelectedAbonoSaleId(rows[0]?.pending_sales?.[0]?.sale_id || "");
      }
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudieron buscar clientes pendientes");
    } finally {
      setAbonosLoading(false);
    }
  };

  const requestPosDiscountAuthorization = async () => {
    const saleId = activeCollectSale?.sale_id;
    if (!saleId) {
      toast.error("Selecciona una factura para solicitar autorización");
      return;
    }
    if (String(collectForm.justification || "").trim().length < 20) {
      toast.error("La justificación debe tener al menos 20 caracteres");
      return;
    }
    setPosDiscountAuthBusy(true);
    try {
      const res = await axios.post(
        `${API}/caja/facturas/${saleId}/solicitud-descuento-tarjeta`,
        {
          justificacion_interna: collectForm.justification,
          mostrar_al_cliente: false,
        },
        { withCredentials: true },
      );
      const status = String(res?.data?.status || "pending");
      setPosDiscountAuthStatus(status);
      toast.success("Solicitud enviada a gerencia/supervisor. Te avisaremos cuando aprueben.");
      await loadInvoices("cotizacion");
      if (activeTab === "abonos") {
        await loadAbonoCustomers(abonoSearch);
      }
    } catch (error) {
      const detail = error?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : (detail?.message || "No se pudo enviar la solicitud"));
    } finally {
      setPosDiscountAuthBusy(false);
    }
  };

  const requireOpenedAndUnlockedSession = () => {
    if (!sessionId || !isSessionOpenedHere) {
      toast.error("Debes abrir caja primero");
      return false;
    }
    if (isLocked) {
      toast.error("La sesión está bloqueada. Desbloquéala para operar.");
      return false;
    }
    return true;
  };

  const openCashSession = async () => {
    if (isSessionOpenedHere) {
      toast.error("Ya existe un turno activo en esta pantalla");
      return;
    }
    if (openedSessionId && openedSessionId !== sessionId) {
      setOpenedSessionId("");
    }
    setBusy((prev) => ({ ...prev, open: true }));
    try {
      const currentRate = await resolveUsdNioRate();
      const hasCashToDeclare = openDenominations.some((row) => Number(row.cantidad || 0) > 0);
      const payload = {
        caja_id: systemCajaId,
        denominaciones: hasCashToDeclare ? openDenominations : [],
        tipo_cambio_usd_nio: currentRate,
        observaciones: openingNotes,
      };
      const res = await axios.post(`${API}/caja/apertura`, payload, { withCredentials: true });
      const newSessionId = String(res?.data?.session_id || "");
      applyActiveSession(newSessionId);
      setServerActiveSession(res?.data || null);
      toast.success(`Caja abierta. ID de sesión: ${newSessionId}`);
    } catch (error) {
      const rawDetail = error?.response?.data?.detail;
      const detail = typeof rawDetail === "string"
        ? rawDetail
        : (rawDetail?.message || rawDetail?.detail || "");
      const duplicateSession = detail.toLowerCase().includes("sesión de caja abierta")
        || detail.toLowerCase().includes("sesion de caja abierta");
      if (duplicateSession) {
        const resumed = await syncCashSessionFromServer({ silent: true });
        if (resumed?.session_id) {
          toast.success(`Ya había una sesión abierta. Se retomó: ${resumed.session_id}`);
          return;
        }
      }
      toast.error(detail || "No se pudo abrir caja");
    } finally {
      setBusy((prev) => ({ ...prev, open: false }));
    }
  };

  const resumeCashSession = async () => {
    await syncCashSessionFromServer();
  };

  const closeCashSession = async () => {
    if (!requireOpenedAndUnlockedSession()) return;
    setBusy((prev) => ({ ...prev, close: true }));
    try {
      const currentRate = await resolveUsdNioRate();
      await axios.post(
        `${API}/caja/cierre`,
        {
          sesion_id: sessionId,
          conteo_fisico: openDenominations,
          observaciones: closingNotes,
          tipo_cambio_usd_nio: currentRate,
        },
        { withCredentials: true }
      );
      clearLocalSessionState();
      toast.success("Turno cerrado correctamente");
    } catch (error) {
      const detail = String(error?.response?.data?.detail || "");
      if (detail.toLowerCase().includes("ya está cerrada")) {
        clearLocalSessionState();
        toast.success("La sesión ya estaba cerrada; se sincronizó el estado local.");
      } else {
        toast.error(detail || "No se pudo cerrar caja");
      }
    } finally {
      setBusy((prev) => ({ ...prev, close: false }));
    }
  };

  const lockCashierSession = () => {
    if (!openedSessionId) {
      toast.error("No hay sesión activa para bloquear");
      return;
    }
    setIsLocked(true);
    setLockOverlayTone("warning");
    setUnlockPin("");
    toast.success("Sesión bloqueada");
  };

  const unlockCashierSession = async () => {
    if (!openedSessionId) {
      toast.error("No hay sesión activa");
      return;
    }
    if (!unlockPin || unlockPin.length !== 8) {
      setLockOverlayTone("danger");
      toast.error("Ingresa PIN de 8 dígitos");
      return;
    }
    setBusy((prev) => ({ ...prev, lock: true }));
    try {
      const expectedUserId = String(user?.user_id || user?.id || user?._id || "").trim();
      const loginPayload = expectedUserId ? { pin: unlockPin, user_id: expectedUserId } : { pin: unlockPin };
      const response = await axios.post(
        `${API}/auth/pin/login`,
        loginPayload,
        { withCredentials: true }
      );
      const resolvedUserId = String(
        response?.data?.user?.user_id || response?.data?.user_id || ""
      ).trim();
      if (expectedUserId && resolvedUserId && resolvedUserId !== expectedUserId) {
        throw new Error("PIN no corresponde al usuario del turno");
      }
      setIsLocked(false);
      setLockOverlayTone("warning");
      setUnlockPin("");
      toast.success("Sesión desbloqueada");
    } catch (error) {
      const detail = String(error?.response?.data?.detail || error?.message || "No se pudo desbloquear");
      if (detail.toLowerCase().includes("pin")) {
        setLockOverlayTone("danger");
      }
      toast.error(detail);
    } finally {
      setBusy((prev) => ({ ...prev, lock: false }));
    }
  };

  const loadInvoices = async (tabValue = activeTab, options = {}) => {
    const { showLoading = true } = options;
    if (showLoading) setInvoicesLoading(true);
    try {
      const res = await axios.get(`${API}/caja/facturas`, {
        withCredentials: true,
        params: {
          tab: tabValue,
          search: invoiceSearch,
          branch_id: user?.branch_id || undefined,
          limit: 200,
        },
      });
      const rows = Array.isArray(res?.data?.rows) ? res.data.rows : [];
      setInvoiceRows(rows);
      const pendingPreselect = pendingPreselectRef.current;
      if (pendingPreselect && rows.find((r) => r.sale_id === pendingPreselect)) {
        setSelectedSaleId(pendingPreselect);
        pendingPreselectRef.current = "";
      } else if (!rows.find((r) => r.sale_id === selectedSaleId)) {
        setSelectedSaleId(rows[0]?.sale_id || "");
      }
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudieron cargar facturas");
    } finally {
      if (showLoading) setInvoicesLoading(false);
    }
  };

  useEffect(() => {
    if (preselectedSaleId) {
      pendingPreselectRef.current = preselectedSaleId;
      setActiveTab("cotizacion");
      setSelectedSaleId(preselectedSaleId);
    }
  }, [preselectedSaleId]);

  useEffect(() => {
    if (["cotizacion", "credito", "pagadas"].includes(activeTab)) {
      loadInvoices(activeTab);
    }
    if (activeTab === "abonos" && isSessionOpenedHere) {
      loadAbonoCustomers(abonoSearch);
    }
  }, [activeTab, isSessionOpenedHere]);

  useEffect(() => {
    if (!isSessionOpenedHere) return;
    if (activeTab !== "cotizacion") return;

    // Keep open invoices synced in near real-time for cashier users.
    const intervalId = window.setInterval(() => {
      loadInvoices("cotizacion", { showLoading: false });
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeTab, isSessionOpenedHere, user?.branch_id, invoiceSearch]);

  useEffect(() => {
    if (!isSessionOpenedHere || isLocked || activeTab !== "cotizacion") return undefined;
    const focusTimer = window.setTimeout(() => {
      voucherScanRef.current?.focus?.();
    }, 250);
    return () => window.clearTimeout(focusTimer);
  }, [activeTab, isSessionOpenedHere, isLocked, collectDialogOpen]);

  useEffect(() => {
    if (!urgentSoundEnabled || activeTab !== "cotizacion" || !isSessionOpenedHere) return;
    const criticalRows = invoiceRows.filter((row) => getCashierUrgencyState(row).level === "critical");
    const freshCritical = criticalRows.filter((row) => !urgentSoundPlayedRef.current.has(row.sale_id));
    if (!freshCritical.length) return;
    playUrgentCashierAlert();
    freshCritical.forEach((row) => urgentSoundPlayedRef.current.add(row.sale_id));
  }, [invoiceRows, urgentSoundEnabled, activeTab, isSessionOpenedHere]);

  const toggleUrgentSound = () => {
    setUrgentSoundEnabled((prev) => {
      const next = !prev;
      window.localStorage.setItem(CASHIER_URGENT_SOUND_KEY, next ? "true" : "false");
      return next;
    });
  };

  const validateCardFields = (method, fields, label) => {
    if (!isCardMethod(method)) return true;
    if (!fields.card_type) {
      toast.error(`Indica si la tarjeta es débito o crédito (${label})`);
      return false;
    }
    if (!String(fields.bank_name || "").trim()) {
      toast.error(`Indica el banco emisor (${label})`);
      return false;
    }
    if (!String(fields.transaction_number || "").trim()) {
      toast.error(`Indica el número de transacción (${label})`);
      return false;
    }
    if (!String(fields.reference || fields.referencia_bancaria || "").trim()) {
      toast.error(`Indica la referencia bancaria (${label})`);
      return false;
    }
    return true;
  };

  const submitCollect = async (options = {}) => {
    const { saleOverride = null, quick = false } = options;
    if (!requireOpenedAndUnlockedSession()) return;
    const sale = saleOverride || activeCollectSale;
    if (!sale) {
      toast.error("Selecciona una factura o abono pendiente");
      return;
    }

    const exchangeRate = Number(tipoCambio || DEFAULT_USD_NIO_BUY_RATE);
    const buyRate = exchangeRate;
    const pendingDue = Number(sale.amount_pending || 0);
    const paymentMethod = quick ? mapSalePaymentMethod(sale) : collectForm.payment_method;
    const nioAmount = quick ? pendingDue : Number(collectForm.nio_amount || 0);
    const usdAmount = quick ? 0 : Number(collectForm.usd_amount || 0);
    const dualTotals = computeDualCurrencyTotals({
      pendingNio: pendingDue,
      nioAmount,
      usdAmount,
      exchangeRate,
      buyRate,
    });
    const amount = quick
      ? pendingDue
      : (nioAmount > 0 || usdAmount > 0 ? dualTotals.covered : Number(collectForm.amount || 0));
    const useDualCurrency = !quick && isCashOrTransferMethod(paymentMethod);
    const mode = quick
      ? "single"
      : (useDualCurrency && nioAmount > 0 && usdAmount > 0 ? "mixed" : collectForm.mode);
    const discount = Number(sale.discounts_applied_amount || 0);
    const cardInMixed = mode === "mixed" && collectForm.pagos.some((p) => isCardMethod(p.metodo));
    const cardSingle = mode === "single" && isCardMethod(paymentMethod);
    const needsAuth = discount > 0 && (cardInMixed || cardSingle) && !collectForm.force_remove_discount;

    if (mode === "single" && cardSingle && !quick) {
      if (!validateCardFields(paymentMethod, {
        card_type: collectForm.card_type,
        bank_name: collectForm.bank_name,
        transaction_number: collectForm.transaction_number,
        reference: collectForm.reference,
      }, "cobro simple")) {
        return;
      }
    }

    if (mode === "mixed") {
      const cardRows = collectForm.pagos.filter((p) => Number(p.monto_origen || 0) > 0 && isCardMethod(p.metodo));
      for (let idx = 0; idx < cardRows.length; idx += 1) {
        const row = cardRows[idx];
        if (!validateCardFields(row.metodo, row, `pago mixto #${idx + 1}`)) return;
      }
    }

    let pagos = [];
    let receivedAmount = null;
    if (useDualCurrency && (nioAmount > 0 || usdAmount > 0)) {
      pagos = buildDualCurrencyPagos({
        method: paymentMethod,
        nioAmount,
        usdAmount,
        receivedNio: collectForm.received_nio,
        receivedUsd: collectForm.received_usd,
        exchangeRate,
        buyRate,
        reference: collectForm.reference,
      });
      if (usdAmount <= 0.009) {
        receivedAmount = collectForm.received_nio || collectForm.received_amount
          ? Number(collectForm.received_nio || collectForm.received_amount)
          : null;
        pagos = [];
      }
    } else if (mode === "mixed") {
      pagos = collectForm.pagos
        .filter((p) => Number(p.monto_origen || 0) > 0)
        .map((p) => ({
          metodo: p.metodo,
          moneda: p.moneda,
          monto_origen: Number(p.monto_origen || 0),
          tasa_cambio: p.moneda === "USD" ? exchangeRate : null,
          received_amount: p.received_amount ? Number(p.received_amount) : null,
          referencia_bancaria: p.referencia_bancaria || null,
          card_type: p.card_type || null,
          bank_name: p.bank_name || null,
          transaction_number: p.transaction_number || null,
        }));
    }

    const payload = {
      sesion_id: sessionId,
      amount,
      payment_method: paymentMethod,
      reference: quick ? "" : collectForm.reference,
      notes: quick ? "Cobro rápido desde tarjeta" : collectForm.notes,
      received_amount: quick ? null : receivedAmount,
      force_remove_discount: Boolean(collectForm.force_remove_discount),
      card_type: mode === "single" && cardSingle ? collectForm.card_type : null,
      bank_name: mode === "single" && cardSingle ? collectForm.bank_name : null,
      transaction_number: mode === "single" && cardSingle ? collectForm.transaction_number : null,
      pagos: useDualCurrency && pagos.length > 0 ? pagos : (mode === "mixed" ? pagos : []),
    };

    if (payload.amount <= 0) {
      toast.error("El monto debe ser mayor a 0");
      return;
    }

    const isPartialCollect = amount < pendingDue - 0.009;
    if (!quick && useDualCurrency && !isPartialCollect) {
      if (!dualTotals.isComplete) {
        toast.error(`El cobro no cubre el pendiente. Faltan ${formatCashierMoney(dualTotals.remainingNio)}`);
        return;
      }
      if (dualTotals.isOver) {
        toast.error(`El cobro excede el pendiente por ${formatCashierMoney(dualTotals.overageNio)}`);
        return;
      }
    }

    if (mode === "mixed" && payload.pagos.length === 0) {
      toast.error("Agrega al menos una línea de pago mixto");
      return;
    }

    if (!quick && useDualCurrency && (collectForm.received_nio || collectForm.received_usd || collectForm.received_amount)) {
      const cashTotals = computeTotalCashChangeNio({
        nioAmount,
        usdAmount,
        receivedNio: collectForm.received_nio || collectForm.received_amount,
        receivedUsd: collectForm.received_usd,
        exchangeRate,
        buyRate,
      });
      if (!cashTotals.isValid) {
        const shortfall = formatCashierMoney(cashTotals.unified?.shortfall || 0);
        toast.error(`El efectivo recibido no cubre el cobro. Faltan ${shortfall}`);
        return;
      }
    }

    if (needsAuth) {
      if (posDiscountAuthStatus === "pending") {
        toast.error("Solicitud pendiente. Espera aprobación de gerencia o supervisor.");
        return;
      }
      toast.error("Envía solicitud a gerencia/supervisor o marca remover descuento.");
      return;
    }

    if (quick) setQuickCollectSaleId(sale.sale_id);
    setBusy((prev) => ({ ...prev, collect: true }));
    try {
      const response = await axios.post(`${API}/caja/facturas/${sale.sale_id}/cobrar`, payload, { withCredentials: true });
      const isPartial = amount < Number(sale.amount_pending || 0) - 0.009;
      const changeAmount = Number(response.data?.change_amount || 0);
      const successMessage = quick
        ? "Cobro total aplicado"
        : (isPartial ? "Abono parcial registrado" : "Cobro aplicado correctamente");
      toast.success(
        changeAmount > 0.009
          ? `${successMessage}. Cambio: ${formatCashierMoney(changeAmount)}`
          : successMessage,
      );
      await printInvoiceAfterCollect(sale, response.data);
      if (sale?.delivery_info?.is_delivery || sale?.delivery_required) {
        setDeliveryDispatchJobId(buildSaleJobId(sale.sale_id));
      }
      setCollectDialogOpen(false);
      setCollectDialogSale(null);
      prefillCollectSaleRef.current = "";
      await loadInvoices("cotizacion");
      if (activeTab === "abonos") {
        await loadAbonoCustomers(abonoSearch);
      }
      if (!quick) {
        setCollectForm((prev) => ({
          ...prev,
          amount: "",
          received_amount: "",
          nio_amount: "",
          usd_amount: "",
          received_nio: "",
          received_usd: "",
          reference: "",
          notes: "",
          force_remove_discount: false,
          justification: "",
          card_type: "",
          bank_name: "",
          transaction_number: "",
        }));
      }
    } catch (error) {
      const detail = error?.response?.data?.detail;
      if (detail?.error === "PAYMENT_PLAN_MISMATCH") {
        toast.error(detail?.message || "El cobro no coincide con el plan acordado. Solicita edición a gerencia.");
      } else {
        toast.error(typeof detail === "string" ? detail : (detail?.message || "No se pudo cobrar factura"));
      }
    } finally {
      setBusy((prev) => ({ ...prev, collect: false }));
      setQuickCollectSaleId("");
    }
  };

  const isCashierInvoiceBulkPurgeable = (sale) => {
    const paid = Number(sale?.amount_paid || 0);
    const status = String(sale?.payment_status || "").toLowerCase();
    return status === "pending" && paid <= 0.009;
  };

  const handleDeleteCashierInvoice = async (sale) => {
    if (!canPurgeCashierInvoices) {
      toast.error("Solo gerencia, supervisores o programadores pueden eliminar facturas en caja");
      return;
    }
    if (!sale?.sale_id) return;
    const label = sale.invoice_number || sale.sale_id;
    const partial = Number(sale?.amount_paid || 0) > 0.009;
    const confirmText = partial
      ? `¿Eliminar ${label}? Tiene abonos parciales (C$${toMoney(sale.amount_paid)}).`
      : `¿Eliminar ${label} de la cola de caja?`;
    if (!window.confirm(confirmText)) return;

    setPurgeBusySaleId(sale.sale_id);
    try {
      await axios.delete(`${API}/caja/facturas/${sale.sale_id}`, { withCredentials: true });
      toast.success(`Factura ${label} eliminada de caja`);
      if (selectedSaleId === sale.sale_id) {
        setSelectedSaleId("");
        setCollectDialogOpen(false);
        setCollectDialogSale(null);
      }
      await loadInvoices(activeTab);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudo eliminar la factura");
    } finally {
      setPurgeBusySaleId("");
    }
  };

  const handleClearCashierQueue = async () => {
    if (!canPurgeCashierInvoices) {
      toast.error("Solo gerencia, supervisores o programadores pueden limpiar la cola de caja");
      return;
    }
    const tabForClear = activeTab === "credito" ? "credito" : "cotizacion";
    const purgeableCount = invoiceRows.filter(isCashierInvoiceBulkPurgeable).length;
    if (!purgeableCount) {
      toast.message("No hay facturas pendientes sin abonos para limpiar");
      return;
    }
    if (!window.confirm(
      `¿Limpiar ${purgeableCount} factura${purgeableCount === 1 ? "" : "s"} pendiente${purgeableCount === 1 ? "" : "s"} sin abonos en caja? Esta acción anula las facturas.`,
    )) {
      return;
    }

    setBusy((prev) => ({ ...prev, clearQueue: true }));
    try {
      const res = await axios.post(
        `${API}/caja/facturas/clear-queue`,
        { branch_id: user?.branch_id || undefined, tab: tabForClear },
        { withCredentials: true },
      );
      const removed = Number(res?.data?.removed || 0);
      toast.success(`Cola limpiada (${removed} factura${removed === 1 ? "" : "s"} eliminada${removed === 1 ? "" : "s"})`);
      setSelectedSaleId("");
      setCollectDialogOpen(false);
      setCollectDialogSale(null);
      await loadInvoices(tabForClear);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudo limpiar la cola de caja");
    } finally {
      setBusy((prev) => ({ ...prev, clearQueue: false }));
    }
  };

  const handleQuickCollect = (sale) => {
    const method = mapSalePaymentMethod(sale);
    if (isCardMethod(method)) {
      toast.info("El cobro con tarjeta requiere banco, transacción y referencia. Usa el formulario de cobro.");
      setSelectedSaleId(sale.sale_id);
      return;
    }
    setSelectedSaleId(sale.sale_id);
    submitCollect({ saleOverride: sale, quick: true });
  };

  const submitCancelInvoice = async () => {
    if (!requireOpenedAndUnlockedSession()) return;
    if (!selectedSale) {
      toast.error("Selecciona una factura");
      return;
    }
    if (!cancelForm.motivo.trim()) {
      toast.error("Indica motivo de anulación");
      return;
    }
    if (cancelForm.justificacion_interna.trim().length < 20) {
      toast.error("La justificación debe tener al menos 20 caracteres");
      return;
    }

    setBusy((prev) => ({ ...prev, cancel: true }));
    try {
      await axios.post(
        `${API}/caja/facturas/${selectedSale.sale_id}/anular`,
        {
          motivo: cancelForm.motivo,
          justificacion_interna: cancelForm.justificacion_interna,
          autorizado_por: cancelForm.autorizado_por || null,
        },
        { withCredentials: true }
      );
      toast.success("Factura anulada");
      setCancelForm({ motivo: "", justificacion_interna: "", autorizado_por: "" });
      await loadInvoices("cotizacion");
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudo anular factura");
    } finally {
      setBusy((prev) => ({ ...prev, cancel: false }));
    }
  };

  const submitMovement = async () => {
    if (!requireOpenedAndUnlockedSession()) return;
    const amount = Number(movementRowsByCurrency.total || 0);
    if (amount <= 0) {
      toast.error("Ingresa cantidades válidas en denominaciones");
      return;
    }

    setBusy((prev) => ({ ...prev, movement: true }));
    try {
      const denominationsAudit = movementForm.denominaciones
        .filter((d) => d.moneda === movementForm.moneda && Number(d.cantidad || 0) > 0)
        .map((d) => `${d.tipo}:${d.valor_nominal}x${d.cantidad}`)
        .join(" | ");

      await axios.post(
        `${API}/caja/movimiento`,
        {
          sesion_id: sessionId,
          tipo: movementForm.tipo,
          moneda: movementForm.moneda,
          monto: amount,
          referencia: movementForm.referencia,
          observaciones: [movementForm.observaciones, denominationsAudit].filter(Boolean).join(" || "),
        },
        { withCredentials: true }
      );
      toast.success(`Movimiento de ${movementForm.tipo} registrado`);
      setMovementForm((prev) => ({ ...prev, referencia: "", observaciones: "", denominaciones: buildDefaultDenominations() }));
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudo registrar movimiento");
    } finally {
      setBusy((prev) => ({ ...prev, movement: false }));
    }
  };

  const previewFisico = async () => {
    if (!requireOpenedAndUnlockedSession()) return;
    setBusy((prev) => ({ ...prev, preview: true }));
    try {
      const currentRate = await resolveUsdNioRate();
      const response = await axios.post(
        `${API}/caja/arqueo/preview-fisico`,
        {
          sesion_id: sessionId,
          conteo_fisico: openDenominations,
          tipo_cambio_usd_nio: currentRate,
        },
        { withCredentials: true }
      );
      setPreviewSummary(response?.data || null);
      setShowPreviewPanel(true);
      toast.success("Preview de arqueo físico generado");
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudo generar preview");
    } finally {
      setBusy((prev) => ({ ...prev, preview: false }));
    }
  };

  const handlePreviewPointerDown = (event) => {
    if (event.button !== 0) return;
    previewDragOffset.current = {
      x: event.clientX - previewPanelPos.x,
      y: event.clientY - previewPanelPos.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePreviewPointerMove = (event) => {
    if (!previewDragOffset.current) return;
    const nextX = Math.max(12, event.clientX - previewDragOffset.current.x);
    const nextY = Math.max(12, event.clientY - previewDragOffset.current.y);
    setPreviewPanelPos({ x: nextX, y: nextY });
  };

  const handlePreviewPointerUp = (event) => {
    previewDragOffset.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const fetchManagementReport = async () => {
    if (!sessionId) {
      toast.error("No hay sesión activa");
      return;
    }
    setBusy((prev) => ({ ...prev, report: true }));
    try {
      await axios.get(`${API}/caja/cierre/${sessionId}/reporte-gerencia`, { withCredentials: true });
      toast.success("Reporte gerencial cargado");
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudo cargar reporte gerencial");
    } finally {
      setBusy((prev) => ({ ...prev, report: false }));
    }
  };

  const downloadManagementExcel = async () => {
    if (!sessionId) {
      toast.error("No hay sesión activa");
      return;
    }
    setBusy((prev) => ({ ...prev, excel: true }));
    try {
      const res = await axios.get(`${API}/caja/cierre/${sessionId}/excel`, {
        withCredentials: true,
        responseType: "blob",
      });
      downloadBlob(res, `cierre_caja_${sessionId}_${new Date().toISOString().replace(/[:.]/g, "-")}.xlsx`);
      toast.success("Excel de cierre descargado");
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudo descargar Excel");
    } finally {
      setBusy((prev) => ({ ...prev, excel: false }));
    }
  };

  const collectPanelProps = {
    collectForm,
    setCollectForm,
    exchangeRate: Number(tipoCambio || DEFAULT_USD_NIO_BUY_RATE),
    authRequiredForCollect,
    posDiscountAuthStatus,
    posDiscountAuthBusy,
    onRequestPosDiscountAuthorization: requestPosDiscountAuthorization,
    onRequestSaleEdit: requestSaleEdit,
    busyCollect: busy.collect,
    canOperate: isSessionOpenedHere && !isLocked,
    canCancelInvoice,
    cancelForm,
    setCancelForm,
    cancelReasons,
    onSubmitCancel: submitCancelInvoice,
    busyCancel: busy.cancel,
  };

  return (
    <div className={cn("p-4 sm:p-6 space-y-4 transition-colors", activePageToneClass)} data-testid="cashier-page">
      <div className="flex items-start justify-between gap-3 flex-wrap ui-fade-in-stagger">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Caja</h1>
          <p className="text-sm text-muted-foreground">Cobro, arqueo y control de turno</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isSessionOpenedHere ? (
            <Badge variant="default" className="animate-erp-pulse">Turno activo</Badge>
          ) : (
            <Badge variant="outline">Sin turno</Badge>
          )}
          {!isCashier ? (
            <Badge variant="outline" className="capitalize">Rol: {user?.role || "sin rol"}</Badge>
          ) : null}
          {sessionId ? (
            <span className="text-[11px] font-mono text-muted-foreground max-w-[220px] truncate" data-testid="cash-session-id-header" title={sessionId}>
              {sessionId}
            </span>
          ) : null}
        </div>
      </div>

      {deliveryDispatchJobId ? (
        <Card className="border-emerald-300 bg-emerald-50/70">
          <CardContent className="py-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-emerald-900">Entrega cobrada — notifique al conductor por WhatsApp</p>
            <div className="flex gap-2">
              <DriverWhatsAppDispatchButton jobId={deliveryDispatchJobId} />
              <Button size="sm" variant="ghost" onClick={() => setDeliveryDispatchJobId("")}>Cerrar</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!isSessionOpenedHere && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="pt-6 text-amber-900 text-sm space-y-3">
            <p>
              Flujo obligatorio: apertura con arqueo inicial antes de cobrar, anular, registrar entradas o salidas.
              Puedes abrir en cero sin detallar denominaciones.
            </p>
            {serverActiveSession?.session_id ? (
              <div className="rounded-md border border-amber-400 bg-amber-100/80 p-3 space-y-2">
                <p>
                  Hay una sesión abierta en el servidor
                  <span className="font-mono font-semibold"> {serverActiveSession.session_id}</span>
                  {serverActiveSession.opened_by_name ? ` (${serverActiveSession.opened_by_name})` : ""}.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-amber-500 text-amber-950 hover:bg-amber-200"
                  onClick={resumeCashSession}
                  disabled={sessionSyncing}
                >
                  {sessionSyncing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Retomar sesión abierta
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {!isSessionOpenedHere ? (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Apertura y control de sesión</CardTitle>
          <CardDescription>El turno se abre con conteo inicial y puede bloquearse/desbloquearse con PIN.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>TC compra (pagos US$)</Label>
                  <Input type="number" step="0.01" value={tipoCambio} readOnly disabled />
                  <p className="text-xs text-muted-foreground">TC venta (precios): {sellTipoCambio}</p>
                </div>
                <div className="space-y-2">
                  <Label>Observación apertura</Label>
                  <Input value={openingNotes} onChange={(e) => setOpeningNotes(e.target.value)} placeholder="Opcional: nota de arqueo inicial" />
                </div>
              </div>

              <DenominationGrid
                title="Denominaciones apertura"
                bills={groupedOpening.nioBills}
                coins={groupedOpening.nioCoins}
                onUpdateQty={updateOpenQty}
                showCurrencyPlaceholders
              />
              <DenominationGrid
                title="Denominaciones apertura USD"
                bills={groupedOpening.usdBills}
                coins={groupedOpening.usdCoins}
                onUpdateQty={updateOpenQty}
                showCurrencyPlaceholders
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-md border bg-muted/40 p-3 text-sm">
                <div><span className="font-semibold">Total C$:</span> {toMoney(openingTotals.NIO)}</div>
                <div><span className="font-semibold">Total US$:</span> {toMoney(openingTotals.USD)}</div>
                <div className="text-muted-foreground">Puedes abrir caja en cero; si no hay efectivo, no es obligatorio detallar denominaciones.</div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={openCashSession}
                  disabled={busy.open || isSessionOpenedHere || sessionSyncing}
                  data-testid="cashier-open-session-btn"
                >
                  {busy.open ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Abrir turno
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => syncCashSessionFromServer()}
                  disabled={sessionSyncing || busy.open}
                >
                  {sessionSyncing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Sincronizar sesión
                </Button>
              </div>
            </>
          }
        </CardContent>
      </Card>
      ) : null}

      <div className="relative">
      <div className={isLocked ? "pointer-events-none select-none blur-[2px] opacity-50" : ""}>
      {isSessionOpenedHere ? (
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
        <Card className="border-primary/30 shadow-sm ui-panel animate-fade-up-soft">
          <CardContent className="py-2.5 space-y-2">
            <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
              <ErpFormToolbar className="shrink-0">
                <ErpToolbarButton
                  action="refresh"
                  icon={ClipboardCheck}
                  label="Arqueo"
                  onClick={previewFisico}
                  disabled={busy.preview || isLocked}
                  title="Preview de arqueo físico"
                  className={busy.preview ? "[&_svg]:animate-spin" : ""}
                />
                <ErpToolbarButton
                  action="save"
                  icon={Lock}
                  label="Bloquear"
                  onClick={lockCashierSession}
                  disabled={!openedSessionId || isLocked}
                  title="Bloquear sesión de caja"
                />
                <ErpToolbarButton
                  action="clear"
                  icon={Power}
                  label="Cerrar turno"
                  onClick={closeCashSession}
                  disabled={busy.close || isLocked}
                  title="Cerrar sesión con arqueo"
                  className={busy.close ? "[&_svg]:animate-spin" : ""}
                />
                {canViewManagement ? (
                  <>
                    <ErpToolbarButton
                      action="refresh"
                      icon={FileText}
                      label="Reporte"
                      onClick={fetchManagementReport}
                      disabled={busy.report || !sessionId}
                      title="Cargar reporte gerencial"
                    />
                    <ErpToolbarButton
                      action="save"
                      icon={Download}
                      label="Excel"
                      onClick={downloadManagementExcel}
                      disabled={busy.excel || !sessionId}
                      title="Descargar Excel de cierre"
                    />
                  </>
                ) : null}
              </ErpFormToolbar>
              <TabsList className={cashTabsListClass}>
                <TabsTrigger value="pagadas" className={cn(cashTabTriggerBaseClass, cashierTabToneClass.pagadas)}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Pagadas
                </TabsTrigger>
                <TabsTrigger value="cotizacion" className={cn(cashTabTriggerBaseClass, cashierTabToneClass.cotizacion)}>
                  <FileText className="h-3.5 w-3.5" />
                  Cotización ({openInvoiceStats.total}
                  {openInvoiceStats.urgent > 0 ? ` · ${openInvoiceStats.urgent} urg.` : ""})
                </TabsTrigger>
                <TabsTrigger value="credito" className={cn(cashTabTriggerBaseClass, cashierTabToneClass.credito)}>
                  <CreditCard className="h-3.5 w-3.5" />
                  Crédito
                </TabsTrigger>
                <TabsTrigger value="abonos" className={cn(cashTabTriggerBaseClass, cashierTabToneClass.abonos)}>
                  <Wallet className="h-3.5 w-3.5" />
                  Abonos
                </TabsTrigger>
              </TabsList>
            </div>
            <Accordion type="single" collapsible className="rounded-md border bg-muted/20 px-3">
              <AccordionItem value="cash-movements" className="border-0">
                <AccordionTrigger className="py-2 text-xs font-medium hover:no-underline">
                  Entradas y salidas de efectivo
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pb-1">
                    <MovementCard
                      title="Entrada de efectivo"
                      movementForm={movementForm}
                      setMovementForm={setMovementForm}
                      movementRowsByCurrency={movementRowsByCurrency}
                      updateMovementQty={updateMovementQty}
                      busy={busy.movement}
                      submitMovement={submitMovement}
                      forceType="entrada"
                      disabled={!isSessionOpenedHere || isLocked}
                      compact
                    />
                    <MovementCard
                      title="Salida de efectivo"
                      movementForm={movementForm}
                      setMovementForm={setMovementForm}
                      movementRowsByCurrency={movementRowsByCurrency}
                      updateMovementQty={updateMovementQty}
                      busy={busy.movement}
                      submitMovement={submitMovement}
                      forceType="salida"
                      disabled={!isSessionOpenedHere || isLocked}
                      compact
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        <Card className="border-primary/30 shadow-sm ui-panel animate-fade-up-soft">
          <CardContent className="pt-3 pb-4">
        <TabsContent value="cotizacion" className="mt-0">
          <CashierInvoiceWorkspace
            toolbarProps={{
              search: invoiceSearch,
              onChangeSearch: setInvoiceSearch,
              onRefresh: () => loadInvoices("cotizacion"),
              loading: invoicesLoading,
              filters: invoiceFilters,
              onToggleFilter: (key) => setInvoiceFilters((prev) => ({ ...prev, [key]: !prev[key] })),
              urgentSoundEnabled,
              onToggleUrgentSound: toggleUrgentSound,
              showVoucherScan: isSessionOpenedHere && !isLocked,
              voucherScanValue: voucherScanInput,
              onVoucherScanChange: setVoucherScanInput,
              onVoucherScanSubmit: handleVoucherScan,
              voucherScanRef,
              canPurgeInvoices: canPurgeCashierInvoices,
              purgeableCount: invoiceRows.filter(isCashierInvoiceBulkPurgeable).length,
              onClearQueue: handleClearCashierQueue,
              clearingQueue: busy.clearQueue,
            }}
            rows={filteredInvoiceRows}
            selectedSaleId={selectedSaleId}
            onSelect={setSelectedSaleId}
            loading={invoicesLoading}
            emptyText={
              displayInvoiceRows.length && filteredInvoiceRows.length === 0
                ? "Ninguna factura coincide con los filtros activos"
                : "No hay cotizaciones pendientes de cobro"
            }
            showBranchBadge={canViewManagement}
            onQuickCollect={handleQuickCollect}
            quickCollectBusy={busy.collect}
            quickCollectSaleId={quickCollectSaleId}
            canOperate={isSessionOpenedHere && !isLocked}
            canPurgeInvoice={canPurgeCashierInvoices}
            onPurgeInvoice={handleDeleteCashierInvoice}
            purgeBusySaleId={purgeBusySaleId}
            selectedSale={selectedSale}
            collectPanelProps={{
              ...collectPanelProps,
              onSubmitCollect: () => submitCollect(),
              onReload: () => loadInvoices("cotizacion"),
              invoicesLoading,
            }}
          />
        </TabsContent>

        <TabsContent value="abonos" className="mt-0">
          <CashierAbonoWorkspace
            search={abonoSearch}
            onChangeSearch={setAbonoSearch}
            onSearch={() => loadAbonoCustomers(abonoSearch)}
            loading={abonosLoading}
            customers={abonoCustomers}
            selectedCustomerId={selectedAbonoCustomerId}
            onSelectCustomer={(customer) => {
              setSelectedAbonoCustomerId(customer.customer_id);
              setSelectedAbonoSaleId(customer.pending_sales?.[0]?.sale_id || "");
              prefillCollectSaleRef.current = "";
            }}
            selectedCustomer={selectedAbonoCustomer}
            selectedSaleId={selectedAbonoSaleId}
            onSelectSale={(saleId) => {
              setSelectedAbonoSaleId(saleId);
              prefillCollectSaleRef.current = "";
            }}
            selectedSale={selectedAbonoSale}
            activeCollectSale={activeCollectSale}
            collectPanelProps={{
              ...collectPanelProps,
              onSubmitCollect: () => submitCollect(),
              onReload: () => loadAbonoCustomers(abonoSearch),
              invoicesLoading: abonosLoading,
              submitLabel: "Registrar abono",
              showPartialHint: true,
            }}
          />
        </TabsContent>

        <TabsContent value="credito" className="mt-0">
          <CashierInvoiceWorkspace
            toolbarProps={{
              search: invoiceSearch,
              onChangeSearch: setInvoiceSearch,
              onRefresh: () => loadInvoices("credito"),
              loading: invoicesLoading,
              filters: invoiceFilters,
              onToggleFilter: (key) => setInvoiceFilters((prev) => ({ ...prev, [key]: !prev[key] })),
            }}
            rows={filteredInvoiceRows}
            selectedSaleId={selectedSaleId}
            onSelect={setSelectedSaleId}
            loading={invoicesLoading}
            emptyText="No hay facturas a crédito pendientes"
            showBranchBadge={canViewManagement}
            onQuickCollect={handleQuickCollect}
            quickCollectBusy={busy.collect}
            quickCollectSaleId={quickCollectSaleId}
            canOperate={isSessionOpenedHere && !isLocked}
            selectedSale={selectedSale}
            collectPanelProps={{
              ...collectPanelProps,
              onSubmitCollect: () => submitCollect(),
              onReload: () => loadInvoices("credito"),
              invoicesLoading,
            }}
          />
        </TabsContent>

        <TabsContent value="pagadas" className="mt-0 space-y-3">
          <InvoiceToolbar
            search={invoiceSearch}
            onChangeSearch={setInvoiceSearch}
            onRefresh={() => loadInvoices("pagadas")}
            loading={invoicesLoading}
            compact
          />
          <div className="rounded-lg border bg-muted/15 max-h-[min(60vh,560px)] overflow-y-auto p-2">
            <InvoiceLayout
              rows={invoiceRows}
              selectedSaleId={selectedSaleId}
              onSelect={setSelectedSaleId}
              loading={invoicesLoading}
              emptyText="No hay facturas pagadas"
              layout="grid"
            />
          </div>
        </TabsContent>
          </CardContent>
        </Card>
      </Tabs>
      ) : (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Las pestañas de facturas y movimientos se habilitan al abrir sesión de caja.
          </CardContent>
        </Card>
      )}

      {!String(sessionId || "").trim() && (
        <Card>
          <CardHeader>
            <CardTitle>Notas de cierre y reportes</CardTitle>
            <CardDescription>Herramientas para supervisión y gerencia.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Observaciones de cierre</Label>
              <Textarea rows={2} value={closingNotes} onChange={(e) => setClosingNotes(e.target.value)} placeholder="Notas de cierre" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={fetchManagementReport} disabled={busy.report || !canViewManagement || !sessionId}>
                {busy.report ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
                Cargar reporte gerencial
              </Button>
              <Button variant="outline" onClick={downloadManagementExcel} disabled={busy.excel || !canViewManagement || !sessionId}>
                {busy.excel ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                Descargar Excel cierre
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      </div>
      {isLocked && (
        <div
          className={[
            "fixed inset-0 z-[80] flex items-center justify-center px-4",
            "backdrop-blur-md",
            lockOverlayTone === "danger" ? "bg-rose-700/35" : "bg-amber-500/35",
          ].join(" ")}
        >
          <div
            className={[
              "w-full max-w-md rounded-lg border p-4 shadow-xl",
              lockOverlayTone === "danger"
                ? "border-rose-400 bg-rose-950/85 text-rose-50"
                : "border-amber-400 bg-amber-950/85 text-amber-50",
            ].join(" ")}
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldAlert className="h-4 w-4" />
              Sesión bloqueada
            </div>
            <p className="mt-2 text-sm opacity-95">
              Desbloquea con tu PIN para reactivar caja. Mientras esté bloqueada, sidebar, tema, cierre de sesión y acciones quedan deshabilitadas.
            </p>
            <div className="mt-3 space-y-2">
              <Label htmlFor="cashier-unlock-pin">PIN de usuario para desbloquear</Label>
              <Input
                id="cashier-unlock-pin"
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={unlockPin}
                onChange={(e) => setUnlockPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="PIN de 8 dígitos"
                autoFocus
              />
            </div>
            <div className="mt-3 flex justify-end">
              <Button onClick={unlockCashierSession} disabled={busy.lock}>
                {busy.lock ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Unlock className="h-4 w-4 mr-2" />}
                Desbloquear
              </Button>
            </div>
          </div>
        </div>
      )}
      </div>

      {showPreviewPanel && (
        <div className="fixed z-[70]" style={{ left: previewPanelPos.x, top: previewPanelPos.y }}>
          <div className="w-[380px] rounded-xl border border-border bg-background/95 text-foreground shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
              <div
                className="flex flex-1 items-center gap-2 text-sm font-semibold cursor-move"
                onPointerDown={handlePreviewPointerDown}
                onPointerMove={handlePreviewPointerMove}
                onPointerUp={handlePreviewPointerUp}
              >
                <ClipboardCheck className="h-4 w-4" />
                Preview arqueo físico
              </div>
              <Button size="sm" variant="ghost" onClick={() => setShowPreviewPanel(false)}>
                Cerrar
              </Button>
            </div>
            <div className="space-y-2 p-4 text-sm">
              <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
                <div className="font-medium">Teórico NIO</div>
                <div className="text-right">C${toMoney(previewSummary?.expected_by_currency?.NIO)}</div>
                <div className="font-medium">Teórico USD</div>
                <div className="text-right">US${toMoney(previewSummary?.expected_by_currency?.USD)}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
                <div className="font-medium">Físico NIO</div>
                <div className="text-right">C${toMoney(previewSummary?.physical_by_currency?.NIO)}</div>
                <div className="font-medium">Físico USD</div>
                <div className="text-right">US${toMoney(previewSummary?.physical_by_currency?.USD)}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
                <div className="font-medium">Diferencia NIO</div>
                <div className={`text-right font-semibold ${differenceToneClass(diffNio)}`}>{toSignedMoney(diffNio, "C$")}</div>
                <div className="font-medium">Diferencia USD</div>
                <div className={`text-right font-semibold ${differenceToneClass(diffUsd)}`}>{toSignedMoney(diffUsd, "US$")}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/40 p-3">
                <div className="font-semibold">Saldo teórico NIO</div>
                <div className="text-right font-semibold">C${toMoney(previewSummary?.saldo_teorico_nio)}</div>
                <div className="font-semibold">Total físico NIO</div>
                <div className="text-right font-semibold">C${toMoney(previewSummary?.total_fisico_nio)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog
        open={collectDialogOpen}
        onOpenChange={(open) => {
          setCollectDialogOpen(open);
          if (!open) setCollectDialogSale(null);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cobro por escaneo de voucher</DialogTitle>
            <DialogDescription>
              {collectDialogSale?.invoice_number
                ? `Factura ${collectDialogSale.invoice_number} · ${collectDialogSale.customer_name || "Cliente"}`
                : "Confirma el cobro de la factura escaneada."}
            </DialogDescription>
          </DialogHeader>
          {collectDialogSale ? (
            <CollectActionCard
              sale={collectDialogSale}
              collectForm={collectForm}
              setCollectForm={setCollectForm}
              authRequiredForCollect={authRequiredForCollect}
              posDiscountAuthStatus={posDiscountAuthStatus}
              posDiscountAuthBusy={posDiscountAuthBusy}
              onRequestPosDiscountAuthorization={requestPosDiscountAuthorization}
              onRequestSaleEdit={requestSaleEdit}
              onSubmitCollect={() => submitCollect({ saleOverride: collectDialogSale })}
              busyCollect={busy.collect}
              canOperate={isSessionOpenedHere && !isLocked}
              onReload={() => loadInvoices("cotizacion")}
              invoicesLoading={invoicesLoading}
              canCancelInvoice={canCancelInvoice}
              cancelForm={cancelForm}
              setCancelForm={setCancelForm}
              cancelReasons={cancelReasons}
              onSubmitCancel={submitCancelInvoice}
              busyCancel={busy.cancel}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function paymentMethodLabel(method) {
  const key = String(method || "").toLowerCase();
  if (["transfer", "transferencia"].includes(key)) return "Transferencia";
  if (["card", "tarjeta"].includes(key)) return "Tarjeta";
  return "Efectivo";
}

function CashierAgreedPaymentSummary({ sale, exchangeRate }) {
  const lines = Array.isArray(sale?.planned_payment_plan?.lines) ? sale.planned_payment_plan.lines : [];
  const method = paymentMethodLabel(sale?.payment_method || sale?.payment_type || "cash");

  if (!lines.length) {
    return (
      <div className="rounded-lg border bg-muted/15 px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Forma de pago acordada</p>
        <p className="mt-1 text-sm font-medium">{method}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-sky-300/50 bg-sky-50/70 dark:bg-sky-950/20 px-3 py-2.5 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-900/80 dark:text-sky-200">
        Forma de pago acordada
      </p>
      <div className="space-y-1.5">
        {lines.map((line, index) => {
          const currency = String(line?.moneda || "NIO").toUpperCase();
          const amount = Number(line?.monto_origen || 0);
          const nioEq = currency === "USD" ? amount * Number(exchangeRate || 36.5) : amount;
          return (
            <div key={`plan-line-${index}`} className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium">
                {paymentMethodLabel(line?.metodo)} · {currency === "USD" ? formatUsdMoney(amount) : formatCashierMoney(amount)}
              </span>
              {currency === "USD" ? (
                <span className="text-xs text-muted-foreground tabular-nums">= {formatCashierMoney(nioEq)}</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CashierDualCurrencyPayment({
  pendingNio,
  exchangeRate,
  method,
  nioAmount,
  usdAmount,
  receivedNio,
  receivedUsd,
  onChange,
  amountsLocked = false,
  showPartialHint = false,
}) {
  const totals = useMemo(
    () => computeDualCurrencyTotals({ pendingNio, nioAmount, usdAmount, exchangeRate, buyRate: exchangeRate }),
    [pendingNio, nioAmount, usdAmount, exchangeRate],
  );
  const cashTotals = useMemo(
    () => computeTotalCashChangeNio({
      nioAmount,
      usdAmount,
      receivedNio,
      receivedUsd,
      exchangeRate,
      buyRate: exchangeRate,
    }),
    [nioAmount, usdAmount, receivedNio, receivedUsd, exchangeRate],
  );
  const showNioReceived = Number(nioAmount || 0) > 0;
  const showUsdReceived = Number(usdAmount || 0) > 0;
  const methodLabel = paymentMethodLabel(method);

  const applyRemainderNio = () => {
    onChange({ nio_amount: totals.remainingNio > 0 ? String(totals.remainingNio) : "" });
  };

  const applyRemainderUsd = () => {
    onChange({ usd_amount: totals.remainingUsd > 0 ? String(totals.remainingUsd) : "" });
  };

  return (
    <div className="space-y-3 rounded-lg border border-emerald-300/40 bg-emerald-50/40 dark:bg-emerald-950/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
          Registrar {methodLabel.toLowerCase()}
        </p>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          TC US$1 = {formatCashierMoney(exchangeRate)}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2 rounded-md border bg-background/80 p-3">
          <Label className="text-sm">Córdobas (C$)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            className="h-11 text-lg font-semibold tabular-nums"
            value={nioAmount}
            readOnly={amountsLocked}
            disabled={amountsLocked}
            onChange={(e) => onChange({ nio_amount: e.target.value })}
            placeholder="0.00"
          />
          {!amountsLocked ? (
            <Button type="button" size="sm" variant="outline" onClick={applyRemainderNio}>
              Usar resto en córdobas ({formatCashierMoney(totals.remainingNio)})
            </Button>
          ) : null}
          {showNioReceived ? (
            <div className="space-y-1.5 pt-1">
              <Label className="text-xs">Recibido en córdobas</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                className="h-10 text-lg font-semibold tabular-nums"
                value={receivedNio}
                onChange={(e) => onChange({ received_nio: e.target.value })}
                placeholder={formatCashierMoney(nioAmount)}
              />
            </div>
          ) : null}
        </div>

        <div className="space-y-2 rounded-md border bg-background/80 p-3">
          <Label className="text-sm">Dólares (US$)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            className="h-11 text-lg font-semibold tabular-nums"
            value={usdAmount}
            readOnly={amountsLocked}
            disabled={amountsLocked}
            onChange={(e) => onChange({ usd_amount: e.target.value })}
            placeholder="0.00"
          />
          {!amountsLocked ? (
            <Button type="button" size="sm" variant="outline" onClick={applyRemainderUsd}>
              Usar resto en dólares ({formatUsdMoney(totals.remainingUsd)})
            </Button>
          ) : null}
          {showUsdReceived ? (
            <div className="space-y-1.5 pt-1">
              <Label className="text-xs">Recibido en dólares</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                className="h-10 text-lg font-semibold tabular-nums"
                value={receivedUsd}
                onChange={(e) => onChange({ received_usd: e.target.value })}
                placeholder={formatUsdMoney(usdAmount)}
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-md border bg-background/80 px-3 py-2.5 space-y-1 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Total cubierto</span>
          <span className="font-semibold tabular-nums">{formatCashierMoney(totals.covered)}</span>
        </div>
        {!totals.isComplete && !showPartialHint ? (
          <div className="flex items-center justify-between gap-2 text-amber-800 dark:text-amber-200">
            <span>Restante</span>
            <span className="font-semibold tabular-nums">
              {formatCashierMoney(totals.remainingNio)}
              {totals.remainingUsd > 0 ? ` · ${formatUsdMoney(totals.remainingUsd)}` : ""}
            </span>
          </div>
        ) : null}
        {totals.isComplete ? (
          <p className="text-emerald-700 dark:text-emerald-300 text-xs font-medium">Monto completo para este cobro</p>
        ) : null}
        {cashTotals.totalChangeNio > 0.009 ? (
          <div className="flex items-center justify-between gap-2 border-t pt-2 text-emerald-800 dark:text-emerald-200">
            <span className="font-medium">Cambio total (en córdobas)</span>
            <span className="text-xl font-bold tabular-nums">{formatCashierMoney(cashTotals.totalChangeNio)}</span>
          </div>
        ) : null}
        {showUsdReceived && cashTotals.usd.changeNio > 0.009 ? (
          <p className="text-[11px] text-muted-foreground tabular-nums">
            Incluye cambio por dólares: {formatUsdMoney(cashTotals.usd.changeUsd)} = {formatCashierMoney(cashTotals.usd.changeNio)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function CardPaymentFields({
  cardType,
  bankName,
  transactionNumber,
  reference,
  referenceKey = "reference",
  onChange,
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 rounded-md border border-dashed p-3 bg-muted/20">
      <div className="space-y-1">
        <Label className="text-xs">Tipo de tarjeta</Label>
        <select
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          value={cardType}
          onChange={(e) => onChange({ card_type: e.target.value })}
        >
          <option value="">Selecciona</option>
          <option value="debit">Débito</option>
          <option value="credit">Crédito</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Banco emisor</Label>
        <select
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          value={bankName}
          onChange={(e) => onChange({ bank_name: e.target.value })}
        >
          <option value="">Selecciona banco</option>
          {CARD_BANKS.map((bank) => (
            <option key={bank} value={bank}>{bank}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">No. transacción</Label>
        <Input
          value={transactionNumber}
          onChange={(e) => onChange({ transaction_number: e.target.value })}
          placeholder="Número POS/banco"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Referencia bancaria</Label>
        <Input
          value={reference}
          onChange={(e) => onChange({ [referenceKey]: e.target.value })}
          placeholder="Referencia/autorización"
        />
      </div>
    </div>
  );
}

function CollectActionCard({
  sale,
  collectForm,
  setCollectForm,
  exchangeRate = DEFAULT_USD_NIO_BUY_RATE,
  authRequiredForCollect,
  posDiscountAuthStatus = "none",
  posDiscountAuthBusy = false,
  onRequestPosDiscountAuthorization,
  onRequestSaleEdit,
  onSubmitCollect,
  busyCollect,
  canOperate,
  onReload,
  invoicesLoading,
  submitLabel = "Cobrar factura",
  showPartialHint = false,
  canCancelInvoice = false,
  cancelForm,
  setCancelForm,
  cancelReasons = [],
  onSubmitCancel,
  busyCancel = false,
  shell = "card",
}) {
  const paymentPlanLocked = Boolean(sale?.payment_plan_locked && sale?.planned_payment_plan?.lines?.length);
  const [editReason, setEditReason] = useState("");
  const pendingAmount = Number(sale?.amount_pending || 0);
  const nioAmount = Number(collectForm.nio_amount || 0);
  const usdAmount = Number(collectForm.usd_amount || 0);
  const dualTotals = useMemo(
    () => computeDualCurrencyTotals({
      pendingNio: pendingAmount,
      nioAmount,
      usdAmount,
      exchangeRate,
      buyRate: exchangeRate,
    }),
    [pendingAmount, nioAmount, usdAmount, exchangeRate],
  );
  const amountToCollect = dualTotals.covered > 0 ? dualTotals.covered : pendingAmount;
  const isPartialPayment = amountToCollect > 0 && pendingAmount > amountToCollect + 0.009;
  const isPanel = shell === "panel";
  const paymentMethod = collectForm.payment_method || mapSalePaymentMethod(sale);
  const useDualCurrency = isCashOrTransferMethod(paymentMethod);
  const showCardSection = isCardMethod(paymentMethod);
  const cashTotals = useMemo(
    () => computeTotalCashChangeNio({
      nioAmount,
      usdAmount,
      receivedNio: collectForm.received_nio || collectForm.received_amount,
      receivedUsd: collectForm.received_usd,
      exchangeRate,
      buyRate: exchangeRate,
    }),
    [nioAmount, usdAmount, collectForm.received_nio, collectForm.received_amount, collectForm.received_usd, exchangeRate],
  );
  const canCollectPayment = useMemo(
    () => canSubmitCashierCollect({
      pendingNio: pendingAmount,
      nioAmount,
      usdAmount,
      receivedNio: collectForm.received_nio,
      receivedUsd: collectForm.received_usd,
      receivedAmount: collectForm.received_amount,
      exchangeRate,
      buyRate: exchangeRate,
      useDualCurrency,
      allowPartial: showPartialHint || isPartialPayment,
      authBlocked: authRequiredForCollect && posDiscountAuthStatus !== "approved",
    }),
    [
      pendingAmount,
      nioAmount,
      usdAmount,
      collectForm.received_nio,
      collectForm.received_usd,
      collectForm.received_amount,
      exchangeRate,
      useDualCurrency,
      showPartialHint,
      isPartialPayment,
      authRequiredForCollect,
      posDiscountAuthStatus,
    ],
  );

  const header = (
    <div className={isPanel ? "space-y-1 border-b pb-3" : undefined}>
      {isPanel ? (
        <>
          <p className="text-sm font-semibold tracking-tight">Cobro · {sale?.invoice_number}</p>
          <p className="text-xs text-muted-foreground">
            {sale?.customer_name || "Cliente"}
            {sale?.vehicle_plate ? ` · ${sale.vehicle_plate}` : ""}
            {" · "}Pendiente C${toMoney(sale?.amount_pending)}
            {showPartialHint ? " · Abono parcial permitido" : ""}
          </p>
        </>
      ) : (
        <>
          <CardTitle>Cobro y acciones - {sale?.invoice_number}</CardTitle>
          <CardDescription>
            {sale?.customer_name || "Cliente"}
            {sale?.vehicle_plate ? ` · ${sale.vehicle_plate}` : ""}
            {" | "}Pendiente: C${toMoney(sale?.amount_pending)}
            {showPartialHint ? " · Puedes abonar un monto menor al total" : ""}
          </CardDescription>
        </>
      )}
    </div>
  );

  const body = (
      <div className={cn("space-y-4", isPanel && "pt-3")}>
        <CashierAmountHero
          sale={sale}
          amountToCollect={amountToCollect}
          cashChange={{
            received: cashTotals.unified?.receivedTotalNio || 0,
            due: cashTotals.unified?.dueNio || amountToCollect,
            change: cashTotals.totalChangeNio,
            shortfall: cashTotals.unified?.shortfall || 0,
            isValid: cashTotals.isValid,
            isExact: cashTotals.totalChangeNio <= 0.009,
          }}
          showCashChange={useDualCurrency && cashTotals.totalChangeNio > 0.009}
        />

        <CashierLegalBreakdown sale={sale} compact={isPanel} />

        <CashierAgreedPaymentSummary sale={sale} exchangeRate={exchangeRate} />

        {paymentPlanLocked ? (
          <div className="rounded-md border border-sky-300 bg-sky-50 p-3 space-y-2 text-sm text-sky-950">
            <p className="text-xs">Si el cliente cambió condiciones, solicita edición. Solo gerencia/supervisor puede modificar la factura.</p>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="grow space-y-1 min-w-[220px]">
                <Label className="text-xs">Razón de solicitud de edición</Label>
                <Input value={editReason} onChange={(e) => setEditReason(e.target.value)} placeholder="Mínimo 10 caracteres" />
              </div>
              <Button type="button" variant="outline" onClick={() => onRequestSaleEdit?.(sale, editReason)}>
                Solicitar edición
              </Button>
            </div>
          </div>
        ) : null}

        {useDualCurrency ? (
          <CashierDualCurrencyPayment
            pendingNio={pendingAmount}
            exchangeRate={exchangeRate}
            method={paymentMethod}
            nioAmount={collectForm.nio_amount}
            usdAmount={collectForm.usd_amount}
            receivedNio={collectForm.received_nio}
            receivedUsd={collectForm.received_usd}
            amountsLocked={paymentPlanLocked}
            showPartialHint={showPartialHint}
            onChange={(patch) => setCollectForm((prev) => ({ ...prev, ...patch }))}
          />
        ) : null}

        {showCardSection ? (
          <CardPaymentFields
            cardType={collectForm.card_type}
            bankName={collectForm.bank_name}
            transactionNumber={collectForm.transaction_number}
            reference={collectForm.reference}
            onChange={(patch) => setCollectForm((prev) => ({ ...prev, ...patch }))}
          />
        ) : null}

        <div className="space-y-3 rounded-lg border bg-muted/10 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Referencia y notas
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {useDualCurrency ? (
              <div className="space-y-2">
                <Label>Referencia</Label>
                <Input value={collectForm.reference} onChange={(e) => setCollectForm((p) => ({ ...p, reference: e.target.value }))} />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Observaciones</Label>
              <Input value={collectForm.notes} onChange={(e) => setCollectForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
        </div>

        {isPartialPayment && (
          <div className="rounded-md border border-violet-300 bg-violet-50 px-3 py-2 text-sm text-violet-900">
            Abono parcial: quedará pendiente C${toMoney(pendingAmount - amountToCollect)} después de este cobro.
          </div>
        )}

        <div className="flex items-center gap-2 text-sm">
          <input
            id={`force-remove-discount-${sale?.sale_id}`}
            type="checkbox"
            checked={collectForm.force_remove_discount}
            onChange={(e) => setCollectForm((p) => ({ ...p, force_remove_discount: e.target.checked }))}
          />
          <Label htmlFor={`force-remove-discount-${sale?.sale_id}`} className="cursor-pointer">
            Forzar remover descuento cuando método incluye tarjeta (emergencia en caja)
          </Label>
        </div>

        {authRequiredForCollect && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-2">
            <div className="flex items-center gap-2 text-amber-900 text-sm font-medium">
              <ShieldAlert className="h-4 w-4" />
              Descuento + tarjeta requiere aprobación remota de gerencia o supervisor
            </div>
            <p className="text-xs text-amber-900/90">
              Por seguridad no se usa PIN en caja. Envía una solicitud; el gerente o supervisor la aprueba desde sus notificaciones.
            </p>
            <div className="space-y-2">
              <Label>Justificación interna (min 20)</Label>
              <Textarea
                rows={3}
                value={collectForm.justification}
                onChange={(e) => setCollectForm((p) => ({ ...p, justification: e.target.value }))}
                placeholder="Motivo de emergencia para cobrar con tarjeta manteniendo descuento"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="button"
                variant="outline"
                onClick={onRequestPosDiscountAuthorization}
                disabled={posDiscountAuthBusy || posDiscountAuthStatus === "pending"}
              >
                {posDiscountAuthBusy ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
                Enviar solicitud
              </Button>
              {posDiscountAuthStatus === "pending" ? (
                <Badge variant="outline" className="border-amber-500 text-amber-900">Pendiente de aprobación</Badge>
              ) : null}
              {posDiscountAuthStatus === "approved" ? (
                <Badge className="bg-emerald-600">Autorización aprobada</Badge>
              ) : null}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="lg" className="min-w-[180px] text-base" onClick={onSubmitCollect} disabled={busyCollect || !canOperate || !canCollectPayment}>
            {busyCollect ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
            {submitLabel}
          </Button>
          <Button variant="outline" onClick={onReload} disabled={invoicesLoading}>
            Recargar pendientes
          </Button>
        </div>

        {canCancelInvoice && cancelForm && setCancelForm && onSubmitCancel && (
          <Accordion type="single" collapsible>
            <AccordionItem value="cancel-invoice" className="rounded-md border px-3">
              <AccordionTrigger className="py-2 text-sm font-medium hover:no-underline">
                Anular factura
              </AccordionTrigger>
              <AccordionContent className="space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Motivo</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={cancelForm.motivo}
                  onChange={(e) => setCancelForm((p) => ({ ...p, motivo: e.target.value }))}
                >
                  <option value="">Selecciona una causa</option>
                  {cancelReasons.map((reason) => (
                    <option key={reason} value={reason}>{reason}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Justificación interna (min 20)</Label>
                <Textarea
                  rows={4}
                  className="min-h-[120px]"
                  value={cancelForm.justificacion_interna}
                  onChange={(e) => setCancelForm((p) => ({ ...p, justificacion_interna: e.target.value }))}
                  placeholder="Detalle interno obligatorio para auditoría"
                />
              </div>
              <div className="space-y-2">
                <Label>Autorizado por (user_id)</Label>
                <Input value={cancelForm.autorizado_por} onChange={(e) => setCancelForm((p) => ({ ...p, autorizado_por: e.target.value }))} placeholder="Opcional" />
              </div>
            </div>
            <Button variant="destructive" onClick={onSubmitCancel} disabled={busyCancel || !canOperate}>
              {busyCancel ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
              Anular factura
            </Button>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </div>
  );

  if (isPanel) {
    return (
      <div className="rounded-lg border border-primary/25 bg-card shadow-sm ui-panel p-3 sm:p-4">
        {header}
        {body}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>{header}</CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}

function CashierCollectPlaceholder({ variant = "invoice" }) {
  const isAbono = variant === "abono";
  return (
    <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground ui-panel min-h-[220px] flex flex-col items-center justify-center gap-2">
      {isAbono ? <Wallet className="h-8 w-8 opacity-40" /> : <FileText className="h-8 w-8 opacity-40" />}
      <p className="font-medium text-foreground/80">
        {isAbono ? "Selecciona cliente y cuenta" : "Selecciona una factura"}
      </p>
      <p className="text-xs max-w-[240px]">
        {isAbono
          ? "Busca un cliente con saldo pendiente y elige la factura o crédito a abonar."
          : "El panel de cobro aparece aquí. También puedes escanear el voucher para abrir el cobro directo."}
      </p>
    </div>
  );
}

function AbonoListPanel({ title, subtitle, children, className }) {
  return (
    <div className={cn("flex min-h-0 flex-col rounded-lg border bg-card/60", className)}>
      <div className="shrink-0 border-b px-3 py-2">
        <p className="text-sm font-semibold tracking-tight">{title}</p>
        {subtitle ? <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2 space-y-1.5">{children}</div>
    </div>
  );
}

function AbonoSelectRow({ active, onClick, primary, secondary, badge, badgeVariant = "outline" }) {
  return (
    <button
      type="button"
      className={cn(
        "w-full rounded-lg border p-2.5 text-left transition ui-interactive hover:bg-muted/40",
        active && "border-violet-400 bg-violet-50/70 ring-1 ring-violet-400/30 dark:bg-violet-950/30",
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-sm truncate">{primary}</div>
          {secondary ? <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{secondary}</div> : null}
        </div>
        {badge != null ? <Badge variant={badgeVariant} className="shrink-0 text-[11px]">{badge}</Badge> : null}
      </div>
    </button>
  );
}

function CashierAbonoWorkspace({
  search,
  onChangeSearch,
  onSearch,
  loading,
  customers,
  selectedCustomerId,
  onSelectCustomer,
  selectedCustomer,
  selectedSaleId,
  onSelectSale,
  selectedSale,
  activeCollectSale,
  collectPanelProps,
}) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(340px,42%)] gap-3 xl:gap-4 items-start">
      <div className="min-w-0 space-y-2">
        <div className="rounded-lg border bg-muted/20 p-2.5 space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <Input
              className="max-w-[280px] h-9 text-sm"
              placeholder="Cliente, teléfono, placa o factura"
              value={search}
              onChange={(e) => onChangeSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSearch();
              }}
            />
            <Button variant="outline" size="sm" onClick={onSearch} disabled={loading}>
              {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Buscar pendientes
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Cobros parciales y abonos a crédito. Puedes abonar menos del total pendiente.
          </p>
        </div>

        <div className="rounded-lg border bg-muted/15 max-h-[min(48vh,500px)] overflow-hidden p-2 ui-panel">
          <div className="grid h-full min-h-[280px] grid-cols-1 lg:grid-cols-2 gap-2">
            <AbonoListPanel
              title="Clientes con saldo"
              subtitle={
                loading
                  ? "Buscando..."
                  : `${customers.length} cliente${customers.length === 1 ? "" : "s"} encontrado${customers.length === 1 ? "" : "s"}`
              }
            >
              {loading ? (
                <div className="text-sm text-muted-foreground py-6 text-center">Buscando clientes...</div>
              ) : customers.length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center">
                  No hay clientes pendientes para la búsqueda actual.
                </div>
              ) : (
                customers.map((customer) => (
                  <AbonoSelectRow
                    key={customer.customer_id}
                    active={customer.customer_id === selectedCustomerId}
                    onClick={() => onSelectCustomer(customer)}
                    primary={(
                      <span className="inline-flex items-center gap-1.5">
                        <UserCircle2 className="h-3.5 w-3.5 shrink-0" />
                        {customer.customer_name}
                      </span>
                    )}
                    secondary={`${customer.customer_phone || "Sin teléfono"} · ${customer.pending_sales?.length || 0} cuenta${(customer.pending_sales?.length || 0) === 1 ? "" : "s"}`}
                    badge={`C$${toMoney(customer.pending_total)}`}
                  />
                ))
              )}
            </AbonoListPanel>

            <AbonoListPanel
              title="Cuentas del cliente"
              subtitle={selectedCustomer?.customer_name || "Selecciona un cliente"}
            >
              {!selectedCustomer ? (
                <div className="text-sm text-muted-foreground py-6 text-center">
                  Selecciona un cliente para ver sus facturas y créditos pendientes.
                </div>
              ) : (selectedCustomer.pending_sales || []).length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center">
                  Este cliente no tiene cuentas pendientes.
                </div>
              ) : (
                (selectedCustomer.pending_sales || []).map((sale) => (
                  <AbonoSelectRow
                    key={sale.sale_id}
                    active={sale.sale_id === selectedSaleId}
                    onClick={() => onSelectSale(sale.sale_id)}
                    primary={sale.invoice_number}
                    secondary={`${sale.account_kind === "credito" ? "Crédito" : "Pendiente"}${sale.vehicle_plate ? ` · ${sale.vehicle_plate}` : ""}`}
                    badge={`C$${toMoney(sale.amount_pending)}`}
                    badgeVariant={sale.account_kind === "credito" ? "secondary" : "outline"}
                  />
                ))
              )}
            </AbonoListPanel>
          </div>
        </div>
      </div>

      <aside className="min-w-0 xl:sticky xl:top-3 max-h-[min(72vh,680px)] overflow-y-auto">
        {selectedSale && activeCollectSale ? (
          <CollectActionCard
            shell="panel"
            sale={activeCollectSale}
            {...collectPanelProps}
          />
        ) : (
          <CashierCollectPlaceholder variant="abono" />
        )}
      </aside>
    </div>
  );
}

function CashierInvoiceWorkspace({
  toolbarProps,
  rows,
  selectedSaleId,
  onSelect,
  loading,
  emptyText,
  showBranchBadge = false,
  onQuickCollect,
  quickCollectBusy,
  quickCollectSaleId,
  canOperate,
  canPurgeInvoice = false,
  onPurgeInvoice,
  purgeBusySaleId = "",
  selectedSale,
  collectPanelProps,
}) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(340px,42%)] gap-3 xl:gap-4 items-start">
      <div className="min-w-0 space-y-2">
        <InvoiceToolbar {...toolbarProps} compact />
        <div className="rounded-lg border bg-muted/15 max-h-[min(48vh,500px)] overflow-y-auto p-2 ui-panel">
          <InvoiceLayout
            rows={rows}
            selectedSaleId={selectedSaleId}
            onSelect={onSelect}
            loading={loading}
            emptyText={emptyText}
            layout="grid"
            showBranchBadge={showBranchBadge}
            onQuickCollect={onQuickCollect}
            quickCollectBusy={quickCollectBusy}
            quickCollectSaleId={quickCollectSaleId}
            canOperate={canOperate}
            canPurgeInvoice={canPurgeInvoice}
            onPurgeInvoice={onPurgeInvoice}
            purgeBusySaleId={purgeBusySaleId}
            dense
          />
        </div>
      </div>
      <aside className="min-w-0 xl:sticky xl:top-3 max-h-[min(72vh,680px)] overflow-y-auto">
        {selectedSale ? (
          <CollectActionCard
            shell="panel"
            sale={selectedSale}
            {...collectPanelProps}
          />
        ) : (
          <CashierCollectPlaceholder />
        )}
      </aside>
    </div>
  );
}

const INVOICE_FILTER_OPTIONS = [
  { key: "urgent", label: "Urgentes" },
  { key: "installation", label: "Con instalación" },
  { key: "credit", label: "Crédito" },
  { key: "partial", label: "Pago parcial" },
];

function InvoiceToolbar({
  search,
  onChangeSearch,
  onRefresh,
  loading,
  filters = {},
  onToggleFilter,
  urgentSoundEnabled = true,
  onToggleUrgentSound,
  showVoucherScan = false,
  voucherScanValue = "",
  onVoucherScanChange,
  onVoucherScanSubmit,
  voucherScanRef,
  canPurgeInvoices = false,
  purgeableCount = 0,
  onClearQueue,
  clearingQueue = false,
  compact = false,
}) {
  const shellClass = compact
    ? "rounded-lg border bg-muted/20 p-2.5 space-y-2"
    : undefined;
  const content = (
    <>
        {showVoucherScan ? (
          <div className={cn(
            "flex flex-wrap gap-2 items-center rounded-md border border-primary/30 bg-primary/5",
            compact ? "p-2" : "p-3",
          )}>
            <Barcode className="h-5 w-5 text-primary shrink-0" />
            <Input
              ref={voucherScanRef}
              className="max-w-md font-mono"
              placeholder="Escanear voucher (INV-YYYYMMDD-####)"
              value={voucherScanValue}
              onChange={(e) => onVoucherScanChange?.(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onVoucherScanSubmit?.(voucherScanValue);
                }
              }}
              data-testid="cashier-voucher-scan"
            />
            <Button
              type="button"
              onClick={() => onVoucherScanSubmit?.(voucherScanValue)}
              disabled={!String(voucherScanValue || "").trim()}
            >
              Abrir cobro
            </Button>
            {!compact ? (
              <span className="text-xs text-muted-foreground">
                El lector USB escribe aquí y abre el diálogo de cobro al presionar Enter.
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            className={compact ? "max-w-[200px] h-9 text-sm" : "max-w-sm"}
            placeholder="Buscar por factura, cliente o sale_id"
            value={search}
            onChange={(e) => onChangeSearch(e.target.value)}
          />
          <Button variant="outline" size={compact ? "sm" : "default"} onClick={onRefresh} disabled={loading}>
            {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
            Recargar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onToggleUrgentSound}
            title={urgentSoundEnabled ? "Alerta sonora activa" : "Alerta sonora desactivada"}
          >
            {urgentSoundEnabled ? <Volume2 className="h-4 w-4 mr-2" /> : <VolumeX className="h-4 w-4 mr-2" />}
            {urgentSoundEnabled ? "Sonido ON" : "Sonido OFF"}
          </Button>
          {canPurgeInvoices ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 text-rose-700 border-rose-300 hover:bg-rose-50 dark:text-rose-300"
              disabled={clearingQueue || purgeableCount === 0}
              onClick={onClearQueue}
              data-testid="cashier-clear-queue"
            >
              {clearingQueue ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Limpiar facturas en caja
              {purgeableCount > 0 ? ` (${purgeableCount})` : ""}
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-muted-foreground mr-1">Filtros:</span>
          {INVOICE_FILTER_OPTIONS.map((option) => {
            const active = Boolean(filters[option.key]);
            return (
              <Button
                key={option.key}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                className="h-8 text-xs"
                onClick={() => onToggleFilter?.(option.key)}
              >
                {option.label}
              </Button>
            );
          })}
        </div>
    </>
  );

  if (compact) {
    return <div className={shellClass}>{content}</div>;
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">{content}</CardContent>
    </Card>
  );
}

function invoiceCardShellClass(row, active, horizontal = false, dense = false) {
  return cn(
    "rounded-lg border text-left transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ui-interactive",
    dense ? "p-1.5" : "p-2",
    getCashierUrgencyState(row).shellClass(active),
    horizontal && "min-h-[200px] w-[300px] shrink-0",
  );
}

function InvoiceLayout({
  rows,
  selectedSaleId,
  onSelect,
  loading,
  emptyText,
  layout = "vertical",
  showBranchBadge = false,
  onQuickCollect = null,
  quickCollectBusy = false,
  quickCollectSaleId = "",
  canOperate = true,
  canPurgeInvoice = false,
  onPurgeInvoice = null,
  purgeBusySaleId = "",
  dense = false,
}) {
  const isHorizontal = layout === "horizontal";
  const gridClass = dense
    ? "grid grid-cols-1 sm:grid-cols-2 gap-2"
    : "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3";

  if (loading) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">Cargando facturas...</div>
    );
  }

  if (!rows.length) {
    if (isHorizontal) {
      return (
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max gap-3">
            <div className="h-[140px] w-[280px] shrink-0 rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground flex items-center">
              {emptyText}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="py-10 text-center text-sm text-muted-foreground">{emptyText}</div>
    );
  }

  if (isHorizontal) {
    return (
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-3">
          {rows.map((row) => {
            const active = row.sale_id === selectedSaleId;
            return (
              <div
                key={row.sale_id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(row.sale_id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(row.sale_id);
                  }
                }}
                className={invoiceCardShellClass(row, active, true, dense)}
              >
                <OperationalJobCard
                  variant="cajero"
                  sale={row}
                  totalLabel={`C$${toMoney(row.amount_pending)}`}
                  embedded
                  showBranchBadge={showBranchBadge}
                  onQuickCollect={canOperate ? onQuickCollect : null}
                  quickCollectBusy={quickCollectBusy}
                  quickCollectSaleId={quickCollectSaleId}
                  canPurgeInvoice={canPurgeInvoice}
                  onPurgeInvoice={onPurgeInvoice}
                  purgeBusySaleId={purgeBusySaleId}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={gridClass}>
      {rows.map((row) => {
        const active = row.sale_id === selectedSaleId;
        return (
          <div
            key={row.sale_id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(row.sale_id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(row.sale_id);
              }
            }}
            className={invoiceCardShellClass(row, active, false, dense)}
          >
            <OperationalJobCard
              variant="cajero"
              sale={row}
              totalLabel={`C$${toMoney(row.amount_pending)}`}
              embedded
              showBranchBadge={showBranchBadge}
              onQuickCollect={canOperate ? onQuickCollect : null}
              quickCollectBusy={quickCollectBusy}
              quickCollectSaleId={quickCollectSaleId}
              canPurgeInvoice={canPurgeInvoice}
              onPurgeInvoice={onPurgeInvoice}
              purgeBusySaleId={purgeBusySaleId}
            />
          </div>
        );
      })}
    </div>
  );
}

function MovementCard({
  title,
  movementForm,
  setMovementForm,
  movementRowsByCurrency,
  updateMovementQty,
  busy,
  submitMovement,
  forceType,
  disabled,
  compact = false,
}) {
  const currentType = movementForm.tipo !== forceType ? forceType : movementForm.tipo;

  return (
    <Card className={compact ? "shadow-none border-muted/80" : ""}>
      <CardHeader className={compact ? "py-3 px-4" : undefined}>
        <CardTitle className={compact ? "text-base" : undefined}>{title}</CardTitle>
        {!compact ? (
          <CardDescription>Registro por denominaciones para mantener trazabilidad del efectivo.</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className={compact ? "space-y-3 px-4 pb-4 pt-0" : "space-y-4"}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-2">
            <Label>Moneda</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={movementForm.moneda}
              onChange={(e) => setMovementForm((prev) => ({ ...prev, tipo: forceType, moneda: e.target.value }))}
            >
              <option value="NIO">NIO</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div className="space-y-2 md:col-span-3">
            <Label>Referencia / observación</Label>
            <Input
              value={movementForm.referencia}
              onChange={(e) => setMovementForm((prev) => ({ ...prev, tipo: forceType, referencia: e.target.value }))}
            />
          </div>
        </div>

        <DenominationGrid
          title={`${movementForm.moneda} - ${currentType}`}
          bills={movementRowsByCurrency.bills}
          coins={movementRowsByCurrency.coins}
          onUpdateQty={updateMovementQty}
          showCurrencyPlaceholders={false}
        />

        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <span className="font-semibold">Total movimiento:</span> {movementForm.moneda} {toMoney(movementRowsByCurrency.total)}
        </div>

        <Button
          onClick={() => {
            setMovementForm((prev) => ({ ...prev, tipo: forceType }));
            submitMovement();
          }}
          disabled={busy || disabled}
        >
          {busy ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
          Registrar {forceType}
        </Button>
      </CardContent>
    </Card>
  );
}

function DenominationGrid({ title, bills, coins, onUpdateQty, showCurrencyPlaceholders = false }) {
  return (
    <div className="rounded-md border p-3 space-y-3">
      <h3 className="font-semibold">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <DenominationTable kindLabel="Billetes" rows={bills} onUpdateQty={onUpdateQty} showCurrencyPlaceholders={showCurrencyPlaceholders} />
        <DenominationTable kindLabel="Monedas" rows={coins} onUpdateQty={onUpdateQty} showCurrencyPlaceholders={showCurrencyPlaceholders} />
      </div>
    </div>
  );
}

function DenominationTable({ kindLabel, rows, onUpdateQty, showCurrencyPlaceholders = false }) {
  return (
    <div className="rounded-md border bg-muted/30 p-2">
      <div className="text-sm font-medium mb-2">{kindLabel}</div>
      <div className="space-y-2">
        {rows.map((row) => {
          const subtotal = Number(row.valor_nominal) * Number(row.cantidad || 0);
          const placeholder = showCurrencyPlaceholders
            ? (row.moneda === "USD" ? "Cantidad en dólares" : "Cantidad en córdobas")
            : undefined;
          return (
            <div key={`${row.moneda}-${row.tipo}-${row.valor_nominal}`} className="grid grid-cols-3 gap-2 items-center">
              <div className="text-sm">{Number(row.valor_nominal).toFixed(2)}</div>
              <Input
                type="number"
                min="0"
                step="1"
                value={row.cantidad}
                onChange={(e) => onUpdateQty(row, e.target.value)}
                placeholder={placeholder}
              />
              <div className="text-sm text-right">{subtotal.toFixed(2)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
