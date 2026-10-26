import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb, requireDb } from "@/db";
import {
  activities,
  activityCostItems,
  calendarHolidays,
  companies,
  jobCalendars,
  jobs,
} from "@/db/schema";
import { createSandbox } from "@/server/sandbox";

describe.skipIf(!getDb())("5.1.0-a schedule schema + seed (DB)", () => {
  const created: string[] = [];

  afterAll(async () => {
    const db = getDb();
    if (!db) return;
    for (const id of created) {
      await db.delete(companies).where(eq(companies.id, id));
    }
  }, 120_000);

  it(
    "migrate tables exist; seed loads A–E on 25-031; Harbor has zero",
    async () => {
      const db = requireDb();
      const companyId = await createSandbox();
      created.push(companyId);

      const tables = await db.execute<{ name: string }>(sql`
        select c.relname as name
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relkind = 'r'
          and c.relname in (
            'job_calendars',
            'calendar_holidays',
            'activities',
            'activity_cost_items'
          )
        order by 1`);
      expect(tables.map((t) => t.name).sort()).toEqual([
        "activities",
        "activity_cost_items",
        "calendar_holidays",
        "job_calendars",
      ]);

      const cedar = await db
        .select()
        .from(jobs)
        .where(eq(jobs.number, "25-031"));
      const cedarId = cedar.find((j) => j.companyId === companyId)!.id;

      const acts = await db
        .select()
        .from(activities)
        .where(eq(activities.jobId, cedarId));
      expect(acts.map((a) => a.code).sort()).toEqual(["A", "B", "C", "D", "E"]);

      const cals = await db
        .select()
        .from(jobCalendars)
        .where(eq(jobCalendars.jobId, cedarId));
      expect(cals).toHaveLength(1);
      const holidays = await db
        .select()
        .from(calendarHolidays)
        .where(eq(calendarHolidays.calendarId, cals[0]!.id));
      expect(holidays).toHaveLength(1);

      const links = await db
        .select()
        .from(activityCostItems)
        .where(eq(activityCostItems.companyId, companyId));
      expect(links.length).toBeGreaterThanOrEqual(4);

      const harbor = await db
        .select()
        .from(jobs)
        .where(eq(jobs.number, "26-010"));
      const harborId = harbor.find((j) => j.companyId === companyId)!.id;
      const harborActs = await db
        .select()
        .from(activities)
        .where(eq(activities.jobId, harborId));
      expect(harborActs).toHaveLength(0);
    },
    120_000,
  );
});
