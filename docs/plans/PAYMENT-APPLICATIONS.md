# Payment Applications (AIA G702/G703) — Design Spec

**Author:** Codex (for Pitbull team)
**Date:** 2026-02-17
**Status:** Ready for implementation
**Target Modules:** `Pitbull.Contracts` + `Pitbull.Billing` + `Pitbull.Web`

---

## Problem

Pitbull already supports basic payment applications and SOV editing, but billing is still mostly header-level math. Construction pay apps require full AIA G702/G703 structure with line-level progression against SOV, retainage controls, approval workflow, and finance views that satisfy both GAAP financial reporting and Bonus/Job Cost operational reporting.

## Goals

1. Implement full AIA G702 summary and G703 continuation-sheet billing workflow.
2. Bill pay apps directly against existing `schedule_of_values` and `sov_line_items` records.
3. Support line-level calculations: scheduled value, previous/this period completed work, stored materials, percent complete, retainage, balance to finish.
4. Add company-scoped retainage + workflow settings via `PaymentApplicationSettings`.
5. Enforce lifecycle: `Draft -> Submitted -> Reviewed -> Approved -> Paid`.
6. Support dual-book views: GAAP revenue recognition and Bonus/Job Cost management view.
7. Provide PDF export matching AIA G702/G703 layouts.
8. Deliver frontend UX for list/detail/grid workflow and export.

## Non-Goals

- No external invoicing/AP integration in v1.
- No owner-portal e-signatures in v1.
- No OCR ingestion of third-party PDFs in v1 (future AI workflow).

---

## Domain Perspectives

### CFO

- Needs trustworthy period-based billed/earned/revenue metrics for GAAP close.
- Needs audit-ready history of status transitions, approvals, and paid amounts.
- Needs retainage liability visibility and release handling at substantial completion.

### Job Cost Accountant

- Needs SOV line-level earned/billed continuity with no math drift across applications.
- Needs Bonus/Job Cost view showing production progress and margin-risk signals.
- Needs retainage and stored-material handling consistent across all subcontracts.

### Project Manager

- Needs quick editable SOV grid for monthly billing cycle.
- Needs clear workflow gates and reasons when a pay app cannot advance.
- Needs snapshot-based history to defend owner review conversations.

### Subcontractor AP Specialist

- Needs application package that matches AIA forms owners expect.
- Needs invoice/check traceability and status visibility through payment.
- Needs predictable retainage treatment and release timing.

---

## Current-State Alignment

Existing foundation in repo:

- `PaymentApplication` entity exists in `Pitbull.Contracts`.
- `ScheduleOfValues` + `SOVLineItem` entities exist in tables `schedule_of_values` and `sov_line_items`.
- API routes exist under `/api/paymentapplications` and `/api/sov/*`.
- Current contract print page has G702/G703-style rendering but not full governed export pipeline.

This spec extends, not replaces, those patterns.

---

## AIA Standard Mapping

## AIA G702 (Application and Certificate for Payment)

Pitbull fields map to G702 lines:

1. Original Contract Sum
2. Net Change by Change Orders
3. Contract Sum to Date (1 + 2)
4. Total Completed and Stored to Date
5. Retainage (work/material as configured)
6. Total Earned Less Retainage
7. Less Previous Certificates for Payment
8. Current Payment Due
9. Balance to Finish (3 - 6)

Additional metadata:

- Application number
- Billing period start/end
- Contractor/subcontractor identity
- Architect/owner fields (configurable labels)
- Certification statement + approvals/signature placeholders

## AIA G703 (Continuation Sheet)

Each row corresponds to an SOV line item and stores:

- Item number / CSI code (if available)
- Description of work
- Scheduled value
- Work completed from previous applications
- Work completed this period
- Materials presently stored
- Total completed and stored to date
- Percent complete
- Balance to finish
- Retainage

Totals roll up to G702 lines automatically.

---

## Core Business Rules

1. Pay app line items must reference active SOV line items (`!IsDeleted`).
2. Line-item progress is cumulative and cannot become negative.
3. `TotalCompletedAndStoredToDate <= ScheduledValue` unless explicit overbilling override setting is enabled.
4. Retainage defaults from company settings, can be overridden per subcontract/SOV (with audit).
5. Retainage release allowed only when status and substantial completion conditions are satisfied.
6. Status progression must be forward-only unless user has override permission.
7. `PaidAmount` may be less than approved amount only with reason code.
8. Snapshot lock: once status reaches `Submitted`, line-level snapshot for that application is immutable unless reverted to `Draft` by privileged role.

---

## Data Model

