/**
 * Page-level output: real Job page server-render at weekday evening after UTC midnight.
 * Kills every M8t-page spelling (slice, split, toJSON, Intl UTC) — not source regex.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Job } from "@/app/app/jobs/[number]/page";
import { getDb } from "@/db";
import { companies } from "@/db/schema";
import { seedId } from "@/seed";
import { createSandbox } from "@/server/sandbox";
import type { CurrentUser } from "@/server/session";

const db = getDb();

/** Weekday evening PT → Tue 00:30Z; LA today = 2026-10-26, UTC day = 2026-10-27. */
const PINNED = "2026-10-27T00:30:00.000Z";
const LA_TODAY = "2026-10-26";
const UTC_DAY = "2026-10-27";

describe.skipIf(!db)("job page output (M8t-page)", () => {
  const created: string[] = [];
  const prevSeed = process.env.V5_SEED_NOW;
  let companyId = "";
  let superintendent!: CurrentUser;

  beforeAll(async () => {
    process.env.V5_SEED_NOW = PINNED;
    const seedAt = new Date(PINNED);
    companyId = await createSandbox(seedAt);
    created.push(companyId);
    superintendent = {
      userId: seedId(companyId, "user:superintendent"),
      companyId,
      name: "Ray Dominguez",
      title: "Superintendent",
      role: "superintendent",
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

  it("M8t-page: /app/jobs/24-077 New plan default + I-5 open at 00:30Z", async () => {
    const element = await Job({
      params: Promise.resolve({ number: "24-077" }),
      user: superintendent,
    });
    const html = renderToStaticMarkup(element);

    // New plan default must be LA-today (closed button exposes data-default-date).
    expect(html).toContain('data-testid="new-plan"');
    expect(html).toContain(`data-default-date="${LA_TODAY}"`);
    expect(html).not.toContain(`data-default-date="${UTC_DAY}"`);

    const i5Id = seedId(companyId, "plan:i5:today");
    // I-5 LA-today plan is an open plan-card, not a history row.
    expect(html).toMatch(
      new RegExp(
        `data-testid="plan-card"[^>]*data-plan-id="${i5Id}"|data-plan-id="${i5Id}"[^>]*data-testid="plan-card"`,
      ),
    );
    expect(html).toMatch(
      new RegExp(
        `data-testid="plan-card"[^>]*data-plan-date="${LA_TODAY}"|data-plan-date="${LA_TODAY}"[^>]*data-testid="plan-card"`,
      ),
    );
    expect(html).not.toMatch(
      new RegExp(
        `data-testid="plan-history-row"[^>]*data-plan-id="${i5Id}"|data-plan-id="${i5Id}"[^>]*data-testid="plan-history-row"`,
      ),
    );
  });
});
