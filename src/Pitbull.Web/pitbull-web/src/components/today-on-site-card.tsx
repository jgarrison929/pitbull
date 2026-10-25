"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { todayOnSiteEmptyCopy, type TodayOnSiteView } from "@/lib/today-on-site";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function TodayOnSiteCard({ projectId }: { projectId: string }) {
  const [data, setData] = useState<TodayOnSiteView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api<TodayOnSiteView>(`/api/projects/${projectId}/today-on-site`)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || "Failed to load today activity");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const hasAny =
    !!data && (data.dailyReportCount > 0 || data.photoCount > 0 || data.openRfiCount > 0);

  return (
    <Card data-testid="today-on-site-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {data?.label ?? "Today's field activity"}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {loading && <p>Loading…</p>}
        {error && <p className="text-destructive">{error}</p>}
        {!loading && !error && data && (
          <>
            {!hasAny && <p>{todayOnSiteEmptyCopy(false)}</p>}
            {hasAny && (
              <ul className="list-disc pl-5 space-y-1">
                <li>{data.dailyReportCount} field report(s)</li>
                <li>{data.photoCount} photo(s)</li>
                <li>{data.openRfiCount} open RFI(s) filed today</li>
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
