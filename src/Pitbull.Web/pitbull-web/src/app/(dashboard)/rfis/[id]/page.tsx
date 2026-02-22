"use client";

import { use, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Link2, FileText, DollarSign, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LoadingButton } from "@/components/ui/loading-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RfiDetailSkeleton } from "@/components/skeletons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TextareaField, FormField } from "@/components/ui/form-field";
import { SmartField } from "@/components/ui/smart-field";
import { FormSection } from "@/components/ui/form-section";
import { FileDropZone } from "@/components/ui/file-drop-zone";
import { AvatarSelector } from "@/components/ui/avatar-selector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RfiCostImpactSection } from "@/components/rfis";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { WorkflowStepper, type WorkflowStep } from "@/components/ui/workflow-stepper";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatusTimeline } from "@/components/ui/status-timeline";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import api, { uploadFiles, getDownloadUrl } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import type { Rfi, UpdateRfiCommand, RfiStatus, RfiPriority } from "@/lib/types";
import { toast } from "sonner";
import { Download, Paperclip } from "lucide-react";

interface FileAttachment {
  id: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  createdAt: string;
}

interface FileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  file?: File;
}

function statusColor(status: RfiStatus) {
  switch (status) {
    case 0:
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
    case 1:
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
    case 2:
      return "bg-neutral-100 text-neutral-600";
    default:
      return "";
  }
}

function statusLabel(status: RfiStatus) {
  switch (status) {
    case 0: return "Open";
    case 1: return "Answered";
    case 2: return "Closed";
    default: return "Unknown";
  }
}

function priorityLabel(priority: RfiPriority) {
  switch (priority) {
    case 0: return "Low";
    case 1: return "Normal";
    case 2: return "High";
    case 3: return "Urgent";
    default: return "Unknown";
  }
}

function priorityColor(priority: RfiPriority) {
  switch (priority) {
    case 0: return "bg-neutral-100 text-neutral-600";
    case 1: return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
    case 2: return "bg-orange-100 text-orange-700";
    case 3: return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    default: return "";
  }
}

function buildRfiWorkflowSteps(status: RfiStatus): WorkflowStep[] {
  const steps: { label: string; order: number }[] = [
    { label: "Open", order: 0 },
    { label: "Answered", order: 1 },
    { label: "Closed", order: 2 },
  ];
  return steps.map((step) => ({
    label: step.label,
    status:
      step.order < status ? "completed" :
      step.order === status ? "current" :
      "upcoming",
  }));
}

// Mock team members for avatar selector
const TEAM_MEMBERS = [
  { id: "1", name: "John Smith" },
  { id: "2", name: "Demo User" },
  { id: "3", name: "Mike Davis" },
  { id: "4", name: "Emily Wilson" },
  { id: "5", name: "Robert Brown" },
];

