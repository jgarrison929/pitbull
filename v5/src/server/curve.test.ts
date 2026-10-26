/**
 * 5.0.5 — S-curve acceptance checks 1–6 + must-fails.
 *
 * Each key rule has a must-fail that goes red if the formula, cutoff, CO delta,
 * draft exclusion, or query budget is reverted.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb, getDbQueryCount, resetDbQueryCount } from "@/db";
import {
  companies,
  costItems,
  jobs,
  progressClaimLines,
  progressClaims,
  users,
} from "@/db/schema";
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
/** Half-cent EV: 10001¢ × 500‰ (or units 1/2) → 5000.5 → round 5001; floor stays 5000. */
const HALF_CENT_BUDGET = 10_001;
const HALF_CENT_EV = 5_001;

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, "..");

function stripComments(src: string) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function countCalls(code: string, name: "least" | "round") {
  // Case-insensitive: Verify D2u/D2uf inline LEAST(/ROUND( (or mixed case)
  // and must go RED the same as lowercase least(/round(.
  return (code.match(new RegExp(`\\b${name}\\s*\\(`, "gi")) ?? []).length;
}

/** Non-test .ts under v5/src (recursive). */
function listSrcTs(dir: string): string[] {
  const out: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules") continue;
      out.push(...listSrcTs(p));
    } else if (ent.isFile() && ent.name.endsWith(".ts") && !ent.name.endsWith(".test.ts")) {
      out.push(p);
    }
  }
  return out;
}

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

