import { describe, expect, it } from "vitest";
import {
  toError,
  capturePostHogException,
  type PostHogExceptionClient,
} from "./posthog-exception";

describe("toError", () => {
  it("passes through Error instances", () => {
    const e = new Error("boom");
    expect(toError(e)).toBe(e);
  });

  it("wraps strings and objects used by handlers", () => {
    expect(toError("fail").message).toBe("fail");
    expect(toError({ message: "api down", name: "ApiError" }).name).toBe(
      "ApiError"
    );
  });
});

describe("capturePostHogException", () => {
  it("calls captureException with source context (real shipped helper)", () => {
    const calls: Array<{ error: unknown; props?: Record<string, unknown> }> =
      [];
    const client: PostHogExceptionClient = {
      __loaded: true,
      captureException(error, props) {
        calls.push({ error, props });
      },
    };

    const err = new Error("field submit failed");
    capturePostHogException(
      err,
      {
        source: "reportError",
        httpStatusCode: 500,
        requestPath: "/api/projects/x/daily-reports",
      },
      client
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]!.error).toBe(err);
    expect(calls[0]!.props).toMatchObject({
      exception_source: "reportError",
      http_status_code: 500,
      request_path: "/api/projects/x/daily-reports",
    });
  });

  it("no-ops when client not loaded", () => {
    let called = false;
    capturePostHogException(
      new Error("x"),
      { source: "manual" },
      {
        __loaded: false,
        captureException() {
          called = true;
        },
      }
    );
    expect(called).toBe(false);
  });

  it("falls back to capture when captureException missing", () => {
    const events: Array<{ event: string; props?: Record<string, unknown> }> =
      [];
    capturePostHogException(
      new Error("legacy"),
      { source: "manual" },
      {
        __loaded: true,
        capture(event, props) {
          events.push({ event, props });
        },
      }
    );
    expect(events).toHaveLength(1);
    expect(events[0]!.event).toBe("$exception");
    expect(events[0]!.props?.$exception_message).toBe("legacy");
  });
});