export default function RfiDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");

  const [rfi, setRfi] = useState<Rfi | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit form state
  const [editSubject, setEditSubject] = useState("");
  const [editQuestion, setEditQuestion] = useState("");
  const [editAnswer, setEditAnswer] = useState("");
  const [editStatus, setEditStatus] = useState<RfiStatus>(0);
  const [editPriority, setEditPriority] = useState<RfiPriority>(1);
  const [editDueDate, setEditDueDate] = useState("");
  const [editBallInCourtName, setEditBallInCourtName] = useState("");
  const [editAssignedToName, setEditAssignedToName] = useState("");
  const [editSpecSection, setEditSpecSection] = useState("");
  const [editDrawingReferences, setEditDrawingReferences] = useState("");
  const [editHasCostImpact, setEditHasCostImpact] = useState(false);
  const [editEstimatedCostImpact, setEditEstimatedCostImpact] = useState("");
  const [editEstimatedDelayDays, setEditEstimatedDelayDays] = useState("");
  const [editAttachments, setEditAttachments] = useState<FileItem[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<FileAttachment[]>([]);

  // Track unsaved changes in edit mode
  const isDirty = useMemo(() => {
    if (!isEditing || !rfi) return false;
    return (
      editSubject !== rfi.subject ||
      editQuestion !== rfi.question ||
      editAnswer !== (rfi.answer || "") ||
      editStatus !== rfi.status ||
      editPriority !== rfi.priority
    );
  }, [isEditing, rfi, editSubject, editQuestion, editAnswer, editStatus, editPriority]);

  useUnsavedChanges(isDirty);

  const { addRecentItem } = useRecentlyViewed();

  useEffect(() => {
    if (!projectId) {
      setError("Project ID is required");
      setIsLoading(false);
      return;
    }

    async function fetchRfi() {
      try {
        const data = await api<Rfi>(`/api/projects/${projectId}/rfis/${id}`);
        setRfi(data);
        // Initialize edit form
        setEditSubject(data.subject);
        setEditQuestion(data.question);
        setEditAnswer(data.answer || "");
        setEditStatus(data.status);
        setEditPriority(data.priority);
        setEditDueDate(data.dueDate ? data.dueDate.split("T")[0] : "");
        setEditBallInCourtName(data.ballInCourtName || "");
        setEditAssignedToName(data.assignedToName || "");
        setEditSpecSection(data.specSection || "");
        setEditDrawingReferences(data.drawingReferences?.join(", ") || "");
        setEditHasCostImpact(data.hasCostImpact);
        setEditEstimatedCostImpact(data.estimatedCostImpact?.toString() || "");
        setEditEstimatedDelayDays(data.estimatedDelayDays?.toString() || "");

        // Load existing attachments
        api<FileAttachment[]>(`/api/files?entityType=Rfi&entityId=${data.id}`)
          .then(setExistingAttachments)
          .catch(() => setExistingAttachments([]));

        addRecentItem({
          id: data.id,
          type: "rfi",
          name: data.subject,
          identifier: `RFI-${String(data.number).padStart(3, "0")}`,
          projectId: projectId ?? undefined,
        });
      } catch {
        setError("Failed to load RFI");
        toast.error("Failed to load RFI");
      } finally {
        setIsLoading(false);
      }
    }
    fetchRfi();
  }, [id, projectId, addRecentItem]);

  async function handleSave() {
    if (!rfi || !projectId) return;

    setIsSaving(true);
    try {
      const drawingRefs = editDrawingReferences
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const command: UpdateRfiCommand = {
        subject: editSubject,
        question: editQuestion,
        answer: editAnswer || null,
        status: editStatus,
        priority: editPriority,
        dueDate: editDueDate || null,
        ballInCourtName: editBallInCourtName || null,
        assignedToName: editAssignedToName || null,
        specSection: editSpecSection || null,
        drawingReferences: drawingRefs.length > 0 ? drawingRefs : undefined,
        hasCostImpact: editHasCostImpact,
        estimatedCostImpact: editEstimatedCostImpact
          ? parseFloat(editEstimatedCostImpact)
          : null,
        estimatedDelayDays: editEstimatedDelayDays
          ? parseInt(editEstimatedDelayDays)
          : null,
      };

      const updated = await api<Rfi>(
        `/api/projects/${projectId}/rfis/${id}`,
        { method: "PUT", body: command }
      );
      setRfi(updated);

      // Upload pending attachments
      const realFiles = editAttachments.map((f) => f.file).filter((f): f is File => f !== undefined);
      if (realFiles.length > 0) {
        try {
          const endpoint = realFiles.length === 1 ? "/api/files/upload" : "/api/files/upload-multiple";
          await uploadFiles(endpoint, realFiles, {
            relatedEntityType: "Rfi",
            relatedEntityId: id,
          });
          toast.success(`${realFiles.length} attachment(s) uploaded`);
          setEditAttachments([]);
          // Reload attachments
          const updated = await api<FileAttachment[]>(`/api/files?entityType=Rfi&entityId=${id}`);
          setExistingAttachments(updated);
        } catch {
          toast.error("RFI saved but file upload failed");
        }
      }

      setIsEditing(false);
      toast.success("RFI updated successfully");
    } catch (err) {
      toast.error("Failed to update RFI", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <RfiDetailSkeleton />;
  }

  if (error || !rfi) {
    return (
      <div className="space-y-6">
        <div className="py-12 text-center">
          <p className="text-muted-foreground">{error || "RFI not found"}</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/rfis">Back to RFIs</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "RFIs", href: "/rfis" },
          { label: `RFI #${String(rfi.number).padStart(3, "0")}` },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{rfi.subject}</h1>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast.success("Link copied to clipboard");
              }}
              title="Copy link"
              aria-label="Copy link"
            >
              <Link2 className="h-4 w-4" />
            </Button>
            <StatusBadge entityType="RFI" status={rfi.status} />
          </div>
          <p className="text-muted-foreground font-mono text-sm">
            RFI-{String(rfi.number).padStart(3, "0")}
          </p>
        </div>
        <div className="flex gap-2">
          {!isEditing && (
            <Button
              onClick={() => setIsEditing(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white min-h-[44px]"
            >
              Edit RFI
            </Button>
          )}
        </div>
      </div>

      {/* Workflow Progress */}
      <WorkflowStepper
        steps={buildRfiWorkflowSteps(rfi.status)}
        className="sm:hidden"
        orientation="vertical"
      />
      <WorkflowStepper
        steps={buildRfiWorkflowSteps(rfi.status)}
        className="hidden sm:flex"
        orientation="horizontal"
      />

      {isEditing ? (
        /* Edit Mode - Accordion Sections */
        <div className="space-y-4">
          <fieldset disabled={isSaving} className="space-y-4">
            {/* Details Section */}
            <FormSection
              title="RFI Details"
              description="Subject, question, answer, and assignment"
              icon={<Info className="h-4 w-4" />}
              defaultOpen={true}
            >
              <div className="space-y-4">
                <FormField
                  label="Subject"
                  name="subject"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  required
                  maxLength={150}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={String(editStatus)}
                      onValueChange={(v) => setEditStatus(Number(v) as RfiStatus)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">🔵 Open</SelectItem>
                        <SelectItem value="1">🟢 Answered</SelectItem>
                        <SelectItem value="2">⚫ Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={String(editPriority)}
                      onValueChange={(v) => setEditPriority(Number(v) as RfiPriority)}
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
                </div>

                <TextareaField
                  label="Question"
                  name="question"
                  value={editQuestion}
                  onChange={(e) => setEditQuestion(e.target.value)}
                  rows={5}
                  required
                  maxLength={2000}
                  helpText="Be specific about location, specification, and drawing references."
                />

                <SmartField
                  label="Answer"
                  fieldName="answer"
                  entityType="RFI"
                  value={editAnswer}
                  onChange={setEditAnswer}
                  rows={5}
                  placeholder="Response to the RFI..."
                  helpText="Enter the official response. Changing status to Answered will timestamp this."
                  context={{ subject: editSubject || "", question: editQuestion || "" }}
                />

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Due Date</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ball In Court</Label>
                    <AvatarSelector
                      options={TEAM_MEMBERS}
                      value={editBallInCourtName}
                      onChange={setEditBallInCourtName}
                      placeholder="Who needs to act?"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Assigned To</Label>
                    <AvatarSelector
                      options={TEAM_MEMBERS}
                      value={editAssignedToName}
                      onChange={setEditAssignedToName}
                      placeholder="Responsible party"
                    />
                  </div>
                </div>
              </div>
            </FormSection>

            {/* Document References Section */}
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
                      value={editSpecSection}
                      onChange={(e) => setEditSpecSection(e.target.value)}
                      placeholder="e.g., 03 30 00 - Cast-in-Place Concrete"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="drawingReferences">Drawing References</Label>
                    <Input
                      id="drawingReferences"
                      value={editDrawingReferences}
                      onChange={(e) => setEditDrawingReferences(e.target.value)}
                      placeholder="e.g., S-101, S-102, D-001"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Attachments</Label>
                  {existingAttachments.length > 0 && (
                    <div className="space-y-1 mb-2">
                      {existingAttachments.map((f) => (
                        <div key={f.id} className="flex items-center gap-2 text-sm rounded border px-2 py-1">
                          <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="flex-1 truncate">{f.fileName}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                            const url = getDownloadUrl(f.id);
                            const token = getToken();
                            if (token) {
                              fetch(url, { headers: { Authorization: `Bearer ${token}` } })
                                .then((r) => r.blob())
                                .then((blob) => { const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = f.fileName; a.click(); URL.revokeObjectURL(u); })
                                .catch(() => toast.error("Download failed"));
                            }
                          }}>
                            <Download className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <FileDropZone
                    files={editAttachments}
                    onFilesChange={setEditAttachments}
                    placeholder="Drop additional files here"
                    maxFiles={10}
                  />
                </div>
              </div>
            </FormSection>

            {/* Cost Impact Section */}
            <FormSection
              title="Cost Impact"
              description="Estimated cost and schedule impact"
              icon={<DollarSign className="h-4 w-4" />}
              defaultOpen={false}
              badge={
                editHasCostImpact ? (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-[10px] ml-2">
                    Has Impact
                  </Badge>
                ) : null
              }
            >
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Has Cost Impact</Label>
                    <Select
                      value={editHasCostImpact ? "true" : "false"}
                      onValueChange={(v) => setEditHasCostImpact(v === "true")}
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
                    <Label>Estimated Cost ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editEstimatedCostImpact}
                      onChange={(e) => setEditEstimatedCostImpact(e.target.value)}
                      placeholder="0.00"
                      disabled={!editHasCostImpact}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Estimated Delay (days)</Label>
                    <Input
                      type="number"
                      value={editEstimatedDelayDays}
                      onChange={(e) => setEditEstimatedDelayDays(e.target.value)}
                      placeholder="0"
                      disabled={!editHasCostImpact}
                    />
                  </div>
                </div>
              </div>
            </FormSection>
          </fieldset>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <LoadingButton
              onClick={handleSave}
              className="bg-amber-500 hover:bg-amber-600 text-white min-h-[44px]"
              loading={isSaving}
              loadingText="Saving..."
            >
              Save Changes
            </LoadingButton>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              onClick={() => setIsEditing(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        /* View Mode */
        <Tabs defaultValue="details" className="space-y-4">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="cost-impact" className="gap-1">
              💰 Cost Impact
              {rfi.hasCostImpact && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-[10px] px-1 py-0 ml-1">
                  $
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">RFI Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Priority</span>
                    <span>
                      <Badge variant="secondary" className={priorityColor(rfi.priority)}>
                        {priorityLabel(rfi.priority)}
                      </Badge>
                    </span>
                    <span className="text-muted-foreground">Due Date</span>
                    <span className="font-medium">
                      {rfi.dueDate ? new Date(rfi.dueDate).toLocaleDateString() : "Not set"}
                    </span>
                    <span className="text-muted-foreground">Ball In Court</span>
                    <span className="font-medium">{rfi.ballInCourtName || "—"}</span>
                    <span className="text-muted-foreground">Assigned To</span>
                    <span className="font-medium">{rfi.assignedToName || "—"}</span>
                    <span className="text-muted-foreground">Created By</span>
                    <span className="font-medium">{rfi.createdByName || "—"}</span>
                    <span className="text-muted-foreground">Created</span>
                    <span className="font-medium">{new Date(rfi.createdAt).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Timeline</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Answered At</span>
                    <span className="font-medium">
                      {rfi.answeredAt ? new Date(rfi.answeredAt).toLocaleDateString() : "Not yet answered"}
                    </span>
                    <span className="text-muted-foreground">Closed At</span>
                    <span className="font-medium">
                      {rfi.closedAt ? new Date(rfi.closedAt).toLocaleDateString() : "Not yet closed"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Question</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {rfi.question}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Answer</CardTitle>
              </CardHeader>
              <CardContent>
                {rfi.answer ? (
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {rfi.answer}
                  </p>
                ) : (
                  <div className="py-4 text-center">
                    <p className="text-muted-foreground text-sm">No answer provided yet.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Document References</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Spec Section</span>
                    <span className="font-medium">{rfi.specSection || "—"}</span>
                    <span className="text-muted-foreground">Drawings</span>
                    <span className="font-medium">
                      {rfi.drawingReferences && rfi.drawingReferences.length > 0
                        ? rfi.drawingReferences.join(", ")
                        : "—"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    Estimated Cost Impact
                    {rfi.hasCostImpact && (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        Has Impact
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {rfi.hasCostImpact ? (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-muted-foreground">Estimated Cost</span>
                      <span className="font-medium text-amber-700">
                        {rfi.estimatedCostImpact != null
                          ? `$${rfi.estimatedCostImpact.toLocaleString()}`
                          : "—"}
                      </span>
                      <span className="text-muted-foreground">Estimated Delay</span>
                      <span className="font-medium text-amber-700">
                        {rfi.estimatedDelayDays != null
                          ? `${rfi.estimatedDelayDays} day${rfi.estimatedDelayDays !== 1 ? "s" : ""}`
                          : "—"}
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No cost impact identified</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="cost-impact">
            {projectId && (
              <RfiCostImpactSection projectId={projectId} rfiId={id} rfi={rfi} />
            )}
          </TabsContent>
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Workflow History</CardTitle>
              </CardHeader>
              <CardContent>
                <StatusTimeline entityType="RFI" entityId={id} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <Separator />

      <div className="flex">
        <Button variant="ghost" asChild className="min-h-[44px]">
          <Link href="/rfis">← Back to RFIs</Link>
        </Button>
      </div>
    </div>
  );
}
