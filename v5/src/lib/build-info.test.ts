import { describe, expect, it } from "vitest";
import { shortCommitSha } from "./build-info";

describe("shortCommitSha", () => {
  it("shows the first 12 characters of a full sha", () => {
    const full = "0057a2c9b0e7ffff0057a2c9b0e7ffff0057a2c9";
    expect(shortCommitSha(full)).toBe("0057a2c9b0e7");
    expect(shortCommitSha(full)).toHaveLength(12);
  });

  it("keeps a 7 to 12 character sha whole", () => {
    expect(shortCommitSha("abc1234")).toBe("abc1234");
    expect(shortCommitSha("abc1234def5")).toBe("abc1234def5");
  });

  it("leaves a non-hex commit whole", () => {
    expect(shortCommitSha("unknown")).toBe("unknown");
  });
});
