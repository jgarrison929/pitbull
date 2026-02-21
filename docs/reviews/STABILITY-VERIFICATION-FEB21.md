# STABILITY VERIFICATION — Feb 21, 2026

Verified against:
- `docs/reviews/STABILITY-REVIEW-FEB21.md` (original audit)
- `docs/reviews/STABILITY-FIXES-FEB21.md` (claimed fixes)

## Scope Executed
- Verified **all 3 CRITICAL** findings in source + related tests.
- Spot-checked **5 HIGH** findings in source + related tests:
  1. HIGH #5 (PO numbering)
  2. HIGH #6 (bank reconciliation future-dated match)
  3. HIGH #8 (billing line update/header totals)
  4. HIGH #10 (accounting period overlap)
  5. HIGH #17 (vendor portal token plaintext)
- Scanned for regressions/new defects introduced by these fixes.

## Test Execution
Ran targeted unit tests for the touched areas:
- Command: `dotnet test tests/Pitbull.Tests.Unit --configuration Release --filter "FullyQualifiedName~WipGlPostingServiceTests|FullyQualifiedName~ContractsServiceTests|FullyQualifiedName~JournalEntryServiceTests|FullyQualifiedName~PurchaseOrderServiceTests|FullyQualifiedName~BankReconciliationServiceTests|FullyQualifiedName~BillingApplicationServiceTests|FullyQualifiedName~AccountingPeriodServiceTests|FullyQualifiedName~VendorPortalServiceTests|FullyQualifiedName~TimeEntryUpdateTests|FullyQualifiedName~PayrollRunServiceTests|FullyQualifiedName~PayrollReviewServiceTests" --verbosity minimal`
- Result: **Passed 211 / Failed 0 / Skipped 0**

---

## CRITICAL Verification

### CRITICAL #1 — WIP GL double-posting
- Files reviewed: `src/Modules/Pitbull.Billing/Features/Wip/WipGlPostingService.cs`, `src/Modules/Pitbull.Core/Data/WipReportConfigurations.cs`, `tests/Pitbull.Tests.Unit/Billing/WipGlPostingServiceTests.cs`
- Verdict: **Partially fixed**
- What is correct:
  - Early already-posted guard exists: `src/Modules/Pitbull.Billing/Features/Wip/WipGlPostingService.cs:27`
  - Concurrency conflict handling exists: `src/Modules/Pitbull.Billing/Features/Wip/WipGlPostingService.cs:161`
  - `xmin` concurrency token exists on WIP report: `src/Modules/Pitbull.Core/Data/WipReportConfigurations.cs:39`
  - Unique filtered index is declared in EF config: `src/Modules/Pitbull.Core/Data/WipReportConfigurations.cs:34`
- What is missing/incomplete:
  - The new WIP unique index is **not present in EF snapshot** (`src/Pitbull.Api/Migrations/PitbullDbContextModelSnapshot.cs:5756` shows period/report indexes only; no `GlJournalEntryId` index), so migration evidence is missing.
  - The regression test is not a true concurrency test; it is sequential (`tests/Pitbull.Tests.Unit/Billing/WipGlPostingServiceTests.cs:281`).

### CRITICAL #2 — Paid payment-app delta logic
- Files reviewed: `src/Modules/Pitbull.Contracts/Services/ContractsService.cs`, `tests/Pitbull.Tests.Unit/Modules/Contracts/ContractsServiceTests.cs`
- Verdict: **Fixed correctly**
- Evidence:
  - Old values are captured before mutation: `src/Modules/Pitbull.Contracts/Services/ContractsService.cs:540`
  - Paid same-status delta uses old vs new values: `src/Modules/Pitbull.Contracts/Services/ContractsService.cs:595`
  - Regression test added and valid: `tests/Pitbull.Tests.Unit/Modules/Contracts/ContractsServiceTests.cs:450`

### CRITICAL #3 — Journal entry number race condition
- Files reviewed: `src/Modules/Pitbull.Billing/Services/JournalEntryService.cs`, `tests/Pitbull.Tests.Unit/Billing/JournalEntryServiceTests.cs`
- Verdict: **Mostly fixed**
- Evidence:
  - Retry-on-unique-violation in create: `src/Modules/Pitbull.Billing/Services/JournalEntryService.cs:149`
  - Retry-on-unique-violation in reverse: `src/Modules/Pitbull.Billing/Services/JournalEntryService.cs:377`
  - Unique index already exists on `(TenantId, CompanyId, EntryNumber)`: `src/Modules/Pitbull.Core/Data/JournalEntryConfiguration.cs:44`
- Caveat:
  - Unique-violation detection is brittle (`inner.Message.Contains("23505")`): `src/Modules/Pitbull.Billing/Services/JournalEntryService.cs:422`.

---

## HIGH Spot-Check Verification (5)

### HIGH #5 — PO number generation duplicates/out-of-order
- Files reviewed: `src/Modules/Pitbull.Billing/Services/PurchaseOrderService.cs`, `tests/Pitbull.Tests.Unit/Modules/Billing/PurchaseOrderServiceTests.cs`
- Verdict: **Partially fixed**
- What is correct:
  - Ordering switched to `OrderByDescending(PONumber)`: `src/Modules/Pitbull.Billing/Services/PurchaseOrderService.cs:304` (fixes out-of-order CreatedAt issue).
