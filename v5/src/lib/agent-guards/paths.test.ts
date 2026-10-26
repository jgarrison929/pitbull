import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FORBIDDEN_RELATIVE_PATHS,
  PARKED_PAGE_SHELL_RENAME,
  WORKING_CALENDAR_PATH,
} from "./paths";

const root = join(import.meta.dirname, "../../..");

describe("forbidden paths (architecture)", () => {
  it("does not recreate banned modules", () => {
    const hits = FORBIDDEN_RELATIVE_PATHS.filter((p) =>
      existsSync(join(root, p)),
    );
    expect(hits, hits.join("\n")).toEqual([]);
  });

  it("must-fail: past mistake recreating lib/schedule/working-days.ts", () => {
    // Evidence: #725 deleted a parallel module; #719 owns working-calendar.ts.
    expect(FORBIDDEN_RELATIVE_PATHS).toContain(
      "src/lib/schedule/working-days.ts",
    );
    expect(WORKING_CALENDAR_PATH).toBe("src/lib/working-calendar.ts");
  });

  it("parks page.tsx → page-shell rename until 5.0.3 queue drains", () => {
    expect(PARKED_PAGE_SHELL_RENAME.from).toBe("src/components/app/page.tsx");
    expect(PARKED_PAGE_SHELL_RENAME.to).toBe(
      "src/components/app/page-shell.tsx",
    );
    // Anatomy still lives at page.tsx on main — do not ban until rename PR.
    expect(existsSync(join(root, PARKED_PAGE_SHELL_RENAME.from))).toBe(true);
    expect(existsSync(join(root, PARKED_PAGE_SHELL_RENAME.to))).toBe(false);
  });
});
