"use client";

import { useState, useCallback, useMemo } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import type {
  CrewMemberDto,
  CrewEntryValidationErrors,
  WeeklySimpleFormData,
  WeeklySimpleEntryData,
  UseWeeklySimpleFormReturn,
  BatchCreateTimeEntriesRequest,
  BatchCreateTimeEntriesResult,
} from "@/types/crew-entry.types";

interface UseWeeklySimpleFormOptions {
  crew: CrewMemberDto[];
  supervisorId: string | null;
  onSuccess?: () => void;
}

function getWeekEndingDate(): string {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilSat = dayOfWeek === 6 ? 0 : 6 - dayOfWeek;
  const sat = new Date(today);
  sat.setDate(today.getDate() + daysUntilSat);
  return sat.toISOString().split("T")[0]!;
}

function createDefaultSimpleEntries(
  crew: CrewMemberDto[]
): WeeklySimpleEntryData[] {
  return crew.map((member) => ({
    employeeId: member.id,
    employeeName: member.fullName,
    employeeNumber: member.employeeNumber,
    costCodeId: "",
    phaseId: "",
    equipmentId: "",
    equipmentHours: "0",
    regularHours: "40",
    overtimeHours: "0",
    doubletimeHours: "0",
    description: "",
    isValid: true,
  }));
}

