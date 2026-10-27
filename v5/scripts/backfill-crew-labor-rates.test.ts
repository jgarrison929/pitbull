import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { companies, crews } from "@/db/schema";
import {
  CREW_LABOR_RATE_CENTS,
  CREW_RATE_EXPAND_DEFAULT_CENTS,
} from "@/lib/crew-rates";
import { createSandbox } from "@/server/sandbox";
import {
  backfillCrewLaborRates,
  backfillStatements,
  failAfterCount,
} from "./backfill-crew-labor-rates.mjs";

const db = getDb();
const created: string[] = [];

const NAMED = [
  "Bridge Crew 2",
  "Culvert Crew A",
  "Interchange Crew 1",
] as const;

async function crewsDigest(companyId: string) {
  const rows = await db!
    .select({
      id: crews.id,
      name: crews.name,
      rate: crews.laborRateCents,
    })
    .from(crews)
    .where(eq(crews.companyId, companyId))
    .orderBy(crews.id);
  const payload = rows.map((r) => `${r.id}|${r.name}|${r.rate}`).join("\n");
  return {
    rows,
    md5: createHash("md5").update(payload).digest("hex"),
  };
}

async function ratesByName(companyId: string) {
  const rows = await db!
    .select({ name: crews.name, rate: crews.laborRateCents })
    .from(crews)
    .where(eq(crews.companyId, companyId));
  return Object.fromEntries(rows.map((r) => [r.name, r.rate]));
}

/** Run `node scripts/db-migrate.mjs` with the test DATABASE_URL. */
function runDbMigrate(
  env: Record<string, string | undefined> = {},
): Promise<{
  code: number | null;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
        "scripts/db-migrate.mjs",
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, ...env },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

describe("backfill-crew-labor-rates", () => {
  it("statements match the committed .sql file UPDATEs", () => {
    const file = readFileSync(
      join(process.cwd(), "scripts/backfill-crew-labor-rates.sql"),
      "utf8",
    );
    const stmts = backfillStatements();
    expect(stmts).toHaveLength(3);
    expect(stmts.join("\n")).toContain(
      `SET "labor_rate_cents" = ${CREW_LABOR_RATE_CENTS["Bridge Crew 2"]}`,
    );
    for (const name of NAMED) {
      expect(stmts.join("\n")).toMatch(
        new RegExp(
          `WHERE "name" = '${name}' AND "labor_rate_cents" = ${CREW_RATE_EXPAND_DEFAULT_CENTS}`,
        ),
      );
    }
    expect(file).toMatch(/db:migrate runs this automatically/);
  });
});

describe("failAfterCount", () => {
  // NODE_ENV is typed read-only; mutate via a loose view for tests.
  const env = process.env as Record<string, string | undefined>;
  const prevEnv = env.NODE_ENV;
  const prevFail = env.V5_BACKFILL_FAIL_AFTER;

  afterAll(() => {
    env.NODE_ENV = prevEnv;
    if (prevFail === undefined) delete env.V5_BACKFILL_FAIL_AFTER;
    else env.V5_BACKFILL_FAIL_AFTER = prevFail;
  });

  it("accepts a plain positive whole number from options or env", () => {
    delete env.V5_BACKFILL_FAIL_AFTER;
    env.NODE_ENV = "test";
    expect(failAfterCount({ failAfter: 1 })).toBe(1);
    expect(failAfterCount({ failAfter: 12 })).toBe(12);
    expect(failAfterCount({ failAfter: "1" })).toBe(1);
    expect(failAfterCount({ failAfter: "12" })).toBe(12);

    env.V5_BACKFILL_FAIL_AFTER = "1";
    expect(failAfterCount({})).toBe(1);
    env.V5_BACKFILL_FAIL_AFTER = "3";
    expect(failAfterCount({})).toBe(3);
  });

  it("is ignored when NODE_ENV=production", () => {
    env.NODE_ENV = "production";
    env.V5_BACKFILL_FAIL_AFTER = "1";
    expect(failAfterCount({})).toBeNull();
    expect(failAfterCount({ failAfter: 1 })).toBeNull();
    expect(failAfterCount({ failAfter: "1" })).toBeNull();
  });

  it("rejects padded, scientific, hex, zero, negatives, and junk", () => {
    env.NODE_ENV = "test";
    delete env.V5_BACKFILL_FAIL_AFTER;

    const rejected = [
      " 1",
      "1 ",
      "1e0",
      "0x1",
      "0",
      "-1",
      "+1",
      "1.5",
      "01",
      "junk",
      "",
      " ",
    ];
    for (const raw of rejected) {
      expect(failAfterCount({ failAfter: raw }), `options ${JSON.stringify(raw)}`).toBeNull();
      process.env.V5_BACKFILL_FAIL_AFTER = raw;
      expect(failAfterCount({}), `env ${JSON.stringify(raw)}`).toBeNull();
    }

    expect(failAfterCount({ failAfter: 0 })).toBeNull();
    expect(failAfterCount({ failAfter: -1 })).toBeNull();
    expect(failAfterCount({ failAfter: 1.5 })).toBeNull();
    expect(failAfterCount({ failAfter: NaN })).toBeNull();
    expect(failAfterCount({ failAfter: Infinity })).toBeNull();
    expect(failAfterCount({ failAfter: true as unknown as number })).toBeNull();
  });
});

