import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Activity,
  Calendar,
  FolderOpen,
  Clock,
  PieChart,
  MessageCircle,
  TrendingUp,
  Wrench,
  AlertTriangle,
} from "lucide-react";

export type WidgetSize = "small" | "medium" | "large";

export interface WidgetConfig {
  id: string;
  type: string;
  row: number;
  col: number;
  width: number;
  height: number;
  visible: boolean;
  config?: string | null;
}

// Helpers for converting between width values and size labels
export function widthToSize(width: number): WidgetSize {
  if (width >= 4) return "large";
  if (width >= 2) return "medium";
  return "small";
}

export function sizeToWidth(size: WidgetSize): number {
  switch (size) {
    case "large": return 4;
    case "medium": return 2;
    case "small": return 1;
  }
}

export interface WidgetDefinition {
  type: string;
  label: string;
  description: string;
  icon: LucideIcon;
  defaultSize: WidgetSize;
  category: "metrics" | "activity" | "projects" | "financial";
}

export const WIDGET_DEFINITIONS: WidgetDefinition[] = [
  {
    type: "kpi-cards",
    label: "KPI Cards",
    description: "Key metrics: active projects, hours, approvals, RFIs",
    icon: BarChart3,
    defaultSize: "large",
    category: "metrics",
  },
  {
    type: "recent-activity",
    label: "Recent Activity",
    description: "Latest actions across all projects",
    icon: Activity,
    defaultSize: "medium",
    category: "activity",
  },
  {
    type: "upcoming-deadlines",
    label: "Upcoming Deadlines",
    description: "RFI due dates, submittal deadlines, milestones",
    icon: Calendar,
    defaultSize: "medium",
    category: "projects",
  },
  {
    type: "project-status",
    label: "Project Budget Health",
    description: "Budget utilization and health across projects",
    icon: FolderOpen,
    defaultSize: "medium",
    category: "projects",
  },
  {
    type: "time-entry-summary",
    label: "Weekly Hours Trend",
    description: "Hours logged this week and trend over time",
    icon: Clock,
    defaultSize: "medium",
    category: "metrics",
  },
  {
    type: "cost-breakdown",
    label: "Cost Breakdown",
    description: "Labor vs equipment cost split this month",
    icon: PieChart,
    defaultSize: "small",
    category: "financial",
  },
  {
    type: "rfis-attention",
    label: "RFIs Needing Attention",
    description: "Overdue RFIs and items in your court",
    icon: MessageCircle,
    defaultSize: "medium",
    category: "projects",
  },
  {
    type: "recent-time-entries",
    label: "Recent Time Entries",
    description: "Latest time entries with status",
    icon: Clock,
    defaultSize: "small",
    category: "activity",
  },
  {
    type: "quick-actions",
    label: "Quick Actions",
    description: "Shortcuts to common tasks",
    icon: TrendingUp,
    defaultSize: "large",
    category: "activity",
  },
  {
    type: "equipment-utilization",
    label: "Equipment Utilization",
    description: "Equipment usage and hours this month",
    icon: Wrench,
    defaultSize: "small",
    category: "metrics",
  },
  {
    type: "cost-forecast",
    label: "Cost Forecast",
    description: "Projected vs actual costs for active projects",
    icon: AlertTriangle,
    defaultSize: "small",
    category: "financial",
  },
];

export function getWidgetDefinition(type: string): WidgetDefinition | undefined {
  return WIDGET_DEFINITIONS.find((w) => w.type === type);
}

export type DashboardTemplate = "default" | "pm" | "controller" | "executive" | "field" | "estimator";

export const ROLE_TEMPLATES: Record<DashboardTemplate, WidgetConfig[]> = {
  default: [
    { id: "w-1", type: "kpi-cards", row: 0, col: 0, width: 4, height: 1, visible: true, config: null },
    { id: "w-2", type: "quick-actions", row: 1, col: 0, width: 4, height: 1, visible: true, config: null },
    { id: "w-3", type: "project-status", row: 2, col: 0, width: 2, height: 2, visible: true, config: null },
    { id: "w-4", type: "time-entry-summary", row: 2, col: 2, width: 2, height: 2, visible: true, config: null },
    { id: "w-5", type: "upcoming-deadlines", row: 4, col: 0, width: 2, height: 2, visible: true, config: null },
    { id: "w-6", type: "recent-activity", row: 4, col: 2, width: 2, height: 2, visible: true, config: null },
  ],
  pm: [
    { id: "w-1", type: "kpi-cards", row: 0, col: 0, width: 4, height: 1, visible: true, config: null },
    { id: "w-2", type: "quick-actions", row: 1, col: 0, width: 4, height: 1, visible: true, config: null },
    { id: "w-3", type: "rfis-attention", row: 2, col: 0, width: 2, height: 2, visible: true, config: null },
    { id: "w-4", type: "upcoming-deadlines", row: 2, col: 2, width: 2, height: 2, visible: true, config: null },
    { id: "w-5", type: "project-status", row: 4, col: 0, width: 2, height: 2, visible: true, config: null },
    { id: "w-6", type: "recent-activity", row: 4, col: 2, width: 2, height: 2, visible: true, config: null },
  ],
  controller: [
    { id: "w-1", type: "kpi-cards", row: 0, col: 0, width: 4, height: 1, visible: true, config: null },
    { id: "w-2", type: "cost-breakdown", row: 1, col: 0, width: 2, height: 2, visible: true, config: null },
    { id: "w-3", type: "cost-forecast", row: 1, col: 2, width: 2, height: 2, visible: true, config: null },
    { id: "w-4", type: "project-status", row: 3, col: 0, width: 2, height: 2, visible: true, config: null },
    { id: "w-5", type: "time-entry-summary", row: 3, col: 2, width: 2, height: 2, visible: true, config: null },
    { id: "w-6", type: "recent-activity", row: 5, col: 0, width: 4, height: 2, visible: true, config: null },
  ],
  executive: [
    { id: "w-1", type: "kpi-cards", row: 0, col: 0, width: 4, height: 1, visible: true, config: null },
    { id: "w-2", type: "project-status", row: 1, col: 0, width: 4, height: 2, visible: true, config: null },
    { id: "w-3", type: "cost-forecast", row: 3, col: 0, width: 2, height: 2, visible: true, config: null },
    { id: "w-4", type: "time-entry-summary", row: 3, col: 2, width: 2, height: 2, visible: true, config: null },
  ],
  field: [
    { id: "w-1", type: "kpi-cards", row: 0, col: 0, width: 4, height: 1, visible: true, config: null },
    { id: "w-2", type: "quick-actions", row: 1, col: 0, width: 4, height: 1, visible: true, config: null },
    { id: "w-3", type: "recent-time-entries", row: 2, col: 0, width: 2, height: 2, visible: true, config: null },
    { id: "w-4", type: "equipment-utilization", row: 2, col: 2, width: 2, height: 2, visible: true, config: null },
  ],
  estimator: [
    { id: "w-1", type: "kpi-cards", row: 0, col: 0, width: 4, height: 1, visible: true, config: null },
    { id: "w-2", type: "quick-actions", row: 1, col: 0, width: 4, height: 1, visible: true, config: null },
    { id: "w-3", type: "upcoming-deadlines", row: 2, col: 0, width: 2, height: 2, visible: true, config: null },
    { id: "w-4", type: "recent-activity", row: 2, col: 2, width: 2, height: 2, visible: true, config: null },
  ],
};
