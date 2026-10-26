// "sandbox reset median ≤ 1.5 s": 5 timed Reset demo runs in the visitor's own sandbox. Hard FAIL when
// the median is over RESET_BUDGET_MS, when any reset errors or times out, or when fewer than
// RESET_SAMPLES samples succeed. No warn mode, no flag to skip it or raise the budget; every target
// (staging, production, local) runs it.
//
// One sample = wall clock from the "Reset demo" click until the post-reset page is READY. READY means,
// on the same poll:
//   1. the URL path is <base>/app and its query has reset=1 (resetDemo's redirect),
//   2. the sandbox's seeded-at datetime in the DOM is NEW: it differs from the value read before the
//      click, so the old page can never count as ready,
//   3. the main content has rendered: the page's <main> landmark is visible and, inside it, the portfolio
//      table shows exactly the default seed's job count of visible job-link rows (the same rows the
//      "portfolio loads from Postgres" check counts).
// Network idle is NOT part of the pass rule. The idle-inclusive time (the first definition: READY plus
// no request in flight for RESET_IDLE_MS, the crawl's networkidle window) is still measured and
// reported as information only; it can never change pass or fail.
// Playwright's networkidle state is not re-armed by the client-side redirect a server action does, so
// the informational idle time tracks in-flight requests from page request events.
//
// Fail fast with a reason (the 502b sign-off incident: the reset server action was cut off, Railway
// logged POST 499, and the sample only said "not ready" 20 s later). A sample fails AT ONCE, without
// waiting for the timeout, when the reset POST itself fails (HTTP >= 400 such as 499/5xx, or the request
// is aborted), or when a check sees an error screen (Next's built-in error screen or the app's
// "Page load failed" / "Shell load failed" boundary, by text or by its data-testid marker): neither can
// turn into a ready page. Every failure reason names the URL with its query and what <main> and its job
// rows showed on the last check. The pass rule above is unchanged.
// When verify.mjs registered an evidence folder on the page (setFailureEvidence), each failed sample is
// captured there (screenshot, HTML, URL, console/page errors, failed requests; see evidence.mjs).
import { ERROR_BOUNDARY, ERROR_BOUNDARY_SELECTOR } from "./checks.mjs";
import { captureFailure, failureEvidenceFor, startFailureRecorder } from "./evidence.mjs";

export const RESET_STEP = "sandbox reset median ≤ 1.5 s (5 resets)";
export const RESET_SAMPLES = 5;
export const RESET_BUDGET_MS = 1500;
export const RESET_IDLE_MS = 500;
export const RESET_TIMEOUT_MS = 20_000;
/** Info-only idle watch stops this long after READY and is reported as "capped". */
export const RESET_IDLE_CAP_MS = 3000;
// These constants are the whole rule: nothing in this file reads environment variables or command-line arguments, and no
// function takes a budget, sample-count or idle-cap argument (checks.test.mjs scans this source).

const sleepReal = (ms) => new Promise((r) => setTimeout(r, ms));
const firstLine = (e) => String(e?.message ?? e).split("\n")[0];
const ERROR_SCREEN_SOURCES = ERROR_BOUNDARY.map((re) => re.source);

/** "main visible, 3/4 job rows" for whatever the last check could read. */
function contentState(seen, expectedRows) {
  if (!seen) return "nothing read yet";
  const main = seen.main === undefined ? "main unknown" : `main ${seen.main ? "visible" : "missing"}`;
  return `${main}, ${Number.isInteger(seen.rows) ? seen.rows : "?"}/${expectedRows} job rows`;
}

/**
 * Watches the reset POST (the Reset demo server action / form post to the app's origin): returns
 * { failure } once it answers HTTP >= 400 or fails on the network. Tolerates page doubles without
 * these events.
 */
