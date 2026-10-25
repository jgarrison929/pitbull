/** PostHog session recording opt-out (same rules as legacy web). */
export function isPostHogSessionRecordingEnabled(
  envValue: string | undefined = process.env.NEXT_PUBLIC_POSTHOG_SESSION_RECORDING,
): boolean {
  if (envValue == null || envValue === "") return true;
  return envValue.toLowerCase() !== "false" && envValue !== "0";
}

export function postHogSessionRecordingInitOptions(
  enabled: boolean,
): { disable_session_recording?: boolean } {
  if (enabled) return {};
  return { disable_session_recording: true };
}
