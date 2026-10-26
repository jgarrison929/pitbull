/**
 * Job page plan surface + New-plan slot output at weekday evening after UTC midnight.
 * Kills M8d (UTC-day `now` into the split) and M8t (UTC New-plan default).
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { JobNewPlanSlot } from "@/components/app/job-new-plan-slot";
import { getDb } from "@/db";
import { companies } from "@/db/schema";
import { seedId } from "@/seed";
import { getJob, getPlansForJob } from "@/server/data";
import { jobPagePlanSurface } from "@/server/job-page-plans";
import { createSandbox } from "@/server/sandbox";

const db = getDb();

/** Weekday evening PT → Tue 00:30Z; LA today = 2026-10-26, UTC day = 2026-10-27. */
const PINNED = "2026-10-27T00:30:00.000Z";
const LA_TODAY = "2026-10-26";
const UTC_DAY = "2026-10-27";

describe.skipIf(!db)("job page plan surface (M8d / M8t)", () => {
  const created: string[] = [];
  const prevSeed = process.env.V5_SEED_NOW;
  let companyId = "";

  beforeAll(async () => {
    process.env.V5_SEED_NOW = PINNED;
    companyId = await createSandbox(new Date(PINNED));
    created.push(companyId);
  }, 120_000);

  afterAll(async () => {
    if (prevSeed === undefined) delete process.env.V5_SEED_NOW;
    else process.env.V5_SEED_NOW = prevSeed;
    for (const id of created) {
      await db!.delete(companies).where(eq(companies.id, id));
    }
  }, 120_000);

  it("M8d/M8t: /app/jobs/24-077 open list + New plan default at 00:30Z", async () => {
    const p = await getJob(companyId, "24-077");
    expect(p).toBeTruthy();
    const plans = await getPlansForJob(companyId, p!.job.id);
    const i5Id = seedId(companyId, "plan:i5:today");
    const i5 = plans.find((pl) => pl.id === i5Id);
    expect(i5).toBeTruthy();
    expect(i5!.planDate).toBe(LA_TODAY);

    const surface = jobPagePlanSurface(plans);
    expect(surface.today).toBe(LA_TODAY);
    expect(surface.today).not.toBe(UTC_DAY);
    expect(surface.open.some((pl) => pl.id === i5Id)).toBe(true);
    expect(surface.history.some((pl) => pl.id === i5Id)).toBe(false);

    // Page output: same slot the job page mounts (date derived inside, not a prop).
    const html = renderToStaticMarkup(
      createElement(JobNewPlanSlot, {
        jobNumber: "24-077",
        crews: [{ id: "crew", name: "Crew" }],
        plans,
      }),
    );
    expect(html).toContain(`data-default-date="${LA_TODAY}"`);
    expect(html).not.toContain(`data-default-date="${UTC_DAY}"`);
    expect(html).toContain('data-testid="new-plan"');

    // Open/history cards the page emits from the same surface.
    const cards = renderToStaticMarkup(
      createElement(
        "div",
        null,
        ...surface.open.map((pl) =>
          createElement("section", {
            key: pl.id,
            "data-testid": "plan-card",
            "data-plan-date": pl.planDate,
            "data-plan-id": pl.id,
          }),
        ),
        ...surface.history.map((pl) =>
          createElement("li", {
            key: pl.id,
            "data-testid": "plan-history-row",
            "data-plan-date": pl.planDate,
            "data-plan-id": pl.id,
          }),
        ),
      ),
    );
    expect(cards).toMatch(
      new RegExp(
        `data-testid="plan-card"[^>]*data-plan-id="${i5Id}"|data-plan-id="${i5Id}"[^>]*data-testid="plan-card"`,
      ),
    );
    expect(cards).not.toMatch(
      new RegExp(
        `data-testid="plan-history-row"[^>]*data-plan-id="${i5Id}"|data-plan-id="${i5Id}"[^>]*data-testid="plan-history-row"`,
      ),
    );
  });
});
