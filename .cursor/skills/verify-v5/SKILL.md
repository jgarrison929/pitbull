---
name: verify-v5
description: Prove a deployed Pitbull v5 app serves the expected commit with a healthy database and that the real flows work. Checks /health and /status, then logs in with a role card, confirms the portfolio reads Postgres, runs one assistant action, edits a plan line on screen and through the assistant, checks that switching roles starts a fresh chat, resets the sandbox, and checks the phone views. Saves JSON and desktop and mobile screenshots as evidence. Use after a v5 merge to confirm staging deployed it, or against a local `npm start`. Works on macOS, Linux and Windows.
---

# Verify v5

One command proves a v5 deployment. It passes only when every check below passes.

| Check | Passes when |
|---|---|
| `/health`, `/status` | Both report the expected commit, a non-zero version, ci-gate result, last-verify field, `Operational`, and Database `ok`. `/` redirects to `/login`. |
| login as a role card | The Project Manager card signs in as Marcus Lee. |
| portfolio loads from Postgres | User menu shows a sandbox id, the table has as many jobs as the default seed (`seed()` job count — not hardcoded), portfolio CPI renders, and no "Live from Postgres" footer. |
| assistant runs a typed action and logs it | Asking "Why is Cedar Creek over budget?" in the rail shows `job.costVariance(25-031)`, and the run is still there after a reload (it lives in `action_runs`). |
| sandbox reset reseeds | As the foreman, "Submit tomorrow's plan" issues the Cedar Creek plan (`issued`). Reset demo then brings it back to seed `draft`, changes the seeded time, drops the visitor submit from the rail (seed history may remain), and keeps the same sandbox id. |
| signed out, /app redirects to /login | A browser with no session asking for a job page lands on `/login`. |
| an unknown job number is refused | Right after the reset, "Submit the plan for 99-999" is refused by name and Cedar Creek's draft stays a draft. |
| pour 60 → 80 on screen | As the foreman, editing the 04-210 pour line to 80 man-hours saves it, a reload still shows 80, and the run is logged as `dailyPlan.updateLine` with "man-hours 60 → 80". |
| pour 60 → 80 through the assistant | After a reset, "Change the pour to 80 man-hours" in the rail runs `dailyPlan.updateLine`, and a reload of the job page shows 80. |
| switching roles starts a fresh chat | Signed in as the PM, the rail shows none of the foreman's runs, the job's "Changes" list still shows Luis Ortega's edit, and back as the foreman the run is still there. |
| phone: foreman lands on chat | At 390px the foreman starts in the chat view and "Show tomorrow's plan" runs `dailyPlan.show`. |
| phone: cost codes do not scroll sideways | At 390px the job page shows the stacked cost list and `documentElement.scrollWidth` is not wider than the phone viewport (bounded by 390 / `visualViewport.width`, not layout `innerWidth` alone). |
| phone: every role×job fits width with tab bar on screen | At 390px, for PM / foreman / executive / superintendent on every seeded job page: no horizontal overflow, and the bottom tab bar (Portfolio / Assistant / Status / Changelog) is fully on screen. |

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

**Last-verify stamp:** on a passing run, the script `POST`s `/api/verify/stamp` when `VERIFY_TOKEN` is set in the runner environment. The same value must be configured on the Railway staging service (`VERIFY_TOKEN`). Without it, `/status` keeps showing `not recorded`.

To see it fail on purpose, pass a commit staging doesn't serve, such as `--commit 000000000000`. The commit checks print `FAIL` and the run exits 1.

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
