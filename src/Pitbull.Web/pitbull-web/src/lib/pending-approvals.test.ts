import { describe, expect, it } from "vitest";
import {
  normalizePendingApprovals,
  pendingApprovalsEmptyCopy,
} from "./pending-approvals";

describe("pending-approvals (2.21.6)", () => {
  it("normalizes camelCase and PascalCase API payloads", () => {
    const a = normalizePendingApprovals({
      total: 3,
      timeEntries: 2,
      changeOrders: 1,
      expandedLifecycle: "timeEntries",
      truthNote: "live",
    });
    expect(a.total).toBe(3);
    expect(a.timeEntries).toBe(2);
    expect(a.changeOrders).toBe(1);

    const b = normalizePendingApprovals({
      Total: 1,
      TimeEntries: 1,
      ChangeOrders: 0,
    });
    expect(b.total).toBe(1);
    expect(b.timeEntries).toBe(1);
  });

  it("honest empty copy is not vanity badge fiction", () => {
    expect(pendingApprovalsEmptyCopy().toLowerCase()).toMatch(/empty|no pending/);
    expect(pendingApprovalsEmptyCopy().toLowerCase()).not.toMatch(/all clear|green/);
  });
});