export function useWeeklySimpleForm({
  crew,
  supervisorId,
  onSuccess,
}: UseWeeklySimpleFormOptions): UseWeeklySimpleFormReturn {
  const [formData, setFormData] = useState<WeeklySimpleFormData>({
    weekEndingDate: getWeekEndingDate(),
    projectId: "",
    entries: createDefaultSimpleEntries(crew),
  });
  const [errors, setErrors] = useState<CrewEntryValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Sync entries when crew changes
  useMemo(() => {
    if (crew.length > 0 && formData.entries.length !== crew.length) {
      setFormData((prev) => ({
        ...prev,
        entries: createDefaultSimpleEntries(crew),
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

  const updateEntry = useCallback(
    (employeeId: string, field: keyof WeeklySimpleEntryData, value: string) => {
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
      const currentEnd = new Date(formData.weekEndingDate + "T00:00:00");
      const prevEnd = new Date(currentEnd);
      prevEnd.setDate(currentEnd.getDate() - 7);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevEnd.getDate() - 6);

      const startDate = prevStart.toISOString().split("T")[0]!;
      const endDate = prevEnd.toISOString().split("T")[0]!;

      const result = await api<{
        items: Array<{
          employeeId: string;
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

      // Aggregate by employee
      const employeeTotals = new Map<
        string,
        { reg: number; ot: number; dt: number; projectId: string; phaseId?: string; equipmentId?: string; costCodeId: string }
      >();

      result.items.forEach((te) => {
        const existing = employeeTotals.get(te.employeeId) || {
          reg: 0,
          ot: 0,
          dt: 0,
          projectId: te.projectId,
          phaseId: te.phaseId,
          equipmentId: te.equipmentId,
          costCodeId: te.costCodeId,
        };
        existing.reg += te.regularHours;
        existing.ot += te.overtimeHours || 0;
        existing.dt += te.doubletimeHours || 0;
        employeeTotals.set(te.employeeId, existing);
      });

      setFormData((prev) => {
        const newEntries = prev.entries.map((entry) => {
          const totals = employeeTotals.get(entry.employeeId);
          if (!totals) return entry;

          return {
            ...entry,
            regularHours: totals.reg.toString(),
            overtimeHours: totals.ot.toString(),
            doubletimeHours: totals.dt.toString(),
            costCodeId: totals.costCodeId || entry.costCodeId,
            phaseId: totals.phaseId || entry.phaseId,
            equipmentId: totals.equipmentId || entry.equipmentId,
          };
        });

        const firstProject = result.items.find((e) => e.projectId);
        return {
          ...prev,
          projectId: firstProject?.projectId || prev.projectId,
          entries: newEntries,
        };
      });

      setIsDirty(true);
      toast.success("Copied entries from last week");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to copy last week's entries"
      );
    }
  }, [supervisorId, formData.weekEndingDate]);

  const getTotalHours = useCallback((): number => {
    return formData.entries.reduce((sum, entry) => {
      return (
        sum +
        (parseFloat(entry.regularHours) || 0) +
        (parseFloat(entry.overtimeHours) || 0) +
        (parseFloat(entry.doubletimeHours) || 0)
      );
    }, 0);
  }, [formData.entries]);

  const getEntryCount = useCallback((): number => {
    return formData.entries.filter((entry) => {
      const total =
        (parseFloat(entry.regularHours) || 0) +
        (parseFloat(entry.overtimeHours) || 0) +
        (parseFloat(entry.doubletimeHours) || 0);
      return total > 0;
    }).length;
  }, [formData.entries]);

  const submitEntries = useCallback(async (isDraft: boolean): Promise<BatchCreateTimeEntriesResult | null> => {
    const newErrors: CrewEntryValidationErrors = {};
    if (!formData.weekEndingDate) newErrors.date = "Week ending date is required";
    if (!formData.projectId) newErrors.projectId = "Project is required";

    // Validate individual entries
    let hasEntryErrors = false;
    const validatedEntries = formData.entries.map((entry) => {
      const reg = parseFloat(entry.regularHours) || 0;
      const ot = parseFloat(entry.overtimeHours) || 0;
      const dt = parseFloat(entry.doubletimeHours) || 0;
      const total = reg + ot + dt;

      let error: string | undefined;
      if (reg < 0 || ot < 0 || dt < 0) {
        error = "Hours cannot be negative";
        hasEntryErrors = true;
      }
      if (total > 168) {
        // 24 * 7
        error = "Weekly hours cannot exceed 168";
        hasEntryErrors = true;
      }

      return { ...entry, error, isValid: !error };
    });

    if (Object.keys(newErrors).length > 0 || hasEntryErrors) {
      setErrors(newErrors);
      setFormData((prev) => ({ ...prev, entries: validatedEntries }));
      toast.error("Please fix the validation errors");
      return null;
    }

    // For drafts: include entries with any meaningful data (even 0 hours)
    // For submits: filter to entries with hours > 0
    const entriesToSubmit = isDraft
      ? validatedEntries.filter((entry) => {
          return (
            entry.costCodeId !== "" ||
            entry.description !== "" ||
            entry.phaseId !== "" ||
            entry.equipmentId !== "" ||
            parseFloat(entry.regularHours) !== 0 ||
            parseFloat(entry.overtimeHours) !== 0 ||
            parseFloat(entry.doubletimeHours) !== 0
          );
        })
      : validatedEntries.filter((entry) => {
          const total =
            (parseFloat(entry.regularHours) || 0) +
            (parseFloat(entry.overtimeHours) || 0) +
            (parseFloat(entry.doubletimeHours) || 0);
          return total > 0;
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
      // For simple mode, create a single TimeEntry per employee with the week ending date
      const request: BatchCreateTimeEntriesRequest = {
        entries: entriesToSubmit.map((entry) => ({
          date: formData.weekEndingDate,
          employeeId: entry.employeeId,
          projectId: formData.projectId,
          costCodeId: entry.costCodeId || undefined,
          regularHours: parseFloat(entry.regularHours) || 0,
          overtimeHours: parseFloat(entry.overtimeHours) || 0,
          doubletimeHours: parseFloat(entry.doubletimeHours) || 0,
          description: entry.description || undefined,
          phaseId: entry.phaseId || undefined,
          equipmentId: entry.equipmentId || undefined,
          equipmentHours: entry.equipmentId
            ? parseFloat(entry.equipmentHours) || 0
            : undefined,
        })),
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
            `Successfully submitted ${result.successCount} weekly time entries for PM review`
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
        const errorMap = new Map(
          result.results
            .filter((r) => !r.success)
            .map((r) => [r.employeeId, r.error || "Unknown error"])
        );

        setFormData((prev) => ({
          ...prev,
          entries: prev.entries.map((entry) => ({
            ...entry,
            error: errorMap.get(entry.employeeId),
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
      entries: createDefaultSimpleEntries(crew),
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
    updateEntry,
    copyLastWeek,
    submit,
    saveDraft,
    reset,
    getTotalHours,
    getEntryCount,
  };
}
