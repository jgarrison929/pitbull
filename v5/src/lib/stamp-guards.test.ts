import { describe, expect, it } from "vitest";
import {
  commitsMatchDeployed,
  isStampTimestampAllowed,
  STAMP_FUTURE_SKEW_MS,
} from "./stamp-guards";

describe("commitsMatchDeployed", () => {
  it("matches full and short SHAs either way", () => {
    expect(
      commitsMatchDeployed("0123456789abcdef", "0123456789ab"),
    ).toBe(true);
    expect(
      commitsMatchDeployed("0123456789ab", "0123456789abcdef"),
    ).toBe(true);
    expect(commitsMatchDeployed("ABC", "abc")).toBe(true);
  });

  it("rejects mismatched or unknown commits", () => {
    expect(commitsMatchDeployed("aaaaaaaaaaaa", "bbbbbbbbbbbb")).toBe(false);
    expect(commitsMatchDeployed("abc", "unknown")).toBe(false);
    expect(commitsMatchDeployed("", "0123456789ab")).toBe(false);
  });
});

describe("isStampTimestampAllowed", () => {
  const now = new Date("2026-10-23T15:00:00.000Z");

  it("allows past and near-present times", () => {
    expect(isStampTimestampAllowed(new Date("2026-10-23T14:59:00.000Z"), now)).toBe(
      true,
    );
    expect(isStampTimestampAllowed(now, now)).toBe(true);
    expect(
      isStampTimestampAllowed(
        new Date(now.getTime() + STAMP_FUTURE_SKEW_MS),
        now,
      ),
    ).toBe(true);
  });

  it("rejects far-future timestamps", () => {
    expect(
      isStampTimestampAllowed(
        new Date(now.getTime() + STAMP_FUTURE_SKEW_MS + 1),
        now,
      ),
    ).toBe(false);
    expect(isStampTimestampAllowed(new Date("2027-01-01T00:00:00.000Z"), now)).toBe(
      false,
    );
  });
});
