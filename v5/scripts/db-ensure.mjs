// Creates the database named in DATABASE_URL when it does not exist yet.
// Runs as Railway's pre-deploy command, so a fresh environment needs no manual SQL.
// It only ever issues CREATE DATABASE. It never drops or alters anything.
import postgres from "postgres";

export function splitDatabaseUrl(databaseUrl) {
  const url = new URL(databaseUrl);
  const name = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!name) throw new Error("DATABASE_URL has no database name");
  url.pathname = "/postgres";
  return { name, adminUrl: url.toString() };
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
    const { name, created } = await ensureDatabase(databaseUrl);
    console.log(`db:ensure ${name} ${created ? "created" : "already exists"}`);
  }
}