- Remaining gap:
  - Still non-atomic read-then-insert; no retry on unique conflict: `src/Modules/Pitbull.Billing/Services/PurchaseOrderService.cs:77`.
  - Duplicate pre-check is vendor-scoped (`po.PONumber == poNumber && po.VendorId == ...`) while DB uniqueness is tenant/company scoped, so concurrent collisions can still fall through to DB error: `src/Modules/Pitbull.Billing/Services/PurchaseOrderService.cs:79`, `src/Modules/Pitbull.Core/Data/PurchaseOrderConfiguration.cs:30`.

### HIGH #6 — Bank reconciliation future transactions
- Files reviewed: `src/Modules/Pitbull.Billing/Features/BankReconciliation/BankReconciliationService.cs`, `tests/Pitbull.Tests.Unit/BankReconciliation/BankReconciliationServiceTests.cs`
- Verdict: **Fixed correctly**
- Evidence:
  - Guard added: `txn.TransactionDate > rec.StatementDate` reject: `src/Modules/Pitbull.Billing/Features/BankReconciliation/BankReconciliationService.cs:380`
  - Test exists and matches behavior: `tests/Pitbull.Tests.Unit/BankReconciliation/BankReconciliationServiceTests.cs:786`

### HIGH #8 — Billing app single-line update leaves header stale
- Files reviewed: `src/Modules/Pitbull.Billing/Services/BillingApplicationService.cs`
- Verdict: **Fixed correctly**
- Evidence:
  - Header recompute now executed after line update: `src/Modules/Pitbull.Billing/Services/BillingApplicationService.cs:194`
  - Payment due / balance recomputation follows: `src/Modules/Pitbull.Billing/Services/BillingApplicationService.cs:200`

### HIGH #10 — Accounting periods can overlap
- Files reviewed: `src/Modules/Pitbull.Billing/Services/AccountingPeriodService.cs`, `tests/Pitbull.Tests.Unit/Billing/AccountingPeriodServiceTests.cs`
- Verdict: **Fixed correctly**
- Evidence:
  - Overlap check present: `src/Modules/Pitbull.Billing/Services/AccountingPeriodService.cs:70`
  - Regression test present: `tests/Pitbull.Tests.Unit/Billing/AccountingPeriodServiceTests.cs:252`

### HIGH #17 — Vendor portal tokens stored plaintext
- Files reviewed: `src/Modules/Pitbull.Billing/Services/VendorPortalService.cs`, `tests/Pitbull.Tests.Unit/Services/VendorPortalServiceTests.cs`
- Verdict: **Fixed correctly**
- Evidence:
  - Token hashed before persistence: `src/Modules/Pitbull.Billing/Services/VendorPortalService.cs:35`
  - Validation hashes input then compares hash: `src/Modules/Pitbull.Billing/Services/VendorPortalService.cs:102`
  - Tests cover storage hash + raw-token validation: `tests/Pitbull.Tests.Unit/Services/VendorPortalServiceTests.cs:498`, `tests/Pitbull.Tests.Unit/Services/VendorPortalServiceTests.cs:512`

---

## New / Additional Issues Found During Verification

1. **Critical deployment completeness risk**: WIP unique index appears configured in model config but not reflected in migration snapshot (`src/Pitbull.Api/Migrations/PitbullDbContextModelSnapshot.cs:5756`), so production DBs may not receive this protection unless a migration exists outside current snapshot.

2. **Fix-claim mismatch outside spot-check set**: HIGH #12 was documented as “require Submitted”, but code allows `Submitted` **or** `Processing`: `src/Modules/Pitbull.Billing/Services/PayrollReviewService.cs:71`.

3. **Potentially new behavioral regression**: Payroll export now silently skips employees with missing allocations and still marks run `Exported` (`src/Modules/Pitbull.Billing/Services/PayrollExportService.cs:110`, `src/Modules/Pitbull.Billing/Services/PayrollExportService.cs:169`), which can produce incomplete exports without failing fast.

---

## Final Summary
- CRITICALs: **1 fully fixed, 1 mostly fixed, 1 partially fixed**
- Spot-checked HIGHs: **4 fixed, 1 partially fixed**
- Overall: major progress, but **not fully closed** due migration completeness for CRITICAL #1 and remaining concurrency behavior in HIGH #5.

---

## Addendum — Verification of Commit `1ddcc24` (Feb 21, 2026)

Re-checked the three previously open gaps against current source and migration state.

1. **Gap (WIP unique index migration missing): CLOSED**
   - Migration added: `src/Pitbull.Api/Migrations/20260221183343_AddWipGlJournalEntryIdIndex.cs:13`
   - Snapshot now includes index + filter: `src/Pitbull.Api/Migrations/PitbullDbContextModelSnapshot.cs:5758`

2. **Gap (PO numbering non-atomic): CLOSED**
   - `PurchaseOrderService` now uses retry-on-unique-violation with regenerated PO number: `src/Modules/Pitbull.Billing/Services/PurchaseOrderService.cs:110`
   - Pattern matches `JournalEntryService` behavior (3-attempt loop + `DbUpdateException` unique-violation gate + regenerate number): `src/Modules/Pitbull.Billing/Services/PurchaseOrderService.cs:111` and `src/Modules/Pitbull.Billing/Services/JournalEntryService.cs:150`

3. **Gap (Payroll export silent skip): CLOSED**
   - Missing allocations are collected and now fail fast with `MISSING_ALLOCATIONS` instead of exporting partial data: `src/Modules/Pitbull.Billing/Services/PayrollExportService.cs:172`
   - Export persistence and run status transition happen only after that guard: `src/Modules/Pitbull.Billing/Services/PayrollExportService.cs:185`

**Conclusion:** all three previously identified gaps are now closed in `1ddcc24`.
