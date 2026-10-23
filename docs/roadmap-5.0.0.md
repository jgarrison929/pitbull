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

## M2 to M5 status (checked against `main` at `06a77e42`, 2026-10-22)

**Done** means merged code plus test coverage that already rode a staging verify. **Merged-but-unverified** means merged to `main` with unit/e2e proof in CI, but **not** yet proven on staging or production — staging is still on `2328af3b` while Railway deploys are held. Do not treat merged-but-unverified rows as staging-verified. Acceptance checks are from section 9 of the fresh-start plan. None of M2 to M5 has closed yet: each one still misses part of its scope or its staging verify.

M1 trust-bar follow-ups on `main` (also merged-but-unverified until staging moves): seed change history via real typed actions ([#659](https://github.com/jgarrison929/pitbull/pull/659)), honest `/status` ([#660](https://github.com/jgarrison929/pitbull/pull/660)), Playwright visual baselines ([#661](https://github.com/jgarrison929/pitbull/pull/661)), unknown-job HTTP 404 / UI cleanup ([#664](https://github.com/jgarrison929/pitbull/pull/664)).

| Milestone | Item | Status | Evidence or what's missing |
|---|---|---|---|
| M2 Estimate → Budget | WBS (cost code tree) and cost items | Done | [#647](https://github.com/jgarrison929/pitbull/pull/647): hierarchy, 10k cost codes per job, search p95 about 55 ms. `cost-rollups.test.ts`, `stress-typeahead.spec.ts` |
| | CSV import of cost items | Not started | No import code or tests. Next M2 slice; will update this row when it lands |
| | Approve estimate → original budget; current budget = original + approved changes | Merged-but-unverified | [#662](https://github.com/jgarrison929/pitbull/pull/662): OB / CB / CE value sets; PM Approve estimate freezes OB from CE, sets CB = OB, audits via `action_runs`. Harbor Abutment seeds as draft ($86,750.00 fixture). `budget.test.ts`, `estimate-approve.spec.ts`. Approved changes that revise CB are still M5 |
| | Budget views | Partial | Job and portfolio read **Current Budget** ([#662](https://github.com/jgarrison929/pitbull/pull/662), merged-but-unverified). No dedicated original/current estimate views, no summary roll-ups by WBS level |
| | Verify: PM imports a CSV, approves, totals match a fixture | Not started | Approve-only e2e exists in CI ([#662](https://github.com/jgarrison929/pitbull/pull/662)); CSV path and staging verify-v5 still missing |
| M3 Field daily plan/report | Plan lines with hours and quantities, edited on screen or by assistant | Done | [#639](https://github.com/jgarrison929/pitbull/pull/639), `plan-edit.spec.ts` |
| | Submit plan | Done | [#631](https://github.com/jgarrison929/pitbull/pull/631), [#639](https://github.com/jgarrison929/pitbull/pull/639), `assistant.spec.ts` |
| | Report actual hours and quantity (re-report replaces the day, 0 to 1200 MH) | Done | [#648](https://github.com/jgarrison929/pitbull/pull/648), `earned-value.spec.ts` |
| | Live gain/loss | Partial | Plan lines show within or over the budgeted unit rate ([#630](https://github.com/jgarrison929/pitbull/pull/630), [#639](https://github.com/jgarrison929/pitbull/pull/639)). The report shows no earned hours vs actual hours |
| | Posting to cost items | Merged-but-unverified | [#665](https://github.com/jgarrison929/pitbull/pull/665): cost posts once on superintendent **approve**, dated by the plan date; foreman numbers stay pending until then. `progress-approve.test.ts`, `approve-return.spec.ts`, `earned-value.spec.ts` |
| | Superintendent plans the day (picks cost items and crew, adds lines) | Partial | Lines can be edited, but plans and lines come only from the seed. There is no new plan or add line |
| | Superintendent approve or return | Merged-but-unverified | [#665](https://github.com/jgarrison929/pitbull/pull/665): lifecycle `draft` → `issued` → `reported` → `approved`; return requires a reason and posts nothing. Screen + `dailyPlan.approve` / `dailyPlan.return` |
| | Verify: mobile-viewport e2e from plan to approval | Merged-but-unverified | [#665](https://github.com/jgarrison929/pitbull/pull/665) phone e2e (`approve-return.spec.ts`, 390×844): report → return → re-report → approve → cost. Plan-create and staging verify still open |
| M4 Cost and earned value | PV (linear), EV (units, milestones, PM percent), AC (labor + cost entries), CPI/SPI | Merged-but-unverified | Base math from [#645](https://github.com/jgarrison929/pitbull/pull/645) / [#640](https://github.com/jgarrison929/pitbull/pull/640). [#666](https://github.com/jgarrison929/pitbull/pull/666): one cutoff — EV/AC/PV at last locked period; since-lock cost and PV shown separately. `ev.test.ts`, `earned-value.spec.ts`. Staging still on pre-#666 |
| | Portfolio rollup | Merged-but-unverified | Portfolio table with budget, EAC, CPI, SPI ([#630](https://github.com/jgarrison929/pitbull/pull/630), [#645](https://github.com/jgarrison929/pitbull/pull/645)); job EAC is now the sum of per-item forecasts ([#666](https://github.com/jgarrison929/pitbull/pull/666)). Staging still on pre-#666 |
| | EAC with 2 forecast methods per cost item | Merged-but-unverified | [#666](https://github.com/jgarrison929/pitbull/pull/666): Current Budget `EAC = AC + (BAC − EV)` and Average Performance `EAC = AC × BAC ÷ EV` (fallback when no progress); ETC on job tiles. `ev.test.ts` |
| | S-curve | Not started | No chart in `v5/` |
| | Drill-down project → WBS → cost item → daily reports | Partial | Project → cost code works. No WBS-level summaries, no link to daily reports |
| | Open from the build report | Not started | Summary roll-ups, truncation vs rounding in EV math, 4× CPU / payload check |
| M5 Change orders | PCO → priced → approved → revises budget and forecast, with audit trail | Not started | No change-order table, action or page. Separate slice; will update this row when it lands. OB/CB from [#662](https://github.com/jgarrison929/pitbull/pull/662) are the intended revise targets once M5 ships |

Out of 5.0.0: owner billing and sub pay (5.5).

## Next

The next unfinished M2 slice is **CSV import of cost items** into the draft Current Estimate (feeds the same Approve estimate path from [#662](https://github.com/jgarrison929/pitbull/pull/662)). M5 change orders remain **not started** and will revise Current Budget once that slice lands; they should not be marked done from this docs pass.

Until Railway deploys resume and staging moves past `2328af3b`, treat [#659](https://github.com/jgarrison929/pitbull/pull/659)–[#662](https://github.com/jgarrison929/pitbull/pull/662), [#664](https://github.com/jgarrison929/pitbull/pull/664)–[#666](https://github.com/jgarrison929/pitbull/pull/666) as **merged-but-unverified** — ci-gate on `main` only, no staging or production verify claim.
