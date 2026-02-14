"use client";

import { useEffect, useState } from "react";
import { format, parseISO, differenceInDays, isAfter } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, AlertTriangle, Lock, Clock } from "lucide-react";
import { getCurrentPayPeriod } from "@/lib/pay-periods-api";
import type { PayPeriod } from "@/types/pay-period.types";
import { getStatusColor, getStatusLabel } from "@/types/pay-period.types";

interface PayPeriodIndicatorProps {
  date?: string;
  showWarningDays?: number; // Show warning if this many days until period ends
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
    return null; // Silent fail - don't block time entry if pay period service is down
  }

  const endDate = parseISO(period.endDate);
  const today = new Date();
  const daysUntilEnd = differenceInDays(endDate, today);
  const isPeriodEnding = daysUntilEnd >= 0 && daysUntilEnd <= showWarningDays;
  const isPastPeriod = isAfter(today, endDate);

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">Pay Period:</span>
        <span className="font-medium">{period.label}</span>
        <Badge className={getStatusColor(period.status)}>
          {getStatusLabel(period.status)}
        </Badge>
        {isPeriodEnding && !period.isLocked && (
          <Badge variant="outline" className="text-amber-600 border-amber-300">
            <Clock className="h-3 w-3 mr-1" />
            {daysUntilEnd === 0 ? "Ends today" : `${daysUntilEnd}d left`}
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

  // Normal state - show current period info
  return (
    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
      <Calendar className="h-5 w-5 text-muted-foreground" />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">Current Pay Period</span>
          <Badge className={getStatusColor(period.status)}>
            {getStatusLabel(period.status)}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {format(parseISO(period.startDate), "MMMM d")} -{" "}
          {format(parseISO(period.endDate), "MMMM d, yyyy")}
          <span className="mx-2">·</span>
          {daysUntilEnd >= 0 ? `${daysUntilEnd + 1} days remaining` : "Period ended"}
        </p>
      </div>
    </div>
  );
}
