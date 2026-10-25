import { describe, expect, it } from "vitest";
import { checkHealth } from "./health";
import {
  appVersion,
  changelogVersion,
  getBuildInfo,
} from "./build-info";

describe("checkHealth", () => {
  it("is ok without a database", async () => {
    expect(await checkHealth(null)).toEqual({ status: "ok", db: "not-configured" });
  });

  it("is ok when the ping succeeds", async () => {
    expect(await checkHealth(async () => {})).toEqual({ status: "ok", db: "ok" });
  });

  it("is degraded when the ping fails", async () => {
    const ping = async () => {
      throw new Error("connection refused");
    };
    expect(await checkHealth(ping)).toEqual({ status: "degraded", db: "error" });
  });
});

describe("getBuildInfo", () => {
  it("prefers the Railway commit and keeps the full SHA", () => {
    const full = "0123456789abcdef0123456789abcdef01234567";
    const info = getBuildInfo({
      RAILWAY_GIT_COMMIT_SHA: full,
      GIT_COMMIT_SHA: "ffff",
    });
    expect(info.commit).toBe(full);
    expect(info.commit).toHaveLength(40);
  });

  it("must-fail: a truncated SHA must not be what /status exposes", () => {
    const full = "0123456789abcdef0123456789abcdef01234567";
    const info = getBuildInfo({ RAILWAY_GIT_COMMIT_SHA: full });
    expect(info.commit).not.toBe(full.slice(0, 12));
  });

  it("reports unknown when no commit is set", () => {
    expect(getBuildInfo({}).commit).toBe("unknown");
  });

  it("uses a real release version, not 0.0.0", () => {
    expect(appVersion()).not.toBe("0.0.0");
    expect(appVersion()).toBe(changelogVersion());
    expect(appVersion()).toMatch(/^5\./);
  });
});
