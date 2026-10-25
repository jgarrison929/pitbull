import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { companies, crews, dailyPlans, jobs, users } from "@/db/schema";
import { calendarDateInTz } from "@/lib/plan-date";
import { seedId } from "@/seed";
import { createDailyPlan } from "@/server/plans";
import { createSandbox } from "@/server/sandbox";
import { seedNow } from "@/server/seed-clock";
import type { CurrentUser } from "@/server/session";

const migrationSql = readFileSync(
  join(process.cwd(), "drizzle/0019_crews_contract.sql"),
  "utf8",
);

describe("migration 0019_crews_contract", () => {
  it("backfills null crew_id, sets NOT NULL, and drops text crew", () => {
    expect(migrationSql).toMatch(/DROP INDEX IF EXISTS "daily_plans_job_crew_date_uidx"/);
    expect(migrationSql).toMatch(/INSERT INTO "crews"/);
    expect(migrationSql).toMatch(/WHERE "crew_id" IS NULL/);
    expect(migrationSql).toMatch(/SET "crew_id" = c\."id"/);
    expect(migrationSql).toMatch(/PARTITION BY "job_id", "crew_id", "plan_date"/);
    expect(migrationSql).toMatch(/DELETE FROM "daily_plans"/);
    expect(migrationSql).toMatch(
      /crews contract: % daily_plans row\(s\) still have null crew_id/,
    );
    expect(migrationSql).toMatch(/ALTER COLUMN "crew_id" SET NOT NULL/);
    expect(migrationSql).toMatch(/DROP COLUMN "crew"/);
    expect(migrationSql).toMatch(
      /CREATE UNIQUE INDEX "daily_plans_job_crew_date_uidx"[\s\S]*"job_id","crew_id","plan_date"/,
    );
    // Backfill comes before the hard cutover.
    const backfillAt = migrationSql.indexOf('SET "crew_id" = c."id"');
    const notNullAt = migrationSql.indexOf('ALTER COLUMN "crew_id" SET NOT NULL');
    const dropAt = migrationSql.indexOf('DROP COLUMN "crew"');
    expect(backfillAt).toBeGreaterThan(-1);
    expect(notNullAt).toBeGreaterThan(backfillAt);
    expect(dropAt).toBeGreaterThan(notNullAt);
  });

  it("must-fail: SET NOT NULL without backfill is not the only step", () => {
    // Red if someone ships a bare SET NOT NULL / DROP with no fill path —
    // staging rows with null crew_id would abort migrate and lose the cutover.
    const stripped = migrationSql
      .replace(/UPDATE "daily_plans"[\s\S]*?;--> statement-breakpoint/m, "")
      .replace(/INSERT INTO "crews"[\s\S]*?;--> statement-breakpoint/m, "");
    expect(stripped).not.toEqual(migrationSql);
    expect(migrationSql).toMatch(/FROM "crews" AS c/);
  });
});

