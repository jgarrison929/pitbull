"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  RefreshCw,
  AlertTriangle,
  LayoutDashboard,
  ChevronDown,
  Settings2,
  RotateCcw,
} from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";
import { useCompany } from "@/contexts/company-context";
import { OnboardingChecklist } from "@/components/onboarding/onboarding-checklist";
import { WelcomeTour } from "@/components/onboarding/welcome-tour";
import { PmDashboard } from "@/components/dashboard/role-views/pm-dashboard";
import { ControllerDashboard } from "@/components/dashboard/role-views/controller-dashboard";
import { FieldDashboard } from "@/components/dashboard/role-views/field-dashboard";
import { ExecutiveDashboard } from "@/components/dashboard/role-views/executive-dashboard";
import { WidgetGrid } from "@/components/dashboard/widget-grid";
import { CustomizeDialog } from "@/components/dashboard/customize-dialog";
import {
  ROLE_TEMPLATES,
  sizeToWidth,
  type WidgetConfig,
  type WidgetDefinition,
  type DashboardTemplate,
} from "@/components/dashboard/widgets";

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

interface DashboardPreferences {
  layout: string;
  widgets?: WidgetConfig[];
}

interface OnboardingStatus {
  hasCompany: boolean;
  isSetupComplete: boolean;
  isChecklistDismissed: boolean;
}

const LAYOUT_LABELS: Record<string, string> = {
  default: "Overview",
  pm: "PM View",
  controller: "Controller",
  field: "Field",
  executive: "Executive",
};

