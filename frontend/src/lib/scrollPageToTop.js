export const scrollToAnchor = ({ anchorRef, behavior = "smooth", block = "center" } = {}) => {
  if (typeof window === "undefined" || !anchorRef?.current) return;

  window.requestAnimationFrame(() => {
    anchorRef.current.scrollIntoView({ behavior, block, inline: "nearest" });

    const main = document.querySelector("main.flex-1.overflow-auto");
    if (!main || !anchorRef.current) return;

    const rect = anchorRef.current.getBoundingClientRect();
    const mainRect = main.getBoundingClientRect();
    if (rect.top >= mainRect.top && rect.bottom <= mainRect.bottom) return;

    const offset = anchorRef.current.offsetTop - main.offsetTop - 32;
    main.scrollTo({ top: Math.max(0, offset), behavior });
  });
};

export const scrollPageToTop = ({ behavior = "smooth", anchorRef = null } = {}) => {
  if (typeof window === "undefined") return;

  window.requestAnimationFrame(() => {
    if (anchorRef?.current) {
      anchorRef.current.scrollIntoView({ behavior, block: "start" });
    }

    const main = document.querySelector("main.flex-1.overflow-auto");
    if (main) {
      main.scrollTo({ top: 0, behavior });
      return;
    }

    window.scrollTo({ top: 0, behavior });
  });
};