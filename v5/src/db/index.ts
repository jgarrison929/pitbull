import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

let db: Db | null = null;

/** Returns the shared Drizzle client, or null when DATABASE_URL is not set. */
export function getDb(): Db | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  db ??= drizzle(postgres(url, { max: 5 }), { schema });
  return db;
}

/** A ping for checkHealth, or null when no database is configured. */
export function dbPing(): (() => Promise<void>) | null {
  const client = getDb();
  if (!client) return null;
  return async () => {
    await client.execute(sql`select 1`);
  };
}
