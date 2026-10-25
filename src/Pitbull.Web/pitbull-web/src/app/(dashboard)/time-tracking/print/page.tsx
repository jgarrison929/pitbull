"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Printer, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useWeekStartDay } from "@/hooks/use-week-start-day";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import api from "@/lib/api";
import { getWeekStart as getWeekStartFn } from "@/lib/date-utils";
import type {
  TimeEntry,
  PagedResult,
  Employee,
} from "@/lib/types";
import { TimeEntryStatus } from "@/lib/types";

const ALL_VALUE = "__all__";

interface WeekGroup {
  weekStart: string;
  weekEnd: string;
  entries: TimeEntry[];
  totalReg: number;
  totalOT: number;
  totalDT: number;
  totalHours: number;
}

interface EquipmentEntry {
  date: string;
  equipmentName: string;
  projectName: string;
  hours: number;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    month: "numeric",
    day: "numeric",
  });
}

function formatHours(hours: number): string {
  return hours.toFixed(1);
}

function getWeekStartLocal(dateStr: string, startDay: number): Date {
  return getWeekStartFn(new Date(dateStr), startDay);
}

function getWeekEndLocal(weekStart: Date): Date {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  return end;
}

function getDefaultDateRange(): { start: string; end: string } {
  const today = new Date();
  // Default to current pay period (last 2 weeks)
  const twoWeeksAgo = new Date(today);
  twoWeeksAgo.setDate(today.getDate() - 13);
  const formatD = (d: Date) => d.toISOString().split("T")[0];
  return { start: formatD(twoWeeksAgo), end: formatD(today) };
}

function groupByWeek(entries: TimeEntry[], startDay: number): WeekGroup[] {
  const weekMap = new Map<string, TimeEntry[]>();

  for (const entry of entries) {
    const ws = getWeekStartLocal(entry.date, startDay);
    const key = ws.toISOString().split("T")[0];
    if (!weekMap.has(key)) {
      weekMap.set(key, []);
    }
    weekMap.get(key)!.push(entry);
  }

  const weeks: WeekGroup[] = [];
  const sortedKeys = Array.from(weekMap.keys()).sort();

  for (const key of sortedKeys) {
    const weekEntries = weekMap.get(key)!;
    const ws = new Date(key);
    const we = getWeekEndLocal(ws);

    weekEntries.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    weeks.push({
      weekStart: ws.toISOString().split("T")[0],
      weekEnd: we.toISOString().split("T")[0],
      entries: weekEntries,
      totalReg: weekEntries.reduce((s, e) => s + e.regularHours, 0),
      totalOT: weekEntries.reduce((s, e) => s + e.overtimeHours, 0),
      totalDT: weekEntries.reduce((s, e) => s + e.doubletimeHours, 0),
      totalHours: weekEntries.reduce((s, e) => s + e.totalHours, 0),
    });
  }

  return weeks;
}

