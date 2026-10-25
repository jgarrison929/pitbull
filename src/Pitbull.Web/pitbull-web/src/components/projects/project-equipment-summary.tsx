"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Wrench, ExternalLink } from "lucide-react";
import api from "@/lib/api";
import type { TimeEntry } from "@/lib/types";

interface EquipmentHoursSummary {
  equipmentId: string;
  equipmentName: string;
  equipmentCode: string;
  totalHours: number;
}

interface ProjectEquipmentSummaryProps {
  projectId: string;
}

export function ProjectEquipmentSummary({
  projectId,
}: ProjectEquipmentSummaryProps) {
  const [summaries, setSummaries] = useState<EquipmentHoursSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalHours, setTotalHours] = useState(0);

  useEffect(() => {
    async function fetchData() {
      try {
        const result = await api<{ items: TimeEntry[] }>(
          `/api/time-entries?projectId=${projectId}&pageSize=500`
        );

        // Aggregate equipment hours
        const equipmentMap = new Map<
          string,
          { name: string; code: string; hours: number }
        >();

        let total = 0;
        for (const entry of result.items) {
          if (!entry.equipmentId || entry.equipmentHours <= 0) continue;
          total += entry.equipmentHours;

          if (!equipmentMap.has(entry.equipmentId)) {
            equipmentMap.set(entry.equipmentId, {
              name: entry.equipmentName ?? "Unknown",
              code: entry.equipmentCode ?? "",
              hours: 0,
            });
          }
          equipmentMap.get(entry.equipmentId)!.hours += entry.equipmentHours;
        }

        const sorted = Array.from(equipmentMap.entries())
          .map(([id, data]) => ({
            equipmentId: id,
            equipmentName: data.name,
            equipmentCode: data.code,
            totalHours: data.hours,
          }))
          .sort((a, b) => b.totalHours - a.totalHours);

        setSummaries(sorted);
        setTotalHours(total);
      } catch {
        // Silently handle
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [projectId]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (summaries.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="h-4 w-4 text-orange-500" />
            Equipment Hours
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No equipment hours logged for this project yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="h-4 w-4 text-orange-500" />
            Equipment Hours
          </CardTitle>
          <Link
            href="/reports/equipment"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            Full Report
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold">{totalHours.toFixed(1)}</span>
          <span className="text-sm text-muted-foreground">total equipment hours</span>
        </div>

        <div className="space-y-2">
          {summaries.map((s) => {
            const percent =
              totalHours > 0 ? (s.totalHours / totalHours) * 100 : 0;
            return (
              <div key={s.equipmentId} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs text-muted-foreground">
                      {s.equipmentCode}
                    </span>
                    <span className="truncate">{s.equipmentName}</span>
                  </div>
                  <span className="font-medium shrink-0 ml-2">
                    {s.totalHours.toFixed(1)}h
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-500 rounded-full transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
