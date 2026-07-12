"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { cn, isValidGuid } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  OverlayMode,
  SpatialGraphResponse,
  SpatialNodeDto,
  SpatialOverlayNodeDto,
  SpatialOverlayResponse,
  SpatialZoneDetailResponse,
} from "@/lib/spatial-types";
import { buildFieldReportHref } from "@/lib/projects";
import {
  ArrowLeft,
  Boxes,
  Info,
  Layers,
  RefreshCw,
  Sprout,
} from "lucide-react";

function bandClass(band: string): string {
  switch (band) {
    case "OnTrack":
      return "border-emerald-500/60 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200";
    case "Watch":
      return "border-amber-500/60 bg-amber-500/10 text-amber-900 dark:text-amber-100";
    case "Risk":
      return "border-red-500/60 bg-red-500/10 text-red-800 dark:text-red-200";
    default:
      return "border-muted-foreground/30 bg-muted/40 text-muted-foreground";
  }
}

function buildTree(nodes: SpatialNodeDto[]): Array<SpatialNodeDto & { depth: number }> {
  const byParent = new Map<string | null, SpatialNodeDto[]>();
  for (const n of nodes) {
    const key = n.parentNodeId ?? null;
    const list = byParent.get(key) ?? [];
    list.push(n);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
  }
  const out: Array<SpatialNodeDto & { depth: number }> = [];
  function walk(parentId: string | null, depth: number) {
    const children = byParent.get(parentId) ?? [];
    for (const c of children) {
      out.push({ ...c, depth });
      walk(c.id, depth + 1);
    }
  }
  walk(null, 0);
  // Orphans (missing parent in payload)
  for (const n of nodes) {
    if (!out.some((x) => x.id === n.id)) out.push({ ...n, depth: 0 });
  }
  return out;
}

