# Pitbull roadmap

Status: checked against `main` at `9f7f9342` on 2026-10-25 at 11:08 AM (PT). This is a plan, not a promise. Versions and order move when evidence comes in.

Pitbull is a construction project controls platform. The scope, the trust bar, and the InEight positioning are in the [fresh-start plan](v5/fresh-start-plan.md). The milestone history of 5.0.0 (M0 to M6) is in [Roadmap 5.0.0](roadmap-5.0.0.md).

## How versions work

Public versions are `5.<feature>.<increment>`.

- The feature number names one module: 5.0 is the core loop, 5.1 is Schedule, 5.2 is Contracts and subs, and so on.
- The increment number counts demo-able releases inside that module. 5.0.1 is the first increment after 5.0.0.
- Each increment fits in one cloud-agent PR or a few parallel ones. It merges through `ci-gate`, deploys to staging, and passes Pitbull Verify on staging before release.
- A release moves `v5/package.json` to the new version and adds the matching entry to `v5/src/content/changelog.ts`. The `/changelog` and `/status` pages read those.

Increments ship as soon as each one passes `ci-gate` and Pitbull Verify on staging. The target dates below are forecasts from observed velocity, not a fixed calendar.

**Evidence.** M1 through M5 merged on `main` between 2026-10-18 and 2026-10-24. 5.0.1 Parts A and B merged and tagged the same day (2026-10-25). 5.0.2 Parts A, B, and C all merged on 2026-10-25. That is same-day increments when work is split across parallel PRs. Build capacity through about 2026-10-27 supports 3 to 5 independent slices at once. 5.0.3 and 5.1.0 may run in parallel.

**Floor.** Trust bar item 4 still holds: at least one release every two weeks. That is a floor, not the pace. Skip a target only when it lands on Thanksgiving Day (2026-11-26) or between 2026-12-24 and 2027-01-01. A release that misses the gate slips to the next open day. It never ships early with gaps.

## Just shipped: 5.0.0

5.0.0 is the M1 to M5 work: the role-card demo, per-visitor sandboxes, estimate to budget, the field daily plan and report, cost and earned value, and change orders.

Status: **shipped** on 2026-10-24.

- #690 moved the `production` branch to `4f40243f` at 7:11 PM PT.
- The tag `v5.0.0` points at `4f40243f`. The Pitbull 5.0.0 release was published at 7:12 PM PT.

Evidence: the staging verify of `4f40243f` passed on 2026-10-24 at 4:08 PM PT. The run covered the following:

- `verify-v5` passed 24 of 24 checks.
- The nav crawl loaded 128 pages (4 roles, 8 pages, 4 viewports). It found no 4xx or 5xx responses, no error boundaries, and no banned strings. The slowest page took 1,316 ms.
- M2: a CSV import and approve on 26-010 matched the fixture total, and all 5 bad CSVs were refused.
- M4 and M5: on 25-031, EAC equals AC + (CB − EV) exactly, and approving CO-001 moved Current Budget and EAC by exactly $60,000.00.

Before 5.0.0, the in-app changelog used milestone labels. All of them ship inside 5.0.0:

| Old label | Date (PT) | What it added |
|---|---|---|
| `5.0.0-m0` to `5.0.0-m1.4` | 2026-10-18 to 2026-10-21 | Rails, the shell, the role-card login, sandboxes, the portfolio, the cost-code tree, field actuals, and an honest `/status` |
| `5.0.0-m2.1` | 2026-10-21 | Original Budget, Current Budget, and Current Estimate, plus Approve estimate |
| `5.0.0-m3` | 2026-10-21 | Superintendent approve and return. Cost posts once, on the plan date |
| `5.0.0-m4.0` | 2026-10-22 | One cutoff for EV, AC, and PV. Per-item forecasts and ETC |
| `5.0.0-m5.0` | 2026-10-22 | Change orders that revise Current Budget |
| `5.0.0-m5.1` | 2026-10-23 | CSV estimate import, with Original Budget and Current Budget views |
| `5.0.0-m5.2` | 2026-10-23 | Honesty fixes for drafts, units, and refusal labels |

