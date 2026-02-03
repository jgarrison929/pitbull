"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { projectTypeOptions } from "@/lib/projects";
import type { CreateProjectCommand, Project, ProjectType } from "@/lib/types";
import { toast } from "sonner";

type FormErrors = Partial<
  Record<"number" | "name" | "contractAmount" | "dates", string>
>;

export default function NewProjectPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // The API expects a numeric enum for ProjectType (System.Text.Json default).
  const [type, setType] = useState<ProjectType>(projectTypeOptions[0]!.value);

  const [errors, setErrors] = useState<FormErrors>({});

  const typeSelectValue = useMemo(() => String(type), [type]);

  function validate(command: CreateProjectCommand): FormErrors {
    const next: FormErrors = {};

    if (!command.number?.trim()) next.number = "Project number is required";
    if (!command.name?.trim()) next.name = "Project name is required";

    if (Number.isNaN(command.contractAmount) || command.contractAmount < 0) {
      next.contractAmount = "Contract amount must be 0 or greater";
    }

    if (command.startDate && command.estimatedCompletionDate) {
      const start = new Date(command.startDate);
      const end = new Date(command.estimatedCompletionDate);
      if (
        !Number.isNaN(start.getTime()) &&
        !Number.isNaN(end.getTime()) &&
        end < start
      ) {
        next.dates = "Estimated completion date must be after start date";
      }
    }

    return next;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);

    const contractAmountRaw = formData.get("contractAmount") as string | null;
    const contractAmount = contractAmountRaw ? Number(contractAmountRaw) : 0;

    const command: CreateProjectCommand = {
      number: (formData.get("number") as string) || "",
      name: (formData.get("name") as string) || "",
      description: (formData.get("description") as string) || undefined,
      type,
      address: (formData.get("address") as string) || undefined,
      city: (formData.get("city") as string) || undefined,
      state: (formData.get("state") as string) || undefined,
      zipCode: (formData.get("zipCode") as string) || undefined,
      clientName: (formData.get("clientName") as string) || undefined,
      clientContact: (formData.get("clientContact") as string) || undefined,
      clientEmail: (formData.get("clientEmail") as string) || undefined,
      clientPhone: (formData.get("clientPhone") as string) || undefined,
      startDate: (formData.get("startDate") as string) || undefined,
      estimatedCompletionDate:
        (formData.get("estimatedCompletionDate") as string) || undefined,
      contractAmount,
      // projectManagerId/superintendentId/sourceBidId are not collected in the UI yet
    };

    const nextErrors = validate(command);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please fix the highlighted fields");
      setIsSubmitting(false);
      return;
    }

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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="number">Project Number</Label>
                <Input id="number" name="number" placeholder="PRJ-2026-001" required />
                {errors.number ? (
                  <p className="text-sm text-destructive">{errors.number}</p>
                ) : null}
              </div>
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

            <div className="space-y-2">
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g. Downtown Office Complex"
                required
              />
              {errors.name ? (
                <p className="text-sm text-destructive">{errors.name}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Brief description of the project scope..."
                rows={3}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contractAmount">Contract Amount ($)</Label>
                <Input
                  id="contractAmount"
                  name="contractAmount"
                  type="number"
                  placeholder="0.00"
                  min={0}
                  step={0.01}
                  required
                />
                {errors.contractAmount ? (
                  <p className="text-sm text-destructive">{errors.contractAmount}</p>
                ) : null}
              </div>
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
              <div className="space-y-2">
                <Label htmlFor="clientEmail">Client Email</Label>
                <Input
                  id="clientEmail"
                  name="clientEmail"
                  type="email"
                  placeholder="name@company.com"
                />
              </div>
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
                <Input id="startDate" name="startDate" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimatedCompletionDate">Estimated Completion</Label>
                <Input
                  id="estimatedCompletionDate"
                  name="estimatedCompletionDate"
                  type="date"
                />
              </div>
            </div>

            {errors.dates ? (
              <p className="text-sm text-destructive">{errors.dates}</p>
            ) : null}

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                type="submit"
                className="bg-amber-500 hover:bg-amber-600 text-white min-h-[44px]"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating..." : "Create Project"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px]"
                onClick={() => router.back()}
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
