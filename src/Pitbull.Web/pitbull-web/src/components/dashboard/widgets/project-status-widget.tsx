"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface ProjectBudgetHealth {
  name: string;
  budget: number;
  spent: number;
  percentUsed: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `$${(value / 1_000).toFixed(0)}K`;
  return formatCurrency(value);
}

function budgetBarColor(percentUsed: number): { bar: string; text: string } {
  if (percentUsed >= 90) return { bar: "bg-red-500", text: "text-red-600" };
  if (percentUsed >= 75) return { bar: "bg-amber-500", text: "text-amber-600" };
  return { bar: "bg-emerald-500", text: "text-emerald-600" };
}

export function ProjectStatusWidget({
  data,
  isLoading,
}: {
  data: ProjectBudgetHealth[] | undefined;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Budget Health</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading &&
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        {!isLoading &&
          data?.map((project) => (
            <div key={project.name} className="space-y-1.5 min-w-0 overflow-hidden">
              <div className="flex items-start justify-between gap-2 text-sm min-w-0">
                <span className="font-medium min-w-0 break-words leading-snug">
                  {project.name}
                </span>
                <span className="text-muted-foreground shrink-0 tabular-nums whitespace-nowrap text-xs sm:text-sm">
                  <span className="sm:hidden">
                    {formatCurrencyCompact(project.spent)} /{" "}
                    {formatCurrencyCompact(project.budget)}
                  </span>
                  <span className="hidden sm:inline">
                    {formatCurrency(project.spent)} / {formatCurrency(project.budget)}
                  </span>
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full ${budgetBarColor(project.percentUsed).bar}`}
                  style={{
                    width: `${Math.min(Math.max(project.percentUsed, 0), 100)}%`,
                  }}
                />
              </div>
              <div className="text-xs text-muted-foreground">
                <span className={budgetBarColor(project.percentUsed).text}>
                  {project.percentUsed.toFixed(1)}%
                </span>{" "}
                used
              </div>
            </div>
          ))}
        {!isLoading && (data?.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">
            No active project budget data.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
