"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DollarSign,
  FileQuestion,
  Clock,
  AlertCircle,
  ExternalLink,
  TrendingUp,
} from "lucide-react";
import api from "@/lib/api";
import type { RfiCostSummary } from "@/lib/types";

interface RfiCostWidgetProps {
  projectId: string;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function RfiCostWidget({ projectId }: RfiCostWidgetProps) {
  const [summary, setSummary] = useState<RfiCostSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSummary() {
      try {
        const data = await api<RfiCostSummary>(
          `/api/projects/${projectId}/rfi-cost-summary`
        );
        setSummary(data);
      } catch (err) {
        setError("Failed to load RFI cost summary");
        console.error("RFI cost summary fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSummary();
  }, [projectId]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-16" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileQuestion className="h-4 w-4" />
            RFI Cost Impact
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!summary || summary.totalRfis === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileQuestion className="h-4 w-4" />
            RFI Cost Impact
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No RFIs recorded for this project yet.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link href={`/rfis/new?projectId=${projectId}`}>Create RFI</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const costImpactPercent =
    summary.totalRfis > 0
      ? Math.round((summary.rfisWithCostImpact / summary.totalRfis) * 100)
      : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileQuestion className="h-4 w-4" />
            RFI Cost Impact
          </CardTitle>
          <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
            <Link href={`/rfis?projectId=${projectId}`}>
              View All
              <ExternalLink className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Total Cost Highlight */}
        <div className="rounded-lg border bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 p-4 mb-4">
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            Total RFI-Related Costs
          </div>
          <div className="text-3xl font-bold text-amber-700 dark:text-amber-400">
            {formatCurrency(summary.totalCost)}
          </div>
          <div className="flex gap-4 mt-2 text-xs">
            <span className="text-muted-foreground">
              Direct:{" "}
              <span className="font-medium text-foreground">
                {formatCurrency(summary.totalDirectCost)}
              </span>
            </span>
            <span className="text-muted-foreground">
              Delay:{" "}
              <span className="font-medium text-foreground">
                {formatCurrency(summary.totalDelayCost)}
              </span>
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <FileQuestion className="h-3 w-3" />
              Total RFIs
            </div>
            <p className="text-xl font-bold">{summary.totalRfis}</p>
            <p className="text-[10px] text-muted-foreground">
              {summary.openRfis} open
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              With Cost Impact
            </div>
            <p className="text-xl font-bold">{summary.rfisWithCostImpact}</p>
            <div className="flex items-center gap-2">
              <Progress value={costImpactPercent} className="h-1.5 flex-1" />
              <span className="text-[10px] text-muted-foreground">
                {costImpactPercent}%
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Total Delay
            </div>
            <p className="text-xl font-bold">{summary.totalDelayDays}</p>
            <p className="text-[10px] text-muted-foreground">days</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <AlertCircle className="h-3 w-3" />
              Overdue
            </div>
            <p
              className={`text-xl font-bold ${
                summary.overdueRfis > 0 ? "text-red-600" : ""
              }`}
            >
              {summary.overdueRfis}
            </p>
            <p className="text-[10px] text-muted-foreground">
              Avg: {summary.averageResolutionDays.toFixed(1)} days
            </p>
          </div>
        </div>

        {/* Top Costly RFIs */}
        {summary.topCostlyRfis.length > 0 && (
          <div className="pt-3 border-t">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              Top Costly RFIs
            </div>
            <div className="space-y-2">
              {summary.topCostlyRfis.slice(0, 5).map((rfi) => (
                <div
                  key={rfi.number}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 shrink-0"
                    >
                      #{rfi.number}
                    </Badge>
                    <span className="truncate text-muted-foreground">
                      {rfi.subject}
                    </span>
                  </div>
                  <span className="font-mono font-medium text-amber-600 shrink-0 ml-2">
                    {formatCurrency(rfi.totalCost)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
