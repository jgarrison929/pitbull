"use client";

import { useState, useCallback, useMemo } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { getTodayISO } from "@/lib/time-tracking";
import type {
  CrewMemberDto,
  CrewEntryFormData,
  CrewMemberEntryData,
  CrewEntryValidationErrors,
  UseCrewEntryFormReturn,
  BatchCreateTimeEntriesRequest,
  BatchCreateTimeEntriesResult,
  YesterdayCrewEntriesResult,
} from "@/types/crew-entry.types";

interface UseCrewEntryFormOptions {
  crew: CrewMemberDto[];
  supervisorId: string | null;
  defaultCostCodeId?: string;
  onSuccess?: () => void;
}

function createDefaultEntries(
  crew: CrewMemberDto[],
  defaultCostCodeId?: string
): CrewMemberEntryData[] {
  return crew.map((member) => ({
    employeeId: member.id,
    employeeName: member.fullName,
    employeeNumber: member.employeeNumber,
    costCodeId: defaultCostCodeId || "",
    regularHours: "8",
    overtimeHours: "0",
    doubletimeHours: "0",
    description: "",
    isValid: true,
  }));
}

function validateEntry(entry: CrewMemberEntryData): string | undefined {
  const reg = parseFloat(entry.regularHours) || 0;
  const ot = parseFloat(entry.overtimeHours) || 0;
  const dt = parseFloat(entry.doubletimeHours) || 0;
  const total = reg + ot + dt;

  if (total > 0 && !entry.costCodeId) {
    return "Cost code required";
  }
  if (reg < 0 || ot < 0 || dt < 0) {
    return "Hours cannot be negative";
  }
  if (total > 24) {
    return "Total hours cannot exceed 24";
  }
  return undefined;
}

