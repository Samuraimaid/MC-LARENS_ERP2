import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CornerDownLeft, Loader2, Search, ArrowLeft } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { fuzzyFilterItems, splitHighlighted } from "@/lib/fuzzyHighlight";
import { loadRecentCommands, pushRecentCommand } from "@/lib/commandRecent";
import {
  COMMAND_GROUP_LABELS,
  buildAccessibleActions,
  buildAccessiblePages,
  resolveCommandById,
} from "@/lib/commandRegistry";
import { fetchNodeProfile, getCachedNodeProfile } from "@/lib/nodeProfile";
import { toast } from "sonner";

export const COMMAND_PALETTE_OPEN_EVENT = "erp:open-command-palette";

/**
 * Global Cmd+K / Ctrl+K command palette (U14 / video 14).
 * Groups: Recientes / Acciones / Páginas. Nested Esc = one level back.
 */
export function CommandPalette({
  open: openProp,
  onOpenChange,
  onLockSession,
}) {
  const navigate = useNavigate();
  const { user, hasRole, hasPermission } = useAuth();
  const { setMode, toggleMode } = useTheme();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [pendingId, setPendingId] = useState(null);
  const [recent, setRecent] = useState(() => loadRecentCommands());
  const [nodeProfile, setNodeProfile] = useState(() => getCachedNodeProfile());
  /** @type {[{ title: string, items: any[] }]} */
  const [stack, setStack] = useState([]);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const runCtx = useMemo(
    () => ({
      navigate: (to) => navigate(to),
      setMode,
      toggleMode,
      onLockSession,
      user,
    }),
    [navigate, setMode, toggleMode, onLockSession, user]
  );

  useEffect(() => {
    fetchNodeProfile().then(setNodeProfile).catch(() => {});
  }, []);

  const pages = useMemo(
    () => buildAccessiblePages({ hasRole, hasPermission, user, nodeProfile }),
    [hasRole, hasPermission, user, nodeProfile]
  );
  const actions = useMemo(
    () => buildAccessibleActions({ hasRole, user }),
    [hasRole, user]
  );

  const pool = useMemo(() => [...actions, ...pages], [actions, pages]);

  const nestedLevel = stack.length > 0 ? stack[stack.length - 1] : null;

  const grouped = useMemo(() => {
    if (nestedLevel) {
      const filtered = fuzzyFilterItems(query, nestedLevel.items || []);
      return [
        {
          key: "nested",
          label: nestedLevel.title || "Acciones",
          items: filtered,
        },
      ].filter((g) => g.items.length > 0);
    }

    const q = query.trim();
    if (!q) {
      // Empty query → Recientes (fallback to Acciones + Páginas if none)
      const recentItems = recent
        .map((row) => {
          const live = resolveCommandById(row, pool);
          if (live) {
            return { ...live, score: 0, indices: [], fromRecent: true };
          }
          // Stale recent with href — still offer navigation
          if (row.href) {
            return {
              id: row.id,
              label: row.label,
              group: row.group || "page",
              href: row.href,
              score: 0,
              indices: [],
              fromRecent: true,
              run: ({ navigate: nav }) => nav(row.href),
            };
          }
          return null;
        })
        .filter(Boolean);

      if (recentItems.length > 0) {
        return [
          {
            key: "recent",
            label: COMMAND_GROUP_LABELS.recent,
            items: recentItems,
          },
        ];
      }
      return [
        {
          key: "action",
          label: COMMAND_GROUP_LABELS.action,
          items: fuzzyFilterItems("", actions),
        },
        {
          key: "page",
          label: COMMAND_GROUP_LABELS.page,
          items: fuzzyFilterItems("", pages),
        },
      ].filter((g) => g.items.length > 0);
    }

    const matchedActions = fuzzyFilterItems(q, actions);
    const matchedPages = fuzzyFilterItems(q, pages);
    const matchedRecent = fuzzyFilterItems(
      q,
      recent
        .map((row) => resolveCommandById(row, pool) || (row.href
          ? {
              id: row.id,
              label: row.label,
              group: row.group || "page",
              href: row.href,
              run: ({ navigate: nav }) => nav(row.href),
            }
          : null))
        .filter(Boolean)
    ).map((item) => ({ ...item, fromRecent: true }));

    return [
      matchedRecent.length
        ? { key: "recent", label: COMMAND_GROUP_LABELS.recent, items: matchedRecent }
        : null,
      matchedActions.length
        ? { key: "action", label: COMMAND_GROUP_LABELS.action, items: matchedActions }
        : null,
      matchedPages.length
        ? { key: "page", label: COMMAND_GROUP_LABELS.page, items: matchedPages }
        : null,
    ].filter(Boolean);
  }, [nestedLevel, query, recent, pool, actions, pages]);

  const flatItems = useMemo(
    () => grouped.flatMap((g) => g.items.map((item) => ({ ...item, _group: g.key }))),
    [grouped]
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, nestedLevel?.title, open]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setStack([]);
    setPendingId(null);
    setRecent(loadRecentCommands());
    const t = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-cmdk-index="${selectedIndex}"]`);
    el?.scrollIntoView?.({ block: "nearest" });
  }, [selectedIndex, flatItems.length]);

  const goBackLevel = useCallback(() => {
    setStack((prev) => prev.slice(0, -1));
    setQuery("");
    setSelectedIndex(0);
  }, []);

  const remember = useCallback((cmd) => {
    if (!cmd?.id || !cmd?.label) return;
    setRecent(
      pushRecentCommand({
        id: cmd.id,
        label: cmd.label,
        group: cmd.group,
        href: cmd.href,
      })
    );
  }, []);

  const runCommand = useCallback(
    async (cmd) => {
      if (!cmd || pendingId) return;

      if (Array.isArray(cmd.children) && cmd.children.length > 0) {
        setStack((prev) => [
          ...prev,
          {
            title: cmd.label,
            items: cmd.children.map((child) => ({
              ...child,
              group: child.group || "action",
            })),
          },
        ]);
        setQuery("");
        setSelectedIndex(0);
        return;
      }

      remember(cmd);

      try {
        if (typeof cmd.run === "function") {
          const result = cmd.run(runCtx);
          if (result && typeof result.then === "function") {
            setPendingId(cmd.id);
            await result;
            setPendingId(null);
            setOpen(false);
            return;
          }
          // Nested children returned dynamically
          if (Array.isArray(result) && result.length > 0) {
            setStack((prev) => [...prev, { title: cmd.label, items: result }]);
            setQuery("");
            return;
          }
        } else if (cmd.href) {
          navigate(cmd.href);
        }
        setOpen(false);
      } catch (err) {
        setPendingId(null);
        toast.error("No se pudo ejecutar — intenta de nuevo");
      }
    },
    [pendingId, remember, runCtx, navigate, setOpen]
  );

  // Global shortcut + custom event (AntiTamperGuard / header button)
  useEffect(() => {
    const onKeyDown = (e) => {
      const key = String(e.key || "").toLowerCase();
      if (key !== "k") return;
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      if (e.shiftKey) return; // leave Ctrl+Shift+K to tamper guard / DevTools block
      e.preventDefault();
      e.stopPropagation();
      setOpen((prev) => !prev);
    };
    const onOpenEvent = () => setOpen(true);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, onOpenEvent);
    };
  }, [setOpen]);

  const onInputKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, Math.max(flatItems.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flatItems[selectedIndex];
      if (item) void runCommand(item);
    } else if (e.key === "Backspace" && !query && stack.length > 0) {
      e.preventDefault();
      goBackLevel();
    }
  };

  const placeholder = nestedLevel
    ? `Buscar en «${nestedLevel.title}»…`
    : "Buscar páginas y acciones…";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Overlay / dismiss closes fully; Esc nesting handled in onEscapeKeyDown.
        if (!next && pendingId) return;
        setOpen(next);
      }}
    >
      <DialogContent
        className={cn(
          "overflow-hidden p-0 gap-0 max-w-xl w-[min(92vw,36rem)]",
          "bg-zinc-950/95 text-zinc-50 border border-zinc-800 shadow-2xl",
          "[&>button]:hidden"
        )}
        onEscapeKeyDown={(e) => {
          // Nested: Esc = one level back (not always close)
          e.preventDefault();
          if (pendingId) return;
          if (stack.length > 0) {
            goBackLevel();
            return;
          }
          setOpen(false);
        }}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <DialogTitle className="sr-only">Paleta de comandos</DialogTitle>
        <div className="flex items-center gap-2 border-b border-zinc-800 px-3">
          {stack.length > 0 ? (
            <button
              type="button"
              className="shrink-0 rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
              aria-label="Volver"
              onClick={goBackLevel}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <Search className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder={placeholder}
            disabled={Boolean(pendingId)}
            className="flex h-12 w-full bg-transparent text-sm text-zinc-50 placeholder:text-zinc-500 outline-none disabled:opacity-60"
            aria-autocomplete="list"
            aria-controls="erp-command-palette-list"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-zinc-700 bg-zinc-900 px-1.5 font-mono text-[10px] text-zinc-400">
            esc
          </kbd>
        </div>

        <div
          id="erp-command-palette-list"
          ref={listRef}
          role="listbox"
          aria-label="Resultados de la paleta"
          className="max-h-[min(60vh,22rem)] overflow-y-auto py-2"
        >
          {flatItems.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-500">
              Sin resultados
            </p>
          ) : (
            grouped.map((group) => (
              <div key={group.key} className="mb-1" role="group" aria-label={group.label}>
                <div className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  {group.label}
                </div>
                {group.items.map((item) => {
                  const globalIndex = flatItems.findIndex((f) => f.id === item.id && f._group === group.key);
                  const selected = globalIndex === selectedIndex;
                  const Icon = item.icon;
                  const parts = splitHighlighted(item.label, item.indices || []);
                  const isPending = pendingId === item.id;
                  return (
                    <button
                      key={`${group.key}-${item.id}`}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      data-cmdk-index={globalIndex}
                      disabled={Boolean(pendingId) && !isPending}
                      className={cn(
                        "relative flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors",
                        "border-l-2 border-transparent",
                        selected
                          ? "border-l-teal-400 bg-zinc-800/90 text-zinc-50"
                          : "text-zinc-300 hover:bg-zinc-900/80",
                        pendingId && !isPending ? "opacity-50" : null
                      )}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                      onClick={() => void runCommand(item)}
                    >
                      {Icon ? (
                        <Icon className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
                      ) : (
                        <span className="h-4 w-4 shrink-0" />
                      )}
                      <span className="min-w-0 flex-1 truncate">
                        {parts.map((part, idx) =>
                          part.matched ? (
                            <span key={idx} className="font-semibold text-teal-400">
                              {part.text}
                            </span>
                          ) : (
                            <span key={idx}>{part.text}</span>
                          )
                        )}
                      </span>
                      {isPending ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-teal-400" aria-label="Cargando" />
                      ) : selected ? (
                        <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
                      ) : Array.isArray(item.children) && item.children.length > 0 ? (
                        <span className="text-[10px] text-zinc-500">›</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-zinc-800 px-3 py-2 text-[10px] text-zinc-500">
          <span>
            {stack.length > 0
              ? "Esc vuelve un nivel"
              : "↑↓ navegar · Enter ejecutar · Esc cerrar"}
          </span>
          <span className="font-medium text-teal-400/90">⌘K / Ctrl+K</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CommandPalette;
