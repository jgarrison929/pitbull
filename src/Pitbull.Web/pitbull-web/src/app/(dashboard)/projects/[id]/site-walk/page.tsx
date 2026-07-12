"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { isValidGuid } from "@/lib/utils";
import type { PmEntityDto, PmPagedResult } from "@/lib/pm-types";
import type { PagedResult, Rfi, Subcontract } from "@/lib/types";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { buildPlansSpecsHref, resolveSiteWalkPlansFilter } from "@/lib/plans-specs-lookup";
import { buildProjectRfisForSubHref } from "@/lib/rfi-sub-link";
import {
  buildSubStatusItems,
  filterLookAheadTasks,
  type ScheduleLookAheadTask,
  type SubStatusItem,
} from "@/lib/site-walk";
import {
  crewDisplayName,
  filterCrewOnProject,
  rankSubsForLookAhead,
} from "@/lib/site-walk-trades";
import type { MyCrewResult, CrewMemberDto } from "@/types/crew-entry.types";
import {
  ArrowLeft,
  Boxes,
  Calendar,
  FileStack,
  Footprints,
  HardHat,
  MessageSquareWarning,
  Users,
} from "lucide-react";
import { isDigitalTwinEnabled } from "@/lib/feature-flags";
import { shouldShowSiteWalkTwinLink } from "@/lib/site-walk-twin-link";

