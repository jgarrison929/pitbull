"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import api from "@/lib/api";
import type { PaginatedResult, Project, Bid } from "@/lib/types";
import { toast } from "sonner";

interface DashboardStats {
  activeProjects: number;
  openBids: number;
  isLoading: boolean;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    activeProjects: 0,
    openBids: 0,
    isLoading: true,
  });

  useEffect(() => {
    async function fetchStats() {
      try {
        const [projectsRes, bidsRes] = await Promise.all([
          api<PaginatedResult<Project>>("/api/projects?pageSize=1"),
          api<PaginatedResult<Bid>>("/api/bids?pageSize=1"),
        ]);
        setStats({
          activeProjects: projectsRes.totalCount,
          openBids: bidsRes.totalCount,
          isLoading: false,
        });
      } catch {
        toast.error("Failed to load dashboard data");
        setStats((s) => ({ ...s, isLoading: false }));
      }
    }
    fetchStats();
  }, []);

  const statCards = [
    {
      title: "Active Projects",
      value: stats.activeProjects.toString(),
      icon: "🏗️",
    },
    {
      title: "Open Bids",
      value: stats.openBids.toString(),
      icon: "📋",
    },
    {
      title: "Pending Change Orders",
      value: "—",
      icon: "📝",
    },
    {
      title: "Monthly Revenue",
      value: "—",
      icon: "💰",
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
              {stats.isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{stat.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { text: "Activity feed coming soon — connect more modules to see updates here.", time: "" },
            ].map((activity, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <div className="mt-1 h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                <div className="flex-1">
                  <p className="text-muted-foreground">{activity.text}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
