"use client";

import { useEffect, useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock } from "lucide-react";
import api from "@/lib/api";
import type { TimeEntry } from "@/lib/types";

// ── Types ──────────────────────────────────────────────
interface DailyDataPoint {
  label: string;
  date: string;
  regular: number;
  overtime: number;
  doubleTime: number;
  total: number;
}

interface HoursTrendChartProps {
  /** Filter entries to a specific employee */
  employeeId?: string;
  /** Filter entries to a specific project */
  projectId?: string;
  /** Chart title override */
  title?: string;
  /** How many days of history to show (default 28) */
  days?: number;
}

// ── Helpers ────────────────────────────────────────────
function formatDateShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getWeekLabel(d: Date): string {
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${formatDateShort(start)} – ${formatDateShort(end)}`;
}

function getWeekKey(d: Date): string {
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  return start.toISOString().split("T")[0];
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

// ── Component ──────────────────────────────────────────
export function HoursTrendChart({
  employeeId,
  projectId,
  title = "Hours Trend",
  days = 28,
}: HoursTrendChartProps) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<"daily" | "weekly">("daily");

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          startDate: daysAgo(days),
          endDate: today(),
          pageSize: "2000",
        });
        if (employeeId) params.set("employeeId", employeeId);
        if (projectId) params.set("projectId", projectId);

        const result = await api<{ items: TimeEntry[] }>(
          `/api/time-entries?${params.toString()}`
        );
        setEntries(result.items);
      } catch {
        // Silently handle – chart will show empty state
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [employeeId, projectId, days]);

  // Build daily data
  const dailyData = useMemo(() => {
    const map = new Map<string, DailyDataPoint>();

    // Pre-fill every date
    for (let i = days; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      map.set(key, {
        label: formatDateShort(d),
        date: key,
        regular: 0,
        overtime: 0,
        doubleTime: 0,
        total: 0,
      });
    }

    for (const entry of entries) {
      const dateKey = entry.date.split("T")[0];
      const point = map.get(dateKey);
      if (point) {
        point.regular += entry.regularHours;
        point.overtime += entry.overtimeHours;
        point.doubleTime += entry.doubletimeHours;
        point.total += entry.totalHours;
      }
    }

    return Array.from(map.values());
  }, [entries, days]);

  // Build weekly data
  const weeklyData = useMemo(() => {
    const map = new Map<
      string,
      { label: string; key: string; regular: number; overtime: number; doubleTime: number; total: number }
    >();

    for (const day of dailyData) {
      const d = new Date(day.date);
      const wk = getWeekKey(d);
      if (!map.has(wk)) {
        map.set(wk, {
          label: getWeekLabel(d),
          key: wk,
          regular: 0,
          overtime: 0,
          doubleTime: 0,
          total: 0,
        });
      }
      const w = map.get(wk)!;
      w.regular += day.regular;
      w.overtime += day.overtime;
      w.doubleTime += day.doubleTime;
      w.total += day.total;
    }

    return Array.from(map.values());
  }, [dailyData]);

  const chartData = view === "daily" ? dailyData : weeklyData;
  const hasData = entries.length > 0;

  // Skeleton loading
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[280px] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" />
            {title}
          </CardTitle>
          <Tabs
            value={view}
            onValueChange={(v) => setView(v as "daily" | "weekly")}
            className="w-auto"
          >
            <TabsList className="h-8">
              <TabsTrigger value="daily" className="text-xs px-3 h-7">
                Daily
              </TabsTrigger>
              <TabsTrigger value="weekly" className="text-xs px-3 h-7">
                Weekly
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="h-[280px] flex flex-col items-center justify-center text-muted-foreground text-sm">
            <Clock className="h-8 w-8 mb-2 opacity-40" />
            <p>No time entries in this period</p>
            <p className="text-xs mt-1">Log hours to see trends here</p>
          </div>
        ) : (
          <>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="gradRegular" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradOT" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradDT" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    interval={view === "daily" ? Math.max(Math.floor(chartData.length / 7), 1) : 0}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v}h`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value?: number, name?: string) => [
                      `${(value ?? 0).toFixed(1)} hrs`,
                      name ?? "",
                    ]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="regular"
                    name="Regular"
                    stackId="hours"
                    stroke="#3b82f6"
                    fill="url(#gradRegular)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="overtime"
                    name="Overtime"
                    stackId="hours"
                    stroke="#f59e0b"
                    fill="url(#gradOT)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="doubleTime"
                    name="Double Time"
                    stackId="hours"
                    stroke="#ef4444"
                    fill="url(#gradDT)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* SR-only data table */}
            <div className="sr-only">
              <table>
                <caption>{title} – tabular data</caption>
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Regular</th>
                    <th>Overtime</th>
                    <th>Double Time</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((d) => (
                    <tr key={d.label}>
                      <td>{d.label}</td>
                      <td>{d.regular.toFixed(1)}</td>
                      <td>{d.overtime.toFixed(1)}</td>
                      <td>{d.doubleTime.toFixed(1)}</td>
                      <td>{d.total.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
