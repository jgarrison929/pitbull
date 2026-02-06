"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { DashboardStatsSkeleton, DashboardActivitySkeleton } from "@/components/skeletons";
import {
  LayoutDashboard,
  HardHat,
  FileText,
  Users,
  Clock,
  Plus,
  ArrowRight,
  TrendingUp,
  CheckCircle,
} from "lucide-react";
import { GettingStarted } from "@/components/ui/getting-started";
import { WeeklyHoursChart } from "@/components/dashboard/weekly-hours-chart";
import api from "@/lib/api";
import type { DashboardStats, RecentActivityItem } from "@/lib/types";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";

interface DashboardState {
  stats: DashboardStats | null;
  isLoading: boolean;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [state, setState] = useState<DashboardState>({
    stats: null,
    isLoading: true,
  });

  useEffect(() => {
    async function fetchStats() {
      try {
        const stats = await api<DashboardStats>("/api/dashboard/stats");
        setState({
          stats,
          isLoading: false,
        });
      } catch {
        toast.error("Failed to load dashboard data");
        setState((s) => ({ ...s, isLoading: false }));
      }
    }
    fetchStats();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const hasNoData =
    state.stats !== null &&
    state.stats.projectCount === 0 &&
    state.stats.bidCount === 0;

  const statCards = [
    {
      title: "Active Projects",
      value: state.stats ? state.stats.projectCount.toString() : "—",
      icon: HardHat,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      href: "/projects",
    },
    {
      title: "Open Bids",
      value: state.stats ? state.stats.bidCount.toString() : "—",
      icon: FileText,
      color: "text-green-600",
      bgColor: "bg-green-50",
      href: "/bids",
    },
    {
      title: "Team Members",
      value: state.stats ? state.stats.employeeCount.toString() : "—",
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      href: "/employees",
    },
    {
      title: "Pending Approvals",
      value: state.stats ? state.stats.pendingTimeApprovals.toString() : "—",
      icon: Clock,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      href: "/time-tracking/approval",
    },
  ];

  const quickActions = [
    {
      title: "New Project",
      description: "Start tracking a project",
      href: "/projects/new",
      icon: HardHat,
      color: "text-blue-600",
    },
    {
      title: "New Bid",
      description: "Create an estimate",
      href: "/bids/new",
      icon: FileText,
      color: "text-green-600",
    },
    {
      title: "Add Employee",
      description: "Grow your team",
      href: "/employees/new",
      icon: Users,
      color: "text-purple-600",
    },
    {
      title: "Log Time",
      description: "Record work hours",
      href: "/time-tracking/new",
      icon: Clock,
      color: "text-amber-600",
    },
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "project":
        return <HardHat className="h-4 w-4 text-blue-600" />;
      case "bid":
        return <FileText className="h-4 w-4 text-green-600" />;
      case "employee":
        return <Users className="h-4 w-4 text-purple-600" />;
      case "timeentry":
        return <Clock className="h-4 w-4 text-amber-600" />;
      default:
        return <CheckCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActivityLink = (item: RecentActivityItem) => {
    switch (item.type) {
      case "project":
        return `/projects/${item.id}`;
      case "bid":
        return `/bids/${item.id}`;
      case "employee":
        return `/employees/${item.id}`;
      default:
        return "#";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {user ? `Welcome back, ${user.name.split(" ")[0]}` : "Dashboard"}
          </h1>
          <p className="text-muted-foreground">
            Here&apos;s what&apos;s happening with your projects today.
          </p>
        </div>
        {state.stats && state.stats.totalProjectValue > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <span className="text-muted-foreground">Portfolio Value:</span>
            <span className="font-semibold">
              {formatCurrency(state.stats.totalProjectValue)}
            </span>
          </div>
        )}
      </div>

      {/* Getting Started Checklist - shows for new users until dismissed */}
      {!state.isLoading && <GettingStarted stats={state.stats} />}

      {state.isLoading ? (
        <>
          <DashboardStatsSkeleton />
          <DashboardActivitySkeleton />
        </>
      ) : hasNoData ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={LayoutDashboard}
              title="Welcome to Pitbull"
              description="Your dashboard will light up once you start adding projects and bids. Let's get building."
            />
            <div className="grid gap-4 sm:grid-cols-2 px-6 pb-8">
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center py-6 text-center">
                  <HardHat className="h-8 w-8 text-amber-500 mb-3" />
                  <h4 className="font-semibold mb-1">Start a Project</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Track scope, budgets, and timelines
                  </p>
                  <Button
                    asChild
                    className="bg-amber-500 hover:bg-amber-600 text-white min-h-[44px]"
                  >
                    <Link href="/projects/new">+ New Project</Link>
                  </Button>
                </CardContent>
              </Card>
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center py-6 text-center">
                  <FileText className="h-8 w-8 text-amber-500 mb-3" />
                  <h4 className="font-semibold mb-1">Create a Bid</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Estimate jobs and win more work
                  </p>
                  <Button
                    asChild
                    className="bg-amber-500 hover:bg-amber-600 text-white min-h-[44px]"
                  >
                    <Link href="/bids/new">+ New Bid</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((stat) => (
              <Link key={stat.title} href={stat.href}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </CardTitle>
                    <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                      <stat.icon className={`h-4 w-4 ${stat.color}`} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Quick Actions + Activity Feed */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Quick Actions */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {quickActions.map((action) => (
                  <Link key={action.title} href={action.href}>
                    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer group">
                      <div className={`${action.color}`}>
                        <action.icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{action.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {action.description}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {state.stats?.recentActivity &&
                state.stats.recentActivity.length > 0 ? (
                  <div className="space-y-4">
                    {state.stats.recentActivity.map((item, index) => (
                      <Link
                        key={`${item.type}-${item.id}-${index}`}
                        href={getActivityLink(item)}
                      >
                        <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer">
                          <div className="mt-0.5 p-1.5 rounded-full bg-muted">
                            {getActivityIcon(item.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {item.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.description}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatTimeAgo(item.timestamp)}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">
                      No recent activity yet. Start by creating a project or
                      bid!
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Weekly Hours Chart */}
          <WeeklyHoursChart />

          {/* Portfolio Summary */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Project Value
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(state.stats?.totalProjectValue ?? 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Across {state.stats?.projectCount ?? 0} active projects
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Bid Pipeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(state.stats?.totalBidValue ?? 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Across {state.stats?.bidCount ?? 0} open bids
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
