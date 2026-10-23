import { describe, expect, it } from "vitest";
import { actionRailLabel } from "./labels";

describe("honesty: assistant rail labels", () => {
  it("never shows raw action ids like changeOrder.reject(24-118)", () => {
    const label = actionRailLabel("changeOrder.reject", "24-118");
    expect(label).not.toMatch(/changeOrder\./);
    expect(label).not.toMatch(/\(/);
    expect(label).toBe("Rejected change order on 24-118");
  });

  it("labels plan line updates without the action key", () => {
    const label = actionRailLabel("dailyPlan.updateLine", "25-031");
    expect(label).toBe("Updated plan line on 25-031");
    expect(label).not.toContain("dailyPlan");
  });
});
