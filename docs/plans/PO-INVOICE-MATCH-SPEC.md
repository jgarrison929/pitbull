# Purchase Order and Invoice Matching Module — Design Spec

**Author:** Codex (for Pitbull team)  
**Date:** 2026-02-19  
**Status:** Ready for implementation planning  
**Priority:** Product review #8 (table-stakes construction AP control)  
**Target Modules:** `Pitbull.Billing` (AP), `Pitbull.Projects`, `Pitbull.Contracts`, `Pitbull.Documents`, `Pitbull.AI`, `Pitbull.Accounting`, `Pitbull.Reports`  
**Domain References:** `docs/plans/AP-AR-FOUNDATION-SPEC.md`, `docs/roles/AP-CLERK.md`

---

## 0) Purpose
Design a construction-grade procure-to-pay control plane where AP can reliably process high invoice volume with low fraud/error risk.

Primary outcome: enforce **3-way match** (`PurchaseOrder -> POReceipt -> ApInvoice`) while preserving operational speed with AI-assisted capture/matching and controlled variance workflows.

This is a design spec, not code.

---

## 1) Strategic Context

### 1.1 Why this matters
1. 3-way match is mandatory for AP maturity and cash control.
2. Construction job cost quality depends on accurate PO/invoice coding (project/phase/cost code).
3. Committed-cost visibility must exist before invoices arrive.
4. AP needs receipt-based controls for partial deliveries and backorders.

### 1.2 Design principles
1. **PO-first commitment:** approved PO lines create committed cost immediately.
2. **Receipt-aware liability:** physical/service receipt drives invoice eligibility.
3. **Policy-driven variance handling:** tolerance and escalation are configurable by company/vendor/category.
4. **Traceable financial path:** every invoice line must trace to PO line, receipt evidence, and posting output.
5. **AI assists, humans authorize:** AI can extract and propose matches; humans approve exceptions and payment release.

### 1.3 Module settings pattern
Introduce `PoInvoiceMatchSettings` (company-scoped):
- `EnableThreeWayMatch` (default true)
- `AutoApproveWithinTolerance` (default true)
- `QtyTolerancePctDefault` (default 2.0)
- `PriceTolerancePctDefault` (default 1.0)
- `AmountToleranceDefault` (default 50.00)
- `RequireReceiptForMaterialInvoices` (default true)
- `RequirePmApprovalForOverTolerance` (default true)
- `DuplicateInvoiceHardStopMode` (default `ExactVendorInvoiceNumber`)

---

## 2) Purchase Order Model

### 2.1 Objectives
1. Capture vendor/project intent before spend.
2. Encode cost coding and delivery expectations on line items.
3. Support approval workflow and downstream receipt/invoice matching.

### 2.2 Entities
All entities inherit `BaseEntity`; company-scoped entities implement `ICompanyScoped`.

### `PurchaseOrder` (company-scoped)
- `CompanyId`, `ProjectId`, `VendorId`
- `PONumber` (unique per company)
- `PoType` (`Standard`, `Subcontract`, `Service`, `TandM`)
- `Status` (`Draft`, `PendingApproval`, `Approved`, `PartiallyReceived`, `Closed`, `Voided`)
- `OrderDate`, `RequiredDate`, `ExpectedDeliveryDate?`
- `PaymentTerms`, `CurrencyCode`
- `Subtotal`, `TaxAmount`, `TotalAmount`
- `CommittedCostAmount`, `ReceivedCostAmount`, `InvoicedAmount`
- `ApprovalWorkflowId?`, `ApprovedByUserId?`, `ApprovedAt?`

### `PurchaseOrderLine` (company-scoped)
- `PurchaseOrderId`, `LineNumber`
- `LineType` (`Material`, `LaborService`, `EquipmentRental`, `SubcontractWork`)
- `Description`
- `ProjectId`, `CostCodeId`, `PhaseId?`
- `Uom`, `OrderedQty`, `UnitPrice`, `LineAmount`
- `NeedByDate?`, `ExpectedDeliveryDate?`
- `ReceivedQty`, `InvoicedQty`, `OpenQty`
- `CommittedCostAmount`, `InvoicedCostAmount`
- `TaxCode?`

### `PurchaseOrderApprovalStep` (company-scoped)
- `PurchaseOrderId`, `StepOrder`
- `ApproverRole`, `ApproverUserId?`
- `Status` (`Pending`, `Approved`, `Rejected`)
- `DecisionAt?`, `DecisionComment?`

