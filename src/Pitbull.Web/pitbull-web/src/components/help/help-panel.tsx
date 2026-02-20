"use client";

import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, BookOpen, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import Link from "next/link";
import {
  getTermsForRoute,
  searchGlossaryTerms,
  CATEGORY_LABELS,
  type GlossaryTerm,
  type GlossaryCategory,
} from "@/lib/glossary-data";

const CATEGORY_COLORS: Record<GlossaryCategory, string> = {
  financial: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400",
  billing: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-400",
  contracts: "bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-400",
  "project-management": "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400",
  compliance: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400",
  "field-operations": "bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-400",
};

function TermCard({ term }: { term: GlossaryTerm }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-lg border p-3">
      <button onClick={() => setExpanded(!expanded)} className="flex items-start justify-between w-full text-left gap-2">
        <div className="min-w-0">
          <p className="font-medium text-sm">{term.term}</p>
          {!expanded && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{term.definition}</p>}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
      </button>
      {expanded && (
        <div className="mt-2 space-y-2">
          <p className="text-sm text-foreground/80">{term.definition}</p>
          <div className="flex flex-wrap gap-1.5">
            <Badge className={`text-[10px] ${CATEGORY_COLORS[term.category]}`}>{CATEGORY_LABELS[term.category]}</Badge>
            {term.aliases?.map((alias) => <Badge key={alias} variant="outline" className="text-[10px]">{alias}</Badge>)}
          </div>
        </div>
      )}
    </div>
  );
}

export function HelpPanel({ open, onOpenChange, pathname }: { open: boolean; onOpenChange: (open: boolean) => void; pathname: string }) {
  const [search, setSearch] = useState("");
  const contextualTerms = useMemo(() => getTermsForRoute(pathname), [pathname]);
  const searchResults = useMemo(() => { if (!search.trim()) return null; return searchGlossaryTerms(search); }, [search]);
  const displayTerms = searchResults ?? contextualTerms;
  const isSearching = search.trim().length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-amber-500" />Help & Glossary</SheetTitle>
        </SheetHeader>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search terms..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {!isSearching && contextualTerms.length > 0 && (
          <div className="mb-3"><p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Relevant to this page</p></div>
        )}
        {isSearching && (
          <div className="mb-3"><p className="text-xs text-muted-foreground">{displayTerms.length} result{displayTerms.length !== 1 ? "s" : ""} for &ldquo;{search}&rdquo;</p></div>
        )}
        <div className="space-y-2">{displayTerms.map((term) => <TermCard key={term.id} term={term} />)}</div>
        {displayTerms.length === 0 && isSearching && (
          <div className="text-center py-8"><p className="text-sm text-muted-foreground">No matching terms found.</p></div>
        )}
        {displayTerms.length === 0 && !isSearching && (
          <div className="text-center py-8">
            <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No contextual help for this page.</p>
            <p className="text-xs text-muted-foreground mt-1">Try searching or browse the full glossary.</p>
          </div>
        )}
        <div className="mt-6 pt-4 border-t">
          <Button variant="outline" asChild className="w-full">
            <Link href="/help/glossary" onClick={() => onOpenChange(false)}>
              <BookOpen className="h-4 w-4 mr-2" />Browse Full Glossary<ExternalLink className="h-3 w-3 ml-auto" />
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
