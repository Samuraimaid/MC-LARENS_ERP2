import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { ArrowDown, ArrowUp, Ban, CheckCircle2, ClipboardCheck, Download, FileText, Lock, Power, RefreshCw, RotateCcw, ShieldAlert, Unlock } from "lucide-react";
import { fetchEffectiveUsdNioRate, DEFAULT_USD_NIO_RATE } from "@/lib/exchangeRate";

const NIO_BILLS = [1000, 500, 200, 100, 50, 20, 10, 5, 1];
const NIO_COINS = [10, 5, 1, 0.5, 0.25, 0.1, 0.05];
const USD_BILLS = [100, 50, 20, 10, 5, 1];
const USD_COINS = [1, 0.5, 0.25, 0.1, 0.05, 0.01];
const CASHIER_SHIFT_KEY = "cashier.shift.state.v2";
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

  const [collectForm, setCollectForm] = useState({
    mode: "single",
    amount: "",
    received_amount: "",
    payment_method: "cash",
    reference: "",
    notes: "",
    force_remove_discount: false,
    authorized_by: "",
    justification: "",
    pagos: [{ metodo: "cash", moneda: "NIO", monto_origen: "", referencia_bancaria: "" }],
  });

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
      cerradas: "bg-emerald-50 dark:bg-emerald-950/30",
      anuladas: "bg-amber-50 dark:bg-amber-950/30",
      devoluciones: "bg-red-50 dark:bg-red-950/30",
      entrada: "bg-lime-50 dark:bg-lime-950/30",
      salida: "bg-rose-50 dark:bg-rose-950/30",
    };
    return toneByTab[activeTab] || "bg-background";
  }, [activeTab, isSessionOpenedHere]);

  const activeTabListToneClass = useMemo(() => {
    const toneByTab = {
      abiertas: "bg-blue-100 dark:bg-blue-900/35",
      cerradas: "bg-emerald-100 dark:bg-emerald-900/35",
      anuladas: "bg-amber-100 dark:bg-amber-900/35",
      devoluciones: "bg-red-100 dark:bg-red-900/35",
      entrada: "bg-lime-100 dark:bg-lime-900/35",
      salida: "bg-rose-100 dark:bg-rose-900/35",
    };
    return toneByTab[activeTab] || "bg-muted";
  }, [activeTab]);

  const cashTabsListClass = `h-14 w-full justify-start overflow-auto p-1.5 touch-pan-x transition-colors ${activeTabListToneClass}`;
  const cashTabTriggerBaseClass = "h-11 min-w-max px-4 text-sm sm:text-base font-semibold";

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

  const selectedSale = useMemo(() => invoiceRows.find((row) => row.sale_id === selectedSaleId) || null, [invoiceRows, selectedSaleId]);

  const authRequiredForCollect = useMemo(() => {
    if (!selectedSale) return false;
    const discount = Number(selectedSale.discounts_applied_amount || 0);
    const cardInMixed = collectForm.mode === "mixed" && collectForm.pagos.some((p) => String(p.metodo || "").toLowerCase() === "card");
    const cardSingle = collectForm.mode === "single" && String(collectForm.payment_method || "").toLowerCase() === "card";
    return discount > 0 && (cardInMixed || cardSingle) && !collectForm.force_remove_discount;
  }, [selectedSale, collectForm]);

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
    if (openedSessionId) {
      toast.error("Ya existe un turno activo en esta pantalla");
      return;
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
      setSessionId(newSessionId);
      setOpenedSessionId(newSessionId);
      setIsLocked(false);
      toast.success(`Caja abierta. ID de sesión: ${newSessionId}`);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudo abrir caja");
    } finally {
      setBusy((prev) => ({ ...prev, open: false }));
    }
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
      setSessionId("");
      setOpenedSessionId("");
      setIsLocked(false);
      setSelectedSaleId("");
      toast.success("Turno cerrado correctamente");
    } catch (error) {
      const detail = String(error?.response?.data?.detail || "");
      if (detail.toLowerCase().includes("ya está cerrada")) {
        setSessionId("");
        setOpenedSessionId("");
        setIsLocked(false);
        setSelectedSaleId("");
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
      if (!rows.find((r) => r.sale_id === selectedSaleId)) {
        setSelectedSaleId(rows[0]?.sale_id || "");
      }
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudieron cargar facturas");
    } finally {
      if (showLoading) setInvoicesLoading(false);
    }
  };

  useEffect(() => {
    if (["abiertas", "cerradas", "anuladas"].includes(activeTab)) {
      loadInvoices(activeTab);
    }
  }, [activeTab]);

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

  const submitCollect = async () => {
    if (!requireOpenedAndUnlockedSession()) return;
    if (!selectedSale) {
      toast.error("Selecciona una factura abierta");
      return;
    }

    const payload = {
      sesion_id: sessionId,
      amount: Number(collectForm.amount || 0),
      payment_method: collectForm.payment_method,
      reference: collectForm.reference,
      notes: collectForm.notes,
      received_amount: collectForm.received_amount ? Number(collectForm.received_amount) : null,
      force_remove_discount: Boolean(collectForm.force_remove_discount),
      pagos: collectForm.mode === "mixed"
        ? collectForm.pagos
            .filter((p) => Number(p.monto_origen || 0) > 0)
            .map((p) => ({
              metodo: p.metodo,
              moneda: p.moneda,
              monto_origen: Number(p.monto_origen || 0),
              referencia_bancaria: p.referencia_bancaria || null,
            }))
        : [],
      autorizacion_descuento_pos: authRequiredForCollect
        ? {
          autorizado_por: collectForm.authorized_by,
          justificacion_interna: collectForm.justification,
          mostrar_al_cliente: false,
        }
        : null,
    };

    if (collectForm.mode === "single" && payload.amount <= 0) {
      toast.error("El monto debe ser mayor a 0");
      return;
    }

    if (collectForm.mode === "mixed" && payload.pagos.length === 0) {
      toast.error("Agrega al menos una línea de pago mixto");
      return;
    }

    if (authRequiredForCollect && String(collectForm.justification || "").trim().length < 20) {
      toast.error("La justificación de autorización debe tener al menos 20 caracteres");
      return;
    }

    setBusy((prev) => ({ ...prev, collect: true }));
    try {
      await axios.post(`${API}/caja/facturas/${selectedSale.sale_id}/cobrar`, payload, { withCredentials: true });
      toast.success("Cobro aplicado correctamente");
      await loadInvoices("abiertas");
      setCollectForm((prev) => ({
        ...prev,
        amount: "",
        received_amount: "",
        reference: "",
        notes: "",
        force_remove_discount: false,
        authorized_by: "",
        justification: "",
      }));
    } catch (error) {
      const detail = error?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : (detail?.message || "No se pudo cobrar factura"));
    } finally {
      setBusy((prev) => ({ ...prev, collect: false }));
    }
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
          <CardContent className="pt-6 text-amber-900 text-sm">
            Flujo obligatorio: apertura con arqueo inicial antes de cobrar, anular, registrar entradas o salidas.
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
                <div><span className="font-semibold">Total $:</span> {toMoney(openingTotals.USD)}</div>
                <div className="text-muted-foreground">Puedes abrir caja en cero; si no hay efectivo, no es obligatorio detallar denominaciones.</div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={openCashSession} disabled={busy.open || Boolean(openedSessionId)} data-testid="cashier-open-session-btn">
                  {busy.open ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Abrir turno
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
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={cashTabsListClass}>
          <TabsTrigger value="abiertas" className={`${cashTabTriggerBaseClass} bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-200 dark:hover:bg-blue-900/50 data-[state=active]:bg-blue-200 data-[state=active]:text-blue-900 dark:data-[state=active]:bg-blue-800/60 dark:data-[state=active]:text-blue-100`}>
            <FileText className="h-5 w-5 mr-2" />
            Facturas abiertas
          </TabsTrigger>
          <TabsTrigger value="cerradas" className={`${cashTabTriggerBaseClass} bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-900/50 data-[state=active]:bg-emerald-200 data-[state=active]:text-emerald-900 dark:data-[state=active]:bg-emerald-800/60 dark:data-[state=active]:text-emerald-100`}>
            <CheckCircle2 className="h-5 w-5 mr-2" />
            Facturas cerradas
          </TabsTrigger>
          <TabsTrigger value="anuladas" className={`${cashTabTriggerBaseClass} bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-900/50 data-[state=active]:bg-amber-200 data-[state=active]:text-amber-900 dark:data-[state=active]:bg-amber-800/60 dark:data-[state=active]:text-amber-100`}>
            <Ban className="h-5 w-5 mr-2" />
            Anuladas
          </TabsTrigger>
          <TabsTrigger value="devoluciones" className={`${cashTabTriggerBaseClass} bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-900/50 data-[state=active]:bg-red-200 data-[state=active]:text-red-900 dark:data-[state=active]:bg-red-800/60 dark:data-[state=active]:text-red-100`}>
            <RotateCcw className="h-5 w-5 mr-2" />
            Devoluciones
          </TabsTrigger>
          <TabsTrigger value="entrada" className={`${cashTabTriggerBaseClass} bg-lime-50 text-lime-700 hover:bg-lime-100 dark:bg-lime-950/40 dark:text-lime-200 dark:hover:bg-lime-900/50 data-[state=active]:bg-lime-200 data-[state=active]:text-lime-900 dark:data-[state=active]:bg-lime-800/60 dark:data-[state=active]:text-lime-100`}>
            <ArrowDown className="h-5 w-5 mr-2" />
            Entrada de efectivo
          </TabsTrigger>
          <TabsTrigger value="salida" className={`${cashTabTriggerBaseClass} bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-200 dark:hover:bg-rose-900/50 data-[state=active]:bg-rose-200 data-[state=active]:text-rose-900 dark:data-[state=active]:bg-rose-800/60 dark:data-[state=active]:text-rose-100`}>
            <ArrowUp className="h-5 w-5 mr-2" />
            Salida de efectivo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="abiertas" className="space-y-4">
          <InvoiceToolbar
            search={invoiceSearch}
            onChangeSearch={setInvoiceSearch}
            onRefresh={() => loadInvoices("abiertas")}
            loading={invoicesLoading}
          />
          <InvoiceLayout
            rows={invoiceRows}
            selectedSaleId={selectedSaleId}
            onSelect={setSelectedSaleId}
            loading={invoicesLoading}
            emptyText="No hay facturas abiertas"
            layout="horizontal"
          />

          {selectedSale && (
            <Card>
              <CardHeader>
                <CardTitle>Cobro y acciones - {selectedSale.invoice_number}</CardTitle>
                <CardDescription>
                  Pendiente: C${toMoney(selectedSale.amount_pending)} | Descuento aplicado: C${toMoney(selectedSale.discounts_applied_amount)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
                        <Label>Monto C$</Label>
                        <Input type="number" step="0.01" value={collectForm.amount} onChange={(e) => setCollectForm((p) => ({ ...p, amount: e.target.value }))} />
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
                      <div className="space-y-2 rounded-md border p-3">
                        {collectForm.pagos.map((pago, idx) => (
                          <div key={`mix-${idx}`} className="grid grid-cols-1 md:grid-cols-4 gap-2">
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
                        ))}
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setCollectForm((prev) => ({
                              ...prev,
                              pagos: [...prev.pagos, { metodo: "cash", moneda: "NIO", monto_origen: "", referencia_bancaria: "" }],
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Monto recibido (solo efectivo simple)</Label>
                    <Input type="number" step="0.01" value={collectForm.received_amount} onChange={(e) => setCollectForm((p) => ({ ...p, received_amount: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Referencia</Label>
                    <Input value={collectForm.reference} onChange={(e) => setCollectForm((p) => ({ ...p, reference: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Observaciones</Label>
                    <Input value={collectForm.notes} onChange={(e) => setCollectForm((p) => ({ ...p, notes: e.target.value }))} />
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <input
                    id="force-remove-discount"
                    type="checkbox"
                    checked={collectForm.force_remove_discount}
                    onChange={(e) => setCollectForm((p) => ({ ...p, force_remove_discount: e.target.checked }))}
                  />
                  <Label htmlFor="force-remove-discount" className="cursor-pointer">
                    Forzar remover descuento cuando método incluye tarjeta
                  </Label>
                </div>

                {authRequiredForCollect && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-amber-900 text-sm font-medium">
                      <ShieldAlert className="h-4 w-4" />
                      Autorización requerida (supervisor/gerencia) por descuento + tarjeta
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>User ID autorizador</Label>
                        <Input value={collectForm.authorized_by} onChange={(e) => setCollectForm((p) => ({ ...p, authorized_by: e.target.value }))} placeholder="Ej: usr_supervisor_001" />
                      </div>
                      <div className="space-y-2">
                        <Label>Justificación interna (min 20)</Label>
                        <Input value={collectForm.justification} onChange={(e) => setCollectForm((p) => ({ ...p, justification: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button onClick={submitCollect} disabled={busy.collect || !isSessionOpenedHere || isLocked}>
                    {busy.collect ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Cobrar factura
                  </Button>
                  <Button variant="outline" onClick={() => loadInvoices("abiertas")} disabled={invoicesLoading}>
                    Recargar pendientes
                  </Button>
                </div>

                {canCancelInvoice && (
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
                    <Button variant="destructive" onClick={submitCancelInvoice} disabled={busy.cancel || !isSessionOpenedHere || isLocked}>
                      {busy.cancel ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
                      Anular factura
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
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
                <div className="text-right">${toMoney(previewSummary?.expected_by_currency?.USD)}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
                <div className="font-medium">Físico NIO</div>
                <div className="text-right">C${toMoney(previewSummary?.physical_by_currency?.NIO)}</div>
                <div className="font-medium">Físico USD</div>
                <div className="text-right">${toMoney(previewSummary?.physical_by_currency?.USD)}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
                <div className="font-medium">Diferencia NIO</div>
                <div className={`text-right font-semibold ${differenceToneClass(diffNio)}`}>{toSignedMoney(diffNio, "C$")}</div>
                <div className="font-medium">Diferencia USD</div>
                <div className={`text-right font-semibold ${differenceToneClass(diffUsd)}`}>{toSignedMoney(diffUsd, "$")}</div>
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

function InvoiceToolbar({ search, onChangeSearch, onRefresh, loading }) {
  return (
    <Card>
      <CardContent className="pt-6 flex flex-wrap gap-2 items-center">
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
      </CardContent>
    </Card>
  );
}

function InvoiceLayout({ rows, selectedSaleId, onSelect, loading, emptyText, layout = "vertical" }) {
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
              <button
                key={row.sale_id}
                type="button"
                onClick={() => onSelect(row.sale_id)}
                className={`h-[170px] w-[350px] shrink-0 rounded-lg border p-4 text-left transition ${active ? "border-primary bg-primary/5" : "hover:border-primary/40"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold truncate">{row.invoice_number || row.sale_id}</div>
                  <Badge variant={row.invoice_state === "cancelled" ? "destructive" : "outline"}>{row.invoice_state}</Badge>
                </div>
                <div className="text-sm text-muted-foreground mt-1 truncate">{row.customer_name || "Cliente"}</div>
                <div className="grid grid-cols-2 gap-2 text-xs mt-3">
                  <div>Total legal</div>
                  <div className="text-right">C${toMoney(row.total_legal)}</div>
                  <div>Pagado</div>
                  <div className="text-right">C${toMoney(row.amount_paid)}</div>
                  <div>Pendiente</div>
                  <div className="text-right font-semibold">C${toMoney(row.amount_pending)}</div>
                </div>
              </button>
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
          <button
            key={row.sale_id}
            type="button"
            onClick={() => onSelect(row.sale_id)}
            className={`rounded-lg border p-4 text-left transition ${active ? "border-primary bg-primary/5" : "hover:border-primary/40"}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold">{row.invoice_number || row.sale_id}</div>
              <Badge variant={row.invoice_state === "cancelled" ? "destructive" : "outline"}>{row.invoice_state}</Badge>
            </div>
            <div className="text-sm text-muted-foreground mt-1">{row.customer_name || "Cliente"}</div>
            <div className="grid grid-cols-2 gap-2 text-xs mt-3">
              <div>Total legal</div>
              <div className="text-right">C${toMoney(row.total_legal)}</div>
              <div>Pagado</div>
              <div className="text-right">C${toMoney(row.amount_paid)}</div>
              <div>Pendiente</div>
              <div className="text-right font-semibold">C${toMoney(row.amount_pending)}</div>
            </div>
          </button>
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
