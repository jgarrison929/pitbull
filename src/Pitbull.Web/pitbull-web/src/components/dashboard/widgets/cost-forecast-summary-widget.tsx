"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Sparkles } from "lucide-react";
import api from "@/lib/api";

interface ProjectBudgetHealth {
  name: string;
  budget: number;
  spent: number;
  percentUsed: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function CostForecastSummaryWidget() {
  const [data, setData] = useState<{
    totalBudget: number;
    totalSpent: number;
    overBudgetCount: number;
    totalProjects: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const analytics = await api<{
          projectBudgetHealth: ProjectBudgetHealth[];
        }>("/api/dashboard/analytics");
        const projects = analytics.projectBudgetHealth;
        setData({
          totalBudget: projects.reduce((s, p) => s + p.budget, 0),
          totalSpent: projects.reduce((s, p) => s + p.spent, 0),
          overBudgetCount: projects.filter((p) => p.percentUsed >= 90).length,
          totalProjects: projects.length,
        });
      } catch {
        // Silently handle
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.totalProjects === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Cost Forecast
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No active project data for cost forecasting.
          </p>
        </CardContent>
      </Card>
    );
  }

  const utilizationPct = data.totalBudget > 0
    ? (data.totalSpent / data.totalBudget) * 100
    : 0;
  const isHealthy = utilizationPct < 85;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          Cost Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs text-muted-foreground">Total Spent / Budget</p>
          <p className="text-xl font-bold">
            {formatCurrency(data.totalSpent)}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              / {formatCurrency(data.totalBudget)}
            </span>
          </p>
        </div>

        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full ${isHealthy ? "bg-emerald-500" : "bg-red-500"}`}
            style={{ width: `${Math.min(utilizationPct, 100)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            {isHealthy ? (
              <TrendingDown className="h-3 w-3 text-emerald-600" />
            ) : (
              <TrendingUp className="h-3 w-3 text-red-600" />
            )}
            <span className={isHealthy ? "text-emerald-600" : "text-red-600"}>
              {utilizationPct.toFixed(1)}% utilized
            </span>
          </div>
          {data.overBudgetCount > 0 && (
            <span className="text-red-600">
              {data.overBudgetCount} project{data.overBudgetCount > 1 ? "s" : ""} over 90%
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
