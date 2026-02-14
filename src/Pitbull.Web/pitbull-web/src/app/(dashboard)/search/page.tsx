"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Search,
  FolderKanban,
  Users,
  FileSpreadsheet,
  HelpCircle,
  Truck,
  Filter,
  SortAsc,
  SortDesc,
  Loader2,
} from "lucide-react";
import api from "@/lib/api";
import type {
  Project,
  Bid,
  Rfi,
  ListEmployeesResult,
  ListEquipmentResult,
  PagedResult,
} from "@/lib/types";
import { projectStatusLabel } from "@/lib/projects";
import { cn } from "@/lib/utils";

type EntityType = "all" | "projects" | "employees" | "equipment" | "bids" | "rfis";
type SortMode = "relevance" | "date";

interface SearchResult {
  id: string;
  type: EntityType;
  title: string;
  subtitle: string;
  badge?: string;
  badgeClass?: string;
  href: string;
  date?: string;
}

const ENTITY_TABS: { value: EntityType; label: string; icon: React.ReactNode }[] = [
  { value: "all", label: "All", icon: <Search className="h-3.5 w-3.5" /> },
  { value: "projects", label: "Projects", icon: <FolderKanban className="h-3.5 w-3.5" /> },
  { value: "employees", label: "Employees", icon: <Users className="h-3.5 w-3.5" /> },
  { value: "equipment", label: "Equipment", icon: <Truck className="h-3.5 w-3.5" /> },
  { value: "bids", label: "Bids", icon: <FileSpreadsheet className="h-3.5 w-3.5" /> },
  { value: "rfis", label: "RFIs", icon: <HelpCircle className="h-3.5 w-3.5" /> },
];

