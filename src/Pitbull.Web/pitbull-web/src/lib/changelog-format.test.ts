import { describe, expect, it } from "vitest";
import { formatReleasePublished } from "./changelog";

describe("formatReleasePublished", () => {
  it("returns null for empty", () => {
    expect(formatReleasePublished(null)).toBeNull();
    expect(formatReleasePublished("")).toBeNull();
  });

  it("formats date-only without inventing a wall-clock time", () => {
    const s = formatReleasePublished("2026-07-10");
    expect(s).toBeTruthy();
    expect(s).toMatch(/2026/);
    // Should not force a clock time for date-only stamps
    expect(s).not.toMatch(/\d{1,2}:\d{2}/);
  });

  it("formats ISO datetime with a time component", () => {
    const s = formatReleasePublished("2026-07-10T11:03:00-07:00");
    expect(s).toBeTruthy();
    expect(s).toMatch(/2026/);
    expect(s).toMatch(/\d{1,2}:\d{2}/);
  });
});
