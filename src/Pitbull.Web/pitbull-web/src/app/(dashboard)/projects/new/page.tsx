"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingButton } from "@/components/ui/loading-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FormField } from "@/components/ui/form-field";
import { SmartField } from "@/components/ui/smart-field";
import { FormSection } from "@/components/ui/form-section";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from "@/lib/api";
import { projectTypeOptions } from "@/lib/projects";
import type {
  CreateProjectCommand,
  Project,
  ProjectType,
  Employee,
  ListEmployeesResult,
} from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useFormAutosave } from "@/hooks/use-form-autosave";
import {
  Users,
  Layers,
  MapPin,
  Building2,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  UserPlus,
} from "lucide-react";

type FormErrors = Partial<
  Record<"number" | "name" | "contractAmount" | "dates" | "email", string>
>;

interface PhaseItem {
  id: string;
  name: string;
  costCode: string;
  budget: number;
}

interface TeamMember {
  employeeId: string;
  employeeName: string;
  role: string;
}

const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;

// Project templates
const PROJECT_TEMPLATES = [
  {
    id: "commercial",
    label: "🏢 Commercial Building",
    description: "Office, retail, or mixed-use construction",
    phases: [
      { name: "Site Work", costCode: "02000" },
      { name: "Foundation", costCode: "03000" },
      { name: "Structural", costCode: "05000" },
      { name: "Mechanical", costCode: "15000" },
      { name: "Electrical", costCode: "16000" },
      { name: "Finishes", costCode: "09000" },
    ],
  },
  {
    id: "residential",
    label: "🏠 Residential",
    description: "Single or multi-family housing",
    phases: [
      { name: "Site Prep", costCode: "02000" },
      { name: "Foundation", costCode: "03000" },
      { name: "Framing", costCode: "06000" },
      { name: "Rough-In", costCode: "15000" },
      { name: "Exterior", costCode: "07000" },
      { name: "Interior Finish", costCode: "09000" },
    ],
  },
  {
    id: "roadwork",
    label: "🛣️ Road Work",
    description: "Road construction and infrastructure",
    phases: [
      { name: "Clearing & Grubbing", costCode: "02100" },
      { name: "Earthwork", costCode: "02200" },
      { name: "Base Course", costCode: "02500" },
      { name: "Paving", costCode: "02600" },
      { name: "Drainage", costCode: "02700" },
      { name: "Signage & Striping", costCode: "02800" },
    ],
  },
  {
    id: "renovation",
    label: "🔨 Renovation",
    description: "Building renovation or tenant improvement",
    phases: [
      { name: "Demolition", costCode: "02050" },
      { name: "Structural Mods", costCode: "05000" },
      { name: "MEP Rough-In", costCode: "15000" },
      { name: "Finishes", costCode: "09000" },
      { name: "Punch List", costCode: "01700" },
    ],
  },
  {
    id: "blank",
    label: "📋 Blank Project",
    description: "Start from scratch",
    phases: [],
  },
];

const TEAM_ROLES = [
  "Project Manager",
  "Superintendent",
  "Foreman",
  "Estimator",
  "Safety Manager",
  "Quality Control",
  "Admin/Coordinator",
];

