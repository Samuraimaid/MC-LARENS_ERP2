import React from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, toast as rawToast } from "sonner";

export function sanitizeToastValue(val) {
  if (val == null) return "";
  if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
    return val;
  }
  if (React.isValidElement(val)) {
    return val;
  }
  if (typeof val === "object") {
    if (typeof val.message === "string") return val.message;
    if (typeof val.detail === "string") return val.detail;
    if (typeof val.detail?.message === "string") return val.detail.message;
    if (typeof val.error === "string") return val.error;
    if (typeof val.title === "string") return val.title;
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  }
  return String(val);
}

// Monkey-patch rawToast in-place so all files importing `toast` from "sonner" or "@/components/ui/sonner" are automatically protected
try {
  const methodsToWrap = ["error", "success", "warning", "info", "message", "loading"];
  methodsToWrap.forEach((m) => {
    if (typeof rawToast[m] === "function") {
      const orig = rawToast[m];
      rawToast[m] = (msg, opts) => {
        const cleanMsg = sanitizeToastValue(msg);
        const cleanOpts = opts && typeof opts === "object" && opts.description
          ? { ...opts, description: sanitizeToastValue(opts.description) }
          : opts;
        return orig(cleanMsg, cleanOpts);
      };
    }
  });
} catch (e) {
  // ignore
}

const Toaster = ({ ...props }) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, rawToast as toast };
