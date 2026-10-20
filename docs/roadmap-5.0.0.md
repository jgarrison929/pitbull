# Roadmap 5.0.0

Status: superseded on 2026-10-18 by the fresh start in [`docs/v5/fresh-start-plan.md`](v5/fresh-start-plan.md). This file used to hold the salvage inventory of the 3.8.2 app (Keep, Verify and Cut verdicts per feature). That inventory is in this file's git history (PR #607) and is kept only as a record of what not to rebuild.

## Path

This is a plan, not a promise. Versions and order will move as evidence comes in.

| Stage | What | Exit criteria |
|---|---|---|
| 3.8.2 (legacy) | The .NET API + Next.js app in `src/`, tagged `legacy-3.8.2-final`. It keeps serving the demo until cutover and gets security fixes only. | Replaced by v5 at cutover |
| v5 M0 | Rails: `v5/` scaffold (`/status`, `/health`), v5 jobs in `ci-gate`, staging `pitbull-web` repointed to `v5/`, a v5 verification skill | The verification skill proves `/status` on staging shows the deployed commit |
| v5 M1 (done 2026-10-20) | Joshua picked the hybrid shell from 3 prototypes, then the prototypes were deleted. Shipped on staging: one design system, role-card demo login for 4 roles, a seeded and resettable sandbox per visitor (capped at 3), portfolio and job pages that read Postgres, cost codes that stack on phones, and one CPI and SPI status rule. An assistant rail and a foreman phone chat run the same typed actions as the screens. Foremen and superintendents edit plan lines on screen or through the assistant. Each chat is private to its role, and the job page keeps every change. Staging builds from Railway service settings, and the staging API is retired. PRs #628 to #641. | verify-v5 passes on staging: role-card login, portfolio from Postgres, one assistant action, sandbox reset, unknown-job refusal, the pour 60 → 80 edit on screen and through the assistant, a fresh chat on role switch, phone views |
| v5 M2 to M5 | Estimate → budget, earned value methods and cost entries, field daily reports, change orders, scale to 10,000 cost codes | Each milestone merges through `ci-gate` and closes with a verify run |
| v5 M6 | Trust pass and cutover: the demo domains move to v5 and legacy code leaves `main` | Nav crawl and role journeys pass on the production domain |
| 5.0.0 | Release | The trust bar in the fresh-start plan holds at the release commit |

The scope, trust bar, InEight positioning and post-5.0 phase map are in the [fresh-start plan](v5/fresh-start-plan.md).
