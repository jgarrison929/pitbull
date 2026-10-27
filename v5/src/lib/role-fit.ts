import { usdShort } from "@/lib/ev";
import { overallStatus } from "@/lib/status";

/** Foreman JobStrip labels for today's plan on a job. */
export type TodayPlanLabel = "Report due" | "Reported" | "No plan today";

const planRank: Record<string, number> = {
  issued: 3,
  reported: 2,
  approved: 2,
  draft: 1,
};

/** Pick one foreman-facing label from today's plan statuses on a job. */
export function todayPlanLabel(
  statuses: Iterable<string>,
): TodayPlanLabel {
  let best: string | null = null;
  let bestRank = 0;
  for (const s of statuses) {
    const r = planRank[s] ?? 0;
    if (r > bestRank) {
      bestRank = r;
      best = s;
    }
  }
  if (best === "issued") return "Report due";
  if (best === "reported" || best === "approved") return "Reported";
  return "No plan today";
}

export function showsCostIndexes(role: string): boolean {
  return role === "pm" || role === "executive";
}

/** Superintendent keeps indexes on the job page only; foreman never. */
export function showsJobPageCostIndexes(role: string): boolean {
  return role !== "foreman";
}

export function showsStatusRiskBadge(role: string): boolean {
  return role !== "foreman";
}

type AtRiskJob = {
  shortName: string;
  number: string;
  cpi: number | null;
  spi: number | null;
  costVarianceCents: number;
  scheduleVarianceCents: number;
};

/**
 * One plain-language line for an at-risk job (executive /app summary).
 * Returns null when the job is not at risk.
 */
export function atRiskSummaryParts(
  job: AtRiskJob,
): { text: string; cents: number } | null {
  const roll = {
    cpi: job.cpi,
    spi: job.spi,
    costVarianceCents: job.costVarianceCents,
    scheduleVarianceCents: job.scheduleVarianceCents,
  };
  if (overallStatus(roll) !== "at-risk") return null;

  const name = `${job.shortName} (${job.number})`;
  // A negative cost variance is the money this line reports. Comparing index
  // ranks let a redder SPI replace that variance with schedule dollars
  // (24-077: watch CPI, at-risk SPI, cost variance still negative).
  if (job.costVarianceCents < 0) {
    const spent = usdShort(Math.abs(job.costVarianceCents));
    return {
      text: `${name} is over cost: it has spent ${spent} more than the work it has done is worth`,
      cents: job.costVarianceCents,
    };
  }
  const behind = usdShort(Math.abs(job.scheduleVarianceCents));
  return {
    text: `${name} is behind schedule: earned value is ${behind} behind what was planned`,
    cents: job.scheduleVarianceCents,
  };
}

export function atRiskSummaryLine(job: AtRiskJob): string | null {
  return atRiskSummaryParts(job)?.text ?? null;
}

