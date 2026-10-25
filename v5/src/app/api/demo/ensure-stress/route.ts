import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireDb } from "@/db";
import { companies } from "@/db/schema";
import { getCurrentUser } from "@/server/session";
import { ensureStressJob } from "@/server/sandbox";

/** Explicit opt-in. Off by default (Railway); set in Playwright / local e2e only. */
export function isEnsureStressAllowed(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.V5_ALLOW_ENSURE_STRESS === "1";
}

/**
 * Opt-in 10k stress WBS for the current sandbox. Used by stress-typeahead e2e
 * so default demo seed / Reset demo stay fast (no V5_SEED_STRESS on webServer).
 * Returns 404 unless V5_ALLOW_ENSURE_STRESS=1.
 */
export async function POST() {
  if (!isEnsureStressAllowed()) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = requireDb();
  const [company] = await db
    .select({ isSandbox: companies.isSandbox })
    .from(companies)
    .where(eq(companies.id, user.companyId))
    .limit(1);
  if (!company?.isSandbox) {
    return NextResponse.json({ error: "sandbox only" }, { status: 403 });
  }
  const result = await ensureStressJob(user.companyId);
  return NextResponse.json({ ok: true, ...result });
}
