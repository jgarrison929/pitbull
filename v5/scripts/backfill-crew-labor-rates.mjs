// Idempotent crew labor rate backfill (5.0.2 Part A).
// Named-crew UPDATEs from scripts/backfill-crew-labor-rates.sql, gated on the
// expand DEFAULT (8500) so custom rates survive every db:migrate.
// Called from db:migrate after Drizzle migrate so Railway cutover does not
// need a manual psql step. Safe to run every deploy.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const here = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(here, "backfill-crew-labor-rates.sql");

/** Executable UPDATE statements from the .sql file (comments stripped). */
export function backfillStatements() {
  return readFileSync(sqlPath, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Plain positive whole number as a string: "1", "12" — not "0", " 1", "1e0". */
const PLAIN_POSITIVE_INT = /^[1-9]\d*$/;

/**
 * How many UPDATEs to run before throwing (test-only). Set via options or
 * `V5_BACKFILL_FAIL_AFTER` so a child-process `db:migrate` can force a mid-
 * backfill failure. Unset / empty → normal path.
 *
 * Hardened: ignored when `NODE_ENV=production`. Accepts only a plain positive
 * whole number (string matching /^[1-9]\d*$/, or a positive safe integer).
 * Rejects padded/scientific/hex/"0"/negatives/junk.
 */
export function failAfterCount(options = {}) {
  if (process.env.NODE_ENV === "production") return null;

  const fromOptions = Object.hasOwn(options, "failAfter");
  const raw = fromOptions ? options.failAfter : process.env.V5_BACKFILL_FAIL_AFTER;
  if (raw == null || raw === "") return null;

  if (typeof raw === "number") {
    if (!Number.isInteger(raw) || raw < 1 || !Number.isSafeInteger(raw)) {
      return null;
    }
    return raw;
  }
  if (typeof raw !== "string") return null;
  if (!PLAIN_POSITIVE_INT.test(raw)) return null;
  return Number(raw);
}

/**
 * Apply named-crew rate UPDATEs inside one transaction. `sql` is a postgres.js
 * client. No-op when the crews table (or labor_rate_cents) is not present yet.
 * On statement failure the transaction rolls back (no partial rates).
 *
 * @param {object} [options]
 * @param {number} [options.failAfter] — after this many successful UPDATEs,
 *   throw (must-fail / all-or-nothing tests). Prefer env in child processes.
 */
export async function backfillCrewLaborRates(sql, options = {}) {
  const [{ exists } = { exists: false }] = await sql`
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'crews'
        and column_name = 'labor_rate_cents'
    ) as exists
  `;
  if (!exists) {
    return { applied: false, reason: "crews.labor_rate_cents missing" };
  }
  const statements = backfillStatements();
  const failAfter = failAfterCount(options);
  await sql.begin(async (tx) => {
    let done = 0;
    for (const stmt of statements) {
      await tx.unsafe(stmt);
      done += 1;
      if (failAfter != null && done === failAfter) {
        throw new Error(
          `forced backfill failure after ${failAfter} UPDATE(s) (V5_BACKFILL_FAIL_AFTER)`,
        );
      }
    }
  });
  return { applied: true, statements: statements.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log("backfill-crew-labor-rates skipped, DATABASE_URL is not set");
  } else {
    const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
    try {
      const result = await backfillCrewLaborRates(sql);
      console.log(
        result.applied
          ? `backfill-crew-labor-rates applied (${result.statements} statements)`
          : `backfill-crew-labor-rates skipped (${result.reason})`,
      );
    } finally {
      await sql.end();
    }
  }
}
