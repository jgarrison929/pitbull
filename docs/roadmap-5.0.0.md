# Roadmap 5.0.0

Status: superseded on 2026-10-18 by the fresh start in [`docs/v5/fresh-start-plan.md`](v5/fresh-start-plan.md). This file used to hold the salvage inventory of the 3.8.2 app (Keep, Verify and Cut verdicts per feature). That inventory is in this file's git history (PR #607) and is kept only as a record of what not to rebuild.

## Path

This is a plan, not a promise. Versions and order will move as evidence comes in.

| Stage | What | Exit criteria |
|---|---|---|
| 3.8.2 (legacy) | The .NET API + Next.js app in `src/`, tagged `legacy-3.8.2-final`. It keeps serving the demo until cutover and gets security fixes only. | Replaced by v5 at cutover |
| v5 M0 | Rails: `v5/` scaffold (`/status`, `/health`), v5 jobs in `ci-gate`, staging `pitbull-web` repointed to `v5/`, a v5 verification skill | The verification skill proves `/status` on staging shows the deployed commit |
| v5 M1 to M5 | Shell prototypes (screen-first vs chat/voice-first) for Joshua to pick, then demo login with per-visitor sandboxes, then estimate → budget, field daily plan, cost and earned value, change orders | Each milestone merges through `ci-gate` and closes with a verify run |
| v5 M6 | Trust pass and cutover: the demo domains move to v5 and legacy code leaves `main` | Nav crawl and role journeys pass on the production domain |
| 5.0.0 | Release | The trust bar in the fresh-start plan holds at the release commit |

The scope, trust bar, InEight positioning and post-5.0 phase map are in the [fresh-start plan](v5/fresh-start-plan.md).
