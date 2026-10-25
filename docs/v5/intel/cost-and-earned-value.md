# Competitive intel: cost and earned value (M4)

Status: research for M4, written 2026-10-21 (PT), checked against `main` at `48143aa6`. Sources are public InEight pages only. No logins, trials, or gated material. Includes a check of the earned value math that landed in #645.

Every claim about InEight has an id (`C1` and so on) and a source tag (`[S1]` and so on) that points to [Sources](#sources). Deductions are in [Inference](#inference-what-we-deduced) (`I` ids). Gaps are in [Unknowns](#unknowns) (`U` ids). Figures in [Acceptance checks](#acceptance-checks) and in the check of #645 are example data that we made up for the checks, unless they cite the #645 seed trace. They are not InEight or customer figures.

## Scope: what M4 means in Pitbull

- M4 is "PV/EV/AC, CPI/SPI, EAC with 2 forecast methods, S-curve, portfolio rollup, drill-down". It is verified by "unit tests for the EV math on a hand-computed fixture, and e2e numbers matching the seeded expectations" ([fresh-start plan §9](../fresh-start-plan.md#9-milestones-each-shippable-and-verifiable)).
- Plan §4 step 5 defines the math. PV is time-phased linearly between each cost item's planned start and finish. EV is budget × quantity percent complete. AC is hours × crew rates + equipment + cost entries. EAC and ETC use a per-item forecast method: current budget or average performance. Drill-down goes from project to WBS to cost item to daily reports.
- Built on `main` (#645, #640, #647): three earned value methods per cost item (`units`, `milestones`, `pm_percent`), a PM lock that freezes each item's claim per period, AC from `cost_entries`, linear PV, CPI and SPI with one status rule, job and portfolio rollups in SQL over leaf cost codes.
- Not built: per-item forecast methods, ETC, the S-curve, WBS-level summaries, and the link from a cost item to its daily reports.

## What InEight does

Budgets and values:

- C1. Control keeps an original budget (read-only after it is set), a current budget (original ± approved changes), and a current estimate (editable at any time with no approval) [S1].
- C2. EV = PV × percent of work completed. Control shows it as CE cost earned, CE MHrs earned, CB cost earned, and CB MHrs earned, so EV exists for both cost and man-hours [S1].
- C3. Percent complete = quantity claimed ÷ Forecast (T/O) quantity. Changing the Forecast (T/O) quantity changes percent complete, earned value, and the forecast [S1].
- C4. A project setting decides whether an individual cost item's percent complete divides by Forecast (T/O) quantity or by CB total quantity [S4].
- C5. Productivity = earned MH ÷ actual MH. Compensation factor = budgeted MH cost ÷ actual MH cost. LEI = productivity ÷ compensation factor [S1].
- C6. Control calls cost variance "Gain/Loss": EV − AC, for cost and for man-hours [S1].

Indices:

- C7. CPI = CE or CB cost earned ÷ actual cost to date [S3].
- C8. SPI = CB cost earned ÷ CB planned value to date. Planned value to date is the cumulative time-phased budget, and SPI needs time-phased budgeting turned on [S1][S3].
- C9. Time-phased budget spreads each cost item's current budget between its start and finish dates by a cost curve, in fiscal months. A linear curve puts about the same amount in each period, with more in longer months [S5].
- C10. Cost items without dates can default to the current fiscal period or to the project's start and end dates [S5].

Rollups:

- C11. A parent's percent complete is calculated at the parent, not summed from children. Settings choose cost or quantity as the basis and the weighting. With cost basis and current-budget weighting, a parent with $500 CB earned of $1,000 CB total is 50% [S4].
- C12. Parent cost items use the Rollup forecast method: the sum of the children's forecasts. A global forecast method change applies only to terminal items, and parents stay on Rollup [S2].

Forecast methods, set per cost item and changeable at any time [S2]:

- C13. Current Budget: actual total cost + CB unit cost × quantity remaining. [S2]
- C14. Current Estimate: actual total cost + CE unit cost × quantity remaining. [S2]
- C15. Average Performance: actual total cost + actual unit cost × quantity remaining. Its settings choose the actuals window: all dates, the most recent N weeks or months, a date range, or from a date onward. [S2]
- C16. Also listed: Manual, Rollup, Committed Cost (actual cost + open committed cost), None, Contract, Detailed ETC, static manual time-phased, and Custom. [S2]
- C17. Forecast final cost = total cost to date + forecast remaining cost [S11].

Periods and claims:

- C18. A manual quantity claim has a posted date, and negative quantities are allowed [S9].
- C19. Field quantities reach Control through a sync of claimed quantities. The documented cadence is weekly, after payroll cost is imported. Hours must go through payroll processing before Control pulls them [S10].
- C20. A Live Forecast snapshot is saved each month. If no one takes one manually, the system saves one on the month-end day [S8]. Snapshots include actuals for the current month. Actuals posted with next-period dates appear only after "plus days" end [S7].
- C21. The FAQ answer to "My forecast calculations are wrong!" is to check whether the organization is in plus days, and if so to exclude actuals posted after the month-end date [S4].

Reporting:

- C22. Time-phased forecasting spreads remaining forecast by cost curve and dates, and produces cash flow and man-hour curves [S6][S11].
- C23. After a change order is approved, InEight suggests moving its items to the Current Budget method so the forecast uses only approved costs [S13].

## Workflow and math

The table restates C1 to C17 for one cost item, with Pitbull's names.

| Quantity | InEight | Pitbull on `main` |
|---|---|---|
| Percent complete | qty claimed ÷ Forecast (T/O) qty, or ÷ CB qty by setting (C3, C4) | claimed qty ÷ budget qty (units), sum of completed milestone weights, or PM percent |
| EV | PV (budget) × percent complete, cost and MH (C2) | budget × percent, cost only |
| CPI | EV ÷ AC to date (C7) | EV ÷ AC. Line: `null` when AC = 0. Rollup: 1 when AC = 0 |
| SPI | EV ÷ PV to date, time-phased (C8) | EV ÷ PV. PV linear by calendar day, as of today |
| Cost G/L | EV − AC (C6) | `varianceCents` = EV − AC |
| Parent percent | computed at parent, cost-weighted by CB in the FAQ example (C11) | job percent = ΣEV ÷ ΣBAC over leaves |
| Forecast | per item by method, parents sum children (C12 to C17) | job only: BAC ÷ CPI |

## Inference: what we deduced

- I1. For an item where percent complete p = claimed qty ÷ qty and unit costs are constant, C13 reduces to EAC = AC + (BAC − EV), and C15 reduces to EAC = AC ÷ p = BAC ÷ CPI for that item. So Pitbull's BAC ÷ CPI is the Average Performance forecast for a single item. It is not the job's forecast, because the sum of per-item forecasts differs from job BAC ÷ job CPI.
- I2. For `milestones` and `pm_percent` items, which have no quantity, the same forms apply if "quantity remaining" is read as (1 − p) × quantity. Then Current Budget gives AC + BAC × (1 − p), and Average Performance gives AC ÷ p.
- I3. InEight's month-end snapshot and plus days (C20, C21) exist so that EV, AC, and forecast share one cutoff. Pitbull's PM lock is the same idea, but only EV is frozen at the lock today.
- I4. Daily linear PV over calendar days is finer than InEight's monthly buckets (C9), and it is enough for the S-curve the plan asks for.

## Unknowns

- U1. Unknown: whether InEight caps percent complete or EV at 100% when claimed quantity exceeds Forecast (T/O) quantity.
- U2. Unknown: what Average Performance returns when an item has actual cost but no claimed quantity.
- U3. Unknown: how InEight defines "Remaining". The measurement page gives PV − AC in its text and "difference between planned value and earned value" in its summary table [S1].
- U4. Unknown: whether CPI is shown when actual cost is zero.

## Where Pitbull can be simpler, faster, or more trustworthy

1. **One cutoff for every number.** The job page and portfolio show EV, AC, and PV as of the last locked claim, and show changes since the lock as a separate "since lock" figure. This is InEight's snapshot idea (C20) without plus days.
2. **Per-item forecasts that add up.** Two methods only: Current Budget and Average Performance (C13, C15). Each item's EAC is shown, and the job's EAC is their sum (C12). New change-order items start on Current Budget (C23), which makes the M5 verify check pass (see [change-orders.md](change-orders.md)).
3. **Show the derivation.** #645 already stores a derivation string per item ("units complete: 248 of 620 CY installed"). Extend it to the forecast: "EAC $1,346,820 = $538,728 ÷ 40.0% (average performance)". InEight shows forecast values in grid columns (C17), and we found no public page that shows the arithmetic next to the number.
4. **Earned hours next to earned dollars.** Pitbull already stores budget MH per unit, so earned MH = claimed qty × budget MH per unit costs nothing to add. It gives the foreman (M3) and the PM the same productivity number (C5).
5. **Leave out for 5.0.0:** Current Estimate as a third value set, committed cost and contract methods (5.2), time-phased forecasting, cost curves, and Average Performance date windows.

## Check of #645

#645 added the three earned value methods, the PM lock, and AC from cost entries (`v5/src/lib/ev.ts`, `v5/src/server/progress.ts`, `v5/src/server/data.ts`). Later PRs moved the rollups into SQL (`v5/src/server/cost-rollups.ts`, #647) with the same formulas. Function names refer to `main` at `48143aa6`.

Where it matches InEight:

- EV = budget × percent complete (C2). Units EV uses claimed quantity ÷ budget quantity, which matches C3 and C4 when the CB-quantity setting is chosen. The exact-fraction rule ($868,000 × 248 ÷ 620 = $347,200, no rounding of the percent first) is sound.
- CPI = EV ÷ AC (C7). SPI = EV ÷ PV (C8). Cost variance = EV − AC (C6).
- Job percent complete = ΣEV ÷ ΣBAC over leaf items. This matches the FAQ example with cost basis and current-budget weighting (C11). Summary WBS rows are excluded from the sums, so nothing counts twice.
- C24. InEight's rules of credit give each step of a component a weight, and completed steps claim that share of the quantity [S12]. Pitbull's weighted milestones match this at the cost item level.
- The PM lock that freezes claimed quantity and percent per period, with live installs shown as pending, matches the intent of period snapshots (C20, I3).

Where it differs. Severity: High means a normal demo flow shows a wrong or misleading number. Medium means a reachable input does, or a plan requirement is missing. Low means an edge case or upkeep risk.

| # | Severity | Finding | Where |
|---|---|---|---|
| D1 | High | **Mixed cutoffs.** EV is frozen at the last lock, AC moves with every report, and PV is recomputed as of today on every read. Between locks, SPI falls every day and CPI falls with every report even when the crew is on plan. InEight compares EV and PV to date and closes periods with snapshots (C8, C20). | `lockProgressClaim` and `postDailyReport` in `progress.ts`, `lineAsOfToday` in `data.ts`, `plannedAsOfSql` in `cost-rollups.ts` |
| D2 | High | **EAC is BAC ÷ CPI at job level.** There is no per-item method, no ETC, and no Current Budget method. The job value differs from the sum of item forecasts (I1). It also makes the M5 verify check fail: a +ΔB change moves EAC by ΔB ÷ CPI. | `rollup` in `ev.ts`, `getPortfolio` in `data.ts`, `toRollup` in `cost-rollups.ts` |
| D3 | Medium | **AC includes unapproved hours.** A foreman's report writes `cost_entries` and refreshes actual cost at once. InEight brings in hours only after approval and payroll (C19). | `postDailyReport`, `refreshCostItemActuals` in `progress.ts` |
| D4 | Medium | **Units EV is not capped at budget.** The lock clamps `claimed_percent_milli` to 100%, but `earnedCentsOf` uses the unclamped `claimed_installed_qty_milli`. If installed quantity passes budget quantity, EV exceeds BAC, and the stored percent (100%) disagrees with EV. Report quantity is limited only to 10,000,000. | `earnedCentsOf`, `snapshotClaimPercent` in `ev.ts`, `earnedSql` in `cost-rollups.ts`, `REPORT_LIMITS` in `plan-line.ts` |
| D5 | Medium | **No earned man-hours.** InEight earns cost and MH (C2) and reports productivity (C5). Pitbull earns dollars only, so the M3 gain/loss in hours has no M4 counterpart. | `CostLine` in `ev.ts` |
| D6 | Low | **One labor rate.** Every reported hour costs $85.00 (`DEFAULT_LABOR_RATE_CENTS`). The plan says hours × crew rates. C25: InEight costs labor as hours × each employee's hourly rate [S14]. | `ev.ts`, `postDailyReport` |
| D7 | Low | **UTC as-of date.** PV takes its date in UTC. After 5 PM PDT the server already uses tomorrow's date for a Pacific job. | `plannedValueCents` in `ev.ts`, `jobRollupSql` in `cost-rollups.ts` |
| D8 | Low | **Rollup CPI and SPI default to 1.** At job level, AC = 0 gives CPI 1.00 (shown as on track) even when EV > 0. The line level returns `null` for the same case. | `rollup` in `ev.ts`, `toRollup` in `cost-rollups.ts` |
| D9 | Low | **Stale next-period draft.** After a lock, the new draft claim's lines copy `claimedPercentMilli` from rows read before the lock updated them, so the draft shows the previous period's percent. EV is not affected. | end of `lockProgressClaim` in `progress.ts` |
| D10 | Low | **Milestone weights can sum to anything.** No check makes an item's weights total 100%. An item with weights summing to 90% can never reach 100%. | `cost_item_milestones`, `snapshotClaimPercent` |
| D11 | Low | **One formula in three places.** CPI, SPI, and EAC are computed separately in `ev.ts`, `data.ts`, and `cost-rollups.ts`. A fix to one can miss the others. | as listed |
| D12 | Low | **Units item with zero budget quantity earns nothing.** `earnedCentsOf` falls back to the claimed percent, which the units snapshot sets to 0. | `earnedCentsOf`, `snapshotClaimPercent` |

## Acceptance checks

Checks 1 to 6 test the M4 math. Checks 7 to 14 would catch D1 to D12. Item 04-210 values come from the #645 seed trace (budget $868,000, 620 CY, 248 CY claimed, AC $538,728). Everything else is example data.

1. **Current Budget forecast.** Input: 04-210 on Current Budget. Action: compute. Expected: EAC = $538,728 + $1,400.00 × 372 = $1,059,528. ETC = $520,800.
2. **Average Performance forecast.** Input: 04-210 on Average Performance. Expected: EAC = $538,728 × 620 ÷ 248 = $1,346,820. ETC = $808,092.
3. **Job EAC is the sum of item EACs.** Input: 04-210 on Average Performance, plus item B with BAC $900,000, EV $0, and AC $0. Expected: job EAC = $1,346,820 + $900,000 = $2,246,820. Today's BAC ÷ CPI gives $2,743,292.35, so this check fails on `main`.
4. **No progress falls back to Current Budget.** Input: item B on Average Performance. Expected: EAC $900,000, labeled as a fallback, not a division by zero.
5. **Earned man-hours.** Input: 04-210 with 1.600 budget MH per CY and 248 CY claimed. Expected: earned 396.8 MH. With 420.0 actual MH, productivity = 396.8 ÷ 420.0 = 0.94 and MH G/L = −23.2 MH.
6. **S-curve totals.** Input: any seeded job. Expected: the last point of cumulative PV equals BAC, and each day's cumulative EV and AC equal the job tiles for that date.
7. **D1, one cutoff.** Input: item with budget $100,000, planned 2026-10-01 to 2026-10-11, locked on 2026-10-06 at 50%. Action: read the job page on 2026-10-09 with no new lock. Expected: EV $50,000 and PV $50,000 as of 2026-10-06, SPI 1.00. On `main` today, PV is $80,000 and SPI is 0.625.
8. **D2, change order moves EAC by its amount.** See check 4 in [change-orders.md](change-orders.md).
9. **D3, unapproved hours stay out of AC.** Input: a foreman reports 22.0 MH on a submitted plan. Expected: AC unchanged until a superintendent approves.
10. **D4, EV never exceeds budget.** Input: 04-210 with 700 CY installed, then lock. Expected: EV ≤ $868,000, the stored percent equals EV ÷ BAC, and the job page flags 80 CY over budget quantity.
11. **D7, Pacific date.** Input: as-of 2026-10-21 18:00 PDT (2026-10-22 01:00 UTC). Expected: PV uses 2026-10-21.
12. **D8, no fake on-track index.** Input: a job with EV $10,000 and AC $0. Expected: CPI shows "—", not 1.00.
13. **D10, weights total 100%.** Input: milestones weighted 50% and 40% on one item. Action: save. Expected: refused.
14. **D11, one source of truth.** Input: the seeded portfolio. Expected: for every job, the TypeScript rollup over lines and the SQL rollup return identical cents for BAC, PV, EV, AC, and EAC.

## Sources

- [S1] InEight Control, Progress Measurement Overview. https://learn.ineight.com/Control/Content/2-Progress%20and%20Forecasting/1%20Measurement/2.1.2%20OverviewMeasurement.htm
- [S2] InEight Control, Forecast Methods. https://learn.ineight.com/Control/Content/2-Progress%20and%20Forecasting/3%20Forecasting/2.3.3%20ForecastMethods.htm
- [S3] Review CPI and SPI. https://learn.ineight.com/integrated_solutions/Content/Business-Processes/Earned-Value-Management/review-performance/review-performance-CPI-SPI.htm
- [S4] InEight Control, Frequently Asked Questions. https://learn.ineight.com/Control/Content/Categories/FAQ-Control.htm
- [S5] InEight Control, Time-phased budget. https://learn.ineight.com/control/content/3-Budget/2%20RevenueManagement/3.2.9%20Time%20phased%20budget.htm
- [S6] Analyze Earned Value and Forecasts. https://learn.ineight.com/integrated_solutions/Content/Business-Processes/Budget-Management/Analyze-Earned-Value-and-Forecasts.htm
- [S7] InEight Control, Live Forecast Snapshot. https://learn.ineight.com/Control/Content/2-Progress%20and%20Forecasting/3%20Forecasting/2.3.9%20LiveForecastSnapshots.htm
- [S8] Close Monthly Cycle. https://learn.ineight.com/integrated_solutions/Content/Business-Processes/Budget-Management/Close-Monthly-Cycle.htm
- [S9] InEight Control, Actuals by Manual Entry. https://learn.ineight.com/control/Content/2-Progress%20and%20Forecasting/1%20Measurement/2.1.7%20ActualsManualEntry.htm
- [S10] Claim In Plan and Progress. https://learn.ineight.com/integrated_solutions/Content/Business-Processes/Earned-Value-Management/record-actuals/claim-in-InEIght-Plan-and-Progress.htm
- [S11] InEight Control, Time Phased Forecasting. https://learn.ineight.com/control/Content/2-Progress%20and%20Forecasting/3%20Forecasting/2.3.6%20TimePhased.htm
- [S12] InEight Plan, Plan Quantity Tracking Overview. https://learn.ineight.com/Plan/Content/Quantity/1-Overview/1%202%20Plan%20Quantity%20Tracking.htm
- [S13] Review Budget and Forecast Changes. https://learn.ineight.com/integrated_solutions/Content/Business-Processes/Change-Order-Management/accept-change-into-budget-forecast/review-budget-and-forecast-changes.htm
- [S14] InEight Progress, Input Actuals. https://learn.ineight.com/Progress/Content/Daily%20Planning%20Mobile/Daily%20Plan%20Execution/InputActuals.htm
