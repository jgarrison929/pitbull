CREATE TYPE "public"."claim_status" AS ENUM('draft', 'locked');--> statement-breakpoint
CREATE TYPE "public"."cost_entry_kind" AS ENUM('labor', 'other');--> statement-breakpoint
CREATE TYPE "public"."ev_method" AS ENUM('units', 'milestones', 'pm_percent');--> statement-breakpoint
CREATE TABLE "cost_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"cost_item_id" uuid NOT NULL,
	"kind" "cost_entry_kind" NOT NULL,
	"hours_tenths" integer,
	"rate_cents" integer,
	"amount_cents" bigint NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"source_plan_line_id" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_item_milestones" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"cost_item_id" uuid NOT NULL,
	"name" text NOT NULL,
	"weight_milli" bigint NOT NULL,
	"complete" boolean DEFAULT false NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pm_percent_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"cost_item_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"percent_milli" bigint NOT NULL,
	"reason" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "progress_claim_lines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL,
	"cost_item_id" uuid NOT NULL,
	"claimed_percent_milli" bigint NOT NULL,
	"installed_qty_milli" bigint NOT NULL,
	"derivation" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "progress_claims" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"period_label" text NOT NULL,
	"status" "claim_status" DEFAULT 'draft' NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by_id" uuid
);
--> statement-breakpoint
ALTER TABLE "cost_items" ADD COLUMN "ev_method" "ev_method" DEFAULT 'units' NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_items" ADD COLUMN "planned_start_on" date;--> statement-breakpoint
ALTER TABLE "cost_items" ADD COLUMN "planned_finish_on" date;--> statement-breakpoint
UPDATE "cost_items" SET "planned_start_on" = CURRENT_DATE - 90, "planned_finish_on" = CURRENT_DATE + 90 WHERE "planned_start_on" IS NULL;--> statement-breakpoint
ALTER TABLE "cost_items" ALTER COLUMN "planned_start_on" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_items" ALTER COLUMN "planned_finish_on" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_items" ADD COLUMN "claimed_percent_milli" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_items" ADD COLUMN "earn_derivation" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_entries" ADD CONSTRAINT "cost_entries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_entries" ADD CONSTRAINT "cost_entries_cost_item_id_cost_items_id_fk" FOREIGN KEY ("cost_item_id") REFERENCES "public"."cost_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_item_milestones" ADD CONSTRAINT "cost_item_milestones_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_item_milestones" ADD CONSTRAINT "cost_item_milestones_cost_item_id_cost_items_id_fk" FOREIGN KEY ("cost_item_id") REFERENCES "public"."cost_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm_percent_logs" ADD CONSTRAINT "pm_percent_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm_percent_logs" ADD CONSTRAINT "pm_percent_logs_cost_item_id_cost_items_id_fk" FOREIGN KEY ("cost_item_id") REFERENCES "public"."cost_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm_percent_logs" ADD CONSTRAINT "pm_percent_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_claim_lines" ADD CONSTRAINT "progress_claim_lines_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_claim_lines" ADD CONSTRAINT "progress_claim_lines_claim_id_progress_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."progress_claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_claim_lines" ADD CONSTRAINT "progress_claim_lines_cost_item_id_cost_items_id_fk" FOREIGN KEY ("cost_item_id") REFERENCES "public"."cost_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_claims" ADD CONSTRAINT "progress_claims_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_claims" ADD CONSTRAINT "progress_claims_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_claims" ADD CONSTRAINT "progress_claims_locked_by_id_users_id_fk" FOREIGN KEY ("locked_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cost_entries_item_idx" ON "cost_entries" USING btree ("cost_item_id");--> statement-breakpoint
CREATE INDEX "cost_item_milestones_item_idx" ON "cost_item_milestones" USING btree ("cost_item_id");--> statement-breakpoint
CREATE INDEX "pm_percent_logs_item_idx" ON "pm_percent_logs" USING btree ("cost_item_id","at");--> statement-breakpoint
CREATE INDEX "progress_claim_lines_claim_idx" ON "progress_claim_lines" USING btree ("claim_id");--> statement-breakpoint
CREATE INDEX "progress_claims_job_idx" ON "progress_claims" USING btree ("job_id");