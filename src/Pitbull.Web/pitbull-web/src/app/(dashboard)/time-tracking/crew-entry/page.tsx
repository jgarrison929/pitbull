"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useCrewEntryData } from "@/hooks/use-crew-entry-data";
import { useCrewEntryForm } from "@/hooks/use-crew-entry-form";
import { CrewEntryHeader } from "@/components/time-tracking/crew-entry/crew-entry-header";
import { CrewEntryGrid } from "@/components/time-tracking/crew-entry/crew-entry-grid";
import { CrewEntryMobileCards } from "@/components/time-tracking/crew-entry/crew-entry-mobile-cards";
import { BatchSubmitSummary } from "@/components/time-tracking/crew-entry/batch-submit-summary";
import { CopyYesterdayDialog } from "@/components/time-tracking/crew-entry/copy-yesterday-dialog";
import { PayPeriodIndicator } from "@/components/time-tracking/pay-period-indicator";
import { OfflineIndicator } from "@/components/time-tracking/offline-indicator";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ArrowLeft, Users, CalendarDays, List } from "lucide-react";
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
    // Keep max 5 templates, replace if same name
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

export default function CrewEntryPage() {
  const router = useRouter();
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const {
    crew,
    projects,
    equipmentList,
    isLoading: dataLoading,
    error: dataError,
    loadCrew,
    supervisorId,
  } = useCrewEntryData();

  const {
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
  } = useCrewEntryForm({
    crew,
    supervisorId,
    onSuccess: () => {
      setShowSummary(false);
      router.push("/time-tracking");
    },
  });

  // Phases for the selected project
  const [phases, setPhases] = useState<Phase[]>([]);

  // Load crew on mount
  useEffect(() => {
    loadCrew(DEMO_SUPERVISOR_ID);
  }, [loadCrew]);

  // Load phases when project changes
  useEffect(() => {
    let cancelled = false;
    async function fetchPhases() {
      if (!formData.projectId) {
        setPhases([]);
        return;
      }
      try {
        const result = await api<Phase[]>(`/api/projects/${formData.projectId}/phases`);
        if (!cancelled) setPhases(result);
      } catch {
        if (!cancelled) setPhases([]);
      }
    }
    fetchPhases();
    return () => { cancelled = true; };
  }, [formData.projectId]);

  const handleCopyYesterday = async () => {
    setShowCopyDialog(false);
    await copyYesterday();
  };

  const handleSubmit = async () => {
    setShowSummary(false);
    await submit();
  };

  // Set all regular hours to 8
  const handleSetAllRegular8 = useCallback(() => {
    formData.entries.forEach((entry) => {
      updateEntry(entry.employeeId, "regularHours", "8");
    });
    toast.success(`Set all ${formData.entries.length} crew to 8 regular hours`);
  }, [formData.entries, updateEntry]);

  // Save crew template
  const handleSaveTemplate = useCallback(() => {
    const name = `Crew Setup - ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    const template: CrewTemplate = {
      name,
      entries: formData.entries.map((e) => ({
        employeeId: e.employeeId,
        costCodeId: e.costCodeId,
        phaseId: e.phaseId,
        equipmentId: e.equipmentId,
      })),
      savedAt: Date.now(),
    };
    saveCrewTemplate(template);
    toast.success("Crew template saved! It will be available next time.");
  }, [formData.entries]);

  // Loading state
  if (dataLoading) {
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

      {/* Header with Copy Previous Day, progress, templates */}
      <CrewEntryHeader
        crewCount={crew.length}
        totalHours={getTotalHours()}
        entryCount={getEntryCount()}
        onCopyYesterday={() => setShowCopyDialog(true)}
        onReset={reset}
        onSetAllRegular8={handleSetAllRegular8}
        onSaveTemplate={handleSaveTemplate}
        isDirty={isDirty}
      />

      {/* Pay Period Indicator */}
      <PayPeriodIndicator date={formData.date} compact />

      {/* Date/Project Selection */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Entry Details</CardTitle>
          <CardDescription>
            Select the date and project for all time entries
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="date" className="text-sm font-medium">
                Date
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => updateDate(e.target.value)}
                  className="flex min-h-[48px] sm:min-h-[40px] w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 touch-manipulation"
                />
                <div className="flex gap-1 shrink-0">
                  <Button
                    type="button"
                    variant={formData.date === getTodayISO() ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateDate(getTodayISO())}
                    className="min-h-[48px] sm:min-h-[36px] px-2.5 text-xs touch-manipulation"
                  >
                    <CalendarDays className="h-3.5 w-3.5 mr-1" />
                    Today
                  </Button>
                  <Button
                    type="button"
                    variant={formData.date === getYesterdayISO() ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateDate(getYesterdayISO())}
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
            <div className="space-y-2">
              <label htmlFor="project" className="text-sm font-medium">
                Project
              </label>
              <select
                id="project"
                value={formData.projectId}
                onChange={(e) => updateProject(e.target.value)}
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

      {/* Desktop Grid */}
      <div className="hidden md:block">
        <CrewEntryGrid
          entries={formData.entries}
          equipmentList={equipmentList}
          phases={phases}
          onUpdateEntry={updateEntry}
        />
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden">
        <CrewEntryMobileCards
          entries={formData.entries}
          equipmentList={equipmentList}
          phases={phases}
          onUpdateEntry={updateEntry}
        />
      </div>

      {/* Submit Button - Large and prominent */}
      <div className="flex flex-col sm:flex-row justify-end gap-3">
        <Button variant="outline" asChild className="min-h-[48px] touch-manipulation">
          <Link href="/time-tracking">Cancel</Link>
        </Button>
        <Button
          onClick={() => setShowSummary(true)}
          disabled={getEntryCount() === 0 || !formData.projectId}
          className="bg-amber-500 hover:bg-amber-600 text-white min-h-[56px] sm:min-h-[48px] text-lg sm:text-base font-semibold touch-manipulation"
        >
          Review &amp; Submit ({getEntryCount()} entries)
        </Button>
      </div>

      {/* Copy Yesterday Dialog */}
      <CopyYesterdayDialog
        open={showCopyDialog}
        onOpenChange={setShowCopyDialog}
        onConfirm={handleCopyYesterday}
      />

      {/* Submit Summary Dialog */}
      <BatchSubmitSummary
        open={showSummary}
        onOpenChange={setShowSummary}
        entries={formData.entries}
        date={formData.date}
        projectName={
          projects.find((p) => p.projectId === formData.projectId)?.projectName ||
          ""
        }
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
