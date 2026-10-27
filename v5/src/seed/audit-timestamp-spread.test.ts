/**
 * Seeded audit timestamps (action_runs + change_order_events) must spread
 * across a Pacific workday — never collapse to the same LocalTime label.
 *
 * Re-runs under TZ=America/Los_Angeles and TZ=UTC so host TZ cannot revive
 * the `today.getTime() + i` ms pile.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { JOB_TIME_ZONE, seedAuditSpread } from "@/lib/plan-date";
import { seed } from "./index";

const company = "00000000-0000-4000-8000-0000000000at";
const v5Root = fileURLToPath(new URL("../..", import.meta.url));
const isTzChild = process.env.AUDIT_SPREAD_TZ_CHILD === "1";
const expectTz = process.env.AUDIT_SPREAD_EXPECT_TZ;

const CLOCKS = [
  // Midday PT (staging seed clock).
  new Date("2026-10-20T17:00:00.000Z"),
  // Evening PT just after UTC midnight.
  new Date("2026-10-27T00:30:00.000Z"),
  // Late afternoon PT.
  new Date("2026-10-26T19:45:00.000Z"),
] as const;

function ptClockLabel(iso: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: JOB_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(iso);
}

function assertSeedAuditSpread(now: Date) {
  const rows = seed(company, now);
  expect(rows.actionRuns.length).toBeGreaterThan(1);

  const runTimes = rows.actionRuns
    .map((r) => r.createdAt!.getTime())
    .sort((a, b) => a - b);
  // Strictly increasing — old `now + i` ms looked identical in LocalTime.
  for (let i = 1; i < runTimes.length; i++) {
    expect(runTimes[i]!).toBeGreaterThan(runTimes[i - 1]!);
    expect(runTimes[i]! - runTimes[i - 1]!).toBeGreaterThanOrEqual(60_000);
  }
  expect(runTimes[runTimes.length - 1]!).toBeLessThanOrEqual(now.getTime());

  const ptLabels = rows.actionRuns.map((r) => ptClockLabel(r.createdAt!));
  expect(new Set(ptLabels).size).toBe(ptLabels.length);

  // CO events on multi-step orders also spread.
  const byCo = new Map<string, Date[]>();
  for (const ev of rows.changeOrderEvents) {
    const list = byCo.get(ev.changeOrderId!) ?? [];
    list.push(ev.at!);
    byCo.set(ev.changeOrderId!, list);
  }
  for (const ats of byCo.values()) {
    if (ats.length < 2) continue;
    const sorted = ats.map((d) => d.getTime()).sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]!).toBeGreaterThan(sorted[i - 1]!);
      expect(sorted[i]! - sorted[i - 1]!).toBeGreaterThanOrEqual(60_000);
    }
  }

  // Helper itself: 24 stamps, distinct PT labels, all ≤ now.
  const spread = seedAuditSpread(now, 24);
  expect(spread).toHaveLength(24);
  expect(new Set(spread.map(ptClockLabel)).size).toBe(24);
  expect(spread.every((t) => t.getTime() <= now.getTime())).toBe(true);
}

describe("seed audit timestamp spread", () => {
  if (expectTz) {
    it(`child process TZ is ${expectTz}`, () => {
      expect(process.env.TZ).toBe(expectTz);
    });
  }

  for (const now of CLOCKS) {
    it(`action_runs PT labels distinct at ${now.toISOString()}`, () => {
      assertSeedAuditSpread(now);
    });
  }
});

describe.skipIf(isTzChild)("seed audit spread under host TZ", () => {
  for (const tz of ["America/Los_Angeles", "UTC"] as const) {
    it(`child vitest TZ=${tz}`, () => {
      const r = spawnSync(
        process.execPath,
        [
          "./node_modules/vitest/vitest.mjs",
          "run",
          "src/seed/audit-timestamp-spread.test.ts",
          "--reporter=dot",
        ],
        {
          cwd: v5Root,
          env: {
            ...process.env,
            TZ: tz,
            AUDIT_SPREAD_TZ_CHILD: "1",
            AUDIT_SPREAD_EXPECT_TZ: tz,
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
