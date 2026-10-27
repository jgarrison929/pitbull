/**
 * Behavior lock: getJob.lockAt must match lastLockDate for seeded locked jobs.
 * A broken correlated scalar (Drizzle binding jobs.id as a param) returned
 * null and EV cutoff fell back to asOf — job-page visuals drifted ~16px.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetDbClient } from "@/db";
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
});
