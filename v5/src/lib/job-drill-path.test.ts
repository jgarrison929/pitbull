import { describe, expect, it } from "vitest";
import { parseJobDrillPath } from "./job-drill-path";

describe("parseJobDrillPath", () => {
  it("parses job, changes, cost-item, and plan paths", () => {
    expect(parseJobDrillPath("/app/jobs/25-031")).toEqual({
      kind: "job",
      number: "25-031",
    });
    expect(parseJobDrillPath("/app/jobs/25-031/changes")).toEqual({
      kind: "changes",
      number: "25-031",
    });
    expect(parseJobDrillPath("/app/jobs/25-031/cost-items/04-210")).toEqual({
      kind: "cost-item",
      number: "25-031",
      code: "04-210",
    });
    expect(
      parseJobDrillPath(
        "/app/jobs/25-031/plans/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      ),
    ).toEqual({
      kind: "plan",
      number: "25-031",
      planId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });
  });

  it("ignores search and unknown shapes", () => {
    expect(parseJobDrillPath("/app/jobs/25-031/cost-items/search")).toBeNull();
    expect(parseJobDrillPath("/app/assistant")).toBeNull();
    expect(parseJobDrillPath("/app/jobs/25-031/plans")).toBeNull();
  });
});
