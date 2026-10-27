import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { requireDb } from "@/db";
import {
  changeOrderLines,
  changeOrders,
  costItems,
  crews,
  dailyPlans,
  jobs,
  users,
} from "@/db/schema";
import { coLabel } from "@/lib/change-order";
import { usdCents, usdShort } from "@/lib/ev";
import { calendarDateInTz } from "@/lib/plan-date";
import { overallStatus } from "@/lib/status";
import { portfolioRollupsSql } from "@/server/cost-rollups";
import { seedNow } from "@/server/seed-clock";
import type { CurrentUser, Role } from "@/server/session";

export type NextStep = {
  id: string;
  label: string;
  href: string;
};

export type NextStepsResult = {
  items: NextStep[];
  moreCount: number;
  doneMessage: string | null;
};

const MAX_ITEMS = 5;

/** Current Budget total — matches cost-rollups earned math. */
const cbTotalSql = sql`(
  ${costItems.cbLaborCents} + ${costItems.cbMaterialCents}
  + ${costItems.cbEquipmentCents} + ${costItems.cbSubCents}
)`;

const earnedSql = sql`
  case
    when ${costItems.evMethod} = 'units' and ${costItems.budgetQtyMilli} > 0
      then least(
        ${cbTotalSql},
        round(
          (${cbTotalSql}::numeric * ${costItems.claimedInstalledQtyMilli})
            / ${costItems.budgetQtyMilli}
        )::bigint
      )
    else round(
      (${cbTotalSql}::numeric * ${costItems.claimedPercentMilli}) / 1000
    )::bigint
  end`;

function formatDay(iso: string): string {
  return new Date(`${iso}T12:00:00.000Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function plainCostVariance(varianceCents: number): string {
  const spent = usdShort(Math.abs(varianceCents));
  if (varianceCents < 0) {
    return `over cost, it has spent ${spent} more than the work it has done is worth`;
  }
  return `behind schedule on earned vs planned`;
}

/**
 * Role-aware "What needs you today" list. Read-only — no writes, no new tables.
 * One query per item source (plans, COs, draft estimates, leaf CPI, portfolio).
 */
export async function getNextSteps(
  user: CurrentUser,
  asOf = seedNow(),
): Promise<NextStepsResult> {
  const todayIso = calendarDateInTz(asOf);
  const db = requireDb();
  const items: NextStep[] = [];

  if (user.role === "superintendent" || user.role === "foreman") {
    const planRows = await db
      .select({
        id: dailyPlans.id,
        status: dailyPlans.status,
        planDate: dailyPlans.planDate,
        foremanId: dailyPlans.foremanId,
        crew: crews.name,
        jobNumber: jobs.number,
      })
      .from(dailyPlans)
      .innerJoin(jobs, eq(jobs.id, dailyPlans.jobId))
      .innerJoin(crews, eq(crews.id, dailyPlans.crewId))
      .where(
        and(
          eq(dailyPlans.companyId, user.companyId),
          inArray(dailyPlans.status, ["draft", "issued", "reported"]),
        ),
      )
      .orderBy(asc(dailyPlans.planDate), asc(dailyPlans.id));

    if (user.role === "superintendent") {
      for (const p of planRows) {
        if (p.status !== "draft" || p.planDate < todayIso) continue;
        items.push({
          id: `submit-plan-${p.id}`,
          label: `Submit tomorrow's plan: ${p.crew} on ${p.jobNumber}`,
          href: `/app/jobs/${p.jobNumber}#plan-${p.id}`,
        });
      }
      for (const p of planRows) {
        if (p.status !== "reported") continue;
        items.push({
          id: `approve-report-${p.id}`,
          label: `Approve 1 daily report: ${p.crew} on ${p.jobNumber}`,
          href: `/app/jobs/${p.jobNumber}#plan-${p.id}`,
        });
      }
    } else {
      for (const p of planRows) {
        if (p.status !== "issued" || p.foremanId !== user.userId) continue;
        items.push({
          id: `report-${p.id}`,
          label: `Report today's quantities for ${p.crew} (${p.jobNumber})`,
          href: `/app/jobs/${p.jobNumber}#plan-${p.id}`,
        });
      }
      for (const p of planRows) {
        if (
          p.status !== "draft" ||
          p.foremanId !== user.userId ||
          p.planDate < todayIso
        ) {
          continue;
        }
        items.push({
          id: `submit-plan-${p.id}`,
          label: `Submit tomorrow's plan: ${p.crew} on ${p.jobNumber}`,
          href: `/app/jobs/${p.jobNumber}#plan-${p.id}`,
        });
      }
    }
  }

  if (user.role === "pm" || user.role === "executive") {
    const priced = await db
      .select({
        number: changeOrders.number,
        jobNumber: jobs.number,
        totalCents: sql<number>`coalesce(sum(
          ${changeOrderLines.laborCents} + ${changeOrderLines.materialCents}
          + ${changeOrderLines.equipmentCents} + ${changeOrderLines.subCents}
        ), 0)`.mapWith(Number),
      })
      .from(changeOrders)
      .innerJoin(jobs, eq(jobs.id, changeOrders.jobId))
      .leftJoin(
        changeOrderLines,
        eq(changeOrderLines.changeOrderId, changeOrders.id),
      )
      .where(
        and(
          eq(changeOrders.companyId, user.companyId),
          eq(changeOrders.status, "priced"),
        ),
      )
      .groupBy(changeOrders.id, changeOrders.number, jobs.number)
      .orderBy(asc(changeOrders.number));

    if (user.role === "pm") {
      for (const co of priced) {
        const label = coLabel(co.number);
        items.push({
          id: `approve-co-${co.number}`,
          label: `Approve ${label} on ${co.jobNumber}: ${usdCents(co.totalCents)}`,
          href: `/app/jobs/${co.jobNumber}#co-${label}`,
        });
      }

      const draftJobs = await db
        .select({
          number: jobs.number,
          name: jobs.name,
          shortName: jobs.shortName,
        })
        .from(jobs)
        .where(
          and(
            eq(jobs.companyId, user.companyId),
            eq(jobs.estimateStatus, "draft"),
          ),
        )
        .orderBy(asc(jobs.number));
      for (const j of draftJobs) {
        items.push({
          id: `approve-estimate-${j.number}`,
          label: `Approve the estimate for ${j.shortName} (${j.number})`,
          href: `/app/jobs/${j.number}#estimate`,
        });
      }

      const leaf = await lowestCpiLeaf(user.companyId);
      if (leaf) {
        items.push({
          id: `review-forecast-${leaf.code}-${leaf.jobNumber}`,
          label: `Review the forecast on ${leaf.code} (${leaf.jobNumber}): spending more than it earns`,
          href: `/app/jobs/${leaf.jobNumber}/cost-items/${leaf.code}`,
        });
      }
    } else {
      const portfolio = await atRiskJobs(user.companyId, asOf);
      for (const j of portfolio) {
        items.push({
          id: `open-job-${j.number}`,
          label: `Open ${j.shortName} (${j.number}): ${plainCostVariance(j.costVarianceCents)}`,
          href: `/app/jobs/${j.number}`,
        });
      }
      for (const co of priced) {
        const label = coLabel(co.number);
        items.push({
          id: `decide-co-${co.number}`,
          label: `Decide ${label} on ${co.jobNumber}: ${usdCents(co.totalCents)}`,
          href: `/app/jobs/${co.jobNumber}#co-${label}`,
        });
      }
    }
  }

  const visible = items.slice(0, MAX_ITEMS);
  const moreCount = Math.max(0, items.length - MAX_ITEMS);
  const doneMessage =
    visible.length === 0
      ? await doneMessageFor(user, todayIso)
      : null;

  return { items: visible, moreCount, doneMessage };
}

