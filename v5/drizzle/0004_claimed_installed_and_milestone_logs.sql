CREATE TABLE "milestone_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"milestone_id" uuid NOT NULL,
	"cost_item_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"complete" boolean NOT NULL,
	"reason" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cost_items" ADD COLUMN "claimed_installed_qty_milli" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "milestone_logs" ADD CONSTRAINT "milestone_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_logs" ADD CONSTRAINT "milestone_logs_milestone_id_cost_item_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."cost_item_milestones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_logs" ADD CONSTRAINT "milestone_logs_cost_item_id_cost_items_id_fk" FOREIGN KEY ("cost_item_id") REFERENCES "public"."cost_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_logs" ADD CONSTRAINT "milestone_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "milestone_logs_item_idx" ON "milestone_logs" USING btree ("cost_item_id","at");