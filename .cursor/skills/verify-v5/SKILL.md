---
name: verify-v5
description: Prove a deployed Pitbull v5 app serves the expected commit with a healthy database. Checks /health and the /status page, saves JSON and a screenshot as evidence. Use after a v5 merge to confirm staging deployed it, or against a local `npm start`. Works on macOS, Linux and Windows.
---

# Verify v5

One command proves a v5 deployment. It passes only when `/health` and `/status` both report the expected commit, `Operational`, and Database `ok`.

## Run it

Prerequisites: Node 24 and `npm ci` in `v5/` (the script loads Playwright from `v5/node_modules`). Install the browser once with `npx playwright install chromium` from `v5/`.

```sh
git fetch origin
node .cursor/skills/verify-v5/verify.mjs                  # staging, expects origin/main
node .cursor/skills/verify-v5/verify.mjs --wait 1800      # poll up to 30 min for the deploy to land
node .cursor/skills/verify-v5/verify.mjs --url http://localhost:3100 --commit "$(git rev-parse HEAD)"
```

| Flag | Default | Meaning |
|---|---|---|
| `--url` | `https://pitbull-web-staging.up.railway.app` | App base URL |
| `--commit` | `git rev-parse origin/main` | Expected commit; compared on the first 12 characters |
| `--wait` | `0` | Seconds to poll `/health` until the commit matches |

Exit code 0 means every check passed. Exit code 1 means at least one failed; the printed `FAIL` lines say which.

## Evidence

Each run writes `.cursor/skills/verify-v5/evidence/<UTC timestamp>/` (git-ignored):

- `result.json` lists every check, pass or fail, with the observed value.
- `health.json` holds the raw `/health` status code and body.
- `status.json` holds the values read from the `/status` page by test id.
- `status.png` is a full-page screenshot of `/status`.

Quote the `VERIFIED` line and the evidence path when reporting.

## Why a deploy may lag

Staging `pitbull-web` deploys `main` from `/v5` with Railway's wait-for-CI on. A deploy sits in `WAITING` until every GitHub Actions run on the commit finishes, including CodeQL. Railway skips the deploy if any run fails, including a Dependabot security-update run, and skips commits that touch nothing under `/v5`. Use `--wait` after a merge, then check the Railway deployment list when the commit never arrives.

The pre-deploy step `npm run db:ensure` creates the `DATABASE_URL` database when it is missing. It never drops or alters anything.
