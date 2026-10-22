ALTER TABLE "daily_plans" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "daily_plans" ALTER COLUMN "status" SET DEFAULT 'draft'::text;--> statement-breakpoint
UPDATE "daily_plans" SET "status" = 'issued' WHERE "status" = 'submitted';--> statement-breakpoint
DROP TYPE "public"."plan_status";--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('draft', 'issued', 'reported', 'approved');--> statement-breakpoint
ALTER TABLE "daily_plans" ALTER COLUMN "status" SET DEFAULT 'draft'::"public"."plan_status";--> statement-breakpoint
ALTER TABLE "daily_plans" ALTER COLUMN "status" SET DATA TYPE "public"."plan_status" USING "status"::"public"."plan_status";--> statement-breakpoint
ALTER TABLE "daily_plan_lines" ADD COLUMN "reported_qty_milli" bigint;--> statement-breakpoint
ALTER TABLE "daily_plan_lines" ADD COLUMN "reported_hours_tenths" integer;--> statement-breakpoint
ALTER TABLE "daily_plans" ADD COLUMN "return_reason" text;--> statement-breakpoint
ALTER TABLE "daily_plans" ADD COLUMN "returned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "daily_plans" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "daily_plans" ADD COLUMN "approved_by_id" uuid;--> statement-breakpoint
ALTER TABLE "daily_plans" ADD CONSTRAINT "daily_plans_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
