"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import api from "@/lib/api";
import type { TimeEntry } from "@/lib/types";

// ── Types ──────────────────────────────────────────────
interface WeeklyTimesheetGridProps {
  employeeId?: string;
  projectId?: string;
  title?: string;
  /** Number of weeks to show (default 4) */
  weeks?: number;
}

interface DayCell {
  date: string;
  label: string;
  dayOfWeek: number;
  hours: number;
  entries: TimeEntry[];
  isToday: boolean;
  isFuture: boolean;
}

interface WeekRow {
  weekLabel: string;
  weekStart: string;
  days: DayCell[];
  total: number;
}

// ── Helpers ────────────────────────────────────────────
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDateKey(d: Date): string {
  return d.toISOString().split("T")[0];
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateFull(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getHeatColor(hours: number, maxHours: number): string {
  if (hours === 0) return "bg-muted";
  const ratio = Math.min(hours / Math.max(maxHours, 8), 1);

  // 4-stop gradient: light amber → amber → orange → red
  if (ratio < 0.25)
    return "bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100";
  if (ratio < 0.5)
    return "bg-amber-300 dark:bg-amber-800/50 text-amber-900 dark:text-amber-100";
  if (ratio < 0.75)
    return "bg-orange-400 dark:bg-orange-700/60 text-white dark:text-orange-100";
  return "bg-red-500 dark:bg-red-700/70 text-white";
}

function getWeekStartDate(weeksAgo: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() - weeksAgo * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── Component ──────────────────────────────────────────
export function WeeklyTimesheetGrid({
  employeeId,
  projectId,
  title = "Timesheet",
  weeks = 4,
}: WeeklyTimesheetGridProps) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<DayCell | null>(null);

  // Dates for the visible range
  const rangeStart = useMemo(
    () => getWeekStartDate(weeks - 1 + weekOffset),
    [weeks, weekOffset]
  );
  const rangeEnd = useMemo(() => {
    const d = getWeekStartDate(weekOffset);
    d.setDate(d.getDate() + 6);
    return d;
  }, [weekOffset]);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          startDate: formatDateKey(rangeStart),
          endDate: formatDateKey(rangeEnd),
          pageSize: "2000",
        });
        if (employeeId) params.set("employeeId", employeeId);
        if (projectId) params.set("projectId", projectId);

        const result = await api<{ items: TimeEntry[] }>(
          `/api/time-entries?${params.toString()}`
        );
        setEntries(result.items);
      } catch {
        // Silent
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [employeeId, projectId, rangeStart, rangeEnd]);

  // Build week rows
  const { weekRows, maxDailyHours } = useMemo(() => {
    const today = formatDateKey(new Date());
    const entryMap = new Map<string, TimeEntry[]>();

    for (const entry of entries) {
      const key = entry.date.split("T")[0];
      if (!entryMap.has(key)) entryMap.set(key, []);
      entryMap.get(key)!.push(entry);
    }

    const rows: WeekRow[] = [];
    let maxHrs = 0;

    for (let w = weeks - 1; w >= 0; w--) {
      const weekStart = getWeekStartDate(w + weekOffset);
      const days: DayCell[] = [];
      let weekTotal = 0;

      for (let d = 0; d < 7; d++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + d);
        const dateKey = formatDateKey(date);
        const dayEntries = entryMap.get(dateKey) ?? [];
        const dayHours = dayEntries.reduce((s, e) => s + e.totalHours, 0);
        weekTotal += dayHours;
        if (dayHours > maxHrs) maxHrs = dayHours;

        days.push({
          date: dateKey,
          label: date.getDate().toString(),
          dayOfWeek: d,
          hours: dayHours,
          entries: dayEntries,
          isToday: dateKey === today,
          isFuture: dateKey > today,
        });
      }

      rows.push({
        weekLabel: `${formatDateShort(weekStart)}`,
        weekStart: formatDateKey(weekStart),
        days,
        total: weekTotal,
      });
    }

    return { weekRows: rows, maxDailyHours: maxHrs };
  }, [entries, weeks, weekOffset]);

  const grandTotal = weekRows.reduce((s, w) => s + w.total, 0);

  const handleDayClick = useCallback((day: DayCell) => {
    if (day.entries.length > 0) {
      setSelectedDay(day);
    }
  }, []);

  // Loading
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[240px] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-purple-500" />
              {title}
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {grandTotal.toFixed(1)}h total
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setWeekOffset((o) => o + weeks)}
                aria-label="Previous weeks"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {weekOffset > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setWeekOffset(0)}
                >
                  Today
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={weekOffset <= 0}
                onClick={() => setWeekOffset((o) => Math.max(0, o - weeks))}
                aria-label="Next weeks"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Heatmap Legend */}
          <div className="flex items-center gap-1 mb-3 text-[10px] text-muted-foreground">
            <span>Less</span>
            <div className="h-3 w-3 rounded-sm bg-muted" />
            <div className="h-3 w-3 rounded-sm bg-amber-100 dark:bg-amber-900/30" />
            <div className="h-3 w-3 rounded-sm bg-amber-300 dark:bg-amber-800/50" />
            <div className="h-3 w-3 rounded-sm bg-orange-400 dark:bg-orange-700/60" />
            <div className="h-3 w-3 rounded-sm bg-red-500 dark:bg-red-700/70" />
            <span>More</span>
          </div>

          {/* Grid */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-[10px] font-medium text-muted-foreground pb-1 pr-2 w-16">
                    Week
                  </th>
                  {DAY_NAMES.map((day) => (
                    <th
                      key={day}
                      className="text-center text-[10px] font-medium text-muted-foreground pb-1 w-10"
                    >
                      {day}
                    </th>
                  ))}
                  <th className="text-right text-[10px] font-medium text-muted-foreground pb-1 pl-2 w-14">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {weekRows.map((week) => (
                  <tr key={week.weekStart}>
                    <td className="text-[10px] text-muted-foreground pr-2 py-0.5 whitespace-nowrap">
                      {week.weekLabel}
                    </td>
                    {week.days.map((day) => (
                      <td key={day.date} className="p-0.5">
                        <button
                          onClick={() => handleDayClick(day)}
                          disabled={day.entries.length === 0}
                          className={`
                            relative w-full aspect-square min-w-[32px] max-w-[44px] rounded-md
                            flex flex-col items-center justify-center
                            text-[10px] font-medium
                            transition-all duration-150
                            ${getHeatColor(day.hours, maxDailyHours)}
                            ${day.isToday ? "ring-2 ring-blue-500 ring-offset-1 ring-offset-background" : ""}
                            ${day.isFuture ? "opacity-40" : ""}
                            ${day.entries.length > 0 ? "cursor-pointer hover:scale-105 hover:shadow-md" : "cursor-default"}
                          `}
                          aria-label={`${formatDateFull(day.date)}: ${day.hours.toFixed(1)} hours`}
                        >
                          <span className="leading-none">{day.label}</span>
                          {day.hours > 0 && (
                            <span className="leading-none text-[8px] mt-0.5">
                              {day.hours.toFixed(day.hours % 1 === 0 ? 0 : 1)}h
                            </span>
                          )}
                        </button>
                      </td>
                    ))}
                    <td className="text-right text-xs font-semibold pl-2 py-0.5 tabular-nums">
                      {week.total > 0 ? `${week.total.toFixed(1)}h` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* SR-only full data table */}
          <div className="sr-only">
            <table>
              <caption>{title} – full tabular data</caption>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Hours</th>
                  <th>Entries</th>
                </tr>
              </thead>
              <tbody>
                {weekRows.flatMap((w) =>
                  w.days.map((d) => (
                    <tr key={d.date}>
                      <td>{d.date}</td>
                      <td>{d.hours.toFixed(1)}</td>
                      <td>{d.entries.length}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Day Detail Dialog */}
      <Dialog
        open={selectedDay !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedDay(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedDay && formatDateFull(selectedDay.date)}
            </DialogTitle>
          </DialogHeader>
          {selectedDay && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Hours</span>
                <span className="font-bold text-lg">
                  {selectedDay.hours.toFixed(1)}h
                </span>
              </div>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {selectedDay.entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-3 rounded-lg border bg-muted/30 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">
                        {entry.projectName}
                      </span>
                      <span className="font-mono text-sm font-semibold">
                        {entry.totalHours.toFixed(1)}h
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {entry.costCodeDescription}
                    </div>
                    <div className="flex gap-2 text-[10px]">
                      {entry.regularHours > 0 && (
                        <Badge variant="outline" className="text-[10px] h-5 py-0">
                          Reg: {entry.regularHours.toFixed(1)}h
                        </Badge>
                      )}
                      {entry.overtimeHours > 0 && (
                        <Badge
                          variant="outline"
                          className="text-[10px] h-5 py-0 text-amber-600 border-amber-300"
                        >
                          OT: {entry.overtimeHours.toFixed(1)}h
                        </Badge>
                      )}
                      {entry.doubletimeHours > 0 && (
                        <Badge
                          variant="outline"
                          className="text-[10px] h-5 py-0 text-red-600 border-red-300"
                        >
                          DT: {entry.doubletimeHours.toFixed(1)}h
                        </Badge>
                      )}
                    </div>
                    {entry.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {entry.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
