# Competitive intel: contracts and subcontracts (5.2)

Status: research for the 5.2 Contracts and subs PRD, written 2026-10-24 (PT), checked against `main` at `6630b6c0`. Sources are public InEight pages, public InEight PDFs, and public review sites only. No logins, trials, or gated material.

Every claim about InEight has an id (`C1` and so on) and a source tag (`[S1]` and so on) that points to [Sources](#sources). Math is in `M` ids. Review sentiment is in `R` ids. Deductions are in [Inference](#inference-what-we-deduced) (`I` ids). Gaps are in [Unknowns](#unknowns) (`U` ids). PDF page numbers are page indexes in the PDF file, and they match the printed page labels in the guide. Figures in [Acceptance checks](#acceptance-checks) are example data that we made up for the checks. They are not InEight or customer figures.

## Scope: what 5.2 means in Pitbull

- 5.2 is "Contracts and subs: subcontracts, commitments, committed-cost forecast method, sub change orders", and it builds on M5 change orders ([fresh-start plan §9](../fresh-start-plan.md#9-milestones-each-shippable-and-verifiable)). Plan §3 maps InEight Contract ("Centralized, ERP-integrated contracts") to "5.2: subcontracts and commitments, committed-cost forecast".
- 5.0.0 leaves out subcontracts, AP and AR, owner billing and pay apps, compliance forms, and integrations (plan §4). Compliance forms are 5.4, owner billing is 5.5, and ERP export is 5.6+ (plan §9).
- The plan's 5.2 row does not name pay applications to subs, retention, or compliance checks.
- State at this commit: each cost item already splits OB, CB, and CE into labor, material, equipment, and sub cents (`ob_sub_cents`, `cb_sub_cents`, `ce_sub_cents` in `v5/src/db/schema.ts`). The `forecast_method` enum has only `current_budget`, after #675 removed the unused `average_performance`. EAC is the sum of per-item forecasts (`v5/src/lib/change-order.ts`).
- Change order lines already carry a category, including `sub` (`CostCategory` in `v5/src/lib/change-order.ts`). The change-order states are `draft`, `priced`, `approved`, `rejected`, and `voided` ([change-orders.md](../change-orders.md)).
- Subcontract cost reaches the seed only as notes on cost entries, for example "Mass excavate subcontract" (`v5/src/seed/index.ts`). There is no vendor, subcontract, commitment, or pay application table.
- Related specs: [change-orders.md](change-orders.md) (owner change orders, pending exposure), [cost-and-earned-value.md](cost-and-earned-value.md) (forecast methods, C16 lists Committed Cost), and [field-plan-and-progress.md](field-plan-and-progress.md) (field quantities).

## What InEight does

Product shape and roles:

- C1. Contract covers "procurement planning through contractor and supplier selection, and from contract creation through pay request approval". It pushes commitment amounts to project forecasts and pushes subcontract scope and line items to field teams [S1, p. 16].
- C2. It has two modules. Bid Packages itemize the scopes to put under contract after award and track milestones. Contracts manage the contract from creation to closeout [S1, pp. 18-19].
- C3. The main users are contract managers and contract administrators. Field handlers, field workers who route invoices, and project engineers, project managers, and controllers who read pay forms also use it [S1, p. 21].
- C4. An organization either integrates with its ERP or runs a "proxy ERP". The proxy ERP answers every publish with an automatic success, skips ERP validations, and allows one invoice per payment form [S1, pp. 17-18].

Contract records:

- C5. Contract statuses are Draft, In review, Out for vendor signature, Out for internal signature, Executed, Terminated, Cancelled, and Closed [S1, p. 164].
- C6. Line items are the pay items (material, service, or credit). Each has quantity, unit, value, WBS phase code, and general ledger account, and becomes a purchase order line when pushed to the ERP [S1, p. 190].
- C7. The header holds retention, liquidated damages, and payment terms. A reporting switch includes or excludes the contract from reporting, for low-risk contracts that do not need high visibility [S1, pp. 168, 177, 183].
- C8. Contract notes "become a part of the legal document and cannot be deleted" [S1, p. 160].
- C9. A master agreement sets terms and pricing but commits nothing until a contract or purchase order is written against it [S1, p. 252].
- C10. A bid package converts to a contract. A setting can require all bid package milestones to be complete first [S1, p. 45][S2].

Schedule of values:

- C11. A schedule of values (SOV) item splits a line item into parts with description, schedule quantity, unit, unit price, schedule value, and WBS code [S1, p. 206].
- C12. An SOV item can be sent to Plan and Progress as a contract component, or hidden from them and claimed in Contract [S1, pp. 206-208].
- C13. A value-only SOV item has zero quantity and a positive, negative, or zero value [S1, p. 207].
- C14. If SOV values exceed the line item's net price, Contract shows a warning icon. It does not block [S1, p. 210].
- C15. Publishing copies current SOV values into the original value. An item added after publishing has an original value of 0 and a manual adjustment for its amount [S1, p. 210].
- C16. A claimed SOV item cannot be deleted. Claims must fall inside the item's valid-from and valid-through dates [S1, pp. 210, 218].
- C17. SOV items can be claimed in three places: in Contract for non-work items such as bonds or mobilization, in Plan for summary quantities, or in Progress from daily plans. A sub assigned to a daily plan sees only the cost items and components assigned to it [S6].

Commitments and Control:

- C18. With "Drive committed cost values from Contract" on, Control takes committed cost from Contract. With it off, committed cost comes from the ERP. Manual entry and Excel import work either way [S4][S5].
- C19. A tax setting decides whether tax is part of committed cost in Contract and Control [S1, p. 59].
- C20. A contract type setting can stop an approval from starting when the contract's current value exceeds the WBS current budget. Otherwise a yellow warning shows [S1, p. 49].
- C21. Accruals cover services or materials that are complete but not yet invoiced, and can be created from an SOV item [S7]. Contract sends accruals to Control only after they are submitted [S1, p. 300]. Without an ERP, the invoice's estimated posting date becomes the posting date of the actual cost in Control [S1, p. 322][S5].

Sub change flow:

- C22. Vendor change orders (VCOs) record changes between the contractor and the vendor, in a log on each contract with a total [S1, p. 267].
- C23. "Unassigned change items" is the sum of issue, PCO, and CCO pricing items from Change that are assigned to the vendor contract but not yet on a VCO [S1, p. 268].
- C24. A VCO's remaining amount to allocate must be zero (within 0.00999) before it can start workflow, submit, publish, or execute [S1, p. 270].
- C25. A VCO records delay days due to the issue, a responsible party, and a company-defined status such as Draft, In review, Out for signature, or Execute and publish [S1, pp. 270-271].
- C26. A Change user can create a VCO. It arrives in Draft and stays linked to its issue, PCO, or CCO. A project-level log lists every VCO with those links [S1, p. 294].
- C27. An executed and published VCO cannot be reopened. The FAQ's fix is a new VCO [S5].
- C28. A new SOV item added on a payment claim gets an ID only after it is put on a VCO and the VCO is executed [S1, p. 354].
- C29. On the owner side, executed change orders from Change go to Control's Changes Register for final acceptance into the budget [S5] (see [change-orders.md](change-orders.md) C12).

Payments to subs:

- C30. A payment claim certifies a vendor's claimed work before an invoice or payment form. It needs an SOV. Up to 10 scheduled dates track each step, and vendors can submit claims through a portal [S1, p. 345].
- C31. A payment claim with a workflow must be approved before it is certified. Certification locks the claim and stores snapshots of its SOV and line items [S1, p. 358].
- C32. One certified payment claim converts to one payment form, and a payment form has at most one payment claim [S1, p. 359].
- C33. Back charges on a payment form short-pay the vendor [S1, p. 317].
- C34. On final approval, a payment form goes to the ERP's accounts payable. After it is submitted it cannot be recalled or changed [S1, p. 339].
- C35. Each contract type has an "Allow overpayment of line items" setting. When it is off, a payment form that exceeds a line item is refused. When it is on, overpayment is unlimited or capped at a percentage [S1, p. 340].
- C36. The capability page says payment applications "can be generated automatically from field-reported progress and accepted quantities, with full support for retainage calculation". It also says the module "maintains a dedicated retainage ledger", and that subs can enter "progress quantities, payroll data, and change order amounts" in a vendor portal [S2].

Retention:

- C37. The retention on the header pre-fills each line item. Each line can be changed, and retention can be waived [S1, pp. 177-180].
- C38. Retention is released through a separate retention release invoice on a payment form. The release "cannot be greater than the total of the retention withheld" [S1, p. 323].
- C39. Automatic submission of a payment form fails when a line's retention across payment forms exceeds the total withheld [S1, p. 340].
- C40. The Payment progress tab shows withheld and released retention. Under a proxy ERP, a user with permission types the paid amount and the retention released by hand [S1, pp. 18, 386-387].
- C41. Payment progress also covers "pay when paid", where a posted invoice is not paid until the owner pays [S1, p. 387].

Compliance:

- C42. The Supporting documents tab holds insurance, surety, waivers, and other documents. An insurance document needs subtype, insurer, effective date, and expiration date [S1, pp. 227-228].
- C43. Insurance, Surety, Certification, Tax ID form, and Other documents can send expiration notices. Notices continue until someone turns them off or 180 days after expiry [S1, p. 228].
- C44. A contract type can require document placeholders. If configured, workflow or publishing cannot happen until the documents are added, and a placeholder cannot be deleted [S1, pp. 229-230].
- C45. The capability page describes a vendor directory with insurance certificates, licensing, performance metrics, and reminders for expirations or missing documents [S2].

Approvals and signature:

- C46. Approval thresholds are set by bid package type, contract type, or VCO type. Any amount equal to or over a threshold needs approval. Contract-level steps run first, then project steps, then organization steps. Foreign-currency amounts are converted before the threshold test [S1, p. 85].
- C47. Payment claims and payment forms have their own approval setup [S1, p. 89]. The capability page describes multi-tier invoice approval with dollar thresholds per step [S2].
- C48. Contract documents go out for signature through DocuSign [S1, p. 247][S2]. In 26.5, Change added DocuSign at the issue level, which InEight suggests for "vendor work authorizations" [S9].

## Workflow and math

The path, end to end: bid package (C2) → contract with line items and SOV (C6, C11) → approval and signature (C46, C48) → executed, which commits cost to Control (C18) → claims from the field or Contract (C17) → payment claim certified (C30, C31) → payment form approved and sent to AP (C32, C34) → payment progress and retention release (C38, C40) → VCOs along the way (C22 to C27) → closeout (C5).

- M1. Total committed cost per cost item = sum over linked line items of (line item amount + tax). InEight's best practice is one cost item per line item [S4].
- M2. Open committed cost = total committed cost − max(goods receipt amount, invoice amount) − accrual amount [S4].
- M3. Under the Committed Cost forecast method, forecast final cost = total committed cost, and forecast remaining cost = open committed cost [S4]. The forecast method list gives the same method as actual cost + open committed cost [S8].
- M4. Payment form: to-date gross = previous gross + current gross. Net payable = current gross − retention − back charges [S1, pp. 317, 321].
- M5. Retained to date = actual retained + remaining new retention value. The page says this holds "even if the retention rate is changed" [S1, p. 159].
- M6. SOV summary progress: value claimed = quantity claimed × unit price. Percent complete = value claimed ÷ schedule value. Quantity remaining = schedule quantity − quantity claimed. Value remaining = schedule value − value claimed [S1, pp. 211-212].
- M7. Payment claim percent: vendor percent = (vendor submission value + previous certified value) ÷ scheduled value × 100. Certified percent = (previous certified value + certified value) ÷ scheduled value × 100. A manually typed percent is allowed, and the period quantity and value win if they disagree [S1, p. 356].

## Integrations

- C49. Contract integrates with the customer's ERP. Options include having the ERP calculate tax before publish and sending equipment details with purchase order lines [S1, p. 17].
- C50. The guide's workflow diagram shows Contract integrated with Change, Progress, Control, and the ERP [S1, p. 18]. In detail, Contract feeds Control committed cost (C18), sends SOV items to Plan and Progress (C12), and links to Change pricing items (C23, C26).
- C51. Data imports and exports through templates, and a large SOV can be set up and maintained by import and export [S1, pp. 116-119, 209]. The FAQ describes bulk claiming by editing exported columns K, L, and M and re-importing [S5].
- C52. Supporting documents can be uploaded from InEight Document, and contract documents can be uploaded to it [S1, pp. 144, 233].
- C53. The product page FAQ claims customers create "contracts in half the time". It gives no study or numbers [S3].

## Customer praise and complaints

Sample size is small. G2 answered 403 or timed out, and Capterra returned a bot check, so neither is in this sample. TrustRadius lists 87 InEight ratings and shows 10 full reviews publicly. Its summary covers 14 reviews from the last 18 months, and 6 of those 14 found the interface overwhelming or clunky [R-S1]. SoftwareConnect shows 4 reviews [R-S2]. Of these, four TrustRadius reviews and one SoftwareConnect review mention contracts, invoices, ERP entry, or subs, and only one is detailed. That is not enough to find a pattern about Contract. R2 to R4 come from one reviewer.

- R1. Praise. A TrustRadius reviewer who uses InEight "primarily for invoice processing" listed "Tracking history of contract", "Checking correctness of GST calculation", and "Itemize expenses through Schedule of Values" as pros ("InEight is the future", 2025-06-03) [R-S1].
- R2. Complaint, retention. The same reviewer wrote "HB cannot be processed directly in in Eight" and "the case of HoldBack processing, you have to manually process this in SAP and InEight doesn't have the functionality to get this done" [R-S1].
- R3. Complaint, error timing. The same reviewer wrote that InEight "cannot detect errors in the invoice and only when you submit to SAP do you see a parked invoices error". The failed payment form "cannot be reused", and the system "fails to catch rounding error in quantities" [R-S1].
- R4. Complaint, cross-project reporting. The same reviewer wrote that "you cannot mass spool from InEight the way we do it in SAP. it has to be done individually for all projects" [R-S1].
- R5. Complaint, ERP. Another TrustRadius reviewer wrote that "InEight was unable to talk to our ERP system which required double entry of all processes" ("InEight", 2025-06-03) [R-S1].
- R6. Praise, sub management. An owner's program manager wrote that "it empowers us to manage our contractors / subcontractors" and that it "includes contractor management elements" (TrustRadius, 2026-09-30) [R-S1].
- R7. Complaint, change hand-offs. A project controls manager described "rework if you think in the whole process of issue creation, promoting to PCO, promote to CCO, execute the issue, move to change in controls" and wrote that "having all in a single place would minimize the manual work" (TrustRadius, 2025-09-30) [R-S1].
- R8. Praise. A Pattern Energy reviewer wrote that InEight "strengthens our contract and budget oversight" (SoftwareConnect, 2025-11-18) [R-S2].
- R9. Vendor-featured. InEight's Contract page quotes Patrick Shaw, Project Controls Manager at Blois Construction: "I really like InEight's user interface" [S3]. This is marketing, not an independent review.

## Inference: what we deduced

These are our readings, not InEight statements.

- I1. **The committed-cost forecast hides pending sub changes.** Under M3, forecast final cost equals total committed cost. Change items assigned to a sub but not yet on an executed VCO (C23) are outside the forecast until the VCO executes. Pitbull should show them next to EAC as pending sub exposure, the same rule M5 uses for owner changes (see [change-orders.md](change-orders.md), item 5 of its recommendations).
- I2. **A commitment with no pay applications cannot show open commitment.** M2 subtracts invoices, receipts, and accruals. If 5.2 has commitments but no pay applications, open commitment equals total commitment forever. Sub actual cost would still arrive as loose cost entries, as the seed does today. Then AC, billed to date, and open commitment cannot be reconciled for the same cost item.
- I3. **Retention lives half outside InEight.** Withholding is in Contract (C37, C39), but payment and release status come from the ERP or are typed by hand (C40), and one reviewer processes holdback in SAP (R2). The marketing page's "dedicated retainage ledger" (C36) does not match what the user guide and that reviewer describe. Pitbull has no ERP in 5.x before 5.6, so a retention ledger inside the app is the only way to show retained to date that adds up.
- I4. **InEight lets each customer choose warn or block.** SOV over line value warns (C14). Over budget warns or blocks (C20). Overpayment blocks or allows a percentage (C35). Pitbull can choose strict defaults and document them, which reads as more trustworthy in a demo.
- I5. **Compliance stops publishing, not paying.** Placeholders can block workflow and publishing (C44), and expired documents send notices (C43). We found no public page that blocks a payment on an expired certificate (U1). Blocking a sub payment on expired insurance is a concrete trust feature.
- I6. **Five payment records is too many for a mid-size contractor.** InEight has invoices, payment claims, payment forms, accruals, and goods receipts (C21, C30 to C34). One pay application record with states covers a sub progress billing.
- I7. **Approved pay applications should stay frozen.** InEight snapshots a certified claim (C31) and blocks recall after submit (C34), but a reviewer reports failed forms that must be rebuilt (R3). Pitbull can validate everything before approval, so approval never fails downstream.

## Unknowns

- U1. Unknown: whether any setting blocks a payment form or payment claim when a required insurance document has expired.
- U2. Unknown: how Control's committed-cost forecast treats a VCO that is approved but not yet executed.
- U3. Unknown: whether retention can step down by rule, for example from 10% to 5% at 50% complete. M5 says the rate can change, but no rule is documented.
- U4. Unknown: lien waiver handling beyond storing "waivers" as supporting documents, for example conditional and unconditional waivers tied to each payment.
- U5. Unknown: whether a negative VCO (a deduct) is allowed, and how it changes retention already withheld.
- U6. Unknown: whether the "payroll data" that subs enter in the portal (C36) covers certified payroll or prevailing-wage reports.
- U7. Unknown: the rounding rule when a percent and a quantity disagree (M7, R3).
- U8. Unknown: pricing. The product page says it depends on modules, users, and contract duration, with no figures [S3].

## Where Pitbull can be simpler, faster, or more trustworthy

1. **One subcontract record, SOV lines mapped to cost items.** A subcontract has a vendor, a retention rate, and SOV lines. Each line has quantity, unit, unit price, and one cost item. Commitment per cost item = the sum of its executed SOV lines plus executed sub change orders (M1, without tax).
2. **Recommendation that changes the plan: add a minimal sub pay application to 5.2, with retention.** States: `draft` → `submitted` → `approved`, plus `rejected`. Each approved pay application posts gross earned to AC on the line's cost item, withholds retention, and lowers open commitment. Without it, 5.2's commitments cannot reconcile with AC (I2). If the plan keeps 5.2 at commitments only, it should say that sub cost still arrives as cost entries until a named later release.
3. **Committed-cost forecast, defined.** For an item on the Committed Cost method, EAC = total commitment (M3). Pending sub change orders and uncommitted CB show next to EAC and never enter it (I1). The derivation string says "EAC $500,000 = executed commitment (committed cost)".
4. **Strict defaults.** Refuse billing an SOV line past 100%. Refuse a retention release larger than retention held (C38). Warn, and route to the executive, when a commitment exceeds CB (C20). Refuse to execute a sub change order whose lines do not add up to its total (C24).
5. **Compliance hold on payment.** A subcontract records its insurance expiry dates. Approving a pay application after an expiry is refused with the certificate named. Forms and inspections stay in 5.4 (I5).
6. **Sub change orders link to owner change orders.** A sub change order can reference a Pitbull change order line. The job page shows owner change lines with a `sub` category that no sub change order covers yet, like InEight's unassigned change items (C23). Approval of either side never moves the other.
7. **Validate before approval.** Every check runs on submit, so an approved pay application is final, and corrections go in the next pay application (I7, R3).
8. **Leave out for 5.2:** bid packages, master agreements, Contract Writer and DocuSign, purchase orders, goods receipts, accruals, taxes, multiple currencies, a vendor portal, and ERP integration (5.6+).

## Acceptance checks

Example data for all checks: job 25-031. Subcontract SC-031-01 to Ridgeline Earthworks, retention 10%. SOV line L1 "Mobilization", 1 LS at $50,000, on cost item 02-100 (CB sub $50,000). SOV line L2 "Mass excavation", 40,000 CY at $12.50 = $500,000, on cost item 02-210 (CB sub $540,000). Both items use the Committed Cost forecast method. General liability insurance expires 2026-12-31.

1. **A draft commits nothing.** Action: save SC-031-01 as a draft. Expected: commitment on 02-100 and 02-210 is $0. EAC unchanged.
2. **Execution commits.** Action: approve and execute. Expected: commitment 02-100 $50,000 and 02-210 $500,000. Uncommitted CB on 02-210 is $40,000.
3. **Committed-cost EAC.** Expected: EAC for 02-210 is $500,000, not CB $540,000, with the derivation "executed commitment".
4. **Over-budget commitment needs the executive.** Input: L2 priced at $560,000 instead. Action: the PM approves. Expected: refused with "commitment exceeds CB by $20,000, needs executive approval". The executive can approve it with the warning shown.
5. **First pay application.** Input: L1 100%, L2 10,000 CY. Action: approve. Expected: current gross $175,000 (L1 $50,000, L2 $125,000). Retention $17,500. Net payable $157,500. Previous gross $0, to-date gross $175,000.
6. **Second pay application.** Input: L2 22,000 CY to date. Expected: current gross $150,000. Previous gross $175,000. To-date gross $325,000. Retention this period $15,000. Retained to date $32,500. Net payable $135,000.
7. **AC and open commitment reconcile.** Expected after check 6: AC from SC-031-01 on 02-210 is $275,000 and open commitment is $225,000. On 02-100, AC is $50,000 and open commitment is $0. For each item, AC from the sub + open commitment = commitment.
8. **No overbilling.** Input: L2 at 41,000 CY to date. Action: submit. Expected: refused, because the line holds 40,000 CY.
9. **Sub change order.** Input: sub change order SCO-1, +5,000 CY on L2 at $12.50 = $62,500, referencing owner change order line 02-210. While SCO-1 is `submitted`: commitment $500,000, EAC $500,000, pending sub exposure $62,500. After execution: L2 is 45,000 CY and $562,500, commitment and EAC on 02-210 are $562,500, and L2 is 48.9% complete (22,000 ÷ 45,000).
10. **Owner change does not move a committed EAC.** Input: an approved owner change order adds $70,000 CB to 02-210 before SCO-1 executes. Expected: CB $610,000. EAC stays $500,000 until SCO-1 executes. The job page shows the owner change as not yet covered by a sub change order.
11. **Retention release capped.** Input: after check 6, a release of $40,000. Expected: refused, because $32,500 is held. A release of $32,500 is allowed and leaves $0 held.
12. **Compliance hold.** Input: a pay application approved on 2027-01-05. Expected: refused with "general liability certificate expired 2026-12-31". After a renewed certificate is added, approval succeeds.
13. **Percent and quantity agree.** Input: L2 claimed as 33.3%. Expected: stored quantity 13,320.000 CY and value $166,500.00 (13,320 × $12.50). The percent is computed from the quantity and never stored on its own.
14. **Approved is final and idempotent.** Action: edit an approved pay application on screen and through the assistant, then approve the same pay application twice in quick succession. Expected: edits refused. AC rises once.
15. **Every transition is audited.** Expected after checks 1 to 14: one audit row per state change on subcontracts, sub change orders, and pay applications, with actor, role, time, from state, to state, and amounts.

## Sources

- [S1] InEight Contract User Guide, Release 26.3 (PDF, 398 pages). https://learn.ineight.com/Contract/Content/Resources/PDFUserGuides/Contract%2026.3.pdf
- [S2] Software Capabilities for InEight Contract. https://ineight.com/software-capabilities-for-ineight-contract/
- [S3] InEight Contract product page. https://ineight.com/products/ineight-contract/
- [S4] InEight Control, Committed cost from Contract. https://learn.ineight.com/Control/Content/2-Progress%20and%20Forecasting/1%20Measurement/2.1.14%20CommittedCostFromContract.htm
- [S5] InEight Contract, Contract frequently asked questions. https://learn.ineight.com/Contract/Content/Categories/FAQ.htm
- [S6] Claim Subcontractor Quantities and Hours. https://learn.ineight.com/integrated_solutions/Content/Business-Processes/Sub-Management/Manage-Progress-and-Risk/Claim-Subcontractor-Quantities-and-Hours.htm
- [S7] Manage Subcontractor Payments. https://learn.ineight.com/integrated_solutions/Content/Business-Processes/Sub-Management/Manage-Progress-and-Risk/Manage-Subcontractor-Payments.htm
- [S8] InEight Control, Forecast Methods. https://learn.ineight.com/Control/Content/2-Progress%20and%20Forecasting/3%20Forecasting/2.3.3%20ForecastMethods.htm
- [S9] InEight Community, 26.5 release highlights. https://community.ineight.com/discussion/281/have-you-checked-out-ineights-latest-26-5-release-notes
- [R-S1] TrustRadius, InEight reviews. https://www.trustradius.com/products/ineight/reviews
- [R-S2] SoftwareConnect, InEight reviews. https://softwareconnect.com/reviews/ineight/
