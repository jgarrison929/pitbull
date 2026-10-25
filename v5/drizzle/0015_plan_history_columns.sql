ALTER TABLE "daily_plans" ADD COLUMN "created_by_id" uuid;--> statement-breakpoint
ALTER TABLE "daily_plans" ADD COLUMN "reported_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "daily_plans" ADD CONSTRAINT "daily_plans_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;