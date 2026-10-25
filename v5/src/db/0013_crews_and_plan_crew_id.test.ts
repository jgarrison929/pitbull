import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { companies, crews, dailyPlans, jobs, users } from "@/db/schema";
import { preferPlanKeep } from "@/lib/plan-keep";
import { seedId } from "@/seed";

/** Migration 0013 is expand-only: crews + nullable crew_id, keep text crew. */
const migrationSql = readFileSync(
  join(process.cwd(), "drizzle/0013_crews_and_plan_crew_id.sql"),
  "utf8",
);

describe("migration 0013_crews_and_plan_crew_id", () => {
  it("creates crews and nullable crew_id without dropping the text crew column", () => {
    expect(migrationSql).toMatch(/CREATE TABLE "crews"/);
    expect(migrationSql).toMatch(/crews_company_name_uidx/);
    expect(migrationSql).toMatch(/ADD COLUMN "crew_id"/);
    expect(migrationSql).toMatch(/INSERT INTO "crews"/);
    expect(migrationSql).toMatch(/DISTINCT ON \("company_id", "crew"\)/);
    expect(migrationSql).toMatch(
      /ORDER BY "company_id", "crew", "plan_date" DESC/,
    );
    expect(migrationSql).toMatch(/SET "crew_id"/);
    // Expand-only: leave nullable so pre-0013 inserts still succeed.
    expect(migrationSql).not.toMatch(/ALTER COLUMN "crew_id" SET NOT NULL/);
    expect(migrationSql).not.toMatch(/"crew_id" uuid NOT NULL/);
    expect(migrationSql).toMatch(/daily_plans_job_crew_date_uidx/);
    expect(migrationSql).toMatch(/weather.*SET DEFAULT ''/);
    expect(migrationSql).not.toMatch(/DROP COLUMN "crew"/);
  });

  it("dedupes by issued-over-draft then newest created_at — not highest UUID", () => {
    expect(migrationSql).toMatch(
      /PARTITION BY "job_id", "crew_id", "plan_date"/,
    );
    expect(migrationSql).toMatch(/WHEN 'issued' THEN 2/);
    expect(migrationSql).toMatch(/WHEN 'draft' THEN 1/);
    expect(migrationSql).toMatch(/"submitted_at" DESC NULLS LAST/);
    expect(migrationSql).toMatch(/ADD COLUMN "created_at"/);
    expect(migrationSql).toMatch(/"created_at" DESC/);
    expect(migrationSql).toMatch(/"id" DESC/);
    expect(migrationSql).toMatch(/DELETE FROM "daily_plans"/);
    // Must not keep solely by ascending id (lowest UUID).
    expect(migrationSql).not.toMatch(
      /ORDER BY\s+"id"\s*\)\s*AS keep_id/i,
    );
  });
});

/**
 * The backfill rule: one crew per (company, name); foreman from the most
 * recent plan. Asserted against the same DISTINCT ON ordering the migration uses.
 */
