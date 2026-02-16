"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useCrewEntryData } from "@/hooks/use-crew-entry-data";
import { useCrewEntryForm } from "@/hooks/use-crew-entry-form";
import { useWeeklyDetailedForm } from "@/hooks/use-weekly-detailed-form";
import { useWeeklySimpleForm } from "@/hooks/use-weekly-simple-form";
import { useTimecardSettings } from "@/hooks/use-timecard-settings";
import { CrewEntryHeader } from "@/components/time-tracking/crew-entry/crew-entry-header";
import { CrewEntryGrid } from "@/components/time-tracking/crew-entry/crew-entry-grid";
import { CrewEntryWeeklyGrid } from "@/components/time-tracking/crew-entry/crew-entry-weekly-grid";
import { CrewEntryWeeklySimpleGrid } from "@/components/time-tracking/crew-entry/crew-entry-weekly-simple-grid";
import { CrewEntryMobileCards } from "@/components/time-tracking/crew-entry/crew-entry-mobile-cards";
import { BatchSubmitSummary } from "@/components/time-tracking/crew-entry/batch-submit-summary";
import { WeeklyBatchSubmitSummary } from "@/components/time-tracking/crew-entry/weekly-batch-submit-summary";
import { CopyYesterdayDialog } from "@/components/time-tracking/crew-entry/copy-yesterday-dialog";
import { CopyLastWeekDialog } from "@/components/time-tracking/crew-entry/copy-last-week-dialog";
import { PayPeriodIndicator } from "@/components/time-tracking/pay-period-indicator";
import { OfflineIndicator } from "@/components/time-tracking/offline-indicator";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ArrowLeft, Users, CalendarDays, Calendar, List } from "lucide-react";
import { getTodayISO } from "@/lib/time-tracking";
import { toast } from "sonner";
import api from "@/lib/api";
import type { Phase } from "@/lib/types";

// For demo purposes - in production this would come from auth context
const DEMO_SUPERVISOR_ID = "00000000-0000-0000-0000-000000000001";

const CREW_TEMPLATE_STORAGE_KEY = "pitbull_crew_templates";

interface CrewTemplate {
  name: string;
  entries: {
    employeeId: string;
    costCodeId: string;
    phaseId: string;
    equipmentId: string;
  }[];
  savedAt: number;
}

function loadCrewTemplates(): CrewTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(CREW_TEMPLATE_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as CrewTemplate[]) : [];
  } catch {
    return [];
  }
}

function saveCrewTemplate(template: CrewTemplate) {
  if (typeof window === "undefined") return;
  try {
    const templates = loadCrewTemplates();
    const filtered = templates.filter((t) => t.name !== template.name);
    filtered.unshift(template);
    localStorage.setItem(CREW_TEMPLATE_STORAGE_KEY, JSON.stringify(filtered.slice(0, 5)));
  } catch {
    // ignore
  }
}

function getYesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0]!;
}

function formatWeekEndingLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function CrewEntryPage() {
  const router = useRouter();
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  // Load timecard settings from company config
  const { settings, isLoading: settingsLoading } = useTimecardSettings();

  const {
    crew,
    projects,
    equipmentList,
    isLoading: dataLoading,
    error: dataError,
    loadCrew,
    supervisorId,
  } = useCrewEntryData();

  // ──────────────────────────────────────────
  // Daily mode form
  // ──────────────────────────────────────────
  const dailyForm = useCrewEntryForm({
    crew,
    supervisorId,
    onSuccess: () => {
      setShowSummary(false);
      router.push("/time-tracking");
    },
  });

  // ──────────────────────────────────────────
  // Weekly Detailed mode form
  // ──────────────────────────────────────────
  const weeklyDetailedForm = useWeeklyDetailedForm({
    crew,
    supervisorId,
    onSuccess: () => {
      setShowSummary(false);
      router.push("/time-tracking");
    },
  });

  // ──────────────────────────────────────────
  // Weekly Simple mode form
  // ──────────────────────────────────────────
  const weeklySimpleForm = useWeeklySimpleForm({
    crew,
    supervisorId,
    onSuccess: () => {
      setShowSummary(false);
      router.push("/time-tracking");
    },
  });

  // Determine the active mode
  const isWeekly = settings.timecardMode === "weekly";
  const isWeeklyDetailed = isWeekly && settings.weeklyEntryMode === "detailed";
  const isWeeklySimple = isWeekly && settings.weeklyEntryMode === "simple";

  // Phases for the selected project
  const [phases, setPhases] = useState<Phase[]>([]);

  // Get the active projectId based on mode
  const activeProjectId = isWeeklyDetailed
    ? weeklyDetailedForm.formData.projectId
    : isWeeklySimple
    ? weeklySimpleForm.formData.projectId
    : dailyForm.formData.projectId;

  // Load crew on mount
  useEffect(() => {
    loadCrew(DEMO_SUPERVISOR_ID);
  }, [loadCrew]);

  // Load phases when project changes
  useEffect(() => {
    let cancelled = false;
    async function fetchPhases() {
      if (!activeProjectId) {
        setPhases([]);
        return;
      }
      try {
        const result = await api<Phase[]>(`/api/projects/${activeProjectId}/phases`);
        if (!cancelled) setPhases(result);
      } catch {
        if (!cancelled) setPhases([]);
      }
    }
    fetchPhases();
    return () => { cancelled = true; };
  }, [activeProjectId]);

  // ──────────────────────────────────────────
  // Event handlers
  // ──────────────────────────────────────────

  const handleCopyPrevious = async () => {
    setShowCopyDialog(false);
    if (isWeeklyDetailed) {
      await weeklyDetailedForm.copyLastWeek();
    } else if (isWeeklySimple) {
      await weeklySimpleForm.copyLastWeek();
    } else {
      await dailyForm.copyYesterday();
    }
  };

  const handleSubmit = async () => {
    setShowSummary(false);
    if (isWeeklyDetailed) {
      await weeklyDetailedForm.submit();
    } else if (isWeeklySimple) {
      await weeklySimpleForm.submit();
    } else {
      await dailyForm.submit();
    }
  };

  const handleReset = () => {
    if (isWeeklyDetailed) {
      weeklyDetailedForm.reset();
    } else if (isWeeklySimple) {
      weeklySimpleForm.reset();
    } else {
      dailyForm.reset();
    }
  };

  const handleUpdateProject = (projectId: string) => {
    if (isWeeklyDetailed) {
      weeklyDetailedForm.updateProject(projectId);
    } else if (isWeeklySimple) {
      weeklySimpleForm.updateProject(projectId);
    } else {
      dailyForm.updateProject(projectId);
    }
  };

  // Get active form stats
  const totalHours = isWeeklyDetailed
    ? weeklyDetailedForm.getTotalHours()
    : isWeeklySimple
    ? weeklySimpleForm.getTotalHours()
    : dailyForm.getTotalHours();

  const entryCount = isWeeklyDetailed
    ? weeklyDetailedForm.getEntryCount()
    : isWeeklySimple
    ? weeklySimpleForm.getEntryCount()
    : dailyForm.getEntryCount();

  const isDirty = isWeeklyDetailed
    ? weeklyDetailedForm.isDirty
    : isWeeklySimple
    ? weeklySimpleForm.isDirty
    : dailyForm.isDirty;

  const isSubmitting = isWeeklyDetailed
    ? weeklyDetailedForm.isSubmitting
    : isWeeklySimple
    ? weeklySimpleForm.isSubmitting
    : dailyForm.isSubmitting;

  const errors = isWeeklyDetailed
    ? weeklyDetailedForm.errors
    : isWeeklySimple
    ? weeklySimpleForm.errors
    : dailyForm.errors;

  // Set all regular hours to 8 (daily mode only)
  const handleSetAllRegular8 = useCallback(() => {
    dailyForm.formData.entries.forEach((entry) => {
      dailyForm.updateEntry(entry.employeeId, "regularHours", "8");
    });
    toast.success(`Set all ${dailyForm.formData.entries.length} crew to 8 regular hours`);
  }, [dailyForm]);

  // Save crew template
  const handleSaveTemplate = useCallback(() => {
    const name = `Crew Setup - ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    const entries = isWeeklyDetailed
      ? weeklyDetailedForm.formData.entries
      : isWeeklySimple
      ? weeklySimpleForm.formData.entries
      : dailyForm.formData.entries;

    const template: CrewTemplate = {
      name,
      entries: entries.map((e) => ({
        employeeId: e.employeeId,
        costCodeId: e.costCodeId,
        phaseId: e.phaseId,
        equipmentId: e.equipmentId,
      })),
      savedAt: Date.now(),
    };
    saveCrewTemplate(template);
    toast.success("Crew template saved! It will be available next time.");
  }, [isWeeklyDetailed, isWeeklySimple, weeklyDetailedForm.formData.entries, weeklySimpleForm.formData.entries, dailyForm.formData.entries]);

  // Loading state
  if (dataLoading || settingsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-1" />
          </div>
        </div>
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  // Error state
  if (dataError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild title="Back to Time Tracking" aria-label="Back to Time Tracking" className="min-h-[44px] min-w-[44px]">
            <Link href="/time-tracking">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Crew Time Entry</h1>
            <p className="text-muted-foreground">Enter time for your crew</p>
          </div>
        </div>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>{dataError}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Empty crew state
  if (crew.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild title="Back to Time Tracking" aria-label="Back to Time Tracking" className="min-h-[44px] min-w-[44px]">
            <Link href="/time-tracking">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Crew Time Entry</h1>
            <p className="text-muted-foreground">Enter time for your crew</p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Crew Assigned</h3>
              <p className="text-muted-foreground max-w-md">
                You don&apos;t have any crew members assigned to you yet. Contact your
                administrator to assign employees to your supervision.
              </p>
              <Button asChild className="mt-6 min-h-[48px] touch-manipulation">
                <Link href="/time-tracking">Back to Time Tracking</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <OfflineIndicator />

      {/* View Tabs */}
      <div className="flex gap-1 border-b">
        <button
          type="button"
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 border-amber-500 text-amber-600 transition-colors"
        >
          <Users className="h-4 w-4" />
          Crew Entry
        </button>
        <Link
          href="/time-tracking?view=entries"
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 transition-colors"
        >
          <List className="h-4 w-4" />
          All Entries
        </Link>
      </div>

      {/* Header with Copy Previous, progress, templates */}
      <CrewEntryHeader
        crewCount={crew.length}
        totalHours={totalHours}
        entryCount={entryCount}
        onCopyPrevious={() => setShowCopyDialog(true)}
        onReset={handleReset}
        onSetAllRegular8={!isWeekly ? handleSetAllRegular8 : undefined}
        onSaveTemplate={handleSaveTemplate}
        isDirty={isDirty}
        timecardMode={settings.timecardMode}
      />

      {/* Pay Period Indicator */}
      <PayPeriodIndicator
        date={
          isWeeklyDetailed
            ? weeklyDetailedForm.formData.weekEndingDate
            : isWeeklySimple
            ? weeklySimpleForm.formData.weekEndingDate
            : dailyForm.formData.date
        }
        compact
      />

      {/* Date/Project Selection */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Entry Details</CardTitle>
          <CardDescription>
            {isWeekly
              ? "Select the week ending date and project for all time entries"
              : "Select the date and project for all time entries"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Date picker — different for daily vs weekly */}
            {isWeekly ? (
              <div className="space-y-2">
                <label htmlFor="weekEnding" className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-amber-600" />
                  Week Ending
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="weekEnding"
                    type="date"
                    value={
                      isWeeklyDetailed
                        ? weeklyDetailedForm.formData.weekEndingDate
                        : weeklySimpleForm.formData.weekEndingDate
                    }
                    onChange={(e) => {
                      if (isWeeklyDetailed) {
                        weeklyDetailedForm.updateWeekEndingDate(e.target.value);
                      } else {
                        weeklySimpleForm.updateWeekEndingDate(e.target.value);
                      }
                    }}
                    className="flex min-h-[48px] sm:min-h-[40px] w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 touch-manipulation"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Week:{" "}
                  {formatWeekEndingLabel(
                    isWeeklyDetailed
                      ? weeklyDetailedForm.formData.weekEndingDate
                      : weeklySimpleForm.formData.weekEndingDate
                  )}
                </p>
                {errors.date && (
                  <p className="text-sm text-destructive">{errors.date}</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <label htmlFor="date" className="text-sm font-medium">
                  Date
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="date"
                    type="date"
                    value={dailyForm.formData.date}
                    onChange={(e) => dailyForm.updateDate(e.target.value)}
                    className="flex min-h-[48px] sm:min-h-[40px] w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 touch-manipulation"
                  />
                  <div className="flex gap-1 shrink-0">
                    <Button
                      type="button"
                      variant={dailyForm.formData.date === getTodayISO() ? "default" : "outline"}
                      size="sm"
                      onClick={() => dailyForm.updateDate(getTodayISO())}
                      className="min-h-[48px] sm:min-h-[36px] px-2.5 text-xs touch-manipulation"
                    >
                      <CalendarDays className="h-3.5 w-3.5 mr-1" />
                      Today
                    </Button>
                    <Button
                      type="button"
                      variant={dailyForm.formData.date === getYesterdayISO() ? "default" : "outline"}
                      size="sm"
                      onClick={() => dailyForm.updateDate(getYesterdayISO())}
                      className="min-h-[48px] sm:min-h-[36px] px-2.5 text-xs touch-manipulation"
                    >
                      Yest.
                    </Button>
                  </div>
                </div>
                {errors.date && (
                  <p className="text-sm text-destructive">{errors.date}</p>
                )}
              </div>
            )}

            {/* Project selector (shared) */}
            <div className="space-y-2">
              <label htmlFor="project" className="text-sm font-medium">
                Project
              </label>
              <select
                id="project"
                value={activeProjectId}
                onChange={(e) => handleUpdateProject(e.target.value)}
                className="flex min-h-[48px] sm:min-h-[40px] w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 touch-manipulation"
              >
                <option value="">Select a project...</option>
                {projects.map((project) => (
                  <option key={project.projectId} value={project.projectId}>
                    {project.projectNumber} - {project.projectName}
                  </option>
                ))}
              </select>
              {errors.projectId && (
                <p className="text-sm text-destructive">{errors.projectId}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════
          GRID: render based on mode
          ══════════════════════════════════════════ */}

      {/* DAILY MODE - existing grid */}
      {!isWeekly && (
        <>
          <div className="hidden md:block">
            <CrewEntryGrid
              entries={dailyForm.formData.entries}
              equipmentList={equipmentList}
              phases={phases}
              onUpdateEntry={dailyForm.updateEntry}
            />
          </div>
          <div className="md:hidden">
            <CrewEntryMobileCards
              entries={dailyForm.formData.entries}
              equipmentList={equipmentList}
              phases={phases}
              onUpdateEntry={dailyForm.updateEntry}
            />
          </div>
        </>
      )}

      {/* WEEKLY DETAILED MODE - day-by-day grid */}
      {isWeeklyDetailed && (
        <div className="overflow-x-auto">
          <CrewEntryWeeklyGrid
            entries={weeklyDetailedForm.formData.entries}
            weekEndingDate={weeklyDetailedForm.formData.weekEndingDate}
            equipmentList={equipmentList}
            phases={phases}
            onUpdateDayHours={weeklyDetailedForm.updateDayHours}
            onUpdateEntryField={weeklyDetailedForm.updateEntryField}
            getDayColumnTotal={weeklyDetailedForm.getDayColumnTotal}
            getGrandTotal={weeklyDetailedForm.getGrandTotal}
          />
        </div>
      )}

      {/* WEEKLY SIMPLE MODE - Reg/OT/DT totals */}
      {isWeeklySimple && (
        <CrewEntryWeeklySimpleGrid
          entries={weeklySimpleForm.formData.entries}
          equipmentList={equipmentList}
          phases={phases}
          onUpdateEntry={weeklySimpleForm.updateEntry}
        />
      )}

      {/* Submit Button */}
      <div className="flex flex-col sm:flex-row justify-end gap-3">
        <Button variant="outline" asChild className="min-h-[48px] touch-manipulation">
          <Link href="/time-tracking">Cancel</Link>
        </Button>
        <Button
          onClick={() => setShowSummary(true)}
          disabled={entryCount === 0 || !activeProjectId}
          className="bg-amber-500 hover:bg-amber-600 text-white min-h-[56px] sm:min-h-[48px] text-lg sm:text-base font-semibold touch-manipulation"
        >
          Review &amp; Submit ({entryCount} {isWeekly ? "weekly " : ""}entries)
        </Button>
      </div>

      {/* ══════════════════════════════════════════
          DIALOGS
          ══════════════════════════════════════════ */}

      {/* Copy Dialog - mode-specific */}
      {isWeekly ? (
        <CopyLastWeekDialog
          open={showCopyDialog}
          onOpenChange={setShowCopyDialog}
          onConfirm={handleCopyPrevious}
        />
      ) : (
        <CopyYesterdayDialog
          open={showCopyDialog}
          onOpenChange={setShowCopyDialog}
          onConfirm={handleCopyPrevious}
        />
      )}

      {/* Submit Summary Dialog - mode-specific */}
      {!isWeekly && (
        <BatchSubmitSummary
          open={showSummary}
          onOpenChange={setShowSummary}
          entries={dailyForm.formData.entries}
          date={dailyForm.formData.date}
          projectName={
            projects.find((p) => p.projectId === activeProjectId)?.projectName || ""
          }
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
        />
      )}

      {isWeeklyDetailed && (
        <WeeklyBatchSubmitSummary
          open={showSummary}
          onOpenChange={setShowSummary}
          weekEndingDate={weeklyDetailedForm.formData.weekEndingDate}
          projectName={
            projects.find((p) => p.projectId === activeProjectId)?.projectName || ""
          }
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
          mode="detailed"
          detailedEntries={weeklyDetailedForm.formData.entries}
        />
      )}

      {isWeeklySimple && (
        <WeeklyBatchSubmitSummary
          open={showSummary}
          onOpenChange={setShowSummary}
          weekEndingDate={weeklySimpleForm.formData.weekEndingDate}
          projectName={
            projects.find((p) => p.projectId === activeProjectId)?.projectName || ""
          }
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
          mode="simple"
          simpleEntries={weeklySimpleForm.formData.entries}
        />
      )}
    </div>
  );
}
