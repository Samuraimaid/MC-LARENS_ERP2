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
import { ArrowDown, ArrowUp, Ban, CheckCircle2, ClipboardCheck, Download, FileText, Lock, Power, RefreshCw, RotateCcw, Search, ShieldAlert, Unlock, UserCircle2, Volume2, VolumeX, Wallet } from "lucide-react";
import { fetchEffectiveUsdNioRate, DEFAULT_USD_NIO_RATE } from "@/lib/exchangeRate";
import { OperationalJobCard, getCashierUrgencyState } from "@/components/erp/OperationalJobCard";
import { cn } from "@/lib/utils";

const NIO_BILLS = [1000, 500, 200, 100, 50, 20, 10, 5, 1];
const NIO_COINS = [10, 5, 1, 0.5, 0.25, 0.1, 0.05];
const USD_BILLS = [100, 50, 20, 10, 5, 1];
const USD_COINS = [1, 0.5, 0.25, 0.1, 0.05, 0.01];
const CASHIER_SHIFT_KEY = "cashier.shift.state.v2";
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

function CashierLegalBreakdown({ sale }) {
  if (!sale) return null;

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

  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        Desglose legal
      </p>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <div
            key={row.key}
            className={`flex items-center justify-between text-sm ${
              row.highlight ? "border-t pt-2 mt-1 font-semibold text-primary" : ""
            }`}
          >
            <span className={row.strong || row.highlight ? "font-medium text-foreground" : "text-muted-foreground"}>
              {row.label}
            </span>
            <span
              className={`tabular-nums ${
                row.negative ? "text-violet-600 dark:text-violet-400" : row.highlight ? "text-primary" : ""
              } ${row.strong ? "font-semibold" : ""}`}
            >
              {row.negative ? "-" : ""}C${toMoney(Math.abs(Number(row.value || 0)))}
            </span>
          </div>
        ))}
      </div>
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
  const canViewManagement = useMemo(() => ["gerencia", "supervisor"].includes(user?.role), [user?.role]);
  const initialShift = useMemo(() => loadShiftState(), []);

  const [sessionId, setSessionId] = useState(initialShift.sessionId);
  const [openedSessionId, setOpenedSessionId] = useState(initialShift.openedSessionId);
  const [isLocked, setIsLocked] = useState(initialShift.locked);
  const [unlockPin, setUnlockPin] = useState("");
  const [lockOverlayTone, setLockOverlayTone] = useState("warning");

  const [tipoCambio, setTipoCambio] = useState(String(DEFAULT_USD_NIO_RATE));
  const [openingNotes, setOpeningNotes] = useState("");
  const [closingNotes, setClosingNotes] = useState("");
  const [openDenominations, setOpenDenominations] = useState(() => buildDefaultDenominations());

  const [activeTab, setActiveTab] = useState("abiertas");
  const [invoiceSearch, setInvoiceSearch] = useState("");
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
  });
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
      const rate = await fetchEffectiveUsdNioRate({ withCredentials: true, fallback: DEFAULT_USD_NIO_RATE });
      if (mounted) {
        setTipoCambio(String(rate));
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
      abiertas: "bg-blue-50 dark:bg-blue-950/30",
      abonos: "bg-violet-50 dark:bg-violet-950/30",
      cerradas: "bg-emerald-50 dark:bg-emerald-950/30",
      anuladas: "bg-amber-50 dark:bg-amber-950/30",
      devoluciones: "bg-red-50 dark:bg-red-950/30",
      entrada: "bg-lime-50 dark:bg-lime-950/30",
      salida: "bg-rose-50 dark:bg-rose-950/30",
    };
    return toneByTab[activeTab] || "bg-background";
  }, [activeTab, isSessionOpenedHere]);

  const cashTabsListClass = "flex h-auto w-full gap-1.5 overflow-x-auto rounded-full border bg-card/95 p-1.5 touch-pan-x";
  const cashTabTriggerBaseClass =
    "group min-w-max shrink-0 inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm sm:text-base font-semibold transition-all duration-150 hover:scale-[1.02] hover:shadow-md data-[state=active]:shadow-sm";

  const cashierTabToneClass = {
    abiertas:
      "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200/80 dark:border-blue-500/30 dark:bg-blue-950/40 dark:text-blue-200 dark:hover:bg-blue-900/50 data-[state=active]:bg-blue-200 data-[state=active]:text-blue-900 dark:data-[state=active]:bg-blue-800/60 dark:data-[state=active]:text-blue-100",
    abonos:
      "bg-violet-50 text-violet-700 hover:bg-violet-100 border-violet-200/80 dark:border-violet-500/30 dark:bg-violet-950/40 dark:text-violet-200 dark:hover:bg-violet-900/50 data-[state=active]:bg-violet-200 data-[state=active]:text-violet-900 dark:data-[state=active]:bg-violet-800/60 dark:data-[state=active]:text-violet-100",
    cerradas:
      "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200/80 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-900/50 data-[state=active]:bg-emerald-200 data-[state=active]:text-emerald-900 dark:data-[state=active]:bg-emerald-800/60 dark:data-[state=active]:text-emerald-100",
    anuladas:
      "bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200/80 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-900/50 data-[state=active]:bg-amber-200 data-[state=active]:text-amber-900 dark:data-[state=active]:bg-amber-800/60 dark:data-[state=active]:text-amber-100",
    devoluciones:
      "bg-red-50 text-red-700 hover:bg-red-100 border-red-200/80 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-900/50 data-[state=active]:bg-red-200 data-[state=active]:text-red-900 dark:data-[state=active]:bg-red-800/60 dark:data-[state=active]:text-red-100",
    entrada:
      "bg-lime-50 text-lime-700 hover:bg-lime-100 border-lime-200/80 dark:border-lime-500/30 dark:bg-lime-950/40 dark:text-lime-200 dark:hover:bg-lime-900/50 data-[state=active]:bg-lime-200 data-[state=active]:text-lime-900 dark:data-[state=active]:bg-lime-800/60 dark:data-[state=active]:text-lime-100",
    salida:
      "bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200/80 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-200 dark:hover:bg-rose-900/50 data-[state=active]:bg-rose-200 data-[state=active]:text-rose-900 dark:data-[state=active]:bg-rose-800/60 dark:data-[state=active]:text-rose-100",
  };

  const resolveUsdNioRate = async () => {
    const rate = await fetchEffectiveUsdNioRate({
      withCredentials: true,
      fallback: Number(tipoCambio || DEFAULT_USD_NIO_RATE),
    });
    setTipoCambio(String(rate));
    return rate;
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
    if (activeTab !== "abiertas") return invoiceRows;
    return [...invoiceRows].sort(
      (a, b) => getCashierUrgencyState(b).minutes - getCashierUrgencyState(a).minutes,
    );
  }, [invoiceRows, activeTab]);

  const filteredInvoiceRows = useMemo(() => {
    if (activeTab !== "abiertas") return displayInvoiceRows;
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
    if (activeTab === "abonos" && selectedAbonoSale) {
      return {
        ...selectedAbonoSale,
        customer_name: selectedAbonoCustomer?.customer_name,
        customer_phone: selectedAbonoCustomer?.customer_phone,
      };
    }
    return selectedSale;
  }, [activeTab, selectedAbonoSale, selectedAbonoCustomer, selectedSale]);

  const prefillCollectAmount = (sale) => {
    if (!sale?.sale_id) return;
    if (prefillCollectSaleRef.current === sale.sale_id) return;
    prefillCollectSaleRef.current = sale.sale_id;
    const pending = Number(sale.amount_pending || 0);
    setCollectForm((prev) => ({
      ...prev,
      amount: pending > 0 ? String(pending) : "",
    }));
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
      await loadInvoices("abiertas");
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
      const detail = String(error?.response?.data?.detail || "");
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
      setActiveTab("abiertas");
      setSelectedSaleId(preselectedSaleId);
    }
  }, [preselectedSaleId]);

  useEffect(() => {
    if (["abiertas", "cerradas", "anuladas"].includes(activeTab)) {
      loadInvoices(activeTab);
    }
    if (activeTab === "abonos" && isSessionOpenedHere) {
      loadAbonoCustomers(abonoSearch);
    }
  }, [activeTab, isSessionOpenedHere]);

  useEffect(() => {
    if (!isSessionOpenedHere) return;
    if (activeTab !== "abiertas") return;

    // Keep open invoices synced in near real-time for cashier users.
    const intervalId = window.setInterval(() => {
      loadInvoices("abiertas", { showLoading: false });
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeTab, isSessionOpenedHere, user?.branch_id, invoiceSearch]);

  useEffect(() => {
    if (!urgentSoundEnabled || activeTab !== "abiertas" || !isSessionOpenedHere) return;
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

    const amount = quick
      ? Number(sale.amount_pending || 0)
      : Number(collectForm.amount || 0);
    const paymentMethod = quick ? mapSalePaymentMethod(sale) : collectForm.payment_method;
    const mode = quick ? "single" : collectForm.mode;
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

    const payload = {
      sesion_id: sessionId,
      amount,
      payment_method: paymentMethod,
      reference: quick ? "" : collectForm.reference,
      notes: quick ? "Cobro rápido desde tarjeta" : collectForm.notes,
      received_amount: quick ? null : (collectForm.received_amount ? Number(collectForm.received_amount) : null),
      force_remove_discount: Boolean(collectForm.force_remove_discount),
      card_type: mode === "single" && cardSingle ? collectForm.card_type : null,
      bank_name: mode === "single" && cardSingle ? collectForm.bank_name : null,
      transaction_number: mode === "single" && cardSingle ? collectForm.transaction_number : null,
      pagos: mode === "mixed"
        ? collectForm.pagos
            .filter((p) => Number(p.monto_origen || 0) > 0)
            .map((p) => ({
              metodo: p.metodo,
              moneda: p.moneda,
              monto_origen: Number(p.monto_origen || 0),
              referencia_bancaria: p.referencia_bancaria || null,
              card_type: p.card_type || null,
              bank_name: p.bank_name || null,
              transaction_number: p.transaction_number || null,
            }))
        : [],
    };

    if (mode === "single" && payload.amount <= 0) {
      toast.error("El monto debe ser mayor a 0");
      return;
    }

    if (mode === "mixed" && payload.pagos.length === 0) {
      toast.error("Agrega al menos una línea de pago mixto");
      return;
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
      await axios.post(`${API}/caja/facturas/${sale.sale_id}/cobrar`, payload, { withCredentials: true });
      const isPartial = amount < Number(sale.amount_pending || 0) - 0.009;
      toast.success(
        quick
          ? "Cobro total aplicado"
          : (isPartial ? "Abono parcial registrado" : "Cobro aplicado correctamente"),
      );
      prefillCollectSaleRef.current = "";
      await loadInvoices("abiertas");
      if (activeTab === "abonos") {
        await loadAbonoCustomers(abonoSearch);
      }
      if (!quick) {
        setCollectForm((prev) => ({
          ...prev,
          amount: "",
          received_amount: "",
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
      toast.error(typeof detail === "string" ? detail : (detail?.message || "No se pudo cobrar factura"));
    } finally {
      setBusy((prev) => ({ ...prev, collect: false }));
      setQuickCollectSaleId("");
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
      await loadInvoices("abiertas");
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

  return (
    <div className={`p-6 space-y-6 transition-colors ${activePageToneClass}`} data-testid="cashier-page">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Caja Operativa</h1>
          <p className="text-muted-foreground">Versión cerrada con control de arqueo, cobros, anulaciones y flujo por pestañas</p>
        </div>
        {!isCashier ? (
          <div className="flex flex-col items-end gap-2 min-w-[260px]">
            <Badge variant={isSessionOpenedHere ? "default" : "outline"} className="capitalize">Rol: {user?.role || "sin rol"}</Badge>
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm w-full" data-testid="cash-session-id-header">
              <div className="text-xs text-muted-foreground">Session ID activo (no editable)</div>
              <div className="font-semibold break-all">{sessionId || "Sin sesión activa"}</div>
            </div>
          </div>
        ) : null}
      </div>

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

      <Card>
        {!isSessionOpenedHere ? (
          <CardHeader>
            <CardTitle>Apertura y control de sesión</CardTitle>
            <CardDescription>El turno se abre con conteo inicial y puede bloquearse/desbloquearse con PIN.</CardDescription>
          </CardHeader>
        ) : null}
        <CardContent className={isSessionOpenedHere ? "pt-6" : "space-y-4"}>
          {!isSessionOpenedHere ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tipo de cambio USD/NIO</Label>
                  <Input type="number" step="0.01" value={tipoCambio} readOnly disabled />
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
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={previewFisico}
                  disabled={busy.preview || !isSessionOpenedHere || isLocked}
                  className="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
                >
                  {busy.preview ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <ClipboardCheck className="h-4 w-4 mr-2" />}
                  Preview físico
                </Button>
                <Button
                  onClick={lockCashierSession}
                  disabled={!openedSessionId || isLocked}
                  className="bg-amber-500 text-amber-950 hover:bg-amber-400 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Bloquear
                </Button>
                <Button
                  variant="destructive"
                  onClick={closeCashSession}
                  disabled={busy.close || !isSessionOpenedHere || isLocked}
                  className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:text-red-950 dark:hover:bg-red-400"
                >
                  {busy.close ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Power className="h-4 w-4 mr-2" />}
                  Cerrar sesión (arqueo)
                </Button>
              </div>
            </>
          )}

        </CardContent>
      </Card>

      <div className="relative">
      <div className={isLocked ? "pointer-events-none select-none blur-[2px] opacity-50" : ""}>
      {isSessionOpenedHere ? (
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
        <TabsList className={cashTabsListClass}>
          <TabsTrigger value="abiertas" className={cn(cashTabTriggerBaseClass, cashierTabToneClass.abiertas)}>
            <FileText className="h-4 w-4 transition-transform duration-150 group-hover:scale-110 group-data-[state=active]:scale-110" />
            Facturas abiertas ({openInvoiceStats.total}
            {openInvoiceStats.urgent > 0 ? ` · ${openInvoiceStats.urgent} urgente${openInvoiceStats.urgent === 1 ? "" : "s"}` : ""})
          </TabsTrigger>
          <TabsTrigger value="abonos" className={cn(cashTabTriggerBaseClass, cashierTabToneClass.abonos)}>
            <Wallet className="h-4 w-4 transition-transform duration-150 group-hover:scale-110 group-data-[state=active]:scale-110" />
            Abonos / Clientes
          </TabsTrigger>
          <TabsTrigger value="cerradas" className={cn(cashTabTriggerBaseClass, cashierTabToneClass.cerradas)}>
            <CheckCircle2 className="h-4 w-4 transition-transform duration-150 group-hover:scale-110 group-data-[state=active]:scale-110" />
            Facturas cerradas
          </TabsTrigger>
          <TabsTrigger value="anuladas" className={cn(cashTabTriggerBaseClass, cashierTabToneClass.anuladas)}>
            <Ban className="h-4 w-4 transition-transform duration-150 group-hover:scale-110 group-data-[state=active]:scale-110" />
            Anuladas
          </TabsTrigger>
          <TabsTrigger value="devoluciones" className={cn(cashTabTriggerBaseClass, cashierTabToneClass.devoluciones)}>
            <RotateCcw className="h-4 w-4 transition-transform duration-150 group-hover:scale-110 group-data-[state=active]:scale-110" />
            Devoluciones
          </TabsTrigger>
          <TabsTrigger value="entrada" className={cn(cashTabTriggerBaseClass, cashierTabToneClass.entrada)}>
            <ArrowDown className="h-4 w-4 transition-transform duration-150 group-hover:scale-110 group-data-[state=active]:scale-110" />
            Entrada de efectivo
          </TabsTrigger>
          <TabsTrigger value="salida" className={cn(cashTabTriggerBaseClass, cashierTabToneClass.salida)}>
            <ArrowUp className="h-4 w-4 transition-transform duration-150 group-hover:scale-110 group-data-[state=active]:scale-110" />
            Salida de efectivo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="abiertas" className="space-y-4">
          <InvoiceToolbar
            search={invoiceSearch}
            onChangeSearch={setInvoiceSearch}
            onRefresh={() => loadInvoices("abiertas")}
            loading={invoicesLoading}
            filters={invoiceFilters}
            onToggleFilter={(key) => setInvoiceFilters((prev) => ({ ...prev, [key]: !prev[key] }))}
            urgentSoundEnabled={urgentSoundEnabled}
            onToggleUrgentSound={toggleUrgentSound}
          />
          <InvoiceLayout
            rows={filteredInvoiceRows}
            selectedSaleId={selectedSaleId}
            onSelect={setSelectedSaleId}
            loading={invoicesLoading}
            emptyText={
              displayInvoiceRows.length && filteredInvoiceRows.length === 0
                ? "Ninguna factura coincide con los filtros activos"
                : "No hay facturas abiertas"
            }
            layout="horizontal"
            showBranchBadge={canViewManagement}
            onQuickCollect={handleQuickCollect}
            quickCollectBusy={busy.collect}
            quickCollectSaleId={quickCollectSaleId}
            canOperate={isSessionOpenedHere && !isLocked}
          />

          {selectedSale && (
            <CollectActionCard
              sale={selectedSale}
              collectForm={collectForm}
              setCollectForm={setCollectForm}
              authRequiredForCollect={authRequiredForCollect}
              posDiscountAuthStatus={posDiscountAuthStatus}
              posDiscountAuthBusy={posDiscountAuthBusy}
              onRequestPosDiscountAuthorization={requestPosDiscountAuthorization}
              onSubmitCollect={() => submitCollect()}
              busyCollect={busy.collect}
              canOperate={isSessionOpenedHere && !isLocked}
              onReload={() => loadInvoices("abiertas")}
              invoicesLoading={invoicesLoading}
              canCancelInvoice={canCancelInvoice}
              cancelForm={cancelForm}
              setCancelForm={setCancelForm}
              cancelReasons={cancelReasons}
              onSubmitCancel={submitCancelInvoice}
              busyCancel={busy.cancel}
            />
          )}
        </TabsContent>

        <TabsContent value="abonos" className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex flex-wrap gap-2 items-center">
                <Input
                  className="max-w-md"
                  placeholder="Buscar cliente por nombre, teléfono, placa o factura"
                  value={abonoSearch}
                  onChange={(e) => setAbonoSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") loadAbonoCustomers(abonoSearch);
                  }}
                />
                <Button variant="outline" onClick={() => loadAbonoCustomers(abonoSearch)} disabled={abonosLoading}>
                  {abonosLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                  Buscar pendientes
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Cobros parciales y abonos a crédito. Puedes abonar menos del total pendiente.
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Clientes con saldo pendiente</CardTitle>
                <CardDescription>{abonoCustomers.length} cliente{abonoCustomers.length === 1 ? "" : "s"} encontrado{abonoCustomers.length === 1 ? "" : "s"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[420px] overflow-y-auto">
                {abonosLoading ? (
                  <div className="text-sm text-muted-foreground">Buscando clientes...</div>
                ) : abonoCustomers.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No hay clientes pendientes para la búsqueda actual.</div>
                ) : (
                  abonoCustomers.map((customer) => {
                    const active = customer.customer_id === selectedAbonoCustomerId;
                    return (
                      <button
                        key={customer.customer_id}
                        type="button"
                        className={cn(
                          "w-full rounded-lg border p-3 text-left transition hover:bg-muted/40",
                          active && "border-violet-400 bg-violet-50/70 dark:bg-violet-950/30",
                        )}
                        onClick={() => {
                          setSelectedAbonoCustomerId(customer.customer_id);
                          setSelectedAbonoSaleId(customer.pending_sales?.[0]?.sale_id || "");
                          prefillCollectSaleRef.current = "";
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              <UserCircle2 className="h-4 w-4" />
                              {customer.customer_name}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {customer.customer_phone || "Sin teléfono"}
                              {" · "}
                              {customer.pending_sales?.length || 0} cuenta{(customer.pending_sales?.length || 0) === 1 ? "" : "s"}
                            </div>
                          </div>
                          <Badge variant="outline">C${toMoney(customer.pending_total)}</Badge>
                        </div>
                      </button>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cuentas del cliente</CardTitle>
                <CardDescription>
                  {selectedAbonoCustomer?.customer_name || "Selecciona un cliente"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[420px] overflow-y-auto">
                {!selectedAbonoCustomer ? (
                  <div className="text-sm text-muted-foreground">Selecciona un cliente para ver sus facturas y créditos pendientes.</div>
                ) : (
                  (selectedAbonoCustomer.pending_sales || []).map((sale) => {
                    const active = sale.sale_id === selectedAbonoSaleId;
                    return (
                      <button
                        key={sale.sale_id}
                        type="button"
                        className={cn(
                          "w-full rounded-lg border p-3 text-left transition hover:bg-muted/40",
                          active && "border-violet-400 bg-violet-50/70 dark:bg-violet-950/30",
                        )}
                        onClick={() => {
                          setSelectedAbonoSaleId(sale.sale_id);
                          prefillCollectSaleRef.current = "";
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-medium">{sale.invoice_number}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {sale.account_kind === "credito" ? "Crédito" : "Pendiente"}
                              {sale.vehicle_plate ? ` · ${sale.vehicle_plate}` : ""}
                            </div>
                          </div>
                          <Badge variant={sale.account_kind === "credito" ? "secondary" : "outline"}>
                            C${toMoney(sale.amount_pending)}
                          </Badge>
                        </div>
                      </button>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>

          {selectedAbonoSale && (
            <CollectActionCard
              sale={activeCollectSale}
              collectForm={collectForm}
              setCollectForm={setCollectForm}
              authRequiredForCollect={authRequiredForCollect}
              posDiscountAuthStatus={posDiscountAuthStatus}
              posDiscountAuthBusy={posDiscountAuthBusy}
              onRequestPosDiscountAuthorization={requestPosDiscountAuthorization}
              onSubmitCollect={() => submitCollect()}
              busyCollect={busy.collect}
              canOperate={isSessionOpenedHere && !isLocked}
              onReload={() => loadAbonoCustomers(abonoSearch)}
              invoicesLoading={abonosLoading}
              submitLabel="Registrar abono"
              showPartialHint
            />
          )}
        </TabsContent>

        <TabsContent value="cerradas" className="space-y-4">
          <InvoiceToolbar
            search={invoiceSearch}
            onChangeSearch={setInvoiceSearch}
            onRefresh={() => loadInvoices("cerradas")}
            loading={invoicesLoading}
          />
          <InvoiceLayout
            rows={invoiceRows}
            selectedSaleId={selectedSaleId}
            onSelect={setSelectedSaleId}
            loading={invoicesLoading}
            emptyText="No hay facturas cerradas"
          />
        </TabsContent>

        <TabsContent value="anuladas" className="space-y-4">
          <InvoiceToolbar
            search={invoiceSearch}
            onChangeSearch={setInvoiceSearch}
            onRefresh={() => loadInvoices("anuladas")}
            loading={invoicesLoading}
          />
          <InvoiceLayout
            rows={invoiceRows}
            selectedSaleId={selectedSaleId}
            onSelect={setSelectedSaleId}
            loading={invoicesLoading}
            emptyText="No hay facturas anuladas"
          />
        </TabsContent>

        <TabsContent value="devoluciones">
          <Card>
            <CardHeader>
              <CardTitle>Devoluciones</CardTitle>
              <CardDescription>Espacio reservado para flujo de devoluciones controladas por sesión.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Pendiente de integración fiscal/contable específica para devoluciones y notas de crédito.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="entrada">
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
          />
        </TabsContent>

        <TabsContent value="salida">
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
          />
        </TabsContent>
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
  authRequiredForCollect,
  posDiscountAuthStatus = "none",
  posDiscountAuthBusy = false,
  onRequestPosDiscountAuthorization,
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
}) {
  const partialAmount = Number(collectForm.amount || 0);
  const pendingAmount = Number(sale?.amount_pending || 0);
  const isPartialPayment = partialAmount > 0 && pendingAmount > partialAmount + 0.009;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cobro y acciones - {sale?.invoice_number}</CardTitle>
        <CardDescription>
          {sale?.customer_name || "Cliente"}
          {sale?.vehicle_plate ? ` · ${sale.vehicle_plate}` : ""}
          {" | "}Pendiente: C${toMoney(sale?.amount_pending)}
          {showPartialHint ? " · Puedes abonar un monto menor al total" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <CashierLegalBreakdown sale={sale} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label>Modo de cobro</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={collectForm.mode}
              onChange={(e) => setCollectForm((prev) => ({ ...prev, mode: e.target.value }))}
            >
              <option value="single">Simple</option>
              <option value="mixed">Mixto</option>
            </select>
          </div>

          {collectForm.mode === "single" ? (
            <>
              <div className="space-y-2">
                <Label>Monto C$ {showPartialHint ? "(abono parcial permitido)" : ""}</Label>
                <Input
                  type="number"
                  step="0.01"
                  max={pendingAmount || undefined}
                  value={collectForm.amount}
                  onChange={(e) => setCollectForm((p) => ({ ...p, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Método</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={collectForm.payment_method}
                  onChange={(e) => setCollectForm((p) => ({ ...p, payment_method: e.target.value }))}
                >
                  <option value="cash">Efectivo</option>
                  <option value="transfer">Transferencia</option>
                  <option value="card">Tarjeta</option>
                </select>
              </div>
            </>
          ) : (
            <div className="md:col-span-2 space-y-2">
              <Label>Pagos mixtos</Label>
              <div className="space-y-3 rounded-md border p-3">
                {collectForm.pagos.map((pago, idx) => (
                  <div key={`mix-${idx}`} className="space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                      <select
                        className="h-10 rounded-md border bg-background px-3 text-sm"
                        value={pago.metodo}
                        onChange={(e) => setCollectForm((prev) => ({
                          ...prev,
                          pagos: prev.pagos.map((row, rowIdx) => (rowIdx === idx ? { ...row, metodo: e.target.value } : row)),
                        }))}
                      >
                        <option value="cash">Efectivo</option>
                        <option value="transfer">Transferencia</option>
                        <option value="card">Tarjeta</option>
                      </select>
                      <select
                        className="h-10 rounded-md border bg-background px-3 text-sm"
                        value={pago.moneda}
                        onChange={(e) => setCollectForm((prev) => ({
                          ...prev,
                          pagos: prev.pagos.map((row, rowIdx) => (rowIdx === idx ? { ...row, moneda: e.target.value } : row)),
                        }))}
                      >
                        <option value="NIO">NIO</option>
                        <option value="USD">USD</option>
                      </select>
                      <Input
                        type="number"
                        step="0.01"
                        value={pago.monto_origen}
                        onChange={(e) => setCollectForm((prev) => ({
                          ...prev,
                          pagos: prev.pagos.map((row, rowIdx) => (rowIdx === idx ? { ...row, monto_origen: e.target.value } : row)),
                        }))}
                        placeholder="Monto"
                      />
                      <Input
                        value={pago.referencia_bancaria}
                        onChange={(e) => setCollectForm((prev) => ({
                          ...prev,
                          pagos: prev.pagos.map((row, rowIdx) => (rowIdx === idx ? { ...row, referencia_bancaria: e.target.value } : row)),
                        }))}
                        placeholder="Referencia"
                      />
                    </div>
                    {isCardMethod(pago.metodo) && (
                      <CardPaymentFields
                        cardType={pago.card_type}
                        bankName={pago.bank_name}
                        transactionNumber={pago.transaction_number}
                        reference={pago.referencia_bancaria}
                        referenceKey="referencia_bancaria"
                        onChange={(patch) => setCollectForm((prev) => ({
                          ...prev,
                          pagos: prev.pagos.map((row, rowIdx) => (rowIdx === idx ? { ...row, ...patch } : row)),
                        }))}
                      />
                    )}
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCollectForm((prev) => ({
                      ...prev,
                      pagos: [...prev.pagos, buildDefaultPaymentRow()],
                    }))}
                  >
                    Agregar línea
                  </Button>
                  {collectForm.pagos.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCollectForm((prev) => ({ ...prev, pagos: prev.pagos.slice(0, -1) }))}
                    >
                      Quitar última
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {collectForm.mode === "single" && isCardMethod(collectForm.payment_method) && (
          <CardPaymentFields
            cardType={collectForm.card_type}
            bankName={collectForm.bank_name}
            transactionNumber={collectForm.transaction_number}
            reference={collectForm.reference}
            onChange={(patch) => setCollectForm((prev) => ({ ...prev, ...patch }))}
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label>Monto recibido (solo efectivo simple)</Label>
            <Input type="number" step="0.01" value={collectForm.received_amount} onChange={(e) => setCollectForm((p) => ({ ...p, received_amount: e.target.value }))} />
          </div>
          {collectForm.mode === "single" && !isCardMethod(collectForm.payment_method) && (
            <div className="space-y-2">
              <Label>Referencia</Label>
              <Input value={collectForm.reference} onChange={(e) => setCollectForm((p) => ({ ...p, reference: e.target.value }))} />
            </div>
          )}
          <div className="space-y-2">
            <Label>Observaciones</Label>
            <Input value={collectForm.notes} onChange={(e) => setCollectForm((p) => ({ ...p, notes: e.target.value }))} />
          </div>
        </div>

        {isPartialPayment && (
          <div className="rounded-md border border-violet-300 bg-violet-50 px-3 py-2 text-sm text-violet-900">
            Abono parcial: quedará pendiente C${toMoney(pendingAmount - partialAmount)} después de este cobro.
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

        <div className="flex gap-2">
          <Button onClick={onSubmitCollect} disabled={busyCollect || !canOperate}>
            {busyCollect ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
            {submitLabel}
          </Button>
          <Button variant="outline" onClick={onReload} disabled={invoicesLoading}>
            Recargar pendientes
          </Button>
        </div>

        {canCancelInvoice && cancelForm && setCancelForm && onSubmitCancel && (
          <div className="rounded-md border p-3 space-y-2">
            <div className="font-medium">Anular factura</div>
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
          </div>
        )}
      </CardContent>
    </Card>
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
}) {
  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            className="max-w-sm"
            placeholder="Buscar por factura, cliente o sale_id"
            value={search}
            onChange={(e) => onChangeSearch(e.target.value)}
          />
          <Button variant="outline" onClick={onRefresh} disabled={loading}>
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
      </CardContent>
    </Card>
  );
}

function invoiceCardShellClass(row, active, horizontal = false) {
  return cn(
    "rounded-lg border p-2 text-left transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
    getCashierUrgencyState(row).shellClass(active),
    horizontal && "min-h-[240px] w-[340px] shrink-0",
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
}) {
  const isHorizontal = layout === "horizontal";

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">Cargando facturas...</CardContent>
      </Card>
    );
  }

  if (!rows.length) {
    if (isHorizontal) {
      return (
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max gap-3">
            <div className="h-[170px] w-[350px] shrink-0 rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground flex items-center">
              {emptyText}
            </div>
          </div>
        </div>
      );
    }

    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">{emptyText}</CardContent>
      </Card>
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
                className={invoiceCardShellClass(row, active, true)}
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
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
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
            className={invoiceCardShellClass(row, active)}
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
}) {
  const currentType = movementForm.tipo !== forceType ? forceType : movementForm.tipo;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Registro por denominaciones para mantener trazabilidad del efectivo.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
