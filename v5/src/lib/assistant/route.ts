// Maps a typed or spoken request to one typed action. Deterministic, so tests and demos are repeatable.
// A language model can replace this later; it would emit the same { action, args } shape.

import type { LineInput } from "@/lib/plan-line";

export type ActionName =
  | "portfolio.summary"
  | "job.costVariance"
  | "dailyPlan.show"
  | "dailyPlan.submit"
  | "dailyPlan.updateLine"
  | "progressClaim.lock";

export type JobArgs = {
  job?: string;
  /** dailyPlan.updateLine: the line by id (screens) or by words (assistant), and the change. */
  lineId?: string;
  lineRef?: string;
  change?: LineInput;
};
export type Intent = { action: ActionName; args: JobArgs };

export type JobRef = { number: string; name: string; shortName: string };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Aliases a person would say: the job number, the short name, or its first word ("Cedar", "SR-99"). */
function aliases(j: JobRef) {
  return [j.number, j.shortName, j.name.split(/[\s/]+/)[0]]
    .map(norm)
    .filter((a) => a.length >= 2);
}

export function findJob(prompt: string, jobs: JobRef[]) {
  const p = norm(prompt);
  return jobs.find((j) => aliases(j).some((a) => p.includes(a)));
}

export function route(prompt: string, jobs: JobRef[]): Intent | null {
  const text = prompt.toLowerCase();
  // A job number that isn't in this sandbox still goes to the action, which refuses it.
  const job =
    findJob(prompt, jobs)?.number ?? prompt.match(/\b\d{2}-\d{3}\b/)?.[0];
  const args: JobArgs = job ? { job } : {};
  const has = (re: RegExp) => re.test(text);

  const change = parseChange(prompt);
  if (change) {
    // Cost codes look like job numbers, so an edit takes its job only from a known job name.
    const known = findJob(prompt, jobs)?.number;
    return {
      action: "dailyPlan.updateLine",
      args: { ...(known ? { job: known } : {}), lineRef: prompt, change },
    };
  }
  if (
    has(/\b(lock|claim)\b/) &&
    has(/\b(progress|claim|earned|period)\b/)
  )
    return { action: "progressClaim.lock", args };
  if (has(/\b(submit|send|file)\b/) && has(/\b(plan|it|tomorrow)\b/))
    return { action: "dailyPlan.submit", args };
  if (has(/\b(plan|tomorrow|crew|schedule)\b/))
    return { action: "dailyPlan.show", args };
  if (job && has(/\b(cost|variance|over|overrun|budget|why|losing|money)\b/))
    return { action: "job.costVariance", args };
  if (has(/\b(portfolio|summary|summarize|risk|jobs|status|how)\b/))
    return { action: "portfolio.summary", args: {} };
  if (job) return { action: "job.costVariance", args };
  return null;
}

const n = String.raw`(\d[\d,]*(?:\.\d+)?)`;

/** "change the pour to 80 man-hours", "set the cage to 5 workers", "note on the pour: crane at 6". */
export function parseChange(prompt: string): LineInput | null {
  const text = prompt.toLowerCase();
  const note = prompt.match(/\bnotes?\b[^:]*:\s*(.+)$/i);
  if (note && /\b(add|note|notes|set)\b/i.test(prompt))
    return { notes: note[1].trim() };
  if (
    !/\b(change|set|make|update|bump|raise|lower|move|put|increase|decrease)\b/.test(
      text,
    )
  )
    return null;
  const pick = (re: RegExp) =>
    text.match(new RegExp(`${n}\\s*${re.source}`))?.[1];
  const manHours = pick(/(?:man[- ]?hours?|mh)\b/);
  if (manHours) return { manHours };
  const workers = pick(/(?:workers?|guys|people|hands)\b/);
  if (workers) return { workers };
  const hours = pick(/(?:hours?|hrs?|h)\b/);
  if (hours) return { hours };
  const qty = pick(/(?:cy|lb|lbs|lf|ea|days?|sf|tons?)\b/);
  if (qty) return { qty };
  return null;
}

/** Shown when no action matches, and as suggestions in the empty state. */
export const examples = [
  "How is the portfolio doing?",
  "Why is Cedar Creek over budget?",
  "Show tomorrow's plan for Cedar Creek",
  "Change the pour to 80 man-hours",
  "Submit tomorrow's plan",
];