export default function TimesheetPrintPage() {
  const { weekStartDay } = useWeekStartDay();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const defaults = getDefaultDateRange();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [selectedEmployee, setSelectedEmployee] = useState<string>(ALL_VALUE);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("startDate", startDate);
      params.set("endDate", endDate);
      params.set("pageSize", "2000");
      params.set("status", String(TimeEntryStatus.Approved));
      if (selectedEmployee !== ALL_VALUE) {
        params.set("employeeId", selectedEmployee);
      }

      const [entriesRes, employeesRes] = await Promise.all([
        api<PagedResult<TimeEntry>>(
          `/api/time-entries?${params.toString()}`
        ),
        api<{ items: Employee[] }>("/api/employees?pageSize=200"),
      ]);

      setEntries(entriesRes.items);
      setEmployees(employeesRes.items);
    } catch {
      // silently handle
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, selectedEmployee]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePrint = () => {
    window.print();
  };

  // Group entries by employee
  const byEmployee = new Map<string, { name: string; entries: TimeEntry[] }>();
  for (const entry of entries) {
    const key = entry.employeeId;
    if (!byEmployee.has(key)) {
      byEmployee.set(key, { name: entry.employeeName, entries: [] });
    }
    byEmployee.get(key)!.entries.push(entry);
  }

  // Extract equipment entries
  const equipmentEntries: EquipmentEntry[] = entries
    .filter((e) => e.equipmentId && e.equipmentHours > 0)
    .map((e) => ({
      date: e.date,
      equipmentName: e.equipmentName || "Unknown",
      projectName: `${e.projectNumber} - ${e.projectName}`,
      hours: e.equipmentHours,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Grand totals
  const grandTotalReg = entries.reduce((s, e) => s + e.regularHours, 0);
  const grandTotalOT = entries.reduce((s, e) => s + e.overtimeHours, 0);
  const grandTotalDT = entries.reduce((s, e) => s + e.doubletimeHours, 0);
  const grandTotalHours = entries.reduce((s, e) => s + e.totalHours, 0);

  const selectedEmpName =
    selectedEmployee !== ALL_VALUE
      ? employees.find((e) => e.id === selectedEmployee)?.firstName +
        " " +
        employees.find((e) => e.id === selectedEmployee)?.lastName
      : "All Employees";

  return (
    <>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Controls - Hidden in print */}
        <div className="no-print space-y-4">
          <div className="flex items-center justify-between">
            <Breadcrumbs
              items={[
                { label: "Time Tracking", href: "/time-tracking" },
                { label: "Print Timesheet" },
              ]}
            />
            <Button onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" />
              Print Timesheet
            </Button>
          </div>

          {/* Filters */}
          <div className="rounded-lg border bg-card p-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="startDate">Period Start</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Period End</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employee">Employee</Label>
                <Select
                  value={selectedEmployee}
                  onValueChange={setSelectedEmployee}
                >
                  <SelectTrigger id="employee">
                    <SelectValue placeholder="All Employees" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>All Employees</SelectItem>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Printable Content */}
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">
            Loading timesheet data...
          </div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No approved time entries found for the selected period.
            <Button asChild variant="outline" className="mt-4 block mx-auto w-fit no-print">
              <Link href="/time-tracking">Back to Time Tracking</Link>
            </Button>
          </div>
        ) : (
          <>
            {/* Letterhead */}
            <div className="print-section border rounded-lg p-6 bg-card">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded bg-primary flex items-center justify-center print-break-avoid">
                      <span className="text-primary-foreground font-bold text-lg">
                        P
                      </span>
                    </div>
                    <div>
                      <h1 className="text-xl font-bold">
                        Pitbull Construction Solutions
                      </h1>
                      <p className="text-sm text-muted-foreground">
                        Employee Timesheet
                      </p>
                    </div>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground justify-end">
                    <CalendarDays className="h-4 w-4" />
                    <span>Pay Period</span>
                  </div>
                  <p className="font-semibold">
                    {formatDate(startDate)} — {formatDate(endDate)}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground block">Employee</span>
                  <span className="font-semibold text-lg">
                    {selectedEmpName}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground block">
                    Report Generated
                  </span>
                  <span>{new Date().toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Per-employee sections */}
            {Array.from(byEmployee.entries()).map(
              ([empId, { name, entries: empEntries }]) => {
                const weeks = groupByWeek(empEntries, weekStartDay);
                const empTotalReg = empEntries.reduce(
                  (s, e) => s + e.regularHours,
                  0
                );
                const empTotalOT = empEntries.reduce(
                  (s, e) => s + e.overtimeHours,
                  0
                );
                const empTotalDT = empEntries.reduce(
                  (s, e) => s + e.doubletimeHours,
                  0
                );
                const empTotalHours = empEntries.reduce(
                  (s, e) => s + e.totalHours,
                  0
                );

                return (
                  <div
                    key={empId}
                    className="print-section border rounded-lg p-6 bg-card print-break-avoid"
                  >
                    {byEmployee.size > 1 && (
                      <h2 className="text-lg font-semibold mb-4 border-b pb-2">
                        {name}
                      </h2>
                    )}

                    {/* Time entries grouped by week */}
                    {weeks.map((week) => (
                      <div key={week.weekStart} className="mb-6 last:mb-0">
                        <h3 className="text-sm font-medium text-muted-foreground mb-2">
                          Week of {formatDate(week.weekStart)} —{" "}
                          {formatDate(week.weekEnd)}
                        </h3>
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="text-left text-muted-foreground border-b-2">
                              <th className="pb-2 pr-2">Date</th>
                              <th className="pb-2 pr-2">Project</th>
                              <th className="pb-2 pr-2">Cost Code</th>
                              <th className="pb-2 pr-2">Phase</th>
                              <th className="pb-2 text-right pr-2">Reg</th>
                              <th className="pb-2 text-right pr-2">OT</th>
                              <th className="pb-2 text-right pr-2">DT</th>
                              <th className="pb-2 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {week.entries.map((entry) => (
                              <tr
                                key={entry.id}
                                className="border-b border-dashed"
                              >
                                <td className="py-1.5 pr-2 whitespace-nowrap">
                                  {formatDateShort(entry.date)}
                                </td>
                                <td className="py-1.5 pr-2 truncate max-w-[160px]">
                                  {entry.projectNumber} - {entry.projectName}
                                </td>
                                <td className="py-1.5 pr-2 font-mono text-xs">
                                  {entry.costCodeDescription || "—"}
                                </td>
                                <td className="py-1.5 pr-2 text-xs">
                                  {entry.phaseName || "—"}
                                </td>
                                <td className="py-1.5 text-right pr-2 font-mono">
                                  {formatHours(entry.regularHours)}
                                </td>
                                <td className="py-1.5 text-right pr-2 font-mono">
                                  {entry.overtimeHours > 0
                                    ? formatHours(entry.overtimeHours)
                                    : "—"}
                                </td>
                                <td className="py-1.5 text-right pr-2 font-mono">
                                  {entry.doubletimeHours > 0
                                    ? formatHours(entry.doubletimeHours)
                                    : "—"}
                                </td>
                                <td className="py-1.5 text-right font-mono font-medium">
                                  {formatHours(entry.totalHours)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="font-semibold bg-muted/50">
                              <td
                                colSpan={4}
                                className="py-1.5 pr-2 text-right"
                              >
                                Week Subtotal
                              </td>
                              <td className="py-1.5 text-right pr-2 font-mono">
                                {formatHours(week.totalReg)}
                              </td>
                              <td className="py-1.5 text-right pr-2 font-mono">
                                {formatHours(week.totalOT)}
                              </td>
                              <td className="py-1.5 text-right pr-2 font-mono">
                                {formatHours(week.totalDT)}
                              </td>
                              <td className="py-1.5 text-right font-mono">
                                {formatHours(week.totalHours)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    ))}

                    {/* Employee total (only if showing multiple employees) */}
                    {byEmployee.size > 1 && (
                      <div className="mt-4 pt-3 border-t-2 flex justify-end">
                        <table className="text-sm">
                          <tbody>
                            <tr className="font-bold">
                              <td className="pr-6">Employee Total</td>
                              <td className="pr-4 text-right font-mono">
                                {formatHours(empTotalReg)} reg
                              </td>
                              <td className="pr-4 text-right font-mono">
                                {formatHours(empTotalOT)} OT
                              </td>
                              <td className="pr-4 text-right font-mono">
                                {formatHours(empTotalDT)} DT
                              </td>
                              <td className="text-right font-mono">
                                {formatHours(empTotalHours)} total
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              }
            )}

            {/* Equipment Section */}
            {equipmentEntries.length > 0 && (
              <div className="print-section border rounded-lg p-6 bg-card print-break-avoid">
                <h2 className="text-lg font-semibold mb-4">Equipment Usage</h2>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b-2">
                      <th className="pb-2 pr-2">Date</th>
                      <th className="pb-2 pr-2">Equipment</th>
                      <th className="pb-2 pr-2">Project</th>
                      <th className="pb-2 text-right">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipmentEntries.map((eq, i) => (
                      <tr key={i} className="border-b border-dashed">
                        <td className="py-1.5 pr-2 whitespace-nowrap">
                          {formatDateShort(eq.date)}
                        </td>
                        <td className="py-1.5 pr-2">{eq.equipmentName}</td>
                        <td className="py-1.5 pr-2 truncate max-w-[200px]">
                          {eq.projectName}
                        </td>
                        <td className="py-1.5 text-right font-mono">
                          {formatHours(eq.hours)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold bg-muted/50">
                      <td colSpan={3} className="py-1.5 pr-2 text-right">
                        Total Equipment Hours
                      </td>
                      <td className="py-1.5 text-right font-mono">
                        {formatHours(
                          equipmentEntries.reduce((s, e) => s + e.hours, 0)
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Grand Total */}
            <div className="print-section border rounded-lg p-6 bg-card">
              <h2 className="text-lg font-semibold mb-3">Grand Total</h2>
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold font-mono">
                    {formatHours(grandTotalReg)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Regular
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold font-mono text-amber-600">
                    {formatHours(grandTotalOT)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Overtime
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold font-mono text-red-600">
                    {formatHours(grandTotalDT)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Double Time
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold font-mono">
                    {formatHours(grandTotalHours)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total Hours
                  </div>
                </div>
              </div>
            </div>

            {/* Signature Lines */}
            <div className="print-section border rounded-lg p-6 bg-card print-break-avoid">
              <h2 className="text-lg font-semibold mb-6">Signatures</h2>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <div className="border-b border-black mb-1 h-8" />
                  <p className="text-sm text-muted-foreground">
                    Employee Signature
                  </p>
                </div>
                <div>
                  <div className="border-b border-black mb-1 h-8" />
                  <p className="text-sm text-muted-foreground">Date</p>
                </div>
                <div>
                  <div className="border-b border-black mb-1 h-8" />
                  <p className="text-sm text-muted-foreground">
                    Supervisor Signature
                  </p>
                </div>
                <div>
                  <div className="border-b border-black mb-1 h-8" />
                  <p className="text-sm text-muted-foreground">Date</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-muted-foreground pt-4 border-t">
              <p>
                Pitbull Construction ERP • Employee Timesheet •{" "}
                {formatDate(startDate)} — {formatDate(endDate)}
              </p>
            </div>
          </>
        )}
      </div>
    </>
  );
}
