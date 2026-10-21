# Competitive intel: field daily plan and report (M3)

Status: research for M3, written 2026-10-21 (PT), checked against `main` at `48143aa6`. Sources are public InEight pages only. No logins, trials, or gated material.

Every claim about InEight has an id (`C1` and so on) and a source tag (`[S1]` and so on) that points to [Sources](#sources). Deductions are in [Inference](#inference-what-we-deduced) (`I` ids). Gaps are in [Unknowns](#unknowns) (`U` ids). PDF page numbers are printed page labels. Figures in [Acceptance checks](#acceptance-checks) are example data that we made up for the checks. They are not InEight or customer figures.

## Scope: what M3 means in Pitbull

- M3 is "Superintendent plans the day, foreman fills in hours and quantities on mobile with live gain/loss, submit, approve or return, then posting". It is verified by "a mobile-viewport e2e from plan to approval, and the posted quantities show on the cost items" ([fresh-start plan §9](../fresh-start-plan.md#9-milestones-each-shippable-and-verifiable)). Plan §4 step 4 says approved quantities and hours post to the cost items.
- Plan lines carry cost item, activity, location, quantity, workers, and hours (`daily_plan_lines` in `v5/src/db/schema.ts`). Lines can be edited on screen or through the assistant (#639).
- Plan status is only `draft` or `submitted` (`plan_status` enum). There is no approve or return step.
- **Report day's work** runs only on a submitted plan. It writes labor at a flat $85.00 per hour (`DEFAULT_LABOR_RATE_CENTS` in `v5/src/lib/ev.ts`) into `cost_entries`, refreshes the cost item's actual cost, and adds the quantity to `installed_qty_milli` at once (`postDailyReport` in `v5/src/server/progress.ts`, #648). Entries carry the time of the report, not the plan date.
- A plan line shows "within rate" when its planned MH per unit is at most 1.05 times the budget MH per unit (`planLine` in `v5/src/server/data.ts`). The report shows no earned hours against actual hours.
- Plans and lines come only from the seed. The superintendent cannot create a plan or add a line.

## What InEight does

Phases and roles:

- C1. Daily planning has three phases: Planning, Execution, and Approval. The planner is "typically a superintendent, field engineer or indirect supervisor", who submits the plan to Execution [S1].
- C2. A plan can be created in InEight Plan from a work package, or in Progress from scratch or from a copy. The plan shows blue in planning, green in execution, and purple while it awaits approval [S2].
- C3. In Execution, the foreman enters actual hours for employees and equipment, installed quantities, notes or issues, and photos, and sees productivity in real time [S1][S2].
- C4. The time sheet takes straight time, overtime, and double time, with buttons for 0.25, 0.50, and 0.75 of an hour [S3].
- C5. Crew members sign out with a PIN or a signature and answer compliance questions set by management. A non-compliant answer needs a note [S3].
- C6. Mobile has the same daily planning functions as web [S1]. The mobile app works online or offline and needs a Wi-Fi or cellular connection only to sync [S8, p. 154].

Approval:

- C7. The approver can approve quantity, hours, or both [S4]. The approver can also edit the plan, or reject it, which sends it back to Execution for the executor to revise and resubmit [S1].
- C8. Approved hours go to the payroll system. Approved quantities go to Plan quantity tracking, which syncs with Control [S1].
- C9. An issue raised in a plan goes to InEight Change after the plan is approved, or at once if the user taps **Send issue** [S3].

Posting to cost:

- C10. Quantities reach Control through a sync that a user runs. The documented cadence is "Weekly after Payroll cost is imported into Control" [S5].
- C11. Hours reach Control only after ERP payroll has processed them. Control then pulls actual cost and man-hours through a separate sync [S1][S5].
- C12. WBS elements link Progress quantities, hours, and cost to Control cost items [S1].
- C13. A manual quantity claim in Control has a posted date. A cost item claimed manually in Control must be hidden from Plan and Progress, so that field and office claims don't conflict [S9].

Quantity claiming:

- C14. Plan breaks a cost item quantity into components, and the component quantities sum to the cost item quantity [S6].
- C15. A claiming scheme splits a component into weighted steps (rules of credit). InEight's example weights a beam 15%, 45%, 30%, and 10%. Completing step 1 claims 15% of the component quantity [S6].
- C16. In a plan, the foreman checks a step complete or types a partial quantity [S5].

Marketing claim:

- C17. The product page says field data "is instantly reflected in the system, updating percent complete in real-time" [S10].

## Workflow and math

- C18. Actual Cost G/L = sum of (actual quantity for the WBS × CE, CB, or forecast final unit cost) − (actual labor cost + actual equipment cost) [S3].
- C19. Actual labor cost = sum of hours worked × the employee's hourly rate. Actual equipment cost = sum of equipment hours × the equipment's hourly rate [S3].
- C20. Planned Cost G/L has the same form with planned quantity and planned hours, and adds "Goals" as a unit-cost basis [S7, p. 67].
- C21. The productivity tab always shows MHR G/L. Dollar G/L shows only when a project setting turns it on [S3].

## Inference: what we deduced

- I1. The MH G/L formula is not printed on the pages we read. By analogy with C18 it is (actual quantity × budget MH per unit) − actual MH.
- I2. C10 and C11 contradict C17 in practice. Control sees field quantities only when someone runs the sync, and hours wait for payroll. Same-minute posting after approval is a speed edge that Pitbull can show in a demo.
- I3. Hours and quantities are approved separately (C7) because hours feed payroll and quantities feed cost, and those have different owners (C8). Pitbull 5.0.0 has no payroll, so one approval can cover both.

## Unknowns

- U1. Unknown: whether an approved daily plan can be edited or un-approved, and what happens to quantities that already synced.
- U2. Unknown: whether a quantity claim is capped at the component or cost item quantity.
- U3. Unknown: how the offline app resolves a conflict when the same plan changes on two devices.
- U4. Unknown: whether an approver's edit is logged apart from the foreman's entry.

## Where Pitbull can be simpler, faster, or more trustworthy

1. **Post on approval, in the same minute.** One **Approve** posts hours and quantity to the cost item in one transaction. There is no weekly sync and no payroll round trip (I2, I3).
2. **Keep unapproved numbers out of cost.** Today `postDailyReport` writes actual cost when the foreman reports. InEight posts hours only after approval (C8, C11). Move the post to approval and show the foreman's numbers as pending until then. This change should land in M3, and it also fixes M4's CPI (see [cost-and-earned-value.md](cost-and-earned-value.md)).
3. **Date each entry with the plan date.** InEight claims carry a posted date (C13). A report approved on Monday for Friday's work belongs to Friday, which keeps M4 period cutoffs honest.
4. **Show gain/loss in hours on the phone.** Per line, show earned MH (reported quantity × budget MH per unit), actual MH, and the difference before submit. This matches InEight's default MHR G/L (C21) without crew-rate setup.
5. **Make return need a reason.** Return is the only path back to the foreman. It needs a typed reason and keeps the foreman's values, so nothing is typed twice.
6. **Leave out for 5.0.0:** sign-in and sign-out PINs, compliance questions, overtime classes, equipment rates, and claiming schemes per component. Milestone weights per cost item already exist (#645) and cover rules of credit at the item level.

## Acceptance checks

Example data for all checks: job 25-031, cost item 04-210 (Pier column, unit CY), budget 620 CY, budget 1.600 MH per CY, labor rate $85.00 per hour.

1. **Superintendent creates a plan.** Input: crew "Crew A", today, cost item 04-210, planned 12 CY, 3 workers × 8 h. Action: save. Expected: a `draft` plan with one line, 24.0 planned MH, and 2.000 MH per CY, flagged over rate (2.000 > 1.600 × 1.05 = 1.680).
2. **Issue to the field.** Input: the plan from check 1. Action: the superintendent issues it. Expected: state `issued`. The foreman sees it at a 390 × 844 viewport.
3. **Live gain/loss on the phone.** Input: the foreman enters 12 CY and 22.0 MH. Action: none yet. Expected: earned 19.2 MH, actual 22.0 MH, and G/L −2.8 MH shown as a loss on the line.
4. **Nothing posts before approval.** Input: the check 3 values. Action: the foreman submits. Expected: state `reported`. Actual cost and installed quantity on 04-210 are unchanged. The job page shows 12 CY and $1,870.00 as pending.
5. **Return needs a reason and keeps values.** Action: the superintendent returns the report with an empty reason. Expected: refused. Action: return with "Recount pour 3". Expected: state `issued`, 12 CY and 22.0 MH still filled in, and the reason shown to the foreman and written to the audit log.
6. **Approval posts once.** Action: the foreman resubmits. The superintendent approves twice in quick succession (double click or two tabs). Expected: state `approved`. Actual cost on 04-210 rises by exactly $1,870.00 (22.0 × $85.00) and installed quantity by exactly 12 CY, once. One audit row names the approver.
7. **Entries carry the plan date.** Input: a plan dated yesterday and approved today. Expected: its cost entries carry yesterday's date.
8. **Approved reports are locked.** Action: edit a line on an approved report. Expected: refused. A correction is a new entry that reverses and replaces the old one, and both show in the audit log.
9. **Rain day.** Input: the foreman reports 0 CY and 0 MH. Action: submit, then approve. Expected: state `approved`, cost unchanged, and zeros shown on reload.
10. **Offline submit posts once.** Input: Playwright sets the phone offline, and the foreman enters the check 3 values and submits. Action: go back online, then replay the same request. Expected: exactly one `reported` submission on the server. The replay changes nothing.
11. **Mobile e2e, plan to posting.** This is the plan's M3 verify check. Run checks 1 to 6 in one Playwright test at 390 × 844 and assert the posted quantity on the cost item page.

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
