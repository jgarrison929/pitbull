"use client";

import { useCallback, useRef, useState } from "react";
import { GripVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  KpiCardsWidget,
  QuickActionsWidget,
  ProjectStatusWidget,
  TimeEntrySummaryWidget,
  UpcomingDeadlinesWidget,
  RecentActivityWidget,
  type WidgetConfig,
} from "./widgets";
import { CostBreakdownWidget } from "./cost-breakdown-widget";
import { RfisNeedingAttention } from "./rfis-needing-attention";
import { RecentTimeEntriesWidget } from "./recent-time-entries-widget";
import { EquipmentUtilizationWidget } from "./equipment-utilization-widget";
import { CostForecastSummaryWidget } from "./widgets/cost-forecast-summary-widget";

interface DashboardAnalytics {
  activeProjects: number;
  totalEmployees: number;
  hoursThisWeek: number;
  hoursLastWeek: number;
  pendingApprovals: number;
  openRFIs: number;
  upcomingDeadlines: {
    date: string;
    projectName: string;
    milestone: string;
    daysRemaining: number;
  }[];
  recentActivity: {
    user: string;
    action: string;
    entity: string;
    timestamp: string;
    resourceId?: string | null;
    description?: string | null;
  }[];
  projectBudgetHealth: {
    name: string;
    budget: number;
    spent: number;
    percentUsed: number;
  }[];
  laborHoursTrend: { weekStart: string; totalHours: number }[];
}

interface WidgetGridProps {
  widgets: WidgetConfig[];
  data: DashboardAnalytics | null;
  isLoading: boolean;
  isEditing: boolean;
  onReorder: (widgets: WidgetConfig[]) => void;
  onRemove: (widgetId: string) => void;
}

function widthToClass(width: number): string {
  if (width >= 4) return "col-span-1 lg:col-span-2";
  return "col-span-1";
}

function renderWidget(
  widget: WidgetConfig,
  data: DashboardAnalytics | null,
  isLoading: boolean
) {
  switch (widget.type) {
    case "kpi-cards":
      return <KpiCardsWidget data={data} isLoading={isLoading} />;
    case "quick-actions":
      return <QuickActionsWidget pendingApprovals={data?.pendingApprovals ?? 0} />;
    case "project-status":
      return (
        <ProjectStatusWidget
          data={data?.projectBudgetHealth}
          isLoading={isLoading}
        />
      );
    case "time-entry-summary":
      return (
        <TimeEntrySummaryWidget
          data={data?.laborHoursTrend}
          isLoading={isLoading}
        />
      );
    case "upcoming-deadlines":
      return (
        <UpcomingDeadlinesWidget
          data={data?.upcomingDeadlines}
          isLoading={isLoading}
        />
      );
    case "recent-activity":
      return (
        <RecentActivityWidget
          data={data?.recentActivity}
          isLoading={isLoading}
        />
      );
    case "cost-breakdown":
      return <CostBreakdownWidget />;
    case "rfis-attention":
      return <RfisNeedingAttention />;
    case "recent-time-entries":
      return <RecentTimeEntriesWidget />;
    case "equipment-utilization":
      return <EquipmentUtilizationWidget />;
    case "cost-forecast":
      return <CostForecastSummaryWidget />;
    default:
      return (
        <div className="rounded-lg border p-6 text-center text-muted-foreground">
          Unknown widget: {widget.type}
        </div>
      );
  }
}

export function WidgetGrid({
  widgets,
  data,
  isLoading,
  isEditing,
  onReorder,
  onRemove,
}: WidgetGridProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const dragRef = useRef<number | null>(null);

  const visibleWidgets = widgets
    .filter((w) => w.visible)
    .sort((a, b) => a.row - b.row || a.col - b.col);

  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      if (!isEditing) return;
      dragRef.current = index;
      setDragIndex(index);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
    },
    [isEditing]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      if (!isEditing) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setOverIndex(index);
    },
    [isEditing]
  );

  const handleDragLeave = useCallback(() => {
    setOverIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();
      setDragIndex(null);
      setOverIndex(null);

      const fromIndex = dragRef.current;
      if (fromIndex === null || fromIndex === dropIndex) return;

      const reordered = [...visibleWidgets];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(dropIndex, 0, moved);

      // Recalculate row/col positions based on new visual order
      let currentRow = 0;
      let currentCol = 0;
      const positions = reordered.map((w) => {
        if (currentCol + w.width > 4) {
          currentRow += 1;
          currentCol = 0;
        }
        const pos = { id: w.id, row: currentRow, col: currentCol };
        currentCol += w.width;
        if (currentCol >= 4) {
          currentRow += 1;
          currentCol = 0;
        }
        return pos;
      });

      const updated = widgets.map((w) => {
        const pos = positions.find((p) => p.id === w.id);
        if (!pos) return w;
        return { ...w, row: pos.row, col: pos.col };
      });

      onReorder(updated);
    },
    [widgets, visibleWidgets, onReorder]
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setOverIndex(null);
    dragRef.current = null;
  }, []);

  if (visibleWidgets.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed p-12 text-center">
        <p className="text-muted-foreground">
          No widgets visible. Click &quot;Customize&quot; to add widgets.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {visibleWidgets.map((widget, index) => (
        <div
          key={widget.id}
          className={`${widthToClass(widget.width)} relative ${
            isEditing ? "group" : ""
          } ${
            dragIndex === index ? "opacity-50" : ""
          } ${
            overIndex === index ? "ring-2 ring-amber-500 ring-offset-2 rounded-lg" : ""
          } transition-all`}
          draggable={isEditing}
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, index)}
          onDragEnd={handleDragEnd}
        >
          {isEditing && (
            <div className="absolute -top-2 -left-2 z-10 flex items-center gap-1">
              <div className="flex items-center gap-0.5 rounded-md bg-background border shadow-sm px-1.5 py-1 cursor-grab active:cursor-grabbing">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">
                  Drag
                </span>
              </div>
            </div>
          )}
          {isEditing && (
            <Button
              variant="destructive"
              size="sm"
              className="absolute -top-2 -right-2 z-10 h-6 w-6 p-0 rounded-full shadow-sm"
              onClick={() => onRemove(widget.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
          {renderWidget(widget, data, isLoading)}
        </div>
      ))}
    </div>
  );
}
