"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Copy, RotateCcw, Users, Clock } from "lucide-react";

interface CrewEntryHeaderProps {
  crewCount: number;
  totalHours: number;
  entryCount: number;
  onCopyYesterday: () => void;
  onReset: () => void;
  isDirty: boolean;
}

export function CrewEntryHeader({
  crewCount,
  totalHours,
  entryCount,
  onCopyYesterday,
  onReset,
  isDirty,
}: CrewEntryHeaderProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild title="Back to Time Tracking">
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

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Stats */}
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>
              <span className="font-medium">{crewCount}</span> crew members
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>
              <span className="font-medium">{totalHours.toFixed(1)}</span> total
              hours
            </span>
          </div>
          <div className="hidden sm:block text-muted-foreground">
            {entryCount} {entryCount === 1 ? "entry" : "entries"} to submit
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCopyYesterday}
            className="gap-2"
          >
            <Copy className="h-4 w-4" />
            <span className="hidden sm:inline">Copy Yesterday</span>
            <span className="sm:hidden">Copy</span>
          </Button>
          {isDirty && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="gap-2 text-muted-foreground"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">Reset</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