function TwinContent({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const valid = isValidGuid(projectId);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [graph, setGraph] = useState<SpatialGraphResponse | null>(null);
  const [overlay, setOverlay] = useState<SpatialOverlayResponse | null>(null);
  const [mode, setMode] = useState<OverlayMode>("rfi");
  const [storeyFilter, setStoreyFilter] = useState<string>("__all__");
  const [asOfDate, setAsOfDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoneDetail, setZoneDetail] = useState<SpatialZoneDetailResponse | null>(
    null
  );
  const [zoneDetailLoading, setZoneDetailLoading] = useState(false);
  const [projectName, setProjectName] = useState("");

  const load = useCallback(async () => {
    if (!valid) return;
    setLoading(true);
    try {
      const overlayQs = new URLSearchParams({ mode });
      if (asOfDate) overlayQs.set("asOf", asOfDate);
      if (storeyFilter && storeyFilter !== "__all__")
        overlayQs.set("storeyNodeId", storeyFilter);
      const [g, o, project] = await Promise.all([
        api<SpatialGraphResponse>(`/api/projects/${projectId}/spatial/graph`),
        api<SpatialOverlayResponse>(
          `/api/projects/${projectId}/spatial/overlays?${overlayQs.toString()}`
        ),
        api<{ name?: string; number?: string }>(`/api/projects/${projectId}`).catch(
          () => null
        ),
      ]);
      setGraph(g);
      setOverlay(o);
      if (project) {
        setProjectName(
          [project.number, project.name].filter(Boolean).join(" — ") || "Project"
        );
      }
    } catch (e) {
      toast.error("Failed to load digital twin", {
        description: e instanceof Error ? e.message : undefined,
      });
      setGraph(null);
      setOverlay(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, valid, mode, storeyFilter, asOfDate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!valid || !selectedId) {
      setZoneDetail(null);
      return;
    }
    let cancelled = false;
    setZoneDetailLoading(true);
    void (async () => {
      try {
        const d = await api<SpatialZoneDetailResponse>(
          `/api/projects/${projectId}/spatial/zones/${selectedId}`
        );
        if (!cancelled) setZoneDetail(d);
      } catch {
        if (!cancelled) setZoneDetail(null);
      } finally {
        if (!cancelled) setZoneDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, selectedId, valid]);

  async function ensureSeeded() {
    setSeeding(true);
    try {
      await api(`/api/projects/${projectId}/spatial/graph/ensure-seeded`, {
        method: "POST",
      });
      toast.success("Zones tree seeded");
      await load();
    } catch (e) {
      toast.error("Could not seed graph", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSeeding(false);
    }
  }

  const storeys = useMemo(
    () =>
      (graph?.nodes ?? []).filter(
        (n) => n.nodeType === "Storey" || n.nodeType === "storey"
      ),
    [graph]
  );

  const tree = useMemo(
    () => (graph?.nodes ? buildTree(graph.nodes) : []),
    [graph]
  );

  const overlayById = useMemo(() => {
    const m = new Map<string, SpatialOverlayNodeDto>();
    for (const n of overlay?.nodes ?? []) m.set(n.spatialNodeId, n);
    return m;
  }, [overlay]);

  const selected = tree.find((n) => n.id === selectedId) ?? null;
  const selectedOverlay = selectedId
    ? overlayById.get(selectedId) ?? null
    : null;

  if (!valid) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Invalid project id.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="digital-twin-workspace">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link
              href={`/projects/${projectId}`}
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Overview
            </Link>
          </div>
          <h1 className="text-xl font-bold flex items-center gap-2 mt-1">
            <Boxes className="h-6 w-6 text-amber-500 shrink-0" />
            Digital Twin
          </h1>
          {projectName && (
            <p className="text-sm text-muted-foreground truncate">{projectName}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Select
            value={mode}
            onValueChange={(v) => setMode(v as OverlayMode)}
          >
            <SelectTrigger className="min-h-[44px] w-[160px]" data-testid="twin-overlay-mode">
              <SelectValue placeholder="Overlay" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rfi">Open RFIs*</SelectItem>
              <SelectItem value="progress">Progress %*</SelectItem>
              <SelectItem value="schedule">Schedule risk*</SelectItem>
            </SelectContent>
          </Select>
          <Select value={storeyFilter} onValueChange={setStoreyFilter}>
            <SelectTrigger className="min-h-[44px] w-[150px]" data-testid="twin-storey-filter">
              <SelectValue placeholder="Storey" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All storeys</SelectItem>
              {storeys.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="min-h-[44px] rounded-md border bg-background px-2 text-sm"
            data-testid="twin-asof-date"
            aria-label="As-of date"
          />
          <Button
            variant="outline"
            className="min-h-[44px]"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {overlay?.truthNote && (
        <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          <Info className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
          <p>
            <span className="font-medium">Truth note: </span>
            {overlay.truthNote}
          </p>
        </div>
      )}

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {!loading && graph && !graph.hasGraph && (
        <Card data-testid="twin-empty-state">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              No spatial graph yet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {graph.message ??
                "Zones-first twin needs a Site → Building → Storey → Zone tree. Overlays stay insufficient (not green) until zones exist."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                className="min-h-[44px] bg-amber-600 hover:bg-amber-700"
                onClick={() => void ensureSeeded()}
                disabled={seeding}
                data-testid="twin-seed-graph"
              >
                <Sprout className="h-4 w-4 mr-1" />
                {seeding ? "Seeding…" : "Seed demo zones tree"}
              </Button>
              <Button variant="outline" className="min-h-[44px]" asChild>
                <Link href={buildFieldReportHref(projectId)}>Field report</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && graph?.hasGraph && (
        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Zones tree
                {graph.graphName && (
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    · {graph.graphName} v{graph.version}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 max-h-[28rem] overflow-y-auto">
              {tree.map((node) => {
                const ov = overlayById.get(node.id);
                const active = selectedId === node.id;
                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => setSelectedId(node.id)}
                    className={cn(
                      "w-full text-left rounded-md border px-2 py-2 min-h-[44px] touch-manipulation transition-colors",
                      active
                        ? "border-amber-500 bg-amber-500/10"
                        : "border-transparent hover:bg-muted/50"
                    )}
                    style={{ paddingLeft: 8 + node.depth * 16 }}
                    data-testid={`twin-node-${node.code}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-xs text-muted-foreground mr-1">
                          {node.nodeType}
                        </span>
                        <span className="font-medium text-sm truncate">
                          {node.name}
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">
                          ({node.code})
                        </span>
                      </div>
                      {ov && (
                        <Badge
                          variant="outline"
                          className={cn("shrink-0 text-[10px]", bandClass(ov.band))}
                        >
                          {ov.label}
                        </Badge>
                      )}
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Zone detail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!selected && (
                <p className="text-sm text-muted-foreground">
                  Select a node to inspect overlay labels. Bands with * are proxies.
                </p>
              )}
              {selected && (
                <>
                  <div>
                    <p className="font-semibold">{selected.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {selected.nodeType} · {selected.code}
                    </p>
                  </div>
                  {selectedOverlay ? (
                    <div
                      className={cn(
                        "rounded-lg border p-3 space-y-1",
                        bandClass(selectedOverlay.band)
                      )}
                    >
                      <p className="font-medium text-sm">{selectedOverlay.label}</p>
                      <p className="text-xs opacity-90">
                        Band: {selectedOverlay.band}
                        {selectedOverlay.isProxy ? " (proxy)" : ""}
                      </p>
                      <p className="text-xs opacity-80">
                        Source: {selectedOverlay.source}
                      </p>
                      {selectedOverlay.insufficientReason && (
                        <p className="text-xs mt-1">
                          {selectedOverlay.insufficientReason}
                        </p>
                      )}
                      {selectedOverlay.formula && (
                        <p className="text-[10px] font-mono opacity-70">
                          {selectedOverlay.formula}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No overlay row for this node.
                    </p>
                  )}
                  {zoneDetailLoading && (
                    <Skeleton className="h-20 w-full" data-testid="twin-zone-detail-loading" />
                  )}
                  {!zoneDetailLoading && zoneDetail && (
                    <div
                      className="space-y-3 border-t pt-3"
                      data-testid="twin-zone-linked-artifacts"
                    >
                      <p className="text-xs text-muted-foreground">
                        {zoneDetail.message}
                      </p>
                      <LinkedList
                        title="Open RFIs"
                        items={zoneDetail.openRfis}
                        empty="No RFIs linked to this zone"
                      />
                      <LinkedList
                        title="Daily reports"
                        items={zoneDetail.dailyReports}
                        empty="No daily reports linked"
                      />
                      <LinkedList
                        title="Progress"
                        items={zoneDetail.progressEntries}
                        empty="No progress entries linked"
                      />
                      <LinkedList
                        title="Schedule"
                        items={zoneDetail.scheduleActivities}
                        empty="No schedule activities linked"
                      />
                    </div>
                  )}
                  {selected.nodeType === "Zone" && (
                    <Button variant="outline" className="w-full min-h-[44px]" asChild>
                      <Link
                        href={`${buildFieldReportHref(projectId)}&zoneId=${encodeURIComponent(selected.id)}`}
                      >
                        Field report in this zone
                      </Link>
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function LinkedList({
  title,
  items,
  empty,
}: {
  title: string;
  items: Array<{ id: string; title: string; status?: string | null; detail?: string | null }>;
  empty: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-md border px-2 py-1.5 text-sm"
            >
              <span className="font-medium">{item.title}</span>
              {item.status && (
                <span className="ml-1 text-xs text-muted-foreground">
                  · {item.status}
                </span>
              )}
              {item.detail && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {item.detail}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function DigitalTwinPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <ErrorBoundary label="digital twin">
      <TwinContent params={params} />
    </ErrorBoundary>
  );
}
