"use client";

import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

// --- Types ---

export interface GanttActivity {
  id: string;
  name: string;
  wbsCode: string;
  activityType: "Wbs" | "Task" | "Milestone";
  status: "NotStarted" | "InProgress" | "Completed" | "OnHold";
  plannedStart: string | null;
  plannedFinish: string | null;
  actualStart: string | null;
  actualFinish: string | null;
  percentComplete: number;
  isCritical: boolean;
  totalFloatDays: number | null;
  parentActivityId: string | null;
  sortOrder: number;
}

export interface GanttDependency {
  id: string;
  predecessorActivityId: string;
  successorActivityId: string;
  dependencyType: "FS" | "FF" | "SS" | "SF";
  lagDays: number;
}

export type ZoomLevel = "day" | "week" | "month";

export interface GanttChartProps {
  activities: GanttActivity[];
  dependencies: GanttDependency[];
  className?: string;
}

// --- Constants ---

const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 48;
const SIDEBAR_WIDTH = 280;
const BAR_HEIGHT = 18;
const BAR_Y_OFFSET = (ROW_HEIGHT - BAR_HEIGHT) / 2;
const MILESTONE_SIZE = 12;
const MIN_COL_WIDTH: Record<ZoomLevel, number> = {
  day: 32,
  week: 100,
  month: 120,
};

// --- Helpers ---

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

