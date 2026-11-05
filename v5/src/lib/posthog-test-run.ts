/**
 * Test-only PostHog tagging. A first-party `pb_test_run` cookie
 * (`pr=123;scenario=PB-97-S1;suite=area-plan-edit`) registers super properties,
 * forces session recording on, and publishes the replay URL on
 * `window.__pbReplayUrl`. No cookie: callers do nothing — init options,
 * masking, and recording stay as they are today.
 */

export const PB_TEST_RUN_COOKIE = "pb_test_run";

export type PbTestRun = {
  pr: string;
  scenario: string;
  suite: string;
};

export type PbTestRunClient = {
  register: (properties: Record<string, string>) => void;
  startSessionRecording: (override?: true) => void;
  get_session_replay_url: (options?: { withTimestamp?: boolean }) => string;
};

export type ReplayWindow = {
  __pbReplayUrl?: string;
};

/** How long to wait for a replay URL after recording is forced on. Covers the ~2s boot. */
export const REPLAY_POLL_MS = 250;
export const REPLAY_POLL_TRIES = 80;

/** Parse a cookie value. Accepts the raw `pr=…;scenario=…;suite=…` form and one `encodeURIComponent` pass. */
export function parsePbTestRunValue(
  raw: string | null | undefined,
): PbTestRun | null {
  if (raw == null) return null;
  let value = raw.trim();
  if (!value) return null;
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.includes("=")) value = decoded;
  } catch {
    // Keep the raw value when it is not percent-encoded.
  }
  const fields = new Map<string, string>();
  for (const part of value.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    if (key && val) fields.set(key, val);
  }
  const pr = fields.get("pr");
  const scenario = fields.get("scenario");
  const suite = fields.get("suite");
  if (!pr || !scenario || !suite) return null;
  return { pr, scenario, suite };
}

/**
 * Find `pb_test_run` in a `document.cookie` / Cookie header string.
 * Pairs are separated by `"; "` (semicolon + space). The value itself uses
 * semicolons without a space, so splitting on `"; "` keeps it intact.
 */
export function pbTestRunFromCookieHeader(
  header: string | null | undefined,
): PbTestRun | null {
  if (!header) return null;
  for (const part of header.split("; ")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    if (part.slice(0, eq).trim() !== PB_TEST_RUN_COOKIE) continue;
    return parsePbTestRunValue(part.slice(eq + 1));
  }
  return null;
}

/** Read the cookie from `document` when this runs in the browser. Null on the server and when unset. */
export function currentPbTestRun(): PbTestRun | null {
  try {
    if (typeof document === "undefined") return null;
    return pbTestRunFromCookieHeader(document.cookie);
  } catch {
    return null;
  }
}

export type PbTestRunTimers = {
  setTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  readCookie: () => PbTestRun | null;
};

/**
 * Register `pb_pr` / `pb_scenario` / `pb_suite`, force recording on, and
 * publish `window.__pbReplayUrl` only while the cookie is still present.
 * Does not change input masking.
 */
export function applyPbTestRunGate(
  posthog: PbTestRunClient,
  run: PbTestRun,
  win: ReplayWindow,
  timers?: Partial<PbTestRunTimers>,
): void {
  posthog.register({
    pb_pr: run.pr,
    pb_scenario: run.scenario,
    pb_suite: run.suite,
  });
  posthog.startSessionRecording(true);

  const readCookie = timers?.readCookie ?? currentPbTestRun;
  const setTimer =
    timers?.setTimeout ??
    ((fn: () => void, ms: number) => setTimeout(fn, ms));

  const publish = (): boolean => {
    if (!readCookie()) {
      delete win.__pbReplayUrl;
      return true;
    }
    let url = "";
    try {
      url = posthog.get_session_replay_url({ withTimestamp: false });
    } catch {
      return false;
    }
    if (url) {
      win.__pbReplayUrl = url;
      return true;
    }
    return false;
  };

  if (publish()) return;
  let tries = 0;
  const tick = () => {
    if (publish() || ++tries >= REPLAY_POLL_TRIES) return;
    setTimer(tick, REPLAY_POLL_MS);
  };
  setTimer(tick, REPLAY_POLL_MS);
}
