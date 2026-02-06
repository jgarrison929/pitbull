"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  DollarSign,
  TrendingUp,
  ExternalLink,
  Users,
  Calendar,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import api from "@/lib/api";

interface ProjectStats {
  projectId: string;
  projectName: string;
  projectNumber: string;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  doubleTimeHours: number;
  totalLaborCost: number;
  timeEntryCount: number;
  approvedEntryCount: number;
  pendingEntryCount: number;
  assignedEmployeeCount: number;
  firstEntryDate: string | null;
  lastEntryDate: string | null;
}

interface ProjectLaborSummaryProps {
  projectId: string;
}

export function ProjectLaborSummary({ projectId }: ProjectLaborSummaryProps) {
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await api<ProjectStats>(
          `/api/projects/${projectId}/stats`
        );
        setStats(response);
      } catch (err) {
        setError("Failed to load project stats");
        console.error("Project stats fetch error:", err);
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
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

  if (!stats || stats.totalHours === 0) {
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
            No time entries recorded for this project yet.
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

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

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
              Full Report
              <ExternalLink className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          {/* Total Hours */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Total Hours
            </div>
            <p className="text-2xl font-bold">{formatHours(stats.totalHours)}</p>
            <div className="text-[10px] text-muted-foreground space-x-1">
              <span>R: {formatHours(stats.regularHours)}</span>
              {stats.overtimeHours > 0 && (
                <span className="text-amber-600">
                  OT: {formatHours(stats.overtimeHours)}
                </span>
              )}
              {stats.doubleTimeHours > 0 && (
                <span className="text-red-600">
                  DT: {formatHours(stats.doubleTimeHours)}
                </span>
              )}
            </div>
          </div>

          {/* Labor Cost */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <DollarSign className="h-3 w-3" />
              Labor Cost
            </div>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(stats.totalLaborCost)}
            </p>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              {formatCurrency(
                stats.totalHours > 0 ? stats.totalLaborCost / stats.totalHours : 0
              )}
              /hr
            </div>
          </div>

          {/* Employees */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              Employees
            </div>
            <p className="text-2xl font-bold">{stats.assignedEmployeeCount}</p>
            <p className="text-[10px] text-muted-foreground">assigned</p>
          </div>

          {/* Time Entries */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              Entries
            </div>
            <p className="text-2xl font-bold">{stats.timeEntryCount}</p>
            <div className="flex gap-1">
              {stats.pendingEntryCount > 0 && (
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1 py-0 bg-amber-100 text-amber-800"
                >
                  <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
                  {stats.pendingEntryCount}
                </Badge>
              )}
              {stats.approvedEntryCount > 0 && (
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1 py-0 bg-green-100 text-green-800"
                >
                  <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
                  {stats.approvedEntryCount}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Date Range */}
        {stats.firstEntryDate && (
          <div className="pt-3 border-t text-xs text-muted-foreground">
            <span>Activity: </span>
            <span className="font-medium text-foreground">
              {formatDate(stats.firstEntryDate)}
            </span>
            <span> — </span>
            <span className="font-medium text-foreground">
              {formatDate(stats.lastEntryDate)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
