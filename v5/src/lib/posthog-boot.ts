/**
 * Schedule PostHog init after the page is idle so posthog-js and `/flags`
 * stay out of the verify crawl's networkidle window (1.5 s page budget +
 * 500 ms quiet). requestIdleCallback alone can fire during hydration and
 * still compete with that measurement.
 */

/** Wait this long after `load` before allowing an idle boot. */
export const POSTHOG_BOOT_MIN_DELAY_MS = 2000;

export type SchedulePostHogBootOptions = {
  /** Override min delay (tests). */
  minDelayMs?: number;
  /** Inject timers / idle APIs (tests). */
  schedule?: {
    setTimeout: typeof setTimeout;
    clearTimeout: typeof clearTimeout;
    requestIdleCallback?: (
      cb: IdleRequestCallback,
      opts?: IdleRequestOptions,
    ) => number;
    cancelIdleCallback?: (id: number) => void;
    readyState?: DocumentReadyState;
    addLoadListener?: (handler: () => void) => void;
    removeLoadListener?: (handler: () => void) => void;
  };
};

/**
 * Run `boot` after window `load`, a minimum delay, then requestIdleCallback
 * (or immediately when idle APIs are missing). Returns a cancel function.
 */
export function schedulePostHogBoot(
  boot: () => void,
  options: SchedulePostHogBootOptions = {},
): () => void {
  const minDelayMs = options.minDelayMs ?? POSTHOG_BOOT_MIN_DELAY_MS;
  const s = options.schedule;
  const setTimeoutFn = s?.setTimeout ?? setTimeout;
  const clearTimeoutFn = s?.clearTimeout ?? clearTimeout;
  const ric =
    s?.requestIdleCallback ??
    (typeof window !== "undefined"
      ? window.requestIdleCallback?.bind(window)
      : undefined);
  const cancelRic =
    s?.cancelIdleCallback ??
    (typeof window !== "undefined"
      ? window.cancelIdleCallback?.bind(window)
      : undefined);
  const readyState =
    s?.readyState ??
    (typeof document !== "undefined" ? document.readyState : "complete");

  let cancelled = false;
  let idleId: number | undefined;
  let delayId: ReturnType<typeof setTimeout> | undefined;
  let loadHandler: (() => void) | undefined;

  const runIdle = () => {
    if (cancelled) return;
    if (typeof ric === "function") {
      idleId = ric(
        () => {
          if (!cancelled) boot();
        },
        // Safety net only — min delay already cleared the page budget window.
        { timeout: 3000 },
      );
    } else {
      boot();
    }
  };

  const afterLoad = () => {
    if (cancelled) return;
    delayId = setTimeoutFn(runIdle, minDelayMs);
  };

  if (readyState === "complete") {
    afterLoad();
  } else {
    loadHandler = afterLoad;
    if (s?.addLoadListener) {
      s.addLoadListener(loadHandler);
    } else if (typeof window !== "undefined") {
      window.addEventListener("load", loadHandler, { once: true });
    } else {
      afterLoad();
    }
  }

  return () => {
    cancelled = true;
    if (loadHandler) {
      if (s?.removeLoadListener) s.removeLoadListener(loadHandler);
      else if (typeof window !== "undefined") {
        window.removeEventListener("load", loadHandler);
      }
    }
    if (delayId != null) clearTimeoutFn(delayId);
    if (idleId != null && typeof cancelRic === "function") cancelRic(idleId);
  };
}