export default function DashboardPage() {
  const { activeCompany } = useCompany();
  const router = useRouter();
  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [setupIncomplete, setSetupIncomplete] = useState(false);
  const [dashboardLayout, setDashboardLayout] = useState<string>("default");
  const [widgets, setWidgets] = useState<WidgetConfig[]>(
    ROLE_TEMPLATES.default
  );
  const [isEditing, setIsEditing] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);

  // Gate: redirect to setup wizard if onboarding is not complete
  useEffect(() => {
    let cancelled = false;
    async function checkSetup() {
      try {
        const status = await api<OnboardingStatus>("/api/onboarding/status");
        if (!cancelled && !status.isSetupComplete) {
          router.replace("/settings/company/setup");
          setSetupIncomplete(true);
        }
      } catch {
        // If endpoint fails, don't block the dashboard
      }
    }
    checkSetup();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Load saved dashboard preferences (layout + widgets)
  useEffect(() => {
    async function loadPref() {
      try {
        const pref = await api<DashboardPreferences>(
          "/api/dashboard/preferences"
        );
        if (pref.layout) setDashboardLayout(pref.layout);
        if (pref.widgets && pref.widgets.length > 0) {
          setWidgets(pref.widgets);
        } else if (pref.layout && pref.layout in ROLE_TEMPLATES) {
          setWidgets(
            ROLE_TEMPLATES[pref.layout as DashboardTemplate]
          );
        }
      } catch {
        // Preference endpoint unavailable -- use defaults
      }
    }
    loadPref();
  }, []);

  // Debounced save of widget configuration
  const saveWidgets = useCallback(
    (newWidgets: WidgetConfig[]) => {
      if (saveTimeout) clearTimeout(saveTimeout);
      const timeout = setTimeout(async () => {
        try {
          await api("/api/dashboard/preferences/widgets", {
            method: "PUT",
            body: { widgets: newWidgets },
          });
        } catch {
          // Silent save failure
        }
      }, 1000);
      setSaveTimeout(timeout);
    },
    [saveTimeout]
  );

  const switchLayout = useCallback(
    async (layout: string) => {
      setDashboardLayout(layout);
      // When switching to a role view, load that template's widgets
      if (layout in ROLE_TEMPLATES) {
        setWidgets(ROLE_TEMPLATES[layout as DashboardTemplate]);
      }
      try {
        await api("/api/dashboard/preferences", {
          method: "PUT",
          body: { layout },
        });
      } catch {
        // Save failed -- layout still switches locally
      }
    },
    []
  );

  const fetchAnalytics = useCallback(async () => {
    try {
      const result = await api<DashboardAnalytics>(
        "/api/dashboard/analytics"
      );
      setData(result);
    } catch {
      toast.error("Failed to load dashboard analytics");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    fetchAnalytics();
  }, [fetchAnalytics, activeCompany?.id]);

  useEffect(() => {
    const timer = setInterval(fetchAnalytics, 60000);
    return () => clearInterval(timer);
  }, [fetchAnalytics]);

  // Widget manipulation callbacks
  const handleReorder = useCallback(
    (newWidgets: WidgetConfig[]) => {
      setWidgets(newWidgets);
      saveWidgets(newWidgets);
    },
    [saveWidgets]
  );

  const handleRemove = useCallback(
    (widgetId: string) => {
      const updated = widgets.map((w) =>
        w.id === widgetId ? { ...w, visible: false } : w
      );
      setWidgets(updated);
      saveWidgets(updated);
    },
    [widgets, saveWidgets]
  );

  const handleAddWidget = useCallback(
    (definition: WidgetDefinition) => {
      // Place the new widget after the last existing widget
      const maxRow = Math.max(...widgets.map((w) => w.row + w.height), 0);
      const width = sizeToWidth(definition.defaultSize);
      const newWidget: WidgetConfig = {
        id: `w-${Date.now()}`,
        type: definition.type,
        row: maxRow,
        col: 0,
        width,
        height: width >= 4 ? 1 : 2,
        visible: true,
        config: null,
      };
      const updated = [...widgets, newWidget];
      setWidgets(updated);
      saveWidgets(updated);
    },
    [widgets, saveWidgets]
  );

  const handleToggleWidget = useCallback(
    (widgetId: string, visible: boolean) => {
      const updated = widgets.map((w) =>
        w.id === widgetId ? { ...w, visible } : w
      );
      setWidgets(updated);
      saveWidgets(updated);
    },
    [widgets, saveWidgets]
  );

  const handleResetToDefault = useCallback(async () => {
    try {
      await api("/api/dashboard/preferences/reset", { method: "POST" });
      // Reload preferences from server after reset
      const pref = await api<DashboardPreferences>(
        "/api/dashboard/preferences"
      );
      if (pref.widgets && pref.widgets.length > 0) {
        setWidgets(pref.widgets);
      } else {
        const template =
          ROLE_TEMPLATES[dashboardLayout as DashboardTemplate] ??
          ROLE_TEMPLATES.default;
        setWidgets(template);
      }
      toast.success("Dashboard reset to default layout");
    } catch {
      toast.error("Failed to reset dashboard");
    }
  }, [dashboardLayout]);

  // Check if layout uses a role-specific view (legacy rendering)
  const usesRoleView = ["pm", "controller", "field", "executive"].includes(
    dashboardLayout
  );

  return (
    <div className="space-y-6">
      {/* Welcome tour for new users */}
      <WelcomeTour />

      {/* Onboarding checklist for new users */}
      <OnboardingChecklist />

      {/* Setup incomplete banner */}
      {setupIncomplete && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Complete your company setup to get started
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-300">
              Set up your company profile, choose modules, and configure
              defaults.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-500/50 dark:text-amber-300"
            onClick={() => router.push("/settings/company/setup")}
          >
            Go to Setup
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time construction KPIs and activity.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px] sm:min-h-0"
              >
                <LayoutDashboard className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">
                  {LAYOUT_LABELS[dashboardLayout] ?? "Overview"}
                </span>
                <span className="sm:hidden">View</span>
                <ChevronDown className="ml-2 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => switchLayout("default")}>
                Overview (Default)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => switchLayout("pm")}>
                Project Manager
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => switchLayout("controller")}>
                Controller / CFO
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => switchLayout("field")}>
                Field Supervisor
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => switchLayout("executive")}>
                Executive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {!usesRoleView && (
            <>
              <Button
                variant={isEditing ? "default" : "outline"}
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
                className="min-h-[44px] sm:min-h-0"
              >
                <Settings2 className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">
                  {isEditing ? "Done Editing" : "Customize"}
                </span>
                <span className="sm:hidden">
                  {isEditing ? "Done" : "Edit"}
                </span>
              </Button>

              {isEditing && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCustomize(true)}
                    className="min-h-[44px] sm:min-h-0"
                  >
                    Add Widget
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetToDefault}
                    className="min-h-[44px] sm:min-h-0"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">Reset</span>
                  </Button>
                </>
              )}
            </>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={fetchAnalytics}
            className="min-h-[44px] sm:min-h-0"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Role-specific dashboard views (legacy) */}
      {dashboardLayout === "pm" && (
        <PmDashboard data={data} isLoading={isLoading} />
      )}
      {dashboardLayout === "controller" && (
        <ControllerDashboard data={data} isLoading={isLoading} />
      )}
      {dashboardLayout === "field" && (
        <FieldDashboard data={data} isLoading={isLoading} />
      )}
      {dashboardLayout === "executive" && (
        <ExecutiveDashboard data={data} isLoading={isLoading} />
      )}

      {/* Widget-based customizable dashboard */}
      {!usesRoleView && (
        <WidgetGrid
          widgets={widgets}
          data={data}
          isLoading={isLoading}
          isEditing={isEditing}
          onReorder={handleReorder}
          onRemove={handleRemove}
        />
      )}

      {/* Widget picker dialog */}
      <CustomizeDialog
        open={showCustomize}
        onOpenChange={setShowCustomize}
        widgets={widgets}
        onAdd={handleAddWidget}
        onToggle={handleToggleWidget}
      />
    </div>
  );
}
