"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import type { CrewMemberEntryData } from "@/types/crew-entry.types";
import type { CostCode } from "@/lib/types";

interface CrewEntryMobileCardsProps {
  entries: CrewMemberEntryData[];
  costCodes: CostCode[];
  onUpdateEntry: (
    employeeId: string,
    field: keyof CrewMemberEntryData,
    value: string
  ) => void;
}

export function CrewEntryMobileCards({
  entries,
  costCodes,
  onUpdateEntry,
}: CrewEntryMobileCardsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const entry = entries[currentIndex];

  if (!entry) return null;

  const totalHours =
    (parseFloat(entry.regularHours) || 0) +
    (parseFloat(entry.overtimeHours) || 0) +
    (parseFloat(entry.doubletimeHours) || 0);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : entries.length - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev < entries.length - 1 ? prev + 1 : 0));
  };

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={goToPrevious} title="Previous employee">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <div className="font-medium">{entry.employeeName}</div>
          <div className="text-xs text-muted-foreground">
            {currentIndex + 1} of {entries.length}
          </div>
        </div>
        <Button variant="outline" size="icon" onClick={goToNext} title="Next employee">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Employee Card */}
      <Card className={entry.error ? "border-destructive" : ""}>
        <CardContent className="pt-6 space-y-4">
          {/* Employee Info */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-lg">{entry.employeeName}</div>
              <div className="text-sm text-muted-foreground">
                {entry.employeeNumber}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">
                {totalHours.toFixed(1)}
              </div>
              <div className="text-xs text-muted-foreground">total hours</div>
            </div>
          </div>

          {/* Error */}
          {entry.error && (
            <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-3 rounded-md">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="text-sm">{entry.error}</span>
            </div>
          )}

          {/* Cost Code */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Cost Code</label>
            <select
              value={entry.costCodeId}
              onChange={(e) =>
                onUpdateEntry(entry.employeeId, "costCodeId", e.target.value)
              }
              className="w-full h-12 rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select cost code...</option>
              {costCodes.map((cc) => (
                <option key={cc.id} value={cc.id}>
                  {cc.code} - {cc.description}
                </option>
              ))}
            </select>
          </div>

          {/* Hours Grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Regular</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                max="24"
                step="0.5"
                value={entry.regularHours}
                onChange={(e) =>
                  onUpdateEntry(entry.employeeId, "regularHours", e.target.value)
                }
                className="w-full h-12 rounded-md border border-input bg-background px-3 text-center text-lg font-medium focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">OT (1.5x)</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                max="24"
                step="0.5"
                value={entry.overtimeHours}
                onChange={(e) =>
                  onUpdateEntry(entry.employeeId, "overtimeHours", e.target.value)
                }
                className="w-full h-12 rounded-md border border-input bg-background px-3 text-center text-lg font-medium focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">DT (2x)</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                max="24"
                step="0.5"
                value={entry.doubletimeHours}
                onChange={(e) =>
                  onUpdateEntry(entry.employeeId, "doubletimeHours", e.target.value)
                }
                className="w-full h-12 rounded-md border border-input bg-background px-3 text-center text-lg font-medium focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Notes (optional)</label>
            <textarea
              value={entry.description}
              onChange={(e) =>
                onUpdateEntry(entry.employeeId, "description", e.target.value)
              }
              placeholder="Work description, location, etc."
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* Quick Navigation Dots */}
      <div className="flex justify-center gap-2">
        {entries.map((_, idx) => {
          const entryData = entries[idx]!;
          const hasHours =
            (parseFloat(entryData.regularHours) || 0) +
            (parseFloat(entryData.overtimeHours) || 0) +
            (parseFloat(entryData.doubletimeHours) || 0) >
            0;

          return (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`w-3 h-3 rounded-full transition-colors ${
                idx === currentIndex
                  ? "bg-amber-500"
                  : hasHours
                  ? "bg-green-500"
                  : "bg-muted-foreground/30"
              }`}
              aria-label={`Go to employee ${idx + 1}`}
            />
          );
        })}
      </div>
    </div>
  );
}
