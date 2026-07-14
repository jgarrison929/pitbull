import { describe, expect, it } from "vitest";
import {
  isPlanBinaryCached,
  planBinaryCacheKey,
  planBinaryKeysToEvict,
  planOfflineAvailabilityLabel,
  MAX_PLAN_BINARIES_PER_PROJECT,
} from "./plan-binary-cache";

describe("planBinaryCacheKey", () => {
  it("builds stable project+file key", () => {
    expect(planBinaryCacheKey("proj-a", "file-1")).toBe("proj-a::file-1");
  });

  it("rejects empty ids", () => {
    expect(() => planBinaryCacheKey("", "f")).toThrow(/required/i);
  });
});

describe("isPlanBinaryCached", () => {
  it("detects cached vs not without implying whole set", () => {
    const keys = new Set([planBinaryCacheKey("p", "a")]);
    expect(isPlanBinaryCached(keys, "p", "a")).toBe(true);
    expect(isPlanBinaryCached(keys, "p", "b")).toBe(false);
    expect(planOfflineAvailabilityLabel(false)).toMatch(/Not offline/i);
    expect(planOfflineAvailabilityLabel(true)).toMatch(/Saved offline/i);
  });
});

describe("planBinaryKeysToEvict", () => {
  it("evicts oldest beyond per-project cap", () => {
    const entries = Array.from({ length: MAX_PLAN_BINARIES_PER_PROJECT + 3 }, (_, i) => ({
      key: `p::f${i}`,
      projectId: "p",
      size: 1000,
      savedAt: new Date(Date.UTC(2026, 0, i + 1)).toISOString(),
    }));
    const drop = planBinaryKeysToEvict(entries, {
      maxPerProject: MAX_PLAN_BINARIES_PER_PROJECT,
      maxTotalBytes: 100_000_000,
    });
    expect(drop.length).toBe(3);
    // oldest (lowest day) should be dropped
    expect(drop).toContain("p::f0");
  });

  it("evicts when total byte budget exceeded", () => {
    const entries = [
      { key: "p::a", projectId: "p", size: 800, savedAt: "2026-01-02T00:00:00Z" },
      { key: "p::b", projectId: "p", size: 800, savedAt: "2026-01-01T00:00:00Z" },
    ];
    const drop = planBinaryKeysToEvict(entries, {
      maxPerProject: 10,
      maxTotalBytes: 1000,
    });
    expect(drop).toContain("p::b");
    expect(drop).not.toContain("p::a");
  });
});
