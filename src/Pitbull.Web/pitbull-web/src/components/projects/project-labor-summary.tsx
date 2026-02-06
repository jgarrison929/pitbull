"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, DollarSign, TrendingUp, ExternalLink } from "lucide-react";
import api from "@/lib/api";

interface LaborCostReport {
  totalCost: number;
  byProject: {
    projectId: string;
    projectName: string;
    projectNumber: string;
    totalCost: number;
    totalRegularHours: number;
    totalOvertimeHours: number;
    totalDoubleTimeHours: number;
    byCostCode: unknown[];
  }[];
}

interface ProjectLaborSummaryProps {
  projectId: string;
}

export function ProjectLaborSummary({ projectId }: ProjectLaborSummaryProps) {
  const [data, setData] = useState<LaborCostReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await api<LaborCostReport>(
          `/api/time-entries/cost-report?projectId=${projectId}&approvedOnly=true`
        );
        setData(response);
      } catch (err) {
        setError("Failed to load labor data");
        console.error("Labor cost fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [projectId]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-16" />
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
          <CardTitle className="text-base">Labor Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const project = data?.byProject?.[0];
  const totalHours = project
    ? project.totalRegularHours +
      project.totalOvertimeHours +
      project.totalDoubleTimeHours
    : 0;
  const totalCost = project?.totalCost ?? 0;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const formatHours = (hours: number) =>
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(hours);

  if (totalHours === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Labor Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No approved time entries yet for this project.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link href={`/time-tracking/new?projectId=${projectId}`}>
              Log Time Entry
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Labor Summary
          </CardTitle>
          <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
            <Link href={`/reports/labor-cost?projectId=${projectId}`}>
              View Details
              <ExternalLink className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Total Hours
            </div>
            <p className="text-2xl font-bold">{formatHours(totalHours)}</p>
            <div className="text-xs text-muted-foreground space-x-2">
              <span>Reg: {formatHours(project?.totalRegularHours ?? 0)}</span>
              {(project?.totalOvertimeHours ?? 0) > 0 && (
                <span className="text-amber-600">
                  OT: {formatHours(project?.totalOvertimeHours ?? 0)}
                </span>
              )}
              {(project?.totalDoubleTimeHours ?? 0) > 0 && (
                <span className="text-red-600">
                  DT: {formatHours(project?.totalDoubleTimeHours ?? 0)}
                </span>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <DollarSign className="h-3 w-3" />
              Labor Cost
            </div>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(totalCost)}
            </p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              <span>
                {formatCurrency(totalHours > 0 ? totalCost / totalHours : 0)}/hr
                avg
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
