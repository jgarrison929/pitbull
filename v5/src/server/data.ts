import "server-only";
import { cache } from "react";
import { and, asc, eq } from "drizzle-orm";
import { requireDb } from "@/db";
import {
  costItems,
  dailyPlanLines,
  dailyPlans,
  jobs,
  users,
} from "@/db/schema";
import { costLine, health, rollup } from "@/lib/ev";

// The tenant boundary: every read takes the signed-in user's companyId and filters on it.

/** Cached per request, so the job strip and the page share one read. */
export const getPortfolio = cache(async function getPortfolio(
  companyId: string,
) {
  const db = requireDb();
  const [jobRows, itemRows] = await Promise.all([
    db
      .select()
      .from(jobs)
      .where(eq(jobs.companyId, companyId))
      .orderBy(asc(jobs.number)),
    db
      .select()
      .from(costItems)
      .where(eq(costItems.companyId, companyId))
      .orderBy(asc(costItems.code)),
  ]);
  const portfolio = jobRows.map((job) => {
    const lines = itemRows.filter((i) => i.jobId === job.id).map(costLine);
    const r = rollup(lines);
    return { job, lines, ...r, status: health(Math.min(r.cpi, r.spi)) };
  });
  return {
    jobs: portfolio,
    totals: rollup(portfolio.flatMap((p) => p.lines)),
    contractCents: jobRows.reduce((s, j) => s + j.contractCents, 0),
  };
});

export type PortfolioJob = Awaited<
  ReturnType<typeof getPortfolio>
>["jobs"][number];

export async function getJob(companyId: string, number: string) {
  const { jobs: all } = await getPortfolio(companyId);
  return all.find((j) => j.job.number === number) ?? null;
}

export async function getPlansForJob(companyId: string, jobId: string) {
  const db = requireDb();
  const plans = await db
    .select({ plan: dailyPlans, foreman: users.name })
    .from(dailyPlans)
    .innerJoin(users, eq(users.id, dailyPlans.foremanId))
    .where(
      and(eq(dailyPlans.companyId, companyId), eq(dailyPlans.jobId, jobId)),
    )
    .orderBy(asc(dailyPlans.planDate));
  const lines = plans.length
    ? await db
        .select({ line: dailyPlanLines, item: costItems })
        .from(dailyPlanLines)
        .innerJoin(costItems, eq(costItems.id, dailyPlanLines.costItemId))
        .where(eq(dailyPlanLines.companyId, companyId))
        .orderBy(asc(dailyPlanLines.sort))
    : [];
  return plans.map(({ plan, foreman }) => ({
    ...plan,
    foreman,
    lines: lines
      .filter((l) => l.line.planId === plan.id)
      .map(({ line, item }) => planLine(line, item)),
  }));
}

export type PlanLine = ReturnType<typeof planLine>;
export function planLine(
  line: typeof dailyPlanLines.$inferSelect,
  item: typeof costItems.$inferSelect,
) {
  const manHours = (line.workers * line.hoursTenths) / 10;
  const planned = line.qtyMilli === 0 ? 0 : manHours / (line.qtyMilli / 1000);
  const budget = item.budgetMhPerUnitMilli / 1000;
  return {
    ...line,
    code: item.code,
    description: item.description,
    unit: item.unit,
    manHours,
    plannedRate: planned,
    budgetRate: budget,
    withinRate: budget === 0 || planned <= budget * 1.05,
  };
}
