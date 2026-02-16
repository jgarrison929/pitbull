"use client";

import { useState, useCallback, useMemo } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import type {
  CrewMemberDto,
  CrewEntryValidationErrors,
  WeeklyDetailedFormData,
  WeeklyDetailedEntryData,
  WeeklyDayHours,
  DayOfWeek,
  UseWeeklyDetailedFormReturn,
  BatchCreateTimeEntriesRequest,
  BatchCreateTimeEntriesResult,
} from "@/types/crew-entry.types";
import { DAYS_OF_WEEK } from "@/types/crew-entry.types";

interface UseWeeklyDetailedFormOptions {
  crew: CrewMemberDto[];
  supervisorId: string | null;
  onSuccess?: () => void;
}

function getWeekEndingDate(): string {
  // Default to coming Saturday (or today if Saturday)
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun, 6=Sat
  const daysUntilSat = dayOfWeek === 6 ? 0 : 6 - dayOfWeek;
  const sat = new Date(today);
  sat.setDate(today.getDate() + daysUntilSat);
  return sat.toISOString().split("T")[0]!;
}

function createDefaultWeeklyHours(): WeeklyDayHours {
  return { mon: "0", tue: "0", wed: "0", thu: "0", fri: "0", sat: "0", sun: "0" };
}

function createDefaultWeeklyEntries(
  crew: CrewMemberDto[]
): WeeklyDetailedEntryData[] {
  return crew.map((member) => ({
    employeeId: member.id,
    employeeName: member.fullName,
    employeeNumber: member.employeeNumber,
    costCodeId: "",
    phaseId: "",
    equipmentId: "",
    equipmentHours: "0",
    dailyHours: createDefaultWeeklyHours(),
    description: "",
    isValid: true,
  }));
}

/**
 * Compute the ISO date for each day of the week ending on the given date.
 * Assumes weekEndingDate is a Saturday. The week runs Sun–Sat.
 * We return Mon–Sun as displayed, mapping to actual calendar dates.
 */
