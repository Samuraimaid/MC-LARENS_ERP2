import React from "react";
import PropTypes from "prop-types";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";

/**
 * RowContextMenu (U2 Context Menu Pattern)
 * 
 * Provides right-click contextual actions for table rows and list cards:
 * - Viewport bounds measurement & flip (Radix builtin)
 * - Grouped by user intent with visual separators
 * - Explicit destructive actions with red highlight
 * - Keyboard navigation (arrows + Enter + Escape)
 */
export function RowContextMenu({ children, items = [], className, disabled = false }) {
  if (disabled || !items || items.length === 0) {
    return children;
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild className={className}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56 rounded-xl border border-white/15 dark:border-white/10 bg-popover/90 backdrop-blur-xl shadow-xl p-1.5 z-50">
        {items.map((item, index) => {
          if (item.separatorBefore) {
            return (
              <React.Fragment key={`sep-${item.id || index}`}>
                <ContextMenuSeparator className="my-1 bg-border/50" />
                <ContextMenuItem
                  disabled={item.disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    item.onClick?.();
                  }}
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium rounded-lg cursor-pointer transition-colors",
                    item.variant === "destructive"
                      ? "text-destructive focus:bg-destructive/10 focus:text-destructive"
                      : "text-foreground focus:bg-accent/80 focus:text-accent-foreground",
                    item.disabled && "opacity-50 pointer-events-none"
                  )}
                >
                  {item.icon && <item.icon className="h-4 w-4 shrink-0 opacity-80" />}
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.shortcut && <ContextMenuShortcut>{item.shortcut}</ContextMenuShortcut>}
                </ContextMenuItem>
              </React.Fragment>
            );
          }

          return (
            <ContextMenuItem
              key={item.id || item.label || index}
              disabled={item.disabled}
              onClick={(e) => {
                e.stopPropagation();
                item.onClick?.();
              }}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium rounded-lg cursor-pointer transition-colors",
                item.variant === "destructive"
                  ? "text-destructive focus:bg-destructive/10 focus:text-destructive"
                  : "text-foreground focus:bg-accent/80 focus:text-accent-foreground",
                item.disabled && "opacity-50 pointer-events-none"
              )}
            >
              {item.icon && <item.icon className="h-4 w-4 shrink-0 opacity-80" />}
              <span className="flex-1 truncate">{item.label}</span>
              {item.shortcut && <ContextMenuShortcut>{item.shortcut}</ContextMenuShortcut>}
            </ContextMenuItem>
          );
        })}
      </ContextMenuContent>
    </ContextMenu>
  );
}

RowContextMenu.propTypes = {
  children: PropTypes.node.isRequired,
  items: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      label: PropTypes.string.isRequired,
      icon: PropTypes.elementType,
      onClick: PropTypes.func,
      variant: PropTypes.oneOf(["default", "destructive"]),
      separatorBefore: PropTypes.bool,
      shortcut: PropTypes.string,
      disabled: PropTypes.bool,
    })
  ),
  className: PropTypes.string,
  disabled: PropTypes.bool,
};

export default RowContextMenu;
