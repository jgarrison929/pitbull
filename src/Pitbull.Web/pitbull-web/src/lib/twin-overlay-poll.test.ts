import { describe, expect, it } from "vitest";
import {
  DEFAULT_TWIN_OVERLAY_POLL_MS,
  resolveTwinOverlayPollMs,
} from "./twin-overlay-poll";

describe("resolveTwinOverlayPollMs", () => {
  it("defaults to 30s when unset", () => {
    expect(resolveTwinOverlayPollMs(undefined)).toBe(DEFAULT_TWIN_OVERLAY_POLL_MS);
    expect(resolveTwinOverlayPollMs("")).toBe(DEFAULT_TWIN_OVERLAY_POLL_MS);
    expect(DEFAULT_TWIN_OVERLAY_POLL_MS).toBe(30_000);
  });

  it("disables for 0/off/false/no", () => {
    expect(resolveTwinOverlayPollMs("0")).toBe(0);
    expect(resolveTwinOverlayPollMs("off")).toBe(0);
    expect(resolveTwinOverlayPollMs("false")).toBe(0);
    expect(resolveTwinOverlayPollMs("no")).toBe(0);
  });

  it("clamps positive values to min 5s", () => {
    expect(resolveTwinOverlayPollMs("1000")).toBe(5_000);
    expect(resolveTwinOverlayPollMs("60000")).toBe(60_000);
  });

  it("falls back on invalid input", () => {
    expect(resolveTwinOverlayPollMs("abc")).toBe(DEFAULT_TWIN_OVERLAY_POLL_MS);
    expect(resolveTwinOverlayPollMs("-10")).toBe(DEFAULT_TWIN_OVERLAY_POLL_MS);
  });
});
