/**
 * Live typed-action history path (kept for parity tests / docs).
 *
 * createSandbox / resetSandbox no longer call this — they insert the baked
 * post-history state from finalizeSeedWithHistory in one pipelined transaction.
 * SEED_*_RUNS counts stay the source of truth for e2e / rail assertions.
 */
import "server-only";
import { SHB_CSV } from "@/lib/budget";
import { run } from "@/server/assistant/actions";
import { runWithSeedClock, seedNow } from "@/server/seed-clock";
import type { CurrentUser } from "@/server/session";
import { SEED_COMPANY_NAME, seedId, seedUsers } from "./index";

/** Every demo job number (must match jobs created in seed/index). */
export const SEED_JOB_NUMBERS = [
  "24-118",
  "25-031",
  "24-077",
  "26-010",
] as const;

/**
 * Approved jobs that get Period 1 locked. Harbor (26-010) stays a draft
 * estimate with an unlocked claim so M2 CSV import can still run.
 */
const SEED_LOCK_JOB_NUMBERS = ["24-118", "25-031", "24-077"] as const;

function asUser(
  companyId: string,
  key: (typeof seedUsers)[number]["key"],
  now: Date,
): CurrentUser {
  const u = seedUsers.find((x) => x.key === key)!;
  return {
    userId: seedId(companyId, `user:${key}`),
    companyId,
    name: u.name,
    title: u.title,
    role: u.role,
    companyName: SEED_COMPANY_NAME,
    seededAt: now,
    expiresAt: null,
  };
}

/**
 * How many action_runs seedActionHistory writes (all roles). Keep e2e /
 * sandbox.test SEED_*_RUNS in sync when this changes.
 *
 * Breakdown: foreman note + I-5 report (2); superintendent issue/return/show/
 * variance/COs (5); PM Harbor import + COs + locks (15); executive reject/
 * approve (2) → 24.
 */
export const SEED_HISTORY_RUNS = 24;
/** Foreman: Cedar plan note + I-5 dailyReport.post. */
export const SEED_FOREMAN_RUNS = 2;
/** Superintendent: issue + return on I-5, then show/variance/COs on Cedar. */
export const SEED_SUPERINTENDENT_RUNS = 5;
/** PM: Harbor import + CO creates/prices/void + Period 1 locks × 3. */
export const SEED_PM_RUNS = 15;

/**
 * Runs the same typed actions the UI and assistant use. Call after insertWork
 * (and outside any advisory-lock transaction that held the insert).
 *
 * Change orders land before the period locks so the newest job-changes row on
 * every locked job stays the Period 1 lock. Cedar (25-031) keeps a single
 * priced CO so the phone job screenshot stays stable; mixed states live on
 * the other two approved jobs. Harbor (26-010) stays a draft estimate — history
 * is a real estimate.importCsv of the SHB file (no-op revise; claim stays
 * unlocked so a later M2 import still writes).
 *
 * Superintendent rail: real issue → report → return on I-5's seeded plan
 * (before locks), plus show/variance/CO reads on Cedar that quote seeded
 * plan MH and the priced CO-001 dollars — never invented KPIs.
 *
 * `now` is the seed calendar (sandbox seedAt / V5_SEED_NOW). Period locks and
 * other EV writes run under runWithSeedClock so lockedAt is never wall clock.
 */