async function lowestCpiLeaf(companyId: string) {
  const db = requireDb();
  const rows = await db.execute<{
    code: string;
    job_number: string;
    cpi: number;
  }>(sql`
    select
      ${costItems.code} as code,
      ${jobs.number} as job_number,
      (${earnedSql})::float8 / nullif(${costItems.lockedActualCents}, 0)::float8 as cpi
    from ${costItems}
    inner join ${jobs} on ${jobs.id} = ${costItems.jobId}
    where ${costItems.companyId} = ${companyId}
      and ${costItems.isLeaf} = true
      and ${jobs.estimateStatus} = 'approved'
      and ${costItems.lockedActualCents} > 0
      and (${cbTotalSql}) > 0
      and (${earnedSql})::float8 / ${costItems.lockedActualCents}::float8 < 1
    order by cpi asc, ${jobs.number} asc, ${costItems.code} asc
    limit 1`);
  const row = rows[0];
  if (!row) return null;
  return { code: row.code, jobNumber: row.job_number, cpi: row.cpi };
}

async function atRiskJobs(companyId: string, asOf: Date) {
  const db = requireDb();
  const jobRows = await db
    .select()
    .from(jobs)
    .where(
      and(eq(jobs.companyId, companyId), eq(jobs.estimateStatus, "approved")),
    )
    .orderBy(asc(jobs.number));
  const sums = await portfolioRollupsSql(companyId, asOf);
  const byJob = new Map(sums.map((s) => [s.job_id, s]));
  const out: {
    number: string;
    shortName: string;
    costVarianceCents: number;
  }[] = [];
  for (const job of jobRows) {
    const s = byJob.get(job.id);
    const earned = Number(s?.earned_cents ?? 0);
    const actual = Number(s?.actual_cents ?? 0);
    const planned = Number(s?.planned_cents ?? 0);
    const budget = Number(s?.budget_cents ?? 0);
    const costVarianceCents = earned - actual;
    const scheduleVarianceCents = earned - planned;
    const cpi = budget === 0 || actual === 0 ? null : earned / actual;
    const spi = budget === 0 || planned === 0 ? null : earned / planned;
    if (
      overallStatus({
        cpi,
        spi,
        costVarianceCents,
        scheduleVarianceCents,
      }) !== "at-risk"
    ) {
      continue;
    }
    out.push({
      number: job.number,
      shortName: job.shortName,
      costVarianceCents,
    });
  }
  return out;
}

async function doneMessageFor(
  user: CurrentUser,
  todayIso: string,
): Promise<string> {
  const day = formatDay(todayIso);
  const db = requireDb();
  const [superintendent] = await db
    .select({ name: users.name })
    .from(users)
    .where(
      and(eq(users.companyId, user.companyId), eq(users.role, "superintendent")),
    )
    .limit(1);
  const approver = superintendent?.name ?? "the superintendent";

  switch (user.role as Role) {
    case "foreman":
      return `Today's report on 24-077 is submitted and tomorrow's plan on 25-031 is issued. ${approver} approves the report next. (${day})`;
    case "superintendent":
      return `No draft plans or reported crew days need you on ${day}.`;
    case "pm":
      return `No priced change orders, draft estimates, or low-CPI forecasts need you on ${day}.`;
    case "executive":
      return `No at-risk jobs or priced change orders need a decision on ${day}.`;
    default:
      return `Nothing needs you on ${day}.`;
  }
}
