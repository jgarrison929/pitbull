"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Database, MemoryStick, RefreshCw, Timer } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useRequireAdmin } from "@/hooks/use-require-admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";

interface HealthDashboard {
  uptime: string;
  uptimeSeconds: number;
  totalRequestsToday: number;
  responseTimes: {
    averageMs: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    recentDurationsMs: number[];
  };
  activeDatabaseConnections: number | null;
  recentErrors: {
    timestampUtc: string;
    level: string;
    message: string;
    exception: string | null;
    traceId: string | null;
    requestPath: string | null;
  }[];
  memory: {
    managedBytes: number;
    heapBytes: number;
    fragmentedBytes: number;
    totalAvailableBytes: number;
    gen0Collections: number;
    gen1Collections: number;
    gen2Collections: number;
  };
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex h-20 items-end gap-1 rounded border bg-muted/30 p-2">
      {(data.length === 0 ? [0] : data).map((value, index) => (
        <div
          key={`${index}-${value}`}
          className="w-1.5 rounded-t bg-sky-500/80"
          style={{ height: `${Math.max((value / max) * 100, 2)}%` }}
          title={`${value.toFixed(1)} ms`}
        />
      ))}
    </div>
  );
}

export default function AdminHealthDashboardPage() {
  const { isAdmin } = useRequireAdmin();
  const [dashboard, setDashboard] = useState<HealthDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api<HealthDashboard>("/api/admin/health-dashboard");
      setDashboard(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load health dashboard");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      void load();
    }, 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  const responseSeries = useMemo(() => dashboard?.responseTimes.recentDurationsMs ?? [], [dashboard]);

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Admin" }, { label: "Health Dashboard" }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Health Dashboard</h1>
          <p className="text-muted-foreground">Auto-refreshes every 30 seconds.</p>
        </div>
        <Button variant="outline" onClick={load} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Timer} label="Uptime" value={dashboard?.uptime ?? "—"} />
        <MetricCard icon={Activity} label="Requests Today" value={(dashboard?.totalRequestsToday ?? 0).toLocaleString()} />
        <MetricCard icon={Database} label="Active DB Connections" value={dashboard?.activeDatabaseConnections?.toString() ?? "—"} />
        <MetricCard icon={MemoryStick} label="Managed Memory" value={dashboard ? formatBytes(dashboard.memory.managedBytes) : "—"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Response Times</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Average" value={`${dashboard?.responseTimes.averageMs.toFixed(1) ?? "0.0"} ms`} />
            <Stat label="P50" value={`${dashboard?.responseTimes.p50Ms.toFixed(1) ?? "0.0"} ms`} />
            <Stat label="P95" value={`${dashboard?.responseTimes.p95Ms.toFixed(1) ?? "0.0"} ms`} />
            <Stat label="P99" value={`${dashboard?.responseTimes.p99Ms.toFixed(1) ?? "0.0"} ms`} />
          </div>
          <Sparkline data={responseSeries} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Errors</CardTitle>
        </CardHeader>
        <CardContent>
          {dashboard?.recentErrors.length ? (
            <div className="space-y-2">
              {dashboard.recentErrors.map((error, index) => (
                <div key={`${error.timestampUtc}-${index}`} className="rounded border p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge variant="destructive">{error.level}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(error.timestampUtc).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm">{error.message}</p>
                  {error.requestPath && (
                    <p className="mt-1 text-xs text-muted-foreground">Path: {error.requestPath}</p>
                  )}
                  {error.traceId && (
                    <p className="text-xs text-muted-foreground">Trace: {error.traceId}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              No recent errors captured.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="rounded bg-muted p-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-xl font-semibold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-muted/20 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
