"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useKeyboardShortcuts } from "@/contexts/keyboard-shortcuts-context";
import {
  Search,
  FolderKanban,
  FileSpreadsheet,
  HelpCircle,
  Plus,
  Building2,
  Users,
  FileText,
  Landmark,
  Settings,
  ChevronRight,
  Clock,
  Truck,
  History,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  category: "recent" | "search" | "action" | "navigation" | "create";
  action: () => void;
  keywords?: string[];
}

const RECENT_SEARCHES_KEY = "pitbull:recent-searches";
const MAX_RECENT = 5;

// Entity prefix search patterns
const ENTITY_PREFIXES: Record<string, { label: string; path: string; icon: React.ReactNode }> = {
  "emp:": { label: "Employees", path: "/employees", icon: <Users className="h-4 w-4" /> },
  "proj:": { label: "Projects", path: "/projects", icon: <FolderKanban className="h-4 w-4" /> },
  "eq:": { label: "Equipment", path: "/equipment", icon: <Truck className="h-4 w-4" /> },
  "bid:": { label: "Bids", path: "/bids", icon: <FileSpreadsheet className="h-4 w-4" /> },
  "rfi:": { label: "RFIs", path: "/rfis", icon: <HelpCircle className="h-4 w-4" /> },
  "con:": { label: "Contracts", path: "/contracts", icon: <FileText className="h-4 w-4" /> },
};

function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function addRecentSearch(query: string) {
  try {
    const recent = getRecentSearches().filter((r) => r !== query);
    recent.unshift(query);
    localStorage.setItem(
      RECENT_SEARCHES_KEY,
      JSON.stringify(recent.slice(0, MAX_RECENT))
    );
  } catch {
    // localStorage may be unavailable
  }
}

