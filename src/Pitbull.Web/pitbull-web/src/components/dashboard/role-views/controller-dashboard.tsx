"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  BookOpen,
  FileText,
  BarChart3,
  Scale,
} from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import { useCompany } from "@/contexts/company-context";
import { roleKpiDrillHref } from "@/lib/role-kpi-drills";

interface DashboardAnalytics {
  activeProjects: number;
  totalEmployees: number;
  hoursThisWeek: number;
  hoursLastWeek: number;
  pendingApprovals: number;
  openRFIs: number;
  upcomingDeadlines: { date: string; projectName: string; milestone: string; daysRemaining: number }[];
  recentActivity: { user: string; action: string; entity: string; timestamp: string; description?: string | null }[];
  projectBudgetHealth: { name: string; budget: number; spent: number; percentUsed: number }[];
  laborHoursTrend: { weekStart: string; totalHours: number }[];
}

interface RoleSummary {
  arTotal: number;
  arOverdue: number;
  apTotal: number;
  apDueNearTerm: number;
  arApNetPosition: number;
  arApNetPositionLabel: string;
  billedToDate: number;
  unbilledContractValue: number;
  portfolioContractValue: number;
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(v);
}

export function ControllerDashboard({
  data,
  isLoading,
}: {
  data: DashboardAnalytics | null;
  isLoading: boolean;
}) {
  const { activeCompany } = useCompany();
  const [summary, setSummary] = useState<RoleSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSummaryLoading(true);
      try {
        const result = await api<RoleSummary>("/api/dashboard/role-summary");
        if (!cancelled) setSummary(result);
      } catch {
        if (!cancelled) setSummary(null);
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeCompany?.id]);

  const loading = isLoading || summaryLoading;
  const budgetAlerts =
    data?.projectBudgetHealth.filter((p) => p.percentUsed >= 90).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link href={roleKpiDrillHref("arTotal")} className="group">
          <Card className="transition-colors group-hover:border-amber-500/50 group-hover:shadow-md cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Accounts Receivable</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {formatCurrency(summary?.arTotal ?? 0)}
                  </div>
                  <Badge
                    variant={
                      (summary?.arOverdue ?? 0) > 0 ? "destructive" : "secondary"
                    }
                    className="mt-1 text-xs"
                  >
                    Overdue 31+: {formatCurrency(summary?.arOverdue ?? 0)}
                  </Badge>
                </>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link href={roleKpiDrillHref("apTotal")} className="group">
          <Card className="transition-colors group-hover:border-amber-500/50 group-hover:shadow-md cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Accounts Payable</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {formatCurrency(summary?.apTotal ?? 0)}
                  </div>
                  <Badge variant="secondary" className="mt-1 text-xs">
                    Due near-term: {formatCurrency(summary?.apDueNearTerm ?? 0)}
                  </Badge>
                </>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link href={roleKpiDrillHref("arApNet")} className="group">
          <Card className="transition-colors group-hover:border-amber-500/50 group-hover:shadow-md cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">AR − AP Net</CardTitle>
              <Scale className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div
                    className={`text-2xl font-bold ${
                      (summary?.arApNetPosition ?? 0) < 0 ? "text-red-600" : ""
                    }`}
                  >
                    {formatCurrency(summary?.arApNetPosition ?? 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {summary?.arApNetPositionLabel ?? "From aging report (not bank cash)"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link href={roleKpiDrillHref("budgetAlertStrict")} className="group">
          <Card className="transition-colors group-hover:border-amber-500/50 group-hover:shadow-md cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Budget Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{budgetAlerts}</div>
                  {budgetAlerts > 0 && (
                    <Badge className="mt-1 bg-red-100 text-red-800">
                      Labor ≥90% of contract
                    </Badge>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Labor proxy — not full job cost
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Owner billing progress</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <Link href={roleKpiDrillHref("billedToDate")} className="hover:opacity-80">
                  <p className="text-xs text-muted-foreground">Billed to date</p>
                  <p className="text-xl font-bold">
                    {formatCurrency(summary?.billedToDate ?? 0)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">View progress apps →</p>
                </Link>
                <Link href={roleKpiDrillHref("unbilledBacklog")} className="hover:opacity-80">
                  <p className="text-xs text-muted-foreground">Unbilled contract</p>
                  <p className="text-xl font-bold">
                    {formatCurrency(summary?.unbilledContractValue ?? 0)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Projects with backlog →</p>
                </Link>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">
                    Portfolio contract value{" "}
                    {formatCurrency(summary?.portfolioContractValue ?? 0)}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Quick actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 grid-cols-2">
              <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 min-h-[44px]">
                <Link href="/accounting/journal-entries">
                  <BookOpen className="h-5 w-5 text-blue-600" />
                  <span className="text-sm font-medium">Journal Entry</span>
                </Link>
              </Button>
              <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 min-h-[44px]">
                <Link href="/accounting/wip">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium">Run WIP</span>
                </Link>
              </Button>
              <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 min-h-[44px]">
                <Link href="/billing/aging">
                  <BarChart3 className="h-5 w-5 text-amber-600" />
                  <span className="text-sm font-medium">AR Aging</span>
                </Link>
              </Button>
              <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 min-h-[44px]">
                <Link href="/accounting/income-statement">
                  <FileText className="h-5 w-5 text-purple-600" />
                  <span className="text-sm font-medium">P&amp;L</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
