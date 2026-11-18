import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyPbTestRunGate,
  currentPbTestRun,
  parsePbTestRunValue,
  pbTestRunFromCookieHeader,
  type PbTestRunClient,
  type ReplayWindow,
} from "./posthog-test-run";

const SAMPLE = "pr=123;scenario=PB-97-S1;suite=area-plan-edit";

describe("pb_test_run cookie", () => {
  it("parses the pr / scenario / suite value", () => {
    expect(parsePbTestRunValue(SAMPLE)).toEqual({
      pr: "123",
      scenario: "PB-97-S1",
      suite: "area-plan-edit",
    });
    expect(parsePbTestRunValue(encodeURIComponent(SAMPLE))).toEqual({
      pr: "123",
      scenario: "PB-97-S1",
      suite: "area-plan-edit",
    });
  });

  it("rejects a cookie that is missing a field", () => {
    expect(parsePbTestRunValue("")).toBeNull();
    expect(parsePbTestRunValue(null)).toBeNull();
    expect(parsePbTestRunValue("pr=123;scenario=PB-97-S1")).toBeNull();
    expect(parsePbTestRunValue("scenario=PB-97-S1;suite=area-plan-edit")).toBeNull();
  });

  it("reads pb_test_run out of a document.cookie string and ignores other cookies", () => {
    const header = `pcs_theme=light; pb_test_run=${SAMPLE}; pcs_session=abc`;
    expect(pbTestRunFromCookieHeader(header)).toEqual({
      pr: "123",
      scenario: "PB-97-S1",
      suite: "area-plan-edit",
    });
    expect(pbTestRunFromCookieHeader("pcs_theme=light")).toBeNull();
    expect(pbTestRunFromCookieHeader(undefined)).toBeNull();
  });

  it("currentPbTestRun is null when document is missing", () => {
    expect(currentPbTestRun()).toBeNull();
  });
});

describe("applyPbTestRunGate", () => {
  function client(url = "") {
    return {
      register: vi.fn(),
      startSessionRecording: vi.fn(),
      get_session_replay_url: () => url,
    };
  }

  it("registers pb_pr, pb_scenario, and pb_suite and forces recording on", () => {
    const posthog = client("https://us.posthog.com/project/1/replay/abc");
    const win: ReplayWindow = {};
    applyPbTestRunGate(
      posthog as PbTestRunClient,
      { pr: "123", scenario: "PB-97-S1", suite: "area-plan-edit" },
      win,
      { readCookie: () => ({ pr: "123", scenario: "PB-97-S1", suite: "area-plan-edit" }) },
    );
    expect(posthog.register).toHaveBeenCalledWith({
      pb_pr: "123",
      pb_scenario: "PB-97-S1",
      pb_suite: "area-plan-edit",
    });
    expect(posthog.startSessionRecording).toHaveBeenCalledWith(true);
    expect(win.__pbReplayUrl).toBe(
      "https://us.posthog.com/project/1/replay/abc",
    );
  });

  it("does not publish a replay URL while the cookie is gone", () => {
    const posthog = client("https://us.posthog.com/replay/abc");
    const win: ReplayWindow = { __pbReplayUrl: "stale" };
    const queued: Array<() => void> = [];
    applyPbTestRunGate(
      posthog as PbTestRunClient,
      { pr: "123", scenario: "PB-97-S1", suite: "area-plan-edit" },
      win,
      {
        readCookie: () => null,
        setTimeout: (fn) => {
          queued.push(fn);
          return 0 as unknown as ReturnType<typeof setTimeout>;
        },
      },
    );
    expect(win.__pbReplayUrl).toBeUndefined();
    expect(queued).toHaveLength(0);
  });

  it("waits for get_session_replay_url and stops once the cookie is cleared", () => {
    let url = "";
    let cookie: ReturnType<typeof parsePbTestRunValue> = parsePbTestRunValue(SAMPLE);
    const posthog = client();
    posthog.get_session_replay_url = () => url;
    const win: ReplayWindow = {};
    const queued: Array<() => void> = [];
    applyPbTestRunGate(posthog as PbTestRunClient, cookie!, win, {
      readCookie: () => cookie,
      setTimeout: (fn) => {
        queued.push(fn);
        return 0 as unknown as ReturnType<typeof setTimeout>;
      },
    });
    expect(win.__pbReplayUrl).toBeUndefined();
    expect(queued).toHaveLength(1);
    url = "https://us.posthog.com/replay/later";
    queued.shift()?.();
    expect(win.__pbReplayUrl).toBe("https://us.posthog.com/replay/later");

    cookie = null;
    win.__pbReplayUrl = "https://us.posthog.com/replay/later";
    const queuedAfter: Array<() => void> = [];
    applyPbTestRunGate(posthog as PbTestRunClient, parsePbTestRunValue(SAMPLE)!, win, {
      readCookie: () => null,
      setTimeout: (fn) => {
        queuedAfter.push(fn);
        return 0 as unknown as ReturnType<typeof setTimeout>;
      },
    });
    expect(win.__pbReplayUrl).toBeUndefined();
    expect(queuedAfter).toHaveLength(0);
  });
});

