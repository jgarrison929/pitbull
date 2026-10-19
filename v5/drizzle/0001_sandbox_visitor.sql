ALTER TABLE "companies" ADD COLUMN "visitor_hash" text;--> statement-breakpoint
CREATE INDEX "companies_visitor_idx" ON "companies" USING btree ("visitor_hash");