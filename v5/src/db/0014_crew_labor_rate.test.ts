import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { companies, crews, users } from "@/db/schema";
import { seedId } from "@/seed";
import { CREW_LABOR_RATE_CENTS } from "@/lib/crew-rates";

/** Migration 0014 is expand-only: NOT NULL + DEFAULT so old inserts still work. */
const migrationSql = readFileSync(
  join(process.cwd(), "drizzle/0014_crew_labor_rate.sql"),
  "utf8",
);

describe("migration 0014_crew_labor_rate", () => {
  it("adds labor_rate_cents NOT NULL with DEFAULT (expand-only)", () => {
    expect(migrationSql).toMatch(/ADD COLUMN "labor_rate_cents"/);
    expect(migrationSql).toMatch(/DEFAULT 8500/);
    expect(migrationSql).toMatch(/NOT NULL/);
    // Keep the default so a pre-0014 INSERT that omits the column succeeds.
    expect(migrationSql).not.toMatch(/DROP DEFAULT/);
    expect(migrationSql).not.toMatch(/DROP COLUMN/);
  });

  it("backfills the three named seed crew rates (idempotent by name)", () => {
    expect(migrationSql).toMatch(
      /SET "labor_rate_cents" = 9250 WHERE "name" = 'Bridge Crew 2'/,
    );
    expect(migrationSql).toMatch(
      /SET "labor_rate_cents" = 7800 WHERE "name" = 'Culvert Crew A'/,
    );
    expect(migrationSql).toMatch(
      /SET "labor_rate_cents" = 8800 WHERE "name" = 'Interchange Crew 1'/,
    );
    expect(migrationSql).toMatch(/backfill-crew-labor-rates\.sql/);
    expect(CREW_LABOR_RATE_CENTS["Bridge Crew 2"]).toBe(9250);
  });
});

describe("scripts/backfill-crew-labor-rates.sql", () => {
  it("is re-runnable and mirrors the migration UPDATEs", () => {
    const script = readFileSync(
      join(process.cwd(), "scripts/backfill-crew-labor-rates.sql"),
      "utf8",
    );
    expect(script).toMatch(
      /SET "labor_rate_cents" = 9250 WHERE "name" = 'Bridge Crew 2'/,
    );
    expect(script).toMatch(
      /SET "labor_rate_cents" = 7800 WHERE "name" = 'Culvert Crew A'/,
    );
    expect(script).toMatch(
      /SET "labor_rate_cents" = 8800 WHERE "name" = 'Interchange Crew 1'/,
    );
    expect(script).toMatch(/db:migrate runs this automatically/);
  });
});

describe("0014 expand-only crew insert without labor_rate_cents", () => {
  const db = getDb();
  const created: string[] = [];

  afterAll(async () => {
    if (!db || !created.length) return;
    for (const id of created) {
      await db.delete(companies).where(eq(companies.id, id));
    }
  });

  it.skipIf(!db)(
    "INSERT that omits labor_rate_cents still succeeds via DEFAULT",
    async () => {
      const companyId = crypto.randomUUID();
      created.push(companyId);
      const foremanId = seedId(companyId, "user:expand-foreman");
      const crewId = seedId(companyId, "crew:expand-omit-rate");
      const today = new Date("2026-10-20T17:00:00.000Z");

      await db!.insert(companies).values({
        id: companyId,
        name: "Expand Rate Co",
        isSandbox: true,
        seededAt: today,
      });
      await db!.insert(users).values({
        id: foremanId,
        companyId,
        name: "Expand Foreman",
        title: "Foreman",
        role: "foreman",
      });

      // Pre-0014 shape: omit labor_rate_cents — DEFAULT 8500 applies.
      await db!.execute(sql`
        INSERT INTO crews (id, company_id, name, foreman_id)
        VALUES (${crewId}::uuid, ${companyId}::uuid, 'Legacy Insert Crew', ${foremanId}::uuid)
      `);

      const [row] = await db!
        .select()
        .from(crews)
        .where(eq(crews.id, crewId));
      expect(row.laborRateCents).toBe(8500);
    },
  );
});
