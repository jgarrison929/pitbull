ALTER TABLE "cost_entries" ADD COLUMN "locked_in_at" timestamp with time zone;--> statement-breakpoint
-- Upgrade path: after ADD COLUMN every row is null. Stamp the oldest entries
-- per cost item until their amounts cover locked_actual_cents — the same set
-- lockProgressClaim would have stamped when the claim froze. Newer rows that
-- make up live actual − locked actual stay null (pending). Do not compare
-- plan/calendar dates, and do not require live actual to still equal the
-- frozen lock snapshot (that leaves every row unstamped once anything posts
-- after the lock).
WITH locks AS (
  SELECT DISTINCT ON (job_id) job_id, locked_at
  FROM "progress_claims"
  WHERE status = 'locked' AND locked_at IS NOT NULL
  ORDER BY job_id, locked_at DESC
),
ranked AS (
  SELECT
    ce.id,
    ce.amount_cents,
    ci.locked_actual_cents,
    locks.locked_at,
    SUM(ce.amount_cents) OVER (
      PARTITION BY ce.cost_item_id
      ORDER BY ce.at ASC, ce.id ASC
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS cum_from_oldest
  FROM "cost_entries" AS ce
  INNER JOIN "cost_items" AS ci
    ON ci.id = ce.cost_item_id AND ci.company_id = ce.company_id
  INNER JOIN locks ON locks.job_id = ci.job_id
  WHERE ce.locked_in_at IS NULL
)
UPDATE "cost_entries" AS ce
SET "locked_in_at" = ranked.locked_at
FROM ranked
WHERE ce.id = ranked.id
  AND ranked.cum_from_oldest - ranked.amount_cents < ranked.locked_actual_cents;
