import { describe, expect, it } from "vitest";
import {
  costBandFromAllocation,
  progressBandFromPercent,
  rfiBandFromOpenCount,
  scheduleBandFromSignals,
} from "./overlay-formula";

/**
 * 2.17.9 — vitest regression for overlay formulas (align with API calculator).
 */
describe("overlay-formula regression (2.17.9)", () => {
  describe("rfi", () => {
    it("null is insufficient, not on-track", () => {
      expect(rfiBandFromOpenCount(null)).toBe("InsufficientData");
      expect(rfiBandFromOpenCount(undefined)).toBe("InsufficientData");
    });
    it("zero open is on-track", () => {
      expect(rfiBandFromOpenCount(0)).toBe("OnTrack");
    });
    it("1–2 watch, 3+ risk", () => {
      expect(rfiBandFromOpenCount(1)).toBe("Watch");
      expect(rfiBandFromOpenCount(2)).toBe("Watch");
      expect(rfiBandFromOpenCount(3)).toBe("Risk");
      expect(rfiBandFromOpenCount(10)).toBe("Risk");
    });
  });

  describe("progress", () => {
    it("missing is insufficient", () => {
      expect(progressBandFromPercent(null)).toBe("InsufficientData");
    });
    it("bands by percent thresholds", () => {
      expect(progressBandFromPercent(10)).toBe("Risk");
      expect(progressBandFromPercent(50)).toBe("Watch");
      expect(progressBandFromPercent(90)).toBe("OnTrack");
    });
  });

  describe("schedule", () => {
    it("missing signals insufficient", () => {
      expect(scheduleBandFromSignals(null, null)).toBe("InsufficientData");
    });
    it("critical with delay is risk", () => {
      expect(scheduleBandFromSignals(true, 2)).toBe("Risk");
    });
  });

  describe("cost", () => {
    it("no allocation is insufficient — never invent OnTrack", () => {
      expect(costBandFromAllocation(null)).toBe("InsufficientData");
      expect(costBandFromAllocation(false)).toBe("InsufficientData");
      expect(costBandFromAllocation(true)).toBe("Watch");
      expect(costBandFromAllocation(true)).not.toBe("OnTrack");
    });
  });
});
