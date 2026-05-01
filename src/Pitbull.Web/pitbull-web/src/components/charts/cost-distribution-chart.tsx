"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import type { PieLabelRenderProps } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { DollarSign, ChevronLeft } from "lucide-react";
import api from "@/lib/api";
import type { TimeEntry } from "@/lib/types";

// ── Types ──────────────────────────────────────────────
interface CostSegment {
  name: string;
  value: number;
  color: string;
  items?: { label: string; value: number }[];
}

interface CostDistributionChartProps {
  /** Filter to a specific project */
  projectId?: string;
  /** Chart title override */
  title?: string;
  /** Date range start (ISO) */
  startDate?: string;
  /** Date range end (ISO) */
  endDate?: string;
}

// ── Colors ─────────────────────────────────────────────
const COLORS = {
  labor: "#3b82f6",
  equipment: "#f59e0b",
  materials: "#10b981",
  subcontract: "#8b5cf6",
  other: "#6b7280",
};

const DRILL_COLORS = [
  "#2563eb",
  "#0891b2",
  "#059669",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#db2777",
  "#ea580c",
];

// ── Helpers ────────────────────────────────────────────
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getMonthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
}

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

// ── Custom label ───────────────────────────────────────
function renderCustomLabel(props: PieLabelRenderProps) {
  const cx = Number(props.cx ?? 0);
  const cy = Number(props.cy ?? 0);
  const midAngle = Number(props.midAngle ?? 0);
  const innerRadius = Number(props.innerRadius ?? 0);
  const outerRadius = Number(props.outerRadius ?? 0);
  const percent = Number(props.percent ?? 0);

  if (percent < 0.05) return null; // Skip labels for tiny slices
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={12}
      fontWeight={600}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

// ── Component ──────────────────────────────────────────
export function CostDistributionChart({
  projectId,
  title = "Cost Distribution",
  startDate,
  endDate,
}: CostDistributionChartProps) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [drillInto, setDrillInto] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          startDate: startDate ?? getMonthStart(),
          endDate: endDate ?? getToday(),
          pageSize: "2000",
        });
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
  }, [projectId, startDate, endDate]);

  // Compute cost segments
  const segments: CostSegment[] = useMemo(() => {
    if (entries.length === 0) return [];

    // Aggregate per-project for drill-down detail
    const laborByProject = new Map<string, number>();
    const equipByProject = new Map<string, number>();
    let totalLabor = 0;
    let totalEquip = 0;

    for (const e of entries) {
      // Labor: hours * $45 average (same estimation as the existing widget)
      const laborCost =
        (e.regularHours + e.overtimeHours * 1.5 + e.doubletimeHours * 2) * 45;
      totalLabor += laborCost;
      laborByProject.set(
        e.projectName || "Unknown",
        (laborByProject.get(e.projectName || "Unknown") ?? 0) + laborCost
      );

      // Equipment
      const equipCost = (e.equipmentHours || 0) * 85;
      totalEquip += equipCost;
      if (equipCost > 0) {
        equipByProject.set(
          e.projectName || "Unknown",
          (equipByProject.get(e.projectName || "Unknown") ?? 0) + equipCost
        );
      }
    }

    const segs: CostSegment[] = [];

    if (totalLabor > 0) {
      segs.push({
        name: "Labor",
        value: totalLabor,
        color: COLORS.labor,
        items: Array.from(laborByProject.entries())
          .map(([label, value]) => ({ label, value }))
          .sort((a, b) => b.value - a.value),
      });
    }

    if (totalEquip > 0) {
      segs.push({
        name: "Equipment",
        value: totalEquip,
        color: COLORS.equipment,
        items: Array.from(equipByProject.entries())
          .map(([label, value]) => ({ label, value }))
          .sort((a, b) => b.value - a.value),
      });
    }

    // Placeholder for materials – no data source yet, but structure supports it
    // This shows users that the chart can handle additional segments

    return segs;
  }, [entries]);

  const totalCost = segments.reduce((s, seg) => s + seg.value, 0);

  // Drill-down data
  const drillData = useMemo(() => {
    if (!drillInto) return null;
    const seg = segments.find((s) => s.name === drillInto);
    if (!seg || !seg.items) return null;
    return seg.items.map((item, i) => ({
      name: item.label,
      value: item.value,
      color: DRILL_COLORS[i % DRILL_COLORS.length],
    }));
  }, [drillInto, segments]);

  const handlePieClick = useCallback(
    (data: { name?: string }) => {
      if (!drillInto && data.name) {
        setDrillInto(data.name);
      }
    },
    [drillInto]
  );

  const pieData = drillData ?? segments;

  // Loading skeleton
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="flex flex-col items-center">
          <Skeleton className="h-[220px] w-[220px] rounded-full" />
          <Skeleton className="h-4 w-32 mt-4" />
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (segments.length === 0 || totalCost === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-500" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[220px] flex flex-col items-center justify-center text-muted-foreground text-sm">
            <DollarSign className="h-8 w-8 mb-2 opacity-40" />
            <p>No cost data available</p>
            <p className="text-xs mt-1">Log time entries to see the breakdown</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-500" />
            {drillInto ? `${title} › ${drillInto}` : title}
          </CardTitle>
          {drillInto && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setDrillInto(null)}
            >
              <ChevronLeft className="h-3 w-3 mr-1" />
              Back
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Center total */}
        <div className="text-center mb-2">
          <p className="text-xs text-muted-foreground">
            {drillInto ? `${drillInto} Total` : "Total Estimated Cost"}
          </p>
          <p className="text-xl font-bold">
            {formatCurrency(
              drillInto
                ? (segments.find((s) => s.name === drillInto)?.value ?? 0)
                : totalCost
            )}
          </p>
        </div>

        {/* Donut chart */}
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
                label={renderCustomLabel}
                labelLine={false}
                onClick={handlePieClick}
                cursor={drillInto ? "default" : "pointer"}
                animationBegin={0}
                animationDuration={400}
              >
                {pieData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    stroke="hsl(var(--background))"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value) => [formatCurrency(Number(value) || 0)]}
              />
              <Legend
                wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                formatter={(value: string) => {
                  const seg = pieData.find((s) => s.name === value);
                  const total = pieData.reduce((s, p) => s + p.value, 0);
                  const pct = seg && total > 0 ? ((seg.value / total) * 100).toFixed(0) : "0";
                  return `${value} (${pct}%)`;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Hint */}
        {!drillInto && segments.some((s) => s.items && s.items.length > 1) && (
          <p className="text-[10px] text-muted-foreground text-center mt-1">
            Click a segment to drill down by project
          </p>
        )}

        {/* SR-only data table */}
        <div className="sr-only">
          <table>
            <caption>{title} – tabular data</caption>
            <thead>
              <tr>
                <th>Category</th>
                <th>Amount</th>
                <th>Percentage</th>
              </tr>
            </thead>
            <tbody>
              {segments.map((seg) => (
                <tr key={seg.name}>
                  <td>{seg.name}</td>
                  <td>{formatCurrency(seg.value)}</td>
                  <td>
                    {totalCost > 0
                      ? ((seg.value / totalCost) * 100).toFixed(1)
                      : 0}
                    %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
