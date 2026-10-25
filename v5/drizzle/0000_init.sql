CREATE TYPE "public"."plan_status" AS ENUM('draft', 'submitted');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('executive', 'pm', 'superintendent', 'foreman');--> statement-breakpoint
CREATE TABLE "action_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"prompt" text NOT NULL,
	"action" text NOT NULL,
	"args" jsonb NOT NULL,
	"summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_sandbox" boolean DEFAULT true NOT NULL,
	"seeded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cost_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"code" text NOT NULL,
	"description" text NOT NULL,
	"unit" text NOT NULL,
	"budget_qty_milli" bigint NOT NULL,
	"installed_qty_milli" bigint NOT NULL,
	"budget_cents" bigint NOT NULL,
	"planned_cents" bigint NOT NULL,
	"actual_cents" bigint NOT NULL,
	"budget_mh_per_unit_milli" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_plan_lines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"cost_item_id" uuid NOT NULL,
	"activity" text NOT NULL,
	"location" text NOT NULL,
	"qty_milli" bigint NOT NULL,
	"workers" integer NOT NULL,
	"hours_tenths" integer NOT NULL,
	"sort" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_plans" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"crew" text NOT NULL,
	"foreman_id" uuid NOT NULL,
	"plan_date" date NOT NULL,
	"status" "plan_status" DEFAULT 'draft' NOT NULL,
	"weather" text NOT NULL,
	"equipment" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"submitted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"number" text NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"owner" text NOT NULL,
	"pm_name" text NOT NULL,
	"finish_on" date NOT NULL,
	"contract_cents" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"title" text NOT NULL,
	"role" "role" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "action_runs" ADD CONSTRAINT "action_runs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_runs" ADD CONSTRAINT "action_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_items" ADD CONSTRAINT "cost_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_items" ADD CONSTRAINT "cost_items_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_plan_lines" ADD CONSTRAINT "daily_plan_lines_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_plan_lines" ADD CONSTRAINT "daily_plan_lines_plan_id_daily_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."daily_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_plan_lines" ADD CONSTRAINT "daily_plan_lines_cost_item_id_cost_items_id_fk" FOREIGN KEY ("cost_item_id") REFERENCES "public"."cost_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_plans" ADD CONSTRAINT "daily_plans_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_plans" ADD CONSTRAINT "daily_plans_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_plans" ADD CONSTRAINT "daily_plans_foreman_id_users_id_fk" FOREIGN KEY ("foreman_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_runs_company_idx" ON "action_runs" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "cost_items_job_idx" ON "cost_items" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "daily_plan_lines_plan_idx" ON "daily_plan_lines" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "daily_plans_company_idx" ON "daily_plans" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "jobs_company_idx" ON "jobs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "sessions_company_idx" ON "sessions" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "users_company_idx" ON "users" USING btree ("company_id");