All entities inherit `BaseEntity`; company-scoped entities implement `ICompanyScoped`.

## Existing Entities to Extend

### `PaymentApplication`

Add/adjust fields:

- `ScheduleOfValuesId: Guid`
- `Status: PaymentApplicationStatus` (normalize to lifecycle subset)
- `RevenueRecognitionDate: DateOnly?`
- `BookModeApplied: AccountingBookMode` (`Gaap`, `Bonus`, `Both`)
- `SubstantialCompletionDate: DateOnly?`
- `RetainageReleaseAmount: decimal`
- `CertifiedByName: string?`
- `CertifiedByTitle: string?`
- `CertifiedDate: DateTime?`
- `ReviewedBy: string?`
- `ReviewedNotes: string?`
- `PaidAmount: decimal?`
- `PaidReference: string?`

### `PaymentApplicationStatus` (normalize)

Use canonical workflow for this feature:

- `Draft = 0`
- `Submitted = 1`
- `Reviewed = 2`
- `Approved = 3`
- `Paid = 4`

Optional non-happy-path statuses can remain (`Rejected`, `Void`) but core workflow and UI must enforce above path.

## New Entities

### `PaymentApplicationLineItem`

Company-scoped detail snapshot tied to pay app and SOV line item:

- `PaymentApplicationId: Guid`
- `SOVLineItemId: Guid`
- `ItemNumber: string` (snapshot)
- `Description: string` (snapshot)
- `ScheduledValue: decimal`
- `WorkCompletedPrevious: decimal`
- `WorkCompletedThisPeriod: decimal`
- `MaterialsStoredPrevious: decimal`
- `MaterialsStoredThisPeriod: decimal`
- `MaterialsStoredToDate: decimal`
- `TotalCompletedAndStoredToDate: decimal`
- `PercentComplete: decimal`
- `BalanceToFinish: decimal`
- `RetainagePercent: decimal`
- `RetainageAmount: decimal`
- `SortOrder: int`

### `PaymentApplicationBookEntry`

Dual-book rollup per pay app:

- `PaymentApplicationId: Guid`
- `BookType: AccountingBookType` (`GAAP`, `BonusJobCost`)
- `EarnedRevenueToDate: decimal`
- `CurrentPeriodRevenue: decimal`
- `BillingsToDate: decimal`
- `CurrentPeriodBilling: decimal`
- `RetainageHeldToDate: decimal`
- `OverUnderBilling: decimal`
- `GeneratedAt: DateTime`

### `PaymentApplicationSettings`

Company-scoped configurable settings entity:

- `CompanyId: Guid`
- `DefaultRetainagePercent: decimal` (e.g. 5-10)
- `EnableApprovalWorkflow: bool`
- `RequireSignedSubcontract: bool`
- `AllowRetainageOverride: bool`
- `AllowRetainageReleaseBeforeFinal: bool`
- `DefaultBookMode: AccountingBookMode` (`Both` default)
- `LockSubmittedLineItems: bool`
- `RequireLienWaiverBeforePaid: bool` (future-compatible toggle)

---

## Calculation Model

Per line item:

- `work_to_date = work_completed_previous + work_completed_this_period`
- `materials_to_date = materials_stored_previous + materials_stored_this_period`
- `total_completed_stored = work_to_date + materials_to_date`
- `percent_complete = total_completed_stored / scheduled_value`
- `retainage_amount = (work_completed_this_period + materials_stored_this_period) * retainage_percent`
- `balance_to_finish = scheduled_value - total_completed_stored`

Pay app totals:

- `g702_line_4 = sum(total_completed_stored)`
- `g702_line_5 = sum(retainage_amount_to_date)`
- `g702_line_6 = line_4 - line_5`
- `g702_line_7 = previous_certificates`
- `g702_line_8 = line_6 - line_7`
- `g702_line_9 = contract_sum_to_date - line_6`

Retainage release:

- If release event triggered, move release amount out of held retainage and into current payment due with audit trail.

---

## Dual-Book Accounting (GAAP + Bonus/Job Cost)

## GAAP View

Purpose: external financial reporting and WIP alignment.

- Uses revenue recognition rules by period.
- Surfaces over/under billings.
- Locks recognition date once period closes.

## Bonus/Job Cost View

Purpose: project performance management.

- Uses operational percent complete and production progress emphasis.
- Allows management adjustments (with reason codes) without altering GAAP ledger numbers.

## Implementation Approach

- Persist both views in `PaymentApplicationBookEntry` generated during submit/review/approve and recalculated on permitted edits.
- API supports `bookType` query parameter for summaries and exports.
- UI toggle between `GAAP` and `Bonus/Job Cost` views without changing source pay app status.

