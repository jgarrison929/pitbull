"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import api from "@/lib/api";

interface WeeklyHoursDataPoint {
  weekLabel: string;
  weekStart: string;
  regularHours: number;
  overtimeHours: number;
  doubleTimeHours: number;
  totalHours: number;
}

interface WeeklyHoursResponse {
  data: WeeklyHoursDataPoint[];
  totalHours: number;
  averageHoursPerWeek: number;
}

export function WeeklyHoursChart() {
  const [data, setData] = useState<WeeklyHoursResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await api<WeeklyHoursResponse>(
          "/api/dashboard/weekly-hours?weeks=8"
        );
        setData(response);
      } catch (err) {
        setError("Failed to load chart data");
        console.error("Weekly hours fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Weekly Hours</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
            {error || "No data available"}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Check if there's any data
  const hasData = data.data.some((d) => d.totalHours > 0);

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Weekly Hours</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex flex-col items-center justify-center text-muted-foreground text-sm">
            <p>No time entries recorded yet</p>
            <p className="text-xs mt-1">
              Hours will appear here once employees log time
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Weekly Hours</CardTitle>
          <div className="text-xs text-muted-foreground">
            Avg: {data.averageHoursPerWeek.toFixed(1)} hrs/week
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.data}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="weekLabel"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}h`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
                formatter={(value) => [
                  `${Number(value).toFixed(1)} hrs`,
                ]}
              />
              <Legend
                wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }}
              />
              <Bar
                dataKey="regularHours"
                name="Regular"
                stackId="hours"
                fill="hsl(var(--primary))"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="overtimeHours"
                name="Overtime"
                stackId="hours"
                fill="#f59e0b"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="doubleTimeHours"
                name="Double Time"
                stackId="hours"
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