function clearRecentSearches() {
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // ignore
  }
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { registerShortcut, unregisterShortcut } = useKeyboardShortcuts();

  // Register Ctrl/Cmd+K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Register the shortcut for display in help dialog
  useEffect(() => {
    registerShortcut({
      key: "⌘K",
      description: "Open command palette / global search",
      action: () => setIsOpen(true),
      global: true,
    });

    return () => unregisterShortcut("⌘K");
  }, [registerShortcut, unregisterShortcut]);

  const close = useCallback(() => {
    setIsOpen(false);
    setSearch("");
    setSelectedIndex(0);
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (open) {
      setSearch("");
      setSelectedIndex(0);
      setRecentSearches(getRecentSearches());
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, []);

  // Check for entity prefix
  const entityPrefix = useMemo(() => {
    const lower = search.toLowerCase();
    for (const prefix of Object.keys(ENTITY_PREFIXES)) {
      if (lower.startsWith(prefix)) {
        return {
          prefix,
          query: search.slice(prefix.length).trim(),
          ...ENTITY_PREFIXES[prefix]!,
        };
      }
    }
    return null;
  }, [search]);

  // Define all commands
  const commands = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [];

    // Recent searches (only when no query typed)
    if (!search.trim() && recentSearches.length > 0) {
      recentSearches.forEach((recent, i) => {
        items.push({
          id: `recent-${i}`,
          title: recent,
          icon: <History className="h-4 w-4" />,
          category: "recent",
          action: () => {
            setSearch(recent);
          },
        });
      });
    }

    // Entity-specific search results
    if (entityPrefix && entityPrefix.query) {
      const searchParam = encodeURIComponent(entityPrefix.query);
      items.push({
        id: `entity-search-${entityPrefix.prefix}`,
        title: `Search ${entityPrefix.label} for "${entityPrefix.query}"`,
        subtitle: `Filter by ${entityPrefix.label.toLowerCase()}`,
        icon: entityPrefix.icon,
        category: "search",
        action: () => {
          addRecentSearch(search);
          router.push(`${entityPrefix.path}?search=${searchParam}`);
          close();
        },
      });
    }

    // General search actions (when there's a search query and no prefix)
    if (search.trim() && !entityPrefix) {
      const searchParam = encodeURIComponent(search.trim());

      // "See all results" link
      items.push({
        id: "search-all",
        title: `See all results for "${search}"`,
        subtitle: "Search across all entities",
        icon: <Search className="h-4 w-4" />,
        category: "search",
        action: () => {
          addRecentSearch(search.trim());
          router.push(`/search?q=${searchParam}`);
          close();
        },
      });

      items.push(
        {
          id: "search-projects",
          title: `Search projects for "${search}"`,
          subtitle: "Project name, number, or client",
          icon: <FolderKanban className="h-4 w-4" />,
          category: "search",
          action: () => {
            addRecentSearch(search.trim());
            router.push(`/projects?search=${searchParam}`);
            close();
          },
        },
        {
          id: "search-employees",
          title: `Search employees for "${search}"`,
          subtitle: "Name, number, title, or email",
          icon: <Users className="h-4 w-4" />,
          category: "search",
          action: () => {
            addRecentSearch(search.trim());
            router.push(`/employees?search=${searchParam}`);
            close();
          },
        },
        {
          id: "search-bids",
          title: `Search bids for "${search}"`,
          subtitle: "Bid number, name, or client",
          icon: <FileSpreadsheet className="h-4 w-4" />,
          category: "search",
          action: () => {
            addRecentSearch(search.trim());
            router.push(`/bids?search=${searchParam}`);
            close();
          },
        },
        {
          id: "search-rfis",
          title: `Search RFIs for "${search}"`,
          subtitle: "Subject, number, or assignee",
          icon: <HelpCircle className="h-4 w-4" />,
          category: "search",
          action: () => {
            addRecentSearch(search.trim());
            router.push(`/rfis?search=${searchParam}`);
            close();
          },
        },
        {
          id: "search-equipment",
          title: `Search equipment for "${search}"`,
          subtitle: "Equipment code, name, or serial number",
          icon: <Truck className="h-4 w-4" />,
          category: "search",
          action: () => {
            addRecentSearch(search.trim());
            router.push(`/equipment?search=${searchParam}`);
            close();
          },
        }
      );
    }

    // Navigation items
    items.push(
      {
        id: "nav-dashboard",
        title: "Dashboard",
        subtitle: "Go to dashboard overview",
        icon: <Building2 className="h-4 w-4" />,
        category: "navigation",
        action: () => { router.push("/"); close(); },
        keywords: ["home", "overview"],
      },
      {
        id: "nav-projects",
        title: "Projects",
        subtitle: "View all construction projects",
        icon: <FolderKanban className="h-4 w-4" />,
        category: "navigation",
        action: () => { router.push("/projects"); close(); },
        keywords: ["list", "construction", "jobs"],
      },
      {
        id: "nav-bids",
        title: "Bids",
        subtitle: "View all bid proposals",
        icon: <FileSpreadsheet className="h-4 w-4" />,
        category: "navigation",
        action: () => { router.push("/bids"); close(); },
        keywords: ["list", "proposals", "estimates"],
      },
      {
        id: "nav-rfis",
        title: "RFIs",
        subtitle: "View requests for information",
        icon: <HelpCircle className="h-4 w-4" />,
        category: "navigation",
        action: () => { router.push("/rfis"); close(); },
        keywords: ["list", "requests", "questions"],
      },
      {
        id: "nav-contracts",
        title: "Contracts",
        subtitle: "View subcontracts & change orders",
        icon: <FileText className="h-4 w-4" />,
        category: "navigation",
        action: () => { router.push("/contracts"); close(); },
        keywords: ["subcontracts", "agreements"],
      },
      {
        id: "nav-wip-schedule",
        title: "WIP Schedule",
        subtitle: "View work-in-progress reports",
        icon: <Landmark className="h-4 w-4" />,
        category: "navigation",
        action: () => { router.push("/accounting/wip"); close(); },
        keywords: ["wip", "work in progress", "revenue", "over under billing"],
      },
      {
        id: "nav-chart-of-accounts",
        title: "Chart of Accounts",
        subtitle: "View GL account hierarchy",
        icon: <Landmark className="h-4 w-4" />,
        category: "navigation",
        action: () => { router.push("/chart-of-accounts"); close(); },
        keywords: ["financial", "gl", "ledger", "accounts"],
      },
      {
        id: "nav-purchase-orders",
        title: "Purchase Orders",
        subtitle: "View procurement commitments",
        icon: <Landmark className="h-4 w-4" />,
        category: "navigation",
        action: () => { router.push("/procurement/purchase-orders"); close(); },
        keywords: ["procurement", "po", "receiving", "vendor"],
      },
      {
        id: "nav-vendor-invoices",
        title: "Vendor Invoices",
        subtitle: "View AP invoice match status",
        icon: <Landmark className="h-4 w-4" />,
        category: "navigation",
        action: () => { router.push("/procurement/invoices"); close(); },
        keywords: ["invoice", "ap", "matching", "variance"],
      },
      {
        id: "nav-employees",
        title: "Employees",
        subtitle: "View team directory",
        icon: <Users className="h-4 w-4" />,
        category: "navigation",
        action: () => { router.push("/employees"); close(); },
        keywords: ["team", "staff", "workers", "workforce"],
      },
      {
        id: "nav-equipment",
        title: "Equipment",
        subtitle: "View equipment inventory",
        icon: <Truck className="h-4 w-4" />,
        category: "navigation",
        action: () => { router.push("/equipment"); close(); },
        keywords: ["machines", "vehicles", "tools", "inventory"],
      },
      {
        id: "nav-time",
        title: "Time Tracking",
        subtitle: "View time entries & approvals",
        icon: <Clock className="h-4 w-4" />,
        category: "navigation",
        action: () => { router.push("/time-tracking"); close(); },
        keywords: ["hours", "timesheet", "labor"],
      },
      {
        id: "nav-settings",
        title: "Settings",
        subtitle: "Application settings",
        icon: <Settings className="h-4 w-4" />,
        category: "navigation",
        action: () => { router.push("/settings"); close(); },
        keywords: ["preferences", "config"],
      }
    );

    // Create new actions
    items.push(
      {
        id: "create-time-entry",
        title: "New Time Entry",
        subtitle: "Log hours for an employee",
        icon: <Plus className="h-4 w-4" />,
        category: "create",
        action: () => { router.push("/time-tracking/new"); close(); },
        keywords: ["create", "add", "hours", "timesheet"],
      },
      {
        id: "create-project",
        title: "New Project",
        subtitle: "Create a construction project",
        icon: <Plus className="h-4 w-4" />,
        category: "create",
        action: () => { router.push("/projects/new"); close(); },
        keywords: ["create", "add", "job"],
      },
      {
        id: "create-employee",
        title: "New Employee",
        subtitle: "Add a team member",
        icon: <Plus className="h-4 w-4" />,
        category: "create",
        action: () => { router.push("/employees/new"); close(); },
        keywords: ["create", "add", "hire"],
      },
      {
        id: "create-bid",
        title: "New Bid",
        subtitle: "Create a bid proposal",
        icon: <Plus className="h-4 w-4" />,
        category: "create",
        action: () => { router.push("/bids/new"); close(); },
        keywords: ["create", "add", "estimate", "proposal"],
      },
      {
        id: "create-rfi",
        title: "New RFI",
        subtitle: "Submit a request for information",
        icon: <Plus className="h-4 w-4" />,
        category: "create",
        action: () => { router.push("/rfis/new"); close(); },
        keywords: ["create", "add", "question"],
      }
    );

    return items;
  }, [router, close, search, entityPrefix, recentSearches]);

  // Filter commands based on search
  const filteredCommands = useMemo(() => {
    if (!search.trim()) return commands;

    // Entity prefix filtering - only show entity search + relevant nav
    if (entityPrefix) {
      return commands.filter(
        (cmd) =>
          cmd.category === "search" ||
          (cmd.category === "navigation" &&
            cmd.title.toLowerCase().includes(entityPrefix.label.toLowerCase()))
      );
    }

    const query = search.toLowerCase();
    return commands.filter((cmd) => {
      // Always show search category items (they already match the query)
      if (cmd.category === "search") return true;

      const searchableText = [
        cmd.title,
        cmd.subtitle || "",
        ...(cmd.keywords || []),
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [commands, search, entityPrefix]);

  // Group commands by category
  const categoryOrder = ["recent", "search", "navigation", "create"] as const;

  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {
      recent: [],
      search: [],
      navigation: [],
      create: [],
    };

    filteredCommands.forEach((cmd) => {
      groups[cmd.category]?.push(cmd);
    });

    return groups;
  }, [filteredCommands]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => {
            const next = Math.min(i + 1, filteredCommands.length - 1);
            // Scroll selected item into view
            setTimeout(() => {
              const el = listRef.current?.querySelector(`[data-index="${next}"]`);
              el?.scrollIntoView({ block: "nearest" });
            }, 0);
            return next;
          });
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => {
            const next = Math.max(i - 1, 0);
            setTimeout(() => {
              const el = listRef.current?.querySelector(`[data-index="${next}"]`);
              el?.scrollIntoView({ block: "nearest" });
            }, 0);
            return next;
          });
          break;
        case "Enter":
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
          }
          break;
        case "Escape":
          e.preventDefault();
          close();
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, close]);

  // Calculate flat index for a command
  const getFlatIndex = (category: string, indexInCategory: number): number => {
    let offset = 0;
    for (const cat of categoryOrder) {
      if (cat === category) break;
      offset += groupedCommands[cat]?.length ?? 0;
    }
    return offset + indexInCategory;
  };

  const categoryLabels: Record<string, string> = {
    recent: "Recent Searches",
    search: "Search",
    navigation: "Navigation",
    create: "Create New...",
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-xl p-0 gap-0 overflow-hidden"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Command Palette</DialogTitle>

        {/* Search input */}
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search or type a command... (emp: proj: eq: bid: rfi:)"
            className="border-0 shadow-none focus-visible:ring-0 h-12"
          />
          <kbd className="hidden sm:inline-flex pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Entity prefix indicator */}
        {entityPrefix && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50/50 dark:bg-amber-950/20 border-b">
            {entityPrefix.icon}
            <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
              Searching {entityPrefix.label}
            </span>
            {entityPrefix.query && (
              <span className="text-xs text-muted-foreground">
                for &ldquo;{entityPrefix.query}&rdquo;
              </span>
            )}
          </div>
        )}

        {/* Results */}
        <div ref={listRef} className="max-h-[350px] overflow-y-auto py-2">
          {filteredCommands.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-muted-foreground">No results found.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try a different search or use prefixes: emp: proj: eq: bid: rfi:
              </p>
            </div>
          ) : (
            <>
              {categoryOrder.map((category) => {
                const items = groupedCommands[category] ?? [];
                if (items.length === 0) return null;

                return (
                  <div key={category}>
                    <div className="flex items-center justify-between px-3 py-1.5">
                      <span className="text-xs font-medium text-muted-foreground">
                        {categoryLabels[category]}
                      </span>
                      {category === "recent" && (
                        <button
                          type="button"
                          onClick={() => {
                            clearRecentSearches();
                            setRecentSearches([]);
                          }}
                          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {items.map((cmd, indexInCategory) => {
                      const flatIndex = getFlatIndex(category, indexInCategory);
                      const isSelected = flatIndex === selectedIndex;

                      return (
                        <button
                          key={cmd.id}
                          data-index={flatIndex}
                          onClick={cmd.action}
                          onMouseEnter={() => setSelectedIndex(flatIndex)}
                          className={cn(
                            "flex w-full items-center gap-3 px-3 py-2 text-sm text-left transition-colors",
                            isSelected
                              ? "bg-accent text-accent-foreground"
                              : "text-foreground hover:bg-accent/50"
                          )}
                        >
                          <div
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
                              isSelected
                                ? "border-accent-foreground/20 bg-accent-foreground/10"
                                : "border-border bg-background"
                            )}
                          >
                            {cmd.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{cmd.title}</div>
                            {cmd.subtitle && (
                              <div className="text-xs text-muted-foreground truncate">
                                {cmd.subtitle}
                              </div>
                            )}
                          </div>
                          {category === "search" ? (
                            <ArrowRight
                              className={cn(
                                "h-4 w-4 shrink-0 transition-opacity",
                                isSelected ? "opacity-100" : "opacity-0"
                              )}
                            />
                          ) : (
                            <ChevronRight
                              className={cn(
                                "h-4 w-4 shrink-0 transition-opacity",
                                isSelected ? "opacity-100" : "opacity-0"
                              )}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-muted px-1 font-mono">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-muted px-1 font-mono">↵</kbd>
              select
            </span>
            <span className="hidden sm:flex items-center gap-1">
              <kbd className="rounded border bg-muted px-1 font-mono">emp:</kbd>
              <kbd className="rounded border bg-muted px-1 font-mono">proj:</kbd>
              filter
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1 font-mono">esc</kbd>
            close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