export default function NewProjectPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Controlled form fields
  const [projectNumber, setProjectNumber] = useState("");
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [contractAmount, setContractAmount] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientContact, setClientContact] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [startDate, setStartDate] = useState("");
  const [estimatedCompletionDate, setEstimatedCompletionDate] = useState("");
  const [type, setType] = useState<ProjectType>(projectTypeOptions[0]!.value);

  // Template selection
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Phase builder
  const [phases, setPhases] = useState<PhaseItem[]>([]);

  // Team assignment
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isDirty, setIsDirty] = useState(false);

  useUnsavedChanges(isDirty);

  const formDataForSave = useMemo(() => ({
    projectNumber, projectName, description, contractAmount, clientName,
    address, city, state, zipCode, startDate, estimatedCompletionDate,
  }), [projectNumber, projectName, description, contractAmount, clientName,
    address, city, state, zipCode, startDate, estimatedCompletionDate]);

  const { loadDraft, clearDraft } = useFormAutosave("project-new", formDataForSave, {
    enabled: isDirty,
  });

  const typeSelectValue = useMemo(() => String(type), [type]);

  // Load draft on mount
  const [draftLoaded, setDraftLoaded] = useState(false);
  useEffect(() => {
    if (draftLoaded) return;
    setDraftLoaded(true);
    const draft = loadDraft();
    if (draft) {
      const ago = new Date().getTime() - new Date(draft.savedAt).getTime();
      const minsAgo = Math.floor(ago / 60000);
      if (minsAgo < 60 * 24) {
        toast.info(`Draft restored from ${minsAgo < 1 ? "just now" : `${minsAgo}m ago`}`, {
          action: {
            label: "Discard",
            onClick: () => {
              clearDraft();
              window.location.reload();
            },
          },
        });
        const d = draft.data;
        if (d.projectNumber) setProjectNumber(d.projectNumber);
        if (d.projectName) setProjectName(d.projectName);
        if (d.description) setDescription(d.description);
        if (d.contractAmount) setContractAmount(d.contractAmount);
        if (d.clientName) setClientName(d.clientName);
        if (d.address) setAddress(d.address);
        if (d.city) setCity(d.city);
        if (d.state) setState(d.state);
        if (d.zipCode) setZipCode(d.zipCode);
        if (d.startDate) setStartDate(d.startDate);
        if (d.estimatedCompletionDate) setEstimatedCompletionDate(d.estimatedCompletionDate);
      }
    }
  }, [draftLoaded, loadDraft, clearDraft]);

  // Load employees for team assignment
  useEffect(() => {
    async function fetchEmployees() {
      setIsLoadingEmployees(true);
      try {
        const result = await api<ListEmployeesResult>("/api/employees?isActive=true&pageSize=200");
        setEmployees(result.items);
      } catch {
        // Silently fail - team assignment is optional
      } finally {
        setIsLoadingEmployees(false);
      }
    }
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (projectNumber || projectName) setIsDirty(true);
  }, [projectNumber, projectName]);

  // Phase budget total
  const phaseBudgetTotal = useMemo(() => {
    return phases.reduce((sum, p) => sum + (p.budget || 0), 0);
  }, [phases]);

  const contractAmountNum = parseFloat(contractAmount) || 0;
  const budgetRemaining = contractAmountNum - phaseBudgetTotal;

  // Template selection handler
  function applyTemplate(templateId: string) {
    const template = PROJECT_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    setSelectedTemplate(templateId);
    setPhases(
      template.phases.map((p, i) => ({
        id: `${Date.now()}-${i}`,
        name: p.name,
        costCode: p.costCode,
        budget: 0,
      }))
    );
    toast.success(`Applied "${template.label.replace(/^.+\s/, "")}" template`);
  }

  // Phase management
  function addPhase() {
    setPhases(prev => [
      ...prev,
      { id: `${Date.now()}`, name: "", costCode: "", budget: 0 },
    ]);
  }

  function updatePhase(id: string, field: keyof PhaseItem, value: string | number) {
    setPhases(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  }

  function removePhase(id: string) {
    setPhases(prev => prev.filter(p => p.id !== id));
  }

  // Team management
  function addTeamMember() {
    setTeam(prev => [...prev, { employeeId: "", employeeName: "", role: "" }]);
  }

  function updateTeamMember(index: number, field: keyof TeamMember, value: string) {
    setTeam(prev => {
      const next = [...prev];
      const member = { ...next[index]! };
      if (field === "employeeId") {
        member.employeeId = value;
        const emp = employees.find(e => e.id === value);
        member.employeeName = emp?.fullName || "";
      } else {
        (member as Record<string, string>)[field] = value;
      }
      next[index] = member;
      return next;
    });
  }

  function removeTeamMember(index: number) {
    setTeam(prev => prev.filter((_, i) => i !== index));
  }

  // Validation
  const handleBlur = useCallback((field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  }, []);

  const validateField = useCallback((field: string, value: string): string | undefined => {
    switch (field) {
      case "number":
        if (!value.trim()) return "Project number is required";
        break;
      case "name":
        if (!value.trim()) return "Project name is required";
        if (value.length > MAX_NAME_LENGTH) return `Must be ${MAX_NAME_LENGTH} characters or less`;
        break;
      case "contractAmount":
        if (value && (isNaN(Number(value)) || Number(value) < 0)) return "Must be 0 or greater";
        break;
      case "email":
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Please enter a valid email";
        break;
    }
    return undefined;
  }, []);

  const validateDates = useCallback((): string | undefined => {
    if (startDate && estimatedCompletionDate) {
      const s = new Date(startDate);
      const e = new Date(estimatedCompletionDate);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e < s) {
        return "Completion date must be after start date";
      }
    }
    return undefined;
  }, [startDate, estimatedCompletionDate]);

  const isFormValid = useMemo(() => {
    if (!projectNumber.trim() || !projectName.trim()) return false;
    if (projectName.length > MAX_NAME_LENGTH) return false;
    if (description.length > MAX_DESCRIPTION_LENGTH) return false;
    if (contractAmount && (isNaN(Number(contractAmount)) || Number(contractAmount) < 0)) return false;
    if (clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) return false;
    if (validateDates()) return false;
    return true;
  }, [projectNumber, projectName, description, contractAmount, clientEmail, validateDates]);

  const updateFieldError = useCallback((field: keyof FormErrors, value: string) => {
    if (touched[field]) {
      const error = validateField(field, value);
      setErrors(prev => {
        const next = { ...prev };
        if (error) next[field] = error;
        else delete next[field];
        return next;
      });
    }
  }, [touched, validateField]);

  function validateAll(): FormErrors {
    const next: FormErrors = {};
    const numErr = validateField("number", projectNumber);
    if (numErr) next.number = numErr;
    const nameErr = validateField("name", projectName);
    if (nameErr) next.name = nameErr;
    const amtErr = validateField("contractAmount", contractAmount);
    if (amtErr) next.contractAmount = amtErr;
    const emailErr = validateField("email", clientEmail);
    if (emailErr) next.email = emailErr;
    const datesErr = validateDates();
    if (datesErr) next.dates = datesErr;
    return next;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched({ number: true, name: true, contractAmount: true, email: true, dates: true });

    const nextErrors = validateAll();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please fix the highlighted fields");
      return;
    }

    setIsSubmitting(true);

    const command: CreateProjectCommand = {
      number: projectNumber,
      name: projectName,
      description: description || undefined,
      type,
      address: address || undefined,
      city: city || undefined,
      state: state || undefined,
      zipCode: zipCode || undefined,
      clientName: clientName || undefined,
      clientContact: clientContact || undefined,
      clientEmail: clientEmail || undefined,
      clientPhone: clientPhone || undefined,
      startDate: startDate || undefined,
      estimatedCompletionDate: estimatedCompletionDate || undefined,
      contractAmount: contractAmount ? Number(contractAmount) : 0,
    };

    try {
      const project = await api<Project>("/api/projects", { method: "POST", body: command });
      clearDraft();
      setIsDirty(false);
      toast.success("Project created successfully");
      router.push(`/projects/${project.id}`);
    } catch (err) {
      toast.error("Failed to create project", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Breadcrumbs items={[{ label: "Projects", href: "/projects" }, { label: "New Project" }]} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Project</h1>
          <p className="text-muted-foreground">Create a new construction project</p>
        </div>
        {isDirty && (
          <Badge variant="secondary" className="gap-1 text-xs animate-in fade-in-50">
            <Save className="h-3 w-3" />
            Draft auto-saved
          </Badge>
        )}
      </div>

      {/* Template Selector */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Start from a template</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {PROJECT_TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.id}
              type="button"
              onClick={() => applyTemplate(tmpl.id)}
              className={cn(
                "rounded-lg border p-3 text-left transition-all hover:border-amber-300 hover:shadow-sm",
                selectedTemplate === tmpl.id
                  ? "border-amber-500 bg-amber-50 dark:bg-amber-900/10 ring-1 ring-amber-500"
                  : "border-border"
              )}
            >
              <p className="text-sm font-medium leading-tight">{tmpl.label}</p>
              <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{tmpl.description}</p>
              {selectedTemplate === tmpl.id && (
                <CheckCircle2 className="h-3.5 w-3.5 text-amber-500 mt-1.5" />
              )}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <fieldset disabled={isSubmitting} className="space-y-4">

          {/* Section 1: Basic Info */}
          <FormSection
            title="Project Details"
            description="Number, name, type, and contract value"
            icon={<Building2 className="h-4 w-4" />}
            defaultOpen={true}
          >
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Project Number"
                  name="number"
                  placeholder="PRJ-2026-001"
                  required
                  value={projectNumber}
                  onChange={(e) => {
                    setProjectNumber(e.target.value);
                    updateFieldError("number", e.target.value);
                  }}
                  onBlur={() => handleBlur("number")}
                  error={touched.number ? errors.number : undefined}
                />
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={typeSelectValue}
                    onValueChange={(v) => setType(Number(v) as ProjectType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {projectTypeOptions.map((opt) => (
                        <SelectItem key={opt.value} value={String(opt.value)}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <FormField
                label="Project Name"
                name="name"
                placeholder="e.g. Downtown Office Complex"
                required
                maxLength={MAX_NAME_LENGTH}
                value={projectName}
                onChange={(e) => {
                  setProjectName(e.target.value);
                  updateFieldError("name", e.target.value);
                }}
                onBlur={() => handleBlur("name")}
                error={touched.name ? errors.name : undefined}
              />

              <SmartField
                label="Description"
                fieldName="description"
                entityType="project"
                placeholder="Brief description of the project scope..."
                rows={3}
                value={description}
                onChange={setDescription}
                context={{ projectName: projectName || "", projectType: String(type) }}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Contract Amount ($)"
                  name="contractAmount"
                  type="number"
                  placeholder="0.00"
                  min={0}
                  step={0.01}
                  required
                  value={contractAmount}
                  onChange={(e) => {
                    setContractAmount(e.target.value);
                    updateFieldError("contractAmount", e.target.value);
                  }}
                  onBlur={() => handleBlur("contractAmount")}
                  error={touched.contractAmount ? errors.contractAmount : undefined}
                />
                <div className="space-y-2">
                  <Label htmlFor="clientName">Client Name</Label>
                  <Input
                    id="clientName"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Client name"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="clientContact">Client Contact</Label>
                  <Input
                    id="clientContact"
                    value={clientContact}
                    onChange={(e) => setClientContact(e.target.value)}
                    placeholder="Contact person"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientPhone">Client Phone</Label>
                  <Input
                    id="clientPhone"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="(555) 555-5555"
                  />
                </div>
              </div>

              <FormField
                label="Client Email"
                name="clientEmail"
                type="email"
                placeholder="name@company.com"
                value={clientEmail}
                onChange={(e) => {
                  setClientEmail(e.target.value);
                  updateFieldError("email", e.target.value);
                }}
                onBlur={() => handleBlur("email")}
                error={touched.email ? errors.email : undefined}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    onBlur={() => handleBlur("dates")}
                    className={cn(touched.dates && errors.dates && "border-destructive")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estCompletion">Estimated Completion</Label>
                  <Input
                    id="estCompletion"
                    type="date"
                    value={estimatedCompletionDate}
                    onChange={(e) => setEstimatedCompletionDate(e.target.value)}
                    onBlur={() => handleBlur("dates")}
                    className={cn(touched.dates && errors.dates && "border-destructive")}
                  />
                </div>
              </div>
              {touched.dates && errors.dates && (
                <p className="text-sm text-destructive" role="alert">{errors.dates}</p>
              )}
            </div>
          </FormSection>

          {/* Section 2: Location */}
          <FormSection
            title="Location"
            description="Project address and site information"
            icon={<MapPin className="h-4 w-4" />}
            defaultOpen={false}
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address">Street Address</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street address"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input id="state" value={state} onChange={(e) => setState(e.target.value)} placeholder="CA" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zipCode">Zip Code</Label>
                  <Input id="zipCode" value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="94105" />
                </div>
              </div>

              {/* Map placeholder */}
              {address && (
                <div className="rounded-lg border-2 border-dashed bg-muted/30 p-8 text-center animate-in fade-in-50">
                  <MapPin className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Map preview will appear here in a future update
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {[address, city, state, zipCode].filter(Boolean).join(", ")}
                  </p>
                </div>
              )}
            </div>
          </FormSection>

          {/* Section 3: Phases */}
          <FormSection
            title="Project Phases"
            description="Define phases and allocate budget"
            icon={<Layers className="h-4 w-4" />}
            defaultOpen={phases.length > 0}
            badge={
              phases.length > 0 ? (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {phases.length} phase{phases.length !== 1 ? "s" : ""}
                </Badge>
              ) : null
            }
          >
            <div className="space-y-4">
              {/* Phase header */}
              {phases.length > 0 && (
                <div className="hidden sm:grid sm:grid-cols-[1fr_100px_120px_40px] gap-2 text-xs font-medium text-muted-foreground px-1">
                  <span>Phase Name</span>
                  <span>Cost Code</span>
                  <span>Budget ($)</span>
                  <span></span>
                </div>
              )}

              {phases.map((phase, index) => (
                <div
                  key={phase.id}
                  className="grid gap-2 sm:grid-cols-[1fr_100px_120px_40px] items-start rounded-md border bg-accent/10 p-2 animate-in fade-in-50 slide-in-from-top-1"
                >
                  <Input
                    placeholder={`Phase ${index + 1}`}
                    value={phase.name}
                    onChange={(e) => updatePhase(phase.id, "name", e.target.value)}
                    className="text-sm"
                  />
                  <Input
                    placeholder="02000"
                    value={phase.costCode}
                    onChange={(e) => updatePhase(phase.id, "costCode", e.target.value)}
                    className="text-sm font-mono"
                  />
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={phase.budget || ""}
                    onChange={(e) => updatePhase(phase.id, "budget", Number(e.target.value) || 0)}
                    className="text-sm text-right"
                    placeholder="0.00"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-destructive"
                    onClick={() => removePhase(phase.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button type="button" variant="outline" size="sm" onClick={addPhase} className="gap-1">
                <Plus className="h-3.5 w-3.5" />
                Add Phase
              </Button>

              {/* Budget allocation summary */}
              {phases.length > 0 && contractAmountNum > 0 && (
                <div className="rounded-lg border bg-card p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Contract Amount</span>
                    <span className="font-medium">${contractAmountNum.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Allocated to Phases</span>
                    <span className="font-medium">${phaseBudgetTotal.toLocaleString()}</span>
                  </div>
                  <hr />
                  <div className="flex justify-between">
                    <span className="font-semibold">Remaining</span>
                    <span className={cn("font-bold", budgetRemaining < 0 ? "text-red-600" : "text-green-600")}>
                      ${budgetRemaining.toLocaleString()}
                    </span>
                  </div>
                  {budgetRemaining < 0 && (
                    <p className="text-xs text-red-600">⚠️ Phase budgets exceed contract amount</p>
                  )}
                </div>
              )}
            </div>
          </FormSection>

          {/* Section 4: Team Assignment */}
          <FormSection
            title="Team Assignment"
            description="Assign employees to this project"
            icon={<Users className="h-4 w-4" />}
            defaultOpen={false}
            badge={
              team.length > 0 ? (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {team.length} member{team.length !== 1 ? "s" : ""}
                </Badge>
              ) : null
            }
          >
            <div className="space-y-4">
              {team.map((member, index) => (
                <div
                  key={index}
                  className="grid gap-2 sm:grid-cols-[1fr_1fr_40px] items-start rounded-md border bg-accent/10 p-2 animate-in fade-in-50"
                >
                  <Select
                    value={member.employeeId || "none"}
                    onValueChange={(v) => updateTeamMember(index, "employeeId", v === "none" ? "" : v)}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select employee...</SelectItem>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.fullName} ({emp.employeeNumber})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={member.role || "none"}
                    onValueChange={(v) => updateTeamMember(index, "role", v === "none" ? "" : v)}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select role...</SelectItem>
                      {TEAM_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>{role}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-destructive"
                    onClick={() => removeTeamMember(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addTeamMember}
                className="gap-1"
                disabled={isLoadingEmployees}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Add Team Member
              </Button>
              <p className="text-xs text-muted-foreground">
                Team assignments can also be managed from the project detail page after creation.
              </p>
            </div>
          </FormSection>
        </fieldset>

        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <LoadingButton
            type="submit"
            className="bg-amber-500 hover:bg-amber-600 text-white min-h-[44px] disabled:opacity-50"
            loading={isSubmitting}
            loadingText="Creating..."
            disabled={!isFormValid}
          >
            Create Project
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
    </div>
  );
}
