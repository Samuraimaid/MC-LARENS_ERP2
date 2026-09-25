import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AnimatedChevronUpIcon } from "@/components/lists/animatedListIcons";

const DEFAULT_THRESHOLD = 400;

function resolveScrollRoot(scrollRoot) {
  if (typeof scrollRoot === "string") {
    return document.querySelector(scrollRoot);
  }
  if (scrollRoot && scrollRoot.current) return scrollRoot.current;
  if (scrollRoot instanceof Element) return scrollRoot;
  return document.querySelector("main.erp-shell-main") || window;
}

function getScrollTop(root) {
  if (!root || root === window) {
    return window.scrollY || document.documentElement.scrollTop || 0;
  }
  return root.scrollTop || 0;
}

/**
 * Botón flotante "Volver al inicio" — visible tras ~400px de scroll.
 * Apunta al contenedor de lista o a `main.erp-shell-main` / window.
 */
export function BackToTopButton({
  scrollRoot,
  threshold = DEFAULT_THRESHOLD,
  className,
  label = "Volver al inicio",
  testId = "back-to-top",
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const root = resolveScrollRoot(scrollRoot);
    const onScroll = () => {
      setVisible(getScrollTop(root) >= threshold);
    };
    onScroll();
    const target = root === window ? window : root;
    if (!target) return undefined;
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, [scrollRoot, threshold]);

  const handleClick = useCallback(() => {
    const root = resolveScrollRoot(scrollRoot);
    if (!root || root === window) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (typeof root.scrollTo === "function") {
      root.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      root.scrollTop = 0;
    }
  }, [scrollRoot]);

  if (!visible) return null;

  return (
    <Button
      type="button"
      size="icon"
      variant="secondary"
      onClick={handleClick}
      title={label}
      aria-label={label}
      data-testid={testId}
      className={cn(
        "fixed bottom-20 right-4 z-40 h-11 w-11 rounded-full border border-border/60 bg-card/90 shadow-lg backdrop-blur-md",
        "hover:bg-primary hover:text-primary-foreground ui-interactive",
        "md:bottom-6 md:right-6",
        className
      )}
    >
      <AnimatedChevronUpIcon className="h-5 w-5" />
      <span className="sr-only">{label}</span>
    </Button>
  );
}

export default BackToTopButton;