### 2.3 Rules
1. PO cannot move to `Approved` without at least one line and valid vendor/project.
2. PO line requires cost coding (`CostCodeId`) for job-cost integration.
3. PO approval writes committed-cost records (see section 6).
4. Void requires reason; partially received/invoiced PO cannot be hard-deleted.

### 2.4 APIs
- `POST /api/purchase-orders`
- `GET /api/purchase-orders`
- `GET /api/purchase-orders/{id}`
- `PUT /api/purchase-orders/{id}`
- `POST /api/purchase-orders/{id}/submit-approval`
- `POST /api/purchase-orders/{id}/approve`
- `POST /api/purchase-orders/{id}/reject`
- `POST /api/purchase-orders/{id}/close`
- `POST /api/purchase-orders/{id}/void`

---

## 3) Receipt and Delivery Confirmation

### 3.1 Objectives
1. Confirm delivery/work completion before invoice payment.
2. Capture partial receipts and backorders by line.
3. Provide auditable evidence (photos, packing slips, signed tickets).

### 3.2 Entities
### `POReceipt` (company-scoped)
- `CompanyId`, `PurchaseOrderId`
- `ReceiptNumber`, `ReceiptDate`
- `ReceivedByUserId`
- `DeliveryDocumentNumber?`
- `DeliveryLocation?`
- `Status` (`Draft`, `Confirmed`, `Voided`)
- `Notes?`

### `POReceiptLine` (company-scoped)
- `POReceiptId`, `PurchaseOrderLineId`
- `ReceivedQty`
- `AcceptedQty`, `RejectedQty`, `BackorderedQty`
- `ConditionStatus` (`Accepted`, `Damaged`, `Short`, `Over`)
- `UnitCostAtReceipt?`

### `POReceiptAttachment` (company-scoped)
- `POReceiptId`, `FileAttachmentId`
- `AttachmentType` (`PackingSlip`, `DeliveryTicket`, `Photo`, `SignedReceipt`)

### 3.3 Rules
1. Receipt line qty cannot exceed remaining open qty unless over-delivery exception is approved.
2. Confirmed receipt updates PO line `ReceivedQty` and PO status.
3. Material invoice matching requires receipt if `RequireReceiptForMaterialInvoices = true`.
4. Voiding receipt after matched invoice requires elevated approval and rematch workflow.

### 3.4 APIs
- `POST /api/purchase-orders/{id}/receipts`
- `GET /api/purchase-orders/{id}/receipts`
- `GET /api/receipts/{receiptId}`
- `POST /api/receipts/{receiptId}/confirm`
- `POST /api/receipts/{receiptId}/void`
- `POST /api/receipts/{receiptId}/attachments`

---

## 4) Invoice Capture (Manual + AI Extraction)

### 4.1 Objectives
1. Support high-volume invoice ingestion from email/upload/scan/manual entry.
2. Auto-extract structured invoice fields from PDF/image.
3. Produce normalized `ApInvoice`/`ApInvoiceLine` drafts for matching.

### 4.2 Entities
### `ApInvoice` (company-scoped)
- `CompanyId`, `VendorId`, `ProjectId?`, `PurchaseOrderId?`
- `InvoiceNumber`, `InvoiceDate`, `DueDate`
- `Status` (`Entered`, `Matched`, `PendingApproval`, `Approved`, `ReadyToPay`, `Paid`, `Voided`, `Disputed`)
- `SourceType` (`Manual`, `Upload`, `EDI`, `Agent`)
- `SourceDocumentId?`
- `Subtotal`, `TaxAmount`, `TotalAmount`, `BalanceAmount`
- `DuplicateCheckStatus` (`Clear`, `SoftWarning`, `HardStop`)

### `ApInvoiceLine` (company-scoped)
- `ApInvoiceId`, `LineNumber`
- `Description`
- `Qty`, `UnitPrice`, `LineAmount`
- `ProjectId?`, `CostCodeId?`, `PhaseId?`, `GlAccountCode?`
- `MatchedPoLineId?`, `MatchedReceiptLineId?`
- `MatchStatus` (`Unmatched`, `Matched`, `WithinTolerance`, `Exception`)

### `InvoiceExtractionResult` (company-scoped)
- `ApInvoiceId?`, `FileAttachmentId`
- `Model`, `Provider`, `Confidence`
- `ExtractedHeaderJson`, `ExtractedLinesJson`
- `NeedsHumanReview` (default true)

### 4.3 Capture workflow
1. File arrives (`PDF/image`) or clerk enters manual invoice.
2. AI extraction service parses header + lines + PO reference candidates.
3. System proposes vendor match and possible PO matches.
4. AP clerk confirms/edits extracted fields.
5. Invoice draft saved; duplicate detection executes before approval.

