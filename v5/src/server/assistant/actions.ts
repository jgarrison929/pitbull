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
import {
  formatUnknownJobRefusal,
  pickUnknownJobChoices,
} from "@/lib/assistant/unknown-job";
import {
  changeOrderCountLabel,
  CO_COMMANDS,
  coCommandFromArgs,
  describeCoResult,
  type CoCommandName,
} from "@/lib/change-order";
import {
  formatInstalledByUnit,
  idx,
  laborCents,
  qty,
  usdCents,
  usdShort,
} from "@/lib/ev";
import { laborRateForPlan } from "@/server/plans";
import { pluralCount, sentence } from "@/lib/prose";
import {
  applyLineInput,
  manHoursOf,
  REPORT_LIMITS,
  type LineValues,
} from "@/lib/plan-line";
import {
  addCalendarDays,
  planDateToday,
  timeZoneForJob,
} from "@/lib/plan-date";
import {
  changeOrderCommand,
  listChangeOrders,
} from "@/server/change-orders";
import {
  getJob,
  getPlansForJob,
  getPortfolio,
  type JobDetail,
} from "@/server/data";
import { importErrorLines } from "@/lib/estimate-reconcile";
import { approveEstimate } from "@/server/estimate";
import { importEstimateCsv } from "@/server/estimate-import";
import {
  addPlanLine,
  createDailyPlan,
  findCrewByName,
  removePlanLine,
  resolvePlanForWrite,
} from "@/server/plans";
import {
  approveDailyReport,
  getReportedActualsForPlan,
  issueDailyPlan,
  lockProgressClaim,
  postDailyReport,
  returnDailyReport,
  forecastMethodLabel,
  parseForecastMethod,
  setForecastMethod,
  setMilestoneComplete,
  setPmPercent,
} from "@/server/progress";
import {
  rebaseline,
  setBaseline,
  type SetBaselineResult,
} from "@/server/schedule";
import { seedNow } from "@/server/seed-clock";
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
  /** Multi-line feedback (e.g. CSV row errors) shown as a list under the summary. */
  detailLines?: string[];
  /** Role, unknown job, or domain refusal — rail chip must not use success wording. */
  refused?: true;
};

type ActionDef = {
  title: string;
  /** Roles allowed to run it. Read-only actions are open to everyone. */
  roles?: Role[];
  /** Shows in the job change feed. WRITES is every action with this set. */
  writes?: true;
  run(user: CurrentUser, args: JobArgs): Promise<ActionResult>;
};

const day = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

const statusLabel = (status: string) => {
  switch (status) {
    case "draft":
      return "a draft";
    case "issued":
      return "issued to the field";
    case "reported":
      return "reported (pending approval)";
    case "approved":
      return "approved";
    default:
      return status;
  }
};

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
    summary: formatUnknownJobRefusal(number, pickUnknownJobChoices(all)),
    refused: true,
  };
}

function normalizePlanDate(date: string | undefined): string | undefined {
  if (!date) return undefined;
  const today = planDateToday(seedNow(), timeZoneForJob());
  if (date === "today") return today;
  if (date === "tomorrow") return addCalendarDays(today, 1);
  return date;
}

type PlanRow = Awaited<ReturnType<typeof getPlansForJob>>[number];

type ScopedOk = { status: "ok"; job: JobDetail; plan: PlanRow };
type ScopedNone = { status: "none"; job?: JobDetail };
type ScopedAsk = {
  status: "ask";
  job?: JobDetail;
  plans: PlanRow[];
};
type ScopedResult = ScopedOk | ScopedNone | ScopedAsk;

function formatPlanChoices(plans: PlanRow[]): string {
  return plans
    .map((p) => `${p.crew}, ${day(p.planDate)}, ${p.status}`)
    .join("; ");
}

/**
 * Scope a plan to an explicit id or to exactly one match.
 * Never picks a keep-winner. Zero matches → none; more than one → ask.
 * `draftsOnly`: when the caller omitted date (submit), narrow to drafts and
 * accept only if exactly one draft remains.
 * `statuses`: narrow candidates (approve/return → reported only).
 */