function startOfWeek(d: Date): Date {
  const result = new Date(d);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function formatMonthYear(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getEffectiveStart(a: GanttActivity): Date | null {
  return parseDate(a.actualStart) ?? parseDate(a.plannedStart);
}

function getEffectiveFinish(a: GanttActivity): Date | null {
  return parseDate(a.actualFinish) ?? parseDate(a.plannedFinish);
}

// --- Compute timeline range ---

interface TimelineConfig {
  startDate: Date;
  endDate: Date;
  totalDays: number;
  colWidth: number;
  totalWidth: number;
  columns: { date: Date; label: string; subLabel?: string }[];
}

function computeTimeline(
  activities: GanttActivity[],
  zoom: ZoomLevel
): TimelineConfig | null {
  let minDate: Date | null = null;
  let maxDate: Date | null = null;

  for (const a of activities) {
    const s = getEffectiveStart(a);
    const f = getEffectiveFinish(a);
    if (s && (!minDate || s < minDate)) minDate = s;
    if (f && (!maxDate || f > maxDate)) maxDate = f;
  }

  if (!minDate || !maxDate) return null;

  // Add padding
  const padDays = zoom === "month" ? 30 : zoom === "week" ? 7 : 3;
  const startDate = addDays(minDate, -padDays);
  const endDate = addDays(maxDate, padDays);
  const totalDays = daysBetween(startDate, endDate) + 1;

  const colWidth = MIN_COL_WIDTH[zoom];
  const columns: TimelineConfig["columns"] = [];

  if (zoom === "day") {
    for (let i = 0; i < totalDays; i++) {
      const d = addDays(startDate, i);
      columns.push({
        date: d,
        label: String(d.getDate()),
        subLabel: d.getDate() === 1 ? formatMonthYear(d) : undefined,
      });
    }
  } else if (zoom === "week") {
    let d = startOfWeek(startDate);
    while (d <= endDate) {
      columns.push({
        date: new Date(d),
        label: formatShortDate(d),
      });
      d = addDays(d, 7);
    }
  } else {
    let d = startOfMonth(startDate);
    while (d <= endDate) {
      columns.push({
        date: new Date(d),
        label: formatMonthYear(d),
      });
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    }
  }

  const totalWidth =
    zoom === "day"
      ? totalDays * colWidth
      : columns.length * colWidth;

  return { startDate, endDate, totalDays, colWidth, totalWidth, columns };
}

function dateToX(
  date: Date,
  timeline: TimelineConfig,
  zoom: ZoomLevel
): number {
  const days = daysBetween(timeline.startDate, date);
  if (zoom === "day") {
    return days * timeline.colWidth;
  }
  // For week/month, use proportional mapping
  return (days / timeline.totalDays) * timeline.totalWidth;
}

// --- Build flat ordered list with indentation ---

interface FlatActivity extends GanttActivity {
  depth: number;
}

function flattenActivities(activities: GanttActivity[]): FlatActivity[] {
  const byParent = new Map<string | null, GanttActivity[]>();
  for (const a of activities) {
    const key = a.parentActivityId ?? "__root__";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(a);
  }

  // Sort children by sortOrder
  for (const children of byParent.values()) {
    children.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const result: FlatActivity[] = [];
  function walk(parentId: string | null, depth: number) {
    const key = parentId ?? "__root__";
    const children = byParent.get(key) ?? [];
    for (const child of children) {
      result.push({ ...child, depth });
      walk(child.id, depth + 1);
    }
  }
  walk(null, 0);
  return result;
}

// --- Dependency arrows ---

function buildDependencyPath(
  dep: GanttDependency,
  activityIndex: Map<string, number>,
  activities: FlatActivity[],
  timeline: TimelineConfig,
  zoom: ZoomLevel
): string | null {
  const predIdx = activityIndex.get(dep.predecessorActivityId);
  const succIdx = activityIndex.get(dep.successorActivityId);
  if (predIdx === undefined || succIdx === undefined) return null;

  const pred = activities[predIdx];
  const succ = activities[succIdx];

  const predStart = getEffectiveStart(pred);
  const predFinish = getEffectiveFinish(pred);
  const succStart = getEffectiveStart(succ);

  if (!predFinish || !succStart || !predStart) return null;

  let fromX: number;
  let toX: number;

  // Determine connection points based on dependency type
  switch (dep.dependencyType) {
    case "FS":
      fromX = dateToX(predFinish, timeline, zoom);
      toX = dateToX(succStart, timeline, zoom);
      break;
    case "FF":
      fromX = dateToX(predFinish, timeline, zoom);
      toX = dateToX(
        getEffectiveFinish(succ) ?? succStart,
        timeline,
        zoom
      );
      break;
    case "SS":
      fromX = dateToX(predStart, timeline, zoom);
      toX = dateToX(succStart, timeline, zoom);
      break;
    case "SF":
      fromX = dateToX(predStart, timeline, zoom);
      toX = dateToX(
        getEffectiveFinish(succ) ?? succStart,
        timeline,
        zoom
      );
      break;
  }

  const fromY = predIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
  const toY = succIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

  // Build a right-angle path with an arrowhead endpoint
  const midX = fromX + 12;
  return `M ${fromX} ${fromY} H ${midX} V ${toY} H ${toX - 4}`;
}

// --- Component ---

export function GanttChart({
  activities,
  dependencies,
  className,
}: GanttChartProps) {
  const [zoom, setZoom] = useState<ZoomLevel>("week");
  const timelineRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const flatList = useMemo(() => flattenActivities(activities), [activities]);
  const timeline = useMemo(
    () => computeTimeline(activities, zoom),
    [activities, zoom]
  );

  const activityIndex = useMemo(() => {
    const map = new Map<string, number>();
    flatList.forEach((a, i) => map.set(a.id, i));
    return map;
  }, [flatList]);

  // Sync vertical scroll between sidebar and timeline
  const handleTimelineScroll = useCallback(() => {
    if (timelineRef.current && sidebarRef.current) {
      sidebarRef.current.scrollTop = timelineRef.current.scrollTop;
    }
  }, []);

  // Sync sidebar scroll to timeline
  const handleSidebarScroll = useCallback(() => {
    if (sidebarRef.current && timelineRef.current) {
      timelineRef.current.scrollTop = sidebarRef.current.scrollTop;
    }
  }, []);

  // Scroll to today on mount
  useEffect(() => {
    if (!timeline || !timelineRef.current) return;
    const today = new Date();
    const x = dateToX(today, timeline, zoom);
    const containerWidth = timelineRef.current.clientWidth;
    timelineRef.current.scrollLeft = Math.max(0, x - containerWidth / 3);
  }, [timeline, zoom]);

  if (activities.length === 0) {
    return (
      <div className={cn("rounded-lg border border-dashed p-8 text-center", className)}>
        <p className="text-sm text-muted-foreground">
          No schedule activities found. Add activities to see the Gantt chart.
        </p>
      </div>
    );
  }

  if (!timeline) {
    return (
      <div className={cn("rounded-lg border border-dashed p-8 text-center", className)}>
        <p className="text-sm text-muted-foreground">
          Activities have no date information. Set planned start/finish dates to render the chart.
        </p>
      </div>
    );
  }

  const chartHeight = flatList.length * ROW_HEIGHT;
  const today = new Date();
  const todayX = dateToX(today, timeline, zoom);

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Zoom controls */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium text-muted-foreground">Zoom:</span>
        {(["day", "week", "month"] as ZoomLevel[]).map((level) => (
          <button
            key={level}
            onClick={() => setZoom(level)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-colors min-h-[36px]",
              zoom === level
                ? "bg-amber-500 text-white"
                : "bg-muted text-muted-foreground hover:bg-accent"
            )}
          >
            {level.charAt(0).toUpperCase() + level.slice(1)}
          </button>
        ))}
      </div>

      {/* Chart container */}
      <div className="flex rounded-lg border overflow-hidden bg-background">
        {/* Sidebar — Activity names */}
        <div className="flex-shrink-0" style={{ width: SIDEBAR_WIDTH }}>
          {/* Sidebar header */}
          <div
            className="border-b border-r bg-muted/50 px-3 flex items-center font-medium text-sm"
            style={{ height: HEADER_HEIGHT }}
          >
            Activity
          </div>
          {/* Sidebar rows */}
          <div
            ref={sidebarRef}
            onScroll={handleSidebarScroll}
            className="overflow-y-auto overflow-x-hidden border-r"
            style={{ maxHeight: `min(60vh, ${chartHeight}px)` }}
          >
            {flatList.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center border-b px-2 text-sm truncate hover:bg-accent/30 transition-colors"
                style={{
                  height: ROW_HEIGHT,
                  paddingLeft: 8 + activity.depth * 16,
                }}
                title={`${activity.wbsCode} ${activity.name}`}
              >
                {activity.activityType === "Wbs" && (
                  <span className="text-muted-foreground text-xs mr-1.5 font-mono">
                    {activity.wbsCode}
                  </span>
                )}
                {activity.activityType === "Milestone" && (
                  <span className="text-amber-500 mr-1.5" aria-hidden>
                    &#9670;
                  </span>
                )}
                <span
                  className={cn(
                    "truncate",
                    activity.activityType === "Wbs" && "font-semibold",
                    activity.isCritical && "text-red-600 dark:text-red-400"
                  )}
                >
                  {activity.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline area */}
        <div className="flex-1 min-w-0">
          {/* Timeline header */}
          <div
            className="border-b bg-muted/50 overflow-hidden"
            style={{ height: HEADER_HEIGHT }}
          >
            <div
              style={{ width: timeline.totalWidth }}
              className="flex h-full"
            >
              {timeline.columns.map((col, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 flex flex-col items-center justify-center border-r text-xs text-muted-foreground"
                  style={{ width: timeline.colWidth }}
                >
                  {col.subLabel && (
                    <span className="text-[10px] font-medium">
                      {col.subLabel}
                    </span>
                  )}
                  <span>{col.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Scrollable chart */}
          <div
            ref={timelineRef}
            onScroll={handleTimelineScroll}
            className="overflow-auto"
            style={{ maxHeight: `min(60vh, ${chartHeight}px)` }}
          >
            <svg
              width={timeline.totalWidth}
              height={chartHeight}
              className="select-none"
            >
              {/* Grid lines */}
              {timeline.columns.map((col, i) => {
                const x = i * timeline.colWidth;
                const isWeekend =
                  zoom === "day" &&
                  (col.date.getDay() === 0 || col.date.getDay() === 6);
                return (
                  <g key={`grid-${i}`}>
                    <line
                      x1={x}
                      y1={0}
                      x2={x}
                      y2={chartHeight}
                      className="stroke-border"
                      strokeWidth={0.5}
                    />
                    {isWeekend && (
                      <rect
                        x={x}
                        y={0}
                        width={timeline.colWidth}
                        height={chartHeight}
                        className="fill-muted/30"
                      />
                    )}
                  </g>
                );
              })}

              {/* Row stripes */}
              {flatList.map((_, i) => (
                <line
                  key={`row-${i}`}
                  x1={0}
                  y1={(i + 1) * ROW_HEIGHT}
                  x2={timeline.totalWidth}
                  y2={(i + 1) * ROW_HEIGHT}
                  className="stroke-border"
                  strokeWidth={0.5}
                />
              ))}

              {/* Today line */}
              {todayX >= 0 && todayX <= timeline.totalWidth && (
                <line
                  x1={todayX}
                  y1={0}
                  x2={todayX}
                  y2={chartHeight}
                  className="stroke-amber-500"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
              )}

              {/* Dependency arrows */}
              {dependencies.map((dep) => {
                const path = buildDependencyPath(
                  dep,
                  activityIndex,
                  flatList,
                  timeline,
                  zoom
                );
                if (!path) return null;
                return (
                  <g key={dep.id}>
                    <path
                      d={path}
                      fill="none"
                      className="stroke-muted-foreground/50"
                      strokeWidth={1.5}
                      markerEnd="url(#arrowhead)"
                    />
                  </g>
                );
              })}

              {/* Activity bars */}
              {flatList.map((activity, rowIdx) => {
                const y = rowIdx * ROW_HEIGHT + BAR_Y_OFFSET;
                const start = getEffectiveStart(activity);
                const finish = getEffectiveFinish(activity);

                if (!start) return null;

                // Milestone
                if (
                  activity.activityType === "Milestone" ||
                  !finish ||
                  daysBetween(start, finish) === 0
                ) {
                  const cx = dateToX(start, timeline, zoom);
                  const cy = rowIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
                  return (
                    <g key={activity.id}>
                      <polygon
                        points={`${cx},${cy - MILESTONE_SIZE} ${cx + MILESTONE_SIZE},${cy} ${cx},${cy + MILESTONE_SIZE} ${cx - MILESTONE_SIZE},${cy}`}
                        className={cn(
                          activity.isCritical
                            ? "fill-red-500"
                            : "fill-amber-500"
                        )}
                      />
                      <title>
                        {activity.name} ({formatShortDate(start)})
                      </title>
                    </g>
                  );
                }

                // Bar
                const x1 = dateToX(start, timeline, zoom);
                const x2 = dateToX(finish, timeline, zoom);
                const barWidth = Math.max(x2 - x1, 4);
                const pct = Math.min(Math.max(activity.percentComplete, 0), 100);
                const progressWidth = barWidth * (pct / 100);

                const isWbs = activity.activityType === "Wbs";

                return (
                  <g key={activity.id}>
                    {/* Background bar */}
                    <rect
                      x={x1}
                      y={isWbs ? y + 2 : y}
                      width={barWidth}
                      height={isWbs ? BAR_HEIGHT - 4 : BAR_HEIGHT}
                      rx={isWbs ? 2 : 3}
                      className={cn(
                        activity.isCritical
                          ? "fill-red-300 dark:fill-red-900/60"
                          : "fill-blue-300 dark:fill-blue-900/60",
                        isWbs && "fill-slate-300 dark:fill-slate-700"
                      )}
                    />
                    {/* Progress fill */}
                    {progressWidth > 0 && (
                      <rect
                        x={x1}
                        y={isWbs ? y + 2 : y}
                        width={progressWidth}
                        height={isWbs ? BAR_HEIGHT - 4 : BAR_HEIGHT}
                        rx={isWbs ? 2 : 3}
                        className={cn(
                          activity.isCritical
                            ? "fill-red-500 dark:fill-red-600"
                            : "fill-blue-500 dark:fill-blue-500",
                          isWbs && "fill-slate-500 dark:fill-slate-500"
                        )}
                      />
                    )}
                    {/* Percent text for wide bars */}
                    {barWidth > 40 && pct > 0 && (
                      <text
                        x={x1 + barWidth / 2}
                        y={y + BAR_HEIGHT / 2 + (isWbs ? 1 : 0)}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="fill-white text-[10px] font-medium pointer-events-none"
                      >
                        {Math.round(pct)}%
                      </text>
                    )}
                    <title>
                      {activity.name}
                      {"\n"}
                      {formatShortDate(start)} - {formatShortDate(finish)}
                      {"\n"}
                      {Math.round(pct)}% complete
                      {activity.isCritical ? "\nCritical Path" : ""}
                      {activity.totalFloatDays != null
                        ? `\nFloat: ${activity.totalFloatDays}d`
                        : ""}
                    </title>
                  </g>
                );
              })}

              {/* Arrow marker definition */}
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="8"
                  markerHeight="6"
                  refX="7"
                  refY="3"
                  orient="auto"
                >
                  <polygon
                    points="0 0, 8 3, 0 6"
                    className="fill-muted-foreground/50"
                  />
                </marker>
              </defs>
            </svg>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-6 rounded-sm bg-red-500" />
          <span>Critical Path</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-6 rounded-sm bg-blue-500" />
          <span>Non-Critical</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 14 14">
            <polygon
              points="7,1 13,7 7,13 1,7"
              className="fill-amber-500"
            />
          </svg>
          <span>Milestone</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-0 w-6 border-t-2 border-dashed border-amber-500" />
          <span>Today</span>
        </div>
      </div>
    </div>
  );
}
