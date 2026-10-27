// Maps a typed or spoken request to one typed action. Deterministic, so tests and demos are repeatable.
// A language model can replace this later; it would emit the same { action, args } shape.

import type { CoCommandName, CoLineInput } from "@/lib/change-order";
import type { LineInput } from "@/lib/plan-line";

export type ActionName =
  | "portfolio.summary"
  | "job.costVariance"
  | "dailyPlan.show"
  | "dailyPlan.create"
  | "dailyPlan.addLine"
  | "dailyPlan.removeLine"
  | "dailyPlan.submit"
  | "dailyPlan.updateLine"
  | "dailyPlan.approve"
  | "dailyPlan.return"
  | "dailyReport.post"
  | "progressClaim.lock"
  | "estimate.importCsv"
  | "estimate.approve"
  | "costItem.setPmPercent"
  | "costItem.setMilestone"
  | "costItem.setForecastMethod"
  | `changeOrder.${CoCommandName}`
  | "changeOrder.show";

/** Per-line actuals for dailyReport.post (screen form or assistant). */
export type ReportActualArg = {
  /** Plan line id when known (screen). */
  lineId?: string;
  /** Cost code when spoken (assistant). */
  costCode?: string;
  manHours?: number;
  qty?: number;
};

export type JobArgs = {
  job?: string;
  /** dailyPlan.updateLine / removeLine: the line by id (screens) or by words (assistant). */
  lineId?: string;
  lineRef?: string;
  change?: LineInput;
  /** costItem.setPmPercent / setMilestone / dailyPlan.addLine */
  costItemId?: string;
  costCode?: string;
  percent?: string;
  /** costItem.setPmPercent / dailyPlan.return: required who/why text. */
  reason?: string;
  milestoneId?: string;
  complete?: boolean;
  /** costItem.setForecastMethod: current_budget | average_performance (never guessed). */
  forecastMethod?: string;
  /** dailyReport.post: optional per-line actuals (defaults = last report, else plan). */
  actuals?: ReportActualArg[];
  /** changeOrder.*: "CO-001" or the change order's id (screen). */
  changeOrder?: string;
  title?: string;
  /** changeOrder.approve: the revision the screen rendered. */
  revision?: string;
  coLines?: CoLineInput[];
  /** estimate.importCsv: the file text. Only the job page's file picker sets it; chat never does. */
  csv?: string;
  /** dailyPlan.create / addLine / approve / return / removeLine: date or today/tomorrow. */
  date?: string;
  /** dailyPlan.create / addLine / approve / return / removeLine: crew id or name. */
  crew?: string;
  crewId?: string;
  /** dailyPlan.addLine / removeLine / approve / return / submit: plan id from the screen. */
  planId?: string;
  /** dailyPlan.addLine fields (screen + assistant). */
  activity?: string;
  /** 5.1.0-d: schedule activity id or code on the plan line. */
  activityId?: string;
  activityCode?: string;
  location?: string;
  qty?: string;
  workers?: string;
  hours?: string;
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

/** Every NN-NNN token in the prompt (job numbers and cost codes share the shape). */
export function codesIn(prompt: string): string[] {
  return [...prompt.matchAll(/\b(\d{2}-\d{3})\b/g)].map((m) => m[1]);
}

/**
 * Resolve job vs cost-code when both look like NN-NNN.
 * Prefer a known job name/number; remaining codes are cost codes.
 */
export function resolveJobAndCostCode(
  prompt: string,
  jobs: JobRef[],
): { job?: string; costCode?: string } {
  const known = findJob(prompt, jobs)?.number;
  const codes = codesIn(prompt);
  const jobFromCode = codes.find((c) => jobs.some((j) => j.number === c));
  const job = known ?? jobFromCode;
  const costCode = codes.find((c) => c !== job);
  return { ...(job ? { job } : {}), ...(costCode ? { costCode } : {}) };
}

export function route(prompt: string, jobs: JobRef[]): Intent | null {
  const text = prompt.toLowerCase();
  // A job number that isn't in this sandbox still goes to the action, which refuses it.
  const job =
    findJob(prompt, jobs)?.number ??
    codesIn(prompt).find((c) => jobs.some((j) => j.number === c)) ??
    // Unknown NN-NNN only when it is the sole candidate and not clearly a cost-code context.
    undefined;
  const unknownJobCode = codesIn(prompt).find(
    (c) => !jobs.some((j) => j.number === c),
  );
  // For generic job-scoped actions, keep prior "first code" behavior via known job or first code.
  const jobArg =
    job ??
    (unknownJobCode &&
    !hasCostCodeContext(text) &&
    codesIn(prompt).length === 1
      ? unknownJobCode
      : undefined);
  const args: JobArgs = jobArg ? { job: jobArg } : {};
  const has = (re: RegExp) => re.test(text);

  // Before plan-line, estimate, and daily-report rules. "Approve the change order"
  // must not land on estimate.approve or dailyPlan.approve.
  const changeOrder = routeChangeOrder(prompt, args);
  if (changeOrder) return changeOrder;

  const createPlan = routeCreatePlan(prompt, jobs);
  if (createPlan) return createPlan;

  const addLine = routeAddPlanLine(prompt, jobs);
  if (addLine) return addLine;

  const removeLine = routeRemovePlanLine(prompt, jobs);
  if (removeLine) return removeLine;

  const change = parseChange(prompt);
  if (change) {
    // Cost codes look like job numbers, so an edit takes its job only from a known job name.
    const known = findJob(prompt, jobs)?.number;
    return {
      action: "dailyPlan.updateLine",
      args: { ...(known ? { job: known } : {}), lineRef: prompt, change },
    };
  }
  if (has(/\bimport(s|ed|ing)?\b/) && has(/\b(estimate|csv)\b/))
    return { action: "estimate.importCsv", args };
  if (
    has(/\b(lock|claim)\b/) &&
    has(/\b(progress|claim|earned|period)\b/)
  )
    return { action: "progressClaim.lock", args };
  // "Approve the estimate on Harbor" / "approve estimate for 26-010"
  if (
    has(/\bapprov/) &&
    has(/\b(estimate|budget|original)\b/)
  )
    return { action: "estimate.approve", args };
  // "Report today's work" / "we poured 38 CY with 72 hours on 04-210"
  const reportActuals = parseReportActuals(prompt);
  // Approve / return before generic "report" / "post" so "approve the report" wins.
  if (
    has(/\b(approve|approves|approved)\b/) &&
    has(/\b(plan|report|daily|work|timesheet)\b/)
  ) {
    const known =
      findJob(prompt, jobs)?.number ??
      codesIn(prompt).find((c) => jobs.some((j) => j.number === c));
    const date = parsePlanDate(prompt);
    const crew = parseCrewName(prompt);
    return {
      action: "dailyPlan.approve",
      args: {
        ...(known ? { job: known } : {}),
        ...(date ? { date } : {}),
        ...(crew ? { crew } : {}),
      },
    };
  }
  if (
    has(/\b(return|reject|send back|kick back)\b/) &&
    has(/\b(plan|report|daily|work|timesheet)\b/)
  ) {
    const known =
      findJob(prompt, jobs)?.number ??
      codesIn(prompt).find((c) => jobs.some((j) => j.number === c));
    const reason =
      prompt.match(/\b(?:because|reason|:)\s*(.+)$/i)?.[1]?.trim() ?? "";
    const date = parsePlanDate(prompt);
    const crew = parseCrewName(prompt);
    return {
      action: "dailyPlan.return",
      args: {
        ...(known ? { job: known } : {}),
        ...(date ? { date } : {}),
        ...(crew ? { crew } : {}),
        reason,
      },
    };
  }
  if (
    (has(/\b(report|posted|post)\b/) &&
      has(/\b(day|daily|work|hours|quantity|qty)\b/)) ||
    reportActuals.length > 0
  ) {
    // Only a known job name/number — never a cost code mistaken for a job.
    const known =
      findJob(prompt, jobs)?.number ??
      codesIn(prompt).find((c) => jobs.some((j) => j.number === c));
    return {
      action: "dailyReport.post",
      args: {
        ...(known ? { job: known } : {}),
        ...(reportActuals.length ? { actuals: reportActuals } : {}),
        lineRef: prompt,
      },
    };
  }
  if (has(/\b(submit|send|file|issue)\b/) && has(/\b(plan|it|tomorrow)\b/)) {
    const date = has(/\btomorrow\b/)
      ? "tomorrow"
      : has(/\btoday\b/)
        ? "today"
        : undefined;
    return {
      action: "dailyPlan.submit",
      args: { ...args, ...(date ? { date } : {}) },
    };
  }
  // Forecast method before PM% — "set … to average performance" must not look like a %.
  const forecastMethod = parseForecastMethodCue(prompt);
  if (forecastMethod) {
    const resolved = resolveJobAndCostCode(prompt, jobs);
    return {
      action: "costItem.setForecastMethod",
      args: {
        ...resolved,
        lineRef: prompt,
        forecastMethod,
      },
    };
  }
  // "set 08-100 to 50% …" / "set traffic control to 55% on 25-031 because …"
  const pmPct = text.match(
    /\b(?:set|log|record)\b.{0,80}\b(\d{1,3}(?:\.\d)?)\s*%/,
  );
  // "%" is non-word, so don't wrap it in \b — "50%" must still count as a percent cue.
  if (pmPct && /(?:\bpercent\b|%|\bcomplete\b|\bprogress\b)/.test(text)) {
    const reason =
      prompt.match(/\b(?:because|reason|:)\s*(.+)$/i)?.[1]?.trim() ?? "";
    const resolved = resolveJobAndCostCode(prompt, jobs);
    return {
      action: "costItem.setPmPercent",
      args: {
        ...resolved,
        lineRef: prompt,
        percent: pmPct[1],
        reason,
      },
    };
  }
  if (
    has(/\b(milestone|mobilization)\b/) &&
    has(/\b(complete|done|finish|open|incomplete|reopen)\b/)
  ) {
    const resolved = resolveJobAndCostCode(prompt, jobs);
    return {
      action: "costItem.setMilestone",
      args: {
        ...resolved,
        lineRef: prompt,
        complete: !has(/\b(open|incomplete|uncheck|clear|reopen)\b/),
        reason:
          prompt.match(/\b(?:because|reason|:)\s*(.+)$/i)?.[1]?.trim() ?? "",
      },
    };
  }
  if (has(/\b(plan|tomorrow|crew|schedule)\b/))
    return { action: "dailyPlan.show", args };
  if (jobArg && has(/\b(cost|variance|over|overrun|budget|why|losing|money)\b/))
    return { action: "job.costVariance", args };
  if (has(/\b(portfolio|summary|summarize|risk|jobs|status|how)\b/))
    return { action: "portfolio.summary", args: {} };
  if (jobArg) return { action: "job.costVariance", args };
  return null;
}

const CO_CUE = /\b(?:change orders?|pco|co[-\s]?\d+)\b/i;

/** "CO-001", "co 3", "PCO-12". The domain parses it; this only lifts the token. */
function changeOrderToken(prompt: string): string | undefined {
  return prompt.match(/\b(?:pco|co)[-\s]*\d+\b/i)?.[0];
}

function because(prompt: string): string {
  return prompt.match(/\b(?:because|reason)\s+(.+)$/i)?.[1]?.trim() ?? "";
}

function coTitle(prompt: string): string {
  const i = prompt.indexOf(":");
  if (i < 0) return "";
  return prompt
    .slice(i + 1)
    .replace(/\s+\b(?:because|reason)\b[\s\S]*$/i, "")
    .trim();
}

/**
 * Change-order prompts. Cue is the words "change order", "PCO", or "CO-12",
 * so "approve the estimate" and "change the pour" stay on their own actions.
 */
export function routeChangeOrder(prompt: string, args: JobArgs): Intent | null {
  if (!CO_CUE.test(prompt)) return null;
  const text = prompt.toLowerCase();
  const token = changeOrderToken(prompt);
  const reason = because(prompt);
  const base: JobArgs = { ...args, ...(token ? { changeOrder: token } : {}) };
  if (/\bapprov/.test(text))
    return { action: "changeOrder.approve", args: base };
  if (/\b(reject|decline)\b/.test(text))
    return { action: "changeOrder.reject", args: { ...base, reason } };
  if (/\b(void|withdraw|cancel)\b/.test(text))
    return { action: "changeOrder.void", args: { ...base, reason } };
  if (/\bpric/.test(text)) {
    const coLines = parseCoLineSpecs(prompt);
    return {
      action: "changeOrder.price",
      args: { ...base, ...(coLines.length ? { coLines } : {}) },
    };
  }
  if (/\b(raise|new|open|create)\b/.test(text)) {
    const title = coTitle(prompt);
    return {
      action: "changeOrder.create",
      args: {
        ...base,
        ...(title ? { title } : {}),
        ...(reason ? { reason } : {}),
      },
    };
  }
  return { action: "changeOrder.show", args: base };
}

/**
 * The text after the first colon, split on ";".
 * "new 91-100 Retaining wall LS labor 18,500 material 23,250; 04-210 material -2,000 qty 10"
 * Amounts stay dollar strings. The domain parses cents and resolves the cost item.
 */
export function parseCoLineSpecs(prompt: string): CoLineInput[] {
  const colon = prompt.indexOf(":");
  if (colon < 0) return [];
  const lines: CoLineInput[] = [];
  for (const segment of prompt.slice(colon + 1).split(";")) {
    const seg = segment.trim();
    const head = seg.match(/^(new\s+)?(\d{2}-\d{3})\b\s*(.*)$/i);
    if (!head) continue;
    const line: CoLineInput = { code: head[2] };
    let rest = head[3] ?? "";
    rest = rest.replace(
      /\b(labor|material|equipment|sub|qty)\s+(-?[\d,]+(?:\.\d+)?)/gi,
      (_, cat: string, num: string) => {
        line[cat.toLowerCase() as "labor" | "material" | "equipment" | "sub" | "qty"] =
          num;
        return " ";
      },
    );
    if (head[1]) {
      const words = rest.trim().split(/\s+/).filter(Boolean);
      const unit = words.at(-1) ?? "";
      if (/^[A-Za-z]{1,6}$/.test(unit)) {
        line.unit = unit;
        const description = words.slice(0, -1).join(" ").replace(/,\s*$/, "");
        if (description) line.description = description;
      } else if (words.length) {
        line.description = words.join(" ");
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Phrases that mean an NN-NNN token is a cost code, not a job. */
function hasCostCodeContext(text: string) {
  return /\b(set|log|record|code|line|cost code)\b/.test(text) &&
    /\b(\d{1,3}(?:\.\d)?\s*%|percent|complete|progress)\b/.test(text);
}

/** Optional leading minus so "-5 hours" stays negative (and is rejected), not "5". */
const n = String.raw`(-?\d[\d,]*(?:\.\d+)?)`;
const reportVerb =
  /\b(pour|poured|report|reported|work|worked|post|posted|tied|tie|placed|installed|laid)\b/;
const qtyUnit = String.raw`(?:cy|lb|lbs|lf|ea|days?|sf|sy|tons?|mo)`;
const mhUnit = String.raw`(?:man[- ]?hours?|mh|hours?|hrs?)`;

/**
 * "we poured 38 CY with 72 hours on 04-210" → one actuals entry.
 * Also "report 70 MH and 40 CY on 04-210", or "… on the pour" (no code — action matches line).
 * Keeps a leading minus; NaN/Infinity become non-finite so the action can refuse them.
 */
export function parseReportActuals(prompt: string): ReportActualArg[] {
  const text = prompt.toLowerCase();
  if (!reportVerb.test(text)) return [];
  const code = prompt.match(/\b(\d{2}-\d{3})\b/)?.[1];
  const entry: ReportActualArg = {};
  if (code) entry.costCode = code;

  // "NaN hours" / "Infinity CY" — route to dailyReport.post with a clear error.
  if (/\bnan\b/.test(text) || /\binfinity\b/.test(text)) {
    if (new RegExp(`\\b(?:nan|infinity)\\s*${mhUnit}\\b`).test(text))
      entry.manHours = Number.NaN;
    if (new RegExp(`\\b(?:nan|infinity)\\s*${qtyUnit}\\b`).test(text))
      entry.qty = Number.NaN;
    if (entry.manHours !== undefined || entry.qty !== undefined) return [entry];
  }

  const qtyMatch = text.match(new RegExp(`${n}\\s*${qtyUnit}\\b`));
  const mhMatch =
    text.match(new RegExp(`${n}\\s*(?:man[- ]?hours?|mh)\\b`)) ??
    text.match(new RegExp(`${n}\\s*(?:hours?|hrs?)\\b`));
  if (!qtyMatch && !mhMatch) return [];
  if (qtyMatch) entry.qty = Number(qtyMatch[1].replace(/,/g, ""));
  if (mhMatch) entry.manHours = Number(mhMatch[1].replace(/,/g, ""));
  return [entry];
}

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

/** today / tomorrow / YYYY-MM-DD from the prompt (undefined when none named). */
export function parsePlanDate(prompt: string): string | undefined {
  const text = prompt.toLowerCase();
  if (/\btoday\b/.test(text)) return "today";
  if (/\btomorrow\b/.test(text)) return "tomorrow";
  return prompt.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1];
}

/** Known crew names when spoken ("Bridge Crew 2", "Culvert Crew A"). */
export function parseCrewName(prompt: string): string | undefined {
  return (
    prompt
      .match(
        /\b(bridge crew\s*\d+|culvert crew\s*\w+|interchange crew\s*\d+)\b/i,
      )?.[1]
      ?.trim() || undefined
  );
}

/**
 * "Plan today on 25-031 for Bridge Crew 2" → dailyPlan.create.
 * Unknown job + plan today/tomorrow → create (Part E refusal), even without crew —
 * otherwise fallthrough to show chips "Couldn't show crew plan on 99-999".
 * Must run before the generic dailyPlan.show cue.
 */
export function routeCreatePlan(
  prompt: string,
  jobs: JobRef[],
): Intent | null {
  const text = prompt.toLowerCase();
  if (!/\bplan\b/.test(text)) return null;
  if (!/\b(today|tomorrow|\d{4}-\d{2}-\d{2})\b/.test(text)) return null;
  // "Show tomorrow's plan" / "what's the plan for" stay on show.
  if (/\b(show|see|what's|whats|open|view)\b/.test(text)) return null;
  if (/\b(submit|send|issue|file|add|remove|report|approve|return)\b/.test(text))
    return null;

  const known =
    findJob(prompt, jobs)?.number ??
    codesIn(prompt).find((c) => jobs.some((j) => j.number === c));
  const unknown = codesIn(prompt).find(
    (c) => !jobs.some((j) => j.number === c),
  );

  const date = parsePlanDate(prompt) ?? "today";
  const forCrew =
    parseCrewName(prompt) ??
    prompt.match(/\bfor\s+(.+?)\s*$/i)?.[1]?.trim();

  // Unknown NN-NNN: always create so unknownJob() refuses with create chip.
  // Crew optional — "Plan today on 99-999" must not fall through to show.
  if (unknown && !known) {
    return {
      action: "dailyPlan.create",
      args: {
        job: unknown,
        date,
        ...(forCrew ? { crew: forCrew } : {}),
      },
    };
  }

  // Known job still needs for/crew ("Plan tomorrow on 24-077" → show).
  if (!/\bfor\b/.test(text) && !/\bcrew\b/.test(text)) return null;
  if (!known) return null;
  if (!forCrew) return null;

  return {
    action: "dailyPlan.create",
    args: { job: known, date, crew: forCrew },
  };
}

/**
 * "Add 04-210 to today's plan on 25-031: 12 CY, 3 workers, 8 hours"
 */
export function routeAddPlanLine(
  prompt: string,
  jobs: JobRef[],
): Intent | null {
  const text = prompt.toLowerCase();
  if (!/\badd\b/.test(text)) return null;
  if (!/\bplan\b/.test(text)) return null;
  const resolved = resolveJobAndCostCode(prompt, jobs);
  if (!resolved.job || !resolved.costCode) return null;

  const qty = text.match(
    new RegExp(`${n}\\s*(?:cy|lb|lbs|lf|ea|days?|sf|sy|tons?|mo)\\b`),
  )?.[1];
  const workers = text.match(new RegExp(`${n}\\s*workers?\\b`))?.[1];
  const hours =
    text.match(new RegExp(`${n}\\s*(?:hours?|hrs?|h)\\b`))?.[1] ??
    text.match(new RegExp(`${n}\\s*h\\b`))?.[1];

  const date = parsePlanDate(prompt) ?? "today";
  const crew = parseCrewName(prompt);

  const activity =
    prompt.match(/\bactivity\s*[:\s]\s*([^,]+)/i)?.[1]?.trim() ??
    prompt.match(/\blocation\s+[^,]+,\s*activity\s+([^,]+)/i)?.[1]?.trim();
  const location = prompt.match(/\blocation\s*[:\s]\s*([^,]+)/i)?.[1]?.trim();

  return {
    action: "dailyPlan.addLine",
    args: {
      job: resolved.job,
      costCode: resolved.costCode,
      date,
      ...(crew ? { crew } : {}),
      ...(qty ? { qty: qty.replace(/,/g, "") } : {}),
      ...(workers ? { workers: workers.replace(/,/g, "") } : {}),
      ...(hours ? { hours: hours.replace(/,/g, "") } : {}),
      ...(activity ? { activity } : {}),
      ...(location ? { location } : {}),
    },
  };
}

/**
 * "Remove 04-210 from today's Bridge Crew 2 plan on 25-031"
 */
export function routeRemovePlanLine(
  prompt: string,
  jobs: JobRef[],
): Intent | null {
  const text = prompt.toLowerCase();
  if (!/\bremove\b/.test(text)) return null;
  if (!/\b(plan|line)\b/.test(text)) return null;
  const resolved = resolveJobAndCostCode(prompt, jobs);
  if (!resolved.job || !resolved.costCode) return null;

  const date = parsePlanDate(prompt) ?? "today";
  const crew = parseCrewName(prompt);

  return {
    action: "dailyPlan.removeLine",
    args: {
      job: resolved.job,
      costCode: resolved.costCode,
      date,
      ...(crew ? { crew } : {}),
    },
  };
}

/**
 * Explicit forecast-method cue only — never guess a method.
 * "Set 04-210 on 25-031 to average performance" → average_performance.
 * "set forecast method" with no named method → null (action will refuse).
 */
export function parseForecastMethodCue(prompt: string): string | null {
  const text = prompt.toLowerCase();
  const namesAverage =
    /\baverage\s+performance\b/.test(text) ||
    /\baverage_performance\b/.test(text);
  const namesCurrent =
    /\bcurrent\s+budget\b/.test(text) || /\bcurrent_budget\b/.test(text);
  if (namesAverage && namesCurrent) return null;
  if (namesAverage) return "average_performance";
  if (namesCurrent) {
    // Require a set/switch/forecast cue so "current budget" alone is not a write.
    if (
      /\b(set|switch|change|use)\b/.test(text) ||
      /\bforecast\b/.test(text)
    ) {
      return "current_budget";
    }
  }
  return null;
}

/** Shown when no action matches, and as suggestions in the empty state. */
export const examples = [
  "How is the portfolio doing?",
  "Why is Cedar Creek over budget?",
  "Show tomorrow's plan for Cedar Creek",
  "Plan today on 25-031 for Bridge Crew 2",
  "Add 04-210 to today's plan on 25-031: 12 CY, 3 workers, 8 hours",
  "Change the pour to 80 man-hours",
  "Submit tomorrow's plan",
  "Report today's work on Cedar Creek",
  "Approve the daily report for Cedar Creek",
  "Return the report for Cedar Creek because Recount pour 3",
  "Lock the progress claim on 25-031",
  "Import the estimate CSV for Harbor Abutment",
  "Approve the estimate on Harbor Abutment",
  "Raise a change order on Cedar Creek: Added guardrail at the east approach",
  "Approve change order CO-001 on Cedar Creek",
];
