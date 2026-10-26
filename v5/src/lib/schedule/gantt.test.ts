import { describe, expect, it } from "vitest";
import {
  barPlacement,
  enumerateIsoDays,
  ganttAxisRange,
  holidaysOnAxis,
} from "./gantt";

describe("gantt layout helpers", () => {
  it("enumerates inclusive calendar days", () => {
    expect(enumerateIsoDays("2026-11-02", "2026-11-04")).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
    ]);
  });

  it("builds an axis from activity early dates", () => {
    expect(
      ganttAxisRange([
        { earlyStartOn: "2026-11-05", earlyFinishOn: "2026-11-07" },
        { earlyStartOn: "2026-11-02", earlyFinishOn: "2026-11-06" },
      ]),
    ).toEqual({ startOn: "2026-11-02", finishOn: "2026-11-07" });
    expect(ganttAxisRange([])).toBeNull();
  });

  it("places a bar as percent of the shared axis", () => {
    // Axis Mon–Fri (5 days). Activity on Wed–Thu (days 2–3 of 0..4).
    const p = barPlacement(
      "2026-11-04",
      "2026-11-05",
      "2026-11-02",
      "2026-11-06",
    );
    expect(p.leftPct).toBeCloseTo(40, 5);
    expect(p.widthPct).toBeCloseTo(40, 5);
  });

  it("shades holiday columns on the axis", () => {
    const cols = holidaysOnAxis(
      [
        { on: "2026-11-26", name: "Thanksgiving" },
        { on: "2026-12-25", name: "Christmas" },
      ],
      "2026-11-02",
      "2026-11-30",
    );
    expect(cols).toHaveLength(1);
    expect(cols[0]!.on).toBe("2026-11-26");
    expect(cols[0]!.name).toBe("Thanksgiving");
    expect(cols[0]!.widthPct).toBeGreaterThan(0);
  });
});
