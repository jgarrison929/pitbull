/**
 * Minimal plan pin → draft RFI payload (3.1.8).
 * User must confirm before submit; never auto-posts progress/cost.
 */

export interface PlanPinLocation {
  /** 0–1 normalized X within the viewer (optional). */
  xPct?: number;
  /** 0–1 normalized Y within the viewer (optional). */
  yPct?: number;
  page?: number;
}

export interface PlanPinDraftInput {
  projectId: string;
  /** Plan set / sheet id when known (twin fuel). */
  planSheetId?: string | null;
  /** Project document file id when pin is on a drawing file. */
  planFileId?: string | null;
  sheetLabel?: string | null;
  note: string;
  location?: PlanPinLocation;
}

export interface PlanPinRfiCreateBody {
  subject: string;
  question: string;
  priority: "Normal";
  drawingReferences: string[];
  /** Client-only flag — API create is draft-open RFI; confirm required in UI. */
  requiresUserConfirm: true;
}

export interface OfflinePlanPinDraft {
  id: string;
  type: "plan-pin-rfi";
  projectId: string;
  planSheetId?: string;
  planFileId?: string;
  body: PlanPinRfiCreateBody;
  createdAt: string;
  status: "pending_confirm" | "queued";
}

/**
 * Build CreateRfiRequest-shaped body with sheet identity in DrawingReferences.
 * Does not invent cost impact or % complete.
 */
export function buildPlanPinRfiDraft(input: PlanPinDraftInput): PlanPinRfiCreateBody {
  if (!input.projectId?.trim()) {
    throw new Error("projectId is required for plan pin draft");
  }
  const note = (input.note ?? "").trim();
  if (!note) {
    throw new Error("note is required for plan pin draft");
  }

  const sheetLabel =
    input.sheetLabel?.trim() ||
    input.planSheetId?.trim() ||
    input.planFileId?.trim() ||
    "plan";

  const refs: string[] = [];
  if (input.planSheetId?.trim()) refs.push(`PlanSheetId:${input.planSheetId.trim()}`);
  if (input.planFileId?.trim()) refs.push(`PlanFileId:${input.planFileId.trim()}`);
  if (input.sheetLabel?.trim()) refs.push(input.sheetLabel.trim());

  const locParts: string[] = [];
  if (
    input.location?.xPct != null &&
    input.location?.yPct != null &&
    Number.isFinite(input.location.xPct) &&
    Number.isFinite(input.location.yPct)
  ) {
    locParts.push(
      `Pin ~${Math.round(input.location.xPct * 100)}% x, ${Math.round(input.location.yPct * 100)}% y`
    );
  }
  if (input.location?.page != null && Number.isFinite(input.location.page)) {
    locParts.push(`page ${input.location.page}`);
  }

  const locationBlock = locParts.length ? `\n\n[${locParts.join(", ")}]` : "";
  const question = `${note}${locationBlock}\n\n(Field pin — confirm before office treats as formal RFI workflow.)`;

  return {
    subject: `Field pin: ${sheetLabel}`.slice(0, 200),
    question,
    priority: "Normal",
    drawingReferences: refs.length ? refs : [sheetLabel],
    requiresUserConfirm: true,
  };
}

/** API JSON body (matches CreateRfiRequest property names). */
export function planPinRfiToApiJson(body: PlanPinRfiCreateBody): Record<string, unknown> {
  return {
    subject: body.subject,
    question: body.question,
    priority: body.priority,
    drawingReferences: body.drawingReferences,
    hasCostImpact: false,
  };
}

export function buildOfflinePlanPinDraft(
  input: PlanPinDraftInput,
  id?: string
): OfflinePlanPinDraft {
  const body = buildPlanPinRfiDraft(input);
  return {
    id:
      id ??
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `pin-${Date.now()}`),
    type: "plan-pin-rfi",
    projectId: input.projectId,
    planSheetId: input.planSheetId?.trim() || undefined,
    planFileId: input.planFileId?.trim() || undefined,
    body,
    createdAt: new Date().toISOString(),
    status: "queued",
  };
}