### 4.4 Duplicate detection rules
1. Hard stop: same `VendorId + InvoiceNumber` exists and not voided.
2. Soft warning: same `VendorId + TotalAmount` within N days, similar date/description.
3. Similar-document warning: high fingerprint similarity against prior invoices.

### 4.5 APIs
- `POST /api/ap/invoices`
- `POST /api/ap/invoices/upload`
- `POST /api/ap/invoices/{id}/extract`
- `GET /api/ap/invoices/{id}`
- `PUT /api/ap/invoices/{id}`
- `POST /api/ap/invoices/{id}/check-duplicate`

---

## 5) 3-Way Match Engine

### 5.1 Objectives
1. Automate PO -> receipt -> invoice line reconciliation.
2. Apply policy-based tolerances for qty/price/amount variance.
3. Produce explainable match results for routing.

### 5.2 Entities
### `ApMatchResult` (company-scoped)
- `ApInvoiceId`
- `MatchStatus` (`FullMatch`, `WithinTolerance`, `Exception`)
- `MatchScore` (0-100)
- `QuantityVariancePct`, `PriceVariancePct`, `AmountVariance`
- `ReasonCodesJson`
- `MatchedBy` (`User`, `Agent`, `System`)
- `AutoMatchedAt?`

### `ApMatchLineResult` (company-scoped)
- `ApMatchResultId`, `ApInvoiceLineId`
- `MatchedPoLineId?`, `MatchedReceiptLineId?`
- `QtyVariance`, `PriceVariance`, `AmountVariance`
- `LineStatus` (`FullMatch`, `WithinTolerance`, `Exception`)
- `ExceptionReasonCode?`

### `ApMatchToleranceRule` (company-scoped)
- `CompanyId`
- `ScopeType` (`Global`, `Vendor`, `CostCategory`, `Project`, `PoType`)
- `ScopeId?`
- `QtyTolerancePct`, `PriceTolerancePct`, `AmountTolerance`
- `AutoApproveWithinTolerance` (bool)

### 5.3 Matching algorithm (line-level)
For each invoice line candidate:
1. Resolve PO line candidates by explicit PO ref, vendor, description similarity, amount proximity.
2. Resolve receipt availability for candidate PO line.
3. Compute:
- `QtyVariancePct = (InvoiceQty - EligibleReceivedQty) / max(EligibleReceivedQty, 1)`
- `PriceVariancePct = (InvoiceUnitPrice - PoUnitPrice) / max(PoUnitPrice, 0.01)`
- `AmountVariance = InvoiceLineAmount - ExpectedAmount`
4. Compare against effective tolerance rule.
5. Assign `FullMatch`, `WithinTolerance`, or `Exception`.

### 5.4 Engine rules
1. Full pass requires PO line exists and receipt quantity is sufficient (for receipt-required lines).
2. Within-tolerance pass can auto-approve by policy.
3. Over-tolerance or ambiguous line match always routes to variance approval.
4. Invoice status transitions:
- `Entered -> Matched` (full/within tolerance)
- `Entered -> PendingApproval` (exception/no PO)

### 5.5 APIs
- `POST /api/ap/invoices/{id}/match`
- `GET /api/ap/invoices/{id}/match-result`
- `POST /api/ap/invoices/{id}/rematch`
- `PUT /api/ap/match-tolerance-rules/{id}`

---

## 6) Variance Approval Workflow

### 6.1 Objectives
1. Auto-process low-risk variance.
2. Escalate material variance with explicit reasons and approver accountability.
3. Prevent silent leakage into project budget/GL.

### 6.2 Entities
### `ApVarianceException` (company-scoped)
- `ApInvoiceId`, `ApInvoiceLineId?`
- `VarianceType` (`QtyOver`, `PriceOver`, `AmountOver`, `NoReceipt`, `NoPO`, `DuplicateRisk`, `CodingMismatch`)
- `ThresholdValue`, `ActualValue`, `VarianceValue`
- `Severity` (`Low`, `Medium`, `High`, `Critical`)
- `Status` (`Open`, `UnderReview`, `Approved`, `Rejected`, `Waived`)
- `AssignedRole`, `AssignedUserId?`

### `ApVarianceApprovalStep` (company-scoped)
- `ApVarianceExceptionId`, `StepOrder`
- `ApproverRole`, `ApproverUserId?`
- `Status` (`Pending`, `Approved`, `Rejected`)
- `DecisionAt?`, `DecisionComment?`, `OverrideReasonCode?`

