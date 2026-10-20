CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
ALTER TABLE "cost_items" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "cost_items" ADD COLUMN "path" text;--> statement-breakpoint
ALTER TABLE "cost_items" ADD COLUMN "depth" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_items" ADD COLUMN "is_leaf" boolean DEFAULT true NOT NULL;--> statement-breakpoint
UPDATE "cost_items" SET "path" = '/' || "code" || '/' WHERE "path" IS NULL;--> statement-breakpoint
ALTER TABLE "cost_items" ALTER COLUMN "path" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_items" ADD CONSTRAINT "cost_items_parent_id_cost_items_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."cost_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cost_items_job_path_idx" ON "cost_items" USING btree ("job_id","path");--> statement-breakpoint
CREATE INDEX "cost_items_job_parent_idx" ON "cost_items" USING btree ("job_id","parent_id");--> statement-breakpoint
CREATE INDEX "cost_items_job_code_idx" ON "cost_items" USING btree ("job_id","code");--> statement-breakpoint
CREATE INDEX "cost_items_job_leaf_idx" ON "cost_items" USING btree ("job_id","is_leaf");--> statement-breakpoint
CREATE INDEX "cost_items_code_trgm_idx" ON "cost_items" USING gin ("code" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "cost_items_desc_trgm_idx" ON "cost_items" USING gin ("description" gin_trgm_ops);
