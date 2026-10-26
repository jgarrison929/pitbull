import { describe, expect, it } from "vitest";
import { reportGainLoss, roundMh } from "./report-work-form";

describe("reportGainLoss (5.0.4-d / field intel check 3)", () => {
  it("shows earned 19.2, actual 22.0, and G/L −2.8 for 12 CY at 1.600 MH/CY", () => {
    const gl = reportGainLoss({ qty: 12, actualMh: 22, budgetRate: 1.6 });
    expect(gl.earned).toBe(19.2);
    expect(gl.actual).toBe(22);
    expect(gl.gl).toBe(-2.8);
  });

  it("treats earned above actual as a gain", () => {
    const gl = reportGainLoss({ qty: 12, actualMh: 16, budgetRate: 1.6 });
    expect(gl.earned).toBe(19.2);
    expect(gl.gl).toBe(3.2);
  });

  it("rounds to one decimal MH", () => {
    expect(roundMh(19.25)).toBe(19.3);
    expect(roundMh(2.84)).toBe(2.8);
  });
});
