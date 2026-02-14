"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { LoadingButton } from "@/components/ui/loading-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import {
  HelpCircle,
  DollarSign,
  Clock,
  Plus,
  Minus,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import api from "@/lib/api";
import { getTodayISO } from "@/lib/time-tracking";
import { PayPeriodIndicator } from "@/components/time-tracking/pay-period-indicator";
import { OfflineIndicator } from "@/components/time-tracking/offline-indicator";
import { useRecentSelections } from "@/hooks/use-recent-selections";
import type {
  CreateTimeEntryCommand,
  TimeEntry,
  PagedResult,
  Project,
  ListEmployeesResult,
  Employee,
  CostCode,
  Equipment,
  ListEquipmentResult,
  Phase,
} from "@/lib/types";
import { toast } from "sonner";

interface CostCodeListResult {
  items: CostCode[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const NONE_VALUE = "__none__";
const QUICK_ENTRY_STORAGE_KEY = "pitbull_quick_entry_combos";

type FormErrors = Partial<
  Record<
    "date" | "employeeId" | "projectId" | "costCodeId" | "hours" | "equipmentHours" | "general",
    string
  >
>;

interface QuickEntryCombination {
  projectId: string;
  costCodeId: string;
  phaseId: string;
  timestamp: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function getYesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0]!;
}

function loadQuickEntryCombos(): Map<string, QuickEntryCombination> {
  if (typeof window === "undefined") return new Map();
  try {
    const stored = localStorage.getItem(QUICK_ENTRY_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Record<string, QuickEntryCombination>;
      return new Map(Object.entries(parsed));
    }
  } catch {
    // ignore
  }
  return new Map();
}

function saveQuickEntryCombo(projectId: string, costCodeId: string, phaseId: string) {
  if (typeof window === "undefined") return;
  try {
    const combos = loadQuickEntryCombos();
    combos.set(projectId, { projectId, costCodeId, phaseId, timestamp: Date.now() });
    const obj: Record<string, QuickEntryCombination> = {};
    combos.forEach((v, k) => { obj[k] = v; });
    localStorage.setItem(QUICK_ENTRY_STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // ignore
  }
}

/** Stepper component for hours input - fat-finger friendly */
function HoursStepper({
  id,
  label,
  value,
  onChange,
  colorClass = "",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  colorClass?: string;
}) {
  const numVal = parseFloat(value) || 0;

  const step = (delta: number) => {
    const next = Math.max(0, Math.min(24, numVal + delta));
    onChange(next.toString());
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
      </Label>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => step(-0.25)}
          className="flex-none flex items-center justify-center w-11 h-11 sm:w-9 sm:h-9 rounded-md border border-input bg-background hover:bg-muted active:bg-muted/80 transition-colors touch-manipulation"
          aria-label={`Decrease ${label}`}
        >
          <Minus className="h-4 w-4" />
        </button>
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={0}
          max={24}
          step={0.25}
          className={`h-11 sm:h-9 text-center text-lg sm:text-sm font-medium ${colorClass}`}
        />
        <button
          type="button"
          onClick={() => step(0.25)}
          className="flex-none flex items-center justify-center w-11 h-11 sm:w-9 sm:h-9 rounded-md border border-input bg-background hover:bg-muted active:bg-muted/80 transition-colors touch-manipulation"
          aria-label={`Increase ${label}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/** Mobile bottom-sheet style selector */
function MobileSelectSheet({
  open,
  onOpenChange,
  title,
  items,
  value,
  onSelect,
  recentIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  items: { id: string; label: string; sublabel?: string }[];
  value: string;
  onSelect: (id: string) => void;
  recentIds?: string[];
}) {
  const recentSet = new Set(recentIds || []);
  const recentItems = items.filter((item) => recentSet.has(item.id));
  const allItems = items;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2 border-b">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          {recentItems.length > 0 && (
            <div className="px-2 pt-2 pb-1">
              <p className="px-2 text-xs text-muted-foreground font-medium mb-1">Recent</p>
              {recentItems.map((item) => (
                <button
                  key={`recent-${item.id}`}
                  type="button"
                  onClick={() => { onSelect(item.id); onOpenChange(false); }}
                  className={`w-full text-left px-3 py-3.5 rounded-lg flex items-center justify-between touch-manipulation transition-colors ${
                    value === item.id ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800" : "hover:bg-muted active:bg-muted/80"
                  }`}
                >
                  <div>
                    <span className="font-medium text-base">⏱ {item.label}</span>
                    {item.sublabel && (
                      <span className="block text-sm text-muted-foreground">{item.sublabel}</span>
                    )}
                  </div>
                  {value === item.id && <CheckCircle2 className="h-5 w-5 text-amber-500 shrink-0" />}
                </button>
              ))}
              <div className="border-b my-2" />
            </div>
          )}
          <div className="px-2 pb-2">
            {recentItems.length > 0 && (
              <p className="px-2 text-xs text-muted-foreground font-medium mb-1">All</p>
            )}
            {allItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => { onSelect(item.id); onOpenChange(false); }}
                className={`w-full text-left px-3 py-3.5 rounded-lg flex items-center justify-between touch-manipulation transition-colors ${
                  value === item.id ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800" : "hover:bg-muted active:bg-muted/80"
                }`}
              >
                <div>
                  <span className="font-medium text-base">{item.label}</span>
                  {item.sublabel && (
                    <span className="block text-sm text-muted-foreground">{item.sublabel}</span>
                  )}
                </div>
                {value === item.id && <CheckCircle2 className="h-5 w-5 text-amber-500 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Touch-friendly select trigger for mobile that opens a bottom-sheet */
function MobileFriendlySelect({
  label,
  required,
  helpText,
  value,
  displayValue,
  placeholder,
  items,
  onSelect,
  recentIds,
  error,
  desktopSelect,
}: {
  label: string;
  required?: boolean;
  helpText?: string;
  value: string;
  displayValue?: string;
  placeholder: string;
  items: { id: string; label: string; sublabel?: string }[];
  onSelect: (id: string) => void;
  recentIds?: string[];
  error?: string;
  desktopSelect: React.ReactNode;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <Label>
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
        {helpText && (
          <SimpleTooltip content={helpText}>
            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" aria-label={`${label} help`} />
          </SimpleTooltip>
        )}
      </div>

      {/* Mobile: touch-friendly trigger button */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="sm:hidden w-full flex items-center justify-between min-h-[48px] px-3 py-2 rounded-md border border-input bg-background text-left text-base touch-manipulation hover:bg-muted/50 active:bg-muted transition-colors"
      >
        <span className={value ? "font-medium" : "text-muted-foreground"}>
          {displayValue || placeholder}
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>

      {/* Desktop: standard select */}
      <div className="hidden sm:block">{desktopSelect}</div>

      {/* Mobile bottom sheet */}
      <MobileSelectSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={`Select ${label}`}
        items={items}
        value={value}
        onSelect={onSelect}
        recentIds={recentIds}
      />

      {error && (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      )}
    </div>
  );
}

export default function NewTimeEntryPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPhasesLoading, setIsPhasesLoading] = useState(false);
  const [showSuccessFlash, setShowSuccessFlash] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Form state
  const [date, setDate] = useState(getTodayISO());
  const [employeeId, setEmployeeId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [costCodeId, setCostCodeId] = useState<string>("");
  const [phaseId, setPhaseId] = useState<string>("");
  const [equipmentId, setEquipmentId] = useState<string>("");
  const [equipmentHours, setEquipmentHours] = useState<string>("0");
  const [equipmentHoursManuallyEdited, setEquipmentHoursManuallyEdited] = useState(false);
  const [regularHours, setRegularHours] = useState<string>("8");
  const [overtimeHours, setOvertimeHours] = useState<string>("0");
  const [doubletimeHours, setDoubletimeHours] = useState<string>("0");
  const [description, setDescription] = useState<string>("");

  // Options
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);

  const [errors, setErrors] = useState<FormErrors>({});

  // Quick entry combos
  const [quickEntryCombos] = useState(() => loadQuickEntryCombos());

  // Recent selections
  const { recentItems: recentProjects, addRecent: addRecentProject } =
    useRecentSelections("project");
  const { recentItems: recentCostCodes, addRecent: addRecentCostCode } =
    useRecentSelections("costCode");
  const { recentItems: recentEquipment, addRecent: addRecentEquipment } =
    useRecentSelections("equipment");

  // Calculate total hours
  const totalHours = useMemo(() => {
    const reg = parseFloat(regularHours) || 0;
    const ot = parseFloat(overtimeHours) || 0;
    const dt = parseFloat(doubletimeHours) || 0;
    return reg + ot + dt;
  }, [regularHours, overtimeHours, doubletimeHours]);

  // Get selected employee for cost estimation
  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === employeeId),
    [employees, employeeId]
  );

  // Get selected equipment for cost estimation
  const selectedEquipment = useMemo(
    () => equipmentList.find((e) => e.id === equipmentId),
    [equipmentList, equipmentId]
  );

  // Cost estimates
  const laborCostEstimate = useMemo(() => {
    if (!selectedEmployee) return 0;
    const rate = selectedEmployee.baseHourlyRate;
    const reg = parseFloat(regularHours) || 0;
    const ot = parseFloat(overtimeHours) || 0;
    const dt = parseFloat(doubletimeHours) || 0;
    return reg * rate + ot * rate * 1.5 + dt * rate * 2;
  }, [selectedEmployee, regularHours, overtimeHours, doubletimeHours]);

  const equipmentCostEstimate = useMemo(() => {
    if (!selectedEquipment || !equipmentId) return 0;
    const eqHrs = parseFloat(equipmentHours) || 0;
    return eqHrs * selectedEquipment.hourlyRate;
  }, [selectedEquipment, equipmentId, equipmentHours]);

  // Auto-sync equipment hours with regular hours (unless manually edited)
  useEffect(() => {
    if (equipmentId && !equipmentHoursManuallyEdited) {
      setEquipmentHours(regularHours);
    }
  }, [equipmentId, regularHours, equipmentHoursManuallyEdited]);

  // Reset manual edit flag when equipment changes
  useEffect(() => {
    setEquipmentHoursManuallyEdited(false);
    if (!equipmentId) {
      setEquipmentHours("0");
    }
  }, [equipmentId]);

  useEffect(() => {
    async function loadOptions() {
      try {
        const [employeesRes, projectsRes, costCodesRes, equipmentRes] = await Promise.all([
          api<ListEmployeesResult>("/api/employees?isActive=true&pageSize=200"),
          api<PagedResult<Project>>("/api/projects?pageSize=200"),
          api<CostCodeListResult>("/api/cost-codes?costType=1&pageSize=200"),
          api<ListEquipmentResult>("/api/equipment?isActive=true&pageSize=200"),
        ]);
        setEmployees(employeesRes.items);
        setProjects(projectsRes.items);
        setCostCodes(costCodesRes.items);
        setEquipmentList(equipmentRes.items);
      } catch {
        toast.error("Failed to load form options");
      } finally {
        setIsLoading(false);
      }
    }
    loadOptions();
  }, []);

  // Load phases when project changes
  useEffect(() => {
    if (!projectId) {
      setPhases([]);
      setPhaseId("");
      return;
    }

    let cancelled = false;
    async function loadPhases() {
      setIsPhasesLoading(true);
      try {
        const result = await api<Phase[]>(`/api/projects/${projectId}/phases`);
        if (!cancelled) {
          setPhases(result);
        }
      } catch {
        if (!cancelled) {
          setPhases([]);
        }
      } finally {
        if (!cancelled) {
          setIsPhasesLoading(false);
        }
      }
      if (!cancelled) {
        setPhaseId("");
      }
    }
    loadPhases();
    return () => { cancelled = true; };
  }, [projectId]);

  // Quick Entry: auto-suggest cost code + phase when project changes
  const handleProjectChange = useCallback(
    (value: string) => {
      setProjectId(value);
      const project = projects.find((p) => p.id === value);
      if (project) {
        addRecentProject(value, `${project.number} - ${project.name}`);
      }

      // Quick entry: auto-fill from last used combo
      const combo = quickEntryCombos.get(value);
      if (combo) {
        if (combo.costCodeId) setCostCodeId(combo.costCodeId);
        // Phase is set after phases load, so store it for deferred application
        if (combo.phaseId) {
          // Small delay to let phases load first
          setTimeout(() => setPhaseId(combo.phaseId), 500);
        }
        toast.info("Auto-filled from last entry on this project", { duration: 2000 });
      }
    },
    [projects, addRecentProject, quickEntryCombos]
  );

  const handleCostCodeChange = useCallback(
    (value: string) => {
      setCostCodeId(value);
      const cc = costCodes.find((c) => c.id === value);
      if (cc) {
        addRecentCostCode(value, `${cc.code} - ${cc.description}`);
      }
    },
    [costCodes, addRecentCostCode]
  );

  const handleEquipmentChange = useCallback(
    (value: string) => {
      const newVal = value === NONE_VALUE ? "" : value;
      setEquipmentId(newVal);
      if (!newVal) setEquipmentHours("0");
      const eq = equipmentList.find((e) => e.id === newVal);
      if (eq) {
        addRecentEquipment(newVal, `${eq.code} - ${eq.name}`);
      }
    },
    [equipmentList, addRecentEquipment]
  );

  function validate(): FormErrors {
    const next: FormErrors = {};

    if (!date) next.date = "Date is required";
    if (!employeeId) next.employeeId = "Employee is required";
    if (!projectId) next.projectId = "Project is required";
    if (!costCodeId) next.costCodeId = "Cost code is required";

    const reg = parseFloat(regularHours) || 0;
    const ot = parseFloat(overtimeHours) || 0;
    const dt = parseFloat(doubletimeHours) || 0;
    const total = reg + ot + dt;

    if (total <= 0) {
      next.hours = "At least some hours are required";
    } else if (total > 24) {
      next.hours = "Total hours cannot exceed 24";
    }

    if (reg < 0 || ot < 0 || dt < 0) {
      next.hours = "Hours cannot be negative";
    }

    if (equipmentId) {
      const eqHrs = parseFloat(equipmentHours) || 0;
      if (eqHrs < 0) {
        next.equipmentHours = "Equipment hours cannot be negative";
      } else if (eqHrs > 24) {
        next.equipmentHours = "Equipment hours cannot exceed 24";
      }
    }

    return next;
  }

  async function doSubmit(andAddAnother: boolean) {
    setIsSubmitting(true);

    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please fix the highlighted fields");
      setIsSubmitting(false);
      return;
    }

    const command: CreateTimeEntryCommand = {
      date,
      employeeId,
      projectId,
      costCodeId,
      regularHours: parseFloat(regularHours) || 0,
      overtimeHours: parseFloat(overtimeHours) || 0,
      doubletimeHours: parseFloat(doubletimeHours) || 0,
      description: description || undefined,
      phaseId: phaseId || undefined,
      equipmentId: equipmentId || undefined,
      equipmentHours: equipmentId ? (parseFloat(equipmentHours) || 0) : undefined,
    };

    try {
      await api<TimeEntry>("/api/time-entries", {
        method: "POST",
        body: command,
      });

      // Save quick entry combo for this project
      saveQuickEntryCombo(projectId, costCodeId, phaseId);

      // Show success flash
      setShowSuccessFlash(true);
      setTimeout(() => setShowSuccessFlash(false), 1200);

      if (andAddAnother) {
        toast.success("Entry created! Add another.");
        // Keep employee, project, cost code, phase — just clear hours + description
        setRegularHours("8");
        setOvertimeHours("0");
        setDoubletimeHours("0");
        setDescription("");
        setEquipmentHours("0");
        setEquipmentHoursManuallyEdited(false);
        setErrors({});
        // Scroll to top
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        toast.success("Time entry created successfully");
        router.push("/time-tracking");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create time entry"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await doSubmit(false);
  }

  // Helper: get recent IDs that exist in the current list
  function getValidRecentIds(
    recentItems: { id: string }[],
    validIds: Set<string>
  ): string[] {
    return recentItems
      .filter((item) => validIds.has(item.id))
      .map((item) => item.id);
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Time Entry</h1>
          <p className="text-muted-foreground">Loading form...</p>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
            <Skeleton className="h-20" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const projectIdSet = new Set(projects.map((p) => p.id));
  const costCodeIdSet = new Set(costCodes.map((c) => c.id));
  const equipmentIdSet = new Set(equipmentList.map((e) => e.id));
  const recentProjectIds = getValidRecentIds(recentProjects, projectIdSet);
  const recentCostCodeIds = getValidRecentIds(recentCostCodes, costCodeIdSet);
  const recentEquipmentIds = getValidRecentIds(recentEquipment, equipmentIdSet);

  const showCostEstimate = selectedEmployee && totalHours > 0;
  const selectedProjectLabel = projects.find((p) => p.id === projectId);
  const selectedCostCodeLabel = costCodes.find((c) => c.id === costCodeId);
  const selectedEmployeeLabel = employees.find((e) => e.id === employeeId);
  const selectedEquipmentLabel = equipmentList.find((e) => e.id === equipmentId);

  return (
    <ErrorBoundary label="time entry form">
      {/* Success Flash Overlay */}
      {showSuccessFlash && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-green-500/20 animate-in fade-in-0 duration-200 pointer-events-none">
          <div className="bg-green-500 text-white rounded-full p-6 shadow-2xl animate-in zoom-in-50 duration-300">
            <CheckCircle2 className="h-16 w-16" />
          </div>
        </div>
      )}

      <div className="max-w-2xl space-y-6">
        <OfflineIndicator />

        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Time Entry</h1>
          <p className="text-muted-foreground">
            Log hours for an employee on a project
          </p>
        </div>

        <PayPeriodIndicator date={date} compact />

        <Card>
          <CardHeader>
            <CardTitle>Time Entry Details</CardTitle>
            <CardDescription>
              Enter the date, employee, project, and hours worked
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
              <fieldset disabled={isSubmitting} className="space-y-5">

              {/* Date with quick buttons */}
              <div className="space-y-2">
                <Label htmlFor="date">Date <span className="text-destructive">*</span></Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    max={getTodayISO()}
                    required
                    className="min-h-[48px] sm:min-h-[40px] text-base sm:text-sm"
                    aria-describedby={errors.date ? "date-error" : undefined}
                  />
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      type="button"
                      variant={date === getTodayISO() ? "default" : "outline"}
                      size="sm"
                      onClick={() => setDate(getTodayISO())}
                      className="min-h-[48px] sm:min-h-[36px] px-3 text-sm font-medium touch-manipulation"
                    >
                      <CalendarDays className="h-3.5 w-3.5 mr-1 sm:mr-0.5" />
                      Today
                    </Button>
                    <Button
                      type="button"
                      variant={date === getYesterdayISO() ? "default" : "outline"}
                      size="sm"
                      onClick={() => setDate(getYesterdayISO())}
                      className="min-h-[48px] sm:min-h-[36px] px-3 text-sm font-medium touch-manipulation"
                    >
                      Yesterday
                    </Button>
                  </div>
                </div>
                {errors.date && (
                  <p id="date-error" className="text-sm text-destructive" role="alert">{errors.date}</p>
                )}
              </div>

              {/* Employee */}
              <MobileFriendlySelect
                label="Employee"
                required
                value={employeeId}
                displayValue={selectedEmployeeLabel ? `${selectedEmployeeLabel.fullName} (${selectedEmployeeLabel.employeeNumber})` : ""}
                placeholder="Select employee"
                items={employees.map((e) => ({
                  id: e.id,
                  label: e.fullName,
                  sublabel: e.employeeNumber,
                }))}
                onSelect={setEmployeeId}
                error={errors.employeeId}
                desktopSelect={
                  <Select value={employeeId} onValueChange={setEmployeeId}>
                    <SelectTrigger aria-label="Select employee">
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.fullName} ({e.employeeNumber})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                }
              />

              {/* Project */}
              <MobileFriendlySelect
                label="Project"
                required
                value={projectId}
                displayValue={selectedProjectLabel ? `${selectedProjectLabel.number} - ${selectedProjectLabel.name}` : ""}
                placeholder="Select project"
                items={projects.map((p) => ({
                  id: p.id,
                  label: `${p.number} - ${p.name}`,
                }))}
                onSelect={handleProjectChange}
                recentIds={recentProjectIds}
                error={errors.projectId}
                desktopSelect={
                  <Select value={projectId} onValueChange={handleProjectChange}>
                    <SelectTrigger aria-label="Select project">
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      {recentProjectIds.length > 0 && (
                        <>
                          <SelectGroup>
                            <SelectLabel className="text-xs text-muted-foreground font-normal">Recent</SelectLabel>
                            {recentProjectIds.map((id) => {
                              const p = projects.find((proj) => proj.id === id);
                              if (!p) return null;
                              return (
                                <SelectItem key={`recent-${p.id}`} value={p.id}>
                                  ⏱ {p.number} - {p.name}
                                </SelectItem>
                              );
                            })}
                          </SelectGroup>
                          <SelectSeparator />
                        </>
                      )}
                      <SelectGroup>
                        {recentProjectIds.length > 0 && (
                          <SelectLabel className="text-xs text-muted-foreground font-normal">All Projects</SelectLabel>
                        )}
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.number} - {p.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                }
              />

              {/* Cost Code */}
              <MobileFriendlySelect
                label="Cost Code"
                required
                helpText="Cost codes categorize labor for job costing (e.g., Rough Framing, Finish Electrical)"
                value={costCodeId}
                displayValue={selectedCostCodeLabel ? `${selectedCostCodeLabel.code} - ${selectedCostCodeLabel.description}` : ""}
                placeholder="Select cost code"
                items={costCodes.map((c) => ({
                  id: c.id,
                  label: `${c.code} - ${c.description}`,
                }))}
                onSelect={handleCostCodeChange}
                recentIds={recentCostCodeIds}
                error={errors.costCodeId}
                desktopSelect={
                  <Select value={costCodeId} onValueChange={handleCostCodeChange}>
                    <SelectTrigger aria-label="Select cost code">
                      <SelectValue placeholder="Select cost code" />
                    </SelectTrigger>
                    <SelectContent>
                      {recentCostCodeIds.length > 0 && (
                        <>
                          <SelectGroup>
                            <SelectLabel className="text-xs text-muted-foreground font-normal">Recent</SelectLabel>
                            {recentCostCodeIds.map((id) => {
                              const c = costCodes.find((cc) => cc.id === id);
                              if (!c) return null;
                              return (
                                <SelectItem key={`recent-${c.id}`} value={c.id}>
                                  ⏱ {c.code} - {c.description}
                                </SelectItem>
                              );
                            })}
                          </SelectGroup>
                          <SelectSeparator />
                        </>
                      )}
                      <SelectGroup>
                        {recentCostCodeIds.length > 0 && (
                          <SelectLabel className="text-xs text-muted-foreground font-normal">All Cost Codes</SelectLabel>
                        )}
                        {costCodes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.code} - {c.description}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                }
              />

              {/* Phase & Equipment (optional) */}
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Phase selector */}
                {projectId && (isPhasesLoading || phases.length > 0) && (
                  <div className="space-y-2 animate-in fade-in-50 slide-in-from-top-1 duration-200">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="phase">Phase (optional)</Label>
                      <SimpleTooltip content="Project phase for tracking costs against specific construction stages">
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" aria-label="Phase help" />
                      </SimpleTooltip>
                    </div>
                    {isPhasesLoading ? (
                      <Skeleton className="h-12 sm:h-10 w-full" />
                    ) : (
                      <>
                        {/* Mobile */}
                        <select
                          value={phaseId || NONE_VALUE}
                          onChange={(e) => setPhaseId(e.target.value === NONE_VALUE ? "" : e.target.value)}
                          className="sm:hidden w-full min-h-[48px] rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-2 focus:ring-ring touch-manipulation"
                        >
                          <option value={NONE_VALUE}>No phase</option>
                          {phases.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.costCode})
                            </option>
                          ))}
                        </select>
                        {/* Desktop */}
                        <div className="hidden sm:block">
                          <Select value={phaseId || NONE_VALUE} onValueChange={(v) => setPhaseId(v === NONE_VALUE ? "" : v)}>
                            <SelectTrigger id="phase" aria-label="Select phase">
                              <SelectValue placeholder="No phase" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE_VALUE}>No phase</SelectItem>
                              {phases.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name} ({p.costCode})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Equipment selector */}
                <MobileFriendlySelect
                  label="Equipment (optional)"
                  helpText="Track equipment used on this time entry for job costing"
                  value={equipmentId}
                  displayValue={selectedEquipmentLabel ? `${selectedEquipmentLabel.code} - ${selectedEquipmentLabel.name}` : ""}
                  placeholder="No equipment"
                  items={[
                    { id: NONE_VALUE, label: "No equipment" },
                    ...equipmentList.map((eq) => ({
                      id: eq.id,
                      label: `${eq.code} - ${eq.name}`,
                      sublabel: `${formatCurrency(eq.hourlyRate)}/hr`,
                    })),
                  ]}
                  onSelect={handleEquipmentChange}
                  recentIds={recentEquipmentIds}
                  desktopSelect={
                    <Select value={equipmentId || NONE_VALUE} onValueChange={handleEquipmentChange}>
                      <SelectTrigger aria-label="Select equipment">
                        <SelectValue placeholder="No equipment" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>No equipment</SelectItem>
                        {recentEquipmentIds.length > 0 && (
                          <>
                            <SelectGroup>
                              <SelectLabel className="text-xs text-muted-foreground font-normal">Recent</SelectLabel>
                              {recentEquipmentIds.map((id) => {
                                const eq = equipmentList.find((e) => e.id === id);
                                if (!eq) return null;
                                return (
                                  <SelectItem key={`recent-${eq.id}`} value={eq.id}>
                                    ⏱ {eq.code} - {eq.name} ({formatCurrency(eq.hourlyRate)}/hr)
                                  </SelectItem>
                                );
                              })}
                            </SelectGroup>
                            <SelectSeparator />
                          </>
                        )}
                        <SelectGroup>
                          {recentEquipmentIds.length > 0 && (
                            <SelectLabel className="text-xs text-muted-foreground font-normal">All Equipment</SelectLabel>
                          )}
                          {equipmentList.map((eq) => (
                            <SelectItem key={eq.id} value={eq.id}>
                              {eq.code} - {eq.name}{" "}
                              <span className="text-muted-foreground">
                                ({formatCurrency(eq.hourlyRate)}/hr)
                              </span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  }
                />
              </div>

              {/* Equipment Hours - animated reveal when equipment is selected */}
              {equipmentId && (
                <div className="space-y-2 animate-in fade-in-50 slide-in-from-top-1 duration-200">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="equipmentHours">Equipment Hours</Label>
                    {selectedEquipment && (
                      <span className="text-xs text-muted-foreground">
                        @ {formatCurrency(selectedEquipment.hourlyRate)}/hr
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 max-w-[250px]">
                    <button
                      type="button"
                      onClick={() => {
                        const v = Math.max(0, (parseFloat(equipmentHours) || 0) - 0.25);
                        setEquipmentHours(v.toString());
                        setEquipmentHoursManuallyEdited(true);
                      }}
                      className="flex-none flex items-center justify-center w-11 h-11 sm:w-9 sm:h-9 rounded-md border border-input bg-background hover:bg-muted active:bg-muted/80 transition-colors touch-manipulation"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <Input
                      id="equipmentHours"
                      type="number"
                      inputMode="decimal"
                      value={equipmentHours}
                      onChange={(e) => {
                        setEquipmentHours(e.target.value);
                        setEquipmentHoursManuallyEdited(true);
                      }}
                      min={0}
                      max={24}
                      step={0.25}
                      placeholder="0"
                      className="h-11 sm:h-9 text-center text-lg sm:text-sm font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const v = Math.min(24, (parseFloat(equipmentHours) || 0) + 0.25);
                        setEquipmentHours(v.toString());
                        setEquipmentHoursManuallyEdited(true);
                      }}
                      className="flex-none flex items-center justify-center w-11 h-11 sm:w-9 sm:h-9 rounded-md border border-input bg-background hover:bg-muted active:bg-muted/80 transition-colors touch-manipulation"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  {errors.equipmentHours && (
                    <p className="text-sm text-destructive" role="alert">{errors.equipmentHours}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Hours the equipment was used (auto-syncs with regular hours until you edit)
                  </p>
                </div>
              )}

              {/* Hours with Stepper Buttons */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Hours</Label>
                <div className="grid gap-4 grid-cols-3">
                  <HoursStepper
                    id="regularHours"
                    label="Regular"
                    value={regularHours}
                    onChange={setRegularHours}
                    colorClass="text-blue-600"
                  />
                  <HoursStepper
                    id="overtimeHours"
                    label="OT (1.5x)"
                    value={overtimeHours}
                    onChange={setOvertimeHours}
                    colorClass="text-amber-600"
                  />
                  <HoursStepper
                    id="doubletimeHours"
                    label="DT (2x)"
                    value={doubletimeHours}
                    onChange={setDoubletimeHours}
                    colorClass="text-red-600"
                  />
                </div>
                {errors.hours && (
                  <p className="text-sm text-destructive">{errors.hours}</p>
                )}
                <div className="flex items-center justify-between text-sm">
                  <p className="text-muted-foreground">
                    Total: <span className="font-mono font-semibold text-foreground">{totalHours.toFixed(2)}</span> hours
                  </p>
                  {/* Color-coded breakdown */}
                  <div className="flex items-center gap-3 text-xs font-mono">
                    {(parseFloat(regularHours) || 0) > 0 && (
                      <span className="text-blue-600">{parseFloat(regularHours).toFixed(1)}R</span>
                    )}
                    {(parseFloat(overtimeHours) || 0) > 0 && (
                      <span className="text-amber-600">{parseFloat(overtimeHours).toFixed(1)}OT</span>
                    )}
                    {(parseFloat(doubletimeHours) || 0) > 0 && (
                      <span className="text-red-600">{parseFloat(doubletimeHours).toFixed(1)}DT</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Work Description (optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of work performed..."
                  rows={2}
                  className="min-h-[48px] text-base sm:text-sm"
                />
              </div>
              </fieldset>

              {/* Running Cost Estimate */}
              {showCostEstimate && (
                <div className="animate-in fade-in-50 duration-300 border-t pt-4 mt-2">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">Estimated Cost</span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-blue-500" />
                      <span className="text-muted-foreground">Labor:</span>
                      <span className="font-mono font-medium">{formatCurrency(laborCostEstimate)}</span>
                    </div>
                    {equipmentId && equipmentCostEstimate > 0 && (
                      <div className="flex items-center gap-2 animate-in fade-in-50 duration-200">
                        <span className="text-amber-500">🚜</span>
                        <span className="text-muted-foreground">Equipment:</span>
                        <span className="font-mono font-medium">{formatCurrency(equipmentCostEstimate)}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 border-l pl-4">
                      <span className="text-muted-foreground font-medium">Total:</span>
                      <span className="font-mono font-semibold text-foreground">
                        {formatCurrency(laborCostEstimate + equipmentCostEstimate)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons - mobile optimized */}
              <div className="flex flex-col gap-3 pt-4">
                {/* Primary row: Save & Add Another is prominent on mobile */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <LoadingButton
                    type="submit"
                    className="bg-amber-500 hover:bg-amber-600 text-white min-h-[56px] sm:min-h-[44px] text-lg sm:text-sm font-semibold flex-1"
                    loading={isSubmitting}
                    loadingText="Creating..."
                  >
                    Create Entry
                  </LoadingButton>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-[56px] sm:min-h-[44px] text-lg sm:text-sm font-semibold border-amber-300 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 flex-1"
                    onClick={() => doSubmit(true)}
                    disabled={isSubmitting}
                  >
                    <Plus className="h-5 w-5 sm:h-4 sm:w-4 mr-2" />
                    Save &amp; Add Another
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-[44px] text-muted-foreground"
                  onClick={() => router.back()}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </ErrorBoundary>
  );
}
