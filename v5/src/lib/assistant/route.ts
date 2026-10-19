// Maps a typed or spoken request to one typed action. Deterministic, so tests and demos are repeatable.
// A language model can replace this later; it would emit the same { action, args } shape.

export type ActionName =
  | "portfolio.summary"
  | "job.costVariance"
  | "dailyPlan.show"
  | "dailyPlan.submit";

export type JobArgs = { job?: string };
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

/** Shown when no action matches, and as suggestions in the empty state. */
export const examples = [
  "How is the portfolio doing?",
  "Why is Cedar Creek over budget?",
  "Show tomorrow's plan for Cedar Creek",
  "Submit tomorrow's plan",
];
