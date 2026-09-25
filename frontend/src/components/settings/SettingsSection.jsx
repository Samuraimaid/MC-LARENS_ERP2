import React, { useMemo, useState } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { SettingsHighlight, SettingsPathBreadcrumb, sectionMatchesSearch } from "./SettingsSearch";
import { normalizeSettingsQuery } from "./settingsSearchUtils";

/**
 * Modified indicator dot on a single settings row (U4).
 */
export function SettingsDirtyDot({ dirty = false, className, label = "Modificado" }) {
  if (!dirty) return null;
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full bg-amber-500 ring-2 ring-amber-500/30",
        className,
      )}
      title={label}
      aria-label={label}
      data-testid="settings-dirty-dot"
    />
  );
}

/**
 * Row chrome: label + description + optional dirty dot + reset-to-default.
 */
export function SettingsRow({
  id,
  label,
  description,
  path,
  keywords = [],
  searchQuery = "",
  dirty = false,
  onReset,
  resetLabel = "Volver al valor predeterminado",
  children,
  className,
  hideWhenNoMatch = true,
}) {
  const matches = useMemo(
    () =>
      sectionMatchesSearch(
        { title: label, description, path, keywords: [...keywords, label, description] },
        searchQuery,
      ),
    [label, description, path, keywords, searchQuery],
  );

  if (hideWhenNoMatch && normalizeSettingsQuery(searchQuery) && !matches) {
    return null;
  }

  return (
    <div
      id={id ? `settings-row-${id}` : undefined}
      data-settings-row={id || undefined}
      data-settings-match={matches ? "1" : "0"}
      className={cn(
        "space-y-2 rounded-lg px-1 py-2 transition-colors",
        normalizeSettingsQuery(searchQuery) && matches && "bg-amber-500/5 ring-1 ring-amber-500/20",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          {path?.length ? (
            <SettingsPathBreadcrumb path={path} query={searchQuery} />
          ) : null}
          <div className="flex items-center gap-2">
            <SettingsDirtyDot dirty={dirty} />
            <p className="text-sm font-medium leading-none">
              <SettingsHighlight text={label} query={searchQuery} />
            </p>
          </div>
          {description ? (
            <p className="text-xs text-muted-foreground">
              <SettingsHighlight text={description} query={searchQuery} />
            </p>
          ) : null}
        </div>
        {dirty && typeof onReset === "function" ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 text-xs text-muted-foreground"
            onClick={onReset}
            data-testid={id ? `settings-reset-${id}` : "settings-reset"}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            {resetLabel}
          </Button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/**
 * Task-grouped settings card. Supports search filter, “N modificados”, advanced accordion.
 */
export function SettingsSection({
  id,
  title,
  description,
  path,
  keywords = [],
  searchQuery = "",
  modifiedCount = 0,
  advanced = false,
  defaultOpen = true,
  icon: Icon,
  children,
  className,
  headerExtra,
  hideWhenNoMatch = true,
}) {
  const [open, setOpen] = useState(advanced ? false : defaultOpen);
  const matches = useMemo(
    () =>
      sectionMatchesSearch(
        { title, description, path, keywords: [...keywords, title, description] },
        searchQuery,
      ),
    [title, description, path, keywords, searchQuery],
  );

  const hasQuery = Boolean(normalizeSettingsQuery(searchQuery));
  // When searching, force-open advanced / collapsed sections that match so rows are reachable.
  const effectivelyOpen = hasQuery && matches ? true : open;

  if (hideWhenNoMatch && hasQuery && !matches) {
    // Still render if children might match nested rows — parent passes forceVisible when needed.
    // Default: hide whole section when section metadata doesn't match.
    // Nested-row match: caller should include row keywords in section keywords OR set forceVisible.
  }

  const forceVisible = hideWhenNoMatch === false;
  if (hasQuery && !matches && !forceVisible) {
    return null;
  }

  const modifiedBadge =
    modifiedCount > 0 ? (
      <Badge
        variant="secondary"
        className="bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30"
        data-testid={id ? `settings-modified-badge-${id}` : "settings-modified-badge"}
      >
        {modifiedCount} modificado{modifiedCount === 1 ? "" : "s"}
      </Badge>
    ) : null;

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0 space-y-1">
        {path?.length ? <SettingsPathBreadcrumb path={path} query={searchQuery} /> : null}
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          {Icon ? <Icon className="h-5 w-5 shrink-0" /> : null}
          <SettingsHighlight text={title} query={searchQuery} />
          {modifiedBadge}
        </CardTitle>
        {description ? (
          <CardDescription>
            <SettingsHighlight text={description} query={searchQuery} />
          </CardDescription>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {headerExtra}
        {advanced ? (
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              effectivelyOpen && "rotate-180",
            )}
          />
        ) : null}
      </div>
    </div>
  );

  if (advanced) {
    return (
      <Card
        id={id ? `settings-section-${id}` : undefined}
        data-settings-section={id || undefined}
        className={cn(className)}
      >
        <Collapsible open={effectivelyOpen} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer select-none hover:bg-muted/30 transition-colors">
              {header}
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">{children}</CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  }

  return (
    <Card
      id={id ? `settings-section-${id}` : undefined}
      data-settings-section={id || undefined}
      className={cn(className)}
    >
      <CardHeader>{header}</CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

/**
 * “Avanzado” accordion wrapper when you don't need a full Card section.
 */
export function SettingsAdvancedGroup({
  title = "Avanzado",
  description = "Opciones secundarias que la mayoría no necesita cambiar.",
  searchQuery = "",
  keywords = ["avanzado"],
  defaultOpen = false,
  children,
  className,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const hasQuery = Boolean(normalizeSettingsQuery(searchQuery));
  const matches = sectionMatchesSearch(
    { title, description, keywords: [...keywords, title, description] },
    searchQuery,
  );
  const effectivelyOpen = hasQuery && matches ? true : open;

  if (hasQuery && !matches) {
    // Still render children so nested SettingsRow can match independently —
    // only collapse chrome when neither group nor (rendered) children apply.
    // Parent section keywords should include advanced row terms.
  }

  return (
    <Collapsible open={effectivelyOpen} onOpenChange={setOpen} className={cn("rounded-xl border border-border/60", className)}>
      <CollapsibleTrigger
        className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left hover:bg-muted/30"
        data-testid="settings-advanced-trigger"
      >
        <div>
          <p className="text-sm font-medium">
            <SettingsHighlight text={title} query={searchQuery} />
          </p>
          {description ? (
            <p className="text-xs text-muted-foreground">
              <SettingsHighlight text={description} query={searchQuery} />
            </p>
          ) : null}
        </div>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", effectivelyOpen && "rotate-180")}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-3 border-t px-3 py-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default SettingsSection;
