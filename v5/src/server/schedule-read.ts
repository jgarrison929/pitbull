import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { requireDb } from "@/db";
import { activities } from "@/db/schema";

/** Read-only activity list for the Schedule page (early-start order). */
export async function listJobActivities(companyId: string, jobId: string) {
  const db = requireDb();
  return db
    .select({
      id: activities.id,
      code: activities.code,
      name: activities.name,
      durationDays: activities.durationDays,
      earlyStartOn: activities.earlyStartOn,
      earlyFinishOn: activities.earlyFinishOn,
    })
    .from(activities)
    .where(
      and(eq(activities.companyId, companyId), eq(activities.jobId, jobId)),
    )
    .orderBy(asc(activities.earlyStartOn), asc(activities.code));
}
