import { describe, expect, it } from "vitest";
import {
  buildOfflinePlanPinDraft,
  buildPlanPinRfiDraft,
  planPinRfiToApiJson,
} from "./plan-pin-draft";

describe("buildPlanPinRfiDraft", () => {
  it("requires project and note; attaches PlanSheetId in drawingReferences", () => {
    expect(() =>
      buildPlanPinRfiDraft({ projectId: "", note: "x" })
    ).toThrow(/projectId/i);
    expect(() =>
      buildPlanPinRfiDraft({ projectId: "p1", note: "  " })
    ).toThrow(/note/i);

    const body = buildPlanPinRfiDraft({
      projectId: "11111111-1111-1111-1111-111111111111",
      planSheetId: "sheet-abc",
      planFileId: "file-xyz",
      sheetLabel: "A-101",
      note: "Missing sleeve at grid B3",
      location: { xPct: 0.42, yPct: 0.55, page: 1 },
    });

    expect(body.requiresUserConfirm).toBe(true);
    expect(body.subject).toMatch(/Field pin/i);
    expect(body.question).toMatch(/Missing sleeve/);
    expect(body.question).toMatch(/42%/);
    expect(body.drawingReferences.some((r) => r.includes("sheet-abc"))).toBe(
      true
    );
    expect(body.drawingReferences.some((r) => r.includes("file-xyz"))).toBe(
      true
    );

    const api = planPinRfiToApiJson(body);
    expect(api.hasCostImpact).toBe(false);
    expect(api.drawingReferences).toEqual(body.drawingReferences);
    expect(api).not.toHaveProperty("estimatedCostImpact");
    expect(api).not.toHaveProperty("percentComplete");
  });
});

describe("buildOfflinePlanPinDraft", () => {
  it("queues offline draft with same sheet identity", () => {
    const d = buildOfflinePlanPinDraft({
      projectId: "p1",
      planSheetId: "s1",
      note: "Crack at beam",
    });
    expect(d.type).toBe("plan-pin-rfi");
    expect(d.status).toBe("queued");
    expect(d.planSheetId).toBe("s1");
    expect(d.body.drawingReferences.join(" ")).toMatch(/s1/);
  });
});
