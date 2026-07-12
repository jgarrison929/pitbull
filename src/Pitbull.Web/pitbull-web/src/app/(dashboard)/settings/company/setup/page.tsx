"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Building2,
  HardHat,
  Settings2,
  Wrench,
  ChevronRight,
  ChevronLeft,
  Check,
  Info,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import api from "@/lib/api";
import type {
  Company,
  ProjectSettingsData,
  ContractSettingsData,
  BidSettingsData,
  RfiSettingsData,
  ReportSettingsData,
} from "@/lib/types";

// ─── Step definitions ─────────────────────────────────
const STEPS = [
  { id: "profile", label: "Company Profile", icon: Building2 },
  { id: "type", label: "Contractor Type", icon: HardHat },
  { id: "modules", label: "Module Activation", icon: Settings2 },
  { id: "settings", label: "Initial Settings", icon: Wrench },
] as const;

// ─── Contractor type presets ──────────────────────────
const CONTRACTOR_TYPES = [
  {
    value: "general",
    label: "General Contractor",
    description: "Full-service GC managing subs, billing, and project delivery",
  },
  {
    value: "specialty",
    label: "Specialty Contractor",
    description: "Single-trade subcontractor (electrical, plumbing, HVAC, etc.)",
  },
  {
    value: "design-build",
    label: "Design-Build Firm",
    description: "Combined design and construction under one contract",
  },
  {
    value: "cm-at-risk",
    label: "CM at Risk",
    description: "Construction manager providing a GMP with self-performed work",
  },
] as const;

// ─── Module toggle state ──────────────────────────────
interface ModuleActivation {
  projects: boolean;
  contracts: boolean;
  bids: boolean;
  rfis: boolean;
  reports: boolean;
}

const DEFAULT_MODULES: ModuleActivation = {
  projects: true,
  contracts: true,
  bids: true,
  rfis: true,
  reports: true,
};

// ─── Settings defaults ────────────────────────────────
const DEFAULT_PROJECT_SETTINGS: ProjectSettingsData = {
  defaultNumberingFormat: "YYYY-####",
  requireBudgetBeforeActivation: false,
  autoCreatePhases: true,
  defaultRetentionPercent: 10,
  requireSpatialOnProgress: false,
};

const DEFAULT_CONTRACT_SETTINGS: ContractSettingsData = {
  defaultRetainagePercent: 10,
  requireSignedSubcontractBeforePayApp: true,
  approvalWorkflowType: "Sequential",
  aiaArchitectName: "",
  aiaOwnerName: "",
};

const DEFAULT_BID_SETTINGS: BidSettingsData = {
  defaultValidityPeriodDays: 30,
  requireEstimatorSignOff: false,
  defaultOverheadPercent: 10,
  defaultProfitPercent: 10,
};

const DEFAULT_RFI_SETTINGS: RfiSettingsData = {
  defaultResponseDeadlineDays: 14,
  autoAssignToPm: true,
  requireCostImpact: false,
};

const DEFAULT_REPORT_SETTINGS: ReportSettingsData = {
  overtimeRules: "Federal",
  overtimeEnabled: true,
  dailyOvertimeThreshold: 8,
  dailyDoubletimeThreshold: 12,
  weeklyOvertimeThreshold: 40,
  saturdayRule: "overtime",
  sundayRule: "doubletime",
  holidayRule: "doubletime",
  holidaysJson: "[]",
  reportBrandingName: "",
  reportLogoUrl: "",
  fiscalYearStartMonth: 1,
};

