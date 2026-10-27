# Pitbull roadmap

Status: checked against `main` at `d56eb6be` on 2026-10-26 at 10:40 AM (PT). This is a plan, not a promise. Versions and order move when evidence comes in.

Pitbull is a construction project controls platform. The scope, the trust bar, and the InEight positioning are in the [fresh-start plan](v5/fresh-start-plan.md). The milestone history of 5.0.0 (M0 to M6) is in [Roadmap 5.0.0](roadmap-5.0.0.md).

**PR numbers.** The repo moved to a fresh public history on 2026-10-25 (root commit `829164a`), and PR numbers restarted at #1. Numbers from #600 to #724 in this page and in older specs refer to the old private history. Links to PRs on the public history use full URLs.

## Decisions in this refresh (2026-10-26)

- **Shipped means verified and released.** An increment counts as shipped when Pitbull Verify passed on staging, the version is tagged, and production serves it. Merged work without that evidence reads "merged, awaiting verify".
- **5.0.2 is verified on staging but not released.** The public history has no tags and no GitHub releases yet. Tag `v5.0.2` and promote to production before 5.0.3 is stamped.
- **The 5.2 Contracts and subs PRD is written** ([PRD](v5/prd/5.2-contracts-and-subs.md)), with build-ready specs for [5.2.0](v5/specs/5.2.0-subcontracts-and-commitments.md) and [5.2.1](v5/specs/5.2.1-committed-cost-forecast.md). All of 5.1 is in build, so 5.2 has to be ready to start.
- **5.2 dates move in.** 5.2.0 moves from 2026-11-24 to 2026-11-13. 5.1 slices are already in PRs and observed pace is close to one increment a day.
- **5.2 migrations start at `0024`.** `0021` to `0023` are taken by 5.1 (see [migration numbers](#migration-numbers)).
- **Expired sub insurance prompts, it does not block.** Joshua decided that a sub pay application can still be submitted with an expired liability certificate. The submit flow asks for a current certificate right then, and the reviewer sees the state. Approval is not blocked. This is 5.2.5 on 2026-12-03 ([spec](v5/specs/5.2.5-insurance-expiry-prompt.md)).

## How versions work

Public versions are `5.<feature>.<increment>`.

- The feature number names one module: 5.0 is the core loop, 5.1 is Schedule, 5.2 is Contracts and subs, and so on.
- The increment number counts demo-able releases inside that module. 5.0.1 is the first increment after 5.0.0.
- Each increment fits in one cloud-agent PR or a few parallel ones. It merges through `ci-gate`, deploys to staging, and passes Pitbull Verify on staging before release.
- A release moves `v5/package.json` and root `VERSION` to the new version and adds the matching entry to `v5/src/content/changelog.ts`. The `/changelog` and `/status` pages read those. The tag `v5.x.y` goes on the release commit after staging verify passes.
- **Release status.** A version's row in `shipped` in `v5/src/content/roadmap.ts` may land in the release commit, because the `v5.<x>.<y>` tag is cut from that commit. In this file, the version's status column reads "Tagged, awaiting production verify" from the tag until the production verify passes. Only then does it read "Released". Verify accepts a `shipped` row in `roadmap.ts` when the version's tag points at the commit that added the row, or at a commit that descends from it. A `shipped` row with no tag, or with a tag on a commit that does not contain the row, fails.
- From 5.0.4, slices merge into an `rc/<version>` branch first. Staging gets one handover of the RC head, and `verify-v5 --rc <sha>` proves that exact commit (merged in [#31](https://github.com/jgarrison929/pitbull/pull/31); `ci-gate` runs on `rc/**` since [#30](https://github.com/jgarrison929/pitbull/pull/30)).

**Evidence of pace.** On the public history, 19 PRs merged to `main` between 2026-10-25 at 4:55 PM and 2026-10-26 at 10:31 AM PT, plus 5.0.4-c into `rc/5.0.4`. 5.0.1 and 5.0.2 landed one day apart. More than ten feature slices are open at once when file ownership does not collide.

**Floor.** Trust bar item 4 still holds: at least one release every two weeks. That is a floor, not the pace. Skip a target only when it lands on Thanksgiving Day (2026-11-26) or between 2026-12-24 and 2027-01-01. A release that misses the gate slips to the next open day. It never ships early with gaps.

## Where each version stands

| Version | Code | Staging verify | Tag | Production | Read as |
|---|---|---|---|---|---|
| 5.0.0 | Old history | Passed 2026-10-24 | `v5.0.0` on the old history only | Superseded by 5.0.1 | **Shipped** |
| 5.0.1 | Old history | Production verify 37/37 on 2026-10-25 | `v5.0.1` on the old history only | `demo.pcserp.app` and `app.pcserp.app` serve 5.0.1 at `05246e2e` | **Shipped** |
| 5.0.2 | On `main`, version stamped | Passed 41/41 on `3d53c3f6`, 2026-10-26 at 9:12 AM PT | None | Not promoted | **Verified on staging, awaiting tag and production** |
| 5.0.3 | On main (Parts B to F, #29, #16) | Pending staging verify on the tagged sha | v5.0.3 | Not yet promoted | **In release** |
| 5.0.4 | 5.0.4-0 on `main`, 5.0.4-c on `rc/5.0.4`; a, b, d, e, f open; g not started | Not run | None | No | **In build** |
| 5.1.0 | 5.1.0-a on `main`; b, c, d open | 0020 applied on staging | None | No | **Merged in part, awaiting verify** |

## Just shipped: 5.0.1 (production) and 5.0.2 (staging)

### 5.0.1

5.0.1 is **The superintendent builds the day's plan, and a public /roadmap page** (crews + create/add/remove lines + public `/roadmap`).

Status: **shipped** on 2026-10-25 at 5:50 AM PT. Old-history PRs: Part B #700 (public `/roadmap`), Part A #699 and #701 (crews, create, add and remove plan lines).

Evidence:

- Production verify on #701 (2026-10-25 at 6:03 AM PT) passed **37/37**. Production served tag `v5.0.1` at `05246e2e`.
- Checked again on 2026-10-26 at 10:22 AM PT: `/health` on `demo.pcserp.app` and `app.pcserp.app` reports version `5.0.1`, commit `05246e2e`, migrations through `0014_crew_labor_rate`, and last verify 2026-10-25 at 6:33 AM PT on `05246e2e`.

### 5.0.2

5.0.2 is **Crew labor rates, seeded field history, and drill-down from a cost item to its daily reports**.

Status: **verified on staging, not released.** `v5/package.json` and root `VERSION` read `5.0.2`. The changelog entry is dated 2026-10-26. The in-app `/roadmap` already lists 5.0.2 as shipped.

Evidence: the staging post-merge sign-off for `main` at `3d53c3f6` ([comment on #11](https://github.com/jgarrison929/pitbull/pull/11)) passed **41/41** and stamped `lastVerifyAt` 2026-10-26 at 9:12 AM PT.

- Crawl: 4 roles × 4 widths. 152 page loads, 152 drill-down loads, and 96 Part C loads (one cost item page and one plan page per active job). 0 failures, 0 loads over 1,500 ms, no banned strings. That closes release closeout item 3 in the [5.0.2 spec](v5/specs/5.0.2-crew-rates-and-field-history.md#release-closeout).
- Reset median 921 ms over 5 samples (budget 1,500 ms).
- M2 matched the fixture to the cent. On 25-031, EAC = AC + (CB − EV) exactly. Approving CO-001 moved CB and EAC by exactly $60,000.00, and reset restored the seed.
- The first leg on the same commit was NOT VERIFIED (39/40) because the verify browser stalled on a screenshot. The comment discloses it, and the rerun passed.

What is left: tag `v5.0.2` on the public history, promote production, and run the production verify (closeout item 5). Staging served `2a233968` (#29) at 10:22 AM PT, still version 5.0.2. Later `main` commits (#29, #16) have no staging sign-off yet.

Parts on the old history: A #707 (`0014`), B #713, C #706.

### 5.0.0

5.0.0 is the M1 to M5 work: the role-card demo, per-visitor sandboxes, estimate to budget, the field daily plan and report, cost and earned value, and change orders. It shipped on 2026-10-24. Tag `v5.0.0` pointed at `4f40243f` on the old history. The staging verify of `4f40243f` passed 24 of 24 checks. The milestone labels `5.0.0-m0` to `5.0.0-m5.2` all ship inside 5.0.0 ([Roadmap 5.0.0](roadmap-5.0.0.md) has the details).

## Merged since the fresh start (2026-10-25 and 2026-10-26)

These are on `main` and staging. None is part of a tagged release yet.

| PR | What | Merged (PT) | Belongs to |
|---|---|---|---|
| [#13](https://github.com/jgarrison929/pitbull/pull/13) | Plan events, migration `0018` | 10-25 at 5:03 PM | 5.0.3 Part D |
| [#10](https://github.com/jgarrison929/pitbull/pull/10) | Crews contract, migration `0019` | 10-26 at 3:25 AM | 5.0.3 Part F |
| [#11](https://github.com/jgarrison929/pitbull/pull/11) | Schedule schema and Cedar seed, migration `0020` | 10-26 at 8:27 AM | 5.1.0-a |
| [#24](https://github.com/jgarrison929/pitbull/pull/24) | No sideways scroll at 320 and 390 px | 10-26 at 4:35 AM | 5.0.4-0 |
| [#25](https://github.com/jgarrison929/pitbull/pull/25) | Visual tokens and `MetricCard` (into `rc/5.0.4`) | 10-26 at 9:41 AM | 5.0.4-c |
| [#18](https://github.com/jgarrison929/pitbull/pull/18) | Plan "today" in the job's time zone, not UTC | 10-26 at 1:29 AM | Fix |
| [#15](https://github.com/jgarrison929/pitbull/pull/15) | App Router error and global-error recovery screens | 10-26 at 7:34 AM | Fix |
| [#28](https://github.com/jgarrison929/pitbull/pull/28), [#29](https://github.com/jgarrison929/pitbull/pull/29) | Cold-path latency; shell link prefetch no longer holds cost-item network idle. Open #28 acceptance target (DB pool and cold paths), moved from #62 on 2026-10-27: max load under 1,000 ms in the 24-browser job-page burst on 24-077 and 24-118 (`v5/scripts/job-page-ttfb-burst.mjs`). `main` does not meet it yet. See the [5.0.4 spec](v5/specs/5.0.4-clear-next-steps-and-mobile-polish.md#job-page-burst-gate-62) | 10-26 at 5:18 AM and 9:40 AM | Speed |
| [#16](https://github.com/jgarrison929/pitbull/pull/16) | Defer PostHog; foreman job page under its query budget | 10-26 at 10:31 AM | Speed |
| [#20](https://github.com/jgarrison929/pitbull/pull/20), [#31](https://github.com/jgarrison929/pitbull/pull/31) | verify-v5: safe `DATABASE_URL`, fail-fast reset; phone layout checks and RC handover | 10-26 at 3:50 AM and 8:42 AM | Verify |
| [#8](https://github.com/jgarrison929/pitbull/pull/8), [#9](https://github.com/jgarrison929/pitbull/pull/9), [#30](https://github.com/jgarrison929/pitbull/pull/30) | Test hardening, parallel must-fail job, `ci-gate` on `rc/**` | 10-25 and 10-26 | CI |
| [#22](https://github.com/jgarrison929/pitbull/pull/22), [#23](https://github.com/jgarrison929/pitbull/pull/23) | 5.0.4 spec | 10-25 evening | Docs |

5.0.3 Parts B (Average Performance, `0017`), C (dark theme), and E (rail unknown-job refusal), and the 5.1.1 CPM library (`v5/src/lib/cpm.ts`), came in with the fresh-history snapshot. They are on `main` but not in any tagged release.

## In flight

State on 2026-10-26 at 10:40 AM PT. "Verify" is the latest Pitbull Verify verdict. A verdict on an older head does not count for the current head.

| PR | Slice | Target branch | State |
|---|---|---|---|
| [#12](https://github.com/jgarrison929/pitbull/pull/12) | 5.0.5 (was 5.0.3 Part A), the S-curve | `main` | ci-gate green. Verify FAIL on an older head; current head waiting |
| [#26](https://github.com/jgarrison929/pitbull/pull/26) | 5.0.4-a, "What needs you today" | `rc/5.0.4` | ci-gate green. Verify FAIL on an older head; current head waiting |
| [#27](https://github.com/jgarrison929/pitbull/pull/27) | 5.0.4-b, page purpose lines and role-fit metrics | `rc/5.0.4` | ci-gate green. Verify FAIL on an older head; current head waiting |
| [#32](https://github.com/jgarrison929/pitbull/pull/32) | 5.0.4-d, plan and report on phones | `rc/5.0.4` | ci-gate green, waiting for Verify |
| [#33](https://github.com/jgarrison929/pitbull/pull/33) | 5.0.4-e, cost and earned value on phones | `rc/5.0.4` | ci-gate green, waiting for Verify |
| [#34](https://github.com/jgarrison929/pitbull/pull/34) | 5.0.4-f, remaining screens | `rc/5.0.4` | ci-gate green, waiting for Verify |
| [#37](https://github.com/jgarrison929/pitbull/pull/37) | 5.1.0-b, schedule server module and typed actions | `main` | ci-gate green, waiting for Verify |
| [#40](https://github.com/jgarrison929/pitbull/pull/40) | 5.1.0-c, Gantt UI | `main` | ci-gate green, waiting for Verify |
| [#41](https://github.com/jgarrison929/pitbull/pull/41) | 5.1.0-d, plan-line `activity_id` and picker, migration `0021` | `main` | ci-gate green, waiting for Verify |
| [#42](https://github.com/jgarrison929/pitbull/pull/42) | verify-v5 crawls job schedule pages once the route exists | `main` | Verify FAIL on an older head; ci-gate running on the current head |
| [#36](https://github.com/jgarrison929/pitbull/pull/36) | 5.1.2-a, baseline schema and set or re-baseline, migration `0023` | `main` | ci-gate green, waiting for Verify. Merges after `0022` exists, or renumbers |
| [#35](https://github.com/jgarrison929/pitbull/pull/35) | 5.1.3-a, XER parser and all-or-nothing import | `main` | ci-gate green, waiting for Verify |
| [#39](https://github.com/jgarrison929/pitbull/pull/39) | 5.1.3-b, Microsoft Project XML parser | `main` | ci-gate green, waiting for Verify |
| [#38](https://github.com/jgarrison929/pitbull/pull/38) | 5.1.3-c, import UI and skipped-types summary | `main` | ci-gate green, waiting for Verify |
| [#21](https://github.com/jgarrison929/pitbull/pull/21) | `db:ensure` parses `DATABASE_URL` without leaking the password | `main` | ci-gate green, waiting for Verify |
| [#17](https://github.com/jgarrison929/pitbull/pull/17) | Extract DB test hooks | `main` | Lead held it for red smoke checks on older heads; ci-gate green now |
| [#14](https://github.com/jgarrison929/pitbull/pull/14) | Agent mistake guards (tests only) | `main` | Last Verify FAIL was for a red ci-gate. ci-gate green now, waiting for Verify |
| [#6](https://github.com/jgarrison929/pitbull/pull/6) | Dependabot: TypeScript 7 | `main` | Not routed |

Not started: 5.0.4-g (guided demo path), 5.1.1 wire-up (links table, link actions, Gantt critical path), 5.1.2-b and 5.1.2-c, and all of 5.2.

## Next: finish 5.0.x

| Version | Target (PT) | Increment | Spec | What is left |
|---|---|---|---|---|
| 5.0.2 | 2026-10-26 | Crew rates, field history, cost drill-down | [5.0.2](v5/specs/5.0.2-crew-rates-and-field-history.md) | Tag `v5.0.2`, promote production, production verify |
| 5.0.3 | 2026-10-26 | Average Performance per cost item, dark theme, plan history, faster job pages | [5.0.3](v5/specs/5.0.3-s-curve-and-forecast-methods.md) (Parts B to F) | Staging verify on the tagged sha, tag, production verify |
| 5.0.4 | 2026-10-30 | Clear next steps for each role, a plain purpose line on every page, and a phone layout with one main number per card | [5.0.4](v5/specs/5.0.4-clear-next-steps-and-mobile-polish.md) | Slices a, b, d, e, f pass Verify into `rc/5.0.4`. Slice g gets built. One RC handover with phone checks, then merge to `main` and tag |
| 5.0.5 | 2026-11-02 | The S-curve for each job and the portfolio | [5.0.5](v5/specs/5.0.5-s-curve.md) (was 5.0.3 Part A) | #12 passes Verify and merges to main, then stamp, staging verify, tag |
| 5.0.6 | 2026-11-04 | One job page order for every role: header with "Next for you", five KPI cards, the cost table, then the role's work. The first cost row sits within 900 px of the top at 1440 | [5.0.6](v5/specs/5.0.6-job-page-anatomy.md) | Starts after 5.0.4 merges to `main`. One slice, then stamp, staging verify, tag |
| 5.0.7 | 2026-11-09 | A detail drawer for cost items, change orders, and plan lines on the job page, plus a read-only change order page at `/app/jobs/[number]/change-orders/[co]` | [5.0.7](v5/specs/5.0.7-detail-drawer.md) | Starts after 5.0.6 and the #62 follow-ups ([#70](https://github.com/jgarrison929/pitbull/pull/70)) merge. One slice, then stamp, staging verify, tag |

5.0.4 is a 5.0 increment because the app did not show what to do next and was crowded on phones (Joshua's review, 2026-10-25). That misses trust bar item 5. It adds no migration, so it runs beside 5.1.0.

5.0.6 and 5.0.7 come from Pitbull UX's audit of staging 5.0.3 and its specs of 2026-10-27 (PT). They finish trust bar item 5's page anatomy: header, KPIs, primary table, detail drawer. Neither adds a migration. The same audit added slice 5.0.4-i and 20 new checks to [5.0.4](v5/specs/5.0.4-clear-next-steps-and-mobile-polish.md#pitbull-ux-checks-2026-10-27).

Gaps still open in the 5.0 story:

| Gap on `main` | Promised for 5.0? | Placed in |
|---|---|---|
| No S-curve | Yes, section 4 step 5 and M4 | [5.0.5](v5/specs/5.0.5-s-curve.md) (was 5.0.3 Part A) ([#12](https://github.com/jgarrison929/pitbull/pull/12)) |
| No page says what to do next. Phone pages were wider than the screen | Yes, trust bar item 5 | 5.0.4 (5.0.4-0 merged; the rest in build) |
| Equipment hours on a plan cost nothing | Section 4 step 5 said "+ equipment". Decision 2026-10-24 | 5.6+ cost depth |
| The foreman reports total man-hours per line, not hours per worker | Section 4 step 4. Decision 2026-10-24 | 5.6+ payroll export |

Closed since the last refresh: plan history by role and time (5.0.3 Part D, `0018`), the crews contract (5.0.3 Part F, `0019`), Average Performance (Part B, `0017`), the dark theme (Part C), and the rail unknown-job refusal (Part E). All are on `main` and ship with the 5.0.3 tag, together with the speed fixes [#29](https://github.com/jgarrison929/pitbull/pull/29) and [#16](https://github.com/jgarrison929/pitbull/pull/16). 5.0.3 is **Average Performance selectable per cost item, the dark theme, plan history by role and time, and faster job pages**. The S-curve moves to 5.0.5.

## Then: 5.1 Schedule

5.1 adds activities, a Gantt view, dependencies, and CPM-lite. Planned value is "PV dates from the baseline schedule, linear spread". The spread stays the linear one M4 already has. Only the dates move. The [5.1 Schedule PRD](v5/prd/5.1-schedule.md) is the source of scope. The [schedule intel](v5/intel/schedule.md) is the source of claim IDs.

Locked rules for every 5.1 increment:

- Planned value reads baseline dates, never current dates. Current dates drive the Gantt chart and the forecast finish (schedule intel I4).
- A CPM finish date is a full working day. The mapping passes finish + 1 day into `plannedValueCents` (acceptance check 7).
- Approved daily reports drive percent complete. Nobody types it on the Gantt chart (I5).

| Version | Target (PT) | Increment | Spec | State |
|---|---|---|---|---|
| 5.1.0 | 2026-10-29 | Activities linked to cost items, one working calendar, a Gantt view, and daily plan lines linked to activities | [5.1.0](v5/specs/5.1.0-activities-and-gantt.md) | a merged ([#11](https://github.com/jgarrison929/pitbull/pull/11)). b, c, d open |
| 5.1.1 | 2026-11-03 | Finish-to-start and start-to-start links with whole-day lag, forward and backward pass, total float, and the critical path. A cycle is refused | [5.1.1](v5/specs/5.1.1-dependencies-and-cpm.md) | CPM library on `main`. Wire-up not started; claims `0022` |
| 5.1.2 | 2026-11-06 | A baseline that cannot be edited. PV and the S-curve read baseline dates with the linear spread. A re-baseline needs a reason | [5.1.2](v5/specs/5.1.2-baseline-and-pv.md) | a open ([#36](https://github.com/jgarrison929/pitbull/pull/36)). b and c not started |
| 5.1.3 | 2026-11-10 | XER import, then Microsoft Project XML import, all-or-nothing | [5.1.3](v5/specs/5.1.3-schedule-import.md) | a, b, c all open |

5.1.2 moves from 2026-11-10 to 2026-11-06 and 5.1.3 from 2026-11-17 to 2026-11-10, because their first slices are already in PRs. 5.1.0 and 5.1.1 keep their dates. A version still releases in order: 5.1.3 does not tag before 5.1.2, even if its slices merge first.

## Then: 5.2 Contracts and subs

5.2 adds subcontracts, commitments, the committed-cost forecast method, minimal sub pay applications with retention, sub change orders, and an insurance expiry prompt on sub pay applications. It builds on M5 change orders. The [5.2 PRD](v5/prd/5.2-contracts-and-subs.md) is the source of scope. The [contracts intel](v5/intel/contracts.md) is the source of claim IDs.

| Version | Target (PT) | Increment | Spec | Migration |
|---|---|---|---|---|
| 5.2.0 | 2026-11-13 | Subcontracts with a vendor, a retention rate, and schedule-of-values lines mapped to cost items. Executing a subcontract commits cost. A commitment over Current Budget needs the executive | [5.2.0](v5/specs/5.2.0-subcontracts-and-commitments.md) | `0024` |
| 5.2.1 | 2026-11-17 | The Committed Cost forecast method: EAC = AC + open commitment, which is the executed commitment when the item has no other cost. An owner change does not move a committed EAC | [5.2.1](v5/specs/5.2.1-committed-cost-forecast.md) | `0025` |
| 5.2.2 | 2026-11-20 | Sub pay applications with retention. Approval posts gross earned to AC once and lowers open commitment | Spec next | `0026` (claim) |
| 5.2.3 | 2026-11-24 | Sub change orders that reference owner change-order lines. Pending sub exposure shows next to EAC | Spec next | `0027` (claim) |
| 5.2.4 | 2026-12-01 | Retention release capped at retention held, and subcontract close-out | Spec next | `0028` (claim, if needed) |
| 5.2.5 | 2026-12-03 | Insurance expiry prompt on sub pay applications. When the sub's liability certificate has expired, submit asks for a current certificate in the same flow. The reviewer sees current, renewed, or expired. Submit and approval are not blocked | [5.2.5](v5/specs/5.2.5-insurance-expiry-prompt.md) | `0029` (claim) |

5.2.3 lands before Thanksgiving Day (2026-11-26). 5.2.4 lands the Tuesday after, and 5.2.5 that Thursday. Specs for 5.2.2 to 5.2.4 are due by 2026-11-13, when 5.2.0 enters verify. 5.2.5 needs 5.2.2 on `main`.

Joshua decided the insurance question on 2026-10-26: no hold on pay applications. Contracts intel recommendation 5 proposed refusing approval after expiry. 5.2.5 prompts for a current certificate at submit instead, and shows the state to the reviewer. See the [PRD decision](v5/prd/5.2-contracts-and-subs.md#insurance-decision-2026-10-26).

## Later releases

Each later release needs an intel doc on the matching InEight module before its PRD. None of those intel docs exist yet. The intel for 5.3 is due by 2026-11-20 so its PRD can land with 5.2.2.

| Release | Window (PT) | Module | Builds on |
|---|---|---|---|
| 5.3 | 5.3.0 by 2026-12-08, then weekly to 2027-01-08 (skipping 2026-12-24 to 2027-01-01) | **Document control.** Drawings and specs with revisions, transmittals, and RFIs and submittals tied to documents. Plan section 3 maps it to InEight Document, "auditable document control" | Projects |
| 5.4 | January to early February 2027 | **Compliance.** A form builder, inspections, incidents, and mobile offline capture. Plan section 3 maps it to InEight Compliance (safety, quality, and environmental forms) | M3 mobile field views |
| 5.5 | February 2027 | **Owner billing and portfolio reporting.** Owner billing on AIA G702 and G703, and portfolio reporting beyond the portfolio earned value that 5.0.0 started. Plan section 3 maps it to InEight Report & Explore | Budget, field progress, 5.2 retention |

The windows are forecasts. Each PRD sets its own increment dates.

## Horizon past 5.5

The plan does not stop at 5.5. From plan section 9, and from the 2026-10-24 decisions on equipment and hours per worker, 5.6 and later cover accounting and payroll export and cost depth. Order and windows (PT):

| Release | Window | What | Builds on |
|---|---|---|---|
| 5.6 | March 2027 | **Payroll and accounting export of approved hours.** Hours per named worker on the daily report, then an export file of approved hours and approved sub pay applications for the contractor's payroll and accounting system. Export only. Pitbull does not run payroll or post a ledger | M3 daily reports, 5.2 pay applications |
| 5.7 | April 2027 | **Equipment rates.** Equipment on a plan line carries an hourly rate, so approve posts equipment cost to AC. Plans already show equipment hours | M3, M4 |
| 5.8 | May 2027 | **Work packaging.** Group cost items and activities into work packages for the field, with quantities and hours rolled up per package | M3, 5.1 |
| 5.9 | June 2027 | **Estimating depth.** Resources and assemblies behind cost items, so an estimate builds from crews, equipment, and materials | M2 |

These windows hold the two-week floor and assume the current pace slows as modules get larger. They get dates when their PRDs land.

The fresh-start plan names the following items with no release assigned. Each needs its own product decision before it gets a version:

- Model: 3D models with live data. Plan section 3 says "Not planned (needs its own decision)".
- From the plan's out-of-5.0.0 list: AP and AR, AI, digital twin, integrations, and multi-company admin.

## Migration numbers

Drizzle's journal is contiguous. A number is a claim, not a file. A migration merges only after every lower claimed number is on `main`, or the later PR renumbers to the next free number when it rebases.

| Number | Owner | State |
|---|---|---|
| `0017` to `0020` | 5.0.3 Parts B, D, F; 5.1.0-a | On `main` and applied on staging |
| `0021` | 5.1.0-d ([#41](https://github.com/jgarrison929/pitbull/pull/41)) | Open |
| `0022` | 5.1.1 `activity_links` | Reserved. No PR yet. If [#36](https://github.com/jgarrison929/pitbull/pull/36) is ready first, #36 takes `0022` and 5.1.1 takes the next free number |
| `0023` | 5.1.2-a ([#36](https://github.com/jgarrison929/pitbull/pull/36)) | Open |
| `0024` | 5.2.0-a | Claimed by the [5.2.0 spec](v5/specs/5.2.0-subcontracts-and-commitments.md) |
| `0025` | 5.2.1-a | Claimed by the [5.2.1 spec](v5/specs/5.2.1-committed-cost-forecast.md) |
| `0026` to `0028` | 5.2.2 to 5.2.4 | Claimed by the [5.2 PRD](v5/prd/5.2-contracts-and-subs.md) |
| `0029` | 5.2.5-a | Claimed by the [5.2.5 spec](v5/specs/5.2.5-insurance-expiry-prompt.md) |

5.1.3 adds no migration (none of [#35](https://github.com/jgarrison929/pitbull/pull/35), [#38](https://github.com/jgarrison929/pitbull/pull/38), or [#39](https://github.com/jgarrison929/pitbull/pull/39) has one). If it needs an import audit table later, it takes the next free number then.
