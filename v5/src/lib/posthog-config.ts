import {
  isPostHogSessionRecordingEnabled,
  postHogSessionRecordingInitOptions,
} from "./posthog-session-recording";

/** Demo role labels for PostHog person properties (no PII). */
export const DEMO_ROLE_PROPERTY = {
  executive: "exec",
  pm: "pm",
  superintendent: "super",
  foreman: "foreman",
} as const;

export type DemoRole = keyof typeof DEMO_ROLE_PROPERTY;
export type DemoRoleProperty = (typeof DEMO_ROLE_PROPERTY)[DemoRole];

/** Resolved public env values (already read from process.env literals). */
export type PostHogPublicEnvValues = {
  key: string | undefined;
  host: string | undefined;
  sessionRecording: string | undefined;
};

export type PostHogClientConfig = {
  key: string;
  /** Ingest host from NEXT_PUBLIC_POSTHOG_HOST, or the US default when unset. */
  host: string;
  sessionRecordingEnabled: boolean;
};

/**
 * Resolve client PostHog config from already-read env values.
 * Returns null when the project key is unset — callers must no-op (no network, no errors).
 *
 * Callers that need Next build-time inlining must pass values from literal
 * `process.env.NEXT_PUBLIC_*` reads (see `readPostHogPublicEnv` in posthog.ts).
 * Do not pass `process.env` as an object — Next will not inline dynamic lookups.
 */
export function resolvePostHogClientConfig(
  values: PostHogPublicEnvValues,
): PostHogClientConfig | null {
  const key = values.key?.trim();
  if (!key) return null;

  const hostFromEnv = values.host?.trim();
  const host =
    hostFromEnv && hostFromEnv.length > 0
      ? hostFromEnv
      : "https://us.i.posthog.com";

  return {
    key,
    host,
    sessionRecordingEnabled: isPostHogSessionRecordingEnabled(
      values.sessionRecording,
    ),
  };
}

/** Attribute on the AI assistant question box — session replay may show clear text. */
export const PH_UNMASK_ATTR = "data-ph-unmask";

/** Duck-typed input for unit tests (no DOM required). */
export type MaskableInput = {
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
};

/**
 * Unmask only the AI assistant question box (`data-ph-unmask`).
 * Never unmask password, email, or login-named inputs even if they carry the attr.
 */
export function shouldUnmaskPostHogInput(element: MaskableInput): boolean {
  const type = (element.getAttribute("type") ?? "").toLowerCase();
  const name = (element.getAttribute("name") ?? "").toLowerCase();
  const id = (element.getAttribute("id") ?? "").toLowerCase();
  const autocomplete = (element.getAttribute("autocomplete") ?? "").toLowerCase();

  if (type === "password" || type === "email") return false;
  if (
    name.includes("password") ||
    name.includes("email") ||
    name.includes("login")
  ) {
    return false;
  }
  if (
    id.includes("password") ||
    id.includes("email") ||
    id.includes("login")
  ) {
    return false;
  }
  if (
    autocomplete.includes("password") ||
    autocomplete.includes("email") ||
    autocomplete === "username" ||
    autocomplete === "current-password" ||
    autocomplete === "new-password"
  ) {
    return false;
  }

  return element.hasAttribute(PH_UNMASK_ATTR);
}

/**
 * Session-recording input mask. With `maskAllInputs: true`, return clear text
 * only for the AI prompt; everything else stays masked.
 */
export function maskPostHogInput(
  text: string,
  element?: MaskableInput,
): string {
  if (element && shouldUnmaskPostHogInput(element)) return text;
  return "*".repeat(text.length);
}

/**
 * Strip free-typed input values from autocapture payloads.
 * Session recording masks inputs via maskAllInputs + maskInputFn; this covers
 * `$autocapture` / element props so values do not ride along in events.
 * (AI questions are captured explicitly as `ai_question_asked`, not via autocapture.)
 */
export function stripInputValuesFromCaptureEvent<
  T extends {
    properties?: Record<string, unknown> | null;
  } | null,
>(event: T): T {
  if (!event?.properties) return event;
  const props = event.properties;
  delete props.$el_attr__value;
  delete props.value;
  const elements = props.$elements;
  if (Array.isArray(elements)) {
    for (const el of elements) {
      if (el && typeof el === "object") {
        const row = el as Record<string, unknown>;
        delete row.attr__value;
        delete row.value;
      }
    }
  }
  return event;
}

/** Init options derived from resolved config (for tests + initPostHog). */
export function postHogInitOptionsFromConfig(config: PostHogClientConfig) {
  return {
    api_host: config.host,
    ...postHogSessionRecordingInitOptions(config.sessionRecordingEnabled),
    // Profiles only after identify(demo role) — no anonymous person records.
    person_profiles: "identified_only" as const,
    capture_pageview: false,
    capture_pageleave: true,
    // Autocapture on for clicks; ignore `value` attrs + before_send strip
    // so free-typed input contents never leave the browser in events.
    autocapture: {
      element_attribute_ignorelist: ["value"],
    },
    respect_dnt: true,
    // Do not set IP / geo properties ourselves (project may discard client IP).
    //
    // Masking policy (product):
    // - Demo seed text on screen is fine to record (do not maskAll text with "*").
    // - maskAllInputs: true for every input/textarea, including login fields.
    // - Unmask ONLY the AI assistant question box (`data-ph-unmask`) via maskInputFn.
    // - Never unmask password / email / login inputs even if they carry that attr.
    // - AI prompt text is also sent explicitly as `ai_question_asked` on submit.
    // - Keep [data-mask] for opt-in text nodes.
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: "[data-mask]",
      maskInputFn: maskPostHogInput,
    },
    before_send: stripInputValuesFromCaptureEvent,
  };
}

/** Map a v5 Role to the PostHog demo_role person property. */
export function demoRoleProperty(role: DemoRole): DemoRoleProperty {
  return DEMO_ROLE_PROPERTY[role];
}
