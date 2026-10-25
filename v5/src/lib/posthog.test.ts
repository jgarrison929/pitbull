import { afterEach, describe, expect, it, vi } from "vitest";

describe("initPostHog", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.doUnmock("posthog-js");
  });

  it("no key → no init and does not load posthog-js", async () => {
    const init = vi.fn();
    const factory = vi.fn(() => ({
      default: {
        __loaded: false,
        init,
        capture: vi.fn(),
        identify: vi.fn(),
        reset: vi.fn(),
      },
    }));
    vi.doMock("posthog-js", factory);

    vi.stubGlobal("window", {});
    const { initPostHog } = await import("./posthog");
    const result = await initPostHog({
      key: undefined,
      host: undefined,
      sessionRecording: undefined,
    });

    expect(result).toBeNull();
    expect(factory).not.toHaveBeenCalled();
    expect(init).not.toHaveBeenCalled();
  });

  it("opt-out passes disable_session_recording to init", async () => {
    const init = vi.fn();
    const client = {
      __loaded: false,
      init: (key: string, opts: Record<string, unknown>) => {
        init(key, opts);
        client.__loaded = true;
      },
      capture: vi.fn(),
      identify: vi.fn(),
      reset: vi.fn(),
    };
    vi.doMock("posthog-js", () => ({ default: client }));
    vi.stubGlobal("window", {});

    const { initPostHog } = await import("./posthog");
    await initPostHog({
      key: "phc_test",
      host: "https://eu.i.posthog.com",
      sessionRecording: "false",
    });

    expect(init).toHaveBeenCalledTimes(1);
    expect(init.mock.calls[0][0]).toBe("phc_test");
    expect(init.mock.calls[0][1]).toMatchObject({
      api_host: "https://eu.i.posthog.com",
      disable_session_recording: true,
      capture_pageview: false,
      person_profiles: "identified_only",
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: "[data-mask]",
      },
    });
  });

  it("readPostHogPublicEnv uses literal process.env.NEXT_PUBLIC_* keys", async () => {
    // Source-level guard: the reader must mention the three literals by name
    // so a refactor back to `env.NEXT_PUBLIC_*` on a process.env param fails CI
    // even before the bundle probe runs.
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const src = readFileSync(
      fileURLToPath(new URL("./posthog.ts", import.meta.url)),
      "utf8",
    );
    expect(src).toMatch(/process\.env\.NEXT_PUBLIC_POSTHOG_KEY/);
    expect(src).toMatch(/process\.env\.NEXT_PUBLIC_POSTHOG_HOST/);
    expect(src).toMatch(/process\.env\.NEXT_PUBLIC_POSTHOG_SESSION_RECORDING/);
    // Forbid the broken pattern: `env = process.env` then `env.NEXT_PUBLIC_*`.
    expect(src).not.toMatch(/env\s*=\s*process\.env/);
    expect(src).not.toMatch(/(?<!process\.)env\.NEXT_PUBLIC_POSTHOG_KEY/);
  });

  it("captureAiQuestionAsked fires ai_question_asked with prompt, role, path", async () => {
    const capture = vi.fn();
    const client = {
      __loaded: false,
      init: (_key: string, _opts: Record<string, unknown>) => {
        client.__loaded = true;
      },
      capture,
      identify: vi.fn(),
      reset: vi.fn(),
    };
    vi.doMock("posthog-js", () => ({ default: client }));
    vi.stubGlobal("window", {});

    const { initPostHog, captureAiQuestionAsked } = await import("./posthog");
    await initPostHog({
      key: "phc_test",
      host: undefined,
      sessionRecording: undefined,
    });

    captureAiQuestionAsked({
      prompt: "  Why is Cedar over budget?  ",
      role: "pm",
      path: "/app/jobs/25-031",
    });
    captureAiQuestionAsked({ prompt: "   ", role: "pm", path: "/app" });

    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith("ai_question_asked", {
      prompt: "Why is Cedar over budget?",
      role: "pm",
      path: "/app/jobs/25-031",
    });
  });
});
