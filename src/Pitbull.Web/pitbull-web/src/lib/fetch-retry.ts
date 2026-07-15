/**
 * Transient network retry policy for critical API GETs (3.2.2).
 * Does not invent success; only retries when transport/gateway fails.
 */

export type TransientRetryReason =
  | "network_error"
  | "abort"
  | "http_502"
  | "http_503"
  | "http_504";

export interface RetryDecision {
  retry: boolean;
  reason?: TransientRetryReason;
  delayMs: number;
}

/** Max attempts including the first try. */
export const DEFAULT_MAX_ATTEMPTS = 3;

export function isTransientHttpStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

export function classifyFetchFailure(error: unknown, status?: number): TransientRetryReason | null {
  if (status != null && isTransientHttpStatus(status)) {
    if (status === 502) return "http_502";
    if (status === 503) return "http_503";
    return "http_504";
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (error.name === "AbortError" || msg.includes("aborted")) return "abort";
    if (
      msg.includes("econnreset") ||
      msg.includes("network") ||
      msg.includes("failed to fetch") ||
      msg.includes("load failed")
    ) {
      return "network_error";
    }
  }
  return null;
}

/**
 * @param attempt 0-based attempt index already completed (0 = after first failure)
 */
export function shouldRetryTransient(input: {
  method: string;
  attempt: number;
  maxAttempts?: number;
  error?: unknown;
  status?: number;
}): RetryDecision {
  const max = input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const method = (input.method || "GET").toUpperCase();
  // Only idempotent GETs by default — never invent POST success via retry
  if (method !== "GET" && method !== "HEAD") {
    return { retry: false, delayMs: 0 };
  }
  if (input.attempt + 1 >= max) {
    return { retry: false, delayMs: 0 };
  }
  const reason = classifyFetchFailure(input.error, input.status);
  if (!reason) return { retry: false, delayMs: 0 };
  // linear backoff: 200ms, 400ms
  const delayMs = 200 * (input.attempt + 1);
  return { retry: true, reason, delayMs };
}

export async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((r) => setTimeout(r, ms));
}
