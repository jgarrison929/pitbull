# Roadmap 5.0.0

Status: superseded on 2026-10-18 by the fresh start in [`docs/v5/fresh-start-plan.md`](v5/fresh-start-plan.md). This file used to hold the salvage inventory of the 3.8.2 app (Keep, Verify and Cut verdicts per feature). That inventory is in this file's git history (PR #607) and is kept only as a record of what not to rebuild.

## Path

This is a plan, not a promise. Versions and order will move as evidence comes in.

| Stage | What | Exit criteria |
|---|---|---|
| 3.8.2 (legacy) | The .NET API + Next.js app in `src/`, tagged `legacy-3.8.2-final`. It keeps serving the demo until cutover and gets security fixes only. | Replaced by v5 at cutover |
| v5 M0 | Rails: `v5/` scaffold (`/status`, `/health`), v5 jobs in `ci-gate`, staging `pitbull-web` repointed to `v5/`, a v5 verification skill | The verification skill proves `/status` on staging shows the deployed commit |
| v5 M1 (done 2026-10-20) | Joshua picked the hybrid shell from 3 prototypes, then the prototypes were deleted. Shipped on staging: one design system, role-card demo login for 4 roles, a seeded and resettable sandbox per visitor (capped at 3), portfolio and job pages that read Postgres, cost codes that stack on phones, and one CPI and SPI status rule. An assistant rail and a foreman phone chat run the same typed actions as the screens. Foremen and superintendents edit plan lines on screen or through the assistant. Each chat is private to its role, and the job page keeps every change. Staging builds from Railway service settings, and the staging API is retired. PRs #628 to #641. | verify-v5 passes on staging: role-card login, portfolio from Postgres, one assistant action, sandbox reset, unknown-job refusal, the pour 60 → 80 edit on screen and through the assistant, a fresh chat on role switch, phone views |
| v5 M2 to M5 | Estimate → budget, field daily plan/report, cost and earned value, change orders. Status per item is below. | Each milestone merges through `ci-gate` and closes with a verify run |
| v5 M6 | Trust pass and cutover: the demo domains move to v5 and legacy code leaves `main` | Nav crawl and role journeys pass on the production domain |
| 5.0.0 | Release | The trust bar in the fresh-start plan holds at the release commit |

The scope, trust bar, InEight positioning and post-5.0 phase map are in the [fresh-start plan](v5/fresh-start-plan.md).

## M2 to M5 status (checked against `main` at `48143aa6`, 2026-10-21)

Done means merged code plus test or verify coverage. Acceptance checks are from section 9 of the fresh-start plan. None of M2 to M5 has closed yet: each one still misses part of its scope or its verify check.

| Milestone | Item | Status | Evidence or what's missing |
|---|---|---|---|
| M2 Estimate → Budget | WBS (cost code tree) and cost items | Done | [#647](https://github.com/jgarrison929/pitbull/pull/647): hierarchy, 10k cost codes per job, search p95 about 55 ms. `cost-rollups.test.ts`, `stress-typeahead.spec.ts` |
| | CSV import of cost items | Not started | No import code or tests |
| | Approve estimate → original budget; current budget = original + approved changes | Not started | Cost items carry one seeded `budget_cents`. No estimate state, no original vs current budget |
| | Budget views | Partial | Job page shows budget vs earned by cost code ([#630](https://github.com/jgarrison929/pitbull/pull/630), `portfolio.spec.ts`). No original/current budget view, no summary roll-ups by WBS level |
| | Verify: PM imports a CSV, approves, totals match a fixture | Not started | |
| M3 Field daily plan/report | Plan lines with hours and quantities, edited on screen or by assistant | Done | [#639](https://github.com/jgarrison929/pitbull/pull/639), `plan-edit.spec.ts` |
| | Submit plan | Done | [#631](https://github.com/jgarrison929/pitbull/pull/631), [#639](https://github.com/jgarrison929/pitbull/pull/639), `assistant.spec.ts` |
| | Report actual hours and quantity (re-report replaces the day, 0 to 1200 MH) | Done | [#648](https://github.com/jgarrison929/pitbull/pull/648), `earned-value.spec.ts` (7 tests) |
| | Live gain/loss | Partial | Plan lines show within or over the budgeted unit rate ([#630](https://github.com/jgarrison929/pitbull/pull/630), [#639](https://github.com/jgarrison929/pitbull/pull/639)). The report shows no earned hours vs actual hours |
| | Posting to cost items | Done | Reported quantity shows as pending; the PM's locked claim becomes the record ([#645](https://github.com/jgarrison929/pitbull/pull/645), `earned-value.spec.ts`) |
| | Superintendent plans the day (picks cost items and crew, adds lines) | Partial | Lines can be edited, but plans and lines come only from the seed. There is no new plan or add line |
| | Superintendent approve or return | Not started | Plan status is only `draft`/`submitted`. The PM claim lock is the only gate |
| | Verify: mobile-viewport e2e from plan to approval | Not started | The phone tests cover landing views only. The report flow e2e runs on desktop |
| M4 Cost and earned value | PV (linear), EV (units, milestones, PM percent), AC (labor + cost entries), CPI/SPI | Done | [#645](https://github.com/jgarrison929/pitbull/pull/645), [#640](https://github.com/jgarrison929/pitbull/pull/640), `ev.test.ts` (hand-traced fixtures), `earned-value.spec.ts` |
| | Portfolio rollup | Done | Portfolio table with budget, EAC, CPI, SPI ([#630](https://github.com/jgarrison929/pitbull/pull/630), [#645](https://github.com/jgarrison929/pitbull/pull/645), `portfolio.spec.ts`) |
| | EAC with 2 forecast methods per cost item | Partial | One method only: EAC = budget / CPI at job level. No per-item method, no current-budget method, no ETC |
| | S-curve | Not started | No chart in `v5/` |
| | Drill-down project → WBS → cost item → daily reports | Partial | Project → cost code works. No WBS-level summaries, no link to daily reports |
| | Open from the build report | Not started | Summary roll-ups, truncation vs rounding in EV math, 4× CPU / payload check |
| M5 Change orders | PCO → priced → approved → revises budget and forecast, with audit trail | Not started | No change-order table, action or page |

Out of 5.0.0: owner billing and sub pay (5.5).

## Next

The next unfinished milestone is **M2 (Estimate → Budget)**. M5 depends on it, because a change order needs an original and a current budget to revise.

First unblocked slice: **approve the estimate into the original budget.** Add an estimate status (`draft`/`approved`) to each job, plus `original_budget_cents` and `current_budget_cents` on cost items. One seeded job starts as a draft estimate (jobs have no stage field yet, so add one or mark the job in the seed). The PM's "Approve estimate" typed action (screen and assistant) freezes the original budget, sets current = original, and writes the audit row. Proof: a vitest fixture where the approved totals equal the fixture sum, and an e2e where the PM approves and the job's budget KPI matches. CSV import comes next and feeds the same draft estimate.
