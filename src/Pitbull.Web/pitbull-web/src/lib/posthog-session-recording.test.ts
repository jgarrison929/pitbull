import { describe, it, expect } from "vitest";
import { isPostHogSessionRecordingEnabled, postHogSessionRecordingInitOptions } from "./posthog-session-recording";

describe("posthog-session-recording (3.2.6)", () => {
  it("defaults to enabled when env unset", () => {
    expect(isPostHogSessionRecordingEnabled(undefined)).toBe(true);
  });
  it("disables when false", () => {
    expect(isPostHogSessionRecordingEnabled("false")).toBe(false);
    expect(postHogSessionRecordingInitOptions(false)).toEqual({ disable_session_recording: true });
  });
});
