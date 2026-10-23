import { describe, expect, it } from "vitest";
import { tokensEqual } from "./tokens-equal";

describe("tokensEqual", () => {
  it("matches identical strings", () => {
    expect(tokensEqual("secret", "secret")).toBe(true);
  });

  it("rejects different values and lengths", () => {
    expect(tokensEqual("secret", "Secret")).toBe(false);
    expect(tokensEqual("short", "longer-value")).toBe(false);
    expect(tokensEqual("", "x")).toBe(false);
  });
});
