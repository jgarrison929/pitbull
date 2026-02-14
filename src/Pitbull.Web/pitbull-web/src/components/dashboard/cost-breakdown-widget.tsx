"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, DollarSign } from "lucide-react";
import api from "@/lib/api";
import type { TimeEntry } from "@/lib/types";

interface CostBreakdown {
  laborCost: number;
  equipmentCost: number;
  totalCost: number;
}

function getMonthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
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

export function CostBreakdownWidget() {
  const [data, setData] = useState<CostBreakdown | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const entries = await api<{ items: TimeEntry[] }>(
          `/api/time-entries?startDate=${getMonthStart()}&endDate=${getToday()}&pageSize=500`
        );

        // Estimate costs: labor hours * average rate ($45), equipment hours * average rate ($85)
        // In production you'd use the cost report endpoint; this provides a visual approximation
        const laborHours = entries.items.reduce(
          (sum, e) => sum + e.regularHours + e.overtimeHours * 1.5 + e.doubletimeHours * 2,
          0
        );
        const equipmentHours = entries.items.reduce(
          (sum, e) => sum + (e.equipmentHours || 0),
          0
        );

        // Use a reasonable default rate for visualization
        const laborCost = laborHours * 45;
        const equipmentCost = equipmentHours * 85;

        setData({
          laborCost,
          equipmentCost,
          totalCost: laborCost + equipmentCost,
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
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.totalCost === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <PieChart className="h-4 w-4 text-emerald-500" />
            Cost Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No cost data available this month. Log time entries to see the
            breakdown.
          </p>
        </CardContent>
      </Card>
    );
  }

  const laborPercent = Math.round((data.laborCost / data.totalCost) * 100);
  const equipmentPercent = 100 - laborPercent;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <PieChart className="h-4 w-4 text-emerald-500" />
          Cost Breakdown
          <span className="text-xs font-normal text-muted-foreground ml-auto">
            This Month
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
            <DollarSign className="h-3 w-3" />
            Total Estimated Cost
          </div>
          <p className="text-2xl font-bold">{formatCurrency(data.totalCost)}</p>
        </div>

        {/* Stacked bar */}
        <div className="space-y-2">
          <div className="flex h-4 rounded-full overflow-hidden">
            {laborPercent > 0 && (
              <div
                className="bg-blue-500 transition-all"
                style={{ width: `${laborPercent}%` }}
                title={`Labor: ${laborPercent}%`}
              />
            )}
            {equipmentPercent > 0 && (
              <div
                className="bg-orange-500 transition-all"
                style={{ width: `${equipmentPercent}%` }}
                title={`Equipment: ${equipmentPercent}%`}
              />
            )}
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-2">
              <div className="h-3 w-3 rounded-sm bg-blue-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Labor</p>
                <p className="text-sm font-semibold">
                  {formatCurrency(data.laborCost)}
                </p>
                <p className="text-[10px] text-muted-foreground">{laborPercent}%</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-2">
              <div className="h-3 w-3 rounded-sm bg-orange-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Equipment</p>
                <p className="text-sm font-semibold">
                  {formatCurrency(data.equipmentCost)}
                </p>
                <p className="text-[10px] text-muted-foreground">{equipmentPercent}%</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
