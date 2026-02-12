"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import type { CrewMemberEntryData } from "@/types/crew-entry.types";
import type { CostCode } from "@/types/employee";

interface CrewEntryGridProps {
  entries: CrewMemberEntryData[];
  costCodes: CostCode[];
  onUpdateEntry: (
    employeeId: string,
    field: keyof CrewMemberEntryData,
    value: string
  ) => void;
}

export function CrewEntryGrid({
  entries,
  costCodes,
  onUpdateEntry,
}: CrewEntryGridProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Crew Hours</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground w-48">
                  Employee
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground w-48">
                  Cost Code
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground w-24">
                  Reg Hrs
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground w-24">
                  OT Hrs
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground w-24">
                  DT Hrs
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground w-20">
                  Total
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => {
                const totalHours =
                  (parseFloat(entry.regularHours) || 0) +
                  (parseFloat(entry.overtimeHours) || 0) +
                  (parseFloat(entry.doubletimeHours) || 0);

                return (
                  <tr
                    key={entry.employeeId}
                    className={`border-b ${
                      index % 2 === 0 ? "" : "bg-muted/30"
                    } ${entry.error ? "bg-destructive/5" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium">{entry.employeeName}</div>
                        <div className="text-xs text-muted-foreground">
                          {entry.employeeNumber}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={entry.costCodeId}
                        onChange={(e) =>
                          onUpdateEntry(entry.employeeId, "costCodeId", e.target.value)
                        }
                        className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">Select...</option>
                        {costCodes.map((cc) => (
                          <option key={cc.id} value={cc.id}>
                            {cc.code} - {cc.description}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        max="24"
                        step="0.5"
                        value={entry.regularHours}
                        onChange={(e) =>
                          onUpdateEntry(entry.employeeId, "regularHours", e.target.value)
                        }
                        className="w-20 h-9 rounded-md border border-input bg-background px-2 text-center text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        max="24"
                        step="0.5"
                        value={entry.overtimeHours}
                        onChange={(e) =>
                          onUpdateEntry(entry.employeeId, "overtimeHours", e.target.value)
                        }
                        className="w-20 h-9 rounded-md border border-input bg-background px-2 text-center text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        max="24"
                        step="0.5"
                        value={entry.doubletimeHours}
                        onChange={(e) =>
                          onUpdateEntry(entry.employeeId, "doubletimeHours", e.target.value)
                        }
                        className="w-20 h-9 rounded-md border border-input bg-background px-2 text-center text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`font-medium ${
                          totalHours > 0 ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {totalHours.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={entry.description}
                          onChange={(e) =>
                            onUpdateEntry(entry.employeeId, "description", e.target.value)
                          }
                          placeholder="Optional notes..."
                          className="flex-1 h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