Loose ends from the 5.0.0 release day, and how they closed:

- Production domain verify for 5.0.0 was not linked on release day. The 5.0.1 production verify on 2026-10-25 (below) covers `demo.pcserp.app` and `app.pcserp.app` on the rebuild.
- The `release.yml` run for `v5.0.0` failed at "Validate tag matches VERSION". #692 set `VERSION` to `5.0.0` on `main` at 7:15 PM PT.
- `v5/package.json` at the 5.0.0 tag read `5.0.0-m5.2`. It was corrected to `5.0.0`, then bumped to `5.0.1` with that release.

## Just shipped: 5.0.1

5.0.1 is **The superintendent builds the day's plan, and a public /roadmap page** (crews + create/add/remove lines + public `/roadmap`).

Status: **shipped** on 2026-10-25 at 5:50 AM PT.

- Tag `v5.0.1` at `05246e2e`, published 2026-10-25 at 5:50 AM PT (`publishedAt` 2026-10-25T12:50:07Z).
- Part B #700 (public `/roadmap`) merged 2026-10-24 at 8:22 PM PT.
- Part A #699 / #701 (crews + create/add/remove plan lines) merged 2026-10-25.

Evidence: production verify on #701 (2026-10-25 at 6:03 AM PT). Production `https://demo.pcserp.app` served tag `v5.0.1` = `05246e2e`. `verify-v5` passed **37/37**. `/health` and `/status` on both `demo.pcserp.app` and `app.pcserp.app` showed version 5.0.1, `ci-gate` pass, and migrations through `0014_crew_labor_rate`.

## Just shipped: 5.0.2

5.0.2 is **Crew labor rates, seeded field history, and drill-down from a cost item to its daily reports**.

