"use client";

import * as React from "react";
import { Check, Circle, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepStatus = "completed" | "current" | "upcoming" | "overdue";

export interface WorkflowStep {
  label: string;
  status: StepStatus;
  description?: string;
  timestamp?: string;
}

export interface WorkflowStepperProps {
  steps: WorkflowStep[];
  orientation?: "horizontal" | "vertical";
  className?: string;
}

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case "completed":
      return (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
          <Check className="h-4 w-4" />
        </div>
      );
    case "current":
      return (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 ring-2 ring-blue-400/50 animate-pulse dark:bg-blue-900/30 dark:text-blue-400 dark:ring-blue-500/30">
          <Circle className="h-4 w-4 fill-current" />
        </div>
      );
    case "overdue":
      return (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
          <AlertTriangle className="h-4 w-4" />
        </div>
      );
    case "upcoming":
    default:
      return (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Clock className="h-4 w-4" />
        </div>
      );
  }
}

function StepConnector({
  status,
  orientation,
}: {
  status: "completed" | "pending";
  orientation: "horizontal" | "vertical";
}) {
  if (orientation === "vertical") {
    return (
      <div
        className={cn(
          "ml-[15px] w-0.5 min-h-[24px]",
          status === "completed" ? "bg-green-400 dark:bg-green-600" : "bg-border"
        )}
      />
    );
  }
  return (
    <div
      className={cn(
        "hidden sm:block h-0.5 flex-1 min-w-[16px]",
        status === "completed" ? "bg-green-400 dark:bg-green-600" : "bg-border"
      )}
    />
  );
}

function statusTextColor(status: StepStatus) {
  switch (status) {
    case "completed":
      return "text-green-700 dark:text-green-400";
    case "current":
      return "text-blue-700 dark:text-blue-400 font-semibold";
    case "overdue":
      return "text-red-700 dark:text-red-400";
    case "upcoming":
    default:
      return "text-muted-foreground";
  }
}

const WorkflowStepper = React.forwardRef<HTMLDivElement, WorkflowStepperProps>(
  ({ steps, orientation = "horizontal", className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          orientation === "horizontal"
            ? "flex items-start gap-0 overflow-x-auto pb-2"
            : "flex flex-col gap-0",
          className
        )}
        role="list"
        aria-label="Workflow progress"
      >
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const connectorStatus =
            step.status === "completed" ? "completed" : "pending";

          return (
            <React.Fragment key={step.label}>
              <div
                role="listitem"
                className={cn(
                  "flex shrink-0",
                  orientation === "horizontal"
                    ? "flex-col items-center gap-1.5 min-w-[80px]"
                    : "flex-row items-start gap-3"
                )}
              >
                <StepIcon status={step.status} />
                <div
                  className={cn(
                    orientation === "horizontal"
                      ? "text-center"
                      : "pt-1 pb-2"
                  )}
                >
                  <p className={cn("text-xs", statusTextColor(step.status))}>
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {step.description}
                    </p>
                  )}
                  {step.timestamp && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                      {step.timestamp}
                    </p>
                  )}
                </div>
              </div>
              {!isLast && (
                <StepConnector
                  status={connectorStatus as "completed" | "pending"}
                  orientation={orientation}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }
);
WorkflowStepper.displayName = "WorkflowStepper";

export { WorkflowStepper };