async function scopedPlan(
  user: CurrentUser,
  args: {
    planId?: string;
    job?: string;
    date?: string;
    crew?: string;
    crewId?: string;
  },
  opts?: { draftsOnly?: boolean; statuses?: readonly string[] },
): Promise<ScopedResult> {
  const planDate = normalizePlanDate(args.date);
  if (args.planId) {
    const row = await resolvePlanForWrite(user, { planId: args.planId });
    if (!row) return { status: "none" };
    if (args.job && row.jobNumber !== args.job) return { status: "none" };
    const job = await resolveJob(user, row.jobNumber);
    if (!job) return { status: "none" };
    const plan = (await getPlansForJob(user.companyId, job.job.id)).find(
      (p) => p.id === row.plan.id,
    );
    if (!plan) return { status: "none" };
    return { status: "ok", job, plan };
  }

  let job: JobDetail | undefined;
  let candidates: PlanRow[] = [];

  if (args.job) {
    const resolved = await resolveJob(user, args.job);
    if (!resolved) return { status: "none" };
    job = resolved;
    candidates = await getPlansForJob(user.companyId, job.job.id);
  } else if (planDate) {
    // Rail shorthand with a date only: this foreman's plans that day.
    const rows = await requireDb()
      .select({ id: dailyPlans.id, jobId: dailyPlans.jobId })
      .from(dailyPlans)
      .where(
        and(
          eq(dailyPlans.companyId, user.companyId),
          eq(dailyPlans.planDate, planDate),
          eq(dailyPlans.foremanId, user.userId),
        ),
      );
    if (rows.length === 0) return { status: "none" };
    for (const r of rows) {
      const j = await jobById(user, r.jobId);
      if (!j) continue;
      const plan = (await getPlansForJob(user.companyId, j.job.id)).find(
        (p) => p.id === r.id,
      );
      if (!plan) continue;
      job = j;
      candidates.push(plan);
    }
    if (candidates.length === 0) return { status: "none" };
  } else {
    return { status: "none" };
  }

  const todayIso = planDateToday(seedNow(), timeZoneForJob());
  if (planDate) {
    candidates = candidates.filter((p) => p.planDate === planDate);
  } else {
    // Implicit today: working surface only (today and future).
    // Do not ask across seeded past-day history.
    candidates = candidates.filter((p) => p.planDate >= todayIso);
  }
  if (args.crewId) {
    candidates = candidates.filter((p) => p.crewId === args.crewId);
  } else if (args.crew) {
    const c = await findCrewByName(user.companyId, args.crew);
    const needle = args.crew.trim().toLowerCase();
    candidates = candidates.filter(
      (p) =>
        (c && p.crewId === c.id) ||
        p.crew.toLowerCase() === needle ||
        p.crew.toLowerCase().includes(needle),
    );
  }

  if (opts?.draftsOnly) {
    candidates = candidates.filter((p) => p.status === "draft");
  }
  if (opts?.statuses?.length) {
    const allowed = new Set(opts.statuses);
    candidates = candidates.filter((p) => allowed.has(p.status));
  }

  // No explicit date: if exactly one of today's plans remains, use it
  // (do not ask across today + tomorrow when today alone matches).
  if (!planDate && candidates.length > 1) {
    const todays = candidates.filter((p) => p.planDate === todayIso);
    if (todays.length === 1) candidates = todays;
  }

  if (candidates.length === 0) return { status: "none", job };
  if (candidates.length === 1 && job) {
    return { status: "ok", job, plan: candidates[0] };
  }
  if (candidates.length === 1) return { status: "none" };
  return { status: "ask", job, plans: candidates };
}

/** Map scopedPlan result for write actions — refuse on none/ask; never guess. */
function writeScope(
  found: ScopedResult,
  opts: {
    planId?: string;
    jobArg?: string;
    noneWithId: string;
    /** When nothing matched and there is no planId (ask which / use the card). */
    noneAsk: string;
    askLead: string;
  },
): ActionResult | ScopedOk {
  if (found.status === "ok") return found;
  const jobNumber = found.job?.job.number ?? opts.jobArg;
  const href = found.job ? jobHref(found.job) : undefined;
  if (found.status === "ask") {
    return {
      summary: `${opts.askLead} ${formatPlanChoices(found.plans)}. Use the button on the plan card.`,
      refused: true,
      job: jobNumber,
      href,
    };
  }
  return {
    summary: opts.planId ? opts.noneWithId : opts.noneAsk,
    refused: true,
    job: jobNumber,
    href,
  };
}

const jobHref = (j: JobDetail) => `/app/jobs/${j.job.number}`;

type Plan = Awaited<ReturnType<typeof getPlansForJob>>[number];
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
      `man-hours ${mhBefore} → ${mhAfter} (${pluralCount(after.workers, "worker")} × ${after.hoursTenths / 10} h)`,
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


function describeBaselineResult(
  r: SetBaselineResult,
  kind: "set" | "rebaseline",
): ActionResult {
  const jobNumber = r.ok ? r.job.number : r.job?.number;
  if (r.ok) {
    const verb = kind === "set" ? "Set" : "Re-baselined";
    return {
      summary: `${verb} “${r.baseline.name}” on ${r.job.shortName} (${r.baseline.activityCount} activities). Reason: ${r.baseline.reason}.`,
      href: `/app/jobs/${r.job.number}`,
      job: r.job.number,
    };
  }
  const summary = (() => {
    switch (r.refusal.kind) {
      case "missing_job":
        return "Which job? Name it or give its number, like 25-031.";
      case "estimate_not_approved":
        return r.job
          ? `${r.job.shortName} is still a draft estimate — approve the estimate before setting a baseline.`
          : "That job is still a draft estimate.";
      case "no_activities":
        return r.job
          ? `${r.job.shortName} has no activities to baseline.`
          : "That job has no activities to baseline.";
      case "empty_name":
        return "Name the baseline, like Award baseline.";
      case "empty_reason":
        return "Why are you setting this baseline? Add a short reason.";
      case "baseline_exists":
        return r.job
          ? `${r.job.shortName} already has a baseline — re-baseline with a reason to append a new one.`
          : "That job already has a baseline — re-baseline instead.";
      case "no_baseline":
        return r.job
          ? `${r.job.shortName} has no baseline yet — set the first one before re-baselining.`
          : "Set the first baseline before re-baselining.";
      case "immutable":
        return "Baseline dates are locked. Re-baseline to capture new dates.";
    }
  })();
  return {
    summary,
    refused: true,
    ...(jobNumber ? { job: jobNumber } : {}),
  };
}

