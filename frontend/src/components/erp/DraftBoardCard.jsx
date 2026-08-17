import React from "react";
import { formatCurrency } from "@/lib/utils";

const DRAFT_SUPERVISOR_ROLES = new Set([
  "gerencia",
  "supervisor",
  "jefe_vendedores",
  "jefe_tienda",
  "recursos_humanos",
]);

function formatRelativeTime(isoDate, nowMs = Date.now()) {
  if (!isoDate) return null;
  const parsed = new Date(isoDate).getTime();
  if (!Number.isFinite(parsed)) return null;
  const diffMs = Math.max(0, nowMs - parsed);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

function cleanSubtitle(title, subtitle) {
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

export function DraftBoardCard({
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
  const isSupervisorViewer = DRAFT_SUPERVISOR_ROLES.has(String(currentUserRole || "").toLowerCase());
  const resolvedOpenLabel = isSupervisorViewer && !isOwn ? "Editar borrador" : openLabel;
  const review = tab?.review || meta?.review || null;
  const reviewStatus = String(review?.status || "idle").toLowerCase();
  const supervisorChanged = Boolean(review?.supervisor_changed);
  const isBlocked = isOwn && reviewStatus === "blocked";
  const isReleasedRestricted = isOwn && reviewStatus === "released" && supervisorChanged;
  const isSupervisorTouched = isOwn && supervisorChanged;

  const canDelete = isSupervisorViewer ? true : (!isOwn ? false : !supervisorChanged);
  const deleteDisabled = isBlocked || !canDelete;
  const relativeTime = formatRelativeTime(meta?.updatedAt);
  const hasPreviewItems = Boolean(meta?.previewItems?.length);
  const subtitle = cleanSubtitle(meta?.title, meta?.subtitle);

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

export default DraftBoardCard;
