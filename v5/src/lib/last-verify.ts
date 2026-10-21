import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { appSettings } from "@/db/schema";

export const LAST_VERIFY_KEY = "last_verify_at";

/** ISO timestamp of the last successful verify-v5 stamp, or null when never recorded. */
export async function readLastVerifyAt(
  env: Record<string, string | undefined> = process.env,
): Promise<string | null> {
  const fromEnv = env.LAST_VERIFY_AT?.trim();
  if (fromEnv) {
    const t = Date.parse(fromEnv);
    if (Number.isFinite(t)) return new Date(t).toISOString();
  }
  const db = getDb();
  if (!db) return null;
  try {
    const [row] = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, LAST_VERIFY_KEY))
      .limit(1);
    return row?.value ?? null;
  } catch {
    return null;
  }
}

/** Persists a successful verify run. Caller must authorize. */
export async function writeLastVerifyAt(at: Date, commit: string) {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL is not set");
  const iso = at.toISOString();
  await db
    .insert(appSettings)
    .values({
      key: LAST_VERIFY_KEY,
      value: iso,
      updatedAt: at,
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: iso, updatedAt: at },
    });
  await db
    .insert(appSettings)
    .values({
      key: "last_verify_commit",
      value: commit.slice(0, 12),
      updatedAt: at,
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: commit.slice(0, 12), updatedAt: at },
    });
  return iso;
}