const CO_ACTIONS = {
  create: { title: "Raise a change order", roles: ["pm", "executive"] },
  price: { title: "Price a change order", roles: ["pm", "executive"] },
  approve: { title: "Approve a change order", roles: ["pm", "executive"] },
  reject: { title: "Reject a change order", roles: ["pm", "executive"] },
  void: { title: "Void a change order", roles: ["pm", "executive"] },
} as const satisfies Record<
  CoCommandName,
  { title: string; roles: readonly Role[] }
>;

async function runCo(
  user: CurrentUser,
  name: CoCommandName,
  args: JobArgs,
): Promise<ActionResult> {
  if (!args.job)
    return {
      summary:
        "Which job? Change orders are numbered per job — name it, like 25-031.",
      refused: true,
    };
  const command = coCommandFromArgs(name, args);
  if ("ask" in command)
    return { summary: command.ask, job: args.job, refused: true };
  const r = await changeOrderCommand(
    user.companyId,
    { userId: user.userId, role: user.role },
    args.job,
    command,
  );
  return {
    summary: describeCoResult(r),
    href: `/app/jobs/${args.job}#change-orders`,
    job: r.job?.number ?? args.job,
    ...(!r.ok && r.errors ? { errors: r.errors } : {}),
    ...(!r.ok ? { refused: true as const } : {}),
  };
}

function coActionDefs(): Record<`changeOrder.${CoCommandName}`, ActionDef> {
  return Object.fromEntries(
    CO_COMMANDS.map((name) => [
      `changeOrder.${name}`,
      {
        title: CO_ACTIONS[name].title,
        roles: [...CO_ACTIONS[name].roles],
        writes: true,
        run: (user: CurrentUser, args: JobArgs) => runCo(user, name, args),
      } satisfies ActionDef,
    ]),
  ) as Record<`changeOrder.${CoCommandName}`, ActionDef>;
}

