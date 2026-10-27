import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { jobPageCaps } from "@/server/job-page";

describe("job page TTFB guards", () => {
  it("must-fail: job page must not import the assistant action table", () => {
    const src = readFileSync(
      join(process.cwd(), "src/app/app/jobs/[number]/page.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/from ["']@\/server\/assistant\/actions["']/);
    expect(src).toMatch(/timedLoadJobPage/);
    expect(src).toMatch(/data-testid="v5-timing"/);
  });

  it("must-fail: job-page loader stays free of session / actions imports", () => {
    const src = readFileSync(
      join(process.cwd(), "src/server/job-page.ts"),
      "utf8",
    );
    // type-only Role via schema — never value-import session (next/headers hang).
    expect(src).not.toMatch(/from ["']@\/server\/session["']/);
    expect(src).not.toMatch(/from ["']@\/server\/assistant\/actions["']/);
    expect(src).toMatch(/timedLoadJobPage/);
    expect(src).toMatch(/getReportedActualsForPlans/);
  });

  it("must-fail: proxy Server-Timing is only v5proxy", () => {
    const src = readFileSync(join(process.cwd(), "src/proxy.ts"), "utf8");
    expect(src).toMatch(/v5proxy;dur=/);
    expect(src).toMatch(/withServerTiming/);
    // No other metric names invented for this slice.
    expect(src).not.toMatch(/v5job;dur=/);
    expect(src).not.toMatch(/v5data;dur=/);
  });

  it("foreman skips lock / EV / create-plan caps", () => {
    const c = jobPageCaps("foreman");
    expect(c.canLock).toBe(false);
    expect(c.canEvEdit).toBe(false);
    expect(c.canCreatePlan).toBe(false);
    expect(c.canReport).toBe(true);
    expect(c.canEdit).toBe(true);
  });

  it("pm can lock and set EV percent", () => {
    const c = jobPageCaps("pm");
    expect(c.canLock).toBe(true);
    expect(c.canEvEdit).toBe(true);
    expect(c.canApprove).toBe(true);
    expect(c.coCan.approve).toBe(true);
  });
});
