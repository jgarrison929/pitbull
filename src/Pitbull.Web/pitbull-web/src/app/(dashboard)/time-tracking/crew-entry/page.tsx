"use client";

import { useEffect, useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ArrowLeft, Users } from "lucide-react";

// For demo purposes - in production this would come from auth context
const DEMO_SUPERVISOR_ID = "00000000-0000-0000-0000-000000000001";

export default function CrewEntryPage() {
  const router = useRouter();
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const {
    crew,
    projects,
    costCodes,
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

  // Load crew on mount
  useEffect(() => {
    // In production, get supervisorId from auth context
    loadCrew(DEMO_SUPERVISOR_ID);
  }, [loadCrew]);

  const handleCopyYesterday = async () => {
    setShowCopyDialog(false);
    await copyYesterday();
  };

  const handleSubmit = async () => {
    setShowSummary(false);
    await submit();
  };

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
          <Button variant="ghost" size="icon" asChild>
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
          <Button variant="ghost" size="icon" asChild>
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
                You don't have any crew members assigned to you yet. Contact your
                administrator to assign employees to your supervision.
              </p>
              <Button asChild className="mt-6">
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
      {/* Header */}
      <CrewEntryHeader
        crewCount={crew.length}
        totalHours={getTotalHours()}
        entryCount={getEntryCount()}
        onCopyYesterday={() => setShowCopyDialog(true)}
        onReset={reset}
        isDirty={isDirty}
      />

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
              <input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => updateDate(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
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
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
          costCodes={costCodes}
          onUpdateEntry={updateEntry}
        />
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden">
        <CrewEntryMobileCards
          entries={formData.entries}
          costCodes={costCodes}
          onUpdateEntry={updateEntry}
        />
      </div>

      {/* Submit Button */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href="/time-tracking">Cancel</Link>
        </Button>
        <Button
          onClick={() => setShowSummary(true)}
          disabled={getEntryCount() === 0 || !formData.projectId}
          className="bg-amber-500 hover:bg-amber-600 text-white"
        >
          Review & Submit ({getEntryCount()} entries)
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
        costCodes={costCodes}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
