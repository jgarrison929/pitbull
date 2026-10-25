import { describe, expect, it } from "vitest";
import { formatLastVerify } from "./last-verify-format";

describe("formatLastVerify", () => {
  it("shows not recorded when there is no stamp time", () => {
    expect(formatLastVerify(null, null)).toBe("not recorded");
    expect(formatLastVerify(null, "abc123def456")).toBe("not recorded");
  });

  it("shows time alone when commit was never recorded", () => {
    expect(formatLastVerify("2026-10-20T17:00:00.000Z", null)).toBe(
      "2026-10-20T17:00:00.000Z",
    );
  });

  it("shows time and full commit side by side", () => {
    const full = "0057a2c9b0e7ffff0057a2c9b0e7ffff0057a2c9";
    expect(formatLastVerify("2026-10-20T17:00:00.000Z", full)).toBe(
      `2026-10-20T17:00:00.000Z · ${full}`,
    );
  });
});