Status: **version stamped** for **2026-10-26**. `v5/package.json` and root `VERSION` read `5.0.2`. Public `/changelog` and `/roadmap` list 5.0.2 as shipped. Tag `v5.0.2` after staging verify passes Part C crawl check 4 ([release closeout](v5/specs/5.0.2-crew-rates-and-field-history.md#release-closeout)).

| Part | PR | Merged (PT) | Notes |
|---|---|---|---|
| A. Crew labor rates | #707 | 2026-10-25 at 12:55 AM | Migration `0014` |
| B. Seeded field history | #713 | 2026-10-25 at 7:14 AM | Merge commit `b836e49c` |
| C. Drill-down | #706 | 2026-10-25 at 9:31 AM | Merge commit `9114836a` on `main` |

## In flight

| Work | What | State |
|---|---|---|
| #715 | Bake demo reset history into one pipelined transaction | Open, ci-gate green, with Verify |
| #717 | Job page query budget under seeded field history | Open, ci-gate green, with Verify |
| 5.0.3 Parts A, B, C | S-curve (`server/curve.ts`), Average Performance (`0017`), dark theme | Builders running |
| 5.1.1 CPM engine | Pure library (checks 1 to 6 plus performance). No database or UI in that slice | Builders running |

## Next: finish the 5.0 core loop

The fresh-start plan promises each item below in the 5.0.0 demo story (section 4) or the trust bar (section 2). 5.0.1 and 5.0.2 shipped. The rest of 5.0.x ships before or alongside early 5.1 slices, for three reasons:

1. The trust bar says 5.0.0 "must pass all of it". 5.0.0 shipped without a dark theme (item 5), and the five-minute demo still has gaps in step 5. Closing the promised loop comes before or with the first Schedule screens.
2. 5.1 Schedule moves planned value onto baseline schedule dates. The S-curve is where that change shows. Without the S-curve, 5.1 has nothing to demo its main number on.
3. Observed velocity supports parallel slices. 5.0.3 and 5.1.0 may run at the same time when file ownership does not collide.

**5.0.4 (added 2026-10-25 at 8:10 PM PT).** Joshua's review said the app does not show what to do next and is crowded on phones. That misses trust bar item 5, so it is a 5.0 increment, sequenced after 5.0.3 and built on 5.0.3 Part C (dark theme). Target 2026-10-30: two days after 5.0.3, matching the one-to-two-day pace of 5.0.1 to 5.0.3. Its slices (5.0.4-0, already in flight via the Pitbull lead, then 5.0.4-a to 5.0.4-g) add no migration, so they run beside 5.1.0. The 5.1 dates do not move.

| Version | Target (PT) | Increment | Spec |
|---|---|---|---|
| 5.0.3 | 2026-10-28 | The S-curve for each job and the portfolio, Average Performance selectable per cost item, and the dark theme | [5.0.3](v5/specs/5.0.3-s-curve-and-forecast-methods.md) |
| 5.0.4 | 2026-10-30 | Clear next steps for each role, a plain purpose line on every page, and a phone layout with one main number per card | [5.0.4](v5/specs/5.0.4-clear-next-steps-and-mobile-polish.md) |

How each gap was placed:

| Gap on `main` | Promised for 5.0? | Placed in |
|---|---|---|
| The superintendent can't create a plan or add lines. Plans come only from the seed | Yes, section 4 step 4 | 5.0.1 (shipped) |
| No public roadmap in the app | Yes, trust bar item 6 | 5.0.1 (shipped) |
| Labor costs a flat $85.00 per hour (`DEFAULT_LABOR_RATE_CENTS`) | Yes, section 4 step 5: "hours × crew rates" | 5.0.2 (shipped) |
| The seed has 2 daily plans and no approved report history. Section 8 asks for 30 to 60 days | Yes, section 8 | 5.0.2 (shipped) |
| No drill-down from a cost item to its daily reports | Yes, section 4 step 5 | 5.0.2 (shipped) |
| The job's "Changes" list shows the last 20 entries with no way to see older ones | Yes, "an audit log for every state change" | 5.0.2 (shipped) |
| No S-curve | Yes, section 4 step 5 and M4 | 5.0.3 Part A |
| No dark theme. `globals.css` defines a `.dark` variant, but nothing in `v5/src` turns it on | Yes, trust bar item 5 | 5.0.3 Part C |
| One forecast method. #675 removed Average Performance because no screen could select it | Yes, section 4 step 5 names two methods | 5.0.3 Part B (`0017`) |
| Plan history shows actor names and drops intermediate returns when columns overwrite | Honesty of the plan audit trail | 5.0.3 Part D (`0018`) |
| Rail unknown-job lists every sandbox job, including drafts | Clear refusal with real choices | 5.0.3 Part E |
| Legacy `daily_plans.crew` text and nullable `crew_id` from expand-only `0013` | Crews contract | 5.0.3 Part F (`0019`) |
| No page says what to do next. The foreman lands on an assistant log, every role sees CPI, SPI, and dollar risk first, and phone pages render wider than the screen (Joshua review, 2026-10-25 at 8:00 PM PT) | Yes, trust bar item 5 | 5.0.4 |
| Equipment hours on a plan cost nothing | Section 4 step 5 said "+ equipment". Decision 2026-10-24 | 5.6+ cost depth |
| The foreman reports total man-hours per line, not hours per worker | Section 4 step 4. Decision 2026-10-24 | 5.6+ payroll export |

## Then: 5.1 Schedule

5.1 adds activities, a Gantt view, dependencies, and CPM-lite. Planned value is "PV dates from the baseline schedule, linear spread". The spread stays the linear one M4 already has. Only the dates move. 5.1 builds on M4's planned value and on the 5.0.3 S-curve. The [5.1 Schedule PRD](v5/prd/5.1-schedule.md) is the source of scope. The [schedule intel](v5/intel/schedule.md) (#691) is the source of claim IDs.

Locked rules for every 5.1 increment:

- Planned value reads baseline dates, never current dates. Current dates drive the Gantt chart and the forecast finish (schedule intel I4).
- A CPM finish date is a full working day. The mapping passes finish + 1 day into `plannedValueCents` (acceptance check 7).
- Approved daily reports drive percent complete. Nobody types it on the Gantt chart (I5).

| Version | Target (PT) | Increment | Spec |
|---|---|---|---|
| 5.1.0 | 2026-10-29 | Activities linked to cost items, one working calendar, a Gantt view, and daily plan lines linked to activities. Cost item current dates follow linked activities | [5.1.0](v5/specs/5.1.0-activities-and-gantt.md) |
| 5.1.1 | 2026-11-03 | Finish-to-start and start-to-start links with whole-day lag, forward and backward pass, total float, and the critical path. A cycle is refused. CPM engine may land as a pure library ahead of UI | [5.1.1](v5/specs/5.1.1-dependencies-and-cpm.md) |
| 5.1.2 | 2026-11-10 | A baseline that cannot be edited. PV and the S-curve read baseline dates with the linear spread. A re-baseline needs a reason | [5.1.2](v5/specs/5.1.2-baseline-and-pv.md) |
| 5.1.3 | 2026-11-17 | XER import, then Microsoft Project XML import, all-or-nothing | [5.1.3](v5/specs/5.1.3-schedule-import.md) |

**Import and plan-line call (2026-10-24).** Daily plan lines link to activities in 5.1.0 (intel recommendation 6). XER and Microsoft Project XML import land as 5.1.3. Native linking is the product edge (I1). Binary `.MPP` stays out (I6). Monte Carlo, risk registers, and markup stay out of 5.1 (recommendation 9).

## Then: 5.2 Contracts and subs

5.2 adds subcontracts, commitments, the committed-cost forecast method, sub change orders, and minimal sub pay applications with retention. It builds on M5 change orders. Plan section 9 doesn't name pay applications. The [contracts intel](v5/intel/contracts.md) (#694) recommends adding them so open commitment drops (recommendation 2, inference I2). The increments stay tentative until the 5.2 PRD sets them.

| Version | Target (PT) | Increment (tentative) |
|---|---|---|
| 5.2.0 | 2026-11-24 | Subcontracts with a vendor, a retention rate, and schedule-of-values lines mapped to cost items. Executing a subcontract commits cost |
| 5.2.1 | 2026-12-04 | The committed-cost forecast method: EAC = total executed commitment (math M3) |
| 5.2.2 | 2026-12-15 | Minimal sub pay applications with retention. Approval posts gross earned to AC and lowers open commitment |
| 5.2.3 | 2027-01-05 | Sub change orders that reference owner change-order lines |

When an approved owner change order adds Current Budget to a cost item on the committed-cost method, the committed EAC wins. The job page shows the owner change as not yet covered until a sub change order for it executes (recommendation 6, acceptance check 10).

The insurance-expiry hold on pay applications (recommendation 5) stays out of 5.2 until Joshua decides.

## Later releases

**5.3 Document control.** Drawings and specs with revisions, transmittals, and RFIs and submittals tied to documents. It builds on projects. Plan section 3 maps it to InEight Document, which the plan describes as "auditable document control".

**5.4 Compliance.** A form builder, inspections, incidents, and mobile offline capture. It builds on the M3 mobile field views. Plan section 3 maps it to InEight Compliance, which covers safety, quality, and environmental forms.

**5.5 Owner billing and portfolio reporting.** Owner billing on AIA G702 and G703, and portfolio reporting beyond the portfolio earned value that 5.0.0 started. It builds on the budget and on field progress. Plan section 3 maps it to InEight Report & Explore.

Dates for 5.3 to 5.5 come with their PRDs.

## Horizon past 5.5

From plan section 9, and from the 2026-10-24 decisions on equipment and hours per worker, 5.6 and later:

- accounting and payroll export of approved hours, including hours per worker on the daily report. It builds on M3.
- Equipment rates on plans, so approve can post equipment cost. Plans already show equipment hours.
- Work packaging. It builds on M3.
- Estimating depth: resources and assemblies. It builds on M2.

The fresh-start plan names the following items with no release assigned. Each needs its own product decision before it gets a version:

- Model: 3D models with live data. Plan section 3 says "Not planned (needs its own decision)".
- From the plan's out-of-5.0.0 list: AP and AR, AI, digital twin, integrations, and multi-company admin.
