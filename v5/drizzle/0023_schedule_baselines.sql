CREATE TABLE "baseline_activities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"baseline_id" uuid NOT NULL,
	"activity_id" uuid NOT NULL,
	"start_on" date NOT NULL,
	"finish_on" date NOT NULL,
	"duration_days" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_baselines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"name" text NOT NULL,
	"reason" text NOT NULL,
	"set_at" timestamp with time zone DEFAULT now() NOT NULL,
	"set_by_id" uuid
);
--> statement-breakpoint
ALTER TABLE "baseline_activities" ADD CONSTRAINT "baseline_activities_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseline_activities" ADD CONSTRAINT "baseline_activities_baseline_id_schedule_baselines_id_fk" FOREIGN KEY ("baseline_id") REFERENCES "public"."schedule_baselines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseline_activities" ADD CONSTRAINT "baseline_activities_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_baselines" ADD CONSTRAINT "schedule_baselines_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_baselines" ADD CONSTRAINT "schedule_baselines_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_baselines" ADD CONSTRAINT "schedule_baselines_set_by_id_users_id_fk" FOREIGN KEY ("set_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "baseline_activities_pair_uidx" ON "baseline_activities" USING btree ("baseline_id","activity_id");--> statement-breakpoint
CREATE INDEX "schedule_baselines_job_idx" ON "schedule_baselines" USING btree ("job_id","set_at");