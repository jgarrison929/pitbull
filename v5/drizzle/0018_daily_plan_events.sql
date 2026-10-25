CREATE TYPE "public"."plan_event_kind" AS ENUM('created', 'submitted', 'reported', 'returned', 'approved');--> statement-breakpoint
CREATE TABLE "daily_plan_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"kind" "plan_event_kind" NOT NULL,
	"actor_role" "role" NOT NULL,
	"actor_id" uuid,
	"detail" text DEFAULT '' NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_plan_events" ADD CONSTRAINT "daily_plan_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_plan_events" ADD CONSTRAINT "daily_plan_events_plan_id_daily_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."daily_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_plan_events" ADD CONSTRAINT "daily_plan_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "daily_plan_events_plan_idx" ON "daily_plan_events" USING btree ("plan_id","at");--> statement-breakpoint
-- Backfill from last-stamp columns. Roles only (no display names). A return-then-approve
-- story loses the first report here; seed rewrite supplies the full append-only list.
INSERT INTO "daily_plan_events" ("company_id", "plan_id", "kind", "actor_role", "actor_id", "detail", "at")
SELECT p."company_id", p."id", 'created'::"plan_event_kind", 'superintendent'::"role", p."created_by_id", '', p."created_at"
FROM "daily_plans" AS p
WHERE p."created_at" IS NOT NULL;--> statement-breakpoint
INSERT INTO "daily_plan_events" ("company_id", "plan_id", "kind", "actor_role", "actor_id", "detail", "at")
SELECT p."company_id", p."id", 'submitted'::"plan_event_kind", 'superintendent'::"role", p."created_by_id", '', p."submitted_at"
FROM "daily_plans" AS p
WHERE p."submitted_at" IS NOT NULL;--> statement-breakpoint
INSERT INTO "daily_plan_events" ("company_id", "plan_id", "kind", "actor_role", "actor_id", "detail", "at")
SELECT p."company_id", p."id", 'reported'::"plan_event_kind", 'foreman'::"role", p."foreman_id", '',
  COALESCE(p."reported_at", p."submitted_at" + interval '1 hour')
FROM "daily_plans" AS p
WHERE p."reported_at" IS NOT NULL
   OR (p."status" IN ('reported', 'approved') AND p."submitted_at" IS NOT NULL);--> statement-breakpoint
INSERT INTO "daily_plan_events" ("company_id", "plan_id", "kind", "actor_role", "actor_id", "detail", "at")
SELECT p."company_id", p."id", 'returned'::"plan_event_kind", 'superintendent'::"role", NULL, COALESCE(p."return_reason", ''), p."returned_at"
FROM "daily_plans" AS p
WHERE p."returned_at" IS NOT NULL AND COALESCE(p."return_reason", '') <> '';--> statement-breakpoint
INSERT INTO "daily_plan_events" ("company_id", "plan_id", "kind", "actor_role", "actor_id", "detail", "at")
SELECT p."company_id", p."id", 'approved'::"plan_event_kind", 'superintendent'::"role", p."approved_by_id", '', p."approved_at"
FROM "daily_plans" AS p
WHERE p."approved_at" IS NOT NULL;
