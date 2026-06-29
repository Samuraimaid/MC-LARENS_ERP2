import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { fetchServerDraftBundle } from "@/lib/serverDrafts";
import { getDraftSnapshotFingerprint, mirrorServerDraftsToLocalStorage } from "@/lib/draftStorage";
import {
  detectReviewTransition,
  mergeDraftTabsWithReview,
  normalizeDraftReview,
} from "@/lib/draftReview";

export function useDraftReviewPolling({
  flow,
  user,
  draftsLoaded,
  activeDraftId,
  showForm,
  setDraftTabs,
  setShowForm,
  listKey,
  activeKey,
  draftKeyPrefix,
  onServerSnapshotChanged = null,
}) {
  const prevReviewRef = useRef(new Map());
  const snapshotFingerprintRef = useRef(new Map());

  useEffect(() => {
    if (!draftsLoaded || !user?.user_id) return undefined;

    let cancelled = false;

    const poll = async () => {
      try {
        const bundle = await fetchServerDraftBundle(flow);
        if (cancelled) return;

        const serverDrafts = Array.isArray(bundle?.drafts) ? bundle.drafts : [];
        serverDrafts.forEach((draft) => {
          const isOwn = String(draft.owner_user_id || "") === String(user.user_id || "");
          if (!isOwn) return;

          const prev = prevReviewRef.current.get(draft.id);
          const nextReview = normalizeDraftReview(draft.review);
          const transition = detectReviewTransition(prev, nextReview);

          if (transition === "blocked") {
            toast.warning("Tu borrador fue bloqueado: supervisión está revisando cambios.", {
              duration: 6000,
            });
            if (activeDraftId === draft.id && showForm) {
              setShowForm(false);
            }
          } else if (transition === "released") {
            toast.success("Tu borrador fue liberado por supervisión. Ya puedes abrirlo de nuevo.", {
              duration: 5000,
            });
          } else if (transition === "unblocked" && prev?.status === "blocked") {
            toast.success("Tu borrador ya no está en revisión.", { duration: 4000 });
          }

          const nextFingerprint = getDraftSnapshotFingerprint(draft.snapshot);
          const prevFingerprint = snapshotFingerprintRef.current.get(draft.id);
          const supervisorSnapshotUpdate = nextReview.status === "blocked"
            || (nextReview.status === "released" && nextReview.supervisor_changed);
          if (prevFingerprint && prevFingerprint !== nextFingerprint && supervisorSnapshotUpdate) {
            toast.info("Supervisión actualizó el contenido de tu borrador.", { duration: 4000 });
            if (typeof onServerSnapshotChanged === "function") {
              onServerSnapshotChanged(draft.id, draft.snapshot);
            }
          }
          snapshotFingerprintRef.current.set(draft.id, nextFingerprint);
          prevReviewRef.current.set(draft.id, nextReview);
        });

        setDraftTabs((currentTabs) => {
          const merged = mergeDraftTabsWithReview(serverDrafts, currentTabs);
          mirrorServerDraftsToLocalStorage({
            listKey,
            activeKey,
            draftKeyPrefix,
            drafts: serverDrafts,
            activeDraftId: bundle.activeDraftId || activeDraftId,
            allowEmptyOverwrite: true,
          });
          return merged;
        });
      } catch (error) {
        // keep local state if polling fails
      }
    };

    poll();
    const intervalId = window.setInterval(poll, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    activeDraftId,
    activeKey,
    draftKeyPrefix,
    draftsLoaded,
    flow,
    listKey,
    setDraftTabs,
    setShowForm,
    showForm,
    onServerSnapshotChanged,
    user?.user_id,
  ]);
}