CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"duration_days" integer NOT NULL,
	"start_no_earlier_on" date,
	"early_start_on" date NOT NULL,
	"early_finish_on" date NOT NULL,
	"late_start_on" date NOT NULL,
	"late_finish_on" date NOT NULL,
	"total_float_days" integer DEFAULT 0 NOT NULL,
	"is_critical" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "activities_duration_days_ck" CHECK ("activities"."duration_days" >= 1 and "activities"."duration_days" <= 3650)
);
--> statement-breakpoint
CREATE TABLE "activity_cost_items" (
	"activity_id" uuid NOT NULL,
	"cost_item_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	CONSTRAINT "activity_cost_items_activity_id_cost_item_id_pk" PRIMARY KEY("activity_id","cost_item_id")
);
--> statement-breakpoint
CREATE TABLE "calendar_holidays" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"calendar_id" uuid NOT NULL,
	"on" date NOT NULL,
	"name" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_calendars" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"name" text NOT NULL,
	"workdays_mask" integer DEFAULT 31 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_cost_items" ADD CONSTRAINT "activity_cost_items_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_cost_items" ADD CONSTRAINT "activity_cost_items_cost_item_id_cost_items_id_fk" FOREIGN KEY ("cost_item_id") REFERENCES "public"."cost_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_cost_items" ADD CONSTRAINT "activity_cost_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_holidays" ADD CONSTRAINT "calendar_holidays_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_holidays" ADD CONSTRAINT "calendar_holidays_calendar_id_job_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."job_calendars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_calendars" ADD CONSTRAINT "job_calendars_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_calendars" ADD CONSTRAINT "job_calendars_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activities_job_code_uidx" ON "activities" USING btree ("job_id","code");--> statement-breakpoint
CREATE INDEX "activities_job_idx" ON "activities" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "activity_cost_items_item_idx" ON "activity_cost_items" USING btree ("cost_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_holidays_day_uidx" ON "calendar_holidays" USING btree ("calendar_id","on");--> statement-breakpoint
CREATE UNIQUE INDEX "job_calendars_job_uidx" ON "job_calendars" USING btree ("job_id");