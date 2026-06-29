import { isErpDraftSupervisor, isOwnErpDraft } from "@/lib/erpDesignSystem";
import { normalizeDraftReview } from "@/lib/draftReview";
import { releaseServerDraft } from "@/lib/serverDrafts";

/**
 * Libera un borrador ajeno que supervisión ya modificó, típico al usar Guardar y Limpiar.
 */
export async function releaseWatchedDraftIfNeeded({
  flow,
  tab,
  review,
  userRole,
  userId,
}) {
  const normalized = normalizeDraftReview(review || tab?.review);
  const shouldRelease = Boolean(
    isErpDraftSupervisor(userRole)
    && tab
    && !isOwnErpDraft(tab, userId)
    && normalized.supervisor_changed
    && ["watching", "blocked"].includes(normalized.status),
  );
  if (!shouldRelease) {
    return null;
  }
  return releaseServerDraft(flow, tab.id);
}