"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Copy,
  RotateCcw,
  Users,
  Clock,
  Save,
  Timer,
} from "lucide-react";

interface CrewEntryHeaderProps {
  crewCount: number;
  totalHours: number;
  entryCount: number;
  onCopyYesterday: () => void;
  onReset: () => void;
  onSetAllRegular8?: () => void;
  onSaveTemplate?: () => void;
  isDirty: boolean;
}

export function CrewEntryHeader({
  crewCount,
  totalHours,
  entryCount,
  onCopyYesterday,
  onReset,
  onSetAllRegular8,
  onSaveTemplate,
  isDirty,
}: CrewEntryHeaderProps) {
  const progressPercent = crewCount > 0 ? (entryCount / crewCount) * 100 : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Title Row */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild title="Back to Time Tracking" className="min-h-[44px] min-w-[44px]">
          <Link href="/time-tracking">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Crew Time Entry</h1>
          <p className="text-muted-foreground">
            Enter time for your entire crew at once
          </p>
        </div>
      </div>

      {/* COPY PREVIOUS DAY - THE most prominent action */}
      <Button
        onClick={onCopyYesterday}
        className="w-full min-h-[56px] sm:min-h-[48px] bg-blue-600 hover:bg-blue-700 text-white text-lg sm:text-base font-semibold gap-3 shadow-md touch-manipulation"
      >
        <Copy className="h-5 w-5" />
        Copy Previous Day
      </Button>

      {/* Quick Actions Row */}
      <div className="flex flex-wrap gap-2">
        {onSetAllRegular8 && (
          <Button
            variant="outline"
            size="sm"
            onClick={onSetAllRegular8}
            className="min-h-[44px] gap-2 flex-1 sm:flex-none touch-manipulation"
          >
            <Timer className="h-4 w-4" />
            Set All to 8 Hrs
          </Button>
        )}
        {onSaveTemplate && (
          <Button
            variant="outline"
            size="sm"
            onClick={onSaveTemplate}
            className="min-h-[44px] gap-2 flex-1 sm:flex-none touch-manipulation"
            disabled={!isDirty}
          >
            <Save className="h-4 w-4" />
            Save Template
          </Button>
        )}
        {isDirty && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="min-h-[44px] gap-2 text-muted-foreground touch-manipulation"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        )}
      </div>

      {/* Progress Indicator + Stats */}
      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              <span className="text-amber-600">{entryCount}</span> of {crewCount} crew entered
            </span>
            <span className="text-muted-foreground">{Math.round(progressPercent)}%</span>
          </div>
          <Progress value={progressPercent} className="h-2.5" />
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>
              <span className="font-medium">{crewCount}</span> crew
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>
              <span className="font-medium">{totalHours.toFixed(1)}</span> total hours
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
