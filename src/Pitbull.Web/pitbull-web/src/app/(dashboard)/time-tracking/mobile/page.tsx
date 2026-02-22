"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Delete,
  MapPin,
  RefreshCw,
  Save,
  Send,
  Wifi,
  WifiOff,
} from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { cn } from "@/lib/utils";
import { useOnlineStatus } from "@/lib/use-online-status";
import {
  enqueueForSync,
  cacheRefData,
  getCachedRefData,
} from "@/lib/offline-store";

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

interface GpsState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  permission: "prompt" | "granted" | "denied" | "unavailable";
  loading: boolean;
}

type HoursField = "regularHours" | "overtimeHours";

const SWIPE_THRESHOLD_PX = 40;
const QUICK_HOURS = ["4", "6", "8", "10"];

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

function NumberPad({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const handleKey = useCallback(
    (key: string) => {
      if (key === "backspace") {
        const next = value.slice(0, -1);
        onChange(next || "0");
      } else if (key === ".") {
        if (!value.includes(".")) onChange(value + ".");
      } else {
        const next = value === "0" ? key : value + key;
        const numeric = Number.parseFloat(next);
        if (Number.isFinite(numeric) && numeric <= 24) onChange(next);
      }
    },
    [value, onChange],
  );

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "backspace"] as const;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="rounded-lg border bg-muted/30 p-2 text-center text-3xl font-bold tabular-nums tracking-wider">
        {value} <span className="text-base font-normal text-muted-foreground">hrs</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => handleKey(key)}
            className="flex min-h-[48px] items-center justify-center rounded-lg border bg-background text-lg font-medium transition-colors active:bg-muted touch-manipulation select-none"
          >
            {key === "backspace" ? <Delete className="h-5 w-5" /> : key}
          </button>
        ))}
      </div>
    </div>
  );
}

function OnlineIndicator({
  syncStatus,
  pendingCount,
  onSyncNow,
}: {
  syncStatus: "online" | "offline" | "syncing";
  pendingCount: number;
  onSyncNow: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {syncStatus === "online" && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          <Wifi className="h-3.5 w-3.5" />
          <span>Online</span>
        </div>
      )}
      {syncStatus === "offline" && (
        <div className="flex items-center gap-1.5 text-xs text-red-500">
          <WifiOff className="h-3.5 w-3.5" />
          <span>Offline</span>
        </div>
      )}
      {syncStatus === "syncing" && (
        <div className="flex items-center gap-1.5 text-xs text-amber-500">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          <span>Syncing</span>
        </div>
      )}
      {pendingCount > 0 && (
        <button
          onClick={onSyncNow}
          className="touch-manipulation"
          aria-label={`${pendingCount} entries pending sync. Tap to sync now.`}
        >
          <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
            {pendingCount} pending
          </Badge>
        </button>
      )}
    </div>
  );
}

function GpsIndicator({ gps }: { gps: GpsState }) {
  if (gps.permission === "unavailable" || gps.permission === "denied") return null;
  if (gps.loading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin className="h-3.5 w-3.5 animate-pulse" />
        <span>Getting location...</span>
      </div>
    );
  }
  if (gps.latitude == null) return null;

  const accuracyColor =
    gps.accuracy != null && gps.accuracy <= 50
      ? "text-emerald-600 dark:text-emerald-400"
      : gps.accuracy != null && gps.accuracy <= 200
        ? "text-amber-500"
        : "text-red-500";

  return (
    <div className={cn("flex items-center gap-1.5 text-xs", accuracyColor)}>
      <MapPin className="h-3.5 w-3.5" />
      <span>
        {gps.accuracy != null ? `~${Math.round(gps.accuracy)}m accuracy` : "Location captured"}
      </span>
    </div>
  );
}

