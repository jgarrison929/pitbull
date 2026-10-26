-- 5.0.3 Part F: crews contract. Backfill first so staging/prod rows with
-- null crew_id (pre-0013 / dual-write window) survive, then SET NOT NULL and
-- drop the legacy text column. Unique index is dropped only for the fill/
-- dedupe window and recreated on (job_id, crew_id, plan_date).
DROP INDEX IF EXISTS "daily_plans_job_crew_date_uidx";--> statement-breakpoint
-- Create crews for distinct (company, text crew) on null-crew_id plans that
-- are not already in crews. Foreman from the most recent such plan.
INSERT INTO "crews" ("id", "company_id", "name", "foreman_id")
SELECT gen_random_uuid(), d."company_id", d."crew", d."foreman_id"
FROM (
	SELECT DISTINCT ON ("company_id", "crew")
		"company_id",
		"crew",
		"foreman_id"
	FROM "daily_plans"
	WHERE "crew_id" IS NULL
	ORDER BY "company_id", "crew", "plan_date" DESC, "id" DESC
) AS d
WHERE NOT EXISTS (
	SELECT 1 FROM "crews" AS c
	WHERE c."company_id" = d."company_id"
	  AND c."name" = d."crew"
);--> statement-breakpoint
UPDATE "daily_plans" AS p
SET "crew_id" = c."id"
FROM "crews" AS c
WHERE p."crew_id" IS NULL
  AND c."company_id" = p."company_id"
  AND c."name" = p."crew";--> statement-breakpoint
-- Same keep rule as 0013: issued (and later) over draft, then newest.
WITH ranked AS (
	SELECT
		"id",
		FIRST_VALUE("id") OVER (
			PARTITION BY "job_id", "crew_id", "plan_date"
			ORDER BY
				CASE "status"
					WHEN 'approved' THEN 4
					WHEN 'reported' THEN 3
					WHEN 'issued' THEN 2
					WHEN 'draft' THEN 1
					ELSE 0
				END DESC,
				"plan_date" DESC,
				"submitted_at" DESC NULLS LAST,
				"created_at" DESC,
				"id" DESC
		) AS keep_id
	FROM "daily_plans"
	WHERE "crew_id" IS NOT NULL
),
dupes AS (
	SELECT "id", keep_id FROM ranked WHERE "id" <> keep_id
)
UPDATE "daily_plan_lines" AS l
SET "plan_id" = d.keep_id
FROM dupes AS d
WHERE l."plan_id" = d."id";--> statement-breakpoint
WITH ranked AS (
	SELECT
		"id",
		FIRST_VALUE("id") OVER (
			PARTITION BY "job_id", "crew_id", "plan_date"
			ORDER BY
				CASE "status"
					WHEN 'approved' THEN 4
					WHEN 'reported' THEN 3
					WHEN 'issued' THEN 2
					WHEN 'draft' THEN 1
					ELSE 0
				END DESC,
				"plan_date" DESC,
				"submitted_at" DESC NULLS LAST,
				"created_at" DESC,
				"id" DESC
		) AS keep_id
	FROM "daily_plans"
	WHERE "crew_id" IS NOT NULL
)
DELETE FROM "daily_plans" AS p
USING ranked AS r
WHERE p."id" = r."id" AND r."id" <> r.keep_id;--> statement-breakpoint
DO $$
DECLARE
	null_count integer;
	sample_ids text;
BEGIN
	SELECT count(*)::integer INTO null_count
	FROM "daily_plans"
	WHERE "crew_id" IS NULL;
	IF null_count > 0 THEN
		SELECT string_agg(id::text, ', ' ORDER BY id::text)
		INTO sample_ids
		FROM (
			SELECT "id" FROM "daily_plans"
			WHERE "crew_id" IS NULL
			ORDER BY "id"
			LIMIT 5
		) AS t;
		RAISE EXCEPTION
			'crews contract: % daily_plans row(s) still have null crew_id (sample: %)',
			null_count,
			sample_ids;
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "daily_plans" ALTER COLUMN "crew_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_plans" DROP COLUMN "crew";--> statement-breakpoint
CREATE UNIQUE INDEX "daily_plans_job_crew_date_uidx" ON "daily_plans" USING btree ("job_id","crew_id","plan_date");
