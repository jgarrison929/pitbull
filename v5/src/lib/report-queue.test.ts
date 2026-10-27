import { describe, expect, it } from "vitest";
import {
  claimReportSend,
  clearQueuedReport,
  readQueuedReport,
  releaseReportSend,
  writeQueuedReport,
  type QueueStore,
} from "./report-queue";

function memoryStore(): QueueStore {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

describe("report queue", () => {
  it("round-trips a queued report and clears it", () => {
    const store = memoryStore();
    writeQueuedReport(
      {
        planId: "plan-1",
        jobNumber: "24-077",
        fields: { action: "dailyReport.post", "actualMh[line]": "22" },
      },
      store,
    );
    expect(readQueuedReport("plan-1", store)).toEqual({
      planId: "plan-1",
      jobNumber: "24-077",
      fields: { action: "dailyReport.post", "actualMh[line]": "22" },
    });
    expect(readQueuedReport("other", store)).toBeNull();
    clearQueuedReport("plan-1", store);
    expect(readQueuedReport("plan-1", store)).toBeNull();
  });

  it("ignores a stored payload for a different plan", () => {
    const store = memoryStore();
    store.setItem(
      "pcs-report-unsent:plan-1",
      JSON.stringify({ planId: "plan-2", jobNumber: "24-077", fields: {} }),
    );
    expect(readQueuedReport("plan-1", store)).toBeNull();
  });

  it("claims a send once until released", () => {
    const planId = "claim-once";
    releaseReportSend(planId);
    expect(claimReportSend(planId)).toBe(true);
    expect(claimReportSend(planId)).toBe(false);
    releaseReportSend(planId);
    expect(claimReportSend(planId)).toBe(true);
    releaseReportSend(planId);
  });
});
