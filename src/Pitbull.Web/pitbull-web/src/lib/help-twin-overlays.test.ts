import { describe, expect, it } from "vitest";
import {
  TWIN_TRUTH_LEGEND_SECTION_TITLE,
  twinTruthBands,
  twinTruthLegendBlob,
  twinTruthLegendBullets,
} from "./help-twin-overlays";

describe("help-twin-overlays truth legend (2.15.8)", () => {
  it("titles the twin truth legend section", () => {
    expect(TWIN_TRUTH_LEGEND_SECTION_TITLE).toMatch(/truth legend/i);
  });

  it("never claims all-green default or all clear for empty", () => {
    const blob = twinTruthLegendBlob().toLowerCase();
    expect(blob).not.toMatch(/all green by default|everything is green|default green/);
    expect(blob).toMatch(/not.*all.?clear|not green|insufficient/);
    expect(blob).toContain("gray");
  });

  it("documents four honest bands and twin route", () => {
    expect(twinTruthBands.map((b) => b.id)).toEqual([
      "on-track",
      "watch",
      "risk",
      "insufficient",
    ]);
    expect(twinTruthLegendBullets.some((b) => b.includes("/projects/{id}/twin"))).toBe(
      true
    );
  });
});