describe("0013 crew backfill foreman pick", () => {
  const db = getDb();
  const created: string[] = [];

  afterAll(async () => {
    if (!db || !created.length) return;
    for (const id of created) {
      await db.delete(companies).where(eq(companies.id, id));
    }
  });

  it.skipIf(!db)(
    "picks the foreman from the most recent plan when a name had two",
    async () => {
      const companyId = crypto.randomUUID();
      created.push(companyId);
      const today = new Date("2026-10-20T17:00:00.000Z");
      const olderForeman = seedId(companyId, "user:foreman-old");
      const newerForeman = seedId(companyId, "user:foreman-new");
      const jobId = seedId(companyId, "job:backfill");
      const crewId = seedId(companyId, "crew:shared");

      await db!.insert(companies).values({
        id: companyId,
        name: "Backfill Co",
        isSandbox: true,
        seededAt: today,
      });
      await db!.insert(users).values([
        {
          id: olderForeman,
          companyId,
          name: "Older Foreman",
          title: "Foreman",
          role: "foreman",
        },
        {
          id: newerForeman,
          companyId,
          name: "Newer Foreman",
          title: "Foreman",
          role: "foreman",
        },
      ]);
      await db!.insert(jobs).values({
        id: jobId,
        companyId,
        number: "99-001",
        name: "Backfill Job",
        shortName: "Backfill",
        owner: "Test",
        pmName: "PM",
        finishOn: "2027-01-01",
        contractCents: 1,
        estimateStatus: "approved",
      });
      await db!.insert(crews).values({
        id: crewId,
        companyId,
        name: "Shared Crew",
        foremanId: newerForeman,
      });
      // Two plans, same crew name, different foremen — newest date wins.
      await db!.insert(dailyPlans).values([
        {
          id: seedId(companyId, "plan:older"),
          companyId,
          jobId,
          crew: "Shared Crew",
          crewId,
          foremanId: olderForeman,
          planDate: "2026-10-01",
          status: "draft",
          weather: "",
          equipment: [],
        },
        {
          id: seedId(companyId, "plan:newer"),
          companyId,
          jobId,
          crew: "Shared Crew",
          crewId,
          foremanId: newerForeman,
          planDate: "2026-10-15",
          status: "draft",
          weather: "",
          equipment: [],
        },
      ]);

      const rows = await db!.execute<{
        company_id: string;
        crew: string;
        foreman_id: string;
      }>(sql`
        SELECT DISTINCT ON (company_id, crew)
          company_id, crew, foreman_id
        FROM daily_plans
        WHERE company_id = ${companyId}
        ORDER BY company_id, crew, plan_date DESC, id DESC
      `);
      expect(rows).toHaveLength(1);
      expect(rows[0].crew).toBe("Shared Crew");
      expect(rows[0].foreman_id).toBe(newerForeman);
    },
  );

  it.skipIf(!db)("job+crew+date unique index exists after 0013", async () => {
    const idx = await db!.execute<{ indexname: string }>(sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'daily_plans'
        AND indexname = 'daily_plans_job_crew_date_uidx'
    `);
    expect(idx.map((r) => r.indexname)).toContain(
      "daily_plans_job_crew_date_uidx",
    );
  });

  it.skipIf(!db)(
    "crew_id stays nullable so a pre-0013 shape insert succeeds",
    async () => {
      const nullable = await db!.execute<{ is_nullable: string }>(sql`
        SELECT is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'daily_plans'
          AND column_name = 'crew_id'
      `);
      expect(nullable[0]?.is_nullable).toBe("YES");

      const companyId = crypto.randomUUID();
      created.push(companyId);
      const today = new Date("2026-10-20T17:00:00.000Z");
      const foremanId = seedId(companyId, "user:old-shape");
      const jobId = seedId(companyId, "job:old-shape");
      const planId = seedId(companyId, "plan:old-shape");

      await db!.insert(companies).values({
        id: companyId,
        name: "Old Shape Co",
        isSandbox: true,
        seededAt: today,
      });
      await db!.insert(users).values({
        id: foremanId,
        companyId,
        name: "Old Shape Foreman",
        title: "Foreman",
        role: "foreman",
      });
      await db!.insert(jobs).values({
        id: jobId,
        companyId,
        number: "99-002",
        name: "Old Shape Job",
        shortName: "Old",
        owner: "Test",
        pmName: "PM",
        finishOn: "2027-01-01",
        contractCents: 1,
        estimateStatus: "approved",
      });

      // Pre-0013 writers omit crew_id entirely (legacy text crew only).
      await db!.execute(sql`
        INSERT INTO daily_plans (
          id, company_id, job_id, crew, foreman_id, plan_date, weather
        ) VALUES (
          ${planId}::uuid,
          ${companyId}::uuid,
          ${jobId}::uuid,
          'Legacy Crew',
          ${foremanId}::uuid,
          '2026-10-21',
          ''
        )
      `);

      const rows = await db!.execute<{
        id: string;
        crew_id: string | null;
        crew: string;
      }>(sql`
        SELECT id, crew_id, crew FROM daily_plans WHERE id = ${planId}::uuid
      `);
      expect(rows).toHaveLength(1);
      expect(rows[0].crew).toBe("Legacy Crew");
      expect(rows[0].crew_id).toBeNull();
    },
  );

  it.skipIf(!db)(
    "issued seed plan survives when a draft collides on job+crew+date",
    async () => {
      // Simulate the pre-unique-index collision the migration merges. Draft has
      // the lower UUID so ORDER BY id ASC would wrongly keep it.
      const draftId = "00000000-0000-4000-8000-000000000001";
      const issuedId = "ffffffff-ffff-4fff-bfff-ffffffffffff";
      const jobId = "11111111-1111-4111-8111-111111111111";
      const crewId = "22222222-2222-4222-8222-222222222222";

      const ranked = await db!.execute<{ keep_id: string; id: string }>(sql`
        WITH sample AS (
          SELECT * FROM (VALUES
            (
              ${draftId}::uuid,
              ${jobId}::uuid,
              ${crewId}::uuid,
              '2026-10-22'::date,
              'draft'::text,
              NULL::timestamptz,
              '2026-10-22T12:00:00Z'::timestamptz
            ),
            (
              ${issuedId}::uuid,
              ${jobId}::uuid,
              ${crewId}::uuid,
              '2026-10-22'::date,
              'issued'::text,
              '2026-10-21T18:00:00Z'::timestamptz,
              '2026-10-20T12:00:00Z'::timestamptz
            )
          ) AS t(id, job_id, crew_id, plan_date, status, submitted_at, created_at)
        )
        SELECT
          id,
          FIRST_VALUE(id) OVER (
            PARTITION BY job_id, crew_id, plan_date
            ORDER BY
              CASE status
                WHEN 'approved' THEN 4
                WHEN 'reported' THEN 3
                WHEN 'issued' THEN 2
                WHEN 'draft' THEN 1
                ELSE 0
              END DESC,
              plan_date DESC,
              submitted_at DESC NULLS LAST,
              created_at DESC,
              id DESC
          ) AS keep_id
        FROM sample
      `);
      expect(ranked.length).toBe(2);
      expect(ranked.every((r) => r.keep_id === issuedId)).toBe(true);

      const kept = preferPlanKeep([
        {
          id: draftId,
          status: "draft",
          planDate: "2026-10-22",
          submittedAt: null,
          createdAt: new Date("2026-10-22T12:00:00.000Z"),
        },
        {
          id: issuedId,
          status: "issued",
          planDate: "2026-10-22",
          submittedAt: new Date("2026-10-21T18:00:00.000Z"),
          createdAt: new Date("2026-10-20T12:00:00.000Z"),
        },
      ]);
      expect(kept?.id).toBe(issuedId);
    },
  );
});
