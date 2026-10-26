import { readFileSync } from "node:fs";
import { and, asc, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import {
  activities,
  activityCostItems,
  calendarHolidays,
  companies,
  jobCalendars,
  jobs,
} from "@/db/schema";
import { SCHEDULE_IMPORT_MAX_BYTES } from "@/lib/schedule-import";
import { createSandbox } from "./sandbox";
import {
  clearJobActivitiesForTests,
  importXerSchedule,
} from "./schedule-import";

const db = getDb();
const created: string[] = [];
const fixture = (name: string) =>
  readFileSync(
    new URL(`../../fixtures/schedule/${name}`, import.meta.url),
  );

async function sandbox() {
  const companyId = await createSandbox();
  created.push(companyId);
  return companyId;
}

describe.skipIf(!db)("importXerSchedule", () => {
  afterAll(async () => {
    for (const id of created)
      await db!.delete(companies).where(eq(companies.id, id));
  });

  it("imports cedar-ok onto a cleared approved job (replace)", async () => {
    const companyId = await sandbox();
    await clearJobActivitiesForTests(companyId, "25-031");

    const beforeLinks = await db!
      .select({ n: activityCostItems.activityId })
      .from(activityCostItems)
      .innerJoin(activities, eq(activities.id, activityCostItems.activityId))
      .innerJoin(jobs, eq(jobs.id, activities.jobId))
      .where(and(eq(jobs.companyId, companyId), eq(jobs.number, "25-031")));
    expect(beforeLinks).toHaveLength(0);

    const r = await importXerSchedule(
      companyId,
      "25-031",
      fixture("cedar-ok.xer"),
      "replace",
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.activityCount).toBe(5);
    expect(r.holidayCount).toBe(1);
    expect(r.skipped.map((s) => s.kind).sort()).toEqual([
      "constraint",
      "milestone",
      "unsupported_link_type",
    ]);
    expect(r.summary).toContain("5 activities");
    expect(r.summary).toMatch(/Skipped:/);

    const rows = await db!
      .select()
      .from(activities)
      .innerJoin(jobs, eq(jobs.id, activities.jobId))
      .where(and(eq(jobs.companyId, companyId), eq(jobs.number, "25-031")))
      .orderBy(asc(activities.code));
    expect(rows.map((r) => r.activities.code)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
    ]);
    expect(rows.find((r) => r.activities.code === "A")?.activities).toMatchObject(
      {
        name: "Drive piles",
        durationDays: 5,
      },
    );

    // No Schedule ID → cost-item coupling (C34 refused).
    const costLinks = await db!
      .select({ activityId: activityCostItems.activityId })
      .from(activityCostItems)
      .innerJoin(activities, eq(activities.id, activityCostItems.activityId))
      .innerJoin(jobs, eq(jobs.id, activities.jobId))
      .where(and(eq(jobs.companyId, companyId), eq(jobs.number, "25-031")));
    expect(costLinks).toHaveLength(0);

    const [jobRow] = await db!
      .select()
      .from(jobs)
      .where(and(eq(jobs.companyId, companyId), eq(jobs.number, "25-031")));
    const [cal] = await db!
      .select()
      .from(jobCalendars)
      .where(eq(jobCalendars.jobId, jobRow.id));
    const holidays = await db!
      .select()
      .from(calendarHolidays)
      .where(eq(calendarHolidays.calendarId, cal.id));
    expect(holidays).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ on: "2026-11-26", name: "Thanksgiving" }),
      ]),
    );
  });

  it("writes nothing when a relationship points at a missing activity id", async () => {
    const companyId = await sandbox();
    // Leave seed activities so we can prove they survive.
    const before = await db!
      .select({ code: activities.code })
      .from(activities)
      .innerJoin(jobs, eq(jobs.id, activities.jobId))
      .where(and(eq(jobs.companyId, companyId), eq(jobs.number, "25-031")))
      .orderBy(asc(activities.code));
    expect(before.map((r) => r.code)).toEqual(["A", "B", "C", "D", "E"]);

    const r = await importXerSchedule(
      companyId,
      "25-031",
      fixture("cedar-missing-pred.xer"),
      "replace",
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.summary).toMatch(/missing predecessor "999"/);
    expect(r.summary).toMatch(/D/);

    const after = await db!
      .select({ code: activities.code })
      .from(activities)
      .innerJoin(jobs, eq(jobs.id, activities.jobId))
      .where(and(eq(jobs.companyId, companyId), eq(jobs.number, "25-031")))
      .orderBy(asc(activities.code));
    expect(after.map((r) => r.code)).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("refuses draft-estimate Harbor with estimate wording", async () => {
    const companyId = await sandbox();
    const r = await importXerSchedule(
      companyId,
      "26-010",
      fixture("cedar-ok.xer"),
      "replace",
    );
    expect(r).toMatchObject({
      ok: false,
      reason: "draft_estimate",
    });
    if (r.ok) return;
    expect(r.summary).toMatch(/Approve the estimate before scheduling/);
  });

  it("refuses files over 10 MB before parse", async () => {
    const companyId = await sandbox();
    const r = await importXerSchedule(
      companyId,
      "25-031",
      new Uint8Array(SCHEDULE_IMPORT_MAX_BYTES + 1),
      "replace",
    );
    expect(r).toMatchObject({ ok: false, reason: "too_large" });
  });
});
