"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoadingButton } from "@/components/ui/loading-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FormField, TextareaField } from "@/components/ui/form-field";
import { FormSection } from "@/components/ui/form-section";
import { FileDropZone } from "@/components/ui/file-drop-zone";
import { AvatarSelector } from "@/components/ui/avatar-selector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from "@/lib/api";
import type { Rfi, CreateRfiCommand, RfiPriority, Project, PagedResult } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useFormAutosave } from "@/hooks/use-form-autosave";
import {
  FileText,
  DollarSign,
  Info,
  Upload,
  Lightbulb,
  Save,
  AlertCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";

type FormErrors = Partial<
  Record<"project" | "subject" | "question", string>
>;

interface FileItem {
  id: string;
  name: string;
  size: number;
  type: string;
}

const MAX_SUBJECT_LENGTH = 150;
const MAX_QUESTION_LENGTH = 2000;

interface SimilarRfi {
  number: string;
  subject: string;
  status: string;
  reason: string;
  id?: string;
}

export default function NewRfiPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get("projectId") || "";

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId);
  const [priority, setPriority] = useState<RfiPriority>(1);

  // Controlled form fields
  const [subject, setSubject] = useState("");
  const [question, setQuestion] = useState("");
  const [ballInCourtName, setBallInCourtName] = useState("");
  const [assignedToName, setAssignedToName] = useState("");
  const [createdByName, setCreatedByName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [specSection, setSpecSection] = useState("");
  const [drawingReferences, setDrawingReferences] = useState("");

  // Cost impact
  const [hasCostImpact, setHasCostImpact] = useState(false);
  const [estimatedCostImpact, setEstimatedCostImpact] = useState("");
  const [estimatedDelayDays, setEstimatedDelayDays] = useState("");

  // File attachments (UI placeholder)
  const [attachments, setAttachments] = useState<FileItem[]>([]);

  // Similar RFIs suggestion
  const [similarRfis, setSimilarRfis] = useState<SimilarRfi[]>([]);
  const [isLoadingSimilar, setIsLoadingSimilar] = useState(false);

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isDirty, setIsDirty] = useState(false);

  // Track unsaved changes
  useUnsavedChanges(isDirty);

  // Auto-save draft
  const formData = useMemo(() => ({
    selectedProjectId, subject, question, priority, ballInCourtName,
    assignedToName, createdByName, dueDate, specSection, drawingReferences,
    hasCostImpact, estimatedCostImpact, estimatedDelayDays,
  }), [selectedProjectId, subject, question, priority, ballInCourtName,
    assignedToName, createdByName, dueDate, specSection, drawingReferences,
    hasCostImpact, estimatedCostImpact, estimatedDelayDays]);

  const { loadDraft, clearDraft } = useFormAutosave("rfi-new", formData, {
    enabled: isDirty,
  });

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
        if (d.selectedProjectId) setSelectedProjectId(d.selectedProjectId);
        if (d.subject) setSubject(d.subject);
        if (d.question) setQuestion(d.question);
        if (d.priority !== undefined) setPriority(d.priority);
        if (d.ballInCourtName) setBallInCourtName(d.ballInCourtName);
        if (d.assignedToName) setAssignedToName(d.assignedToName);
        if (d.createdByName) setCreatedByName(d.createdByName);
        if (d.dueDate) setDueDate(d.dueDate);
        if (d.specSection) setSpecSection(d.specSection);
        if (d.drawingReferences) setDrawingReferences(d.drawingReferences);
        if (d.hasCostImpact !== undefined) setHasCostImpact(d.hasCostImpact);
        if (d.estimatedCostImpact) setEstimatedCostImpact(d.estimatedCostImpact);
        if (d.estimatedDelayDays) setEstimatedDelayDays(d.estimatedDelayDays);
      }
    }
  }, [draftLoaded, loadDraft, clearDraft]);

  // Mark dirty on any change
  useEffect(() => {
    if (subject || question || ballInCourtName || assignedToName) {
      setIsDirty(true);
    }
  }, [subject, question, ballInCourtName, assignedToName]);

  // Fetch similar RFIs with debounce when subject has enough text
  useEffect(() => {
    if (subject.length < 10) {
      setSimilarRfis([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoadingSimilar(true);
      try {
        const results = await api<SimilarRfi[]>("/api/ai/suggest/similar-rfis", {
          method: "POST",
          body: { subject, description: question || undefined },
        });
        setSimilarRfis(results ?? []);
      } catch {
        // Silently fail — similar RFIs are a nice-to-have
        setSimilarRfis([]);
      } finally {
        setIsLoadingSimilar(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [subject, question]);

  // Team members for avatar selector (derived from project context)
  const teamMembers = useMemo(() => [
    { id: "1", name: "John Smith" },
    { id: "2", name: "Demo User" },
    { id: "3", name: "Mike Davis" },
    { id: "4", name: "Emily Wilson" },
    { id: "5", name: "Robert Brown" },
  ], []);

  const handleBlur = useCallback((field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  }, []);

  const validateField = useCallback((field: string, value: string): string | undefined => {
    switch (field) {
      case "project":
        if (!value) return "Please select a project";
        break;
      case "subject":
        if (!value.trim()) return "Subject is required";
        if (value.length > MAX_SUBJECT_LENGTH) return `Subject must be ${MAX_SUBJECT_LENGTH} characters or less`;
        break;
      case "question":
        if (!value.trim()) return "Question is required";
        if (value.length > MAX_QUESTION_LENGTH) return `Question must be ${MAX_QUESTION_LENGTH} characters or less`;
        break;
    }
    return undefined;
  }, []);

  const isFormValid = useMemo(() => {
    if (!selectedProjectId) return false;
    if (!subject.trim()) return false;
    if (subject.length > MAX_SUBJECT_LENGTH) return false;
    if (!question.trim()) return false;
    if (question.length > MAX_QUESTION_LENGTH) return false;
    return true;
  }, [selectedProjectId, subject, question]);

  const updateFieldError = useCallback((field: keyof FormErrors, value: string) => {
    if (touched[field]) {
      const error = validateField(field, value);
      setErrors(prev => {
        const next = { ...prev };
        if (error) {
          next[field] = error;
        } else {
          delete next[field];
        }
        return next;
      });
    }
  }, [touched, validateField]);

  useEffect(() => {
    async function fetchProjects() {
      try {
        const result = await api<PagedResult<Project>>("/api/projects?pageSize=100");
        setProjects(result.items);
        if (!initialProjectId && result.items.length > 0) {
          setSelectedProjectId(result.items[0]!.id);
        }
      } catch {
        toast.error("Failed to load projects");
      } finally {
        setIsLoadingProjects(false);
      }
    }
    fetchProjects();
  }, [initialProjectId]);

  useEffect(() => {
    if (touched.project) {
      updateFieldError("project", selectedProjectId);
    }
  }, [selectedProjectId, touched.project, updateFieldError]);

  function validateAll(): FormErrors {
    const next: FormErrors = {};
    const projectError = validateField("project", selectedProjectId);
    if (projectError) next.project = projectError;
    const subjectError = validateField("subject", subject);
    if (subjectError) next.subject = subjectError;
    const questionError = validateField("question", question);
    if (questionError) next.question = questionError;
    return next;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched({ project: true, subject: true, question: true });

    const nextErrors = validateAll();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please fix the highlighted fields");
      return;
    }

    setIsSubmitting(true);

    const drawingRefs = drawingReferences
      ? drawingReferences.split(",").map((s) => s.trim()).filter((s) => s.length > 0)
      : undefined;

    const command: CreateRfiCommand = {
      subject,
      question,
      priority,
      dueDate: dueDate || undefined,
      ballInCourtName: ballInCourtName || undefined,
      assignedToName: assignedToName || undefined,
      createdByName: createdByName || undefined,
      specSection: specSection || undefined,
      drawingReferences: drawingRefs,
      hasCostImpact,
      estimatedCostImpact: hasCostImpact && estimatedCostImpact ? parseFloat(estimatedCostImpact) : undefined,
      estimatedDelayDays: hasCostImpact && estimatedDelayDays ? parseInt(estimatedDelayDays) : undefined,
    };

    try {
      const rfi = await api<Rfi>(`/api/projects/${selectedProjectId}/rfis`, {
        method: "POST",
        body: command,
      });
      clearDraft();
      setIsDirty(false);
      toast.success("RFI created successfully");
      router.push(`/rfis/${rfi.id}?projectId=${selectedProjectId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create RFI");
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New RFI</h1>
          <p className="text-muted-foreground">
            Create a new Request for Information
          </p>
        </div>
        {isDirty && (
          <Badge variant="secondary" className="gap-1 text-xs animate-in fade-in-50">
            <Save className="h-3 w-3" />
            Draft auto-saved
          </Badge>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <fieldset disabled={isSubmitting || isLoadingProjects} className="space-y-4">

          {/* Section 1: Details */}
          <FormSection
            title="RFI Details"
            description="Basic information and assignment"
            icon={<Info className="h-4 w-4" />}
            defaultOpen={true}
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="project">
                    Project
                    <span className="text-destructive ml-1" aria-hidden="true">*</span>
                  </Label>
                </div>
                <Select
                  value={selectedProjectId}
                  onValueChange={(value) => {
                    setSelectedProjectId(value);
                    if (touched.project) updateFieldError("project", value);
                  }}
                >
                  <SelectTrigger
                    className={cn(touched.project && errors.project && "border-destructive")}
                    aria-invalid={!!(touched.project && errors.project)}
                    onBlur={() => handleBlur("project")}
                  >
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.number} - {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {touched.project && errors.project && (
                  <p className="text-sm text-destructive" role="alert">{errors.project}</p>
                )}
                {selectedProject && !errors.project && (
                  <p className="text-xs text-muted-foreground">
                    RFI will be added to: {selectedProject.name}
                  </p>
                )}
              </div>

              <FormField
                label="Subject"
                name="subject"
                placeholder="e.g. Foundation Depth Clarification"
                required
                maxLength={MAX_SUBJECT_LENGTH}
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  updateFieldError("subject", e.target.value);
                }}
                onBlur={() => handleBlur("subject")}
                error={touched.subject ? errors.subject : undefined}
              />

              {/* Similar RFIs suggestion */}
              {isLoadingSimilar && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/10 p-3 animate-in fade-in-50">
                  <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                  <span className="text-xs text-amber-700 dark:text-amber-400">Finding similar RFIs...</span>
                </div>
              )}
              {!isLoadingSimilar && similarRfis.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/10 p-3 animate-in fade-in-50 slide-in-from-top-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="h-4 w-4 text-amber-600" />
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Similar RFIs Found</span>
                  </div>
                  <ul className="space-y-1.5">
                    {similarRfis.map((s) => (
                      <li key={s.number} className="text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            <span className="font-mono font-medium">{s.number}</span>{" "}
                            {s.subject}
                            {s.id && (
                              <a
                                href={`/rfis/${s.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-1 inline-flex items-center text-amber-600 hover:text-amber-700"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                            {s.status}
                          </Badge>
                        </div>
                        {s.reason && (
                          <p className="text-muted-foreground/70 mt-0.5 pl-[3.5rem]">{s.reason}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <TextareaField
                label="Question"
                name="question"
                placeholder="Describe what you need clarification on...&#10;&#10;Tip: Use clear, specific language. Reference spec sections and drawing numbers."
                rows={6}
                required
                maxLength={MAX_QUESTION_LENGTH}
                value={question}
                onChange={(e) => {
                  setQuestion(e.target.value);
                  updateFieldError("question", e.target.value);
                }}
                onBlur={() => handleBlur("question")}
                error={touched.question ? errors.question : undefined}
                helpText="Supports multi-line text. Be specific about location, specification, and drawing references."
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={String(priority)}
                    onValueChange={(v) => setPriority(Number(v) as RfiPriority)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">🟢 Low</SelectItem>
                      <SelectItem value="1">🔵 Normal</SelectItem>
                      <SelectItem value="2">🟠 High</SelectItem>
                      <SelectItem value="3">🔴 Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    name="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Ball in court with avatars */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Ball In Court</Label>
                  <AvatarSelector
                    options={teamMembers}
                    value={ballInCourtName}
                    onChange={setBallInCourtName}
                    placeholder="Who needs to take action?"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Assigned To</Label>
                  <AvatarSelector
                    options={teamMembers}
                    value={assignedToName}
                    onChange={setAssignedToName}
                    placeholder="Who should respond?"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="createdByName">Created By</Label>
                <Input
                  id="createdByName"
                  value={createdByName}
                  onChange={(e) => setCreatedByName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
            </div>
          </FormSection>

          {/* Section 2: Document References */}
          <FormSection
            title="Document References"
            description="Spec sections, drawings, and attachments"
            icon={<FileText className="h-4 w-4" />}
            defaultOpen={false}
          >
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="specSection">Spec Section</Label>
                  <Input
                    id="specSection"
                    value={specSection}
                    onChange={(e) => setSpecSection(e.target.value)}
                    placeholder="e.g., 03 30 00 - Cast-in-Place Concrete"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="drawingReferences">Drawing References</Label>
                  <Input
                    id="drawingReferences"
                    value={drawingReferences}
                    onChange={(e) => setDrawingReferences(e.target.value)}
                    placeholder="e.g., S-101, S-102, D-001"
                  />
                  <p className="text-xs text-muted-foreground">Separate multiple with commas</p>
                </div>
              </div>

              {/* File attachment drop zone */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Upload className="h-3.5 w-3.5" />
                  Attachments
                </Label>
                <FileDropZone
                  files={attachments}
                  onFilesChange={setAttachments}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png,.dwg"
                  maxFiles={5}
                  maxSizeMB={25}
                  placeholder="Drop drawings, specs, or photos here"
                />
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  File upload will be available in a future update. Files are tracked locally for now.
                </p>
              </div>
            </div>
          </FormSection>

          {/* Section 3: Cost Impact */}
          <FormSection
            title="Cost Impact"
            description="Track estimated cost and schedule impact"
            icon={<DollarSign className="h-4 w-4" />}
            defaultOpen={false}
            badge={
              hasCostImpact ? (
                <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-[10px] ml-2">
                  Has Impact
                </Badge>
              ) : null
            }
          >
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="hasCostImpact">Has Cost Impact</Label>
                  <Select
                    value={hasCostImpact ? "true" : "false"}
                    onValueChange={(v) => setHasCostImpact(v === "true")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="false">No</SelectItem>
                      <SelectItem value="true">Yes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estimatedCostImpact">Estimated Cost ($)</Label>
                  <Input
                    id="estimatedCostImpact"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={estimatedCostImpact}
                    onChange={(e) => setEstimatedCostImpact(e.target.value)}
                    disabled={!hasCostImpact}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estimatedDelayDays">Estimated Delay (days)</Label>
                  <Input
                    id="estimatedDelayDays"
                    type="number"
                    placeholder="0"
                    value={estimatedDelayDays}
                    onChange={(e) => setEstimatedDelayDays(e.target.value)}
                    disabled={!hasCostImpact}
                  />
                </div>
              </div>

              {hasCostImpact && estimatedCostImpact && (
                <div className="rounded-md border bg-amber-50/50 dark:bg-amber-900/10 p-3 text-sm animate-in fade-in-50">
                  <p className="font-medium text-amber-700 dark:text-amber-400">
                    💰 Estimated Impact: ${Number(estimatedCostImpact).toLocaleString()}
                    {estimatedDelayDays && ` · ${estimatedDelayDays} day${Number(estimatedDelayDays) !== 1 ? "s" : ""} delay`}
                  </p>
                </div>
              )}
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
            Create RFI
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
