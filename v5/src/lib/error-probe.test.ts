import { describe, expect, it } from "vitest";
import { isErrorProbeAllowed } from "./error-probe";

describe("isErrorProbeAllowed", () => {
  it("is off by default (Railway / production)", () => {
    expect(isErrorProbeAllowed({})).toBe(false);
    expect(isErrorProbeAllowed({ NODE_ENV: "production" })).toBe(false);
    expect(isErrorProbeAllowed({ CI: "true" })).toBe(false);
  });

  it("is on only when V5_ERROR_PROBE=1", () => {
    expect(isErrorProbeAllowed({ V5_ERROR_PROBE: "1" })).toBe(true);
    expect(isErrorProbeAllowed({ V5_ERROR_PROBE: "0" })).toBe(false);
    expect(isErrorProbeAllowed({ V5_ERROR_PROBE: "true" })).toBe(false);
  });
});
