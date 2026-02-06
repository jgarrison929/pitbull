"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingButton } from "@/components/ui/loading-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
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
import api from "@/lib/api";
import { getTodayISO } from "@/lib/time-tracking";
import type {
  CreateTimeEntryCommand,
  TimeEntry,
  PagedResult,
  Project,
  ListEmployeesResult,
  Employee,
  CostCode,
} from "@/lib/types";
import { toast } from "sonner";

interface CostCodeListResult {
  items: CostCode[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

type FormErrors = Partial<
  Record<
    "date" | "employeeId" | "projectId" | "costCodeId" | "hours" | "general",
    string
  >
>;

export default function NewTimeEntryPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Form state
  const [date, setDate] = useState(getTodayISO());
  const [employeeId, setEmployeeId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [costCodeId, setCostCodeId] = useState<string>("");
  const [regularHours, setRegularHours] = useState<string>("8");
  const [overtimeHours, setOvertimeHours] = useState<string>("0");
  const [doubletimeHours, setDoubletimeHours] = useState<string>("0");
  const [description, setDescription] = useState<string>("");

  // Options
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);

  const [errors, setErrors] = useState<FormErrors>({});

  // Calculate total hours
  const totalHours = useMemo(() => {
    const reg = parseFloat(regularHours) || 0;
    const ot = parseFloat(overtimeHours) || 0;
    const dt = parseFloat(doubletimeHours) || 0;
    return reg + ot + dt;
  }, [regularHours, overtimeHours, doubletimeHours]);

  useEffect(() => {
    async function loadOptions() {
      try {
        const [employeesRes, projectsRes, costCodesRes] = await Promise.all([
          api<ListEmployeesResult>("/api/employees?isActive=true&pageSize=200"),
          api<PagedResult<Project>>("/api/projects?pageSize=200"),
          api<CostCodeListResult>("/api/cost-codes?costType=1&pageSize=200"), // costType=1 is Labor
        ]);
        setEmployees(employeesRes.items);
        setProjects(projectsRes.items);
        setCostCodes(costCodesRes.items);
      } catch {
        toast.error("Failed to load form options");
      } finally {
        setIsLoading(false);
      }
    }
    loadOptions();
  }, []);

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

    return next;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
    };

    try {
      await api<TimeEntry>("/api/time-entries", {
        method: "POST",
        body: command,
      });
      toast.success("Time entry created successfully");
      router.push("/time-tracking");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create time entry"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Time Entry</h1>
          <p className="text-muted-foreground">Loading form...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Time Entry</h1>
        <p className="text-muted-foreground">
          Log hours for an employee on a project
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Time Entry Details</CardTitle>
          <CardDescription>
            Enter the date, employee, project, and hours worked
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <fieldset disabled={isSubmitting} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  max={getTodayISO()}
                  required
                />
                {errors.date && (
                  <p className="text-sm text-destructive">{errors.date}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="employee">Employee *</Label>
                <Select value={employeeId} onValueChange={setEmployeeId}>
                  <SelectTrigger>
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
                {errors.employeeId && (
                  <p className="text-sm text-destructive">{errors.employeeId}</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="project">Project *</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.number} - {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.projectId && (
                  <p className="text-sm text-destructive">{errors.projectId}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="costCode">Cost Code *</Label>
                <Select value={costCodeId} onValueChange={setCostCodeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select cost code" />
                  </SelectTrigger>
                  <SelectContent>
                    {costCodes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.code} - {c.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.costCodeId && (
                  <p className="text-sm text-destructive">{errors.costCodeId}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-medium">Hours</Label>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="regularHours" className="text-xs font-normal">
                    Regular
                  </Label>
                  <Input
                    id="regularHours"
                    type="number"
                    value={regularHours}
                    onChange={(e) => setRegularHours(e.target.value)}
                    min={0}
                    max={24}
                    step={0.25}
                    placeholder="8"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="overtimeHours" className="text-xs font-normal">
                    Overtime (1.5x)
                  </Label>
                  <Input
                    id="overtimeHours"
                    type="number"
                    value={overtimeHours}
                    onChange={(e) => setOvertimeHours(e.target.value)}
                    min={0}
                    max={24}
                    step={0.25}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="doubletimeHours"
                    className="text-xs font-normal"
                  >
                    Double Time (2x)
                  </Label>
                  <Input
                    id="doubletimeHours"
                    type="number"
                    value={doubletimeHours}
                    onChange={(e) => setDoubletimeHours(e.target.value)}
                    min={0}
                    max={24}
                    step={0.25}
                    placeholder="0"
                  />
                </div>
              </div>
              {errors.hours && (
                <p className="text-sm text-destructive">{errors.hours}</p>
              )}
              <p className="text-sm text-muted-foreground">
                Total: <span className="font-mono font-medium">{totalHours.toFixed(2)}</span> hours
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Work Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of work performed..."
                rows={3}
              />
            </div>
            </fieldset>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <LoadingButton
                type="submit"
                className="bg-amber-500 hover:bg-amber-600 text-white min-h-[44px]"
                loading={isSubmitting}
                loadingText="Creating..."
              >
                Create Entry
              </LoadingButton>
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px]"
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
  );
}