function asDataMap(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number.parseFloat(value);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

function asBool(value: unknown): boolean {
  return value === true || value === "true";
}

function healthBadge(health: SubStatusItem["health"]) {
  switch (health) {
    case "on_track":
      return <Badge className="bg-emerald-600 text-white">OK*</Badge>;
    case "at_risk":
      return <Badge className="bg-amber-500 text-white">Watch*</Badge>;
    case "delayed":
      return <Badge variant="destructive">Risk*</Badge>;
  }
}

function SiteWalkContent({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const valid = isValidGuid(projectId);
  const [loading, setLoading] = useState(true);
  const [lookAhead, setLookAhead] = useState<ScheduleLookAheadTask[]>([]);
  const [subs, setSubs] = useState<
    Array<SubStatusItem & { relevanceScore?: number }>
  >([]);
  const [openRfis, setOpenRfis] = useState<Rfi[]>([]);
  const [crewOnJob, setCrewOnJob] = useState<CrewMemberDto[]>([]);
  const [projectName, setProjectName] = useState("");
  const [hasTradeRanking, setHasTradeRanking] = useState(false);

  const load = useCallback(async () => {
    if (!valid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [project, schedules, subRes, rfiRes, crewRes] = await Promise.all([
        api<{ name?: string; number?: string }>(`/api/projects/${projectId}`).catch(
          () => null
        ),
        api<PmPagedResult>(
          `/api/projects/${projectId}/schedules?page=1&pageSize=20`
        ).catch(() => ({ items: [] as PmEntityDto[] })),
        api<PagedResult<Subcontract>>(
          `/api/subcontracts?projectId=${projectId}&pageSize=50`
        ).catch(() => ({
          items: [] as Subcontract[],
          totalCount: 0,
          page: 1,
          pageSize: 50,
          totalPages: 0,
        })),
        api<PagedResult<Rfi>>(`/api/projects/${projectId}/rfis?pageSize=50`).catch(
          () => ({
            items: [] as Rfi[],
            totalCount: 0,
            page: 1,
            pageSize: 50,
            totalPages: 0,
          })
        ),
        // Real crew list — filter to this project’s assignments
        api<MyCrewResult>("/api/employees/my-crew").catch(() => null),
      ]);

      if (project) {
        setProjectName(
          [project.number, project.name].filter(Boolean).join(" — ") || "Project"
        );
      }

      const scheduleList = schedules.items ?? [];
      const active =
        scheduleList.find((s) => s.status === "Active") ?? scheduleList[0];

      let tasks: ScheduleLookAheadTask[] = [];
      if (active) {
        const actResult = await api<PmPagedResult>(
          `/api/projects/${projectId}/schedules/${active.id}/activities?page=1&pageSize=500`
        ).catch(() => ({ items: [] as PmEntityDto[] }));
        tasks = (actResult.items ?? []).map((item) => {
          const data = asDataMap(item.data);
          return {
            id: item.id,
            name: item.name || asString(data.Name) || "Untitled",
            status: item.status || asString(data.Status) || "NotStarted",
            plannedStart: asString(data.PlannedStart) || null,
            plannedFinish: asString(data.PlannedFinish) || null,
            percentComplete: asNumber(data.PercentComplete),
            isCritical: asBool(data.IsCritical),
            wbsCode: asString(data.WbsCode) || undefined,
          };
        });
        setLookAhead(filterLookAheadTasks(tasks, new Date(), 7));
      } else {
        setLookAhead([]);
      }

      const nearTerm = filterLookAheadTasks(tasks, new Date(), 7);
      const lookTexts = nearTerm.map((t) => t.name);

      const rfiItems = rfiRes.items ?? [];
      const open = rfiItems.filter((r) => {
        const st = String(r.status ?? "");
        return (
          st !== "Closed" && st !== "3" && !st.toLowerCase().includes("closed")
        );
      });
      setOpenRfis(open.slice(0, 10));

      const baseSubs = buildSubStatusItems(
        (subRes.items ?? []).map((s) => ({
          id: s.id,
          subcontractorName: s.subcontractorName,
          tradeCode: s.tradeCode,
          status: String(s.status),
          updatedAt: s.updatedAt,
          createdAt: s.createdAt,
          insuranceCurrent: s.insuranceCurrent,
        }))
      );

      // Rank by trade language from THIS job’s look-ahead — not portfolio “electrical green”
      const ranked = rankSubsForLookAhead(
        baseSubs.map((s) => ({
          ...s,
          trade: s.trade,
          scope: undefined as string | undefined,
        })),
        lookTexts
      );
      setHasTradeRanking(lookTexts.length > 0 && ranked.some((r) => r.relevanceScore > 0));
      setSubs(ranked);

      if (crewRes?.crewMembers) {
        setCrewOnJob(filterCrewOnProject(crewRes.crewMembers, projectId));
      } else {
        setCrewOnJob([]);
      }
    } catch (error) {
      toast.error("Failed to load site walk", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }, [projectId, valid]);

  useEffect(() => {
    void load();
  }, [load]);

  const criticalCount = useMemo(
    () => lookAhead.filter((t) => t.isCritical).length,
    [lookAhead]
  );

  if (!valid) {
    return (
      <div className="p-6 text-sm text-destructive">Invalid project ID.</div>
    );
  }

  return (
    <div className="space-y-4 pb-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="min-h-[44px] min-w-[44px]"
          asChild
        >
          <Link href={`/projects/${projectId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Footprints className="h-5 w-5 text-amber-500" />
            Today on this job
          </h1>
          <p className="text-sm text-muted-foreground truncate">
            {projectName || "Loading…"}
          </p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground px-1">
        What matters for the walk on <strong>this project</strong> — your crew, near-term
        work, trades that match that work, open issues. Not a portfolio status tour.
      </p>

      {/* Big field actions */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          className="min-h-[52px] bg-amber-500 hover:bg-amber-600 text-white text-base"
          asChild
        >
          <Link href={`/daily-reports/mobile?projectId=${projectId}`}>
            Log report
          </Link>
        </Button>
        <Button variant="outline" className="min-h-[52px] text-base" asChild>
          <Link href={`/time-tracking/crew-entry?projectId=${projectId}`}>
            Crew time
          </Link>
        </Button>
        <Button variant="outline" className="min-h-[52px]" asChild>
          <Link
            href={buildPlansSpecsHref(projectId, {
              view: "plans",
              ...resolveSiteWalkPlansFilter({
                // Prefer first look-ahead task name fragment as search prefill (not an invented sheet #).
                lookAheadKeyword: lookAhead[0]?.name?.split(/\s+/)[0] ?? null,
              }),
            })}
            data-testid="site-walk-open-plans"
          >
            <FileStack className="h-4 w-4 mr-2" />
            Plans
          </Link>
        </Button>
        <Button variant="outline" className="min-h-[52px]" asChild>
          <Link href={`/projects/${projectId}/schedule`}>
            <Calendar className="h-4 w-4 mr-2" />
            Schedule
          </Link>
        </Button>
        {shouldShowSiteWalkTwinLink(isDigitalTwinEnabled()) && (
          <Button
            variant="outline"
            className="min-h-[52px] col-span-2"
            asChild
            data-testid="site-walk-open-twin"
          >
            <Link href={`/projects/${projectId}/twin`}>
              <Boxes className="h-4 w-4 mr-2" />
              Digital Twin (zones)
            </Link>
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <>
          {/* Crew on THIS project */}
          <Card data-testid="site-walk-crew">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <HardHat className="h-4 w-4 text-amber-500" />
                Crew on this job
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {crewOnJob.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No crew members with an active assignment to this project (from your
                  crew list). Assign people under Employees, or open Crew time.
                </p>
              ) : (
                crewOnJob.slice(0, 12).map((m) => (
                  <div
                    key={m.id}
                    className="rounded-lg border p-3 flex justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {crewDisplayName(m)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {m.title || m.employeeNumber}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <Button variant="outline" className="w-full min-h-[44px]" asChild>
                <Link href="/time-tracking/crew-entry">Enter crew hours</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Look-ahead */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-amber-500" />
                  Near-term work (7 days)
                </span>
                {criticalCount > 0 && (
                  <Badge variant="destructive">{criticalCount} critical path</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {lookAhead.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No near-term schedule activities. Activate a schedule with dates, or
                  log work in the daily report.
                </p>
              ) : (
                lookAhead.slice(0, 12).map((task) => (
                  <div
                    key={task.id}
                    className="rounded-lg border p-3 space-y-1"
                    data-testid="look-ahead-card"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm leading-snug">{task.name}</p>
                      {task.isCritical && (
                        <Badge
                          variant="destructive"
                          className="shrink-0 text-[10px]"
                        >
                          CP
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>{task.status}</span>
                      <span>{task.percentComplete}%</span>
                      {task.plannedFinish && (
                        <span>Finish {task.plannedFinish.slice(0, 10)}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Subs — ranked by look-ahead trade language */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-amber-500" />
                Subs on this project
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {hasTradeRanking && (
                <p className="text-xs text-muted-foreground">
                  Sorted by likely match to near-term work names (e.g. pour/form before
                  electrical). *Status is a proxy from contract/insurance — not live field
                  green/red.
                </p>
              )}
              {!hasTradeRanking && subs.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  *Status is a proxy (contract status / insurance), not live field
                  performance. No schedule keywords to rank trades yet.
                </p>
              )}
              {subs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No subcontracts on this project.
                </p>
              ) : (
                subs.slice(0, 12).map((sub) => (
                  <Link
                    key={sub.id}
                    href={buildProjectRfisForSubHref(projectId, {
                      subName: sub.name,
                      subId: sub.id,
                    })}
                    className="rounded-lg border p-3 flex items-center justify-between gap-2 touch-manipulation hover:border-amber-400"
                    data-testid="sub-status-card"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{sub.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {sub.trade || sub.status}
                        {(sub.relevanceScore ?? 0) > 0 && (
                          <span className="text-amber-700"> · matches today&apos;s work</span>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {healthBadge(sub.health)}
                      <span className="text-[10px] text-amber-700">RFIs</span>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          {/* Open RFIs */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquareWarning className="h-4 w-4 text-amber-500" />
                Open RFIs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {openRfis.length === 0 ? (
                <p className="text-sm text-muted-foreground">No open RFIs.</p>
              ) : (
                openRfis.map((rfi) => (
                  <Link
                    key={rfi.id}
                    href={`/rfis/${rfi.id}?projectId=${projectId}`}
                    className="block rounded-lg border p-3 hover:border-amber-400 touch-manipulation min-h-[48px]"
                  >
                    <p className="font-medium text-sm">
                      {rfi.subject || `RFI ${rfi.number}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      #{rfi.number} · {String(rfi.status)}
                    </p>
                  </Link>
                ))
              )}
              <Button variant="outline" className="w-full min-h-[44px]" asChild>
                <Link href={`/rfis/new?projectId=${projectId}`}>New RFI</Link>
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default function SiteWalkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <ErrorBoundary label="site walk">
      <SiteWalkContent params={params} />
    </ErrorBoundary>
  );
}
