/**
 * MCO-LOCK guard: listChangeOrders must honor opts.lockAt (skip lastLockDate).
 * Verify mutant that ignores the passed lockAt stayed GREEN — catch it here.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getDbQueryCount, resetDbClient, resetDbQueryCount } from "@/db";
import { listChangeOrders } from "@/server/change-orders";
import * as data from "@/server/data";
import { getJob } from "@/server/data";
import { createSandbox } from "@/server/sandbox";

describe("listChangeOrders lockAt reuse", () => {
  let companyId = "";

  beforeAll(async () => {
    await resetDbClient();
    companyId = await createSandbox();
  }, 120_000);

  afterAll(() => {
    resetDbClient();
  });

  it("must-fail MCO-LOCK: opts.lockAt skips lastLockDate (spy)", async () => {
    const p = await getJob(companyId, "24-077");
    expect(p).toBeTruthy();
    // 24-077 has a priced CO — without lockAt, lastLockDate would run.
    expect(p!.lockAt).toBeInstanceOf(Date);

    const spy = vi.spyOn(data, "lastLockDate");
    try {
      const co = await listChangeOrders(companyId, "24-077", {
        job: p!.job,
        ledgerSums: {
          original: p!.money.job.obCents,
          current: p!.money.job.cbCents,
        },
        lockAt: p!.lockAt,
      });
      expect(co).toBeTruthy();
      expect(co!.changeOrders.some((o) => o.status === "priced")).toBe(true);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it("must-fail MCO-LOCK: omitting lockAt still loads lastLockDate for priced COs", async () => {
    const p = await getJob(companyId, "24-077");
    expect(p).toBeTruthy();
    const spy = vi.spyOn(data, "lastLockDate");
    try {
      await listChangeOrders(companyId, "24-077", {
        job: p!.job,
        ledgerSums: {
          original: p!.money.job.obCents,
          current: p!.money.job.cbCents,
        },
      });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(companyId, p!.job.id);
    } finally {
      spy.mockRestore();
    }
  });

  it("must-fail MCO-LOCK: lockAt path issues fewer queries than lastLockDate path", async () => {
    const p = await getJob(companyId, "24-077");
    expect(p).toBeTruthy();
    const optsBase = {
      job: p!.job,
      ledgerSums: {
        original: p!.money.job.obCents,
        current: p!.money.job.cbCents,
      },
    };

    resetDbQueryCount();
    await listChangeOrders(companyId, "24-077", {
      ...optsBase,
      lockAt: p!.lockAt,
    });
    const withLock = getDbQueryCount();

    resetDbQueryCount();
    await listChangeOrders(companyId, "24-077", optsBase);
    const withoutLock = getDbQueryCount();

    expect(withLock).toBeLessThan(withoutLock);
  });
});
