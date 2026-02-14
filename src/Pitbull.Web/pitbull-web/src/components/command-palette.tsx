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
  Settings,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  category: "navigation" | "action" | "search";
  action: () => void;
  keywords?: string[];
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
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
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, []);

  // Define all commands
  const commands = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [
      // Quick Actions
      {
        id: "new-project",
        title: "New Project",
        subtitle: "Create a new construction project",
        icon: <Plus className="h-4 w-4" />,
        category: "action",
        action: () => {
          router.push("/projects/new");
          close();
        },
        keywords: ["create", "add"],
      },
      {
        id: "new-bid",
        title: "New Bid",
        subtitle: "Create a new bid proposal",
        icon: <Plus className="h-4 w-4" />,
        category: "action",
        action: () => {
          router.push("/bids/new");
          close();
        },
        keywords: ["create", "add", "proposal"],
      },
      {
        id: "new-rfi",
        title: "New RFI",
        subtitle: "Create a new request for information",
        icon: <Plus className="h-4 w-4" />,
        category: "action",
        action: () => {
          router.push("/rfis/new");
          close();
        },
        keywords: ["create", "add", "request"],
      },
      {
        id: "new-employee",
        title: "New Employee",
        subtitle: "Add a new team member",
        icon: <Plus className="h-4 w-4" />,
        category: "action",
        action: () => {
          router.push("/employees/new");
          close();
        },
        keywords: ["create", "add", "hire", "team"],
      },

      // Navigation
      {
        id: "nav-dashboard",
        title: "Dashboard",
        subtitle: "Go to dashboard overview",
        icon: <Building2 className="h-4 w-4" />,
        category: "navigation",
        action: () => {
          router.push("/");
          close();
        },
        keywords: ["home", "overview"],
      },
      {
        id: "nav-projects",
        title: "Projects",
        subtitle: "View all projects",
        icon: <FolderKanban className="h-4 w-4" />,
        category: "navigation",
        action: () => {
          router.push("/projects");
          close();
        },
        keywords: ["list", "construction"],
      },
      {
        id: "nav-bids",
        title: "Bids",
        subtitle: "View all bids",
        icon: <FileSpreadsheet className="h-4 w-4" />,
        category: "navigation",
        action: () => {
          router.push("/bids");
          close();
        },
        keywords: ["list", "proposals", "estimates"],
      },
      {
        id: "nav-rfis",
        title: "RFIs",
        subtitle: "View all requests for information",
        icon: <HelpCircle className="h-4 w-4" />,
        category: "navigation",
        action: () => {
          router.push("/rfis");
          close();
        },
        keywords: ["list", "requests", "questions"],
      },
      {
        id: "nav-contracts",
        title: "Contracts",
        subtitle: "View subcontracts",
        icon: <FileText className="h-4 w-4" />,
        category: "navigation",
        action: () => {
          router.push("/contracts");
          close();
        },
        keywords: ["subcontracts", "agreements"],
      },
      {
        id: "nav-employees",
        title: "Employees",
        subtitle: "View team members",
        icon: <Users className="h-4 w-4" />,
        category: "navigation",
        action: () => {
          router.push("/employees");
          close();
        },
        keywords: ["team", "staff", "workers"],
      },
      {
        id: "nav-settings",
        title: "Settings",
        subtitle: "Application settings",
        icon: <Settings className="h-4 w-4" />,
        category: "navigation",
        action: () => {
          router.push("/settings");
          close();
        },
        keywords: ["preferences", "config"],
      },
    ];

    // If there's a search query, add search navigation options
    if (search.trim()) {
      const searchParam = encodeURIComponent(search.trim());
      items.unshift(
        {
          id: "search-projects",
          title: `Search projects for "${search}"`,
          icon: <Search className="h-4 w-4" />,
          category: "search",
          action: () => {
            router.push(`/projects?search=${searchParam}`);
            close();
          },
        },
        {
          id: "search-bids",
          title: `Search bids for "${search}"`,
          icon: <Search className="h-4 w-4" />,
          category: "search",
          action: () => {
            router.push(`/bids?search=${searchParam}`);
            close();
          },
        },
        {
          id: "search-rfis",
          title: `Search RFIs for "${search}"`,
          icon: <Search className="h-4 w-4" />,
          category: "search",
          action: () => {
            router.push(`/rfis?search=${searchParam}`);
            close();
          },
        }
      );
    }

    return items;
  }, [router, close, search]);

  // Filter commands based on search
  const filteredCommands = useMemo(() => {
    if (!search.trim()) return commands;

    const query = search.toLowerCase();
    return commands.filter((cmd) => {
      const searchableText = [
        cmd.title,
        cmd.subtitle || "",
        ...(cmd.keywords || []),
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [commands, search]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {
      search: [],
      action: [],
      navigation: [],
    };

    filteredCommands.forEach((cmd) => {
      groups[cmd.category].push(cmd);
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
          setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
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
    const categoryOrder = ["search", "action", "navigation"];
    for (const cat of categoryOrder) {
      if (cat === category) break;
      offset += groupedCommands[cat].length;
    }
    return offset + indexInCategory;
  };

  const categoryLabels: Record<string, string> = {
    search: "Search",
    action: "Quick Actions",
    navigation: "Navigation",
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
              placeholder="Search commands, projects, bids, RFIs..."
            className="border-0 shadow-none focus-visible:ring-0 h-12"
          />
          <kbd className="hidden sm:inline-flex pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[300px] overflow-y-auto py-2">
          {filteredCommands.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </div>
          ) : (
            <>
              {(["search", "action", "navigation"] as const).map((category) => {
                const items = groupedCommands[category];
                if (items.length === 0) return null;

                return (
                  <div key={category}>
                    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                      {categoryLabels[category]}
                    </div>
                    {items.map((cmd, indexInCategory) => {
                      const flatIndex = getFlatIndex(category, indexInCategory);
                      const isSelected = flatIndex === selectedIndex;

                      return (
                        <button
                          key={cmd.id}
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
                          <div className="flex-1 truncate">
                            <div className="font-medium">{cmd.title}</div>
                            {cmd.subtitle && (
                              <div className="text-xs text-muted-foreground truncate">
                                {cmd.subtitle}
                              </div>
                            )}
                          </div>
                          <ChevronRight
                            className={cn(
                              "h-4 w-4 shrink-0 transition-opacity",
                              isSelected ? "opacity-100" : "opacity-0"
                            )}
                          />
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
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-muted px-1 font-mono">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-muted px-1 font-mono">↵</kbd>
              select
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
