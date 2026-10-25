-- Drop unused average_performance forecast method (never selectable in UI).
ALTER TABLE "cost_items" ALTER COLUMN "forecast_method" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "cost_items" ALTER COLUMN "forecast_method" SET DEFAULT 'current_budget'::text;--> statement-breakpoint
UPDATE "cost_items" SET "forecast_method" = 'current_budget' WHERE "forecast_method" <> 'current_budget';--> statement-breakpoint
DROP TYPE "public"."forecast_method";--> statement-breakpoint
CREATE TYPE "public"."forecast_method" AS ENUM('current_budget');--> statement-breakpoint
ALTER TABLE "cost_items" ALTER COLUMN "forecast_method" SET DEFAULT 'current_budget'::"public"."forecast_method";--> statement-breakpoint
ALTER TABLE "cost_items" ALTER COLUMN "forecast_method" SET DATA TYPE "public"."forecast_method" USING "forecast_method"::"public"."forecast_method";