---

## Backend API Design

All endpoints `[Authorize]` and rate-limited with existing `api` policy.

## 1) Payment Applications Controller

Route base: `api/paymentapplications`

### Existing routes (keep)

- `POST /api/paymentapplications`
- `GET /api/paymentapplications/{id:guid}`
- `GET /api/paymentapplications`
- `PUT /api/paymentapplications/{id:guid}`
- `DELETE /api/paymentapplications/{id:guid}` (soft-delete only)

### New/extended routes

1. `GET /api/paymentapplications/{id:guid}/line-items`
- Returns `PaymentApplicationLineItemDto[]`.

2. `PUT /api/paymentapplications/{id:guid}/line-items`
- Bulk upsert line grid for draft app.

Request DTO:

```csharp
public sealed record UpdatePaymentApplicationLineItemsRequest(
    IReadOnlyList<PaymentApplicationLineItemInputDto> Items,
    bool RecalculateTotals = true
);
```

3. `POST /api/paymentapplications/{id:guid}/submit`
- Transition `Draft -> Submitted`.

4. `POST /api/paymentapplications/{id:guid}/review`
- Transition `Submitted -> Reviewed`.

Request DTO:

```csharp
public sealed record ReviewPaymentApplicationRequest(
    string ReviewedBy,
    string? Notes
);
```

5. `POST /api/paymentapplications/{id:guid}/approve`
- Transition `Reviewed -> Approved`.

Request DTO:

```csharp
public sealed record ApprovePaymentApplicationRequest(
    string ApprovedBy,
    decimal? ApprovedAmount,
    DateOnly? RevenueRecognitionDate,
    string? Notes
);
```

6. `POST /api/paymentapplications/{id:guid}/mark-paid`
- Transition `Approved -> Paid`.

Request DTO:

```csharp
public sealed record MarkPaymentApplicationPaidRequest(
    decimal PaidAmount,
    DateTime PaidDate,
    string PaymentReference,
    string? CheckNumber,
    string? Notes
);
```

7. `GET /api/paymentapplications/{id:guid}/summary`
- Returns G702 rollup + workflow metadata.

8. `GET /api/paymentapplications/{id:guid}/summary?bookType=GAAP|BonusJobCost`
- Returns selected book view metrics.

9. `GET /api/paymentapplications/{id:guid}/export/g702.pdf`
- AIA G702 PDF output.

10. `GET /api/paymentapplications/{id:guid}/export/g703.pdf`
- AIA G703 PDF output.

11. `GET /api/paymentapplications/{id:guid}/export/package.pdf`
- Combined package PDF.

## 2) Payment Application Settings Controller

Route base: `api/companies/settings/payment-applications`

Pattern mirrors `TimecardSettingsController` (company-scoped by active company context).

1. `GET /api/companies/settings/payment-applications`

Response DTO:

```csharp
public sealed record PaymentApplicationSettingsDto(
    decimal DefaultRetainagePercent,
    bool EnableApprovalWorkflow,
    bool RequireSignedSubcontract,
    bool AllowRetainageOverride,
    bool AllowRetainageReleaseBeforeFinal,
    AccountingBookMode DefaultBookMode,
    bool LockSubmittedLineItems,
    bool RequireLienWaiverBeforePaid
);
```

2. `PUT /api/companies/settings/payment-applications`

Request DTO:

```csharp
public sealed record UpdatePaymentApplicationSettingsRequest(
    decimal DefaultRetainagePercent,
    bool EnableApprovalWorkflow,
    bool RequireSignedSubcontract,
    bool AllowRetainageOverride,
    bool AllowRetainageReleaseBeforeFinal,
    AccountingBookMode DefaultBookMode,
    bool LockSubmittedLineItems,
    bool RequireLienWaiverBeforePaid
);
```

## 3) SOV Integration Routes (new helper routes)

1. `POST /api/paymentapplications/from-sov/{sovId:guid}`
- Create draft pay app pre-populated from SOV line items and prior pay app history.

Request DTO:

```csharp
public sealed record CreatePaymentApplicationFromSovRequest(
    DateTime PeriodStart,
    DateTime PeriodEnd,
    string? InvoiceNumber,
    string? Notes
);
```

2. `GET /api/sov/{sovId:guid}/billing-preview`
- Returns projected G702/G703 values before app creation.

---

## DTO Definitions

### Header DTO

