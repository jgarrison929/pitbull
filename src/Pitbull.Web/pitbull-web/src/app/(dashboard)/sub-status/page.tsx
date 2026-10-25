"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import type { PagedResult, Subcontract } from "@/lib/types";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { buildSubStatusItems, type SubStatusItem } from "@/lib/site-walk";
import { Users } from "lucide-react";

function healthBadge(health: SubStatusItem["health"]) {
  switch (health) {
    case "on_track":
      return <Badge className="bg-emerald-600 text-white">On track</Badge>;
    case "at_risk":
      return <Badge className="bg-amber-500 text-white">At risk</Badge>;
    case "delayed":
      return <Badge variant="destructive">Delayed</Badge>;
  }
}

function SubStatusContent() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SubStatusItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await api<PagedResult<Subcontract>>(
          "/api/subcontracts?pageSize=100"
        );
        if (cancelled) return;
        setItems(
          buildSubStatusItems(
            (result.items ?? []).map((s) => ({
              id: s.id,
              subcontractorName: s.subcontractorName,
              tradeCode: s.tradeCode,
              status: String(s.status),
              updatedAt: s.updatedAt,
              createdAt: s.createdAt,
              insuranceCurrent: s.insuranceCurrent,
            }))
          )
        );
      } catch (error) {
        toast.error("Failed to load sub status", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Users className="h-6 w-6 text-amber-500" />
          Sub status
        </h1>
        <p className="text-muted-foreground text-sm">
          Portfolio at-a-glance — status, last update, insurance risk.
        </p>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No subcontracts found.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2" data-testid="sub-status-list">
          {items.map((sub) => (
            <Card key={sub.id}>
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-snug">{sub.name}</CardTitle>
                  {healthBadge(sub.health)}
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 text-xs text-muted-foreground space-y-1">
                <p>
                  {sub.trade || "Trade n/a"} · {sub.status}
                  {sub.openIssuesCount > 0
                    ? ` · ${sub.openIssuesCount} open issues`
                    : ""}
                </p>
                {sub.lastUpdate && (
                  <p>Last update {new Date(sub.lastUpdate).toLocaleDateString()}</p>
                )}
                <Link
                  href="/contracts"
                  className="text-amber-700 underline inline-block min-h-[32px] pt-1"
                >
                  Open contracts
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SubStatusPage() {
  return (
    <ErrorBoundary label="sub status">
      <SubStatusContent />
    </ErrorBoundary>
  );
}
