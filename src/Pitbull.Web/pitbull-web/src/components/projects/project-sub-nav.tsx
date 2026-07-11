"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Briefcase,
  Calendar,
  CheckSquare,
  ClipboardCheck,
  ClipboardList,
  FileQuestion,
  FileStack,
  FileText,
  FolderOpen,
  Footprints,
  LayoutGrid,
  MessageSquare,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import {
  getPrimaryProjectNavItems,
  getProjectNavItems,
  groupProjectNavItems,
  isProjectNavItemActive,
  shouldShowProjectSubNav,
  type ProjectNavItem,
} from "@/lib/project-nav";
import { cn } from "@/lib/utils";

const ICON_MAP = {
  walk: Footprints,
  report: FileText,
  plans: FileStack,
  schedule: Calendar,
  overview: BarChart3,
  rfi: FileQuestion,
  submittal: ClipboardList,
  docs: FolderOpen,
  tasks: CheckSquare,
  cost: Briefcase,
  punch: ClipboardCheck,
  progress: TrendingUp,
  ev: BarChart3,
  co: FileText,
  meetings: Users,
  comms: MessageSquare,
  narratives: FileText,
  daily: FileText,
} as const;

function NavIcon({
  name,
  className,
}: {
  name: ProjectNavItem["icon"];
  className?: string;
}) {
  const Icon = ICON_MAP[name] ?? LayoutGrid;
  return <Icon className={className} />;
}

interface ProjectSubNavProps {
  projectId: string;
  className?: string;
}

/**
 * Mobile: 2×2 field hub (Site walk first) + "More on this job" sheet.
 * Desktop: compact primary row + same sheet for the long tail — no horizontal scroll marathon.
 */
export function ProjectSubNav({ projectId, className }: ProjectSubNavProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [query, setQuery] = useState("");

  const allItems = useMemo(() => getProjectNavItems(projectId), [projectId]);
  const primary = useMemo(
    () => getPrimaryProjectNavItems(projectId),
    [projectId]
  );

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = q
      ? allItems.filter(
          (i) =>
            i.label.toLowerCase().includes(q) ||
            (i.shortLabel?.toLowerCase().includes(q) ?? false)
        )
      : allItems;
    return groupProjectNavItems(items);
  }, [allItems, query]);

  if (!shouldShowProjectSubNav(pathname)) {
    return null;
  }

  function closeMore() {
    setMoreOpen(false);
    setQuery("");
  }

  return (
    <div className={cn("space-y-3", className)} data-testid="project-sub-nav">
      {/* Mobile field hub */}
      <div className="md:hidden space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {primary.map((item) => {
            const active = isProjectNavItemActive(pathname, item, projectId);
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex min-h-[56px] flex-col items-start justify-center gap-1 rounded-xl border px-3 py-3 touch-manipulation transition-colors",
                  active
                    ? "border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
                    : "border-border bg-card hover:bg-muted/60 active:bg-muted"
                )}
              >
                <NavIcon
                  name={item.icon}
                  className={cn(
                    "h-5 w-5",
                    active ? "text-amber-600" : "text-muted-foreground"
                  )}
                />
                <span className="text-sm font-semibold leading-tight">
                  {item.shortLabel ?? item.label}
                </span>
              </Link>
            );
          })}
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full min-h-[48px] text-base"
          onClick={() => setMoreOpen(true)}
        >
          <LayoutGrid className="mr-2 h-4 w-4" />
          More on this job
        </Button>
      </div>

      {/* Desktop: primary strip without endless scroll */}
      <div className="hidden md:flex md:items-center md:gap-1 md:flex-wrap border-b pb-0">
        {primary.map((item) => {
          const active = isProjectNavItemActive(pathname, item, projectId);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                active
                  ? "border-amber-500 text-amber-600"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              )}
            >
              <NavIcon name={item.icon} className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
            "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
          )}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          More
        </button>
      </div>

      <Sheet
        open={moreOpen}
        onOpenChange={(open) => {
          setMoreOpen(open);
          if (!open) setQuery("");
        }}
      >
        <SheetContent side="bottom" className="rounded-t-xl max-h-[85vh] flex flex-col p-0 gap-0">
          <SheetHeader className="p-4 pb-2 border-b space-y-3 text-left">
            <SheetTitle>On this job</SheetTitle>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find RFIs, cost, meetings…"
              className="min-h-[48px] text-base"
              autoComplete="off"
            />
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-2 pb-6 pt-2">
            {filteredGroups.length === 0 ? (
              <p className="px-3 py-8 text-sm text-muted-foreground text-center">
                No matches for “{query}”
              </p>
            ) : (
              filteredGroups.map((group) => (
                <div key={group.group} className="mb-3">
                  <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {group.label}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const active = isProjectNavItemActive(
                        pathname,
                        item,
                        projectId
                      );
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          onClick={closeMore}
                          className={cn(
                            "flex min-h-[48px] items-center gap-3 rounded-lg px-3 py-2.5 touch-manipulation transition-colors",
                            active
                              ? "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
                              : "hover:bg-muted active:bg-muted/80"
                          )}
                        >
                          <NavIcon
                            name={item.icon}
                            className="h-5 w-5 shrink-0 text-muted-foreground"
                          />
                          <span className="font-medium text-base">
                            {item.label}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
