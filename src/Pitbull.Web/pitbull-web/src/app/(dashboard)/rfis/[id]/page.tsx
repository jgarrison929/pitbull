"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { LoadingButton } from "@/components/ui/loading-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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
import api from "@/lib/api";
import type { Rfi, UpdateRfiCommand, RfiStatus, RfiPriority } from "@/lib/types";
import { toast } from "sonner";

function statusColor(status: RfiStatus) {
  switch (status) {
    case 0: // Open
      return "bg-blue-100 text-blue-700";
    case 1: // Answered
      return "bg-green-100 text-green-700";
    case 2: // Closed
      return "bg-neutral-100 text-neutral-600";
    default:
      return "";
  }
}

function statusLabel(status: RfiStatus) {
  switch (status) {
    case 0:
      return "Open";
    case 1:
      return "Answered";
    case 2:
      return "Closed";
    default:
      return "Unknown";
  }
}

function priorityLabel(priority: RfiPriority) {
  switch (priority) {
    case 0:
      return "Low";
    case 1:
      return "Normal";
    case 2:
      return "High";
    case 3:
      return "Urgent";
    default:
      return "Unknown";
  }
}

function priorityColor(priority: RfiPriority) {
  switch (priority) {
    case 0: // Low
      return "bg-neutral-100 text-neutral-600";
    case 1: // Normal
      return "bg-blue-100 text-blue-700";
    case 2: // High
      return "bg-orange-100 text-orange-700";
    case 3: // Urgent
      return "bg-red-100 text-red-700";
    default:
      return "";
  }
}

export default function RfiDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
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

  // Cost impact fields
  const [editSpecSection, setEditSpecSection] = useState("");
  const [editDrawingReferences, setEditDrawingReferences] = useState("");
  const [editHasCostImpact, setEditHasCostImpact] = useState(false);
  const [editEstimatedCostImpact, setEditEstimatedCostImpact] = useState("");
  const [editEstimatedDelayDays, setEditEstimatedDelayDays] = useState("");

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

        // Cost impact fields
        setEditSpecSection(data.specSection || "");
        setEditDrawingReferences(data.drawingReferences?.join(", ") || "");
        setEditHasCostImpact(data.hasCostImpact);
        setEditEstimatedCostImpact(data.estimatedCostImpact?.toString() || "");
        setEditEstimatedDelayDays(data.estimatedDelayDays?.toString() || "");
      } catch {
        setError("Failed to load RFI");
        toast.error("Failed to load RFI");
      } finally {
        setIsLoading(false);
      }
    }
    fetchRfi();
  }, [id, projectId]);

  async function handleSave() {
    if (!rfi || !projectId) return;

    setIsSaving(true);
    try {
      // Parse drawing references from comma-separated string
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

        // Cost impact fields
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
        {
          method: "PUT",
          body: command,
        }
      );
      setRfi(updated);
      setIsEditing(false);
      toast.success("RFI updated successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update RFI");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-80" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{rfi.subject}</h1>
            <Badge variant="secondary" className={statusColor(rfi.status)}>
              {statusLabel(rfi.status)}
            </Badge>
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

      {isEditing ? (
        /* Edit Mode */
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edit RFI</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <fieldset disabled={isSaving} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    required
                  />
                </div>

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
                        <SelectItem value="0">Open</SelectItem>
                        <SelectItem value="1">Answered</SelectItem>
                        <SelectItem value="2">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={String(editPriority)}
                      onValueChange={(v) =>
                        setEditPriority(Number(v) as RfiPriority)
                      }
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
                </div>

                <div className="space-y-2">
                  <Label htmlFor="question">Question</Label>
                  <Textarea
                    id="question"
                    value={editQuestion}
                    onChange={(e) => setEditQuestion(e.target.value)}
                    rows={4}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="answer">Answer</Label>
                  <Textarea
                    id="answer"
                    value={editAnswer}
                    onChange={(e) => setEditAnswer(e.target.value)}
                    rows={4}
                    placeholder="Response to the RFI..."
                  />
                </div>

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
                    <Label htmlFor="ballInCourt">Ball In Court</Label>
                    <Input
                      id="ballInCourt"
                      value={editBallInCourtName}
                      onChange={(e) => setEditBallInCourtName(e.target.value)}
                      placeholder="Who needs to act?"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assignedTo">Assigned To</Label>
                    <Input
                      id="assignedTo"
                      value={editAssignedToName}
                      onChange={(e) => setEditAssignedToName(e.target.value)}
                      placeholder="Responsible party"
                    />
                  </div>
                </div>

                {/* Document References */}
                <Separator className="my-4" />
                <h3 className="text-sm font-semibold text-muted-foreground">Document References</h3>

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

                {/* Cost Impact */}
                <Separator className="my-4" />
                <h3 className="text-sm font-semibold text-muted-foreground">Cost Impact</h3>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="hasCostImpact">Has Cost Impact</Label>
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
                    <Label htmlFor="estimatedCostImpact">Estimated Cost ($)</Label>
                    <Input
                      id="estimatedCostImpact"
                      type="number"
                      step="0.01"
                      value={editEstimatedCostImpact}
                      onChange={(e) => setEditEstimatedCostImpact(e.target.value)}
                      placeholder="0.00"
                      disabled={!editHasCostImpact}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estimatedDelayDays">Estimated Delay (days)</Label>
                    <Input
                      id="estimatedDelayDays"
                      type="number"
                      value={editEstimatedDelayDays}
                      onChange={(e) => setEditEstimatedDelayDays(e.target.value)}
                      placeholder="0"
                      disabled={!editHasCostImpact}
                    />
                  </div>
                </div>
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
          </CardContent>
        </Card>
      ) : (
        /* View Mode */
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">RFI Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Priority</span>
                  <span>
                    <Badge
                      variant="secondary"
                      className={priorityColor(rfi.priority)}
                    >
                      {priorityLabel(rfi.priority)}
                    </Badge>
                  </span>
                  <span className="text-muted-foreground">Due Date</span>
                  <span className="font-medium">
                    {rfi.dueDate
                      ? new Date(rfi.dueDate).toLocaleDateString()
                      : "Not set"}
                  </span>
                  <span className="text-muted-foreground">Ball In Court</span>
                  <span className="font-medium">
                    {rfi.ballInCourtName || "—"}
                  </span>
                  <span className="text-muted-foreground">Assigned To</span>
                  <span className="font-medium">
                    {rfi.assignedToName || "—"}
                  </span>
                  <span className="text-muted-foreground">Created By</span>
                  <span className="font-medium">
                    {rfi.createdByName || "—"}
                  </span>
                  <span className="text-muted-foreground">Created</span>
                  <span className="font-medium">
                    {new Date(rfi.createdAt).toLocaleDateString()}
                  </span>
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
                    {rfi.answeredAt
                      ? new Date(rfi.answeredAt).toLocaleDateString()
                      : "Not yet answered"}
                  </span>
                  <span className="text-muted-foreground">Closed At</span>
                  <span className="font-medium">
                    {rfi.closedAt
                      ? new Date(rfi.closedAt).toLocaleDateString()
                      : "Not yet closed"}
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
                  <p className="text-muted-foreground text-sm">
                    No answer provided yet.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Document References & Cost Impact Card */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Document References</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Spec Section</span>
                  <span className="font-medium">
                    {rfi.specSection || "—"}
                  </span>
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
                  Cost Impact
                  {rfi.hasCostImpact && (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-700">
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
                  <p className="text-sm text-muted-foreground">
                    No cost impact identified
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
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
