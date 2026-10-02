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
  allowCustom = false,
  customLabelPrefix = "+ Usar / Crear:",
  className,
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const commandRef = React.useRef(null);
  const listRef = React.useRef(null);

  const normalizedOptions = React.useMemo(
    () => (Array.isArray(options) ? options : []).map(normalizeOption).filter(Boolean),
    [options]
  );

  const visibleOptions = React.useMemo(
    () => filterSearchableOptions(normalizedOptions, search),
    [normalizedOptions, search]
  );

  const selectedValue = value ? String(value) : "";
  const selectedOption = normalizedOptions.find((option) => option.value === selectedValue) || null;
  const triggerLabel = selectedOption?.label || selectedValue;

  const exactMatchExists = React.useMemo(() => {
    if (!search.trim()) return false;
    const clean = search.trim().toLowerCase();
    return normalizedOptions.some(
      (opt) => opt.value.toLowerCase() === clean || opt.label.toLowerCase() === clean
    );
  }, [normalizedOptions, search]);

  const handleOpenChange = (nextOpen) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSearch("");
    }
  };

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
          <CommandList ref={listRef} className="max-h-60 overflow-y-auto overscroll-contain">
            {allowCustom && search.trim() && !exactMatchExists ? (
              <CommandGroup heading="Nueva opción">
                <CommandItem
                  value={`__custom_${search.trim()}`}
                  onSelect={() => {
                    onChange(search.trim());
                    setSearch("");
                    setOpen(false);
                  }}
                  className="font-medium text-primary cursor-pointer"
                >
                  <span className="truncate">
                    {customLabelPrefix} <strong>&quot;{search.trim()}&quot;</strong>
                  </span>
                </CommandItem>
              </CommandGroup>
            ) : null}

            {visibleOptions.length === 0 && (!allowCustom || !search.trim()) ? (
              <CommandEmpty>{emptyText}</CommandEmpty>
            ) : null}

            {visibleOptions.length > 0 ? (
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
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}