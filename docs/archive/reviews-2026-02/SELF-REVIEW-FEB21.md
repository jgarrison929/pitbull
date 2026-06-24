# Self-Review — Post-Stability Fixes (Feb 21, 2026)

After implementing all 3 CRITICAL, 15 HIGH, and 8 MEDIUM fixes from `STABILITY-REVIEW-FEB21.md`, a self-review scan of all modified files uncovered 4 additional issues.

## Findings

### Finding 1: Three Additional Controllers with Guid.Empty Vulnerability

**Severity:** MEDIUM (same class as original MEDIUM #8)
**Files:**
- `src/Pitbull.Api/Controllers/PurchaseOrdersController.cs` — `Approve` action
- `src/Pitbull.Api/Controllers/LienWaiversController.cs` — `Approve` and `Reject` actions
- `src/Pitbull.Api/Controllers/RetentionController.cs` — `ReleaseRetention` action

**Problem:** The original MEDIUM #8 fix addressed `GetCurrentUserId()` returning `Guid.Empty` on parse failure in 3 controllers (JournalEntries, AccountingPeriods, BankReconciliations). However, 3 additional controllers had the identical pattern — returning `Guid.Empty` when user claims are missing, which would write a zeroed GUID into the database on mutating operations.

**Fix:** Changed `GetCurrentUserId()` in all 3 controllers from `Guid` return type to `Guid?`, returning `null` on parse failure. Added `if (userId is null) return Unauthorized(...)` guard before each mutating operation.

**Test impact:** The `VendorInvoicesControllerTests` test class used `PurchaseOrdersController.Approve()` internally without user claims on the HTTP context. Fixed by adding a `ClaimsPrincipal` with a "sub" claim to the test's `PurchaseOrdersController` setup. The `RetentionControllerTests` and `LienWaiversControllerTests` already had proper claims configured.

### Finding 2: Owner Contract CREATE Missing Materials Retainage Bounds

**Severity:** MEDIUM
**File:** `src/Modules/Pitbull.Billing/Services/OwnerContractService.cs`

**Problem:** The MEDIUM #3/#9 fix added bounds validation (0-100%) for both `DefaultRetainagePercent` and `RetainagePercentMaterials` on the **update** path. However, the **create** path only validated `DefaultRetainagePercent` bounds — `RetainagePercentMaterials` had no bounds check on creation, allowing values like -5% or 200% to be persisted.

**Fix:** Added `RetainagePercentMaterials` bounds validation (0-100%) to `CreateContractAsync`, immediately after the existing `DefaultRetainagePercent` check.

## Tests Added

5 new tests in `tests/Pitbull.Tests.Unit/Stability/MediumFixesTests.cs`:

1. `OwnerContract_Create_RejectsNegativeMaterialsRetainage` — Verifies create-path rejects -5% materials retainage
2. `OwnerContract_Create_RejectsMaterialsRetainageOver100` — Verifies create-path rejects 150% materials retainage
3. `PurchaseOrdersController_Approve_NoUserClaims_Returns401` — Verifies PO approve returns 401 without claims
4. `LienWaiversController_Approve_NoUserClaims_Returns401` — Verifies lien waiver approve returns 401 without claims
5. `RetentionController_Release_NoUserClaims_Returns401` — Verifies retention release returns 401 without claims

## Verification

- Full test suite: **2657 passed, 0 failed, 2 skipped**
- Build: **0 warnings, 0 errors**

## Files Changed

- `src/Pitbull.Api/Controllers/PurchaseOrdersController.cs`
- `src/Pitbull.Api/Controllers/LienWaiversController.cs`
- `src/Pitbull.Api/Controllers/RetentionController.cs`
- `src/Modules/Pitbull.Billing/Services/OwnerContractService.cs`
- `tests/Pitbull.Tests.Unit/Api/VendorInvoicesControllerTests.cs`
- `tests/Pitbull.Tests.Unit/Stability/MediumFixesTests.cs`
