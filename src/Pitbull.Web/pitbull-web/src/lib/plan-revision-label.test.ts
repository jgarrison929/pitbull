import { describe, it, expect } from "vitest";
import { formatPlanRevisionLabel } from "./plan-revision-label";

describe("formatPlanRevisionLabel (2.13.7)", () => {
  it("returns null when revision missing — never invents latest", () => {
    expect(formatPlanRevisionLabel(null)).toBeNull();
    expect(formatPlanRevisionLabel("")).toBeNull();
    expect(formatPlanRevisionLabel("   ")).toBeNull();
  });

  it("formats API revision without inventing latest", () => {
    expect(formatPlanRevisionLabel("Rev 3")).toBe("Rev 3");
    expect(formatPlanRevisionLabel("IFC")).toBe("IFC");
    expect(formatPlanRevisionLabel("Rev 2", { revisionDate: "2026-06-01" })).toBe(
      "Rev 2 · 2026-06-01"
    );
    expect(formatPlanRevisionLabel("Rev 3")).not.toMatch(/latest/i);
  });
});
