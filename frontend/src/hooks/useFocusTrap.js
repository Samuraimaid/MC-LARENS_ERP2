import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function listFocusable(root) {
  if (!root) return [];
  return Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => {
    if (el.hasAttribute("disabled") || el.getAttribute("aria-hidden") === "true") return false;
    if (el.closest("[aria-hidden='true']") && !root.contains(el.closest("[aria-hidden='true']")?.parentElement)) {
      return false;
    }
    const style = window.getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") return false;
    return true;
  });
}

/**
 * U9: trap Tab inside a custom modal/overlay and restore focus to the opener on unmount.
 * Radix Dialog/AlertDialog already do this — use for custom overlays only.
 */
export function useFocusTrap(active, containerRef, { onEscape, initialFocusRef } = {}) {
  const previousFocusRef = useRef(null);
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!active) return undefined;
    const node = containerRef?.current;
    if (!node || typeof document === "undefined") return undefined;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusInitial = () => {
      const preferred = initialFocusRef?.current;
      if (preferred && typeof preferred.focus === "function") {
        preferred.focus();
        return;
      }
      const items = listFocusable(node);
      if (items.length > 0) {
        items[0].focus();
        return;
      }
      if (typeof node.focus === "function") {
        if (!node.hasAttribute("tabindex")) node.setAttribute("tabindex", "-1");
        node.focus();
      }
    };

    // Defer so the overlay is in the DOM and painted.
    const raf = window.requestAnimationFrame(focusInitial);

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        if (typeof onEscapeRef.current === "function") {
          event.preventDefault();
          event.stopPropagation();
          onEscapeRef.current(event);
        }
        return;
      }
      if (event.key !== "Tab") return;

      const items = listFocusable(node);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const activeEl = document.activeElement;

      if (event.shiftKey) {
        if (activeEl === first || !node.contains(activeEl)) {
          event.preventDefault();
          last.focus();
        }
      } else if (activeEl === last || !node.contains(activeEl)) {
        event.preventDefault();
        first.focus();
      }
    };

    node.addEventListener("keydown", onKeyDown);

    return () => {
      window.cancelAnimationFrame(raf);
      node.removeEventListener("keydown", onKeyDown);
      const prev = previousFocusRef.current;
      previousFocusRef.current = null;
      if (prev && typeof prev.focus === "function" && document.contains(prev)) {
        try {
          prev.focus();
        } catch {
          // ignore restore failures (detached nodes)
        }
      }
    };
  }, [active, containerRef, initialFocusRef]);
}

export default useFocusTrap;
