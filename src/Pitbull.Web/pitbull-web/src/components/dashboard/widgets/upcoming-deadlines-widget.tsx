"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface UpcomingDeadline {
  date: string;
  projectName: string;
  milestone: string;
  daysRemaining: number;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function UpcomingDeadlinesWidget({
  data,
  isLoading,
}: {
  data: UpcomingDeadline[] | undefined;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Deadlines</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading &&
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        {!isLoading &&
          data?.map((deadline, index) => (
            <div
              key={`${deadline.projectName}-${deadline.milestone}-${index}`}
              className="rounded-md border p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{deadline.projectName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {deadline.milestone}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm">{formatDate(deadline.date)}</p>
                  <p
                    className={`text-xs ${deadline.daysRemaining < 7 ? "text-red-600" : "text-muted-foreground"}`}
                  >
                    {deadline.daysRemaining} day
                    {deadline.daysRemaining === 1 ? "" : "s"} remaining
                  </p>
                </div>
              </div>
            </div>
          ))}
        {!isLoading && (data?.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">
            No upcoming milestones or deadlines.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
