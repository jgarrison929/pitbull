/**
 * Part E: unknownJob() through run() — live portfolio choices, no create.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { companies, jobs } from "@/db/schema";
import { run } from "@/server/assistant/actions";
import { createSandbox } from "@/server/sandbox";
import type { CurrentUser } from "@/server/session";
import { seedId } from "@/seed";

const db = getDb();

describe.skipIf(!db)("Part E unknownJob via run()", () => {
  const created: string[] = [];
  let superintendent!: CurrentUser;

  beforeAll(async () => {
    const companyId = await createSandbox();
    created.push(companyId);
    superintendent = {
      userId: seedId(companyId, "user:superintendent"),
      companyId,
      name: "Ray Dominguez",
      title: "Superintendent",
      role: "superintendent",
      companyName: "Demo",
      seededAt: new Date("2026-10-20T17:00:00.000Z"),
      expiresAt: null,
    };
  }, 120_000);

  afterAll(async () => {
    for (const id of created) {
      await db!.delete(companies).where(eq(companies.id, id));
    }
  }, 120_000);

  it("acceptance: refuses 99-999 with three approved choices, never 26-010", async () => {
    const r = await run(
      superintendent,
      "Plan today on 99-999 for Bridge Crew 2",
      "dailyPlan.create",
      { job: "99-999", crew: "Bridge Crew 2", date: "today" },
    );
    expect(r.result.refused).toBe(true);
    expect(r.result.summary).toBe(
      "There is no job 99-999. Try 24-077, 24-118, or 25-031",
    );
    expect(r.result.summary).not.toContain("26-010");
    expect(r.summary).toBe(r.result.summary);

    const forged = await db!
      .select({ number: jobs.number })
      .from(jobs)
      .where(eq(jobs.companyId, superintendent.companyId));
    expect(forged.map((j) => j.number)).not.toContain("99-999");
  });

  it("must-fail: old wording still would not match live refusal", async () => {
    const r = await run(
      superintendent,
      "Submit the plan for 99-999",
      "dailyPlan.submit",
      { job: "99-999" },
    );
    expect(r.result.summary).not.toContain("in this sandbox");
    expect(r.result.summary).not.toContain("Jobs here");
  });
});
