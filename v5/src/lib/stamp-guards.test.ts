import { describe, expect, it } from "vitest";
import {
  commitsMatchDeployed,
  isFullCommitSha,
  isStampTimestampAllowed,
  stampTimestampRejectReason,
  STAMP_FUTURE_SKEW_MS,
  STAMP_MAX_AGE_MS,
} from "./stamp-guards";

const FULL =
  "0123456789abcdef0123456789abcdef01234567";

describe("isFullCommitSha", () => {
  it("accepts a 40-char hex SHA", () => {
    expect(isFullCommitSha(FULL)).toBe(true);
    expect(isFullCommitSha(FULL.toUpperCase())).toBe(true);
    expect(isFullCommitSha(`  ${FULL}  `)).toBe(true);
  });

  it("rejects short, empty, or non-hex values", () => {
    expect(isFullCommitSha("d")).toBe(false);
    expect(isFullCommitSha(FULL.slice(0, 12))).toBe(false);
    expect(isFullCommitSha(FULL.slice(0, 39))).toBe(false);
    expect(isFullCommitSha(`${FULL}a`)).toBe(false);
    expect(isFullCommitSha("g".repeat(40))).toBe(false);
    expect(isFullCommitSha("")).toBe(false);
  });
});

describe("commitsMatchDeployed", () => {
  it("matches a full stamped SHA against a short deployed prefix", () => {
    expect(commitsMatchDeployed(FULL, FULL.slice(0, 12))).toBe(true);
    expect(commitsMatchDeployed(FULL, FULL)).toBe(true);
    expect(commitsMatchDeployed(FULL.toUpperCase(), FULL.slice(0, 7))).toBe(
      true,
    );
  });

  it("rejects mismatched or unknown commits", () => {
    expect(
      commitsMatchDeployed(
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "bbbbbbbbbbbb",
      ),
    ).toBe(false);
    expect(commitsMatchDeployed(FULL, "unknown")).toBe(false);
    expect(commitsMatchDeployed("", FULL.slice(0, 12))).toBe(false);
  });
});

describe("isStampTimestampAllowed", () => {
  const now = new Date("2026-10-23T15:00:00.000Z");

  it("allows recent past and near-present times", () => {
    expect(
      isStampTimestampAllowed(new Date("2026-10-23T14:59:00.000Z"), now),
    ).toBe(true);
    expect(isStampTimestampAllowed(now, now)).toBe(true);
    expect(
      isStampTimestampAllowed(
        new Date(now.getTime() + STAMP_FUTURE_SKEW_MS),
        now,
      ),
    ).toBe(true);
    expect(
      isStampTimestampAllowed(
        new Date(now.getTime() - STAMP_MAX_AGE_MS),
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
    expect(
      isStampTimestampAllowed(new Date("2027-01-01T00:00:00.000Z"), now),
    ).toBe(false);
    expect(
      stampTimestampRejectReason(
        new Date(now.getTime() + STAMP_FUTURE_SKEW_MS + 1),
        now,
      ),
    ).toBe("timestamp is in the future");
  });

  it("rejects stale timestamps beyond the max age window", () => {
    expect(
      isStampTimestampAllowed(
        new Date(now.getTime() - STAMP_MAX_AGE_MS - 1),
        now,
      ),
    ).toBe(false);
    expect(
      isStampTimestampAllowed(new Date("2001-01-01T00:00:00.000Z"), now),
    ).toBe(false);
    expect(
      stampTimestampRejectReason(new Date("2001-01-01T00:00:00.000Z"), now),
    ).toBe("timestamp is too old");
  });
});
