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
import {
  buildPhotoPinsUrl,
  photoThumbsEmptyMessage,
  pinsWithThumbnails,
  type TwinPhotoPinDto,
  type TwinPhotoPinsResponse,
} from "@/lib/twin-photo-pins";
import { resolveTwinOverlayPollMs } from "@/lib/twin-overlay-poll";
import {
  TWIN_ZONE_DRILL_EVENT,
  buildTwinZoneDrillProps,
} from "@/lib/twin-zone-drill-analytics";
import {
  buildModelAssetsUrl,
  buildStartConversionUrl,
  modelAssetStatusLabel,
  type ModelAssetDto,
  type ModelAssetListResponse,
} from "@/lib/model-assets";
import { buildFieldReportHref } from "@/lib/projects";
import { buildPlansSpecsHref } from "@/lib/plans-specs-lookup";
import { buildSiteWalkHref } from "@/lib/site-walk";
import { captureProductEvent } from "@/lib/posthog";
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
  const [zonePhotoPins, setZonePhotoPins] = useState<TwinPhotoPinDto[]>([]);
  const [zonePhotoMessage, setZonePhotoMessage] = useState<string | null>(null);
  const [zonePhotosLoading, setZonePhotosLoading] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [modelAssets, setModelAssets] = useState<ModelAssetDto[]>([]);
  const [modelAssetsMessage, setModelAssetsMessage] = useState<string | null>(null);
  const [modelAssetsLoading, setModelAssetsLoading] = useState(false);
  const [registeringModel, setRegisteringModel] = useState(false);
  const [modelName, setModelName] = useState("");
  const [modelFormat, setModelFormat] = useState("Gltf");
  const [modelBlobKey, setModelBlobKey] = useState("");

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

  /** Quiet overlay refresh for poll — no full-page loading flash. */
  const refreshOverlays = useCallback(async () => {
    if (!valid) return;
    try {
      const overlayQs = new URLSearchParams({ mode });
      if (asOfDate) overlayQs.set("asOf", asOfDate);
      if (storeyFilter && storeyFilter !== "__all__")
        overlayQs.set("storeyNodeId", storeyFilter);
      const o = await api<SpatialOverlayResponse>(
        `/api/projects/${projectId}/spatial/overlays?${overlayQs.toString()}`
      );
      setOverlay(o);
    } catch {
      // keep last overlay; poll failures stay silent
    }
  }, [projectId, valid, mode, storeyFilter, asOfDate]);

  const loadModelAssets = useCallback(async () => {
    if (!valid) return;
    setModelAssetsLoading(true);
    try {
      const res = await api<ModelAssetListResponse>(buildModelAssetsUrl(projectId));
      setModelAssets(res.assets ?? []);
      setModelAssetsMessage(res.message ?? null);
    } catch {
      setModelAssets([]);
      setModelAssetsMessage(null);
    } finally {
      setModelAssetsLoading(false);
    }
  }, [projectId, valid]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadModelAssets();
  }, [loadModelAssets]);

  // 2.15.6: configurable overlay poll (default 30s; NEXT_PUBLIC_TWIN_OVERLAY_POLL_MS)
  useEffect(() => {
    if (!valid) return;
    const ms = resolveTwinOverlayPollMs();
    if (ms <= 0) return;
    const id = window.setInterval(() => {
      void refreshOverlays();
    }, ms);
    return () => window.clearInterval(id);
  }, [valid, refreshOverlays]);

  useEffect(() => {
    if (!valid) return;
    captureProductEvent("twin_opened", { project_id: projectId });
  }, [valid, projectId]);

  useEffect(() => {
    if (!valid || !selectedId) {
      setZoneDetail(null);
      setZonePhotoPins([]);
      setZonePhotoMessage(null);
      return;
    }
    let cancelled = false;
    setZoneDetailLoading(true);
    setZonePhotosLoading(true);
    const started = performance.now();
    void (async () => {
      let pinsEmpty = true;
      try {
        const [detailSettled, pinsSettled] = await Promise.allSettled([
          api<SpatialZoneDetailResponse>(
            `/api/projects/${projectId}/spatial/zones/${selectedId}`
          ),
          api<TwinPhotoPinsResponse>(buildPhotoPinsUrl(projectId, selectedId)),
        ]);
        if (cancelled) return;

        if (detailSettled.status === "fulfilled") {
          setZoneDetail(detailSettled.value);
        } else {
          setZoneDetail(null);
        }

        if (pinsSettled.status === "fulfilled") {
          const res = pinsSettled.value;
          setZonePhotoPins(res.pins ?? []);
          setZonePhotoMessage(res.message ?? null);
          pinsEmpty = (res.pins ?? []).length === 0;
        } else {
          setZonePhotoPins([]);
          setZonePhotoMessage(null);
        }

        // 2.16.1 diagnostic only — duration of zone drill load
        captureProductEvent(
          TWIN_ZONE_DRILL_EVENT,
          buildTwinZoneDrillProps({
            projectId,
            spatialNodeId: selectedId,
            durationMs: performance.now() - started,
            pinsEmpty,
          })
        );
      } finally {
        if (!cancelled) {
          setZoneDetailLoading(false);
          setZonePhotosLoading(false);
        }
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

  async function registerModelAsset() {
    setRegisteringModel(true);
    try {
      await api(buildModelAssetsUrl(projectId), {
        method: "POST",
        body: {
          displayName: modelName.trim() || undefined,
          sourceFormat: modelFormat,
          sourceBlobKey: modelBlobKey.trim() || undefined,
        },
      });
      toast.success("Model registered as Pending (not ready until conversion succeeds)");
      setModelName("");
      setModelBlobKey("");
      await loadModelAssets();
    } catch (e) {
      toast.error("Could not register model", {
        description:
          e instanceof Error
            ? e.message
            : "Requires Spatial.Manage — pending is never claimed ready.",
      });
    } finally {
      setRegisteringModel(false);
    }
  }

  async function startConversion(modelAssetId: string) {
    try {
      const dto = await api<ModelAssetDto>(
        buildStartConversionUrl(projectId, modelAssetId),
        { method: "POST" }
      );
      if (dto.isReady) {
        toast.error("Invariant: processing must not be ready");
      } else {
        toast.message("Conversion started — status Processing (not ready)");
      }
      await loadModelAssets();
    } catch (e) {
      toast.error("Could not start conversion", {
        description: e instanceof Error ? e.message : undefined,
      });
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
        <div
          className="space-y-3"
          data-testid="twin-loading-skeleton"
          role="status"
          aria-busy="true"
          aria-label="Loading digital twin"
        >
          {/* Mobile-first schematic: board + side panel placeholders (no blank white flash). */}
          <div className="grid gap-3 lg:grid-cols-[1fr_minmax(240px,320px)]">
            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-full max-w-xs mt-2" />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="hidden sm:block">
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-28" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          </div>
          <Skeleton className="h-12 w-full sm:hidden rounded-lg" />
        </div>
      )}

      {!loading && graph && !graph.hasGraph && (
        <Card data-testid="twin-empty-state" role="status" aria-live="polite">
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
          <div className="lg:col-span-3 space-y-4">
            <Card data-testid="twin-schematic-board">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="h-4 w-4 text-amber-500" />
                  Schematic zones (2.5D)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  Floor-plan style cards — color is overlay band only (gray =
                  insufficient, not green).
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {tree
                    .filter((n) => n.nodeType === "Zone" || n.nodeType === "zone")
                    .map((node) => {
                      const ov = overlayById.get(node.id);
                      const band = ov?.band ?? "InsufficientData";
                      const active = selectedId === node.id;
                      return (
                        <button
                          key={node.id}
                          type="button"
                          onClick={() => setSelectedId(node.id)}
                          className={cn(
                            "min-h-[72px] rounded-lg border-2 p-2 text-left touch-manipulation transition-shadow",
                            bandClass(band),
                            active && "ring-2 ring-amber-500 shadow-md"
                          )}
                          data-testid={`twin-schematic-${node.code}`}
                        >
                          <span className="text-xs font-semibold block truncate">
                            {node.name}
                          </span>
                          <span className="text-[10px] opacity-80">{node.code}</span>
                          <span className="block text-[10px] mt-1 font-medium">
                            {ov?.label ?? "No data*"}
                          </span>
                        </button>
                      );
                    })}
                </div>
                <div className="flex flex-wrap gap-2 mt-3 text-[10px] text-muted-foreground">
                  <span className={cn("px-1.5 py-0.5 rounded border", bandClass("OnTrack"))}>
                    OnTrack
                  </span>
                  <span className={cn("px-1.5 py-0.5 rounded border", bandClass("Watch"))}>
                    Watch*
                  </span>
                  <span className={cn("px-1.5 py-0.5 rounded border", bandClass("Risk"))}>
                    Risk*
                  </span>
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded border",
                      bandClass("InsufficientData")
                    )}
                  >
                    Insufficient*
                  </span>
                </div>
              </CardContent>
            </Card>

          <Card>
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
            <CardContent className="space-y-1 max-h-[20rem] overflow-y-auto">
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
          </div>

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
                      <ZonePhotoThumbs
                        loading={zonePhotosLoading}
                        pins={zonePhotoPins}
                        apiMessage={zonePhotoMessage}
                      />
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
                      <LinkedList
                        title="Plan sheets"
                        items={zoneDetail.planSheets ?? []}
                        empty="No plan sheets linked"
                        hrefForItem={(item) => {
                          const sheet = item.title.split("—")[0]?.trim();
                          return buildPlansSpecsHref(projectId, {
                            sheet: sheet || undefined,
                            view: "plans",
                          });
                        }}
                      />
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    {selected.nodeType === "Zone" && (
                      <Button variant="outline" className="w-full min-h-[44px]" asChild>
                        <Link
                          href={`${buildFieldReportHref(projectId)}&zoneId=${encodeURIComponent(selected.id)}`}
                        >
                          Field report in this zone
                        </Link>
                      </Button>
                    )}
                    <Button variant="ghost" className="w-full min-h-[44px]" asChild>
                      <Link href={buildSiteWalkHref(projectId)}>
                        Open site walk
                      </Link>
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 2.16.4 model assets — desktop admin register; phone read-only status */}
      <Card data-testid="twin-model-assets">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">3D model assets</CardTitle>
          <p className="text-xs text-muted-foreground">
            Optional. Zones-first twin works without a model. Pending/Processing is{" "}
            <strong>not ready</strong> — never claimed live until conversion Succeeded.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {modelAssetsLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : (
            <>
              {modelAssetsMessage && (
                <p className="text-xs text-muted-foreground" data-testid="twin-model-assets-message">
                  {modelAssetsMessage}
                </p>
              )}
              {modelAssets.length === 0 ? (
                <p className="text-sm text-muted-foreground italic" data-testid="twin-model-assets-empty">
                  No model assets registered.
                </p>
              ) : (
                <ul className="space-y-2" data-testid="twin-model-assets-list">
                  {modelAssets.map((a) => (
                    <li
                      key={a.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      <span className="font-medium">
                        {a.displayName}{" "}
                        <span className="text-muted-foreground font-normal">
                          v{a.versionNumber} · {a.sourceFormat}
                        </span>
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={a.isReady ? "default" : "secondary"}
                          data-testid={`twin-model-status-${a.id}`}
                        >
                          {modelAssetStatusLabel(a)}
                        </Badge>
                        {!a.isReady &&
                          a.conversionStatus.toLowerCase() === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="hidden md:inline-flex min-h-[36px]"
                              data-testid={`twin-model-start-conversion-${a.id}`}
                              onClick={() => void startConversion(a.id)}
                            >
                              Start conversion
                            </Button>
                          )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {/* Desktop admin form (hidden on narrow phones — use md+) */}
          <div
            className="hidden md:block space-y-3 border-t pt-3"
            data-testid="twin-model-assets-admin"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Register model (desktop admin · Spatial.Manage)
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              <input
                className="min-h-[44px] rounded-md border bg-background px-2 text-sm"
                placeholder="Display name"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                data-testid="twin-model-name"
                aria-label="Model display name"
              />
              <Select value={modelFormat} onValueChange={setModelFormat}>
                <SelectTrigger className="min-h-[44px]" data-testid="twin-model-format">
                  <SelectValue placeholder="Format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Gltf">glTF</SelectItem>
                  <SelectItem value="Ifc">IFC</SelectItem>
                  <SelectItem value="Obj">OBJ</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
              <input
                className="min-h-[44px] rounded-md border bg-background px-2 text-sm"
                placeholder="Source blob key (optional)"
                value={modelBlobKey}
                onChange={(e) => setModelBlobKey(e.target.value)}
                data-testid="twin-model-blob-key"
                aria-label="Source blob key"
              />
            </div>
            <Button
              className="min-h-[44px]"
              onClick={() => void registerModelAsset()}
              disabled={registeringModel}
              data-testid="twin-model-register"
            >
              {registeringModel ? "Registering…" : "Register as Pending"}
            </Button>
          </div>
          <p className="md:hidden text-xs text-muted-foreground" data-testid="twin-model-phone-note">
            Model registration is desktop admin only. Status above is read-only on phone.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/** Zone panel photo thumbnails (2.15.4) — neutral empty, never fake green. */
function ZonePhotoThumbs({
  loading,
  pins,
  apiMessage,
}: {
  loading: boolean;
  pins: TwinPhotoPinDto[];
  apiMessage: string | null;
}) {
  const thumbs = pinsWithThumbnails(pins);
  const emptyMsg = photoThumbsEmptyMessage(pins, apiMessage);
  return (
    <div data-testid="twin-zone-photo-thumbs">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
        Photos
      </p>
      {loading ? (
        <Skeleton className="h-14 w-full" data-testid="twin-zone-photo-thumbs-loading" />
      ) : thumbs.length === 0 ? (
        <p
          className="text-xs text-muted-foreground italic"
          data-testid="twin-zone-photo-thumbs-empty"
        >
          {emptyMsg}
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2" data-testid="twin-zone-photo-thumbs-grid">
          {thumbs.map((pin) => (
            <li key={pin.photoId}>
              {/* eslint-disable-next-line @next/next/no-img-element -- remote field thumbs; not optimized assets */}
              <img
                src={pin.thumbnailUrl!}
                alt="Field photo"
                className="h-14 w-14 rounded-md object-cover border border-border bg-muted"
                loading="lazy"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LinkedList({
  title,
  items,
  empty,
  hrefForItem,
}: {
  title: string;
  items: Array<{ id: string; title: string; status?: string | null; detail?: string | null }>;
  empty: string;
  hrefForItem?: (item: { id: string; title: string }) => string;
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
          {items.map((item) => {
            const href = hrefForItem?.(item);
            const body = (
              <>
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
              </>
            );
            return (
              <li
                key={item.id}
                className="rounded-md border px-2 py-1.5 text-sm"
              >
                {href ? (
                  <Link href={href} className="hover:text-amber-600 block">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
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
