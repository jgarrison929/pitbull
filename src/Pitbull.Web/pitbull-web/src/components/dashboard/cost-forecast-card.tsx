"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  Clock,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface CostPrediction {
  id: string;
  projectId: string;
  projectName: string;
  predictedFinalCost: number;
  confidenceLevel: number;
  predictionMethod: "LinearRegression" | "EarnedValue" | "WeightedAverage" | "Historical";
  varianceToBudget: number;
  variancePercent: number;
  budgetAtCompletion: number;
  costToDate: number;
  estimatedCostToComplete: number;
  burnRate: number;
  daysRemaining: number;
  notes: string | null;
  createdAt: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getConfidenceLabel(level: number): { label: string; className: string } {
  if (level >= 0.8) {
    return {
      label: "High",
      className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
    };
  }
  if (level >= 0.5) {
    return {
      label: "Medium",
      className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
    };
  }
  return {
    label: "Low",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
  };
}

function getMethodLabel(method: CostPrediction["predictionMethod"]): string {
  switch (method) {
    case "LinearRegression":
      return "Linear Regression";
    case "EarnedValue":
      return "Earned Value";
    case "WeightedAverage":
      return "Weighted Average";
    case "Historical":
      return "Historical";
    default:
      return method;
  }
}

export function CostForecastCard({ projectId }: { projectId: string }) {
  const [prediction, setPrediction] = useState<CostPrediction | null>(null);
  const [history, setHistory] = useState<CostPrediction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [latest, historyData] = await Promise.all([
        api<CostPrediction>(`/api/cost-predictions/project/${projectId}`).catch(() => null),
        api<CostPrediction[]>(`/api/cost-predictions/project/${projectId}/history`).catch(() => []),
      ]);
      setPrediction(latest);
      setHistory(historyData);
    } catch {
      // Non-critical section — silently degrade
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const result = await api<CostPrediction>(
        `/api/cost-predictions/project/${projectId}/generate`,
        { method: "POST" }
      );
      setPrediction(result);
      setHistory((prev) => [...prev, result]);
      toast.success("Cost forecast generated");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate forecast";
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const chartData = history.map((h) => ({
    date: formatDate(h.createdAt),
    predicted: h.predictedFinalCost,
    budget: h.budgetAtCompletion,
  }));

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Cost Forecast
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-8 w-40 bg-muted rounded" />
            <div className="h-4 w-60 bg-muted rounded" />
            <div className="h-32 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!prediction) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Cost Forecast
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium mb-1">No predictions yet</p>
            <p className="text-xs text-muted-foreground mb-4">
              Generate your first cost forecast to see predicted vs budgeted costs.
            </p>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-3.5 w-3.5" />
                  Generate Forecast
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isOverBudget = prediction.varianceToBudget > 0;
  const confidence = getConfidenceLabel(prediction.confidenceLevel);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Cost Forecast
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge className={cn("text-[10px]", confidence.className)}>
                {confidence.label} Confidence
              </Badge>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Main Metrics */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Predicted Final Cost</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(prediction.predictedFinalCost)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Budget at Completion</p>
                <p className="text-2xl font-bold text-muted-foreground">
                  {formatCurrency(prediction.budgetAtCompletion)}
                </p>
              </div>
            </div>

            {/* Variance Indicator */}
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg border p-3",
                isOverBudget
                  ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
                  : "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30"
              )}
            >
              {isOverBudget ? (
                <TrendingUp className="h-4 w-4 text-red-600 dark:text-red-400" />
              ) : (
                <TrendingDown className="h-4 w-4 text-green-600 dark:text-green-400" />
              )}
              <div className="flex-1">
                <p
                  className={cn(
                    "text-sm font-medium",
                    isOverBudget
                      ? "text-red-700 dark:text-red-300"
                      : "text-green-700 dark:text-green-300"
                  )}
                >
                  {isOverBudget ? "Over" : "Under"} budget by{" "}
                  {formatCurrency(Math.abs(prediction.varianceToBudget))}
                </p>
                <p
                  className={cn(
                    "text-xs",
                    isOverBudget
                      ? "text-red-600 dark:text-red-400"
                      : "text-green-600 dark:text-green-400"
                  )}
                >
                  {isOverBudget ? "+" : ""}
                  {prediction.variancePercent.toFixed(1)}% variance
                </p>
              </div>
            </div>

            {/* Mini Stats */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-2.5">
                <p className="text-[10px] text-muted-foreground uppercase">Method</p>
                <p className="text-xs font-medium mt-0.5">
                  {getMethodLabel(prediction.predictionMethod)}
                </p>
              </div>
              <div className="rounded-lg border p-2.5">
                <p className="text-[10px] text-muted-foreground uppercase">Burn Rate</p>
                <p className="text-xs font-medium mt-0.5">
                  {formatCurrency(prediction.burnRate)}/day
                </p>
              </div>
              <div className="rounded-lg border p-2.5">
                <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  Days Remaining
                </p>
                <p className="text-xs font-medium mt-0.5">{prediction.daysRemaining}</p>
              </div>
            </div>

            {/* Trend Chart */}
            {chartData.length > 1 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Prediction Trend</p>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10 }}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <YAxis
                        tickFormatter={(v: number) =>
                          `$${(v / 1000).toFixed(0)}k`
                        }
                        tick={{ fontSize: 10 }}
                        stroke="hsl(var(--muted-foreground))"
                        width={50}
                      />
                      <Tooltip
                        formatter={(value) => [formatCurrency(Number(value))]}
                        labelStyle={{ fontSize: 11 }}
                        contentStyle={{
                          fontSize: 11,
                          borderRadius: 8,
                          border: "1px solid hsl(var(--border))",
                          background: "hsl(var(--background))",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="predicted"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        name="Predicted"
                        dot={{ r: 3, fill: "#f59e0b" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="budget"
                        stroke="hsl(var(--muted-foreground))"
                        strokeWidth={1}
                        strokeDasharray="4 4"
                        name="Budget"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Regenerate Button */}
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                )}
                Regenerate
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
