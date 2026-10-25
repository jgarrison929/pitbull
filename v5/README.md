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

### Visual baselines

`tests/e2e/visual.spec.ts` uses `maxDiffPixels: 0`. Committed PNGs are **CI-truth**: they only match GitHub Actions Linux Chromium (or the same Playwright Docker image). Host Chromium on an agent/dev box still differs by text AA even with static Geist — do **not** refresh snapshots with bare `npx playwright test --update-snapshots` on the agent.

**Preferred local render (pinned Docker):**

```bash
# Needs Docker + Postgres on the host. On Linux the script uses --network=host
# (default DATABASE_URL → 127.0.0.1). Override with DATABASE_URL=… as needed.
bash scripts/visual-in-playwright-docker.sh            # assert against committed snaps
bash scripts/visual-in-playwright-docker.sh --update   # rewrite snaps inside the image
```

Image tag is `mcr.microsoft.com/playwright:v<lockfile @playwright/test>-noble` (jammy fallback).

Glyphs Geist does not ship (✓, ▾, ▸) are **inline SVGs** in the UI. The Docker script still installs `fonts-dejavu-core` so residual system-font glyphs match GHA ubuntu-latest (same as Verify’s pinned Harbor note).

**CI artifact adopt (when Docker is unavailable):**

1. Push the UI change; let the `v5` job fail the visual tests.
2. Download the `v5-playwright` artifact from that run.
3. `bash scripts/adopt-visual-actuals.sh /path/to/unzipped/v5-playwright`
4. Commit the updated `tests/e2e/visual.spec.ts-snapshots/*-chromium-linux.png`.

Fonts are pinned as static Geist woff2 via `next/font/local` (`src/app/fonts/`, asserted by `fonts-pin.test.ts`). Residual local≠CI AA is host rasterization, not missing faces.

## Deploy

Staging `pitbull-web` on Railway runs this folder: Root Directory `/v5`, and `DATABASE_URL` pointing at the `pcs_v5` database. Build and deploy settings live in the Railway service settings, not in a config file: Railpack, `npm run build`, pre-deploy `npm run db:prepare`, `npm start`, healthcheck `/health` (60 s), watch `/v5/**`. The full runbook is section 7 of the plan.

### PostHog (session replay)

Client analytics is off unless a project key is present at **build** time (`NEXT_PUBLIC_*` is inlined by Next). Set these on the Railway service (available to the Railpack `npm run build` step), then redeploy:

| Variable | Required | Notes |
|----------|----------|--------|
| `NEXT_PUBLIC_POSTHOG_KEY` | yes, to enable | Unset → complete no-op (CI / local / e2e) |
| `NEXT_PUBLIC_POSTHOG_HOST` | no | Defaults to `https://us.i.posthog.com` when empty |
| `NEXT_PUBLIC_POSTHOG_SESSION_RECORDING` | no | Set to `false` (or `0`) to disable recording only |

No Dockerfile — Railpack reads service variables during build. Changing any `NEXT_PUBLIC_*` value requires a rebuild, not just a restart.

## Routes

- `/status`: version, commit, ci-gate result, last verify timestamp · commit, build time, DB health.
- `/health`: the same data as JSON. Returns 503 when a configured DB is unreachable.
- ci-gate is resolved from GitHub once per commit (5 min server cache, single-flight refresh). On GitHub errors, last good is kept (stale + age) with a short retry TTL — `unknown` is never locked for the full 5 min. Optional `GITHUB_TOKEN` / `GH_TOKEN` avoids anonymous rate limits.
- After a successful verify-v5 run, set `VERIFY_TOKEN` on the deploy and in the runner env so `POST /api/verify/stamp` records last-verify (otherwise `/status` shows `not recorded`). Stamp requires a full 40-character commit SHA matching the deploy, and an `at` within the allowed window (not future beyond clock skew, not older than 24h).
