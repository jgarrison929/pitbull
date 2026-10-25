import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { appSettings } from "@/db/schema";
import { isFullCommitSha } from "@/lib/stamp-guards";

export const LAST_VERIFY_KEY = "last_verify_at";
export const LAST_VERIFY_COMMIT_KEY = "last_verify_commit";

async function readAppSetting(
  key: string,
): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const [row] = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, key))
      .limit(1);
    return row?.value ?? null;
  } catch {
    return null;
  }
}

/** ISO timestamp of the last successful verify-v5 stamp, or null when never recorded. */
export async function readLastVerifyAt(
  env: Record<string, string | undefined> = process.env,
): Promise<string | null> {
  const fromEnv = env.LAST_VERIFY_AT?.trim();
  if (fromEnv) {
    const t = Date.parse(fromEnv);
    if (Number.isFinite(t)) return new Date(t).toISOString();
  }
  return readAppSetting(LAST_VERIFY_KEY);
}

/** Full commit SHA from the last verify-v5 stamp, or null when never recorded. */
export async function readLastVerifyCommit(
  env: Record<string, string | undefined> = process.env,
): Promise<string | null> {
  const fromEnv = env.LAST_VERIFY_COMMIT?.trim();
  if (fromEnv) return fromEnv;
  return readAppSetting(LAST_VERIFY_COMMIT_KEY);
}

/** Persists a successful verify run. Caller must authorize. Commit must be a full 40-char SHA. */
export async function writeLastVerifyAt(at: Date, commit: string) {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL is not set");
  const full = commit.trim();
  if (!isFullCommitSha(full)) {
    throw new Error("commit must be a full 40-character SHA");
  }
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
      key: LAST_VERIFY_COMMIT_KEY,
      value: full,
      updatedAt: at,
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: full, updatedAt: at },
    });
  return iso;
}
