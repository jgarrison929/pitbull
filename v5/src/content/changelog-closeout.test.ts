import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { changelog } from "./changelog";
import { shipped } from "./roadmap";

const pkg = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as { version: string };

const lock = JSON.parse(
  readFileSync(new URL("../../package-lock.json", import.meta.url), "utf8"),
) as { version: string; packages?: { "": { version?: string } } };

const rootVersion = readFileSync(
  new URL("../../../VERSION", import.meta.url),
  "utf8",
).trim();

/** Spec release-closeout item copy (5.0.2 Parts A–C). */
const CLOSEOUT_502_ITEMS = [
  "Crew labor rates on Bridge Crew 2 ($92.50), Culvert Crew A ($78.00), and Interchange Crew 1 ($88.00). Approve posts hours × that rate.",
  "Thirty working days of seeded approved daily reports per active job, including one Cedar plan returned for Recount pour 3 then approved.",
  "Cost item and plan drill-down pages, plus a full job change list beyond the last 20 entries.",
] as const;

describe("5.0.2 release closeout", () => {
  it("stamps package.json, root VERSION, and changelog[0] as 5.0.2", () => {
    expect(pkg.version).toBe("5.0.2");
    expect(rootVersion).toBe("5.0.2");
    expect(changelog[0]?.version).toBe("5.0.2");
    expect(changelog[0]?.date).toBe("2026-10-26");
  });

  it("must-fail: package-lock.json version must match package.json and VERSION", () => {
    // #723 follow-up: bumping package.json/VERSION without the lockfile stayed green.
    expect(lock.version).toBe(pkg.version);
    expect(lock.version).toBe(rootVersion);
    expect(lock.packages?.[""]?.version).toBe(pkg.version);
    expect(lock.packages?.[""]?.version).toBe(rootVersion);
  });

  it("keeps the Parts A–C changelog items in plain user language", () => {
    expect(changelog[0]?.items).toEqual([...CLOSEOUT_502_ITEMS]);
  });

  it("must-fail: omitting a Part A–C bullet is not a valid closeout", () => {
    const items = changelog[0]?.items ?? [];
    for (const required of CLOSEOUT_502_ITEMS) {
      expect(items, `missing: ${required.slice(0, 40)}…`).toContain(required);
    }
    expect(items).toHaveLength(CLOSEOUT_502_ITEMS.length);
  });

  it("must-fail: announcing 5.0.2 early (still under Next) is refused", () => {
    expect(shipped[0]?.version).toBe("5.0.2");
    expect(shipped.map((r) => r.version)).toContain("5.0.2");
  });
});
