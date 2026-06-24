# AIA G702/G703 Billing Package System — Design Specification

> **Status:** Draft
> **Module:** `Pitbull.Billing` (new) + `Pitbull.Contracts` (extends existing)
> **Author:** AI-assisted design
> **Date:** 2026-02-19
> **Prerequisites:** AP/AR Foundation (AP-AR-FOUNDATION-SPEC.md), Retention & Lien Waiver (RETENTION-LIEN-WAIVER-SPEC.md), GL Accounting (GL-ACCOUNTING-SPEC.md)

---

## Table of Contents

1. [Purpose & Scope](#1-purpose--scope)
2. [Glossary](#2-glossary)
3. [Schedule of Values Setup](#3-schedule-of-values-setup)
4. [G702 Generation](#4-g702-generation-application-and-certificate-for-payment)
5. [G703 Continuation Sheet](#5-g703-continuation-sheet)
6. [Billing Period Workflow](#6-billing-period-workflow)
7. [Change Order Integration](#7-change-order-integration)
8. [Retainage Calculation](#8-retainage-calculation)
9. [Stored Materials Tracking](#9-stored-materials-tracking)
10. [PDF Generation](#10-pdf-generation)
11. [AI Agent Opportunities](#11-ai-agent-opportunities)
12. [Predictive Features](#12-predictive-features)
13. [Domain Entities](#13-domain-entities)
14. [API Surface](#14-api-surface)
15. [Implementation Phases](#15-implementation-phases)
16. [Acceptance Criteria](#16-acceptance-criteria)

---

## 1. Purpose & Scope

### 1.1 Problem Statement

The AIA G702 (Application and Certificate for Payment) and G703 (Continuation Sheet) are **the** standard billing documents in commercial construction. Virtually every prime contract in the United States requires monthly progress billing in this format. Yet in most construction ERPs — including Vista — the G702/G703 is generated in Excel, submitted to the owner, and then manually re-entered back into the accounting system.

This double-entry problem costs mid-size GCs hundreds of hours per year and introduces transcription errors that corrupt AR aging, WIP schedules, and revenue recognition.

### 1.2 Key Distinction: AR-Side vs. AP-Side

The existing codebase has `PaymentApplication`, `PaymentApplicationLineItem`, and `SOVLineItem` entities that model the **AP-side** — subcontractors billing us. The G702/G703 system models the **AR-side** — us billing the owner. While the data structures are similar, the workflows, approval chains, and document requirements are fundamentally different:

| Aspect | AP Side (Sub → Us) | AR Side (Us → Owner) |
|--------|--------------------|-----------------------|
| Who creates | Subcontractor submits | PM creates |
| Who approves | PM reviews, approves | Owner/Architect certifies |
| Document format | Sub's format (often AIA-based) | AIA G702/G703 (mandatory) |
| Retention direction | We withhold from sub | Owner withholds from us |
| SOV ownership | Sub's SOV (their line items) | Our SOV (our line items to owner) |
| Supporting docs | Sub provides to us | We provide to owner + collect from subs |
| GL impact | AP liability + job cost | AR receivable + revenue |

This spec introduces the AR-side billing system while preserving and integrating with the existing AP-side entities.

### 1.3 Goals

| Goal | Description |
|------|-------------|
| Native G702/G703 | Generate AIA-compliant payment applications directly from live SOV data |
| Single data entry | PM updates progress → system generates billing → posts to AR. No Excel roundtrip. |
| Billing package assembly | Auto-assemble complete billing package per owner requirements |
| Period integrity | Sequential application numbering with carry-forward validation |
| Retention accuracy | Per-line-item retention with support for step-down schedules |
| Change order flow | Approved COs automatically adjust SOV and contract values |
| PDF generation | Print-ready AIA-format documents for owner submission |
| Owner portal readiness | Export in formats compatible with major owner billing portals |

### 1.4 Existing Codebase Anchors

| Entity | Location | Relationship to This Spec |
|--------|----------|--------------------------|
| `PaymentApplication` | `Pitbull.Contracts` | **AP-side** — sub billing us. AR-side needs a mirror entity. |
| `PaymentApplicationLineItem` | `Pitbull.Contracts` | G703 line structure — will be generalized for AR side |
| `ScheduleOfValues` | `Pitbull.Contracts` | Currently linked to `Subcontract` — need owner SOV variant |
| `SOVLineItem` | `Pitbull.Contracts` | Line item structure reusable for owner SOV |
| `ChangeOrder` | `Pitbull.Contracts` | Currently sub-only — need owner change order support |
| `PaymentApplicationBookEntry` | `Pitbull.Contracts` | Dual-book entries — extends to AR billings |
| `ContractSettings` | `Pitbull.Core` | Already has `AiaArchitectName`, `AiaOwnerName` |
| `PaymentApplicationSettings` | `Pitbull.Core` | Retention defaults and override controls |
| `RetentionLedger` | RETENTION-LIEN-WAIVER-SPEC | AR-side retention entries created by billing |
| `LienWaiver` | RETENTION-LIEN-WAIVER-SPEC | Outbound waivers included in billing package |
| `ArBilling` | AP-AR-FOUNDATION-SPEC | AR subledger entry created from billing |
| `CustomerOwner` | AP-AR-FOUNDATION-SPEC | Owner/customer master for billing |
| `CustomerProjectContract` | AP-AR-FOUNDATION-SPEC | Contract terms and billing requirements |

### 1.5 Non-Goals (This Phase)

- Time & Materials billing format (separate spec)
- Cost-Plus billing format (separate spec)
- GMP (Guaranteed Maximum Price) billing specifics
- Sub-tier payment application processing
- Electronic signatures on AIA documents
- Direct Textura/GCPay/Procore portal API integration (Phase 2+)

---

## 2. Glossary

| Term | Definition |
|------|------------|
| **AIA** | American Institute of Architects — publishes standard construction contract documents |
| **G702** | AIA Document G702 — Application and Certificate for Payment. Summary page showing contract totals, retainage, and amount due. |
| **G703** | AIA Document G703 — Continuation Sheet. Line-by-line SOV detail showing work completed per item. |
| **Schedule of Values (SOV)** | Breakdown of contract amount into billing line items. Each line has a scheduled value and is billed progressively. |
| **Scheduled Value** | The amount allocated to an SOV line item. Sum of all scheduled values = contract amount. |
| **Application Number** | Sequential number for each billing period (App #1, #2, etc.). Must be continuous. |
| **Period Through** | The end date of the billing period covered by the application. |
| **Previous Certificates** | Total amount certified (approved) in all prior applications. |
| **Stored Materials** | Materials procured and stored (on-site or off-site) but not yet incorporated into the work. |
| **Balance to Finish** | Scheduled Value minus Total Completed and Stored. What remains to be billed on each line. |
| **Certificate for Payment** | The architect's certification that the work described in the application has been completed. |
| **Billing Package** | The complete set of documents submitted to the owner: G702, G703, lien waivers, CO log, supporting documentation. |
| **Overbilling** | Billing more than the cost-based percent complete. Creates a WIP liability ("Billings in Excess"). |
| **Underbilling** | Billing less than the cost-based percent complete. Creates a WIP asset ("Costs in Excess"). |

---

## 3. Schedule of Values Setup

### 3.1 Owner SOV vs. Sub SOV

The system needs two SOV contexts:

| SOV Type | Purpose | Parent Entity |
|----------|---------|---------------|
| **Owner SOV** (new) | Our billing to the owner — G703 line items | `OwnerContract` / `CustomerProjectContract` |
| **Sub SOV** (existing) | Sub's billing to us — their pay app detail | `Subcontract` |

### 3.2 OwnerScheduleOfValues Entity

```
OwnerScheduleOfValues
├── Id : Guid (PK)
├── TenantId : Guid (RLS)
├── CompanyId : Guid
├── ProjectId : Guid (FK → Projects)
├── CustomerProjectContractId : Guid (FK → CustomerProjectContract)
├── Name : string — "Main SOV" (most projects have one)
├── OriginalContractAmount : decimal(18,2)
├── ApprovedChangeOrderAmount : decimal(18,2) — auto-calculated from approved COs
├── RevisedContractAmount : decimal(18,2) — Original + Approved COs
├── TotalScheduledValue : decimal(18,2) — sum of all line items (must = RevisedContractAmount)
├── DefaultRetainagePercent : decimal(5,2) — inherited from contract, overridable
├── Status : enum (Draft, Active, Locked, Closed)
├── LockedDate : DateTimeOffset? — when SOV was locked (no more line edits without CO)
├── Notes : string?
├── CreatedAt / CreatedBy / UpdatedAt / UpdatedBy (BaseEntity)
```

**Business Rules:**
- SOV cannot be `Active` unless `TotalScheduledValue == RevisedContractAmount` (balanced)
- Line items can only be added/removed while Status is `Draft`
- Once `Active`, line values can only change via Change Order integration
- `Locked` prevents any modification — used during billing to ensure consistency

### 3.3 OwnerSOVLineItem Entity

```
OwnerSOVLineItem
├── Id : Guid (PK)
├── TenantId : Guid (RLS)
├── CompanyId : Guid
├── OwnerScheduleOfValuesId : Guid (FK → OwnerScheduleOfValues)
│
│  Identity
├── ItemNumber : string — "001", "002", etc. (or "01.A", "02.A.1" for sub-items)
├── Description : string — "General Conditions", "Concrete Foundations", etc.
├── SortOrder : int
│
│  Values
├── OriginalValue : decimal(18,2) — original scheduled value
├── ApprovedChangeOrderValue : decimal(18,2) — sum of COs allocated to this line
├── ScheduledValue : decimal(18,2) — Original + CO adjustments (the G703 Column C)
│
│  Cumulative Progress (updated each billing)
├── WorkCompletedPrevious : decimal(18,2) — sum of all prior period billings
├── WorkCompletedThisPeriod : decimal(18,2) — current period billing amount
├── MaterialsStoredPrevious : decimal(18,2) — prior stored materials
├── MaterialsStoredCurrent : decimal(18,2) — new stored materials this period
├── MaterialsInstalledThisPeriod : decimal(18,2) — moved from stored → installed
│
│  Computed (G703 columns)
├── TotalCompletedAndStored : decimal(18,2) — D + E + F (see G703 mapping)
├── PercentComplete : decimal(5,2) — G ÷ C (capped at 100%)
├── BalanceToFinish : decimal(18,2) — C - G
│
│  Retainage
├── RetainagePercent : decimal(5,2)? — override per line (null = use SOV default)
├── RetainageAmount : decimal(18,2) — calculated retainage on this line
│
│  Cost Code Mapping
├── CostCodeId : Guid? — link to job cost for over/under billing analysis
├── PhaseId : Guid? — optional phase grouping
│
│  Tracking
├── IsFromChangeOrder : bool — true if this line was added via CO
├── SourceChangeOrderId : Guid? — which CO added this line (if applicable)
├── IsFrontLoaded : bool — AI flag: billing exceeds cost-based progress
│
├── Notes : string?
├── CreatedAt / CreatedBy / UpdatedAt / UpdatedBy (BaseEntity)
```

**G703 Column Mapping:**

| G703 Column | Entity Field | Description |
|-------------|-------------|-------------|
| A | `ItemNumber` | Line item number |
| B | `Description` | Description of work |
| C | `ScheduledValue` | Scheduled value (original + COs) |
| D | `WorkCompletedPrevious` | From previous applications |
| E | `WorkCompletedThisPeriod` | This period |
| F | `MaterialsStoredPrevious + MaterialsStoredCurrent` | Materials presently stored |
| G | `TotalCompletedAndStored` | Total completed and stored to date (D+E+F) |
| H | `PercentComplete` | G ÷ C |
| I | `BalanceToFinish` | C - G |

### 3.4 SOV Setup Workflow

```
1. PM creates OwnerScheduleOfValues (Draft status)
   └── Inherits contract amount from CustomerProjectContract

2. PM adds line items
   ├── Manual entry (one at a time)
   ├── Bulk import (CSV/Excel)
   ├── Clone from template (standard project type)
   └── Clone from estimate (if bid module populated)

3. PM verifies balance
   └── System validates: SUM(line.ScheduledValue) == SOV.RevisedContractAmount

4. PM activates SOV
   └── Status → Active. Line items frozen (editable only via COs)

5. Monthly billing begins
   └── PM updates WorkCompletedThisPeriod on each line
```

### 3.5 SOV Templates

Pre-built SOV templates for common project types reduce setup time.

```
OwnerSOVTemplate
├── Id : Guid (PK)
├── TenantId : Guid (RLS)
├── CompanyId : Guid
├── Name : string — "Standard Commercial Office", "Healthcare", "Industrial"
├── Description : string?
├── IsSystem : bool — system-provided vs. company-created
├── CreatedAt / CreatedBy (BaseEntity)

OwnerSOVTemplateLine
├── Id : Guid (PK)
├── TemplateId : Guid (FK → OwnerSOVTemplate)
├── ItemNumber : string
├── Description : string
├── DefaultPercentOfContract : decimal(5,2)? — optional suggested allocation
├── SortOrder : int
├── DefaultCostCodeMapping : string? — suggested cost code
```

---

## 4. G702 Generation (Application and Certificate for Payment)

### 4.1 OwnerPaymentApplication Entity

This is the AR-side equivalent of the existing AP-side `PaymentApplication`.

```
OwnerPaymentApplication
├── Id : Guid (PK)
├── TenantId : Guid (RLS)
├── CompanyId : Guid
├── ProjectId : Guid (FK → Projects)
├── CustomerProjectContractId : Guid (FK → CustomerProjectContract)
├── OwnerScheduleOfValuesId : Guid (FK → OwnerScheduleOfValues)
│
│  Identity
├── ApplicationNumber : int — sequential (1, 2, 3...)
├── PeriodFrom : DateOnly
├── PeriodThrough : DateOnly — G702 "PERIOD TO" field
├── ApplicationDate : DateOnly — date of application
│
│  G702 Lines 1-3: Contract Summary
├── OriginalContractSum : decimal(18,2) — Line 1
├── NetChangeByChangeOrders : decimal(18,2) — Line 2
├── ContractSumToDate : decimal(18,2) — Line 3 = Line 1 + Line 2
│
│  G702 Line 4: Work Progress
├── TotalCompletedAndStoredToDate : decimal(18,2) — Line 4 = Sum of G703 Column G
│
│  G702 Line 5: Retainage
├── RetainageOnCompletedWork : decimal(18,2) — Line 5a
├── RetainageOnStoredMaterials : decimal(18,2) — Line 5b
├── TotalRetainage : decimal(18,2) — Line 5 total = 5a + 5b
├── RetainagePercentWork : decimal(5,2) — rate on completed work
├── RetainagePercentMaterials : decimal(5,2) — rate on stored materials
│
│  G702 Lines 6-9: Net Amounts
├── TotalEarnedLessRetainage : decimal(18,2) — Line 6 = Line 4 - Line 5
├── LessPreviousCertificates : decimal(18,2) — Line 7 (from prior app)
├── CurrentPaymentDue : decimal(18,2) — Line 8 = Line 6 - Line 7
├── BalanceToFinishIncludingRetainage : decimal(18,2) — Line 9 = Line 3 - Line 6
│
│  Status & Workflow
├── Status : enum (see §6 state machine)
├── WorkflowStage : string? — current stage label for display
│
│  PM / Contractor Certification
├── PreparedById : Guid (FK → Employees) — who prepared
├── PreparedDate : DateOnly?
├── ContractorCertifiedById : Guid? — contractor signature
├── ContractorCertifiedDate : DateOnly?
├── ContractorCertifiedNotarized : bool
│
│  Architect Certification (filled by owner/architect response)
├── ArchitectName : string?
├── ArchitectCertifiedAmount : decimal(18,2)? — may differ from requested
├── ArchitectCertifiedDate : DateOnly?
├── ArchitectProjectNumber : string?
│
│  Submission
├── SubmittedDate : DateTimeOffset?
├── SubmittedById : Guid?
├── SubmissionMethod : enum? (Email, Portal, Mail, InPerson)
├── SubmissionReference : string? — portal confirmation #, tracking #, etc.
│
│  Payment Tracking
├── ExpectedPaymentDate : DateOnly? — based on payment terms
├── ActualPaymentDate : DateOnly?
├── PaidAmount : decimal(18,2)?
├── PaymentReference : string?
│
│  AR Integration
├── ArBillingId : Guid? (FK → ArBilling — created on submission)
├── RetentionLedgerEntryIds : string? — JSON array of retention ledger entry IDs
│
│  Billing Package
├── BillingPackageComplete : bool
├── BillingPackageNotes : string?
│
│  Notes
├── InternalNotes : string? — not included in owner package
├── BillingNarrative : string? — cover letter / explanation text
│
├── CreatedAt / CreatedBy / UpdatedAt / UpdatedBy (BaseEntity)
```

### 4.2 G702 Calculation Engine

The G702 values are derived from the G703 line items. The calculation engine runs whenever the application is recalculated.

```
CalculateG702(app):
  lines = app.LineItems (OwnerPaymentApplicationLineItems)

  // Line 1: Original contract (from SOV)
  app.OriginalContractSum = sov.OriginalContractAmount

  // Line 2: Net change orders
  app.NetChangeByChangeOrders = sov.ApprovedChangeOrderAmount

  // Line 3: Contract sum to date
  app.ContractSumToDate = app.OriginalContractSum + app.NetChangeByChangeOrders

  // Line 4: Total completed and stored (from G703)
  app.TotalCompletedAndStoredToDate = SUM(lines.TotalCompletedAndStored)

  // Line 5: Retainage
  completedWork = SUM(lines.WorkCompletedPrevious + lines.WorkCompletedThisPeriod)
  storedMaterials = SUM(lines.MaterialsStoredToDate)
  app.RetainageOnCompletedWork = SUM(lines WHERE HasLineRetainage
      ? lines.CompletedWork * lines.RetainagePercent
      : completedWork * app.RetainagePercentWork)
  app.RetainageOnStoredMaterials = SUM(lines WHERE HasLineRetainage
      ? lines.StoredMaterials * lines.RetainagePercent
      : storedMaterials * app.RetainagePercentMaterials)
  app.TotalRetainage = app.RetainageOnCompletedWork + app.RetainageOnStoredMaterials

  // Line 6: Total earned less retainage
  app.TotalEarnedLessRetainage = app.TotalCompletedAndStoredToDate - app.TotalRetainage

  // Line 7: Previous certificates (from prior application)
  priorApp = GetPreviousApplication(app.ProjectId, app.ApplicationNumber - 1)
  app.LessPreviousCertificates = priorApp?.TotalEarnedLessRetainage ?? 0

  // Line 8: Current payment due
  app.CurrentPaymentDue = app.TotalEarnedLessRetainage - app.LessPreviousCertificates

  // Line 9: Balance to finish
  app.BalanceToFinishIncludingRetainage = app.ContractSumToDate - app.TotalEarnedLessRetainage
```

### 4.3 Carry-Forward Validation

Each application must be consistent with the prior application. On creation of Application #N:

| Field | Validation |
|-------|-----------|
| `ApplicationNumber` | Must equal prior app number + 1 |
| `OriginalContractSum` | Must match prior app (unless CO approved between periods) |
| Each line's `WorkCompletedPrevious` | Must equal prior app's `TotalCompletedAndStored` for that line |
| Each line's `MaterialsStoredPrevious` | Must equal prior app's `MaterialsStoredToDate` for that line |
| `LessPreviousCertificates` | Must equal prior app's `TotalEarnedLessRetainage` |

If any validation fails, the system blocks creation and explains the discrepancy.

---

## 5. G703 Continuation Sheet

### 5.1 OwnerPaymentApplicationLineItem Entity

```
OwnerPaymentApplicationLineItem
├── Id : Guid (PK)
├── TenantId : Guid (RLS)
├── CompanyId : Guid
├── OwnerPaymentApplicationId : Guid (FK → OwnerPaymentApplication)
├── OwnerSOVLineItemId : Guid (FK → OwnerSOVLineItem)
│
│  Snapshot (frozen at time of application creation)
├── ItemNumber : string — from SOV line
├── Description : string — from SOV line
├── ScheduledValue : decimal(18,2) — Column C (from SOV line, includes COs)
├── SortOrder : int
│
│  G703 Columns D-F (editable during draft)
├── WorkCompletedPrevious : decimal(18,2) — Column D: from prior apps
├── WorkCompletedThisPeriod : decimal(18,2) — Column E: this billing period
├── MaterialsStoredToDate : decimal(18,2) — Column F: stored materials balance
│
│  G703 Columns G-I (computed)
├── TotalCompletedAndStored : decimal(18,2) — Column G = D + E + F
├── PercentComplete : decimal(5,2) — Column H = G ÷ C
├── BalanceToFinish : decimal(18,2) — Column I = C - G
│
│  Retainage
├── RetainagePercent : decimal(5,2)? — line-level override (null = use app default)
├── RetainageAmount : decimal(18,2) — calculated retainage on this line
│
│  Cost Alignment (for WIP analysis)
├── CostCodeId : Guid? — mapped from SOV line
├── CostToDateAtBilling : decimal(18,2)? — snapshot of job cost at billing time
├── CostBasedPercentComplete : decimal(5,2)? — cost ÷ budget for comparison
│
│  Flags
├── IsOverbilled : bool — billing % > cost % by more than threshold
├── HasZeroProgress : bool — no billing this period when cost progress exists
│
├── CreatedAt / CreatedBy / UpdatedAt / UpdatedBy (BaseEntity)
```

### 5.2 G703 Line Calculation

```
CalculateG703Line(line):
  // Column G: Total completed and stored
  line.TotalCompletedAndStored =
      line.WorkCompletedPrevious +
      line.WorkCompletedThisPeriod +
      line.MaterialsStoredToDate

  // Column H: Percent complete (cap at 100%)
  line.PercentComplete = line.ScheduledValue != 0
      ? MIN(ROUND(line.TotalCompletedAndStored / line.ScheduledValue * 100, 2), 100)
      : 0

  // Column I: Balance to finish
  line.BalanceToFinish = line.ScheduledValue - line.TotalCompletedAndStored

  // Retainage
  rate = line.RetainagePercent ?? app.RetainagePercentWork
  line.RetainageAmount = ROUND(line.TotalCompletedAndStored * rate / 100, 2)

  // Validation: Cannot bill more than scheduled value
  ASSERT line.TotalCompletedAndStored <= line.ScheduledValue
      : "Line {line.ItemNumber} total ({TotalCompletedAndStored}) exceeds scheduled value ({ScheduledValue})"

  // Validation: This period cannot be negative (use credit line instead)
  ASSERT line.WorkCompletedThisPeriod >= 0
      : "Negative billing on line {line.ItemNumber} — use a backcharge or credit line"
```

### 5.3 G703 Grand Totals

The last row of the G703 is the grand totals row:

```
GrandTotals:
  Column C: SUM(all lines.ScheduledValue) — must equal G702 Line 3
  Column D: SUM(all lines.WorkCompletedPrevious)
  Column E: SUM(all lines.WorkCompletedThisPeriod)
  Column F: SUM(all lines.MaterialsStoredToDate)
  Column G: SUM(all lines.TotalCompletedAndStored) — must equal G702 Line 4
  Column H: Column G ÷ Column C (overall percent complete)
  Column I: SUM(all lines.BalanceToFinish) — must equal Column C - Column G
```

**Cross-validation between G702 and G703:**
- G703 Grand Total Column C == G702 Line 3 (Contract Sum to Date)
- G703 Grand Total Column G == G702 Line 4 (Total Completed and Stored)
- These must be exact. Any discrepancy blocks submission.

---

## 6. Billing Period Workflow

### 6.1 State Machine

```
                    ┌──────────────┐
                    │    Draft     │  PM updates line items
                    └──────┬───────┘
                           │ PM finalizes
                           ▼
                    ┌──────────────┐
                    │  PmReview    │  Senior PM / Project Executive reviews
                    └──────┬───────┘
                      ┌────┴─────┐
                   Reject     Approve
                      │          │
                      ▼          ▼
              ┌──────────┐  ┌────────────────┐
              │ PmReject  │  │  ReadyToSubmit  │  Billing package assembled
              └─────┬────┘  └──────┬─────────┘
                    │              │ AR Clerk submits to owner
                 Revise            ▼
                    │       ┌──────────────────┐
                    │       │  SubmittedToOwner │  Awaiting architect cert
                    ▼       └──────┬───────────┘
             (back to Draft)  ┌────┴─────┐
                           Dispute    Certify
                              │          │
                              ▼          ▼
                      ┌──────────┐  ┌──────────────────┐
                      │ Disputed │  │ ArchitectCertified│  Owner approves amount
                      └─────┬────┘  └──────┬───────────┘
                            │              │
                         Resolve           │ Payment tracking
                            │              ▼
                            ▼       ┌──────────────┐
                     (back to       │  PaymentDue   │  Awaiting check/ACH
                      Draft)        └──────┬───────┘
                                           │
                                           ▼
                                    ┌──────────┐
                                    │   Paid   │  Cash received and applied
                                    └──────────┘
```

**Status Enum:** `Draft`, `PmReview`, `PmRejected`, `ReadyToSubmit`, `SubmittedToOwner`, `Disputed`, `ArchitectCertified`, `PaymentDue`, `PartiallyPaid`, `Paid`, `Void`

### 6.2 Workflow Steps in Detail

#### Step 1: Draft Creation (PM)

1. PM selects project and billing period
2. System auto-creates `OwnerPaymentApplication` with:
   - Next sequential application number
   - Period dates
   - Contract values from SOV
   - Line items pre-populated from SOV with `WorkCompletedPrevious` carried forward
3. PM updates `WorkCompletedThisPeriod` and `MaterialsStoredCurrent` per line
4. System recalculates G702/G703 in real-time as PM edits
5. System flags overbilling warnings per line

#### Step 2: PM Review (Optional — configurable)

1. PM marks application as ready for review
2. Senior PM or Project Executive reviews:
   - Billing amounts vs. cost-to-date (WIP alignment)
   - Change order incorporation
   - Retention calculation accuracy
   - Overbilling warnings
3. Reviewer approves or rejects with comments

#### Step 3: Billing Package Assembly (AR Clerk)

1. System auto-assembles billing package:
   - G702 (generated)
   - G703 (generated)
   - Conditional Progress Lien Waiver (outbound — from RETENTION-LIEN-WAIVER-SPEC)
   - Sub lien waivers for prior period (collected by AP)
   - Change order log
   - Stored materials documentation
   - Supporting docs per owner requirements
2. AR Clerk reviews package completeness
3. Missing documents flagged with status and responsible party

#### Step 4: Submission to Owner (AR Clerk)

1. AR Clerk submits via owner's required method (email, portal, mail)
2. System records submission date, method, and reference
3. Creates `ArBilling` record in AR subledger
4. Creates `RetentionLedger.Hold` entries (AR side)
5. Sets expected payment date based on contract terms
6. Starts collection reminder countdown

#### Step 5: Architect Certification (External)

1. Architect reviews, may adjust amounts
2. AR Clerk records architect's certified amount (may differ from requested)
3. If disputed, application goes to `Disputed` status for resolution

#### Step 6: Payment (AR Clerk)

1. Payment received → `ArCashReceipt` created
2. Applied to this application → `ArCashApplication`
3. Retention portion stays in `RetentionLedger`
4. Application transitions to `Paid` when full amount collected

### 6.3 Billing Calendar

```
BillingCalendar
├── Id : Guid (PK)
├── TenantId : Guid (RLS)
├── CompanyId : Guid
├── ProjectId : Guid (FK → Projects)
├── CustomerProjectContractId : Guid (FK)
├── BillingCycleType : enum (Monthly, Biweekly, Custom)
├── BillingDeadlineDay : int — day of month (e.g., 25)
├── CutoffDay : int — cost cutoff day (e.g., last day of month)
├── SubmissionLeadDays : int — days before deadline to start prep (default: 5)
├── PaymentTermsDays : int — expected days to payment (default: 30)
├── Notes : string?
├── CreatedAt / CreatedBy / UpdatedAt / UpdatedBy (BaseEntity)
```

### 6.4 Domain Events

| Event | Published When | Subscribers |
|-------|---------------|-------------|
| `OwnerBillingDraftCreated` | Draft app created | Dashboard update |
| `OwnerBillingReadyForReview` | PM submits for review | Notification to reviewer |
| `OwnerBillingApproved` | PM review approved | AR Clerk notification, package assembly |
| `OwnerBillingSubmitted` | Submitted to owner | AR subledger posting, retention ledger, collection timer |
| `OwnerBillingCertified` | Architect certifies | Payment tracking initiated |
| `OwnerBillingDisputed` | Owner disputes | PM + Controller notification |
| `OwnerBillingPaid` | Full payment received | AR ledger, retention ledger, GL posting |
| `OwnerBillingPartiallyPaid` | Partial payment | AR ledger update, discrepancy flag |
| `BillingDeadlineApproaching` | N days before deadline | PM + AR Clerk reminder |
| `BillingDeadlineMissed` | Past deadline, no submission | PM + Controller escalation |

---

## 7. Change Order Integration

### 7.1 Owner Change Orders

The existing `ChangeOrder` entity is scoped to subcontracts. The owner billing system needs **Owner Change Orders** (OCOs) that modify the prime contract value.

```
OwnerChangeOrder
├── Id : Guid (PK)
├── TenantId : Guid (RLS)
├── CompanyId : Guid
├── ProjectId : Guid (FK → Projects)
├── CustomerProjectContractId : Guid (FK)
├── OwnerScheduleOfValuesId : Guid (FK)
│
│  Identity
├── ChangeOrderNumber : string — "OCO-001"
├── Title : string
├── Description : string
├── Reason : string? — Owner request, design change, field condition, etc.
│
│  Financial Impact
├── Amount : decimal(18,2) — positive (add) or negative (deduct)
├── DaysExtension : int? — schedule impact
│
│  Status
├── Status : enum (Proposed, PendingOwnerApproval, Approved, Rejected, Void)
├── ProposedDate : DateOnly?
├── SubmittedToOwnerDate : DateOnly?
├── ApprovedDate : DateOnly?
├── OwnerReferenceNumber : string? — owner's CO number
│
│  SOV Impact (how the CO amount is distributed across SOV lines)
├── SOVAllocations : ICollection<OwnerChangeOrderSOVAllocation>
│
│  Linked Sub Change Orders (a single OCO may trigger multiple sub COs)
├── LinkedSubChangeOrderIds : string? — JSON array of sub CO IDs
│
├── Notes : string?
├── CreatedAt / CreatedBy / UpdatedAt / UpdatedBy (BaseEntity)
```

### 7.2 SOV Allocation

When a change order is approved, its dollar amount must be allocated to SOV line items (new or existing).

```
OwnerChangeOrderSOVAllocation
├── Id : Guid (PK)
├── OwnerChangeOrderId : Guid (FK)
├── OwnerSOVLineItemId : Guid? — null if creating a new line
├── NewLineItemNumber : string? — if creating a new SOV line
├── NewLineDescription : string? — if creating a new SOV line
├── Amount : decimal(18,2) — amount allocated to this line
├── Notes : string?
```

### 7.3 CO → SOV Flow

```
Owner Change Order Approved
        │
        ▼
  ┌─────────────────────────────────────────────┐
  │ For each SOVAllocation:                      │
  │                                              │
  │ IF allocation targets existing SOV line:     │
  │   line.ApprovedChangeOrderValue += Amount    │
  │   line.ScheduledValue = Original + CO Value  │
  │                                              │
  │ IF allocation creates new SOV line:          │
  │   Create new OwnerSOVLineItem                │
  │   Set OriginalValue = 0                      │
  │   Set ApprovedChangeOrderValue = Amount      │
  │   Set ScheduledValue = Amount                │
  │   Set IsFromChangeOrder = true               │
  │   Set SourceChangeOrderId = CO.Id            │
  └─────────────────────────────────────────────┘
        │
        ▼
  ┌─────────────────────────────────────────────┐
  │ Update SOV totals:                           │
  │   SOV.ApprovedChangeOrderAmount += CO.Amount │
  │   SOV.RevisedContractAmount = Original + COs │
  │   SOV.TotalScheduledValue recalculated       │
  └─────────────────────────────────────────────┘
        │
        ▼
  ┌─────────────────────────────────────────────┐
  │ Update CustomerProjectContract:              │
  │   Contract.ApprovedChangeOrderAmount         │
  │   Contract.RevisedContractAmount             │
  └─────────────────────────────────────────────┘
```

### 7.4 Pending CO Tracking

Pending COs (not yet approved) are tracked separately and shown on billing reports as informational:

| Field | Location |
|-------|----------|
| Pending CO count | G702 supplemental section |
| Pending CO total amount | Billing narrative |
| Pending COs cannot be billed | Hard rule — only approved COs affect SOV |

---

## 8. Retainage Calculation

### 8.1 Retainage Model for Owner Billing

Owner billing retainage is more nuanced than simple percentage-of-total. The AIA G702 separates retainage into two categories:

| G702 Line | Description | Rate Source |
|-----------|-------------|-------------|
| 5a | Retainage on Completed Work | `RetainagePercentWork` |
| 5b | Retainage on Stored Materials | `RetainagePercentMaterials` |

**Common configurations:**
- Same rate for both (e.g., 10% work, 10% materials)
- Lower rate for stored materials (e.g., 10% work, 0% materials — incentivize procurement)
- Zero retainage on stored materials (owner already has security via possession)

### 8.2 Per-Line-Item Retainage

Some contracts specify different retention rates for different SOV lines:

| Example | Rate | Reason |
|---------|------|--------|
| General Conditions | 5% | Low risk, ongoing overhead |
| Sitework | 10% | Standard trade work |
| Elevator | 0% | Manufacturer-supplied, pre-negotiated |
| Testing & Inspections | 0% | Third-party service, no warranty concern |

The `OwnerSOVLineItem.RetainagePercent` field overrides the application-level rate when set.

### 8.3 Retention Step-Down

Leverages `RetentionSchedule` from RETENTION-LIEN-WAIVER-SPEC:

```
RetentionSchedule (for owner contract):
  Sort 1: PercentComplete = 0% → RetainagePercent = 10%
  Sort 2: PercentComplete = 50% → RetainagePercent = 5%
  Sort 3: PercentComplete = 95% → RetainagePercent = 0%
```

The billing engine evaluates the schedule at the application level (overall percent complete) and per-line where configured.

### 8.4 Retainage Calculation Algorithm

```
CalculateRetainage(app, lines):
  schedule = GetRetentionSchedule(app.CustomerProjectContractId)

  FOR EACH line IN lines:
    // Determine applicable rate for this line
    IF line.RetainagePercent IS NOT NULL:
      rate = line.RetainagePercent  // Line-level override
    ELSE IF schedule EXISTS:
      rate = EvaluateSchedule(schedule, line.PercentComplete)
    ELSE:
      rate = app.RetainagePercentWork  // Application-level default

    // Calculate line retainage
    completedRetainage = (line.WorkCompletedPrevious + line.WorkCompletedThisPeriod) * rate / 100
    storedRetainage = line.MaterialsStoredToDate * (app.RetainagePercentMaterials / 100)
    line.RetainageAmount = ROUND(completedRetainage + storedRetainage, 2)

  // Aggregate to G702 Line 5
  app.RetainageOnCompletedWork = SUM(lines' completed retainage)
  app.RetainageOnStoredMaterials = SUM(lines' stored retainage)
  app.TotalRetainage = app.RetainageOnCompletedWork + app.RetainageOnStoredMaterials
```

### 8.5 GL Posting on Billing Submission

When an owner payment application is submitted:

```
DR  Accounts Receivable (1100)              $CurrentPaymentDue
DR  Retention Receivable (1150)             $RetainageThisPeriod
    CR  Billings on Contracts (3100)                    $TotalBilledThisPeriod
```

Where `RetainageThisPeriod = TotalRetainage - PriorApp.TotalRetainage` and `TotalBilledThisPeriod = CurrentPaymentDue + RetainageThisPeriod`.

---

## 9. Stored Materials Tracking

### 9.1 Why Stored Materials Matter

Construction contracts allow billing for materials that have been purchased and stored but not yet installed. This is critical for:

- **Cash flow:** Large material purchases (steel, elevator, HVAC units) shouldn't sit unbilled
- **Risk management:** Owner takes financial interest in stored materials
- **AIA compliance:** G703 Column F explicitly tracks stored materials

### 9.2 StoredMaterial Entity

```
StoredMaterial
├── Id : Guid (PK)
├── TenantId : Guid (RLS)
├── CompanyId : Guid
├── ProjectId : Guid (FK → Projects)
├── OwnerSOVLineItemId : Guid (FK → OwnerSOVLineItem)
│
│  Description
├── Description : string — "Structural steel for 3rd floor"
├── MaterialType : string? — "Steel", "HVAC", "Electrical", etc.
├── Quantity : decimal?
├── UnitOfMeasure : string?
├── UnitCost : decimal(18,2)?
├── TotalValue : decimal(18,2) — billable value
│
│  Location
├── StorageLocation : enum (OnSite, OffSiteWarehouse, OffSiteVendor)
├── StorageAddress : string? — for off-site locations
├── BondedWarehouse : bool — some contracts require bonded storage
│
│  Documentation
├── InvoiceReference : string? — vendor invoice proving purchase
├── DeliveryTicketReference : string?
├── PhotoDocumentIds : string? — JSON array of document vault IDs
├── InsuredAmount : decimal(18,2)? — insurance coverage for off-site materials
│
│  Tracking
├── ReceivedDate : DateOnly — when material arrived at storage
├── FirstBilledDate : DateOnly? — when first included in a billing
├── InstalledDate : DateOnly? — when moved to "work completed"
├── Status : enum (Stored, PartiallyInstalled, FullyInstalled, Damaged, Returned)
├── CurrentStoredValue : decimal(18,2) — remaining unbilled stored value
│
├── Notes : string?
├── CreatedAt / CreatedBy / UpdatedAt / UpdatedBy (BaseEntity)
```

### 9.3 Stored Materials → Billing Flow

```
Material Arrives on Site
        │
        ▼
  PM Creates StoredMaterial Record
  ├── Attaches invoice, delivery ticket, photos
  ├── Assigns to SOV line item
  └── Sets TotalValue (billable amount)
        │
        ▼
  Monthly Billing: PM includes in pay app
  ├── SOV line's MaterialsStoredCurrent += material value
  ├── G703 Column F reflects stored materials
  └── Material.FirstBilledDate set
        │
        ▼
  Material Installed (future billing period)
  ├── PM marks Material as Installed
  ├── SOV line: MaterialsStoredCurrent decreases
  ├── SOV line: WorkCompletedThisPeriod increases
  ├── Net change = 0 (material moves from "stored" to "completed")
  └── Material.InstalledDate set, Status → FullyInstalled
```

### 9.4 Owner Documentation Requirements

Many owners require specific documentation before accepting stored materials billing:

| Requirement | Description |
|-------------|-------------|
| Proof of purchase | Vendor invoice showing material was paid for |
| Delivery ticket | Signed proof of delivery to storage location |
| Photos | Photographs of material in storage |
| Insurance certificate | Builder's risk or inland marine coverage |
| Bonded warehouse | For off-site storage, some owners require bonded warehouses |
| Inventory list | Itemized list of all stored materials with values |
| Transfer of title | Some owners require title transfer to owner on billing |

The `CustomerProjectContract.SubmissionRequirementsJson` field captures per-owner requirements, and the billing package assembly checks these before marking the package complete.

---

## 10. PDF Generation

### 10.1 Document Templates

The system generates two primary PDF documents:

| Document | Template | Customizable |
|----------|----------|-------------|
| G702 — Application and Certificate | AIA standard layout | Header logos, company info only |
| G703 — Continuation Sheet | AIA standard layout | Column widths auto-adjust |
| Cover Letter | Company template | Fully customizable |
| Change Order Log | Standard tabular | Column selection |
| Stored Materials Inventory | Standard tabular | Auto-generated |

### 10.2 G702 PDF Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  [Company Logo]        APPLICATION AND CERTIFICATE FOR PAYMENT       │
│                                                        AIA Document  │
│                                                        G702 — 2017   │
│──────────────────────────────────────────────────────────────────────│
│  TO OWNER:              │ APPLICATION NO:  {ApplicationNumber}       │
│  {OwnerName}            │ PERIOD TO:       {PeriodThrough}           │
│  {OwnerAddress}         │ APPLICATION DATE:{ApplicationDate}         │
│─────────────────────────│                                            │
│  FROM CONTRACTOR:       │ PROJECT NO:      {ProjectNumber}           │
│  {CompanyName}          │ CONTRACT FOR:    {ProjectName}             │
│  {CompanyAddress}       │ CONTRACT DATE:   {ContractDate}            │
│──────────────────────────────────────────────────────────────────────│
│                                                                      │
│  CONTRACTOR'S APPLICATION FOR PAYMENT                                │
│                                                                      │
│  Application is made for payment, as shown below, in connection      │
│  with the Contract. Continuation Sheet, AIA Document G703, is        │
│  attached.                                                           │
│                                                                      │
│  1. ORIGINAL CONTRACT SUM ...................... ${OriginalContract}  │
│  2. Net change by Change Orders ............... ${NetChanges}        │
│  3. CONTRACT SUM TO DATE (Line 1 ± 2) ......... ${ContractToDate}   │
│  4. TOTAL COMPLETED & STORED TO DATE            ${TotalCompleted}   │
│     (Column G on G703)                                               │
│  5. RETAINAGE:                                                       │
│     a. __% of Completed Work  ${CompletedRetainage}                  │
│     b. __% of Stored Material ${StoredRetainage}                     │
│     Total Retainage (Lines 5a + 5b) ........... ${TotalRetainage}   │
│  6. TOTAL EARNED LESS RETAINAGE                                      │
│     (Line 4 Less Line 5 Total) ................ ${EarnedLessRet}    │
│  7. LESS PREVIOUS CERTIFICATES FOR PAYMENT ..... ${PrevCerts}       │
│     (Line 6 from prior Certificate)                                  │
│  8. CURRENT PAYMENT DUE ....................... ${CurrentDue}        │
│  9. BALANCE TO FINISH, INCLUDING RETAINAGE ..... ${BalToFinish}     │
│     (Line 3 less Line 6)                                             │
│                                                                      │
│──────────────────────────────────────────────────────────────────────│
│  CHANGE ORDER SUMMARY          ADDITIONS     DEDUCTIONS              │
│  Total changes approved                                              │
│  in previous months by Owner   ${PriorAdd}   ${PriorDeduct}         │
│  Total approved this Month     ${ThisAdd}    ${ThisDeduct}           │
│  TOTALS                        ${TotalAdd}   ${TotalDeduct}         │
│  NET CHANGES by Change Order   ${NetChanges}                         │
│──────────────────────────────────────────────────────────────────────│
│                                                                      │
│  CONTRACTOR'S CERTIFICATION                                          │
│  The undersigned Contractor certifies that to the best of the        │
│  Contractor's knowledge, information and belief the Work covered     │
│  by this Application for Payment has been completed in accordance    │
│  with the Contract Documents...                                      │
│                                                                      │
│  CONTRACTOR: {CompanyName}                                           │
│  By: _________________ Date: {CertifiedDate}                        │
│  State of: ________    County of: ________                           │
│  Subscribed and sworn to before me this ___ day of _____ 20__       │
│  Notary Public: _____________ My Commission expires: ________        │
│                                                                      │
│──────────────────────────────────────────────────────────────────────│
│                                                                      │
│  ARCHITECT'S CERTIFICATE FOR PAYMENT                                 │
│  In accordance with the Contract Documents, based on on-site         │
│  observations and the data comprising this application, the          │
│  Architect certifies to the Owner that to the best of the            │
│  Architect's knowledge, information and belief the Work has           │
│  progressed as indicated...                                          │
│                                                                      │
│  AMOUNT CERTIFIED ............................ ${CertifiedAmount}    │
│  ARCHITECT: {ArchitectName}                                          │
│  By: _________________ Date: {ArchitectDate}                        │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 10.3 G703 PDF Layout

```
┌───┬──────────────┬───────────┬───────────┬──────────┬──────────┬───────────┬──────┬───────────┬──────────┐
│   │              │           │    WORK COMPLETED     │MATERIALS │  TOTAL    │      │ BALANCE   │          │
│ A │      B       │     C     ├───────────┬──────────┤PRESENTLY │COMPLETED  │  H   │   TO      │    I     │
│   │              │SCHEDULED  │     D     │    E     │  STORED  │AND STORED │  %   │ FINISH    │RETAINAGE │
│ # │ DESCRIPTION  │  VALUE    │FROM PREV  │  THIS    │  TO DATE │ TO DATE   │(G÷C) │ (C - G)   │          │
│   │              │           │  APPS     │ PERIOD   │    F     │  G=D+E+F  │      │           │          │
├───┼──────────────┼───────────┼───────────┼──────────┼──────────┼───────────┼──────┼───────────┼──────────┤
│001│ Gen Cond     │   350,000 │   280,000 │   35,000 │        0 │   315,000 │  90% │    35,000 │   31,500 │
│002│ Site Work    │   280,000 │   280,000 │        0 │        0 │   280,000 │ 100% │         0 │   28,000 │
│003│ Concrete     │   420,000 │   378,000 │   42,000 │        0 │   420,000 │ 100% │         0 │   42,000 │
│...│ ...          │       ... │       ... │      ... │      ... │       ... │  ... │       ... │      ... │
├───┴──────────────┼───────────┼───────────┼──────────┼──────────┼───────────┼──────┼───────────┼──────────┤
│   GRAND TOTALS   │ 5,000,000 │ 3,200,000 │  285,000 │   45,000 │ 3,530,000 │ 70.6%│ 1,470,000 │  353,000 │
└──────────────────┴───────────┴───────────┴──────────┴──────────┴───────────┴──────┴───────────┴──────────┘

                                                     AIA Document G703 — Continuation Sheet
                                                     APPLICATION NO: {ApplicationNumber}
                                                     APPLICATION DATE: {ApplicationDate}
                                                     PAGE {PageNum} OF {TotalPages}
                                                     PERIOD TO: {PeriodThrough}
                                                     ARCHITECT'S PROJECT NO: {ArchProjectNo}
```

### 10.4 PDF Generation Technology

| Approach | Description | Recommendation |
|----------|-------------|----------------|
| HTML → PDF | Render HTML template, convert via headless browser (Playwright/Puppeteer) or wkhtmltopdf | **Recommended** — most flexible for layout |
| Razor → PDF | ASP.NET Razor views rendered to PDF via a library like QuestPDF or IronPDF | Good .NET-native option |
| Template engine | Use a purpose-built PDF library (QuestPDF) with programmatic layout | Best for pixel-perfect AIA compliance |

**Recommended approach:** QuestPDF for the document generation engine. It's a .NET-native library that produces high-quality PDFs with precise layout control, which is critical for matching the AIA form format.

### 10.5 BillingPackage Entity

Tracks the complete set of documents assembled for owner submission.

```
BillingPackage
├── Id : Guid (PK)
├── TenantId : Guid (RLS)
├── CompanyId : Guid
├── OwnerPaymentApplicationId : Guid (FK)
│
│  Documents
├── G702DocumentUrl : string? — generated PDF path
├── G703DocumentUrl : string? — generated PDF path
├── CoverLetterDocumentUrl : string?
├── ChangeOrderLogDocumentUrl : string?
├── StoredMaterialsInventoryUrl : string?
├── CombinedPackageUrl : string? — all documents merged into single PDF
│
│  Lien Waivers (links to LienWaiver entities)
├── CompanyConditionalWaiverId : Guid? — our waiver to owner
├── SubWaiverIds : string? — JSON array of sub waiver IDs included
├── SubWaiversComplete : bool — all required sub waivers collected
│
│  Compliance
├── AllRequiredDocumentsPresent : bool
├── MissingDocuments : string? — JSON array of missing doc types
├── OwnerSpecificRequirements : string? — JSON from CustomerProjectContract
│
│  Generation
├── GeneratedAt : DateTimeOffset
├── GeneratedById : Guid
├── RegeneratedCount : int — how many times re-generated
│
├── CreatedAt / CreatedBy / UpdatedAt / UpdatedBy (BaseEntity)
```

---

## 11. AI Agent Opportunities

### 11.1 Progress Suggestion Agent

**Trigger:** PM opens draft billing for a project
**Input:** Job cost data, sub pay apps received, prior billing progress
**Action:**

1. For each SOV line item:
   - Pull cost-to-date from linked cost codes
   - Pull sub billings received (from AP-side pay apps)
   - Calculate cost-based percent complete: `(CostToDate / RevisedBudget) × 100`
   - Compare to prior billing percent
   - Suggest this period's billing amount
2. Present suggestions with confidence levels:
   - **High confidence** (cost data aligns with physical progress)
   - **Medium confidence** (some data available, PM should verify)
   - **Low confidence** (insufficient data, manual input needed)
3. Flag lines where cost progress and billing progress diverge significantly

**Value:** Reduces PM billing preparation from 2-4 hours to 30 minutes per project. PM reviews and adjusts rather than calculating from scratch.

### 11.2 Overbilling Detection Agent

**Trigger:** Real-time during draft editing, and on PM review
**Action:**

1. For each line item, compare:
   - `PercentComplete` (billing-based) vs. cost-based percent
   - This period's billing vs. remaining budget
   - Overall project billing pace vs. schedule pace
2. Apply configurable thresholds:
   - **Warning** (yellow): Billing > Cost by 10-20% points
   - **Alert** (orange): Billing > Cost by 20-30% points
   - **Block** (red): Billing > Cost by 30%+ points (configurable)
3. Generate overbilling report with WIP impact analysis:
   - "Line 003 Concrete is 100% billed but only 85% cost-to-date"
   - "This creates $63,000 in Billings in Excess (WIP liability)"
   - "Overall project overbilled by $150,000 — Controller review recommended"

**Value:** Prevents WIP schedule surprises. Overbilling is the #1 cause of WIP adjustments that shock the financial statements.

### 11.3 Billing Narrative Generator

**Trigger:** PM requests narrative generation for billing package
**Action:**

1. Analyze this period's billing:
   - Major work items with significant progress
   - Change orders incorporated
   - Stored materials added
   - Milestones achieved
2. Generate professional cover letter text:
   ```
   "During the period ending January 31, 2026, significant progress
   was made on the following items: Structural steel erection reached
   90% completion, interior framing commenced on floors 2-4, and
   HVAC equipment was delivered and stored on-site ($85,000). Change
   Order #3 ($45,000 for additional fire-stopping) has been incorporated
   into this application. Current payment requested: $285,000."
   ```
3. PM edits and finalizes

**Value:** Professional billing narratives improve owner payment speed and reduce payment disputes. Most PMs skip narratives because they're tedious to write.

### 11.4 Auto-Populate from Cost Data Agent

**Trigger:** Billing deadline approaching, draft not yet started
**Action:**

1. Create draft `OwnerPaymentApplication` with:
   - Carry-forward data from prior app
   - Auto-calculated progress based on cost-to-date vs. budget
   - Sub billings received this period allocated to SOV lines
   - Stored materials from `StoredMaterial` records
2. Flag items needing PM attention:
   - Lines with no cost activity (should they be billed?)
   - Lines approaching 100% (verify physically complete)
   - New change orders not yet incorporated
3. Send notification to PM: "Draft billing #7 for Project 2026-015 has been pre-populated. 12 of 15 lines auto-calculated. 3 lines need your input."

**Value:** PM never starts from a blank screen. Billing preparation becomes review and adjustment instead of data entry.

### 11.5 Billing Package Completeness Agent

**Trigger:** Application moves to `ReadyToSubmit` status
**Action:**

1. Check owner's documented requirements (`CustomerProjectContract.SubmissionRequirementsJson`)
2. Verify each required document exists and is current:
   - G702 generated? G703 generated?
   - Company conditional waiver generated?
   - All required sub waivers collected? (coordinate with AP)
   - Change order log current?
   - Stored materials documentation attached?
   - Notarization required and done?
3. Generate completeness report:
   - Green: Ready to submit
   - Yellow: Missing non-critical items (can submit with note)
   - Red: Missing critical items (blocked)
4. Auto-request missing items from responsible parties

**Value:** Eliminates rejected billings due to missing documents. A rejected billing = 30+ days of delayed cash.

---

## 12. Predictive Features

### 12.1 Billing Deadline Management

**Rule-based alerts with escalation:**

```
Calendar Alert Timeline (example: billing due on 25th):
─────────────────────────────────────────────────────
Day 10: [Info] Billing period opens for PM input
Day 15: [Info] PM should have SOV progress updated
Day 18: [Warning] 7 days until deadline — draft not started
Day 20: [Warning] PM must complete by Day 22 for AR to assemble
Day 22: [Urgent] AR Clerk assembles billing package
Day 24: [Critical] Tomorrow is deadline — package incomplete
Day 25: [Alarm] DEADLINE — submit today or skip this cycle
Day 26: [Escalate] Billing missed — Controller notified
```

**Dashboard Widget:** "Billing Calendar" showing all projects, their deadline status, and preparation progress.

### 12.2 Auto-Populate from Cost-to-Date

When a billing draft is opened, automatically:

1. Query job cost system for cost-to-date per cost code
2. Calculate cost-based percent complete: `CostToDate / RevisedBudget`
3. For each SOV line with a mapped cost code:
   - Suggest `WorkCompletedThisPeriod = (CostPercent × ScheduledValue) - PriorBillings`
   - Flag if cost-based suggestion differs significantly from prior billing pace
4. Handle lines without cost code mapping:
   - General Conditions: suggest based on elapsed time ÷ project duration
   - Sub-only lines: suggest based on received sub pay apps

### 12.3 No-Progress Line Detection

**Trigger:** Draft billing has lines with zero progress that should have activity

**Logic:**
1. For each SOV line where `WorkCompletedThisPeriod == 0`:
   - Check if cost was incurred against mapped cost code this period
   - Check if sub pay app was received for this scope
   - Check project schedule — is this work currently active?
2. If cost or schedule suggests progress, flag the line:
   - "$12,000 in labor posted to cost code 08.100 (MEP Mechanical) this period, but SOV Line 08 shows zero progress. Should this be billed?"

**Value:** Prevents underbilling from oversight. Underbilling reduces cash flow and is equally problematic as overbilling for WIP accuracy.

### 12.4 Payment Prediction

**Based on owner payment history:**

```
Model: owner_payment_prediction
Features:
  - owner_id
  - historical_avg_days_to_pay
  - historical_payment_consistency (stddev)
  - billing_amount (larger billings may pay slower)
  - project_percent_complete
  - retention_included (retention billings pay slower)
  - month_of_year (fiscal year-end effects)
Output:
  - predicted_payment_date
  - confidence_interval
  - predicted_amount (may differ from billed if owner typically deducts)
```

**Dashboard Widget:** "Expected Cash Inflows" showing predicted collection dates for all outstanding billings.

### 12.5 Billing Pace Analysis

**Per project, compare billing pace vs. schedule pace vs. cost pace:**

```
Project 2026-015: Medical Office Building
──────────────────────────────────────────
Metric              Value    Status
Schedule Complete:   70%     On track
Cost Complete:       65%     Slightly under
Billing Complete:    75%     OVERBILLED
──────────────────────────────────────────
Over/Under Billing:  +$125,000
WIP Impact:          Billings in Excess (liability)
Recommendation:      Slow billing pace next 2 months
```

### 12.6 Change Order Revenue Forecasting

Track pending change orders and predict their approval likelihood and timing:

| Metric | Description |
|--------|-------------|
| Pending CO total | Dollar amount of submitted-but-not-approved COs |
| Historical approval rate | % of COs approved (by owner, by type) |
| Average approval time | Days from submission to approval |
| Revenue impact forecast | Expected contract growth from pending COs |

---

## 13. Domain Entities — Complete Reference

### 13.1 Entity Relationship Diagram

```
┌──────────────────────┐         ┌────────────────────────┐
│  CustomerOwner       │────────→│ CustomerProjectContract │
│  (AP-AR-FOUNDATION)  │         │  OriginalContractAmount │
└──────────────────────┘         │  BillingDeadlineDay     │
                                 └───────────┬────────────┘
                                             │
                    ┌────────────────────────┤
                    │                        │
                    ▼                        ▼
          ┌──────────────────┐    ┌─────────────────────┐
          │ OwnerChangeOrder │    │OwnerScheduleOfValues │
          │  Amount          │    │ OriginalContract     │
          │  Status          │    │ ApprovedCOs          │
          │  SOVAllocations  │    │ RevisedContract      │
          └────────┬─────────┘    │ Status               │
                   │              └──────────┬────────────┘
                   │                         │
                   │    ┌────────────────────┤
                   │    │                    │
                   ▼    ▼                    ▼
          ┌─────────────────┐     ┌──────────────────────┐
          │ OCO SOV         │     │  OwnerSOVLineItem    │
          │ Allocation      │────→│  ScheduledValue      │
          └─────────────────┘     │  WorkCompleted*      │
                                  │  MaterialsStored*    │
                                  │  RetainagePercent?   │
                                  │  CostCodeId?         │
                                  └──────────┬───────────┘
                                             │
                                             ▼
                                  ┌──────────────────────────┐
                                  │OwnerPaymentApplication   │
                                  │  ApplicationNumber       │
                                  │  G702 Lines 1-9          │
                                  │  Status (workflow)       │
                                  │  ContractorCertification │
                                  │  ArchitectCertification  │
                                  └──────────┬───────────────┘
                                             │
                              ┌──────────────┼──────────────┐
                              │              │              │
                              ▼              ▼              ▼
                   ┌────────────────┐ ┌────────────┐ ┌──────────────┐
                   │OwnerPayApp     │ │BillingPkg  │ │StoredMaterial│
                   │  LineItem      │ │ G702 PDF   │ │ Description  │
                   │  G703 cols A-I │ │ G703 PDF   │ │ Value        │
                   │  Retainage     │ │ Waivers    │ │ Location     │
                   │  OverbillFlag  │ │ COLog      │ │ Status       │
                   └────────────────┘ └────────────┘ └──────────────┘
```

### 13.2 New Enums

```csharp
// Owner SOV
public enum OwnerSOVStatus { Draft, Active, Locked, Closed }

// Owner Payment Application (G702)
public enum OwnerPaymentApplicationStatus
{
    Draft,
    PmReview,
    PmRejected,
    ReadyToSubmit,
    SubmittedToOwner,
    Disputed,
    ArchitectCertified,
    PaymentDue,
    PartiallyPaid,
    Paid,
    Void
}

// Owner Change Order
public enum OwnerChangeOrderStatus { Proposed, PendingOwnerApproval, Approved, Rejected, Void }

// Submission Method
public enum BillingSubmissionMethod { Email, Portal, Mail, InPerson }

// Billing Cycle
public enum BillingCycleType { Monthly, Biweekly, Custom }

// Storage Location
public enum StorageLocationType { OnSite, OffSiteWarehouse, OffSiteVendor }

// Stored Material Status
public enum StoredMaterialStatus { Stored, PartiallyInstalled, FullyInstalled, Damaged, Returned }
```

### 13.3 Database Tables

| Table | Key Columns | Indexes |
|-------|------------|---------|
| `owner_schedules_of_values` | id, tenant_id, company_id, project_id | (tenant_id, project_id), (tenant_id, customer_project_contract_id) |
| `owner_sov_line_items` | id, tenant_id, company_id, owner_sov_id | (tenant_id, owner_sov_id, sort_order) |
| `owner_sov_templates` | id, tenant_id, company_id | (tenant_id, company_id, name) |
| `owner_sov_template_lines` | id, template_id | (template_id, sort_order) |
| `owner_payment_applications` | id, tenant_id, company_id, project_id | (tenant_id, project_id, application_number) UNIQUE, (tenant_id, status) |
| `owner_payment_application_line_items` | id, tenant_id, company_id, app_id | (tenant_id, app_id, sort_order) |
| `owner_change_orders` | id, tenant_id, company_id, project_id | (tenant_id, project_id, change_order_number) UNIQUE, (tenant_id, status) |
| `owner_change_order_sov_allocations` | id, co_id | (co_id) |
| `billing_calendars` | id, tenant_id, company_id, project_id | (tenant_id, project_id) UNIQUE |
| `billing_packages` | id, tenant_id, company_id, app_id | (tenant_id, app_id) UNIQUE |
| `stored_materials` | id, tenant_id, company_id, project_id | (tenant_id, project_id, status), (tenant_id, owner_sov_line_item_id) |

All tables follow snake_case convention, include `tenant_id` for RLS, and extend `BaseEntity`.

---

## 14. API Surface

### 14.1 Owner Schedule of Values APIs

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/projects/{projectId}/owner-sov` | Get owner SOV for a project |
| POST | `/api/projects/{projectId}/owner-sov` | Create owner SOV |
| PUT | `/api/owner-sov/{id}` | Update SOV metadata |
| POST | `/api/owner-sov/{id}/activate` | Activate SOV (lock line structure) |
| POST | `/api/owner-sov/{id}/lock` | Lock SOV (during billing) |
| POST | `/api/owner-sov/{id}/unlock` | Unlock SOV (after billing) |
| GET | `/api/owner-sov/{id}/line-items` | Get all SOV line items |
| POST | `/api/owner-sov/{id}/line-items` | Add a line item |
| PUT | `/api/owner-sov/line-items/{lineId}` | Update a line item |
| DELETE | `/api/owner-sov/line-items/{lineId}` | Remove a line item (draft only) |
| POST | `/api/owner-sov/{id}/line-items/bulk` | Bulk add/import line items |
| POST | `/api/owner-sov/{id}/validate-balance` | Check if SOV lines sum to contract |
| GET | `/api/owner-sov-templates` | List available SOV templates |
| POST | `/api/owner-sov/{id}/apply-template` | Apply template to SOV |

### 14.2 Owner Payment Application (G702/G703) APIs

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/projects/{projectId}/owner-billings` | List all billings for a project |
| GET | `/api/owner-billings/{id}` | Get billing detail (G702 + G703 data) |
| POST | `/api/projects/{projectId}/owner-billings` | Create new draft billing |
| PUT | `/api/owner-billings/{id}` | Update draft billing (line items, notes) |
| PUT | `/api/owner-billings/{id}/line-items/{lineId}` | Update a single G703 line |
| PUT | `/api/owner-billings/{id}/line-items/bulk` | Bulk update G703 lines |
| POST | `/api/owner-billings/{id}/recalculate` | Recalculate G702 from G703 lines |
| POST | `/api/owner-billings/{id}/submit-for-review` | Submit to PM reviewer |
| POST | `/api/owner-billings/{id}/approve-review` | PM approves billing |
| POST | `/api/owner-billings/{id}/reject-review` | PM rejects billing (with comments) |
| POST | `/api/owner-billings/{id}/submit-to-owner` | Submit to owner (creates AR entry) |
| POST | `/api/owner-billings/{id}/record-certification` | Record architect certification |
| POST | `/api/owner-billings/{id}/record-dispute` | Record owner dispute |
| POST | `/api/owner-billings/{id}/record-payment` | Record payment received |
| POST | `/api/owner-billings/{id}/void` | Void a billing |
| GET | `/api/owner-billings/{id}/history` | Audit trail for a billing |

### 14.3 PDF Generation APIs

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/owner-billings/{id}/pdf/g702` | Generate/download G702 PDF |
| GET | `/api/owner-billings/{id}/pdf/g703` | Generate/download G703 PDF |
| GET | `/api/owner-billings/{id}/pdf/cover-letter` | Generate/download cover letter |
| GET | `/api/owner-billings/{id}/pdf/co-log` | Generate change order log PDF |
| GET | `/api/owner-billings/{id}/pdf/stored-materials` | Generate stored materials inventory |
| GET | `/api/owner-billings/{id}/pdf/package` | Generate complete billing package (merged PDF) |

### 14.4 Owner Change Order APIs

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/projects/{projectId}/owner-change-orders` | List owner COs for a project |
| GET | `/api/owner-change-orders/{id}` | Get CO detail |
| POST | `/api/projects/{projectId}/owner-change-orders` | Create an owner CO |
| PUT | `/api/owner-change-orders/{id}` | Update CO details |
| POST | `/api/owner-change-orders/{id}/submit` | Submit to owner for approval |
| POST | `/api/owner-change-orders/{id}/approve` | Record owner approval |
| POST | `/api/owner-change-orders/{id}/reject` | Record owner rejection |
| GET | `/api/owner-change-orders/{id}/sov-allocations` | Get SOV allocations for CO |
| PUT | `/api/owner-change-orders/{id}/sov-allocations` | Set SOV allocations for CO |
| GET | `/api/projects/{projectId}/owner-change-orders/summary` | CO summary for billing package |

### 14.5 Stored Materials APIs

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/projects/{projectId}/stored-materials` | List stored materials for a project |
| GET | `/api/stored-materials/{id}` | Get stored material detail |
| POST | `/api/projects/{projectId}/stored-materials` | Create stored material record |
| PUT | `/api/stored-materials/{id}` | Update stored material |
| POST | `/api/stored-materials/{id}/install` | Mark material as installed |
| GET | `/api/projects/{projectId}/stored-materials/inventory` | Current inventory for billing |

### 14.6 Billing Calendar APIs

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/billing-calendar` | Get billing calendar for all projects |
| GET | `/api/projects/{projectId}/billing-calendar` | Get billing calendar for a project |
| PUT | `/api/projects/{projectId}/billing-calendar` | Update billing calendar settings |
| GET | `/api/billing-calendar/upcoming-deadlines` | Deadlines within N days |
| GET | `/api/billing-calendar/missed-deadlines` | Past-due billings |

### 14.7 Reporting APIs

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/reports/billing-status` | Billing status across all projects |
| GET | `/api/reports/over-under-billing` | Over/under billing by project |
| GET | `/api/reports/billing-vs-cost` | Billing progress vs. cost progress comparison |
| GET | `/api/reports/pending-change-orders` | Pending owner COs with revenue impact |
| GET | `/api/reports/stored-materials-summary` | Stored materials across all projects |
| GET | `/api/reports/billing-forecast` | Projected billings for next N months |
| GET | `/api/reports/ar-by-project` | AR summary per project (billed, collected, outstanding, retention) |

### 14.8 AI Suggestion APIs

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/owner-billings/{id}/ai/progress-suggestions` | AI-suggested progress per line |
| GET | `/api/owner-billings/{id}/ai/overbilling-analysis` | Overbilling risk analysis |
| POST | `/api/owner-billings/{id}/ai/generate-narrative` | Generate billing narrative |
| GET | `/api/owner-billings/{id}/ai/completeness-check` | Billing package completeness |

---

## 15. Implementation Phases

### Phase 1: Owner SOV + Basic Billing (Sprint 1-3)

**Scope:**
- `OwnerScheduleOfValues` and `OwnerSOVLineItem` entities, migrations, EF configuration
- SOV CRUD APIs (create, add lines, validate balance, activate)
- SOV templates and bulk import
- `OwnerPaymentApplication` entity with basic workflow (Draft → Submitted → Paid)
- `OwnerPaymentApplicationLineItem` entity (G703 lines)
- G702 calculation engine
- G703 line calculations
- Carry-forward validation between applications
- Basic billing APIs

**Dependencies:** `CustomerProjectContract` from AP-AR-FOUNDATION-SPEC

**Acceptance:** PM can set up an owner SOV, create a monthly billing with line-by-line progress, and submit it. G702 calculations are correct and sequential billing is enforced.

### Phase 2: Full Workflow + Owner Change Orders (Sprint 4-5)

**Scope:**
- Full billing workflow state machine (Draft → PmReview → ReadyToSubmit → SubmittedToOwner → ArchitectCertified → PaymentDue → Paid)
- PM review and rejection flow
- Architect certification recording
- Dispute handling
- `OwnerChangeOrder` entity with SOV allocation
- CO → SOV integration (auto-update line values on approval)
- Pending CO tracking and reporting
- Domain events for billing lifecycle
- `BillingCalendar` entity with deadline management

**Dependencies:** Phase 1

**Acceptance:** Full billing lifecycle from draft through payment. Change orders update SOV automatically. Billing calendar tracks deadlines with notifications.

### Phase 3: PDF Generation + Billing Package (Sprint 6-7)

**Scope:**
- QuestPDF-based G702 PDF generation (AIA-compliant layout)
- G703 PDF generation with multi-page support
- Cover letter template and generation
- Change order log PDF
- Stored materials inventory PDF
- `BillingPackage` entity and assembly logic
- Combined package PDF (all documents merged)
- PDF download APIs

**Dependencies:** Phase 2

**Acceptance:** System generates print-ready AIA G702/G703 PDFs matching industry standard format. Complete billing package assembled automatically per owner requirements.

### Phase 4: Stored Materials + Retainage (Sprint 8-9)

**Scope:**
- `StoredMaterial` entity and CRUD APIs
- Stored materials → billing flow (store → bill → install)
- Documentation requirements tracking
- Per-line-item retainage overrides
- Retention step-down schedule integration (from RETENTION-LIEN-WAIVER-SPEC)
- Split retainage: work vs. stored materials (G702 Line 5a/5b)
- RetentionLedger integration (AR-side Hold entries on billing)
- GL posting on billing submission

**Dependencies:** Phase 2, RETENTION-LIEN-WAIVER-SPEC, GL-ACCOUNTING-SPEC

**Acceptance:** Stored materials tracked with documentation, billing includes proper stored materials column, retainage calculated correctly per line with step-down schedules, GL entries post on submission.

### Phase 5: AR Integration + Reporting (Sprint 10-11)

**Scope:**
- `ArBilling` creation on submission (AP-AR-FOUNDATION-SPEC integration)
- Cash receipt application against owner billings
- Over/under billing report (feeds WIP schedule)
- Billing status report across all projects
- Billing vs. cost progress comparison
- Billing forecast
- AR aging integration
- Lien waiver coordination (outbound waivers for billing package)

**Dependencies:** Phases 1-4, AP-AR-FOUNDATION-SPEC, RETENTION-LIEN-WAIVER-SPEC

**Acceptance:** Billing flows through to AR subledger. Cash receipts apply correctly. WIP-relevant reporting available. Lien waivers included in billing package.

### Phase 6: AI & Predictive Features (Sprint 12-13)

**Scope:**
- Progress suggestion agent (cost-based auto-populate)
- Overbilling detection agent (real-time warnings)
- Billing narrative generator
- Auto-populate draft from cost data
- Billing package completeness agent
- Billing deadline management with escalation
- No-progress line detection
- Payment prediction model
- Billing pace analysis

**Dependencies:** Phases 1-5

**Acceptance:** AI suggestions reduce billing preparation time by 60%+. Overbilling detected before submission. Billing deadlines managed with automated reminders.

---

## 16. Acceptance Criteria

### Schedule of Values
1. PM can create an owner SOV with line items that sum to the contract amount
2. SOV cannot be activated until balanced (lines sum = contract)
3. Active SOV lines are frozen — only modifiable via change order integration
4. SOV templates can be applied to pre-populate line items
5. Bulk import (CSV) successfully creates line items

### G702/G703 Generation
6. G702 Lines 1-9 calculate correctly per AIA specification
7. G703 Columns A-I calculate correctly with proper rounding
8. G702 Line 4 equals G703 Grand Total Column G (cross-validation)
9. G702 Line 3 equals G703 Grand Total Column C (cross-validation)
10. Application numbers are sequential with no gaps
11. Carry-forward values from prior application are exact

### Billing Workflow
12. Full state machine enforces valid transitions only
13. PM review is configurable (can be skipped for smaller projects)
14. Rejected billings return to Draft with reviewer comments preserved
15. Submission to owner creates AR subledger entry
16. Architect certification records amount (may differ from requested)
17. Disputed billings are tracked with resolution workflow

### Change Order Integration
18. Approved owner CO automatically updates SOV line scheduled values
19. New SOV lines can be created from CO allocations
20. Pending COs are visible in billing reports but cannot be billed
21. CO summary included in billing package shows additions and deductions

### Retainage
22. Per-line-item retainage overrides work correctly
23. G702 Line 5 splits retainage between completed work (5a) and stored materials (5b)
24. Retention step-down schedules apply at correct thresholds
25. RetentionLedger entries created on billing submission (AR side)

### Stored Materials
26. Stored materials tracked with location, value, and documentation
27. Stored materials appear in G703 Column F
28. "Install" action moves value from stored to completed (net zero change)
29. Owner documentation requirements checked before billing package marked complete

### PDF Generation
30. G702 PDF matches AIA standard layout with all 9 lines
31. G703 PDF correctly handles multi-page SOVs with page numbering
32. Combined billing package merges all documents into single PDF
33. PDF includes company logo and formatting per company settings

### AI & Predictive
34. Progress suggestions populate based on cost-to-date data
35. Overbilling warnings display in real-time during draft editing
36. Billing deadline reminders fire at configured intervals
37. No-progress lines flagged when cost activity exists
38. Auto-populated drafts carry forward correctly from prior billing

---

## Appendix A: Existing Code References

| File | Relevant Fields/Methods |
|------|------------------------|
| `src/Modules/Pitbull.Contracts/Domain/ScheduleOfValues.cs` | `SubcontractId`, `TotalScheduledValue`, `RetainagePercent`, `Status` |
| `src/Modules/Pitbull.Contracts/Domain/SOVLineItem.cs` | `ScheduledValue`, `PreviouslyBilled`, `CurrentBilled`, `StoredMaterials`, `Retainage`, computed `TotalCompletedToDate`, `PercentComplete`, `BalanceToFinish` |
| `src/Modules/Pitbull.Contracts/Domain/PaymentApplication.cs` | AP-side pay app — G702-like structure. `ApplicationNumber`, `WorkCompletedPrevious/ThisPeriod/ToDate`, `StoredMaterials`, retention fields, status workflow |
| `src/Modules/Pitbull.Contracts/Domain/PaymentApplicationLineItem.cs` | G703-like line items. `ScheduledValue`, `WorkCompletedPrevious/ThisPeriod`, `MaterialsStored*`, `RetainagePercent/Amount` |
| `src/Modules/Pitbull.Contracts/Domain/PaymentApplicationBookEntry.cs` | Dual-book accounting entries. `EarnedRevenueToDate`, `OverUnderBilling` |
| `src/Modules/Pitbull.Contracts/Domain/ChangeOrder.cs` | Sub change orders — `Amount`, `Status`, `SubcontractId` |
| `src/Modules/Pitbull.Core/Domain/ContractSettings.cs` | `AiaArchitectName`, `AiaOwnerName`, `DefaultRetainagePercent` |
| `src/Modules/Pitbull.Core/Domain/PaymentApplicationSettings.cs` | `DefaultRetainagePercent`, `AllowRetainageOverride`, `AllowRetainageReleaseBeforeFinal` |

## Appendix B: Related Specifications

| Spec | Relationship |
|------|-------------|
| `docs/plans/AP-AR-FOUNDATION-SPEC.md` | `CustomerOwner`, `CustomerProjectContract`, `ArBilling`, `ArCashReceipt` — the AR subledger that billing posts into |
| `docs/plans/RETENTION-LIEN-WAIVER-SPEC.md` | `RetentionLedger` (AR-side Hold entries), `LienWaiver` (outbound waivers in billing package), compliance gating |
| `docs/plans/GL-ACCOUNTING-SPEC.md` | GL account mapping (1100 AR, 1150 Retention Receivable, 3100 Billings on Contracts), journal entry posting |
| `docs/roles/AR-CLERK.md` | AR Clerk workflows: billing assembly, cash receipts, collections, retention billing |
| `docs/roles/PROJECT-MANAGER.md` | PM workflows: SOV setup, progress updates, change orders, cost forecasting |
