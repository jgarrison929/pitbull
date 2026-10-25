/**
 * Pure PostHog Error Tracking helper (client injected).
 * Callers pass the live posthog instance so this module stays testable without
 * loading posthog-js (which needs browser APIs).
 */

export type ExceptionSource =
  | "reportError"
  | "window_onerror"
  | "unhandled_rejection"
  | "error_boundary"
  | "react_error_boundary"
  | "fetch_interceptor"
  | "manual";

export interface CaptureExceptionContext {
  source: ExceptionSource;
  level?: "error" | "warning" | "fatal";
  httpStatusCode?: number;
  requestMethod?: string;
  requestPath?: string;
  componentStack?: string;
  pageUrl?: string;
  /** Extra safe metadata (no secrets). */
  extra?: Record<string, unknown>;
}

/** Minimal client surface used for Error Tracking (injectable in tests). */
export type PostHogExceptionClient = {
  __loaded?: boolean;
  captureException?: (
    error: unknown,
    props?: Record<string, unknown>
  ) => unknown;
  capture?: (event: string, props?: Record<string, unknown>) => unknown;
};

/**
 * Normalize anything throwable into an Error for captureException.
 */
export function toError(
  input: unknown,
  fallbackMessage = "Unknown error"
): Error {
  if (input instanceof Error) return input;
  if (typeof input === "string" && input.trim()) return new Error(input);
  if (input && typeof input === "object") {
    const o = input as Record<string, unknown>;
    const msg =
      (typeof o.message === "string" && o.message) ||
      (typeof o.error === "string" && o.error) ||
      fallbackMessage;
    const err = new Error(msg);
    if (typeof o.name === "string") err.name = o.name;
    if (typeof o.stack === "string") err.stack = o.stack;
    return err;
  }
  return new Error(fallbackMessage);
}

/**
 * Capture to PostHog Error Tracking when the client is loaded.
 * Never throws. Always pass `client` (use getDefaultPostHogClient() in app code).
 */
export function capturePostHogException(
  errorLike: unknown,
  context: CaptureExceptionContext,
  client: PostHogExceptionClient
): void {
  try {
    if (!client.__loaded) return;

    const error = toError(
      errorLike,
      context.extra?.message as string | undefined
    );
    let pageUrl = context.pageUrl;
    if (!pageUrl && typeof window !== "undefined") {
      try {
        pageUrl = window.location?.href;
      } catch {
        pageUrl = undefined;
      }
    }
    const props: Record<string, unknown> = {
      exception_source: context.source,
      level: context.level ?? "error",
    };
    if (pageUrl) props.page_url = pageUrl;
    if (context.httpStatusCode != null)
      props.http_status_code = context.httpStatusCode;
    if (context.requestMethod) props.request_method = context.requestMethod;
    if (context.requestPath) props.request_path = context.requestPath;
    if (context.componentStack)
      props.component_stack = context.componentStack;
    if (context.extra) {
      for (const [k, v] of Object.entries(context.extra)) {
        if (v !== undefined) props[k] = v;
      }
    }

    if (typeof client.captureException === "function") {
      client.captureException(error, props);
      return;
    }

    client.capture?.("$exception", {
      $exception_message: error.message,
      $exception_type: error.name,
      $exception_stack_trace_raw: error.stack,
      ...props,
    });
  } catch {
    // never break the app for analytics
  }
}
