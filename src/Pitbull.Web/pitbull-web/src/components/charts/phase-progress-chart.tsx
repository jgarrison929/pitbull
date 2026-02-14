"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Layers } from "lucide-react";
import api from "@/lib/api";
import { type Phase, PhaseStatus } from "@/lib/types";

// ── Types ──────────────────────────────────────────────
interface PhaseProgressChartProps {
  projectId: string;
  title?: string;
}

// ── Status styles ──────────────────────────────────────
const STATUS_COLORS: Record<PhaseStatus, { bar: string; badge: string; label: string }> = {
  [PhaseStatus.Completed]: {
    bar: "bg-green-500",
    badge: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
    label: "Complete",
  },
  [PhaseStatus.InProgress]: {
    bar: "bg-blue-500",
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
    label: "In Progress",
  },
  [PhaseStatus.NotStarted]: {
    bar: "bg-gray-400 dark:bg-gray-600",
    badge: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    label: "Not Started",
  },
  [PhaseStatus.OnHold]: {
    bar: "bg-amber-500",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
    label: "On Hold",
  },
};

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000)
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

// ── Component ──────────────────────────────────────────
export function PhaseProgressChart({
  projectId,
  title = "Phase Progress",
}: PhaseProgressChartProps) {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const data = await api<Phase[]>(`/api/projects/${projectId}/phases`);
        setPhases(data.sort((a, b) => a.sortOrder - b.sortOrder));
      } catch {
        // Silent
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [projectId]);

  // Loading
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 w-full rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (phases.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-500" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground text-sm">
            <Layers className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>No phases defined</p>
            <p className="text-xs mt-1">Add phases to this project to track progress</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalBudget = phases.reduce((s, p) => s + p.budgetAmount, 0);
  const totalActual = phases.reduce((s, p) => s + p.actualCost, 0);
  const overallProgress =
    phases.length > 0
      ? phases.reduce((s, p) => s + p.percentComplete, 0) / phases.length
      : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-500" />
            {title}
          </CardTitle>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              Overall: <strong className="text-foreground">{Math.round(overallProgress)}%</strong>
            </span>
            <span>
              Budget: <strong className="text-foreground">{formatCurrency(totalBudget)}</strong>
            </span>
            <span className={totalActual > totalBudget ? "text-red-500" : ""}>
              Actual: <strong>{formatCurrency(totalActual)}</strong>
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs">
          {Object.entries(STATUS_COLORS).map(([, style]) => (
            <div key={style.label} className="flex items-center gap-1.5">
              <div className={`h-2.5 w-2.5 rounded-sm ${style.bar}`} />
              <span className="text-muted-foreground">{style.label}</span>
            </div>
          ))}
        </div>

        {/* Phase bars */}
        <TooltipProvider>
          <div className="space-y-3">
            {phases.map((phase) => {
              const statusStyle = STATUS_COLORS[phase.status] ?? STATUS_COLORS[PhaseStatus.NotStarted];
              const budgetPct =
                totalBudget > 0
                  ? (phase.budgetAmount / totalBudget) * 100
                  : 0;
              const overBudget = phase.actualCost > phase.budgetAmount && phase.budgetAmount > 0;

              return (
                <div key={phase.id} className="group">
                  {/* Phase header */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-mono text-muted-foreground">
                        {phase.costCode}
                      </span>
                      <span className="text-sm font-medium truncate">
                        {phase.name}
                      </span>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] py-0 h-5 ${statusStyle.badge}`}
                      >
                        {statusStyle.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-semibold">
                        {Math.round(phase.percentComplete)}%
                      </span>
                    </div>
                  </div>

                  {/* Progress bar with budget overlay */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="relative h-6 bg-muted rounded-full overflow-hidden cursor-default">
                        {/* Progress fill */}
                        <div
                          className={`absolute inset-y-0 left-0 ${statusStyle.bar} rounded-full transition-all duration-500`}
                          style={{ width: `${Math.min(phase.percentComplete, 100)}%` }}
                        />

                        {/* Budget proportion marker */}
                        {budgetPct > 0 && budgetPct < 100 && (
                          <div
                            className="absolute inset-y-0 w-px bg-foreground/30"
                            style={{ left: `${budgetPct}%` }}
                          />
                        )}

                        {/* Over budget indicator */}
                        {overBudget && (
                          <div className="absolute right-1 inset-y-0 flex items-center">
                            <span className="text-[9px] font-bold text-red-600 dark:text-red-400">
                              OVER
                            </span>
                          </div>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      <div className="space-y-1">
                        <p className="font-semibold">{phase.name}</p>
                        <p>
                          Progress: {Math.round(phase.percentComplete)}%
                        </p>
                        <p>
                          Budget: {formatCurrency(phase.budgetAmount)}
                        </p>
                        <p className={overBudget ? "text-red-400" : ""}>
                          Actual: {formatCurrency(phase.actualCost)}
                          {overBudget &&
                            ` (+${formatCurrency(phase.actualCost - phase.budgetAmount)})`}
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>

                  {/* Budget vs Actual mini stats */}
                  <div className="flex justify-between mt-0.5 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>
                      Budget: {formatCurrency(phase.budgetAmount)}
                    </span>
                    <span className={overBudget ? "text-red-500" : ""}>
                      Actual: {formatCurrency(phase.actualCost)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </TooltipProvider>

        {/* SR-only data table */}
        <div className="sr-only">
          <table>
            <caption>{title} – tabular data</caption>
            <thead>
              <tr>
                <th>Phase</th>
                <th>Code</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Budget</th>
                <th>Actual</th>
              </tr>
            </thead>
            <tbody>
              {phases.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.costCode}</td>
                  <td>{STATUS_COLORS[p.status]?.label ?? "Unknown"}</td>
                  <td>{p.percentComplete}%</td>
                  <td>{formatCurrency(p.budgetAmount)}</td>
                  <td>{formatCurrency(p.actualCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
