"use client";

import { useEffect, useState, useCallback, useMemo, useRef, Suspense } from "react";
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
  FileText,
  Hash,
  Filter,
  SortAsc,
  SortDesc,
  Loader2,
} from "lucide-react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type EntityType = "all" | "project" | "employee" | "contract" | "bid" | "rfi" | "costcode";
type SortMode = "relevance" | "name";

interface SearchResultItem {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  url: string;
}

interface SearchResponse {
  results: SearchResultItem[];
  totalCount: number;
}

const ENTITY_TABS: { value: EntityType; label: string; icon: React.ReactNode }[] = [
  { value: "all", label: "All", icon: <Search className="h-3.5 w-3.5" /> },
  { value: "project", label: "Projects", icon: <FolderKanban className="h-3.5 w-3.5" /> },
  { value: "employee", label: "Employees", icon: <Users className="h-3.5 w-3.5" /> },
  { value: "contract", label: "Contracts", icon: <FileText className="h-3.5 w-3.5" /> },
  { value: "bid", label: "Bids", icon: <FileSpreadsheet className="h-3.5 w-3.5" /> },
  { value: "rfi", label: "RFIs", icon: <HelpCircle className="h-3.5 w-3.5" /> },
  { value: "costcode", label: "Cost Codes", icon: <Hash className="h-3.5 w-3.5" /> },
];

const TYPE_BADGE_STYLES: Record<string, string> = {
  project: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
  employee: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200",
  contract: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-200",
  bid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
  rfi: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
  costcode: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  project: <FolderKanban className="h-4 w-4" />,
  employee: <Users className="h-4 w-4" />,
  contract: <FileText className="h-4 w-4" />,
  bid: <FileSpreadsheet className="h-4 w-4" />,
  rfi: <HelpCircle className="h-4 w-4" />,
  costcode: <Hash className="h-4 w-4" />,
};

const TYPE_LABELS: Record<string, string> = {
  project: "Projects",
  employee: "Employees",
  contract: "Contracts",
  bid: "Bids",
  rfi: "RFIs",
  costcode: "Cost Codes",
};

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQuery);
  const [activeFilter, setActiveFilter] = useState<EntityType>("all");
  const [sortMode, setSortMode] = useState<SortMode>("relevance");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
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

    try {
      const data = await api<SearchResponse>(
        `/api/search?q=${encodeURIComponent(searchQuery.trim())}`
      );
      setResults(data.results);
    } catch (err) {
      setResults([]);
      toast.error(err instanceof Error ? err.message : "Search failed");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Search on mount if query param exists
  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
    searchInputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search
  function handleSearchChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (value.trim()) params.set("q", value.trim());
      router.replace(`/search${params.toString() ? `?${params}` : ""}`, { scroll: false });
      performSearch(value);
    }, 300);
  }

  // Filter and sort results
  const filteredResults = useMemo(() => {
    let r = results;
    if (activeFilter !== "all") {
      r = r.filter((item) => item.type === activeFilter);
    }
    if (sortMode === "name") {
      r = [...r].sort((a, b) => a.title.localeCompare(b.title));
    }
    return r;
  }, [results, activeFilter, sortMode]);

  // Group by type for "all" view
  const groupedResults = useMemo(() => {
    if (activeFilter !== "all") return null;

    const groups: Record<string, SearchResultItem[]> = {};
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
          Find projects, employees, contracts, bids, RFIs, and cost codes
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

          <button
            onClick={() => setSortMode(sortMode === "relevance" ? "name" : "relevance")}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            {sortMode === "relevance" ? (
              <SortAsc className="h-3.5 w-3.5" />
            ) : (
              <SortDesc className="h-3.5 w-3.5" />
            )}
            Sort by: {sortMode === "relevance" ? "Relevance" : "Name"}
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
              description="Enter a search term to find projects, employees, contracts, bids, RFIs, and cost codes across your workspace."
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
        <div className="space-y-6">
          {Object.entries(groupedResults).map(([type, items]) => (
            <Card key={type}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    {TYPE_ICONS[type]}
                    {TYPE_LABELS[type] || type}
                  </CardTitle>
                  <CardDescription>{items.length} result{items.length !== 1 ? "s" : ""}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 p-2 sm:p-6 sm:pt-0">
                {items.slice(0, 5).map((result) => (
                  <ResultItem key={result.id} result={result} />
                ))}
                {items.length > 5 && (
                  <Button
                    variant="ghost"
                    className="w-full text-sm text-muted-foreground"
                    onClick={() => setActiveFilter(type as EntityType)}
                  >
                    Show all {items.length} {TYPE_LABELS[type]?.toLowerCase() || type}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {filteredResults.length} result{filteredResults.length !== 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-2 sm:p-6 sm:pt-0">
            {filteredResults.map((result) => (
              <ResultItem key={result.id} result={result} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function getResultUrl(result: SearchResultItem): string {
  // Cost codes don't have detail pages — link to the list page
  if (result.type === "costcode") return "/cost-codes";
  return result.url;
}

function ResultItem({ result }: { result: SearchResultItem }) {
  return (
    <Link
      href={getResultUrl(result)}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent/50"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-background">
        {TYPE_ICONS[result.type] || <Search className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{result.title}</p>
        {result.subtitle && (
          <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
        )}
      </div>
      <Badge variant="secondary" className={TYPE_BADGE_STYLES[result.type] || ""}>
        {TYPE_LABELS[result.type] || result.type}
      </Badge>
    </Link>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}
