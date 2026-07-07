"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useRequireAdmin } from "@/hooks/use-require-admin";
import type { CreateWorkflowDefinitionPayload, WorkflowDefinition } from "@/lib/workflows";
import { WORKFLOW_ENTITY_PRESETS } from "@/lib/workflows";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingButton } from "@/components/ui/loading-button";
import { TableSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PRESET_KEY = "__custom__";

export default function WorkflowDefinitionsAdminPage() {
  useRequireAdmin();
  const [definitions, setDefinitions] = useState<WorkflowDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [preset, setPreset] = useState<string>(WORKFLOW_ENTITY_PRESETS[0].label);

  const [form, setForm] = useState<CreateWorkflowDefinitionPayload>({
    entityType: WORKFLOW_ENTITY_PRESETS[0].entityType,
    triggerStatus: WORKFLOW_ENTITY_PRESETS[0].triggerStatus,
    approvedStatus: WORKFLOW_ENTITY_PRESETS[0].approvedStatus,
    rejectedStatus: WORKFLOW_ENTITY_PRESETS[0].rejectedStatus,
    name: "",
    description: "",
    isActive: true,
    mode: 0,
    priority: 0,
    steps: [
      {
        stepOrder: 1,
        name: "Approver",
        approverType: 1,
        isOptional: false,
      },
    ],
  });

  const loadDefinitions = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api<WorkflowDefinition[]>("/api/workflow-definitions");
      setDefinitions(data);
    } catch {
      toast.error("Failed to load workflow definitions");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDefinitions();
  }, [loadDefinitions]);

  const applyPreset = (label: string) => {
    setPreset(label);
    const match = WORKFLOW_ENTITY_PRESETS.find((p) => p.label === label);
    if (!match) return;
    setForm((prev) => ({
      ...prev,
      entityType: match.entityType,
      triggerStatus: match.triggerStatus,
      approvedStatus: match.approvedStatus,
      rejectedStatus: match.rejectedStatus,
      name: prev.name || `${match.label} Approval`,
    }));
  };

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setIsSaving(true);
    try {
      await api("/api/workflow-definitions", { method: "POST", body: form });
      toast.success("Workflow definition created");
      setForm((prev) => ({ ...prev, name: "" }));
      await loadDefinitions();
    } catch {
      toast.error("Failed to create workflow definition");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Workflow Definitions</h1>
        <p className="text-muted-foreground">
          Configure approval chains for change orders and owner billing.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New definition</CardTitle>
          <CardDescription>
            Assign a specific user as approver (use their user ID from Admin → Users).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Entity preset</Label>
              <Select value={preset} onValueChange={applyPreset}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORKFLOW_ENTITY_PRESETS.map((p) => (
                    <SelectItem key={p.label} value={p.label}>
                      {p.label}
                    </SelectItem>
                  ))}
                  <SelectItem value={PRESET_KEY}>Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wf-name">Name</Label>
              <Input
                id="wf-name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Change Order Approval"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Entity type</Label>
              <Input
                value={form.entityType}
                onChange={(e) => setForm((prev) => ({ ...prev, entityType: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Trigger status</Label>
              <Input
                value={form.triggerStatus}
                onChange={(e) => setForm((prev) => ({ ...prev, triggerStatus: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Approved status</Label>
              <Input
                value={form.approvedStatus}
                onChange={(e) => setForm((prev) => ({ ...prev, approvedStatus: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Rejected status</Label>
              <Input
                value={form.rejectedStatus}
                onChange={(e) => setForm((prev) => ({ ...prev, rejectedStatus: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Step name</Label>
              <Input
                value={form.steps[0]?.name ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    steps: [{ ...prev.steps[0], name: e.target.value, stepOrder: 1 }],
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Approver user ID</Label>
              <Input
                value={form.steps[0]?.approverUserId ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    steps: [
                      {
                        ...prev.steps[0],
                        stepOrder: 1,
                        approverType: 1,
                        approverUserId: e.target.value || null,
                      },
                    ],
                  }))
                }
                placeholder="UUID of approver"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={form.isActive}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))}
            />
            <Label>Active</Label>
          </div>

          <LoadingButton loading={isSaving} onClick={() => void handleCreate()}>
            Create definition
          </LoadingButton>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active definitions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={3} headers={["Name", "Entity", "Trigger", "Steps"]} />
          ) : definitions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No workflow definitions yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Trigger → Approved</TableHead>
                  <TableHead>Steps</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {definitions.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="font-medium">{d.name}</div>
                      {!d.isActive && <Badge variant="secondary">Inactive</Badge>}
                    </TableCell>
                    <TableCell>{d.entityType}</TableCell>
                    <TableCell>
                      {d.triggerStatus} → {d.approvedStatus}
                    </TableCell>
                    <TableCell>{d.steps.length}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Button variant="outline" onClick={() => void loadDefinitions()}>
        Refresh
      </Button>
    </div>
  );
}