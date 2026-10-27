/**
 * Trust bar: I-5 today's issued/returned plan must have daily_plan_events so
 * the plan page History matches the job card (not an empty History shell).
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { I5_RETURN_REASON } from "./finalize-history";
import { seed, seedId } from "./index";

const company = "00000000-0000-4000-8000-0000000000i5";
const v5Root = fileURLToPath(new URL("../..", import.meta.url));
const isTzChild = process.env.I5_HISTORY_TZ_CHILD === "1";
const expectTz = process.env.I5_HISTORY_EXPECT_TZ;

const CLOCKS = [
  new Date("2026-10-20T17:00:00.000Z"),
  new Date("2026-10-27T00:30:00.000Z"),
  new Date("2026-10-26T19:45:00.000Z"),
] as const;

function assertI5PlanHistorySource(now: Date) {
  const rows = seed(company, now);
  const planId = seedId(company, "plan:i5:today");
  const plan = rows.dailyPlans.find((p) => p.id === planId)!;
  expect(plan.status).toBe("issued");
  expect(plan.returnReason).toBe(I5_RETURN_REASON);
  expect(plan.submittedAt).toBeTruthy();
  expect(plan.reportedAt).toBeTruthy();
  expect(plan.returnedAt).toBeTruthy();

  const events = rows.dailyPlanEvents
    .filter((e) => e.planId === planId)
    .slice()
    .sort(
      (a, b) =>
        a.at!.getTime() - b.at!.getTime() ||
        String(a.id).localeCompare(String(b.id)),
    );
  // Must-fail twin: stamp columns alone → empty History on the plan page.
  expect(events.map((e) => e.kind)).toEqual([
    "created",
    "submitted",
    "reported",
    "returned",
  ]);
  expect(events.find((e) => e.kind === "returned")!.detail).toBe(
    I5_RETURN_REASON,
  );
  expect(events.every((e) => e.actorRole)).toBe(true);

  // Stamps agree with the append-only log (plan page reads events, not stamps).
  expect(plan.submittedAt!.getTime()).toBe(
    events.find((e) => e.kind === "submitted")!.at!.getTime(),
  );
  expect(plan.reportedAt!.getTime()).toBe(
    events.find((e) => e.kind === "reported")!.at!.getTime(),
  );
  expect(plan.returnedAt!.getTime()).toBe(
    events.find((e) => e.kind === "returned")!.at!.getTime(),
  );
  // Chronology stays honest.
  for (let i = 1; i < events.length; i++) {
    expect(events[i]!.at!.getTime()).toBeGreaterThan(
      events[i - 1]!.at!.getTime(),
    );
  }
  expect(events[events.length - 1]!.at!.getTime()).toBeLessThanOrEqual(
    now.getTime(),
  );
}

describe("I-5 plan history source", () => {
  if (expectTz) {
    it(`child process TZ is ${expectTz}`, () => {
      expect(process.env.TZ).toBe(expectTz);
    });
  }

  for (const now of CLOCKS) {
    it(`events match issued/returned stamps at ${now.toISOString()}`, () => {
      assertI5PlanHistorySource(now);
    });
  }
});

describe.skipIf(isTzChild)("I-5 plan history under host TZ", () => {
  for (const tz of ["America/Los_Angeles", "UTC"] as const) {
    it(`child vitest TZ=${tz}`, () => {
      const r = spawnSync(
        process.execPath,
        [
          "./node_modules/vitest/vitest.mjs",
          "run",
          "src/seed/i5-plan-history.test.ts",
          "--reporter=dot",
        ],
        {
          cwd: v5Root,
          env: {
            ...process.env,
            TZ: tz,
            I5_HISTORY_TZ_CHILD: "1",
            I5_HISTORY_EXPECT_TZ: tz,
            NO_COLOR: "1",
            FORCE_COLOR: "0",
          },
          encoding: "utf8",
        },
      );
      expect(r.status, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`).toBe(0);
    });
  }
});
