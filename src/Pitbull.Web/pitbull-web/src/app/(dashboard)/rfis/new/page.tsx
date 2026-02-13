"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoadingButton } from "@/components/ui/loading-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { FormField, TextareaField } from "@/components/ui/form-field";
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
import type { Rfi, CreateRfiCommand, RfiPriority, Project, PagedResult } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type FormErrors = Partial<
  Record<"project" | "subject" | "question", string>
>;

const MAX_SUBJECT_LENGTH = 150;
const MAX_QUESTION_LENGTH = 2000;

export default function NewRfiPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get("projectId") || "";

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId);
  const [priority, setPriority] = useState<RfiPriority>(1); // Normal

  // Controlled form fields for validation
  const [subject, setSubject] = useState("");
  const [question, setQuestion] = useState("");

  // Cost impact state
  const [hasCostImpact, setHasCostImpact] = useState(false);

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Mark field as touched on blur
  const handleBlur = useCallback((field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  }, []);

  // Validate a single field
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

  // Check if form is valid
  const isFormValid = useMemo(() => {
    if (!selectedProjectId) return false;
    if (!subject.trim()) return false;
    if (subject.length > MAX_SUBJECT_LENGTH) return false;
    if (!question.trim()) return false;
    if (question.length > MAX_QUESTION_LENGTH) return false;
    return true;
  }, [selectedProjectId, subject, question]);

  // Update errors when fields change (only for touched fields)
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
        const result = await api<PagedResult<Project>>(
          "/api/projects?pageSize=100"
        );
        setProjects(result.items);
        // If no initial project, select first
        if (!initialProjectId && result.items.length > 0) {
          setSelectedProjectId(result.items[0].id);
        }
      } catch {
        toast.error("Failed to load projects");
      } finally {
        setIsLoadingProjects(false);
      }
    }
    fetchProjects();
  }, [initialProjectId]);

  // Validate project when it changes
  useEffect(() => {
    if (touched.project) {
      updateFieldError("project", selectedProjectId);
    }
  }, [selectedProjectId, touched.project, updateFieldError]);

  // Validate all fields on submit
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

    // Mark all fields as touched
    setTouched({
      project: true,
      subject: true,
      question: true,
    });

    const nextErrors = validateAll();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please fix the highlighted fields");
      return;
    }

    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);

    // Parse drawing references from comma-separated string
    const drawingRefsString = formData.get("drawingReferences") as string;
    const drawingRefs = drawingRefsString
      ? drawingRefsString.split(",").map((s) => s.trim()).filter((s) => s.length > 0)
      : undefined;

    // Parse cost impact fields
    const estimatedCostStr = formData.get("estimatedCostImpact") as string;
    const estimatedDelayStr = formData.get("estimatedDelayDays") as string;

    const command: CreateRfiCommand = {
      subject,
      question,
      priority,
      dueDate: (formData.get("dueDate") as string) || undefined,
      ballInCourtName: (formData.get("ballInCourtName") as string) || undefined,
      assignedToName: (formData.get("assignedToName") as string) || undefined,
      createdByName: (formData.get("createdByName") as string) || undefined,

      // Document references
      specSection: (formData.get("specSection") as string) || undefined,
      drawingReferences: drawingRefs,

      // Cost impact
      hasCostImpact,
      estimatedCostImpact: hasCostImpact && estimatedCostStr ? parseFloat(estimatedCostStr) : undefined,
      estimatedDelayDays: hasCostImpact && estimatedDelayStr ? parseInt(estimatedDelayStr) : undefined,
    };

    try {
      const rfi = await api<Rfi>(
        `/api/projects/${selectedProjectId}/rfis`,
        {
          method: "POST",
          body: command,
        }
      );
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
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New RFI</h1>
        <p className="text-muted-foreground">
          Create a new Request for Information
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>RFI Details</CardTitle>
          <CardDescription>
            Enter the information for this RFI
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <fieldset
              disabled={isSubmitting || isLoadingProjects}
              className="space-y-4"
            >
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
                    if (touched.project) {
                      updateFieldError("project", value);
                    }
                  }}
                >
                  <SelectTrigger 
                    className={cn(
                      touched.project && errors.project && "border-destructive"
                    )}
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

              <TextareaField
                label="Question"
                name="question"
                placeholder="Describe what you need clarification on..."
                rows={5}
                required
                maxLength={MAX_QUESTION_LENGTH}
                value={question}
                onChange={(e) => {
                  setQuestion(e.target.value);
                  updateFieldError("question", e.target.value);
                }}
                onBlur={() => handleBlur("question")}
                error={touched.question ? errors.question : undefined}
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
                      <SelectItem value="0">Low</SelectItem>
                      <SelectItem value="1">Normal</SelectItem>
                      <SelectItem value="2">High</SelectItem>
                      <SelectItem value="3">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input id="dueDate" name="dueDate" type="date" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ballInCourtName">Ball In Court</Label>
                  <Input
                    id="ballInCourtName"
                    name="ballInCourtName"
                    placeholder="Who needs to take action?"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assignedToName">Assigned To</Label>
                  <Input
                    id="assignedToName"
                    name="assignedToName"
                    placeholder="Who should respond?"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="createdByName">Created By</Label>
                <Input
                  id="createdByName"
                  name="createdByName"
                  placeholder="Your name"
                />
              </div>

              {/* Document References */}
              <Separator className="my-4" />
              <h3 className="text-sm font-semibold text-muted-foreground">Document References</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="specSection">Spec Section</Label>
                  <Input
                    id="specSection"
                    name="specSection"
                    placeholder="e.g., 03 30 00 - Cast-in-Place Concrete"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="drawingReferences">Drawing References</Label>
                  <Input
                    id="drawingReferences"
                    name="drawingReferences"
                    placeholder="e.g., S-101, S-102, D-001"
                  />
                </div>
              </div>

              {/* Cost Impact */}
              <Separator className="my-4" />
              <h3 className="text-sm font-semibold text-muted-foreground">Cost Impact</h3>

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
                    name="estimatedCostImpact"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    disabled={!hasCostImpact}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estimatedDelayDays">Estimated Delay (days)</Label>
                  <Input
                    id="estimatedDelayDays"
                    name="estimatedDelayDays"
                    type="number"
                    placeholder="0"
                    disabled={!hasCostImpact}
                  />
                </div>
              </div>
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
        </CardContent>
      </Card>
    </div>
  );
}
