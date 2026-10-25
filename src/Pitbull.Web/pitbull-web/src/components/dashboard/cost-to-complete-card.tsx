"use client";

import { useCallback, useEffect, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { toast } from "sonner";

interface CostCodePrediction {
  costCodeId: string;
  costCodeCode: string;
  costCodeDescription: string;
  budget: number;
  actualCost: number;
  predictedEac: number;
  variance: number;
  variancePercent: number;
  confidence: number;
  trendDirection: "up" | "down" | "flat";
  dailyBurnRate: number;
  daysUntilExhaustion: number | null;
  isWarning: boolean;
}

interface CostToCompleteResult {
  projectId: string;
  projectName: string;
  projectHealth: "Green" | "Yellow" | "Red";
  totalBudget: number;
  totalActualCost: number;
  totalPredictedEac: number;
  overallVariance: number;
  overallConfidence: number;
  warningCount: number;
  costCodes: CostCodePrediction[];
  generatedAt: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const healthConfig = {
  Green: {
    label: "On Track",
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
    dotClass: "bg-green-500",
  },
  Yellow: {
    label: "At Risk",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
    dotClass: "bg-amber-500",
  },
  Red: {
    label: "Over Budget",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
    dotClass: "bg-red-500",
  },
} as const;

function TrendIcon({ direction }: { direction: string }) {
  if (direction === "up") return <TrendingUp className="h-3.5 w-3.5 text-red-500" />;
  if (direction === "down") return <TrendingDown className="h-3.5 w-3.5 text-green-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

export function CostToCompleteCard({ projectId }: { projectId: string }) {
  const [data, setData] = useState<CostToCompleteResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [tableOpen, setTableOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrediction = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api<CostToCompleteResult>(
        `/api/projects/${projectId}/cost-to-complete`
      );
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load prediction";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchPrediction();
  }, [fetchPrediction]);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const result = await api<CostToCompleteResult>(
        `/api/projects/${projectId}/cost-to-complete`
      );
      setData(result);
      toast.success("Prediction refreshed");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to refresh";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-blue-500" />
            Cost-to-Complete Predictions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-8 w-48 bg-muted rounded" />
            <div className="h-4 w-72 bg-muted rounded" />
            <div className="h-32 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-blue-500" />
            Cost-to-Complete Predictions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchPrediction}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const health = healthConfig[data.projectHealth];
  const isOverBudget = data.overallVariance > 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-blue-500" />
              Cost-to-Complete Predictions
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge className={cn("text-[10px] flex items-center gap-1.5", health.className)}>
                <span className={cn("h-1.5 w-1.5 rounded-full", health.dotClass)} />
                {health.label}
              </Badge>
              {data.warningCount > 0 && (
                <Badge variant="destructive" className="text-[10px]">
                  {data.warningCount} warning{data.warningCount > 1 ? "s" : ""}
                </Badge>
              )}
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Summary Metrics */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Total Budget</p>
                <p className="text-xl font-bold">{formatCurrency(data.totalBudget)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Actual to Date</p>
                <p className="text-xl font-bold">{formatCurrency(data.totalActualCost)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Predicted EAC</p>
                <p className={cn("text-xl font-bold", isOverBudget ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400")}>
                  {formatCurrency(data.totalPredictedEac)}
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
                <TrendingUp className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
              ) : (
                <TrendingDown className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
              )}
              <div className="flex-1">
                <p className={cn("text-sm font-medium", isOverBudget ? "text-red-700 dark:text-red-300" : "text-green-700 dark:text-green-300")}>
                  Projected {isOverBudget ? "over" : "under"} budget by {formatCurrency(Math.abs(data.overallVariance))}
                </p>
                <p className={cn("text-xs", isOverBudget ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400")}>
                  Overall confidence: {(data.overallConfidence * 100).toFixed(0)}%
                </p>
              </div>
            </div>

            {/* Expandable Cost Code Detail Table */}
            <Collapsible open={tableOpen} onOpenChange={setTableOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-between">
                  <span>{data.costCodes.length} cost code{data.costCodes.length !== 1 ? "s" : ""} analyzed</span>
                  {tableOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                {/* Mobile card view */}
                <div className="space-y-2 sm:hidden">
                  {data.costCodes.map((cc) => (
                    <div
                      key={cc.costCodeId}
                      className={cn(
                        "rounded-lg border p-3 space-y-2",
                        cc.isWarning && "border-red-200 dark:border-red-900"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {cc.isWarning && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                          <span className="font-medium text-sm">{cc.costCodeCode}</span>
                        </div>
                        <TrendIcon direction={cc.trendDirection} />
                      </div>
                      <p className="text-xs text-muted-foreground">{cc.costCodeDescription}</p>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground">Budget</p>
                          <p className="font-mono">{formatCurrency(cc.budget)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">EAC</p>
                          <p className={cn("font-mono", cc.isWarning && "text-red-600 dark:text-red-400")}>
                            {formatCurrency(cc.predictedEac)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Variance</p>
                          <p className={cn("font-mono", cc.variance > 0 ? "text-red-600" : "text-green-600")}>
                            {cc.variance > 0 ? "+" : ""}{(cc.variancePercent * 100).toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table view */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cost Code</TableHead>
                        <TableHead className="text-right">Budget</TableHead>
                        <TableHead className="text-right">Actual</TableHead>
                        <TableHead className="text-right">Predicted EAC</TableHead>
                        <TableHead className="text-right">Variance</TableHead>
                        <TableHead className="text-center">Trend</TableHead>
                        <TableHead className="text-right">Burn Rate</TableHead>
                        <TableHead className="text-right">Days Left</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.costCodes.map((cc) => (
                        <TableRow
                          key={cc.costCodeId}
                          className={cn(cc.isWarning && "bg-red-50/50 dark:bg-red-950/10")}
                        >
                          <TableCell>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1.5">
                                    {cc.isWarning && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                                    <span className="font-medium">{cc.costCodeCode}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{cc.costCodeDescription}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Confidence: {(cc.confidence * 100).toFixed(0)}%
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatCurrency(cc.budget)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatCurrency(cc.actualCost)}
                          </TableCell>
                          <TableCell className={cn("text-right font-mono text-sm", cc.isWarning && "text-red-600 dark:text-red-400 font-semibold")}>
                            {formatCurrency(cc.predictedEac)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={cc.variance > 0 ? "destructive" : "default"}
                              className="text-[10px] font-mono"
                            >
                              {cc.variance > 0 ? "+" : ""}
                              {(cc.variancePercent * 100).toFixed(1)}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <TrendIcon direction={cc.trendDirection} />
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatCurrency(cc.dailyBurnRate)}/d
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {cc.daysUntilExhaustion !== null ? (
                              <span className={cn(cc.daysUntilExhaustion < 30 && "text-red-600 dark:text-red-400 font-semibold")}>
                                {cc.daysUntilExhaustion}d
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Refresh Button */}
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">
                Generated {new Date(data.generatedAt).toLocaleString()}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                )}
                Refresh
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
