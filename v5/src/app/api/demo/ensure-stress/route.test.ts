import { describe, expect, it } from "vitest";
import { isEnsureStressAllowed } from "./route";

describe("isEnsureStressAllowed", () => {
  it("is off by default (Railway / production)", () => {
    expect(isEnsureStressAllowed({})).toBe(false);
    expect(isEnsureStressAllowed({ NODE_ENV: "production" })).toBe(false);
    expect(isEnsureStressAllowed({ CI: "true" })).toBe(false);
  });

  it("is on only when V5_ALLOW_ENSURE_STRESS=1", () => {
    expect(isEnsureStressAllowed({ V5_ALLOW_ENSURE_STRESS: "1" })).toBe(true);
    expect(isEnsureStressAllowed({ V5_ALLOW_ENSURE_STRESS: "0" })).toBe(false);
    expect(isEnsureStressAllowed({ V5_ALLOW_ENSURE_STRESS: "true" })).toBe(
      false,
    );
  });
});
