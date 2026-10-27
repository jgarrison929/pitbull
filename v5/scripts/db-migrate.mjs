// Applies the committed Drizzle migrations in ./drizzle, then the idempotent
// crew-rate backfill. Runs in Railway's pre-deploy step after db:ensure.
// "up to date" is printed only after migrate + backfill both succeed.
//
// Enum ADD VALUE cannot run inside drizzle-orm's single migration transaction.
// Migrations whose SQL contains ADD VALUE are applied outside a transaction;
// all others stay in a per-migration transaction. That keeps `db:migrate`
// working from scratch and on top of an already-applied prior migration.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readMigrationFiles } from "drizzle-orm/migrator";
import postgres from "postgres";
import { parsePostgresUrl } from "../src/db/database-url.ts";
import { backfillCrewLaborRates } from "./backfill-crew-labor-rates.mjs";
import { redactDbEnsureError } from "./db-ensure.mjs";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.log("db:migrate skipped, DATABASE_URL is not set");
} else {
  try {
    // Same encode-userinfo path as db:ensure / app client — never pass the raw
    // env URL to postgres() (unencoded `/` `?` `#` `@` → ERR_INVALID_URL and
    // Node dumps `input` with the password).
    const parsed = parsePostgresUrl(databaseUrl);
    if (!parsed) {
      throw new Error("DATABASE_URL is not a usable Postgres URL");
    }
    const client = postgres(parsed.connectionString, {
      max: 1,
      onnotice: () => {},
    });
    try {
      const folder = path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "..",
        "drizzle",
      );
      await migrateWithAddValueOutside(client, folder);
      const backfill = await backfillCrewLaborRates(client);
      console.log(
        backfill.applied
          ? `db:migrate backfill-crew-labor-rates ok (${backfill.statements} statements)`
          : `db:migrate backfill-crew-labor-rates skipped (${backfill.reason})`,
      );
      console.log("db:migrate up to date");
    } finally {
      await client.end();
    }
  } catch (err) {
    // Never log DATABASE_URL / password — Node's ERR_INVALID_URL embeds them in `input`.
    console.error(`db:migrate failed: ${redactDbEnsureError(err)}`);
    process.exitCode = 1;
  }
}

/**
 * Same journal/hash rules as drizzle-orm's migrator, but ADD VALUE statements
 * run outside a transaction.
 */
async function migrateWithAddValueOutside(client, migrationsFolder) {
  const migrationsTable = "__drizzle_migrations";
  const migrationsSchema = "drizzle";
  await client.unsafe(`CREATE SCHEMA IF NOT EXISTS "${migrationsSchema}"`);
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS "${migrationsSchema}"."${migrationsTable}" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  const applied = await client.unsafe(
    `select id, hash, created_at from "${migrationsSchema}"."${migrationsTable}" order by created_at desc limit 1`,
  );
  const lastDbMigration = applied[0];

  const migrations = readMigrationFiles({ migrationsFolder });

  for (const migration of migrations) {
    if (
      lastDbMigration &&
      Number(lastDbMigration.created_at) >= migration.folderMillis
    ) {
      continue;
    }

    const stmts = migration.sql
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const fileSql = migration.sql.join("--> statement-breakpoint");
    const addValue = /\bADD\s+VALUE\b/i.test(fileSql);

    if (addValue) {
      for (const stmt of stmts) {
        await client.unsafe(stmt);
      }
      await client.unsafe(
        `insert into "${migrationsSchema}"."${migrationsTable}" ("hash", "created_at") values ($1, $2)`,
        [migration.hash, migration.folderMillis],
      );
    } else {
      await client.begin(async (tx) => {
        for (const stmt of stmts) {
          await tx.unsafe(stmt);
        }
        await tx.unsafe(
          `insert into "${migrationsSchema}"."${migrationsTable}" ("hash", "created_at") values ($1, $2)`,
          [migration.hash, migration.folderMillis],
        );
      });
    }
  }
}
