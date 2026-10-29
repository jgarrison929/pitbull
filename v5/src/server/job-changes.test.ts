import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { actionRuns, companies, users } from "@/db/schema";
import { actions, WRITES } from "@/server/assistant/actions";
import { createSandbox } from "@/server/sandbox";
import {
  jobChanges,
  jobChangesCount,
  WRITE_ACTIONS,
} from "@/server/job-changes";

describe("job change feed WRITE_ACTIONS", () => {
  it("must match actions with writes: true (cannot drift from the table)", () => {
    const derived = (Object.keys(actions) as (keyof typeof actions)[])
      .filter((name) => actions[name].writes)
      .slice()
      .sort();
    expect([...WRITE_ACTIONS].sort()).toEqual(derived);
    expect([...WRITES].sort()).toEqual(derived);
  });
});

describe("job change feed is bounded", () => {
  it("pages in SQL and the changes screen does not load the whole feed", () => {
    const query = readFileSync(new URL("./job-changes.ts", import.meta.url), "utf8");
    const page = readFileSync(
      new URL("../app/app/jobs/[number]/changes/page.tsx", import.meta.url),
      "utf8",
    );
    expect(query).toMatch(/limit \$\{take\}/);
    expect(query).toMatch(/offset \$\{skip\}/);
    expect(query).not.toMatch(/\.slice\(offset/);
    expect(page).not.toMatch(/10_000/);
    expect(page).toMatch(/jobChangesCount/);
    expect(page).toMatch(/PAGE_SIZE/);
  });
});

const db = getDb();

describe.skipIf(!db)("job change feed SQL page", () => {
  const created: string[] = [];
  afterAll(async () => {
    for (const id of created) {
      await db!.delete(companies).where(eq(companies.id, id));
    }
  });

  it("limits the page and collapses a same plan+day re-report", async () => {
    const companyId = await createSandbox();
    created.push(companyId);
    const [user] = await db!
      .select({ id: users.id })
      .from(users)
      .where(eq(users.companyId, companyId))
      .limit(1);
    expect(user).toBeTruthy();
    const before = await jobChangesCount(companyId, "25-031");
    const planId = "00000000-0000-4000-8000-0000000000aa";
    await db!.insert(actionRuns).values([
      {
        companyId,
        userId: user!.id,
        prompt: "first post",
        action: "dailyReport.post",
        args: { job: "25-031", planId, requested: "25-031" },
        summary: "Reported quantities for Mon, Oct 1:",
        createdAt: new Date("2026-10-01T12:00:00.000Z"),
      },
      {
        companyId,
        userId: user!.id,
        prompt: "second post",
        action: "dailyReport.post",
        args: { job: "25-031", planId, requested: "25-031" },
        summary: "Reported quantities for Mon, Oct 1:",
        createdAt: new Date("2026-10-01T13:00:00.000Z"),
      },
    ]);
    const after = await jobChangesCount(companyId, "25-031");
    expect(after).toBe(before + 1);
    const newest = await jobChanges(companyId, "25-031", 200, 0);
    const dupes = newest.filter((row) => row.planId === planId);
    expect(dupes).toHaveLength(1);
    expect(dupes[0]!.createdAt).toBe("2026-10-01T13:00:00.000Z");

    const page = await jobChanges(companyId, "25-031", 2, 0);
    expect(page).toHaveLength(2);
    const foreman = await jobChanges(companyId, "25-031", 50, 0, {
      excludeCostLanguage: true,
    });
    expect(
      foreman.some((row) => /\bCPI\b|\bSPI\b|At risk|[−-]\$\d/.test(row.summary)),
    ).toBe(false);
  }, 30_000);
});