export default function MobileTimeEntryPage() {
  const router = useRouter();
  const { isOnline, syncStatus, pendingCount, syncNow, refreshPendingCount } = useOnlineStatus();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [activeHoursField, setActiveHoursField] = useState<HoursField>("regularHours");
  const [form, setForm] = useState<FormState>({
    date: getTodayISO(),
    projectId: "",
    costCodeId: "",
    regularHours: "8",
    overtimeHours: "0",
    notes: "",
  });
  const [gps, setGps] = useState<GpsState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    permission: "prompt",
    loading: false,
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

  // Request GPS position
  const captureGps = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGps((prev) => ({ ...prev, permission: "unavailable" }));
      return;
    }

    setGps((prev) => ({ ...prev, loading: true }));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGps({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          permission: "granted",
          loading: false,
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setGps((prev) => ({ ...prev, permission: "denied", loading: false }));
        } else {
          // Position unavailable or timeout -- entry still submits
          setGps((prev) => ({ ...prev, loading: false }));
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  // Request GPS on mount
  useEffect(() => {
    captureGps();
  }, [captureGps]);

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

      const entryData = {
        date: form.date,
        employeeId: employee.id,
        projectId: form.projectId,
        costCodeId: form.costCodeId,
        regularHours: Number.parseFloat(form.regularHours) || 0,
        overtimeHours: Number.parseFloat(form.overtimeHours) || 0,
        description: form.notes.trim() || undefined,
      };

      // If offline, queue for background sync
      if (!isOnline && !isDraft) {
        try {
          await enqueueForSync({
            id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            ...entryData,
            doubletimeHours: 0,
            description: entryData.description || "",
            latitude: gps.latitude ?? undefined,
            longitude: gps.longitude ?? undefined,
            locationAccuracy: gps.accuracy ?? undefined,
            createdAt: new Date().toISOString(),
          });
          await refreshPendingCount();
          toast.success("Saved offline", { description: "Will sync when connection is restored" });
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 1200);
        } catch {
          toast.error("Failed to save offline entry");
        } finally {
          setIsSubmitting(false);
        }
        return;
      }

      try {
        const request: BatchCreateTimeEntriesRequest = {
          isDraft,
          allowPartialSuccess: false,
          submittedById: employee.id,
          entries: [entryData],
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
          setShowSuccess(true);
          setTimeout(() => {
            setShowSuccess(false);
            router.push("/time-tracking");
          }, 1200);
        }
      } catch (err) {
        // If network error, offer offline save
        if (!navigator.onLine) {
          try {
            await enqueueForSync({
              id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              ...entryData,
              doubletimeHours: 0,
              description: entryData.description || "",
              latitude: gps.latitude ?? undefined,
              longitude: gps.longitude ?? undefined,
              locationAccuracy: gps.accuracy ?? undefined,
              createdAt: new Date().toISOString(),
            });
            await refreshPendingCount();
            toast.success("Connection lost — saved offline", {
              description: "Will sync when connection is restored",
            });
          } catch {
            toast.error("Failed to save time entry");
          }
        } else {
          toast.error("Failed to save time entry", {
            description: err instanceof Error ? err.message : undefined,
          });
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [employee, form, router, validate, isOnline, gps, refreshPendingCount]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setIsLoading(true);

      // Try loading from cache first for instant UI
      const [cachedProjects, cachedCostCodes] = await Promise.all([
        getCachedRefData<Project>("projects"),
        getCachedRefData<CostCode>("costCodes"),
      ]);

      if (cachedProjects && cachedCostCodes && !cancelled) {
        setProjects(cachedProjects);
        setCostCodes(cachedCostCodes);
      }

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

        // Cache reference data for offline use
        cacheRefData("projects", projectsRes.items || []);
        cacheRefData("costCodes", costCodeRes.items || []);
        cacheRefData("employees", employeesRes.items || []);
      } catch {
        if (!cancelled) {
          // If we have cached data, show it with a warning
          if (cachedProjects && cachedCostCodes) {
            toast.warning("Using cached data — connection unavailable");
          } else {
            toast.error("Failed to load mobile time entry form");
          }
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

  if (showSuccess) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-4 px-3 py-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <Check className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
        </div>
        <p className="text-lg font-semibold">Time Entry Submitted</p>
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
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight">Mobile Time Entry</h1>
          <p className="text-sm text-muted-foreground">Field-ready daily log</p>
        </div>
        <OnlineIndicator
          syncStatus={syncStatus}
          pendingCount={pendingCount}
          onSyncNow={syncNow}
        />
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Hours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick-select buttons */}
          <div className="space-y-2">
            <Label>Quick Set Regular Hours</Label>
            <div className="grid grid-cols-4 gap-2">
              {QUICK_HOURS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => { updateField("regularHours", h); setActiveHoursField("regularHours"); }}
                  className={cn(
                    "flex min-h-[44px] items-center justify-center rounded-lg border text-sm font-medium transition-colors touch-manipulation",
                    form.regularHours === h
                      ? "border-amber-500 bg-amber-500/10 text-amber-600"
                      : "bg-background hover:bg-muted"
                  )}
                >
                  {h}h
                </button>
              ))}
            </div>
          </div>

          {/* Hours field toggle */}
          <div className="flex rounded-lg border p-1">
            <button
              type="button"
              onClick={() => setActiveHoursField("regularHours")}
              className={cn(
                "flex-1 rounded-md py-2 text-sm font-medium transition-colors touch-manipulation",
                activeHoursField === "regularHours"
                  ? "bg-amber-500 text-white"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Regular: {form.regularHours}h
            </button>
            <button
              type="button"
              onClick={() => setActiveHoursField("overtimeHours")}
              className={cn(
                "flex-1 rounded-md py-2 text-sm font-medium transition-colors touch-manipulation",
                activeHoursField === "overtimeHours"
                  ? "bg-amber-500 text-white"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              OT: {form.overtimeHours}h
            </button>
          </div>

          {/* Number pad */}
          <NumberPad
            value={form[activeHoursField]}
            onChange={(v) => updateField(activeHoursField, v)}
            label={activeHoursField === "regularHours" ? "Regular Hours" : "Overtime Hours"}
          />

          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-center">
            Total: <span className="font-semibold text-lg">{totalHours.toFixed(2)} hrs</span>
          </div>
          {errors.hours && <p className="text-sm text-destructive">{errors.hours}</p>}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              rows={3}
              placeholder="What work was completed?"
              className="text-base"
            />
          </div>
        </CardContent>
      </Card>

      {/* GPS / Location card */}
      {gps.permission !== "unavailable" && (
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <GpsIndicator gps={gps} />
                {gps.permission === "denied" && (
                  <p className="text-xs text-muted-foreground">
                    Location access denied. Entry will submit without GPS.
                  </p>
                )}
                {gps.permission === "granted" && gps.latitude != null && (
                  <p className="text-xs text-muted-foreground">
                    Location captured for job costing accuracy
                  </p>
                )}
                {gps.permission === "prompt" && !gps.loading && (
                  <p className="text-xs text-muted-foreground">
                    Enable location for job site verification
                  </p>
                )}
              </div>
              {gps.permission !== "denied" && !gps.loading && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 touch-manipulation"
                  onClick={captureGps}
                >
                  <MapPin className="mr-1.5 h-4 w-4" />
                  {gps.latitude != null ? "Refresh" : "Enable"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 pb-20">
        <Button
          type="button"
          variant="outline"
          className="h-14 touch-manipulation text-base"
          onClick={() => submit(true)}
          disabled={isSubmitting || !employee}
        >
          <Save className="mr-2 h-5 w-5" />
          Draft
        </Button>

        <Button
          type="button"
          className="h-14 bg-amber-500 text-white hover:bg-amber-600 touch-manipulation text-base"
          onClick={() => submit(false)}
          disabled={isSubmitting || !employee}
        >
          <Send className="mr-2 h-5 w-5" />
          {isOnline ? "Submit" : "Save Offline"}
        </Button>
      </div>
    </div>
  );
}
