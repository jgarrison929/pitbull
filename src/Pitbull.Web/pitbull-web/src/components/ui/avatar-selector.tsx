"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface AvatarOption {
  id: string;
  name: string;
  initials?: string;
}

interface AvatarSelectorProps {
  options: AvatarOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
];

function getColorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}

/**
 * Avatar-based selector for assigning people (ball-in-court, supervisors, etc).
 * Shows initials in colored circles with name labels.
 */
export function AvatarSelector({
  options,
  value,
  onChange,
  placeholder = "Select a person",
  className,
  disabled = false,
}: AvatarSelectorProps) {
  const [search, setSearch] = React.useState("");
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const filtered = React.useMemo(() => {
    if (!search.trim()) return options;
    const lower = search.toLowerCase();
    return options.filter((o) => o.name.toLowerCase().includes(lower));
  }, [options, search]);

  const selected = options.find((o) => o.name === value || o.id === value);

  // Close on outside click
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Selected display / trigger */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md border bg-transparent px-3 py-2 text-sm transition-colors",
          "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        {selected ? (
          <>
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold",
                getColorForName(selected.name)
              )}
            >
              {selected.initials || getInitials(selected.name)}
            </span>
            <span className="flex-1 text-left truncate">{selected.name}</span>
          </>
        ) : (
          <span className="flex-1 text-left text-muted-foreground">{placeholder}</span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md animate-in fade-in-0 zoom-in-95">
          {/* Search */}
          <div className="p-2 border-b">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full rounded-md border bg-transparent px-2 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              autoFocus
            />
          </div>

          {/* Options */}
          <div className="max-h-48 overflow-y-auto p-1">
            {/* None option */}
            <button
              type="button"
              onClick={() => {
                onChange("");
                setIsOpen(false);
                setSearch("");
              }}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground">
                —
              </span>
              <span className="text-muted-foreground">None</span>
            </button>

            {filtered.map((option) => {
              const isSelected = option.name === value || option.id === value;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onChange(option.name);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors",
                    isSelected ? "bg-accent" : "hover:bg-accent"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold",
                      getColorForName(option.name)
                    )}
                  >
                    {option.initials || getInitials(option.name)}
                  </span>
                  <span className="flex-1 text-left truncate">{option.name}</span>
                  {isSelected && <Check className="h-4 w-4 text-amber-500" />}
                </button>
              );
            })}

            {filtered.length === 0 && (
              <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                No matches found
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
