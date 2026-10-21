# M3 field daily plan and report vs InEight Plan & Progress

Status: competitive-intel spec, docs only. Checked against `main` at `48143aa6` and public InEight pages read on 2026-10-21 (PT).
Conventions: `[S#]` cites a source at the end of this file. `I#` marks an inference, which was deduced and not read. `U#` marks an unknown. Numbers under "Example data" are made up for tests and are not InEight or customer figures.

## Scope in Pitbull

M3 in the [fresh-start plan](../fresh-start-plan.md) (sections 4 and 9): the superintendent plans the day, and the foreman enters hours and quantities on a phone with live gain/loss. The foreman submits, and the superintendent approves or returns the report. Approved quantities and hours post to the cost items. Verify: a mobile-viewport e2e from plan to approval, and the posted quantities show on the cost items.

What `main` has today:

- Plan lines carry cost item, activity, location, quantity, workers and hours (`v5/src/db/schema.ts`, `daily_plan_lines`). Lines can be edited on screen or by the assistant (#639).
- Plan status is only `draft` or `submitted` (`plan_status` enum in `schema.ts`). There is no approve or return step.
- "Report day's work" runs only on a submitted plan. It writes labor at a flat $85.00 per hour (`DEFAULT_LABOR_RATE_CENTS` in `v5/src/lib/ev.ts`) into `cost_entries` and adds quantity to `installed_qty_milli` at once (`postDailyReport` in `v5/src/server/progress.ts`, #648). Entries are dated when the report is posted, not with the plan date.
- A plan line shows "within rate" when planned MH per unit is at most 1.05 times the budget MH per unit (`planLine` in `v5/src/server/data.ts`). There is no earned-hours versus actual-hours gain/loss on the report.
- Plans and lines come only from the seed. The superintendent cannot create a plan or add a line.

## What InEight does

Phases and roles:

- Daily planning has three phases: Planning, Execution, and Approval [S1].
- The planner is "typically a superintendent, field engineer or indirect supervisor". That person submits the plan to Execution [S1].
- A plan can be created in InEight Plan from a work package, or in Progress from scratch or from a copy [S2]. The screen shows each phase in a color: blue for planning, green for execution, purple for awaiting approval [S2].
- In Execution, the foreman enters actual hours for employees and equipment, installed quantities, notes or issues, and photos, and sees productivity in real time [S1][S2].
- The time sheet takes straight time, overtime and double time, and has buttons for 0.25, 0.50 and 0.75 of an hour [S3].
- Crew members sign out with a PIN or signature and answer compliance questions set by management. A non-compliant answer requires a note [S3].
- Mobile and web have the same daily planning functions [S1]. The mobile app works offline. It needs a Wi-Fi or cellular connection only to sync [S8, p. 154].

Approval:

- The approver can approve quantities, hours, or both [S4]. Each can be approved separately [S1].
- The approver can also edit the plan, or reject it, which sends it back to Execution for the executor to revise and resubmit [S1].
- Approved hours go to the payroll system. Approved quantities go to Plan quantity tracking, which syncs with Control [S1].
- Issues raised in a plan go to InEight Change after the plan is approved, or at once if the user taps **Send issue** [S3].

Posting to cost:

- Quantities reach Control through a sync that a user runs. The documented flow is "Weekly after Payroll cost is imported into Control" [S5].
- Hours reach Control only after the ERP processes payroll. Control then pulls actual cost and man-hours through a separate sync [S1][S5].
- WBS elements link Progress quantities, hours and cost to Control cost items [S1].

Quantity claiming:

- Plan breaks a cost item quantity into components. Component quantities sum to the cost item quantity [S6].
- A claiming scheme splits a component into weighted steps (rules of credit). Example from InEight: 15%, 45%, 30% and 10% steps on a beam. Completing step 1 claims 15% of the component quantity [S6].
- A foreman can check a step complete or enter a partial quantity [S5].
- In Control, a cost item claimed manually must be hidden from Plan and Progress, so field and office claims don't conflict [S9].

## Workflow and math

Gain/loss formulas from InEight:

- Actual Cost G/L = sum of (actual quantity for the WBS × CE, CB or forecast final unit cost) − (actual labor cost + actual equipment cost) [S3].
- Actual labor cost = sum of hours worked × the employee's hourly rate. Equipment cost = sum of equipment hours × the equipment hourly rate [S3].
- Planned Cost G/L uses the same form with planned quantity and planned hours, and adds "Goals" as a unit-cost basis [S7, p. 67].
- The productivity tab shows MHR G/L by default. Dollar G/L shows only when a project setting turns it on [S3].

Inferences:

- I1. The MH G/L formula is not printed on the pages read. By analogy with the cost formula it is (actual quantity × budget MH per unit) − actual MH.
- I2. InEight Control does not see field quantities the moment they are approved. A user must run the sync, and the documented cadence is weekly [S5]. Marketing copy says field data is "instantly reflected" [S10]. Same-day posting after approval is a speed edge for Pitbull that is visible in a demo.
- I3. Separate hours and quantity approval exists because hours feed payroll and quantities feed cost, and those two have different owners [S1]. Pitbull 5.0.0 has no payroll, so one approve covers both.

## Unknowns

- U1. Unknown: whether an approved daily plan can be edited or un-approved, and what happens to quantities that already synced.
- U2. Unknown: whether quantity claims are capped at the component or cost item quantity.
- U3. Unknown: how the offline app resolves a conflict when the same plan changes on two devices.
- U4. Unknown: whether a superintendent's edit during approval is logged separately from the foreman's entry.

## Where Pitbull can be simpler, faster, or more trustworthy

1. **One approval, then same-minute posting.** One **Approve** posts both hours and quantity to the cost item in the same transaction. There is no weekly sync and no payroll round trip (I2, I3).
2. **Nothing unapproved reaches cost.** Today `postDailyReport` writes actual cost the moment the foreman reports. InEight posts hours only after approval [S1]. Recommendation: move the post to approval. Keep the foreman's numbers as pending until then.
3. **Posting date is the plan date.** Date each cost entry with the plan date, not the time the report was posted. InEight claims carry a posted date [S9]. This keeps period cutoffs honest for M4.
4. **Gain/loss in hours on the phone.** Show earned MH (reported quantity × budget MH per unit), actual MH, and the difference per line before submit. This matches InEight's default MHR G/L [S3] without the cost-rate setup.
5. **Return needs a reason.** Make return the only path back to the foreman, and make it need a typed reason. Keep the foreman's values so nothing is re-entered.
6. **Skip for 5.0.0.** Skip sign-in and sign-out PINs, compliance questions, overtime classes, equipment rates and claiming schemes per component. Milestone weights per cost item already exist (#645) and cover rules of credit at item level.

## Acceptance checks

Example data for all checks: job 25-031, cost item 04-210 (Pier column, unit CY), budget 620 CY, budget MH per unit 1.600, labor rate $85.00 per hour.

1. **Superintendent creates a plan.** Input: superintendent picks crew "Crew A", date today, cost item 04-210, planned 12 CY, 3 workers × 8 h. Action: save. Expected: a plan in state `draft` with one line, 24 planned MH, and planned MH per unit 2.000, flagged over rate (2.000 > 1.600 × 1.05).
2. **Issue to the field.** Input: the plan from check 1. Action: superintendent issues it. Expected: the state is `issued`. The foreman sees it on a 390 × 844 viewport. Plan lines are read-only for the superintendent.
3. **Live gain/loss on the phone.** Input: foreman enters 12 CY and 22.0 MH. Action: none (before submit). Expected: earned MH 19.2, actual MH 22.0, G/L −2.8 MH shown in red on the line.
4. **Nothing posts before approval.** Input: check 3 values. Action: foreman submits. Expected: state `reported`. Cost item 04-210 actual cost and installed quantity are unchanged. The job page shows 12 CY and $1,870.00 as pending.
5. **Return keeps values and needs a reason.** Action: superintendent clicks **Return** with an empty reason. Expected: refused. Action: return with reason "Recount pour 3". Expected: state `issued`, values 12 CY and 22.0 MH still filled, and the reason shown to the foreman and written to the audit log.
6. **Approve posts once.** Action: foreman resubmits, superintendent approves twice in quick succession (double click or two tabs). Expected: state `approved`. Actual cost of 04-210 rises by exactly $1,870.00 (22.0 × $85.00) and installed quantity by exactly 12 CY, once. One audit row names the approver.
7. **Posting date is the plan date.** Input: plan dated yesterday, approved today. Expected: the cost entries carry yesterday's date.
8. **Approved reports are locked.** Action: foreman or superintendent edits an approved line. Expected: refused. The only correction path is a new entry that reverses and replaces it, and both show in the audit log.
9. **Rain day.** Input: foreman reports 0 CY and 0 MH. Action: submit, approve. Expected: state `approved`, actual cost and installed quantity unchanged, and the report shows zeros on reload.
10. **Offline submit is idempotent.** Input: phone set offline in Playwright, foreman enters check 3 values and submits. Action: go back online. Expected: exactly one `reported` submission reaches the server, and a second replay of the same request is a no-op.
11. **Mobile e2e from plan to posting.** The plan's M3 verify check: run checks 1 to 6 in one Playwright test at 390 × 844 and assert the posted quantity on the cost item page.

## Sources

- [S1] InEight Progress Overview. https://learn.ineight.com/Progress/Content/Administration/1-Overview/1%202%20InEight%20Progress%20Overview.htm
- [S2] InEight Progress, Daily Plan Process Overview (video transcript). https://learn.ineight.com/Progress/Content/Video-search/Daily-Plan-Process-Overview-video.htm
- [S3] InEight Progress, Input Actuals. https://learn.ineight.com/Progress/Content/Daily%20Planning%20Mobile/Daily%20Plan%20Execution/InputActuals.htm
- [S4] InEight Progress, Approve Daily Plans. https://learn.ineight.com/Progress/Content/Daily%20Planning/Daily%20Plan%20Approval/ApproveDailyPlans.htm
- [S5] Claim In Plan and Progress. https://learn.ineight.com/integrated_solutions/Content/Business-Processes/Earned-Value-Management/record-actuals/claim-in-InEIght-Plan-and-Progress.htm
- [S6] InEight Plan, Plan Quantity Tracking Overview. https://learn.ineight.com/Plan/Content/Quantity/1-Overview/1%202%20Plan%20Quantity%20Tracking.htm
- [S7] Progress Daily Plan Web User Guide, release 26.5, p. 67 (PDF). https://learn.ineight.com/Progress/Content/Resources/PDFUserGuides/ProgressDaily%20Plan%20Web26.5.pdf
- [S8] Progress Daily Plan Mobile User Guide, release 26.5, p. 154 (PDF). https://learn.ineight.com/Progress/Content/Resources/PDFUserGuides/ProgressDaily%20Plan%20Mobile26.5.pdf
- [S9] InEight Control, Actuals by Manual Entry. https://learn.ineight.com/control/Content/2-Progress%20and%20Forecasting/1%20Measurement/2.1.7%20ActualsManualEntry.htm
- [S10] InEight Plan & Progress product page. https://ineight.com/products/ineight-progress/