### 6.3 Routing rules
1. Within tolerance + policy enabled -> auto-approve invoice.
2. Over threshold price/qty variance -> PM approval required.
3. Critical variance (over hard cap, compliance issues, duplicate hard-stop) -> PM + Controller.
4. Rejected variance returns invoice to AP for correction/dispute.

### 6.4 APIs
- `GET /api/ap/variances?status=`
- `GET /api/ap/variances/{id}`
- `POST /api/ap/variances/{id}/approve`
- `POST /api/ap/variances/{id}/reject`
- `POST /api/ap/variances/{id}/waive`

---

## 7) Committed Cost Tracking

### 7.1 Objectives
1. Recognize budget commitment at PO approval, before invoice posting.
2. Track commitment burn (`Committed -> Received -> Invoiced`).
3. Provide project-level committed cost visibility with change over time.

### 7.2 Entities
### `ProjectCommittedCost` (company-scoped)
- `CompanyId`, `ProjectId`
- `SourceType` (`PurchaseOrder`, `Subcontract`, `ChangeOrder`)
- `SourceId`, `SourceLineId?`
- `CostCodeId`, `PhaseId?`
- `OriginalCommittedAmount`, `CurrentCommittedAmount`
- `ReceivedAmount`, `InvoicedAmount`, `RemainingCommittedAmount`
- `Status` (`Open`, `PartiallyInvoiced`, `FullyInvoiced`, `Closed`)

### 7.3 Rules
1. PO approval creates committed-cost entries per PO line.
2. PO revisions update commitment delta with audit trail.
3. Invoice posting increments `InvoicedAmount`; never bypasses commitment linkage for PO-based invoice.
4. Commitment release when PO closed/voided with remaining balance reconciliation.

### 7.4 APIs
- `GET /api/projects/{projectId}/committed-costs`
- `GET /api/projects/{projectId}/committed-cost-summary`
- `GET /api/projects/{projectId}/committed-cost-trend`

---

## 8) Subcontractor PO Patterns

### 8.1 Objectives
Support common subcontract procurement patterns:
1. Lump Sum
2. Unit Price
3. Time & Materials (T&M)

### 8.2 Pattern behavior

#### A) Lump Sum
- PO line qty fixed at `1` with contract value.
- Progress/invoice draws reduce remaining commitment.
- Variance mostly controlled at amount level.

#### B) Unit Price
- Qty * unit price with staged receipts.
- Core controls: received qty vs invoice qty and unit price adherence.

#### C) T&M
- Receipt evidence may include signed tickets/time sheets.
- Invoice lines can be labor/material/equipment with rate cards.
- Match engine validates against approved T&M rate schedule and receipt artifacts.

### 8.3 Entities
### `SubcontractPoPattern` (company-scoped)
- `PurchaseOrderId`
- `PatternType` (`LumpSum`, `UnitPrice`, `TandM`)
- `RateScheduleJson?`
- `ControlRulesJson`

### 8.4 Rules
1. Pattern type determines required receipt evidence and variance checks.
2. T&M requires approved rate schedule before posting.
3. Lump sum overbill requires explicit PM/Controller approval.

---

## 9) Integration with Job Cost and GL

### 9.1 Job cost integration
1. PO approval writes commitment by project/cost code/phase.
2. Receipt updates received-cost metrics for field progress visibility.
3. Invoice approval/posting writes actual cost to job cost.

### 9.2 GL integration
1. Invoice posted -> debit expense/COS (or project WIP category), credit AP liability.
2. Payment posted -> debit AP liability, credit cash.
3. Retention/withheld mechanics follow AP/AR foundation retention ledger rules.

### 9.3 Event contract
- `PurchaseOrderApproved`
- `POReceiptConfirmed`
- `ApInvoiceCaptured`
- `ApInvoiceMatched`
- `ApVarianceExceptionRaised`
- `ApInvoiceApproved`
- `ApInvoicePosted`

### 9.4 Reconciliation checks
1. Open PO commitment vs project budget remaining.
2. AP open balance vs subledger.
3. PO line received qty/invoiced qty integrity.

---

## 10) AI Opportunities

### 10.1 Invoice intelligence
1. OCR extraction from PDF/image into header + line DTO.
2. Auto-match invoice to PO and receipt with confidence score.
3. Duplicate invoice detection (exact + fuzzy).
4. Cost code suggestion from description + vendor/project history.

### 10.2 Matching intelligence
1. Smart line-mapping when invoice descriptions differ from PO wording.
2. Explainable exception reasons (short receipt, unit price variance, no open qty).
3. Adaptive confidence tuning per vendor/document quality.

