import { describe, expect, it } from "vitest";
import { changelogHasMore, formatReleasePublished, type ChangelogResponse } from "./changelog";

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

describe("changelogHasMore", () => {
  const base = (partial: Partial<ChangelogResponse>): ChangelogResponse => ({
    appVersion: "3.7.7",
    sourcePath: "CHANGELOG.md",
    releases: Array.from({ length: partial.releases?.length ?? 0 }, (_, i) => ({
      version: `1.0.${i}`,
      date: null,
      added: [],
      changed: [],
      fixed: [],
      security: [],
      removed: [],
      deprecated: [],
    })),
    totalCount: 0,
    offset: 0,
    limit: null,
    ...partial,
  });

  it("is true when more releases remain after this page", () => {
    expect(
      changelogHasMore(
        base({
          releases: Array.from({ length: 12 }, () => ({
            version: "x",
            date: null,
            added: [],
            changed: [],
            fixed: [],
            security: [],
            removed: [],
            deprecated: [],
          })),
          offset: 0,
          totalCount: 100,
          limit: 12,
        })
      )
    ).toBe(true);
  });

  it("is false on the last page", () => {
    expect(
      changelogHasMore(
        base({
          releases: Array.from({ length: 4 }, () => ({
            version: "x",
            date: null,
            added: [],
            changed: [],
            fixed: [],
            security: [],
            removed: [],
            deprecated: [],
          })),
          offset: 96,
          totalCount: 100,
          limit: 12,
        })
      )
    ).toBe(false);
  });
});
