/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
// intentionally not destructuring `user` from AuthContext to avoid unused variable
import { useAuth } from "../context/AuthContext";
import { formatCurrency, formatDate, getStatusColor, PAYMENT_TYPES } from "../lib/utils";
import { cn } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog";
import {
  ContextualDialogFooter,
  ContextualDialogHeader,
  getStatusPrimaryButtonClass,
  getStatusSecondaryButtonClass,
} from "../components/ui/contextual-dialog-header";
import { useDialogMessages } from "../context/DialogMessagesContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Separator } from "../components/ui/separator";
import { Switch } from "../components/ui/switch";
import { ScrollArea } from "../components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import SearchableSelect from "@/components/ui/searchable-select";
import { toast } from "sonner";
import { 
  Search, CreditCard, Printer, Download, RefreshCw,
  Wrench, Package, ShieldCheck, Car, XCircle,
  User, Truck, Tag, Percent, ArrowRightLeft, Building2, Eye, Eraser, SaveAll, Unlock
} from "lucide-react";
import { API_BASE as API } from "@/lib/api";
import { loadLocalDraftState, mirrorServerDraftsToLocalStorage } from "@/lib/draftStorage";
import { AUTOSAVE_STATUS, emitAutosaveStatus } from "@/lib/autosaveStatus";
import { getVehicleThumbnail } from "@/lib/vehicleThumbnail";
import { VehicleThumbnailWatermark } from "@/components/erp/VehicleThumbnailWatermark";
import {
  fetchUsdNioDualRates,
  DEFAULT_USD_NIO_BUY_RATE,
  DEFAULT_USD_NIO_SELL_RATE,
} from "@/lib/exchangeRate";
import { defaultApplyIvaForCustomer, isCompanyCustomerType } from "@/lib/saleTotals";
import { fetchEffectiveIvaRate, DEFAULT_IVA_RATE } from "@/lib/taxRate";
import {
  deleteServerDraft,
  fetchServerDraftBundle,
  releaseServerDraft,
  saveServerDraft,
  setServerDraftActive,
  unwatchServerDraft,
  watchServerDraft,
} from "@/lib/serverDrafts";
import { useDraftReviewPolling } from "@/hooks/useDraftReviewPolling";
import {
  canSellerDeleteDraft,
  canSellerOpenDraft,
  isDraftReleasedWithRestrictions,
  normalizeDraftReview,
} from "@/lib/draftReview";
import { playSelectionFeedbackSound } from "@/lib/uiSounds";
import { releaseWatchedDraftIfNeeded } from "@/lib/supervisorDraftRelease";
import {
  normalizePaymentMethodCode,
  normalizePaymentMethodList,
  paymentMethodsAllowDiscounts,
} from "@/lib/paymentMethods";
import {
  getVehicleSelectOptionsByBrandYear,
  getVehicleYearsByBrand,
  isValidVehicleSelection,
  VEHICLE_CATALOG_BRANDS,
  VEHICLE_COLOR_SUGGESTIONS,
} from "@/lib/vehicleCatalog";
import {
  formatChasis,
  formatCedula,
  formatPhone,
  formatPlateNumber,
  formatRUC,
} from "@/lib/formatters";

import SaleForm from "../components/sales/SaleForm";
import BrandMosaicLoader from "@/components/ui/BrandMosaicLoader";
import TachometerLoader from "@/components/ui/TachometerLoader";
import SalePaymentPlanDialog from "../components/sales/SalePaymentPlanDialog";
import SaleOperationalAuditDialog from "../components/sales/SaleOperationalAuditDialog";
import { OperationalJobCard } from "@/components/erp/OperationalJobCard";
import ErpFormToolbar, { ErpToolbarButton } from "@/components/erp/ErpFormToolbar";
import { isErpDraftSupervisor, isOwnErpDraft, canAccessCashier, canPrintLetterInvoice, canReprintSellerVoucher, isSellerRole } from "@/lib/roleHome";
import { computeDraftSnapshotTotals } from "@/lib/saleTotals";
import { isSaleDraftSaveEligible } from "@/lib/draftSaveEligibility";
import { scrollPageToTop } from "@/lib/scrollPageToTop";
import { buildCustomerProofWhatsAppUrl } from "@/lib/deliveryProof";

// Divisas disponibles
const CURRENCIES = [
  { code: "NIO", symbol: "C$", name: "Córdobas" },
  { code: "USD", symbol: "US$", name: "Dólares" },
];

const CATALOG_SOURCE_CONTEXT_KEY = "catalog_source_context_v1";

const WhatsAppIcon = ({ className }) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
    <path
      fill="currentColor"
      d="M19.11 17.72c-.28-.14-1.64-.81-1.9-.9-.25-.1-.44-.14-.62.14-.18.28-.71.9-.87 1.08-.16.18-.32.2-.6.06-.28-.14-1.16-.43-2.21-1.37-.82-.73-1.37-1.63-1.53-1.9-.16-.28-.02-.43.12-.57.12-.12.28-.32.42-.48.14-.16.18-.28.28-.46.1-.18.05-.34-.02-.48-.07-.14-.62-1.5-.85-2.05-.22-.53-.44-.46-.62-.47h-.53c-.18 0-.48.07-.73.34-.25.28-.96.94-.96 2.3 0 1.36.99 2.68 1.12 2.86.14.18 1.95 2.98 4.73 4.18.66.28 1.17.45 1.58.58.66.21 1.26.18 1.73.11.53-.08 1.64-.67 1.87-1.32.23-.65.23-1.21.16-1.32-.07-.12-.25-.18-.53-.32zM16.03 5.5c-5.72 0-10.37 4.65-10.37 10.37 0 1.83.48 3.54 1.32 5.03l-1.4 5.13 5.26-1.38a10.33 10.33 0 0 0 5.19 1.4c5.72 0 10.37-4.65 10.37-10.37S21.75 5.5 16.03 5.5zm0 18.9c-1.7 0-3.3-.46-4.67-1.34l-.34-.2-3.13.82.83-3.05-.22-.35a8.84 8.84 0 0 1-1.38-4.71 8.9 8.9 0 0 1 17.8 0 8.9 8.9 0 0 1-8.9 8.83z"
    />
  </svg>
);

// Prefijos de placa Nicaragua
const PLATE_PREFIXES = [
  "M", "LE", "CH", "MY", "GR", "CZ", "MT", "BO", "CT", "RI", 
  "NS", "ES", "MZ", "JI", "RS", "AN", "AS", "TM", "ZC", "PN", 
  "EN", "CD", "MI", "OI"
];

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

const DRAFT_SUPERVISOR_ROLES_SET = new Set([
  "gerencia",
  "supervisor",
  "jefe_vendedores",
  "jefe_tienda",
  "recursos_humanos",
]);

