import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { fetchServerDraftBundle } from "@/lib/serverDrafts";
import { getDraftSnapshotFingerprint, mirrorServerDraftsToLocalStorage } from "@/lib/draftStorage";
import {
  detectReviewTransition,
  mergeDraftTabsWithReview,
  normalizeDraftReview,
} from "@/lib/draftReview";

/**
 * Module-level baselines survive React remounts / Workbench tab churn.
 * Without this, every remount looks like idle→released and spams toasts.
 */
const GLOBAL_REVIEW_BASELINE = new Map(); // key → { status, released_at, fingerprint }
const GLOBAL_RELEASE_TOASTED = new Set(); // key → already notified for this release event
const RELEASE_STORAGE_KEY = "erp_draft_release_toasts_v1";

function baselineKey(userId, flow, draftId) {
  return `${String(userId || "")}|${String(flow || "")}|${String(draftId || "")}`;
}

function releaseEventKey(userId, flow, draftId, releasedAt) {
  return `${baselineKey(userId, flow, draftId)}|${String(releasedAt || "released")}`;
}

function loadReleasedToastMemory() {
  try {
    const raw = sessionStorage.getItem(RELEASE_STORAGE_KEY);
    if (!raw) return;
    const list = JSON.parse(raw);
    if (Array.isArray(list)) {
      list.forEach((key) => GLOBAL_RELEASE_TOASTED.add(String(key)));
    }
  } catch {
    // ignore
  }
}

