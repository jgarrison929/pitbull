import { describe, it, expect } from "vitest";
import { getAppVersion, getAppVersionLabel } from "./app-version";

describe("app-version", () => {
  it("returns a non-empty semver-like version string", () => {
    const v = getAppVersion();
    expect(v.length).toBeGreaterThan(0);
    expect(v.startsWith("v")).toBe(false);
    // package.json / NEXT_PUBLIC_APP_VERSION is 2.0.0 in this repo
    expect(v).toMatch(/^\d+\.\d+/);
  });

  it("labels version with a v prefix", () => {
    expect(getAppVersionLabel()).toBe(`v${getAppVersion()}`);
  });
});
