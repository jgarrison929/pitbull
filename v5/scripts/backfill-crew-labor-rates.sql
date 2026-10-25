-- Idempotent / re-runnable crew labor rate backfill (5.0.2 Part A).
-- Same named crews as drizzle/0014_crew_labor_rate.sql, but gated on the
-- expand DEFAULT so a later custom rate is never overwritten on re-deploy.
--
-- Deploy: db:migrate runs this automatically after Drizzle migrate (see
-- scripts/backfill-crew-labor-rates.mjs). Manual re-run is still safe:
--
--   psql "$DATABASE_URL" -f v5/scripts/backfill-crew-labor-rates.sql
--   node v5/scripts/backfill-crew-labor-rates.mjs

UPDATE "crews" SET "labor_rate_cents" = 9250 WHERE "name" = 'Bridge Crew 2' AND "labor_rate_cents" = 8500;
UPDATE "crews" SET "labor_rate_cents" = 7800 WHERE "name" = 'Culvert Crew A' AND "labor_rate_cents" = 8500;
UPDATE "crews" SET "labor_rate_cents" = 8800 WHERE "name" = 'Interchange Crew 1' AND "labor_rate_cents" = 8500;
