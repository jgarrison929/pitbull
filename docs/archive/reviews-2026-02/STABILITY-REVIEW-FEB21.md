# STABILITY REVIEW — Feb 21, 2026

## Module: Pitbull.Billing (Core Financial / GL / Reconciliation)

## [SEVERITY: CRITICAL] — WIP GL posting can double-post under concurrency
**File:** src/Modules/Pitbull.Billing/Features/Wip/WipGlPostingService.cs  
**Line(s):** ~16-30, ~154-164  
**Issue:** `PostToGlAsync` checks `report.GlJournalEntryId` and then writes a journal entry in a separate step without a transaction-level concurrency guard. Two concurrent requests can both pass the pre-check and both create posted entries.  
**Impact:** Duplicate GL postings for the same WIP report (materially incorrect financial statements).  
**Fix:** Use a transaction with optimistic concurrency token check on `WipReport` (or a unique constraint on `WipReport.GlJournalEntryId`/source doc), and fail second writer with conflict.

## [SEVERITY: HIGH] — Journal entry number generation is race-prone
**File:** src/Modules/Pitbull.Billing/Services/JournalEntryService.cs  
**Line(s):** ~116, ~376-395  
**Issue:** `GenerateEntryNumberAsync` reads max entry number then increments in memory. Concurrent creates can generate identical numbers.  
**Impact:** Unique constraint violations and intermittent create/post failures in production during concurrent entry posting.  
**Fix:** Move numbering to DB sequence or serialized allocator table; alternatively retry on unique violation with regenerated number.

## [SEVERITY: HIGH] — WIP posting entry number logic is non-atomic and has dead code smell
**File:** src/Modules/Pitbull.Billing/Features/Wip/WipGlPostingService.cs  
**Line(s):** ~123-136  
**Issue:** Entry number generation does two separate queries and includes an unused `MaxAsync(...Id.GetHashCode())` result, then derives next number from string sort. Still race-prone and fragile.  
**Impact:** Colliding `EntryNumber` values and unpredictable failures under load.  
**Fix:** Remove hash-based query and allocate number atomically (DB sequence / locking strategy).

## [SEVERITY: HIGH] — PO number generation can produce duplicates/out-of-order numbers
**File:** src/Modules/Pitbull.Billing/Services/PurchaseOrderService.cs  
**Line(s):** ~299-318  
**Issue:** `GeneratePoNumberAsync` uses most recent `CreatedAt` record, not the max numeric suffix for the current year. Backfilled rows or clock skew can regress sequence; concurrent creates race.  
**Impact:** Duplicate PO numbers and failed PO creation in busy environments.  
**Fix:** Allocate PO numbers atomically per year/company using DB sequence/counter row.

## [SEVERITY: HIGH] — Bank reconciliation can match future transactions against prior statement
**File:** src/Modules/Pitbull.Billing/Features/BankReconciliation/BankReconciliationService.cs  
**Line(s):** ~365-387  
**Issue:** `MatchTransactionAsync` does not validate `txn.TransactionDate <= rec.StatementDate`.  
**Impact:** Reconciliation can be falsely forced to balance using out-of-period activity.  
**Fix:** Reject matching transactions dated after `StatementDate`.

## [SEVERITY: MEDIUM] — Reconciliation start lacks chronological validation
**File:** src/Modules/Pitbull.Billing/Features/BankReconciliation/BankReconciliationService.cs  
**Line(s):** ~324-337  
**Issue:** New reconciliations are allowed with statement dates earlier than last completed period.  
**Impact:** Overlapping/out-of-order reconciliation history and confusing beginning balance behavior.  
**Fix:** Require `command.StatementDate > lastCompleted.StatementDate` for same account.

## [SEVERITY: MEDIUM] — Aging report logic overstates true AR/AP exposure for partial settlements
**File:** src/Modules/Pitbull.Billing/Features/Aging/AgingReportService.cs  
**Line(s):** ~92-100, ~112-129, ~21-29  
**Issue:** Buckets use full `CurrentPaymentDue`/`TotalAmount` snapshots, but no paid-to-date netting is applied for partial settlements at line level.  
**Impact:** CFO/AP aging can be materially overstated for partially paid items.  
**Fix:** Age on outstanding balance fields (or ledger-derived residuals), not original/current gross figures.

## Module: Contracts & Billing Workflow

## [SEVERITY: CRITICAL] — Paid payment-app delta logic is incorrect (drift in subcontract totals)
**File:** src/Modules/Pitbull.Contracts/Services/ContractsService.cs  
**Line(s):** ~521-535, ~547, ~573-584  
**Issue:** `oldCurrentPaymentDue` is captured *after* recalculation (`var oldCurrentPaymentDue = payApp.CurrentPaymentDue;`), so `billedDelta` becomes zero in same-status paid updates.  
**Impact:** `Subcontract.BilledToDate`/`PaidToDate` drift from reality when paid applications are edited.  
**Fix:** Capture old values before mutating pay-app monetary fields; compute deltas from true before/after values.

