import React from "react";
import { Clock, Eye, Lock, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErpRollingCurrency } from "@/components/erp/ErpRollingNumber";
import { cn } from "@/lib/utils";
import { VehicleThumbnailWatermark } from "@/components/erp/VehicleThumbnailWatermark";
import {
  ERP_SEMANTIC_TONES,
  formatErpRelativeTime,
  isErpDraftSupervisor,
  isOwnErpDraft,
} from "@/lib/erpDesignSystem";
import {
  canSellerDeleteDraft,
  isDraftBlockedForSeller,
  isDraftReleasedWithRestrictions,
  isDraftSupervisorTouched,
} from "@/lib/draftReview";

export default function DraftBoardCard({
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
  const isOwn = isOwnErpDraft(tab, currentUserId);
  const isSupervisorViewer = isErpDraftSupervisor(currentUserRole);
  const resolvedOpenLabel = isSupervisorViewer && !isOwn ? "Editar borrador" : openLabel;
  const review = tab?.review || meta?.review || null;
  const isBlocked = isOwn && isDraftBlockedForSeller(review);
  const isReleasedRestricted = isOwn && isDraftReleasedWithRestrictions(review);
  const isSupervisorTouched = isOwn && isDraftSupervisorTouched(review);
  const canDelete = canSellerDeleteDraft(tab, review, currentUserId, currentUserRole);
  const deleteDisabled = isBlocked || !canDelete;
  const relativeTime = formatErpRelativeTime(meta?.updatedAt, nowMs);
  const hasPreviewItems = Boolean(meta?.previewItems?.length);

  const handleOpen = (event) => {
    event?.stopPropagation?.();
    if (isBlocked) return;
    onOpen?.();
  };

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition",
        isBlocked
          ? ERP_SEMANTIC_TONES.draftBlocked
          : isReleasedRestricted
            ? ERP_SEMANTIC_TONES.draftReleased
            : isActive
              ? "border-primary"
              : isOwn
                ? ERP_SEMANTIC_TONES.draftOwn
                : ERP_SEMANTIC_TONES.draftOther
      )}
      title={
        isBlocked
          ? "En revisión por supervisión"
          : !isOwn && meta?.sellerName
            ? `Borrador de ${meta.sellerName}`
            : undefined
      }
    >
      <VehicleThumbnailWatermark vehicle={meta?.previewVehicleRecord} />
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
                <p className="text-sm font-semibold line-clamp-2 leading-tight">{meta?.title || "Sin cliente"}</p>
                <p className="text-[11px] text-muted-foreground truncate">{meta?.subtitle}</p>
              </div>
              <p className="shrink-0 text-[11px] text-muted-foreground">{meta?.itemsCount ?? 0} ítems</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isBlocked ? (
                <Badge variant="outline" className={cn("gap-1", ERP_SEMANTIC_TONES.reviewBadge)}>
                  <Eye className="h-3 w-3" />
                  En Revisión
                </Badge>
              ) : (
                <Badge variant="outline">{isActive ? "Activo" : "Borrador"}</Badge>
              )}
              {isReleasedRestricted ? (
                <Badge variant="outline" className={cn("gap-1", ERP_SEMANTIC_TONES.releasedBadge)}>
                  <Lock className="h-3 w-3" />
                  Liberado
                </Badge>
              ) : null}
              {isSupervisorTouched && !isBlocked ? (
                <Badge variant="outline" className="gap-1 border-sky-400/50 bg-sky-50 text-sky-900 dark:border-sky-500/35 dark:bg-sky-500/10 dark:text-sky-100">
                  <Lock className="h-3 w-3" />
                  Revisado
                </Badge>
              ) : null}
              <Badge variant="secondary">{meta?.currency}</Badge>
              {meta?.sellerName ? (
                <Badge
                  variant="outline"
                  className="max-w-full gap-1 border-muted-foreground/25 bg-muted/40 text-muted-foreground"
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

            <p className={cn("text-[11px]", hasPreviewItems ? "text-muted-foreground" : "italic text-muted-foreground/80")}>
              {hasPreviewItems ? meta.previewItems.join(" · ") : emptyProductsLabel}
            </p>

            {meta?.previewVehicle ? (
              <p className="text-[11px] text-muted-foreground">Vehículo: {meta.previewVehicle}</p>
            ) : null}

            <div className="space-y-1 rounded-md border border-dashed border-border/70 bg-muted/20 p-2">
              <p className="text-xs font-semibold inline-flex items-baseline gap-1">
                <span>Total:</span>
                <ErpRollingCurrency value={meta?.total || 0} currency={meta?.currency || "NIO"} />
              </p>
              {meta?.totalDiscounts > 0 ? (
                <p className="text-[11px] text-green-700 dark:text-green-400 inline-flex items-baseline gap-1">
                  <span>Descuentos:</span>
                  <ErpRollingCurrency value={meta.totalDiscounts} currency={meta.currency} prefix="-" />
                </p>
              ) : null}
              {meta?.retention > 0 ? (
                <p className="text-[11px] text-orange-600 dark:text-orange-400 inline-flex items-baseline gap-1">
                  <span>Retención IR ({meta.retentionRate}%):</span>
                  <ErpRollingCurrency value={meta.retention} currency={meta.currency} prefix="-" />
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2 mt-2">
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