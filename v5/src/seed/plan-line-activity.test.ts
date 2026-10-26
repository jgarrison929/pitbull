import { describe, expect, it } from "vitest";
import { seed, seedId } from "@/seed";

describe("5.1.0-d seed Bridge Crew 2 plan-line activity links", () => {
  it("links Cedar tomorrow lines to activities C and E; dewatering stays free-text", () => {
    const companyId = "00000000-0000-4000-8000-000000000021";
    const rows = seed(companyId, new Date("2026-10-20T17:00:00.000Z"));
    const id = (key: string) => seedId(companyId, key);

    const pour = rows.dailyPlanLines.find(
      (l) => l.id === id("plan-line:cedar:0"),
    )!;
    const cage = rows.dailyPlanLines.find(
      (l) => l.id === id("plan-line:cedar:1"),
    )!;
    const dewater = rows.dailyPlanLines.find(
      (l) => l.id === id("plan-line:cedar:2"),
    )!;

    expect(pour.activityId).toBe(id("activity:cedar:C"));
    expect(pour.activity).toBe("Pier columns");
    expect(cage.activityId).toBe(id("activity:cedar:E"));
    expect(cage.activity).toBe("Tie column cage");
    expect(dewater.activityId).toBeNull();
    expect(dewater.activity).toBe("Dewatering watch, pump check");

    // Linked cost items match the schedule graph.
    expect(pour.costItemId).toBe(id("cost:cedar:04-210"));
    expect(cage.costItemId).toBe(id("cost:cedar:04-310"));
  });
});
