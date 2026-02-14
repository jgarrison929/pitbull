"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Wrench } from "lucide-react";
import api from "@/lib/api";
import type { Equipment, TimeEntry } from "@/lib/types";

// ── Types ──────────────────────────────────────────────
interface EquipUsage {
  name: string;
  code: string;
  hours: number;
  internalCost: number;
  billingRevenue: number;
  isIdle: boolean;
  isActive: boolean;
}

interface EquipmentUtilizationChartProps {
  /** Date range start (ISO) */
  startDate?: string;
  /** Date range end (ISO) */
  endDate?: string;
  /** Filter to a project */
  projectId?: string;
  /** Chart title override */
  title?: string;
  /** Max equipment items to show (default 15) */
  maxItems?: number;
}

// ── Helpers ────────────────────────────────────────────
function getMonthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
}

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ── Component ──────────────────────────────────────────
export function EquipmentUtilizationChart({
  startDate,
  endDate,
  projectId,
  title = "Equipment Utilization",
  maxItems = 15,
}: EquipmentUtilizationChartProps) {
  const [data, setData] = useState<EquipUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: startDate ?? getMonthStart(),
        endDate: endDate ?? getToday(),
        pageSize: "2000",
      });
      if (projectId) params.set("projectId", projectId);

      const [equipResult, entriesResult] = await Promise.all([
        api<{ items: Equipment[] }>("/api/equipment?pageSize=200"),
        api<{ items: TimeEntry[] }>(`/api/time-entries?${params.toString()}`),
      ]);

      // Aggregate hours per equipment
      const hoursMap = new Map<string, number>();
      for (const entry of entriesResult.items) {
        if (!entry.equipmentId || entry.equipmentHours <= 0) continue;
        hoursMap.set(
          entry.equipmentId,
          (hoursMap.get(entry.equipmentId) ?? 0) + entry.equipmentHours
        );
      }

      const usage: EquipUsage[] = equipResult.items.map((equip) => {
        const hours = hoursMap.get(equip.id) ?? 0;
        return {
          name: equip.name,
          code: equip.code,
          hours,
          internalCost: hours * equip.hourlyRate,
          billingRevenue: hours * (equip.billingRate ?? equip.hourlyRate),
          isIdle: hours === 0 && equip.isActive,
          isActive: equip.isActive,
        };
      });

      // Sort: used first by hours desc, then idle
      usage.sort((a, b) => b.hours - a.hours);
      setData(usage);
    } catch {
      // Silent
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Truncate for chart display
  const chartData = useMemo(() => {
    return data.slice(0, maxItems);
  }, [data, maxItems]);

  const idleCount = data.filter((d) => d.isIdle).length;
  const totalHours = data.reduce((s, d) => s + d.hours, 0);

  // Loading
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-44" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="h-4 w-4 text-orange-500" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground text-sm">
            <Wrench className="h-8 w-8 mb-2 opacity-40" />
            <p>No equipment found</p>
            <p className="text-xs mt-1">Add equipment to track utilization</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="h-4 w-4 text-orange-500" />
            {title}
          </CardTitle>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">
              Total: <strong className="text-foreground">{totalHours.toFixed(0)}h</strong>
            </span>
            {idleCount > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700"
              >
                {idleCount} idle
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}`}
              />
              <YAxis
                type="category"
                dataKey="code"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={70}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number, name: string) => [
                  formatCurrency(value),
                  name,
                ]}
                labelFormatter={(label) => {
                  const item = chartData.find((d) => d.code === label);
                  return item ? `${item.name} (${item.hours.toFixed(1)}h)` : label;
                }}
              />
              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
              <Bar dataKey="internalCost" name="Internal Cost" radius={[0, 0, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cost-${index}`}
                    fill={entry.isIdle ? "#ef4444" : "#3b82f6"}
                    fillOpacity={entry.isIdle ? 0.4 : 0.8}
                  />
                ))}
              </Bar>
              <Bar dataKey="billingRevenue" name="Billing Revenue" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`rev-${index}`}
                    fill={entry.isIdle ? "#ef4444" : "#10b981"}
                    fillOpacity={entry.isIdle ? 0.4 : 0.8}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend for idle */}
        {idleCount > 0 && (
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <div className="h-2.5 w-2.5 rounded-sm bg-red-500 opacity-40" />
            <span>Idle equipment (no hours logged this period)</span>
          </div>
        )}

        {/* SR-only data table */}
        <div className="sr-only">
          <table>
            <caption>{title} – tabular data</caption>
            <thead>
              <tr>
                <th>Equipment</th>
                <th>Code</th>
                <th>Hours</th>
                <th>Internal Cost</th>
                <th>Billing Revenue</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.code}>
                  <td>{d.name}</td>
                  <td>{d.code}</td>
                  <td>{d.hours.toFixed(1)}</td>
                  <td>{formatCurrency(d.internalCost)}</td>
                  <td>{formatCurrency(d.billingRevenue)}</td>
                  <td>{d.isIdle ? "Idle" : d.isActive ? "Active" : "Inactive"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
