"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Wrench, Clock, ExternalLink } from "lucide-react";
import api from "@/lib/api";
import type { Equipment, TimeEntry } from "@/lib/types";

interface EquipmentUtilizationData {
  totalEquipment: number;
  activeEquipment: number;
  hoursThisWeek: number;
  hoursThisMonth: number;
}

function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day;
  const start = new Date(now.setDate(diff));
  return start.toISOString().split("T")[0];
}

function getMonthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
}

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

export function EquipmentUtilizationWidget() {
  const [data, setData] = useState<EquipmentUtilizationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [equipmentResult, weekEntries, monthEntries] = await Promise.all([
          api<{ items: Equipment[]; totalCount: number }>("/api/equipment?pageSize=200"),
          api<{ items: TimeEntry[] }>(
            `/api/time-entries?startDate=${getWeekStart()}&endDate=${getToday()}&pageSize=500`
          ),
          api<{ items: TimeEntry[] }>(
            `/api/time-entries?startDate=${getMonthStart()}&endDate=${getToday()}&pageSize=500`
          ),
        ]);

        const activeCount = equipmentResult.items.filter((e) => e.isActive).length;

        const weekHours = weekEntries.items.reduce(
          (sum, entry) => sum + (entry.equipmentHours || 0),
          0
        );
        const monthHours = monthEntries.items.reduce(
          (sum, entry) => sum + (entry.equipmentHours || 0),
          0
        );

        setData({
          totalEquipment: equipmentResult.totalCount,
          activeEquipment: activeCount,
          hoursThisWeek: weekHours,
          hoursThisMonth: monthHours,
        });
      } catch {
        // Silently handle - widget will show fallback
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Equipment Utilization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Unable to load equipment data</p>
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
            Equipment
          </CardTitle>
          <Link
            href="/reports/equipment"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            Details
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">{data.activeEquipment}</span>
          <span className="text-sm text-muted-foreground">
            / {data.totalEquipment} active
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted/50 p-2.5">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <Clock className="h-3 w-3" />
              This Week
            </div>
            <p className="text-lg font-semibold">{data.hoursThisWeek.toFixed(1)}h</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2.5">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <Clock className="h-3 w-3" />
              This Month
            </div>
            <p className="text-lg font-semibold">{data.hoursThisMonth.toFixed(1)}h</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
