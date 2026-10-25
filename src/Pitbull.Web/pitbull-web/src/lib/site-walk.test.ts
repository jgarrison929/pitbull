import { describe, expect, it } from "vitest";
import {
  buildSiteWalkHref,
  buildSubStatusItems,
  deriveSubHealth,
  filterLookAheadTasks,
  type ScheduleLookAheadTask,
} from "./site-walk";

describe("filterLookAheadTasks", () => {
  const now = new Date("2026-07-11T12:00:00Z");

  const tasks: ScheduleLookAheadTask[] = [
    {
      id: "t1",
      name: "Pour foundation",
      status: "InProgress",
      plannedStart: "2026-07-10",
      plannedFinish: "2026-07-12",
      percentComplete: 40,
      isCritical: true,
    },
    {
      id: "t2",
      name: "Roofing far future",
      status: "NotStarted",
      plannedStart: "2026-09-01",
      plannedFinish: "2026-09-15",
      percentComplete: 0,
      isCritical: false,
    },
    {
      id: "t3",
      name: "Electrical rough-in",
      status: "NotStarted",
      plannedStart: "2026-07-14",
      plannedFinish: "2026-07-16",
      percentComplete: 0,
      isCritical: false,
    },
    {
      id: "t4",
      name: "Done work",
      status: "Completed",
      plannedStart: "2026-07-01",
      plannedFinish: "2026-07-05",
      percentComplete: 100,
      isCritical: false,
    },
  ];

  it("returns near-term and in-progress tasks, critical first", () => {
    const result = filterLookAheadTasks(tasks, now, 7);
    expect(result.map((t) => t.id)).toContain("t1");
    expect(result.map((t) => t.id)).toContain("t3");
    expect(result.map((t) => t.id)).not.toContain("t2");
    expect(result.map((t) => t.id)).not.toContain("t4");
    expect(result[0]?.id).toBe("t1");
  });
});

describe("deriveSubHealth", () => {
  it("flags many open issues as delayed", () => {
    expect(deriveSubHealth("Active", 5)).toBe("delayed");
  });
  it("flags insurance issues as at_risk", () => {
    expect(deriveSubHealth("Active", 0, false)).toBe("at_risk");
  });
  it("is on_track when healthy", () => {
    expect(deriveSubHealth("Active", 0, true)).toBe("on_track");
  });
});

describe("buildSubStatusItems", () => {
  it("maps subcontract rows to glance cards with health", () => {
    const items = buildSubStatusItems(
      [
        {
          id: "s1",
          subcontractorName: "ABC Electric",
          tradeCode: "ELEC",
          status: "Active",
          updatedAt: "2026-07-10T00:00:00Z",
          insuranceCurrent: true,
        },
      ],
      { s1: 2 }
    );
    expect(items[0]?.name).toBe("ABC Electric");
    expect(items[0]?.openIssuesCount).toBe(2);
    expect(items[0]?.health).toBe("at_risk");
  });
});

describe("buildSiteWalkHref", () => {
  it("points at project site-walk route", () => {
    expect(buildSiteWalkHref("p1")).toBe("/projects/p1/site-walk");
  });
});
