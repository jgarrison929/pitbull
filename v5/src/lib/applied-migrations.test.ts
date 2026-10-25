import { describe, expect, it } from "vitest";
import {
  formatMigrationsLabel,
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
});