### 10.3 Procurement intelligence
1. Predict delivery dates from vendor historical lead times and seasonality.
2. Predict likely overage risk by PO line before invoice arrives.
3. Recommend pre-approval actions for likely variance hotspots.

### 10.4 Governance
1. AI may create drafts/suggestions, not final payment decisions.
2. High-impact actions (variance waiver, payment release, compliance exceptions) require human approval.
3. AI actions must include audit metadata (`confidence`, `model`, `source`, `reason`).

---

## 11) Predictive Features

### 11.1 Committed-cost warnings
1. Alert when committed cost + approved change orders approaches budget threshold.
2. Warn on PO lines likely to exceed budget based on receipt/invoice trend.
3. Surface project heatmap of open commitments and overrun risk.

### 11.2 Vendor payment pattern analysis
1. Analyze average invoice-to-payment cycle by vendor.
2. Detect missed early-pay discount opportunities.
3. Flag vendors with frequent variance/dispute patterns.

### 11.3 Cash flow impact of open POs
1. Forecast cash requirements from open PO commitments + expected invoice timing.
2. Overlay AP due dates with AR expected collections and payroll obligations.
3. Show scenario views (pay-on-due-date vs optimized-discount strategy).

---

## 12) Security, Controls, and Compliance

1. All endpoints require `[Authorize]` and role-based scopes (`AP_CLERK`, `PM`, `CONTROLLER`, `ADMIN`).
2. Segregation of duties:
- preparer should not approve high-variance exceptions by default.
3. Compliance holds (insurance/W-9/lien waiver where applicable) can block progression to `ReadyToPay`.
4. Period controls enforce posting into valid accounting period.
5. Full audit trail required for extraction edits, match overrides, and approvals.

---

## 13) API Surface (Summary)

### 13.1 Purchase orders and receipts
- `POST /api/purchase-orders`
- `POST /api/purchase-orders/{id}/approve`
- `POST /api/purchase-orders/{id}/receipts`
- `POST /api/receipts/{receiptId}/confirm`

### 13.2 Invoices and matching
- `POST /api/ap/invoices/upload`
- `POST /api/ap/invoices/{id}/extract`
- `POST /api/ap/invoices/{id}/match`
- `GET /api/ap/invoices/{id}/match-result`
- `POST /api/ap/invoices/{id}/submit-approval`
- `POST /api/ap/invoices/{id}/approve`

### 13.3 Variance and commitment analytics
- `GET /api/ap/variances`
- `POST /api/ap/variances/{id}/approve`
- `GET /api/projects/{projectId}/committed-cost-summary`

---

## 14) Implementation Phases

1. **Phase 1: PO + receipt foundation**
- PO/PO line model, approval workflow, receipt capture/confirmation.

2. **Phase 2: Invoice capture + 3-way engine**
- invoice model, match engine, tolerance rules, variance exceptions.

3. **Phase 3: Committed cost + job cost/GL integration**
- commitment ledger, posting events, reconciliation views.

4. **Phase 4: Subcontract patterns + AI automation**
- lump sum/unit price/T&M controls, OCR, auto-match, duplicate detection.

5. **Phase 5: Predictive cash/procurement intelligence**
- commitment warnings, vendor behavior analytics, cash flow forecast from open POs.

---

## 15) Acceptance Criteria

1. AP clerk can process invoice with full 3-way match against PO and receipt.
2. Within-tolerance invoices auto-approve by policy; over-threshold variances route correctly.
3. Approved PO creates committed cost visible on project budget before first invoice.
4. Receipt and invoice updates correctly reduce open commitment quantities/amounts.
5. Subcontract PO patterns (lump sum, unit price, T&M) are supported with proper controls.
6. Invoice posting flows to GL and job cost with traceable source references.
7. AI extraction and match suggestions are available with confidence and exception reasoning.
8. Duplicate invoice hard stop and soft warning rules are enforced.
9. Predictive warnings highlight budget/commitment and cash flow risk from open POs.
10. Audit trail captures all overrides, approvals, and AI-originated suggestions.

---

## 16) Open Decisions

1. Whether `PurchaseOrder` should live fully in `Pitbull.Billing` or share ownership with a dedicated procurement module.
2. Whether service receipts (non-material) require explicit confirmation per vendor/category.
3. How deep v1 should go on tax handling for material/service mixed invoices.
4. Whether to expose external vendor portal APIs for invoice/receipt submission in phase 1 or later.
5. Standard posture for no-PO invoices: blocked by default vs controlled exception path.
