/**
 * 5.0.3 Part A — S-curve acceptance checks 1–6 + must-fails.
 *
 * Each key rule has a must-fail that goes red if the formula, cutoff, CO delta,
 * draft exclusion, or query budget is reverted.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb, getDbQueryCount, resetDbQueryCount } from "@/db";
import { companies, costItems, jobs } from "@/db/schema";
import { changeOrderCommand } from "@/server/change-orders";
import { jobRollupSql } from "@/server/cost-rollups";
import {
  JOB_CURVE_LEAF_BUDGET,
  JOB_CURVE_QUERY_BUDGET,
  PORTFOLIO_CURVE_QUERY_BUDGET,
  jobCurve,
  portfolioCurve,
} from "@/server/curve";
import { earnedCentsOf } from "@/lib/ev";
import { seedStressJob, STRESS_LEAF_COUNT } from "@/seed/stress";
import { getJob, getPortfolio } from "@/server/data";
import { lockProgressClaim } from "@/server/progress";
import { createSandbox } from "@/server/sandbox";
import { seedNow } from "@/server/seed-clock";
import { seedId } from "@/seed";

const hasDb = Boolean(getDb());
const created: string[] = [];
const ACTIVE = ["25-031", "24-118", "24-077"] as const;
const CO_001_DELTA_CENTS = 6_000_000; // $60,000.00

const here = dirname(fileURLToPath(import.meta.url));

function db() {
  const client = getDb();
  if (!client) throw new Error("DATABASE_URL is not set");
  return client;
}

async function jobId(companyId: string, number: string) {
  const [row] = await db()
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.companyId, companyId), eq(jobs.number, number)))
    .limit(1);
  if (!row) throw new Error(`job ${number} missing`);
  return row.id;
}

function pointOn(
  points: { on: string; plannedCents: number; earnedCents: number | null; actualCents: number | null }[],
  on: string,
) {
  const p = points.find((x) => x.on === on);
  if (!p) throw new Error(`no curve point on ${on}`);
  return p;
}

describe.skipIf(!hasDb)("5.0.3 Part A S-curve", () => {
  const prevSeedNow = process.env.V5_SEED_NOW;
  let companyId = "";

  beforeAll(async () => {
    process.env.V5_SEED_NOW = "2026-10-20T17:00:00.000Z";
    companyId = await createSandbox(seedNow());
    created.push(companyId);
  }, 120_000);

  afterAll(async () => {
    if (prevSeedNow === undefined) delete process.env.V5_SEED_NOW;
    else process.env.V5_SEED_NOW = prevSeedNow;
    for (const id of created)
      await db().delete(companies).where(eq(companies.id, id));
  });

  it("must-fail: D11 — one SQL definition via cost-rollup-exprs", () => {
    const exprs = readFileSync(join(here, "cost-rollup-exprs.ts"), "utf8");
    const rollups = readFileSync(join(here, "cost-rollups.ts"), "utf8");
    const curve = readFileSync(join(here, "curve.ts"), "utf8");

    // Sole owner of the CB / EV / PV fragments.
    expect(exprs).toMatch(/export const cbTotalSql\b/);
    expect(exprs).toMatch(/export function earnedFromSql\b/);
    expect(exprs).toMatch(/export const earnedSql\s*=\s*earnedFromSql\(/);
    expect(exprs).toMatch(/export function plannedAsOfSql\b/);
    expect(exprs).toMatch(/claimedInstalledQtyMilli/);
    expect(exprs).toMatch(/claimedPercentMilli/);

    // Claim-line EV is the same function — not a second CASE body.
    const claimFn = exprs.match(
      /export function earnedFromClaimLineSql\b[\s\S]*?\n\}/,
    );
    expect(claimFn?.[0]).toMatch(/return earnedFromSql\(/);
    expect(claimFn?.[0]).not.toMatch(/\bcase\b/i);
    expect(claimFn?.[0]).not.toMatch(/\bleast\b/);
    expect(claimFn?.[0]).not.toMatch(/\bround\b/);

    // Count definitions in code (not names / comments): EV CASE has one
    // least + two rounds; PV linear has one more round. A duplicated
    // claim-line CASE goes to 2 least / 5 rounds.
    const code = exprs
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect((code.match(/\bleast\s*\(/g) ?? []).length).toBe(1);
    expect((code.match(/\bround\s*\(/g) ?? []).length).toBe(3);

    // Both consumers import the shared module — not a second private copy.
    expect(rollups).toMatch(/from ["']@\/server\/cost-rollup-exprs["']/);
    expect(curve).toMatch(/from ["']@\/server\/cost-rollup-exprs["']/);
    expect(rollups).toMatch(/\bcbTotalSql\b/);
    expect(rollups).toMatch(/\bearnedSql\b/);
    expect(rollups).toMatch(/\bplannedAsOfSql\b/);
    expect(curve).toMatch(/\bearnedSql\b/);
    expect(curve).toMatch(/\bplannedAsOfSql\b/);

    // Private re-declarations deleted.
    expect(rollups).not.toMatch(/\bconst cbTotalSql\b/);
    expect(rollups).not.toMatch(/\bconst earnedSql\b/);
    expect(rollups).not.toMatch(/\bfunction plannedAsOfSql\b/);
    expect(curve).not.toMatch(/\bconst cbTotalSql\b/);
    expect(curve).not.toMatch(/\bconst earnedSql\b/);
    expect(curve).not.toMatch(/\bfunction plannedAsOfSql\b/);
    expect(rollups).not.toMatch(/claimedInstalledQtyMilli/);
    expect(curve).not.toMatch(/claimedInstalledQtyMilli/);
  });

  it("must-fail: D11 — half-cent percent EV rounds (shared CASE uses round)", () => {
    // 10001 × 500‰ = 5000.5¢ → round → 5001; floor would stay GREEN at 5000.
    expect(
      earnedCentsOf({
        evMethod: "pm_percent",
        budgetQtyMilli: 0,
        budgetCents: 10_001,
        claimedInstalledQtyMilli: 0,
        claimedPercentMilli: 500,
      }),
    ).toBe(5_001);
    const exprs = readFileSync(join(here, "cost-rollup-exprs.ts"), "utf8");
    expect(exprs).toMatch(/else\s+round\s*\(/);
    expect(exprs).not.toMatch(/\bfloor\s*\(/);
    expect(exprs).not.toMatch(/\btrunc\s*\(/);
  });

  it("check 1: last planned-value point equals Current Budget on 25-031", async () => {
    const id = await jobId(companyId, "25-031");
    const curve = await jobCurve(companyId, id);
    const job = await getJob(companyId, "25-031");
    expect(curve).not.toBeNull();
    expect(curve!.points.length).toBeGreaterThan(0);
    expect(curve!.points.at(-1)!.plannedCents).toBe(job!.budgetCents);
  });

  it("check 2: at cutoff, EV/AC/PV equal the tiles on 25-031, 24-118, 24-077", async () => {
    for (const number of ACTIVE) {
      const id = await jobId(companyId, number);
      const [curve, roll] = await Promise.all([
        jobCurve(companyId, id),
        jobRollupSql(companyId, id),
      ]);
      expect(curve?.cutoffOn, number).toBeTruthy();
      const at = pointOn(curve!.points, curve!.cutoffOn!);
      expect(at.earnedCents, `${number} EV`).toBe(roll.earnedCents);
      expect(at.actualCents, `${number} AC`).toBe(roll.actualCents);
      expect(at.plannedCents, `${number} PV`).toBe(roll.plannedCents);
    }
  });

  it("must-fail: cutoff EV/AC/PV diverge from jobRollupSql when formulas drift", async () => {
    const id = await jobId(companyId, "25-031");
    const curve = await jobCurve(companyId, id);
    const roll = await jobRollupSql(companyId, id);
    const at = pointOn(curve!.points, curve!.cutoffOn!);
    // Deliberate tight equality — a private PV formula would break this after a CO.
    expect({
      earned: at.earnedCents,
      actual: at.actualCents,
      planned: at.plannedCents,
    }).toEqual({
      earned: roll.earnedCents,
      actual: roll.actualCents,
      planned: roll.plannedCents,
    });
  });

  it("check 3: locking Period 2 moves the cutoff and matches new tiles", async () => {
    const company = await createSandbox(seedNow());
    created.push(company);
    const id = await jobId(company, "25-031");
    const before = await jobCurve(company, id);
    expect(before?.cutoffOn).toBeTruthy();

    // Seed locks Period 1 at seedNow; lock Period 2 one day later so the
    // cutoff date moves (acceptance: a lock moves the cutoff).
    const nextLockAt = new Date(seedNow().getTime() + 24 * 60 * 60 * 1000);
    const pmId = seedId(company, "user:pm");
    const locked = await lockProgressClaim(company, id, pmId, nextLockAt);
    expect(locked.ok).toBe(true);

    const newCutoffIso = nextLockAt.toISOString().slice(0, 10);
    const [after, roll] = await Promise.all([
      jobCurve(company, id),
      jobRollupSql(company, id, nextLockAt),
    ]);
    expect(after?.cutoffOn).toBe(newCutoffIso);
    expect(after!.cutoffOn).not.toBe(before!.cutoffOn);
    const at = pointOn(after!.points, after!.cutoffOn!);
    expect(at.earnedCents).toBe(roll.earnedCents);
    expect(at.actualCents).toBe(roll.actualCents);
    expect(at.plannedCents).toBe(roll.plannedCents);
  });

  it("check 4: approving CO-001 raises the last planned-value point by $60,000.00", async () => {
    const company = await createSandbox(seedNow());
    created.push(company);
    const id = await jobId(company, "25-031");
    const before = await jobCurve(company, id);
    const beforeLast = before!.points.at(-1)!.plannedCents;

    const executive = {
      userId: seedId(company, "user:executive"),
      role: "executive" as const,
    };
    const result = await changeOrderCommand(company, executive, "25-031", {
      kind: "approve",
      co: { number: 1 },
    });
    expect(result.ok).toBe(true);

    const after = await jobCurve(company, id);
    const afterLast = after!.points.at(-1)!.plannedCents;
    expect(afterLast - beforeLast).toBe(CO_001_DELTA_CENTS);
    // Must-fail: last PV still equals Current Budget after the CO.
    const job = await getJob(company, "25-031");
    expect(afterLast).toBe(job!.budgetCents);
  });

  it("check 5: portfolio curve sums active jobs; cutoff matches portfolio tiles", async () => {
    const [curve, portfolio] = await Promise.all([
      portfolioCurve(companyId),
      getPortfolio(companyId),
    ]);
    expect(curve.points.length).toBeGreaterThan(0);
    const budgetSum = portfolio.activeJobs.reduce(
      (s, j) => s + j.budgetCents,
      0,
    );
    expect(curve.points.at(-1)!.plannedCents).toBe(budgetSum);
    expect(curve.cutoffOn).toBeTruthy();
    const at = pointOn(curve.points, curve.cutoffOn!);
    expect(at.earnedCents).toBe(portfolio.totals.earnedCents);
    expect(at.actualCents).toBe(portfolio.totals.actualCents);
    expect(at.plannedCents).toBe(portfolio.totals.plannedCents);
  });

  it("must-fail: portfolio curve omits draft 26-010 from the series", async () => {
    const [curve, portfolio, draftCurve] = await Promise.all([
      portfolioCurve(companyId),
      getPortfolio(companyId),
      jobCurve(companyId, await jobId(companyId, "26-010")),
    ]);
    expect(draftCurve).toBeNull();
    expect(portfolio.jobs.some((j) => j.job.number === "26-010")).toBe(true);
    expect(portfolio.activeJobs.some((j) => j.job.number === "26-010")).toBe(
      false,
    );
    // Active set is exactly the three approved jobs.
    expect(portfolio.activeJobs.map((j) => j.job.number).sort()).toEqual(
      [...ACTIVE].sort(),
    );
    expect(curve.points.at(-1)!.plannedCents).toBe(
      portfolio.activeJobs.reduce((s, j) => s + j.budgetCents, 0),
    );
  });

  it("check 6: draft job 26-010 has no curve", async () => {
    const id = await jobId(companyId, "26-010");
    const curve = await jobCurve(companyId, id);
    expect(curve).toBeNull();
  });

  it("must-fail: jobCurve stays within a fixed query budget", async () => {
    const id = await jobId(companyId, "25-031");
    // Warm once so schema/plan cache is not charged to the budget.
    await jobCurve(companyId, id);
    resetDbQueryCount();
    await jobCurve(companyId, id);
    expect(getDbQueryCount()).toBeLessThanOrEqual(JOB_CURVE_QUERY_BUDGET);
    expect(JOB_CURVE_QUERY_BUDGET).toBe(1);
  });

  it("must-fail: oversize WBS skips the daily series (leaf budget)", () => {
    const src = readFileSync(join(here, "curve.ts"), "utf8");
    // Cap must sit below the 10k stress fixture so 99-010 cannot days×leaves.
    expect(JOB_CURVE_LEAF_BUDGET).toBeLessThan(STRESS_LEAF_COUNT);
    expect(JOB_CURVE_LEAF_BUDGET).toBe(2_000);
    expect(src).toMatch(/leaf_meta/);
    expect(src).toMatch(/leaf_n\s*<=/);
    expect(src).toMatch(/JOB_CURVE_LEAF_BUDGET/);
  });

  it(
    "stress 99-010: jobCurve returns null without days×leaves stall",
    async () => {
      const companyId = crypto.randomUUID();
      created.push(companyId);
      const today = new Date("2026-10-19T00:00:00Z");
      const stress = seedStressJob(companyId, today);
      await db().insert(companies).values({
        id: companyId,
        name: "Curve stress",
        isSandbox: true,
        seededAt: today,
      });
      const stressJob = stress.jobs[0]!;
      await db().insert(jobs).values(stressJob);
      const items = stress.costItems;
      for (let i = 0; i < items.length; i += 500) {
        await db().insert(costItems).values(items.slice(i, i + 500));
      }
      const t0 = performance.now();
      const curve = await jobCurve(companyId, stressJob.id!);
      expect(performance.now() - t0).toBeLessThan(2_000);
      expect(curve).toBeNull();
    },
    120_000,
  );

  it("must-fail: portfolioCurve stays within a fixed query budget", async () => {
    await portfolioCurve(companyId);
    resetDbQueryCount();
    await portfolioCurve(companyId);
    expect(getDbQueryCount()).toBeLessThanOrEqual(PORTFOLIO_CURVE_QUERY_BUDGET);
    expect(PORTFOLIO_CURVE_QUERY_BUDGET).toBe(1);
  });

  it("EV/AC are null after the cutoff and present at the cutoff", async () => {
    const id = await jobId(companyId, "25-031");
    const curve = await jobCurve(companyId, id);
    expect(curve?.cutoffOn).toBeTruthy();
    const cutoff = curve!.cutoffOn!;
    const at = pointOn(curve!.points, cutoff);
    expect(at.earnedCents).not.toBeNull();
    expect(at.actualCents).not.toBeNull();
    const after = curve!.points.find((p) => p.on > cutoff);
    if (after) {
      expect(after.earnedCents).toBeNull();
      expect(after.actualCents).toBeNull();
      expect(after.plannedCents).toBeGreaterThanOrEqual(at.plannedCents);
    }
  });
});