function watchResetPost(page, origin) {
  const state = { failure: null };
  const sameOrigin = (u) => {
    try {
      return new URL(u).origin === origin;
    } catch {
      return false;
    }
  };
  const where = (u) => {
    const x = new URL(u);
    return `${x.pathname}${x.search}`;
  };
  const onResponse = (r) => {
    const req = typeof r?.request === "function" ? r.request() : null;
    if (state.failure || !req || req.method?.() !== "POST" || !sameOrigin(r.url()) || !(r.status() >= 400)) return;
    state.failure = `reset POST ${where(r.url())} answered HTTP ${r.status()}`;
  };
  const onFailed = (req) => {
    if (state.failure || typeof req?.method !== "function" || req.method() !== "POST" || !sameOrigin(req.url())) return;
    state.failure = `reset POST ${where(req.url())} failed: ${req.failure?.()?.errorText ?? "request failed"}`;
  };
  const offs = [];
  for (const [e, f] of [["response", onResponse], ["requestfailed", onFailed]]) {
    try {
      page.on(e, f);
      offs.push(() => page.off(e, f));
    } catch {
      // page double without this event
    }
  }
  return {
    get failure() {
      return state.failure;
    },
    stop: () => offs.forEach((off) => off()),
  };
}

/** Median of a non-empty list (odd: middle value; even: mean of the two middle values). */
export function median(values) {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * samples: [{ ms } | { error }] in run order → { ok, failures, values, median, detail }.
 * Fails on: not exactly RESET_SAMPLES attempts, any errored/timed-out reset, fewer than RESET_SAMPLES
 * successful samples, or median > RESET_BUDGET_MS. Takes no budget argument on purpose.
 */
export function evaluateResetTimes(samples) {
  const list = Array.isArray(samples) ? samples : [];
  const failures = [];
  const values = list.filter((s) => Number.isFinite(s?.ms) && s.ms >= 0).map((s) => Math.round(s.ms));
  if (list.length !== RESET_SAMPLES) failures.push(`${list.length} resets attempted, need ${RESET_SAMPLES}`);
  list.forEach((s, i) => {
    if (!(Number.isFinite(s?.ms) && s.ms >= 0)) failures.push(`reset ${i + 1} failed: ${s?.error ?? "no time recorded"}`);
  });
  if (values.length < RESET_SAMPLES) failures.push(`${values.length}/${RESET_SAMPLES} resets succeeded`);
  const med = values.length ? Math.round(median(values)) : null;
  if (med === null || !(med <= RESET_BUDGET_MS)) failures.push(`median ${med ?? "n/a"} ms > ${RESET_BUDGET_MS} ms budget`);
  const shown = list.map((s) => (Number.isFinite(s?.ms) ? `${Math.round(s.ms)}` : "ERR")).join(", ");
  const detail = `resets ${shown} ms; median ${med ?? "n/a"} ms (budget ${RESET_BUDGET_MS} ms)${failures.length ? ` — ${failures.join("; ")}` : ""}`;
  return { ok: failures.length === 0, failures, values, median: med, detail };
}

/** Counts in-flight page requests; `lastAt` is when the count last changed. */
function trackRequests(page, now) {
  const inflight = new Set();
  let lastAt = now();
  const start = (r) => {
    inflight.add(r);
    lastAt = now();
  };
  const end = (r) => {
    if (inflight.delete(r)) lastAt = now();
  };
  page.on("request", start);
  page.on("requestfinished", end);
  page.on("requestfailed", end);
  return {
    get busy() {
      return inflight.size > 0;
    },
    get lastAt() {
      return lastAt;
    },
    stop() {
      page.off("request", start);
      page.off("requestfinished", end);
      page.off("requestfailed", end);
    },
  };
}

/**
 * One timed reset on a signed-in page. Untimed setup: load /app and read seeded-at. Timed: click
 * Reset demo → READY (see the header). Returns { ms, idleMs, idleCapped }: ms is the pass-rule time;
 * idleMs is the informational idle-inclusive time, null with idleCapped when the network was not quiet
 * within RESET_IDLE_CAP_MS after READY. timeoutMs bounds the whole sample: READY observed more than
 * timeoutMs after the click throws, as does no READY by then or any page error before READY.
 */
export async function timeOneReset(page, base, { expectedRows, now = Date.now, sleep = sleepReal, timeoutMs = RESET_TIMEOUT_MS, pollMs = 25 } = {}) {
  if (!Number.isInteger(expectedRows) || expectedRows < 1) throw new Error(`expectedRows must be a positive integer (got ${expectedRows})`);
  await page.goto(`${base}/app`, { waitUntil: "networkidle" });
  const appPath = new URL(`${base}/app`).pathname;
  const before = await page.getByTestId("seeded-at").getAttribute("datetime", { timeout: timeoutMs });
  if (!before) throw new Error("no seeded-at before reset");
  await page.getByTestId("user-menu").click({ timeout: timeoutMs });
  /**
   * One check = one page.evaluate: seeded-at, <main>, the row count and the URL are read in a single
   * page task, so a page script can never run between them and no check can mix two page states.
   * Any missing element or evaluate error makes the check { ok: false }.
   */
  const readCheck = async () => {
    try {
      const snap = await page.evaluate(({ screenSources, boundarySel }) => {
        const visible = (el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
        };
        const seeded = document.querySelector('[data-testid="seeded-at"]');
        const main = document.querySelector("main");
        const rows = [...document.querySelectorAll('main [data-testid="portfolio-table"] [data-testid="job-link"]')].filter(visible).length;
        // Error screens: the app boundary's stable marker first, then Next's built-in / boundary wording.
        const marker = document.querySelector(boundarySel);
        const text = document.body ? document.body.innerText : "";
        const hit = screenSources.map((src) => text.match(new RegExp(src, "i"))).find(Boolean);
        const errorScreen = marker ? `marker [data-testid="${marker.getAttribute("data-testid")}"]${hit ? ` "${hit[0]}"` : ""}` : hit ? `"${hit[0]}"` : null;
        return { href: location.href, after: seeded ? seeded.getAttribute("datetime") : null, hasSeeded: Boolean(seeded), main: Boolean(main) && visible(main), rows, errorScreen };
      }, { screenSources: ERROR_SCREEN_SOURCES, boundarySel: ERROR_BOUNDARY_SELECTOR });
      const here = new URL(snap.href);
      const href = `${here.pathname}${here.search}`;
      const errorScreen = snap.errorScreen ?? null;
      if (!snap.hasSeeded) return { ok: false, href, error: "seeded-at element missing", main: snap.main, rows: snap.rows, errorScreen };
      return {
        ok: true,
        errorScreen,
        href,
        url: here.pathname === appPath && here.searchParams.get("reset") === "1",
        seeded: Boolean(snap.after) && snap.after !== before,
        main: snap.main,
        rows: snap.rows,
      };
    } catch (error) {
      let href = null;
      try {
        const here = new URL(page.url());
        href = `${here.pathname}${here.search}`;
      } catch {
        // diagnostics only
      }
      return { ok: false, href, error: String(error?.message ?? error).split("\n")[0] };
    }
  };
  const net = trackRequests(page, now);
  const post = watchResetPost(page, new URL(base).origin);
  try {
    const t0 = now();
    const deadline = t0 + timeoutMs;
    await page.getByRole("button", { name: "Reset demo" }).click({ timeout: timeoutMs });
    // Each check is atomic: `seen` is replaced wholesale by one check's single-task snapshot. If any
    // read throws, that check is a failed read: nothing from it or from an earlier check is carried
    // over, ready is not evaluated, and the loop sleeps and re-checks (bounded by the deadline).
    let seen = null;
    let readyAt = null;
    const stateOf = (c) =>
      c.ok
        ? `seeded-at ${c.seeded ? "new" : "unchanged"}, main ${c.main ? "visible" : "missing"}, ${c.rows}/${expectedRows} job rows`
        : `page read failed: ${c.error}${c.main !== undefined || c.rows !== undefined ? `; ${contentState(c, expectedRows)}` : ""}`;
    while (readyAt === null) {
      seen = await readCheck();
      const all = seen.ok && seen.url && seen.seeded && seen.main && seen.rows === expectedRows && !seen.errorScreen;
      const at = now();
      if (all && at - t0 <= timeoutMs) readyAt = at;
      else if (all) throw new Error(`reset ready at ${at - t0} ms, after the ${timeoutMs} ms timeout`);
      else if (seen.errorScreen) {
        // An error screen never becomes the reseeded portfolio: fail now, not at the timeout.
        throw new Error(`reset failed fast at ${at - t0} ms: error screen ${seen.errorScreen} (url ${seen.href ?? "unknown"}, ${stateOf(seen)})`);
      } else if (post.failure) {
        // The reset POST was cut off or refused (the 502b 499): no redirect is coming.
        throw new Error(`reset failed fast at ${at - t0} ms: ${post.failure} (url ${seen.href ?? "unknown"}, ${stateOf(seen)})`);
      } else if (at >= deadline) {
        throw new Error(`reset not ready after ${timeoutMs} ms (url ${seen.href ?? "unknown"}, ${stateOf(seen)})`);
      } else await sleep(Math.min(pollMs, Math.max(1, deadline - at)));
    }
    // Information only: watch until the network has been quiet for RESET_IDLE_MS, at most RESET_IDLE_CAP_MS after READY.
    const capAt = readyAt + RESET_IDLE_CAP_MS;
    for (;;) {
      if (!net.busy && now() - net.lastAt >= RESET_IDLE_MS) {
        return { ms: readyAt - t0, idleMs: Math.max(readyAt, net.lastAt + RESET_IDLE_MS) - t0, idleCapped: false };
      }
      if (now() >= capAt) return { ms: readyAt - t0, idleMs: null, idleCapped: true };
      await sleep(Math.min(pollMs, Math.max(1, capAt - now())));
    }
  } finally {
    net.stop();
    post.stop();
  }
}

/**
 * The step verify.mjs runs: RESET_SAMPLES timed resets, each error recorded as that sample's failure
 * (never dropped), then evaluateResetTimes on the READY times only. The idle-inclusive times ride
 * along as information. Returns { ok, detail, samples, values, median, idleValues, idleMedian, failures }.
 */
export async function runResetTimeStep(page, base, opts = {}) {
  const samples = [];
  const evidence = failureEvidenceFor(page);
  const recorder = evidence ? startFailureRecorder(page) : null;
  for (let i = 0; i < RESET_SAMPLES; i++) {
    const mark = recorder?.mark() ?? 0;
    try {
      samples.push(await timeOneReset(page, base, opts));
    } catch (error) {
      const sample = { error: firstLine(error) };
      if (evidence) {
        // Captured while the page still shows the failed reset; capture never changes the verdict.
        const files = await captureFailure(page, { dir: evidence.dir, kind: "reset", label: `sample-${i + 1}`, reason: sample.error, recorder, mark, secrets: evidence.secrets }).catch(() => null);
        if (files?.json) sample.evidence = files.json;
      }
      samples.push(sample);
    }
  }
  recorder?.stop();
  const verdict = evaluateResetTimes(samples);
  const idle = resetIdleInfo(samples);
  return { ...verdict, ...idle, detail: `${verdict.detail}; ${idle.idleDetail}`, samples };
}

/** Informational idle-inclusive times (old definition). Never read by evaluateResetTimes. */
export function resetIdleInfo(samples) {
  const idleValues = (samples ?? []).map((s) => (Number.isFinite(s?.idleMs) ? Math.round(s.idleMs) : s?.idleCapped ? "capped" : null));
  const known = idleValues.filter((v) => typeof v === "number");
  const idleMedian = known.length ? Math.round(median(known)) : null;
  return {
    idleValues,
    idleMedian,
    idleDetail: `info only, not in the pass rule: idle-inclusive ${idleValues.map((v) => v ?? "n/a").join(", ")} ms${idleValues.includes("capped") ? ` (capped = not quiet ${RESET_IDLE_CAP_MS} ms after ready)` : ""}, median ${idleMedian ?? "n/a"} ms`,
  };
}
