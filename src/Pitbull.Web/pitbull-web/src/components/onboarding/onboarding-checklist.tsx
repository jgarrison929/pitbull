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
    key: "first_project",
    field: "firstProjectCreated" as const,
    label: "Create your first project",
    description: "Set up a project to start tracking work",
    icon: FolderPlus,
    href: "/projects/new",
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
    key: "cost_codes",
    field: "costCodesConfigured" as const,
    label: "Review cost codes",
    description: "Customize your cost code structure",
    icon: DollarSign,
    href: "/cost-codes",
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
        setChecklist(data);
        if (data.dismissed || data.isFullyCompleted) {
          setChecklist(null);
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

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <Rocket className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">
              Getting Started
            </h3>
            <p className="text-xs text-slate-500">
              {checklist.completedCount} of {checklist.totalItems} complete
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs font-medium text-slate-500">{progress}%</span>
          {collapsed ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronUp className="w-4 h-4 text-slate-400" />
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
                      ? "bg-green-50 cursor-default"
                      : "hover:bg-slate-50 cursor-pointer"
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                      completed
                        ? "bg-green-500 text-white"
                        : "border-2 border-slate-300"
                    }`}
                  >
                    {completed && <Check className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium ${
                        completed
                          ? "text-green-700 line-through"
                          : "text-slate-900"
                      }`}
                    >
                      {item.label}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {item.description}
                    </p>
                  </div>
                  <item.icon
                    className={`w-4 h-4 flex-shrink-0 ${
                      completed ? "text-green-400" : "text-slate-300"
                    }`}
                  />
                </button>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5 mr-1" /> Dismiss checklist
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
