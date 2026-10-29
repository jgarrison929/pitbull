import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { actionRuns, companies, users } from "@/db/schema";
import { actions, WRITES } from "@/server/assistant/actions";
import { createSandbox } from "@/server/sandbox";
import {
  jobChanges,
  jobChangesCount,
  jobChangesStatement,
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
    expect(query).not.toMatch(/10_000/);
    expect(page).not.toMatch(/10_000/);
    expect(page).not.toMatch(/\.slice\(/);
    expect(page).toMatch(/const PAGE_SIZE = 50\b/);
    expect(page).toMatch(
      /jobChanges\(\s*user\.companyId,\s*number,\s*PAGE_SIZE,/,
    );
    expect(page).toMatch(/jobChangesCount/);
    const migration = readFileSync(
      new URL("../../drizzle/0021_action_runs_job_idx.sql", import.meta.url),
      "utf8",
    );
    expect(migration).toContain("action_runs_company_job_created_idx");
    expect(migration).toContain(`"company_id"`);
    expect(migration).toContain(`(args->>'job')`);
    expect(migration).toContain(`"created_at" DESC NULLS LAST`);
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

    // Enough other jobs that a company-only index is the expensive plan.
    // Base had no job index and loaded 10_000 rows into Node.
    await db!.execute(sql`
      insert into action_runs (
        company_id, user_id, prompt, action, args, summary, created_at
      )
      select
        ${companyId},
        ${user!.id},
        'bulk',
        'dailyPlan.create',
        jsonb_build_object('job', 'other-' || g),
        'bulk',
        now() - (g || ' seconds')::interval
      from generate_series(1, 4000) g
    `);
    await db!.execute(sql`analyze action_runs`);
    const explainedResult = await db!.execute(sql`
      explain (format text)
      ${jobChangesStatement(companyId, "25-031", 50, 0)}
    `);
    const explained = [...explainedResult]
      .map((row) => String(Object.values(row as object)[0] ?? ""))
      .join("\n");
    expect(explained).toMatch(/\bLimit\b/);
    expect(explained).toContain("action_runs_company_job_created_idx");
    expect(explained).toMatch(/Index Cond:.*args ->> 'job'/);
  }, 30_000);
});
