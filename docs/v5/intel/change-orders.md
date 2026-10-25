# Competitive intel: change orders (M5)

Status: research for M5, written 2026-10-21 (PT), checked against `main` at `48143aa6`. Sources are public InEight pages only. No logins, trials, or gated material.

Every claim about InEight has an id (`C1` and so on) and a source tag (`[S1]` and so on) that points to [Sources](#sources). Deductions are in [Inference](#inference-what-we-deduced) (`I` ids). Gaps are in [Unknowns](#unknowns) (`U` ids). Figures in [Acceptance checks](#acceptance-checks) are example data that we made up for the checks. They are not InEight or customer figures.

## Scope: what M5 means in Pitbull

- M5 is "PCO → priced → approved → revises the budget and forecast, with audit trail". It is verified by an "e2e where the executive approves and EAC and the current budget move by the exact amount" ([fresh-start plan §9](../fresh-start-plan.md#9-milestones-each-shippable-and-verifiable)).
- Plan §4 step 6: a PCO is raised with cost-item impacts, priced, and approved by the PM or the executive. Approval revises the current budget and the forecast. Each step has an audit trail. The executive role "approves big COs".
- State at this commit: `v5/` has no change-order table, action, or page. Cost items carry one `budget_cents` and no original or current budget split. That split is M2's first slice, so M5 depends on M2 (see `estimate-to-budget.md` in this folder once it merges).
- Job EAC today is `budgetCents / cpi` (`rollup` in `v5/src/lib/ev.ts`, `toRollup` in `v5/src/server/cost-rollups.ts`). That formula decides whether the M5 verify check can pass (see [Inference](#inference-what-we-deduced), I1).
- Out of 5.0.0: subcontracts and sub change orders (5.2), owner billing and pay items (5.5).

## What InEight does

Records and states:

- C1. Change has three records. An issue is something that could add cost or affect the schedule. A PCO is a potential change to the owner's contract that is being priced and negotiated, and it can hold one or more issues. A CCO is a finalized change ready for the owner, and it can bundle several PCOs [S1].
- C2. Data flows one way, from issue to PCO to CCO. Edits to a PCO do not change its issue, and issue changes can be pushed up to the PCO. An issue can go straight to a CCO and skip the PCO [S1][S2].
- C3. When an issue becomes a change order, it is limited to 250 unique cost items or 100 unique pay items [S1].
- C4. A PCO header carries three statuses: PCO status, pricing status, and proposal status. Each status change prompts for a note, kept in a notes panel [S1].
- C5. The documented lifecycle is: create the issue, price it, convert to a PCO, forecast potential revenue and cost, review schedule impact, approve the PCO, convert to a CCO, get internal approval, collect client eSignatures, execute, then approve the contract adjustment in Control [S3].

Pricing:

- C6. Pricing adds existing cost items (with an adjusted CB quantity) or new cost items on the issue's Pricing tab. Markups come from project settings or are entered by hand [S2].
- C7. After the client signs, the PM enters the agreed amount, attaches the signed change order, and sets the CCO status to Executed [S2].

Approval routing:

- C8. Approval workflows exist for budget moves, PCOs, CCOs, and documents, with ordered steps assigned to roles [S4].
- C9. Organizations set dollar thresholds by contract type for PCOs and CCOs. Thresholds are absolute values, so a price change in either direction starts the workflow [S4].
- C10. Step order: steps on the individual PCO or CCO run first, then project steps, then organization steps. Organization steps show only when the value is over their threshold [S4].
- C11. A workflow in progress keeps the assignments it started with. If a role's user changes, the new user in that role inherits the pending approval [S4].

Into the budget:

- C12. An executed CCO arrives in Control's Change Register as a contract adjustment with status CCO-Draft. Someone reviews it, assigns cost items to pay items, and submits it [S5].
- C13. Change Register records go Draft, Pending, then Approved or Rejected. Only Approved updates the Current Budget. Rejected ends the record and makes it read-only [S6].
- C14. Revising an approved record backs out its budget, quantity, man-hour, and pay item amounts, marks it Revised and read-only, and creates a new draft with the next version, for example 2.0 to 2.1 [S6].
- C15. Approving a contract adjustment locks any new cost items and sets their Original Budget to zero [S7]. It updates the current budget and current price of existing items [S5].
- C16. A contract adjustment from Change can be submitted only when its total adjusted price equals the executed CCO price [S8].
- C17. A budget move can be submitted only when its total adjusted cost is zero [S8][S9].
- C18. A contract adjustment can carry a start date, finish date, and cost curve, which spread its added budget across fiscal periods. Budget cannot start in a closed period, and a distribution that does not add up to the adjustment blocks submit and approval [S9].

Pending exposure and forecast:

- C19. Pending costs from a PCO show in Control as Issue cost and Pending budget cost columns at any approval stage, with no probability applied [S10].
- C20. A revenue category gives a PCO an approval probability. Adjusted forecast final revenue = current value × probability, and it becomes 100% once the change order is executed [S10][S11].
- C21. Before approval, the cost of a pending change can be forecast with the Current Estimate method. After approval, InEight suggests switching those items to the Current Budget method, so that the forecast uses only approved costs [S12].

Audit:

- C22. The product page says Change has "built-in audit trails" [S13]. The Control FAQ says that changes made through Excel import do not create an audit log entry [S8].

## Workflow and math

- C23. Current budget (CB) = original budget (OB) ± approved changes [S14].
- C24. Under the Current Budget forecast method, forecast = actual cost + CB unit cost × remaining quantity [S15].
- C25. Contract adjustment price = adjusted CB cost + billing markup + fee [S7].

## Inference: what we deduced

- I1. **The M5 verify check fails under today's EAC formula.** EAC is `BAC / CPI` at job level. A change order of +ΔB moves EAC by ΔB ÷ CPI, not by ΔB. With CPI 0.80, a +$500,000 change moves EAC by +$625,000. InEight forecasts per cost item (C24), and a new item on the Current Budget method has no actuals, so its forecast is exactly its CB. To make "EAC moves by the exact amount" true, M4 must compute EAC as a sum of per-item forecasts, and new change-order items must start on the Current Budget method (C21).
- I2. InEight separates issue, PCO, and CCO because owner negotiation, internal pricing, and the budget update happen in different products (Change and Control) and are handled by different people (C1, C12). Pitbull 5.0.0 has one app and no owner billing, so one change-order record with states covers the demo.
- I3. Approve-to-budget is two approvals in InEight: the CCO workflow in Change, then the contract adjustment in Control (C5, C12, C13). Pitbull can make one approval update the budget in the same transaction.
- I4. C22 implies that InEight's audit coverage depends on the entry path. Pitbull can write one audit row for every state change on every path, which is a trust claim we can demo.

## Unknowns

- U1. Unknown: whether InEight blocks a negative change that takes a cost item's current budget below its actual cost or below zero.
- U2. Unknown: the full list of values for PCO status, pricing status, and proposal status.
- U3. Unknown: whether an organization can stop the author of a PCO from also approving it (separation of duties).
- U4. Unknown: how percent complete on a quantity-claimed item reacts when a contract adjustment changes its quantity, beyond the general rule that percent complete = quantity claimed ÷ Forecast (T/O) quantity [S14].

## Where Pitbull can be simpler, faster, or more trustworthy

1. **One record, one approval.** A change order goes `draft` → `submitted` → `approved` or `rejected`, and pricing happens in `draft`. Approval writes the budget change and the audit row in one transaction (I2, I3).
2. **Route by absolute amount.** The PM approves when the absolute net cost is at or below a job setting. Above it, only the executive approves. This copies InEight's absolute-value thresholds (C9) with one level instead of three (C10).
3. **Approved means immutable.** InEight revises an approved record by backing it out and versioning it (C14). Pitbull can refuse edits to an approved change order and fix mistakes with a new change order that references it. The budget history then only appends.
4. **EAC moves by exactly the approved amount.** This needs I1 in M4: per-item forecasts, and new change-order items start on the Current Budget method.
5. **Show pending exposure, never mix it in.** Show the total of submitted but unapproved change orders next to CB and EAC on the job page (like C19). It never enters CB or EAC.
6. **Every path audits.** Screen, assistant, and any future import write the same audit row (I4).
7. **Leave out for 5.0.0:** issues as a separate record, CCO bundling, revenue probability, pay items, eSignature, and time-phased spreading of the change. Linear PV over the cost item's dates covers the demo.

## Acceptance checks

Example data for all checks: job 25-031 with BAC $10,000,000, EV $4,000,000, and AC $5,000,000 (CPI 0.80). PM approval limit $100,000. Cost item 04-210 (Pier column): 620 CY, $868,000 ($1,400.00 per CY), 248 CY claimed.

1. **A draft holds no budget.** Input: the PM creates a change order with a new cost item 99-010 "Added retaining wall" at +$500,000. Action: save as draft. Expected: CB, BAC, and EAC unchanged. Pending exposure $0, because drafts are not submitted.
2. **Submitted shows as pending only.** Action: submit check 1. Expected: pending exposure $500,000. CB and EAC unchanged.
3. **Routing uses the absolute amount.** Input: check 2 ($500,000 > $100,000). Action: the PM approves. Expected: refused with "needs executive approval". Input: a −$150,000 deduct. Expected: also routed to the executive, because 150,000 > 100,000.
4. **Executive approval moves CB and EAC by the exact amount.** Action: the executive approves check 2. Expected: BAC $10,500,000 (+$500,000). EAC moves from $12,500,000 to $13,000,000 (+$500,000), with 99-010 forecast at its CB of $500,000. Today's formula gives $13,125,000 (+$625,000), so this check fails until M4 has per-item forecasts.
5. **The original budget never changes.** Expected after check 4: OB per item and per job equals its value before check 1. For every cost item, CB = OB + the sum of its approved change-order lines. New item 99-010 has OB $0 (like C15).
6. **Added scope at the same unit rate keeps EV.** Input: a change order adds 100 CY and $140,000 to 04-210. Action: approve. Expected: CB $1,008,000 over 720 CY. EV stays $347,200 (before: $868,000 × 248 ÷ 620; after: $1,008,000 × 248 ÷ 720). Percent complete drops from 40.0% to 34.4%.
7. **Reject ends the record.** Action: reject a submitted change order with reason "Owner declined". Expected: state `rejected`, read-only. CB and EAC unchanged. Pending exposure drops by its amount.
8. **Approved is immutable.** Action: edit an approved change order on screen and through the assistant. Expected: both refused. A new change order that references it is the only correction path.
9. **No negative budget.** Input: a −$900,000 deduct on 04-210 (CB $868,000). Action: submit. Expected: refused, because CB would go below zero.
10. **Approval is idempotent.** Action: the executive approves the same change order twice in quick succession. Expected: CB rises once.
11. **Every transition is audited.** Expected after checks 1 to 10: one audit row per state change with actor, role, time, from state, to state, amounts, and the reason when one was entered. Screen and assistant actions write the same row shape.
12. **Verify e2e.** The plan's M5 verify check: in one Playwright test, the PM drafts and submits check 1, the executive approves, and the job page shows the BAC and EAC values from check 4.

## Sources

- [S1] InEight Change, Potential Change Order (PCO). https://learn.ineight.com/Change/Content/CHNG20.5%205/5%201%20Potential%20Change%20Order%20(PCO).htm
- [S2] Manage Changes to the Current Cost and Revenue Budgets. https://learn.ineight.com/integrated_solutions/Content/Business-Processes/Budget-Management/Manage-Changes-to-the-Current-Cost-and-Revenue.htm
- [S3] Change Order Management. https://learn.ineight.com/integrated_solutions/Content/Business-Processes/Change-Order-Management/Change-Order-Home.htm
- [S4] InEight Change, Workflow assignments. https://learn.ineight.com/Change/Content/CHNG20.5%202/Workflow%20assignments%20(organization).htm
- [S5] InEight Control, Managing change orders (video transcript). https://learn.ineight.com/Control/Content/Video-Search/Managing-Change-Orders-video.htm
- [S6] InEight Control, Change Approval Process. https://learn.ineight.com/Control/Content/3-Budget/1%20ChangeManagement/3.1.9%20ApprovalProcess.htm
- [S7] Approve Contract Adjustment. https://learn.ineight.com/integrated_solutions/Content/Business-Processes/Change-Order-Management/accept-change-into-budget-forecast/approve-contract-adjustment.htm
- [S8] InEight Control, Frequently Asked Questions. https://learn.ineight.com/Control/Content/Categories/FAQ-Control.htm
- [S9] InEight Control, Time-phased budget. https://learn.ineight.com/control/content/3-Budget/2%20RevenueManagement/3.2.9%20Time%20phased%20budget.htm
- [S10] Forecast Potential Revenue and Cost. https://learn.ineight.com/integrated_solutions/Content/Business-Processes/Change-Order-Management/create-potential-change-order/forecast-potential-revenue.htm
- [S11] InEight Change, Client Change Order (CCO) Generation. https://learn.ineight.com/Change/Content/CHNG20.5%205/5%202%20Client%20Change%20Order%20CCO.htm
- [S12] Review Budget and Forecast Changes. https://learn.ineight.com/integrated_solutions/Content/Business-Processes/Change-Order-Management/accept-change-into-budget-forecast/review-budget-and-forecast-changes.htm
- [S13] InEight Change product page. https://ineight.com/products/ineight-change/
- [S14] InEight Control, Progress Measurement Overview. https://learn.ineight.com/Control/Content/2-Progress%20and%20Forecasting/1%20Measurement/2.1.2%20OverviewMeasurement.htm
- [S15] InEight Control, Forecast Methods. https://learn.ineight.com/Control/Content/2-Progress%20and%20Forecasting/3%20Forecasting/2.3.3%20ForecastMethods.htm
