import React, { useMemo } from "react";
import { Clock, Eye, Lock, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErpRollingCurrency } from "@/components/erp/ErpRollingNumber";
import { cn } from "@/lib/utils";
import { VehicleThumbnailWatermark } from "@/components/erp/VehicleThumbnailWatermark";

const DRAFT_SUPERVISOR_ROLES = new Set([
  "gerencia",
  "supervisor",
  "jefe_vendedores",
  "jefe_tienda",
  "recursos_humanos",
]);

const DRAFT_TONES = {
  draftOwn: "border-border",
  draftOther: "border-dashed border-amber-400/60 dark:border-amber-500/40",
  draftBlocked: "opacity-55 saturate-50 pointer-events-none border-amber-300/70 dark:border-amber-500/40",
  draftReleased: "border-violet-300/60 dark:border-violet-500/35",
  reviewBadge: "border-amber-400/60 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-100",
  releasedBadge: "border-violet-400/50 bg-violet-50 text-violet-900 dark:border-violet-500/35 dark:bg-violet-500/10 dark:text-violet-100",
};

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

function resolveVehicleIdentity(label) {
  const text = String(label || "").trim();
  if (!text) return null;
  const head = text.split(/[•·|]/)[0].trim();
  const parts = head.split(/\s+/).filter((p) => p && !/^[•·|]+$/.test(p));
  if (parts.length < 2) return { brand: parts[0] || "", model: parts.slice(1).join(" ") };
  const yearIdx = parts.findIndex((p) => /^\d{4}$/.test(p));
  if (yearIdx > 0) {
    return {
      brand: parts[0],
      model: parts.slice(1, yearIdx).join(" ") || parts[1],
      year: parts[yearIdx],
    };
  }
  return { brand: parts[0], model: parts.slice(1).join(" ") };
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
  nowMs = Date.now(),
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
  const relativeTime = formatRelativeTime(meta?.updatedAt, nowMs);
  const hasPreviewItems = Boolean(meta?.previewItems?.length);
  const subtitle = cleanSubtitle(meta?.title, meta?.subtitle);

  const watermarkVehicle = useMemo(() => {
    const record = meta?.previewVehicleRecord;
    if (record && (record.brand || record.model)) {
      return {
        brand: record.brand,
        model: record.model,
        year: record.year,
        descriptor: record.descriptor,
        vehicle_cab_variant: record.vehicle_cab_variant,
      };
    }
    return resolveVehicleIdentity(meta?.previewVehicle);
  }, [meta?.previewVehicle, meta?.previewVehicleRecord]);

  let statusLabel = null;
  let StatusIcon = null;
  let statusClassName = "";
  if (isBlocked) {
    statusLabel = "En revisión";
    StatusIcon = Eye;
    statusClassName = DRAFT_TONES.reviewBadge;
  } else if (isReleasedRestricted) {
    statusLabel = "Liberado";
    StatusIcon = Lock;
    statusClassName = DRAFT_TONES.releasedBadge;
  } else if (isSupervisorTouched) {
    statusLabel = "Revisado";
    StatusIcon = Lock;
    statusClassName =
      "border-sky-400/50 bg-sky-50 text-sky-900 dark:border-sky-500/35 dark:bg-sky-500/10 dark:text-sky-100";
  } else if (isActive) {
    statusLabel = "Activo";
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
    <Card
      className={cn(
        "relative overflow-hidden transition",
        isBlocked
          ? DRAFT_TONES.draftBlocked
          : isReleasedRestricted
            ? DRAFT_TONES.draftReleased
            : isActive
              ? "border-primary"
              : isOwn
                ? DRAFT_TONES.draftOwn
                : DRAFT_TONES.draftOther
      )}
      title={
        isBlocked
          ? "En revisión por supervisión"
          : !isOwn && meta?.sellerName
            ? `Borrador de ${meta.sellerName}`
            : undefined
      }
    >
      <VehicleThumbnailWatermark vehicle={watermarkVehicle} />
      <CardContent className="relative p-0">
        <div
          role="button"
          tabIndex={isBlocked ? -1 : 0}
          className="block"
          onClick={handleOpen}
          onKeyDown={(e) => {
            if (isBlocked) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpen?.();
            }
          }}
        >
          <div className="p-3 space-y-2">
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
                <Badge variant="outline" className={cn("gap-1", statusClassName)}>
                  {StatusIcon ? <StatusIcon className="h-3 w-3" /> : null}
                  {statusLabel}
                </Badge>
              ) : null}
              {meta?.currency ? <Badge variant="secondary">{meta.currency}</Badge> : null}
              {!isOwn && meta?.sellerName ? (
                <Badge
                  variant="outline"
                  className="max-w-[9rem] gap-1 border-muted-foreground/25 bg-muted/40 text-muted-foreground"
                  title={meta.sellerName}
                >
                  <User className="h-3 w-3 shrink-0" />
                  <span className="truncate">{meta.sellerName}</span>
                </Badge>
              ) : null}
              {relativeTime ? (
                <Badge variant="outline" className="gap-1 text-[10px] font-normal text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {relativeTime}
                </Badge>
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
                <ErpRollingCurrency value={meta?.total || 0} currency={meta?.currency || "NIO"} />
              </p>
              {meta?.totalDiscounts > 0 ? (
                <p className="text-[11px] text-green-700 dark:text-green-400 inline-flex items-baseline gap-1">
                  <span>−</span>
                  <ErpRollingCurrency value={meta.totalDiscounts} currency={meta.currency} />
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2 mt-1">
              <Button
                size="sm"
                className={cn(
                  "text-white",
                  isBlocked ? "bg-slate-400 hover:bg-slate-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"
                )}
                disabled={isBlocked}
                title={isBlocked ? "Borrador en revisión por supervisión" : resolvedOpenLabel}
                onClick={handleOpen}
              >
                {resolvedOpenLabel}
              </Button>
              <Button
                size="sm"
                variant="destructive"
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
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default DraftBoardCard;
