/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { cn, formatCurrency, formatDate, getStatusColor, PAYMENT_TYPES } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { Label } from "../components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { toast } from "sonner";
import { Search, FileText, CheckCircle, XCircle, ShoppingCart, RefreshCw, Eye, Eraser, SaveAll, Unlock } from "lucide-react";
import DraftBoardCard from "@/components/erp/DraftBoardCard";
import ErpFormToolbar, { ErpToolbarButton } from "@/components/erp/ErpFormToolbar";
import { isErpDraftSupervisor, isOwnErpDraft } from "@/lib/erpDesignSystem";
import { useDraftReviewPolling } from "@/hooks/useDraftReviewPolling";
import {
  canSellerDeleteDraft,
  canSellerOpenDraft,
  isDraftReleasedWithRestrictions,
  normalizeDraftReview,
} from "@/lib/draftReview";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog";
import {
  ContextualDialogFooter,
  ContextualDialogHeader,
  getStatusPrimaryButtonClass,
  getStatusSecondaryButtonClass,
} from "../components/ui/contextual-dialog-header";
import SaleForm from "../components/sales/SaleForm";
import { API_BASE as API } from "@/lib/api";
import { loadLocalDraftState, mirrorServerDraftsToLocalStorage } from "@/lib/draftStorage";
import { AUTOSAVE_STATUS, emitAutosaveStatus } from "@/lib/autosaveStatus";
import { VehicleThumbnailWatermark } from "@/components/erp/VehicleThumbnailWatermark";
import { fetchEffectiveUsdNioRate, DEFAULT_USD_NIO_RATE } from "@/lib/exchangeRate";
import { fetchEffectiveIvaRate, DEFAULT_IVA_RATE } from "@/lib/taxRate";
import { CUSTOMER_VEHICLE_CARD_PATTERNS } from "@/lib/cardPatterns";
import {
  deleteServerDraft,
  fetchServerDraftBundle,
  releaseServerDraft,
  saveServerDraft,
  setServerDraftActive,
  unwatchServerDraft,
  watchServerDraft,
} from "@/lib/serverDrafts";
import { playSelectionFeedbackSound } from "@/lib/uiSounds";
import { releaseWatchedDraftIfNeeded } from "@/lib/supervisorDraftRelease";
import {
  normalizePaymentMethodCode,
  normalizePaymentMethodList,
} from "@/lib/paymentMethods";
import { computeDraftSnapshotTotals } from "@/lib/saleTotals";
import { isSaleDraftSaveEligible } from "@/lib/draftSaveEligibility";
import { scrollPageToTop } from "@/lib/scrollPageToTop";
import { useAuth } from "@/context/AuthContext";
import { User, CarFront } from "lucide-react";

const WhatsAppIcon = ({ className }) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
    <path
      fill="currentColor"
      d="M19.11 17.72c-.28-.14-1.64-.81-1.9-.9-.25-.1-.44-.14-.62.14-.18.28-.71.9-.87 1.08-.16.18-.32.2-.6.06-.28-.14-1.16-.43-2.21-1.37-.82-.73-1.37-1.63-1.53-1.9-.16-.28-.02-.43.12-.57.12-.12.28-.32.42-.48.14-.16.18-.28.28-.46.1-.18.05-.34-.02-.48-.07-.14-.62-1.5-.85-2.05-.22-.53-.44-.46-.62-.47h-.53c-.18 0-.48.07-.73.34-.25.28-.96.94-.96 2.3 0 1.36.99 2.68 1.12 2.86.14.18 1.95 2.98 4.73 4.18.66.28 1.17.45 1.58.58.66.21 1.26.18 1.73.11.53-.08 1.64-.67 1.87-1.32.23-.65.23-1.21.16-1.32-.07-.12-.25-.18-.53-.32zM16.03 5.5c-5.72 0-10.37 4.65-10.37 10.37 0 1.83.48 3.54 1.32 5.03l-1.4 5.13 5.26-1.38a10.33 10.33 0 0 0 5.19 1.4c5.72 0 10.37-4.65 10.37-10.37S21.75 5.5 16.03 5.5zm0 18.9c-1.7 0-3.3-.46-4.67-1.34l-.34-.2-3.13.82.83-3.05-.22-.35a8.84 8.84 0 0 1-1.38-4.71 8.9 8.9 0 0 1 17.8 0 8.9 8.9 0 0 1-8.9 8.83z"
    />
  </svg>
);

const CATALOG_SOURCE_CONTEXT_KEY = "catalog_source_context_v1";

const getPaymentTone = (paymentType) => {
  switch (paymentType) {
    case "cash":
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:border-emerald-500/30";
    case "card":
      return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-200 dark:border-blue-500/30";
    case "transfer":
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/30";
    case "credit":
      return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-200 dark:border-purple-500/30";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-200 dark:border-slate-500/30";
  }
};