describe.skipIf(!getDb())("0019 acceptance: schema after migrate", () => {
  const db = getDb()!;

  it("daily_plans.crew is gone and crew_id is NOT NULL", async () => {
    const cols = await db.execute<{
      column_name: string;
      is_nullable: string;
    }>(sql`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'daily_plans'
        AND column_name IN ('crew', 'crew_id')
      ORDER BY column_name
    `);
    expect(cols.map((c) => c.column_name)).toEqual(["crew_id"]);
    expect(cols[0]?.is_nullable).toBe("NO");

    const idx = await db.execute<{ indexname: string }>(sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'daily_plans'
        AND indexname = 'daily_plans_job_crew_date_uidx'
    `);
    expect(idx.map((r) => r.indexname)).toContain(
      "daily_plans_job_crew_date_uidx",
    );
  });
});

describe.skipIf(!getDb())("0019 acceptance: seed and create path", () => {
  const db = getDb()!;
  const created: string[] = [];

  afterAll(async () => {
    for (const id of created)
      await db.delete(companies).where(eq(companies.id, id));
  });

  it("every seeded plan has non-null crew_id; Bridge resolves by name", async () => {
    const companyId = await createSandbox();
    created.push(companyId);

    const nulls = await db.execute<{ n: string }>(sql`
      SELECT count(*)::text AS n FROM daily_plans
      WHERE company_id = ${companyId}::uuid AND crew_id IS NULL
    `);
    expect(nulls[0]?.n).toBe("0");

    const [bridge] = await db
      .select()
      .from(crews)
      .where(eq(crews.companyId, companyId));
    const bridgeCrew = (
      await db.select().from(crews).where(eq(crews.companyId, companyId))
    ).find((c) => c.name === "Bridge Crew 2");
    expect(bridgeCrew).toBeTruthy();

    const bridgePlans = await db
      .select({ id: dailyPlans.id, crewId: dailyPlans.crewId })
      .from(dailyPlans)
      .where(eq(dailyPlans.crewId, bridgeCrew!.id));
    expect(bridgePlans.length).toBeGreaterThan(0);
    expect(bridgePlans.every((p) => p.crewId === bridgeCrew!.id)).toBe(true);
    expect(bridge).toBeTruthy();
  });

  it("createDailyPlan writes crewId only (no text crew column)", async () => {
    const companyId = await createSandbox();
    created.push(companyId);
    const superId = seedId(companyId, "user:superintendent");
    const bridgeId = seedId(companyId, "crew:bridge-2");
    const jobId = seedId(companyId, "job:cedar");
    const user: CurrentUser = {
      userId: superId,
      companyId,
      name: "Ray Dominguez",
      title: "Field Superintendent",
      role: "superintendent",
      companyName: "Demo",
      seededAt: seedNow(),
      expiresAt: null,
    };
    const planDate = calendarDateInTz(seedNow());
    const createdPlan = await createDailyPlan(user, {
      jobId,
      crewId: bridgeId,
      planDate,
    });
    expect("planId" in createdPlan).toBe(true);
    if (!("planId" in createdPlan)) return;

    const [row] = await db
      .select({ crewId: dailyPlans.crewId })
      .from(dailyPlans)
      .where(eq(dailyPlans.id, createdPlan.planId));
    expect(row.crewId).toBe(bridgeId);

    // Column is gone — selecting it must fail.
    await expect(
      db.execute(sql`SELECT crew FROM daily_plans WHERE id = ${createdPlan.planId}::uuid`),
    ).rejects.toSatisfy((err: unknown) =>
      /column .*crew.* does not exist/i.test(errorText(err)),
    );
  });

  it("inserting a plan without crew_id fails at the database", async () => {
    const companyId = await createSandbox();
    created.push(companyId);
    const foremanId = seedId(companyId, "user:foreman");
    const jobId = seedId(companyId, "job:cedar");
    const planId = crypto.randomUUID();

    await expect(
      db.execute(sql`
        INSERT INTO daily_plans (
          id, company_id, job_id, foreman_id, plan_date, weather, status
        ) VALUES (
          ${planId}::uuid,
          ${companyId}::uuid,
          ${jobId}::uuid,
          ${foremanId}::uuid,
          ${calendarDateInTz(seedNow())},
          '',
          'draft'
        )
      `),
    ).rejects.toSatisfy((err: unknown) =>
      /null value in column "crew_id"|violates not-null/i.test(errorText(err)),
    );
  });
});

function errorText(err: unknown): string {
  if (!err || typeof err !== "object") return String(err);
  const e = err as { message?: string; cause?: { message?: string } };
  return `${e.message ?? ""}\n${e.cause?.message ?? ""}\n${String(err)}`;
}

/**
 * Must-fail on a DB that has existing null crew_id rows: SET NOT NULL without
 * backfill rejects them. Proves why 0019 backfills first (no data loss on
 * staging/prod cutover). Whole simulation rolls back so the shared DB stays
 * on the 0019 contract.
 */
describe.skipIf(!getDb())("0019 must-fail: SET NOT NULL without backfill", () => {
  const db = getDb()!;
  const created: string[] = [];

  afterAll(async () => {
    for (const id of created)
      await db.delete(companies).where(eq(companies.id, id));
  });

  it("rejects null crew_id rows when SET NOT NULL runs alone", async () => {
    const companyId = crypto.randomUUID();
    created.push(companyId);
    const today = new Date("2026-10-20T17:00:00.000Z");
    const foremanId = seedId(companyId, "user:foreman");
    const jobId = seedId(companyId, "job:must-fail");
    const planId = seedId(companyId, "plan:must-fail");

    await db.insert(companies).values({
      id: companyId,
      name: "Must Fail Co",
      isSandbox: true,
      seededAt: today,
    });
    await db.insert(users).values({
      id: foremanId,
      companyId,
      name: "Luis Ortega",
      title: "Foreman",
      role: "foreman",
    });
    await db.insert(jobs).values({
      id: jobId,
      companyId,
      number: "99-019",
      name: "Must Fail Job",
      shortName: "MustFail",
      owner: "Test",
      pmName: "PM",
      finishOn: "2027-01-01",
      contractCents: 1,
      estimateStatus: "approved",
    });

    let sawNotNullFailure = false;
    try {
      await db.transaction(async (tx) => {
        await tx.execute(sql`
          ALTER TABLE daily_plans ALTER COLUMN crew_id DROP NOT NULL
        `);
        await tx.execute(sql`
          INSERT INTO daily_plans (
            id, company_id, job_id, foreman_id, plan_date, weather, status
          ) VALUES (
            ${planId}::uuid,
            ${companyId}::uuid,
            ${jobId}::uuid,
            ${foremanId}::uuid,
            '2026-10-20',
            '',
            'draft'
          )
        `);

        try {
          await tx.execute(
            sql`ALTER TABLE daily_plans ALTER COLUMN crew_id SET NOT NULL`,
          );
        } catch (err) {
          sawNotNullFailure = /null value|contains null/i.test(errorText(err));
          if (!sawNotNullFailure) throw err;
        }
        expect(sawNotNullFailure).toBe(true);
        // Abort the transaction so DROP NOT NULL + orphan insert never stick.
        tx.rollback();
      });
    } catch (err) {
      // drizzle tx.rollback() throws; a failed SET NOT NULL may surface first.
      expect(
        /rollback|Rollback|null value|contains null|Failed query/i.test(
          errorText(err),
        ),
      ).toBe(true);
    }

    // Shared DB must still enforce NOT NULL after the rolled-back simulation.
    const nullable = await db.execute<{ is_nullable: string }>(sql`
      SELECT is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'daily_plans'
        AND column_name = 'crew_id'
    `);
    expect(nullable[0]?.is_nullable).toBe("NO");
    expect(sawNotNullFailure).toBe(true);
  });
});
