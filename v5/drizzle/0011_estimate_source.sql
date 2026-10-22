CREATE TYPE "public"."estimate_source" AS ENUM('seed', 'csv');--> statement-breakpoint
DROP INDEX "cost_items_job_code_idx";--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "estimate_source" "estimate_source" DEFAULT 'seed' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "cost_items_job_code_uidx" ON "cost_items" USING btree ("job_id","code");--> statement-breakpoint
CREATE INDEX "cost_items_parent_idx" ON "cost_items" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "daily_plan_lines_item_idx" ON "daily_plan_lines" USING btree ("cost_item_id");--> statement-breakpoint
CREATE INDEX "progress_claim_lines_item_idx" ON "progress_claim_lines" USING btree ("cost_item_id");
--> statement-breakpoint
-- Lump seed jobs put every cent in labor. Any material, equipment, or sub cost means a unit-cost estimate (Harbor).
UPDATE "jobs" SET "estimate_source" = 'csv'
WHERE "estimate_status" = 'draft'
   OR "id" IN (
     SELECT "job_id" FROM "cost_items"
     WHERE "ce_material_cents" <> 0 OR "ce_equipment_cents" <> 0 OR "ce_sub_cents" <> 0
   );
