"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Layers, CheckCircle, Clock, AlertCircle } from "lucide-react";
import api from "@/lib/api";
import type { Phase } from "@/lib/types";
import { PhaseStatus } from "@/lib/types";

interface ProjectPhasesTableProps {
  projectId: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function phaseStatusLabel(status: PhaseStatus): string {
  switch (status) {
    case PhaseStatus.NotStarted:
      return "Not Started";
    case PhaseStatus.InProgress:
      return "In Progress";
    case PhaseStatus.Completed:
      return "Completed";
    case PhaseStatus.OnHold:
      return "On Hold";
    default:
      return "Unknown";
  }
}

function phaseStatusBadgeClass(status: PhaseStatus): string {
  switch (status) {
    case PhaseStatus.NotStarted:
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    case PhaseStatus.InProgress:
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case PhaseStatus.Completed:
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case PhaseStatus.OnHold:
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    default:
      return "";
  }
}

function phaseStatusIcon(status: PhaseStatus) {
  switch (status) {
    case PhaseStatus.Completed:
      return <CheckCircle className="h-3.5 w-3.5 text-green-600" />;
    case PhaseStatus.InProgress:
      return <Clock className="h-3.5 w-3.5 text-blue-500" />;
    case PhaseStatus.OnHold:
      return <AlertCircle className="h-3.5 w-3.5 text-amber-500" />;
    default:
      return null;
  }
}

export function ProjectPhasesTable({ projectId }: ProjectPhasesTableProps) {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPhases() {
      try {
        const data = await api<Phase[]>(`/api/projects/${projectId}/phases`);
        setPhases(data.sort((a, b) => a.sortOrder - b.sortOrder));
      } catch {
        setError("Failed to load phases");
      } finally {
        setIsLoading(false);
      }
    }
    fetchPhases();
  }, [projectId]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
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
            <Layers className="h-4 w-4" />
            Project Phases
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (phases.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Project Phases
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No phases defined for this project yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalBudget = phases.reduce((sum, p) => sum + p.budgetAmount, 0);
  const totalActual = phases.reduce((sum, p) => sum + p.actualCost, 0);
  const overallProgress =
    phases.length > 0
      ? phases.reduce((sum, p) => sum + p.percentComplete, 0) / phases.length
      : 0;
  const budgetVariance = totalBudget - totalActual;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Project Phases
          </CardTitle>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              Overall: <span className="font-semibold text-foreground">{Math.round(overallProgress)}%</span>
            </span>
            <span
              className={`font-medium ${budgetVariance >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {budgetVariance >= 0 ? "Under" : "Over"} by{" "}
              {formatCurrency(Math.abs(budgetVariance))}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Desktop Table */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Phase</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Budget</TableHead>
                <TableHead className="text-right">Actual Cost</TableHead>
                <TableHead className="text-right">Variance</TableHead>
                <TableHead className="w-[200px]">Progress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {phases.map((phase) => {
                const variance = phase.budgetAmount - phase.actualCost;
                return (
                  <TableRow key={phase.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{phase.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {phase.costCode}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`text-xs ${phaseStatusBadgeClass(phase.status)}`}
                      >
                        <span className="flex items-center gap-1">
                          {phaseStatusIcon(phase.status)}
                          {phaseStatusLabel(phase.status)}
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(phase.budgetAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(phase.actualCost)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${variance >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {variance >= 0 ? "+" : ""}
                      {formatCurrency(variance)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={phase.percentComplete}
                          className="h-2 flex-1"
                        />
                        <span className="text-xs font-medium w-10 text-right">
                          {Math.round(phase.percentComplete)}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {/* Totals */}
              <TableRow className="bg-muted font-semibold">
                <TableCell>
                  Total ({phases.length} phases)
                </TableCell>
                <TableCell />
                <TableCell className="text-right">
                  {formatCurrency(totalBudget)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(totalActual)}
                </TableCell>
                <TableCell
                  className={`text-right ${budgetVariance >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {budgetVariance >= 0 ? "+" : ""}
                  {formatCurrency(budgetVariance)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress
                      value={overallProgress}
                      className="h-2 flex-1"
                    />
                    <span className="text-xs font-medium w-10 text-right">
                      {Math.round(overallProgress)}%
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-3">
          {phases.map((phase) => {
            const variance = phase.budgetAmount - phase.actualCost;
            return (
              <div
                key={phase.id}
                className="rounded-lg border p-3 space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">{phase.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {phase.costCode}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] ${phaseStatusBadgeClass(phase.status)}`}
                  >
                    {phaseStatusLabel(phase.status)}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={phase.percentComplete} className="h-2 flex-1" />
                  <span className="text-xs font-medium">
                    {Math.round(phase.percentComplete)}%
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Budget</p>
                    <p className="font-medium">{formatCurrency(phase.budgetAmount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Actual</p>
                    <p className="font-medium">{formatCurrency(phase.actualCost)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Variance</p>
                    <p
                      className={`font-medium ${variance >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {variance >= 0 ? "+" : ""}
                      {formatCurrency(variance)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