## [SEVERITY: HIGH] — Approved change-order amount edits do not re-sync subcontract current value
**File:** src/Modules/Pitbull.Contracts/Services/ContractsService.cs  
**Line(s):** ~312-338, ~345  
**Issue:** Update logic adjusts subcontract value on status transitions to Approved/Void, but not when an already-approved CO amount is changed while status remains Approved.  
**Impact:** Subcontract revised value becomes incorrect (contract sum mismatch).  
**Fix:** When `oldStatus == Approved && newStatus == Approved && amount changed`, apply delta to `subcontract.CurrentValue`.

## [SEVERITY: HIGH] — Billing app single-line update leaves header totals stale
**File:** src/Modules/Pitbull.Billing/Services/BillingApplicationService.cs  
**Line(s):** ~166-190  
**Issue:** `UpdateLineAsync` recalculates only the line item; it does not recompute G702 totals (`TotalRetainage`, `CurrentPaymentDue`, etc.).  
**Impact:** Persisted billing header can disagree with line items until manual recalc, causing incorrect payment due.  
**Fix:** Call `CalculateG702(...)` and recompute prior-certificate/current due in `UpdateLineAsync` before save.

## [SEVERITY: HIGH] — Billing app creation lacks billing-period date validation
**File:** src/Modules/Pitbull.Billing/Services/BillingApplicationService.cs  
**Line(s):** ~46-94  
**Issue:** No guard that `PeriodThrough >= PeriodFrom`.  
**Impact:** Invalid period ranges can be persisted and propagated into billing docs/reports.  
**Fix:** Add validation and reject inverted periods.

## [SEVERITY: HIGH] — Accounting periods can overlap
**File:** src/Modules/Pitbull.Billing/Services/AccountingPeriodService.cs  
**Line(s):** ~54-77  
**Issue:** Create validates duplicate fiscal period number but not date-range overlap with existing periods.  
**Impact:** Ambiguous period resolution for posting; journal posting may hit wrong period.  
**Fix:** Add overlap check (`existing.StartDate <= new.EndDate && existing.EndDate >= new.StartDate`).

## [SEVERITY: MEDIUM] — Owner contract update skips retainage bounds validation
**File:** src/Modules/Pitbull.Billing/Services/OwnerContractService.cs  
**Line(s):** ~106-107  
**Issue:** Create validates retainage percent range, update path does not.  
**Impact:** Invalid retainage percentages can enter production data and distort billing calculations.  
**Fix:** Reuse create-time validation in update path.

## Module: Payroll / Certified Payroll / Wage Validation

## [SEVERITY: HIGH] — Payroll run update allows arbitrary status jumps
**File:** src/Modules/Pitbull.Billing/Services/PayrollRunService.cs  
**Line(s):** ~110-111  
**Issue:** `UpdatePayrollRunAsync` directly sets `run.Status` from request for draft runs without transition rules.  
**Impact:** Workflow bypass (e.g., Draft -> Exported) and inconsistent payroll lifecycle.  
**Fix:** Enforce explicit allowed status transitions server-side.

## [SEVERITY: HIGH] — Payroll review can be submitted from non-submitted run states
**File:** src/Modules/Pitbull.Billing/Services/PayrollReviewService.cs  
**Line(s):** ~71-84  
**Issue:** `SubmitAsync` blocks only `Exported`; it permits Draft/Processing runs to enter review.  
**Impact:** Review/approval pipeline starts on incomplete payroll data.  
**Fix:** Require `run.Status == PayrollRunStatus.Submitted` before creating a review.

## [SEVERITY: HIGH] — Payroll export fabricates synthetic project/cost code rows
**File:** src/Modules/Pitbull.Billing/Services/PayrollExportService.cs  
**Line(s):** ~109-123, ~150-152  
**Issue:** If no matching time entries are found, service creates synthetic entries with `ProjectId = Guid.Empty` and `CostCodeId = Guid.Empty`.  
**Impact:** Invalid downstream payroll/job-cost exports and reconciliation failures in external systems.  
**Fix:** Fail export for missing allocation data, or require deterministic fallback mappings configured per company.

## [SEVERITY: MEDIUM] — Payroll allocation rounding can produce per-employee total mismatches
**File:** src/Modules/Pitbull.Billing/Services/PayrollExportService.cs  
**Line(s):** ~133-136  
**Issue:** Ratio-based per-entry rounding does not reconcile remainder to a final balancing line.  
**Impact:** Sum of export lines can differ from payroll run line totals by cents.  
**Fix:** Use remainder distribution (largest-remainder method) so per-employee lines sum exactly.

## [SEVERITY: HIGH] — Prevailing wage validation ignores classification-specific rates
**File:** src/Modules/Pitbull.Billing/Services/PrevailingWageValidationService.cs  
**Line(s):** ~67-71, ~93  
**Issue:** Required rate is selected as max rate per determination, and violations are tagged with a default classification instead of the worked classification.  
**Impact:** False positives/negatives in certified payroll compliance (legal risk).  
**Fix:** Validate by actual `WorkClassificationId` for each time slice and compare against matching determination rate.

