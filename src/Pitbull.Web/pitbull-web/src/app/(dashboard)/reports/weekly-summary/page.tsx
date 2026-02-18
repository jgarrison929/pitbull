"use client";

import { useCallback, useEffect, useState } from "react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/skeletons";
import { RefreshCw } from "lucide-react";
import api from "@/lib/api";
import { getWeeklySummaryReport, type WeeklySummaryReportResponse } from "@/lib/reports-api";
import { toast } from "sonner";

interface ProjectOption {
  id: string;
  name: string;
  number: string;
}

const ALL_PROJECTS = "__all__";

function thisWeekIso() {
  return new Date().toISOString().split("T")[0];
}

export default function WeeklySummaryPage() {
  const [report, setReport] = useState<WeeklySummaryReportResponse | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [weekOf, setWeekOf] = useState(thisWeekIso());
  const [projectId, setProjectId] = useState(ALL_PROJECTS);

  const fetchProjects = useCallback(async () => {
    try {
      const result = await api<{ items: ProjectOption[] }>("/api/projects?pageSize=200");
      setProjects(result.items);
    } catch {
      setProjects([]);
    }
  }, []);

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getWeeklySummaryReport({
        weekOf,
        projectId: projectId !== ALL_PROJECTS ? projectId : undefined,
      });
      setReport(result);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to load weekly summary report");
    } finally {
      setIsLoading(false);
    }
  }, [weekOf, projectId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Reports", href: "/reports" }, { label: "Weekly Summary" }]} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Weekly Timesheet Summary</h1>
          <p className="text-muted-foreground">Mon-Sun employee grid in standard construction format.</p>
        </div>
        <Button variant="outline" onClick={fetchReport}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="week-of">Week Of</Label>
            <Input id="week-of" type="date" value={weekOf} onChange={(e) => setWeekOf(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="All projects" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_PROJECTS}>All projects</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>{project.number} - {project.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Timesheet Grid</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton headers={["Employee", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Total"]} rows={10} />
          ) : !report || report.rows.length === 0 ? (
            <EmptyState title="No timesheet data" description="No time entries found for this week." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  {report.days.map((day) => (
                    <TableHead key={day.date} className="text-right">{day.label}</TableHead>
                  ))}
                  <TableHead className="text-right">Weekly Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.map((row) => (
                  <TableRow key={row.employeeId}>
                    <TableCell>
                      <div className="font-medium">{row.employeeNumber} - {row.employeeName}</div>
                    </TableCell>
                    {row.dayHours.map((hours, idx) => (
                      <TableCell key={`${row.employeeId}-${idx}`} className="text-right">{hours.toFixed(2)}</TableCell>
                    ))}
                    <TableCell className="text-right font-semibold">{row.weeklyTotal.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/40 font-semibold">
                  <TableCell>Totals</TableCell>
                  {report.totals.dayHours.map((hours, idx) => (
                    <TableCell key={`total-${idx}`} className="text-right">{hours.toFixed(2)}</TableCell>
                  ))}
                  <TableCell className="text-right">{report.totals.weeklyTotal.toFixed(2)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
