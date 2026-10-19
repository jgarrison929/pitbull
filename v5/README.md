# Pitbull v5

The fresh-start Pitbull app: one Next.js 16 service with Postgres through Drizzle. The plan is in [`docs/v5/fresh-start-plan.md`](../docs/v5/fresh-start-plan.md). The legacy app (`src/`, tag `legacy-3.8.2-final`) keeps running until cutover.

## Run it

```bash
nvm use            # Node 24 (see .nvmrc)
npm ci
npm run dev        # http://localhost:3000 redirects to /status
```

Set `DATABASE_URL` to a Postgres URL to make `/health` and `/status` ping the database. Without it, the DB reports `not-configured`.

## Checks

These are the same checks the `v5` job runs inside `ci-gate`:

```bash
npm run lint
npm run typecheck
npm test                       # vitest
npm run build && npm run e2e   # Playwright smoke against `next start`
```

## Deploy

Staging `pitbull-web` on Railway runs this folder: Root Directory `/v5`, and `DATABASE_URL` pointing at the `pcs_v5` database. Build and deploy settings live in the Railway service settings, not in a config file: Railpack, `npm run build`, pre-deploy `npm run db:prepare`, `npm start`, healthcheck `/health` (60 s), watch `/v5/**`. The full runbook is section 7 of the plan.

## Routes

- `/status`: version, commit, build time, DB health.
- `/health`: the same data as JSON. Returns 503 when a configured DB is unreachable.
