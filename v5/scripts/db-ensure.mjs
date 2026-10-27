// Creates the database named in DATABASE_URL when it does not exist yet.
// Runs as Railway's pre-deploy command, so a fresh environment needs no manual SQL.
// It only ever issues CREATE DATABASE. It never drops or alters anything.
import postgres from "postgres";
import { parsePostgresUrl } from "../src/db/database-url.ts";

/**
 * Split DATABASE_URL into the target db name and an admin URL aimed at
 * the maintenance database. Uses the same encode-userinfo parser as the
 * app DB client — never raw `new URL(env)` (unencoded `/` `?` `#` in the
 * password throws ERR_INVALID_URL and Node dumps `input` with the secret).
 */
export function splitDatabaseUrl(databaseUrl) {
  const parsed = parsePostgresUrl(databaseUrl);
  if (!parsed) {
    throw new Error("DATABASE_URL is not a usable Postgres URL");
  }
  const url = new URL(parsed.connectionString);
  const name = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!name) throw new Error("DATABASE_URL has no database name");
  url.pathname = "/postgres";
  return { name, adminUrl: url.toString() };
}

/** Strip any accidental postgres URL / userinfo from error text before logging. */
export function redactDbEnsureError(err) {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.replace(/postgres(ql)?:\/\/\S+/gi, "postgres://[redacted]");
}

export async function ensureDatabase(databaseUrl, connect = postgres) {
  const { name, adminUrl } = splitDatabaseUrl(databaseUrl);
  const sql = connect(adminUrl, { max: 1, onnotice: () => {} });
  try {
    const rows = await sql`select 1 from pg_database where datname = ${name}`;
    if (rows.length > 0) return { name, created: false };
    await sql`create database ${sql(name)}`;
    return { name, created: true };
  } finally {
    await sql.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log("db:ensure skipped, DATABASE_URL is not set");
  } else {
    try {
      const { name, created } = await ensureDatabase(databaseUrl);
      console.log(`db:ensure ${name} ${created ? "created" : "already exists"}`);
    } catch (err) {
      // Never log DATABASE_URL / password — Node's ERR_INVALID_URL embeds them in `input`.
      console.error(`db:ensure failed: ${redactDbEnsureError(err)}`);
      process.exitCode = 1;
    }
  }
}
