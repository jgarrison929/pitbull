# Competitive intel: schedule (5.1)

Status: research for the 5.1 Schedule PRD, written 2026-10-24 (PT), checked against `main` at `709ba5de`. Sources are public InEight pages, public InEight PDFs, and public review sites only. No logins, trials, or gated material.

Every claim about InEight has an id (`C1` and so on) and a source tag (`[S1]` and so on) that points to [Sources](#sources). Math is in `M` ids. Review sentiment is in `R` ids. Deductions are in [Inference](#inference-what-we-deduced) (`I` ids). Gaps are in [Unknowns](#unknowns) (`U` ids). PDF page numbers are page indexes in the PDF file, and they match the printed page labels in the two guides used here. Figures in [Acceptance checks](#acceptance-checks) are example data that we made up for the checks. They are not InEight or customer figures.

## Scope: what 5.1 means in Pitbull

- 5.1 is "Schedule: activities, Gantt, dependencies, CPM-lite; PV from schedule instead of linear", and it builds on M4 PV ([fresh-start plan §9](../fresh-start-plan.md#9-milestones-each-shippable-and-verifiable)). Plan §3 maps InEight Schedule ("CPM, risk analysis") to "5.1: activities, Gantt, CPM-lite; PV from schedule".
- 5.0.0 leaves out "scheduling beyond planned dates" (plan §4). Every release is held to the same trust bar (plan §2, §9).
- State at this commit: each cost item has a required `planned_start_on` and `planned_finish_on` (`cost_items` in `v5/src/db/schema.ts`). `plannedValueCents` in `v5/src/lib/ev.ts` spreads Current Budget linearly by calendar day. It returns 0 on or before the start date and the full budget on or after the finish date. There is no activity, relationship, calendar, or baseline table.
- Daily plan lines carry a free-text `activity` field next to `cost_item_id` (`daily_plan_lines` in `v5/src/db/schema.ts`). Nothing links that text to a schedule.
- No 5.1 PRD exists in the repo yet. This spec feeds it.
- Related specs: [cost-and-earned-value.md](cost-and-earned-value.md) (PV, SPI, time-phased budget), [field-plan-and-progress.md](field-plan-and-progress.md) (daily plans), and [change-orders.md](change-orders.md) (contract adjustments with dates).

## What InEight does

Product shape:

- C1. Schedule is a CPM planning and risk tool with six views: Plan, Markup, Schedule Review, Cost Risk, Short Interval Planning (SIP), and Risk Register [S1, p. 13].
- C2. InEight markets it as CPM software for capital construction that non-specialists can use, and its FAQ answers why to switch from Oracle Primavera P6 [S3]. The capability page lists AI schedule generation from a Knowledge Library and Monte Carlo simulation [S2]. The product page FAQ says Schedule can check a schedule against the DCMA 14-point assessment [S3].
- C3. A customer quote on the product page credits Schedule with "a huge time savings for our schedulers" on the SunZia project [S3].

Roles:

- C4. Organization roles are Schedule creator (planner or scheduler, creates schedules and runs markup and review), Project member (supervisors, foremen, SMEs, subs, customers who contribute), Administrator (super user), and Knowledge base administrator [S1, pp. 27-28].
- C5. Per-schedule contributor roles are Scheduler (edits plan, logic, and resources), Short Interval Planner, Markup, and View Only [S1, pp. 32-33].

Data objects:

- C6. A schedule lives in a project workspace and has a schedule type: Active Estimate, Inactive Estimate, Active Baseline, Inactive Baseline, Re-Baseline, Active Update, Inactive Update, Planned, or What If [S1, p. 39].
- C7. Setting a schedule to Active Baseline locks it read-only in every view, including the Import icon [S1, p. 41].
- C8. The structure is a WBS of planning packages and work packages with activities, milestones, level-of-effort activities, and WBS summary activities [S1, p. 104][S2].
- C9. Logic types are finish-to-start, start-to-start, finish-to-finish, and start-to-finish, with lag. A relationship lag mode setting picks which activity's calendar the lag uses [S1, pp. 111, 175][S2].
- C10. Calendars set working days and holidays, with a default calendar, at the Knowledge Library and project levels. Fill-down applies a calendar, code, or resource to all child elements [S1, pp. 61, 88, 299].
- C11. Activities carry constraints, codes, and user-defined fields [S2].
- C12. Resources have a category (labor, equipment, material), a unit, default units per day, and a cost per unit. A driving resource can set an activity's duration [S1, p. 69][S7].
- C13. Schedule resources are separate from the resources in other InEight products. The FAQ says any coordination is an internal process [S1, p. 300].
- C14. Snapshots copy the whole schedule. There are two snapshot slots per project. A snapshot cannot be edited, and a snapshot can be promoted to its own schedule [S1, pp. 194, 203].
- C15. Variance columns compare the current schedule with a snapshot, and the Gantt chart can show up to two snapshot bars [S1, pp. 189, 202].

CPM settings:

- C16. Settings include data date, Auto CPM, schedule mode (Planning or Scheduling), out-of-sequence progress (Retained Logic, Progress Override, or Actual Dates), and Auto Progress [S1, pp. 173-174, 191-193].
- C17. Critical activities are defined by total float at or below a threshold (default 0 hours) or by longest path. Schedule can compute up to 10 sub-critical float paths [S1, pp. 175-176].
- C18. Planning mode lets planning packages float freely. In Scheduling mode, an activity with no predecessor or constraint is scheduled from the data date [S1, p. 192].

Progress:

- C19. An activity is progressed by a Start toggle, remaining duration, finish date, or percent complete, then a Finish toggle [S1, p. 179].
- C20. Percent complete has three types: duration, units (from resource budgeted units), and physical (typed in, only while the activity is in progress) [S1, pp. 182-185].
- C21. The FAQ says field progress comes in through the review cycle feature [S1, p. 300]. The 26.10 preview adds started, finished, actual dates, and physical percent to the Markup view [S8].

Look-ahead:

- C22. SIP breaks a CPM activity into daily steps with dates, a planner, and SIP resources and quantities. Intervals are 17, 25, or 50 days [S1, pp. 261-263].
- C23. 26.5 added an annotation that flags SIP steps outside the activity's scheduled dates [S9].
- C24. Plan view does not lock records another user changed. 26.10 adds a refresh alert that names who changed the schedule [S8].

Risk:

- C25. Uncertainty (internal, such as productivity) is kept apart from risk events (external, with a probability, a schedule impact, and a cost impact) [S1, p. 229].
- C26. Each line takes one uncertainty source: Inference Engine (AI), Human Intelligence (markup feedback), or Risk Intelligence (preset ranges from "Very Conservative" 50% to 100% to "Very Aggressive" 100% to 150%) [S1, pp. 239-241].
- C27. Distributions are triangular (min, likely, max) or uniform (min, max) [S1, p. 244].
- C28. The risk histogram shows iterations by finish date and the P-value dates. The guide's example has a 6% chance of the deterministic date and a P75 date 161 days later. Criticality % shows how often an activity is critical across Monte Carlo runs. Tornado analysis ranks drivers [S1, pp. 234, 247].
- C29. "Adopt Markup" or "Apply Uncertainty adjustments" writes a risk-adjusted deterministic schedule [S1, p. 235].
- C30. Risk registers import and export in Oracle PRA (Pertmaster) and Deltek Acumen formats [S1, p. 235].
- C31. Cost Risk imports cost items from Schedule, Estimate (.xlsx), or Control (.csv of actual and forecast remaining cost). The contingency it produces is typed back into the estimate by hand [S1, pp. 211, 252].

## Workflow and math

How Schedule reaches cost, progress, and earned value:

- C32. In the 26.3 guide, "the only InEight product integration available is with Estimate" [S1, p. 206]. Estimate cost items become a WBS and activities with their resources. ID, description, and cost are read-only in Schedule, and Schedule dates sync back to Estimate [S1, pp. 206-210][S7].
- C33. The capability page also says Schedule draws advanced work packaging data from Plan & Progress [S2]. The guide makes that depend on linking a Project Suite project and a project setting [S1, pp. 118-119].
- C34. Control gets schedule dates in one of three ways: manual entry, a cost item import, or an XER import. Each cost item's Schedule ID must equal the activity ID [S5].
- C35. When activities are finer than cost items, the documented workaround is to add WBS summary activities with unique IDs, export to Excel, and join the export to a Control import template by hand [S5].
- C36. An XER import into Control brings baseline or current start and finish dates and milestones. Unmapped items stop the import until someone fixes the map, and the import is logged in an audit log [S4][S5].
- C37. Control can push physical percent complete, 25 CBS tags, and 15 user-defined fields back to P6 through an XER export. The page says "this is not an API", so field names are typed by hand [S4].
- C38. Control can take percent complete from an XER into its % Complete column. The XER can come from P6 or from InEight Schedule [S4].
- C39. Control's Schedule data block holds planned dates, actual start and finish, and a cost curve that spreads cost across the dates [S10].
- M1. Duration % complete = elapsed duration ÷ original duration. The guide's example is 5 of 10 days = 50% [S1, p. 182].
- M2. Units % complete = actual units ÷ budgeted units. The guide's example is 50 of 100 MH = 50%. With the recalculate setting on, a 10-day activity at 50% duration with 100 planned units shows 50 actual units [S1, pp. 174, 182].
- M3. Total float is the time a task can slip without moving the project finish. Free float is the time it can slip without moving its successors [S1, p. 176].
- M4. A P75 date means "we are 75% confident in hitting or beating a target goal" [S1, p. 238].
- M5. Control's SPI = CB cost earned ÷ CB planned value to date, and it needs time-phased budgeting. The time-phased budget spreads each cost item's current budget between its start and finish dates by a cost curve (see C8 and C9 in [cost-and-earned-value.md](cost-and-earned-value.md)) [S11][S12].

## Integrations

- C40. Schedule imports full schedules or parts (WBS, activities, logic, codes, UDFs, resource assignments) from Excel, Microsoft Project .MPP, and P6 .XER. It exports P6 .XER, .MPP, and Excel [S2][S1, p. 293].
- C41. XER import keeps WBS summary activities as their own type instead of turning them into planning packages [S1, p. 104].
- C42. Several P6 projects exported as one XER import as one "master" schedule. Schedule has no program level with links across separate schedules [S1, p. 299].
- C43. An XER import can bring history from another schedule: planners, assignments, and short interval plans [S1, p. 301].
- C44. Resource import from Microsoft Project arrived in 25.11. Duplicate resource assignments on one activity arrived in 25.11 for P6 compatibility, with a toggle for P6 XCR files that turn them off [S6].
- C45. 26.3 added driving resources and said they improve P6 and Excel import and export [S7]. 26.5 made XER import faster for large schedules [S9].
- C46. Estimate also has a P6 link of its own. It sends resources and expenses to P6, reads P6 start and finish dates back, and uses "plug days" for duration [S13].
- C47. Since 25.11, Schedule data reaches InEight Report and Explore in near time instead of once a night, and a resource spread export goes to a reporting API [S6].

## Customer praise and complaints

Sample size is small. G2 timed out or answered 403 to our fetches, so it is not in this sample. We read every review on the Capterra InEight page (15 reviews, mostly Estimate and its predecessor Hard Dollar), the TrustRadius InEight page (the reviews shown publicly, plus its summary of 14 recent reviews), and SoftwareConnect (4 reviews). Exactly one independent-site review names InEight Schedule. That is not enough to find a pattern about Schedule. The platform-level complaints below repeat across sites.

- R1. Praise, Schedule. A Pattern Energy reviewer wrote that "on our 80,000-activity SunZia project, scheduling tasks that used to take our team weeks now take minutes" (SoftwareConnect, 2025-11-18) [R-S3]. The same person is quoted on InEight's product page (C3), so this is not an independent voice.
- R2. Praise, Schedule, vendor-published. In an InEight case study, a Kiewit superintendent says Schedule has "a familiar interface similar to Microsoft Project", and that SIP helps when "an activity that's lagging" needs to be split [R-S4]. This is marketing, not a review.
- R3. Praise, integration. A field engineer listed "well integrated features that interface with many different products such as SAP, Excel, P6 etc." (Capterra, 2021-01-12) [R-S2].
- R4. Complaint, navigation. TrustRadius's own summary says 6 of 14 recent reviewers found the interface and navigation "overwhelming or clunky" [R-S1]. An owner's program manager wrote that navigation "isn't always seamless since the system is a combination of a few legacy systems (different links to navigate)" (TrustRadius, 2026-09-30) [R-S1].
- R5. Complaint, complexity. The same review says "some complex functionality cannot be disabled for smaller more basic projects" and implementation "requires strong consulting guidance" [R-S1].
- R6. Complaint, integration between modules. A project controls manager listed "Integration Between Modules" as a con and said the team will "start a better understanding on schedule and estimate in the near future" (TrustRadius, 2025-09-30) [R-S1].
- R7. Complaint, other software. A general manager wrote that "trying to get other programs to work with this software is a challenge" (Capterra, 2020-11-19) [R-S2].

## Inference: what we deduced

These are our readings, not InEight statements.

- I1. **Schedule to cost is a file hand-off in InEight.** Schedule's only native product link is Estimate (C32). Control gets dates by XER or Excel, matched on a Schedule ID that someone types (C34 to C37). A one-model app can link an activity to cost items by key, with no export, map, or re-import.
- I2. **Granularity mismatch is the normal case.** InEight's own guide says activities are usually finer than cost items and works around it with summary activities (C35). Pitbull needs a defined rule for many activities to one cost item, and for one activity to many cost items.
- I3. **PV comes from the budget, not from the schedule engine.** Control computes SPI from the time-phased budget (M5), and the schedule only supplies dates (C34, C39). The plan's "PV from schedule instead of linear" mixes two choices: where the dates come from, and the shape of the spread. InEight's default curve is still linear between the dates (M5).
- I4. **Baseline PV needs frozen dates.** InEight keeps baselines as separate locked schedules (C6, C7) and only two snapshot slots (C14). If PV reads current activity dates, every slip moves PV with it and SPI drifts toward 1.00. SPI is only meaningful if PV reads baseline dates.
- I5. **Percent complete has two owners in InEight.** Control can take percent complete from an XER (C38) or from field quantities (see [field-plan-and-progress.md](field-plan-and-progress.md) C8, C10). For one cost item, those can disagree. Pitbull should let quantities from approved daily reports drive EV and let the schedule only read it.
- I6. **MPP import is the expensive one.** .MPP is a binary Microsoft format, while .XER is a text format and Microsoft Project also saves an XML format. This is general file-format knowledge, not an InEight claim. Starting with XER and Microsoft Project XML covers both tools without a binary parser.
- I7. **Risk is a separate product inside Schedule.** Markup, three uncertainty sources, risk registers, Monte Carlo, and cost risk (C25 to C31) are most of the guide. None of it feeds Control's EV (C31 is typed back by hand). CPM-lite does not need any of it.
- I8. **Concurrent edits are a trust gap.** Plan view does not lock records another user changed (C24). Pitbull can refuse a stale save instead of warning after the fact.

## Unknowns

- U1. Unknown: which XER tables and fields Schedule reads and writes, for example whether activity codes, constraints, calendars with exceptions, and resource curves round-trip.
- U2. Unknown: whether MPP import keeps constraints, calendars, lags in elapsed time, and summary tasks. Public pages list only "WBS items, activities, logic, codes, user-defined fields, and resource assignments" (C40).
- U3. Unknown: the CPM date rules, for example whether durations are in hours or days, and how a start-to-finish link or a negative lag is handled.
- U4. Unknown: whether Control's % Complete column from an XER (C38) changes EV, or only shows next to it.
- U5. Unknown: the Monte Carlo iteration count, the sampling method, and whether results are reproducible with a seed.
- U6. Unknown: whether a baseline keeps an audit trail of who set it and when, beyond the snapshot name.
- U7. Unknown: the largest schedule size Schedule supports. The only public number is the 80,000-activity customer project (R1).
- U8. Unknown: pricing. The product page says it depends on modules, users, and contract terms, with no figures [S3].

## Where Pitbull can be simpler, faster, or more trustworthy

1. **Link activities to cost items in the data model.** An activity has zero or more cost item links. A cost item's PV dates are the earliest start and latest finish of its linked activities. There is no Schedule ID to type and no XER round trip to Control (I1, I2).
2. **Recommendation that changes the plan wording: split "PV from schedule" into two parts.** 5.1 takes PV dates from the baseline schedule. It keeps the linear spread that M4 already has. Resource-loaded or curve-shaped PV waits for a later release. Change "PV from schedule instead of linear" in plan §9 to "PV dates from the baseline schedule, linear spread" (I3).
3. **Freeze PV at the baseline.** Setting a baseline copies activity dates into an immutable record. PV reads baseline dates. Current dates drive the Gantt chart and the forecast finish. A re-baseline is a new record with a reason and an audit row, and the old one stays readable (I4).
4. **CPM-lite means a small, exact engine.** Finish-to-start and start-to-start with whole-day lag, one working calendar per job with holidays, forward and backward pass, total float, and the critical path. Refuse a cycle on save. Leave out finish-to-finish, start-to-finish, multiple calendars, constraints other than "start no earlier than", and resource leveling (C9 to C18).
5. **Field progress stays the one source of percent complete.** Approved daily reports already move quantities (M3). An activity's percent complete is read from its linked cost items. Nobody types it on the Gantt chart (I5).
6. **Link daily plan lines to activities.** Replace the free-text `activity` on `daily_plan_lines` with a link to a schedule activity. The superintendent then sees today's work against the CPM dates, which is SIP without a second planning tool (C22, C23).
7. **Import XER first, then Microsoft Project XML.** Import is all-or-nothing with row errors, like M2 (see [estimate-to-budget.md](estimate-to-budget.md)). Report what did not transfer, for example "12 constraints ignored", instead of silently dropping it (I6, U1, U2).
8. **Refuse stale saves.** Each activity carries a version. A save against an old version is refused with the name of the person who changed it (I8).
9. **Leave out for 5.1:** Monte Carlo, risk registers, markup cycles, AI schedule generation, the Knowledge Library, resource histograms, MPP binary import, and program-level schedules (I7).

## Acceptance checks

Example data for all checks: job 25-031 starts Monday 2026-11-02. The job calendar works Monday to Friday, with a holiday on Thursday 2026-11-26. Durations are in working days. Activities: A "Drive piles" 5 d, B "Pile caps" 3 d (FS after A), C "Pier columns" 4 d (FS after A), D "Cap beam" 2 d (FS after B and C). Cost item 04-210 (Pier column) has Current Budget $868,000 and is linked to C. Dates are inclusive working days.

1. **Forward pass.** Action: schedule. Expected: A 2026-11-02 to 2026-11-06. B 2026-11-09 to 2026-11-11. C 2026-11-09 to 2026-11-12. D 2026-11-13 to 2026-11-16. Job finish 2026-11-16.
2. **Float and critical path.** Expected: total float A 0, B 1 d, C 0, D 0. The critical path is A, C, D.
3. **Start-to-start with lag.** Input: add E "Survey" 2 d, SS +2 d after A. Expected: E 2026-11-04 to 2026-11-05. Job finish unchanged.
4. **Holiday.** Input: change C to 12 d. Expected: C 2026-11-09 to 2026-11-24. D 2026-11-25 to 2026-11-27, skipping the 2026-11-26 holiday.
5. **Cycle refused.** Input: add D → A (FS). Action: save. Expected: refused with the cycle named (A → C → D → A). The schedule is unchanged.
6. **Cost item dates come from linked activities.** Input: link 04-210 to C only. Expected: 04-210 planned start 2026-11-09, planned finish 2026-11-12. Link 04-210 to B as well. Expected: planned start 2026-11-09, planned finish 2026-11-12, because C finishes last.
7. **PV treats the finish date as a full working day.** Input: 04-210 linked to C (2026-11-09 to 2026-11-12, 4 calendar days inclusive). Action: read PV as of the start of each date, which is how `plannedValueCents` reads `asOf`. Expected: $0 on 2026-11-09, $217,000 on 2026-11-10, $434,000 on 2026-11-11, $651,000 on 2026-11-12, and $868,000 on 2026-11-13. Passing the activity finish 2026-11-12 straight into `plannedValueCents` gives $289,333 on 2026-11-10 and $868,000 on 2026-11-12, one day early. The 5.1 mapping must pass finish + 1 day (2026-11-13) or change the function.
8. **PV reads the baseline.** Input: set the baseline after check 1. Then change C to 8 d. Expected: the Gantt chart shows C finishing 2026-11-18. PV for 04-210 still reaches $868,000 on 2026-11-13. With EV $347,200 on 2026-11-13, SPI = 347,200 ÷ 868,000 = 0.40. If PV read the current dates (finish 2026-11-18), PV on 2026-11-13 would be $347,200 and SPI would show 1.00, hiding the slip.
9. **Baseline is immutable.** Action: edit a baseline date on screen and through the assistant. Expected: both refused. A re-baseline needs a reason and writes an audit row. The old baseline is still readable.
10. **Percent complete comes from the field.** Input: 248 of 620 CY of 04-210 approved in daily reports. Expected: activity C shows 40.0% complete, read-only on the Gantt chart.
11. **XER import is all-or-nothing.** Input: an XER with 40 activities, one of which has a relationship to a missing activity ID. Action: import. Expected: nothing written. The error names the activity and the missing ID. Input: the fixed file. Expected: 40 activities, their relationships, and the calendar import, and a summary lists anything not imported by type and count.
12. **Stale save refused.** Input: two users open activity C. User 1 saves a 5 d duration. User 2 then saves 6 d. Expected: user 2's save is refused with user 1's name and time. C stays 5 d.
13. **Pacific dates.** Input: as-of 2026-11-12 18:00 PST (2026-11-13 02:00 UTC). Expected: PV uses 2026-11-12 (see check 11 in [cost-and-earned-value.md](cost-and-earned-value.md)).

## Sources

- [S1] InEight Schedule User Guide, Release 26.3 (PDF, 302 pages). https://learn.ineight.com/Schedule/Content/Resources/PDFUserGuides/Schedule%2026.3.pdf
- [S2] Software Capabilities of InEight Schedule. https://ineight.com/software-capabilities-of-ineight-schedule/
- [S3] InEight Schedule product page. https://ineight.com/products/ineight-schedule/
- [S4] InEight Control, Primavera Schedule integration. https://learn.ineight.com/Control/Content/4-Scheduling/4%204%20PrimaveraIntegration.htm
- [S5] Create and Align the Schedule. https://learn.ineight.com/integrated_solutions/Content/Business-Processes/Budget-Management/Create-and-Align-the-Schedule.htm
- [S6] InEight Schedule 25.11 Release Notes. https://learn.ineight.com/Schedule/Content/Categories/MajorReleaseNotes/25.11-Release-Notes.htm
- [S7] InEight Schedule 26.3 Release Notes. https://learn.ineight.com/Schedule/Content/Categories/MajorReleaseNotes/26.3-Release-Notes.htm
- [S8] InEight Schedule 26.10 Release Notes (preview). https://learn.ineight.com/Schedule/Content/Categories/ReleaseNotesStartPage.htm
- [S9] InEight Community, 26.5 release highlights. https://community.ineight.com/discussion/281/have-you-checked-out-ineights-latest-26-5-release-notes
- [S10] InEight Control, Schedule Overview (video transcript). https://learn.ineight.com/control/Content/Video-Search/Schedule-Overview-video.htm
- [S11] InEight Control, Time-phased budget. https://learn.ineight.com/control/content/3-Budget/2%20RevenueManagement/3.2.9%20Time%20phased%20budget.htm
- [S12] InEight Control, Progress Measurement Overview. https://learn.ineight.com/Control/Content/2-Progress%20and%20Forecasting/1%20Measurement/2.1.2%20OverviewMeasurement.htm
- [S13] InEight Estimate Quick Guide, Primavera Integration (PDF). https://learn.ineight.com/Estimate/Content/Resources/PDFUserGuides/Quick-Guides-Estimate/Estimate_Quick_Guide_Primavera_Integration.pdf
- [R-S1] TrustRadius, InEight reviews. https://www.trustradius.com/products/ineight/reviews
- [R-S2] Capterra, InEight reviews. https://www.capterra.com/p/161032/InEight/reviews/
- [R-S3] SoftwareConnect, InEight reviews. https://softwareconnect.com/reviews/ineight/
- [R-S4] InEight case study, Kiewit Children's Behavioral Health & Wellness Center (vendor-published). https://content.ineight.com/kiewit-behavioral-health-wellness-center-case-study/
