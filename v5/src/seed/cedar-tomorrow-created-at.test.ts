/**
 * Acceptance: Cedar's seeded "tomorrow" plan Created stamp is before seed now
 * so live Approve/Report rows sort after it. Regression for staging verify
 * finding that tomorrow@06:00Z (11 PM PT prior evening) listed after Approved.
 *
 * Runs the same checks in-process and again under TZ=America/Los_Angeles and
 * TZ=UTC via child vitest processes (host TZ must not revive the bug).
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  planDateToday,
  timeZoneForJob,
} from "@/lib/plan-date";
import { seed, seedId } from "./index";

const company = "00000000-0000-4000-8000-0000000000ct";
const v5Root = fileURLToPath(new URL("../..", import.meta.url));
const isTzChild = process.env.CEDAR_CREATED_TZ_CHILD === "1";
const expectTz = process.env.CEDAR_CREATED_EXPECT_TZ;

/** Clocks that exposed the bug: Created at tomorrow@06:00Z after "now". */
const CLOCKS = [
  // Afternoon PT on the day before the plan date (staging verify window).
  new Date("2026-10-26T19:45:00.000Z"),
  // Evening PT just after UTC midnight (plan-date TZ window).
  new Date("2026-10-27T00:30:00.000Z"),
  // Midday when UTC day === LA day.
  new Date("2026-10-26T17:00:00.000Z"),
] as const;

function assertCedarTomorrowCreatedChronology(now: Date) {
  const rows = seed(company, now);
  const planId = seedId(company, "plan:cedar:tomorrow");
  const plan = rows.dailyPlans.find((p) => p.id === planId)!;
  const created = rows.dailyPlanEvents.find(
    (e) => e.planId === planId && e.kind === "created",
  )!;
  const laTomorrow = addCalendarDays(
    planDateToday(now, timeZoneForJob()),
    1,
  );
  const bugStamp = new Date(`${laTomorrow}T06:00:00.000Z`);

  expect(plan.planDate).toBe(laTomorrow);
  expect(created).toBeTruthy();
  expect(plan.createdAt!.getTime()).toBe(created.at!.getTime());
  // Chronology: Created before seed now so a live Approved-at-now sorts after.
  expect(plan.createdAt!.getTime()).toBeLessThan(now.getTime());
  expect(created.at!.getTime()).toBeLessThan(now.getTime());
  // Must not revive the tomorrow@06:00Z source stamp.
  expect(plan.createdAt!.getTime()).not.toBe(bugStamp.getTime());
  if (bugStamp.getTime() > now.getTime()) {
    expect(plan.createdAt!.getTime()).toBeLessThan(bugStamp.getTime());
  }
}

describe("Cedar tomorrow Created chronology", () => {
  if (expectTz) {
    it(`child process TZ is ${expectTz}`, () => {
      expect(process.env.TZ).toBe(expectTz);
    });
  }

  for (const now of CLOCKS) {
    it(`Created before seed now at ${now.toISOString()}`, () => {
      assertCedarTomorrowCreatedChronology(now);
    });
  }
});

describe.skipIf(isTzChild)("Cedar tomorrow Created under host TZ", () => {
  for (const tz of ["America/Los_Angeles", "UTC"] as const) {
    it(`child vitest TZ=${tz}`, () => {
      const r = spawnSync(
        process.execPath,
        [
          "./node_modules/vitest/vitest.mjs",
          "run",
          "src/seed/cedar-tomorrow-created-at.test.ts",
          "--reporter=dot",
        ],
        {
          cwd: v5Root,
          env: {
            ...process.env,
            TZ: tz,
            CEDAR_CREATED_TZ_CHILD: "1",
            CEDAR_CREATED_EXPECT_TZ: tz,
            // CI colors break fragile summary regexes; exit status is the gate.
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