```csharp
public sealed record PaymentApplicationDetailDto(
    Guid Id,
    Guid SubcontractId,
    Guid ScheduleOfValuesId,
    int ApplicationNumber,
    DateTime PeriodStart,
    DateTime PeriodEnd,
    PaymentApplicationStatus Status,
    decimal CurrentPaymentDue,
    decimal TotalCompletedAndStored,
    decimal TotalRetainage,
    decimal RetainagePercent,
    decimal? PaidAmount,
    DateTime? SubmittedDate,
    DateTime? ReviewedDate,
    DateTime? ApprovedDate,
    DateTime? PaidDate,
    string? ApprovedBy,
    string? ReviewedBy,
    string? InvoiceNumber,
    string? CheckNumber,
    string? Notes,
    PaymentApplicationG702Dto G702,
    IReadOnlyList<PaymentApplicationLineItemDto> G703LineItems,
    IReadOnlyList<PaymentApplicationBookEntryDto> BookEntries
);
```

### G702 DTO

```csharp
public sealed record PaymentApplicationG702Dto(
    decimal OriginalContractSum,
    decimal NetChangeByChangeOrders,
    decimal ContractSumToDate,
    decimal TotalCompletedAndStoredToDate,
    decimal RetainageToDate,
    decimal TotalEarnedLessRetainage,
    decimal LessPreviousCertificates,
    decimal CurrentPaymentDue,
    decimal BalanceToFinish
);
```

### G703 Line DTO

```csharp
public sealed record PaymentApplicationLineItemDto(
    Guid Id,
    Guid SOVLineItemId,
    string ItemNumber,
    string Description,
    decimal ScheduledValue,
    decimal WorkCompletedPrevious,
    decimal WorkCompletedThisPeriod,
    decimal MaterialsStoredPrevious,
    decimal MaterialsStoredThisPeriod,
    decimal TotalCompletedAndStoredToDate,
    decimal PercentComplete,
    decimal BalanceToFinish,
    decimal RetainagePercent,
    decimal RetainageAmount,
    int SortOrder
);
```

---

## Service Layer Design

## Interfaces

- `IPaymentApplicationService` (header, workflow, totals)
- `IPaymentApplicationLineItemService` (G703 grid operations)
- `IPaymentApplicationExportService` (PDF generation)
- `IPaymentApplicationSettingsService` (company settings)
- `IPaymentApplicationBookService` (GAAP + Bonus projections)

## Key Service Behaviors

1. `CreateFromSovAsync`:
- pulls SOV + prior paid/submitted history,
- snapshots line items,
- applies retainage settings hierarchy: app override -> SOV -> company default.

2. `RecalculateAsync`:
- recomputes all line and header derived fields,
- validates cross-footing between G702 and G703.

3. `TransitionStatusAsync`:
- enforces allowed transitions,
- stores actor/date notes,
- writes audit records.

4. `GeneratePdfAsync`:
- produces deterministic G702/G703 layout,
- supports package export,
- includes generation metadata (app id/version/timezone).

---

## Workflow and State Machine

Allowed transitions:

- `Draft -> Submitted`
- `Submitted -> Reviewed`
- `Reviewed -> Approved`
- `Approved -> Paid`

Privileged fallback transitions (optional policy):

- `Reviewed -> Draft` (rework)
- `Approved -> Reviewed` (correction before payment)

Hard gates:

- `RequireSignedSubcontract = true`: block submit if subcontract missing execution/signature metadata.
- If workflow enabled: direct `Draft -> Approved` not allowed.
- `Paid` requires payment reference and paid amount/date.

---

## Retainage Policy

Retainage hierarchy:

1. Pay app explicit override (if allowed)
2. SOV retainage percent
3. `PaymentApplicationSettings.DefaultRetainagePercent`

Defaults:

- Typical range 5-10%; validation supports `0..100` with warning above 15.

Retainage release:

- If `AllowRetainageReleaseBeforeFinal = false`, release only when substantial completion recorded.
- Release events must generate audit note and update both GAAP and Bonus entries.

---

## PDF Export Design

## Output Requirements

- `G702.pdf` one-page (or multipage when legal text overflows) standard style.
- `G703.pdf` continuation sheet with repeating header and totals footer.
- `package.pdf` = G702 + G703 + optional approval/signature block pages.

## Layout Fidelity

- Match AIA line naming/order and numeric placement.
- Fixed-width numeric columns for reconciliation.
- Footer includes generated timestamp, timezone, application id, and data version hash.

## Technical Approach

- Backend PDF generation service (server-side) to ensure deterministic output.
- Use dedicated template renderer and tested coordinate map.
- Validate totals in export pipeline before rendering; fail export if out-of-balance.

---

## Frontend Design

