"use client";

import * as React from "react";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  RefreshCw,
  Clock,
  Users,
  DollarSign,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HealthScoreGauge } from "@/components/ui/health-score-gauge";
import { cn } from "@/lib/utils";
import type { AiProjectSummary } from "@/lib/types";

interface AiInsightsProps {
  projectId: string;
  summary: AiProjectSummary | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export function AiInsights({
  summary,
  isLoading,
  error,
  onRefresh,
}: AiInsightsProps) {
  if (isLoading) {
    return <AiInsightsSkeleton />;
  }

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-5 w-5 text-destructive" />
            AI Insights Unavailable
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!summary || !summary.success) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
            AI Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {summary?.error || "Unable to generate insights for this project."}
          </p>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Generate Insights
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-background to-primary/5 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            AI Project Insights
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="sr-only">Refresh insights</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Health Score Hero Section */}
        <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-xl bg-background/60 border">
          <HealthScoreGauge score={summary.healthScore} size="lg" />
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-lg font-semibold mb-2">Project Health</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {summary.summary}
            </p>
          </div>
        </div>

        {/* Key Metrics Grid */}
        {summary.metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard
              icon={Clock}
              label="Hours Logged"
              value={summary.metrics.totalHoursLogged.toFixed(1)}
              subtext="total"
            />
            <MetricCard
              icon={DollarSign}
              label="Labor Cost"
              value={formatCurrency(summary.metrics.totalLaborCost)}
              subtext="to date"
            />
            <MetricCard
              icon={Users}
              label="Team Size"
              value={String(summary.metrics.assignedEmployees)}
              subtext="assigned"
            />
            <MetricCard
              icon={Calendar}
              label="Deadline"
              value={summary.metrics.daysUntilDeadline > 0 
                ? `${summary.metrics.daysUntilDeadline}d` 
                : summary.metrics.daysUntilDeadline === 0 
                  ? "Today!" 
                  : `${Math.abs(summary.metrics.daysUntilDeadline)}d ago`}
              subtext={summary.metrics.daysUntilDeadline > 0 ? "remaining" : summary.metrics.daysUntilDeadline === 0 ? "" : "overdue"}
              highlight={summary.metrics.daysUntilDeadline < 0}
            />
          </div>
        )}

        {/* Insights Sections */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Highlights */}
          {summary.highlights.length > 0 && (
            <InsightSection
              title="Highlights"
              icon={CheckCircle2}
              items={summary.highlights}
              variant="success"
            />
          )}

          {/* Concerns */}
          {summary.concerns.length > 0 && (
            <InsightSection
              title="Concerns"
              icon={AlertTriangle}
              items={summary.concerns}
              variant="warning"
            />
          )}

          {/* Recommendations */}
          {summary.recommendations.length > 0 && (
            <InsightSection
              title="Recommendations"
              icon={Lightbulb}
              items={summary.recommendations}
              variant="info"
            />
          )}
        </div>

        {/* Generated timestamp */}
        <p className="text-xs text-muted-foreground text-right">
          Generated {new Date(summary.generatedAt).toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  subtext,
  highlight = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtext: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-lg border p-3 text-center transition-colors",
      highlight ? "border-orange-300 bg-orange-50" : "bg-background/60"
    )}>
      <Icon className={cn(
        "h-4 w-4 mx-auto mb-1",
        highlight ? "text-orange-500" : "text-muted-foreground"
      )} />
      <div className="text-xs text-muted-foreground font-medium mb-0.5">{label}</div>
      <div className={cn(
        "text-lg font-bold tabular-nums",
        highlight && "text-orange-600"
      )}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{subtext}</div>
    </div>
  );
}

function InsightSection({
  title,
  icon: Icon,
  items,
  variant,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: string[];
  variant: "success" | "warning" | "info";
}) {
  const styles = {
    success: {
      container: "bg-emerald-50/50 border-emerald-200",
      icon: "text-emerald-600",
      dot: "bg-emerald-500",
    },
    warning: {
      container: "bg-amber-50/50 border-amber-200",
      icon: "text-amber-600",
      dot: "bg-amber-500",
    },
    info: {
      container: "bg-blue-50/50 border-blue-200",
      icon: "text-blue-600",
      dot: "bg-blue-500",
    },
  };

  const style = styles[variant];

  return (
    <div className={cn("rounded-lg border p-4", style.container)}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={cn("h-4 w-4", style.icon)} />
        <h4 className="font-medium text-sm">{title}</h4>
      </div>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className={cn("h-1.5 w-1.5 rounded-full mt-1.5 shrink-0", style.dot)} />
            <span className="text-muted-foreground">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Loading skeleton for AI Insights
export function AiInsightsSkeleton() {
  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-5 w-5 text-primary animate-pulse" />
          AI Project Insights
          <span className="text-xs font-normal text-muted-foreground ml-2">
            Analyzing...
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Health Score Skeleton */}
        <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-xl bg-background/60 border">
          <div className="flex flex-col items-center gap-1">
            <Skeleton className="h-[140px] w-[140px] rounded-full" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="flex-1 space-y-2 text-center sm:text-left">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>

        {/* Metrics Skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-lg border p-3 text-center bg-background/60">
              <Skeleton className="h-4 w-4 mx-auto mb-1" />
              <Skeleton className="h-6 w-16 mx-auto mb-1" />
              <Skeleton className="h-3 w-12 mx-auto" />
            </div>
          ))}
        </div>

        {/* Insights Skeleton */}
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-lg border p-4 bg-muted/20">
              <div className="flex items-center gap-2 mb-3">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
