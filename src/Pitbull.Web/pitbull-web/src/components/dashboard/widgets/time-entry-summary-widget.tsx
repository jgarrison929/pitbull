"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface LaborTrendPoint {
  weekStart: string;
  totalHours: number;
}

function formatWeekLabel(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function TimeEntrySummaryWidget({
  data,
  isLoading,
}: {
  data: LaborTrendPoint[] | undefined;
  isLoading: boolean;
}) {
  const maxHours = Math.max(...(data?.map((p) => p.totalHours) ?? [1]), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Hours Trend</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-44 w-full" />
        ) : (
          <div className="flex h-44 items-end gap-3">
            {data?.map((point) => {
              const height = Math.max((point.totalHours / maxHours) * 100, 4);
              return (
                <div
                  key={point.weekStart}
                  className="flex flex-1 flex-col items-center gap-2"
                >
                  <div
                    className="w-full rounded-md bg-amber-500/20"
                    style={{ height: `${height}%` }}
                  >
                    <div className="h-full w-full rounded-md bg-amber-500" />
                  </div>
                  <div className="text-xs text-muted-foreground text-center">
                    {formatWeekLabel(point.weekStart)}
                  </div>
                  <div className="text-xs font-medium">
                    {point.totalHours.toFixed(0)}h
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