function rememberReleasedToast(eventKey) {
  GLOBAL_RELEASE_TOASTED.add(eventKey);
  try {
    const next = Array.from(GLOBAL_RELEASE_TOASTED).slice(-80);
    sessionStorage.setItem(RELEASE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

loadReleasedToastMemory();

/** Only notify when supervision actually finishes a review cycle */
function isActionableReleaseTransition(prevStatus, nextStatus) {
  if (nextStatus !== "released") return false;
  return prevStatus === "blocked" || prevStatus === "watching";
}

/**
 * Poll draft review state for the current user.
 * - First observation only seeds baseline (no toast).
 * - Release toasts only for blocked/watching → released.
 * - Deduped globally per release event (session).
 */
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
  const activeDraftIdRef = useRef(activeDraftId);
  const showFormRef = useRef(showForm);
  const onServerSnapshotChangedRef = useRef(onServerSnapshotChanged);
  const pollGenerationRef = useRef(0);

  useEffect(() => {
    activeDraftIdRef.current = activeDraftId;
  }, [activeDraftId]);

  useEffect(() => {
    showFormRef.current = showForm;
  }, [showForm]);

  useEffect(() => {
    onServerSnapshotChangedRef.current = onServerSnapshotChanged;
  }, [onServerSnapshotChanged]);

  useEffect(() => {
    if (!draftsLoaded || !user?.user_id) return undefined;

    let cancelled = false;
    const generation = ++pollGenerationRef.current;
    const userId = String(user.user_id || "");

    const poll = async () => {
      try {
        const bundle = await fetchServerDraftBundle(flow);
        // Ignore stale responses from cancelled effect generations
        if (cancelled || generation !== pollGenerationRef.current) return;

        const serverDrafts = Array.isArray(bundle?.drafts) ? bundle.drafts : [];
        const releaseBatch = [];

        serverDrafts.forEach((draft) => {
          const draftId = String(draft?.id || "").trim();
          if (!draftId) return;

          const isOwn = String(draft.owner_user_id || "") === userId;
          if (!isOwn) return;

          const nextReview = normalizeDraftReview(draft.review);
          const nextFingerprint = getDraftSnapshotFingerprint(draft.snapshot);
          const key = baselineKey(userId, flow, draftId);
          const prev = GLOBAL_REVIEW_BASELINE.get(key);

          // First observation: seed only
          if (!prev) {
            GLOBAL_REVIEW_BASELINE.set(key, {
              status: nextReview.status,
              released_at: nextReview.released_at || null,
              fingerprint: nextFingerprint,
            });
            return;
          }

          const prevStatus = String(prev.status || "idle");
          const transition = detectReviewTransition(
            { status: prevStatus },
            nextReview,
          );

          if (transition === "blocked") {
            toast.warning(
              "Tu borrador fue bloqueado: supervisión está revisando cambios. El formulario se ocultó hasta que lo liberen.",
              {
                id: `draft-blocked-${draftId}`,
                duration: 7000,
              },
            );
            // Hide form so seller doesn't keep editing a locked draft.
            // Recovery: "Mostrar formulario" / "Abrir borrador" when released.
            if (activeDraftIdRef.current === draftId && showFormRef.current) {
              setShowForm(false);
            }
          } else if (isActionableReleaseTransition(prevStatus, nextReview.status)) {
            const eventKey = releaseEventKey(
              userId,
              flow,
              draftId,
              nextReview.released_at || nextReview.released_by_user_id || Date.now(),
            );
            if (!GLOBAL_RELEASE_TOASTED.has(eventKey)) {
              rememberReleasedToast(eventKey);
              releaseBatch.push(draftId);
            }
            // Auto re-open form for the active draft so sellers are not left
            // on a board-only screen without a recovery control.
            if (typeof setShowForm === "function" && activeDraftIdRef.current === draftId) {
              setShowForm(true);
            }
          } else if (transition === "unblocked" && prevStatus === "blocked") {
            toast.success("Tu borrador ya no está en revisión. Puedes abrir el formulario de nuevo.", {
              id: `draft-unblocked-${draftId}`,
              duration: 5000,
            });
            if (typeof setShowForm === "function" && activeDraftIdRef.current === draftId) {
              setShowForm(true);
            }
          }

          const prevFingerprint = prev.fingerprint;
          const supervisorSnapshotUpdate = nextReview.status === "blocked"
            || (nextReview.status === "released" && nextReview.supervisor_changed);
          if (
            prevFingerprint
            && prevFingerprint !== nextFingerprint
            && supervisorSnapshotUpdate
            && prevStatus !== "idle"
          ) {
            toast.info("Supervisión actualizó el contenido de tu borrador.", {
              id: `draft-snapshot-${draftId}`,
              duration: 4000,
            });
            if (typeof onServerSnapshotChangedRef.current === "function") {
              onServerSnapshotChangedRef.current(draftId, draft.snapshot);
            }
          }

          GLOBAL_REVIEW_BASELINE.set(key, {
            status: nextReview.status,
            released_at: nextReview.released_at || null,
            fingerprint: nextFingerprint,
          });
        });

        // One toast even if several drafts released in the same poll tick
        if (releaseBatch.length === 1) {
          toast.success("Tu borrador fue liberado por supervisión. Ya puedes abrirlo de nuevo.", {
            id: "draft-released-batch",
            duration: 5000,
          });
        } else if (releaseBatch.length > 1) {
          toast.success(
            `${releaseBatch.length} borradores fueron liberados por supervisión. Ya puedes abrirlos de nuevo.`,
            {
              id: "draft-released-batch",
              duration: 5000,
            },
          );
        }

        // Drop baselines for drafts that no longer exist for this user/flow
        const liveKeys = new Set(
          serverDrafts
            .filter((d) => String(d?.owner_user_id || "") === userId && d?.id)
            .map((d) => baselineKey(userId, flow, d.id)),
        );
        for (const key of GLOBAL_REVIEW_BASELINE.keys()) {
          if (key.startsWith(`${userId}|${flow}|`) && !liveKeys.has(key)) {
            GLOBAL_REVIEW_BASELINE.delete(key);
          }
        }

        setDraftTabs((currentTabs) => {
          const merged = mergeDraftTabsWithReview(serverDrafts, currentTabs);
          mirrorServerDraftsToLocalStorage({
            listKey,
            activeKey,
            draftKeyPrefix,
            drafts: serverDrafts,
            activeDraftId: bundle.activeDraftId || activeDraftIdRef.current,
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
    activeKey,
    draftKeyPrefix,
    draftsLoaded,
    flow,
    listKey,
    setDraftTabs,
    setShowForm,
    user?.user_id,
  ]);
}
