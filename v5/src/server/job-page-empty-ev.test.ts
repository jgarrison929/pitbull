/**
 * Job page: hide "Field measurement methods" when there is nothing to enter.
 * EvMethodControls returns null for empty lists — the Section must not render
 * as a title-only shell (trust-bar empty section).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Job } from "@/app/app/jobs/[number]/page";
import { getDb } from "@/db";
import { companies } from "@/db/schema";
import { seedId } from "@/seed";
import { getJobEvControls, getJob } from "@/server/data";
import { createSandbox } from "@/server/sandbox";
import type { CurrentUser } from "@/server/session";

const db = getDb();
const PINNED = "2026-10-20T17:00:00.000Z";

describe.skipIf(!db)("job page empty Field measurement methods", () => {
  const created: string[] = [];
  const prevSeed = process.env.V5_SEED_NOW;
  let companyId = "";
  let pm!: CurrentUser;

  beforeAll(async () => {
    process.env.V5_SEED_NOW = PINNED;
    const seedAt = new Date(PINNED);
    companyId = await createSandbox(seedAt);
    created.push(companyId);
    pm = {
      companyId,
      userId: seedId(companyId, "user:pm"),
      role: "pm",
      name: "Marcus Lee",
      title: "Project Manager",
      companyName: "Demo",
      seededAt: seedAt,
      expiresAt: null,
    };
  }, 120_000);

  afterAll(async () => {
    if (prevSeed === undefined) delete process.env.V5_SEED_NOW;
    else process.env.V5_SEED_NOW = prevSeed;
    for (const id of created) {
      await db!.delete(companies).where(eq(companies.id, id));
    }
  }, 120_000);

  it("Harbor (no pm_percent / milestones) omits the section for PM", async () => {
    const harbor = await getJob(companyId, "26-010");
    expect(harbor).toBeTruthy();
    const controls = await getJobEvControls(companyId, harbor!.job.id);
    expect(controls.milestones).toHaveLength(0);
    expect(controls.pmItems).toHaveLength(0);

    const html = renderToStaticMarkup(
      await Job({
        params: Promise.resolve({ number: "26-010" }),
        user: pm,
      }),
    );
    expect(html).not.toContain("Field measurement methods");
    expect(html).not.toContain('data-testid="ev-method-controls"');
  });
});
