import { describe, expect, it } from "vitest";
import {
  normalizeAppVersion,
  shouldHardReloadForVersionChange,
} from "./app-version";

describe("normalizeAppVersion", () => {
  it("strips v prefix and trims", () => {
    expect(normalizeAppVersion(" v2.8.2 ")).toBe("2.8.2");
    expect(normalizeAppVersion("2.8.2")).toBe("2.8.2");
    expect(normalizeAppVersion(null)).toBe("");
  });
});

describe("shouldHardReloadForVersionChange", () => {
  it("stores first-seen remote without reload", () => {
    const r = shouldHardReloadForVersionChange({
      remoteVersion: "2.8.2",
      clientVersion: "2.8.1",
      lastSeenRemote: null,
      alreadyAttemptedForRemote: null,
    });
    expect(r.reload).toBe(false);
    expect(r.storeRemote).toBe("2.8.2");
    expect(r.reason).toBe("first-seen");
  });

  it("does not reload when remote unchanged", () => {
    const r = shouldHardReloadForVersionChange({
      remoteVersion: "2.8.2",
      clientVersion: "2.8.2",
      lastSeenRemote: "2.8.2",
      alreadyAttemptedForRemote: null,
    });
    expect(r.reload).toBe(false);
    expect(r.reason).toBe("unchanged");
  });

  it("reloads when remote advanced and client is still stale", () => {
    const r = shouldHardReloadForVersionChange({
      remoteVersion: "2.8.2",
      clientVersion: "2.8.1",
      lastSeenRemote: "2.8.1",
      alreadyAttemptedForRemote: null,
    });
    expect(r.reload).toBe(true);
    expect(r.storeRemote).toBe("2.8.2");
    expect(r.reason).toBe("stale-client");
  });

  it("does not loop after a failed reload attempt for same remote", () => {
    const r = shouldHardReloadForVersionChange({
      remoteVersion: "2.8.2",
      clientVersion: "2.8.1",
      lastSeenRemote: "2.8.1",
      alreadyAttemptedForRemote: "2.8.2",
    });
    expect(r.reload).toBe(false);
    expect(r.reason).toBe("already-attempted");
  });

  it("stores remote without reload when client already matches new version", () => {
    const r = shouldHardReloadForVersionChange({
      remoteVersion: "2.8.2",
      clientVersion: "2.8.2",
      lastSeenRemote: "2.8.1",
      alreadyAttemptedForRemote: null,
    });
    expect(r.reload).toBe(false);
    expect(r.storeRemote).toBe("2.8.2");
    expect(r.reason).toBe("client-matches");
  });
});