## 1) Payment App List Page

Path: `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/payment-applications/page.tsx` (enhance existing)

Capabilities:

- filters by company/subcontract/status/period,
- status badges and aging indicators,
- quick actions: open detail, submit/review/approve/paid, export PDF.

## 2) Payment App Detail + Editable SOV Grid

Path: `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/contracts/[id]/payment-applications/[paymentAppId]/page.tsx` (new)

Components:

- `PaymentApplicationHeaderCard`
- `PaymentApplicationStatusWorkflow`
- `PaymentApplicationG702Summary`
- `PaymentApplicationG703Grid` (editable)
- `PaymentApplicationBookToggle` (`GAAP` / `Bonus/Job Cost`)
- `PaymentApplicationActions`

Grid behavior:

- inline edit for `work this period`, `materials this period`, retainage override (if allowed),
- auto-calc non-editable fields (`% complete`, balance, totals),
- row and footer validation states,
- save draft and submit actions.

## 3) Contract-Specific Pay App Page

Path: `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/contracts/[id]/payment-applications/page.tsx` (enhance existing)

- create from SOV,
- show latest G702 key totals,
- deep link to detail editor,
- export action per application.

## 4) Payment App Settings Admin Page

Path: `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/admin/payment-applications-settings/page.tsx` (new)

- edit company defaults for retainage/workflow requirements,
- preview impact rules,
- role-restricted to admin/finance.

---

## Security and Authorization

- `[Authorize]` required on all routes.
- Role guidance:
- Draft edit/create: `Admin,ProjectManager,JobCostAccountant`.
- Review: `Admin,ProjectManager`.
- Approve: `Admin,CFO,Controller`.
- Mark paid: `Admin,AP`.
- Settings: `Admin,CFO`.
- Ensure no stack traces in responses.
- Audit every status change, retainage override, and payment event.

---

## Integration Points

1. `Subcontract`:
- enforce signed subcontract gate (setting driven).

2. `ScheduleOfValues`:
- source-of-truth for line-item structure and scheduled values.

3. `ChangeOrder`:
- net change by CO feeds G702 line 2.

4. `Reports`:
- financial overview should consume new GAAP/Bonus projections.

5. `Documents` module:
- optional attach exported PDFs and supporting docs.

---

## Migration and Backfill

1. Add new tables:
- `payment_application_line_items`
- `payment_application_book_entries`
- `payment_application_settings`

2. Backfill existing pay apps:
- derive line snapshots from current SOV state where possible,
- flag uncertain historical mappings for manual review.

3. Settings seed:
- default retainage 10,
- approval workflow enabled,
- require signed subcontract enabled (recommended).

Migration safety:

- no rename/drop patterns that violate CI rules,
- use bounded `varchar` lengths and `LEFT` in backfill SQL where needed.

---

## Testing Strategy

## Unit Tests

- line-item calc engine,
- retainage policy engine,
- state transition guard,
- GAAP/Bonus projection generation,
- G702/G703 cross-foot validation.

## Integration Tests

- create-from-SOV flow,
- full lifecycle transitions,
- signed-subcontract gate behavior,
- retainage release scenarios,
- PDF export endpoints (content smoke checks),
- tenant/company isolation and soft-delete behavior.

## Frontend Tests

- editable grid calculations,
- status workflow actions,
- book-type toggle rendering,
- export button and error handling,
- settings page persistence.

---

## Rollout Plan

## Phase 1: Data + Settings + Calculations

- implement entities/migrations/settings API,
- implement calculation + projection services,
- backfill strategy for existing records.

## Phase 2: Workflow + Detail UI

- add transition endpoints,
- ship detail page with editable G703 grid and G702 summary,
- enforce workflow gates.

## Phase 3: PDF Exports + Reporting

- implement deterministic G702/G703 PDF rendering,
- wire export actions in list/detail pages,
- integrate GAAP/Bonus views into finance reports.

---

## Acceptance Criteria

1. A payment application can be created from SOV with pre-populated G703 line items.
2. G703 edits auto-recalculate G702 totals and remain cross-foot balanced.
3. Company setting controls default retainage percent and workflow toggles.
4. Lifecycle strictly supports `Draft -> Submitted -> Reviewed -> Approved -> Paid` with status timestamps and audit trail.
5. Signed subcontract requirement blocks submit when configured.
6. GAAP and Bonus/Job Cost views are both available and reconcile to the same source pay app with separate projections.
7. Export endpoints produce AIA-style G702 and G703 PDFs with correct values and stable formatting.
8. Frontend provides list + detail + editable SOV grid + workflow actions + PDF export.
