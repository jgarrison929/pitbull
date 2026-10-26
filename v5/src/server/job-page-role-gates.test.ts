/**
 * M5: job page role gates skip lock / EV / crew queries for capture roles.
 * Spies on the real page load — not a hand-rolled loader that always calls them.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Job } from "@/app/app/jobs/[number]/page";
import { getDb } from "@/db";
import { companies } from "@/db/schema";
import { seedId } from "@/seed";
import * as data from "@/server/data";
import * as plans from "@/server/plans";
import * as progress from "@/server/progress";
import { createSandbox } from "@/server/sandbox";
import type { CurrentUser } from "@/server/session";

const db = getDb();
const JOB = "25-031";

describe.skipIf(!db)("job page role gates (M5)", () => {
  const created: string[] = [];
  const prevSeed = process.env.V5_SEED_NOW;
  let companyId = "";
  let foreman!: CurrentUser;
  let pm!: CurrentUser;
  let superintendent!: CurrentUser;

  beforeAll(async () => {
    process.env.V5_SEED_NOW = "2026-10-20T17:00:00.000Z";
    const seedAt = new Date(process.env.V5_SEED_NOW);
    companyId = await createSandbox(seedAt);
    created.push(companyId);
    foreman = {
      userId: seedId(companyId, "user:foreman"),
      companyId,
      name: "Luis Ortega",
      title: "Foreman, Bridge Crew 2",
      role: "foreman",
      companyName: "Demo",
      seededAt: seedAt,
      expiresAt: null,
    };
    pm = {
      userId: seedId(companyId, "user:pm"),
      companyId,
      name: "Marcus Lee",
      title: "Project Manager",
      role: "pm",
      companyName: "Demo",
      seededAt: seedAt,
      expiresAt: null,
    };
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

  async function renderAs(user: CurrentUser) {
    const draftSpy = vi.spyOn(progress, "draftClaimForJob");
    const evSpy = vi.spyOn(data, "getJobEvControls");
    const crewsSpy = vi.spyOn(plans, "listCrews");
    try {
      const element = await Job({
        params: Promise.resolve({ number: JOB }),
        user,
      });
      renderToStaticMarkup(element);
      return {
        draftCalls: draftSpy.mock.calls.length,
        evCalls: evSpy.mock.calls.length,
        crewsCalls: crewsSpy.mock.calls.length,
      };
    } finally {
      draftSpy.mockRestore();
      evSpy.mockRestore();
      crewsSpy.mockRestore();
    }
  }

  it("M5: foreman job page does not call draftClaim / EV / listCrews", async () => {
    const calls = await renderAs(foreman);
    expect(calls.draftCalls).toBe(0);
    expect(calls.evCalls).toBe(0);
    expect(calls.crewsCalls).toBe(0);
  });

  it("M5: PM job page runs draftClaim and getJobEvControls", async () => {
    const calls = await renderAs(pm);
    expect(calls.draftCalls).toBeGreaterThan(0);
    expect(calls.evCalls).toBeGreaterThan(0);
    // dailyPlan.create is superintendent-only — crews stay gated off for PM.
    expect(calls.crewsCalls).toBe(0);
  });

  it("M5: superintendent job page runs listCrews (create-plan gate)", async () => {
    const calls = await renderAs(superintendent);
    expect(calls.crewsCalls).toBeGreaterThan(0);
    expect(calls.evCalls).toBeGreaterThan(0);
  });
});
