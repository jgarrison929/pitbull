import { describe, it, expect } from "vitest";
import { getAppVersion, getAppVersionLabel } from "./app-version";

describe("app-version", () => {
  it("returns a non-empty semver-like version string", () => {
    const v = getAppVersion();
    expect(v.length).toBeGreaterThan(0);
    expect(v.startsWith("v")).toBe(false);
    // package.json / NEXT_PUBLIC_APP_VERSION tracks product VERSION (2.1.0+)
    expect(v).toMatch(/^\d+\.\d+/);
  });

  it("labels version with a v prefix", () => {
    expect(getAppVersionLabel()).toBe(`v${getAppVersion()}`);
  });
});
