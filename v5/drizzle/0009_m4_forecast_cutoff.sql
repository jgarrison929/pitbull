CREATE TYPE "public"."forecast_method" AS ENUM('current_budget', 'average_performance');--> statement-breakpoint
ALTER TABLE "cost_items" ADD COLUMN "forecast_method" "forecast_method" DEFAULT 'current_budget' NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_items" ADD COLUMN "locked_actual_cents" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Existing locked claims already drove EV from claimed_*; freeze AC to match until the next lock.
UPDATE "cost_items" SET "locked_actual_cents" = "actual_cents"
WHERE "claimed_percent_milli" > 0 OR "claimed_installed_qty_milli" > 0;