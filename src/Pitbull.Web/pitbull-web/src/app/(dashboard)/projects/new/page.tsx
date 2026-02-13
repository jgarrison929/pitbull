"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { LoadingButton } from "@/components/ui/loading-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { projectTypeOptions } from "@/lib/projects";
import type { CreateProjectCommand, Project, ProjectType } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type FormErrors = Partial<
  Record<"number" | "name" | "contractAmount" | "dates" | "email", string>
>;

const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;

export default function NewProjectPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Controlled form fields for validation
  const [projectNumber, setProjectNumber] = useState("");
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [contractAmount, setContractAmount] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [startDate, setStartDate] = useState("");
  const [estimatedCompletionDate, setEstimatedCompletionDate] = useState("");

  // The API expects a numeric enum for ProjectType (System.Text.Json default).
  const [type, setType] = useState<ProjectType>(projectTypeOptions[0]!.value);

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const typeSelectValue = useMemo(() => String(type), [type]);

  // Mark field as touched on blur
  const handleBlur = useCallback((field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  }, []);

  // Validate in real-time
  const validateField = useCallback((field: string, value: string): string | undefined => {
    switch (field) {
      case "number":
        if (!value.trim()) return "Project number is required";
        break;
      case "name":
        if (!value.trim()) return "Project name is required";
        if (value.length > MAX_NAME_LENGTH) return `Project name must be ${MAX_NAME_LENGTH} characters or less`;
        break;
      case "contractAmount":
        if (value && (isNaN(Number(value)) || Number(value) < 0)) {
          return "Contract amount must be 0 or greater";
        }
        break;
      case "email":
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return "Please enter a valid email address";
        }
        break;
    }
    return undefined;
  }, []);

  // Validate dates together
  const validateDates = useCallback((): string | undefined => {
    if (startDate && estimatedCompletionDate) {
      const start = new Date(startDate);
      const end = new Date(estimatedCompletionDate);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end < start) {
        return "Estimated completion date must be after start date";
      }
    }
    return undefined;
  }, [startDate, estimatedCompletionDate]);

  // Check if form is valid
  const isFormValid = useMemo(() => {
    if (!projectNumber.trim() || !projectName.trim()) return false;
    if (projectName.length > MAX_NAME_LENGTH) return false;
    if (description.length > MAX_DESCRIPTION_LENGTH) return false;
    if (contractAmount && (isNaN(Number(contractAmount)) || Number(contractAmount) < 0)) return false;
    if (clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) return false;
    if (validateDates()) return false;
    return true;
  }, [projectNumber, projectName, description, contractAmount, clientEmail, validateDates]);

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

  // Validate all fields on submit
  function validateAll(): FormErrors {
    const next: FormErrors = {};

    const numberError = validateField("number", projectNumber);
    if (numberError) next.number = numberError;

    const nameError = validateField("name", projectName);
    if (nameError) next.name = nameError;

    const amountError = validateField("contractAmount", contractAmount);
    if (amountError) next.contractAmount = amountError;

    const emailError = validateField("email", clientEmail);
    if (emailError) next.email = emailError;

    const datesError = validateDates();
    if (datesError) next.dates = datesError;

    return next;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    
    // Mark all fields as touched
    setTouched({
      number: true,
      name: true,
      contractAmount: true,
      email: true,
      dates: true,
    });

    const nextErrors = validateAll();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please fix the highlighted fields");
      return;
    }

    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);

    const command: CreateProjectCommand = {
      number: projectNumber,
      name: projectName,
      description: description || undefined,
      type,
      address: (formData.get("address") as string) || undefined,
      city: (formData.get("city") as string) || undefined,
      state: (formData.get("state") as string) || undefined,
      zipCode: (formData.get("zipCode") as string) || undefined,
      clientName: (formData.get("clientName") as string) || undefined,
      clientContact: (formData.get("clientContact") as string) || undefined,
      clientEmail: clientEmail || undefined,
      clientPhone: (formData.get("clientPhone") as string) || undefined,
      startDate: startDate || undefined,
      estimatedCompletionDate: estimatedCompletionDate || undefined,
      contractAmount: contractAmount ? Number(contractAmount) : 0,
    };

    try {
      const project = await api<Project>("/api/projects", {
        method: "POST",
        body: command,
      });
      toast.success("Project created successfully");
      router.push(`/projects/${project.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Project</h1>
        <p className="text-muted-foreground">Create a new construction project</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
          <CardDescription>Enter the basic information for this project</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <fieldset disabled={isSubmitting} className="space-y-4">
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

            <TextareaField
              label="Description"
              name="description"
              placeholder="Brief description of the project scope..."
              rows={3}
              maxLength={MAX_DESCRIPTION_LENGTH}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
                <Input id="clientName" name="clientName" placeholder="Client name" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="clientContact">Client Contact</Label>
                <Input id="clientContact" name="clientContact" placeholder="Contact person" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientPhone">Client Phone</Label>
                <Input id="clientPhone" name="clientPhone" placeholder="(555) 555-5555" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
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
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" name="address" placeholder="Street address" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" name="city" placeholder="City" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input id="state" name="state" placeholder="CA" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="zipCode">Zip Code</Label>
                <Input id="zipCode" name="zipCode" placeholder="94105" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input 
                  id="startDate" 
                  name="startDate" 
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  onBlur={() => handleBlur("dates")}
                  className={cn(touched.dates && errors.dates && "border-destructive")}
                  aria-invalid={!!(touched.dates && errors.dates)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimatedCompletionDate">Estimated Completion</Label>
                <Input
                  id="estimatedCompletionDate"
                  name="estimatedCompletionDate"
                  type="date"
                  value={estimatedCompletionDate}
                  onChange={(e) => setEstimatedCompletionDate(e.target.value)}
                  onBlur={() => handleBlur("dates")}
                  className={cn(touched.dates && errors.dates && "border-destructive")}
                  aria-invalid={!!(touched.dates && errors.dates)}
                />
              </div>
            </div>

            {touched.dates && errors.dates && (
              <p className="text-sm text-destructive" role="alert">{errors.dates}</p>
            )}
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
        </CardContent>
      </Card>
    </div>
  );
}
