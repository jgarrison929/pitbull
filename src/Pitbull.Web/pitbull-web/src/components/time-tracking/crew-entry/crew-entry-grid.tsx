"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { AlertCircle, CopyCheck, CheckCircle2 } from "lucide-react";
import type { CrewMemberEntryData } from "@/types/crew-entry.types";
import type { CostCode, Equipment, Phase } from "@/lib/types";

interface CrewEntryGridProps {
  entries: CrewMemberEntryData[];
  costCodes: CostCode[];
  equipmentList?: Equipment[];
  phases?: Phase[];
  onUpdateEntry: (
    employeeId: string,
    field: keyof CrewMemberEntryData,
    value: string
  ) => void;
}

export function CrewEntryGrid({
  entries,
  costCodes,
  equipmentList = [],
  phases = [],
  onUpdateEntry,
}: CrewEntryGridProps) {
  // "Apply to all" values
  const [applyPhaseId, setApplyPhaseId] = useState<string>("");
  const [applyEquipmentId, setApplyEquipmentId] = useState<string>("");

  function applyPhaseToAll() {
    entries.forEach((entry) => {
      onUpdateEntry(entry.employeeId, "phaseId", applyPhaseId);
    });
  }

  function applyEquipmentToAll() {
    entries.forEach((entry) => {
      onUpdateEntry(entry.employeeId, "equipmentId", applyEquipmentId);
      if (applyEquipmentId) {
        onUpdateEntry(entry.employeeId, "equipmentHours", entry.regularHours);
      }
    });
  }

  function isEntryComplete(entry: CrewMemberEntryData): boolean {
    const total =
      (parseFloat(entry.regularHours) || 0) +
      (parseFloat(entry.overtimeHours) || 0) +
      (parseFloat(entry.doubletimeHours) || 0);
    return total > 0 && !!entry.costCodeId;
  }

  function isEntryMissingRequired(entry: CrewMemberEntryData): boolean {
    const total =
      (parseFloat(entry.regularHours) || 0) +
      (parseFloat(entry.overtimeHours) || 0) +
      (parseFloat(entry.doubletimeHours) || 0);
    return total > 0 && !entry.costCodeId;
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Crew Hours</CardTitle>
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
                  {/* Status icon column */}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground w-48">
                  Employee
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground w-48">
                  Cost Code
                </th>
                {phases.length > 0 && (
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground w-40">
                    Phase
                  </th>
                )}
                {equipmentList.length > 0 && (
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground w-44">
                    Equipment
                  </th>
                )}
                <th className="px-4 py-3 text-center text-sm font-medium text-blue-600 w-24">
                  Reg Hrs
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-amber-600 w-24">
                  OT Hrs
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-red-600 w-24">
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

                const complete = isEntryComplete(entry);
                const missingRequired = isEntryMissingRequired(entry);

                return (
                  <tr
                    key={entry.employeeId}
                    className={`border-b transition-colors ${
                      index % 2 === 0 ? "" : "bg-muted/30"
                    } ${entry.error ? "bg-destructive/5" : ""} ${
                      complete ? "bg-green-50/50 dark:bg-green-900/20" : ""
                    } ${missingRequired ? "bg-amber-50/50 dark:bg-amber-900/20" : ""}`}
                  >
                    {/* Status indicator */}
                    <td className="px-2 py-3 text-center">
                      {complete && (
                        <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                      )}
                      {missingRequired && (
                        <AlertCircle className="h-5 w-5 text-amber-500 mx-auto" />
                      )}
                      {entry.error && (
                        <AlertCircle className="h-5 w-5 text-red-500 mx-auto" />
                      )}
                    </td>
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
                        className={`w-full h-9 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${
                          missingRequired ? "border-amber-400" : "border-input"
                        }`}
                      >
                        <option value="">Select...</option>
                        {costCodes.map((cc) => (
                          <option key={cc.id} value={cc.id}>
                            {cc.code} - {cc.description}
                          </option>
                        ))}
                      </select>
                    </td>
                    {phases.length > 0 && (
                      <td className="px-4 py-3">
                        <select
                          value={entry.phaseId}
                          onChange={(e) =>
                            onUpdateEntry(entry.employeeId, "phaseId", e.target.value)
                          }
                          className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="">None</option>
                          {phases.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.costCode})
                            </option>
                          ))}
                        </select>
                      </td>
                    )}
                    {equipmentList.length > 0 && (
                      <td className="px-4 py-3">
                        <select
                          value={entry.equipmentId}
                          onChange={(e) => {
                            const newEquipmentId = e.target.value;
                            onUpdateEntry(entry.employeeId, "equipmentId", newEquipmentId);
                            if (newEquipmentId) {
                              onUpdateEntry(entry.employeeId, "equipmentHours", entry.regularHours);
                            } else {
                              onUpdateEntry(entry.employeeId, "equipmentHours", "0");
                            }
                          }}
                          className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
                        className="w-20 h-9 rounded-md border border-input bg-background px-2 text-center text-sm font-medium text-blue-600 focus:outline-none focus:ring-2 focus:ring-ring"
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
                        className="w-20 h-9 rounded-md border border-input bg-background px-2 text-center text-sm font-medium text-amber-600 focus:outline-none focus:ring-2 focus:ring-ring"
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
                        className="w-20 h-9 rounded-md border border-input bg-background px-2 text-center text-sm font-medium text-red-600 focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`font-medium font-mono ${
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
