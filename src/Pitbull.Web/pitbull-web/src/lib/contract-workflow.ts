export interface ContractMilestone {
  id: string;
  title: string;
  dueDate: string;
  amount: number;
  completionPercent: number;
  generatedAmount: number;
}

export interface ContractWorkflowData {
  milestones: ContractMilestone[];
}

export interface ContractWorkflowEnvelope {
  workflow: ContractWorkflowData;
  plainNotes: string | null;
}

const WORKFLOW_MARKER = "[[pitbull-contract-workflow-v1]]";

const EMPTY_WORKFLOW: ContractWorkflowData = {
  milestones: [],
};

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function sanitizeMilestone(
  milestone: Partial<ContractMilestone>
): ContractMilestone {
  const amount = Number(milestone.amount ?? 0);
  const generatedAmount = Number(milestone.generatedAmount ?? 0);

  return {
    id: (milestone.id ?? "").trim(),
    title: (milestone.title ?? "").trim(),
    dueDate: (milestone.dueDate ?? "").trim(),
    amount: Number.isFinite(amount) ? Math.max(0, amount) : 0,
    completionPercent: clampPercent(Number(milestone.completionPercent ?? 0)),
    generatedAmount: Number.isFinite(generatedAmount) ? Math.max(0, generatedAmount) : 0,
  };
}

export function parseContractWorkflowNotes(
  notes: string | null | undefined
): ContractWorkflowEnvelope {
  if (!notes) {
    return { workflow: EMPTY_WORKFLOW, plainNotes: null };
  }

  if (!notes.startsWith(WORKFLOW_MARKER)) {
    return { workflow: EMPTY_WORKFLOW, plainNotes: notes };
  }

  const payload = notes.slice(WORKFLOW_MARKER.length).trimStart();
  const newlineIndex = payload.indexOf("\n");
  const jsonPart = newlineIndex >= 0 ? payload.slice(0, newlineIndex) : payload;
  const plainPart = newlineIndex >= 0 ? payload.slice(newlineIndex + 1).trim() : "";

  try {
    const parsed = JSON.parse(jsonPart) as Partial<ContractWorkflowData>;
    const milestones = Array.isArray(parsed.milestones)
      ? parsed.milestones
          .map((m) => sanitizeMilestone(m))
          .filter((m) => m.id && m.title && m.dueDate)
      : [];

    return {
      workflow: { milestones },
      plainNotes: plainPart || null,
    };
  } catch {
    return { workflow: EMPTY_WORKFLOW, plainNotes: notes };
  }
}

export function serializeContractWorkflowNotes(
  workflow: ContractWorkflowData,
  plainNotes?: string | null
): string | null {
  const payload: ContractWorkflowData = {
    milestones: workflow.milestones.map((m) => sanitizeMilestone(m)),
  };
  const json = JSON.stringify(payload);
  const notes = (plainNotes ?? "").trim();
  const serialized = `${WORKFLOW_MARKER}${json}${notes ? `\n${notes}` : ""}`;
  return serialized.trim() || null;
}

export function calculateMilestoneEarnedAmount(milestone: ContractMilestone): number {
  return milestone.amount * (clampPercent(milestone.completionPercent) / 100);
}

export function calculateMilestoneBillableAmount(milestone: ContractMilestone): number {
  const earned = calculateMilestoneEarnedAmount(milestone);
  return Math.max(0, earned - milestone.generatedAmount);
}
