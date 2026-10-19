---
name: verify-v5
description: Prove a deployed Pitbull v5 app serves the expected commit with a healthy database and that the real flows work. Checks /health and /status, then logs in with a role card, confirms the portfolio reads Postgres, runs one assistant action, resets the sandbox, and checks the phone views. Saves JSON and desktop and mobile screenshots as evidence. Use after a v5 merge to confirm staging deployed it, or against a local `npm start`. Works on macOS, Linux and Windows.
---

# Verify v5

One command proves a v5 deployment. It passes only when every check below passes.

| Check | Passes when |
|---|---|
| `/health`, `/status` | Both report the expected commit, `Operational`, and Database `ok`. `/` redirects to `/login`. |
| login as a role card | The Project Manager card signs in as Marcus Lee. |
| portfolio loads from Postgres | `data-source` says "Live from Postgres" with this visitor's sandbox id, the table has 3 jobs, and portfolio CPI renders. |
| assistant runs a typed action and logs it | Asking "Why is Cedar Creek over budget?" in the rail shows `job.costVariance(25-031)`, and the run is still there after a reload (it lives in `action_runs`). |
| sandbox reset reseeds | As the foreman, "Submit tomorrow's plan" submits the Cedar Creek plan. Reset demo then brings it back to draft, changes the seeded time, clears the transcript, and keeps the same sandbox id. |
| phone: foreman lands on chat | At 390px the foreman starts in the chat view and "Show tomorrow's plan" runs `dailyPlan.show`. |
| phone: cost codes do not scroll sideways | At 390px the job page shows the stacked cost list and the page is no wider than the screen. |

Each run signs in as a new visitor, so it gets its own sandbox and never touches anyone else's data.

## Run it

Prerequisites: Node 24 and `npm ci` in `v5/` (the script loads Playwright from `v5/node_modules`). Install the browser once with `npx playwright install chromium` from `v5/`.

```sh
git fetch origin
node .cursor/skills/verify-v5/verify.mjs                  # staging, expects origin/main
node .cursor/skills/verify-v5/verify.mjs --wait 1800      # poll up to 30 min for the deploy to land
node .cursor/skills/verify-v5/verify.mjs --url http://localhost:3100 --commit "$(git rev-parse HEAD)"
node .cursor/skills/verify-v5/verify.mjs --shots /tmp/m1-screens  # also copy the screenshots somewhere handy
```

| Flag | Default | Meaning |
|---|---|---|
| `--url` | `https://pitbull-web-staging.up.railway.app` | App base URL |
| `--commit` | `git rev-parse origin/main` | Expected commit; compared on the first 12 characters |
| `--wait` | `0` | Seconds to poll `/health` until the commit matches |
| `--shots` | the evidence folder | Where to write the desktop and mobile screenshots |

Exit code 0 means every check passed. Exit code 1 means at least one failed; the printed `FAIL` lines say which.

## Evidence

Each run writes `.cursor/skills/verify-v5/evidence/<UTC timestamp>/` (git-ignored):

- `result.json` lists every check, pass or fail, with the observed value.
- `health.json` holds the raw `/health` status code and body.
- `status.json` holds the values read from the `/status` page by test id.
- `status.png` is a full-page screenshot of `/status`.
- `login-desktop.png`, `portfolio-desktop.png`, `assistant-rail-desktop.png`, `job-desktop.png`, `foreman-chat-mobile.png`, `portfolio-mobile.png` and `job-mobile.png` show each flow (in `--shots` when given).

Quote the `VERIFIED` line and the evidence path when reporting.

## Why a deploy may lag

Staging `pitbull-web` deploys `main` from `/v5` with Railway's wait-for-CI on. A deploy sits in `WAITING` until every GitHub Actions run on the commit finishes, including CodeQL. Railway skips the deploy if any run fails, including a Dependabot security-update run, and skips commits that touch nothing under `/v5`. Use `--wait` after a merge, then check the Railway deployment list when the commit never arrives.

The pre-deploy step `npm run db:ensure` creates the `DATABASE_URL` database when it is missing. It never drops or alters anything.
