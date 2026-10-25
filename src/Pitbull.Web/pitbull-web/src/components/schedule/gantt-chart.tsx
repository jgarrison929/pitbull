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

export type ZoomPreset = "1W" | "1M" | "3M" | "All";

export interface GanttChartProps {
  activities: GanttActivity[];
  dependencies: GanttDependency[];
  className?: string;
}

// --- Constants ---

const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 48;
const SIDEBAR_WIDTH = 280;
const BAR_HEIGHT = 18;
const ACTUAL_BAR_HEIGHT = 8;
const BAR_Y_OFFSET = (ROW_HEIGHT - BAR_HEIGHT) / 2;
const ACTUAL_BAR_Y_GAP = 2;
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

function getScheduleRange(activities: GanttActivity[]): { min: Date; max: Date } | null {
  let minDate: Date | null = null;
  let maxDate: Date | null = null;

  for (const a of activities) {
    for (const dateStr of [a.plannedStart, a.plannedFinish, a.actualStart, a.actualFinish]) {
      const d = parseDate(dateStr);
      if (d) {
        if (!minDate || d < minDate) minDate = d;
        if (!maxDate || d > maxDate) maxDate = d;
      }
    }
  }

  if (!minDate || !maxDate) return null;
  return { min: minDate, max: maxDate };
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
  startDate: Date,
  endDate: Date,
  zoom: ZoomLevel
): TimelineConfig {
  const padDays = zoom === "month" ? 30 : zoom === "week" ? 7 : 3;
  const paddedStart = addDays(startDate, -padDays);
  const paddedEnd = addDays(endDate, padDays);
  const totalDays = daysBetween(paddedStart, paddedEnd) + 1;

  const colWidth = MIN_COL_WIDTH[zoom];
  const columns: TimelineConfig["columns"] = [];

  if (zoom === "day") {
    for (let i = 0; i < totalDays; i++) {
      const d = addDays(paddedStart, i);
      columns.push({
        date: d,
        label: String(d.getDate()),
        subLabel: d.getDate() === 1 ? formatMonthYear(d) : undefined,
      });
    }
  } else if (zoom === "week") {
    let d = startOfWeek(paddedStart);
    while (d <= paddedEnd) {
      columns.push({
        date: new Date(d),
        label: formatShortDate(d),
      });
      d = addDays(d, 7);
    }
  } else {
    let d = startOfMonth(paddedStart);
    while (d <= paddedEnd) {
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

  return { startDate: paddedStart, endDate: paddedEnd, totalDays, colWidth, totalWidth, columns };
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

// --- Determine zoom level from date range ---

function zoomForRange(startDate: Date, endDate: Date): ZoomLevel {
  const days = daysBetween(startDate, endDate);
  if (days <= 14) return "day";
  if (days <= 90) return "week";
  return "month";
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

// --- Check if actual dates differ from planned ---

function hasActualOverlay(a: GanttActivity): boolean {
  const ps = parseDate(a.plannedStart);
  const pf = parseDate(a.plannedFinish);
  const as_ = parseDate(a.actualStart);
  const af = parseDate(a.actualFinish);
  if (!as_ && !af) return false;
  if (!ps && !pf) return false;
  // Show overlay when at least one actual date exists and differs from planned
  const startDiffers = as_ && ps && daysBetween(ps, as_) !== 0;
  const finishDiffers = af && pf && daysBetween(pf, af) !== 0;
  return !!(startDiffers || finishDiffers || (as_ && !ps) || (af && !pf));
}

// --- Component ---

export function GanttChart({
  activities,
  dependencies,
  className,
}: GanttChartProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const scheduleRange = useMemo(() => getScheduleRange(activities), [activities]);

  // Zoom preset state
  const [zoomPreset, setZoomPreset] = useState<ZoomPreset>("All");

  // Compute the visible date range and zoom level based on preset
  const { visibleStart, visibleEnd, zoom } = useMemo(() => {
    if (!scheduleRange) {
      return { visibleStart: new Date(), visibleEnd: new Date(), zoom: "week" as ZoomLevel };
    }

    const today = new Date();

    switch (zoomPreset) {
      case "1W": {
        const start = addDays(today, -1);
        const end = addDays(today, 6);
        return { visibleStart: start, visibleEnd: end, zoom: "day" as ZoomLevel };
      }
      case "1M": {
        const start = addDays(today, -3);
        const end = addDays(today, 28);
        return { visibleStart: start, visibleEnd: end, zoom: "day" as ZoomLevel };
      }
      case "3M": {
        const start = addDays(today, -7);
        const end = addDays(today, 84);
        return { visibleStart: start, visibleEnd: end, zoom: "week" as ZoomLevel };
      }
      case "All":
      default: {
        const z = zoomForRange(scheduleRange.min, scheduleRange.max);
        return { visibleStart: scheduleRange.min, visibleEnd: scheduleRange.max, zoom: z };
      }
    }
  }, [zoomPreset, scheduleRange]);

  const flatList = useMemo(() => flattenActivities(activities), [activities]);
  const timeline = useMemo(
    () => computeTimeline(visibleStart, visibleEnd, zoom),
    [visibleStart, visibleEnd, zoom]
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

  if (!scheduleRange) {
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

  const presets: { key: ZoomPreset; label: string }[] = [
    { key: "1W", label: "1W" },
    { key: "1M", label: "1M" },
    { key: "3M", label: "3M" },
    { key: "All", label: "All" },
  ];

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Zoom controls */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium text-muted-foreground">Zoom:</span>
        {presets.map((p) => (
          <button
            key={p.key}
            onClick={() => setZoomPreset(p.key)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-colors min-h-[36px]",
              zoomPreset === p.key
                ? "bg-amber-500 text-white"
                : "bg-muted text-muted-foreground hover:bg-accent"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Chart container */}
      <div className="flex rounded-lg border overflow-hidden bg-background">
        {/* Sidebar -- Activity names */}
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
                className={cn(
                  "flex items-center border-b px-2 text-sm truncate hover:bg-accent/30 transition-colors",
                  activity.isCritical && activity.activityType !== "Wbs" && "border-l-[3px] border-l-red-500"
                )}
                style={{
                  height: ROW_HEIGHT,
                  paddingLeft: activity.isCritical && activity.activityType !== "Wbs"
                    ? 5 + activity.depth * 16
                    : 8 + activity.depth * 16,
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
                {/* Float indicator for non-critical activities */}
                {!activity.isCritical &&
                  activity.activityType === "Task" &&
                  activity.totalFloatDays != null &&
                  activity.totalFloatDays > 0 && (
                    <span className="ml-auto flex-shrink-0 text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                      +{activity.totalFloatDays}d
                    </span>
                  )}
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
                  className="stroke-red-500"
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
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
                const plannedStart = parseDate(activity.plannedStart);
                const plannedFinish = parseDate(activity.plannedFinish);
                const actualStartDate = parseDate(activity.actualStart);
                const actualFinishDate = parseDate(activity.actualFinish);
                const start = getEffectiveStart(activity);
                const finish = getEffectiveFinish(activity);

                if (!start) return null;

                const y = rowIdx * ROW_HEIGHT + BAR_Y_OFFSET;

                // Milestone
                if (
                  activity.activityType === "Milestone" ||
                  !finish ||
                  daysBetween(start, finish) === 0
                ) {
                  const milestoneDate = plannedFinish ?? plannedStart ?? start;
                  const cx = dateToX(milestoneDate, timeline, zoom);
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
                      {/* Actual date marker if different */}
                      {actualStartDate && plannedStart && daysBetween(plannedStart, actualStartDate) !== 0 && (
                        <polygon
                          points={`${dateToX(actualStartDate, timeline, zoom)},${cy - MILESTONE_SIZE + 3} ${dateToX(actualStartDate, timeline, zoom) + MILESTONE_SIZE - 3},${cy} ${dateToX(actualStartDate, timeline, zoom)},${cy + MILESTONE_SIZE - 3} ${dateToX(actualStartDate, timeline, zoom) - MILESTONE_SIZE + 3},${cy}`}
                          className="fill-emerald-500"
                          opacity={0.8}
                        />
                      )}
                      <title>
                        {activity.name} ({formatShortDate(milestoneDate)})
                        {activity.isCritical ? "\nCritical Path" : ""}
                      </title>
                    </g>
                  );
                }

                // Regular bar
                const isWbs = activity.activityType === "Wbs";
                const showOverlay = hasActualOverlay(activity) && !isWbs;

                // Planned bar (always shown if planned dates exist)
                const pStart = plannedStart ?? start;
                const pFinish = plannedFinish ?? finish;
                const px1 = dateToX(pStart, timeline, zoom);
                const px2 = dateToX(pFinish, timeline, zoom);
                const plannedBarWidth = Math.max(px2 - px1, 4);
                const pct = Math.min(Math.max(activity.percentComplete, 0), 100);
                const progressWidth = plannedBarWidth * (pct / 100);

                // Actual bar coordinates
                const aStart = actualStartDate ?? pStart;
                const aFinish = actualFinishDate ?? (activity.status === "InProgress" ? new Date() : pFinish);
                const ax1 = dateToX(aStart, timeline, zoom);
                const ax2 = dateToX(aFinish, timeline, zoom);
                const actualBarWidth = Math.max(ax2 - ax1, 4);

                return (
                  <g key={activity.id}>
                    {/* Critical path left accent */}
                    {activity.isCritical && !isWbs && (
                      <rect
                        x={px1 - 2}
                        y={y}
                        width={3}
                        height={BAR_HEIGHT}
                        rx={1}
                        className="fill-red-600 dark:fill-red-500"
                      />
                    )}
                    {/* Planned bar background */}
                    <rect
                      x={px1}
                      y={isWbs ? y + 2 : y}
                      width={plannedBarWidth}
                      height={isWbs ? BAR_HEIGHT - 4 : BAR_HEIGHT}
                      rx={isWbs ? 2 : 3}
                      className={cn(
                        activity.isCritical
                          ? "fill-red-200 dark:fill-red-900/50"
                          : "fill-blue-200 dark:fill-blue-900/50",
                        isWbs && "fill-slate-300 dark:fill-slate-700"
                      )}
                    />
                    {/* Progress fill */}
                    {progressWidth > 0 && (
                      <rect
                        x={px1}
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
                    {plannedBarWidth > 40 && pct > 0 && (
                      <text
                        x={px1 + plannedBarWidth / 2}
                        y={y + BAR_HEIGHT / 2 + (isWbs ? 1 : 0)}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="fill-white text-[10px] font-medium pointer-events-none"
                      >
                        {Math.round(pct)}%
                      </text>
                    )}
                    {/* Actual bar overlay (thinner, below planned bar) */}
                    {showOverlay && (
                      <rect
                        x={ax1}
                        y={y + BAR_HEIGHT + ACTUAL_BAR_Y_GAP}
                        width={actualBarWidth}
                        height={ACTUAL_BAR_HEIGHT}
                        rx={2}
                        className="fill-emerald-500 dark:fill-emerald-400"
                        opacity={0.85}
                      />
                    )}
                    {/* Float indicator in the chart area for non-critical tasks */}
                    {!activity.isCritical &&
                      !isWbs &&
                      activity.totalFloatDays != null &&
                      activity.totalFloatDays > 0 &&
                      plannedBarWidth > 8 && (
                        <text
                          x={px1 + plannedBarWidth + 4}
                          y={y + BAR_HEIGHT / 2}
                          dominantBaseline="central"
                          className="fill-emerald-600 dark:fill-emerald-400 text-[9px] font-mono pointer-events-none"
                        >
                          +{activity.totalFloatDays}d
                        </text>
                      )}
                    <title>
                      {activity.name}
                      {"\n"}
                      Planned: {formatShortDate(pStart)} - {formatShortDate(pFinish)}
                      {actualStartDate
                        ? `\nActual: ${formatShortDate(aStart)}${actualFinishDate ? " - " + formatShortDate(actualFinishDate) : " - In Progress"}`
                        : ""}
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
          <span>Planned</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-6 rounded-sm bg-emerald-500" />
          <span>Actual</span>
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
          <div className="h-0 w-6 border-t-2 border-dashed border-red-500" />
          <span>Today</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-emerald-600 dark:text-emerald-400">+3d</span>
          <span>Float</span>
        </div>
      </div>
    </div>
  );
}
