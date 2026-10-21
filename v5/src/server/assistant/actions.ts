import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { requireDb } from "@/db";
import {
  actionRuns,
  costItemMilestones,
  costItems,
  dailyPlanLines,
  dailyPlans,
  jobs,
  users,
} from "@/db/schema";
import type {
  ActionName,
  JobArgs,
  ReportActualArg,
} from "@/lib/assistant/route";
import { qty, usdShort } from "@/lib/ev";
import {
  applyLineInput,
  manHoursOf,
  REPORT_LIMITS,
  type LineValues,
} from "@/lib/plan-line";
import {
  getJob,
  getPlansForJob,
  getPortfolio,
  type JobDetail,
} from "@/server/data";
import { approveEstimate } from "@/server/estimate";
import {
  getReportedActualsForPlan,
  lockProgressClaim,
  postDailyReport,
  setMilestoneComplete,
  setPmPercent,
} from "@/server/progress";
import type { CurrentUser, Role } from "@/server/session";

// The typed actions. The assistant and on-screen buttons both call run(), so every change goes
// through one path, is checked against the role, and is written to action_runs.

/** job is the job number the action acted on, whether the request named it or the action picked it. */
export type ActionResult = {
  summary: string;
  href?: string;
  job?: string;
  /** dailyPlan.updateLine: the cost code of the line it changed, and field errors for forms. */
  line?: string;
  errors?: Record<string, string>;
};

type ActionDef = {
  title: string;
  /** Roles allowed to run it. Read-only actions are open to everyone. */
  roles?: Role[];
  run(user: CurrentUser, args: JobArgs): Promise<ActionResult>;
};

const day = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

/** Calendar day in job local time (America/Los_Angeles) — not UTC. */
const localDay = (at: Date) =>
  at.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  });

async function resolveJob(user: CurrentUser, number?: string) {
  if (!number) return undefined;
  // getJob hydrates this job's WBS — never getPortfolio (empty lines after hierarchy).
  return (await getJob(user.companyId, number)) ?? undefined;
}

async function jobById(user: CurrentUser, jobId: string) {
  const db = requireDb();
  const [row] = await db
    .select({ number: jobs.number })
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.companyId, user.companyId)))
    .limit(1);
  return row ? getJob(user.companyId, row.number) : null;
}

/** A named job that isn't in this sandbox is refused, never swapped for another job. */
async function unknownJob(
  user: CurrentUser,
  number: string,
): Promise<ActionResult> {
  const { jobs: all } = await getPortfolio(user.companyId);
  return {
    summary: `There is no job ${number} in this sandbox. Jobs here: ${all.map((j) => j.job.number).join(", ")}.`,
  };
}

/** The plan a request means: the named job's next plan, or else the next draft this person can act on. */
async function resolvePlan(user: CurrentUser, number?: string) {
  const db = requireDb();
  const target = await resolveJob(user, number);
  if (number && !target) return null;
  const [row] = await db
    .select({ id: dailyPlans.id, jobId: dailyPlans.jobId })
    .from(dailyPlans)
    .innerJoin(jobs, eq(jobs.id, dailyPlans.jobId))
    .where(
      and(
        eq(dailyPlans.companyId, user.companyId),
        target ? eq(dailyPlans.jobId, target.job.id) : undefined,
      ),
    )
    .orderBy(
      // Prefer drafts, then this foreman's own crew, then the earliest date.
      sql`${dailyPlans.status} = 'draft' desc`,
      sql`${dailyPlans.foremanId} = ${user.userId} desc`,
      asc(dailyPlans.planDate),
    )
    .limit(1);
  if (!row) return null;
  const job = target ?? (await jobById(user, row.jobId));
  if (!job) return null;
  const plan = (await getPlansForJob(user.companyId, job.job.id)).find(
    (p) => p.id === row.id,
  )!;
  return { job, plan };
}

const jobHref = (j: JobDetail) => `/app/jobs/${j.job.number}`;

