// After the pure seed rows are inserted, run real typed actions so every job's
// change list is populated from action_runs — never by inserting fake audit rows.
import "server-only";
import { run } from "@/server/assistant/actions";
import type { CurrentUser } from "@/server/session";
import { SEED_COMPANY_NAME, seedId, seedUsers } from "./index";

/** Job numbers the demo seed creates (must match jobSpecs in seed/index). */
export const SEED_JOB_NUMBERS = ["24-118", "25-031", "24-077"] as const;

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
 * Runs the same typed actions the UI and assistant use. Call after insertWork
 * (and outside any advisory-lock transaction that held the insert).
 *
 * Change orders land before the period locks so the newest job-changes row on
 * every seeded job stays the Period 1 lock. Cedar (25-031) keeps a single
 * priced CO so the phone job screenshot stays stable; mixed states live on
 * the other two jobs.
 */
export async function seedActionHistory(companyId: string, now = new Date()) {
  const foreman = asUser(companyId, "foreman", now);
  const pm = asUser(companyId, "pm", now);
  const executive = asUser(companyId, "executive", now);

  // Plan edit on Cedar's draft — note only, so man-hours/qty stay at seed values
  // that e2e asserts (60 MH / 42 CY on the pour).
  await run(
    foreman,
    "Add a note on the pour: forms checked, ready for concrete",
    "dailyPlan.updateLine",
    {
      job: "25-031",
      lineId: seedId(companyId, "plan-line:cedar:0"),
      change: { notes: "Forms checked — ready for concrete." },
    },
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

  // Period locks for every seeded job. Period 1 is a draft in seed rows; locking
  // writes a real action_runs row with who / when / what.
  for (const job of SEED_JOB_NUMBERS) {
    await run(pm, `Lock Period 1 on job ${job}`, "progressClaim.lock", {
      job,
    });
  }
}
