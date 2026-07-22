import { describe, expect, it } from "vitest";
import {
  buildSubmittalWorkflowGlance,
  SUBMITTAL_WORKFLOW_EMPTY,
} from "./submittal-workflow-glance";

describe("submittal-workflow-glance (3.4.7)", () => {
  it("marks current step for InReview", () => {
    const steps = buildSubmittalWorkflowGlance("InReview");
    expect(steps.find((s) => s.label === "In Review")?.status).toBe("current");
    expect(steps.find((s) => s.label === "Draft")?.status).toBe("completed");
    expect(steps.find((s) => s.label === "Approved")?.status).toBe("upcoming");
  });

  it("treats ApprovedAsNoted like Approved position", () => {
    const steps = buildSubmittalWorkflowGlance("ApprovedAsNoted");
    expect(steps.find((s) => s.label === "Approved")?.status).toBe("current");
  });

  it("Rejected is terminal overdue branch", () => {
    const steps = buildSubmittalWorkflowGlance("Rejected");
    expect(steps[steps.length - 1]?.label).toBe("Rejected");
    expect(steps[steps.length - 1]?.status).toBe("overdue");
  });

  it("empty history copy is not a health claim", () => {
    expect(SUBMITTAL_WORKFLOW_EMPTY.toLowerCase()).toMatch(/do not invent/);
    expect(SUBMITTAL_WORKFLOW_EMPTY.toLowerCase()).not.toMatch(/%|health score/);
  });
});
