"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { HeartPulse } from "lucide-react";
import api from "@/lib/api";
import { useCompany } from "@/contexts/company-context";
import { toast } from "sonner";

interface SafetyIncident {
  id: string;
  projectId?: string | null;
  projectName: string;
  projectNumber: string;
  reportDate?: string | null;
  incidentType: string;
  severity: string;
  description: string;
  createdAtUtc: string;
}

export default function SafetyReportPage() {
  const { activeCompany } = useCompany();
  const searchParams = useSearchParams();
  const period = searchParams.get("period") ?? "ytd";
  const [items, setItems] = useState<SafetyIncident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await api<SafetyIncident[]>(
          "/api/dashboard/safety-incidents"
        );
        if (!cancelled) setItems(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) {
          toast.error("Failed to load safety incidents");
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeCompany?.id, period]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Safety incidents</h1>
        <p className="text-muted-foreground">
          Daily-report safety incidents year-to-date — the set behind the executive Safety KPI.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            {period.toUpperCase()} · {items.length} incident
            {items.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton headers={["Project", "Type", "Severity", "When", "Description"]} rows={5} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={HeartPulse}
              title="No safety incidents this year"
              description="When field crews log incidents on daily reports, they appear here for executive review."
            />
          ) : (
            <div className="space-y-3">
              {items.map((inc) => (
                <div
                  key={inc.id}
                  className="rounded-md border p-3 flex flex-col sm:flex-row sm:items-start gap-2 justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    {inc.projectId ? (
                      <Link
                        href={`/projects/${inc.projectId}/daily-reports`}
                        className="font-medium text-amber-700 hover:underline text-sm"
                      >
                        {inc.projectNumber || inc.projectName || "Project"}
                      </Link>
                    ) : (
                      <p className="font-medium text-sm">{inc.projectName || "Unknown project"}</p>
                    )}
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {inc.description || "—"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Badge variant="secondary">{inc.incidentType}</Badge>
                    <Badge
                      className={
                        inc.severity.toLowerCase().includes("high") ||
                        inc.severity.toLowerCase().includes("critical")
                          ? "bg-red-100 text-red-800"
                          : "bg-amber-100 text-amber-900"
                      }
                    >
                      {inc.severity}
                    </Badge>
                    <span className="text-xs text-muted-foreground self-center">
                      {inc.reportDate
                        ? new Date(inc.reportDate).toLocaleDateString()
                        : new Date(inc.createdAtUtc).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
