import { describe, expect, it } from "vitest";
import { resolveVerifyToken } from "./verify-token";

describe("resolveVerifyToken", () => {
  it("reads VERIFY_TOKEN (not a legacy alias)", () => {
    expect(resolveVerifyToken({ VERIFY_TOKEN: "secret" })).toBe("secret");
    expect(resolveVerifyToken({ VERIFY_TOKEN: "  spaced  " })).toBe("spaced");
  });

  it("is null when VERIFY_TOKEN is unset or blank", () => {
    expect(resolveVerifyToken({})).toBeNull();
    expect(resolveVerifyToken({ VERIFY_TOKEN: "" })).toBeNull();
    expect(resolveVerifyToken({ VERIFY_TOKEN: "   " })).toBeNull();
  });

  it("ignores VERIFY_STAMP_TOKEN — stamp path uses VERIFY_TOKEN only", () => {
    expect(
      resolveVerifyToken({ VERIFY_STAMP_TOKEN: "legacy-only" }),
    ).toBeNull();
    expect(
      resolveVerifyToken({
        VERIFY_STAMP_TOKEN: "legacy",
        VERIFY_TOKEN: "current",
      }),
    ).toBe("current");
  });
});
