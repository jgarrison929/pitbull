// Applies the committed Drizzle migrations in ./drizzle. Runs in Railway's pre-deploy step after db:ensure.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.log("db:migrate skipped, DATABASE_URL is not set");
} else {
  const client = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  const folder = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "drizzle");
  await migrate(drizzle(client), { migrationsFolder: folder });
  await client.end();
  console.log("db:migrate up to date");
}
