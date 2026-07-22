import { describe, expect, it } from "vitest";
import {
  CPM_GLOSSARY,
  cpmOnTrackClaimAllowed,
  formatBaselineVarianceDays,
  formatDataDate,
} from "./cpm-honesty";

describe("cpm-honesty (band 3.8 through 3.7.5)", () => {
  it("glossary covers data-date and float", () => {
    expect(CPM_GLOSSARY.dataDate.toLowerCase()).toMatch(/data date/);
    expect(CPM_GLOSSARY.totalFloat.toLowerCase()).toMatch(/insufficient|float/);
  });

  it("data date null is honest", () => {
    expect(formatDataDate(null)).toMatch(/not set/i);
  });

  it("baseline variance requires both dates", () => {
    expect(formatBaselineVarianceDays(null, "2026-01-01")).toMatch(/insufficient/i);
    expect(formatBaselineVarianceDays("2026-01-01", "2026-01-11")).toMatch(/behind|ahead|baseline/i);
  });

  it("never allows on-track health KPI claim", () => {
    expect(
      cpmOnTrackClaimAllowed({
        isCritical: false,
        totalFloat: 10,
      })
    ).toBe(false);
  });
});
