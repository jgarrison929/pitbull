# Stability Fixes — Feb 21, 2026

Fixes for all 3 CRITICAL and 15 HIGH severity bugs identified in the Codex stability audit (`docs/reviews/STABILITY-REVIEW-FEB21.md`).

## Branch
`fix/stability-criticals-and-highs`

## Results
- **Build:** 0 warnings
- **Tests:** 2,639 passed, 0 failed, 2 skipped
- **New tests added:** 18 (3 for CRITICALs + 15 for HIGHs)

---

## CRITICAL Fixes

### CRITICAL #1: WIP GL double-posting (WipGlPostingService.cs)
**Problem:** Concurrent requests could create duplicate GL journal entries for the same WIP report.
**Fix:** Three-layer defense: (1) existing application-level `GlJournalEntryId` null check, (2) `DbUpdateConcurrencyException` catch via PostgreSQL xmin concurrency token, (3) unique filtered DB index on `GlJournalEntryId`.
**Test:** `PostToGl_CalledTwice_SecondCallReturnsAlreadyPosted`

### CRITICAL #2: Payment app delta logic backwards (ContractsService.cs)
**Problem:** `oldCurrentPaymentDue` and `oldApprovedAmount` were captured AFTER the recalculation block mutated the pay app fields, making the delta always zero.
**Fix:** Moved the two variable captures before the recalculation block.
**Test:** `UpdatePaidPayApp_WorkChange_DeltaReflectsActualDifference`

### CRITICAL #3: Journal entry number race condition (JournalEntryService.cs)
**Problem:** Concurrent journal entry creation could generate duplicate entry numbers.
**Fix:** Retry-on-unique-violation pattern (3 attempts) catching PostgreSQL error code 23505 in both `CreateJournalEntryAsync` and `ReverseJournalEntryAsync`.
**Tests:** `Create_EntryNumbersAreUniqueAcrossMultipleEntries`, `Reverse_GeneratesUniqueEntryNumber`

---

## HIGH Fixes

