/**
 * 5.1.0-b schedule server module — acceptance checks from the increment spec.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import {
  actionRuns,
  activities,
  activityCostItems,
  companies,
  costItems,
  jobs,
} from "@/db/schema";
import { run } from "@/server/assistant/actions";
import { createSandbox } from "@/server/sandbox";
import type { CurrentUser } from "@/server/session";
import { seedId } from "@/seed";
import {
  editActivity,
  linkCostItem,
  removeHoliday,
  setHoliday,
  unlinkCostItem,
} from "@/server/schedule";

const db = getDb();
const here = dirname(fileURLToPath(import.meta.url));

function user(
  companyId: string,
  role: CurrentUser["role"],
  name: string,
  title: string,
): CurrentUser {
  return {
    userId: seedId(companyId, `user:${role}`),
    companyId,
    name,
    title,
    role,
    companyName: "Demo",
    seededAt: new Date("2026-10-20T17:00:00.000Z"),
    expiresAt: null,
  };
}

async function cedarJobId(companyId: string) {
  const [row] = await db!
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.companyId, companyId), eq(jobs.number, "25-031")))
    .limit(1);
  return row!.id;
}

async function activityRow(companyId: string, code: string) {
  const jobId = await cedarJobId(companyId);
  const [row] = await db!
    .select()
    .from(activities)
    .where(
      and(
        eq(activities.companyId, companyId),
        eq(activities.jobId, jobId),
        eq(activities.code, code),
      ),
    )
    .limit(1);
  return row!;
}

async function costDates(companyId: string, code: string) {
  const jobId = await cedarJobId(companyId);
  const [row] = await db!
    .select({
      plannedStartOn: costItems.plannedStartOn,
      plannedFinishOn: costItems.plannedFinishOn,
      id: costItems.id,
    })
    .from(costItems)
    .where(
      and(
        eq(costItems.companyId, companyId),
        eq(costItems.jobId, jobId),
        eq(costItems.code, code),
      ),
    )
    .limit(1);
  return row!;
}

describe.skipIf(!db)("5.1.0-b schedule writes", () => {
  const created: string[] = [];

  afterAll(async () => {
    for (const id of created) {
      await db!.delete(companies).where(eq(companies.id, id));
    }
  }, 120_000);

  it("cost item dates follow the link; many activities → min start / max finish", async () => {
    const companyId = await createSandbox();
    created.push(companyId);
    const pm = user(companyId, "pm", "Marcus Lee", "Project Manager");

    const c = await activityRow(companyId, "C");
    const b = await activityRow(companyId, "B");

    // Seed already links 04-210 → C; re-link is idempotent and syncs dates.
    const linked = await linkCostItem(companyId, pm, "25-031", {
      activity: "C",
      costCode: "04-210",
    });
    expect(linked.ok).toBe(true);
    if (!linked.ok) return;
    expect(linked.plannedStartOn).toBe(c.earlyStartOn);
    expect(linked.plannedFinishOn).toBe(c.earlyFinishOn);

    const afterUnlink = await unlinkCostItem(companyId, pm, "25-031", {
      activity: "C",
      costCode: "04-210",
    });
    expect(afterUnlink.ok).toBe(true);

    const datesUnlinked = await costDates(companyId, "04-210");
    // No linked activities → dates stay as last synced (rule).
    expect(datesUnlinked.plannedStartOn).toBe(c.earlyStartOn);
    expect(datesUnlinked.plannedFinishOn).toBe(c.earlyFinishOn);

    await linkCostItem(companyId, pm, "25-031", {
      activity: "C",
      costCode: "04-210",
    });
    await linkCostItem(companyId, pm, "25-031", {
      activity: "B",
      costCode: "04-210",
    });
    const both = await costDates(companyId, "04-210");
    const expectStart =
      b.earlyStartOn <= c.earlyStartOn ? b.earlyStartOn : c.earlyStartOn;
    const expectFinish =
      b.earlyFinishOn >= c.earlyFinishOn ? b.earlyFinishOn : c.earlyFinishOn;
    expect(both.plannedStartOn).toBe(expectStart);
    expect(both.plannedFinishOn).toBe(expectFinish);
  }, 120_000);

  it("holiday inside C's span lengthens C and linked 04-210; remove restores", async () => {
    const companyId = await createSandbox();
    created.push(companyId);
    const pm = user(companyId, "pm", "Marcus Lee", "Project Manager");
    const { createWorkingCalendar } = await import("@/lib/working-calendar");
    const { calendarHolidays, jobCalendars } = await import("@/db/schema");

    const before = await activityRow(companyId, "C");
    expect(before.durationDays).toBeGreaterThan(1);

    // Existing Thanksgiving (and any other holidays) stay in the calendar math.
    const holidayRows = await db!
      .select({ on: calendarHolidays.on })
      .from(calendarHolidays)
      .innerJoin(
        jobCalendars,
        eq(jobCalendars.id, calendarHolidays.calendarId),
      )
      .where(eq(jobCalendars.jobId, before.jobId));
    const cal = createWorkingCalendar(holidayRows.map((h) => h.on));
    // Second working day of C's inclusive span — start stays put; finish slips.
    const mid = cal.addWorkingDays(before.earlyStartOn, 1);
    expect(mid < before.earlyFinishOn || mid === before.earlyFinishOn).toBe(
      true,
    );

    const set = await setHoliday(companyId, pm, "25-031", {
      date: mid,
      name: "Mid-span outage",
    });
    expect(set.ok).toBe(true);

    const after = await activityRow(companyId, "C");
    expect(after.earlyStartOn).toBe(before.earlyStartOn);
    expect(after.earlyFinishOn > before.earlyFinishOn).toBe(true);

    await linkCostItem(companyId, pm, "25-031", {
      activity: "C",
      costCode: "04-210",
    });
    const linked = await costDates(companyId, "04-210");
    expect(linked.plannedFinishOn).toBe(after.earlyFinishOn);

    const removed = await removeHoliday(companyId, pm, "25-031", {
      date: mid,
    });
    expect(removed.ok).toBe(true);
    const restored = await activityRow(companyId, "C");
    expect(restored.earlyStartOn).toBe(before.earlyStartOn);
    expect(restored.earlyFinishOn).toBe(before.earlyFinishOn);
  }, 120_000);

  it("draft job 26-010 refuses schedule.addActivity with exact wording", async () => {
    const companyId = await createSandbox();
    created.push(companyId);
    const pm = user(companyId, "pm", "Marcus Lee", "Project Manager");

    const r = await run(pm, "Add activity X on 26-010", "schedule.addActivity", {
      job: "26-010",
      code: "X",
      name: "Should not land",
      durationDays: "2",
      startOn: "2026-11-17",
    });
    expect(r.result.refused).toBe(true);
    expect(r.result.summary).toBe("Approve the estimate before scheduling");
  }, 120_000);

  it("superintendent role refusal chip wording on add activity", async () => {
    const companyId = await createSandbox();
    created.push(companyId);
    const superint = user(
      companyId,
      "superintendent",
      "Ray Dominguez",
      "Superintendent",
    );

    const r = await run(
      superint,
      "Add activity X on 25-031",
      "schedule.addActivity",
      {
        job: "25-031",
        code: "X",
        name: "Nope",
        durationDays: "2",
        startOn: "2026-11-17",
      },
    );
    expect(r.result.refused).toBe(true);
    expect(r.args).toMatchObject({
      job: "25-031",
      refused: true,
    });
    // Rail chip uses labels — mirror acceptance string.
    const { actionRailLabel } = await import("@/lib/assistant/labels");
    expect(
      actionRailLabel("schedule.addActivity", r.result.job, { refused: true }),
    ).toBe("Couldn't add activity on 25-031");
  }, 120_000);

  it("stale version names the other editor (Marcus Lee)", async () => {
    const companyId = await createSandbox();
    created.push(companyId);
    const pm = user(companyId, "pm", "Marcus Lee", "Project Manager");

    const before = await activityRow(companyId, "C");
    const first = await run(
      pm,
      "Edit activity C name (session 1)",
      "schedule.editActivity",
      {
        job: "25-031",
        activity: "C",
        version: String(before.version),
        name: "Pier columns (session 1)",
      },
    );
    expect(first.result.refused).toBeFalsy();
    expect(first.args).toMatchObject({ activity: "C", job: "25-031" });

    // Confirm audit row exists for editor lookup.
    const [audit] = await db!
      .select()
      .from(actionRuns)
      .where(
        and(
          eq(actionRuns.companyId, companyId),
          eq(actionRuns.action, "schedule.editActivity"),
        ),
      )
      .limit(1);
    expect(audit).toBeTruthy();

    const stale = await editActivity(companyId, pm, "25-031", {
      activity: "C",
      version: before.version, // stale
      durationDays: 5,
    });
    expect(stale.ok).toBe(false);
    if (stale.ok) return;
    expect(stale.summary).toContain("Marcus Lee");
    expect(stale.summary).toMatch(/version/i);
  }, 120_000);

  it("summary WBS code is refused at link time", async () => {
    const companyId = await createSandbox();
    created.push(companyId);
    const pm = user(companyId, "pm", "Marcus Lee", "Project Manager");

    const jobId = await cedarJobId(companyId);
    // Demo seed is leaf-only; flip an unused leaf to summary for the refuse check.
    const [probe] = await db!
      .select({ id: costItems.id, code: costItems.code })
      .from(costItems)
      .where(
        and(
          eq(costItems.companyId, companyId),
          eq(costItems.jobId, jobId),
          eq(costItems.isLeaf, true),
          eq(costItems.code, "07-410"),
        ),
      )
      .limit(1);
    expect(probe).toBeTruthy();
    await db!
      .update(costItems)
      .set({ isLeaf: false })
      .where(eq(costItems.id, probe!.id));

    const r = await linkCostItem(companyId, pm, "25-031", {
      activity: "C",
      costCode: probe!.code,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.summary).toMatch(/summary WBS/i);
  }, 120_000);

  it("must-fail: only schedule.ts owns planned_* writes for linked sync", () => {
    const scheduleSrc = readFileSync(join(here, "schedule.ts"), "utf8");
    expect(scheduleSrc).toMatch(
      /export async function syncCostItemDatesFromActivities/,
    );
    expect(scheduleSrc).toMatch(
      /\.set\(\{\s*plannedStartOn:\s*start,\s*plannedFinishOn:\s*finish\s*\}/,
    );

    // progress.ts may *read* item.plannedStartOn inside other updates; it must
    // never assign plannedStartOn: / plannedFinishOn: as set columns.
    const progressSrc = readFileSync(join(here, "progress.ts"), "utf8");
    expect(progressSrc).not.toMatch(/plannedStartOn\s*:/);
    expect(progressSrc).not.toMatch(/plannedFinishOn\s*:/);

    expect(scheduleSrc).toMatch(/activityCostItems/);
    void activityCostItems;
  });
});
