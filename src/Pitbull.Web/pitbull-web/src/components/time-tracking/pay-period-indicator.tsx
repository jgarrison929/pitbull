"use client";

import { useEffect, useState } from "react";
import { format, parseISO, differenceInDays, isAfter } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, AlertTriangle, Lock, Clock } from "lucide-react";
import { getCurrentPayPeriod } from "@/lib/pay-periods-api";
import type { PayPeriod } from "@/types/pay-period.types";
import { getStatusColor, getStatusLabel } from "@/types/pay-period.types";

interface PayPeriodIndicatorProps {
  date?: string;
  showWarningDays?: number;
  compact?: boolean;
}

export function PayPeriodIndicator({
  date,
  showWarningDays = 2,
  compact = false,
}: PayPeriodIndicatorProps) {
  const [period, setPeriod] = useState<PayPeriod | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPeriod = async () => {
      setIsLoading(true);
      try {
        const data = await getCurrentPayPeriod(date);
        setPeriod(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load pay period");
      } finally {
        setIsLoading(false);
      }
    };
    loadPeriod();
  }, [date]);

  if (isLoading) {
    return <Skeleton className={compact ? "h-6 w-48" : "h-16 w-full"} />;
  }

  if (error || !period) {
    return null; // Silent fail
  }

  const startDate = parseISO(period.startDate);
  const endDate = parseISO(period.endDate);
  const today = new Date();
  const daysUntilEnd = differenceInDays(endDate, today);
  const totalDays = differenceInDays(endDate, startDate) + 1;
  const daysElapsed = Math.max(0, Math.min(totalDays, differenceInDays(today, startDate) + 1));
  const progressPercent = totalDays > 0 ? (daysElapsed / totalDays) * 100 : 0;
  const isPeriodEnding = daysUntilEnd >= 0 && daysUntilEnd <= showWarningDays;
  const isPastPeriod = isAfter(today, endDate);

  // Check if selected date is outside current period
  const isDateOutsidePeriod = date
    ? isAfter(parseISO(date), endDate) || isAfter(startDate, parseISO(date))
    : false;

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm p-3 bg-muted/50 rounded-lg">
        <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-muted-foreground">Pay Period:</span>
        <span className="font-semibold">
          {format(startDate, "MMM d")} – {format(endDate, "MMM d")}
        </span>
        <Badge className={getStatusColor(period.status)}>
          {getStatusLabel(period.status)}
        </Badge>

        {/* Countdown */}
        {daysUntilEnd >= 0 && !period.isLocked && (
          <Badge
            variant="outline"
            className={`${
              isPeriodEnding
                ? "text-amber-600 border-amber-300 bg-amber-50"
                : "text-muted-foreground"
            }`}
          >
            <Clock className="h-3 w-3 mr-1" />
            {daysUntilEnd === 0
              ? "Closes today"
              : `${daysUntilEnd} day${daysUntilEnd > 1 ? "s" : ""} left`}
          </Badge>
        )}

        {period.isLocked && (
          <Badge variant="destructive" className="gap-1">
            <Lock className="h-3 w-3" />
            Locked
          </Badge>
        )}

        {isDateOutsidePeriod && (
          <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 gap-1">
            <AlertTriangle className="h-3 w-3" />
            Outside period
          </Badge>
        )}
      </div>
    );
  }

  // Full display
  if (period.isLocked) {
    return (
      <Alert variant="destructive">
        <Lock className="h-4 w-4" />
        <AlertTitle>Pay Period Locked</AlertTitle>
        <AlertDescription>
          The pay period <strong>{period.label}</strong> is locked. Time entries
          for dates within this period cannot be created or modified.
          {period.lockedByName && (
            <span className="block mt-1 text-sm">
              Locked by {period.lockedByName}
              {period.lockedAt && ` on ${format(parseISO(period.lockedAt), "MMM d, yyyy")}`}
            </span>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (isDateOutsidePeriod && date) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Outside Current Pay Period</AlertTitle>
        <AlertDescription>
          The selected date ({format(parseISO(date), "MMM d, yyyy")}) is outside the current
          pay period ({period.label}). This entry may need special approval.
        </AlertDescription>
      </Alert>
    );
  }

  if (isPastPeriod) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Past Pay Period</AlertTitle>
        <AlertDescription>
          You are entering time for a date in a past pay period ({period.label}).
          This period may be locked soon.
        </AlertDescription>
      </Alert>
    );
  }

  if (isPeriodEnding) {
    return (
      <Alert>
        <Clock className="h-4 w-4" />
        <AlertTitle>Pay Period Ending Soon</AlertTitle>
        <AlertDescription>
          The current pay period ({period.label}) ends{" "}
          {daysUntilEnd === 0 ? "today" : `in ${daysUntilEnd} day${daysUntilEnd > 1 ? "s" : ""}`}.
          Make sure all time entries are submitted before the period is locked.
        </AlertDescription>
      </Alert>
    );
  }

  // Normal state - enhanced with progress bar and prominent dates
  return (
    <div className="p-4 bg-muted/50 rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <span className="font-semibold">Current Pay Period</span>
          <Badge className={getStatusColor(period.status)}>
            {getStatusLabel(period.status)}
          </Badge>
        </div>
        {daysUntilEnd >= 0 && (
          <span className="text-sm font-medium text-muted-foreground">
            {daysUntilEnd + 1} day{daysUntilEnd !== 0 ? "s" : ""} remaining
          </span>
        )}
      </div>

      {/* Prominent dates */}
      <div className="flex items-center gap-3 text-sm">
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Start:</span>
          <span className="font-medium">{format(startDate, "EEEE, MMMM d")}</span>
        </div>
        <span className="text-muted-foreground">→</span>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">End:</span>
          <span className="font-medium">{format(endDate, "EEEE, MMMM d, yyyy")}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <Progress
          value={progressPercent}
          className={`h-2 ${isPeriodEnding ? "[&>div]:bg-amber-500" : ""}`}
        />
        <p className="text-xs text-muted-foreground">
          Day {daysElapsed} of {totalDays}
        </p>
      </div>
    </div>
  );
}
