export interface EquipmentAssignment {
  id: string;
  projectId: string;
  projectName: string;
  startDate: string;
  endDate: string;
  hoursPerDay: number;
}

export interface EquipmentWorkflowData {
  dailyRate: number;
  nextServiceDate: string | null;
  serviceIntervalHours: number;
  currentHours: number;
  assignments: EquipmentAssignment[];
}

export interface EquipmentWorkflowEnvelope {
  workflow: EquipmentWorkflowData;
  plainDescription: string | null;
}

const MARKER = "[[pitbull-equipment-workflow-v1]]";

const EMPTY_WORKFLOW: EquipmentWorkflowData = {
  dailyRate: 0,
  nextServiceDate: null,
  serviceIntervalHours: 0,
  currentHours: 0,
  assignments: [],
};

function clampNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function sanitizeAssignment(
  assignment: Partial<EquipmentAssignment>
): EquipmentAssignment {
  return {
    id: (assignment.id ?? "").trim(),
    projectId: (assignment.projectId ?? "").trim(),
    projectName: (assignment.projectName ?? "").trim(),
    startDate: (assignment.startDate ?? "").trim(),
    endDate: (assignment.endDate ?? "").trim(),
    hoursPerDay: clampNonNegative(Number(assignment.hoursPerDay ?? 0)),
  };
}

export function parseEquipmentDescription(
  description: string | null | undefined
): EquipmentWorkflowEnvelope {
  if (!description) {
    return { workflow: EMPTY_WORKFLOW, plainDescription: null };
  }

  if (!description.startsWith(MARKER)) {
    return { workflow: EMPTY_WORKFLOW, plainDescription: description };
  }

  const payload = description.slice(MARKER.length).trimStart();
  const newlineIndex = payload.indexOf("\n");
  const jsonPart = newlineIndex >= 0 ? payload.slice(0, newlineIndex) : payload;
  const plainPart = newlineIndex >= 0 ? payload.slice(newlineIndex + 1).trim() : "";

  try {
    const parsed = JSON.parse(jsonPart) as Partial<EquipmentWorkflowData>;

    return {
      workflow: {
        dailyRate: clampNonNegative(Number(parsed.dailyRate ?? 0)),
        nextServiceDate: parsed.nextServiceDate ?? null,
        serviceIntervalHours: clampNonNegative(Number(parsed.serviceIntervalHours ?? 0)),
        currentHours: clampNonNegative(Number(parsed.currentHours ?? 0)),
        assignments: Array.isArray(parsed.assignments)
          ? parsed.assignments
              .map((a) => sanitizeAssignment(a))
              .filter(
                (a) =>
                  a.id &&
                  a.projectId &&
                  a.projectName &&
                  a.startDate &&
                  a.endDate
              )
          : [],
      },
      plainDescription: plainPart || null,
    };
  } catch {
    return { workflow: EMPTY_WORKFLOW, plainDescription: description };
  }
}

export function serializeEquipmentDescription(
  workflow: EquipmentWorkflowData,
  plainDescription?: string | null
): string | null {
  const payload: EquipmentWorkflowData = {
    dailyRate: clampNonNegative(workflow.dailyRate),
    nextServiceDate: workflow.nextServiceDate,
    serviceIntervalHours: clampNonNegative(workflow.serviceIntervalHours),
    currentHours: clampNonNegative(workflow.currentHours),
    assignments: workflow.assignments.map((a) => sanitizeAssignment(a)),
  };

  const json = JSON.stringify(payload);
  const plain = (plainDescription ?? "").trim();
  const serialized = `${MARKER}${json}${plain ? `\n${plain}` : ""}`;
  return serialized.trim() || null;
}