export const actions: Record<ActionName, ActionDef> = {
  "portfolio.summary": {
    title: "Portfolio summary",
    async run(user) {
      const { jobs: all, activeJobCount, totals } = await getPortfolio(
        user.companyId,
      );
      const risky = all.filter(
        (j) => !j.estimateDraft && j.status !== "on-track",
      );
      const flags = risky.map((j) =>
        (j.cpi ?? Infinity) < (j.spi ?? Infinity)
          ? `${j.job.shortName} (CPI ${idx(j.cpi)})`
          : `${j.job.shortName} (SPI ${idx(j.spi)})`,
      );
      return {
        summary:
          `${activeJobCount} active jobs. Portfolio CPI ${idx(totals.cpi)}, SPI ${idx(totals.spi)}. ` +
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
          `${j.job.shortName} is ${usdShort(Math.abs(net))} ${net < 0 ? "over" : "under"} on earned vs actual cost (CPI ${idx(j.cpi)}). ` +
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
    async run(user, { job, planId, date, crew, crewId }) {
      const found = await scopedPlan(user, {
        planId,
        job,
        date,
        crew,
        crewId,
      });
      if (found.status === "ask") {
        return {
          summary: `Which plan should I show? ${formatPlanChoices(found.plans)}. Name the crew and date.`,
          job: found.job?.job.number ?? job,
          href: found.job ? jobHref(found.job) : undefined,
        };
      }
      if (found.status !== "ok")
        return { summary: "There is no crew plan for that job yet." };
      const { plan, job: j } = found;
      const mh = plan.lines.reduce((s, l) => s + l.manHours, 0);
      const over = plan.lines.filter((l) => !l.withinRate);
      return {
        summary:
          `${plan.crew} on ${j.job.shortName}, ${day(plan.planDate)}, is ${statusLabel(plan.status)}. ` +
          `${pluralCount(plan.lines.length, "activity", "activities")}, ${mh} man-hours: ${plan.lines.map((l) => l.activity).join(", ")}. ` +
          (over.length
            ? `Over budgeted rate: ${over.map((l) => l.code).join(", ")}.`
            : "Every line is within its budgeted unit rate."),
        href: jobHref(j),
        job: j.job.number,
      };
    },
  },
  "dailyPlan.create": {
    title: "Create a daily plan",
    writes: true,
    roles: ["superintendent"],
    async run(user, { job, date, crew, crewId }) {
      if (!job)
        return {
          summary: "Which job should I plan? Name the job number.",
          refused: true,
        };
      const j = await resolveJob(user, job);
      if (!j) return unknownJob(user, job);
      const today = planDateToday(seedNow(), timeZoneForJob());
      const planDate =
        !date || date === "today"
          ? today
          : date === "tomorrow"
            ? addCalendarDays(today, 1)
            : date;
      let resolvedCrewId = crewId;
      if (!resolvedCrewId && crew) {
        const c = await findCrewByName(user.companyId, crew);
        if (!c)
          return {
            summary: `There is no crew named "${crew}" in this sandbox.`,
            href: jobHref(j),
            job: j.job.number,
            refused: true,
          };
        resolvedCrewId = c.id;
      }
      if (!resolvedCrewId)
        return {
          summary: "Which crew should I put on the plan?",
          href: jobHref(j),
          job: j.job.number,
          refused: true,
        };
      const result = await createDailyPlan(user, {
        jobId: j.job.id,
        crewId: resolvedCrewId,
        planDate,
      });
      if ("refused" in result)
        return {
          summary: result.refused,
          href: jobHref(j),
          job: j.job.number,
          refused: true,
        };
      return {
        summary: `Created a draft plan on ${j.job.shortName} for ${planDate}. Add a cost item to plan the day.`,
        href: jobHref(j),
        job: j.job.number,
      };
    },
  },
  "dailyPlan.addLine": {
    title: "Add a plan line",
    writes: true,
    roles: ["superintendent"],
    async run(user, args) {
      const {
        job,
        planId,
        date,
        crew,
        crewId,
        costItemId,
        costCode,
        activity,
        location,
        qty,
        workers,
        hours,
      } = args;
      // Rail defaults to today when the prompt omitted a date; cards pass planId.
      const found = await scopedPlan(user, {
        planId,
        job,
        date: planId ? date : (date ?? "today"),
        crew,
        crewId,
      });
      const scoped = writeScope(found, {
        planId,
        jobArg: job,
        noneWithId: "There is no plan to add a line to.",
        noneAsk:
          "Which plan should I add a line to? Use Add on the plan card, or name the crew and date.",
        askLead: "Which plan should I add a line to?",
      });
      if (!("status" in scoped)) return scoped;
      const { plan, job: j } = scoped;
      let itemId = costItemId;
      if (!itemId && costCode) {
        const [item] = await requireDb()
          .select({ id: costItems.id })
          .from(costItems)
          .where(
            and(
              eq(costItems.companyId, user.companyId),
              eq(costItems.jobId, j.job.id),
              eq(costItems.code, costCode),
              eq(costItems.isLeaf, true),
            ),
          )
          .limit(1);
        itemId = item?.id;
      }
      if (!itemId)
        return {
          summary: "Which cost item should I add? Name a leaf code on this job.",
          href: jobHref(j),
          job: j.job.number,
          refused: true,
        };
      const result = await addPlanLine(user, plan.id, {
        costItemId: itemId,
        activity,
        location,
        qty,
        workers,
        hours,
      });
      if ("refused" in result)
        return {
          summary: result.refused,
          href: jobHref(j),
          job: j.job.number,
          refused: true,
        };
      return {
        summary: `Added a line to ${plan.crew}'s plan for ${day(plan.planDate)} on ${j.job.shortName}.`,
        href: jobHref(j),
        job: j.job.number,
      };
    },
  },
  "dailyPlan.removeLine": {
    title: "Remove a plan line",
    writes: true,
    roles: ["superintendent"],
    async run(user, { job, planId, lineId, lineRef, costCode, date, crew, crewId }) {
      const found = await scopedPlan(user, {
        planId,
        job,
        date: planId ? date : (date ?? "today"),
        crew,
        crewId,
      });
      const scoped = writeScope(found, {
        planId,
        jobArg: job,
        noneWithId: "There is no plan to change.",
        noneAsk:
          "Which plan should I change? Use the plan card, or name the crew and date.",
        askLead: "Which plan should I change?",
      });
      if (!("status" in scoped)) return scoped;
      const { plan, job: j } = scoped;
      let id = lineId;
      if (!id) {
        const code = costCode ?? lineRef;
        const line = plan.lines.find(
          (l) =>
            l.id === lineRef ||
            (code && l.code.toLowerCase() === code.toLowerCase()),
        );
        id = line?.id;
      }
      if (!id)
        return {
          summary: "Which line should I remove? Name the cost code or pick it on screen.",
          href: jobHref(j),
          job: j.job.number,
          refused: true,
        };
      const result = await removePlanLine(user, plan.id, id);
      if ("refused" in result)
        return {
          summary: result.refused,
          href: jobHref(j),
          job: j.job.number,
          refused: true,
        };
      return {
        summary: `Removed a line from ${plan.crew}'s plan for ${day(plan.planDate)} on ${j.job.shortName}.`,
        href: jobHref(j),
        job: j.job.number,
      };
    },
  },
  "dailyPlan.updateLine": {
    title: "Change a plan line",
    writes: true,
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
        const p = await scopedPlan(user, {
          job,
          date: "tomorrow",
        });
        if (p.status === "ask") {
          return {
            summary: `Which plan should I change? ${formatPlanChoices(p.plans)}. Name the crew.`,
            href: p.job ? jobHref(p.job) : undefined,
            job: p.job?.job.number ?? job,
            refused: true,
          };
        }
        if (p.status !== "ok")
          return { summary: "There is no crew plan to change." };
        const m = matchLine(p.plan.lines, lineRef ?? "");
        if ("ask" in m)
          return {
            summary: m.ask,
            href: jobHref(p.job),
            job: p.job.job.number,
          };
        found = { job: p.job, plan: p.plan, line: m.line };
      }
      const { job: j, plan, line } = found;
      const where = { href: jobHref(j), job: j.job.number, line: line.code };
      if (plan.status !== "draft") {
        const msg =
          plan.status === "approved"
            ? `${plan.crew}'s plan for ${day(plan.planDate)} is approved and locked. A correction needs a new reversing entry.`
            : `${plan.crew}'s plan for ${day(plan.planDate)} is issued, so its lines are locked. Use Report day's work (or ask me) for actual hours and quantities — the plan stays as planned.`;
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
        summary: sentence(
          `Changed ${item.code} ${v.activity} on ${plan.crew}'s plan: `,
          changes,
        ),
        ...where,
        line: item.code,
      };
    },
  },
  "dailyPlan.submit": {
    title: "Issue a crew plan to the field",
    writes: true,
    roles: ["foreman", "superintendent"],
    async run(user, { job, planId, date, crew, crewId }) {
      // No default to "tomorrow". With no date, accept only if exactly one draft matches.
      const found = await scopedPlan(
        user,
        { planId, job, date, crew, crewId },
        { draftsOnly: !planId && !date },
      );
      const scoped = writeScope(found, {
        planId,
        jobArg: job,
        noneWithId: "There is no crew plan to submit.",
        noneAsk:
          "Which plan should I submit? Use Submit on the plan card, or name the job and date.",
        askLead: "Which plan should I submit?",
      });
      if (!("status" in scoped)) return scoped;
      const { plan, job: j } = scoped;
      if (plan.status !== "draft")
        return {
          summary: `${plan.crew}'s plan for ${day(plan.planDate)} on ${j.job.shortName} was already issued.`,
          href: jobHref(j),
          job: j.job.number,
        };
      if (plan.lines.length === 0)
        return {
          summary: `Add a cost item before submitting ${plan.crew}'s plan for ${day(plan.planDate)}.`,
          href: jobHref(j),
          job: j.job.number,
          refused: true,
        };
      const issued = await issueDailyPlan(user.companyId, plan.id, {
        userId: user.userId,
        role: user.role,
      });
      if (!issued.ok) {
        return {
          summary: `${plan.crew}'s plan for ${day(plan.planDate)} on ${j.job.shortName} was already issued.`,
          href: jobHref(j),
          job: j.job.number,
        };
      }
      // Plan ≠ actual: issue only commits the plan. Actuals stay pending until approve.
      const mh = plan.lines.reduce((s, l) => s + l.manHours, 0);
      return {
        summary: `Issued ${plan.crew}'s plan for ${day(plan.planDate)} on ${j.job.shortName}: ${pluralCount(plan.lines.length, "activity", "activities")}, ${mh} man-hours. Planned only — report the day's work; cost posts when the superintendent approves.`,
        href: jobHref(j),
        job: j.job.number,
      };
    },
  },
  "dailyPlan.approve": {
    title: "Approve a daily report",
    writes: true,
    roles: ["superintendent"],
    async run(user, { job, planId, date, crew, crewId }) {
      // Rail match set: reported only. Approved is never a choice that causes ask.
      // Cards pass planId and skip the status filter.
      const scopeArgs = { planId, job, date, crew, crewId };
      const found = await scopedPlan(
        user,
        scopeArgs,
        planId ? undefined : { statuses: ["reported"] },
      );
      if (found.status === "none" && !planId) {
        const approved = await scopedPlan(user, scopeArgs, {
          statuses: ["approved"],
        });
        if (approved.status === "ok") {
          const { plan, job: j } = approved;
          return {
            summary: `${plan.crew}'s report for ${day(plan.planDate)} on ${j.job.shortName} is already approved — cost was not posted again.`,
            href: jobHref(j),
            job: j.job.number,
          };
        }
        if (approved.status === "ask" && approved.plans.length > 0) {
          const j = approved.job!;
          // Several approved matches: do not imply one arbitrary plan.
          const sorted = [...approved.plans].sort(
            (a, b) =>
              a.planDate.localeCompare(b.planDate) ||
              a.crew.localeCompare(b.crew) ||
              a.id.localeCompare(b.id),
          );
          if (sorted.length === 1) {
            const p = sorted[0]!;
            return {
              summary: `${p.crew}'s report for ${day(p.planDate)} on ${j.job.shortName} is already approved — cost was not posted again.`,
              href: jobHref(j),
              job: j.job.number,
            };
          }
          return {
            summary: `Those reports on ${j.job.shortName} are already approved — cost was not posted again.`,
            href: jobHref(j),
            job: j.job.number,
          };
        }
      }
      const scoped = writeScope(found, {
        planId,
        jobArg: job,
        noneWithId: "There is no crew plan to approve.",
        noneAsk:
          "Nothing to approve — no reported plan matches. Use Approve on the plan card when a report is ready.",
        askLead: "Which report should I approve?",
      });
      if (!("status" in scoped)) return scoped;
      const { plan, job: j } = scoped;
      if (plan.status === "approved") {
        return {
          summary: `${plan.crew}'s report for ${day(plan.planDate)} on ${j.job.shortName} is already approved — cost was not posted again.`,
          href: jobHref(j),
          job: j.job.number,
        };
      }
      if (plan.status !== "reported") {
        return {
          summary: `Nothing to approve yet — ${plan.crew}'s plan for ${day(plan.planDate)} is ${statusLabel(plan.status)}. The foreman must report first.`,
          href: jobHref(j),
          job: j.job.number,
        };
      }
      const result = await approveDailyReport(user.companyId, plan.id, {
        userId: user.userId,
        role: user.role,
      });
      if (!result.ok) {
        return {
          summary: `Could not approve ${plan.crew}'s report on ${j.job.shortName}.`,
          href: jobHref(j),
          job: j.job.number,
        };
      }
      if (result.already) {
        return {
          summary: `${plan.crew}'s report for ${day(plan.planDate)} on ${j.job.shortName} is already approved — cost was not posted again.`,
          href: jobHref(j),
          job: j.job.number,
        };
      }
      const installed = formatInstalledByUnit(result.postedQtyByUnit);
      return {
        summary:
          `Approved ${plan.crew}'s report for ${day(plan.planDate)} on ${j.job.shortName}: ` +
          `${result.postedMh} MH at ${usdCents(result.rateCents)}/MH / ${usdShort(result.postedCents)} actual cost` +
          (installed ? `, ${installed}` : "") +
          `. Entries dated ${day(result.planDate!)}.`,
        href: jobHref(j),
        job: j.job.number,
      };
    },
  },
  "dailyPlan.return": {
    title: "Return a daily report",
    writes: true,
    roles: ["superintendent"],
    async run(user, { job, planId, date, crew, crewId, reason }) {
      const found = await scopedPlan(
        user,
        { planId, job, date, crew, crewId },
        planId ? undefined : { statuses: ["reported"] },
      );
      const scoped = writeScope(found, {
        planId,
        jobArg: job,
        noneWithId: "There is no crew plan to return.",
        noneAsk:
          "Nothing to return — no reported plan matches. Use Return on the plan card when a report is ready.",
        askLead: "Which report should I return?",
      });
      if (!("status" in scoped)) return scoped;
      const { plan, job: j } = scoped;
      const why = (reason ?? "").trim();
      if (!why) {
        return {
          summary:
            "Return needs a reason — say why (for example: Return the report because Recount pour 3).",
          href: jobHref(j),
          job: j.job.number,
          errors: { reason: "A return reason is required." },
        };
      }
      if (plan.status !== "reported") {
        return {
          summary: `Nothing to return — ${plan.crew}'s plan for ${day(plan.planDate)} is ${statusLabel(plan.status)}.`,
          href: jobHref(j),
          job: j.job.number,
        };
      }
      const result = await returnDailyReport(user.companyId, plan.id, why, {
        userId: user.userId,
        role: user.role,
      });
      if (!result.ok) {
        return {
          summary:
            result.reason === "need-reason"
              ? "Return needs a reason."
              : `Could not return ${plan.crew}'s report.`,
          href: jobHref(j),
          job: j.job.number,
          errors: { reason: "A return reason is required." },
        };
      }
      return {
        summary: `Returned ${plan.crew}'s report for ${day(plan.planDate)} on ${j.job.shortName}: "${why}". Values kept for the foreman — nothing posted to cost.`,
        href: jobHref(j),
        job: j.job.number,
      };
    },
  },
  "dailyReport.post": {
    title: "Report a day's work",
    writes: true,
    roles: ["foreman", "superintendent"],
    async run(user, { job, planId, date, crew, crewId, actuals, lineRef }) {
      const found = await scopedPlan(user, { planId, job, date, crew, crewId });
      const scoped = writeScope(found, {
        planId,
        jobArg: job,
        noneWithId: "There is no crew plan to report against.",
        noneAsk:
          "Which plan should I report against? Use Report on the plan card.",
        askLead: "Which plan should I report against?",
      });
      if (!("status" in scoped)) return scoped;
      const { plan, job: j } = scoped;
      if (plan.status === "approved") {
        return {
          summary: `${plan.crew}'s report for ${day(plan.planDate)} is already approved and locked.`,
          href: jobHref(j),
          job: j.job.number,
        };
      }
      if (plan.status !== "issued" && plan.status !== "reported")
        return {
          summary: `Issue ${plan.crew}'s plan first — I won't report against a draft. Then use Report day's work; cost stays pending until the superintendent approves.`,
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
      const result = await postDailyReport(user.companyId, plan.id, byLineId, {
        userId: user.userId,
        role: user.role,
      });
      if (!("ok" in result) || !result.ok) {
        return {
          summary: `Could not save ${plan.crew}'s report on ${j.job.shortName}.`,
          href: jobHref(j),
          job: j.job.number,
        };
      }
      const reportDay = day(plan.planDate);
      const rateCents = await laborRateForPlan(requireDb(), plan.id);
      const pendingCents = Object.values(byLineId).reduce(
        (s, a) => s + laborCents(a.manHours, rateCents),
        0,
      );
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
          `${result.postedMh} man-hours pending` +
          (diffs.length ? ` — ${diffs.join("; ")}` : " (as planned)") +
          `. ${usdShort(pendingCents)} and quantities await superintendent approval — nothing posted to actual cost yet.`,
        href: jobHref(j),
        job: j.job.number,
      };
    },
  },
  "progressClaim.lock": {
    title: "Lock a progress claim",
    writes: true,
    roles: ["pm", "executive"],
    async run(user, { job }) {
      if (!job)
        return {
          summary:
            "Which job's progress claim should I lock? Name the job number.",
        };
      const j = await resolveJob(user, job);
      if (!j) return unknownJob(user, job);
      if (j.job.estimateStatus === "draft")
        return {
          summary: `Approve the estimate on ${j.job.shortName} before locking a progress claim.`,
          href: jobHref(j),
          job: j.job.number,
          refused: true,
        };
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
          refused: true,
        };
      return {
        summary: `Locked ${result.periodLabel} on ${j.job.shortName}: ${pluralCount(result.lines, "cost code")}. ${result.nextPeriodLabel} is now open as a draft.`,
        href: jobHref(j),
        job: j.job.number,
      };
    },
  },
  "estimate.importCsv": {
    title: "Import estimate CSV",
    writes: true,
    roles: ["pm"],
    async run(user, { job, csv }) {
      if (!job)
        return {
          summary: "Which job's estimate should I import? Name the job number.",
        };
      const j = await resolveJob(user, job);
      if (!j) return unknownJob(user, job);
      // No job on this result: pointing at the file picker changes nothing, so it stays off the job's audit trail.
      if (!csv && j.job.estimateStatus === "draft")
        return {
          summary: `Import reads a CSV file. Open ${j.job.shortName} and choose the estimate file under Import estimate.`,
          href: jobHref(j),
        };
      const result = await importEstimateCsv(
        user.companyId,
        j.job.number,
        csv ?? "",
      );
      const detailLines =
        !result.ok && "errors" in result && result.errors.length
          ? importErrorLines(result.errors)
          : undefined;
      return {
        summary: result.summary,
        href: jobHref(j),
        job: j.job.number,
        ...(detailLines?.length ? { detailLines } : {}),
      };
    },
  },
  "estimate.approve": {
    title: "Approve estimate",
    writes: true,
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
          refused: true,
        };
      }
      return {
        summary:
          `Approved the estimate on ${result.shortName}: Original Budget ` +
          `${usdShort(result.originalBudgetCents)} frozen across ${pluralCount(result.leafCount, "cost item")}. ` +
          `Current Budget equals Original.`,
        href: jobHref(j),
        job: j.job.number,
      };
    },
  },
  "costItem.setPmPercent": {
    title: "Log PM percent complete",
    writes: true,
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
    writes: true,
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
  "costItem.setForecastMethod": {
    title: "Set forecast method",
    writes: true,
    // PM owns forecasts; executive / superintendent / foreman are refused.
    roles: ["pm"],
    async run(user, { job, costItemId, costCode, lineRef, forecastMethod }) {
      const method = parseForecastMethod(forecastMethod);
      if (!method) {
        return {
          summary:
            "Which forecast method? Say Current Budget or Average Performance.",
          refused: true,
          job,
        };
      }
      const item = await resolveCostItem(user, {
        job,
        costItemId,
        costCode,
        lineRef,
      });
      if ("summary" in item) return { ...item, refused: true as const };
      const result = await setForecastMethod(user.companyId, item.id, method);
      if (!result.ok) {
        return {
          summary:
            result.reason === "not-leaf"
              ? `${item.code} is a summary row — pick a leaf cost item.`
              : "That cost item isn't on this job.",
          refused: true,
          job: item.jobNumber,
        };
      }
      const label = forecastMethodLabel(result.method);
      const summary = result.unchanged
        ? `${result.code} ${result.description} is already on ${label}.`
        : `Switched ${result.code} ${result.description} to ${label} (was ${forecastMethodLabel(result.previous)}).`;
      return {
        summary,
        href: `/app/jobs/${item.jobNumber}/cost-items/${result.code}`,
        job: item.jobNumber,
        line: result.code,
      };
    },
  },
  "schedule.setBaseline": {
    title: "Set baseline",
    writes: true,
    roles: ["pm"],
    async run(user, { job, name, reason }) {
      if (!job)
        return {
          summary:
            "Which job? Name it or give its number, like 25-031.",
          refused: true,
        };
      return describeBaselineResult(
        await setBaseline(
          user.companyId,
          { userId: user.userId, role: user.role },
          job,
          { name, reason },
        ),
        "set",
      );
    },
  },
  "schedule.rebaseline": {
    title: "Re-baseline",
    writes: true,
    roles: ["pm"],
    async run(user, { job, name, reason }) {
      if (!job)
        return {
          summary:
            "Which job? Name it or give its number, like 25-031.",
          refused: true,
        };
      return describeBaselineResult(
        await rebaseline(
          user.companyId,
          { userId: user.userId, role: user.role },
          job,
          { name, reason },
        ),
        "rebaseline",
      );
    },
  },
  ...coActionDefs(),
  "changeOrder.show": {
    title: "Show change orders",
    async run(user, { job }) {
      if (!job)
        return {
          summary:
            "Which job? Change orders are numbered per job — name it, like 25-031.",
        };
      const data = await listChangeOrders(user.companyId, job);
      if (!data) return unknownJob(user, job);
      const href = `/app/jobs/${job}#change-orders`;
      if (!data.changeOrders.length)
        return {
          summary: `${data.job.shortName} has no change orders yet. Raise one, then price it. Nothing moves until a PM or executive approves.`,
          href,
          job,
        };
      const listed = data.changeOrders
        .slice(0, 8)
        .map(
          (c) =>
            `${c.label} ${c.title} (${c.status}, ${usdCents(c.totalCents)})`,
        )
        .join("; ");
      return {
        summary:
          `${data.job.shortName}: ${changeOrderCountLabel(data.changeOrders.length)}. ` +
          `Pending ${usdCents(data.ledger.pendingCents)}, not in Current Budget or EAC. ${listed}.`,
        href,
        job,
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
  /** When true, the rail chip uses a refusal label (never success wording). */
  refused?: true;
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
      action === "costItem.setMilestone" ||
      action === "costItem.setForecastMethod") &&
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
          refused: true,
          // Keep the named job on the chip so refusal reads "Couldn't … on 25-031".
          job: effectiveArgs.job,
        };
  const refused = Boolean(result.refused);
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
        // Role refusal never ran the action — still show the job they named.
        job: result.job ?? effectiveArgs.job ?? null,
        ...(result.line ? { line: result.line } : {}),
        ...(result.href ? { href: result.href } : {}),
        ...(refused ? { refused: true as const } : {}),
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
  return rows.reverse().map(({ run, userName, role }) => {
    const args = run.args as RunArgs;
    return {
      id: run.id,
      prompt: run.prompt,
      action: run.action,
      args,
      summary: run.summary,
      createdAt: run.createdAt.toISOString(),
      userName,
      role,
    };
  });
}
export type RunView = Awaited<ReturnType<typeof recentRuns>>[number];

/** Job change feed. Derived from `writes: true`, so a new command cannot forget the list. */
export const WRITES: ActionName[] = (Object.keys(actions) as ActionName[]).filter(
  (name) => actions[name].writes,
);

function jobChangesWhere(companyId: string, jobNumber: string) {
  return and(
    eq(actionRuns.companyId, companyId),
    sql`${actionRuns.args}->>'job' = ${jobNumber}`,
    sql`${actionRuns.action} in (${sql.join(
      WRITES.map((w) => sql`${w}`),
      sql`, `,
    )})`,
  );
}

/** The audit trail for one job: every change anyone in this sandbox made, newest first. */
export async function jobChanges(
  companyId: string,
  jobNumber: string,
  limit = 20,
  offset = 0,
) {
  const rows = await requireDb()
    .select({ run: actionRuns, userName: users.name, role: users.role })
    .from(actionRuns)
    .innerJoin(users, eq(users.id, actionRuns.userId))
    .where(jobChangesWhere(companyId, jobNumber))
    .orderBy(desc(actionRuns.createdAt))
    .limit(limit)
    .offset(offset);
  return rows.map(({ run, userName, role }) => ({
    id: run.id,
    action: run.action,
    summary: run.summary,
    createdAt: run.createdAt.toISOString(),
    userName,
    role,
  }));
}

/** How many write actions are on this job's change list. */
export async function jobChangesCount(companyId: string, jobNumber: string) {
  const [row] = await requireDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(actionRuns)
    .where(jobChangesWhere(companyId, jobNumber));
  return Number(row?.n ?? 0);
}
