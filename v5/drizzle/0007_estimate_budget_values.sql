CREATE TYPE "public"."estimate_status" AS ENUM('draft', 'approved');--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "estimate_status" "estimate_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_items" ADD COLUMN "ob_labor_cents" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_items" ADD COLUMN "ob_material_cents" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_items" ADD COLUMN "ob_equipment_cents" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_items" ADD COLUMN "ob_sub_cents" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_items" ADD COLUMN "cb_labor_cents" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_items" ADD COLUMN "cb_material_cents" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_items" ADD COLUMN "cb_equipment_cents" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_items" ADD COLUMN "cb_sub_cents" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_items" ADD COLUMN "ce_labor_cents" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_items" ADD COLUMN "ce_material_cents" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_items" ADD COLUMN "ce_equipment_cents" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_items" ADD COLUMN "ce_sub_cents" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Back-fill: legacy budget_cents → CE labor plug; existing jobs were already "approved" budgets.
UPDATE "cost_items" SET
  "ce_labor_cents" = "budget_cents",
  "ob_labor_cents" = "budget_cents",
  "cb_labor_cents" = "budget_cents";--> statement-breakpoint
UPDATE "jobs" SET "estimate_status" = 'approved';--> statement-breakpoint
ALTER TABLE "cost_items" DROP COLUMN "budget_cents";
