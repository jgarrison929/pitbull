import { describe, expect, it } from "vitest";
import {
  ZONE_PICKER_TWIN_SECTION_TITLE,
  zonePickerTwinBullets,
  zonePickerTwinHelpBlob,
  zonePickerTwinSteps,
} from "./help-zone-picker-twin";

describe("help zone picker + twin (2.18.8)", () => {
  it("covers picker location, optional default, required, demo skip, twin fuel", () => {
    const ids = zonePickerTwinBullets.map((b) => b.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "where-picker",
        "optional-default",
        "when-required",
        "demo-skip",
        "twin-fuel",
        "quality-metric",
      ])
    );
  });

  it("never claims all-green or invents KPI vanity", () => {
    const blob = zonePickerTwinHelpBlob().toLowerCase();
    expect(blob).toContain(ZONE_PICKER_TWIN_SECTION_TITLE.toLowerCase());
    expect(blob).not.toMatch(/all clear by default|always green|100% coverage kpi/);
    expect(blob).toMatch(/not an executive|not a kpi|data-quality|data quality/);
    expect(blob).toMatch(/neutral|gray|never/);
    expect(zonePickerTwinSteps.length).toBeGreaterThanOrEqual(4);
  });
});
