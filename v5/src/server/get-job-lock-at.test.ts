/**
 * Behavior lock: getJob.lockAt must be the latest locked claim (desc order).
 * MLOCK-ASC (orderBy asc) stayed green when the seed job had a single lock —
 * insert an older claim so asc vs desc diverge.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { getDb, resetDbClient } from "@/db";
import { progressClaims } from "@/db/schema";
import { getJob, lastLockDate } from "@/server/data";
import { createSandbox } from "@/server/sandbox";

describe("getJob.lockAt matches lastLockDate", () => {
  let companyId = "";

  beforeAll(async () => {
    companyId = await createSandbox();
  }, 120_000);

  afterAll(() => {
    resetDbClient();
  });

  it("25-031 (seeded locks): same instant as lastLockDate", async () => {
    const p = await getJob(companyId, "25-031");
    expect(p).toBeTruthy();
    const viaHelper = await lastLockDate(companyId, p!.job.id);
    expect(viaHelper).toBeInstanceOf(Date);
    expect(p!.lockAt).toBeInstanceOf(Date);
    expect(p!.lockAt!.getTime()).toBe(viaHelper!.getTime());
  });

  it("26-010 (draft, never locked): both null", async () => {
    const p = await getJob(companyId, "26-010");
    expect(p).toBeTruthy();
    const viaHelper = await lastLockDate(companyId, p!.job.id);
    expect(viaHelper).toBeNull();
    expect(p!.lockAt).toBeNull();
  });

  it("must-fail MLOCK-ASC: newest locked_at wins when multiple locks exist", async () => {
    const db = getDb();
    expect(db).toBeTruthy();
    const p0 = await getJob(companyId, "25-031");
    expect(p0?.lockAt).toBeInstanceOf(Date);
    const jobId = p0!.job.id;
    const newest = p0!.lockAt!;
    const older = new Date(newest.getTime() - 86_400_000);

    await db!.insert(progressClaims).values({
      id: randomUUID(),
      companyId,
      jobId,
      periodLabel: "Period 0 (older lock for MLOCK-ASC)",
      status: "locked",
      lockedAt: older,
      lockedById: null,
    });

    const viaHelper = await lastLockDate(companyId, jobId);
    const viaGetJob = await getJob(companyId, "25-031");
    expect(viaHelper!.getTime()).toBe(newest.getTime());
    expect(viaGetJob!.lockAt!.getTime()).toBe(newest.getTime());
    // Explicitly not the older row — asc order would pick this.
    expect(viaGetJob!.lockAt!.getTime()).toBeGreaterThan(older.getTime());

    await db!
      .delete(progressClaims)
      .where(
        and(
          eq(progressClaims.companyId, companyId),
          eq(progressClaims.jobId, jobId),
          eq(progressClaims.periodLabel, "Period 0 (older lock for MLOCK-ASC)"),
        ),
      );
  });
});
