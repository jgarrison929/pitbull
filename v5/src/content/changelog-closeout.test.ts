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

/** 5.0.3 release items (Parts B to F, #29, #16). */
const CLOSEOUT_503_ITEMS = [
  "A project manager can set each cost item's forecast to Current Budget or Average Performance (AC ÷ percent complete) on its cost item page or from the assistant. An item with 0% complete keeps the Current Budget value and is labeled as a fallback.",
  "A Light and Dark theme switch in the user menu. The choice is remembered, so pages load in the chosen theme without a flash.",
  "Each daily plan's history lists every submit, return, and approve with the role and the time, including the Cedar plan returned for Recount pour 3 then approved.",
  "Every daily plan belongs to a crew record. Asking the assistant for a plan on a job that does not exist is refused and offers up to three of your approved jobs.",
  "Faster job pages: cost item pages no longer wait on link prefetch, analytics load after the page, and the foreman's job page runs fewer queries.",
] as const;

const entry502 = changelog.find((e) => e.version === "5.0.2");

describe("5.0.3 release closeout", () => {
  it("stamps package.json, root VERSION, and changelog[0] as 5.0.3", () => {
    expect(pkg.version).toBe("5.0.3");
    expect(rootVersion).toBe("5.0.3");
    expect(changelog[0]?.version).toBe("5.0.3");
    expect(changelog[0]?.date).toBe("2026-10-26");
  });

  it("must-fail: package-lock.json version must match package.json and VERSION", () => {
    // #723 follow-up: bumping package.json/VERSION without the lockfile stayed green.
    expect(lock.version).toBe(pkg.version);
    expect(lock.version).toBe(rootVersion);
    expect(lock.packages?.[""]?.version).toBe(pkg.version);
    expect(lock.packages?.[""]?.version).toBe(rootVersion);
  });

  it("keeps the 5.0.3 changelog items in plain user language", () => {
    expect(changelog[0]?.items).toEqual([...CLOSEOUT_503_ITEMS]);
  });

  it("must-fail: omitting a 5.0.3 bullet is not a valid closeout", () => {
    const items = changelog[0]?.items ?? [];
    for (const required of CLOSEOUT_503_ITEMS) {
      expect(items, `missing: ${required.slice(0, 40)}…`).toContain(required);
    }
    expect(items).toHaveLength(CLOSEOUT_503_ITEMS.length);
  });

  it("must-fail: announcing 5.0.3 early (still under Next) is refused", () => {
    expect(shipped[0]?.version).toBe("5.0.3");
    expect(shipped.map((r) => r.version)).toContain("5.0.3");
  });
});

describe("5.0.2 release closeout", () => {
  it("keeps the 5.0.2 changelog entry dated 2026-10-26, right after 5.0.3", () => {
    expect(changelog[1]?.version).toBe("5.0.2");
    expect(entry502?.date).toBe("2026-10-26");
  });

  it("keeps the Parts A–C changelog items in plain user language", () => {
    expect(entry502?.items).toEqual([...CLOSEOUT_502_ITEMS]);
  });

  it("must-fail: omitting a Part A–C bullet is not a valid closeout", () => {
    const items = entry502?.items ?? [];
    for (const required of CLOSEOUT_502_ITEMS) {
      expect(items, `missing: ${required.slice(0, 40)}…`).toContain(required);
    }
    expect(items).toHaveLength(CLOSEOUT_502_ITEMS.length);
  });

  it("must-fail: dropping 5.0.2 from shipped is refused", () => {
    expect(shipped[1]?.version).toBe("5.0.2");
    expect(shipped.map((r) => r.version)).toContain("5.0.2");
  });
});
