"use client";

import { useState } from "react";
import {
  Clock,
  FileText,
  AlertTriangle,
  Check,
  X,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { toast } from "sonner";

export interface ParsedDataEntry {
  entityType: "TimeEntry" | "DailyReport";
  fields: Record<string, unknown>;
  confidenceScore: number;
  originalText: string;
  summary: string;
  warnings: string[];
  requiresConfirmation: boolean;
}

interface ExecuteResult {
  entityType: string;
  entityId: string;
  summary: string;
}

const ENTITY_CONFIG = {
  TimeEntry: {
    icon: Clock,
    borderColor: "border-l-blue-500",
    label: "Time Entry",
    href: "/time-tracking",
  },
  DailyReport: {
    icon: FileText,
    borderColor: "border-l-green-500",
    label: "Daily Report",
    href: "/daily-reports",
  },
} as const;

const FIELD_LABELS: Record<string, string> = {
  employeeName: "Employee",
  employeeId: "Employee ID",
  projectName: "Project",
  projectId: "Project ID",
  costCodeDescription: "Cost Code",
  costCodeId: "Cost Code ID",
  date: "Date",
  regularHours: "Regular Hours",
  overtimeHours: "Overtime Hours",
  doubletimeHours: "Double Time Hours",
  description: "Description",
  weather: "Weather",
  manpower: "Manpower",
  activities: "Activities",
  safetyNotes: "Safety Notes",
};

function getConfidenceColor(score: number): string {
  if (score >= 0.8) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200";
  if (score >= 0.5) return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200";
  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200";
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function isEditableField(key: string): boolean {
  // Skip ID fields and internal fields from editing
  return !key.endsWith("Id") && key !== "entityType";
}

export function DataEntryConfirmation({
  entry,
  onConfirmed,
  onCancelled,
}: {
  entry: ParsedDataEntry;
  onConfirmed?: (result: ExecuteResult) => void;
  onCancelled?: () => void;
}) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [result, setResult] = useState<ExecuteResult | null>(null);
  const [editedFields, setEditedFields] = useState<Record<string, unknown>>({ ...entry.fields });

  const config = ENTITY_CONFIG[entry.entityType];
  const Icon = config.icon;

  const handleConfirm = async () => {
    setIsExecuting(true);
    try {
      const executeResult = await api<ExecuteResult>("/api/data-entry/execute", {
        method: "POST",
        body: {
          entityType: entry.entityType,
          fields: editedFields,
          originalText: entry.originalText,
        },
      });
      setResult(executeResult);
      setIsDone(true);
      toast.success(executeResult.summary || `${config.label} created successfully`);
      onConfirmed?.(executeResult);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create entry";
      toast.error(message);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleFieldChange = (key: string, value: string) => {
    setEditedFields((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  if (isDone && result) {
    return (
      <Card className={cn("border-l-4", config.borderColor, "bg-green-50/50 dark:bg-green-950/20")}>
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              {config.label} created
            </span>
            <a
              href={config.href}
              className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 ml-auto"
            >
              View
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-l-4", config.borderColor)}>
      <CardContent className="py-3 px-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Create {config.label}</span>
          </div>
          <Badge className={cn("text-[10px]", getConfidenceColor(entry.confidenceScore))}>
            {Math.round(entry.confidenceScore * 100)}% confidence
          </Badge>
        </div>

        {/* Summary */}
        <p className="text-xs text-muted-foreground">{entry.summary}</p>

        {/* Warnings */}
        {entry.warnings.length > 0 && (
          <div className="space-y-1.5">
            {entry.warnings.map((warning, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-2.5 py-1.5 dark:border-amber-900 dark:bg-amber-950/30"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300">{warning}</p>
              </div>
            ))}
          </div>
        )}

        {/* Fields */}
        <div className="space-y-2 rounded-lg border p-3">
          {Object.entries(editedFields).map(([key, value]) => {
            if (!isEditableField(key)) return null;
            const label = FIELD_LABELS[key] || key.replace(/([A-Z])/g, " $1").trim();

            return (
              <div key={key} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-28 flex-shrink-0">
                  {label}
                </span>
                <Input
                  value={formatFieldValue(value)}
                  onChange={(e) => handleFieldChange(key, e.target.value)}
                  className="h-7 text-xs"
                />
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancelled}
            disabled={isExecuting}
            className="h-7 text-xs"
          >
            <X className="mr-1.5 h-3 w-3" />
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={isExecuting}
            className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-white"
          >
            {isExecuting ? (
              <>
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check className="mr-1.5 h-3 w-3" />
                Confirm &amp; Create
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
