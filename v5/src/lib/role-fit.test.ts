import { describe, expect, it } from "vitest";
import {
  atRiskSummaryLine,
  todayPlanLabel,
} from "./role-fit";

describe("todayPlanLabel", () => {
  it("maps issued to Report due", () => {
    expect(todayPlanLabel(["issued"])).toBe("Report due");
  });
  it("maps reported and approved to Reported", () => {
    expect(todayPlanLabel(["reported"])).toBe("Reported");
    expect(todayPlanLabel(["approved"])).toBe("Reported");
  });
  it("prefers issued over reported", () => {
    expect(todayPlanLabel(["reported", "issued"])).toBe("Report due");
  });
  it("defaults to No plan today", () => {
    expect(todayPlanLabel([])).toBe("No plan today");
    expect(todayPlanLabel(["draft"])).toBe("No plan today");
  });
});

describe("atRiskSummaryLine", () => {
  it("names over-cost jobs with the dollar amount", () => {
    const line = atRiskSummaryLine({
      shortName: "I-5 Culverts",
      number: "24-077",
      cpi: 0.9,
      spi: 1.0,
      costVarianceCents: -25_500_000,
      scheduleVarianceCents: 0,
    });
    expect(line).toMatch(/24-077/);
    expect(line).toMatch(/over cost/);
    expect(line).toMatch(/\$255K/);
  });

  it("names behind-schedule jobs when cost is fine", () => {
    const line = atRiskSummaryLine({
      shortName: "SR 99",
      number: "24-118",
      cpi: 1.05,
      spi: 0.9,
      costVarianceCents: 100_000,
      scheduleVarianceCents: -5_000_000,
    });
    expect(line).toMatch(/24-118/);
    expect(line).toMatch(/behind schedule/);
  });

  it("returns null when not at risk", () => {
    expect(
      atRiskSummaryLine({
        shortName: "Harbor",
        number: "26-010",
        cpi: 1.0,
        spi: 1.0,
        costVarianceCents: 0,
        scheduleVarianceCents: 0,
      }),
    ).toBeNull();
  });
});
