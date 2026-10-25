"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import {
  Check,
  ChevronDown,
  ChevronUp,
  X,
  Building2,
  Layers,
  Settings,
  Users,
  FolderPlus,
  UserPlus,
  DollarSign,
  Rocket,
} from "lucide-react";

interface ChecklistData {
  id: string;
  companyProfileCompleted: boolean;
  contractorTypeSelected: boolean;
  modulesActivated: boolean;
  modulesConfigured: boolean;
  teamMembersInvited: boolean;
  firstProjectCreated: boolean;
  employeesAdded: boolean;
  costCodesConfigured: boolean;
  completedCount: number;
  totalItems: number;
  isFullyCompleted: boolean;
  dismissed: boolean;
}

const CHECKLIST_ITEMS = [
  {
    key: "company_profile",
    field: "companyProfileCompleted" as const,
    label: "Complete company profile",
    description: "Add your address, tax ID, and branding",
    icon: Building2,
    href: "/settings/company/setup",
  },
  {
    key: "contractor_type",
    field: "contractorTypeSelected" as const,
    label: "Select contractor type",
    description: "Choose your contractor specialty",
    icon: Layers,
    href: "/settings/company/setup",
  },
  {
    key: "modules_activated",
    field: "modulesActivated" as const,
    label: "Activate modules",
    description: "Enable the features you need",
    icon: Settings,
    href: "/settings/company/setup",
  },
  {
    key: "modules_configured",
    field: "modulesConfigured" as const,
    label: "Configure module settings",
    description: "Set defaults for your activated modules",
    icon: Settings,
    href: "/settings",
  },
  {
    key: "team_invited",
    field: "teamMembersInvited" as const,
    label: "Invite team members",
    description: "Add your colleagues to the workspace",
    icon: Users,
    href: "/admin/users",
  },
  {
    key: "cost_codes",
    field: "costCodesConfigured" as const,
    label: "Review cost codes",
    description: "Customize your cost code structure",
    icon: DollarSign,
    href: "/cost-codes",
  },
  {
    key: "employees_added",
    field: "employeesAdded" as const,
    label: "Add employees",
    description: "Add your workforce for time tracking",
    icon: UserPlus,
    href: "/employees/new",
  },
  {
    key: "first_project",
    field: "firstProjectCreated" as const,
    label: "Create your first project",
    description: "Set up a project to start tracking work",
    icon: FolderPlus,
    href: "/projects/new",
  },
];

export function OnboardingChecklist() {
  const [checklist, setChecklist] = useState<ChecklistData | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    let cancelled = false;
    async function loadChecklist() {
      try {
        const data = await api<ChecklistData>("/api/onboarding/checklist");
        if (cancelled) return;
        if (data.dismissed) {
          setChecklist(null);
        } else {
          setChecklist(data);
        }
      } catch {
        // User might not have a checklist yet — that's fine
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadChecklist();
    return () => { cancelled = true; };
  }, []);

  async function handleDismiss() {
    try {
      await api("/api/onboarding/checklist/dismiss", { method: "POST" });
      setChecklist(null);
    } catch {
      // Silently fail
    }
  }

  if (loading || !checklist) return null;

  const progress = Math.round(
    (checklist.completedCount / checklist.totalItems) * 100
  );

  if (checklist.isFullyCompleted) {
    return (
      <div className="border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
              <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-green-800 dark:text-green-200">
                You&apos;re all set! 🎉
              </h3>
              <p className="text-xs text-green-600 dark:text-green-400">
                All {checklist.totalItems} setup steps completed
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200"
          >
            <X className="w-3.5 h-3.5 mr-1" /> Dismiss
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-card border border-slate-200 dark:border-border rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-muted/50"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Rocket className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">
              Getting Started
            </h3>
            <p className="text-xs text-muted-foreground">
              {checklist.completedCount} of {checklist.totalItems} complete
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs font-medium text-muted-foreground">{progress}%</span>
          {collapsed ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Items */}
      {!collapsed && (
        <div className="px-4 pb-4">
          <div className="space-y-1">
            {CHECKLIST_ITEMS.map((item) => {
              const completed = checklist[item.field];
              return (
                <button
                  key={item.key}
                  onClick={() => !completed && router.push(item.href)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors ${
                    completed
                      ? "bg-green-50 dark:bg-green-950/30 cursor-default"
                      : "hover:bg-muted/50 cursor-pointer"
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                      completed
                        ? "bg-green-500 text-white"
                        : "border-2 border-muted-foreground/30"
                    }`}
                  >
                    {completed && <Check className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium ${
                        completed
                          ? "text-green-700 dark:text-green-400 line-through"
                          : "text-foreground"
                      }`}
                    >
                      {item.label}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.description}
                    </p>
                  </div>
                  <item.icon
                    className={`w-4 h-4 flex-shrink-0 ${
                      completed ? "text-green-400" : "text-muted-foreground/40"
                    }`}
                  />
                </button>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-border/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5 mr-1" /> Dismiss checklist
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
