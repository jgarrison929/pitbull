"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, User, Calendar, Building } from "lucide-react";
import { DAYS_OF_WEEK, DAY_LABELS } from "@/types/crew-entry.types";
import type {
  WeeklyDetailedEntryData,
  WeeklySimpleEntryData,
} from "@/types/crew-entry.types";

interface WeeklyBatchSubmitSummaryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weekEndingDate: string;
  projectName: string;
  isSubmitting: boolean;
  onSubmit: () => void;
  mode: "detailed" | "simple";
  detailedEntries?: WeeklyDetailedEntryData[];
  simpleEntries?: WeeklySimpleEntryData[];
}

export function WeeklyBatchSubmitSummary({
  open,
  onOpenChange,
  weekEndingDate,
  projectName,
  isSubmitting,
  onSubmit,
  mode,
  detailedEntries,
  simpleEntries,
}: WeeklyBatchSubmitSummaryProps) {
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (mode === "detailed" && detailedEntries) {
    const entriesToSubmit = detailedEntries.filter((entry) => {
      const weekTotal = DAYS_OF_WEEK.reduce(
        (sum, day) => sum + (parseFloat(entry.dailyHours[day]) || 0),
        0
      );
      return weekTotal > 0;
    });

    const totalHours = entriesToSubmit.reduce((sum, entry) => {
      return (
        sum +
        DAYS_OF_WEEK.reduce(
          (daySum, day) => daySum + (parseFloat(entry.dailyHours[day]) || 0),
          0
        )
      );
    }, 0);

    // Count total individual day entries that will be created
    const dayEntryCount = entriesToSubmit.reduce((count, entry) => {
      return (
        count +
        DAYS_OF_WEEK.filter((day) => (parseFloat(entry.dailyHours[day]) || 0) > 0)
          .length
      );
    }, 0);

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Review Weekly Time Entries</DialogTitle>
            <DialogDescription>
              Confirm the following weekly time entries before submitting
            </DialogDescription>
          </DialogHeader>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Week Ending: {formatDate(weekEndingDate)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Building className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{projectName || "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{entriesToSubmit.length} employees</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>
                {totalHours.toFixed(1)} total hours ({dayEntryCount} day entries)
              </span>
            </div>
          </div>

          {/* Entry List */}
          <div className="flex-1 overflow-y-auto border rounded-md max-h-[300px]">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Employee</th>
                  {DAYS_OF_WEEK.map((day) => (
                    <th key={day} className="text-center px-2 py-2 font-medium">
                      {DAY_LABELS[day]}
                    </th>
                  ))}
                  <th className="text-center px-3 py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {entriesToSubmit.map((entry, index) => {
                  const weekTotal = DAYS_OF_WEEK.reduce(
                    (sum, day) =>
                      sum + (parseFloat(entry.dailyHours[day]) || 0),
                    0
                  );

                  return (
                    <tr
                      key={entry.employeeId}
                      className={index % 2 === 0 ? "" : "bg-muted/30"}
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium">{entry.employeeName}</div>
                      </td>
                      {DAYS_OF_WEEK.map((day) => {
                        const hrs = parseFloat(entry.dailyHours[day]) || 0;
                        return (
                          <td key={day} className="px-2 py-2 text-center">
                            {hrs > 0 ? hrs.toFixed(1) : "—"}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-center font-medium">
                        {weekTotal.toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={onSubmit}
              disabled={isSubmitting}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {isSubmitting
                ? "Submitting..."
                : `Submit ${dayEntryCount} Day Entries`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Simple mode
  if (mode === "simple" && simpleEntries) {
    const entriesToSubmit = simpleEntries.filter((entry) => {
      const total =
        (parseFloat(entry.regularHours) || 0) +
        (parseFloat(entry.overtimeHours) || 0) +
        (parseFloat(entry.doubletimeHours) || 0);
      return total > 0;
    });

    const totalHours = entriesToSubmit.reduce(
      (sum, entry) =>
        sum +
        (parseFloat(entry.regularHours) || 0) +
        (parseFloat(entry.overtimeHours) || 0) +
        (parseFloat(entry.doubletimeHours) || 0),
      0
    );

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Review Weekly Time Entries</DialogTitle>
            <DialogDescription>
              Confirm the following weekly totals before submitting
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Week Ending: {formatDate(weekEndingDate)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Building className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{projectName || "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{entriesToSubmit.length} employees</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{totalHours.toFixed(1)} total hours</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto border rounded-md max-h-[300px]">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Employee</th>
                  <th className="text-center px-3 py-2 font-medium">Reg</th>
                  <th className="text-center px-3 py-2 font-medium">OT</th>
                  <th className="text-center px-3 py-2 font-medium">DT</th>
                  <th className="text-center px-3 py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {entriesToSubmit.map((entry, index) => {
                  const reg = parseFloat(entry.regularHours) || 0;
                  const ot = parseFloat(entry.overtimeHours) || 0;
                  const dt = parseFloat(entry.doubletimeHours) || 0;
                  const total = reg + ot + dt;

                  return (
                    <tr
                      key={entry.employeeId}
                      className={index % 2 === 0 ? "" : "bg-muted/30"}
                    >
                      <td className="px-3 py-2 font-medium">
                        {entry.employeeName}
                      </td>
                      <td className="px-3 py-2 text-center">{reg.toFixed(1)}</td>
                      <td className="px-3 py-2 text-center">
                        {ot > 0 ? ot.toFixed(1) : "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {dt > 0 ? dt.toFixed(1) : "—"}
                      </td>
                      <td className="px-3 py-2 text-center font-medium">
                        {total.toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={onSubmit}
              disabled={isSubmitting}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {isSubmitting
                ? "Submitting..."
                : `Submit ${entriesToSubmit.length} Entries`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return null;
}