describe.skipIf(!db)("backfillCrewLaborRates idempotent", () => {
  afterAll(async () => {
    for (const id of created)
      await db!.delete(companies).where(eq(companies.id, id));
  });

  it("two runs leave identical crews tables", async () => {
    const companyId = await createSandbox();
    created.push(companyId);

    // Simulate old-build sandboxes that only got DEFAULT 8500 after 0014.
    await db!.execute(sql`
      UPDATE crews
      SET labor_rate_cents = ${CREW_RATE_EXPAND_DEFAULT_CENTS}
      WHERE company_id = ${companyId}::uuid
    `);

    const before = await crewsDigest(companyId);
    expect(
      before.rows.every((r) => r.rate === CREW_RATE_EXPAND_DEFAULT_CENTS),
    ).toBe(true);

    const client = (
      await import("postgres")
    ).default(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
    try {
      const first = await backfillCrewLaborRates(client);
      expect(first.applied).toBe(true);
      const afterFirst = await crewsDigest(companyId);
      expect(
        afterFirst.rows.find((r) => r.name === "Bridge Crew 2")?.rate,
      ).toBe(CREW_LABOR_RATE_CENTS["Bridge Crew 2"]);
      expect(
        afterFirst.rows.find((r) => r.name === "Culvert Crew A")?.rate,
      ).toBe(CREW_LABOR_RATE_CENTS["Culvert Crew A"]);
      expect(
        afterFirst.rows.find((r) => r.name === "Interchange Crew 1")?.rate,
      ).toBe(CREW_LABOR_RATE_CENTS["Interchange Crew 1"]);

      const second = await backfillCrewLaborRates(client);
      expect(second.applied).toBe(true);
      const afterSecond = await crewsDigest(companyId);

      // Two runs leave identical tables (md5 of ordered crew rows).
      expect(afterSecond.md5).toBe(afterFirst.md5);
      expect(afterSecond.rows).toEqual(afterFirst.rows);
      expect(afterFirst.md5).not.toBe(before.md5);
    } finally {
      await client.end();
    }
  });
});

describe.skipIf(!db)("db-migrate.mjs runs crew-rate backfill", () => {
  afterAll(async () => {
    for (const id of created)
      await db!.delete(companies).where(eq(companies.id, id));
  });

  it("applies spec rates to expand-default crews via scripts/db-migrate.mjs", async () => {
    const companyId = await createSandbox();
    created.push(companyId);

    await db!.execute(sql`
      UPDATE crews
      SET labor_rate_cents = ${CREW_RATE_EXPAND_DEFAULT_CENTS}
      WHERE company_id = ${companyId}::uuid
        AND name IN ('Bridge Crew 2', 'Culvert Crew A', 'Interchange Crew 1')
    `);

    const before = await ratesByName(companyId);
    for (const name of NAMED) {
      expect(before[name]).toBe(CREW_RATE_EXPAND_DEFAULT_CENTS);
    }

    const { code, stdout, stderr } = await runDbMigrate();
    expect(stderr, `db:migrate stderr: ${stderr}`).toBe("");
    expect(code, `db:migrate exit ${code}: ${stdout}`).toBe(0);
    expect(stdout).toMatch(/backfill-crew-labor-rates/);
    expect(stdout).toMatch(/db:migrate up to date/);

    const after = await ratesByName(companyId);
    expect(after["Bridge Crew 2"]).toBe(CREW_LABOR_RATE_CENTS["Bridge Crew 2"]);
    expect(after["Culvert Crew A"]).toBe(
      CREW_LABOR_RATE_CENTS["Culvert Crew A"],
    );
    expect(after["Interchange Crew 1"]).toBe(
      CREW_LABOR_RATE_CENTS["Interchange Crew 1"],
    );
  });

  it("leaves custom rates untouched when db:migrate re-runs the backfill", async () => {
    const companyId = await createSandbox();
    created.push(companyId);

    const customBridge = 10000;
    const customCulvert = 8000;

    await db!.execute(sql`
      UPDATE crews
      SET labor_rate_cents = ${customBridge}
      WHERE company_id = ${companyId}::uuid AND name = 'Bridge Crew 2'
    `);
    await db!.execute(sql`
      UPDATE crews
      SET labor_rate_cents = ${customCulvert}
      WHERE company_id = ${companyId}::uuid AND name = 'Culvert Crew A'
    `);
    // Interchange stays at expand default so migrate still has work to do.
    await db!.execute(sql`
      UPDATE crews
      SET labor_rate_cents = ${CREW_RATE_EXPAND_DEFAULT_CENTS}
      WHERE company_id = ${companyId}::uuid AND name = 'Interchange Crew 1'
    `);

    const { code, stdout, stderr } = await runDbMigrate();
    expect(stderr, `db:migrate stderr: ${stderr}`).toBe("");
    expect(code, `db:migrate exit ${code}: ${stdout}`).toBe(0);

    const after = await ratesByName(companyId);
    expect(after["Bridge Crew 2"]).toBe(customBridge);
    expect(after["Culvert Crew A"]).toBe(customCulvert);
    expect(after["Interchange Crew 1"]).toBe(
      CREW_LABOR_RATE_CENTS["Interchange Crew 1"],
    );
  });

  it("rolls back all rates when backfill fails after the first UPDATE", async () => {
    // Must-fail: without sql.begin around the UPDATEs, Bridge Crew 2 would
    // stick at 9250 while Culvert/Interchange stay 8500. V5_BACKFILL_FAIL_AFTER=1
    // throws after the first statement inside the transaction.
    const companyId = await createSandbox();
    created.push(companyId);

    await db!.execute(sql`
      UPDATE crews
      SET labor_rate_cents = ${CREW_RATE_EXPAND_DEFAULT_CENTS}
      WHERE company_id = ${companyId}::uuid
        AND name IN ('Bridge Crew 2', 'Culvert Crew A', 'Interchange Crew 1')
    `);

    const before = await ratesByName(companyId);
    for (const name of NAMED) {
      expect(before[name]).toBe(CREW_RATE_EXPAND_DEFAULT_CENTS);
    }

    const { code, stdout, stderr } = await runDbMigrate({
      V5_BACKFILL_FAIL_AFTER: "1",
    });
    expect(code, `expected exit 1; stdout=${stdout} stderr=${stderr}`).toBe(1);
    expect(`${stdout}\n${stderr}`).toMatch(/forced backfill failure/);
    expect(stdout).not.toMatch(/db:migrate up to date/);

    const after = await ratesByName(companyId);
    // All-or-nothing: first UPDATE must not stick.
    expect(after["Bridge Crew 2"]).toBe(CREW_RATE_EXPAND_DEFAULT_CENTS);
    expect(after["Culvert Crew A"]).toBe(CREW_RATE_EXPAND_DEFAULT_CENTS);
    expect(after["Interchange Crew 1"]).toBe(CREW_RATE_EXPAND_DEFAULT_CENTS);
  });
});
