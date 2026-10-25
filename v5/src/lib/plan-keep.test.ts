import { describe, expect, it } from "vitest";
import { planKeepBeats, preferPlanKeep, planStatusKeepRank } from "./plan-keep";

describe("plan-keep", () => {
  it("ranks issued above draft", () => {
    expect(planStatusKeepRank("issued")).toBeGreaterThan(
      planStatusKeepRank("draft"),
    );
  });

  it("keeps issued over draft even when draft has the lower UUID", () => {
    const draft = {
      id: "00000000-0000-4000-8000-000000000001",
      status: "draft",
      planDate: "2026-10-22",
      submittedAt: null,
      createdAt: new Date("2026-10-22T12:00:00.000Z"),
    };
    const issued = {
      id: "ffffffff-ffff-4fff-bfff-ffffffffffff",
      status: "issued",
      planDate: "2026-10-22",
      submittedAt: new Date("2026-10-21T18:00:00.000Z"),
      createdAt: new Date("2026-10-20T12:00:00.000Z"),
    };
    expect(planKeepBeats(issued, draft)).toBe(true);
    expect(planKeepBeats(draft, issued)).toBe(false);
    expect(preferPlanKeep([draft, issued])?.id).toBe(issued.id);
    expect(preferPlanKeep([issued, draft])?.id).toBe(issued.id);
  });

  it("when status ties, prefers newest submitted_at then created_at then id", () => {
    const older = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      status: "issued",
      planDate: "2026-10-22",
      submittedAt: new Date("2026-10-20T12:00:00.000Z"),
      createdAt: new Date("2026-10-19T12:00:00.000Z"),
    };
    const newer = {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      status: "issued",
      planDate: "2026-10-22",
      submittedAt: new Date("2026-10-21T12:00:00.000Z"),
      createdAt: new Date("2026-10-18T12:00:00.000Z"),
    };
    expect(preferPlanKeep([older, newer])?.id).toBe(newer.id);
  });

  it("among drafts, prefers newer created_at over higher UUID", () => {
    const olderHighId = {
      id: "ffffffff-ffff-4fff-bfff-ffffffffffff",
      status: "draft",
      planDate: "2026-10-22",
      submittedAt: null,
      createdAt: new Date("2026-10-20T12:00:00.000Z"),
    };
    const newerLowId = {
      id: "00000000-0000-4000-8000-000000000001",
      status: "draft",
      planDate: "2026-10-22",
      submittedAt: null,
      createdAt: new Date("2026-10-21T12:00:00.000Z"),
    };
    expect(preferPlanKeep([olderHighId, newerLowId])?.id).toBe(newerLowId.id);
  });
});
