import { useState, useEffect } from "react";

function getDeviceState() {
  if (typeof window === "undefined") {
    return {
      isPhone: false,
      isTablet: false,
      isDesktop: true,
      isPortrait: false,
      isLandscape: true,
      isTouchDevice: false,
      viewportWidth: 1440,
      viewportHeight: 900,
    };
  }
  const w = window.innerWidth;
  const h = window.innerHeight;
  return {
    // < 640px portrait phone
    isPhone: w < 640,
    // 640–1023px tablet or phone landscape
    isTablet: w >= 640 && w < 1024,
    // >= 1024px desktop
    isDesktop: w >= 1024,
    isPortrait: h > w,
    isLandscape: w >= h,
    isTouchDevice: navigator.maxTouchPoints > 0,
    viewportWidth: w,
    viewportHeight: h,
  };
}

/**
 * Reactive hook that returns device/orientation info.
 * Updates on resize and orientationchange.
 */
export function useDevice() {
  const [state, setState] = useState(getDeviceState);

  useEffect(() => {
    const update = () => setState(getDeviceState());
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return state;
}
