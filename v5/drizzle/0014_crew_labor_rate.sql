-- Expand-only: NOT NULL with DEFAULT so a pre-0014 build can still INSERT into
-- crews without naming labor_rate_cents. Do not DROP the default in 5.0.2.
ALTER TABLE "crews" ADD COLUMN "labor_rate_cents" integer DEFAULT 8500 NOT NULL;--> statement-breakpoint
-- Spec seed rates (cents/MH). Idempotent by name — same statements live in
-- scripts/backfill-crew-labor-rates.sql and must be re-run once after cutover
-- (old-build sandboxes created/reset post-0014 only get DEFAULT 8500).
UPDATE "crews" SET "labor_rate_cents" = 9250 WHERE "name" = 'Bridge Crew 2';--> statement-breakpoint
UPDATE "crews" SET "labor_rate_cents" = 7800 WHERE "name" = 'Culvert Crew A';--> statement-breakpoint
UPDATE "crews" SET "labor_rate_cents" = 8800 WHERE "name" = 'Interchange Crew 1';
