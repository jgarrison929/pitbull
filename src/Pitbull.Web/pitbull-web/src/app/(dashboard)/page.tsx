"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
              {state.isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{stat.value}</div>
              )}
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
            {state.isLoading ? (
              <div className="flex items-start gap-3 text-sm">
                <Skeleton className="mt-1 h-2 w-2 rounded-full shrink-0" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-full max-w-md" />
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 text-sm">
                <div className="mt-1 h-2 w-2 rounded-full bg-green-500 shrink-0" />
                <div className="flex-1">
                  <p className="text-muted-foreground">
                    {state.stats ? (
                      <>Last activity: {new Date(state.stats.lastActivityDate).toLocaleDateString()}</>
                    ) : (
                      "Activity feed coming soon — connect more modules to see updates here."
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