## [SEVERITY: MEDIUM] — Wage determination allows invalid negative rate components
**File:** src/Modules/Pitbull.Billing/Services/WageDeterminationService.cs  
**Line(s):** ~79-90, ~136-147  
**Issue:** No guard against negative `BaseRate`, `FringeRate`, or `TotalRate`.  
**Impact:** Invalid wage schedules can be saved and used in compliance checks/payroll logic.  
**Fix:** Add rate validation (`>= 0`) and enforce `TotalRate == BaseRate + FringeRate` unless explicitly justified.

## Module: AP / Vendor Invoices / Vendor Portal Security

## [SEVERITY: HIGH] — Vendor invoice update allows unrestricted status mutation
**File:** src/Modules/Pitbull.Billing/Services/VendorInvoiceService.cs  
**Line(s):** ~118-119  
**Issue:** `UpdateVendorInvoiceAsync` directly sets status from client command without workflow/authorization checks.  
**Impact:** Users can force invoices to `Paid`/`Approved` bypassing match/approval controls.  
**Fix:** Replace direct assignment with validated transition methods and role checks.

## [SEVERITY: HIGH] — Vendor invoice create/update accepts non-positive totals
**File:** src/Modules/Pitbull.Billing/Services/VendorInvoiceService.cs  
**Line(s):** ~69-83, ~116-117  
**Issue:** No validation for `TotalAmount > 0`.  
**Impact:** Negative/zero AP invoices can distort aging/AP totals and matching logic.  
**Fix:** Enforce positive monetary amount on create and update.

## [SEVERITY: HIGH] — Vendor portal tokens are stored in plaintext
**File:** src/Modules/Pitbull.Core/Domain/VendorPortalToken.cs; src/Modules/Pitbull.Billing/Services/VendorPortalService.cs  
**Line(s):** Token model ~16; validation query ~92-95 and ~211-213  
**Issue:** Raw token string is persisted and queried directly.  
**Impact:** DB read access immediately grants active portal access links (external-facing).  
**Fix:** Store only token hash, compare hashed input, and rotate/revoke with one-way storage.

## [SEVERITY: MEDIUM] — Vendor portal token creation does not validate project linkage
**File:** src/Modules/Pitbull.Billing/Services/VendorPortalService.cs  
**Line(s):** ~13-37  
**Issue:** `GenerateTokenAsync` validates vendor existence but does not validate project existence or vendor-project relationship.  
**Impact:** Tokens can be minted for invalid project IDs; portal writes/read paths can carry orphan project references.  
**Fix:** Validate project exists in same tenant/company and (optionally) vendor is contractually linked to that project.

## Module: Time Tracking (Payroll Feed)

## [SEVERITY: HIGH] — Approved entries can be reverted back to Submitted
**File:** src/Modules/Pitbull.TimeTracking/Services/TimeEntryService.cs  
**Line(s):** ~1597-1599  
**Issue:** State machine explicitly allows `Approved -> Submitted`.  
**Impact:** Payroll-approved hours can be reopened and changed after approval windows, causing payroll/job-cost instability.  
**Fix:** Disallow `Approved -> Submitted` in normal flow; require privileged correction workflow with audit trail.

## [SEVERITY: MEDIUM] — Labor cost report can include unapproved hours by default
**File:** src/Modules/Pitbull.TimeTracking/Services/TimeEntryService.cs  
**Line(s):** ~327-367  
**Issue:** `GetLaborCostReportAsync` only filters approved entries when `approvedOnly` is true; default path includes draft/rejected/submitted.  
**Impact:** Job-cost reports can include non-final labor causing PM/CFO discrepancies.  
**Fix:** Default to approved-only for cost reporting, or split explicit draft/provisional reports.

## Module: Security & Auth Boundary in Controllers

## [SEVERITY: MEDIUM] — User ID fallback to `Guid.Empty` permits unaudited state-changing actions
**File:** src/Pitbull.Api/Controllers/JournalEntriesController.cs; src/Pitbull.Api/Controllers/AccountingPeriodsController.cs; src/Pitbull.Api/Controllers/BankReconciliationsController.cs  
**Line(s):** `GetCurrentUserId()` methods ~184-188, ~150-154, ~127-131  
**Issue:** If claim parsing fails, controllers continue with `Guid.Empty` and call mutating services (post/close/complete).  
**Impact:** Audit attribution corruption (`Guid.Empty` actor) on critical accounting operations.  
**Fix:** Treat missing/invalid user GUID as unauthorized (`401/403`) and fail request.

---

## Summary
- **CRITICAL:** 3  
- **HIGH:** 15  
- **MEDIUM:** 9  
- **LOW:** 0

**Confidence level:** **Moderate-High** for financial workflow and payroll correctness risks identified above. I would **not** consider this codebase safe to demo to real construction-company users handling live money/payroll until CRITICAL/HIGH items are remediated and covered by integration tests.