// ─── Component ────────────────────────────────────────
export default function CompanySetupWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Step 1: Company profile (read-only display from existing company)
  const [company, setCompany] = useState<Company | null>(null);

  // Step 2: Contractor type
  const [contractorType, setContractorType] = useState("general");

  // Step 3: Module activation
  const [modules, setModules] = useState<ModuleActivation>(DEFAULT_MODULES);

  // Step 4: Settings for each active module
  const [projectSettings, setProjectSettings] = useState(DEFAULT_PROJECT_SETTINGS);
  const [contractSettings, setContractSettings] = useState(DEFAULT_CONTRACT_SETTINGS);
  const [bidSettings, setBidSettings] = useState(DEFAULT_BID_SETTINGS);
  const [rfiSettings, setRfiSettings] = useState(DEFAULT_RFI_SETTINGS);
  const [reportSettings, setReportSettings] = useState(DEFAULT_REPORT_SETTINGS);

  // Load existing company data
  const loadCompany = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await api<Company[]>("/api/companies");
      if (data.length > 0) {
        setCompany(data[0]);
        // Pre-fill report branding from company name
        setReportSettings((prev) => ({
          ...prev,
          reportBrandingName: prev.reportBrandingName || data[0].name,
        }));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load company data";
      setLoadError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCompany();
  }, [loadCompany]);

  // Apply contractor type presets
  useEffect(() => {
    switch (contractorType) {
      case "specialty":
        setModules({ projects: true, contracts: false, bids: true, rfis: false, reports: true });
        setBidSettings((prev) => ({ ...prev, defaultOverheadPercent: 15, defaultProfitPercent: 15 }));
        break;
      case "design-build":
        setModules({ projects: true, contracts: true, bids: true, rfis: true, reports: true });
        setProjectSettings((prev) => ({ ...prev, autoCreatePhases: true, requireBudgetBeforeActivation: true }));
        break;
      case "cm-at-risk":
        setModules({ projects: true, contracts: true, bids: false, rfis: true, reports: true });
        setContractSettings((prev) => ({ ...prev, approvalWorkflowType: "Sequential" }));
        break;
      default: // general
        setModules(DEFAULT_MODULES);
        break;
    }
  }, [contractorType]);

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const saves: Promise<unknown>[] = [];

      if (modules.projects) {
        saves.push(api("/api/companies/settings/projects", { method: "PUT", body: projectSettings }));
      }
      if (modules.contracts) {
        saves.push(api("/api/companies/settings/contracts", { method: "PUT", body: contractSettings }));
      }
      if (modules.bids) {
        saves.push(api("/api/companies/settings/bids", { method: "PUT", body: bidSettings }));
      }
      if (modules.rfis) {
        saves.push(api("/api/companies/settings/rfis", { method: "PUT", body: rfiSettings }));
      }
      if (modules.reports) {
        saves.push(api("/api/companies/settings/reports", { method: "PUT", body: reportSettings }));
      }

      await Promise.all(saves);

      await Promise.all([
        api("/api/onboarding/checklist/company_profile", {
          method: "PUT",
          body: { completed: true },
        }),
        api("/api/onboarding/checklist/contractor_type", {
          method: "PUT",
          body: { completed: true },
        }),
        api("/api/onboarding/checklist/modules_activated", {
          method: "PUT",
          body: { completed: true },
        }),
        api("/api/onboarding/checklist/modules_configured", {
          method: "PUT",
          body: { completed: true },
        }),
      ]);

      toast.success("Company setup complete! All module settings saved.");
      router.push("/");
    } catch {
      toast.error("Failed to save some settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const canProceed = () => {
    if (currentStep === 0) return !!company;
    if (currentStep === 2) return Object.values(modules).some(Boolean);
    return true;
  };

  const goNext = () => {
    if (currentStep < STEPS.length - 1) setCurrentStep(currentStep + 1);
  };

  const goBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Breadcrumbs
          items={[
            { label: "Settings", href: "/settings" },
            { label: "Company Setup" },
          ]}
        />
        <Alert variant="destructive">
          <Info className="h-4 w-4" />
          <AlertDescription>
            {loadError}
          </AlertDescription>
        </Alert>
        <Button variant="outline" onClick={loadCompany}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Breadcrumbs
        items={[
          { label: "Settings", href: "/settings" },
          { label: "Company Setup" },
        ]}
      />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Company Setup Wizard</h1>
        <p className="text-muted-foreground">
          Configure your company profile and module settings in a few easy steps
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;

          return (
            <div key={step.id} className="flex items-center gap-2 flex-1">
              <button
                onClick={() => index <= currentStep && setCurrentStep(index)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full ${
                  isActive
                    ? "bg-amber-500 text-white"
                    : isCompleted
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 cursor-pointer"
                    : "bg-muted text-muted-foreground"
                }`}
                disabled={index > currentStep}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4 shrink-0" />
                ) : (
                  <Icon className="h-4 w-4 shrink-0" />
                )}
                <span className="hidden sm:inline truncate">{step.label}</span>
                <span className="sm:hidden">{index + 1}</span>
              </button>
              {index < STEPS.length - 1 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block" />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="min-h-[400px]">
        {/* Step 1: Company Profile */}
        {currentStep === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Company Profile
              </CardTitle>
              <CardDescription>
                Review your company information. Edit in Company Settings if needed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {company ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs uppercase text-muted-foreground">Company Name</Label>
                    <p className="font-medium">{company.name}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs uppercase text-muted-foreground">Code</Label>
                    <p className="font-medium">{company.code}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs uppercase text-muted-foreground">Address</Label>
                    <p className="text-sm">
                      {[company.address, company.city, company.state, company.zipCode]
                        .filter(Boolean)
                        .join(", ") || "Not set"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs uppercase text-muted-foreground">Phone</Label>
                    <p className="text-sm">{company.phone || "Not set"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs uppercase text-muted-foreground">Tax ID</Label>
                    <p className="text-sm">{company.taxId || "Not set"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs uppercase text-muted-foreground">Currency</Label>
                    <p className="text-sm">{company.currency}</p>
                  </div>
                </div>
              ) : (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    No company found. Please create a company in Admin &rarr; Companies first.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Contractor Type */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardHat className="h-5 w-5" />
                Contractor Type
              </CardTitle>
              <CardDescription>
                Select your contractor type to get recommended module presets
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {CONTRACTOR_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setContractorType(type.value)}
                    className={`p-4 rounded-lg border text-left transition-colors ${
                      contractorType === type.value
                        ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20"
                        : "border-border hover:border-amber-300 hover:bg-muted/50"
                    }`}
                  >
                    <p className="font-medium">{type.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{type.description}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Module Activation */}
        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Module Activation
              </CardTitle>
              <CardDescription>
                Enable or disable modules based on your business needs. You can change these later.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(
                [
                  { key: "projects" as const, label: "Projects", desc: "Project management, budgets, phases, and retention" },
                  { key: "contracts" as const, label: "Contracts", desc: "Subcontracts, change orders, retainage, and AIA forms" },
                  { key: "bids" as const, label: "Bids", desc: "Bid management, estimating, and markup tracking" },
                  { key: "rfis" as const, label: "RFIs", desc: "Request for Information tracking with cost impact" },
                  { key: "reports" as const, label: "Reports", desc: "Labor reports, overtime rules, and fiscal year settings" },
                ] as const
              ).map((mod) => (
                <div
                  key={mod.key}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">{mod.label}</Label>
                    <p className="text-xs text-muted-foreground">{mod.desc}</p>
                  </div>
                  <Switch
                    checked={modules[mod.key]}
                    onCheckedChange={(checked) =>
                      setModules((prev) => ({ ...prev, [mod.key]: checked }))
                    }
                  />
                </div>
              ))}

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Disabled modules can be re-enabled any time from Settings. Their data is never deleted.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Initial Settings */}
        {currentStep === 3 && (
          <div className="space-y-6">
            {modules.projects && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Project Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Numbering Format</Label>
                      <Input
                        value={projectSettings.defaultNumberingFormat}
                        onChange={(e) =>
                          setProjectSettings((p) => ({ ...p, defaultNumberingFormat: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Default Retention %</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={projectSettings.defaultRetentionPercent}
                        onChange={(e) =>
                          setProjectSettings((p) => ({
                            ...p,
                            defaultRetentionPercent: parseFloat(e.target.value) || 0,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Auto-create standard phases</Label>
                    <Switch
                      checked={projectSettings.autoCreatePhases}
                      onCheckedChange={(checked) =>
                        setProjectSettings((p) => ({ ...p, autoCreatePhases: checked }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Require budget before activation</Label>
                    <Switch
                      checked={projectSettings.requireBudgetBeforeActivation}
                      onCheckedChange={(checked) =>
                        setProjectSettings((p) => ({ ...p, requireBudgetBeforeActivation: checked }))
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {modules.contracts && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Contract Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Default Retainage %</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={contractSettings.defaultRetainagePercent}
                        onChange={(e) =>
                          setContractSettings((p) => ({
                            ...p,
                            defaultRetainagePercent: parseFloat(e.target.value) || 0,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Approval Workflow</Label>
                      <Select
                        value={contractSettings.approvalWorkflowType}
                        onValueChange={(v) =>
                          setContractSettings((p) => ({ ...p, approvalWorkflowType: v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="None">No Approval</SelectItem>
                          <SelectItem value="Sequential">Sequential (PM then Exec)</SelectItem>
                          <SelectItem value="Parallel">Parallel (Any Approver)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Require signed subcontract before pay app</Label>
                    <Switch
                      checked={contractSettings.requireSignedSubcontractBeforePayApp}
                      onCheckedChange={(checked) =>
                        setContractSettings((p) => ({
                          ...p,
                          requireSignedSubcontractBeforePayApp: checked,
                        }))
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {modules.bids && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Bid Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Validity Period (days)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        value={bidSettings.defaultValidityPeriodDays}
                        onChange={(e) =>
                          setBidSettings((p) => ({
                            ...p,
                            defaultValidityPeriodDays: parseInt(e.target.value) || 30,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Overhead %</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={bidSettings.defaultOverheadPercent}
                        onChange={(e) =>
                          setBidSettings((p) => ({
                            ...p,
                            defaultOverheadPercent: parseFloat(e.target.value) || 0,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Profit %</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={bidSettings.defaultProfitPercent}
                        onChange={(e) =>
                          setBidSettings((p) => ({
                            ...p,
                            defaultProfitPercent: parseFloat(e.target.value) || 0,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Require estimator sign-off</Label>
                    <Switch
                      checked={bidSettings.requireEstimatorSignOff}
                      onCheckedChange={(checked) =>
                        setBidSettings((p) => ({ ...p, requireEstimatorSignOff: checked }))
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {modules.rfis && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">RFI Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Default Response Deadline (days)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={rfiSettings.defaultResponseDeadlineDays}
                      onChange={(e) =>
                        setRfiSettings((p) => ({
                          ...p,
                          defaultResponseDeadlineDays: parseInt(e.target.value) || 14,
                        }))
                      }
                      className="w-32"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Auto-assign to project manager</Label>
                    <Switch
                      checked={rfiSettings.autoAssignToPm}
                      onCheckedChange={(checked) =>
                        setRfiSettings((p) => ({ ...p, autoAssignToPm: checked }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Require cost impact assessment</Label>
                    <Switch
                      checked={rfiSettings.requireCostImpact}
                      onCheckedChange={(checked) =>
                        setRfiSettings((p) => ({ ...p, requireCostImpact: checked }))
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {modules.reports && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Report Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Overtime Rules</Label>
                      <Select
                        value={reportSettings.overtimeRules}
                        onValueChange={(v) =>
                          setReportSettings((p) => ({ ...p, overtimeRules: v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Federal">Federal (Weekly 40hr)</SelectItem>
                          <SelectItem value="California">California (Daily 8hr + Weekly)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Fiscal Year Start</Label>
                      <Select
                        value={String(reportSettings.fiscalYearStartMonth)}
                        onValueChange={(v) =>
                          setReportSettings((p) => ({ ...p, fiscalYearStartMonth: parseInt(v) }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            "January", "February", "March", "April", "May", "June",
                            "July", "August", "September", "October", "November", "December",
                          ].map((month, i) => (
                            <SelectItem key={i + 1} value={String(i + 1)}>
                              {month}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Report Branding Name</Label>
                    <Input
                      value={reportSettings.reportBrandingName}
                      onChange={(e) =>
                        setReportSettings((p) => ({ ...p, reportBrandingName: e.target.value }))
                      }
                      placeholder="Company name shown on reports"
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button
          variant="outline"
          onClick={goBack}
          disabled={currentStep === 0}
          className="gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>

        <p className="text-sm text-muted-foreground">
          Step {currentStep + 1} of {STEPS.length}
        </p>

        {currentStep < STEPS.length - 1 ? (
          <Button
            onClick={goNext}
            disabled={!canProceed()}
            className="gap-2 bg-amber-500 hover:bg-amber-600"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSaveAll}
            disabled={isSaving}
            className="gap-2 bg-amber-500 hover:bg-amber-600"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Complete Setup
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
