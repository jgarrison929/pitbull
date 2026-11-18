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

  it("refused runs never get success wording", () => {
    expect(
      actionRailLabel("changeOrder.approve", "25-031", { refused: true }),
    ).toBe("Couldn't approve change order on 25-031");
    expect(
      actionRailLabel("dailyPlan.submit", "99-999", { refused: true }),
    ).toBe("Couldn't submit plan on 99-999");
    expect(
      actionRailLabel("progressClaim.lock", "25-031", { refused: true }),
    ).toBe("Couldn't lock progress claim on 25-031");
    expect(
      actionRailLabel("dailyPlan.create", "25-031", { refused: true }),
    ).toBe("Couldn't create plan on 25-031");
    expect(
      actionRailLabel("dailyPlan.create", "99-999", { refused: true }),
    ).toBe("Couldn't create plan on 99-999");
    expect(
      actionRailLabel("dailyPlan.create", "99-999", { refused: true }),
    ).not.toBe("Couldn't show crew plan on 99-999");
    expect(
      actionRailLabel("costItem.setForecastMethod", "25-031", {
        refused: true,
      }),
    ).toBe("Couldn't set forecast method on 25-031");
    expect(
      actionRailLabel("changeOrder.approve", "25-031", { refused: true }),
    ).not.toMatch(/^Approved/);
    // 5.1.0-b: superintendent role refusal chip.
    expect(
      actionRailLabel("schedule.addActivity", "25-031", { refused: true }),
    ).toBe("Couldn't add activity on 25-031");
  });

  it("labels plan create without the action key", () => {
    expect(actionRailLabel("dailyPlan.create", "25-031")).toBe(
      "Created plan on 25-031",
    );
    expect(actionRailLabel("dailyPlan.addLine", "25-031")).toBe(
      "Added plan line on 25-031",
    );
  });
});
