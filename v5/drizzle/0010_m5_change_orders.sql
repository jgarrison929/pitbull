CREATE TYPE "public"."co_command" AS ENUM('create', 'price', 'approve', 'reject', 'void');--> statement-breakpoint
CREATE TYPE "public"."co_status" AS ENUM('draft', 'priced', 'approved', 'rejected', 'voided');--> statement-breakpoint
CREATE TABLE "change_order_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"change_order_id" uuid NOT NULL,
	"command" "co_command" NOT NULL,
	"from_status" "co_status",
	"to_status" "co_status" NOT NULL,
	"revision" integer NOT NULL,
	"actor_id" uuid,
	"actor_role" "role" NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"total_cents" bigint NOT NULL,
	"cb_delta_cents" bigint,
	"eac_delta_cents" bigint,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_order_lines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"change_order_id" uuid NOT NULL,
	"sort" integer NOT NULL,
	"cost_item_id" uuid,
	"new_code" text,
	"new_description" text,
	"new_unit" text,
	"new_parent_id" uuid,
	"labor_cents" bigint DEFAULT 0 NOT NULL,
	"material_cents" bigint DEFAULT 0 NOT NULL,
	"equipment_cents" bigint DEFAULT 0 NOT NULL,
	"sub_cents" bigint DEFAULT 0 NOT NULL,
	"qty_delta_milli" bigint DEFAULT 0 NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	CONSTRAINT "change_order_lines_target_ck" CHECK ("change_order_lines"."cost_item_id" is not null or ("change_order_lines"."new_code" is not null and "change_order_lines"."new_description" is not null and "change_order_lines"."new_unit" is not null))
);
--> statement-breakpoint
CREATE TABLE "change_orders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"status" "co_status" DEFAULT 'draft' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "change_order_events" ADD CONSTRAINT "change_order_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_order_events" ADD CONSTRAINT "change_order_events_change_order_id_change_orders_id_fk" FOREIGN KEY ("change_order_id") REFERENCES "public"."change_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_order_events" ADD CONSTRAINT "change_order_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_order_lines" ADD CONSTRAINT "change_order_lines_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_order_lines" ADD CONSTRAINT "change_order_lines_change_order_id_change_orders_id_fk" FOREIGN KEY ("change_order_id") REFERENCES "public"."change_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_order_lines" ADD CONSTRAINT "change_order_lines_cost_item_id_cost_items_id_fk" FOREIGN KEY ("cost_item_id") REFERENCES "public"."cost_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_order_lines" ADD CONSTRAINT "change_order_lines_new_parent_id_cost_items_id_fk" FOREIGN KEY ("new_parent_id") REFERENCES "public"."cost_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_orders" ADD CONSTRAINT "change_orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_orders" ADD CONSTRAINT "change_orders_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "change_order_events_co_idx" ON "change_order_events" USING btree ("change_order_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "change_order_events_decision_uq" ON "change_order_events" USING btree ("change_order_id") WHERE "change_order_events"."to_status" in ('approved', 'rejected', 'voided');--> statement-breakpoint
CREATE INDEX "change_order_lines_co_idx" ON "change_order_lines" USING btree ("change_order_id");--> statement-breakpoint
CREATE INDEX "change_order_lines_item_idx" ON "change_order_lines" USING btree ("cost_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "change_order_lines_co_item_uq" ON "change_order_lines" USING btree ("change_order_id","cost_item_id") WHERE "change_order_lines"."new_code" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "change_order_lines_co_code_uq" ON "change_order_lines" USING btree ("change_order_id","new_code") WHERE "change_order_lines"."new_code" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "change_orders_job_number_uq" ON "change_orders" USING btree ("job_id","number");--> statement-breakpoint
CREATE INDEX "change_orders_job_status_idx" ON "change_orders" USING btree ("job_id","status");