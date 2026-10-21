# Competitive intel: estimate to budget (M2)

Status: research for M2, written 2026-10-21 (PT). Sources are public InEight pages only. No logins, trials, or gated material.

Every claim about InEight has an id (`C1` and so on) and a link to the page it came from. Deductions are in [Inference](#inference-what-we-deduced) (`I` ids). Gaps are in [Unknowns](#unknowns) (`U` ids). PDF page numbers are page indexes in the PDF file, not printed page labels. Dollar and quantity figures in [Acceptance checks](#acceptance-checks) are example data that we made up for the checks. They are not InEight figures.

## Scope: what M2 means in Pitbull

- M2 is "WBS and cost items, CSV import, approve to budget, budget views". It is verified when "PM imports a CSV, approves it, and the budget totals match a fixture" ([fresh-start plan §9](../fresh-start-plan.md#9-milestones-each-shippable-and-verifiable)).
- The demo step: an estimate is a list of cost items under a WBS (cost code tree) with quantity, unit, man-hours, and labor, material, equipment, and sub unit costs. "Approve estimate" freezes it as the Original Budget. Current Budget is the original plus approved changes ([plan §4, step 3](../fresh-start-plan.md#4-500-core-the-smallest-credible-ineight-style-story)).
- The Project Manager role owns estimate to budget. The Estimator is folded into PM for 5.0.0 (plan §4, demo roles).
- Money is integer cents and quantities are integer thousandths ([`v5/src/db/schema.ts`](../../../v5/src/db/schema.ts)).
- State at this commit: `cost_items` already has the tree (`parent_id`, `path`, `is_leaf`), `unit`, `budget_qty_milli`, `budget_mh_per_unit_milli`, and one `budget_cents`. It has no estimate, no Original or Current Budget split, no per-category cost, and no import. The seed writes budgets directly.
- Out of M2: change orders (M5), forecasts (M4), and estimating depth such as resources and assemblies (5.6+, plan §9).

## What InEight does

InEight splits the job across two products. Estimate builds the bid. Control holds the budget and the forecast.

Estimate:

- C1. A cost item gets its cost from one of three cost sources: Detail (resources plus productivity, the recommended method), Plug (a unit or total cost typed per cost category), or Quote (subcontractor or vendor quotes). Only the selected source counts toward the total ([Estimate: Costs and production](https://learn.ineight.com/estimate/Content/5-DirectCosts/5-3-Costs-and-production.htm)).
- C2. Estimate has seven resource types: Labor, Construction Equipment, Rented Construction Equipment, Installed Materials, Installed Equipment, Supplies, and Unique. Unique resources can model subcontractors ([Estimate on Premise: Resources](https://learn.ineight.com/Estimate-On-Premise/Content/3-LibrarySetup/3%204%20Resources.htm)).
- C3. A cost segment marks each cost item as Direct Costs, Job Overhead, or Business Overhead ([Estimate: Costs and production](https://learn.ineight.com/estimate/Content/5-DirectCosts/5-3-Costs-and-production.htm)).
- C4. A job snapshot is a read-only copy of the estimate at a point in time, for example after takeoff or after bid review. A loaded snapshot can be edited but not saved ([Estimate: Snapshots](https://learn.ineight.com/estimate/Content/10-DataReproduction/10%206%20Snapshots.htm)). Compare Jobs puts a job and a snapshot side by side, matched on fields such as Account Code ([Advanced Job Snapshots](https://learn.ineight.com/estimate/Content/201-1-EstimateDataManagement/1%203%20Advanced%20Job%20Snapshots.htm)).
- C5. InEight markets Estimate as cloud or on-premises, priced by modules, users, and contract length, with no public price ([InEight Estimate product page](https://ineight.com/products/ineight-estimate/)).

The handoff to Control:

- C6. Control's budget comes from one of three routes: publish from InEight Estimate, import from Excel, or build cost items by hand ([Create a Budget](https://learn.ineight.com/integrated_solutions/Content/Business-Processes/Earned-Value-Management/set-up-budget/create-a-budget.htm)).
- C7. Before publish, the estimator "conforms" the estimate to how the field will build and measure the work: summarize, break out by area, align to account codes, and turn major materials into cost items ([Create Budget from Conformed Estimate](https://learn.ineight.com/integrated_solutions/Content/Business-Processes/Budget-Management/Create_Budget_from_Conformed.htm)).
- C8. Conforming also means converting dependent cost items and cost item assemblies into standard items, converting ad-hoc resources, and removing suspended items, which do not go to Control ([Align Estimate and Platform data](https://learn.ineight.com/Estimate/Content/17-ConformEstimate/8-1-Align-Estimate-and-Platform-data.htm)). Control "does not have equivalent data structures or calculation capabilities" for those items ([Prepping the Control Budget, PDF](https://learn.ineight.com/integrated_solutions/Content/Resources/PDFUserGuides/Prepping_the_Control_Budget_for_Various_Interfaces.pdf), p. 21).
- C9. Currency, unit-of-measure names, account codes, tags, cost categories, and pay item fields must match between Estimate and Platform ([Align Estimate and Platform data](https://learn.ineight.com/Estimate/Content/17-ConformEstimate/8-1-Align-Estimate-and-Platform-data.htm)). A UoM mismatch or an account code missing from Platform makes the publish fail ([Estimate Integration to Cloud Platform and Control, PDF](https://learn.ineight.com/Integrated_Solutions/Content/Resources/PDFUserGuides/Estimate-Integration-Cloud-Platform-and-Control.pdf), p. 10).
- C10. The guide warns that conforming can change the budget by accident. It recommends an archive of the estimate first, the PBS Changes Log, and a "Conform Estimate" job status so that price changes made during conforming are easy to isolate ([Prepping the Control Budget, PDF](https://learn.ineight.com/integrated_solutions/Content/Resources/PDFUserGuides/Prepping_the_Control_Budget_for_Various_Interfaces.pdf), p. 24). Dropping an item under a terminal item makes that item a parent and deletes its resource employments. Merge has no undo (same PDF, p. 25).
- C11. **Publish Estimate to a New Project** sends the whole job. Re-publishing removes all cost items, pay items, and change orders already in the Control project ([Create Budget from Conformed Estimate](https://learn.ineight.com/integrated_solutions/Content/Business-Processes/Budget-Management/Create_Budget_from_Conformed.htm)).
- C12. The publish runs in the background, "could take several minutes", and sends emails on start and on success or failure. Errors can leave a partial import. InEight recommends validating the data before you lock the budget. Once the budget is locked, do not unlock and re-import ([Estimate Integration PDF](https://learn.ineight.com/Integrated_Solutions/Content/Resources/PDFUserGuides/Estimate-Integration-Cloud-Platform-and-Control.pdf), pp. 5 and 8).
- C13. Publish carries the CBS hierarchy, forecast takeoff quantity, current estimate values, account codes, WBS phase code, schedule dates, tags, and the resources on each cost item with their costs ([Estimate Integration PDF](https://learn.ineight.com/Integrated_Solutions/Content/Resources/PDFUserGuides/Estimate-Integration-Cloud-Platform-and-Control.pdf), p. 25).
- C14. **Publish Cost Items to Active Project** (selective import) adds items later, for example to price a large change order. It does not bring the current budget, which needs a budget move or contract adjustment. The forecast method defaults to current estimate (same PDF, pp. 31 and 32).
- C15. The Excel route reads the first worksheet. The first row is headers. Numbers cannot hold `$` or formulas. CBS positions must be unique. Blank cells stall the import. Some rows can succeed while others fail, and the import then shows as failed. Column mappings save as templates, one set per user ([Control: Cost Item Excel Import](https://learn.ineight.com/control/content/1-Essentials/3%20CostItemSetup/1.3.4%20ExcelImport.htm)). An imported file fills the Current Estimate fields ([Create a Budget](https://learn.ineight.com/integrated_solutions/Content/Business-Processes/Earned-Value-Management/set-up-budget/create-a-budget.htm)).
- C16. Platform accepts at most 11 digits before the decimal. Longer resource values fail the import ([Estimate Integration PDF](https://learn.ineight.com/Integrated_Solutions/Content/Resources/PDFUserGuides/Estimate-Integration-Cloud-Platform-and-Control.pdf), p. 27).

Budget in Control:

- C17. Control keeps three value sets per cost item. Original Budget (OB) is a read-only snapshot before execution that "never changes". Current Budget (CB) is OB plus or minus approved changes. Current Estimate (CE) is editable at any time with no approval and works as a sandbox for pricing changes ([Control: Lock Budget](https://learn.ineight.com/Control/Content/1-Essentials/4%20CostItemManagement/1.4.4%20LockBudget.htm)).
- C18. A new project's CBS is unlocked and OB and CB are empty. **Lock Budget** fills OB and CB from the CE values. After that, CB changes only through approved change orders. Unlocking is "the exception, not the rule" ([Control: Lock Budget](https://learn.ineight.com/Control/Content/1-Essentials/4%20CostItemManagement/1.4.4%20LockBudget.htm)). Unlocking sets OB back to zero ([Lock The Budget](https://learn.ineight.com/integrated_solutions/Content/Business-Processes/Earned-Value-Management/set-up-budget/lock-the-budget.htm)).
- C19. Lock can apply to selected cost items or to the whole budget. A Budget lock status column shows which items are locked. This shipped in Control 21.7 ([Control archived release notes](https://learn.ineight.com/Control/Content/Categories/MajorReleaseNotes/Archived-Release-Notes.htm)).
- C20. The CE quantity is labeled Forecast T/O (takeoff) Qty and is meant to be kept current to drive cost at completion ([Lock The Budget](https://learn.ineight.com/integrated_solutions/Content/Business-Processes/Earned-Value-Management/set-up-budget/lock-the-budget.htm)).
- C21. Budget, actual cost, and quantity live only on terminal cost items. Parents roll up cost. Quantities do not roll up by default, because children may use different units or count the same quantity twice, such as CY to install and CY to buy ([Prepping the Control Budget, PDF](https://learn.ineight.com/integrated_solutions/Content/Resources/PDFUserGuides/Prepping_the_Control_Budget_for_Various_Interfaces.pdf), pp. 12 and 23). A "CBS contribute qty" setting lets children with matching units add to the parent quantity. It exists only in Control and should be set before the budget is locked (same PDF, p. 18).
- C22. Cost categories are an organization-level hierarchy in Platform master data, used for reporting and benchmarking, with optional custom labels ([Platform: Cost categories](https://learn.ineight.com/Platform/Content/DataLibraries/Cost-Categories.htm)). Budget sync to an ERP sends amount, quantity, and man-hours for OB, CB, and CE, broken down by cost category ([Control Integration Specification, PDF](https://learn.ineight.com/Platform/Content/Categories/CategorySnippets/APIMDocuments/InEight%20Control%20Integration%20Specification.pdf)).
- C23. Budget that is not detailed yet can sit in "budget holding" cost items. The budget locks with them, and budget moves later push CB into the new detail. Contingency should be its own cost item, not built into unit rates that the field is measured against ([Prepping the Control Budget, PDF](https://learn.ineight.com/integrated_solutions/Content/Resources/PDFUserGuides/Prepping_the_Control_Budget_for_Various_Interfaces.pdf), pp. 16 and 17).
- C24. CB changes through two records. A budget move must net to zero across cost items. A contract adjustment changes the total price ([Manage budget Changes](https://learn.ineight.com/integrated_solutions/content/Business-Processes/Earned-Value-Management/set-up-budget/manage-budget-changes-InEight-Control.htm)). Each record goes Draft, Pending, then Approved or Rejected, and only Approved updates CB. Revising an approved record creates a new version, so 2.0 becomes 2.1 ([Control: Change Approval Process](https://learn.ineight.com/Control/Content/3-Budget/1%20ChangeManagement/3.1.9%20ApprovalProcess.htm)).
- C25. A new cost item added for a change order starts unlocked and outside CB. Approval locks it, and its OB is set to zero ([Approve Contract Adjustment](https://learn.ineight.com/integrated_solutions/Content/Business-Processes/Change-Order-Management/accept-change-into-budget-forecast/approve-contract-adjustment.htm)).
- C26. One budget move or contract adjustment holds at most 250 cost items and 100 pay items (24.7). An optional setting adds approved CB adjustments to CE (24.5) ([Control archived release notes](https://learn.ineight.com/Control/Content/Categories/MajorReleaseNotes/Archived-Release-Notes.htm)).

## Workflow and math

The path, end to end, from the sources above:

1. Build the estimate in Estimate (C1, C2). Take snapshots at milestones (C4).
2. Conform it to the execution structure and align master data with Platform (C7 to C10).
3. Publish to a new Control project (C11 to C13), or import Excel (C15). Either way, values land in CE.
4. Validate, then lock. OB = CB = CE at that moment (C12, C18).
5. After lock, CB moves only through approved budget moves and contract adjustments (C24, C25). CE stays editable (C17).

The math InEight documents:

- M1. Detail cost item. Labor and equipment cost = resource unit cost × production hours. Material cost = unit cost × quantity. Item total = sum of resource totals ([Estimate: Costs and production](https://learn.ineight.com/estimate/Content/5-DirectCosts/5-3-Costs-and-production.htm)).
- M2. Production can be entered as a duration, units per duration, or duration per unit, and the other two fill in (same page).
- M3. In Control, resource work hours = total duration hours × resource quantity. Total man-hours = sum of labor work hours. Total equipment hours = sum of equipment work hours. When Forecast T/O Qty changes, the user picks whether to hold CE unit cost or CE total cost ([Control: Current Estimate Resources tab](https://learn.ineight.com/control/Content/1-Essentials/4%20CostItemManagement/Cost-item-details/4-Current-estimate-resources-tab.htm)).
- M4. Published man-hours come from pay hours, not work hours ([Estimate Integration PDF](https://learn.ineight.com/Integrated_Solutions/Content/Resources/PDFUserGuides/Estimate-Integration-Cloud-Platform-and-Control.pdf), p. 25). A productivity factor imports but does not change Control's man-hour math ([Prepping the Control Budget, PDF](https://learn.ineight.com/integrated_solutions/Content/Resources/PDFUserGuides/Prepping_the_Control_Budget_for_Various_Interfaces.pdf), p. 21).
- M5. Parent cost = sum of terminal children. Parent quantity is blank unless children opt in with matching units (C21).
- M6. What freezes: lock copies CE quantity, man-hours, and cost into OB and CB (C18, C19). OB has quantity, man-hours, and cost ([Lock The Budget](https://learn.ineight.com/integrated_solutions/Content/Business-Processes/Earned-Value-Management/set-up-budget/lock-the-budget.htm)).
- M7. The baseline feeds the forecast. Current Budget method = actual cost + CB unit cost × quantity remaining. Current Estimate method = actual cost + CE unit cost × quantity remaining. Parents default to Rollup ([Control: Forecast Methods](https://learn.ineight.com/Control/Content/2-Progress%20and%20Forecasting/3%20Forecasting/2.3.3%20ForecastMethods.htm)).

## Inference: what we deduced

These are our readings, not InEight statements.

- I1. Estimate to budget is a project of its own in InEight. It spans two products plus Platform master data, needs a conforming pass, and fails on a mismatched unit name (C7 to C12). A mid-size contractor without an implementation partner pays for that in days, not minutes.
- I2. Publish is one-shot in practice. A re-publish wipes cost items and change orders (C11). After lock, the guide says not to re-import (C12). So the estimate stops being the source of truth at lock, and every later edit goes through change records (C24).
- I3. InEight does not prove that the locked budget equals the approved bid. Its own guide relies on a changes log and an archive to catch budget drift during conforming (C10), and Excel imports can land partly (C15). We found no public page for a built-in reconciliation of estimate total against locked OB.
- I4. CE is the working forecast, not a budget. Pitbull's plan has Original and Current Budget but no CE. M4 forecasts and M5 change pricing both need a place to edit numbers without touching CB, which is what CE does in Control (C17, M7).
- I5. Budget by cost category is the norm. Plug costs are typed per category (C1), ERP sync splits by category (C22), and conforming can split items by cost type (Prepping PDF, p. 25). A single `budget_cents` per cost item, as Pitbull has today, cannot answer "what is the labor budget".
- I6. Partial lock (C19) and holding items (C23) exist because large jobs lock in phases. A 5-minute demo on 40 to 80 cost items per job does not need either.

## Unknowns

- U1. Unknown: whether Estimate has an approval state or sign-off that must pass before publish. The docs say "once the estimate is conformed and approved" ([Lock The Budget](https://learn.ineight.com/integrated_solutions/Content/Business-Processes/Earned-Value-Management/set-up-budget/lock-the-budget.htm)) but show no approval mechanism.
- U2. Unknown: which roles may lock or unlock a budget. Public pages say only "appropriate permissions".
- U3. Unknown: whether Control records who locked the budget and when, or keeps OB history across an unlock.
- U4. Unknown: the rounding rule and stored precision for cost and quantity, beyond the 11-digit limit (C16).
- U5. Unknown: actual publish times for a given job size. The only figure is "several minutes" (C12).
- U6. Unknown: a maximum number of cost items per Control project.
- U7. Unknown: whether any report reconciles the estimate total to the locked OB (I3).
- U8. Unknown: pricing. No public numbers (C5).

## Where Pitbull can be simpler, faster, or more trustworthy

1. **One app, no conforming pass.** The CSV is the conformed budget. Pitbull validates units, codes, and the tree at import, inside one transaction, so no master-data sync can fail later (against C9, C12).
2. **All-or-nothing import with row errors.** A file with one bad row writes nothing and lists every bad row and column. InEight can land a partial import (C12, C15).
3. **Prove the freeze.** Approve shows the estimate total, the OB total, and the per-category totals, and refuses when any of them differ by one cent. This closes the gap in I3 and is a demo moment InEight does not show publicly.
4. **Re-import is safe before approval and impossible after it.** Before approval, a re-import replaces the estimate in place, matched by code. After approval, the import action is gone and changes go through M5. That avoids the InEight wipe hazard (C11) without the unlock escape hatch (C18).
5. **Recommendation that changes the plan: store three value sets and four categories in M2.** Each leaf should carry OB, CB, and CE values for quantity, man-hours, and labor, material, equipment, and sub cost. Approve is the only writer of OB, and CB starts equal to OB. M4 forecasts then read CB and CE (M7), and M5 writes CB through change records (C24), with no later schema migration of the budget columns. The current single `budget_cents` should become the derived total.
6. **No quantity roll-up by default.** Follow C21. Summing 1,200 CY of excavation and 800 CY of backfill into "2,000 CY" is a number a controls lead will not trust.
7. **Skip for 5.0.0.** Skip partial lock (C19), holding items (C23), the Detail resource build-up (C1, M1 to M3), and snapshots (C4). The approved estimate is the only snapshot M2 needs. Resource depth is already on the 5.6+ row.

## Acceptance checks

Example data, constructed for these checks (not InEight data). Job `SHB-1001`, one CSV:

```csv
code,parent_code,description,unit,qty,mh_per_unit,labor_unit,material_unit,equipment_unit,sub_unit
02,,Earthwork,,,,,,,
02-100,02,Excavation,CY,1200,0.05,4.50,0,6.25,0
02-200,02,Structural backfill,CY,800,0.08,5.00,18.00,3.50,0
03,,Concrete,,,,,,,
03-100,03,Footing concrete,CY,150,1.2,72.00,165.00,0,0
03-200,03,Rebar install (sub),LB,18000,0,0,0,0,0.95
```

Expected leaf values (cost = qty × unit cost per category, man-hours = qty × MH per unit):

| Code | Labor | Material | Equipment | Sub | Total | MH |
|---|---|---|---|---|---|---|
| 02-100 | 5,400.00 | 0.00 | 7,500.00 | 0.00 | 12,900.00 | 60 |
| 02-200 | 4,000.00 | 14,400.00 | 2,800.00 | 0.00 | 21,200.00 | 64 |
| 03-100 | 10,800.00 | 24,750.00 | 0.00 | 0.00 | 35,550.00 | 180 |
| 03-200 | 0.00 | 0.00 | 0.00 | 17,100.00 | 17,100.00 | 0 |
| Job | 20,200.00 | 39,150.00 | 10,300.00 | 17,100.00 | 86,750.00 | 304 |

1. Import totals. Import the CSV as the PM on a fresh sandbox job. Expect 6 cost items (4 leaves, 2 summaries), job total $86,750.00 (8,675,000 cents), the category totals in the Job row, and 304.000 man-hours.
2. Roll-up. Open the budget view. Expect `02` = $34,100.00 and 124 MH, and `03` = $52,650.00 and 180 MH. Expect a blank quantity on both summaries, including `02`, whose children are both CY.
3. Atomic import. Change `02-200` qty to `$800` and duplicate the `03-100` row. Import. Expect zero rows written, the job unchanged, and two errors that name the row number and column.
4. Leaf-only cost. Add a unit cost to the `02` row. Import. Expect rejection: "costs belong on leaf cost items" or similar, naming the `02` row.
5. Idempotent re-import. Before approval, import the same CSV twice. Expect 6 cost items, not 12, and the same totals as check 1.
6. Approve freezes OB. Approve the estimate. Expect OB = CB = CE for every leaf and every category, OB total $86,750.00, and one audit entry with the actor, role, and timestamp.
7. Freeze holds. After approval, try to edit `02-100` qty and try a re-import. Expect both refused by the server action, not only hidden in the UI. OB stays $86,750.00.
8. Reconciliation guard. Seed a mismatch by test hook: estimate total 8,675,000 cents and OB written as 8,674,999 cents. Expect Approve to refuse and show both numbers.
9. CE moves, budgets do not. After approval, set CE qty on `02-100` to 1,300 CY, holding unit cost. Expect CE total $13,975.00 for that item. OB and CB stay $12,900.00.
10. Rounding. Import one leaf with qty 0.333 and labor unit cost $0.05. Expect labor cost 2 cents (1.665 rounded half away from zero). The job total equals the sum of rounded category amounts.
11. Units. Import `cy` and `CY` in one file. Expect one unit, `CY`. Import `CUYD` when it is not on the unit list. Expect the whole file rejected (check 3 rules).
12. Scale (proposed target, not a measured number). A 10,000-row CSV imports in under 10 s on staging, and the budget view for that job loads under the 1.5 s page budget in plan §9 M6.

## Sources

- [InEight Estimate product page](https://ineight.com/products/ineight-estimate/)
- [Estimate: Costs and production](https://learn.ineight.com/estimate/Content/5-DirectCosts/5-3-Costs-and-production.htm)
- [Estimate on Premise: Resources](https://learn.ineight.com/Estimate-On-Premise/Content/3-LibrarySetup/3%204%20Resources.htm)
- [Estimate: Snapshots](https://learn.ineight.com/estimate/Content/10-DataReproduction/10%206%20Snapshots.htm)
- [Estimate: Advanced Job Snapshots](https://learn.ineight.com/estimate/Content/201-1-EstimateDataManagement/1%203%20Advanced%20Job%20Snapshots.htm)
- [Estimate: Align Estimate and Platform data](https://learn.ineight.com/Estimate/Content/17-ConformEstimate/8-1-Align-Estimate-and-Platform-data.htm)
- [Create Budget from Conformed Estimate](https://learn.ineight.com/integrated_solutions/Content/Business-Processes/Budget-Management/Create_Budget_from_Conformed.htm)
- [Create a Budget](https://learn.ineight.com/integrated_solutions/Content/Business-Processes/Earned-Value-Management/set-up-budget/create-a-budget.htm)
- [Lock The Budget](https://learn.ineight.com/integrated_solutions/Content/Business-Processes/Earned-Value-Management/set-up-budget/lock-the-budget.htm)
- [Manage budget Changes (Control only)](https://learn.ineight.com/integrated_solutions/content/Business-Processes/Earned-Value-Management/set-up-budget/manage-budget-changes-InEight-Control.htm)
- [Approve Contract Adjustment](https://learn.ineight.com/integrated_solutions/Content/Business-Processes/Change-Order-Management/accept-change-into-budget-forecast/approve-contract-adjustment.htm)
- [Control: Lock Budget](https://learn.ineight.com/Control/Content/1-Essentials/4%20CostItemManagement/1.4.4%20LockBudget.htm)
- [Control: Cost Item Excel Import](https://learn.ineight.com/control/content/1-Essentials/3%20CostItemSetup/1.3.4%20ExcelImport.htm)
- [Control: Current Estimate Resources tab](https://learn.ineight.com/control/Content/1-Essentials/4%20CostItemManagement/Cost-item-details/4-Current-estimate-resources-tab.htm)
- [Control: Forecast Methods](https://learn.ineight.com/Control/Content/2-Progress%20and%20Forecasting/3%20Forecasting/2.3.3%20ForecastMethods.htm)
- [Control: Change Approval Process](https://learn.ineight.com/Control/Content/3-Budget/1%20ChangeManagement/3.1.9%20ApprovalProcess.htm)
- [Control archived release notes](https://learn.ineight.com/Control/Content/Categories/MajorReleaseNotes/Archived-Release-Notes.htm)
- [Platform: Cost categories](https://learn.ineight.com/Platform/Content/DataLibraries/Cost-Categories.htm)
- [Prepping the Control Budget for Various Interfaces (PDF)](https://learn.ineight.com/integrated_solutions/Content/Resources/PDFUserGuides/Prepping_the_Control_Budget_for_Various_Interfaces.pdf)
- [Estimate Integration to Cloud Platform and Control (PDF)](https://learn.ineight.com/Integrated_Solutions/Content/Resources/PDFUserGuides/Estimate-Integration-Cloud-Platform-and-Control.pdf)
- [Control Integration Specification (PDF)](https://learn.ineight.com/Platform/Content/Categories/CategorySnippets/APIMDocuments/InEight%20Control%20Integration%20Specification.pdf)