type Plan = NonNullable<Awaited<ReturnType<typeof resolvePlan>>>["plan"];
type Line = Plan["lines"][number];

const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "lift",
  "pier",
  "check",
  "watch",
]);
const words = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));

/**
 * Which line a sentence means: a cost code in it, else the line whose activity or cost item
 * shares the most words with it ("the pour" → 04-210 Pour Pier 3 column). Ties and misses ask.
 */
export function matchLine(
  lines: Line[],
  ref: string,
): { line: Line } | { ask: string } {
  const byCode = lines.filter((l) => ref.includes(l.code));
  if (byCode.length === 1) return { line: byCode[0] };
  const said = new Set(words(ref));
  const scored = lines
    .map((l) => ({
      l,
      score: [...new Set(words(`${l.activity} ${l.description}`))].filter((w) =>
        said.has(w),
      ).length,
    }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (
    best &&
    best.score > 0 &&
    scored.filter((s) => s.score === best.score).length === 1
  )
    return { line: best.l };
  const options = (
    best?.score ? scored.filter((s) => s.score === best.score) : scored
  ).map((s) => `${s.l.code} ${s.l.activity}`);
  return { ask: `Which line do you mean? ${options.join("; ")}.` };
}

async function findLineById(user: CurrentUser, lineId: string) {
  const [row] = await requireDb()
    .select({ planId: dailyPlanLines.planId, jobId: dailyPlans.jobId })
    .from(dailyPlanLines)
    .innerJoin(dailyPlans, eq(dailyPlans.id, dailyPlanLines.planId))
    .where(
      and(
        eq(dailyPlanLines.id, lineId),
        eq(dailyPlanLines.companyId, user.companyId),
      ),
    )
    .limit(1);
  if (!row) return null;
  const job = await jobById(user, row.jobId);
  if (!job) return null;
  const plan = (await getPlansForJob(user.companyId, job.job.id)).find(
    (p) => p.id === row.planId,
  )!;
  return { job, plan, line: plan.lines.find((l) => l.id === lineId)! };
}

function describeChange(
  before: Line,
  after: LineValues,
  unit: string,
  code: string,
) {
  const out: string[] = [];
  if (after.costItemId !== before.costItemId)
    out.push(`cost code ${before.code} → ${code}`);
  const mhBefore = manHoursOf(before);
  const mhAfter = manHoursOf(after);
  if (
    mhAfter !== mhBefore ||
    after.workers !== before.workers ||
    after.hoursTenths !== before.hoursTenths
  )
    out.push(
      `man-hours ${mhBefore} → ${mhAfter} (${after.workers} workers × ${after.hoursTenths / 10} h)`,
    );
  if (after.qtyMilli !== before.qtyMilli)
    out.push(
      `quantity ${qty(before.qtyMilli)} → ${qty(after.qtyMilli)} ${unit}`,
    );
  if (after.activity !== before.activity)
    out.push(`activity "${after.activity}"`);
  if (after.location !== before.location)
    out.push(`location "${after.location}"`);
  if (after.notes !== before.notes)
    out.push(after.notes ? `note "${after.notes}"` : "note cleared");
  return out;
}

export const actions: Record<ActionName, ActionDef> = {
  "portfolio.summary": {
    title: "Portfolio summary",
    async run(user) {
      const { jobs: all, totals } = await getPortfolio(user.companyId);
      const risky = all.filter((j) => j.status !== "on-track");
      const flags = risky.map((j) =>
        j.cpi < j.spi
          ? `${j.job.shortName} (CPI ${j.cpi.toFixed(2)})`
          : `${j.job.shortName} (SPI ${j.spi.toFixed(2)})`,
      );
      return {
        summary:
          `${all.length} jobs. Portfolio CPI ${totals.cpi.toFixed(2)}, SPI ${totals.spi.toFixed(2)}. ` +
          (flags.length
            ? `Needs attention: ${flags.join(", ")}.`
            : "Every job is on track."),
        href: "/app",
      };
    },
  },
  "job.costVariance": {
    title: "Cost variance by cost code",
    async run(user, { job }) {
      const j = await resolveJob(user, job);
      if (!j)
        return {
          summary: "Which job? Name it or give its number, like 25-031.",
        };
      const worst = [...j.lines]
        .filter((l) => l.varianceCents < 0)
        .sort((a, b) => a.varianceCents - b.varianceCents)
        .slice(0, 3);
      const net = j.costVarianceCents;
      return {
        summary:
          `${j.job.shortName} is ${usdShort(Math.abs(net))} ${net < 0 ? "over" : "under"} on earned vs actual cost (CPI ${j.cpi.toFixed(2)}). ` +
          (worst.length
            ? `Largest overruns: ${worst.map((l) => `${l.code} ${l.description} ${usdShort(l.varianceCents)}`).join("; ")}.`
            : "No cost code is over."),
        href: jobHref(j),
        job: j.job.number,
      };
    },
  },
  "dailyPlan.show": {
    title: "Show a crew plan",
    async run(user, { job }) {
      const found = await resolvePlan(user, job);
      if (!found) return { summary: "There is no crew plan for that job yet." };
      const { plan, job: j } = found;
      const mh = plan.lines.reduce((s, l) => s + l.manHours, 0);
      const over = plan.lines.filter((l) => !l.withinRate);
      return {
        summary:
          `${plan.crew} on ${j.job.shortName}, ${day(plan.planDate)}, is ${plan.status === "draft" ? "a draft" : "submitted"}. ` +
          `${plan.lines.length} activities, ${mh} man-hours: ${plan.lines.map((l) => l.activity).join(", ")}. ` +
          (over.length
            ? `Over budgeted rate: ${over.map((l) => l.code).join(", ")}.`
            : "Every line is within its budgeted unit rate."),
        href: jobHref(j),
        job: j.job.number,
      };
    },
  },
  "dailyPlan.updateLine": {
    title: "Change a plan line",
    roles: ["foreman", "superintendent"],
    async run(user, { job, lineId, lineRef, change }) {
      if (!change)
        return {
          summary:
            "What should change? Say a number with its unit, like 80 man-hours.",
        };
      let found: { job: JobDetail; plan: Plan; line: Line } | null = null;
      if (lineId) {
        found = await findLineById(user, lineId);
        if (!found)
          return {
            summary: "That plan line isn't in this sandbox.",
            errors: { form: "That plan line isn't in this sandbox." },
          };
      } else {
        const p = await resolvePlan(user, job);
        if (!p) return { summary: "There is no crew plan to change." };
        const m = matchLine(p.plan.lines, lineRef ?? "");
        if ("ask" in m)
          return {
            summary: m.ask,
            href: jobHref(p.job),
            job: p.job.job.number,
          };
        found = { ...p, line: m.line };
      }
      const { job: j, plan, line } = found;
      const where = { href: jobHref(j), job: j.job.number, line: line.code };
      if (plan.status !== "draft") {
        const msg = `${plan.crew}'s plan for ${day(plan.planDate)} is submitted, so its lines are locked. Use Report day's work (or ask me to report actual hours and quantities) — the plan stays as planned.`;
        return { summary: msg, errors: { form: msg }, ...where };
      }
      const result = applyLineInput(
        {
          costItemId: line.costItemId,
          activity: line.activity,
          location: line.location,
          qtyMilli: line.qtyMilli,
          workers: line.workers,
          hoursTenths: line.hoursTenths,
          notes: line.notes,
        },
        change,
        j.lines.map((l) => l.id),
      );
      if (result.errors)
        return {
          summary: `Not changed. ${Object.values(result.errors).join(" ")}`,
          errors: result.errors,
          ...where,
        };
      const v = result.values;
      const item = j.lines.find((l) => l.id === v.costItemId)!;
      const changes = describeChange(line, v, item.unit, item.code);
      if (!changes.length)
        return {
          summary: `${line.code} ${line.activity} already has those values.`,
          ...where,
        };
      await requireDb()
        .update(dailyPlanLines)
        .set(v)
        .where(
          and(
            eq(dailyPlanLines.id, line.id),
            eq(dailyPlanLines.companyId, user.companyId),
          ),
        );
      return {
        summary: `Changed ${item.code} ${v.activity} on ${plan.crew}'s plan: ${changes.join("; ")}.`,
        ...where,
        line: item.code,
      };
    },
  },
  "dailyPlan.submit": {
    title: "Submit a crew plan",
    roles: ["foreman", "superintendent"],
    async run(user, { job }) {
      const found = await resolvePlan(user, job);
      if (!found) return { summary: "There is no crew plan to submit." };
      const { plan, job: j } = found;
      if (plan.status !== "draft")
        return {
          summary: `${plan.crew}'s plan for ${day(plan.planDate)} on ${j.job.shortName} was already submitted.`,
          href: jobHref(j),
          job: j.job.number,
        };
      await requireDb()
        .update(dailyPlans)
        .set({ status: "submitted", submittedAt: sql`now()` })
        .where(
          and(
            eq(dailyPlans.id, plan.id),
            eq(dailyPlans.companyId, user.companyId),
          ),
        );
      // Plan ≠ actual: submit only commits the plan. Actuals come from dailyReport.post.
      const mh = plan.lines.reduce((s, l) => s + l.manHours, 0);
      return {
        summary: `Submitted ${plan.crew}'s plan for ${day(plan.planDate)} on ${j.job.shortName}: ${plan.lines.length} activities, ${mh} man-hours. Planned only — report the day's work to post actuals.`,
        href: jobHref(j),
        job: j.job.number,
      };
    },
  },
  "dailyReport.post": {
    title: "Report a day's work",
    roles: ["foreman", "superintendent"],
    async run(user, { job, actuals, lineRef }) {
      const found = await resolvePlan(user, job);
      if (!found) return { summary: "There is no crew plan to report against." };
      const { plan, job: j } = found;
      if (plan.status !== "submitted")
        return {
          summary: `Submit ${plan.crew}'s plan first — I won't report against a draft. Then use Report day's work (or ask me) to post actual hours and quantities; the plan stays as planned.`,
          href: jobHref(j),
          job: j.job.number,
        };
      const last = await getReportedActualsForPlan(user.companyId, plan.id);
      const byLineId: Record<
        string,
        { manHours: number; qtyMilli: number }
      > = {};

      // No per-line numbers ("Report today's work"): every line = last report ?? plan.
      const entries: ReportActualArg[] =
        actuals && actuals.length
          ? actuals
          : plan.lines.map((l) => ({ lineId: l.id }));

      for (const a of entries) {
        let line = a.lineId
          ? plan.lines.find((l) => l.id === a.lineId)
          : a.costCode
            ? plan.lines.find((l) => l.code === a.costCode)
            : undefined;
        if (!line && !a.lineId && !a.costCode) {
          // "we poured 38 CY … on the pour" — resolve by activity words.
          const m = matchLine(plan.lines, lineRef ?? "");
          if ("ask" in m)
            return {
              summary: m.ask,
              href: jobHref(j),
              job: j.job.number,
            };
          line = m.line;
        }
        if (!line) {
          return {
            summary: a.costCode
              ? `No plan line for cost code ${a.costCode} on ${j.job.shortName}.`
              : "Which line should I report? Name the cost code or activity.",
            href: jobHref(j),
            job: j.job.number,
          };
        }
        const prior = last[line.id];
        // Spoken field wins; else last report; else plan. Never wipe an unspoken
        // field back to the plan when a prior report exists.
        const manHours =
          a.manHours !== undefined
            ? Number(a.manHours)
            : (prior?.manHours ?? line.manHours);
        const qtyVal =
          a.qty !== undefined
            ? Number(a.qty)
            : (prior?.qtyMilli ?? line.qtyMilli) / 1000;
        if (
          !Number.isFinite(manHours) ||
          manHours < REPORT_LIMITS.manHours.min ||
          manHours > REPORT_LIMITS.manHours.max
        ) {
          const msg = `Man-hours must be from ${REPORT_LIMITS.manHours.min} to ${REPORT_LIMITS.manHours.max}.`;
          const errors: Record<string, string> = { manHours: msg };
          const got =
            a.manHours !== undefined && !Number.isFinite(Number(a.manHours))
              ? "blank or non-numeric"
              : String(a.manHours);
          return {
            summary: `${msg} (got ${got}).`,
            href: jobHref(j),
            job: j.job.number,
            errors,
          };
        }
        if (
          !Number.isFinite(qtyVal) ||
          qtyVal < REPORT_LIMITS.qty.min ||
          qtyVal > REPORT_LIMITS.qty.max
        ) {
          const msg = `Quantity must be from ${REPORT_LIMITS.qty.min} to ${REPORT_LIMITS.qty.max}.`;
          const errors: Record<string, string> = { qty: msg };
          const got =
            a.qty !== undefined && !Number.isFinite(Number(a.qty))
              ? "blank or non-numeric"
              : String(a.qty);
          return {
            summary: `${msg} (got ${got}).`,
            href: jobHref(j),
            job: j.job.number,
            errors,
          };
        }
        byLineId[line.id] = {
          manHours,
          qtyMilli: Math.round(qtyVal * 1000),
        };
      }
      const now = new Date();
      const result = await postDailyReport(
        user.companyId,
        plan.id,
        byLineId,
        now,
      );
      const reportDay = localDay(now);
      const diffs = Object.entries(byLineId)
        .map(([id, a]) => {
          const line = plan.lines.find((l) => l.id === id)!;
          const parts: string[] = [];
          if (a.manHours !== line.manHours)
            parts.push(`${a.manHours} MH (plan ${line.manHours})`);
          if (a.qtyMilli !== line.qtyMilli)
            parts.push(
              `${qty(a.qtyMilli)} ${line.unit} (plan ${qty(line.qtyMilli)})`,
            );
          return parts.length ? `${line.code}: ${parts.join(", ")}` : null;
        })
        .filter(Boolean);
      return {
        summary:
          `Reported ${plan.crew}'s work on ${j.job.shortName} for ${reportDay}: ` +
          `${result.postedMh} man-hours to actuals` +
          (diffs.length ? ` — ${diffs.join("; ")}` : " (as planned)") +
          `; quantities pending until the PM locks.`,
        href: jobHref(j),
        job: j.job.number,
      };
    },
  },
  "progressClaim.lock": {
    title: "Lock a progress claim",
    roles: ["pm", "executive"],
    async run(user, { job }) {
      if (!job)
        return {
          summary:
            "Which job's progress claim should I lock? Name the job number.",
        };
      const j = await resolveJob(user, job);
      if (!j) return unknownJob(user, job);
      const result = await lockProgressClaim(
        user.companyId,
        j.job.id,
        user.userId,
      );
      if (!result.ok)
        return {
          summary: `There is no open draft progress claim on ${j.job.shortName} to lock.`,
          href: jobHref(j),
          job: j.job.number,
        };
      return {
        summary: `Locked ${result.periodLabel} on ${j.job.shortName}: ${result.lines} cost codes. ${result.nextPeriodLabel} is now open as a draft.`,
        href: jobHref(j),
        job: j.job.number,
      };
    },
  },
  "estimate.approve": {
    title: "Approve estimate",
    roles: ["pm", "executive"],
    async run(user, { job }) {
      if (!job)
        return {
          summary:
            "Which job's estimate should I approve? Name the job number.",
        };
      const j = await resolveJob(user, job);
      if (!j) return unknownJob(user, job);
      const result = await approveEstimate(user.companyId, j.job.number);
      if (!result.ok) {
        return {
          summary: result.summary,
          href: jobHref(j),
          job: j.job.number,
        };
      }
      return {
        summary:
          `Approved the estimate on ${result.shortName}: Original Budget ` +
          `${usdShort(result.originalBudgetCents)} frozen across ${result.leafCount} cost items. ` +
          `Current Budget equals Original.`,
        href: jobHref(j),
        job: j.job.number,
      };
    },
  },
  "costItem.setPmPercent": {
    title: "Log PM percent complete",
    roles: ["pm", "superintendent", "executive"],
    async run(user, { job, costItemId, costCode, lineRef, percent, reason }) {
      const pct = Number(String(percent ?? "").replace(/,/g, ""));
      if (!Number.isFinite(pct) || pct < 0 || pct > 100)
        return {
          summary:
            "What percent should I log? Say a number like 45% and a reason.",
        };
      const why = (reason ?? "").trim();
      if (!why)
        return {
          summary:
            "I need a reason for the PM percent log (who/why). Add “because …”.",
        };
      const item = await resolveCostItem(user, {
        job,
        costItemId,
        costCode,
        lineRef,
        method: "pm_percent",
      });
      if ("summary" in item) return item;
      const result = await setPmPercent(
        user.companyId,
        item.id,
        user.userId,
        Math.round(pct * 10),
        why,
      );
      if (!result.ok)
        return { summary: "Could not log that PM percent on this cost code." };
      return {
        summary: `Logged PM percent on ${result.code} ${result.description}: ${result.percentMilli / 10}% — ${why}.`,
        href: `/app/jobs/${item.jobNumber}`,
        job: item.jobNumber,
        line: result.code,
      };
    },
  },
  "costItem.setMilestone": {
    title: "Set a milestone complete",
    roles: ["pm", "superintendent", "executive"],
    async run(user, { job, milestoneId, costCode, lineRef, complete, reason }) {
      let id = milestoneId;
      if (!id) {
        const found = await resolveMilestone(user, {
          job,
          costCode,
          lineRef,
        });
        if ("summary" in found) return found;
        id = found.id;
      }
      const result = await setMilestoneComplete(
        user.companyId,
        id,
        complete !== false,
        user.userId,
        reason,
      );
      if (!result.ok)
        return { summary: "That milestone isn't on this job." };
      return {
        summary: `${result.complete ? "Completed" : "Reopened"} milestone “${result.name}” on ${result.code}.`,
        line: result.code,
      };
    },
  },
};

async function resolveCostItem(
  user: CurrentUser,
  opts: {
    job?: string;
    costItemId?: string;
    costCode?: string;
    lineRef?: string;
    method?: string;
  },
) {
  const db = requireDb();
  if (opts.costItemId) {
    const [row] = await db
      .select({
        id: costItems.id,
        code: costItems.code,
        jobNumber: jobs.number,
        method: costItems.evMethod,
        description: costItems.description,
      })
      .from(costItems)
      .innerJoin(jobs, eq(jobs.id, costItems.jobId))
      .where(
        and(
          eq(costItems.id, opts.costItemId),
          eq(costItems.companyId, user.companyId),
        ),
      );
    if (!row) return { summary: "That cost item isn't in this sandbox." };
    if (opts.method && row.method !== opts.method)
      return {
        summary: `${row.code} uses the ${row.method} method, not ${opts.method}.`,
      };
    return row;
  }
  // Prefer an explicit costCode; never treat the job number as the cost code.
  const jobNumber = opts.job;
  const code =
    opts.costCode ??
    [...(opts.lineRef ?? "").matchAll(/\b(\d{2}-\d{3})\b/g)]
      .map((m) => m[1])
      .find((c) => c !== jobNumber);
  const j = opts.job ? await resolveJob(user, opts.job) : undefined;
  const rows = await db
    .select({
      id: costItems.id,
      code: costItems.code,
      jobNumber: jobs.number,
      method: costItems.evMethod,
      description: costItems.description,
    })
    .from(costItems)
    .innerJoin(jobs, eq(jobs.id, costItems.jobId))
    .where(
      and(
        eq(costItems.companyId, user.companyId),
        j ? eq(costItems.jobId, j.job.id) : undefined,
        opts.method
          ? eq(costItems.evMethod, opts.method as "pm_percent")
          : undefined,
      ),
    );
  const match = code
    ? rows.filter((r) => r.code === code)
    : rows.filter((r) => {
        const desc = r.description.toLowerCase();
        const ref = (opts.lineRef ?? "").toLowerCase();
        // Prefer a multi-word description match (e.g. "traffic control").
        return (
          ref.includes(desc) ||
          desc
            .split(/\s+/)
            .filter((w) => w.length > 3)
            .every((w) => ref.includes(w))
        );
      });
  // Without a job, a cost-code match across jobs still needs disambiguation.
  if (match.length === 1) return match[0];
  if (match.length > 1)
    return {
      summary: `Which cost code? ${match.map((m) => `${m.code} on ${m.jobNumber}`).join(", ")}.`,
    };
  return {
    summary:
      "Which cost code should I update? Name the code (for example 08-100) and the job.",
  };
}

async function resolveMilestone(
  user: CurrentUser,
  opts: { job?: string; costCode?: string; lineRef?: string },
) {
  const db = requireDb();
  const j = opts.job ? await resolveJob(user, opts.job) : undefined;
  const rows = await db
    .select({
      id: costItemMilestones.id,
      name: costItemMilestones.name,
      code: costItems.code,
      complete: costItemMilestones.complete,
    })
    .from(costItemMilestones)
    .innerJoin(costItems, eq(costItems.id, costItemMilestones.costItemId))
    .where(
      and(
        eq(costItemMilestones.companyId, user.companyId),
        j ? eq(costItems.jobId, j.job.id) : undefined,
        opts.costCode ? eq(costItems.code, opts.costCode) : undefined,
      ),
    );
  const ref = (opts.lineRef ?? "").toLowerCase();
  // Prefer the longest milestone name contained in the prompt so
  // "Mobilization complete" wins over "Mobilization in".
  const named = [...rows]
    .filter((r) => ref.includes(r.name.toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length);
  if (named.length >= 1) {
    // Drop shorter names that are substrings of the best match's name
    // (e.g. keep only "Mobilization complete", not also "Mobilization in"
    // when only the longer phrase appears — already filtered — or when both
    // appear, keep the longest unique name).
    const bestName = named[0].name.toLowerCase();
    const exact = named.filter((r) => r.name.toLowerCase() === bestName);
    if (exact.length === 1) return exact[0];
    if (exact.length > 1)
      return {
        summary: `Which milestone? ${exact.map((m) => `${m.code} ${m.name}`).join("; ")}.`,
      };
  }
  const byCode = opts.costCode
    ? rows.filter((r) => r.code === opts.costCode)
    : [];
  if (byCode.length === 1) return byCode[0];
  if (rows.length === 1) return rows[0];
  if (rows.length > 1)
    return {
      summary: `Which milestone? ${rows.map((m) => `${m.code} ${m.name}`).join("; ")}.`,
    };
  return { summary: "Which milestone should I mark? Name it and the job." };
}

export const isActionName = (s: unknown): s is ActionName =>
  typeof s === "string" && Object.hasOwn(actions, s);

export type RunArgs = {
  requested: string | null;
  job: string | null;
  /** Cost code of the plan line an edit touched. */
  line?: string;
  href?: string;
};

const roleNames: Record<Role, string> = {
  executive: "an executive",
  pm: "a project manager",
  superintendent: "a superintendent",
  foreman: "a foreman",
};

/** Runs one action as the user and records it. Every run is logged, refusals included. */
export async function run(
  user: CurrentUser,
  prompt: string,
  action: ActionName,
  args: JobArgs,
) {
  const def = actions[action];
  const allowed = !def.roles || def.roles.includes(user.role);
  // A named job that isn't in this sandbox is refused here, so no action can swap in another job.
  // Exception: PM%/milestone prompts often lead with a cost code (08-100). If that token
  // isn't a job and no separate costCode was supplied, reinterpret it as the cost code.
  let effectiveArgs = args;
  if (
    (action === "costItem.setPmPercent" ||
      action === "costItem.setMilestone") &&
    args.job &&
    !args.costCode &&
    !(await resolveJob(user, args.job))
  ) {
    effectiveArgs = {
      ...args,
      job: undefined,
      costCode: args.job,
      lineRef: args.lineRef ?? args.job,
    };
  }
  const unknown =
    effectiveArgs.job && !(await resolveJob(user, effectiveArgs.job));
  const result: ActionResult = unknown
    ? await unknownJob(user, effectiveArgs.job!)
    : allowed
      ? await def.run(user, effectiveArgs)
      : {
          summary: `${def.title} needs ${def.roles!.map((r) => roleNames[r]).join(" or ")}. You are signed in as ${roleNames[user.role]}. Switch role to try it.`,
        };
  const [row] = await requireDb()
    .insert(actionRuns)
    .values({
      companyId: user.companyId,
      userId: user.userId,
      prompt,
      action,
      // requested is the job the person named; job is the one the action acted on.
      // They differ when the request named none and the action picked one.
      args: {
        requested: args.job ?? null,
        job: result.job ?? null,
        ...(result.line ? { line: result.line } : {}),
        ...(result.href ? { href: result.href } : {}),
      } satisfies RunArgs,
      summary: result.summary,
    })
    .returning();
  return { ...row, result };
}

/**
 * One person's conversation: their latest runs, oldest first. Filtered here on the server by
 * the signed-in user, so switching roles starts fresh and nothing leaks through a reload.
 */
export async function recentRuns(
  user: Pick<CurrentUser, "companyId" | "userId">,
  limit = 30,
) {
  const rows = await requireDb()
    .select({ run: actionRuns, userName: users.name, role: users.role })
    .from(actionRuns)
    .innerJoin(users, eq(users.id, actionRuns.userId))
    .where(
      and(
        eq(actionRuns.companyId, user.companyId),
        eq(actionRuns.userId, user.userId),
      ),
    )
    .orderBy(desc(actionRuns.createdAt))
    .limit(limit);
  return rows.reverse().map(({ run, userName, role }) => ({
    id: run.id,
    prompt: run.prompt,
    action: run.action,
    args: run.args as RunArgs,
    summary: run.summary,
    createdAt: run.createdAt.toISOString(),
    userName,
    role,
  }));
}
export type RunView = Awaited<ReturnType<typeof recentRuns>>[number];

const WRITES: ActionName[] = [
  "dailyPlan.updateLine",
  "dailyPlan.submit",
  "dailyReport.post",
  "progressClaim.lock",
  "estimate.approve",
  "costItem.setPmPercent",
  "costItem.setMilestone",
];

/** The audit trail for one job: every change anyone in this sandbox made, newest first. */
export async function jobChanges(
  companyId: string,
  jobNumber: string,
  limit = 20,
) {
  const rows = await requireDb()
    .select({ run: actionRuns, userName: users.name, role: users.role })
    .from(actionRuns)
    .innerJoin(users, eq(users.id, actionRuns.userId))
    .where(
      and(
        eq(actionRuns.companyId, companyId),
        sql`${actionRuns.args}->>'job' = ${jobNumber}`,
        sql`${actionRuns.action} in (${sql.join(
          WRITES.map((w) => sql`${w}`),
          sql`, `,
        )})`,
      ),
    )
    .orderBy(desc(actionRuns.createdAt))
    .limit(limit);
  return rows.map(({ run, userName, role }) => ({
    id: run.id,
    action: run.action,
    summary: run.summary,
    createdAt: run.createdAt.toISOString(),
    userName,
    role,
  }));
}