export function getWeekDates(weekEndingDate: string): Record<DayOfWeek, string> {
  const endDate = new Date(weekEndingDate + "T00:00:00");
  // If week ending is Saturday, Mon is 5 days before
  // We compute offsets: Mon=-5, Tue=-4, Wed=-3, Thu=-2, Fri=-1, Sat=0, Sun=+1
  // Actually for a standard work week ending Sat: Sun is the start of next week or end of this week?
  // Let's do: Week ending Sat Feb 14 -> Mon=Feb 9, ..., Sat=Feb 14, Sun=Feb 8 (previous)
  // Actually construction: week is Mon-Sun with ending being the last day. Let's just assume
  // week ending date is the last day. Mon is 6 days before, Tue is 5 before, ... Sun is the ending date.
  // OR: week ending is Saturday, Mon-Sat within, Sun before.
  // Simplest: week ending date is always the last day. Days go backwards from it.
  // Mon=6 days before, Tue=5, Wed=4, Thu=3, Fri=2, Sat=1, Sun=0 (the ending date IS Sunday)
  // OR the week ending is Saturday, so: Mon=-5, Tue=-4, Wed=-3, Thu=-2, Fri=-1, Sat=0 (ending), Sun... 
  //
  // Let's just make it flexible: compute Mon through Sun such that the week ending date falls on 
  // the appropriate day. Week runs Mon-Sun.
  // If weekEndingDate is a Sunday: Mon=-6, ..., Sun=0
  // If weekEndingDate is a Saturday: Mon=-5, ..., Sat=0, Sun=+1
  // For simplicity in v1: treat the 7-day period as ending on the weekEndingDate.
  // Day 7 (Sun) = weekEndingDate, Day 1 (Mon) = weekEndingDate - 6

  const dates: Record<string, string> = {};
  const dayOrder: DayOfWeek[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  
  for (let i = 0; i < 7; i++) {
    const d = new Date(endDate);
    d.setDate(endDate.getDate() - (6 - i));
    dates[dayOrder[i]!] = d.toISOString().split("T")[0]!;
  }

  return dates as Record<DayOfWeek, string>;
}

function getEmployeeWeekTotal(entry: WeeklyDetailedEntryData): number {
  return DAYS_OF_WEEK.reduce((sum, day) => {
    return sum + (parseFloat(entry.dailyHours[day]) || 0);
  }, 0);
}

export function useWeeklyDetailedForm({
  crew,
  supervisorId,
  onSuccess,
}: UseWeeklyDetailedFormOptions): UseWeeklyDetailedFormReturn {
  const [formData, setFormData] = useState<WeeklyDetailedFormData>({
    weekEndingDate: getWeekEndingDate(),
    projectId: "",
    entries: createDefaultWeeklyEntries(crew),
  });
  const [errors, setErrors] = useState<CrewEntryValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Sync entries when crew changes
  useMemo(() => {
    if (crew.length > 0 && formData.entries.length !== crew.length) {
      setFormData((prev) => ({
        ...prev,
        entries: createDefaultWeeklyEntries(crew),
      }));
    }
  }, [crew, formData.entries.length]);

  const updateWeekEndingDate = useCallback((date: string) => {
    setFormData((prev) => ({ ...prev, weekEndingDate: date }));
    setErrors((prev) => ({ ...prev, date: undefined }));
    setIsDirty(true);
  }, []);

  const updateProject = useCallback((projectId: string) => {
    setFormData((prev) => ({ ...prev, projectId }));
    setErrors((prev) => ({ ...prev, projectId: undefined }));
    setIsDirty(true);
  }, []);

  const updateDayHours = useCallback(
    (employeeId: string, day: DayOfWeek, value: string) => {
      setFormData((prev) => ({
        ...prev,
        entries: prev.entries.map((entry) =>
          entry.employeeId === employeeId
            ? {
                ...entry,
                dailyHours: { ...entry.dailyHours, [day]: value },
                error: undefined,
              }
            : entry
        ),
      }));
      setIsDirty(true);
    },
    []
  );

  const updateEntryField = useCallback(
    (employeeId: string, field: string, value: string) => {
      setFormData((prev) => ({
        ...prev,
        entries: prev.entries.map((entry) =>
          entry.employeeId === employeeId
            ? { ...entry, [field]: value, error: undefined }
            : entry
        ),
      }));
      setIsDirty(true);
    },
    []
  );

  const copyLastWeek = useCallback(async () => {
    if (!supervisorId) {
      toast.error("No supervisor ID available");
      return;
    }

    try {
      // Get dates for the previous week
      const currentEnd = new Date(formData.weekEndingDate + "T00:00:00");
      const prevEnd = new Date(currentEnd);
      prevEnd.setDate(currentEnd.getDate() - 7);
      const prevEndISO = prevEnd.toISOString().split("T")[0]!;

      // Fetch last week's entries for all crew
      // Use the batch endpoint to get entries for the whole previous week
      const prevWeekDates = getWeekDates(prevEndISO);
      const startDate = prevWeekDates.mon;
      const endDate = prevEndISO;

      const result = await api<{
        items: Array<{
          employeeId: string;
          date: string;
          regularHours: number;
          overtimeHours: number;
          doubletimeHours: number;
          projectId: string;
          phaseId?: string;
          equipmentId?: string;
          costCodeId: string;
        }>;
      }>(
        `/api/time-entries?foremanId=${supervisorId}&startDate=${startDate}&endDate=${endDate}&pageSize=500`
      );

      if (!result.items || result.items.length === 0) {
        toast.info("No entries from last week to copy");
        return;
      }

      // Map entries by employee and day
      const weekDates = getWeekDates(prevEndISO);
      const dateToDay = new Map<string, DayOfWeek>();
      for (const day of DAYS_OF_WEEK) {
        dateToDay.set(weekDates[day], day);
      }

      setFormData((prev) => {
        const newEntries = prev.entries.map((entry) => {
          const empEntries = result.items.filter(
            (e) => e.employeeId === entry.employeeId
          );

          if (empEntries.length === 0) return entry;

          const newDailyHours = { ...createDefaultWeeklyHours() };

          empEntries.forEach((te) => {
            const day = dateToDay.get(te.date);
            if (day) {
              const totalHrs = te.regularHours + (te.overtimeHours || 0) + (te.doubletimeHours || 0);
              newDailyHours[day] = totalHrs.toString();
            }
          });

          return {
            ...entry,
            dailyHours: newDailyHours,
            phaseId: empEntries[0]?.phaseId || entry.phaseId,
            equipmentId: empEntries[0]?.equipmentId || entry.equipmentId,
            costCodeId: empEntries[0]?.costCodeId || entry.costCodeId,
          };
        });

        const firstWithProject = result.items.find((e) => e.projectId);

        return {
          ...prev,
          projectId: firstWithProject?.projectId || prev.projectId,
          entries: newEntries,
        };
      });

      setIsDirty(true);
      toast.success(`Copied entries from last week`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to copy last week's entries"
      );
    }
  }, [supervisorId, formData.weekEndingDate]);

  const getEmployeeDayTotalFn = useCallback(
    (employeeId: string): number => {
      // This doesn't quite make sense for "day total" without specifying the day
      // Return the week total instead
      const entry = formData.entries.find((e) => e.employeeId === employeeId);
      if (!entry) return 0;
      return getEmployeeWeekTotal(entry);
    },
    [formData.entries]
  );

  const getEmployeeWeekTotalFn = useCallback(
    (employeeId: string): number => {
      const entry = formData.entries.find((e) => e.employeeId === employeeId);
      if (!entry) return 0;
      return getEmployeeWeekTotal(entry);
    },
    [formData.entries]
  );

  const getDayColumnTotal = useCallback(
    (day: DayOfWeek): number => {
      return formData.entries.reduce((sum, entry) => {
        return sum + (parseFloat(entry.dailyHours[day]) || 0);
      }, 0);
    },
    [formData.entries]
  );

  const getGrandTotal = useCallback((): number => {
    return formData.entries.reduce((sum, entry) => {
      return sum + getEmployeeWeekTotal(entry);
    }, 0);
  }, [formData.entries]);

  const getTotalHours = useCallback((): number => {
    return getGrandTotal();
  }, [getGrandTotal]);

  const getEntryCount = useCallback((): number => {
    return formData.entries.filter((entry) => {
      return getEmployeeWeekTotal(entry) > 0;
    }).length;
  }, [formData.entries]);

  const submitEntries = useCallback(async (isDraft: boolean): Promise<BatchCreateTimeEntriesResult | null> => {
    // Validate
    const newErrors: CrewEntryValidationErrors = {};
    if (!formData.weekEndingDate) newErrors.date = "Week ending date is required";
    if (!formData.projectId) newErrors.projectId = "Project is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Please fix the validation errors");
      return null;
    }

    // Build batch entries - one TimeEntry per day per employee
    const weekDates = getWeekDates(formData.weekEndingDate);
    const entriesToSubmit: BatchCreateTimeEntriesRequest["entries"] = [];

    formData.entries.forEach((entry) => {
      const weekTotal = getEmployeeWeekTotal(entry);

      // For drafts: include entries even with 0 hours if employee has any meaningful data
      // For submits: skip employees with no hours
      if (!isDraft && weekTotal <= 0) return;
      if (isDraft && weekTotal <= 0 && entry.costCodeId === "" && entry.description === "") return;

      DAYS_OF_WEEK.forEach((day) => {
        const hours = parseFloat(entry.dailyHours[day]) || 0;
        // For drafts: include day entries even if hours are 0 (when employee has some data)
        // For submits: skip days with 0 hours
        if (!isDraft && hours <= 0) return;
        if (isDraft && hours <= 0) return; // Still skip zero-hour days for drafts to avoid noise

        // For v1, put all hours as regular. OT calculation is server-side.
        entriesToSubmit.push({
          date: weekDates[day],
          employeeId: entry.employeeId,
          projectId: formData.projectId,
          costCodeId: entry.costCodeId || undefined,
          regularHours: hours,
          overtimeHours: 0,
          doubletimeHours: 0,
          description: entry.description || undefined,
          phaseId: entry.phaseId || undefined,
          equipmentId: entry.equipmentId || undefined,
          equipmentHours: entry.equipmentId
            ? parseFloat(entry.equipmentHours) || 0
            : undefined,
        });
      });
    });

    if (entriesToSubmit.length === 0) {
      if (isDraft) {
        toast.error("No entries to save - modify at least one employee's data");
      } else {
        toast.error("No entries to submit - enter hours for at least one employee");
      }
      return null;
    }

    setIsSubmitting(true);

    try {
      const request: BatchCreateTimeEntriesRequest = {
        entries: entriesToSubmit,
        allowPartialSuccess: false,
        isDraft,
        submittedById: supervisorId || undefined,
      };

      const result = await api<BatchCreateTimeEntriesResult>(
        "/api/time-entries/batch",
        { method: "POST", body: request }
      );

      if (result.failureCount === 0) {
        if (isDraft) {
          toast.success("Draft saved - you can continue editing later");
        } else {
          toast.success(
            `Successfully submitted ${result.successCount} time entries for PM review`
          );
        }
        setIsDirty(false);
        if (!isDraft) {
          onSuccess?.();
        }
      } else if (result.successCount > 0) {
        toast.warning(
          `Created ${result.successCount} entries, ${result.failureCount} failed`
        );
      } else {
        // Map errors back to form
        const errorsByEmployee = new Map<string, string>();
        result.results
          .filter((r) => !r.success)
          .forEach((r) => {
            if (!errorsByEmployee.has(r.employeeId)) {
              errorsByEmployee.set(r.employeeId, r.error || "Unknown error");
            }
          });

        setFormData((prev) => ({
          ...prev,
          entries: prev.entries.map((entry) => ({
            ...entry,
            error: errorsByEmployee.get(entry.employeeId),
          })),
        }));

        toast.error("Batch submission failed - see individual errors");
      }

      return result;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to submit time entries"
      );
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onSuccess, supervisorId]);

  const submit = useCallback(() => submitEntries(false), [submitEntries]);
  const saveDraft = useCallback(() => submitEntries(true), [submitEntries]);

  const reset = useCallback(() => {
    setFormData({
      weekEndingDate: getWeekEndingDate(),
      projectId: "",
      entries: createDefaultWeeklyEntries(crew),
    });
    setErrors({});
    setIsDirty(false);
  }, [crew]);

  return {
    formData,
    errors,
    isSubmitting,
    isDirty,
    updateWeekEndingDate,
    updateProject,
    updateDayHours,
    updateEntryField,
    copyLastWeek,
    submit,
    saveDraft,
    reset,
    getTotalHours,
    getEntryCount,
    getEmployeeDayTotal: getEmployeeDayTotalFn,
    getEmployeeWeekTotal: getEmployeeWeekTotalFn,
    getDayColumnTotal,
    getGrandTotal,
  };
}