const classificationLabels: Record<number, string> = {
  0: "Hourly",
  1: "Salaried",
  2: "Contractor",
  3: "Apprentice",
  4: "Supervisor",
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQuery);
  const [activeFilter, setActiveFilter] = useState<EntityType>("all");
  const [sortMode, setSortMode] = useState<SortMode>("relevance");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);
    const allResults: SearchResult[] = [];
    const searchParam = encodeURIComponent(searchQuery.trim());

    try {
      // Search projects
      try {
        const projects = await api<PagedResult<Project>>(
          `/api/projects?search=${searchParam}&pageSize=20`
        );
        projects.items.forEach((p) => {
          allResults.push({
            id: p.id,
            type: "projects",
            title: p.name,
            subtitle: `${p.number}${p.clientName ? ` · ${p.clientName}` : ""}`,
            badge: projectStatusLabel(p.status),
            badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
            href: `/projects/${p.id}`,
            date: p.createdAt,
          });
        });
      } catch {
        // Projects search failed silently
      }

      // Search employees
      try {
        const employees = await api<ListEmployeesResult>(
          `/api/employees?search=${searchParam}&pageSize=20`
        );
        employees.items.forEach((e) => {
          allResults.push({
            id: e.id,
            type: "employees",
            title: e.fullName,
            subtitle: `${e.employeeNumber}${e.title ? ` · ${e.title}` : ""}`,
            badge: classificationLabels[e.classification] || "Unknown",
            badgeClass: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200",
            href: `/employees/${e.id}`,
            date: e.createdAt,
          });
        });
      } catch {
        // Employees search failed silently
      }

      // Search bids
      try {
        const bids = await api<PagedResult<Bid>>(
          `/api/bids?search=${searchParam}&pageSize=20`
        );
        bids.items.forEach((b) => {
          allResults.push({
            id: b.id,
            type: "bids",
            title: b.name,
            subtitle: `${b.bidNumber}${b.clientName ? ` · ${b.clientName}` : ""}`,
            badge: b.status,
            badgeClass: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
            href: `/bids/${b.id}`,
            date: b.bidDate || undefined,
          });
        });
      } catch {
        // Bids search failed silently
      }

      // Search RFIs
      try {
        const rfis = await api<PagedResult<Rfi>>(
          `/api/rfis?search=${searchParam}&pageSize=20`
        );
        rfis.items.forEach((r) => {
          allResults.push({
            id: r.id,
            type: "rfis",
            title: `RFI #${String(r.number).padStart(3, "0")}: ${r.subject}`,
            subtitle: r.ballInCourtName ? `Ball in court: ${r.ballInCourtName}` : "",
            badge: r.status === 0 ? "Open" : r.status === 1 ? "Answered" : "Closed",
            badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
            href: `/rfis/${r.id}`,
            date: r.createdAt,
          });
        });
      } catch {
        // RFIs search failed silently
      }

      // Search equipment
      try {
        const equipment = await api<ListEquipmentResult>(
          `/api/equipment?search=${searchParam}&pageSize=20`
        );
        equipment.items.forEach((eq) => {
          allResults.push({
            id: eq.id,
            type: "equipment",
            title: eq.name,
            subtitle: `${eq.code}${eq.serialNumber ? ` · SN: ${eq.serialNumber}` : ""}`,
            badge: eq.typeName,
            badgeClass: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200",
            href: `/equipment/${eq.id}`,
            date: eq.createdAt,
          });
        });
      } catch {
        // Equipment search failed silently
      }

      setResults(allResults);
    } catch {
      // Overall search failed
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Search on mount if query param exists
  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
    // Focus search input
    searchInputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search
  function handleSearchChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // Update URL
      const params = new URLSearchParams();
      if (value.trim()) params.set("q", value.trim());
      router.replace(`/search${params.toString() ? `?${params}` : ""}`, { scroll: false });
      performSearch(value);
    }, 400);
  }

  // Filter results by entity type
  const filteredResults = useMemo(() => {
    let r = results;
    if (activeFilter !== "all") {
      r = r.filter((item) => item.type === activeFilter);
    }

    // Sort
    if (sortMode === "date") {
      r = [...r].sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      });
    }

    return r;
  }, [results, activeFilter, sortMode]);

  // Group by type for "all" view
  const groupedResults = useMemo(() => {
    if (activeFilter !== "all") return null;

    const groups: Record<string, SearchResult[]> = {};
    filteredResults.forEach((r) => {
      if (!groups[r.type]) groups[r.type] = [];
      groups[r.type]!.push(r);
    });
    return groups;
  }, [filteredResults, activeFilter]);

  // Count by type
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    results.forEach((r) => {
      counts[r.type] = (counts[r.type] || 0) + 1;
    });
    return counts;
  }, [results]);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Search" }]} />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Search</h1>
        <p className="text-muted-foreground">
          Find projects, employees, equipment, bids, and RFIs
        </p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          value={query}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search across all entities..."
          className="pl-10 h-12 text-base"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground animate-spin" />
        )}
      </div>

      {/* Filters and Sort */}
      {hasSearched && results.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Entity type tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            <Filter className="h-4 w-4 text-muted-foreground mr-1 shrink-0" />
            {ENTITY_TABS.map((tab) => {
              const count = tab.value === "all" ? results.length : (typeCounts[tab.value] || 0);
              if (tab.value !== "all" && count === 0) return null;

              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveFilter(tab.value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
                    activeFilter === tab.value
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  )}
                >
                  {tab.icon}
                  {tab.label}
                  <span className="text-[10px] opacity-70">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Sort */}
          <button
            onClick={() => setSortMode(sortMode === "relevance" ? "date" : "relevance")}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            {sortMode === "relevance" ? (
              <SortAsc className="h-3.5 w-3.5" />
            ) : (
              <SortDesc className="h-3.5 w-3.5" />
            )}
            Sort by: {sortMode === "relevance" ? "Relevance" : "Date"}
          </button>
        </div>
      )}

      {/* Results */}
      {!hasSearched ? (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={Search}
              title="Start searching"
              description="Enter a search term to find projects, employees, equipment, bids, and RFIs across your workspace."
            />
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Searching...</p>
          </CardContent>
        </Card>
      ) : filteredResults.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={Search}
              title="No results found"
              description={`No matches found for "${query}". Try a different search term or broaden your filters.`}
            />
          </CardContent>
        </Card>
      ) : activeFilter === "all" && groupedResults ? (
        // Grouped results view
        <div className="space-y-6">
          {Object.entries(groupedResults).map(([type, items]) => {
            const tab = ENTITY_TABS.find((t) => t.value === type);
            return (
              <Card key={type}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      {tab?.icon}
                      {tab?.label || type}
                    </CardTitle>
                    <CardDescription>{items.length} result{items.length !== 1 ? "s" : ""}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 p-2 sm:p-6 sm:pt-0">
                  {items.slice(0, 5).map((result) => (
                    <SearchResultItem key={result.id} result={result} />
                  ))}
                  {items.length > 5 && (
                    <Button
                      variant="ghost"
                      className="w-full text-sm text-muted-foreground"
                      onClick={() => setActiveFilter(type as EntityType)}
                    >
                      Show all {items.length} {tab?.label?.toLowerCase() || type}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        // Flat results view (when filtered by type)
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {filteredResults.length} result{filteredResults.length !== 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-2 sm:p-6 sm:pt-0">
            {filteredResults.map((result) => (
              <SearchResultItem key={result.id} result={result} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SearchResultItem({ result }: { result: SearchResult }) {
  return (
    <Link
      href={result.href}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent/50"
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{result.title}</p>
        {result.subtitle && (
          <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {result.date && (
          <span className="hidden sm:block text-xs text-muted-foreground">
            {formatDate(result.date)}
          </span>
        )}
        {result.badge && (
          <Badge variant="secondary" className={result.badgeClass}>
            {result.badge}
          </Badge>
        )}
      </div>
    </Link>
  );
}