export function QuotationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const DRAFT_LIST_KEY = "draft_quote_tabs_v1";
  const DRAFT_ACTIVE_KEY = "draft_quote_active_v1";
  const DRAFT_KEY_PREFIX = "draft_quote_v1_";
  const DRAFT_FLOW = "quotation";
  const SALE_DRAFT_LIST_KEY = "draft_sale_tabs_v1";
  const SALE_DRAFT_ACTIVE_KEY = "draft_sale_active_v1";
  const SALE_DRAFT_KEY_PREFIX = "draft_sale_v1_";
  const EMBEDDED_FORM_VISIBILITY_KEY_PREFIX = "quotes_embedded_form_visible_v1";
  const [quotations, setQuotations] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterValidity, setFilterValidity] = useState("all");
  const [showNewQuote, setShowNewQuote] = useState(true);
  const [quoteFormRenderNonce, setQuoteFormRenderNonce] = useState(0);
  const [draftTabs, setDraftTabs] = useState([]);
  const [activeDraftId, setActiveDraftId] = useState(null);
  const [draftsLoaded, setDraftsLoaded] = useState(false);
  const [draftContentRevision, setDraftContentRevision] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [showArchivedQuotes, setShowArchivedQuotes] = useState(false);
  const [showClearQuoteConfirm, setShowClearQuoteConfirm] = useState(false);
  const [effectiveUsdNioRate, setEffectiveUsdNioRate] = useState(DEFAULT_USD_NIO_RATE);
  const [effectiveIvaRate, setEffectiveIvaRate] = useState(DEFAULT_IVA_RATE);
  const [draftSaveState, setDraftSaveState] = useState("idle");
  const [saveFlash, setSaveFlash] = useState(false);
  const [boardTab, setBoardTab] = useState("drafts");
  const [currency, setCurrency] = useState("NIO");
  const draftTabsRef = useRef([]);
  const activeDraftIdRef = useRef(null);
  const suppressAutoDraftRef = useRef(false);
  const quoteFormAnchorRef = useRef(null);
  const draftSyncTimersRef = useRef(new Map());
  const supervisorWatchingDraftRef = useRef(null);
    const markDraftSaving = useCallback(() => {
      setDraftSaveState("saving");
      emitAutosaveStatus(AUTOSAVE_STATUS.SAVING, { source: "quotations" });
    }, []);

    const markDraftSaved = useCallback(() => {
      setDraftSaveState("saved");
      emitAutosaveStatus(AUTOSAVE_STATUS.SYNCED, { source: "quotations" });
    }, []);

    const markDraftSaveError = useCallback(() => {
      setDraftSaveState("error");
      emitAutosaveStatus(AUTOSAVE_STATUS.DISCONNECTED, { source: "quotations" });
    }, []);

  useEffect(() => {
    emitAutosaveStatus(AUTOSAVE_STATUS.SYNCED, { source: "quotations" });
    return () => {
      emitAutosaveStatus(AUTOSAVE_STATUS.SYNCED, { source: "quotations" });
    };
  }, []);

  const formVisibilityStorageKey = useMemo(() => {
    const userToken = user?.user_id || user?.pin_user_id || "anon";
    return `${EMBEDDED_FORM_VISIBILITY_KEY_PREFIX}_${userToken}`;
  }, [EMBEDDED_FORM_VISIBILITY_KEY_PREFIX, user?.pin_user_id, user?.user_id]);

  useEffect(() => {
    let mounted = true;
    const refreshRate = async () => {
      const [rate, iva] = await Promise.all([
        fetchEffectiveUsdNioRate({ withCredentials: true, fallback: DEFAULT_USD_NIO_RATE }),
        fetchEffectiveIvaRate({ withCredentials: true, fallback: DEFAULT_IVA_RATE }),
      ]);
      if (mounted) {
        setEffectiveUsdNioRate(rate);
        setEffectiveIvaRate(iva);
      }
    };

    refreshRate();
    const intervalId = window.setInterval(refreshRate, 30000);
    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [cartItems, setCartItems] = useState([]);
  const [paymentType, setPaymentType] = useState("cash");
  const [mixedPaymentMethods, setMixedPaymentMethods] = useState([]);
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [validDays, setValidDays] = useState(7);
  const [notes, setNotes] = useState("");
  const [applyIVA, setApplyIVA] = useState(true);
  const [applyRetention, setApplyRetention] = useState(false);
  const [retentionRate, setRetentionRate] = useState(2);
  const [appliedDiscounts, setAppliedDiscounts] = useState([]);

  const fetchData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const params = filterStatus !== "all" ? `?status=${filterStatus}` : "";
      const [quotesRes, customersRes, productsRes, inventoryRes, warehousesRes, vehiclesRes] = await Promise.allSettled([
        axios.get(`${API}/quotations${params}`, { withCredentials: true }),
        axios.get(`${API}/customers`, { withCredentials: true }),
        axios.get(`${API}/products`, { withCredentials: true }),
        axios.get(`${API}/inventory`, { withCredentials: true }),
        axios.get(`${API}/warehouses`, { withCredentials: true }),
        axios.get(`${API}/vehicles`, { withCredentials: true }),
      ]);

      const hasCriticalFailures =
        quotesRes.status === "rejected" ||
        customersRes.status === "rejected" ||
        productsRes.status === "rejected" ||
        vehiclesRes.status === "rejected";

      if (quotesRes.status === "fulfilled") setQuotations(quotesRes.value.data);
      if (customersRes.status === "fulfilled") setCustomers(customersRes.value.data);
      if (productsRes.status === "fulfilled") setProducts(productsRes.value.data);
      setInventory(inventoryRes.status === "fulfilled" ? inventoryRes.value.data : []);
      if (vehiclesRes.status === "fulfilled") setVehicles(vehiclesRes.value.data);

      // Bodegas puede estar restringido por permisos; no debe romper Cotizaciones.
      setWarehouses(warehousesRes.status === "fulfilled" ? warehousesRes.value.data : []);

      if (hasCriticalFailures) {
        toast.error("Error al cargar datos");
      }
    } catch (error) {
      toast.error("Error al cargar datos");
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [filterStatus]);

  useEffect(() => {
    const refreshData = () => {
      fetchData({ silent: true });
    };

    const intervalId = window.setInterval(refreshData, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchData]);

  const readDraft = (draftId) => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(getDraftKey(draftId));
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  };

  const computeDraftTotals = (draft) => {
    const customer = customers.find(
      (entry) => String(entry.customer_id ?? "") === String(draft?.selectedCustomerId ?? "")
    ) || null;
    return computeDraftSnapshotTotals(draft, {
      exchangeRate: effectiveUsdNioRate,
      ivaRate: effectiveIvaRate,
      customer,
    });
  };

  const computeDraftTotal = (draft) => computeDraftTotals(draft).total;

  const getDraftLabel = (tab) => {
    const draft = readDraft(tab.id);
    if (!draft) return tab.name;
    const customerName = customers.find(c => c.customer_id === draft.selectedCustomerId)?.name;
    const total = computeDraftTotal(draft);
    const currencyDraft = draft.currency || "NIO";
    const name = customerName || "Sin cliente";
    return `${name} • ${formatCurrency(total || 0, currencyDraft)}`;
  };

  const getVehicleLabel = (vehicleId) => {
    if (!vehicleId) return null;
    const vehicle = vehicles.find(v => v.vehicle_id === vehicleId || v.id === vehicleId);
    if (!vehicle) return null;
    const parts = [vehicle.brand, vehicle.model, vehicle.year].filter(Boolean);
    return parts.length ? parts.join(" ") : null;
  };

  const getVehicleById = (vehicleId) => {
    if (!vehicleId) return null;
    return vehicles.find(v => v.vehicle_id === vehicleId || v.id === vehicleId) || null;
  };

  const getCustomerNameFromQuote = (quote) => {
    if (!quote) return "Sin cliente";
    if (quote.customer_name) return quote.customer_name;
    const match = customers.find(c => c.customer_id === quote.customer_id);
    return match?.name || "Sin cliente";
  };

  const getQuoteVehicleLabel = (quote) => {
    if (!quote) return null;
    return getVehicleLabel(quote.vehicle_id);
  };

  const getQuoteItemsPreview = (quote) => {
    const items = Array.isArray(quote?.items) ? quote.items : [];
    if (items.length === 0) return "Sin productos";
    const names = items.slice(0, 3).map((item) => item.product_name || "Producto");
    return items.length > 3 ? `${names.join(" · ")} · +${items.length - 3}` : names.join(" · ");
  };

  const getDraftPreview = (draft) => {
    if (!draft) return { image: null, items: [], vehicle: null, previewVehicle: null };
    const items = Array.isArray(draft.cartItems) ? draft.cartItems : [];
    const vehicle = getVehicleById(draft.selectedVehicle);
    const previewNames = items.slice(0, 3).map((item) => item.product_name || "Producto");
    return {
      image: null,
      previewVehicle: vehicle || null,
      items: previewNames,
      vehicle: getVehicleLabel(draft.selectedVehicle),
    };
  };

  const getDraftMeta = (tab) => {
    const draft = readDraft(tab.id);
    const preview = getDraftPreview(draft);
    const customerName = customers.find(c => c.customer_id === draft?.selectedCustomerId)?.name;
    const totals = computeDraftTotals(draft);
    const currencyDraft = draft?.currency || "NIO";
    const itemsCount = Array.isArray(draft?.cartItems) ? draft.cartItems.length : 0;
    const updatedAt = draft?.updatedAt || tab.updatedAt;
    return {
      title: customerName || "Sin cliente",
      subtitle: tab.name,
      total: totals.total,
      currency: currencyDraft,
      itemsCount,
      updatedAt,
      previewItems: preview.items,
      previewImage: preview.image,
      previewVehicle: preview.vehicle,
      previewVehicleRecord: preview.previewVehicle,
      applyIVA: draft?.applyIVA ?? true,
      totalDiscounts: totals.displayTotalDiscounts,
      retention: totals.retention,
      retentionRate: draft?.retentionRate ?? 2,
      sellerName: tab.ownerName || user?.name || null,
      review: tab.review || normalizeDraftReview(null),
    };
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const getUsableLocalDraftState = () => {
      const state = loadLocalDraftState(DRAFT_LIST_KEY, DRAFT_ACTIVE_KEY);
      if (typeof window === "undefined") {
        return state;
      }

      const usableTabs = Array.isArray(state.draftTabs)
        ? state.draftTabs.filter((tab) => {
            if (!tab?.id) return false;
            const raw = window.localStorage.getItem(`${DRAFT_KEY_PREFIX}${tab.id}`);
            if (!raw) return false;
            try {
              const draft = JSON.parse(raw);
              return isSaleDraftSaveEligible(draft);
            } catch (error) {
              return false;
            }
          })
        : [];

      const activeDraftId = usableTabs.some((tab) => tab.id === state.activeDraftId)
        ? state.activeDraftId
        : (usableTabs[0]?.id ?? null);

      return { draftTabs: usableTabs, activeDraftId };
    };

    const loadDrafts = async () => {
      try {
        emitAutosaveStatus(AUTOSAVE_STATUS.RECOVERING, { source: "quotations" });
        const bundle = await fetchServerDraftBundle(DRAFT_FLOW);
        if (cancelled) return;
        const serverDrafts = Array.isArray(bundle?.drafts) ? bundle.drafts : [];
        const eligibleServerDrafts = serverDrafts.filter((draft) => (
          isSaleDraftSaveEligible(draft?.snapshot || {})
        ));
        serverDrafts
          .filter((draft) => !isSaleDraftSaveEligible(draft?.snapshot || {}))
          .forEach((draft) => {
            if (draft?.id) {
              deleteServerDraft(DRAFT_FLOW, draft.id).catch(() => {});
            }
          });
        const nextActiveDraftId = bundle.activeDraftId && eligibleServerDrafts.some((d) => d.id === bundle.activeDraftId)
          ? bundle.activeDraftId
          : (eligibleServerDrafts[0]?.id ?? null);

        mirrorServerDraftsToLocalStorage({
          listKey: DRAFT_LIST_KEY,
          activeKey: DRAFT_ACTIVE_KEY,
          draftKeyPrefix: DRAFT_KEY_PREFIX,
          drafts: eligibleServerDrafts,
          activeDraftId: nextActiveDraftId,
        });
        setDraftTabs(eligibleServerDrafts.map((draft) => ({
          id: draft.id,
          name: draft.name,
          updatedAt: draft.updatedAt,
          ownerUserId: draft.owner_user_id || null,
          ownerName: draft.owner_name || null,
          review: normalizeDraftReview(draft.review),
        })));
        setActiveDraftId(nextActiveDraftId);
        emitAutosaveStatus(AUTOSAVE_STATUS.SYNCED, { source: "quotations" });
      } catch (error) {
        if (cancelled) return;
        const fallback = getUsableLocalDraftState();
        setDraftTabs(fallback.draftTabs);
        setActiveDraftId(fallback.activeDraftId);
        emitAutosaveStatus(AUTOSAVE_STATUS.DISCONNECTED, { source: "quotations" });
      } finally {
        if (!cancelled) {
          setDraftsLoaded(true);
        }
      }
    };

    loadDrafts();
    return () => {
      cancelled = true;
    };
  }, [DRAFT_ACTIVE_KEY, DRAFT_FLOW, DRAFT_KEY_PREFIX, DRAFT_LIST_KEY]);

  const handleServerSnapshotChanged = useCallback((draftId) => {
    setDraftContentRevision((prev) => prev + 1);
    if (draftId === activeDraftId) {
      setQuoteFormRenderNonce((prev) => prev + 1);
    }
  }, [activeDraftId]);

  useDraftReviewPolling({
    flow: DRAFT_FLOW,
    user,
    draftsLoaded,
    activeDraftId,
    showForm: showNewQuote,
    setDraftTabs,
    setShowForm: setShowNewQuote,
    listKey: DRAFT_LIST_KEY,
    activeKey: DRAFT_ACTIVE_KEY,
    draftKeyPrefix: DRAFT_KEY_PREFIX,
    onServerSnapshotChanged: handleServerSnapshotChanged,
  });

  const activeDraftTab = useMemo(
    () => draftTabs.find((tab) => tab.id === activeDraftId) || null,
    [activeDraftId, draftTabs]
  );

  const activeDraftReview = activeDraftTab?.review || normalizeDraftReview(null);
  const sellerQuoteParamsLocked = isDraftReleasedWithRestrictions(activeDraftReview)
    && !isErpDraftSupervisor(user?.role);

  const showReleaseDraftButton = Boolean(
    isErpDraftSupervisor(user?.role)
    && activeDraftTab
    && !isOwnErpDraft(activeDraftTab, user?.user_id)
    && ["watching", "blocked"].includes(activeDraftReview.status)
  );

  const stopSupervisorWatch = useCallback(async (draftId) => {
    if (!draftId || !isErpDraftSupervisor(user?.role)) return;
    try {
      await unwatchServerDraft(DRAFT_FLOW, draftId);
    } catch (error) {
      // keep UI responsive
    }
    if (supervisorWatchingDraftRef.current === draftId) {
      supervisorWatchingDraftRef.current = null;
    }
  }, [DRAFT_FLOW, user?.role]);

  const startSupervisorWatch = useCallback(async (draftId) => {
    if (!draftId || !isErpDraftSupervisor(user?.role)) return;
    const tab = draftTabsRef.current.find((entry) => entry.id === draftId);
    if (!tab || isOwnErpDraft(tab, user?.user_id)) return;
    try {
      const updated = await watchServerDraft(DRAFT_FLOW, draftId);
      setDraftTabs((prev) => prev.map((entry) => (
        entry.id === draftId
          ? { ...entry, review: normalizeDraftReview(updated?.review) }
          : entry
      )));
      supervisorWatchingDraftRef.current = draftId;
    } catch (error) {
      // supervisor can still open locally if watch fails
    }
  }, [DRAFT_FLOW, user?.role, user?.user_id]);

  const handleReleaseDraft = useCallback(async () => {
    if (!activeDraftId) return;
    try {
      const updated = await releaseServerDraft(DRAFT_FLOW, activeDraftId);
      setDraftTabs((prev) => prev.map((entry) => (
        entry.id === activeDraftId
          ? { ...entry, review: normalizeDraftReview(updated?.review) }
          : entry
      )));
      supervisorWatchingDraftRef.current = null;
      toast.success("Borrador liberado para el vendedor.");
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo liberar el borrador");
    }
  }, [DRAFT_FLOW, activeDraftId]);

  useEffect(() => {
    if (!showNewQuote && supervisorWatchingDraftRef.current) {
      stopSupervisorWatch(supervisorWatchingDraftRef.current);
    }
  }, [showNewQuote, stopSupervisorWatch]);

  useEffect(() => {
    if (!draftsLoaded) return;
    if (typeof window === "undefined") return;
    window.localStorage.setItem(DRAFT_LIST_KEY, JSON.stringify(draftTabs));
  }, [draftTabs, draftsLoaded]);

  useEffect(() => {
    if (!draftsLoaded) return;
    if (typeof window === "undefined") return;
    if (activeDraftId) {
      window.localStorage.setItem(DRAFT_ACTIVE_KEY, activeDraftId);
    } else {
      window.localStorage.removeItem(DRAFT_ACTIVE_KEY);
    }
  }, [activeDraftId, draftsLoaded]);

  useEffect(() => {
    draftTabsRef.current = draftTabs;
  }, [draftTabs]);

  useEffect(() => {
    activeDraftIdRef.current = activeDraftId;
  }, [activeDraftId]);

  useEffect(() => () => {
    draftSyncTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    draftSyncTimersRef.current.clear();
  }, []);

  useEffect(() => {
    if (!draftsLoaded) return;
    setServerDraftActive(DRAFT_FLOW, activeDraftId).catch(() => {
      // preserve local active draft if remote sync fails
    });
  }, [DRAFT_FLOW, activeDraftId, draftsLoaded]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(formVisibilityStorageKey);
    if (stored === null) {
      setShowNewQuote(true);
      return;
    }
    setShowNewQuote(stored === "true");
  }, [formVisibilityStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(formVisibilityStorageKey, showNewQuote ? "true" : "false");
  }, [formVisibilityStorageKey, showNewQuote]);

  const getDraftKey = (draftId) => `${DRAFT_KEY_PREFIX}${draftId}`;

  const isDraftSnapshotEmpty = (draft) => !isSaleDraftSaveEligible(draft);

  const visibleDraftTabs = useMemo(() => (
    draftTabs.filter((tab) => isSaleDraftSaveEligible(readDraft(tab.id)))
  ), [draftTabs, draftContentRevision]);

  const createEmptyDraftSnapshot = () => ({ updatedAt: new Date().toISOString(), validDays: 7 });

  const resetQuoteFormState = useCallback(() => {
    setCartItems([]);
    setSelectedCustomer(null);
    setSelectedVehicle("");
    setSelectedWarehouse("");
    setPaymentType("cash");
    setMixedPaymentMethods([]);
    setGlobalDiscount(0);
    setNotes("");
    setValidDays(7);
    setApplyIVA(true);
    setApplyRetention(false);
    setRetentionRate(2);
    setAppliedDiscounts([]);
    setCurrency("NIO");
  }, []);

  const syncDraftToServer = useCallback(async (draftId, snapshotOverride = undefined, nameOverride = undefined) => {
    if (!draftId) return;
    setDraftSaveState("saving");
    emitAutosaveStatus(AUTOSAVE_STATUS.SYNCING, { source: "quotations" });
    const tab = draftTabsRef.current.find((entry) => entry.id === draftId);
    const snapshot = snapshotOverride === undefined ? readDraft(draftId) || {} : (snapshotOverride || {});
    if (!isSaleDraftSaveEligible(snapshot)) {
      markDraftSaved();
      return;
    }
    try {
      const saved = await saveServerDraft(DRAFT_FLOW, draftId, {
        name: nameOverride || tab?.name || `Cotización ${draftTabsRef.current.length || 1}`,
        snapshot,
      });
      if (saved?.review) {
        setDraftTabs((prev) => prev.map((entry) => (
          entry.id === draftId
            ? { ...entry, review: normalizeDraftReview(saved.review) }
            : entry
        )));
      }
      if (saved?.snapshot && typeof window !== "undefined") {
        window.localStorage.setItem(getDraftKey(draftId), JSON.stringify(saved.snapshot));
        setDraftContentRevision((prev) => prev + 1);
      }
      markDraftSaved();
    } catch (error) {
      if (error.response?.status === 423) {
        toast.warning(
          "Este borrador está en revisión por supervisión. El formulario se ocultó; al liberarlo usa «Mostrar formulario» o «Abrir borrador».",
        );
        setShowNewQuote(false);
      }
      throw error;
    }
  }, [DRAFT_FLOW, markDraftSaved]);

  const scheduleDraftSync = useCallback((draftId, snapshotOverride = undefined, nameOverride = undefined) => {
    if (!draftId || typeof window === "undefined") return;
    const existingTimer = draftSyncTimersRef.current.get(draftId);
    if (existingTimer) {
      window.clearTimeout(existingTimer);
    }
    const timerId = window.setTimeout(() => {
      syncDraftToServer(draftId, snapshotOverride, nameOverride).catch(() => {
        // keep local draft if remote sync fails
      });
      draftSyncTimersRef.current.delete(draftId);
    }, 500);
    draftSyncTimersRef.current.set(draftId, timerId);
  }, [syncDraftToServer]);

  const isDraftEmpty = (draftId) => {
    if (typeof window === "undefined") return true;
    try {
      const raw = window.localStorage.getItem(getDraftKey(draftId));
      if (!raw) return true;
      const draft = JSON.parse(raw);
      return !draft?.selectedCustomerId
        && (!draft?.cartItems || draft.cartItems.length === 0)
        && !draft?.notes
        && !draft?.customerSearch
        && !draft?.productSearch
        && !draft?.globalDiscount
        && (!draft?.appliedDiscounts || draft.appliedDiscounts.length === 0);
    } catch (error) {
      return true;
    }
  };

  const updateDraftTabMeta = (draftId, snapshotOverride = null) => {
    if (typeof window === "undefined") return;
    try {
      const draft = snapshotOverride || readDraft(draftId);
      if (!draft || !isSaleDraftSaveEligible(draft)) return;
      const customerName = customers.find(c => c.customer_id === draft?.selectedCustomerId)?.name;
      let nextName = null;
      setDraftTabs(prev => prev.map(tab => {
        if (tab.id !== draftId) return tab;
        nextName = customerName ? `Cotización - ${customerName}` : tab.name;
        return { ...tab, name: nextName, updatedAt: draft?.updatedAt || tab.updatedAt };
      }));
      scheduleDraftSync(draftId, draft, nextName || undefined);
    } catch (error) {
      // ignore
    }
  };

  const createDraftTab = useCallback(() => {
    const id = `quote_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const name = `Cotización ${draftTabs.length + 1}`;
    const newTab = {
      id,
      name,
      updatedAt: new Date().toISOString(),
      ownerUserId: user?.user_id || null,
      ownerName: user?.name || null,
      review: normalizeDraftReview(null),
    };
    setDraftTabs(prev => [...prev, newTab]);
    setActiveDraftId(id);
    setShowNewQuote(true);
    setQuoteFormRenderNonce((prev) => prev + 1);
  }, [draftTabs.length, user?.name, user?.user_id]);

  const handleSaveAndClearQuote = useCallback(async () => {
    playSelectionFeedbackSound();

    if (activeDraftId && typeof window !== "undefined") {
      try {
        const draftKey = getDraftKey(activeDraftId);
        const raw = window.localStorage.getItem(draftKey);
        if (raw) {
          const snapshot = {
            ...JSON.parse(raw),
            validDays,
            updatedAt: new Date().toISOString(),
          };
          window.localStorage.setItem(draftKey, JSON.stringify(snapshot));
          updateDraftTabMeta(activeDraftId, snapshot);
          await syncDraftToServer(activeDraftId, snapshot);
          const releaseTab = draftTabsRef.current.find((entry) => entry.id === activeDraftId) || activeDraftTab;
          const released = await releaseWatchedDraftIfNeeded({
            flow: DRAFT_FLOW,
            tab: releaseTab,
            review: releaseTab?.review,
            userRole: user?.role,
            userId: user?.user_id,
          });
          if (released?.review) {
            setDraftTabs((prev) => prev.map((entry) => (
              entry.id === activeDraftId
                ? { ...entry, review: normalizeDraftReview(released.review) }
                : entry
            )));
            supervisorWatchingDraftRef.current = null;
          }
          setSaveFlash(true);
          window.setTimeout(() => setSaveFlash(false), 2000);
        }
      } catch (error) {
        toast.error("No se pudo guardar el borrador");
        return;
      }
    }

    createDraftTab();
    resetQuoteFormState();
    toast.success("Borrador guardado. Formulario listo para nueva cotización.");
  }, [DRAFT_FLOW, activeDraftId, activeDraftTab, createDraftTab, resetQuoteFormState, syncDraftToServer, user?.role, user?.user_id, validDays]);

  const closeDraftTab = (draftId, { force = false, createReplacement = false } = {}) => {
    const tab = draftTabsRef.current.find((entry) => entry.id === draftId);
    if (
      !force
      && !canSellerDeleteDraft(tab, tab?.review, user?.user_id, user?.role)
    ) {
      toast.error("No puedes eliminar un borrador revisado por supervisión");
      return;
    }
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(getDraftKey(draftId));
    }

    let nextActiveId;
    setDraftTabs((prev) => {
      const remaining = prev.filter((entry) => entry.id !== draftId);
      if (activeDraftIdRef.current === draftId) {
        nextActiveId = remaining[remaining.length - 1]?.id || null;
      }
      return remaining;
    });

    if (activeDraftIdRef.current === draftId) {
      if (nextActiveId) {
        setActiveDraftId(nextActiveId);
        setQuoteFormRenderNonce((prev) => prev + 1);
      } else if (createReplacement) {
        suppressAutoDraftRef.current = true;
        setActiveDraftId(null);
        resetQuoteFormState();
        createDraftTab();
        window.setTimeout(() => {
          suppressAutoDraftRef.current = false;
        }, 0);
      } else {
        setActiveDraftId(null);
        resetQuoteFormState();
        setQuoteFormRenderNonce((prev) => prev + 1);
      }
    }

    deleteServerDraft(DRAFT_FLOW, draftId).catch(() => {
      // keep local draft state even if remote cleanup fails
    });
  };

  const selectDraftAndOpenForm = useCallback(async (draftId) => {
    if (!draftId) return;
    const tab = draftTabsRef.current.find((entry) => entry.id === draftId);
    if (!canSellerOpenDraft(tab, tab?.review, user?.user_id, user?.role)) {
      toast.warning("Este borrador está en revisión por supervisión.");
      return;
    }
    if (supervisorWatchingDraftRef.current && supervisorWatchingDraftRef.current !== draftId) {
      await stopSupervisorWatch(supervisorWatchingDraftRef.current);
    }
    if (tab && !isOwnErpDraft(tab, user?.user_id)) {
      if (tab.ownerName) {
        toast.info(`Revisión silenciosa del borrador de ${tab.ownerName}`);
      }
      await startSupervisorWatch(draftId);
    }
    setActiveDraftId(draftId);
    updateDraftTabMeta(draftId);
    setShowNewQuote(true);
    setQuoteFormRenderNonce((prev) => prev + 1);
    scrollPageToTop({ anchorRef: quoteFormAnchorRef });
  }, [startSupervisorWatch, stopSupervisorWatch, updateDraftTabMeta, user?.user_id]);

  const openActiveDraft = useCallback(() => {
    if (draftTabs.length === 0) {
      createDraftTab();
      return;
    }
    if (!activeDraftId) {
      setActiveDraftId(draftTabs[0]?.id || null);
    }
    setShowNewQuote(true);
  }, [activeDraftId, createDraftTab, draftTabs]);

  const toggleEmbeddedQuoteForm = useCallback(() => {
    if (showNewQuote) {
      setShowNewQuote(false);
      return;
    }
    if (!activeDraftId) {
      createDraftTab();
      return;
    }
    setShowNewQuote(true);
  }, [activeDraftId, createDraftTab, showNewQuote]);

  const clearEmbeddedQuoteForm = useCallback(() => {
    if (typeof window !== "undefined" && activeDraftId) {
      window.localStorage.removeItem(getDraftKey(activeDraftId));
    }
    if (activeDraftId) {
      syncDraftToServer(activeDraftId, {}, draftTabsRef.current.find((tab) => tab.id === activeDraftId)?.name).catch(() => {
        // keep local clear behavior even if remote sync fails
      });
    }
    resetQuoteFormState();
    setQuoteFormRenderNonce((prev) => prev + 1);
    toast.success("Formulario limpiado.");
  }, [activeDraftId, resetQuoteFormState, syncDraftToServer]);

  useEffect(() => {
    if (!draftsLoaded || typeof window === "undefined") return;
    const flag = window.localStorage.getItem("catalog_open_draft");
    if (flag !== "quote") return;
    openActiveDraft();
    window.localStorage.removeItem("catalog_open_draft");
  }, [draftsLoaded, openActiveDraft]);

  useEffect(() => {
    if (!draftsLoaded || !showNewQuote || activeDraftId) return;
    if (suppressAutoDraftRef.current) return;
    createDraftTab();
  }, [activeDraftId, createDraftTab, draftsLoaded, showNewQuote]);

  useEffect(() => {
    if (!draftsLoaded) return;
    if (showNewQuote) return;
    if (draftTabs.length > 0) return;
    setShowNewQuote(true);
  }, [draftTabs.length, draftsLoaded, showNewQuote]);

  useEffect(() => {
    if (!activeDraftId || typeof window === "undefined") return;

    try {
      const draft = readDraft(activeDraftId);
      if (!draft || isDraftSnapshotEmpty(draft)) {
        resetQuoteFormState();
        return;
      }

      const customerId = draft.selectedCustomerId;
      if (customerId) {
        const customer = customers.find(
          (c) => String(c.customer_id ?? "") === String(customerId)
        );
        setSelectedCustomer(customer || null);
      } else {
        setSelectedCustomer(null);
      }

      setSelectedVehicle(draft.selectedVehicle || "");
      setSelectedWarehouse(draft.selectedWarehouse || "");
      setCartItems(draft.cartItems || []);
      setPaymentType(draft.paymentMethod || draft.payment_type || "cash");
      setMixedPaymentMethods(normalizePaymentMethodList(draft.mixedPaymentMethods || draft.mixed_payment_methods || []));
      setGlobalDiscount(draft.globalDiscount || 0);
      setNotes(draft.notes || "");
      setApplyIVA(draft.applyIVA ?? true);
      setApplyRetention(draft.applyRetention ?? false);
      setRetentionRate(draft.retentionRate ?? 2);
      setCurrency(draft.currency || "NIO");
      setAppliedDiscounts(draft.appliedDiscounts || []);
      setValidDays(Number.parseInt(draft?.validDays, 10) || 7);
    } catch (error) {
      // keep current state if draft parsing fails
    }
  }, [activeDraftId, customers, draftContentRevision, resetQuoteFormState]);

  useEffect(() => {
    if (!activeDraftId || typeof window === "undefined") return;
    try {
      const existingDraft = readDraft(activeDraftId) || {};
      const snapshot = {
        ...existingDraft,
        validDays,
        updatedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(getDraftKey(activeDraftId), JSON.stringify(snapshot));
      scheduleDraftSync(activeDraftId, snapshot);
    } catch (error) {
      // ignore local draft persistence errors
    }
  }, [activeDraftId, scheduleDraftSync, validDays]);

  const openCatalogFromQuoteForm = useCallback(async (snapshot) => {
    if (typeof window === "undefined") return;

    const nowIso = new Date().toISOString();
    const selectedVehicleRecord = vehicles.find((v) => v.vehicle_id === snapshot?.selectedVehicle) || null;
    const safeSnapshot = {
      selectedCustomerId: snapshot?.selectedCustomerId || null,
      selectedVehicle: snapshot?.selectedVehicle || "",
      vehicleFlowOption: snapshot?.vehicleFlowOption || (snapshot?.selectedVehicle ? "registered" : "carryout"),
      selectedVehicleData: snapshot?.selectedVehicleData || (selectedVehicleRecord
        ? {
            vehicle_id: selectedVehicleRecord.vehicle_id,
            brand: selectedVehicleRecord.brand,
            model: selectedVehicleRecord.model,
            year: selectedVehicleRecord.year,
            plate: selectedVehicleRecord.plate || selectedVehicleRecord.plate_number || selectedVehicleRecord.number_plate || null,
            vehicle_type: selectedVehicleRecord.vehicle_type || null,
            color: selectedVehicleRecord.color || selectedVehicleRecord.vehicle_color || selectedVehicleRecord.colour || null,
            vin: selectedVehicleRecord.vin || selectedVehicleRecord.chasis || selectedVehicleRecord.chassis || null,
          }
        : null),
      selectedWarehouse: snapshot?.selectedWarehouse || selectedWarehouse || "",
      paymentMethod: snapshot?.paymentMethod || snapshot?.payment_type || "cash",
      mixedPaymentMethods: normalizePaymentMethodList(snapshot?.mixedPaymentMethods || snapshot?.mixed_payment_methods || []),
      cartItems: Array.isArray(snapshot?.cartItems) ? snapshot.cartItems : [],
      globalDiscount: snapshot?.globalDiscount || 0,
      notes: snapshot?.notes || "",
      applyIVA: snapshot?.applyIVA ?? true,
      ivaRate: snapshot?.ivaRate ?? effectiveIvaRate,
      applyRetention: snapshot?.applyRetention ?? false,
      retentionRate: snapshot?.retentionRate ?? 2,
      currency: snapshot?.currency || "NIO",
      exchangeRate: snapshot?.exchangeRate || effectiveUsdNioRate,
      appliedDiscounts: Array.isArray(snapshot?.appliedDiscounts) ? snapshot.appliedDiscounts : [],
      validDays,
      customerSearch: snapshot?.customerSearch || "",
      productSearch: snapshot?.productSearch || "",
      updatedAt: nowIso,
    };

    if (!safeSnapshot.selectedCustomerId) {
      toast.error("Selecciona un cliente antes de buscar desde catálogo");
      return;
    }

    let draftId = activeDraftId;
    let nextTabs = Array.isArray(draftTabs) ? [...draftTabs] : [];

    if (!draftId) {
      draftId = `quote_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      const draftName = `Cotización - ${customers.find((c) => String(c.customer_id ?? "") === String(safeSnapshot.selectedCustomerId ?? ""))?.name || "Sin cliente"}`;
      nextTabs.push({
        id: draftId,
        name: draftName,
        updatedAt: nowIso,
        ownerUserId: user?.user_id || null,
        ownerName: user?.name || null,
        review: normalizeDraftReview(null),
      });
      setDraftTabs(nextTabs);
      setActiveDraftId(draftId);
    } else {
      nextTabs = nextTabs.map((tab) => (tab.id === draftId ? { ...tab, updatedAt: nowIso } : tab));
      setDraftTabs(nextTabs);
    }

    const selectedCustomerRecord = customers.find((c) => c.customer_id === safeSnapshot.selectedCustomerId) || null;
    const draftKey = getDraftKey(draftId);
    const draftName = nextTabs.find((tab) => tab.id === draftId)?.name;
    window.localStorage.setItem(DRAFT_LIST_KEY, JSON.stringify(nextTabs));
    window.localStorage.setItem(DRAFT_ACTIVE_KEY, draftId);
    window.localStorage.setItem(draftKey, JSON.stringify(safeSnapshot));
    scheduleDraftSync(draftId, safeSnapshot, draftName);
    try {
      await saveServerDraft(DRAFT_FLOW, draftId, {
        name: draftName,
        snapshot: safeSnapshot,
      });
      await setServerDraftActive(DRAFT_FLOW, draftId);
    } catch (error) {
      // continue with local draft context if remote sync is temporarily unavailable
    }
    window.localStorage.setItem(CATALOG_SOURCE_CONTEXT_KEY, JSON.stringify({
      source: "quote-form",
      returnPath: window.location.pathname || "/quotations",
      draftId,
      draftName: draftName || draftId,
      selectedCustomerId: safeSnapshot.selectedCustomerId,
      customerName: selectedCustomerRecord?.name || null,
      selectedVehicle: safeSnapshot.selectedVehicle || "",
      vehicle: selectedVehicleRecord
        ? {
            vehicle_id: selectedVehicleRecord.vehicle_id,
            brand: selectedVehicleRecord.brand,
            model: selectedVehicleRecord.model,
            year: selectedVehicleRecord.year,
            plate: selectedVehicleRecord.plate || selectedVehicleRecord.plate_number || selectedVehicleRecord.number_plate || null,
            vehicle_type: selectedVehicleRecord.vehicle_type || null,
          }
        : null,
      createdAtTs: Date.now(),
    }));
    window.localStorage.setItem("catalog_open_draft", "quote");
    window.location.href = "/catalog";
  }, [
    DRAFT_ACTIVE_KEY,
    DRAFT_FLOW,
    DRAFT_LIST_KEY,
    activeDraftId,
    customers,
    draftTabs,
    effectiveIvaRate,
    effectiveUsdNioRate,
    scheduleDraftSync,
    selectedWarehouse,
    user?.name,
    user?.user_id,
    validDays,
    vehicles,
  ]);

  const addToCart = (product) => {
    const existing = cartItems.find(item => item.product_id === product.product_id);
    if (existing) {
      setCartItems(cartItems.map(item =>
        item.product_id === product.product_id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCartItems([...cartItems, {
        product_id: product.product_id,
        product_name: product.name,
        image: product.images?.[0] || null,
        quantity: 1,
        unit_price: product.price,
        discount: 0,
      }]);
    }
  };

  const updateCartItem = (productId, field, value) => {
    setCartItems(cartItems.map(item =>
      item.product_id === productId ? { ...item, [field]: value } : item
    ));
  };

  const removeFromCart = (productId) => {
    setCartItems(cartItems.filter(item => item.product_id !== productId));
  };

  const calculateTotals = () => {
    const subtotal = cartItems.reduce((sum, item) => {
      const itemTotal = item.unit_price * item.quantity * (1 - item.discount / 100);
      return sum + itemTotal;
    }, 0);
    const tax = subtotal * (effectiveIvaRate / 100);
    const discountAmount = subtotal * (globalDiscount / 100);
    const total = subtotal + tax - discountAmount;
    return { subtotal, tax, discountAmount, total };
  };

  const createQuotation = async () => {
    if (!selectedCustomer || cartItems.length === 0) {
      toast.error("Selecciona un cliente y agrega productos");
      return;
    }

    try {
      await axios.post(`${API}/quotations`, {
        customer_id: selectedCustomer?.customer_id || selectedCustomer,
        items: cartItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          discount: item.discount,
        })),
        discount: globalDiscount,
        valid_days: validDays,
        notes,
      }, { withCredentials: true });

      toast.success("Cotización creada exitosamente");
      setShowNewQuote(false);
      resetQuoteFormState();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al crear cotización");
    }
  };

  // Create quotation from SaleForm payload
  const createQuotationWithPayload = async (payload) => {
    if (!payload?.customer_id || !payload?.items || payload.items.length === 0) {
      throw new Error("Selecciona un cliente y agrega productos");
    }

    const body = {
      customer_id: payload.customer_id,
      items: payload.items.map(i => ({
        product_id: i.product_id,
        quantity: i.quantity,
        discount: i.discount,
        unit_price: i.unit_price,
        with_installation: i.with_installation || false,
      })),
      active_price_tier: payload.active_price_tier || null,
      active_price_tier_label: payload.active_price_tier_label || null,
      audit_events: payload.audit_events || [],
      precio2_approval_id: payload.precio2_approval_id || null,
      discount: payload.discount || 0,
      valid_days: validDays,
      notes: payload.notes || null,
      vehicle_id: payload.vehicle_id || null,
      warehouse_id: payload.warehouse_id || null,
      apply_iva: payload.apply_iva ?? true,
      iva_rate: payload.iva_rate ?? effectiveIvaRate,
      currency: payload.currency || "NIO",
      exchange_rate: payload.exchange_rate || null,
      discount_codes: payload.discount_codes || [],
      payment_type: payload.payment_type || payload.payment_method || "cash",
      payment_method: payload.payment_method || payload.payment_type || "cash",
      mixed_payment_methods: normalizePaymentMethodList(payload.mixed_payment_methods || payload.mixedPaymentMethods || []),
      credit_days: payload.credit_days || null,
    };

    const response = await axios.post(`${API}/quotations`, body, { withCredentials: true });

    toast.success("Cotización creada exitosamente");
    if (response?.data?.quotation_id) {
      const url = `${API}/print/quotation-pdf/${response.data.quotation_id}`;
      window.open(url, "_blank");
    }
    fetchData();
    return response.data;
  };

  const updateStatus = async (quotationId, status) => {
    try {
      await axios.put(`${API}/quotations/${quotationId}/status?status=${status}`, {}, { withCredentials: true });
      toast.success("Estado actualizado");
      fetchData();
    } catch (error) {
      toast.error("Error al actualizar estado");
    }
  };

  const isQuotationValid = (quotation) => {
    if (!quotation?.valid_until) return false;
    const validUntil = new Date(quotation.valid_until);
    if (Number.isNaN(validUntil.getTime())) return false;
    return validUntil >= new Date();
  };

  const getValidityInfo = (quotation) => {
    if (!quotation?.valid_until) {
      return { expired: true, expiringSoon: false, label: "Sin vigencia", expiresAtText: "—" };
    }
    const validUntilDate = new Date(quotation.valid_until);
    const validUntil = validUntilDate.getTime();
    if (Number.isNaN(validUntil)) {
      return { expired: true, expiringSoon: false, label: "Sin vigencia", expiresAtText: "—" };
    }
    const diffMs = validUntil - now;
    if (diffMs <= 0) {
      return { expired: true, expiringSoon: false, label: "Vencida", expiresAtText: validUntilDate.toLocaleString() };
    }
    const totalHours = Math.floor(diffMs / 3600000);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    const dayLabel = days === 1 ? "1 dia" : `${days} dias`;
    const hourLabel = hours === 1 ? "1 hora" : `${hours} horas`;
    const expiringSoon = diffMs <= 24 * 3600000;
    return {
      expired: false,
      expiringSoon,
      label: `${dayLabel} ${hourLabel}`,
      expiresAtText: validUntilDate.toLocaleString(),
    };
  };

  const normalizePhone = (phone) => (phone || "").toString().replace(/[^\d]/g, "");

  const resolveQuotationPhone = (quotation) => {
    const fromQuote = quotation?.customer_phone || quotation?.phone || "";
    if (fromQuote) return fromQuote;
    const fromCustomerId = customers.find(c => c.customer_id === quotation?.customer_id)?.phone;
    if (fromCustomerId) return fromCustomerId;
    const fromName = customers.find(c => c.name === quotation?.customer_name)?.phone;
    return fromName || "";
  };

  const sendQuotationWhatsApp = (quotation) => {
    const phone = normalizePhone(resolveQuotationPhone(quotation));
    if (!phone) {
      toast.error("El cliente no tiene teléfono válido");
      return;
    }
    const quoteUrl = `${API}/print/quotation-pdf/${quotation.quotation_id}`;
    const customerName = quotation.customer_name || "cliente";
    const message = `Hola ${customerName}, te envío la cotización ${quotation.quotation_id}. Puedes verla aquí: ${quoteUrl}`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const convertToSale = async (quotation) => {
    if (!quotation?.quotation_id) return;
    if (!isQuotationValid(quotation)) {
      toast.error("La cotización está vencida y no puede convertirse a venta");
      return;
    }

    window.open(`${API}/print/quotation-pdf/${quotation.quotation_id}`, "_blank");

    // Conversión directa, sin confirmación

    try {
      const items = (quotation.items || []).map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        discount: item.discount || 0,
        warehouse_id: quotation.warehouse_id || undefined,
        with_installation: item.with_installation || false,
      }));

      const saleBody = {
        customer_id: quotation.customer_id,
        quotation_id: quotation.quotation_id,
        items,
        discount: quotation.discount_percent || 0,
        payment_type: quotation.payment_type || quotation.payment_method || "cash",
        payment_method: quotation.payment_method || quotation.payment_type || "cash",
        credit_days: quotation.payment_type === "credit" ? (quotation.credit_days || 30) : null,
        delivery_required: false,
        delivery_address: null,
        vehicle_id: quotation.vehicle_id || null,
        notes: quotation.notes || null,
      };

      const response = await axios.post(`${API}/sales`, saleBody, { withCredentials: true });
      const invoiceNumber = response?.data?.invoice_number;
      toast.success(invoiceNumber ? `Venta ${invoiceNumber} creada` : "Venta creada exitosamente");
      fetchData();
      window.location.href = "/sales";
    } catch (error) {
      const detail = error?.response?.data?.detail;
      if (detail?.error === "REQUIRES_MANAGER_AUTH") {
        toast.error(detail.message || "Requiere autorización de gerente");
      } else {
        toast.error(detail || "Error al convertir a venta");
      }
    }
  };

  const convertToSaleDraft = (quotation) => {
    if (!quotation?.quotation_id) return;
    if (!isQuotationValid(quotation)) {
      toast.error("La cotización está vencida y no puede convertirse a borrador");
      return;
    }
    if (typeof window === "undefined") return;

    const draftId = `sale_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const draftName = `Venta - ${quotation.customer_name || "Cotización"}`;
    const updatedAt = new Date().toISOString();
    const tab = { id: draftId, name: draftName, updatedAt };

    const items = Array.isArray(quotation.items) ? quotation.items : [];
    const cartItems = items.map((item) => {
      const productMatch = products.find((p) => (p.product_id || p.sku || p.id) === item.product_id);
      const installationType = productMatch?.installation_type || "optional";
      return {
        product_id: item.product_id,
        product_name: item.product_name || productMatch?.name || "Producto",
        image: item.image || productMatch?.images?.[0] || productMatch?.image_url || productMatch?.image || null,
        quantity: item.quantity || 1,
        unit_price: item.unit_price || item.price || productMatch?.price || 0,
        discount: item.discount || 0,
        installation_type: installationType,
        installation_price: productMatch?.installation_price || 0,
        with_installation: item.with_installation || installationType === "required",
        warehouse_id: quotation.warehouse_id || item.warehouse_id || null,
      };
    });

    const snapshot = {
      selectedCustomerId: quotation.customer_id || null,
      selectedVehicle: quotation.vehicle_id || "",
      selectedWarehouse: quotation.warehouse_id || "",
      paymentMethod: quotation.payment_method || quotation.payment_type || "cash",
      mixedPaymentMethods: normalizePaymentMethodList(quotation.mixed_payment_methods || quotation.mixedPaymentMethods || []),
      cartItems,
      globalDiscount: quotation.discount_percent || 0,
      notes: quotation.notes || "",
      applyIVA: quotation.apply_iva ?? true,
      ivaRate: effectiveIvaRate,
      currency: quotation.currency || "NIO",
      exchangeRate: effectiveUsdNioRate,
      appliedDiscounts: quotation.applied_discounts || [],
      customerSearch: "",
      productSearch: "",
      updatedAt,
    };

    const rawList = window.localStorage.getItem(SALE_DRAFT_LIST_KEY);
    const list = rawList ? JSON.parse(rawList) : [];
    const nextList = Array.isArray(list) ? [...list, tab] : [tab];

    window.localStorage.setItem(SALE_DRAFT_LIST_KEY, JSON.stringify(nextList));
    window.localStorage.setItem(SALE_DRAFT_ACTIVE_KEY, draftId);
    window.localStorage.setItem(`${SALE_DRAFT_KEY_PREFIX}${draftId}`, JSON.stringify(snapshot));
    saveServerDraft("sale", draftId, { name: tab.name, snapshot }).catch(() => {
      // sales page can still recover from local storage if remote sync fails
    });
    window.localStorage.setItem("catalog_open_draft", "sale");
    window.location.href = "/sales";
  };

  const filteredQuotations = quotations.filter(q => {
    const query = search.toLowerCase();
    const validity = getValidityInfo(q);
    const validityMatch = filterValidity === "all"
      ? true
      : filterValidity === "active"
        ? !validity.expired
        : validity.expired;
    return validityMatch && (
      (q.quotation_id || "").toLowerCase().includes(query) ||
      (q.customer_name || "").toLowerCase().includes(query)
    );
  });

  const totals = calculateTotals();

  return (
    <div className="p-6 space-y-6" data-testid="quotations-page">
      {!showNewQuote ? (
        <Card className="border-dashed border-primary/40 bg-primary/5">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Formulario de cotización oculto</p>
              <p className="text-xs text-muted-foreground">
                Usa el botón para volver a cotizar, o abre un borrador del tablero.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => {
                playSelectionFeedbackSound();
                toggleEmbeddedQuoteForm();
              }}
              data-testid="show-quote-form-banner-btn"
            >
              <Eye className="h-4 w-4 mr-2" />
              Mostrar formulario
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {showNewQuote ? (
        <Card ref={quoteFormAnchorRef} className="border-primary/30 shadow-sm ui-panel animate-fade-up-soft">
          <CardHeader className="pb-3">
            <div className="flex w-full flex-wrap items-center gap-2 ui-fade-in-stagger">
              <ErpFormToolbar saveFlash={saveFlash}>
                <ErpToolbarButton
                  action="refresh"
                  icon={RefreshCw}
                  label="Actualizar datos"
                  onClick={() => {
                    playSelectionFeedbackSound();
                    fetchData();
                  }}
                  title="Actualizar datos"
                />
                <ErpToolbarButton
                  action="saveClear"
                  icon={SaveAll}
                  label="Guardar y Limpiar"
                  testId="save-and-clear-quotation-btn"
                  onClick={handleSaveAndClearQuote}
                  disabled={draftSaveState === "saving"}
                  title="Guardar borrador y limpiar formulario"
                />
                {showReleaseDraftButton ? (
                  <ErpToolbarButton
                    action="save"
                    icon={Unlock}
                    label="Liberar"
                    onClick={handleReleaseDraft}
                    title="Liberar borrador para el vendedor"
                  />
                ) : null}
              </ErpFormToolbar>
              <div className="ml-auto flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs text-muted-foreground">
                <span className={currency === "NIO" ? "font-semibold text-foreground" : ""}>C$</span>
                <Switch
                  checked={currency === "USD"}
                  disabled={sellerQuoteParamsLocked}
                  onCheckedChange={(checked) => {
                    if (sellerQuoteParamsLocked) {
                      toast.error("No puedes modificar la moneda en un borrador revisado por supervisión");
                      return;
                    }
                    playSelectionFeedbackSound();
                    setCurrency(checked ? "USD" : "NIO");
                  }}
                  className="data-[state=unchecked]:bg-blue-500 data-[state=checked]:bg-emerald-500"
                  aria-label="Cambiar moneda entre córdobas y dólares"
                />
                <span className={currency === "USD" ? "font-semibold text-foreground" : ""}>US$</span>
              </div>
              <ErpToolbarButton
                action="clear"
                icon={Eraser}
                label="Limpiar"
                onClick={() => {
                  playSelectionFeedbackSound();
                  setShowClearQuoteConfirm(true);
                }}
                title="Limpiar Formulario"
              />
            </div>
            <Dialog open={showClearQuoteConfirm} onOpenChange={setShowClearQuoteConfirm}>
              <DialogContent className="max-w-sm">
                <ContextualDialogHeader
                  variant="warning"
                  size="hero"
                  title="¿Limpiar formulario?"
                  description="Se borrarán todos los datos ingresados en la cotización actual. Esta acción no se puede deshacer."
                />
                <ContextualDialogFooter variant="warning">
                  <Button
                    variant="ghost"
                    className={getStatusSecondaryButtonClass("warning")}
                    onClick={() => setShowClearQuoteConfirm(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className={getStatusPrimaryButtonClass("warning")}
                    onClick={() => { setShowClearQuoteConfirm(false); clearEmbeddedQuoteForm(); }}
                  >
                    <Eraser className="mr-2 h-4 w-4" />
                    Sí, limpiar
                  </Button>
                </ContextualDialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="pt-0">
            <div key={activeDraftId || "no-draft"} className="animate-draft-load">
            <SaleForm
              key={`${activeDraftId || "draft"}-${quoteFormRenderNonce}`}
              customers={customers}
              products={products}
              warehouses={warehouses}
              inventory={inventory}
              vehicles={vehicles}
              flowType="quotation"
              step4Label="Paso 4: Productos en esta Cotización"
              step5Label="Paso 5: Método de Pago (Cotización)"
              initialData={{
                selectedCustomer,
                selectedVehicle,
                selectedWarehouse,
                cartItems,
                paymentMethod: paymentType,
                mixedPaymentMethods,
                globalDiscount,
                notes,
                applyIVA,
                applyRetention,
                retentionRate,
                ivaRate: effectiveIvaRate,
                currency,
                appliedDiscounts,
              }}
              defaultIvaRate={effectiveIvaRate}
              draftKey={activeDraftId ? getDraftKey(activeDraftId) : null}
              draftReview={activeDraftReview}
              onOpenCatalogSearch={openCatalogFromQuoteForm}
              onDraftPersist={(snapshot) => {
                if (!activeDraftId) return;
                if (!isSaleDraftSaveEligible(snapshot)) return;
                markDraftSaving();
                updateDraftTabMeta(activeDraftId, {
                  ...snapshot,
                  validDays,
                });
              }}
              onDraftSaveStateChange={(payload) => {
                const state = payload?.state;
                if (state === "saving") {
                  markDraftSaving();
                  return;
                }
                if (state === "saved") {
                  markDraftSaved();
                  return;
                }
                if (state === "error") {
                  markDraftSaveError();
                }
              }}
              onDraftClear={() => {
                if (!activeDraftId) return;
                deleteServerDraft(DRAFT_FLOW, activeDraftId).catch(() => {
                  // keep local clear behavior if remote cleanup fails
                });
              }}
              onDataRefresh={fetchData}
              currencyValue={currency}
              onCurrencyChange={setCurrency}
              hideCurrencyField={true}
              extraFields={
                <div>
                  <Label>Validez (días)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={validDays}
                    disabled={sellerQuoteParamsLocked}
                    onChange={(e) => {
                      if (sellerQuoteParamsLocked) {
                        toast.error("No puedes modificar la validez en un borrador revisado por supervisión");
                        return;
                      }
                      setValidDays(parseInt(e.target.value, 10) || 1);
                    }}
                  />
                  {sellerQuoteParamsLocked ? (
                    <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
                      Validez definida por supervisión; no editable.
                    </p>
                  ) : null}
                </div>
              }
              submitLabel="Crear Cotización"
              onSubmit={async (payload) => {
                const submittedDraftId = activeDraftIdRef.current;
                try {
                  const createdQuote = await createQuotationWithPayload(payload);
                  if (!createdQuote?.quotation_id) return;
                  if (submittedDraftId) {
                    closeDraftTab(submittedDraftId, { force: true, createReplacement: true });
                  } else {
                    resetQuoteFormState();
                    createDraftTab();
                  }
                } catch (err) {
                  const detail = err?.response?.data?.detail;
                  const message = typeof detail === "string"
                    ? detail
                    : (detail?.message || err?.message || "Error al crear cotización");
                  toast.error(message);
                }
              }}
            />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cotización..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="search-quotations"
          />
        </div>
        <Button
          type="button"
          variant={showNewQuote ? "outline" : "default"}
          onClick={() => {
            playSelectionFeedbackSound();
            toggleEmbeddedQuoteForm();
          }}
          className="ui-interactive"
          title={showNewQuote ? "Ocultar formulario" : "Mostrar formulario"}
          aria-label={showNewQuote ? "Ocultar formulario de cotización" : "Mostrar formulario de cotización"}
        >
          {showNewQuote ? (
            <>
              <XCircle className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Ocultar formulario</span>
            </>
          ) : (
            <>
              <Eye className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Mostrar formulario</span>
            </>
          )}
        </Button>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendiente</SelectItem>
            <SelectItem value="approved">Aprobada</SelectItem>
            <SelectItem value="rejected">Rechazada</SelectItem>
            <SelectItem value="converted">Convertida</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterValidity} onValueChange={setFilterValidity}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Vigencia" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="active">Vigentes</SelectItem>
            <SelectItem value="expired">Vencidas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Drafts + Quotations */}
      <div className="2xl:hidden">
        <Tabs value={boardTab} onValueChange={setBoardTab}>
          <TabsList className="h-11 w-full justify-center overflow-auto rounded-full border bg-card/95 p-1 touch-pan-x">
            <TabsTrigger value="drafts" className="shrink-0 rounded-full px-4 text-[12px] leading-tight data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Borradores
            </TabsTrigger>
            <TabsTrigger value="created" className="shrink-0 rounded-full px-4 text-[12px] leading-tight data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Creadas
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-6 2xl:grid-cols-[440px,1fr]">
        <Card className={cn("h-fit", boardTab !== "drafts" ? "hidden 2xl:block" : "") }>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">BORRADORES DE COTIZACIÓN</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {visibleDraftTabs.length === 0 ? (
              <div className="border border-dashed rounded-xl p-6 text-center text-sm text-muted-foreground">
                No hay borradores abiertos.
              </div>
            ) : (
              <div className="grid gap-4">
                {visibleDraftTabs.map((tab) => {
                  const meta = getDraftMeta(tab);
                  const isActive = activeDraftId === tab.id;
                  const openDraft = () => {
                    selectDraftAndOpenForm(tab.id);
                  };
                  return (
                    <DraftBoardCard
                      key={`${tab.id}-${draftContentRevision}`}
                      tab={tab}
                      meta={meta}
                      isActive={isActive}
                      currentUserId={user?.user_id}
                      currentUserRole={user?.role}
                      nowMs={now}
                      emptyProductsLabel="Sin productos aún"
                      onOpen={openDraft}
                      onDelete={() => closeDraftTab(tab.id)}
                    />
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={cn(boardTab !== "created" ? "hidden 2xl:block" : "") }>
          <CardContent className="p-4">
            {loading ? (
              <div className="py-10 text-center text-muted-foreground">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto" />
              </div>
            ) : filteredQuotations.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                No hay cotizaciones
              </div>
              ) : (
              <div className="grid gap-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-muted-foreground">Mostrando últimas 10 cotizaciones</div>
                  {filteredQuotations.length > 10 && (
                    <Button variant="ghost" size="sm" onClick={() => setShowArchivedQuotes(s => !s)}>
                      {showArchivedQuotes ? `Ocultar archivadas (${filteredQuotations.length - 10})` : `Mostrar archivadas (${filteredQuotations.length - 10})`}
                    </Button>
                  )}
                </div>
                { (showArchivedQuotes ? filteredQuotations : filteredQuotations.slice(0, 10)).map((q, index) => {
                  const quotationId = q.quotation_id || q.id || q._id || "";
                  const validity = getValidityInfo(q);
                  const canConvert = q.status === "approved" && !validity.expired;
                  const paymentType = q.payment_type || "cash";
                  const customerLabel = getCustomerNameFromQuote(q);
                  const vehicleLabel = getQuoteVehicleLabel(q);
                  const itemsPreview = getQuoteItemsPreview(q);
                  return (
                    <Card key={quotationId || q.customer_name || index} className="relative overflow-hidden">
                      <VehicleThumbnailWatermark vehicle={q.vehicle_id ? getVehicleById(q.vehicle_id) : null} />
                      <CardContent className="relative p-4 space-y-3">
                        <div className="flex gap-3 items-start">
                          <div className="flex-1 flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold">
                                {quotationId ? `#${quotationId.slice(-6).toUpperCase()}` : "Sin ID"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {customerLabel}
                              </p>
                              {vehicleLabel ? (
                                <p className="text-xs text-muted-foreground">Vehículo: {vehicleLabel}</p>
                              ) : null}
                              <p className="text-xs text-muted-foreground">
                                {q.created_at ? formatDate(q.created_at) : "—"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Vence: {validity.expiresAtText}
                              </p>
                              <p className={`text-xs ${validity.expired ? "text-red-500" : "text-muted-foreground"}`}>
                                Vigencia: {validity.label}
                              </p>
                              {validity.expiringSoon ? (
                                <Badge className="bg-amber-50 text-amber-700 border-amber-200">Vence hoy</Badge>
                              ) : null}
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold">
                                {formatCurrency(q.total || 0)}
                              </p>
                              <div className="flex flex-wrap justify-end gap-2 mt-1">
                                <Badge className={getPaymentTone(paymentType)}>
                                  {PAYMENT_TYPES[paymentType] || paymentType || "Efectivo"}
                                </Badge>
                                <Badge className={getStatusColor(q.status || "pending")}>
                                  {q.status === "pending" ? "Pendiente" :
                                   q.status === "approved" ? "Aprobada" :
                                   q.status === "rejected" ? "Rechazada" : "Convertida"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className={cn(CUSTOMER_VEHICLE_CARD_PATTERNS.shared.shell, CUSTOMER_VEHICLE_CARD_PATTERNS.shared.pairedCompactMinHeight, CUSTOMER_VEHICLE_CARD_PATTERNS.customer.shell, "p-2") }>
                            <div className={CUSTOMER_VEHICLE_CARD_PATTERNS.shared.splitCompact}>
                              <div className="min-w-0 space-y-1">
                                <p className="inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold text-emerald-900">
                                  <User className="h-3.5 w-3.5 text-emerald-700" />
                                  <span className="truncate">{customerLabel || "Sin cliente"}</span>
                                </p>
                                <p className="text-[11px] text-emerald-900/80">Artículos: {itemsPreview}</p>
                              </div>
                              <Badge variant="outline" className={CUSTOMER_VEHICLE_CARD_PATTERNS.customer.badge}>Cliente</Badge>
                            </div>
                          </div>
                          <div className={cn(CUSTOMER_VEHICLE_CARD_PATTERNS.shared.shell, CUSTOMER_VEHICLE_CARD_PATTERNS.shared.pairedCompactMinHeight, CUSTOMER_VEHICLE_CARD_PATTERNS.vehicle.shell, "p-2") }>
                            <div className={CUSTOMER_VEHICLE_CARD_PATTERNS.shared.splitCompact}>
                              <div className="min-w-0 space-y-1">
                                <p className="inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold text-sky-900">
                                  <CarFront className="h-3.5 w-3.5 text-sky-700" />
                                  <span className="truncate">{vehicleLabel || "Sin vehículo"}</span>
                                </p>
                                <p className="text-[11px] text-sky-900/80">Vigencia: {validity.label}</p>
                              </div>
                              <Badge variant="outline" className={CUSTOMER_VEHICLE_CARD_PATTERNS.vehicle.badge}>Vehículo</Badge>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => sendQuotationWhatsApp(q)}
                            title="Enviar por WhatsApp"
                          >
                            <WhatsAppIcon className="h-6 w-6 text-[#25D366]" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Ver detalle (solo lectura)"
                            onClick={() => navigate(`/quotations/view/${quotationId}`)}
                          >
                            <Eye className="h-5 w-5" />
                          </Button>
                          {q.status === "pending" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => updateStatus(quotationId, "approved")}
                                title="Aprobar"
                              >
                                <CheckCircle className="h-5 w-5 text-green-500" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => updateStatus(quotationId, "rejected")}
                                title="Rechazar"
                              >
                                <XCircle className="h-5 w-5 text-red-500" />
                              </Button>
                            </>
                          )}
                          {q.status === "approved" && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => convertToSaleDraft(q)}
                                disabled={!canConvert}
                                title={canConvert ? "Convertir a borrador de factura" : "Cotización vencida"}
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                Borrador de factura
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => convertToSale(q)}
                                title={canConvert ? "Convertir a factura" : "Cotización vencida"}
                                disabled={!canConvert}
                              >
                                <ShoppingCart className="h-4 w-4 mr-2" />
                                Convertir a factura
                              </Button>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
      </Card>
      </div>
    </div>
  );
}
