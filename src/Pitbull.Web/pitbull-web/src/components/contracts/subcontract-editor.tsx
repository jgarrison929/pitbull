"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import api from "@/lib/api";
import { SubcontractStatus, type PagedResult, type Project, type Subcontract } from "@/lib/types";
import { toast } from "sonner";

type StatusOption = {
  value: SubcontractStatus;
  label: string;
};

const statusOptions: StatusOption[] = [
  { value: SubcontractStatus.Draft, label: "Draft" },
  { value: SubcontractStatus.Executed, label: "Executed" },
  { value: SubcontractStatus.ClosedOut, label: "Closed" },
];

type CreateSubcontractPayload = {
  projectId: string;
  subcontractNumber: string;
  subcontractorName: string;
  subcontractorContact: string | null;
  subcontractorEmail: string | null;
  subcontractorPhone: string | null;
  subcontractorAddress: string | null;
  scopeOfWork: string;
  tradeCode: string | null;
  originalValue: number;
  retainagePercent: number;
  startDate: string | null;
  completionDate: string | null;
  licenseNumber: string | null;
  notes: string | null;
};

type UpdateSubcontractPayload = CreateSubcontractPayload & {
  id: string;
  executionDate: string | null;
  status: SubcontractStatus;
  insuranceExpirationDate: string | null;
  insuranceCurrent: boolean;
};

interface FormState {
  projectId: string;
  subcontractNumber: string;
  subcontractorName: string;
  originalValue: string;
  retainagePercent: string;
  status: SubcontractStatus;
  startDate: string;
  completionDate: string;
  scopeOfWork: string;
  subcontractorContact: string;
  subcontractorEmail: string;
}

const emptyForm: FormState = {
  projectId: "",
  subcontractNumber: "",
  subcontractorName: "",
  originalValue: "",
  retainagePercent: "10",
  status: SubcontractStatus.Draft,
  startDate: "",
  completionDate: "",
  scopeOfWork: "",
  subcontractorContact: "",
  subcontractorEmail: "",
};

interface SubcontractEditorProps {
  mode: "create" | "edit";
  subcontractId?: string;
}

