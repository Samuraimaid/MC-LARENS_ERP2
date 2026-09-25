import { useCallback, useRef, useState } from "react";
import { optimisticUpdate } from "@/lib/optimisticUpdate";
import { MORPH_TOGGLE_ERROR_ES } from "@/components/common/MorphToggle";

/**
 * U13 — optimistic boolean toggle with pending flag for MorphToggle spinner.
 * Flip UI immediately via `apply`, show pending while `request` runs,
 * rollback + Spanish toast on API error.
 *
 * @param {object} [opts]
 * @param {string} [opts.errorMessage]
 */
export function useOptimisticToggle(opts = {}) {
  const errorMessage = opts.errorMessage || MORPH_TOGGLE_ERROR_ES;
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);

  const run = useCallback(
    async ({ apply, request, rollback, onSuccess }) => {
      if (pendingRef.current) return false;
      pendingRef.current = true;
      setPending(true);
      try {
        return await optimisticUpdate({
          apply,
          request,
          rollback,
          onSuccess,
          errorMessage,
        });
      } finally {
        pendingRef.current = false;
        setPending(false);
      }
    },
    [errorMessage]
  );

  return { pending, run };
}

/**
 * Pure helper (easy to unit-test): geometry / timing contract for U13.
 */
export function morphToggleGeometryContract() {
  return {
    knobDiameter: 20,
    knobRadius: 10,
    railWidth: 40,
    railPadding: 10,
    travel: 20,
    durationMs: 250,
    easing: "ease-out",
    morphProps: ["rail-color", "knob-translateX", "knob-shadow", "label-opacity"],
    errorEs: MORPH_TOGGLE_ERROR_ES,
  };
}
