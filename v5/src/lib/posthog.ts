import {
  demoRoleProperty,
  postHogInitOptionsFromConfig,
  resolvePostHogClientConfig,
  type DemoRole,
  type PostHogClientConfig,
  type PostHogPublicEnvValues,
} from "./posthog-config";
import {
  applyPbTestRunGate,
  currentPbTestRun,
  type PbTestRunClient,
} from "./posthog-test-run";

type PostHogClient = {
  __loaded?: boolean;
  init: (key: string, options: Record<string, unknown>) => void;
  capture: (event: string, properties?: Record<string, unknown>) => void;
  identify: (
    distinctId: string,
    properties?: Record<string, unknown>,
  ) => void;
  reset: () => void;
  register?: PbTestRunClient["register"];
  startSessionRecording?: PbTestRunClient["startSessionRecording"];
  get_session_replay_url?: PbTestRunClient["get_session_replay_url"];
};

let client: PostHogClient | null = null;
let initPromise: Promise<PostHogClient | null> | null = null;

/**
 * Single call site with literal `process.env.NEXT_PUBLIC_*` member access so
 * Next.js inlines the values into the client bundle at build time.
 * Never refactor this to `env.NEXT_PUBLIC_*` on a `process.env` parameter.
 */
export function readPostHogPublicEnv(): PostHogPublicEnvValues {
  return {
    key: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    sessionRecording: process.env.NEXT_PUBLIC_POSTHOG_SESSION_RECORDING,
  };
}

/** Resolve config from literal env reads (production path). */
export function getPostHogConfig(): PostHogClientConfig | null {
  return resolvePostHogClientConfig(readPostHogPublicEnv());
}

/**
 * Lazy-load and init posthog-js after hydration when a key is present.
 * No key → complete no-op (does not import posthog-js, no network).
 *
 * Pass `values` only in tests. Production must omit it so the literal
 * `readPostHogPublicEnv()` path runs and Next can inline the key.
 */
export async function initPostHog(
  values?: PostHogPublicEnvValues,
): Promise<PostHogClient | null> {
  if (typeof window === "undefined") return null;

  const config = resolvePostHogClientConfig(values ?? readPostHogPublicEnv());
  if (!config) return null;

  if (client?.__loaded) return client;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const mod = await import("posthog-js");
    const posthog = mod.default as unknown as PostHogClient;
    if (posthog.__loaded) {
      client = posthog;
      armTestRun(posthog);
      return posthog;
    }
    posthog.init(config.key, postHogInitOptionsFromConfig(config));
    client = posthog;
    armTestRun(posthog);
    return posthog;
  })().catch(() => {
    // Analytics must never break product flows or spam the console in CI.
    initPromise = null;
    return null;
  });

  return initPromise;
}

export function getPostHogClient(): PostHogClient | null {
  return client?.__loaded ? client : null;
}

/**
 * When `pb_test_run` is set, tag this session and force recording on.
 * No cookie returns before any PostHog call, so init options and masking
 * stay exactly as `postHogInitOptionsFromConfig` built them.
 */
function armTestRun(posthog: PostHogClient): void {
  const testRun = currentPbTestRun();
  if (!testRun) return;
  if (
    !posthog.register ||
    !posthog.startSessionRecording ||
    !posthog.get_session_replay_url
  ) {
    return;
  }
  try {
    applyPbTestRunGate(
      posthog as PbTestRunClient,
      testRun,
      window as { __pbReplayUrl?: string },
    );
  } catch {
    // Test tagging must not take down a product session.
  }
}

/** Identify by demo role only — person property, no real PII. */
export function identifyDemoRole(role: DemoRole | null | undefined): void {
  const ph = getPostHogClient();
  if (!ph) return;
  if (!role) {
    ph.reset();
    return;
  }
  const demoRole = demoRoleProperty(role);
  ph.identify(`demo:${demoRole}`, { demo_role: demoRole });
}

export function capturePageview(pathname: string, search: string): void {
  const ph = getPostHogClient();
  if (!ph || typeof window === "undefined") return;
  let url = window.origin + pathname;
  if (search) url += `?${search}`;
  ph.capture("$pageview", {
    $current_url: url,
    path: pathname,
  });
}

/** Explicit AI question event — prompt is intentional product telemetry (demo only). */
export function captureAiQuestionAsked(args: {
  prompt: string;
  role: DemoRole;
  path: string;
}): void {
  const ph = getPostHogClient();
  if (!ph) return;
  const prompt = args.prompt.trim();
  if (!prompt) return;
  ph.capture("ai_question_asked", {
    prompt,
    role: demoRoleProperty(args.role),
    path: args.path,
  });
}