export function useCrewEntryForm({
  crew,
  supervisorId,
  defaultCostCodeId,
  onSuccess,
}: UseCrewEntryFormOptions): UseCrewEntryFormReturn {
  const [formData, setFormData] = useState<CrewEntryFormData>({
    date: getTodayISO(),
    projectId: "",
    entries: createDefaultEntries(crew, defaultCostCodeId),
  });
  const [errors, setErrors] = useState<CrewEntryValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Sync entries when crew changes
  useMemo(() => {
    if (crew.length > 0 && formData.entries.length !== crew.length) {
      setFormData((prev) => ({
        ...prev,
        entries: createDefaultEntries(crew, defaultCostCodeId),
      }));
    }
  }, [crew, defaultCostCodeId, formData.entries.length]);

  const updateDate = useCallback((date: string) => {
    setFormData((prev) => ({ ...prev, date }));
    setErrors((prev) => ({ ...prev, date: undefined }));
    setIsDirty(true);
  }, []);

  const updateProject = useCallback((projectId: string) => {
    setFormData((prev) => ({ ...prev, projectId }));
    setErrors((prev) => ({ ...prev, projectId: undefined }));
    setIsDirty(true);
  }, []);

  const updateEntry = useCallback(
    (employeeId: string, field: keyof CrewMemberEntryData, value: string) => {
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

  const copyYesterday = useCallback(async () => {
    if (!supervisorId) {
      toast.error("No supervisor ID available");
      return;
    }

    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayISO = yesterday.toISOString().split("T")[0];

      const result = await api<YesterdayCrewEntriesResult>(
        `/api/time-entries/yesterday-crew?foremanId=${supervisorId}&targetDate=${yesterdayISO}`
      );

      if (result.entryCount === 0) {
        toast.info("No entries from yesterday to copy");
        return;
      }

      // Map yesterday's entries to form data
      setFormData((prev) => {
        const newEntries = prev.entries.map((entry) => {
          const yesterdayData = result.employeeEntries.find(
            (ye) => ye.employeeId === entry.employeeId
          );

          if (yesterdayData && yesterdayData.entries.length > 0) {
            // Take the first entry if multiple exist (most common case is single entry)
            const firstEntry = yesterdayData.entries[0]!;
            return {
              ...entry,
              costCodeId: firstEntry.costCodeId,
              regularHours: firstEntry.regularHours.toString(),
              overtimeHours: firstEntry.overtimeHours.toString(),
              doubletimeHours: firstEntry.doubletimeHours.toString(),
              description: firstEntry.description || "",
            };
          }
          return entry;
        });

        // If we found a project from yesterday, use it
        const firstWithProject = result.employeeEntries.find(
          (e) => e.entries.length > 0
        );
        const projectId = firstWithProject?.entries[0]?.projectId || prev.projectId;

        return {
          ...prev,
          projectId,
          entries: newEntries,
        };
      });

      setIsDirty(true);
      toast.success(`Copied ${result.entryCount} entries from yesterday`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to copy yesterday's entries"
      );
    }
  }, [supervisorId]);

  const getTotalHours = useCallback(() => {
    return formData.entries.reduce((sum, entry) => {
      const reg = parseFloat(entry.regularHours) || 0;
      const ot = parseFloat(entry.overtimeHours) || 0;
      const dt = parseFloat(entry.doubletimeHours) || 0;
      return sum + reg + ot + dt;
    }, 0);
  }, [formData.entries]);

  const getEntryCount = useCallback(() => {
    return formData.entries.filter((entry) => {
      const reg = parseFloat(entry.regularHours) || 0;
      const ot = parseFloat(entry.overtimeHours) || 0;
      const dt = parseFloat(entry.doubletimeHours) || 0;
      return reg + ot + dt > 0;
    }).length;
  }, [formData.entries]);

  const submit = useCallback(async (): Promise<BatchCreateTimeEntriesResult | null> => {
    // Validate global fields
    const newErrors: CrewEntryValidationErrors = {};
    if (!formData.date) newErrors.date = "Date is required";
    if (!formData.projectId) newErrors.projectId = "Project is required";

    // Validate individual entries
    let hasEntryErrors = false;
    const validatedEntries = formData.entries.map((entry) => {
      const error = validateEntry(entry);
      if (error) hasEntryErrors = true;
      return { ...entry, error, isValid: !error };
    });

    if (Object.keys(newErrors).length > 0 || hasEntryErrors) {
      setErrors(newErrors);
      setFormData((prev) => ({ ...prev, entries: validatedEntries }));
      toast.error("Please fix the validation errors");
      return null;
    }

    // Filter to entries with hours > 0
    const entriesToSubmit = validatedEntries.filter((entry) => {
      const reg = parseFloat(entry.regularHours) || 0;
      const ot = parseFloat(entry.overtimeHours) || 0;
      const dt = parseFloat(entry.doubletimeHours) || 0;
      return reg + ot + dt > 0;
    });

    if (entriesToSubmit.length === 0) {
      toast.error("No entries to submit - enter hours for at least one employee");
      return null;
    }

    setIsSubmitting(true);

    try {
      const request: BatchCreateTimeEntriesRequest = {
        entries: entriesToSubmit.map((entry) => ({
          date: formData.date,
          employeeId: entry.employeeId,
          projectId: formData.projectId,
          costCodeId: entry.costCodeId,
          regularHours: parseFloat(entry.regularHours) || 0,
          overtimeHours: parseFloat(entry.overtimeHours) || 0,
          doubletimeHours: parseFloat(entry.doubletimeHours) || 0,
          description: entry.description || undefined,
        })),
        allowPartialSuccess: false,
      };

      const result = await api<BatchCreateTimeEntriesResult>(
        "/api/time-entries/batch",
        { method: "POST", body: request }
      );

      if (result.failureCount === 0) {
        toast.success(
          `Successfully created ${result.successCount} time entries`
        );
        setIsDirty(false);
        onSuccess?.();
      } else if (result.successCount > 0) {
        toast.warning(
          `Created ${result.successCount} entries, ${result.failureCount} failed`
        );
      } else {
        // Map errors back to form
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
  }, [formData, onSuccess]);

  const reset = useCallback(() => {
    setFormData({
      date: getTodayISO(),
      projectId: "",
      entries: createDefaultEntries(crew, defaultCostCodeId),
    });
    setErrors({});
    setIsDirty(false);
  }, [crew, defaultCostCodeId]);

  return {
    formData,
    errors,
    isSubmitting,
    isDirty,
    updateDate,
    updateProject,
    updateEntry,
    copyYesterday,
    submit,
    reset,
    getTotalHours,
    getEntryCount,
  };
}
