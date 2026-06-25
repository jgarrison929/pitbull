# Workflow Evaluation Matrix

> **Rubric:** PASS = canonical ERP stages enforced server-side with audit logging and matching UI actions. FAIL = missing stages, ad-hoc jumps, or dead-end navigation. PARTIAL = core path works; compliance/GL/cash gaps remain.
>
> **Baseline sources:** `docs/archive/roles-2026-02/PROJECT-MANAGER.md`, `CONTROLLER-CFO.md`, `PAYROLL-MANAGER.md`, `AR-CLERK.md`, `AP-CLERK.md`

## Rubric (pass/fail gates)

| Gate | Requirement |
|------|-------------|
| G1 | Status enum includes industry-standard stage names for the lifecycle |
| G2 | Server rejects invalid transitions (`INVALID_STATUS_TRANSITION`) |
| G3 | `WorkflowTransition` audit recorded on each change (where service exists) |
| G4 | API exposes one action per allowed transition (not generic status PUT bypass) |
| G5 | Frontend buttons match `GetAllowed(from)` — no skip-stage dropdown |
| G6 | Day-1→Month-1 dependency chain navigable without dead ends |

---

## Matrix

| # | Lifecycle | Canonical ERP stages (baseline) | Pitbull stages (post-remediation) | Verdict | Reviewer | Remediation status |
|---|-----------|--------------------------------|-------------------------------------|---------|----------|-------------------|
| 1 | Bid → Project | Draft → Submitted → Won/Lost → Converted → Project setup | `BidStatus` + `ConvertToProjectAsync`; `BidStatusTransitions` on update | **PASS** | PM | Enforced bid transitions; conversion still Won-only |
| 2 | Project setup | Create project → SOV → cost codes → budget → contracts → team | `ProjectStatus.PreConstruction`; nav order Cost Codes → Employees → Projects → Contracts → Time | **PARTIAL** | PM | Navigation fixed; full setup orchestration still future work |
| 3 | Crew time → approval → payroll/export | Draft → Submitted → Approved/Rejected → Payroll run → Export | `TimeEntryService` state machine; `PayrollRunService` approved-only | **PASS** | Payroll | Approval path strong; payroll calc still MVP export |
| 4 | Owner pay app (AR) | Draft → PM review → Submit → Owner cert → Payment due → Paid | `BillingApplicationStatus` full graph + `BillingApplicationStatusTransitions` | **PASS** | AR / CFO | Post-submit transitions + audit added this sprint |
| 5 | Subcontract pay app (AP) | Draft → Submitted → Reviewed → Approved → Paid (+ Reject) | `PaymentApplicationService` workflow | **PASS** | AP | Canonical sub billing model (distinct from owner `BillingApplication`) |
| 6 | Change order | Pending → Under Review → Approved/Rejected/Withdrawn → Void | `ChangeOrderStatusTransitions` (Pending→Approved removed) | **PASS** | PM | Subcontract-scoped CO; owner CO model future |
| 7 | RFI | Open → Answered → Closed | `RfiStatusTransitions` + answer required on close | **PASS** | PM | Transition enforcement + `ClosedAt` set |
| 8 | Submittal | Draft → Submitted → InReview → Approved/Revise/Rejected → Closed | `SubmittalService` inline matrix | **PASS** | PM | Backend enforced; UI restricted to `getAllowedSubmittalStatuses` |
| 9 | Vendor invoice → pay | Pending → Matched → Approved → Paid | `VendorInvoiceService.IsValidInvoiceStatusTransition` | **PARTIAL** | AP | Match/pay works; compliance gates & accrual GL future |
| 10 | Daily report | Draft → Submitted → Approved → Locked | `DailyReportStatus`; approve Submitted-only; crew JSON synced | **PASS** | PM | Crew `CrewEntries` persisted to `PmDailyReportCrew` |

### Canonical billing model decision

| Domain | Canonical entity | Notes |
|--------|------------------|-------|
| Owner AR billing (G702/G703) | `BillingApplication` | `/billing/applications` |
| Subcontractor AP pay apps | `PaymentApplication` | `/payment-applications` |
| WIP billings-to-date | `BillingApplication.TotalEarnedLessRetainage` | Fixed: was incorrectly using `PaymentApplication` |

---

## Subagent review summaries

Detailed findings: `{SCRATCH}/workflow-reviews/` (PM, Finance AR/AP, Payroll perspectives).

### PM review — key gaps closed

- Change order Pending→Approved bypass removed
- RFI free-status jumps blocked
- Daily report Draft→Approved bypass removed; crew JSON submit dead-end fixed
- Bid status transitions enforced

### Finance (CFO / AR / AP) — key gaps closed

- Owner billing post-submit lifecycle implemented (ArchitectCertified → PaymentDue → Paid)
- `BillingApplication` added to `WorkflowTransition` audit
- WIP calculation uses owner billing data

### Payroll — assessment

- Time approval: **PASS** (production path via `TimeEntryService`)
- Overtime settings persist server-side via `ReportSettingsController` (**PASS** persistence)
- Overtime not yet consumed by payroll engine (**PARTIAL** — documented non-goal for full tax engine)

---

## Tests

| Area | Test file |
|------|-----------|
| Transition graphs | `tests/Pitbull.Tests.Unit/Workflow/WorkflowTransitionGraphTests.cs` |
| Change orders | `tests/Pitbull.Tests.Unit/Modules/Contracts/ContractsServiceTests.cs` |
| Billing workflow | `tests/Pitbull.Tests.Unit/Billing/BillingApplicationServiceTests.cs` |
| WIP source | `tests/Pitbull.Tests.Unit/Services/WipCalculationServiceTests.cs` |
| Workflow audit | `tests/Pitbull.Tests.Unit/Features/Workflow/WorkflowTransitionServiceTests.cs` |

Evidence output: `C:\Users\jgarr\AppData\Local\Temp\grok-goal-d470372385b3\implementer\workflow-tests.log`

---

## Frontend alignment (G5)

Shared transition helpers: `src/Pitbull.Web/pitbull-web/src/lib/workflow-transitions.ts` (mirrors C# `*StatusTransitions`).

| Page | Verdict | Pattern |
|------|---------|---------|
| `billing/applications/[id]` | **PASS** | Status-gated POST action buttons |
| `payment-applications/[id]` | **PASS** | `ALLOWED_ACTIONS` + dedicated endpoints |
| `contracts/.../change-orders` | **PASS** | Restricted status dropdown via `getAllowedChangeOrderStatuses` |
| `bids` (list + detail + edit) | **PASS** | Allowed-transition select / workflow buttons |
| `rfis/[id]` | **PASS** | View-mode workflow buttons + restricted edit dropdown |
| `projects/.../submittals` | **PASS** | Restricted status on edit; create locks Draft |
| `projects/.../daily-reports` | **PASS** | Read-only status in form; Submit/Approve list actions |

Subagent frontend review (2026-06-25): all seven PM/finance workflow pages now match backend allowed transitions.