export async function seedActionHistory(companyId: string, now = seedNow()) {
  return runWithSeedClock(now, async () => {
    const foreman = asUser(companyId, "foreman", now);
    const pm = asUser(companyId, "pm", now);
    const executive = asUser(companyId, "executive", now);
    const superintendent = asUser(companyId, "superintendent", now);

    // Plan edit on Cedar's draft — note only, so man-hours/qty stay at seed values
    // that e2e asserts (60 MH / 42 CY on pier columns / 04-210).
    await run(
      foreman,
      "Add a note on pier columns: forms checked, ready for concrete",
      "dailyPlan.updateLine",
      {
        job: "25-031",
        lineId: seedId(companyId, "plan-line:cedar:0"),
        change: { notes: "Forms checked — ready for concrete." },
      },
    );

    // Harbor draft estimate: real import path (no progressClaim.lock — import
    // refuses locked claims). SHB matches the seed, so CE is unchanged.
    await run(
      pm,
      "Import the estimate CSV for Harbor Abutment",
      "estimate.importCsv",
      { job: "26-010", csv: SHB_CSV },
    );

    // —— Change orders (6), mixed states, before locks ——

    // 25-031 CO-001 priced (pending) — verify e2e target; only CO on this job.
    await run(
      pm,
      "Raise a change order on 25-031: Owner-added retaining wall, north approach",
      "changeOrder.create",
      {
        job: "25-031",
        title: "Owner-added retaining wall, north approach",
        reason: "County directive CD-07",
      },
    );
    await run(
      pm,
      "Price CO-001 on 25-031: new 91-100 Retaining wall LS labor 18,500 material 23,250 equipment 6,100 sub 12,150",
      "changeOrder.price",
      {
        job: "25-031",
        changeOrder: "CO-001",
        coLines: [
          {
            code: "91-100",
            description: "Retaining wall, north approach",
            unit: "LS",
            qty: "1",
            labor: "18,500",
            material: "23,250",
            equipment: "6,100",
            sub: "12,150",
          },
        ],
      },
    );

    // 24-118 CO-001 draft
    await run(
      pm,
      "Raise a change order on 24-118: Temp access road grading",
      "changeOrder.create",
      {
        job: "24-118",
        title: "Temp access road grading",
        reason: "Owner asked for a haul route around the abutment",
      },
    );

    // 24-118 CO-002 priced then rejected
    await run(
      pm,
      "Raise a change order on 24-118: Abutment formwork revise",
      "changeOrder.create",
      {
        job: "24-118",
        title: "Abutment formwork revise",
        reason: "Shop drawing conflict SF-14",
      },
    );
    await run(
      pm,
      "Price CO-002 on 24-118: new 91-210 Formwork revise LS labor 4,200 material 1,800",
      "changeOrder.price",
      {
        job: "24-118",
        changeOrder: "CO-002",
        coLines: [
          {
            code: "91-210",
            description: "Formwork revise, west wing",
            unit: "LS",
            qty: "1",
            labor: "4,200",
            material: "1,800",
            equipment: "0",
            sub: "0",
          },
        ],
      },
    );
    await run(
      executive,
      "Reject CO-002 on 24-118 because Owner declined the formwork change",
      "changeOrder.reject",
      {
        job: "24-118",
        changeOrder: "CO-002",
        reason: "Owner declined the formwork change",
      },
    );

    // 24-118 CO-003 priced then approved (new leaf; CB/EAC move on this job only)
    await run(
      pm,
      "Raise a change order on 24-118: Temp cofferdam at pier 2",
      "changeOrder.create",
      {
        job: "24-118",
        title: "Temp cofferdam at pier 2",
        reason: "River rose; need a temporary cofferdam",
      },
    );
    await run(
      pm,
      "Price CO-003 on 24-118: new 91-300 Temp cofferdam LS labor 8,000 material 12,500 equipment 3,500",
      "changeOrder.price",
      {
        job: "24-118",
        changeOrder: "CO-003",
        coLines: [
          {
            code: "91-300",
            description: "Temp cofferdam at pier 2",
            unit: "LS",
            qty: "1",
            labor: "8,000",
            material: "12,500",
            equipment: "3,500",
            sub: "0",
          },
        ],
      },
    );
    await run(
      executive,
      "Approve CO-003 on 24-118",
      "changeOrder.approve",
      { job: "24-118", changeOrder: "CO-003" },
    );

    // 24-077 CO-001 draft then voided
    await run(
      pm,
      "Raise a change order on 24-077: Duplicate field note pile tip",
      "changeOrder.create",
      {
        job: "24-077",
        title: "Duplicate field note pile tip",
        reason: "Opened by mistake — same as yesterday's note",
      },
    );
    await run(
      pm,
      "Void CO-001 on 24-077 because Duplicate of the field note",
      "changeOrder.void",
      {
        job: "24-077",
        changeOrder: "CO-001",
        reason: "Duplicate of the field note",
      },
    );

    // 24-077 CO-002 priced (pending)
    await run(
      pm,
      "Raise a change order on 24-077: Guardrail extension east approach",
      "changeOrder.create",
      {
        job: "24-077",
        title: "Guardrail extension east approach",
        reason: "Owner added 120 LF of guardrail",
      },
    );
    await run(
      pm,
      "Price CO-002 on 24-077: new 91-400 Guardrail extension LS labor 2,200 material 6,800 sub 1,500",
      "changeOrder.price",
      {
        job: "24-077",
        changeOrder: "CO-002",
        coLines: [
          {
            code: "91-400",
            description: "Guardrail extension east approach",
            unit: "LS",
            qty: "1",
            labor: "2,200",
            material: "6,800",
            equipment: "0",
            sub: "1,500",
          },
        ],
      },
    );

    // —— Superintendent field cycle on I-5 (before locks so Period 1 stays newest) ——
    // Plan lines: 40 + 50 + 20 = 110 MH from seed/index (Culvert Crew A).
    const i5PlanId = seedId(companyId, "plan:i5:today");
    await run(
      superintendent,
      "Issue Culvert Crew A's plan on I-5 Culverts",
      "dailyPlan.submit",
      { job: "24-077", planId: i5PlanId },
    );
    // Report with actuals that trace to the seeded plan lines (MH/qty on those codes).
    await run(
      foreman,
      "Report day's work on 24-077: trench 175 CY at 42 MH, RCP 48 LF at 50 MH, basins 2 EA at 18 MH",
      "dailyReport.post",
      {
        job: "24-077",
        planId: i5PlanId,
        actuals: [
          {
            lineId: seedId(companyId, "plan-line:i5:0"),
            manHours: 42,
            qty: 175,
          },
          {
            lineId: seedId(companyId, "plan-line:i5:1"),
            manHours: 50,
            qty: 48,
          },
          {
            lineId: seedId(companyId, "plan-line:i5:2"),
            manHours: 18,
            qty: 2,
          },
        ],
      },
    );
    await run(
      superintendent,
      "Return the report for 24-077 because Catch basin invert elevations don't match the mark-out",
      "dailyPlan.return",
      {
        job: "24-077",
        planId: i5PlanId,
        reason: "Catch basin invert elevations don't match the mark-out",
      },
    );

    // Reads for the superintendent rail — summaries quote seeded plan / cost / CO rows.
    await run(
      superintendent,
      "Show tomorrow's plan for Cedar Creek",
      "dailyPlan.show",
      { job: "25-031", planId: seedId(companyId, "plan:cedar:tomorrow") },
    );
    await run(
      superintendent,
      "Why is Cedar Creek over budget?",
      "job.costVariance",
      { job: "25-031" },
    );
    await run(
      superintendent,
      "Show change orders on Cedar Creek",
      "changeOrder.show",
      { job: "25-031" },
    );

    // Period locks for approved jobs only. Harbor stays unlocked so M2 import
    // onto the draft estimate still writes.
    for (const job of SEED_LOCK_JOB_NUMBERS) {
      await run(pm, `Lock Period 1 on job ${job}`, "progressClaim.lock", {
        job,
      });
    }
  });
}
