import { describe, expect, it } from "vitest";
import {
  formatMigrationsLabel,
  journalWhenStrictlyIncreases,
  loadMigrationJournal,
  namesForAppliedRows,
} from "./applied-migrations";

describe("namesForAppliedRows", () => {
  const journal = [
    { tag: "0000_init", when: 100 },
    { tag: "0001_sandbox_visitor", when: 200 },
  ];

  it("maps created_at to journal tags in order", () => {
    expect(
      namesForAppliedRows(
        [{ created_at: 100 }, { created_at: "200" }],
        journal,
      ),
    ).toEqual(["0000_init", "0001_sandbox_visitor"]);
  });

  it("must-fail: a foreign created_at is never silently dropped or renamed to a real tag", () => {
    const names = namesForAppliedRows([{ created_at: 999 }], journal);
    expect(names).toEqual(["unknown:999"]);
    expect(names.some((n) => journal.some((j) => j.tag === n))).toBe(false);
  });
});

describe("formatMigrationsLabel", () => {
  it("labels not-configured, empty, and joined names", () => {
    expect(formatMigrationsLabel(null)).toBe("not-configured");
    expect(formatMigrationsLabel([])).toBe("(none)");
    expect(formatMigrationsLabel(["0000_init", "0001_sandbox_visitor"])).toBe(
      "0000_init, 0001_sandbox_visitor",
    );
  });

  it("must-fail: unreadable migrations must not look like an empty DB", () => {
    expect(formatMigrationsLabel("unavailable")).toBe("unavailable");
    expect(formatMigrationsLabel("unavailable")).not.toBe("(none)");
    expect(formatMigrationsLabel([])).not.toBe("unavailable");
  });
});

describe("loadMigrationJournal", () => {
  it("reads every committed v5 migration tag from drizzle/meta/_journal.json", () => {
    const entries = loadMigrationJournal();
    const tags = entries.map((e) => e.tag);
    expect(tags[0]).toBe("0000_init");
    expect(tags).toContain("0012_drop_average_performance");
    expect(tags).toContain("0017_average_performance");
    expect(new Set(tags).size).toBe(tags.length);
  });

  it("journal when values strictly increase with idx", () => {
    const entries = loadMigrationJournal();
    expect(journalWhenStrictlyIncreases(entries)).toBe(true);
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i]!.when).toBeGreaterThan(entries[i - 1]!.when);
      if (
        typeof entries[i]!.idx === "number" &&
        typeof entries[i - 1]!.idx === "number"
      ) {
        expect(entries[i]!.idx).toBeGreaterThan(entries[i - 1]!.idx!);
      }
    }
  });
});

describe("journalWhenStrictlyIncreases", () => {
  it("accepts rising when (and idx) in order", () => {
    expect(
      journalWhenStrictlyIncreases([
        { tag: "a", when: 100, idx: 0 },
        { tag: "b", when: 200, idx: 1 },
        { tag: "c", when: 300, idx: 2 },
      ]),
    ).toBe(true);
  });

  it("must-fail: a lower stamp after a higher one is refused", () => {
    // Mirrors the #726/#728 collision: 0017 @ 1793000000000 then 0018 with a
    // smaller when would be silently skipped by the migrator.
    expect(
      journalWhenStrictlyIncreases([
        { tag: "0017_average_performance", when: 1793000000000, idx: 17 },
        { tag: "0018_daily_plan_events", when: 1792951797052, idx: 18 },
      ]),
    ).toBe(false);
  });

  it("must-fail: equal when values are refused", () => {
    expect(
      journalWhenStrictlyIncreases([
        { tag: "a", when: 100, idx: 0 },
        { tag: "b", when: 100, idx: 1 },
      ]),
    ).toBe(false);
  });

  it("must-fail: non-rising idx is refused when idx is present", () => {
    expect(
      journalWhenStrictlyIncreases([
        { tag: "a", when: 100, idx: 20 },
        { tag: "b", when: 200, idx: 20 },
      ]),
    ).toBe(false);
  });
});
