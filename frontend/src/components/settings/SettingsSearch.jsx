import React, { useCallback, useId, useMemo, useRef } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  highlightSettingsMatch,
  normalizeSettingsQuery,
  settingsKeywordsMatch,
  settingsTextMatches,
} from "./settingsSearchUtils";

/**
 * Highlight matching span inside a label/path (U4 settings search).
 */
export function SettingsHighlight({ text, query, className }) {
  const parts = useMemo(() => highlightSettingsMatch(text, query), [text, query]);
  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.match ? (
          <mark
            key={`${i}-${part.text}`}
            className="rounded-sm bg-amber-300/70 px-0.5 text-foreground dark:bg-amber-500/40"
          >
            {part.text}
          </mark>
        ) : (
          <React.Fragment key={`${i}-${part.text}`}>{part.text}</React.Fragment>
        ),
      )}
    </span>
  );
}

/**
 * Breadcrumb path with optional highlight (e.g. Configuración › Apariencia › Liquid Glass).
 */
export function SettingsPathBreadcrumb({ path = [], query = "", className }) {
  const segments = Array.isArray(path) ? path.filter(Boolean) : [];
  if (!segments.length) return null;
  return (
    <p
      className={cn(
        "text-[11px] text-muted-foreground truncate",
        className,
      )}
      data-testid="settings-path-breadcrumb"
    >
      {segments.map((seg, i) => (
        <React.Fragment key={`${i}-${seg}`}>
          {i > 0 ? <span className="mx-1 opacity-60">›</span> : null}
          <SettingsHighlight text={seg} query={query} />
        </React.Fragment>
      ))}
    </p>
  );
}

/**
 * Top search field for settings. Enter focuses/scrolls to first matching row via onJump.
 */
export function SettingsSearch({
  value,
  onChange,
  onJump,
  placeholder = "Buscar ajustes…",
  className,
  resultCount,
}) {
  const inputId = useId();
  const inputRef = useRef(null);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        onJump?.(normalizeSettingsQuery(value));
      }
      if (event.key === "Escape" && value) {
        event.preventDefault();
        onChange?.("");
      }
    },
    [onChange, onJump, value],
  );

  return (
    <div className={cn("relative flex items-center gap-2", className)} data-testid="settings-search">
      <label htmlFor={inputId} className="sr-only">
        Buscar ajustes
      </label>
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          id={inputId}
          type="search"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="h-10 pl-9 pr-9"
          autoComplete="off"
          data-testid="settings-search-input"
        />
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
            onClick={() => onChange?.("")}
            aria-label="Limpiar búsqueda"
            data-testid="settings-search-clear"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      {value && typeof resultCount === "number" ? (
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums" data-testid="settings-search-count">
          {resultCount === 0 ? "Sin resultados" : `${resultCount} resultado${resultCount === 1 ? "" : "s"}`}
        </span>
      ) : null}
    </div>
  );
}

export function sectionMatchesSearch({ title, description, path, keywords }, query) {
  if (!normalizeSettingsQuery(query)) return true;
  const blob = [title, description, ...(path || []), ...(keywords || [])].filter(Boolean).join(" ");
  return settingsTextMatches(blob, query) || settingsKeywordsMatch(keywords, query);
}

export { normalizeSettingsQuery, settingsTextMatches, settingsKeywordsMatch, highlightSettingsMatch };
