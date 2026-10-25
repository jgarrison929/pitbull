CREATE TABLE "crews" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"foreman_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crews" ADD CONSTRAINT "crews_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crews" ADD CONSTRAINT "crews_foreman_id_users_id_fk" FOREIGN KEY ("foreman_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "crews_company_name_uidx" ON "crews" USING btree ("company_id","name");--> statement-breakpoint
ALTER TABLE "daily_plans" ALTER COLUMN "weather" SET DEFAULT '';--> statement-breakpoint
-- Nullable on purpose: pre-0013 builds insert without crew_id. A later contract
-- migration sets NOT NULL and drops the text "crew" column once every writer
-- dual-writes crew_id.
ALTER TABLE "daily_plans" ADD COLUMN "crew_id" uuid;--> statement-breakpoint
-- Newest-plan tie-break for dedupe (and for app preferPlanKeep). Existing rows
-- get now(); new inserts use the column default.
ALTER TABLE "daily_plans" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
-- One crew per (company_id, name). When a name had multiple foremen, take the
-- foreman from the most recent plan (plan_date desc, id desc).
INSERT INTO "crews" ("id", "company_id", "name", "foreman_id")
SELECT gen_random_uuid(), d."company_id", d."crew", d."foreman_id"
FROM (
	SELECT DISTINCT ON ("company_id", "crew")
		"company_id",
		"crew",
		"foreman_id"
	FROM "daily_plans"
	ORDER BY "company_id", "crew", "plan_date" DESC, "id" DESC
) AS d;--> statement-breakpoint
UPDATE "daily_plans" AS p
SET "crew_id" = c."id"
FROM "crews" AS c
WHERE c."company_id" = p."company_id"
  AND c."name" = p."crew";--> statement-breakpoint
ALTER TABLE "daily_plans" ADD CONSTRAINT "daily_plans_crew_id_crews_id_fk" FOREIGN KEY ("crew_id") REFERENCES "public"."crews"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
-- Spec: one plan per job + crew + date. Keep issued (and later states) over
-- draft, then newest by submitted_at / created_at — id only as last resort.
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
CREATE UNIQUE INDEX "daily_plans_job_crew_date_uidx" ON "daily_plans" USING btree ("job_id","crew_id","plan_date");
-- Expand-only: keep "daily_plans"."crew" and leave "crew_id" nullable so a
-- pre-0013 build can still INSERT. Later contract migration: create missing
-- crews, fill null crew_id, dedupe, SET NOT NULL, DROP crew.
