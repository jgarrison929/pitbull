"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ChevronRight, Search, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  filterAndRankEntities,
  type EntityOption,
} from "@/lib/entity-lookup";
import { cn } from "@/lib/utils";

export interface EntityLookupFieldProps {
  label: string;
  value: string;
  onSelect: (id: string) => void;
  items: EntityOption[];
  placeholder?: string;
  recentIds?: string[];
  required?: boolean;
  error?: string;
  helpText?: string;
  /** Allow clearing selection (empty id). Default true when not required. */
  allowClear?: boolean;
  emptyOptionLabel?: string;
  className?: string;
  /** min-height of trigger; mobile defaults to 48px. */
  triggerClassName?: string;
  id?: string;
}

/**
 * Searchable entity picker for mobile-first data entry.
 * Opens a dialog with typeahead + recent matches; commits entity id on select.
 */
export function EntityLookupField({
  label,
  value,
  onSelect,
  items,
  placeholder = "Search and select...",
  recentIds = [],
  required,
  error,
  helpText,
  allowClear,
  emptyOptionLabel = "None",
  className,
  triggerClassName,
  id,
}: EntityLookupFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const canClear = allowClear ?? !required;

  const selected = useMemo(
    () => items.find((item) => item.id === value),
    [items, value]
  );

  const ranked = useMemo(
    () => filterAndRankEntities(items, query, recentIds),
    [items, query, recentIds]
  );

  const recentSet = useMemo(() => new Set(recentIds), [recentIds]);
  const recentInResults = ranked.filter((item) => recentSet.has(item.id));
  const rest = ranked.filter((item) => !recentSet.has(item.id));

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setQuery("");
  }

  function pick(id: string) {
    onSelect(id);
    handleOpenChange(false);
  }

  const display =
    selected == null
      ? ""
      : selected.sublabel
        ? `${selected.label}`
        : selected.label;

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>

      <button
        type="button"
        id={id}
        onClick={() => setOpen(true)}
        className={cn(
          "w-full flex items-center justify-between min-h-[48px] sm:min-h-[40px] px-3 py-2 rounded-md border border-input bg-background text-left text-base sm:text-sm touch-manipulation hover:bg-muted/50 active:bg-muted transition-colors",
          error && "border-destructive",
          triggerClassName
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-invalid={error ? "true" : undefined}
      >
        <span className={cn("truncate", !value && "text-muted-foreground")}>
          {value && selected ? (
            <>
              <span className="font-medium">{display}</span>
              {selected.sublabel && (
                <span className="text-muted-foreground"> · {selected.sublabel}</span>
              )}
            </>
          ) : (
            placeholder
          )}
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
      </button>

      {helpText && !error && (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-4 pb-2 border-b space-y-3">
            <DialogTitle>Select {label}</DialogTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Find ${label.toLowerCase()}...`}
                className="pl-9 min-h-[48px] text-base"
                autoFocus
                autoComplete="off"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted-foreground touch-manipulation"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto max-h-[60vh]">
            {canClear && (
              <div className="px-2 pt-2">
                <button
                  type="button"
                  onClick={() => pick("")}
                  className={cn(
                    "w-full text-left px-3 py-3.5 rounded-lg touch-manipulation transition-colors",
                    !value
                      ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
                      : "hover:bg-muted active:bg-muted/80"
                  )}
                >
                  <span className="text-muted-foreground">{emptyOptionLabel}</span>
                </button>
              </div>
            )}

            {recentInResults.length > 0 && !query && (
              <div className="px-2 pt-2 pb-1">
                <p className="px-2 text-xs text-muted-foreground font-medium mb-1">
                  Recent
                </p>
                {recentInResults.map((item) => (
                  <EntityRow
                    key={`recent-${item.id}`}
                    item={item}
                    selected={value === item.id}
                    recent
                    onPick={() => pick(item.id)}
                  />
                ))}
                <div className="border-b my-2" />
              </div>
            )}

            <div className="px-2 pb-3 pt-1">
              {recentInResults.length > 0 && !query && (
                <p className="px-2 text-xs text-muted-foreground font-medium mb-1">
                  All matches
                </p>
              )}
              {(query ? ranked : rest).length === 0 ? (
                <p className="px-3 py-6 text-sm text-muted-foreground text-center">
                  No matches for “{query}”
                </p>
              ) : (
                (query ? ranked : rest).map((item) => (
                  <EntityRow
                    key={item.id}
                    item={item}
                    selected={value === item.id}
                    onPick={() => pick(item.id)}
                  />
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EntityRow({
  item,
  selected,
  recent,
  onPick,
}: {
  item: EntityOption;
  selected: boolean;
  recent?: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        "w-full text-left px-3 py-3.5 rounded-lg flex items-center justify-between touch-manipulation transition-colors",
        selected
          ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
          : "hover:bg-muted active:bg-muted/80"
      )}
    >
      <div className="min-w-0">
        <span className="font-medium text-base block truncate">
          {recent ? `⏱ ${item.label}` : item.label}
        </span>
        {item.sublabel && (
          <span className="block text-sm text-muted-foreground truncate">
            {item.sublabel}
          </span>
        )}
      </div>
      {selected && (
        <CheckCircle2 className="h-5 w-5 text-amber-500 shrink-0 ml-2" />
      )}
    </button>
  );
}
