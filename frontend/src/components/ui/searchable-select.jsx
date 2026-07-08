import React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { filterSearchableOptions } from "@/lib/searchableSelectFilter";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function normalizeOption(option) {
  if (!option) return null;
  if (typeof option === "string") {
    return { value: option, label: option, hint: "", searchText: option };
  }
  const value = String(option.value ?? option.label ?? "");
  const label = String(option.label ?? value);
  const hint = String(option.hint ?? "");
  return {
    value,
    label,
    hint,
    searchText: [value, label, hint].filter(Boolean).join(" "),
  };
}

function moveCommandSelection(commandRoot, direction) {
  if (!commandRoot) return;
  const key = direction > 0 ? "ArrowDown" : "ArrowUp";
  commandRoot.dispatchEvent(
    new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
    })
  );
}

export default function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = "Seleccionar...",
  searchPlaceholder = "Escribe para buscar...",
  emptyText = "Sin resultados",
  disabled = false,
  className,
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const commandRef = React.useRef(null);
  const listRef = React.useRef(null);

  const normalizedOptions = React.useMemo(
    () => options.map(normalizeOption).filter(Boolean),
    [options]
  );

  const visibleOptions = React.useMemo(
    () => filterSearchableOptions(normalizedOptions, search),
    [normalizedOptions, search]
  );

  const selectedValue = value ? String(value) : "";
  const selectedOption = normalizedOptions.find((option) => option.value === selectedValue) || null;
  const triggerLabel = selectedOption?.label || selectedValue;

  const handleOpenChange = (nextOpen) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSearch("");
    }
  };

  React.useEffect(() => {
    const list = listRef.current;
    if (!list || !open) return undefined;

    const handleWheel = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const delta = event.deltaY || event.deltaX;
      if (!delta) return;
      moveCommandSelection(commandRef.current, delta > 0 ? 1 : -1);
    };

    list.addEventListener("wheel", handleWheel, { passive: false });
    return () => list.removeEventListener("wheel", handleWheel);
  }, [open, visibleOptions.length]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-auto min-h-10 w-full justify-between py-2 font-normal",
            !selectedValue && "text-muted-foreground",
            className
          )}
          title={selectedOption?.hint || selectedValue || ""}
        >
          <span className="min-w-0 text-left">
            <span className="block truncate">{triggerLabel || placeholder}</span>
            {selectedOption?.hint ? (
              <span className="block truncate text-[11px] text-muted-foreground">{selectedOption.hint}</span>
            ) : null}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command ref={commandRef} shouldFilter={false} loop={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList ref={listRef}>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {visibleOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  keywords={[option.label, option.hint].filter(Boolean)}
                  onSelect={() => {
                    onChange(option.value);
                    setSearch("");
                    setOpen(false);
                  }}
                  title={option.hint || option.label}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      selectedValue === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{option.label}</span>
                    {option.hint ? (
                      <span className="block truncate text-[11px] text-muted-foreground">{option.hint}</span>
                    ) : null}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}