export function SubcontractEditor({ mode, subcontractId }: SubcontractEditorProps) {
  const router = useRouter();
  const isEdit = mode === "edit";

  const [projects, setProjects] = useState<Project[]>([]);
  const [subcontract, setSubcontract] = useState<Subcontract | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const pageTitle = useMemo(
    () => (isEdit ? "Edit Subcontract" : "New Subcontract"),
    [isEdit]
  );

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const projectReq = api<PagedResult<Project>>("/api/projects?pageSize=200");
        const subcontractReq =
          isEdit && subcontractId
            ? api<Subcontract>(`/api/subcontracts/${subcontractId}`)
            : Promise.resolve(null);

        const [projectsRes, subcontractRes] = await Promise.all([projectReq, subcontractReq]);
        setProjects(projectsRes.items);
        setSubcontract(subcontractRes);

        if (subcontractRes) {
          const statusValue = statusOptions.some((o) => o.value === subcontractRes.status)
            ? subcontractRes.status
            : SubcontractStatus.Draft;

          setForm({
            projectId: subcontractRes.projectId,
            subcontractNumber: subcontractRes.subcontractNumber ?? "",
            subcontractorName: subcontractRes.subcontractorName ?? "",
            originalValue: subcontractRes.originalValue?.toString() ?? "",
            retainagePercent: subcontractRes.retainagePercent?.toString() ?? "10",
            status: statusValue,
            startDate: subcontractRes.startDate?.slice(0, 10) ?? "",
            completionDate: subcontractRes.completionDate?.slice(0, 10) ?? "",
            scopeOfWork: subcontractRes.scopeOfWork ?? "",
            subcontractorContact: subcontractRes.subcontractorContact ?? "",
            subcontractorEmail: subcontractRes.subcontractorEmail ?? "",
          });
        }
      } catch {
        toast.error("Failed to load subcontract form");
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [isEdit, subcontractId]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): boolean {
    if (!form.projectId) {
      toast.error("Project is required");
      return false;
    }
    if (!form.subcontractNumber.trim()) {
      toast.error("Number is required");
      return false;
    }
    if (!form.subcontractorName.trim()) {
      toast.error("Vendor / Sub Name is required");
      return false;
    }
    if (!form.scopeOfWork.trim()) {
      toast.error("Description is required");
      return false;
    }
    const amount = Number(form.originalValue);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Amount must be greater than 0");
      return false;
    }
    const retainage = Number(form.retainagePercent);
    if (!Number.isFinite(retainage) || retainage < 0 || retainage > 100) {
      toast.error("Retention % must be between 0 and 100");
      return false;
    }
    if (form.subcontractorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.subcontractorEmail)) {
      toast.error("Contact email format is invalid");
      return false;
    }
    if (form.startDate && form.completionDate && form.startDate > form.completionDate) {
      toast.error("End date must be on or after start date");
      return false;
    }
    return true;
  }

  async function handleSave() {
    if (!validate()) return;

    setIsSaving(true);
    try {
      const createPayload: CreateSubcontractPayload = {
        projectId: form.projectId,
        subcontractNumber: form.subcontractNumber.trim(),
        subcontractorName: form.subcontractorName.trim(),
        subcontractorContact: form.subcontractorContact.trim() || null,
        subcontractorEmail: form.subcontractorEmail.trim() || null,
        subcontractorPhone: null,
        subcontractorAddress: null,
        scopeOfWork: form.scopeOfWork.trim(),
        tradeCode: null,
        originalValue: Number(form.originalValue),
        retainagePercent: Number(form.retainagePercent),
        startDate: form.startDate || null,
        completionDate: form.completionDate || null,
        licenseNumber: subcontract?.licenseNumber ?? null,
        notes: subcontract?.notes ?? null,
      };

      if (isEdit && subcontractId && subcontract) {
        const updatePayload: UpdateSubcontractPayload = {
          ...createPayload,
          id: subcontractId,
          executionDate: subcontract.executionDate ?? null,
          status: form.status,
          insuranceExpirationDate: subcontract.insuranceExpirationDate ?? null,
          insuranceCurrent: subcontract.insuranceCurrent,
        };

        const result = await api<Subcontract>(`/api/subcontracts/${subcontractId}`, {
          method: "PUT",
          body: updatePayload,
        });
        toast.success("Subcontract updated");
        router.push(`/contracts/${result.id}`);
        return;
      }

      const result = await api<Subcontract>("/api/subcontracts", {
        method: "POST",
        body: createPayload,
      });
      toast.success("Subcontract created");
      router.push(`/contracts/${result.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save subcontract");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Contracts", href: "/contracts" },
            { label: pageTitle },
          ]}
        />
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">Loading…</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Contracts", href: "/contracts" },
          { label: pageTitle },
        ]}
      />

      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{pageTitle}</h1>
          <p className="text-muted-foreground">
            Number, vendor, project, amount, status, dates, and contact details.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subcontract Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="projectId">Project</Label>
              <Select
                value={form.projectId}
                onValueChange={(value) => updateField("projectId", value)}
              >
                <SelectTrigger id="projectId">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.number} - {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={String(form.status)}
                onValueChange={(value) =>
                  updateField("status", Number(value) as SubcontractStatus)
                }
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="subcontractNumber">Number</Label>
              <Input
                id="subcontractNumber"
                value={form.subcontractNumber}
                onChange={(e) => updateField("subcontractNumber", e.target.value)}
                placeholder="SC-2026-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subcontractorName">Vendor / Sub Name</Label>
              <Input
                id="subcontractorName"
                value={form.subcontractorName}
                onChange={(e) => updateField("subcontractorName", e.target.value)}
                placeholder="ABC Concrete Inc"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="originalValue">Amount</Label>
              <Input
                id="originalValue"
                type="number"
                min="0"
                step="0.01"
                value={form.originalValue}
                onChange={(e) => updateField("originalValue", e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="retainagePercent">Retention %</Label>
              <Input
                id="retainagePercent"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={form.retainagePercent}
                onChange={(e) => updateField("retainagePercent", e.target.value)}
                placeholder="10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={form.startDate}
                onChange={(e) => updateField("startDate", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="completionDate">End Date</Label>
              <Input
                id="completionDate"
                type="date"
                value={form.completionDate}
                onChange={(e) => updateField("completionDate", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scopeOfWork">Description</Label>
            <Textarea
              id="scopeOfWork"
              value={form.scopeOfWork}
              onChange={(e) => updateField("scopeOfWork", e.target.value)}
              placeholder="Scope of work details"
              rows={4}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="subcontractorContact">Contact Name</Label>
              <Input
                id="subcontractorContact"
                value={form.subcontractorContact}
                onChange={(e) => updateField("subcontractorContact", e.target.value)}
                placeholder="Jane Smith"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subcontractorEmail">Contact Email</Label>
              <Input
                id="subcontractorEmail"
                type="email"
                value={form.subcontractorEmail}
                onChange={(e) => updateField("subcontractorEmail", e.target.value)}
                placeholder="jane@vendor.com"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button asChild variant="outline" disabled={isSaving}>
              <Link href={isEdit && subcontractId ? `/contracts/${subcontractId}` : "/contracts"}>
                Cancel
              </Link>
            </Button>
            <Button
              onClick={handleSave}
              className="bg-amber-500 hover:bg-amber-600 text-white"
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : isEdit ? "Update Subcontract" : "Create Subcontract"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
