"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import {
  Activity, Database, Users, Briefcase, FileText, HardHat, Clock, Key, RefreshCw,
} from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

interface SystemHealth {
  status: string;
  database: {
    connected: boolean;
    version: string | null;
    databaseSizeBytes: number | null;
    activeConnections: number | null;
    error: string | null;
  };
  stats: {
    totalUsers: number;
    activeUsers: number;
    totalProjects: number;
    totalBids: number;
    totalSubcontracts: number;
    totalTimeEntries: number;
    apiKeysActive: number;
  };
  checkedAt: string;
}

function formatBytes(bytes: number | null) {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function SystemHealthPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api<SystemHealth>("/api/admin/system-health");
      setHealth(res);
    } catch {
      toast.error("Failed to load system health");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  const statusColor = health?.status === "Healthy"
    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Admin" }, { label: "System Health" }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Health</h1>
          <p className="text-muted-foreground">
            {health ? `Last checked: ${new Date(health.checkedAt).toLocaleString()}` : "Loading..."}
          </p>
        </div>
        <Button variant="outline" onClick={fetchHealth} disabled={isLoading} className="min-h-[44px]">
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {health && (
        <>
          {/* Overall Status */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <Activity className="h-5 w-5" />
                <CardTitle className="text-base">Overall Status</CardTitle>
                <Badge className={statusColor}>{health.status}</Badge>
              </div>
            </CardHeader>
          </Card>

          {/* Database Health */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-4 w-4" />
                Database
              </CardTitle>
              <CardDescription>PostgreSQL connection and statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Connection</p>
                  <p className="text-lg font-semibold">
                    {health.database.connected ? (
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">Connected</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">Disconnected</Badge>
                    )}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Database Size</p>
                  <p className="text-lg font-semibold font-mono">{formatBytes(health.database.databaseSizeBytes)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Active Connections</p>
                  <p className="text-lg font-semibold font-mono">{health.database.activeConnections ?? "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Version</p>
                  <p className="text-sm text-muted-foreground truncate" title={health.database.version || ""}>
                    {health.database.version?.split(" ").slice(0, 2).join(" ") || "—"}
                  </p>
                </div>
              </div>
              {health.database.error && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/10 rounded-md text-sm text-red-700 dark:text-red-300">
                  {health.database.error}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Entity Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Users} label="Total Users" value={health.stats.totalUsers} sub={`${health.stats.activeUsers} active`} />
            <StatCard icon={Briefcase} label="Projects" value={health.stats.totalProjects} />
            <StatCard icon={FileText} label="Bids" value={health.stats.totalBids} />
            <StatCard icon={HardHat} label="Subcontracts" value={health.stats.totalSubcontracts} />
            <StatCard icon={Clock} label="Time Entries" value={health.stats.totalTimeEntries} />
            <StatCard icon={Key} label="Active API Keys" value={health.stats.apiKeysActive} />
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub }: {
  icon: React.ElementType;
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-muted rounded-md">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold font-mono">{value.toLocaleString()}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
