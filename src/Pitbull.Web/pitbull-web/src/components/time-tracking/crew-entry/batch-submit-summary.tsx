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
import type { CrewMemberEntryData } from "@/types/crew-entry.types";
import type { CostCode } from "@/types/employee";

interface BatchSubmitSummaryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: CrewMemberEntryData[];
  date: string;
  projectName: string;
  costCodes: CostCode[];
  isSubmitting: boolean;
  onSubmit: () => void;
}

export function BatchSubmitSummary({
  open,
  onOpenChange,
  entries,
  date,
  projectName,
  costCodes,
  isSubmitting,
  onSubmit,
}: BatchSubmitSummaryProps) {
  // Filter to entries with hours
  const entriesToSubmit = entries.filter((entry) => {
    const total =
      (parseFloat(entry.regularHours) || 0) +
      (parseFloat(entry.overtimeHours) || 0) +
      (parseFloat(entry.doubletimeHours) || 0);
    return total > 0;
  });

  const totalHours = entriesToSubmit.reduce((sum, entry) => {
    return (
      sum +
      (parseFloat(entry.regularHours) || 0) +
      (parseFloat(entry.overtimeHours) || 0) +
      (parseFloat(entry.doubletimeHours) || 0)
    );
  }, 0);

  const getCostCodeName = (id: string) => {
    const cc = costCodes.find((c) => c.id === id);
    return cc ? `${cc.code}` : "—";
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Review Time Entries</DialogTitle>
          <DialogDescription>
            Confirm the following time entries before submitting
          </DialogDescription>
        </DialogHeader>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{formatDate(date)}</span>
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

        {/* Entry List */}
        <div className="flex-1 overflow-y-auto border rounded-md max-h-[300px]">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Employee</th>
                <th className="text-center px-3 py-2 font-medium">Code</th>
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
                    <td className="px-3 py-2">
                      <div className="font-medium">{entry.employeeName}</div>
                    </td>
                    <td className="px-3 py-2 text-center text-muted-foreground">
                      {getCostCodeName(entry.costCodeId)}
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
            {isSubmitting ? "Submitting..." : `Submit ${entriesToSubmit.length} Entries`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
