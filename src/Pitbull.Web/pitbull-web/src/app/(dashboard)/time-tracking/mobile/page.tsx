"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Save, Send } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { getTodayISO } from "@/lib/time-tracking";
import type { Project, ListEmployeesResult, Employee, CostCode } from "@/lib/types";
import type {
  BatchCreateTimeEntriesRequest,
  BatchCreateTimeEntriesResult,
} from "@/types/crew-entry.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";

interface CostCodeListResult {
  items: CostCode[];
}

interface SimpleListResult<T> {
  items: T[];
}

interface AuthProfile {
  id: string;
  email: string;
}

interface FormState {
  date: string;
  projectId: string;
  costCodeId: string;
  regularHours: string;
  overtimeHours: string;
  notes: string;
}

interface FormErrors {
  projectId?: string;
  costCodeId?: string;
  hours?: string;
}

const SWIPE_THRESHOLD_PX = 40;

function shiftDate(isoDate: string, dayDelta: number): string {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + dayDelta);
  return date.toISOString().split("T")[0] ?? isoDate;
}

function formatDateLabel(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function clampHours(value: string): string {
  if (!value.trim()) return "0";
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) return "0";
  return Math.max(0, Math.min(24, numeric)).toString();
}

export default function MobileTimeEntryPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [form, setForm] = useState<FormState>({
    date: getTodayISO(),
    projectId: "",
    costCodeId: "",
    regularHours: "8",
    overtimeHours: "0",
    notes: "",
  });

  const touchStartXRef = useRef<number | null>(null);

  const totalHours = useMemo(() => {
    const regular = Number.parseFloat(form.regularHours) || 0;
    const overtime = Number.parseFloat(form.overtimeHours) || 0;
    return regular + overtime;
  }, [form.regularHours, form.overtimeHours]);

  const updateField = useCallback(<K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field === "projectId" ? "projectId" : field === "costCodeId" ? "costCodeId" : "hours"]: undefined }));
  }, []);

  const applyDateDelta = useCallback((dayDelta: number) => {
    setForm((prev) => ({ ...prev, date: shiftDate(prev.date, dayDelta) }));
  }, []);

  const validate = useCallback((): FormErrors => {
    const next: FormErrors = {};
    if (!form.projectId) next.projectId = "Project is required";
    if (!form.costCodeId) next.costCodeId = "Cost code is required";

    const regular = Number.parseFloat(form.regularHours) || 0;
    const overtime = Number.parseFloat(form.overtimeHours) || 0;
    const total = regular + overtime;

    if (regular < 0 || overtime < 0) {
      next.hours = "Hours cannot be negative";
    } else if (total <= 0) {
      next.hours = "Enter regular or OT hours";
    } else if (total > 24) {
      next.hours = "Total hours cannot exceed 24";
    }

    return next;
  }, [form]);

  const submit = useCallback(
    async (isDraft: boolean) => {
      if (!employee) {
        toast.error("Could not resolve your employee profile");
        return;
      }

      const nextErrors = validate();
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) {
        toast.error("Please fix the highlighted fields");
        return;
      }

      setIsSubmitting(true);
      try {
        const request: BatchCreateTimeEntriesRequest = {
          isDraft,
          allowPartialSuccess: false,
          submittedById: employee.id,
          entries: [
            {
              date: form.date,
              employeeId: employee.id,
              projectId: form.projectId,
              costCodeId: form.costCodeId,
              regularHours: Number.parseFloat(form.regularHours) || 0,
              overtimeHours: Number.parseFloat(form.overtimeHours) || 0,
              description: form.notes.trim() || undefined,
            },
          ],
        };

        const result = await api<BatchCreateTimeEntriesResult>("/api/time-entries/batch", {
          method: "POST",
          body: request,
        });

        if (result.failureCount > 0) {
          const firstError = result.results.find((r) => !r.success)?.error;
          toast.error(firstError || "Failed to save time entry");
          return;
        }

        if (isDraft) {
          toast.success("Draft saved");
        } else {
          toast.success("Time entry submitted");
          router.push("/time-tracking");
        }
      } catch (err) {
        toast.error("Failed to save time entry", { description: err instanceof Error ? err.message : undefined });
      } finally {
        setIsSubmitting(false);
      }
    },
    [employee, form, router, validate]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setIsLoading(true);
      try {
        const [profile, employeesRes, projectsRes, costCodeRes] = await Promise.all([
          api<AuthProfile>("/api/auth/me"),
          api<ListEmployeesResult>("/api/employees?isActive=true&pageSize=500"),
          api<SimpleListResult<Project>>("/api/projects?pageSize=500"),
          api<CostCodeListResult>("/api/cost-codes?costType=1&pageSize=500"),
        ]);

        if (cancelled) return;

        const userEmail = profile.email?.toLowerCase().trim();
        const matchedEmployee = employeesRes.items.find(
          (candidate) => (candidate.email || "").toLowerCase().trim() === userEmail
        );

        if (!matchedEmployee) {
          toast.error("No employee record is linked to your login");
        }

        setEmployee(matchedEmployee ?? null);
        setProjects(projectsRes.items || []);
        setCostCodes(costCodeRes.items || []);
      } catch {
        if (!cancelled) {
          toast.error("Failed to load mobile time entry form");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleDateTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = event.changedTouches[0]?.clientX ?? null;
  };

  const handleDateTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const startX = touchStartXRef.current;
    const endX = event.changedTouches[0]?.clientX;
    touchStartXRef.current = null;

    if (startX == null || endX == null) return;

    const deltaX = endX - startX;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return;

    if (deltaX < 0) {
      applyDateDelta(1);
    } else {
      applyDateDelta(-1);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-md space-y-4 px-3 py-4 sm:px-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-3 py-4 sm:px-4">
      <Breadcrumbs items={[{ label: "Time Tracking", href: "/time-tracking" }, { label: "Mobile" }]} />
      <div className="flex items-center gap-2">
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0 touch-manipulation"
          aria-label="Back to time tracking"
        >
          <Link href="/time-tracking">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Mobile Time Entry</h1>
          <p className="text-sm text-muted-foreground">Field-ready daily log</p>
        </div>
      </div>

      {!employee && (
        <Card className="border-destructive/60">
          <CardContent className="pt-5 text-sm text-destructive">
            Unable to match your login to an active employee record. Contact your admin.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Date</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="rounded-xl border bg-muted/40 p-3"
            onTouchStart={handleDateTouchStart}
            onTouchEnd={handleDateTouchEnd}
          >
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-12 w-12 touch-manipulation"
                onClick={() => applyDateDelta(-1)}
                aria-label="Previous day"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>

              <div className="text-center">
                <p className="text-sm text-muted-foreground">Swipe left or right</p>
                <p className="text-lg font-semibold">{formatDateLabel(form.date)}</p>
                <p className="text-xs text-muted-foreground">{form.date}</p>
              </div>

              <Button
                type="button"
                variant="outline"
                className="h-12 w-12 touch-manipulation"
                onClick={() => applyDateDelta(1)}
                aria-label="Next day"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            <Button
              type="button"
              variant={form.date === getTodayISO() ? "default" : "secondary"}
              className="mt-3 h-12 w-full touch-manipulation"
              onClick={() => updateField("date", getTodayISO())}
            >
              <CalendarDays className="mr-2 h-4 w-4" />
              Jump to Today
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Entry Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project">Project</Label>
            <select
              id="project"
              value={form.projectId}
              onChange={(event) => updateField("projectId", event.target.value)}
              className="h-12 w-full rounded-md border border-input bg-background px-3 text-base touch-manipulation"
            >
              <option value="">Select project...</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.number} - {project.name}
                </option>
              ))}
            </select>
            {errors.projectId && <p className="text-sm text-destructive">{errors.projectId}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="costCode">Cost Code</Label>
            <select
              id="costCode"
              value={form.costCodeId}
              onChange={(event) => updateField("costCodeId", event.target.value)}
              className="h-12 w-full rounded-md border border-input bg-background px-3 text-base touch-manipulation"
            >
              <option value="">Select cost code...</option>
              {costCodes.map((costCode) => (
                <option key={costCode.id} value={costCode.id}>
                  {costCode.code} - {costCode.description}
                </option>
              ))}
            </select>
            {errors.costCodeId && <p className="text-sm text-destructive">{errors.costCodeId}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="regularHours">Regular Hours</Label>
              <Input
                id="regularHours"
                type="number"
                inputMode="decimal"
                min={0}
                max={24}
                step={0.25}
                value={form.regularHours}
                onChange={(event) => updateField("regularHours", event.target.value)}
                onBlur={(event) => updateField("regularHours", clampHours(event.target.value))}
                className="h-12 text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="otHours">OT Hours</Label>
              <Input
                id="otHours"
                type="number"
                inputMode="decimal"
                min={0}
                max={24}
                step={0.25}
                value={form.overtimeHours}
                onChange={(event) => updateField("overtimeHours", event.target.value)}
                onBlur={(event) => updateField("overtimeHours", clampHours(event.target.value))}
                className="h-12 text-base"
              />
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
            Total: <span className="font-semibold">{totalHours.toFixed(2)} hrs</span>
          </div>
          {errors.hours && <p className="text-sm text-destructive">{errors.hours}</p>}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              rows={4}
              placeholder="What work was completed?"
              className="text-base"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 pb-2 sm:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          className="h-12 touch-manipulation"
          onClick={() => submit(true)}
          disabled={isSubmitting || !employee}
        >
          <Save className="mr-2 h-4 w-4" />
          Save Draft
        </Button>

        <Button
          type="button"
          className="h-12 bg-amber-500 text-white hover:bg-amber-600 touch-manipulation"
          onClick={() => submit(false)}
          disabled={isSubmitting || !employee}
        >
          <Send className="mr-2 h-4 w-4" />
          Submit
        </Button>
      </div>
    </div>
  );
}
