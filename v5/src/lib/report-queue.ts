/**
 * Foreman report queue (5.0.4-d). One plan, one pending payload, in
 * sessionStorage so a reload still shows the unsent state. The send claim
 * is synchronous: a second click while the first post is in flight does not
 * start another one.
 */

export type QueueStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type QueuedReport = {
  planId: string;
  jobNumber: string;
  fields: Record<string, string>;
};

const inflight = new Set<string>();
const CHANGE = "pcs-report-queue";

/** Client-generated. A replay with this key must not create a second report. */
export const REPORT_IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,80}$/;

function keyFor(planId: string) {
  return `pcs-report-unsent:${planId}`;
}

function idempotencyKeyFor(planId: string) {
  return `pcs-report-key:${planId}`;
}

/** Undefined when missing or not a key this server will honor. */
export function validReportIdempotencyKey(
  value: string | undefined | null,
): string | undefined {
  if (!value || !REPORT_IDEMPOTENCY_KEY.test(value)) return undefined;
  return value;
}

/**
 * Stable for one unsent attempt, including a reload. A successful send
 * clears it so the next amend is a new post.
 */
export function reportIdempotencyKey(planId: string, store: QueueStore): string {
  const storageKey = idempotencyKeyFor(planId);
  const existing = store.getItem(storageKey);
  if (existing && REPORT_IDEMPOTENCY_KEY.test(existing)) return existing;
  const next = crypto.randomUUID();
  store.setItem(storageKey, next);
  return next;
}

export function clearReportIdempotencyKey(planId: string, store: QueueStore) {
  store.removeItem(idempotencyKeyFor(planId));
}

function emit() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CHANGE));
}

/** Same-tab writes do not fire the `storage` event, so the form listens here. */
export function subscribeReportQueue(onStoreChange: () => void) {
  window.addEventListener(CHANGE, onStoreChange);
  return () => window.removeEventListener(CHANGE, onStoreChange);
}

/** Stable string snapshot for `useSyncExternalStore` (sessionStorage). */
export function queuedReportRaw(planId: string): string | null {
  return sessionStorage.getItem(keyFor(planId));
}

export function readQueuedReport(
  planId: string,
  store: QueueStore,
): QueuedReport | null {
  const raw = store.getItem(keyFor(planId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as QueuedReport;
    if (
      parsed?.planId !== planId ||
      parsed.fields == null ||
      typeof parsed.fields !== "object"
    ) {
      return null;
    }
    return {
      planId: parsed.planId,
      jobNumber: String(parsed.jobNumber ?? ""),
      fields: parsed.fields,
    };
  } catch {
    return null;
  }
}

export function writeQueuedReport(report: QueuedReport, store: QueueStore) {
  store.setItem(keyFor(report.planId), JSON.stringify(report));
  emit();
}

export function clearQueuedReport(planId: string, store: QueueStore) {
  store.removeItem(keyFor(planId));
  emit();
}

/** First caller wins until `releaseReportSend`. */
export function claimReportSend(planId: string): boolean {
  if (inflight.has(planId)) return false;
  inflight.add(planId);
  return true;
}

export function releaseReportSend(planId: string) {
  inflight.delete(planId);
}