function formatRelativeTimeHelper(isoDate) {
  if (!isoDate) return null;
  const parsed = new Date(isoDate).getTime();
  if (!Number.isFinite(parsed)) return null;
  const diffMs = Math.max(0, Date.now() - parsed);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

function cleanSubtitleHelper(title, subtitle) {
  try {
    const t = String(title || "").trim().toLowerCase();
    const s = String(subtitle || "").trim();
    if (!s) return null;
    if (!t) return s;
    const sLower = s.toLowerCase();
    if (sLower === t) return null;
    const stripped = sLower
      .replace(/^(venta|cotizacion|cotización|quote|draft|borrador)\s*[-–—:]\s*/i, "")
      .trim();
    if (stripped && stripped === t) return null;
    return s;
  } catch (_) {
    return subtitle || null;
  }
}

function DraftBoardCard({
  tab,
  meta,
  isActive = false,
  currentUserId = null,
  currentUserRole = null,
  openLabel = "Abrir borrador",
  emptyProductsLabel = "Sin productos aún",
  onOpen,
  onDelete,
}) {
  const isOwn = !tab?.ownerUserId || String(tab.ownerUserId) === String(currentUserId || "");
  const isSupervisorViewer = DRAFT_SUPERVISOR_ROLES_SET.has(String(currentUserRole || "").toLowerCase());
  const resolvedOpenLabel = isSupervisorViewer && !isOwn ? "Editar borrador" : openLabel;
  const review = tab?.review || meta?.review || null;
  const reviewStatus = String(review?.status || "idle").toLowerCase();
  const supervisorChanged = Boolean(review?.supervisor_changed);
  const isBlocked = isOwn && reviewStatus === "blocked";
  const isReleasedRestricted = isOwn && reviewStatus === "released" && supervisorChanged;
  const isSupervisorTouched = isOwn && supervisorChanged;

  const canDelete = isSupervisorViewer ? true : (!isOwn ? false : !supervisorChanged);
  const deleteDisabled = isBlocked || !canDelete;
  const relativeTime = formatRelativeTimeHelper(meta?.updatedAt);
  const hasPreviewItems = Boolean(meta?.previewItems?.length);
  const subtitle = cleanSubtitleHelper(meta?.title, meta?.subtitle);

  let statusLabel = null;
  let statusBadgeClass = "";
  if (isBlocked) {
    statusLabel = "En revisión";
    statusBadgeClass = "border-amber-400/60 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-100";
  } else if (isReleasedRestricted) {
    statusLabel = "Liberado";
    statusBadgeClass = "border-violet-400/50 bg-violet-50 text-violet-900 dark:border-violet-500/35 dark:bg-violet-500/10 dark:text-violet-100";
  } else if (isSupervisorTouched) {
    statusLabel = "Revisado";
    statusBadgeClass = "border-sky-400/50 bg-sky-50 text-sky-900 dark:border-sky-500/35 dark:bg-sky-500/10 dark:text-sky-100";
  } else if (isActive) {
    statusLabel = "Activo";
    statusBadgeClass = "border-primary/50 bg-primary/10 text-primary";
  }

  const handleOpen = (event) => {
    event?.stopPropagation?.();
    if (isBlocked) return;
    onOpen?.();
  };

  const previewItemsShort = hasPreviewItems
    ? meta.previewItems.slice(0, 2).join(" · ") +
      (meta.previewItems.length > 2 ? ` · +${meta.previewItems.length - 2}` : "")
    : null;

  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition select-none ${
        isBlocked
          ? "opacity-55 saturate-50 pointer-events-none border-amber-300/70 dark:border-amber-500/40"
          : isReleasedRestricted
            ? "border-violet-300/60 dark:border-violet-500/35"
            : isActive
              ? "border-primary shadow-md ring-1 ring-primary/30"
              : isOwn
                ? "border-border"
                : "border-dashed border-amber-400/60 dark:border-amber-500/40"
      }`}
      title={
        isBlocked
          ? "En revisión por supervisión"
          : !isOwn && meta?.sellerName
            ? `Borrador de ${meta.sellerName}`
            : undefined
      }
    >
      <div
        role="button"
        tabIndex={isBlocked ? -1 : 0}
        className="block p-3 space-y-2 cursor-pointer focus:outline-none"
        onClick={handleOpen}
        onKeyDown={(e) => {
          if (isBlocked) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen?.();
          }
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold line-clamp-2 leading-tight">
              {meta?.title || "Sin cliente"}
            </p>
            {subtitle ? (
              <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>
            ) : null}
          </div>
          <p className="shrink-0 text-[11px] text-muted-foreground">
            {meta?.itemsCount ?? 0} ítems
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {statusLabel ? (
            <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${statusBadgeClass}`}>
              {statusLabel}
            </span>
          ) : null}
          {meta?.currency ? (
            <span className="inline-flex items-center rounded-md bg-secondary text-secondary-foreground px-2 py-0.5 text-xs font-medium">
              {meta.currency}
            </span>
          ) : null}
          {!isOwn && meta?.sellerName ? (
            <span
              className="inline-flex max-w-[9rem] items-center gap-1 rounded-md border border-muted-foreground/25 bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground"
              title={meta.sellerName}
            >
              <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="truncate">{meta.sellerName}</span>
            </span>
          ) : null}
          {relativeTime ? (
            <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-normal text-muted-foreground">
              <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {relativeTime}
            </span>
          ) : null}
        </div>

        {isBlocked && review?.blocked_by_name ? (
          <p className="text-[11px] text-amber-800 dark:text-amber-300">
            Revisado por {review.blocked_by_name}
          </p>
        ) : null}

        {previewItemsShort ? (
          <p className="text-[11px] text-muted-foreground line-clamp-2">{previewItemsShort}</p>
        ) : (
          <p className="text-[11px] italic text-muted-foreground/80">{emptyProductsLabel}</p>
        )}

        {meta?.previewVehicle ? (
          <p className="text-[11px] text-muted-foreground truncate" title={meta.previewVehicle}>
            {meta.previewVehicle}
          </p>
        ) : null}

        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-md border border-dashed border-border/70 bg-muted/20 px-2 py-1.5">
          <p className="text-xs font-semibold inline-flex items-baseline gap-1">
            <span className="text-muted-foreground font-medium">Total</span>
            <span className="font-mono font-bold text-foreground">
              {formatCurrency(meta?.total || 0, meta?.currency || "NIO")}
            </span>
          </p>
          {meta?.totalDiscounts > 0 ? (
            <p className="text-[11px] text-green-700 dark:text-green-400 inline-flex items-baseline gap-1">
              <span>−</span>
              <span className="font-mono">
                {formatCurrency(meta.totalDiscounts, meta?.currency || "NIO")}
              </span>
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 mt-1">
          <button
            type="button"
            className={`inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-medium text-white transition-colors ${
              isBlocked ? "bg-slate-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"
            }`}
            disabled={isBlocked}
            title={isBlocked ? "Borrador en revisión por supervisión" : resolvedOpenLabel}
            onClick={handleOpen}
          >
            {resolvedOpenLabel}
          </button>
          <button
            type="button"
            className={`inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-medium text-destructive-foreground transition-colors ${
              deleteDisabled
                ? "bg-rose-300 dark:bg-rose-950/40 text-rose-500 cursor-not-allowed"
                : "bg-destructive hover:bg-destructive/90 text-white"
            }`}
            disabled={deleteDisabled}
            title={
              !canDelete
                ? "No puedes eliminar un borrador revisado por supervisión"
                : isBlocked
                  ? "Borrador en revisión por supervisión"
                  : "Eliminar borrador"
            }
            onClick={(e) => {
              e.stopPropagation();
              if (deleteDisabled) return;
              onDelete?.();
            }}
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

export function SalesPage() {
  const navigate = useNavigate();
  const { hasPermission, user } = useAuth();
  const { getMessage: getDialogMessage } = useDialogMessages();
  const canViewSales = hasPermission("sales", "view");
  const canCreateSales = hasPermission("sales", "create");
  const canEditSales = hasPermission("sales", "edit");
  const canCreateCustomers = hasPermission("customers", "create");
  const isBillingApprover = ["gerencia", "recursos_humanos"].includes(String(user?.role || "").toLowerCase());
  const canEditPaymentPlan = ["gerencia", "supervisor"].includes(String(user?.role || "").toLowerCase());
  const canSeeAdvancedFilters = ["gerencia", "recursos_humanos", "jefe_vendedores", "jefe_tienda"].includes(String(user?.role || "").toLowerCase());
  const canUseCashier = canAccessCashier(user?.role);
  const isSellerOnly = isSellerRole(user?.role);
  const canReprintVoucher = canReprintSellerVoucher(user?.role);
  const DRAFT_LIST_KEY_BASE = "draft_sale_tabs_v1";
  const DRAFT_ACTIVE_KEY_BASE = "draft_sale_active_v1";
  const DRAFT_KEY_PREFIX_BASE = "draft_sale_v1_";
  const LEGACY_DRAFT_LIST_KEY = "draft_sale_tabs_v1";
  const LEGACY_DRAFT_ACTIVE_KEY = "draft_sale_active_v1";
  const LEGACY_DRAFT_PREFIX = "draft_sale_v1_sale_";
  const DRAFT_FLOW = "sale";
  const EMBEDDED_FORM_VISIBILITY_KEY_PREFIX = "sales_embedded_form_visible_v1";
  const userDraftScopeToken = useMemo(() => {
    const raw = user?.user_id || user?.pin_user_id || user?.username || "anon";
    return String(raw).replace(/[^a-zA-Z0-9_-]/g, "_");
  }, [user?.pin_user_id, user?.user_id, user?.username]);
  const DRAFT_LIST_KEY = useMemo(
    () => `${DRAFT_LIST_KEY_BASE}_${userDraftScopeToken}`,
    [DRAFT_LIST_KEY_BASE, userDraftScopeToken]
  );
  const DRAFT_ACTIVE_KEY = useMemo(
    () => `${DRAFT_ACTIVE_KEY_BASE}_${userDraftScopeToken}`,
    [DRAFT_ACTIVE_KEY_BASE, userDraftScopeToken]
  );
  const DRAFT_KEY_PREFIX = useMemo(
    () => `${DRAFT_KEY_PREFIX_BASE}${userDraftScopeToken}_`,
    [DRAFT_KEY_PREFIX_BASE, userDraftScopeToken]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!userDraftScopeToken || userDraftScopeToken === "anon") return;

    try {
      window.localStorage.removeItem(LEGACY_DRAFT_LIST_KEY);
      window.localStorage.removeItem(LEGACY_DRAFT_ACTIVE_KEY);

      const keysToRemove = [];
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (!key) continue;
        if (key.startsWith(LEGACY_DRAFT_PREFIX)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach((key) => window.localStorage.removeItem(key));
    } catch (error) {
      // ignore storage access issues to keep sales UI available
    }
  }, [LEGACY_DRAFT_ACTIVE_KEY, LEGACY_DRAFT_LIST_KEY, LEGACY_DRAFT_PREFIX, userDraftScopeToken]);
  const [sales, setSales] = useState([]);
  const [openCashierInvoices, setOpenCashierInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [crossBranchInventory, setCrossBranchInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshingData, setIsRefreshingData] = useState(false);
  const [search, setSearch] = useState("");
  const [paymentPlanDialogSale, setPaymentPlanDialogSale] = useState(null);
  const [paymentPlanDialogOpen, setPaymentPlanDialogOpen] = useState(false);
  const [auditDialogSale, setAuditDialogSale] = useState(null);
  const [auditDialogOpen, setAuditDialogOpen] = useState(false);
  const [filterPayment, setFilterPayment] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showNewSale, setShowNewSale] = useState(true);
  const [saleFormRenderNonce, setSaleFormRenderNonce] = useState(0);
  const [saveFlash, setSaveFlash] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [draftTabs, setDraftTabs] = useState([]);
  const [activeDraftId, setActiveDraftId] = useState(null);
  const [draftsLoaded, setDraftsLoaded] = useState(false);
  const [draftContentRevision, setDraftContentRevision] = useState(0);
  const [showArchivedSales, setShowArchivedSales] = useState(false);
  const [draftSaveState, setDraftSaveState] = useState("idle");
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const deliveryNotifSinceRef = useRef(null);
  const seenDeliveryNotifIdsRef = useRef(new Set());
  
  // Search states
  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  
  // New sale form
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [cartItems, setCartItems] = useState([]);
  const [paymentType, setPaymentType] = useState("cash");
  const [mixedPaymentMethods, setMixedPaymentMethods] = useState([]);
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [creditDays] = useState(30);
  const [deliveryRequired] = useState(false);
  const [deliveryAddress] = useState("");
  const [notes, setNotes] = useState("");
  
  // IVA and currency
  const [applyIVA, setApplyIVA] = useState(false);
  const [applyRetention, setApplyRetention] = useState(false);
  const [retentionRate, setRetentionRate] = useState(2);
  
  const [ivaRate, setIvaRate] = useState(DEFAULT_IVA_RATE);
  const [currency, setCurrency] = useState("NIO");
  const [exchangeRate, setExchangeRate] = useState(DEFAULT_USD_NIO_SELL_RATE);
  const [buyExchangeRate, setBuyExchangeRate] = useState(DEFAULT_USD_NIO_BUY_RATE);
  const [effectiveIvaRate, setEffectiveIvaRate] = useState(DEFAULT_IVA_RATE);
  
  // Discount codes
  const [discountCode, setDiscountCode] = useState("");
  const [appliedDiscounts, setAppliedDiscounts] = useState([]);
  
  // Manager authorization states
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [authProducts, setAuthProducts] = useState([]);
  const [managerAuthCode, setManagerAuthCode] = useState("");
  
  // Transfer dialog
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [transferProduct, setTransferProduct] = useState(null);
  const [transferFromWarehouse, setTransferFromWarehouse] = useState("");
  
  // Compatibility warnings
  const [compatibilityWarnings, setCompatibilityWarnings] = useState([]);
  
  // New customer dialog
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerTab, setNewCustomerTab] = useState("customer");
  const [newCustomer, setNewCustomer] = useState({
    // Customer fields
    first_name: "",
    last_name: "",
    customer_type: "natural",
    tax_id: "",
    email: "",
    phone_prefix: "+505",
    phone: "",
    address: "",
    credit_limit: 0,
    // Vehicle fields
    add_vehicle: false,
    plate_prefix: "M",
    plate_number: "",
    brand: "",
    model: "",
    year: "",
    color: "",
    chasis: "",
  });
  
  // Additional filters
  const [filterSeller, setFilterSeller] = useState("all");
  const [filterBranch, setFilterBranch] = useState("all");
  const [sellers, setSellers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [showPrintPrompt, setShowPrintPrompt] = useState(false);
  const [showClearSaleConfirm, setShowClearSaleConfirm] = useState(false);
  const [printSaleData, setPrintSaleData] = useState(null);
  const [boardTab, setBoardTab] = useState("drafts");
  const draftTabsRef = useRef([]);
  const activeDraftIdRef = useRef(null);
  const suppressAutoDraftRef = useRef(false);
  const draftSyncTimersRef = useRef(new Map());
  const supervisorWatchingDraftRef = useRef(null);
  const saleFormAnchorRef = useRef(null);

  const markDraftSaving = useCallback(() => {
    setDraftSaveState("saving");
    emitAutosaveStatus(AUTOSAVE_STATUS.SAVING, { source: "sales" });
  }, []);

  const markDraftSaved = useCallback(() => {
    setDraftSaveState("saved");
    setDraftSavedAt(new Date());
    emitAutosaveStatus(AUTOSAVE_STATUS.SYNCED, { source: "sales" });
  }, []);

  const markDraftSaveError = useCallback(() => {
    setDraftSaveState("error");
    emitAutosaveStatus(AUTOSAVE_STATUS.DISCONNECTED, { source: "sales" });
  }, []);
  const formVisibilityStorageKey = useMemo(() => {
    const userToken = user?.user_id || user?.pin_user_id || "anon";
    return `${EMBEDDED_FORM_VISIBILITY_KEY_PREFIX}_${userToken}`;
  }, [EMBEDDED_FORM_VISIBILITY_KEY_PREFIX, user?.pin_user_id, user?.user_id]);
  const newCustomerYearOptions = useMemo(
    () => getVehicleYearsByBrand(newCustomer.brand),
    [newCustomer.brand]
  );
  const newCustomerModelOptions = useMemo(
    () => getVehicleSelectOptionsByBrandYear(newCustomer.brand, newCustomer.year),
    [newCustomer.brand, newCustomer.year]
  );

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    emitAutosaveStatus(AUTOSAVE_STATUS.SYNCED, { source: "sales" });
    return () => {
      emitAutosaveStatus(AUTOSAVE_STATUS.SYNCED, { source: "sales" });
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const refreshRate = async () => {
      const [rates, iva] = await Promise.all([
        fetchUsdNioDualRates({
          withCredentials: true,
          fallbackBuy: DEFAULT_USD_NIO_BUY_RATE,
          fallbackSell: DEFAULT_USD_NIO_SELL_RATE,
        }),
        fetchEffectiveIvaRate({ withCredentials: true, fallback: DEFAULT_IVA_RATE }),
      ]);
      if (mounted) {
        setExchangeRate(rates.sellRate);
        setBuyExchangeRate(rates.buyRate);
        setEffectiveIvaRate(iva);
        setIvaRate(iva);
      }
    };

    refreshRate();
    const intervalId = window.setInterval(refreshRate, 30000);
    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
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
        emitAutosaveStatus(AUTOSAVE_STATUS.RECOVERING, { source: "sales" });
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
        emitAutosaveStatus(AUTOSAVE_STATUS.SYNCED, { source: "sales" });
      } catch (error) {
        if (cancelled) return;
        const fallback = getUsableLocalDraftState();
        setDraftTabs(fallback.draftTabs);
        setActiveDraftId(fallback.activeDraftId);
        emitAutosaveStatus(AUTOSAVE_STATUS.DISCONNECTED, { source: "sales" });
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
  }, [DRAFT_ACTIVE_KEY, DRAFT_FLOW, DRAFT_KEY_PREFIX, DRAFT_LIST_KEY, userDraftScopeToken]);

  const handleServerSnapshotChanged = useCallback((draftId) => {
    setDraftContentRevision((prev) => prev + 1);
    if (draftId === activeDraftId) {
      setSaleFormRenderNonce((prev) => prev + 1);
    }
  }, [activeDraftId]);

  useDraftReviewPolling({
    flow: DRAFT_FLOW,
    user,
    draftsLoaded,
    activeDraftId,
    showForm: showNewSale,
    setDraftTabs,
    setShowForm: setShowNewSale,
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
  const sellerSaleParamsLocked = isDraftReleasedWithRestrictions(activeDraftReview)
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
    if (!showNewSale && supervisorWatchingDraftRef.current) {
      stopSupervisorWatch(supervisorWatchingDraftRef.current);
    }
  }, [showNewSale, stopSupervisorWatch]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!draftsLoaded) return;
    if (typeof window === "undefined") return;
    window.localStorage.setItem(DRAFT_LIST_KEY, JSON.stringify(draftTabs));
  }, [DRAFT_LIST_KEY, draftTabs, draftsLoaded]);

  useEffect(() => {
    if (!draftsLoaded) return;
    if (typeof window === "undefined") return;
    if (activeDraftId) {
      window.localStorage.setItem(DRAFT_ACTIVE_KEY, activeDraftId);
    } else {
      window.localStorage.removeItem(DRAFT_ACTIVE_KEY);
    }
  }, [DRAFT_ACTIVE_KEY, activeDraftId, draftsLoaded]);

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
      // keep local state if server sync fails
    });
  }, [DRAFT_FLOW, activeDraftId, draftsLoaded]);

  // Keep SalesPage state in sync when switching between server-restored drafts.
  useEffect(() => {
    if (!activeDraftId || typeof window === "undefined") return;

    try {
      const draft = readDraft(activeDraftId);
      if (!draft || isDraftSnapshotEmpty(draft)) {
        setSelectedCustomer(null);
        setSelectedVehicle("");
        setSelectedWarehouse("");
        setCartItems([]);
        setPaymentType("cash");
        setGlobalDiscount(0);
        setNotes("");
        setApplyIVA(false);
        setApplyRetention(false);
        setRetentionRate(2);
        setCurrency("NIO");
        setAppliedDiscounts([]);
        return;
      }

      const customerId = draft.selectedCustomerId;
      let restoredCustomer = null;
      if (customerId) {
        restoredCustomer = customers.find(
          (c) => String(c.customer_id ?? "") === String(customerId)
        ) || null;
        if (restoredCustomer) {
          setSelectedCustomer(restoredCustomer);
        }
      } else {
        setSelectedCustomer(null);
      }

      setSelectedVehicle(draft.selectedVehicle || "");
      setSelectedWarehouse(draft.selectedWarehouse || "");
      setCartItems(draft.cartItems || []);
      setPaymentType(draft.paymentMethod || draft.payment_type || "cash");
      setGlobalDiscount(draft.globalDiscount || 0);
      setNotes(draft.notes || "");
      setApplyIVA(draft.applyIVA ?? defaultApplyIvaForCustomer(restoredCustomer));
      setApplyRetention(draft.applyRetention ?? false);
      setRetentionRate(draft.retentionRate ?? 2);
      setCurrency(draft.currency || "NIO");
      setAppliedDiscounts(draft.appliedDiscounts || []);
    } catch (error) {
      // keep current state if draft parsing fails
    }
  }, [activeDraftId, customers, draftContentRevision]);

  useEffect(() => {
    if (typeof window === "undefined" || !user) return;
    const stored = window.localStorage.getItem(formVisibilityStorageKey);
    if (stored === null) {
      setShowNewSale(true);
      return;
    }
    setShowNewSale(stored === "1");
  }, [formVisibilityStorageKey, user]);

  useEffect(() => {
    if (typeof window === "undefined" || !user) return;
    window.localStorage.setItem(formVisibilityStorageKey, showNewSale ? "1" : "0");
  }, [formVisibilityStorageKey, showNewSale, user]);

  const fetchData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const [salesRes, customersRes, productsRes, warehousesRes, vehiclesRes, inventoryRes, crossBranchRes, usersRes, branchesRes, cashierRes] = await Promise.all([
        axios.get(`${API}/sales`, { withCredentials: true }).catch(() => ({ data: [] })),
        axios.get(`${API}/customers`, { withCredentials: true }).catch(() => ({ data: [] })),
        axios.get(`${API}/products`, { withCredentials: true }).catch(() => ({ data: [] })),
        axios.get(`${API}/warehouses`, { withCredentials: true }).catch(() => ({ data: [] })),
        axios.get(`${API}/vehicles`, { withCredentials: true }).catch(() => ({ data: [] })),
        axios.get(`${API}/inventory`, { withCredentials: true }).catch(() => ({ data: [] })),
        axios.get(`${API}/inventory/other-branches`, { withCredentials: true }).catch(() => ({ data: { items: [] } })),
        axios.get(`${API}/users`, { withCredentials: true }).catch(() => ({ data: [] })),
        axios.get(`${API}/branches`, { withCredentials: true }).catch(() => ({ data: [] })),
        canUseCashier
          ? axios.get(`${API}/caja/facturas`, {
              withCredentials: true,
              params: {
                tab: "cotizacion",
                branch_id: user?.branch_id || undefined,
                limit: 200,
              },
            }).catch(() => ({ data: { rows: [] } }))
          : Promise.resolve({ data: { rows: [] } }),
      ]);
      setSales(Array.isArray(salesRes?.data) ? salesRes.data : (Array.isArray(salesRes?.data?.sales) ? salesRes.data.sales : []));
      setOpenCashierInvoices(Array.isArray(cashierRes?.data?.rows) ? cashierRes.data.rows : []);
      setCustomers(Array.isArray(customersRes?.data) ? customersRes.data : (Array.isArray(customersRes?.data?.customers) ? customersRes.data.customers : []));
      setProducts(Array.isArray(productsRes?.data) ? productsRes.data : (Array.isArray(productsRes?.data?.products) ? productsRes.data.products : []));
      const warehousesList = Array.isArray(warehousesRes?.data) ? warehousesRes.data : (Array.isArray(warehousesRes?.data?.warehouses) ? warehousesRes.data.warehouses : []);
      setWarehouses(warehousesList);
      setVehicles(Array.isArray(vehiclesRes?.data) ? vehiclesRes.data : (Array.isArray(vehiclesRes?.data?.vehicles) ? vehiclesRes.data.vehicles : []));
      setInventory(Array.isArray(inventoryRes?.data) ? inventoryRes.data : (Array.isArray(inventoryRes?.data?.inventory) ? inventoryRes.data.inventory : []));
      setCrossBranchInventory(Array.isArray(crossBranchRes?.data?.items) ? crossBranchRes.data.items : []);
      const rawUsers = Array.isArray(usersRes?.data) ? usersRes.data : (Array.isArray(usersRes?.data?.users) ? usersRes.data.users : []);
      setSellers(rawUsers.filter(u => u && (u.role === "ventas" || u.role === "gerencia")));
      setBranches(Array.isArray(branchesRes?.data) ? branchesRes.data : (Array.isArray(branchesRes?.data?.branches) ? branchesRes.data.branches : []));
      if (warehousesList.length > 0) {
        setSelectedWarehouse((currentWarehouseId) => {
          if (currentWarehouseId && warehousesList.some((warehouse) => warehouse?.warehouse_id === currentWarehouseId)) {
            return currentWarehouseId;
          }
          return warehousesList[0].warehouse_id;
        });
      }
    } catch (error) {
      toast.error("Error al cargar datos");
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [user?.branch_id]);

  const openDeliveryProofWhatsApp = useCallback((payload) => {
    const url = buildCustomerProofWhatsAppUrl({
      proofImageId: payload?.proof_image_id,
      proofUrl: payload?.proof_url,
      customerName: payload?.customer_name,
    });
    if (!url) {
      toast.error("No hay evidencia de entrega disponible");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  useEffect(() => {
    if (!user?.user_id) return undefined;
    const sellerRoles = ["ventas", "cajero", "jefe_vendedores", "jefe_tienda", "gerencia", "supervisor"];
    if (!sellerRoles.includes(String(user.role || "").toLowerCase())) return undefined;

    const pollDeliveryNotifications = async () => {
      try {
        const since = deliveryNotifSinceRef.current
          || new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const response = await axios.get(`${API}/hr/drivers/seller-notifications/live`, {
          withCredentials: true,
          params: { since },
        });
        const rows = Array.isArray(response.data?.notifications) ? response.data.notifications : [];
        if (!rows.length) return;

        rows.slice().reverse().forEach((item) => {
          if (!item?.notification_id || seenDeliveryNotifIdsRef.current.has(item.notification_id)) return;
          seenDeliveryNotifIdsRef.current.add(item.notification_id);
          toast.success(item.message, {
            duration: 12000,
            className: "border-emerald-500 bg-emerald-50 text-emerald-900",
            action: item.proof_url || item.proof_image_id ? {
              label: "Compartir evidencia",
              onClick: () => openDeliveryProofWhatsApp(item),
            } : undefined,
          });
        });

        deliveryNotifSinceRef.current = rows[0]?.created_at || since;
        fetchData({ silent: true });
      } catch {
        // polling silencioso
      }
    };

    pollDeliveryNotifications();
    const timer = window.setInterval(pollDeliveryNotifications, 4000);
    return () => window.clearInterval(timer);
  }, [user?.user_id, user?.role, fetchData, openDeliveryProofWhatsApp]);

  const handleRefreshData = useCallback(async () => {
    setIsRefreshingData(true);
    try {
      await fetchData({ silent: true });
    } finally {
      setIsRefreshingData(false);
    }
  }, [fetchData]);

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
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const snapshot = parsed?.snapshot && typeof parsed.snapshot === "object" ? parsed.snapshot : parsed;
      if (!snapshot || typeof snapshot !== "object") return null;

      const normalized = {
        ...snapshot,
        selectedCustomerId:
          snapshot.selectedCustomerId
          ?? snapshot.selected_customer_id
          ?? snapshot.customer_id
          ?? null,
        selectedVehicle:
          snapshot.selectedVehicle
          ?? snapshot.selected_vehicle
          ?? snapshot.vehicle_id
          ?? "",
        cartItems: Array.isArray(snapshot.cartItems)
          ? snapshot.cartItems
          : (Array.isArray(snapshot.cart_items)
            ? snapshot.cart_items
            : (Array.isArray(snapshot.items) ? snapshot.items : [])),
        globalDiscount:
          snapshot.globalDiscount
          ?? snapshot.global_discount
          ?? snapshot.discount
          ?? 0,
        appliedDiscounts: Array.isArray(snapshot.appliedDiscounts)
          ? snapshot.appliedDiscounts
          : (Array.isArray(snapshot.applied_discounts) ? snapshot.applied_discounts : []),
        applyIVA:
          snapshot.applyIVA
          ?? snapshot.apply_iva
          ?? true,
        applyRetention:
          snapshot.applyRetention
          ?? snapshot.apply_retention
          ?? false,
        retentionRate: (() => {
          const rawRate = snapshot.retentionRate ?? snapshot.retention_rate ?? snapshot.retentionRateHint ?? snapshot.retention_rate_hint;
          if (rawRate === 0.01 || rawRate === 0.02) return rawRate * 100;
          if (rawRate === 1 || rawRate === 2) return rawRate;
          return 2;
        })(),
        currency: snapshot.currency || "NIO",
      };
      return normalized;
    } catch (error) {
      return null;
    }
  };

  const computeDraftTotals = (draft) => {
    const customer = customers.find(
      (entry) => String(entry.customer_id ?? "") === String(draft?.selectedCustomerId ?? "")
    ) || null;
    return computeDraftSnapshotTotals(draft, {
      exchangeRate,
      ivaRate: effectiveIvaRate,
      customer,
    });
  };

  const computeDraftTotal = (draft) => {
    return computeDraftTotals(draft).total;
  };

  const getDraftLabel = (tab) => {
    const draft = readDraft(tab.id);
    if (!draft) return tab.name;
    const customerName = customers.find((c) => String(c.customer_id ?? "") === String(draft.selectedCustomerId ?? ""))?.name;
    const total = computeDraftTotal(draft);
    const currencyDraft = draft.currency || "NIO";
    const name = customerName || "Sin cliente";
    return `${name} • ${formatCurrency(total || 0, currencyDraft)}`;
  };

  const getVehicleLabel = (vehicleId) => {
    if (!vehicleId) return null;
    const normalizedVehicleId = String(vehicleId);
    const vehicle = vehicles.find((v) => String(v.vehicle_id ?? v.id ?? "") === normalizedVehicleId);
    if (!vehicle) return null;
    const parts = [vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(" ");
    const plate = vehicle.plate || vehicle.plate_number || vehicle.number_plate || vehicle.registration || null;
    const color = vehicle.color || vehicle.vehicle_color || vehicle.colour || null;
    const pieces = [];
    if (parts) pieces.push(parts);
    if (plate) pieces.push(plate);
    if (color) pieces.push(color);
    return pieces.length ? pieces.join(" • ") : null;
  };

  const getVehicleById = (vehicleId) => {
    if (!vehicleId) return null;
    const normalizedVehicleId = String(vehicleId);
    return vehicles.find((v) => String(v.vehicle_id ?? v.id ?? "") === normalizedVehicleId) || null;
  };

  const getSaleItemsPreview = (sale) => {
    const items = Array.isArray(sale?.items) ? sale.items : [];
    if (items.length === 0) return "Sin artículos";
    const names = items.slice(0, 3).map((item) => item.product_name || "Producto");
    return items.length > 3 ? `${names.join(" · ")} · +${items.length - 3}` : names.join(" · ");
  };

  const getDraftPreview = (draft) => {
    if (!draft) return { image: null, items: [], vehicle: null, previewVehicle: null };
    const items = Array.isArray(draft.cartItems) ? draft.cartItems : [];
    const rawSelected = draft.selectedVehicle;
    // selectedVehicle may be id string or embedded vehicle object from older drafts
    let vehicle =
      rawSelected && typeof rawSelected === "object"
        ? rawSelected
        : getVehicleById(rawSelected);
    if (!vehicle && draft.vehicle && typeof draft.vehicle === "object") {
      vehicle = draft.vehicle;
    }
    // Identity-only payload: brand/model drive silhouette (avoid stale hatchback presets)
    const previewVehicle = vehicle
      ? {
          brand: vehicle.brand,
          model: vehicle.model,
          year: vehicle.year,
          descriptor: vehicle.descriptor,
          vehicle_cab_variant: vehicle.vehicle_cab_variant,
        }
      : null;
    const image = getVehicleThumbnail(previewVehicle);
    const previewNames = items.slice(0, 2).map((item) => item.product_name || "Producto");
    if (items.length > 2) {
      previewNames.push(`+${items.length - 2}`);
    }
    const vehicleLabel =
      getVehicleLabel(typeof rawSelected === "object" ? rawSelected?.vehicle_id || rawSelected?.id : rawSelected) ||
      (previewVehicle
        ? [previewVehicle.brand, previewVehicle.model, previewVehicle.year].filter(Boolean).join(" ")
        : null);
    return {
      image,
      previewVehicle,
      items: previewNames,
      vehicle: vehicleLabel,
    };
  };

  const getDraftMeta = (tab) => {
    const draft = readDraft(tab.id);
    const preview = getDraftPreview(draft);
    const customerName = customers.find((c) => String(c.customer_id ?? "") === String(draft?.selectedCustomerId ?? ""))?.name;
    const totals = computeDraftTotals(draft);
    const currencyDraft = draft?.currency || "NIO";
    const itemsCount = Array.isArray(draft?.cartItems) ? draft.cartItems.length : 0;
    const updatedAt = draft?.updatedAt || tab.updatedAt;
    // Avoid redundant "Venta - CustomerName" when title is already the customer
    const rawSubtitle = String(tab.name || "").trim();
    const title = customerName || "Sin cliente";
    const subtitleLooksRedundant =
      !rawSubtitle ||
      rawSubtitle === title ||
      rawSubtitle.replace(/^(venta|cotizaci[oó]n)\s*[-–—:]\s*/i, "").trim() === title;
    return {
      title,
      subtitle: subtitleLooksRedundant ? null : rawSubtitle,
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

  const getDraftKey = (draftId) => `${DRAFT_KEY_PREFIX}${draftId}`;

  const isDraftSnapshotEmpty = (draft) => !isSaleDraftSaveEligible(draft);

  const visibleDraftTabs = useMemo(() => (
    (Array.isArray(draftTabs) ? draftTabs : []).filter((tab) => isSaleDraftSaveEligible(readDraft(tab.id)))
  ), [draftTabs, draftContentRevision]);

  const createEmptyDraftSnapshot = () => ({ updatedAt: new Date().toISOString() });

  const syncDraftToServer = useCallback(async (draftId, snapshotOverride = undefined, nameOverride = undefined) => {
    if (!draftId) return;
    setDraftSaveState("saving");
    emitAutosaveStatus(AUTOSAVE_STATUS.SYNCING, { source: "sales" });
    const tab = draftTabsRef.current.find((entry) => entry.id === draftId);
    const snapshot = snapshotOverride === undefined ? readDraft(draftId) || {} : (snapshotOverride || {});
    if (!isSaleDraftSaveEligible(snapshot)) {
      markDraftSaved();
      return;
    }
    try {
      const saved = await saveServerDraft(DRAFT_FLOW, draftId, {
        name: nameOverride || tab?.name || `Venta ${draftTabsRef.current.length || 1}`,
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
        setShowNewSale(false);
      }
      markDraftSaveError();
      throw error;
    }
  }, [DRAFT_FLOW, markDraftSaved, markDraftSaveError, markDraftSaving]);

  const cancelScheduledDraftSync = useCallback((draftId) => {
    if (!draftId || typeof window === "undefined") return;
    const existingTimer = draftSyncTimersRef.current.get(draftId);
    if (existingTimer) {
      window.clearTimeout(existingTimer);
      draftSyncTimersRef.current.delete(draftId);
    }
  }, []);

  const scheduleDraftSync = useCallback((draftId, snapshotOverride = undefined, nameOverride = undefined) => {
    if (!draftId || typeof window === "undefined") return;
    const existingTimer = draftSyncTimersRef.current.get(draftId);
    if (existingTimer) {
      window.clearTimeout(existingTimer);
    }
    const timerId = window.setTimeout(() => {
      syncDraftToServer(draftId, snapshotOverride, nameOverride).catch(() => {
        // preserve local draft state if server sync fails
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
      const customerName = customers.find((c) => String(c.customer_id ?? "") === String(draft?.selectedCustomerId ?? ""))?.name;
      let nextName = null;
      setDraftTabs(prev => prev.map(tab => {
        if (tab.id !== draftId) return tab;
        nextName = customerName ? `Venta - ${customerName}` : tab.name;
        return { ...tab, name: nextName, updatedAt: draft?.updatedAt || tab.updatedAt };
      }));
      scheduleDraftSync(draftId, draft, nextName || undefined);
    } catch (error) {
      // ignore
    }
  };

  const createDraftTab = useCallback(() => {
    if (!canCreateSales) {
      toast.error("No tienes permiso para crear ventas");
      return;
    }
    const id = `sale_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const name = `Venta ${draftTabs.length + 1}`;
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
    setShowNewSale(true);
    setSaleFormRenderNonce((prev) => prev + 1);
  }, [canCreateSales, draftTabs.length, user?.name, user?.user_id]);

  const handleSaveAndClearSale = useCallback(async () => {
    if (!canCreateSales) {
      toast.error("No tienes permiso para crear ventas");
      return;
    }
    playSelectionFeedbackSound();

    if (activeDraftId && typeof window !== "undefined") {
      try {
        const draftKey = getDraftKey(activeDraftId);
        const raw = window.localStorage.getItem(draftKey);
        if (raw) {
          const snapshot = {
            ...JSON.parse(raw),
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
    resetSaleForm({ keepVisible: true, skipAutoDraft: true });
    toast.success("Borrador guardado. Formulario listo para nueva venta.");
  }, [DRAFT_FLOW, activeDraftId, activeDraftTab, canCreateSales, createDraftTab, syncDraftToServer, user?.role, user?.user_id]);

  useEffect(() => {
    if (!draftsLoaded || !showNewSale || !canCreateSales) return;
    if (suppressAutoDraftRef.current) return;
    if (activeDraftId) return;
    createDraftTab();
  }, [activeDraftId, canCreateSales, createDraftTab, draftsLoaded, showNewSale]);

  const openCatalogFromSaleForm = useCallback(async (snapshot) => {
    if (!canCreateSales) {
      toast.error("No tienes permiso para crear ventas");
      return;
    }
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
      exchangeRate: snapshot?.exchangeRate || exchangeRate,
      appliedDiscounts: Array.isArray(snapshot?.appliedDiscounts) ? snapshot.appliedDiscounts : [],
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
      draftId = `sale_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      const draftName = `Venta - ${customers.find((c) => String(c.customer_id ?? "") === String(safeSnapshot.selectedCustomerId ?? ""))?.name || "Sin cliente"}`;
      nextTabs.push({ id: draftId, name: draftName, updatedAt: nowIso });
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
      source: "sale-form",
      returnPath: window.location.pathname || "/sales",
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
    window.localStorage.setItem("catalog_open_draft", "sale");
    window.location.href = "/catalog";
  }, [
    DRAFT_ACTIVE_KEY,
    DRAFT_FLOW,
    DRAFT_LIST_KEY,
    activeDraftId,
    canCreateSales,
    customers,
    draftTabs,
    exchangeRate,
    effectiveIvaRate,
    scheduleDraftSync,
    selectedWarehouse,
    vehicles,
  ]);

  const removeDraftFromState = useCallback(async (draftId, { skipServerDelete = false } = {}) => {
    if (!draftId) return;
    cancelScheduledDraftSync(draftId);
    if (supervisorWatchingDraftRef.current === draftId) {
      await stopSupervisorWatch(draftId);
    }
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(getDraftKey(draftId));
    }
    setDraftTabs((prev) => prev.filter((entry) => entry.id !== draftId));
    if (!skipServerDelete) {
      try {
        await deleteServerDraft(DRAFT_FLOW, draftId);
      } catch (error) {
        // backend may have already consumed the draft when the sale was created
      }
    }
  }, [DRAFT_FLOW, stopSupervisorWatch]);

  const beginFreshSaleForm = useCallback(() => {
    suppressAutoDraftRef.current = true;
    setActiveDraftId(null);
    resetSaleForm({ keepVisible: true, skipAutoDraft: true });
    setSaleFormRenderNonce((prev) => prev + 1);
    setDraftContentRevision((prev) => prev + 1);
    createDraftTab();
    window.setTimeout(() => {
      suppressAutoDraftRef.current = false;
    }, 0);
  }, [createDraftTab]);

  const finalizeSaleAfterSubmit = useCallback(async (submittedDraftId) => {
    if (submittedDraftId) {
      await removeDraftFromState(submittedDraftId, { skipServerDelete: true });
    }

    suppressAutoDraftRef.current = true;
    setActiveDraftId(null);
    resetSaleForm({ keepVisible: true, skipAutoDraft: true });
    setSaleFormRenderNonce((prev) => prev + 1);
    setDraftContentRevision((prev) => prev + 1);

    let syncedTabs = [];
    try {
      const bundle = await fetchServerDraftBundle(DRAFT_FLOW);
      const serverDrafts = Array.isArray(bundle?.drafts) ? bundle.drafts : [];
      const eligibleServerDrafts = serverDrafts.filter((draft) => (
        isSaleDraftSaveEligible(draft?.snapshot || {})
        && draft.id !== submittedDraftId
      ));
      syncedTabs = eligibleServerDrafts.map((draft) => ({
        id: draft.id,
        name: draft.name,
        updatedAt: draft.updatedAt,
        ownerUserId: draft.owner_user_id || null,
        ownerName: draft.owner_name || null,
        review: normalizeDraftReview(draft.review),
      }));
      mirrorServerDraftsToLocalStorage({
        listKey: DRAFT_LIST_KEY,
        activeKey: DRAFT_ACTIVE_KEY,
        draftKeyPrefix: DRAFT_KEY_PREFIX,
        drafts: eligibleServerDrafts,
        activeDraftId: null,
        allowEmptyOverwrite: true,
      });
    } catch (error) {
      syncedTabs = draftTabsRef.current.filter((entry) => entry.id !== submittedDraftId);
    }

    const freshId = `sale_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const freshTab = {
      id: freshId,
      name: `Venta ${syncedTabs.length + 1}`,
      updatedAt: new Date().toISOString(),
      ownerUserId: user?.user_id || null,
      ownerName: user?.name || null,
      review: normalizeDraftReview(null),
    };
    const nextTabs = [...syncedTabs, freshTab];
    setDraftTabs(nextTabs);
    setActiveDraftId(freshId);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DRAFT_LIST_KEY, JSON.stringify(nextTabs));
      window.localStorage.setItem(DRAFT_ACTIVE_KEY, freshId);
      window.localStorage.removeItem(getDraftKey(freshId));
    }

    window.setTimeout(() => {
      suppressAutoDraftRef.current = false;
    }, 0);
  }, [
    DRAFT_ACTIVE_KEY,
    DRAFT_FLOW,
    DRAFT_KEY_PREFIX,
    DRAFT_LIST_KEY,
    removeDraftFromState,
    user?.name,
    user?.user_id,
  ]);

  const closeDraftTab = async (draftId, { force = false, createReplacement = false } = {}) => {
    const tab = draftTabsRef.current.find((entry) => entry.id === draftId);
    if (
      !force
      && !canSellerDeleteDraft(tab, tab?.review, user?.user_id, user?.role)
    ) {
      toast.error("No puedes eliminar un borrador revisado por supervisión");
      return false;
    }

    const wasActiveDraft = activeDraftIdRef.current === draftId;
    const shouldResetForm = wasActiveDraft || (force && createReplacement);

    await removeDraftFromState(draftId);

    if (!shouldResetForm) {
      return true;
    }

    const remaining = draftTabsRef.current.filter((entry) => entry.id !== draftId);
    const nextActiveId = remaining[remaining.length - 1]?.id || null;

    if (nextActiveId) {
      setActiveDraftId(nextActiveId);
      setSaleFormRenderNonce((prev) => prev + 1);
      return true;
    }

    if (createReplacement) {
      beginFreshSaleForm();
      return true;
    }

    setActiveDraftId(null);
    resetSaleForm({ keepVisible: true, skipAutoDraft: true });
    setSaleFormRenderNonce((prev) => prev + 1);
    return true;
  };

  const openDraftTab = useCallback(async (tab) => {
    if (!tab?.id) return;
    if (!canSellerOpenDraft(tab, tab.review, user?.user_id, user?.role)) {
      toast.warning("Este borrador está en revisión por supervisión.");
      return;
    }
    if (supervisorWatchingDraftRef.current && supervisorWatchingDraftRef.current !== tab.id) {
      await stopSupervisorWatch(supervisorWatchingDraftRef.current);
    }
    if (!isOwnErpDraft(tab, user?.user_id)) {
      const sellerName = tab.ownerName || null;
      if (sellerName) {
        toast.info(`Revisión silenciosa del borrador de ${sellerName}`);
      }
      await startSupervisorWatch(tab.id);
    }
    setActiveDraftId(tab.id);
    updateDraftTabMeta(tab.id);
    setShowNewSale(true);
    setSaleFormRenderNonce((prev) => prev + 1);
    scrollPageToTop({ anchorRef: saleFormAnchorRef });
  }, [startSupervisorWatch, stopSupervisorWatch, updateDraftTabMeta, user?.role, user?.user_id]);

  const openActiveDraft = useCallback(() => {
    if (!canCreateSales) {
      toast.error("No tienes permiso para crear ventas");
      return;
    }
    if (draftTabs.length === 0) {
      createDraftTab();
      return;
    }
    if (!activeDraftId) {
      setActiveDraftId(draftTabs[0]?.id || null);
    }
    setShowNewSale(true);
  }, [activeDraftId, canCreateSales, createDraftTab, draftTabs]);

  const toggleEmbeddedSaleForm = useCallback(() => {
    if (!canCreateSales) {
      toast.error("No tienes permiso para crear ventas");
      return;
    }
    if (showNewSale) {
      setShowNewSale(false);
      return;
    }
    if (draftTabs.length === 0) {
      createDraftTab();
      return;
    }
    if (!activeDraftId) {
      setActiveDraftId(draftTabs[0]?.id || null);
    }
    setShowNewSale(true);
  }, [activeDraftId, canCreateSales, createDraftTab, draftTabs, showNewSale]);

  const clearEmbeddedSaleForm = useCallback(() => {
    if (!canCreateSales) {
      toast.error("No tienes permiso para crear ventas");
      return;
    }
    let draftIdToClear = activeDraftId;
    if (typeof window !== "undefined" && !draftIdToClear) {
      draftIdToClear = window.localStorage.getItem(DRAFT_ACTIVE_KEY) || null;
    }

    if (typeof window !== "undefined" && draftIdToClear) {
      window.localStorage.removeItem(getDraftKey(draftIdToClear));
    }

    if (draftIdToClear) {
      setDraftTabs((prev) => prev.filter((tab) => tab.id !== draftIdToClear));
      if (activeDraftId === draftIdToClear) {
        setActiveDraftId(null);
      }
      deleteServerDraft(DRAFT_FLOW, draftIdToClear).catch(() => {
        // keep local clear behavior even if remote cleanup fails
      });
    }

    setSaleFormRenderNonce((prev) => prev + 1);
    resetSaleForm({ keepVisible: true, skipAutoDraft: true });
    toast.success("Formulario limpiado");
  }, [DRAFT_ACTIVE_KEY, DRAFT_FLOW, activeDraftId, canCreateSales]);

  useEffect(() => {
    if (!draftsLoaded || typeof window === "undefined") return;
    const flag = window.localStorage.getItem("catalog_open_draft");
    if (flag !== "sale") return;
    openActiveDraft();
    window.localStorage.removeItem("catalog_open_draft");
  }, [draftsLoaded, openActiveDraft]);

  // Filtered customers based on search
  const filteredCustomers = useMemo(() => {
    const list = Array.isArray(customers) ? customers : [];
    if (!customerSearch) return list.slice(0, 10);
    const searchLower = customerSearch.toLowerCase();
    return list.filter(c => 
      c?.name?.toLowerCase().includes(searchLower) ||
      c?.phone?.includes(customerSearch) ||
      c?.tax_id?.includes(customerSearch)
    ).slice(0, 20);
  }, [customers, customerSearch]);

  // Filtered products based on search
  const filteredProducts = useMemo(() => {
    const list = Array.isArray(products) ? products : [];
    if (!productSearch) return list.slice(0, 20);
    const searchLower = productSearch.toLowerCase();
    return list.filter(p => 
      p?.name?.toLowerCase().includes(searchLower) ||
      p?.sku?.toLowerCase().includes(searchLower)
    ).slice(0, 30);
  }, [products, productSearch]);

  // Get vehicles for selected customer
  const customerVehicles = useMemo(() => {
    if (!selectedCustomer) return [];
    const list = Array.isArray(vehicles) ? vehicles : [];
    return list.filter(v => v?.customer_id === selectedCustomer.customer_id);
  }, [vehicles, selectedCustomer]);

  // Get stock for a product in a specific warehouse
  const getProductStock = (productId, warehouseId) => {
    const list = Array.isArray(inventory) ? inventory : [];
    const inv = list.find(i => i?.product_id === productId && i?.warehouse_id === warehouseId);
    return inv?.quantity || 0;
  };

  // Get stock in other warehouses
  const getOtherWarehouseStock = (productId, currentWarehouseId) => {
    const invList = Array.isArray(inventory) ? inventory : [];
    const whList = Array.isArray(warehouses) ? warehouses : [];
    return invList
      .filter(i => i?.product_id === productId && i?.warehouse_id !== currentWarehouseId && i?.quantity > 0)
      .map(i => ({
        warehouse_id: i.warehouse_id,
        warehouse_name: whList.find(w => w?.warehouse_id === i.warehouse_id)?.name || i.warehouse_id,
        quantity: i.quantity
      }));
  };

  // Check product compatibility
  const checkCompatibility = async (product) => {
    if (!selectedVehicle) return { compatible: true };
    
    try {
      const response = await axios.get(
        `${API}/products/${product.product_id}/check-compatibility/${selectedVehicle}`,
        { withCredentials: true }
      );
      return response.data;
    } catch (error) {
      return { compatible: true };
    }
  };

  const addToCart = async (product) => {
    const currentStock = getProductStock(product.product_id, selectedWarehouse);
    
    // Check if stock is available
    if (currentStock <= 0) {
      const otherStock = getOtherWarehouseStock(product.product_id, selectedWarehouse);
      if (otherStock.length > 0) {
        setTransferProduct(product);
        setTransferFromWarehouse(otherStock[0].warehouse_id);
        setShowTransferDialog(true);
        return;
      } else {
        toast.error(`${product.name} no tiene stock disponible`);
        return;
      }
    }

    // Check compatibility if vehicle is selected
    if (selectedVehicle) {
      const compatResult = await checkCompatibility(product);
      if (!compatResult.compatible) {
        setCompatibilityWarnings(prev => {
          const existing = prev.find(w => w.product_id === product.product_id);
          if (existing) return prev;
          return [...prev, {
            product_id: product.product_id,
            product_name: product.name,
            reasons: compatResult.reasons,
          }];
        });
        toast.warning(`${product.name}: ${compatResult.reasons?.join(", ") || "Posible incompatibilidad"}`, {
          duration: 5000
        });
      }
    }

    const existing = cartItems.find(item => item.product_id === product.product_id);
    if (existing) {
      if (existing.quantity >= currentStock) {
        toast.error("No hay más stock disponible");
        return;
      }
      setCartItems(cartItems.map(item =>
        item.product_id === product.product_id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      const installationType = product.installation_type || "optional";
      const withInstallation = installationType === "required";
      
      setCartItems([...cartItems, {
        product_id: product.product_id,
        product_name: product.name,
        image: product.images?.[0] || null,
        quantity: 1,
        unit_price: product.price,
        discount: 0,
        warehouse_id: selectedWarehouse,
        installation_type: installationType,
        with_installation: withInstallation,
        installation_price: product.installation_price || 0,
        stock: currentStock,
      }]);
    }
  };

  const requestTransfer = async () => {
    if (!canEditSales) {
      toast.error("No tienes permiso para solicitar traslados");
      return;
    }
    if (!transferProduct || !transferFromWarehouse) return;
    
    try {
      await axios.post(`${API}/inventory/transfer-request`, {
        product_id: transferProduct.product_id,
        from_warehouse_id: transferFromWarehouse,
        to_warehouse_id: selectedWarehouse,
        quantity: 1,
        reason: "Venta - Solicitud de traslado",
        sale_pending: true,
      }, { withCredentials: true });
      
      toast.success("Solicitud de traslado enviada a supervisor");
      setShowTransferDialog(false);
      setTransferProduct(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al solicitar traslado");
    }
  };

  const toggleInstallation = (productId) => {
    setCartItems(cartItems.map(item => {
      if (item.product_id === productId) {
        return { ...item, with_installation: !item.with_installation };
      }
      return item;
    }));
  };

  const removeFromCart = (productId) => {
    setCartItems(cartItems.filter(item => item.product_id !== productId));
    setCompatibilityWarnings(prev => prev.filter(w => w.product_id !== productId));
  };

  const updateCartItem = (productId, field, value) => {
    setCartItems(cartItems.map(item =>
      item.product_id === productId ? { ...item, [field]: value } : item
    ));
  };

  const applyDiscountCode = () => {
    if (!discountCode) return;
    
    // Example discount codes (in real app, validate against backend)
    const codes = {
      "DESC10": { type: "percent", value: 10, name: "10% de descuento" },
      "DESC20": { type: "percent", value: 20, name: "20% de descuento" },
      "FIJO100": { type: "fixed", value: 100, name: "C$100 de descuento" },
    };
    
    const code = codes[discountCode.toUpperCase()];
    if (code) {
      if (appliedDiscounts.find(d => d.code === discountCode.toUpperCase())) {
        toast.error("Este código ya fue aplicado");
        return;
      }
      setAppliedDiscounts([...appliedDiscounts, { ...code, code: discountCode.toUpperCase() }]);
      toast.success(`Código aplicado: ${code.name}`);
      setDiscountCode("");
    } else {
      toast.error("Código de descuento inválido");
    }
  };

  const removeDiscountCode = (code) => {
    setAppliedDiscounts(appliedDiscounts.filter(d => d.code !== code));
  };

  // Los precios de productos están en USD. Convertir según moneda seleccionada.
  const convertPrice = (priceUSD) => {
    if (currency === "NIO") {
      return priceUSD * exchangeRate; // Convertir USD a NIO
    }
    return priceUSD; // Mantener en USD
  };

  const calculateTotals = () => {
    const discountsAllowed = paymentMethodsAllowDiscounts(paymentType, mixedPaymentMethods);
    // Calcular subtotal convirtiendo cada precio según la moneda seleccionada
    let subtotalInCurrency = cartItems.reduce((sum, item) => {
      const priceInCurrency = convertPrice(item.unit_price);
      let itemTotal = priceInCurrency * item.quantity * (1 - (discountsAllowed ? (item.discount || 0) : 0) / 100);
      if (item.with_installation && item.installation_price) {
        const installationInCurrency = convertPrice(item.installation_price);
        itemTotal += installationInCurrency * item.quantity;
      }
      return sum + itemTotal;
    }, 0);

    // Apply discount codes
    let discountFromCodes = 0;
    appliedDiscounts.forEach(d => {
      if (d.type === "percent") {
        discountFromCodes += subtotalInCurrency * (d.value / 100);
      } else if (d.type === "fixed") {
        // Fixed discounts are in NIO, convert if needed
        const fixedInCurrency = currency === "USD" ? d.value / exchangeRate : d.value;
        discountFromCodes += fixedInCurrency;
      }
    });

    // Apply global discount
    const globalDiscountAmount = discountsAllowed ? subtotalInCurrency * (globalDiscount / 100) : 0;
    
    const subtotalAfterDiscounts = subtotalInCurrency - discountFromCodes - globalDiscountAmount;
    const tax = applyIVA ? subtotalAfterDiscounts * (ivaRate / 100) : 0;
    const total = subtotalAfterDiscounts + tax;

    // También calcular equivalente en la otra moneda para referencia
    const totalInUSD = currency === "USD" ? total : total / exchangeRate;
    const totalInNIO = currency === "NIO" ? total : total * exchangeRate;

    return { 
      subtotal: subtotalInCurrency, 
      discountFromCodes,
      globalDiscountAmount,
      tax, 
      total,
      totalInUSD,
      totalInNIO,
      currencySymbol: currency === "USD" ? "US$" : "C$",
      currencyCode: currency
    };
  };

  const createSale = async (authCode = null) => {
    if (!canCreateSales) {
      toast.error("No tienes permiso para crear ventas");
      return;
    }
    if (!selectedCustomer || cartItems.length === 0) {
      toast.error("Selecciona un cliente y agrega productos");
      return;
    }

    try {
      const totals = calculateTotals();
      
      const saleData = {
        customer_id: selectedCustomer.customer_id,
        vehicle_id: selectedVehicle || null,
        items: cartItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          discount: item.discount,
          warehouse_id: item.warehouse_id,
          with_installation: item.with_installation,
        })),
        discount: globalDiscount,
        payment_type: paymentType,
        credit_days: paymentType === "credit" ? creditDays : null,
        delivery_required: deliveryRequired,
        delivery_address: deliveryRequired ? deliveryAddress : null,
        delivery_info: null,
        manager_authorization_code: authCode || managerAuthCode || null,
        apply_iva: applyIVA,
        iva_rate: ivaRate,
        currency: currency,
        exchange_rate: exchangeRate,
        discount_codes: appliedDiscounts.map(d => d.code),
        total_amount: totals.total,
      };

      const response = await axios.post(`${API}/sales`, saleData, { withCredentials: true });
      
      if (response.data.requires_manager_auth) {
        setAuthProducts(response.data.products || []);
        setShowAuthDialog(true);
        return;
      }
      
      toast.success(`Factura ${response.data.invoice_number} enviada a caja para cobro`);
      
      if (paymentType === "stripe") {
        const checkoutRes = await axios.post(`${API}/payments/checkout`, {
          sale_id: response.data.sale_id,
          origin_url: window.location.origin,
        }, { withCredentials: true });
        window.location.href = checkoutRes.data.url;
        return;
      }
      
      resetSaleForm();
      fetchData();
    } catch (error) {
      if (error.response?.data?.requires_manager_auth) {
        setAuthProducts(error.response?.data?.products || []);
        setShowAuthDialog(true);
        return;
      }
      toast.error(error.response?.data?.detail || "Error al crear venta");
    }
  };

  // Helper to create a sale using payload from SaleForm component
  const createSaleWithPayload = async (payload, authCode = null, draftId = null) => {
    if (!canCreateSales) {
      throw new Error("No tienes permiso para crear ventas");
    }
    if (!payload?.customer_id || !payload?.items || payload.items.length === 0) {
      throw new Error("Selecciona un cliente y agrega productos");
    }

    try {
      // Keep local UI state in sync
      setSelectedCustomer(customers.find(c => c.customer_id === payload.customer_id) || null);
      setSelectedVehicle(payload.vehicle_id || "");
      setSelectedWarehouse(payload.warehouse_id || selectedWarehouse);
      setCartItems(payload.items.map(i => ({
        product_id: i.product_id,
        product_name: i.product_name || "",
        quantity: i.quantity,
        unit_price: i.unit_price || 0,
        discount: i.discount || 0,
        warehouse_id: i.warehouse_id || (payload.warehouse_id || selectedWarehouse),
      })));
      setGlobalDiscount(payload.discount || 0);
      setPaymentType(payload.payment_type || payload.payment_method || "cash");
      setMixedPaymentMethods(normalizePaymentMethodList(payload.mixed_payment_methods || payload.mixedPaymentMethods || []));
      setApplyIVA(payload.apply_iva ?? applyIVA);
      setCurrency(payload.currency || currency);
      if (payload.applied_discounts) {
        setAppliedDiscounts(payload.applied_discounts);
      }

      const totalsLocal = typeof payload.total_amount === "number" ? { total: payload.total_amount } : calculateTotals();

      const payloadPaymentType = payload.payment_type || payload.payment_method || paymentType;
      const payloadMixedPaymentMethods = normalizePaymentMethodList(payload.mixed_payment_methods || payload.mixedPaymentMethods || []);
      const discountsAllowed = paymentMethodsAllowDiscounts(payloadPaymentType, payloadMixedPaymentMethods);
      const saleData = {
        customer_id: payload.customer_id,
        vehicle_id: payload.vehicle_id || null,
        items: payload.items.map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          discount: item.discount,
          unit_price: item.unit_price,
          original_unit_price: item.original_unit_price ?? item.unit_price,
          installation_price: item.installation_price || 0,
          warehouse_id: item.warehouse_id || (payload.warehouse_id || selectedWarehouse),
          with_installation: item.with_installation || false,
        })),
        discount: payload.discount || 0,
        supervisor_discount_preapproved: isDraftReleasedWithRestrictions(activeDraftReview),
        payment_type: payloadPaymentType,
        payment_method: payload.payment_method || payloadPaymentType,
        mixed_payment_methods: payloadMixedPaymentMethods,
        planned_payment_plan: payload.planned_payment_plan || null,
        credit_days: payloadPaymentType === "credit" ? (payload.credit_days ?? creditDays) : null,
        delivery_required: Boolean(payload.delivery_required || payload.delivery_info?.is_delivery || deliveryRequired),
        delivery_address: deliveryRequired ? deliveryAddress : null,
        delivery_info: payload.delivery_info || null,
        manager_authorization_code: authCode || managerAuthCode || null,
        apply_iva: payload.apply_iva ?? applyIVA,
        iva_rate: payload.iva_rate ?? ivaRate,
        apply_retention: payload.apply_retention ?? false,
        retention_rate: payload.retention_rate ?? 0,
        currency: payload.currency || currency,
        exchange_rate: payload.exchange_rate ?? exchangeRate,
        applied_discounts: discountsAllowed ? (payload.applied_discounts || []) : [],
        discount_codes: discountsAllowed ? (payload.discount_codes || []) : [],
        total_amount: payload.total_amount ?? totalsLocal.total,
        notes: payload.notes || null,
        draft_id: draftId || null,
        idempotency_key: draftId ? `draft:${draftId}` : null,
      };

      const response = await axios.post(`${API}/sales`, saleData, { withCredentials: true });

      if (response.data.requires_manager_auth) {
        setAuthProducts(response.data.products || []);
        setShowAuthDialog(true);
        return null;
      }

      toast.success(`Factura ${response.data.invoice_number} enviada a caja para cobro`);
      setPrintSaleData(response.data);
      setShowPrintPrompt(true);
      await fetchData({ silent: true });
      return response.data;
    } catch (error) {
      if (error.response?.data?.requires_manager_auth) {
        setAuthProducts(error.response?.data?.products || []);
        setShowAuthDialog(true);
        return null;
      }
      throw error;
    }
  };

  const resetSaleForm = ({ keepVisible = true, skipAutoDraft = false } = {}) => {
    // Save draft if not empty before resetting
    if (!skipAutoDraft && !activeDraftId && (cartItems.length > 0 || selectedCustomer || notes)) {
      // If no active draft but form has data, create a new draft and save it
      const id = `sale_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      const name = `Venta (auto)`;
      const newTab = { id, name, updatedAt: new Date().toISOString() };
      setDraftTabs(prev => [...prev, newTab]);
      window.localStorage.setItem(getDraftKey(id), JSON.stringify({
        selectedCustomerId: selectedCustomer?.customer_id || null,
        selectedVehicle,
        vehicleFlowOption: selectedVehicle ? "registered" : "carryout",
        selectedWarehouse,
        cartItems,
        globalDiscount,
        notes,
        applyIVA,
        ivaRate,
        currency,
        exchangeRate,
        appliedDiscounts,
        customerSearch,
        productSearch,
        updatedAt: new Date().toISOString(),
      }));
    }
    setShowNewSale(keepVisible);
    setCartItems([]);
    setSelectedCustomer(null);
    setSelectedVehicle("");
    setGlobalDiscount(0);
    setManagerAuthCode("");
    setShowAuthDialog(false);
    setAuthProducts([]);
    setCompatibilityWarnings([]);
    setCustomerSearch("");
    setProductSearch("");
    setAppliedDiscounts([]);
    setApplyIVA(false);
    setApplyRetention(false);
    setRetentionRate(2);
    setIvaRate(effectiveIvaRate);
    setCurrency("NIO");
  };

  useEffect(() => {
    if (!selectedCustomer) return;
    if (isCompanyCustomerType(selectedCustomer)) {
      setApplyIVA(true);
    }
  }, [selectedCustomer]);

  const requestManagerAuth = async () => {
    try {
      const response = await axios.post(`${API}/auth/manager/generate-code`, null, {
        params: { reason: "Instalación de productos solo para llevar" },
        withCredentials: true
      });
      toast.success(`Código de autorización generado: ${response.data.code}`);
      setManagerAuthCode(response.data.code);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al generar código. ¿Eres gerente?");
    }
  };

  const submitWithAuth = async () => {
    if (!managerAuthCode) {
      toast.error("Ingresa el código de autorización del gerente");
      return;
    }
    setShowAuthDialog(false);
    await createSale(managerAuthCode);
  };

  const totals = calculateTotals();

  const filteredSales = (Array.isArray(sales) ? sales : []).filter(sale => {
    if (!sale) return false;
    const matchesSearch = (sale.invoice_number || "")?.toLowerCase().includes(search.toLowerCase()) ||
                         (sale.customer_name || "")?.toLowerCase().includes(search.toLowerCase());
    const matchesPayment = filterPayment === "all" || sale.payment_type === filterPayment;
    const matchesStatus = filterStatus === "all" || sale.status === filterStatus;
    const matchesSeller = filterSeller === "all" || sale.seller_id === filterSeller || sale.created_by === filterSeller;
    const matchesBranch = filterBranch === "all" || sale.branch_id === filterBranch;
    return matchesSearch && matchesPayment && matchesStatus && matchesSeller && matchesBranch;
  });

  const openInvoicesInCash = useMemo(() => {
    const salesById = new Map(
      (Array.isArray(filteredSales) ? filteredSales : []).map((sale) => [String(sale?.sale_id || ""), sale])
    );
    const cashierRows = (Array.isArray(openCashierInvoices) ? openCashierInvoices : []).length
      ? openCashierInvoices
      : (Array.isArray(filteredSales) ? filteredSales : []).filter((sale) => {
          if (!sale) return false;
          const invoiceState = String(sale.invoice_state || "").toLowerCase();
          const paymentStatus = String(sale.payment_status || sale.status || "").toLowerCase();
          if (invoiceState === "cancelled") return false;
          if (invoiceState === "open") return true;
          return Boolean(sale.cash_session_id) && paymentStatus !== "paid";
        });

    return (Array.isArray(cashierRows) ? cashierRows : [])
      .map((row) => {
        const saleId = String(row?.sale_id || "");
        const saleDetails = salesById.get(saleId) || {};
        return {
          ...saleDetails,
          ...row,
          sale_id: saleId || saleDetails.sale_id,
        };
      })
      .filter((sale) => sale?.sale_id);
  }, [filteredSales, openCashierInvoices]);

  const closedInvoicesToday = (Array.isArray(filteredSales) ? filteredSales : []).filter((sale) => {
    if (!sale) return false;
    const invoiceState = String(sale.invoice_state || "").toLowerCase();
    const paymentStatus = String(sale.payment_status || sale.status || "").toLowerCase();
    if (invoiceState === "cancelled") return false;
    if (paymentStatus !== "paid") return false;
    if (!sale.created_at) return false;
    const created = new Date(sale.created_at);
    const now = new Date();
    return (
      created.getFullYear() === now.getFullYear() &&
      created.getMonth() === now.getMonth() &&
      created.getDate() === now.getDate()
    );
  });

  const openPaymentPlanEditor = (sale) => {
    if (!sale?.sale_id) return;
    if (String(sale.payment_type || sale.payment_method || "").toLowerCase() === "credit") {
      toast.error("Las facturas a crédito no usan plan de cobro en caja");
      return;
    }
    if (String(sale.payment_status || "").toLowerCase() === "paid") {
      toast.error("No se puede editar el plan de una factura pagada");
      return;
    }
    setPaymentPlanDialogSale(sale);
    setPaymentPlanDialogOpen(true);
  };

  const openOperationalAuditModal = (sale) => {
    if (!sale?.sale_id) return;
    setAuditDialogSale(sale);
    setAuditDialogOpen(true);
  };

  const handlePaymentPlanSaved = (updatedSale) => {
    if (!updatedSale?.sale_id) return;
    setSales((prev) => prev.map((row) => (
      row.sale_id === updatedSale.sale_id ? { ...row, ...updatedSale } : row
    )));
    setPaymentPlanDialogSale((prev) => (
      prev?.sale_id === updatedSale.sale_id ? { ...prev, ...updatedSale } : prev
    ));
  };

  const requestInvoiceEdit = async (sale) => {
    const reason = window.prompt("Motivo de la solicitud de edición", "Corrección de items/precios/descuentos");
    if (!reason) return;
    try {
      await axios.post(
        `${API}/sales/${sale.sale_id}/requests/edit`,
        { reason },
        { withCredentials: true }
      );
      toast.success("Solicitud de edición enviada a Gerencia/RRHH");
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo enviar la solicitud de edición");
    }
  };

  const requestInvoiceCancel = async (sale) => {
    const reason = window.prompt("Motivo de la solicitud de anulación", "Cliente desistió / corrección de factura");
    if (!reason) return;
    try {
      await axios.post(
        `${API}/sales/${sale.sale_id}/requests/cancel`,
        { reason },
        { withCredentials: true }
      );
      toast.success("Solicitud de anulación enviada a Gerencia/RRHH");
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo enviar la solicitud de anulación");
    }
  };

  const cancelInvoiceDirectly = async (sale) => {
    const motivo = window.prompt("Motivo de anulación", "Anulación autorizada por gerencia/RRHH");
    if (!motivo) return;
    const justificacion = window.prompt("Justificación interna (mínimo 20 caracteres)", "Detalle interno de anulación autorizada");
    if (!justificacion) return;
    try {
      await axios.post(
        `${API}/caja/facturas/${sale.sale_id}/anular`,
        {
          motivo,
          justificacion_interna: justificacion,
          autorizado_por: user?.user_id,
        },
        { withCredentials: true }
      );
      toast.success("Factura anulada correctamente");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo anular la factura");
    }
  };

  // Print sale receipt
  const printSale = async (sale) => {
    try {
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>Factura ${sale.invoice_number}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
              .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
              .company { font-size: 24px; font-weight: bold; }
              .invoice-info { display: flex; justify-content: space-between; margin-bottom: 20px; }
              .customer-info { margin-bottom: 20px; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f4f4f4; }
              .totals { text-align: right; }
              .total-row { font-weight: bold; font-size: 18px; }
              @media print { body { print-color-adjust: exact; } }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="company">AutoAccesorios ERP</div>
              <div>Sistema de Facturación</div>
            </div>
            <div class="invoice-info">
              <div><strong>Factura:</strong> ${sale.invoice_number}</div>
              <div><strong>Fecha:</strong> ${new Date(sale.created_at).toLocaleDateString('es-NI')}</div>
            </div>
            <div class="customer-info">
              <strong>Cliente:</strong> ${sale.customer_name || 'N/A'}<br>
              <strong>Tipo de Pago:</strong> ${sale.payment_type === 'cash' ? 'Contado' : sale.payment_type === 'credit' ? 'Crédito' : 'Tarjeta'}
            </div>
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Precio Unit.</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${(sale.items || []).map(item => `
                  <tr>
                    <td>${item.product_name || 'Producto'}</td>
                    <td>${item.quantity}</td>
                    <td>C$${(item.unit_price || 0).toFixed(2)}</td>
                    <td>C$${((item.unit_price || 0) * item.quantity).toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="totals">
              <p>Subtotal: C$${(sale.subtotal || sale.total || 0).toFixed(2)}</p>
              ${sale.discount ? `<p>Descuento: -C$${sale.discount.toFixed(2)}</p>` : ''}
              ${sale.tax ? `<p>IVA: C$${sale.tax.toFixed(2)}</p>` : ''}
              <p class="total-row">TOTAL: C$${(sale.total || 0).toFixed(2)}</p>
            </div>
            <script>window.print(); setTimeout(() => window.close(), 500);</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch (error) {
      toast.error("Error al imprimir");
    }
  };

  const printThermalSale = async (saleId) => {
    if (!saleId) {
      toast.error("ID de venta inválido");
      return;
    }
    try {
      const { printSellerVoucherPos, openSellerVoucherPreviewPdf } = await import("@/lib/voucherPrinter");
      await printSellerVoucherPos(saleId);
      toast.success("Voucher enviado a impresora POS 80mm");
    } catch (error) {
      const detail = error?.response?.data?.detail;
      const message = typeof detail === "string" ? detail : "No se pudo imprimir en la impresora POS";
      toast.error(message);
      if (error?.response?.status === 503) {
        try {
          const { openSellerVoucherPreviewPdf } = await import("@/lib/voucherPrinter");
          await openSellerVoucherPreviewPdf(saleId);
          toast.info("Se abrió vista previa PDF porque la impresora POS no está disponible");
        } catch {
          // ignore secondary failure
        }
      }
    }
  };

  const openPaymentReceiptPdf = async (saleId) => {
    if (!saleId) {
      toast.error("ID de venta inválido");
      return;
    }
    try {
      const response = await axios.get(`${API}/print/payment-receipt-pdf/${saleId}`, {
        withCredentials: true,
        responseType: "blob",
      });
      const contentType = response.headers["content-type"] || "";
      if (response.status !== 200 || !contentType.includes("pdf")) {
        toast.error("Comprobante de abono no disponible");
        return;
      }
      const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      window.open(blobUrl, "_blank");
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60 * 1000);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "No se pudo obtener el comprobante de abono");
    }
  };

  const openInvoicePdf = async (saleId, sale = null) => {
    if (!saleId) {
      toast.error("ID de venta inválido");
      return;
    }
    const saleRecord = sale || sales.find((row) => row.sale_id === saleId) || printSaleData;
    if (!canPrintLetterInvoice(user?.role, saleRecord)) {
      toast.error("La factura membretada solo está disponible en caja después del cobro");
      return;
    }
    try {
      // Request PDF from backend first to verify it exists and get blob
      const response = await axios.get(`${API}/print/invoice-pdf/${saleId}`, {
        withCredentials: true,
        responseType: 'blob',
      });

      // If backend returned a JSON error blob (e.g., 404 HTML/JSON), try to detect and handle
      const contentType = response.headers['content-type'] || '';
      if (response.status !== 200 || !contentType.includes('pdf')) {
        toast.error('Factura no disponible');
        return;
      }

      const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      window.open(blobUrl, '_blank');
      // Do not revoke immediately; let browser keep the blob for the new tab. Revoke after a delay.
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60 * 1000);
    } catch (e) {
      console.error('openInvoicePdf error:', e);
      toast.error('No se pudo obtener la factura');
    }
  };

  const normalizePhone = (phone) => (phone || "").toString().replace(/[^\d]/g, "");

  const resolveSalePhone = (sale) => {
    const fromSale = sale?.customer_phone || sale?.phone || "";
    if (fromSale) return fromSale;
    const fromCustomerId = customers.find(c => c.customer_id === sale?.customer_id)?.phone;
    if (fromCustomerId) return fromCustomerId;
    const fromName = customers.find(c => c.name === sale?.customer_name)?.phone;
    return fromName || "";
  };

  const sendInvoiceWhatsApp = async (sale) => {
    if (!canPrintLetterInvoice(user?.role, sale)) {
      toast.error("Solo se puede compartir la factura membretada después del cobro en caja");
      return;
    }
    const phone = normalizePhone(resolveSalePhone(sale));
    if (!phone) {
      toast.error("El cliente no tiene teléfono válido");
      return;
    }

    const invoiceUrl = `${API}/print/invoice-pdf/${sale.sale_id}`;
    // Verify invoice exists before opening WhatsApp link
    try {
      const headResp = await axios.get(invoiceUrl, { withCredentials: true, responseType: 'blob' });
      const ct = headResp.headers['content-type'] || '';
      if (headResp.status !== 200 || !ct.includes('pdf')) {
        toast.error('La factura no está disponible para compartir');
        return;
      }
    } catch (err) {
      console.error('Invoice check failed:', err);
      toast.error('La factura no está disponible para compartir');
      return;
    }

    const customerName = sale.customer_name || 'cliente';
    const message = `Hola ${customerName}, te envío tu factura ${sale.invoice_number}. Puedes verla aquí: ${invoiceUrl}`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    // Note: recipient may need access to the backend to view the invoice
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Download sale as PDF (simple HTML to PDF)
  const downloadSale = async (sale) => {
    try {
      // Try to get PDF from backend if available
      const response = await axios.get(`${API}/sales/${sale.sale_id}/pdf`, {
        withCredentials: true,
        responseType: 'blob'
      });
      const ct = response.headers['content-type'] || '';
      if (response.status !== 200 || !ct.includes('pdf')) {
        throw new Error('PDF not available');
      }

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `factura_${sale.invoice_number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Factura descargada");
    } catch (error) {
      // Fallback: generate simple PDF-like download
      const content = `
FACTURA: ${sale.invoice_number}
Fecha: ${new Date(sale.created_at).toLocaleDateString('es-NI')}
Cliente: ${sale.customer_name || 'N/A'}
----------------------------------------
${(sale.items || []).map(item => `${item.product_name || 'Producto'} x${item.quantity} - C$${((item.unit_price || 0) * item.quantity).toFixed(2)}`).join('\n')}
----------------------------------------
TOTAL: C$${(sale.total || 0).toFixed(2)}
      `;
      
      const blob = new Blob([content], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `factura_${sale.invoice_number}.txt`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Factura descargada (formato texto)");
    }
  };

  // Create new customer
  const createNewCustomer = async () => {
    if (!canCreateCustomers) {
      toast.error("No tienes permiso para crear clientes");
      return;
    }
    if (!newCustomer.first_name || !newCustomer.phone) {
      toast.error("Nombre y teléfono son requeridos");
      return;
    }
    
    try {
      const fullPhone = `${newCustomer.phone_prefix}-${newCustomer.phone}`;
      const customerData = {
        name: `${newCustomer.first_name} ${newCustomer.last_name}`.trim(),
        first_name: newCustomer.first_name,
        last_name: newCustomer.last_name,
        customer_type: newCustomer.customer_type,
        tax_id: newCustomer.tax_id,
        email: newCustomer.email || null,
        phone: fullPhone,
        address: newCustomer.address || null,
        credit_limit: parseFloat(newCustomer.credit_limit) || 0,
      };
      
      const response = await axios.post(`${API}/customers`, customerData, { withCredentials: true });
      const customerId = response.data.customer_id;
      toast.success("Cliente creado exitosamente");
      
      // Create vehicle if requested
      if (newCustomer.add_vehicle && newCustomer.brand && newCustomer.model) {
        if (!newCustomer.year) {
          toast.error("Selecciona el año del vehículo");
          return;
        }
        if (!isValidVehicleSelection(newCustomer.brand, newCustomer.year, newCustomer.model)) {
          toast.error("Marca, año y modelo deben seleccionarse desde la lista");
          return;
        }
        try {
          const plateFormatted = newCustomer.plate_prefix === "M"
            ? `M ${newCustomer.plate_number}`
            : `${newCustomer.plate_prefix} ${newCustomer.plate_number}`;
          
          const vehicleData = {
            customer_id: customerId,
            plate: plateFormatted,
            brand: newCustomer.brand,
            model: newCustomer.model,
            year: parseInt(newCustomer.year) || new Date().getFullYear(),
            color: newCustomer.color || null,
            vin: newCustomer.chasis || null,
            vehicle_type: "sedan",
          };

          await axios.post(`${API}/vehicles`, vehicleData, { withCredentials: true });
          toast.success("Vehículo registrado");
          
          // Refresh vehicles
          const vehiclesRes = await axios.get(`${API}/vehicles`, { withCredentials: true });
          setVehicles(vehiclesRes.data);
        } catch (error) {
          toast.error("Cliente creado pero error al registrar vehículo");
        }
      }
      
      // Refresh customers and select the new one
      const customersRes = await axios.get(`${API}/customers`, { withCredentials: true });
      setCustomers(customersRes.data);
      
      // Find and select the newly created customer
      const newCust = customersRes.data.find(c => c.customer_id === customerId);
      if (newCust) {
        setSelectedCustomer(newCust);
      }
      
      // Reset form and close dialog
      resetNewCustomerForm();
      setShowNewCustomer(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al crear cliente");
    }
  };

  const resetNewCustomerForm = () => {
    setNewCustomer({
      first_name: "",
      last_name: "",
      customer_type: "natural",
      tax_id: "",
      email: "",
      phone_prefix: "+505",
      phone: "",
      address: "",
      credit_limit: 0,
      add_vehicle: false,
      plate_prefix: "M",
      plate_number: "",
      brand: "",
      model: "",
      year: "",
      color: "",
      chasis: "",
    });
    setNewCustomerTab("customer");
  };

  return (
    <div className="p-6 space-y-6" data-testid="sales-page">
      {!canViewSales ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">No tienes permiso para ver ventas.</p>
          </CardContent>
        </Card>
      ) : (
      <>
      {/* Sellers need a way to re-open the form when it was hidden (toggle used to be manager-only). */}
      {canViewSales && canCreateSales && !showNewSale ? (
        <Card className="border-dashed border-primary/40 bg-primary/5">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Formulario de venta oculto</p>
              <p className="text-xs text-muted-foreground">
                Puedes abrirlo de nuevo o cargar un borrador desde el tablero inferior.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => {
                  playSelectionFeedbackSound();
                  toggleEmbeddedSaleForm();
                }}
                data-testid="show-sale-form-banner-btn"
              >
                <Eye className="h-4 w-4 mr-2" />
                Mostrar formulario
              </Button>
              {visibleDraftTabs.length > 0 && activeDraftId ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    playSelectionFeedbackSound();
                    const tab = draftTabs.find((entry) => entry.id === activeDraftId) || draftTabs[0];
                    if (tab) openDraftTab(tab);
                  }}
                >
                  Abrir borrador activo
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {canViewSales && !canCreateSales ? (
        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground">
            No tienes permiso para crear ventas. Pide a gerencia el permiso <strong>Ventas → Crear</strong>.
          </CardContent>
        </Card>
      ) : null}

      {showNewSale && canCreateSales ? (
        <Card ref={saleFormAnchorRef} className="border-primary/30 shadow-sm ui-panel animate-fade-up-soft">
          <CardHeader className="pb-3">
            <div className="flex w-full flex-wrap items-center gap-2 ui-fade-in-stagger">
              <ErpFormToolbar saveFlash={saveFlash}>
                <ErpToolbarButton
                  action="refresh"
                  icon={RefreshCw}
                  label="Actualizar datos"
                  onClick={() => {
                    playSelectionFeedbackSound();
                    handleRefreshData();
                  }}
                  disabled={isRefreshingData}
                  title="Actualizar datos"
                  className={isRefreshingData ? "[&_svg]:animate-spin" : ""}
                />
                {isRefreshingData ? (
                  <BrandMosaicLoader variant="mini" statusText="Actualizando datos..." />
                ) : null}
                <ErpToolbarButton
                  action="saveClear"
                  icon={SaveAll}
                  label="Guardar y Limpiar"
                  testId="save-and-clear-sale-btn"
                  onClick={handleSaveAndClearSale}
                  disabled={!canCreateSales}
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
                  disabled={sellerSaleParamsLocked}
                  onCheckedChange={(checked) => {
                    if (sellerSaleParamsLocked) {
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
                  setShowClearSaleConfirm(true);
                }}
                disabled={!canCreateSales}
                title="Limpiar Formulario"
              />
            </div>
            <Dialog open={showClearSaleConfirm} onOpenChange={setShowClearSaleConfirm}>
              <DialogContent className="max-w-sm">
                {(() => {
                  const msg = getDialogMessage("sale.clear_form");
                  const variant = msg.variant || "warning";
                  return (
                    <>
                      <ContextualDialogHeader
                        variant={variant}
                        size="hero"
                        title={msg.title}
                        description={msg.description}
                      />
                      <ContextualDialogFooter variant={variant}>
                        <Button
                          variant="ghost"
                          className={getStatusSecondaryButtonClass(variant)}
                          onClick={() => setShowClearSaleConfirm(false)}
                        >
                          {msg.secondary_label || "Cancelar"}
                        </Button>
                        <Button
                          className={getStatusPrimaryButtonClass(variant)}
                          onClick={() => { setShowClearSaleConfirm(false); clearEmbeddedSaleForm(); }}
                        >
                          <Eraser className="mr-2 h-4 w-4" />
                          {msg.primary_label || "Sí, limpiar"}
                        </Button>
                      </ContextualDialogFooter>
                    </>
                  );
                })()}
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="pt-0">
            <div key={activeDraftId || "no-draft"}>
            <SaleForm
              key={activeDraftId || "draft"}
              customers={customers}
              products={products}
              warehouses={warehouses}
              inventory={inventory}
              crossBranchInventory={crossBranchInventory}
              vehicles={vehicles}
              initialData={{ selectedCustomer, selectedVehicle, selectedWarehouse, cartItems, paymentMethod: paymentType, mixedPaymentMethods, globalDiscount, notes, applyIVA, applyRetention, retentionRate, ivaRate, currency }}
              exchangeRate={exchangeRate}
              buyExchangeRate={buyExchangeRate}
              defaultIvaRate={effectiveIvaRate}
              draftKey={activeDraftId ? getDraftKey(activeDraftId) : null}
              draftReview={activeDraftReview}
              onOpenCatalogSearch={openCatalogFromSaleForm}
              onDraftPersist={(snapshot) => {
                if (!activeDraftId) return;
                if (!isSaleDraftSaveEligible(snapshot)) return;
                markDraftSaving();
                updateDraftTabMeta(activeDraftId, snapshot);
              }}
              onDraftSaveStateChange={(payload) => {
                if (!activeDraftId) return;
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
              submitLabel="Enviar Factura a Caja"
              confirmSendToCashier={isSellerOnly || String(user?.role || "").toLowerCase() === "ventas"}
              onSubmit={async (payload) => {
                const submittedDraftId = activeDraftIdRef.current;
                cancelScheduledDraftSync(submittedDraftId);
                try {
                  const createdSale = await createSaleWithPayload(payload, null, submittedDraftId);
                  if (!createdSale?.sale_id) return false;
                  await finalizeSaleAfterSubmit(submittedDraftId);
                  return { ok: true, sale_id: createdSale.sale_id };
                } catch (err) {
                  const detail = err?.response?.data?.detail;
                  let message = "Error al crear venta";
                  if (typeof detail === "string") {
                    message = detail;
                  } else if (detail?.error === "TOTAL_MISMATCH") {
                    const expected = Number(detail?.expected_total);
                    const submitted = Number(detail?.submitted_total);
                    message = Number.isFinite(expected) && Number.isFinite(submitted)
                      ? `El total no coincide con el servidor (enviado: ${submitted.toFixed(2)}, esperado: ${expected.toFixed(2)}).`
                      : (detail?.message || message);
                  } else if (detail?.error === "PAYMENT_PLAN_MISMATCH") {
                    message = detail?.message || "El plan de pago no cuadra con el total a cobrar.";
                  } else if (detail?.message) {
                    message = detail.message;
                  }
                  toast.error(message);
                  return false;
                }
              }}
            />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Form show/hide — all roles that can create sales (incl. vendedores) */}
      {canCreateSales ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={showNewSale ? "outline" : "default"}
            onClick={() => {
              playSelectionFeedbackSound();
              toggleEmbeddedSaleForm();
            }}
            className="ui-interactive"
            title={showNewSale ? "Ocultar formulario" : "Mostrar formulario"}
            aria-label={showNewSale ? "Ocultar formulario de venta" : "Mostrar formulario de venta"}
            data-testid="toggle-sale-form-btn"
          >
            {showNewSale ? (
              <>
                <XCircle className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Ocultar formulario</span>
                <span className="sm:hidden">Ocultar</span>
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Mostrar formulario</span>
                <span className="sm:hidden">Formulario</span>
              </>
            )}
          </Button>
          {!showNewSale ? (
            <span className="text-xs text-muted-foreground">
              Formulario oculto — usa el botón para volver a vender.
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Filters and Search (management / jefes) */}
      {canSeeAdvancedFilters && <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por factura o cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterPayment} onValueChange={setFilterPayment}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tipo pago" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="cash">Efectivo</SelectItem>
            <SelectItem value="card">Tarjeta</SelectItem>
            <SelectItem value="credit">Crédito</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendiente</SelectItem>
            <SelectItem value="paid">Pagado</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterSeller} onValueChange={setFilterSeller}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Vendedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Vendedores</SelectItem>
            {sellers.map(s => (
              <SelectItem key={s.user_id || s.pin_user_id} value={s.user_id || s.pin_user_id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterBranch} onValueChange={setFilterBranch}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Sucursal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Sucursales</SelectItem>
            {branches.map(b => (
              <SelectItem key={b.branch_id} value={b.branch_id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>}

      {/* Drafts + 3-column invoice board */}
      <div className="2xl:hidden">
        <Tabs value={boardTab} onValueChange={setBoardTab}>
          <TabsList className="h-11 w-full justify-center overflow-auto rounded-full border bg-card/95 p-1 touch-pan-x">
            <TabsTrigger value="drafts" className="shrink-0 rounded-full px-4 text-[12px] leading-tight data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Borradores
            </TabsTrigger>
            <TabsTrigger value="open" className="shrink-0 rounded-full px-4 text-[12px] leading-tight data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Abiertas
            </TabsTrigger>
            <TabsTrigger value="closed" className="shrink-0 rounded-full px-4 text-[12px] leading-tight data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Cerradas
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-6 2xl:grid-cols-3">
        <Card className={cn("h-fit", boardTab !== "drafts" ? "hidden 2xl:block" : "") }>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">BORRADORES DE VENTA</CardTitle>
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
                  const openDraft = () => openDraftTab(tab);
                  return (
                    <DraftBoardCard
                      key={`${tab.id}-${draftContentRevision}`}
                      tab={tab}
                      meta={meta}
                      isActive={isActive}
                      currentUserId={user?.user_id}
                      currentUserRole={user?.role}
                      openLabel="Abrir borrador"
                      onOpen={openDraft}
                      onDelete={() => closeDraftTab(tab.id)}
                    />
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={cn(boardTab !== "open" ? "hidden 2xl:block" : "") }>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">FACTURAS ABIERTAS EN CAJA</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {loading ? (
              <div className="py-10 text-center text-muted-foreground">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto" />
              </div>
            ) : openInvoicesInCash.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                No hay facturas abiertas en caja
              </div>
            ) : (
              <div className="grid gap-4">
                {openInvoicesInCash.map((sale) => {
                  const saleVehicle = sale.vehicle_id ? getVehicleById(sale.vehicle_id) : null;
                  return (
                  <Card key={sale.sale_id} className="relative overflow-hidden">
                    <VehicleThumbnailWatermark vehicle={saleVehicle} />
                    <CardContent className="relative p-4 space-y-3">
                      <div className="flex gap-3 items-start">
                        <div className="flex-1 flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">
                              {sale.invoice_number || "Sin factura"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {sale.customer_name || "Sin cliente"}
                            </p>
                            {sale.vehicle_id ? (
                              <p className="text-xs text-muted-foreground">
                                Vehículo: {getVehicleLabel(sale.vehicle_id) || "Sin vehículo"}
                              </p>
                            ) : null}
                            <p className="text-xs text-muted-foreground">
                              {sale.created_at ? formatDate(sale.created_at) : "—"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold">
                              {formatCurrency(sale.total)}
                            </p>
                            <div className="flex flex-wrap justify-end gap-2 mt-1">
                              <Badge className={getPaymentTone(sale.payment_type)}>
                                {PAYMENT_TYPES[sale.payment_type] || sale.payment_type}
                              </Badge>
                              <Badge className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-200 dark:border-blue-500/30">
                                Abierta en caja
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Artículos: {getSaleItemsPreview(sale)}
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {canEditPaymentPlan
                          && String(sale.payment_type || "").toLowerCase() !== "credit"
                          && String(sale.payment_status || "").toLowerCase() !== "paid" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openPaymentPlanEditor(sale)}
                            data-testid={`edit-payment-plan-${sale.sale_id}`}
                          >
                            Editar plan de cobro
                          </Button>
                        ) : null}
                        {canUseCashier ? (
                          <Button
                            variant="default"
                            size="sm"
                            className="gap-2"
                            onClick={() => navigate(`/cashier?sale_id=${encodeURIComponent(sale.sale_id)}`)}
                            data-testid={`go-cashier-${sale.sale_id}`}
                          >
                            <CreditCard className="h-4 w-4" />
                            Ir a Caja
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Trazabilidad operativa"
                          onClick={() => openOperationalAuditModal(sale)}
                          data-testid={`audit-sale-${sale.sale_id}`}
                        >
                          <Wrench className="h-5 w-5" />
                        </Button>
                        {isSellerOnly ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Imprimir voucher"
                            onClick={() => printThermalSale(sale.sale_id)}
                            data-testid={`print-sale-${sale.sale_id}`}
                          >
                            <Printer className="h-5 w-5" />
                          </Button>
                        ) : null}
                        {canReprintVoucher ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            title="Reimprimir voucher POS 80mm"
                            onClick={() => printThermalSale(sale.sale_id)}
                            data-testid={`reprint-voucher-${sale.sale_id}`}
                          >
                            <Printer className="h-4 w-4" />
                            Reimprimir voucher
                          </Button>
                        ) : null}
                        {canPrintLetterInvoice(user?.role, sale) ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Descargar"
                            onClick={() => downloadSale(sale)}
                            data-testid={`download-sale-${sale.sale_id}`}
                          >
                            <Download className="h-5 w-5" />
                          </Button>
                        ) : null}
                        {canPrintLetterInvoice(user?.role, sale) ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Enviar por WhatsApp"
                            onClick={() => sendInvoiceWhatsApp(sale)}
                            data-testid={`whatsapp-sale-${sale.sale_id}`}
                          >
                            <WhatsAppIcon className="h-6 w-6 text-[#25D366]" />
                          </Button>
                        ) : null}
                        {canPrintLetterInvoice(user?.role, sale) ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Ver factura"
                            onClick={() => openInvoicePdf(sale.sale_id, sale)}
                            data-testid={`view-sale-${sale.sale_id}`}
                          >
                            <Eye className="h-5 w-5" />
                          </Button>
                        ) : null}
                        {isBillingApprover ? (
                          <>
                            <Button variant="outline" size="sm" onClick={() => requestInvoiceEdit(sale)}>
                              Abrir/Editar
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => cancelInvoiceDirectly(sale)}>
                              Anular factura
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button variant="outline" size="sm" onClick={() => requestInvoiceEdit(sale)}>
                              Solicitar edición
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => requestInvoiceCancel(sale)}>
                              Solicitar anulación
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

        <Card className={cn(boardTab !== "closed" ? "hidden 2xl:block" : "") }>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">FACTURAS CERRADAS DEL DÍA</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {loading ? (
              <div className="py-10 text-center text-muted-foreground">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto" />
              </div>
            ) : closedInvoicesToday.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                No hay facturas cerradas hoy
              </div>
            ) : (
              <div className="grid gap-4">
                {closedInvoicesToday.map((sale) => (
                  <Card key={`closed-${sale.sale_id}`} className="overflow-hidden">
                    <CardContent className="p-3 sm:p-4 space-y-3">
                      <OperationalJobCard
                        variant="vendedor"
                        sale={sale}
                        vehicles={vehicles}
                        totalLabel={formatCurrency(sale.total)}
                        embedded
                      />
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Trazabilidad operativa"
                          onClick={() => openOperationalAuditModal(sale)}
                          data-testid={`audit-closed-sale-${sale.sale_id}`}
                        >
                          <Wrench className="h-5 w-5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Imprimir voucher"
                          onClick={() => (isSellerOnly ? printThermalSale(sale.sale_id) : printSale(sale))}
                        >
                          <Printer className="h-5 w-5" />
                        </Button>
                        {canPrintLetterInvoice(user?.role, sale) ? (
                          <Button variant="ghost" size="icon" title="Descargar" onClick={() => downloadSale(sale)}>
                            <Download className="h-5 w-5" />
                          </Button>
                        ) : null}
                        {canPrintLetterInvoice(user?.role, sale) ? (
                          <Button variant="ghost" size="icon" title="Ver factura" onClick={() => openInvoicePdf(sale.sale_id, sale)}>
                            <Eye className="h-5 w-5" />
                          </Button>
                        ) : null}
                        {(sale.delivery_info?.proof_image_id || sale.delivery_info?.proof_url) ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 text-emerald-700 border-emerald-300"
                            onClick={() => openDeliveryProofWhatsApp({
                              proof_image_id: sale.delivery_info?.proof_image_id,
                              proof_url: sale.delivery_info?.proof_url,
                              customer_name: sale.customer_name,
                            })}
                          >
                            <WhatsAppIcon className="h-4 w-4" />
                            Compartir evidencia con cliente
                          </Button>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transfer Dialog */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent>
          <ContextualDialogHeader
            variant="information"
            size="hero"
            icon={ArrowRightLeft}
            title="Solicitar Traslado"
            description={
              transferProduct?.name
                ? `${transferProduct.name} no tiene stock en esta bodega pero está disponible en otras.`
                : "No hay stock en esta bodega; el producto está disponible en otras."
            }
          />
          <div className="space-y-4">
            {transferProduct && (
              <div className="p-3 bg-muted rounded-md">
                <p className="font-medium">{transferProduct.name}</p>
                <p className="text-sm text-muted-foreground">Stock en otras bodegas:</p>
                {getOtherWarehouseStock(transferProduct.product_id, selectedWarehouse).map(s => (
                  <p key={s.warehouse_id} className="text-sm">• {s.warehouse_name}: {s.quantity} unidades</p>
                ))}
              </div>
            )}
            <div>
              <Label>Trasladar desde:</Label>
              <Select value={transferFromWarehouse} onValueChange={setTransferFromWarehouse}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {transferProduct && getOtherWarehouseStock(transferProduct.product_id, selectedWarehouse).map(s => (
                    <SelectItem key={s.warehouse_id} value={s.warehouse_id}>
                      {s.warehouse_name} ({s.quantity} disponibles)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              Se enviará una solicitud de traslado que debe ser aprobada por un supervisor.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransferDialog(false)}>Cancelar</Button>
            <Button onClick={requestTransfer} disabled={!canEditSales}>
              <Truck className="h-4 w-4 mr-2" />
              Solicitar Traslado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manager Authorization Dialog */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent>
          <ContextualDialogHeader
            variant="warning"
            size="hero"
            icon={ShieldCheck}
            title="Autorización de Gerente Requerida"
            description="Los siguientes productos son Solo para llevar y requieren autorización del gerente para ser instalados."
          />
          
          <div className="space-y-4">
            {authProducts.length > 0 && (
              <div className="border rounded-lg p-3 bg-orange-50 dark:bg-orange-950/20">
                <p className="text-sm font-medium mb-2">Productos que requieren autorización:</p>
                <ul className="list-disc list-inside text-sm text-muted-foreground">
                  {authProducts.map((p, idx) => (
                    <li key={idx}>{p.name || p.product_name}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <div>
              <Label>Código de Autorización</Label>
              <Input
                value={managerAuthCode}
                onChange={(e) => setManagerAuthCode(e.target.value.toUpperCase())}
                placeholder="Ingresa el código del gerente"
                className="font-mono"
              />
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={requestManagerAuth} className="flex-1">
                Generar Código (Gerente)
              </Button>
              <Button onClick={submitWithAuth} disabled={!managerAuthCode} className="flex-1">
                Confirmar Venta
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Customer Dialog */}
      <Dialog open={showNewCustomer} onOpenChange={(open) => { setShowNewCustomer(open); if (!open) resetNewCustomerForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Nuevo Cliente
            </DialogTitle>
            <DialogDescription>
              Registra un nuevo cliente y opcionalmente su vehículo.
            </DialogDescription>
          </DialogHeader>
          
          <Tabs value={newCustomerTab} onValueChange={setNewCustomerTab}>
            <TabsContent value="customer" className="space-y-4 mt-4">
              {/* Apellidos */}
              <div>
                <Label>Apellidos *</Label>
                <Input
                  value={newCustomer.last_name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, last_name: e.target.value })}
                  placeholder="Pérez López"
                />
              </div>
              {/* Tax ID */}
              <div>
                <Label>{newCustomer.customer_type === "natural" ? "Cédula" : "RUC"}</Label>
                <Input
                  value={newCustomer.tax_id}
                  onChange={(e) => setNewCustomer({ 
                    ...newCustomer, 
                    tax_id: newCustomer.customer_type === "natural" 
                      ? formatCedula(e.target.value) 
                      : formatRUC(e.target.value)
                  })}
                  placeholder={newCustomer.customer_type === "natural" ? "001-000000-0000A" : "J0000000000000"}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {newCustomer.customer_type === "natural" 
                    ? "Formato: 001-000000-0000A" 
                    : "Formato: J0000000000000"}
                </p>
              </div>
              {/* Phone */}
              <div>
                <Label>Teléfono *</Label>
                <div className="flex gap-2">
                  <Select 
                    value={newCustomer.phone_prefix} 
                    onValueChange={(v) => setNewCustomer({ ...newCustomer, phone_prefix: v })}
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="+505">+505</SelectItem>
                      <SelectItem value="+1">+1</SelectItem>
                      <SelectItem value="+52">+52</SelectItem>
                      <SelectItem value="+57">+57</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: formatPhone(e.target.value) })}
                    placeholder="0000-0000"
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Formato: +505-0000-0000</p>
              </div>
              {/* Email */}
              <div>
                <Label>Email <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                  placeholder="cliente@email.com"
                />
              </div>
              {/* Address */}
              <div>
                <Label>Dirección <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                  placeholder="Dirección del cliente"
                />
              </div>
              {/* Credit Limit */}
              <div>
                <Label>Límite de Crédito (C$)</Label>
                <Input
                  type="number"
                  min="0"
                  value={newCustomer.credit_limit}
                  onChange={(e) => setNewCustomer({ ...newCustomer, credit_limit: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              {/* Add Vehicle Checkbox */}
              <div className="flex items-center space-x-2 pt-2 border-t">
                <Checkbox
                  id="add-vehicle-sale"
                  checked={newCustomer.add_vehicle}
                  onCheckedChange={(checked) => {
                    setNewCustomer({ ...newCustomer, add_vehicle: checked });
                    if (checked) setNewCustomerTab("vehicle");
                  }}
                />
                <Label htmlFor="add-vehicle-sale" className="cursor-pointer">
                  Registrar vehículo del cliente
                </Label>
              </div>
            </TabsContent>

            <TabsContent value="vehicle" className="space-y-4 mt-4">
              {/* Plate */}
              <div>
                <Label>Placa *</Label>
                <div className="flex gap-2">
                  <Select 
                    value={newCustomer.plate_prefix} 
                    onValueChange={(v) => setNewCustomer({ ...newCustomer, plate_prefix: v, plate_number: "" })}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLATE_PREFIXES.map(prefix => (
                        <SelectItem key={prefix} value={prefix}>{prefix}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={newCustomer.plate_number}
                    onChange={(e) => setNewCustomer({ 
                      ...newCustomer, 
                      plate_number: formatPlateNumber(newCustomer.plate_prefix, e.target.value)
                    })}
                    placeholder={newCustomer.plate_prefix === "M" ? "123 456" : "12345"}
                    className="flex-1 font-mono"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {newCustomer.plate_prefix === "M" 
                    ? "Formato: M 123 456 (6 dígitos)" 
                    : `Formato: ${newCustomer.plate_prefix} 12345 (4-5 dígitos)`}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Marca *</Label>
                  <SearchableSelect
                    value={newCustomer.brand}
                    onChange={(v) => setNewCustomer({ ...newCustomer, brand: v, year: "", model: "" })}
                    options={VEHICLE_CATALOG_BRANDS}
                    placeholder="Seleccionar marca"
                    searchPlaceholder="Buscar marca..."
                  />
                </div>

                <div>
                  <Label>Año *</Label>
                  <SearchableSelect
                    value={String(newCustomer.year || "")}
                    onChange={(v) => setNewCustomer({ ...newCustomer, year: v, model: "" })}
                    options={newCustomerYearOptions}
                    placeholder="Seleccionar año"
                    searchPlaceholder="Buscar año..."
                    disabled={!newCustomer.brand}
                  />
                </div>

                <div>
                  <Label>Modelo *</Label>
                  <SearchableSelect
                    value={newCustomer.model}
                    onChange={(v) => setNewCustomer({ ...newCustomer, model: v })}
                    options={newCustomerModelOptions}
                    placeholder="Seleccionar modelo"
                    searchPlaceholder="Buscar modelo..."
                    disabled={!newCustomer.brand || !newCustomer.year}
                  />
                </div>
              </div>

              <div>
                <Label>Color</Label>
                <Input
                  list="sales-new-customer-color-options"
                  value={newCustomer.color}
                  onChange={(e) => setNewCustomer({ ...newCustomer, color: e.target.value })}
                  placeholder="Escribe para sugerencias de color"
                />
                <datalist id="sales-new-customer-color-options">
                  {VEHICLE_COLOR_SUGGESTIONS.map((color) => (
                    <option key={color} value={color} />
                  ))}
                </datalist>
              </div>

              {/* Chasis */}
              <div>
                <Label>CHASIS (VIN)</Label>
                <Input
                  value={newCustomer.chasis}
                  onChange={(e) => setNewCustomer({ ...newCustomer, chasis: formatChasis(e.target.value) })}
                  placeholder="1HGBH41JXMN109186"
                  className="font-mono"
                  maxLength={17}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  17 caracteres alfanuméricos (sin I, O, Q, Ñ). {newCustomer.chasis.length}/17
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <Button onClick={createNewCustomer} className="w-full mt-4" disabled={!canCreateCustomers}>
            {newCustomer.add_vehicle ? "Crear Cliente y Vehículo" : "Crear Cliente"}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={showPrintPrompt} onOpenChange={setShowPrintPrompt}>
        <DialogContent>
          {(() => {
            const msg = getDialogMessage("sale.print_receipt");
            return (
              <>
                <ContextualDialogHeader
                  variant={msg.variant || "information"}
                  size="hero"
                  icon={Printer}
                  title={msg.title || "Imprimir comprobante"}
                  description={
                    isSellerOnly
                      ? (msg.description_seller || msg.description)
                      : (msg.description_other || msg.description)
                  }
                />
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={isSellerOnly ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => {
                        if (printSaleData?.sale_id) {
                          printThermalSale(printSaleData.sale_id);
                        }
                        setShowPrintPrompt(false);
                      }}
                    >
                      {msg.primary_label || "Voucher térmico 80mm"}
                    </Button>
                    {!isSellerOnly && canPrintLetterInvoice(user?.role, printSaleData) ? (
                      <Button
                        className="flex-1"
                        onClick={() => {
                          if (printSaleData?.sale_id) {
                            openInvoicePdf(printSaleData.sale_id, printSaleData);
                          }
                          setShowPrintPrompt(false);
                        }}
                      >
                        {msg.secondary_label || "PDF membretado"}
                      </Button>
                    ) : null}
                    {!isSellerOnly && (printSaleData?.payment_status === "partial" || Number(printSaleData?.amount_paid || 0) > 0) ? (
                      <Button
                        variant="secondary"
                        className="w-full"
                        onClick={() => {
                          if (printSaleData?.sale_id) {
                            openPaymentReceiptPdf(printSaleData.sale_id);
                          }
                          setShowPrintPrompt(false);
                        }}
                      >
                        {msg.tertiary_label || "Comprobante de abono"}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <SalePaymentPlanDialog
        sale={paymentPlanDialogSale}
        open={paymentPlanDialogOpen}
        onOpenChange={setPaymentPlanDialogOpen}
        onSaved={handlePaymentPlanSaved}
      />

      <SaleOperationalAuditDialog
        sale={auditDialogSale}
        open={auditDialogOpen}
        onOpenChange={setAuditDialogOpen}
      />
      </>
      )}
    </div>
  );
}
