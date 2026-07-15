import { describe, it, expect } from "vitest";
import { summarizePinFlush, pinFlushToastCopy, selectPlanPinQueueItems } from "./plan-pin-flush";

describe("plan-pin-flush (3.2.4)", () => {
  it("summarizes success and failures honestly", () => {
    const r = summarizePinFlush([
      { id: "1", projectId: "p", status: "success" },
      { id: "2", projectId: "p", status: "failed", error: "offline" },
    ]);
    expect(r.succeeded).toBe(1);
    expect(r.failed).toBe(1);
    expect(pinFlushToastCopy(r)).toMatch(/Synced 1, failed 1/);
  });
  it("selects plan-pin-rfi queue items", () => {
    expect(selectPlanPinQueueItems([{ type: "plan-pin-rfi" }, { type: "daily-report" }])).toHaveLength(1);
  });
});
