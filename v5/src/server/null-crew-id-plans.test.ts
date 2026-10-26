import { describe, expect, it } from "vitest";

/**
 * Expand-window coverage (null crew_id + text crew coalesce) lived here for
 * 0013. Migration 0019 drops that shape — see 0019_crews_contract.test.ts for
 * NOT NULL + create path + must-fail without backfill.
 */
describe("null crew_id expand window (retired by 0019)", () => {
  it("documents that 0019 owns the contract", () => {
    expect(true).toBe(true);
  });
});
