export type ApprovalMode = 0 | 1;
export type ApproverType = 0 | 1 | 2;

export interface WorkflowApprovalStep {
  id?: string;
  stepOrder: number;
  name: string;
  approverType: ApproverType;
  approverRole?: string | null;
  approverUserId?: string | null;
  approverRelationship?: string | null;
  isOptional: boolean;
}

export interface WorkflowDefinition {
  id: string;
  entityType: string;
  triggerStatus: string;
  approvedStatus: string;
  rejectedStatus: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  amountThreshold?: number | null;
  mode: ApprovalMode;
  priority: number;
  projectId?: string | null;
  steps: WorkflowApprovalStep[];
}

export interface PendingApproval {
  id: string;
  entityType: string;
  entityId: string;
  workflowName: string;
  stepName: string;
  stepOrder: number;
  triggerStatus: string;
  approvedStatus: string;
  rejectedStatus: string;
  status: number;
  createdAtUtc: string;
  entityTitle?: string | null;
}

export interface CreateWorkflowDefinitionPayload {
  entityType: string;
  triggerStatus: string;
  approvedStatus: string;
  rejectedStatus: string;
  name: string;
  description?: string;
  isActive: boolean;
  amountThreshold?: number | null;
  mode: ApprovalMode;
  priority: number;
  projectId?: string | null;
  steps: Omit<WorkflowApprovalStep, "id">[];
}

export const WORKFLOW_ENTITY_PRESETS = [
  {
    label: "Change Order",
    entityType: "ChangeOrder",
    triggerStatus: "UnderReview",
    approvedStatus: "Approved",
    rejectedStatus: "Rejected",
  },
  {
    label: "Owner Billing (AR)",
    entityType: "BillingApplication",
    triggerStatus: "PmReview",
    approvedStatus: "ReadyToSubmit",
    rejectedStatus: "PmRejected",
  },
] as const;

export function entityDetailHref(entityType: string, entityId: string): string {
  switch (entityType) {
    case "ChangeOrder":
      return `/change-orders`;
    case "BillingApplication":
      return `/billing/applications/${entityId}`;
    default:
      return "/";
  }
}