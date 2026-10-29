import "server-only";

import { sql } from "drizzle-orm";
import { requireDb } from "@/db";
import { CO_COMMANDS } from "@/lib/change-order";

/**
 * Action names with `writes: true` in assistant/actions — kept as a static list
 * so the job page can load the change feed without importing the full action
 * table (TTFB). Sync-tested against `actions` in job-changes.test.ts.
 */
export const WRITE_ACTIONS = [
  "dailyPlan.create",
  "dailyPlan.addLine",
  "dailyPlan.removeLine",
  "dailyPlan.updateLine",
  "dailyPlan.submit",
  "dailyPlan.approve",
  "dailyPlan.return",
  "dailyReport.post",
  "progressClaim.lock",
  "estimate.importCsv",
  "estimate.approve",
  "costItem.setPmPercent",
  "costItem.setMilestone",
  "costItem.setForecastMethod",
  ...CO_COMMANDS.map((c) => `changeOrder.${c}` as const),
] as const;

export type JobChangeRow = {
  id: string;
  action: string;
  summary: string;
  createdAt: string;
  userName: string;
  role: string;
  planId: string | null;
};

export type JobChangesOptions = {
  /**
   * Foreman feed. Drops summaries that carry CPI, SPI, "At risk", or a dollar
   * delta — the same test as the job page (`/\bCPI\b|\bSPI\b|At risk|[−-]\$\d/`).
   * Postgres word boundaries are `\m` / `\M`.
   */
  excludeCostLanguage?: boolean;
};

/**
 * Postgres form of the foreman cost-language ban.
 * JS: /\bCPI\b|\bSPI\b|At risk|[−-]\$\d/
 */
const COST_LANGUAGE_PATTERN = String.raw`(\mCPI\M|\mSPI\M|At risk|[−-]\$[0-9])`;

type RawChange = {
  id: string;
  action: string;
  summary: string;
  created_at: Date | string;
  plan_id: string | null;
  user_name: string;
  role: string;
};

function mapRow(row: RawChange): JobChangeRow {
  const created =
    row.created_at instanceof Date
      ? row.created_at
      : new Date(row.created_at);
  return {
    id: row.id,
    action: row.action,
    summary: row.summary,
    createdAt: created.toISOString(),
    userName: row.user_name,
    role: row.role,
    planId: row.plan_id && row.plan_id.length > 0 ? row.plan_id : null,
  };
}

/**
 * One job's write feed, newest first, with a same plan+day re-report collapsed
 * to the latest post (same rule as `collapseSamePlanReports`).
 *
 * The window runs only over rows the `(company_id, args->>'job', created_at)`
 * index can reach. The page then takes `limit`/`offset` — it does not ship
 * the whole feed to Node.
 */
function collapsedFeed(
  companyId: string,
  jobNumber: string,
  options: JobChangesOptions | undefined,
) {
  const actions = sql.join(
    WRITE_ACTIONS.map((name) => sql`${name}`),
    sql`, `,
  );
  const costBan = options?.excludeCostLanguage
    ? sql`and summary !~ ${COST_LANGUAGE_PATTERN}`
    : sql``;
  return sql`
    with filtered as (
      select
        ar.id,
        ar.action,
        ar.summary,
        ar.created_at,
        ar.args->>'planId' as plan_id,
        u.name as user_name,
        u.role as role
      from action_runs ar
      inner join users u on u.id = ar.user_id
      where ar.company_id = ${companyId}
        and ar.args->>'job' = ${jobNumber}
        and ar.action in (${actions})
        ${costBan}
    ),
    collapsed as (
      select * from (
        select
          filtered.*,
          row_number() over (
            partition by case
              when action = 'dailyReport.post'
               and coalesce(plan_id, '') <> ''
               and substring(summary from '^Reported .+ for ([^:]+):') is not null
              then plan_id || '|' || substring(summary from '^Reported .+ for ([^:]+):')
              else id::text
            end
            order by created_at desc
          ) as rn
        from filtered
      ) numbered
      where rn = 1
    )
  `;
}

/** The audit trail for one job: writes in this sandbox, newest first. */
export async function jobChanges(
  companyId: string,
  jobNumber: string,
  limit = 20,
  offset = 0,
  options?: JobChangesOptions,
) {
  const take = Math.max(0, Math.floor(limit));
  const skip = Math.max(0, Math.floor(offset));
  const result = await requireDb().execute(sql`
    ${collapsedFeed(companyId, jobNumber, options)}
    select id, action, summary, created_at, plan_id, user_name, role
    from collapsed
    order by created_at desc
    limit ${take}
    offset ${skip}
  `);
  return [...result].map((row) => mapRow(row as RawChange));
}

/** How many change rows are shown after same plan+day reports collapse. */
export async function jobChangesCount(
  companyId: string,
  jobNumber: string,
  options?: JobChangesOptions,
) {
  const result = await requireDb().execute(sql`
    ${collapsedFeed(companyId, jobNumber, options)}
    select count(*)::int as n from collapsed
  `);
  const row = [...result][0] as { n?: number | string } | undefined;
  return Number(row?.n ?? 0);
}
