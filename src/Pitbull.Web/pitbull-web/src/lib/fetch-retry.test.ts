import { describe, it, expect } from "vitest";
import {
  classifyFetchFailure,
  shouldRetryTransient,
  isTransientHttpStatus,
} from "./fetch-retry";

describe("fetch-retry (3.2.2)", () => {
  it("classifies ECONNRESET-style network errors", () => {
    expect(classifyFetchFailure(new Error("read ECONNRESET"))).toBe("network_error");
    expect(classifyFetchFailure(new TypeError("Failed to fetch"))).toBe("network_error");
  });

  it("classifies 502/503/504 as transient", () => {
    expect(isTransientHttpStatus(502)).toBe(true);
    expect(classifyFetchFailure(undefined, 503)).toBe("http_503");
  });

  it("retries GET after network error with backoff", () => {
    const d = shouldRetryTransient({
      method: "GET",
      attempt: 0,
      error: new Error("ECONNRESET"),
    });
    expect(d.retry).toBe(true);
    expect(d.delayMs).toBe(200);
  });

  it("does not retry POST (no invent success)", () => {
    const d = shouldRetryTransient({
      method: "POST",
      attempt: 0,
      error: new Error("ECONNRESET"),
    });
    expect(d.retry).toBe(false);
  });

  it("stops after max attempts", () => {
    const d = shouldRetryTransient({
      method: "GET",
      attempt: 2,
      maxAttempts: 3,
      status: 502,
    });
    expect(d.retry).toBe(false);
  });
});
