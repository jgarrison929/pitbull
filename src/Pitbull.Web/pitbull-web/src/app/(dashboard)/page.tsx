"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { DashboardStatsSkeleton, DashboardActivitySkeleton } from "@/components/skeletons";
import { LayoutDashboard, HardHat, FileText } from "lucide-react";
import api from "@/lib/api";
import type { DashboardStats } from "@/lib/types";
import { toast } from "sonner";

interface DashboardState {
  stats: DashboardStats | null;
  isLoading: boolean;
}

export default function DashboardPage() {
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
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const hasNoData =
    state.stats !== null &&
    state.stats.projectCount === 0 &&
    state.stats.bidCount === 0;

  const statCards = [
    {
      title: "Active Projects",
      value: state.stats ? state.stats.projectCount.toString() : "—",
      icon: "🏗️",
    },
    {
      title: "Open Bids",
      value: state.stats ? state.stats.bidCount.toString() : "—",
      icon: "📋",
    },
    {
      title: "Total Project Value",
      value: state.stats ? formatCurrency(state.stats.totalProjectValue) : "—",
      icon: "💰",
    },
    {
      title: "Total Bid Value",
      value: state.stats ? formatCurrency(state.stats.totalBidValue) : "—",
      icon: "📋",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back. Here&apos;s your project overview.
        </p>
      </div>

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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((stat) => (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <span className="text-xl">{stat.icon}</span>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3 text-sm">
                  <div className="mt-1 h-2 w-2 rounded-full bg-green-500 shrink-0" />
                  <div className="flex-1">
                    <p className="text-muted-foreground">
                      {state.stats ? (
                        <>Last activity: {new Date(state.stats.lastActivityDate).toLocaleDateString()}</>
                      ) : (
                        "Activity feed coming soon - connect more modules to see updates here."
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
