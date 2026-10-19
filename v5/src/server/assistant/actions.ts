import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { requireDb } from "@/db";
import { actionRuns, dailyPlans, jobs, users } from "@/db/schema";
import type { ActionName, JobArgs } from "@/lib/assistant/route";
import { usdShort } from "@/lib/ev";
import { getPlansForJob, getPortfolio, type PortfolioJob } from "@/server/data";
import type { CurrentUser, Role } from "@/server/session";

// The typed actions. The assistant and on-screen buttons both call run(), so every change goes
// through one path, is checked against the role, and is written to action_runs.

export type ActionResult = { summary: string; href?: string };

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

async function resolveJob(user: CurrentUser, number?: string) {
  const { jobs: all } = await getPortfolio(user.companyId);
  return number ? all.find((j) => j.job.number === number) : undefined;
}

/** The plan a request means: the named job's next plan, or else the next draft this person can act on. */
async function resolvePlan(user: CurrentUser, number?: string) {
  const db = requireDb();
  const target = await resolveJob(user, number);
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
  const job =
    target ??
    (await getPortfolio(user.companyId)).jobs.find(
      (j) => j.job.id === row.jobId,
    )!;
  const plan = (await getPlansForJob(user.companyId, job.job.id)).find(
    (p) => p.id === row.id,
  )!;
  return { job, plan };
}

const jobHref = (j: PortfolioJob) => `/app/jobs/${j.job.number}`;

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
      const mh = plan.lines.reduce((s, l) => s + l.manHours, 0);
      return {
        summary: `Submitted ${plan.crew}'s plan for ${day(plan.planDate)} on ${j.job.shortName}: ${plan.lines.length} activities, ${mh} man-hours.`,
        href: jobHref(j),
      };
    },
  },
};

export const isActionName = (s: unknown): s is ActionName =>
  typeof s === "string" && Object.hasOwn(actions, s);

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
  const result: ActionResult = allowed
    ? await def.run(user, args)
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
      args: { ...args, ...(result.href ? { href: result.href } : {}) },
      summary: result.summary,
    })
    .returning();
  return row;
}

/** The latest runs in this sandbox, oldest first, for the assistant transcript. */
export async function recentRuns(companyId: string, limit = 30) {
  const rows = await requireDb()
    .select({ run: actionRuns, userName: users.name, role: users.role })
    .from(actionRuns)
    .innerJoin(users, eq(users.id, actionRuns.userId))
    .where(eq(actionRuns.companyId, companyId))
    .orderBy(desc(actionRuns.createdAt))
    .limit(limit);
  return rows.reverse().map(({ run, userName, role }) => ({
    id: run.id,
    prompt: run.prompt,
    action: run.action,
    args: run.args as JobArgs & { href?: string },
    summary: run.summary,
    createdAt: run.createdAt.toISOString(),
    userName,
    role,
  }));
}
export type RunView = Awaited<ReturnType<typeof recentRuns>>[number];
