import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireDb } from "@/db";
import { companies } from "@/db/schema";
import { requireUser } from "@/server/session";
import { ensureStressJob } from "@/server/sandbox";

/**
 * Opt-in 10k stress WBS for the current sandbox. Used by stress-typeahead e2e
 * so default demo seed / Reset demo stay fast (no V5_SEED_STRESS on webServer).
 */
export async function POST() {
  const user = await requireUser();
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
