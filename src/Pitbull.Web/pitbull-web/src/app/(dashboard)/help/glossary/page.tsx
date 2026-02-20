"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, BookOpen } from "lucide-react";
import {
  glossaryTerms,
  searchGlossaryTerms,
  CATEGORY_LABELS,
  type GlossaryCategory,
} from "@/lib/glossary-data";

const ALL_CATEGORIES: GlossaryCategory[] = [
  "financial",
  "billing",
  "contracts",
  "project-management",
  "compliance",
  "field-operations",
];

const CATEGORY_COLORS: Record<GlossaryCategory, string> = {
  financial: "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400",
  billing: "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-500/15 dark:text-blue-400",
  contracts: "bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-500/15 dark:text-purple-400",
  "project-management": "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-500/15 dark:text-amber-400",
  compliance: "bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-500/15 dark:text-red-400",
  "field-operations": "bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-500/15 dark:text-orange-400",
};

export default function GlossaryPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<GlossaryCategory | "all">("all");

  const filteredTerms = useMemo(() => {
    let results = search.trim() ? searchGlossaryTerms(search) : glossaryTerms;
    if (activeCategory !== "all") {
      results = results.filter((t) => t.category === activeCategory);
    }
    return results.sort((a, b) => a.term.localeCompare(b.term));
  }, [search, activeCategory]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-amber-500" />
          Construction Glossary
        </h1>
        <p className="text-muted-foreground mt-1">
          {glossaryTerms.length} terms covering construction management, finance, and compliance.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search terms, definitions, or aliases..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeCategory === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveCategory("all")}
          className="text-xs"
        >
          All ({glossaryTerms.length})
        </Button>
        {ALL_CATEGORIES.map((cat) => {
          const count = glossaryTerms.filter((t) => t.category === cat).length;
          return (
            <Button
              key={cat}
              variant={activeCategory === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(cat)}
              className="text-xs"
            >
              {CATEGORY_LABELS[cat]} ({count})
            </Button>
          );
        })}
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        Showing {filteredTerms.length} term{filteredTerms.length !== 1 ? "s" : ""}
        {search.trim() && ` matching "${search}"`}
        {activeCategory !== "all" && ` in ${CATEGORY_LABELS[activeCategory]}`}
      </p>

      {/* Terms grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredTerms.map((term) => (
          <Card key={term.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{term.term}</CardTitle>
                <Badge className={`text-[10px] shrink-0 ${CATEGORY_COLORS[term.category]}`}>
                  {CATEGORY_LABELS[term.category]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{term.definition}</p>
              {term.aliases && term.aliases.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  <span className="text-[10px] text-muted-foreground mr-1">Also:</span>
                  {term.aliases.map((alias) => (
                    <Badge key={alias} variant="outline" className="text-[10px]">
                      {alias}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty state */}
      {filteredTerms.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-lg font-medium">No terms found</p>
          <p className="text-sm text-muted-foreground mt-1">
            Try adjusting your search or category filter.
          </p>
        </div>
      )}
    </div>
  );
}
