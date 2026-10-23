import { describe, expect, it } from "vitest";
import { activeJobsOnly, isActiveJob, isEstimateDraft } from "./portfolio";

describe("honesty: draft jobs are not active", () => {
  const cedar = { job: { number: "25-031", estimateStatus: "approved" } };
  const harbor = { job: { number: "26-010", estimateStatus: "draft" } };

  it("excludes draft-estimate jobs from the active set", () => {
    // Bug: 26-010 counted in "4 active jobs" while login said three live jobs.
    expect(isActiveJob(harbor.job)).toBe(false);
    expect(isEstimateDraft(harbor.job)).toBe(true);
    expect(isActiveJob(cedar.job)).toBe(true);
    expect(activeJobsOnly([cedar, harbor])).toEqual([cedar]);
    expect(activeJobsOnly([cedar, harbor])).toHaveLength(1);
  });
});
