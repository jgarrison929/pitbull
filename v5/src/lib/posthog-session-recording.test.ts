import { describe, expect, it } from "vitest";
import {
  isPostHogSessionRecordingEnabled,
  postHogSessionRecordingInitOptions,
} from "./posthog-session-recording";

describe("posthog-session-recording", () => {
  it("defaults to enabled when env unset", () => {
    expect(isPostHogSessionRecordingEnabled(undefined)).toBe(true);
    expect(isPostHogSessionRecordingEnabled("")).toBe(true);
  });

  it("disables when NEXT_PUBLIC_POSTHOG_SESSION_RECORDING is false or 0", () => {
    expect(isPostHogSessionRecordingEnabled("false")).toBe(false);
    expect(isPostHogSessionRecordingEnabled("FALSE")).toBe(false);
    expect(isPostHogSessionRecordingEnabled("0")).toBe(false);
    expect(postHogSessionRecordingInitOptions(false)).toEqual({
      disable_session_recording: true,
    });
  });

  it("keeps recording when flag is true-ish", () => {
    expect(isPostHogSessionRecordingEnabled("true")).toBe(true);
    expect(isPostHogSessionRecordingEnabled("1")).toBe(true);
    expect(postHogSessionRecordingInitOptions(true)).toEqual({});
  });
});