### HIGH #4: WIP posting entry number non-atomic (WipGlPostingService.cs)
**Fix:** Replaced inline duplicate code with clean `GenerateEntryNumberAsync` method using `OrderByDescending(EntryNumber)` pattern (fixed alongside CRITICAL #1).

### HIGH #5: PO number generation duplicates (PurchaseOrderService.cs)
**Problem:** `GeneratePoNumberAsync` ordered by `CreatedAt` instead of `PONumber`, which could assign duplicate numbers if POs were created out of chronological order.
**Fix:** Changed to `Where(po.PONumber.StartsWith(prefix)).OrderByDescending(po.PONumber)`.
**Test:** `Create_MultiplePos_GeneratesSequentialNumbers`

### HIGH #6: Bank recon matches future transactions (BankReconciliationService.cs)
**Problem:** `MatchTransactionAsync` allowed matching transactions dated after the reconciliation statement date.
**Fix:** Added `txn.TransactionDate > rec.StatementDate` validation check.
**Test:** `MatchTransaction_FutureDated_ReturnsValidationError`

### HIGH #7: Approved CO amount edits don't sync subcontract (ContractsService.cs)
**Problem:** When an already-Approved change order's amount was edited, the subcontract `CurrentValue` was not updated with the delta.
**Fix:** Added new block detecting `Approved→Approved` with amount change, computing and applying the delta to the subcontract.
**Test:** `UpdateApprovedChangeOrder_AmountChange_SyncsSubcontract`

### HIGH #8: Billing app line update leaves header stale (BillingApplicationService.cs)
**Problem:** `UpdateLineAsync` recalculated the individual line but did not call `CalculateG702` to update header totals (TotalEarnedLessRetainage, CurrentPaymentDue, etc.).
**Fix:** Added `CalculateG702(app, allLines)` and payment due recalculation after line update.

### HIGH #9: Billing app missing period date validation (BillingApplicationService.cs)
**Problem:** `CreateAsync` did not validate that `PeriodThrough >= PeriodFrom`.
**Fix:** Added early validation returning `VALIDATION_ERROR` if through date precedes from date.

### HIGH #10: Accounting periods can overlap (AccountingPeriodService.cs)
**Problem:** `CreatePeriodAsync` only checked for duplicate `(FiscalYear, PeriodNumber)` but not overlapping date ranges.
**Fix:** Added date overlap check using `StartDate <= command.EndDate && EndDate >= command.StartDate`.
**Test:** `CreatePeriod_OverlappingDates_ReturnsOverlappingPeriod`

### HIGH #11: Payroll run allows arbitrary status jumps (PayrollRunService.cs)
**Problem:** `UpdatePayrollRunAsync` set `run.Status = command.Status.Value` without validating the transition.
**Fix:** Added `IsValidPayrollStatusTransition` state machine: Draft→Processing→Submitted→UnderReview→Approved→Exported.
**Tests:** `Update_DraftToExported_ReturnsInvalidStatusTransition`, `Update_DraftToProcessing_Succeeds`

### HIGH #12: Payroll review from non-submitted states (PayrollReviewService.cs)
**Problem:** `SubmitAsync` only checked `status != Exported`, allowing review submission from Draft or Approved states.
**Fix:** Changed to require `status is Submitted or Processing`.

### HIGH #13: Payroll export fabricates synthetic rows (PayrollExportService.cs)
**Problem:** When a payroll run line had no matching time entries, the service created fake `TimeEntry` objects with `ProjectId = Guid.Empty`, producing invalid export data.
**Fix:** Skip employees with no approved time entries and log a warning instead.
**Test:** Updated existing `Generate_NoTimeEntries_StillCreatesExportWithFallbackLines` to expect 0 lines.

### HIGH #14: Prevailing wage uses wrong classification (PrevailingWageValidationService.cs)
**Problem:** Required rate was the MAX across ALL work classifications for a determination, creating false positives.
**Fix:** Changed to key rates by `(WageDeterminationId, WorkClassificationId)` tuple and look up using the employee's default classification.

### HIGH #15: Vendor invoice unrestricted status mutation (VendorInvoiceService.cs)
**Problem:** `UpdateVendorInvoiceAsync` allowed setting any status without transition validation (e.g., Paid→Pending).
**Fix:** Added `IsValidInvoiceStatusTransition` state machine: Pending→Matched/PartiallyMatched/Approved, Matched/PartiallyMatched→Approved, Approved→Paid.
**Tests:** `Update_PendingToPaid_ReturnsInvalidTransition`, `Update_ApprovedToPending_ReturnsInvalidTransition`, `Update_PendingToApproved_Succeeds`

### HIGH #16: Vendor invoice accepts non-positive totals (VendorInvoiceService.cs)
**Problem:** `CreateVendorInvoiceAsync` had no validation on `TotalAmount`.
**Fix:** Added `TotalAmount <= 0` check returning `VALIDATION_ERROR`.
**Tests:** `Create_ZeroAmount_ReturnsValidationError`, `Create_NegativeAmount_ReturnsValidationError`, `Create_PositiveAmount_Succeeds`

### HIGH #17: Vendor portal tokens stored plaintext (VendorPortalService.cs)
**Problem:** Tokens were stored as plaintext in the `Token` column, allowing anyone with DB read access to impersonate vendors.
**Fix:** Store SHA-256 hash of the token. Return raw token only on generation. Validate by hashing incoming token and comparing to stored hash.
**Tests:** `GenerateToken_StoresHashedToken_NotPlaintext`, `ValidateToken_WithRawToken_Succeeds`

### HIGH #18: Approved time entries can revert to Submitted (TimeEntryService.cs)
**Problem:** `IsValidTransition` allowed `(Approved, Submitted) => true`, enabling approved entries to be reopened.
**Fix:** Removed the `Approved→Submitted` transition.
**Test:** `Update_ApprovedToSubmitted_ReturnsInvalidTransition`

---

## Files Modified (service code)

| File | Fixes |
|------|-------|
| `WipGlPostingService.cs` | CRITICAL #1, HIGH #4 |
| `ContractsService.cs` | CRITICAL #2, HIGH #7 |
| `JournalEntryService.cs` | CRITICAL #3 |
| `PurchaseOrderService.cs` | HIGH #5 |
| `BankReconciliationService.cs` | HIGH #6 |
| `BillingApplicationService.cs` | HIGH #8, #9 |
| `AccountingPeriodService.cs` | HIGH #10 |
| `PayrollRunService.cs` | HIGH #11 |
| `PayrollReviewService.cs` | HIGH #12 |
| `PayrollExportService.cs` | HIGH #13 |
| `PrevailingWageValidationService.cs` | HIGH #14 |
| `VendorInvoiceService.cs` | HIGH #15, #16 |
| `VendorPortalService.cs` | HIGH #17 |
| `TimeEntryService.cs` | HIGH #18 |
| `WipReportConfigurations.cs` | CRITICAL #1 (unique index) |

## Test Files Modified/Created

| File | Tests Added |
|------|-------------|
| `WipGlPostingServiceTests.cs` | 1 |
| `ContractsServiceTests.cs` | 2 |
| `JournalEntryServiceTests.cs` | 2 |
| `PurchaseOrderServiceTests.cs` | 1 |
| `BankReconciliationServiceTests.cs` | 1 |
| `AccountingPeriodServiceTests.cs` | 1 |
| `PayrollRunServiceTests.cs` | 2 |
| `VendorInvoiceServiceTests.cs` (new) | 6 |
| `VendorPortalServiceTests.cs` | 2 |
| `TimeEntryUpdateTests.cs` | 1 |
| `PayrollExportServiceTests.cs` | 1 (updated) |