describe("initPostHog pb_test_run gate", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.doUnmock("posthog-js");
  });

  function stubClient() {
    const init = vi.fn();
    const register = vi.fn();
    const startSessionRecording = vi.fn();
    const get_session_replay_url = vi.fn(() => "https://us.posthog.com/replay/1");
    const client = {
      __loaded: false,
      init: (key: string, opts: Record<string, unknown>) => {
        init(key, opts);
        client.__loaded = true;
      },
      capture: vi.fn(),
      identify: vi.fn(),
      reset: vi.fn(),
      register,
      startSessionRecording,
      get_session_replay_url,
    };
    vi.doMock("posthog-js", () => ({ default: client }));
    return { init, register, startSessionRecording, get_session_replay_url };
  }

  it("no cookie: init options match today and the gate does not run", async () => {
    const { init, register, startSessionRecording } = stubClient();
    const win: ReplayWindow = {};
    vi.stubGlobal("window", win);
    vi.stubGlobal("document", { cookie: "pcs_theme=light" });

    const { initPostHog } = await import("./posthog");
    const { postHogInitOptionsFromConfig, resolvePostHogClientConfig } =
      await import("./posthog-config");
    await initPostHog({
      key: "phc_test",
      host: "https://us.i.posthog.com",
      sessionRecording: "false",
    });

    const config = resolvePostHogClientConfig({
      key: "phc_test",
      host: "https://us.i.posthog.com",
      sessionRecording: "false",
    })!;
    expect(init).toHaveBeenCalledTimes(1);
    expect(init.mock.calls[0][1]).toEqual(postHogInitOptionsFromConfig(config));
    expect(init.mock.calls[0][1].session_recording).toMatchObject({
      maskAllInputs: true,
    });
    expect(register).not.toHaveBeenCalled();
    expect(startSessionRecording).not.toHaveBeenCalled();
    expect(win.__pbReplayUrl).toBeUndefined();
  });

  it("cookie set: registers, forces recording, publishes the replay URL, and still masks inputs", async () => {
    const { init, register, startSessionRecording } = stubClient();
    const win: ReplayWindow = {};
    vi.stubGlobal("window", win);
    vi.stubGlobal("document", {
      cookie: `pcs_theme=light; pb_test_run=${SAMPLE}`,
    });

    const { initPostHog } = await import("./posthog");
    const { postHogInitOptionsFromConfig, resolvePostHogClientConfig } =
      await import("./posthog-config");
    await initPostHog({
      key: "phc_test",
      host: undefined,
      sessionRecording: undefined,
    });

    const config = resolvePostHogClientConfig({
      key: "phc_test",
      host: undefined,
      sessionRecording: undefined,
    })!;
    expect(init.mock.calls[0][1]).toEqual(postHogInitOptionsFromConfig(config));
    expect(init.mock.calls[0][1].session_recording.maskAllInputs).toBe(true);
    expect(register).toHaveBeenCalledWith({
      pb_pr: "123",
      pb_scenario: "PB-97-S1",
      pb_suite: "area-plan-edit",
    });
    expect(startSessionRecording).toHaveBeenCalledWith(true);
    expect(win.__pbReplayUrl).toBe("https://us.posthog.com/replay/1");
  });

  it("no key: cookie does not load posthog-js or set a replay URL", async () => {
    const factory = vi.fn();
    vi.doMock("posthog-js", factory);
    const win: ReplayWindow = {};
    vi.stubGlobal("window", win);
    vi.stubGlobal("document", { cookie: `pb_test_run=${SAMPLE}` });

    const { initPostHog } = await import("./posthog");
    const result = await initPostHog({
      key: undefined,
      host: undefined,
      sessionRecording: undefined,
    });
    expect(result).toBeNull();
    expect(factory).not.toHaveBeenCalled();
    expect(win.__pbReplayUrl).toBeUndefined();
  });
});
