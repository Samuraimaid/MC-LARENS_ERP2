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

const TOAST_DURATION_MS = {
  success: 4000,
  info: 4000,
  message: 4000,
  warning: 6000,
  error: 8000,
  loading: 4000,
};

const recentToasts = new Map();

function toastDedupeKey(type, message, opts) {
  const description = opts && typeof opts === "object" && opts.description != null
    ? String(sanitizeToastValue(opts.description))
    : "";
  return `${type}|${String(message)}|${description}`;
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
          : (opts && typeof opts === "object" ? { ...opts } : opts);
        const key = toastDedupeKey(m, cleanMsg, cleanOpts);
        const now = Date.now();
        const recent = recentToasts.get(key);
        if (recent && now - recent.at < 2000) return recent.id;
        const duration = cleanOpts && typeof cleanOpts === "object" && cleanOpts.duration != null
          ? cleanOpts.duration
          : (TOAST_DURATION_MS[m] ?? 4000);
        const id = orig(cleanMsg, {
          ...(cleanOpts && typeof cleanOpts === "object" ? cleanOpts : {}),
          duration,
          style: {
            ...(cleanOpts && typeof cleanOpts === "object" ? cleanOpts.style : {}),
            "--erp-toast-ms": typeof duration === "number" ? `${duration}ms` : "4s",
          },
        });
        recentToasts.set(key, { at: now, id });
        return id;
      };
    }
  });
} catch (e) {
  // ignore
}

const Toaster = ({ richColors: _richColors, position = "top-right", ...props }) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme}
      position={position}
      visibleToasts={3}
      closeButton
      duration={4000}
      gap={8}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast relative overflow-hidden group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          title: "group-[.toast]:text-sm group-[.toast]:font-semibold",
          description: "group-[.toast]:text-muted-foreground truncate max-w-[16rem]",
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