describe.skipIf(!hasDb)("5.0.5 S-curve", () => {
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
    expect(claimFn?.[0]).not.toMatch(/\bleast\b/i);
    expect(claimFn?.[0]).not.toMatch(/\bround\b/i);

    // Count definitions in code (not names / comments): EV CASE has one
    // least + two rounds; PV linear has one more round. A duplicated
    // claim-line CASE goes to 2 least / 5 rounds.
    const exprsCode = stripComments(exprs);
    expect(countCalls(exprsCode, "least")).toBe(1);
    expect(countCalls(exprsCode, "round")).toBe(3);

    // Consumers: zero private EV CASE bodies (code counts, not just names).
    // A full CASE inlined in curve.ts as claimEarned (Verify D2/D2b) adds
    // least/round here. A private % CASE in cost-rollups (D3) adds least or
    // a second round beyond the known EAC round.
    const curveCode = stripComments(curve);
    const rollupsCode = stripComments(rollups);
    expect(countCalls(curveCode, "least")).toBe(0);
    expect(countCalls(curveCode, "round")).toBe(0);
    expect(curveCode).not.toMatch(/evMethod\s*[=!]=\s*['"]units['"]/);
    expect(curveCode).not.toMatch(/ev_method/);
    expect(countCalls(rollupsCode, "least")).toBe(0);
    // Exactly one round: average_performance EAC. An extra EV CASE round fails.
    expect(countCalls(rollupsCode, "round")).toBe(1);

    // Both consumers import the shared module — not a second private copy.
    expect(rollups).toMatch(/from ["']@\/server\/cost-rollup-exprs["']/);
    expect(curve).toMatch(/from ["']@\/server\/cost-rollup-exprs["']/);
    expect(rollups).toMatch(/\bcbTotalSql\b/);
    expect(rollups).toMatch(/\bearnedSql\b/);
    expect(rollups).toMatch(/\bplannedAsOfSql\b/);
    expect(curve).toMatch(/\bearnedSql\b/);
    expect(curve).toMatch(/\bplannedAsOfSql\b/);
    expect(curve).toMatch(/\bearnedFromClaimLineSql\b/);

    // Private re-declarations deleted.
    expect(rollups).not.toMatch(/\bconst cbTotalSql\b/);
    expect(rollups).not.toMatch(/\bconst earnedSql\b/);
    expect(rollups).not.toMatch(/\bfunction plannedAsOfSql\b/);
    expect(curve).not.toMatch(/\bconst cbTotalSql\b/);
    expect(curve).not.toMatch(/\bconst earnedSql\b/);
    expect(curve).not.toMatch(/\bfunction plannedAsOfSql\b/);
    expect(rollups).not.toMatch(/claimedInstalledQtyMilli/);
    expect(curve).not.toMatch(/claimedInstalledQtyMilli/);

    // Repo-wide: only cost-rollup-exprs may pair EV units + least( (D11).
    const offenders: string[] = [];
    for (const file of listSrcTs(srcRoot)) {
      const rel = file.slice(srcRoot.length + 1);
      if (rel === "server/cost-rollup-exprs.ts") continue;
      const code = stripComments(readFileSync(file, "utf8"));
      const hasUnitsEv =
        /evMethod\s*[=!]=\s*['"]units['"]/.test(code) ||
        /ev_method/.test(code);
      if (hasUnitsEv && countCalls(code, "least") > 0) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  it("must-fail: D11 — half-cent percent EV rounds (shared CASE uses round)", () => {
    // 10001 × 500‰ = 5000.5¢ → round → 5001; floor would stay GREEN at 5000.
    expect(
      earnedCentsOf({
        evMethod: "pm_percent",
        budgetQtyMilli: 0,
        budgetCents: HALF_CENT_BUDGET,
        claimedInstalledQtyMilli: 0,
        claimedPercentMilli: 500,
      }),
    ).toBe(HALF_CENT_EV);
    expect(
      earnedCentsOf({
        evMethod: "units",
        budgetQtyMilli: 2_000,
        budgetCents: HALF_CENT_BUDGET,
        claimedInstalledQtyMilli: 1_000,
        claimedPercentMilli: 0,
      }),
    ).toBe(HALF_CENT_EV);
    const exprs = readFileSync(join(here, "cost-rollup-exprs.ts"), "utf8");
    expect(exprs).toMatch(/else\s+round\s*\(/i);
    expect(exprs).not.toMatch(/\bfloor\s*\(/);
    expect(exprs).not.toMatch(/\btrunc\s*\(/);
  });

  /**
   * Behavior lock for D11: a lone half-cent leaf with two locks. Days on/after
   * the first lock use claim-line EV; the cutoff day uses tile EV. Both must
   * equal 5001 (round), matching jobRollupSql — a private floor/CASE copy in
   * curve.ts or a drifted claim-line path goes RED.
   */
  it("must-fail: D11 — cutoff + claim-line EV match tiles on half-cent leaves", async () => {
    for (const variant of ["pm_percent", "units"] as const) {
      const companyId = crypto.randomUUID();
      const jobId = crypto.randomUUID();
      const itemId = crypto.randomUUID();
      const userId = crypto.randomUUID();
      const claim1 = crypto.randomUUID();
      const claim2 = crypto.randomUUID();
      created.push(companyId);
      const lock1At = new Date("2026-10-10T17:00:00.000Z");
      const lock2At = new Date("2026-10-20T17:00:00.000Z");
      const isUnits = variant === "units";

      await db().insert(companies).values({
        id: companyId,
        name: `Half-cent ${variant}`,
        isSandbox: true,
        seededAt: lock2At,
      });
      await db().insert(users).values({
        id: userId,
        companyId,
        name: "PM",
        title: "Project Manager",
        role: "pm",
      });
      await db().insert(jobs).values({
        id: jobId,
        companyId,
        number: `99-HC-${variant === "units" ? "U" : "P"}`,
        name: "Half-cent EV",
        shortName: "Half-cent",
        owner: "Test",
        pmName: "PM",
        finishOn: "2026-10-30",
        contractCents: HALF_CENT_BUDGET,
        estimateStatus: "approved",
      });
      await db().insert(costItems).values({
        id: itemId,
        companyId,
        jobId,
        path: "/HC/",
        depth: 0,
        isLeaf: true,
        code: "HC-1",
        description: "Half-cent leaf",
        unit: isUnits ? "CY" : "LS",
        evMethod: variant,
        budgetQtyMilli: isUnits ? 2_000 : 0,
        installedQtyMilli: isUnits ? 1_000 : 0,
        claimedInstalledQtyMilli: isUnits ? 1_000 : 0,
        claimedPercentMilli: isUnits ? 0 : 500,
        cbLaborCents: HALF_CENT_BUDGET,
        obLaborCents: HALF_CENT_BUDGET,
        ceLaborCents: HALF_CENT_BUDGET,
        plannedStartOn: "2026-10-01",
        plannedFinishOn: "2026-10-30",
        plannedCents: HALF_CENT_BUDGET,
        actualCents: 0,
        lockedActualCents: 0,
        earnDerivation: "half-cent fixture",
        budgetMhPerUnitMilli: 0,
      });
      for (const [claimId, lockedAt, label] of [
        [claim1, lock1At, "P1"],
        [claim2, lock2At, "P2"],
      ] as const) {
        await db().insert(progressClaims).values({
          id: claimId,
          companyId,
          jobId,
          periodLabel: label,
          status: "locked",
          lockedAt,
          lockedById: userId,
        });
        await db().insert(progressClaimLines).values({
          id: crypto.randomUUID(),
          companyId,
          claimId,
          costItemId: itemId,
          claimedPercentMilli: isUnits ? 0 : 500,
          installedQtyMilli: isUnits ? 1_000 : 0,
          derivation: "half-cent fixture",
        });
      }

      const [curve, roll] = await Promise.all([
        jobCurve(companyId, jobId),
        jobRollupSql(companyId, jobId, lock2At),
      ]);
      expect(curve?.cutoffOn, variant).toBe("2026-10-20");
      expect(roll.earnedCents, `${variant} tile`).toBe(HALF_CENT_EV);
      const atCutoff = pointOn(curve!.points, "2026-10-20");
      expect(atCutoff.earnedCents, `${variant} cutoff`).toBe(HALF_CENT_EV);
      expect(atCutoff.earnedCents, `${variant} cutoff=tile`).toBe(
        roll.earnedCents,
      );
      // Claim-line path (lock 1 → days before cutoff): must also be round(5000.5).
      const atLock1 = pointOn(curve!.points, "2026-10-10");
      expect(atLock1.earnedCents, `${variant} lock1`).toBe(HALF_CENT_EV);
      const mid = pointOn(curve!.points, "2026-10-15");
      expect(mid.earnedCents, `${variant} mid`).toBe(HALF_CENT_EV);
      // Before the first lock: no EV yet.
      const before = pointOn(curve!.points, "2026-10-05");
      expect(before.earnedCents, `${variant} before`).toBeNull();
    }
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

  /**
   * Query-budget must-fail on a one-leaf company (not the full demo sandbox).
   * Runs before the 10k stress insert so pool/IO contention cannot flake a
   * 40 ms call into the default 5 s vitest timeout.
   */
  it("must-fail: portfolioCurve stays within a fixed query budget", async () => {
    const tinyId = crypto.randomUUID();
    const tinyJob = crypto.randomUUID();
    const tinyItem = crypto.randomUUID();
    const tinyUser = crypto.randomUUID();
    const tinyClaim = crypto.randomUUID();
    created.push(tinyId);
    const lockedAt = new Date("2026-10-20T17:00:00.000Z");
    await db().insert(companies).values({
      id: tinyId,
      name: "Portfolio budget tiny",
      isSandbox: true,
      seededAt: lockedAt,
    });
    await db().insert(users).values({
      id: tinyUser,
      companyId: tinyId,
      name: "PM",
      title: "PM",
      role: "pm",
    });
    await db().insert(jobs).values({
      id: tinyJob,
      companyId: tinyId,
      number: "99-QB",
      name: "Budget",
      shortName: "Budget",
      owner: "Test",
      pmName: "PM",
      finishOn: "2026-10-25",
      contractCents: 100,
      estimateStatus: "approved",
    });
    await db().insert(costItems).values({
      id: tinyItem,
      companyId: tinyId,
      jobId: tinyJob,
      path: "/QB/",
      depth: 0,
      isLeaf: true,
      code: "QB-1",
      description: "Tiny",
      unit: "LS",
      evMethod: "pm_percent",
      budgetQtyMilli: 0,
      installedQtyMilli: 0,
      claimedInstalledQtyMilli: 0,
      claimedPercentMilli: 500,
      cbLaborCents: 100,
      obLaborCents: 100,
      ceLaborCents: 100,
      plannedStartOn: "2026-10-18",
      plannedFinishOn: "2026-10-22",
      plannedCents: 100,
      actualCents: 0,
      lockedActualCents: 0,
      earnDerivation: "qb",
      budgetMhPerUnitMilli: 0,
    });
    await db().insert(progressClaims).values({
      id: tinyClaim,
      companyId: tinyId,
      jobId: tinyJob,
      periodLabel: "P1",
      status: "locked",
      lockedAt,
      lockedById: tinyUser,
    });
    await db().insert(progressClaimLines).values({
      id: crypto.randomUUID(),
      companyId: tinyId,
      claimId: tinyClaim,
      costItemId: tinyItem,
      claimedPercentMilli: 500,
      installedQtyMilli: 0,
      derivation: "qb",
    });

    // Warm connection + plan cache; measure only the second call.
    await portfolioCurve(tinyId);
    resetDbQueryCount();
    const t0 = performance.now();
    await portfolioCurve(tinyId);
    const ms = performance.now() - t0;
    expect(getDbQueryCount()).toBeLessThanOrEqual(PORTFOLIO_CURVE_QUERY_BUDGET);
    expect(PORTFOLIO_CURVE_QUERY_BUDGET).toBe(1);
    // Tight wall bound on the tiny fixture — flags regressions without a 5s hang.
    expect(ms).toBeLessThan(1_500);
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
