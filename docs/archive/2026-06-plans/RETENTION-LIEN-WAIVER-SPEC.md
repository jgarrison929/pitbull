# Retention & Lien Waiver System — Design Specification

> **Status:** Draft
> **Module:** `Pitbull.Contracts` (extends existing) + `Pitbull.Accounting` (future)
> **Author:** AI-assisted design
> **Date:** 2026-02-19
> **Prerequisites:** AP/AR Foundation (AP-AR-FOUNDATION-SPEC.md), GL Accounting (GL-ACCOUNTING-SPEC.md)

---

## Table of Contents

1. [Purpose & Scope](#1-purpose--scope)
2. [Glossary](#2-glossary)
3. [Retention Tracking](#3-retention-tracking)
4. [Configurable Retention Rates](#4-configurable-retention-rates)
5. [Retention Release Workflow](#5-retention-release-workflow)
6. [Lien Waiver Types & State Machine](#6-lien-waiver-types--state-machine)
7. [Compliance-Gated Payments](#7-compliance-gated-payments)
8. [State-Specific Lien Waiver Templates](#8-state-specific-lien-waiver-templates)
9. [Integration with Payment Applications & Billing](#9-integration-with-payment-applications--billing)
10. [AI Agent Opportunities](#10-ai-agent-opportunities)
11. [Predictive Features](#11-predictive-features)
12. [Domain Entities](#12-domain-entities)
13. [API Surface](#13-api-surface)
14. [Implementation Phases](#14-implementation-phases)
15. [Acceptance Criteria](#15-acceptance-criteria)

---

## 1. Purpose & Scope

### 1.1 Problem Statement

Construction contracts universally include retention (retainage) — a percentage of each progress payment withheld as security against defective work. This creates a bilateral accounting challenge:

- **Accounts Payable (AP):** We withhold retention from subcontractors until they complete their scope.
- **Accounts Receivable (AR):** The owner withholds retention from us until we complete the project.

Lien waivers are the legal mechanism that releases payment liability. Most states have statutory lien waiver forms, and paying a subcontractor without collecting a proper waiver exposes the general contractor to **double-payment risk** — the sub's unpaid suppliers can lien the project.

### 1.2 Goals

| Goal | Description |
|------|-------------|
| Bilateral tracking | Track retention held (AP) and retention owed (AR) per contract with full audit trail |
| Configurable rates | Support standard 10%, reduced rates, sliding scales, and per-line-item overrides |
| Release workflow | Multi-step approval chain for retention release with closeout documentation |
| Lien waiver compliance | Four waiver types with state-specific statutory forms |
| Payment gating | Block payments to subs without current insurance + signed lien waiver |
| GL integration | Post retention entries to proper GL accounts (1110/1150 AR, 2010/2050 AP) |
| Audit trail | Every retention calculation, release, and waiver action is logged and traceable |

### 1.3 Existing Codebase Anchors

The following entities and fields already exist and will be extended (not replaced):

| Existing Entity/Field | Location | Current State |
|----------------------|----------|---------------|
| `Subcontract.RetainagePercent` | `Pitbull.Contracts` | Default 10%, stored on contract |
| `Subcontract.RetainageHeld` | `Pitbull.Contracts` | Running total |
| `PaymentApplication.RetainagePercent/ThisPeriod/Previous/Total` | `Pitbull.Contracts` | Per-pay-app retention |
| `PaymentApplicationSettings.DefaultRetainagePercent` | `Pitbull.Contracts` | Tenant-level default |
| `PaymentApplicationSettings.AllowRetainageOverride` | `Pitbull.Contracts` | Whether PM can override |
| `PaymentApplicationSettings.AllowRetainageReleaseBeforeFinal` | `Pitbull.Contracts` | Early release flag |
| `ContractSettings.DefaultRetainagePercent` | `Pitbull.Contracts` | Contract-level default |
| `ProjectSettings.DefaultRetentionPercent` | `Pitbull.Projects` | Project-level default |
| `ScheduleOfValues.RetainagePercent` | `Pitbull.Contracts` | SOV-level default |
| `SOVLineItem.Retainage` | `Pitbull.Contracts` | Line-item retainage |
| `PaymentApplicationLineItem.RetainagePercent/Amount` | `Pitbull.Contracts` | Line-item pay app retention |
| `ProjectBudget.RetainageHeld` | `Pitbull.Projects` | Budget-level tracking |
| `RetentionLedger` (stub) | AP-AR-FOUNDATION-SPEC | Designed, not implemented |
| `RetentionReleaseRequest` (stub) | AP-AR-FOUNDATION-SPEC | Designed, not implemented |
| `LienWaiver` (stub) | AP-AR-FOUNDATION-SPEC | Designed, not implemented |
| `LienWaiverRequirement` (stub) | AP-AR-FOUNDATION-SPEC | Designed, not implemented |

### 1.4 Non-Goals (This Phase)

- Joint-venture retention splitting
- International retention rules (UK "retention bonds")
- Electronic notarization of lien waivers
- Sub-tier lien waiver collection (sub's suppliers)

---

## 2. Glossary

| Term | Definition |
|------|------------|
| **Retainage / Retention** | Percentage of a progress payment withheld as security. Used interchangeably in this spec. |
| **Retention Held (AP)** | Amount we withhold from subcontractors — our liability until released. |
| **Retention Receivable (AR)** | Amount the owner withholds from us — our asset until collected. |
| **Lien Waiver** | Legal document in which a party waives its right to file a mechanic's lien for payment received. |
| **Conditional Waiver** | Effective only upon actual receipt of payment (check clearance). |
| **Unconditional Waiver** | Effective immediately upon signing — used after payment clears. |
| **Progress Waiver** | Covers a specific draw/billing period. |
| **Final Waiver** | Covers all work and releases all lien rights on the project. |
| **Compliance Gate** | A set of prerequisites that must be satisfied before a payment can be released. |
| **Substantial Completion** | Contractual milestone that typically triggers retention release eligibility. |
| **Punch List** | Remaining deficiency items that must be corrected before final payment. |
| **Closeout Package** | Collection of documents (as-builts, warranties, final waivers) required for final payment. |

---

## 3. Retention Tracking

### 3.1 Dual-Sided Ledger

Retention is tracked on both the payable and receivable sides, each as a first-class ledger entity.

```
┌─────────────────────────────────────────────────────────┐
│                     PROJECT                              │
│                                                          │
│  ┌──────────────────────┐    ┌────────────────────────┐ │
│  │  RECEIVABLE SIDE     │    │  PAYABLE SIDE          │ │
│  │  (Owner → Us)        │    │  (Us → Subs)           │ │
│  │                      │    │                        │ │
│  │  Prime Contract      │    │  Subcontract A         │ │
│  │  Retention Rate: 10% │    │  Retention Rate: 10%   │ │
│  │  Retained: $150,000  │    │  Retained: $45,000     │ │
│  │                      │    │                        │ │
│  │  Owner Pay App #1    │    │  Subcontract B         │ │
│  │  Owner Pay App #2    │    │  Retention Rate: 5%    │ │
│  │  Owner Pay App #3    │    │  Retained: $12,500     │ │
│  │                      │    │                        │ │
│  │  Status: Held        │    │  Subcontract C         │ │
│  │                      │    │  Retention Rate: 10%   │ │
│  │                      │    │  Retained: $30,000     │ │
│  └──────────────────────┘    └────────────────────────┘ │
│                                                          │
│  Net Retention Position: $150,000 - $87,500 = $62,500   │
│  (Cash tied up in retention float)                       │
└─────────────────────────────────────────────────────────┘
```

### 3.2 RetentionLedger Entity

Each row records a single retention event — either a hold or a release. The running balance is computed, never stored.

```
RetentionLedger
├── Id : Guid (PK)
├── TenantId : Guid (RLS)
├── CompanyId : Guid
├── ProjectId : Guid (FK → Projects)
├── ContractId : Guid (FK → Subcontracts or PrimeContracts)
├── ContractType : enum (PrimeContract, Subcontract)
├── CounterpartyType : enum (OwnerReceivable, SubcontractorPayable)
├── PaymentApplicationId : Guid? (FK → PaymentApplications)
├── PaymentApplicationLineItemId : Guid? (FK → line item that generated this)
├── TransactionType : enum (Hold, Release, Adjustment, WriteOff)
├── Amount : decimal(18,2) — positive for Hold, negative for Release
├── RunningBalance : decimal(18,2) — computed on read, not stored
├── RetainagePercent : decimal(5,2) — rate applied at time of transaction
├── EffectiveDate : DateOnly
├── Description : string
├── ReleaseRequestId : Guid? (FK → RetentionReleaseRequest, if this is a release)
├── JournalEntryId : Guid? (FK → GL JournalEntry, once posted)
├── CreatedAt / CreatedBy / UpdatedAt / UpdatedBy (BaseEntity)
```

**Business Rules:**
- Every `PaymentApplication` line item with a non-zero retainage generates a `RetentionLedger.Hold` entry.
- Release entries are only created through the `RetentionReleaseRequest` approval workflow.
- Adjustments handle corrections (rate changes, contract modifications).
- Write-offs handle uncollectable retention (rare — requires Controller approval).
- The `RunningBalance` is always calculated as `SUM(Amount) WHERE ContractId = X`, ordered by `EffectiveDate`.

### 3.3 GL Account Mapping

| Side | Hold Account | Release Account | Description |
|------|-------------|-----------------|-------------|
| AR (Owner → Us) | 1150 Retention Receivable | 1100 Accounts Receivable | Owner withholds from our billings |
| AP (Us → Subs) | 2050 Retention Payable | 2000 Accounts Payable | We withhold from sub payments |

**Journal Entry on Sub Payment with 10% Retention:**
```
DR  Cost of Construction (job cost)     $100,000
    CR  Accounts Payable                           $90,000
    CR  Retention Payable                          $10,000
```

**Journal Entry on Retention Release to Sub:**
```
DR  Retention Payable                   $10,000
    CR  Cash                                       $10,000
```

**Journal Entry on Owner Billing with 10% Retention:**
```
DR  Accounts Receivable                 $90,000
DR  Retention Receivable                $10,000
    CR  Billings in Excess (or Revenue)            $100,000
```

**Journal Entry on Owner Retention Payment:**
```
DR  Cash                                $10,000
    CR  Retention Receivable                       $10,000
```

---

## 4. Configurable Retention Rates

### 4.1 Rate Hierarchy

Retention rates cascade from general to specific, with each level able to override the parent:

```
Tenant Default (PaymentApplicationSettings.DefaultRetainagePercent)
  └── Project Default (ProjectSettings.DefaultRetentionPercent)
       └── Contract Default (Subcontract.RetainagePercent / PrimeContract.RetainagePercent)
            └── SOV Default (ScheduleOfValues.RetainagePercent)
                 └── Line Item Override (SOVLineItem.RetainagePercent)
                      └── Pay App Line Override (PaymentApplicationLineItem.RetainagePercent)
```

### 4.2 RetentionSchedule Entity

Supports contracts with sliding-scale retention (e.g., 10% until 50% complete, then 5%).

```
RetentionSchedule
├── Id : Guid (PK)
├── TenantId : Guid (RLS)
├── CompanyId : Guid
├── ContractId : Guid (FK → Subcontracts or PrimeContracts)
├── ContractType : enum (PrimeContract, Subcontract)
├── ThresholdType : enum (PercentComplete, DollarAmount, Date)
├── ThresholdValue : decimal — the trigger point
├── RetainagePercent : decimal(5,2) — rate after this threshold
├── EffectiveDate : DateOnly? — for date-based triggers
├── SortOrder : int — evaluation order (first matching rule wins)
├── Notes : string?
├── CreatedAt / CreatedBy / UpdatedAt / UpdatedBy (BaseEntity)
```

**Example: Sliding Scale**

| Sort | Threshold Type | Threshold | Rate |
|------|---------------|-----------|------|
| 1 | PercentComplete | 0% | 10% |
| 2 | PercentComplete | 50% | 5% |
| 3 | PercentComplete | 95% | 0% |

### 4.3 Rate Resolution Algorithm

```
ResolveRetentionRate(contractId, lineItemId?, percentComplete):
  1. If PaymentApplicationLineItem has explicit RetainagePercent → use it
  2. If SOVLineItem has explicit RetainagePercent → use it
  3. If RetentionSchedule exists for contract:
     a. Evaluate rules in SortOrder, find last matching threshold
     b. Return that rate
  4. If ScheduleOfValues.RetainagePercent is set → use it
  5. If Contract.RetainagePercent is set → use it
  6. If ProjectSettings.DefaultRetentionPercent is set → use it
  7. Return PaymentApplicationSettings.DefaultRetainagePercent (tenant default)
```

### 4.4 Override Controls

| Setting | Location | Effect |
|---------|----------|--------|
| `AllowRetainageOverride` | PaymentApplicationSettings | PM can change rate on individual pay apps |
| `AllowRetainageReleaseBeforeFinal` | PaymentApplicationSettings | Enables partial release before substantial completion |
| `RequireRetentionScheduleApproval` | ContractSettings (new) | Changes to retention schedule require Controller sign-off |

---

## 5. Retention Release Workflow

### 5.1 Release Triggers

Retention release is initiated by one of these events:

| Trigger | Side | Description |
|---------|------|-------------|
| Substantial Completion | AP | Sub's scope is substantially complete; PM initiates release |
| Final Completion | AP | All punch list items resolved; final payment due |
| Contract Closeout | AP | All closeout docs received; final release |
| Owner Payment | AR | Owner pays retention; we record receipt |
| Scheduled Release | Both | Calendar-based (e.g., 12 months after substantial completion) |
| Partial Release | AP | PM approves releasing a portion (if `AllowRetainageReleaseBeforeFinal`) |

### 5.2 RetentionReleaseRequest Entity

```
RetentionReleaseRequest
├── Id : Guid (PK)
├── TenantId : Guid (RLS)
├── CompanyId : Guid
├── ProjectId : Guid (FK → Projects)
├── ContractId : Guid (FK → Subcontracts or PrimeContracts)
├── ContractType : enum (PrimeContract, Subcontract)
├── CounterpartyType : enum (OwnerReceivable, SubcontractorPayable)
├── RequestType : enum (Partial, Final)
├── RequestedAmount : decimal(18,2)
├── ApprovedAmount : decimal(18,2)?
├── RetentionBalanceAtRequest : decimal(18,2) — snapshot at time of request
├── Status : enum (see state machine below)
├── RequestedById : Guid (FK → Employees)
├── RequestedDate : DateOnly
├── Reason : string
├── RejectionReason : string?
│
│  Approval Chain
├── PmApprovalById : Guid?
├── PmApprovalDate : DateTimeOffset?
├── PmApprovalStatus : enum (Pending, Approved, Rejected)?
├── ControllerApprovalById : Guid?
├── ControllerApprovalDate : DateTimeOffset?
├── ControllerApprovalStatus : enum (Pending, Approved, Rejected)?
│
│  Closeout Checklist
├── PunchListComplete : bool
├── FinalLienWaiverReceived : bool
├── AsBuiltsReceived : bool
├── WarrantiesReceived : bool
├── CloseoutNotesReceived : bool
│
├── LedgerEntryId : Guid? (FK → RetentionLedger, created on approval)
├── PaymentId : Guid? (FK → ApPayment, if release triggers a payment)
├── CreatedAt / CreatedBy / UpdatedAt / UpdatedBy (BaseEntity)
```

### 5.3 Release State Machine

```
                    ┌──────────┐
                    │  Draft   │
                    └────┬─────┘
                         │ Submit
                         ▼
                 ┌───────────────┐
            ┌────│  PmReview     │────┐
            │    └───────────────┘    │
         Reject                    Approve
            │                         │
            ▼                         ▼
    ┌──────────────┐      ┌────────────────────┐
    │  PmRejected  │      │  ControllerReview  │
    └──────┬───────┘      └────────┬───────────┘
           │                  ┌────┴────┐
         Resubmit          Reject    Approve
           │                 │          │
           ▼                 ▼          ▼
    (back to PmReview)  ┌──────────┐  ┌──────────┐
                        │CtrlReject│  │ Approved  │
                        └────┬─────┘  └────┬─────┘
                             │              │
                          Resubmit    Create Ledger Entry
                             │         + Queue Payment
                             ▼              │
                      (back to PmReview)    ▼
                                      ┌──────────┐
                                      │  Paid    │
                                      └──────────┘
```

**State Enum:** `Draft`, `PmReview`, `PmRejected`, `ControllerReview`, `ControllerRejected`, `Approved`, `Paid`, `Cancelled`

### 5.4 Approval Rules

| Rule | Description |
|------|-------------|
| PM always reviews first | Even if requester is PM, a different PM or project executive must approve |
| Controller required for amounts > threshold | Configurable threshold (default: all releases require Controller) |
| Final release requires closeout checklist | All checklist booleans must be true for `RequestType.Final` |
| Partial release requires `AllowRetainageReleaseBeforeFinal` | Setting must be enabled at tenant level |
| Cannot release more than balance | `RequestedAmount <= RetentionBalanceAtRequest` |
| Final waiver required before final release | `FinalLienWaiverReceived` must be true |

### 5.5 Domain Events

| Event | Published When | Subscribers |
|-------|---------------|-------------|
| `RetentionReleaseRequested` | Request submitted | Notification to PM |
| `RetentionReleasePmApproved` | PM approves | Routes to Controller queue |
| `RetentionReleasePmRejected` | PM rejects | Notification to requester |
| `RetentionReleaseApproved` | Controller approves | Creates ledger entry, queues payment |
| `RetentionReleaseControllerRejected` | Controller rejects | Notification to requester + PM |
| `RetentionReleasePaid` | Payment clears | Updates ledger, triggers unconditional waiver request |

---

## 6. Lien Waiver Types & State Machine

### 6.1 Four Waiver Types

The construction industry uses a 2×2 matrix of lien waiver types:

|  | **Progress** (partial payment) | **Final** (final payment) |
|--|------|-------|
| **Conditional** (effective on payment clearance) | Conditional Progress | Conditional Final |
| **Unconditional** (effective immediately) | Unconditional Progress | Unconditional Final |

**Typical Flow:**
1. Sub submits a pay app → we send **Conditional Progress** waiver with the check
2. Check clears → we request **Unconditional Progress** waiver from sub
3. Project closeout → sub signs **Conditional Final** waiver for retention release
4. Final check clears → sub signs **Unconditional Final** waiver

### 6.2 LienWaiver Entity

```
LienWaiver
├── Id : Guid (PK)
├── TenantId : Guid (RLS)
├── CompanyId : Guid
├── ProjectId : Guid (FK → Projects)
├── ContractId : Guid (FK → Subcontracts or PrimeContracts)
├── ContractType : enum (PrimeContract, Subcontract)
├── CounterpartyId : Guid (FK → vendor or owner entity)
├── CounterpartyName : string (denormalized for display)
│
│  Classification
├── WaiverType : enum (ConditionalProgress, UnconditionalProgress, ConditionalFinal, UnconditionalFinal)
├── Direction : enum (Inbound, Outbound)
│     Inbound = received from sub/vendor; Outbound = we provide to owner
│
│  Financial Reference
├── PaymentApplicationId : Guid? (FK → PaymentApplications)
├── PaymentId : Guid? (FK → ApPayment or ArReceipt)
├── ThroughDate : DateOnly — period covered by this waiver
├── AmountWaived : decimal(18,2) — dollar amount covered
├── ExceptionsAmount : decimal(18,2)? — disputed/excluded amount
├── ExceptionsDescription : string? — description of exceptions
│
│  Status & Workflow
├── Status : enum (see state machine below)
├── RequestedDate : DateOnly
├── RequestedById : Guid (FK → Employees)
├── DueDate : DateOnly — when we need it back
├── ReceivedDate : DateOnly?
├── ReviewedById : Guid?
├── ReviewedDate : DateTimeOffset?
├── RejectionReason : string?
│
│  Document
├── TemplateId : Guid? (FK → LienWaiverTemplate)
├── StateCode : string(2) — state whose statutory form applies
├── GeneratedDocumentUrl : string? — path to generated PDF
├── SignedDocumentUrl : string? — path to uploaded signed document
├── NotarizedRequired : bool
├── NotarizedDate : DateOnly?
├── NotaryName : string?
│
├── Notes : string?
├── CreatedAt / CreatedBy / UpdatedAt / UpdatedBy (BaseEntity)
```

### 6.3 Waiver State Machine

```
┌────────────┐
│  Pending    │  — waiver created, not yet sent
└─────┬──────┘
      │ Send to counterparty
      ▼
┌────────────┐
│  Sent       │  — waiver sent, awaiting return
└─────┬──────┘
      │ Counterparty returns signed copy
      ▼
┌────────────┐
│  Received   │  — signed waiver in hand, needs review
└─────┬──────┘
      ├── Review passes ──────────────┐
      │                                ▼
      │                        ┌─────────────┐
      │                        │  Approved    │  — waiver accepted, gates cleared
      │                        └─────────────┘
      │
      └── Review fails ──────────────┐
                                      ▼
                               ┌─────────────┐
                               │  Rejected    │  — sent back for correction
                               └──────┬──────┘
                                      │ Resubmit
                                      ▼
                                (back to Sent)

Additional terminal states:
┌─────────────┐
│  Waived      │  — requirement waived by authorized user (rare)
└─────────────┘
┌─────────────┐
│  Expired     │  — past due date, never received (triggers alert)
└─────────────┘
```

**Status Enum:** `Pending`, `Sent`, `Received`, `Approved`, `Rejected`, `Waived`, `Expired`

### 6.4 Direction: Inbound vs. Outbound

| Direction | We Are | Counterparty | Typical Type |
|-----------|--------|-------------|--------------|
| **Inbound** | GC collecting from sub | Subcontractor | All 4 types |
| **Outbound** | GC providing to owner | Owner / Lender | All 4 types |

**Outbound waivers** are included in the owner billing package (AIA G702/G703). They cover:
- Our own waiver for the billing period
- All sub waivers for the billing period (pass-through)

### 6.5 LienWaiverRequirement Entity

Defines what waivers are required per contract, enabling compliance gating.

```
LienWaiverRequirement
├── Id : Guid (PK)
├── TenantId : Guid (RLS)
├── CompanyId : Guid
├── ContractId : Guid (FK → Subcontracts or PrimeContracts)
├── ContractType : enum (PrimeContract, Subcontract)
├── WaiverType : enum (ConditionalProgress, UnconditionalProgress, ConditionalFinal, UnconditionalFinal)
├── IsRequired : bool — whether this waiver type is required for this contract
├── RequiredForPayment : bool — if true, payment is blocked without this waiver
├── NotarizationRequired : bool — if true, waiver must be notarized
├── StateCode : string(2) — state whose form to use
├── TemplateId : Guid? (FK → LienWaiverTemplate)
├── Notes : string?
├── CreatedAt / CreatedBy / UpdatedAt / UpdatedBy (BaseEntity)
```

**Default Requirements (set at contract creation):**
- Conditional Progress: Required for payment = **true**
- Unconditional Progress: Required for payment = **false** (requested after check clears)
- Conditional Final: Required for payment = **true** (for retention release)
- Unconditional Final: Required for payment = **false** (requested after final check clears)

---

## 7. Compliance-Gated Payments

### 7.1 Compliance Gate Definition

Before any AP payment can transition from `Approved` → `Paid`, the system checks a compliance gate composed of multiple requirements.

```
ComplianceGate
├── Id : Guid (PK)
├── TenantId : Guid (RLS)
├── CompanyId : Guid
├── PaymentId : Guid (FK → ApPayment)
├── ContractId : Guid (FK → Subcontracts)
├── ProjectId : Guid (FK → Projects)
│
│  Individual Gates
├── InsuranceCertCurrent : bool
├── InsuranceCertExpiryDate : DateOnly?
├── W9OnFile : bool
├── ConditionalWaiverReceived : bool
├── ConditionalWaiverId : Guid? (FK → LienWaiver)
├── PreviousUnconditionalWaiverReceived : bool — waiver for PRIOR period
├── PreviousUnconditionalWaiverId : Guid?
├── CustomGate1Label : string? — tenant-configurable
├── CustomGate1Satisfied : bool
├── CustomGate2Label : string?
├── CustomGate2Satisfied : bool
│
│  Overall Status
├── AllGatesSatisfied : bool (computed)
├── OverrideApprovedById : Guid? — if gates overridden by authorized user
├── OverrideReason : string?
├── OverrideDate : DateTimeOffset?
│
├── CreatedAt / CreatedBy / UpdatedAt / UpdatedBy (BaseEntity)
```

### 7.2 Gate Evaluation Flow

```
Sub Pay App Approved
        │
        ▼
  ┌─────────────────┐
  │ Check Insurance  │──── Expired? ──→ BLOCK + Alert PM
  │ Certificate      │
  └────────┬────────┘
           │ Current
           ▼
  ┌─────────────────┐
  │ Check W-9       │──── Missing? ──→ BLOCK + Alert AP Clerk
  │ On File         │
  └────────┬────────┘
           │ On file
           ▼
  ┌─────────────────────────┐
  │ Check Conditional Waiver │──── Missing? ──→ BLOCK + Auto-request waiver
  │ (this period)            │
  └────────┬────────────────┘
           │ Received
           ▼
  ┌──────────────────────────────┐
  │ Check Unconditional Waiver   │──── Missing? ──→ WARN (not block)
  │ (previous period)            │
  └────────┬─────────────────────┘
           │
           ▼
  ┌─────────────────┐
  │ Custom Gates     │──── Any unsatisfied? ──→ BLOCK
  └────────┬────────┘
           │ All satisfied
           ▼
    Payment Cleared for Processing
```

### 7.3 Override Policy

Compliance gates can be overridden, but only by authorized roles with a mandatory reason:

| Role | Can Override |
|------|-------------|
| Controller | All gates |
| Project Executive | Insurance + W-9 gates only |
| PM | None (can request override from Controller) |

**Override creates an audit entry** with the overrider's identity, reason, and timestamp. Overrides are flagged in reports and dashboards.

### 7.4 ComplianceGateSettings

Tenant-level configuration for which gates are enforced.

```
ComplianceGateSettings
├── Id : Guid (PK)
├── TenantId : Guid (RLS)
├── CompanyId : Guid
├── RequireInsuranceCert : bool (default: true)
├── RequireW9 : bool (default: true)
├── RequireConditionalWaiver : bool (default: true)
├── RequirePreviousUnconditionalWaiver : bool (default: false)
├── InsuranceGracePeriodDays : int (default: 30) — warn before expiry
├── AutoRequestWaiverOnPayAppApproval : bool (default: true)
├── CustomGate1Label : string?
├── CustomGate1Enabled : bool (default: false)
├── CustomGate2Label : string?
├── CustomGate2Enabled : bool (default: false)
├── CreatedAt / CreatedBy / UpdatedAt / UpdatedBy (BaseEntity)
```

---

## 8. State-Specific Lien Waiver Templates

### 8.1 LienWaiverTemplate Entity

```
LienWaiverTemplate
├── Id : Guid (PK)
├── TenantId : Guid (RLS)
├── CompanyId : Guid
├── StateCode : string(2) — "CA", "TX", "FL", etc.
├── WaiverType : enum (ConditionalProgress, UnconditionalProgress, ConditionalFinal, UnconditionalFinal)
├── Name : string — "California Conditional Progress Waiver"
├── IsStatutory : bool — state-mandated form (cannot be modified)
├── TemplateBody : string — Markdown/HTML template with merge fields
├── Version : int — template version for audit
├── EffectiveDate : DateOnly — when this version became effective
├── SupersededById : Guid? — if a newer version exists
├── IsActive : bool
├── CreatedAt / CreatedBy / UpdatedAt / UpdatedBy (BaseEntity)
```

### 8.2 Merge Fields

Templates use `{{FieldName}}` placeholders that are populated at generation time:

| Field | Description |
|-------|-------------|
| `{{ClaimantName}}` | Sub/vendor legal name |
| `{{ClaimantAddress}}` | Sub/vendor address |
| `{{CustomerName}}` | Our company name (or owner name for outbound) |
| `{{ProjectName}}` | Project name |
| `{{ProjectAddress}}` | Project physical address |
| `{{ProjectOwner}}` | Property owner's legal name |
| `{{ThroughDate}}` | Period end date covered by waiver |
| `{{PaymentAmount}}` | Dollar amount covered |
| `{{ExceptionsAmount}}` | Disputed/excluded amount |
| `{{ExceptionsDescription}}` | Description of exceptions |
| `{{CheckNumber}}` | Payment check/EFT reference |
| `{{PaymentDate}}` | Date of payment |
| `{{ContractAmount}}` | Total contract value |
| `{{PriorPayments}}` | Previously paid amounts |
| `{{SignatureDate}}` | Date of signature |
| `{{NotaryBlock}}` | Notary acknowledgment block (if required) |

### 8.3 State Coverage

**Phase 1 — Statutory Form States:**

| State | Code | Statutory? | Notes |
|-------|------|-----------|-------|
| **California** | CA | Yes | Civil Code §8132-8138. Four mandatory forms. Most prescriptive state. |
| **Texas** | TX | Yes | Property Code §53.284-53.285. Four statutory forms. |
| **Florida** | FL | Yes | Statute §713.20. "Partial/Final Release of Lien" forms. |
| **Georgia** | GA | Yes | O.C.G.A. §44-14-366. Statutory forms since 2016. |
| **Michigan** | MI | Yes | MCL §570.1115. "Sworn Statement" and waiver forms. |
| **Nevada** | NV | Yes | NRS §108.2457. Four statutory forms. |

**Phase 2 — Non-Statutory States (company-standard forms):**

| State | Code | Notes |
|-------|------|-------|
| All other states | * | Use company-standard templates. AIA G706A as default. |

### 8.4 California Statutory Forms (Example)

California Civil Code prescribes exact form language. The system must generate these word-for-word.

| Section | Type | Key Language |
|---------|------|-------------|
| §8132 | Conditional Progress | "...conditioned on receipt of payment..." |
| §8134 | Unconditional Progress | "...unconditionally waives and releases..." |
| §8136 | Conditional Final | "...conditioned on receipt of final payment..." |
| §8138 | Unconditional Final | "...unconditionally waives and releases any mechanic's lien..." |

**Important:** California waivers that do not use the statutory language are **void**. The system must prevent any modification to statutory template text. Custom text can only appear in the exceptions field.

### 8.5 Template Management Rules

| Rule | Description |
|------|-------------|
| Statutory templates are system-managed | Tenant cannot edit the body text of statutory forms |
| Tenant can create custom templates | For non-statutory states or additional requirements |
| Version tracking | Every template edit creates a new version; old versions preserved |
| State auto-detection | Project address determines which state's templates apply by default |
| Manual override | PM or AP Clerk can select a different state template if needed |

---

## 9. Integration with Payment Applications & Billing

### 9.1 Sub Pay App → Retention + Waiver Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ SUB PAY APP LIFECYCLE                                           │
│                                                                  │
│  Sub Submits Pay App                                            │
│       │                                                          │
│       ▼                                                          │
│  PM Reviews & Approves                                          │
│       │                                                          │
│       ├──→ Retention Calculated per line item                    │
│       │    (RetentionLedger.Hold entries created)                │
│       │                                                          │
│       ├──→ Compliance Gate Created                               │
│       │    (insurance, W-9, waiver checks)                       │
│       │                                                          │
│       ├──→ Conditional Progress Waiver auto-generated            │
│       │    (from state template, sent to sub)                    │
│       │                                                          │
│       ▼                                                          │
│  AP Clerk Processes Payment                                      │
│       │                                                          │
│       ├──→ Verify compliance gate satisfied                      │
│       │    (conditional waiver received + approved?)             │
│       │                                                          │
│       ├──→ Issue check/EFT for (Approved - Retention)           │
│       │                                                          │
│       ▼                                                          │
│  Payment Clears                                                  │
│       │                                                          │
│       ├──→ Request Unconditional Progress Waiver from sub        │
│       │                                                          │
│       ├──→ GL entries posted:                                    │
│       │    DR Job Cost, CR AP (net), CR Retention Payable        │
│       │                                                          │
│       └──→ Update payment status to Cleared                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 Owner Billing → Retention + Waiver Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ OWNER BILLING LIFECYCLE                                          │
│                                                                  │
│  PM Prepares Owner Pay App (AIA G702/G703)                      │
│       │                                                          │
│       ├──→ Retention calculated at project/contract level        │
│       │    (RetentionLedger.Hold entries — AR side)              │
│       │                                                          │
│       ├──→ Billing Package assembled:                            │
│       │    • G702 Summary with retention line                    │
│       │    • G703 Continuation Sheet                             │
│       │    • Our Conditional Progress Waiver (outbound)          │
│       │    • All sub Unconditional Waivers for prior period      │
│       │                                                          │
│       ▼                                                          │
│  AR Clerk Submits to Owner                                       │
│       │                                                          │
│       ▼                                                          │
│  Owner Pays (net of retention)                                   │
│       │                                                          │
│       ├──→ AR Receipt recorded                                   │
│       ├──→ GL: DR Cash, CR AR (net amount)                       │
│       ├──→ Retention Receivable remains on books                 │
│       │                                                          │
│       ├──→ Owner requests Unconditional Waiver from us           │
│       │    (outbound waiver generated and sent)                  │
│       │                                                          │
│       ▼                                                          │
│  Project Closeout                                                │
│       │                                                          │
│       ├──→ Retention billing submitted                           │
│       │    (requires closeout docs: as-builts, warranties, etc.) │
│       │                                                          │
│       ├──→ Final waivers exchanged:                              │
│       │    • We provide Conditional Final to owner               │
│       │    • We collect Final waivers from all subs              │
│       │                                                          │
│       ├──→ Owner pays retention                                  │
│       │    GL: DR Cash, CR Retention Receivable                  │
│       │                                                          │
│       └──→ Unconditional Final waiver provided to owner          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 9.3 Retention in AIA G702/G703

The AIA G702 Application for Payment includes specific retention fields:

| G702 Column | Mapping |
|-------------|---------|
| Column D: Total Completed & Stored | Sum of all SOV line items billed |
| Column E: Retainage (% or amount) | Computed from retention rate × Column D |
| Column F: Total Earned Less Retainage | Column D - Column E |
| Column G: Previous Certificates | Prior billings less retention |
| Current Payment Due | Column F - Column G |

The `PaymentApplication` entity already has `RetainageThisPeriod`, `RetainagePrevious`, and `TotalRetainage` fields that map directly to these G702 fields.

### 9.4 Cross-Module Event Flow

| Event | Source Module | Action in Retention/Waiver Module |
|-------|-------------|-----------------------------------|
| `PaymentApplicationApproved` | Contracts | Create `RetentionLedger.Hold` entries, create `ComplianceGate`, auto-generate conditional waiver |
| `ApPaymentIssued` | Accounting | Check compliance gate, block if unsatisfied |
| `ApPaymentCleared` | Accounting | Request unconditional waiver from sub |
| `ArReceiptRecorded` | Accounting | Match to retention receivable if applicable |
| `SubcontractClosed` | Contracts | Trigger final waiver collection, flag retention for release |
| `ProjectClosed` | Projects | Generate retention release report, flag outstanding waivers |
| `InsuranceCertExpiring` | Vendor Management | Update compliance gate, alert PM |

---

## 10. AI Agent Opportunities

### 10.1 Waiver Auto-Generation Agent

**Trigger:** `PaymentApplicationApproved` event
**Action:**
1. Determine state from project address
2. Select correct statutory template
3. Populate all merge fields from pay app + contract data
4. Generate PDF
5. Create `LienWaiver` record in `Pending` status
6. Route to AP Clerk for review and sending

**Value:** Eliminates manual waiver preparation (5-10 min per waiver × hundreds of pay apps per year).

### 10.2 Missing Waiver Detection Agent

**Trigger:** Scheduled daily scan + before payment run
**Action:**
1. Scan all `ApPayment` records in `Approved` status
2. For each, check if required conditional waiver exists and is `Approved`
3. For each, check if prior period's unconditional waiver exists
4. Generate exception report with:
   - Payments blocked by missing waivers
   - Days outstanding for each missing waiver
   - Counterparty contact information
5. Auto-send reminder emails to subs with overdue waivers

**Value:** Prevents payment delays from missing paperwork; reduces AP Clerk's daily "waiver chase" time.

### 10.3 Retention Release Readiness Agent

**Trigger:** Scheduled weekly scan + on project milestone events
**Action:**
1. For each project nearing completion (>90% complete):
   - Check all sub closeout checklists
   - Identify missing documents (warranties, as-builts, final waivers)
   - Calculate total retention eligible for release
   - Flag projects where retention release is overdue
2. Generate "Retention Release Readiness Report"
3. Auto-create draft `RetentionReleaseRequest` records for eligible releases

**Value:** Proactive cash flow management — releases trapped in retention because no one initiated the paperwork.

### 10.4 Waiver Document Classification Agent

**Trigger:** Document uploaded to waiver record
**Action:**
1. OCR the uploaded PDF/image
2. Extract key fields: waiver type, amount, through date, signatory, notary
3. Validate extracted data against the `LienWaiver` record
4. Flag discrepancies (wrong amount, wrong date, wrong project)
5. Check for required notarization
6. Auto-transition to `Received` status if valid, or flag for manual review

**Value:** Eliminates manual review of waiver documents; catches data entry errors.

### 10.5 Insurance Expiry Monitoring Agent

**Trigger:** Daily scan
**Action:**
1. Scan all active subcontracts
2. For each, check insurance certificate expiry date
3. If within `InsuranceGracePeriodDays`:
   - Send renewal reminder to sub
   - Alert PM and AP Clerk
   - Update compliance gate status
4. If expired:
   - Block pending payments
   - Escalate to Project Executive

**Value:** Prevents paying uninsured subs — a significant liability risk.

---

## 11. Predictive Features

### 11.1 Retention Release Timing Predictor

**Input:** Historical project completion patterns, current project % complete, sub performance data
**Output:** Predicted date when each sub's retention will be eligible for release

```
Model: retention_release_prediction
Features:
  - project_type (commercial, industrial, healthcare)
  - sub_trade (electrical, mechanical, concrete)
  - contract_value
  - percent_complete
  - punch_list_items_remaining
  - historical_completion_velocity
  - season (weather-sensitive trades)
Output:
  - predicted_release_date
  - confidence_interval
  - risk_factors[]
```

**Dashboard Widget:** "Retention Release Forecast" showing expected cash inflows from retention recovery over the next 90 days.

### 11.2 Retention Threshold Alerts

**Rule-based predictions:**
- Alert when sub's retention balance exceeds X% of remaining contract value (over-retained)
- Alert when project retention receivable hits release threshold (e.g., substantial completion)
- Alert when retention rate should step down per sliding schedule but hasn't been applied

### 11.3 Auto-Draft Final Waivers at Closeout

**Trigger:** Project status changes to `SubstantiallyComplete` or `PunchListComplete`

**Action:**
1. Identify all subs on the project with retention balances
2. For each sub:
   - Draft `ConditionalFinal` waiver from template
   - Pre-populate all merge fields
   - Create `LienWaiver` record in `Pending` status
   - Assign to AP Clerk's queue
3. Generate closeout summary showing:
   - Total retention to release
   - Outstanding waivers needed
   - Missing closeout documents

### 11.4 Cash Flow Impact Analysis

**Input:** All retention held (AP) + retention receivable (AR) across all active projects
**Output:** Rolling 12-month cash flow impact of retention

```
Retention Cash Flow Forecast
─────────────────────────────
Month       AR Collected    AP Released    Net Impact
2026-03     $45,000         $32,000        +$13,000
2026-04     $120,000        $87,000        +$33,000
2026-05     $0              $15,000        -$15,000
...
─────────────────────────────
Total       $550,000        $420,000       +$130,000
```

### 11.5 Compliance Risk Scoring

**Per-vendor risk score** based on:
- Historical waiver return time (average days to return)
- Insurance lapse frequency
- Waiver rejection rate (wrong amounts, missing signatures)
- Outstanding waiver count

**Risk Tiers:**
| Tier | Score | Action |
|------|-------|--------|
| Green | 0-20 | Standard processing |
| Yellow | 21-50 | Weekly reminder emails, PM notified |
| Orange | 51-75 | Biweekly AP Clerk follow-up, hold future pay apps |
| Red | 76-100 | Controller review required, potential contract default |

---

## 12. Domain Entities — Complete Reference

### 12.1 Entity Relationship Diagram

```
┌──────────────────┐     ┌───────────────────┐     ┌──────────────────┐
│    Project        │────→│   Subcontract      │────→│ RetentionSchedule│
│                   │     │  RetainagePercent   │     │ ThresholdType    │
│ DefaultRetention  │     │  RetainageHeld      │     │ RetainagePercent  │
└────────┬─────────┘     └──────┬────────────┘     └──────────────────┘
         │                       │
         │                       │
         ▼                       ▼
┌──────────────────┐     ┌───────────────────┐
│RetentionLedger   │     │PaymentApplication │
│ Hold / Release   │←────│ RetainageThisPeriod│
│ Amount           │     │ RetainagePrevious  │
│ CounterpartyType │     │ TotalRetainage     │
└────────┬─────────┘     └──────┬────────────┘
         │                       │
         │                       │
         ▼                       ▼
┌────────────────────┐   ┌───────────────────┐
│RetentionRelease    │   │  ComplianceGate    │
│  Request           │   │  InsuranceCert     │
│  PmApproval        │   │  W9OnFile          │
│  ControllerApproval│   │  ConditionalWaiver │
│  Status            │   │  AllGatesSatisfied │
└────────────────────┘   └──────┬────────────┘
                                 │
                                 │
                                 ▼
                         ┌───────────────────┐     ┌──────────────────┐
                         │   LienWaiver       │────→│LienWaiverTemplate│
                         │  WaiverType        │     │ StateCode        │
                         │  Direction         │     │ IsStatutory      │
                         │  Status            │     │ TemplateBody     │
                         │  AmountWaived      │     │ MergeFields      │
                         └───────────────────┘     └──────────────────┘
                                 │
                                 ▼
                         ┌───────────────────┐
                         │LienWaiverRequirement│
                         │ WaiverType         │
                         │ IsRequired         │
                         │ RequiredForPayment │
                         └───────────────────┘
```

### 12.2 New Enums

```csharp
public enum CounterpartyType { OwnerReceivable, SubcontractorPayable }
public enum RetentionTransactionType { Hold, Release, Adjustment, WriteOff }
public enum RetentionThresholdType { PercentComplete, DollarAmount, Date }
public enum RetentionReleaseRequestType { Partial, Final }
public enum RetentionReleaseStatus { Draft, PmReview, PmRejected, ControllerReview, ControllerRejected, Approved, Paid, Cancelled }
public enum ApprovalStatus { Pending, Approved, Rejected }
public enum LienWaiverType { ConditionalProgress, UnconditionalProgress, ConditionalFinal, UnconditionalFinal }
public enum LienWaiverDirection { Inbound, Outbound }
public enum LienWaiverStatus { Pending, Sent, Received, Approved, Rejected, Waived, Expired }
public enum ContractType { PrimeContract, Subcontract }
```

### 12.3 Database Tables

| Table | Key Columns | Indexes |
|-------|------------|---------|
| `retention_ledger` | id, tenant_id, company_id, project_id, contract_id | (tenant_id, project_id, contract_id), (tenant_id, counterparty_type, effective_date) |
| `retention_schedules` | id, tenant_id, company_id, contract_id | (tenant_id, contract_id, sort_order) |
| `retention_release_requests` | id, tenant_id, company_id, project_id, contract_id | (tenant_id, project_id, status), (tenant_id, contract_id) |
| `lien_waivers` | id, tenant_id, company_id, project_id, contract_id | (tenant_id, project_id, status), (tenant_id, contract_id, waiver_type), (tenant_id, counterparty_id, status) |
| `lien_waiver_requirements` | id, tenant_id, company_id, contract_id | (tenant_id, contract_id, waiver_type) |
| `lien_waiver_templates` | id, tenant_id, company_id, state_code, waiver_type | (tenant_id, state_code, waiver_type, is_active) |
| `compliance_gates` | id, tenant_id, company_id, payment_id | (tenant_id, payment_id), (tenant_id, project_id, all_gates_satisfied) |
| `compliance_gate_settings` | id, tenant_id, company_id | (tenant_id, company_id) UNIQUE |

All tables follow the existing snake_case convention, include `tenant_id` for RLS, and extend `BaseEntity` audit columns.

---

## 13. API Surface

### 13.1 Retention Ledger APIs

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/retention/project/{projectId}` | Get retention summary for a project (both sides) |
| GET | `/api/retention/contract/{contractId}` | Get retention ledger entries for a contract |
| GET | `/api/retention/project/{projectId}/summary` | Aggregated AR + AP retention with net position |
| GET | `/api/retention/dashboard` | Company-wide retention dashboard (all projects) |
| GET | `/api/retention/forecast` | Rolling 12-month retention cash flow forecast |

### 13.2 Retention Schedule APIs

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/contracts/{contractId}/retention-schedule` | Get retention schedule for a contract |
| POST | `/api/contracts/{contractId}/retention-schedule` | Create/update retention schedule |
| PUT | `/api/contracts/{contractId}/retention-schedule/{id}` | Update a schedule entry |
| DELETE | `/api/contracts/{contractId}/retention-schedule/{id}` | Remove a schedule entry |

### 13.3 Retention Release Request APIs

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/retention-releases` | List all release requests (filterable by project, status, type) |
| GET | `/api/retention-releases/{id}` | Get release request details |
| POST | `/api/retention-releases` | Create a new release request |
| POST | `/api/retention-releases/{id}/submit` | Submit for PM review |
| POST | `/api/retention-releases/{id}/pm-approve` | PM approves |
| POST | `/api/retention-releases/{id}/pm-reject` | PM rejects (with reason) |
| POST | `/api/retention-releases/{id}/controller-approve` | Controller approves |
| POST | `/api/retention-releases/{id}/controller-reject` | Controller rejects (with reason) |
| POST | `/api/retention-releases/{id}/cancel` | Cancel a request |

### 13.4 Lien Waiver APIs

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/lien-waivers` | List waivers (filter by project, contract, type, status, direction) |
| GET | `/api/lien-waivers/{id}` | Get waiver details |
| POST | `/api/lien-waivers` | Create a waiver record |
| POST | `/api/lien-waivers/{id}/generate` | Generate waiver PDF from template |
| POST | `/api/lien-waivers/{id}/send` | Mark as sent to counterparty |
| POST | `/api/lien-waivers/{id}/receive` | Mark as received (upload signed doc) |
| POST | `/api/lien-waivers/{id}/approve` | Approve received waiver |
| POST | `/api/lien-waivers/{id}/reject` | Reject waiver (with reason) |
| POST | `/api/lien-waivers/{id}/waive` | Waive requirement (authorized users only) |
| GET | `/api/lien-waivers/project/{projectId}/status` | Waiver compliance status for all subs on a project |
| GET | `/api/lien-waivers/project/{projectId}/billing-package` | Get waivers needed for owner billing package |

### 13.5 Lien Waiver Template APIs

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/lien-waiver-templates` | List templates (filter by state, type) |
| GET | `/api/lien-waiver-templates/{id}` | Get template details |
| POST | `/api/lien-waiver-templates` | Create a custom template |
| PUT | `/api/lien-waiver-templates/{id}` | Update a custom template (not statutory) |
| GET | `/api/lien-waiver-templates/states` | List supported states and their template coverage |

### 13.6 Lien Waiver Requirement APIs

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/contracts/{contractId}/waiver-requirements` | Get waiver requirements for a contract |
| PUT | `/api/contracts/{contractId}/waiver-requirements` | Update waiver requirements (bulk) |

### 13.7 Compliance Gate APIs

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/compliance-gates/payment/{paymentId}` | Get compliance gate for a payment |
| GET | `/api/compliance-gates/project/{projectId}` | Get all compliance gates for a project |
| POST | `/api/compliance-gates/{id}/override` | Override a compliance gate (with reason) |
| GET | `/api/compliance-gates/blocked-payments` | List all payments currently blocked by compliance |
| GET | `/api/compliance-gate-settings` | Get tenant compliance gate settings |
| PUT | `/api/compliance-gate-settings` | Update compliance gate settings |

### 13.8 Reporting APIs

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/reports/retention-aging` | Retention aging report (how long has retention been held) |
| GET | `/api/reports/retention-by-project` | Retention summary per project (AR + AP + net) |
| GET | `/api/reports/waiver-compliance` | Waiver compliance status across all projects/subs |
| GET | `/api/reports/compliance-overrides` | Audit report of all compliance gate overrides |
| GET | `/api/reports/vendor-compliance-scores` | Vendor compliance risk scores |

---

## 14. Implementation Phases

### Phase 1: Retention Ledger Foundation (Sprint 1-2)

**Scope:**
- `RetentionLedger` entity, migrations, EF configuration
- `RetentionSchedule` entity for configurable rates
- Rate resolution algorithm
- Auto-create `Hold` entries when `PaymentApplication` is approved
- Retention summary APIs (per project, per contract)
- Retention dashboard API

**Dependencies:** Existing `Subcontract`, `PaymentApplication`, `SOVLineItem` entities

**Acceptance:** Retention is tracked for every pay app, visible on project dashboard, rates are configurable per contract.

### Phase 2: Retention Release Workflow (Sprint 3-4)

**Scope:**
- `RetentionReleaseRequest` entity with full state machine
- PM and Controller approval chain
- Closeout checklist enforcement
- Domain events for release lifecycle
- Release request APIs
- GL integration (journal entries on release)

**Dependencies:** Phase 1, GL module (GL-ACCOUNTING-SPEC.md)

**Acceptance:** PM can initiate retention release, Controller approves, GL entries post automatically, audit trail complete.

### Phase 3: Lien Waiver Core (Sprint 5-6)

**Scope:**
- `LienWaiver` entity with state machine
- `LienWaiverRequirement` entity
- Waiver CRUD APIs
- Inbound/outbound waiver tracking
- Waiver status dashboard

**Dependencies:** Phase 1

**Acceptance:** AP Clerk can track all four waiver types, waivers linked to pay apps and contracts, status visible per project.

### Phase 4: Compliance Gating (Sprint 7-8)

**Scope:**
- `ComplianceGate` entity
- `ComplianceGateSettings` entity
- Gate evaluation on payment processing
- Override workflow with audit trail
- Blocked payments dashboard
- Integration with payment processing pipeline

**Dependencies:** Phase 3, AP payment processing (AP-AR-FOUNDATION-SPEC.md)

**Acceptance:** Payments cannot be issued without satisfying compliance gates. Overrides require authorized role and create audit entry.

### Phase 5: State Templates & PDF Generation (Sprint 9-10)

**Scope:**
- `LienWaiverTemplate` entity
- Statutory templates for CA, TX, FL, GA, MI, NV
- Company-standard templates for other states
- Merge field population engine
- PDF generation (HTML → PDF via wkhtmltopdf or similar)
- Template management APIs

**Dependencies:** Phase 3

**Acceptance:** Waivers auto-generate with correct state-specific statutory language, PDFs are production-ready for mailing/emailing.

### Phase 6: AI & Predictive Features (Sprint 11-12)

**Scope:**
- Waiver auto-generation agent
- Missing waiver detection agent
- Retention release readiness agent
- Waiver document classification agent (OCR)
- Retention release timing predictor
- Cash flow impact analysis
- Vendor compliance risk scoring

**Dependencies:** Phases 1-5

**Acceptance:** AI agents reduce manual work by auto-generating waivers, flagging compliance gaps, and predicting retention release timing.

---

## 15. Acceptance Criteria

### Retention Tracking
1. Every approved sub pay app creates `RetentionLedger.Hold` entries for each line item with non-zero retention
2. Every owner billing creates AR-side `RetentionLedger.Hold` entries
3. Retention rates resolve correctly through the full hierarchy (tenant → project → contract → SOV → line item)
4. Sliding-scale retention schedules apply correct rates based on % complete
5. Net retention position (AR - AP) is visible per project on the dashboard
6. Retention balances are accurate across all active projects

### Retention Release
7. Release requests follow the full state machine (Draft → PmReview → ControllerReview → Approved → Paid)
8. Final release requests enforce closeout checklist completion
9. Partial releases are only allowed when `AllowRetainageReleaseBeforeFinal` is enabled
10. Release cannot exceed current retention balance
11. GL journal entries are created automatically on release approval
12. All approvals and rejections are logged with timestamp, user, and reason

### Lien Waivers
13. All four waiver types (conditional/unconditional × progress/final) are supported
14. Inbound (from subs) and outbound (to owners) waivers are tracked separately
15. Waiver state machine enforces valid transitions (Pending → Sent → Received → Approved)
16. Waivers are linked to their parent pay app and contract
17. Billing package API returns all waivers needed for owner billing
18. Overdue waivers are flagged with days outstanding

### Compliance Gating
19. Payment cannot transition Approved → Paid without all required compliance gates satisfied
20. Insurance certificate expiry is checked against the payment date
21. Conditional waiver for the current period must be approved before payment
22. Compliance gate override requires authorized role and mandatory reason
23. Override audit report shows all overrides with full context
24. Compliance gate settings are configurable per tenant

### State Templates
25. California, Texas, and Florida statutory forms generate with legally required language
26. Statutory template text cannot be modified by tenants
27. Merge fields populate correctly from pay app and contract data
28. Templates auto-select based on project state (from project address)
29. Custom templates can be created for non-statutory states
30. Template versioning preserves all historical versions

### AI & Predictive
31. Waivers auto-generate when a pay app is approved (configurable)
32. Missing waiver scan runs daily and produces actionable exception report
33. Retention release readiness report identifies projects eligible for release
34. Cash flow forecast shows rolling 12-month retention impact
35. Vendor compliance scores update weekly based on waiver return history

---

## Appendix A: Existing Code References

| File | Relevant Fields/Methods |
|------|------------------------|
| `src/Modules/Pitbull.Contracts/Domain/Subcontract.cs` | `RetainagePercent`, `RetainageHeld` |
| `src/Modules/Pitbull.Contracts/Domain/PaymentApplication.cs` | `RetainagePercent`, `RetainageThisPeriod`, `RetainagePrevious`, `TotalRetainage`, `TotalEarnedLessRetainage` |
| `src/Modules/Pitbull.Contracts/Domain/PaymentApplicationLineItem.cs` | `RetainagePercent`, `RetainageAmount` |
| `src/Modules/Pitbull.Contracts/Domain/ScheduleOfValues.cs` | `RetainagePercent` |
| `src/Modules/Pitbull.Contracts/Domain/SOVLineItem.cs` | `Retainage` |
| `src/Modules/Pitbull.Contracts/Domain/PaymentApplicationSettings.cs` | `DefaultRetainagePercent`, `AllowRetainageOverride`, `AllowRetainageReleaseBeforeFinal` |
| `src/Modules/Pitbull.Contracts/Domain/ContractSettings.cs` | `DefaultRetainagePercent` |
| `src/Modules/Pitbull.Projects/Domain/ProjectSettings.cs` | `DefaultRetentionPercent` |
| `src/Modules/Pitbull.Projects/Domain/ProjectBudget.cs` | `RetainageHeld` |
| `src/Modules/Pitbull.Contracts/Domain/AccountingBookType.cs` | `GAAP`, `BonusJobCost` enum |
| `src/Modules/Pitbull.Contracts/Domain/PaymentApplicationBookEntry.cs` | Dual-book entry pattern |

## Appendix B: Related Specifications

| Spec | Relationship |
|------|-------------|
| `docs/plans/AP-AR-FOUNDATION-SPEC.md` | Parent spec — defines `RetentionLedger`, `LienWaiver` stubs that this spec fully specifies |
| `docs/plans/GL-ACCOUNTING-SPEC.md` | GL account mapping, journal entry posting for retention transactions |
| `docs/roles/AP-CLERK.md` | AP-side workflows, lien waiver collection process |
| `docs/roles/AR-CLERK.md` | AR-side workflows, billing package assembly |
| `docs/roles/PROJECT-MANAGER.md` | PM approval role, sub closeout management |
| `docs/roles/CONTROLLER-CFO.md` | Controller approval role, GL account structure |
