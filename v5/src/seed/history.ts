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
 */
export async function seedActionHistory(companyId: string, now = new Date()) {
  const foreman = asUser(companyId, "foreman", now);
  const pm = asUser(companyId, "pm", now);

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

  // Period locks for every seeded job. Period 1 is a draft in seed rows; locking
  // writes a real action_runs row with who / when / what.
  for (const job of SEED_JOB_NUMBERS) {
    await run(pm, `Lock Period 1 on job ${job}`, "progressClaim.lock", {
      job,
    });
  }
}
