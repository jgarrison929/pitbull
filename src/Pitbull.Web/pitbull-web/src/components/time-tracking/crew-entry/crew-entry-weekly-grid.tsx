"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { AlertCircle, CopyCheck, CheckCircle2 } from "lucide-react";
import { DAYS_OF_WEEK, DAY_LABELS } from "@/types/crew-entry.types";
import { getWeekDates } from "@/hooks/use-weekly-detailed-form";
import type {
  WeeklyDetailedEntryData,
  DayOfWeek,
} from "@/types/crew-entry.types";
import type { Equipment, Phase } from "@/lib/types";

interface CrewEntryWeeklyGridProps {
  entries: WeeklyDetailedEntryData[];
  weekEndingDate: string;
  equipmentList?: Equipment[];
  phases?: Phase[];
  onUpdateDayHours: (employeeId: string, day: DayOfWeek, value: string) => void;
  onUpdateEntryField: (employeeId: string, field: string, value: string) => void;
  getDayColumnTotal: (day: DayOfWeek) => number;
  getGrandTotal: () => number;
}

export function CrewEntryWeeklyGrid({
  entries,
  weekEndingDate,
  equipmentList = [],
  phases = [],
  onUpdateDayHours,
  onUpdateEntryField,
  getDayColumnTotal,
  getGrandTotal,
}: CrewEntryWeeklyGridProps) {
  const [applyPhaseId, setApplyPhaseId] = useState<string>("");
  const [applyEquipmentId, setApplyEquipmentId] = useState<string>("");

  const weekDates = getWeekDates(weekEndingDate);

  function applyPhaseToAll() {
    entries.forEach((entry) => {
      onUpdateEntryField(entry.employeeId, "phaseId", applyPhaseId);
    });
  }

  function applyEquipmentToAll() {
    entries.forEach((entry) => {
      onUpdateEntryField(entry.employeeId, "equipmentId", applyEquipmentId);
    });
  }

  function getEmployeeWeekTotal(entry: WeeklyDetailedEntryData): number {
    return DAYS_OF_WEEK.reduce((sum, day) => {
      return sum + (parseFloat(entry.dailyHours[day]) || 0);
    }, 0);
  }

  function isEntryComplete(entry: WeeklyDetailedEntryData): boolean {
    return getEmployeeWeekTotal(entry) > 0;
  }

  function formatDateShort(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Weekly Crew Hours</CardTitle>
          {/* Apply to All controls */}
          {(phases.length > 0 || equipmentList.length > 0) && (
            <div className="flex items-center gap-3">
              {phases.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <select
                    value={applyPhaseId}
                    onChange={(e) => setApplyPhaseId(e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Phase...</option>
                    {phases.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <SimpleTooltip content="Apply phase to all crew members">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={applyPhaseToAll}
                      disabled={!applyPhaseId}
                      className="h-8 gap-1 text-xs"
                    >
                      <CopyCheck className="h-3 w-3" />
                      Apply All
                    </Button>
                  </SimpleTooltip>
                </div>
              )}
              {equipmentList.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <select
                    value={applyEquipmentId}
                    onChange={(e) => setApplyEquipmentId(e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Equipment...</option>
                    {equipmentList.map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.code} - {eq.name}
                      </option>
                    ))}
                  </select>
                  <SimpleTooltip content="Apply equipment to all crew members">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={applyEquipmentToAll}
                      disabled={!applyEquipmentId}
                      className="h-8 gap-1 text-xs"
                    >
                      <CopyCheck className="h-3 w-3" />
                      Apply All
                    </Button>
                  </SimpleTooltip>
                </div>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-2 py-3 text-center text-sm font-medium text-muted-foreground w-10">
                  {/* Status */}
                </th>
                <th className="px-3 py-3 text-left text-sm font-medium text-muted-foreground w-44">
                  Employee
                </th>
                {phases.length > 0 && (
                  <th className="px-2 py-3 text-left text-sm font-medium text-muted-foreground w-32">
                    Phase
                  </th>
                )}
                {equipmentList.length > 0 && (
                  <th className="px-2 py-3 text-left text-sm font-medium text-muted-foreground w-36">
                    Equipment
                  </th>
                )}
                {DAYS_OF_WEEK.map((day) => (
                  <th
                    key={day}
                    className={`px-1 py-3 text-center text-sm font-medium w-20 ${
                      day === "sat" || day === "sun"
                        ? "text-amber-600"
                        : "text-blue-600"
                    }`}
                  >
                    <div>{DAY_LABELS[day]}</div>
                    <div className="text-xs font-normal text-muted-foreground">
                      {formatDateShort(weekDates[day])}
                    </div>
                  </th>
                ))}
                <th className="px-2 py-3 text-center text-sm font-semibold text-muted-foreground w-20">
                  Total
                </th>
                <th className="px-3 py-3 text-left text-sm font-medium text-muted-foreground min-w-[120px]">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => {
                const weekTotal = getEmployeeWeekTotal(entry);
                const complete = isEntryComplete(entry);

                return (
                  <tr
                    key={entry.employeeId}
                    className={`border-b transition-colors ${
                      index % 2 === 0 ? "" : "bg-muted/30"
                    } ${entry.error ? "bg-destructive/5" : ""} ${
                      complete ? "bg-green-50/50 dark:bg-green-900/20" : ""
                    }`}
                  >
                    {/* Status */}
                    <td className="px-2 py-2 text-center">
                      {complete && (
                        <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                      )}
                      {entry.error && (
                        <AlertCircle className="h-5 w-5 text-red-500 mx-auto" />
                      )}
                    </td>

                    {/* Employee */}
                    <td className="px-3 py-2">
                      <div>
                        <div className="font-medium text-sm">{entry.employeeName}</div>
                        <div className="text-xs text-muted-foreground">
                          {entry.employeeNumber}
                        </div>
                      </div>
                    </td>

                    {/* Phase */}
                    {phases.length > 0 && (
                      <td className="px-2 py-2">
                        <select
                          value={entry.phaseId}
                          onChange={(e) =>
                            onUpdateEntryField(entry.employeeId, "phaseId", e.target.value)
                          }
                          className="w-full h-8 rounded-md border border-input bg-background px-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="">None</option>
                          {phases.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    )}

                    {/* Equipment */}
                    {equipmentList.length > 0 && (
                      <td className="px-2 py-2">
                        <select
                          value={entry.equipmentId}
                          onChange={(e) => {
                            onUpdateEntryField(
                              entry.employeeId,
                              "equipmentId",
                              e.target.value
                            );
                            if (!e.target.value) {
                              onUpdateEntryField(
                                entry.employeeId,
                                "equipmentHours",
                                "0"
                              );
                            }
                          }}
                          className="w-full h-8 rounded-md border border-input bg-background px-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="">None</option>
                          {equipmentList.map((eq) => (
                            <option key={eq.id} value={eq.id}>
                              {eq.code} - {eq.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    )}

                    {/* Day-by-day hours inputs */}
                    {DAYS_OF_WEEK.map((day) => {
                      const dayHours = parseFloat(entry.dailyHours[day]) || 0;
                      return (
                        <td key={day} className="px-1 py-2">
                          <input
                            type="number"
                            min="0"
                            max="24"
                            step="0.5"
                            value={entry.dailyHours[day]}
                            onChange={(e) =>
                              onUpdateDayHours(
                                entry.employeeId,
                                day,
                                e.target.value
                              )
                            }
                            className={`w-16 h-8 rounded-md border border-input bg-background px-1 text-center text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring ${
                              dayHours > 8
                                ? "text-amber-600"
                                : dayHours > 0
                                ? "text-blue-600"
                                : "text-muted-foreground"
                            } ${
                              day === "sat" || day === "sun"
                                ? "bg-amber-50/50 dark:bg-amber-900/10"
                                : ""
                            }`}
                          />
                        </td>
                      );
                    })}

                    {/* Weekly Total */}
                    <td className="px-2 py-2 text-center">
                      <span
                        className={`font-semibold font-mono text-sm ${
                          weekTotal > 40
                            ? "text-amber-600"
                            : weekTotal > 0
                            ? "text-foreground"
                            : "text-muted-foreground"
                        }`}
                      >
                        {weekTotal.toFixed(1)}
                      </span>
                      {weekTotal > 40 && (
                        <div className="text-xs text-amber-600">
                          OT: {(weekTotal - 40).toFixed(1)}
                        </div>
                      )}
                    </td>

                    {/* Notes */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={entry.description}
                          onChange={(e) =>
                            onUpdateEntryField(
                              entry.employeeId,
                              "description",
                              e.target.value
                            )
                          }
                          placeholder="Notes..."
                          className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        {entry.error && (
                          <div className="flex items-center gap-1 text-destructive">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span className="text-xs whitespace-nowrap">
                              {entry.error}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Column Totals Footer */}
            <tfoot>
              <tr className="border-t-2 bg-muted/70">
                <td className="px-2 py-3" />
                <td className="px-3 py-3 font-semibold text-sm">
                  Totals
                </td>
                {phases.length > 0 && <td className="px-2 py-3" />}
                {equipmentList.length > 0 && <td className="px-2 py-3" />}
                {DAYS_OF_WEEK.map((day) => {
                  const dayTotal = getDayColumnTotal(day);
                  return (
                    <td key={day} className="px-1 py-3 text-center">
                      <span
                        className={`font-semibold font-mono text-sm ${
                          dayTotal > 0 ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {dayTotal.toFixed(1)}
                      </span>
                    </td>
                  );
                })}
                <td className="px-2 py-3 text-center">
                  <span className="font-bold font-mono text-sm text-foreground">
                    {getGrandTotal().toFixed(1)}
                  </span>
                </td>
                <td className="px-3 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
