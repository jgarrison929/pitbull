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
| 2 | Project setup | Create project → SOV → cost codes → budget → contracts → team | `ProjectStatus.PreConstruction`; nav order Cost Codes → Employees → Projects → Contracts → Time; tenant provisioning on register; checklist auto-sync + canonical order | **PARTIAL** | PM | Day-1 chain improved; project create phases/team persistence and activate workflow still future |
| 3 | Crew time → approval → payroll/export | Draft → Submitted → Approved/Rejected → Payroll run → Export | `TimeEntryService` state machine; `PayrollRunService` approved-only | **PASS** | Payroll | Approval path strong; payroll calc still MVP export |
| 4 | Owner pay app (AR) | Draft → PM review → Submit → Owner cert → Payment due → Paid | `BillingApplicationStatus` full graph + `BillingApplicationStatusTransitions` | **PASS** | AR / CFO | Post-submit transitions + audit added this sprint |
| 5 | Subcontract pay app (AP) | Draft → Submitted → Reviewed → Approved → Paid (+ Reject → Draft) | `PaymentApplicationStatusTransitions` + dedicated POST actions; PUT blocked for status | **PASS** | AP | PUT bypass removed; contracts edit UI no longer skips stages |
| 6 | Change order | Pending → Under Review → Approved/Rejected/Withdrawn → Void | `ChangeOrderStatusTransitions` (Pending→Approved removed) | **PASS** | PM | Subcontract-scoped CO; owner CO model future |
| 7 | RFI | Open → Answered → Closed | `RfiStatusTransitions` + answer required on close | **PASS** | PM | Transition enforcement + `ClosedAt` set |
| 8 | Submittal | Draft → Submitted → InReview → Approved/Revise/Rejected → Closed | `SubmittalService` inline matrix | **PASS** | PM | Backend enforced; UI restricted to `getAllowedSubmittalStatuses` |
| 9 | Vendor invoice → pay | Pending → Matched → Approved → Paid | `VendorInvoiceService.IsValidInvoiceStatusTransition` | **PASS** | AP | Match + Approve + Mark Paid UI actions; GL accrual future |
| 10 | Daily report | Draft → Submitted → Approved → Locked | `DailyReportStatus`; approve Submitted-only; crew JSON synced | **PASS** | PM | Crew `CrewEntries` persisted to `PmDailyReportCrew` |

### Canonical billing model decision

| Domain | Canonical entity | Notes |
|--------|------------------|-------|
| Owner AR billing (G702/G703) | `BillingApplication` | `/billing/applications` |
| Subcontractor AP pay apps | `PaymentApplication` | `/payment-applications` |
| WIP billings-to-date | `BillingApplication.TotalEarnedLessRetainage` | Fixed: was incorrectly using `PaymentApplication` |

---

## Remediation approach (delete non-conforming paths, recreate modern lifecycles)

Per plan criterion 2, failed workflows were not left patched in place — bypass implementations were **removed** and replaced with explicit transition graphs:

| Removed (non-ERP) | Replaced with (modern) |
|-------------------|------------------------|
| Sub pay app PUT status bypass | `PaymentApplicationStatusTransitions` + POST workflow endpoints only |
| AR/AP nav label "Pay Apps" for owner billing | **Owner Billing (AR)** vs **Sub Pay Apps (AP)** |
| Change order `Pending → Approved` skip | `ChangeOrderStatusTransitions` requiring `UnderReview` |
| RFI free-status PUT jumps | `RfiStatusTransitions` + answer required |
| Bid status dropdown allowing any enum | `BidStatusTransitions` + UI `getAllowedBidStatuses` |
| Billing lifecycle ending at submit | Full `BillingApplicationStatusTransitions` + dedicated POST actions |
| WIP sourcing `PaymentApplication` (sub AP) | `BillingApplication.TotalEarnedLessRetainage` (owner AR) |
| Daily report status dropdown bypassing submit | Read-only status + Submit/Approve API actions |
| Submittal delete→Closed fallback | Hard delete or error; status via transition graph only |
| Vendor invoice Match-only UI | Match + Approve + Mark Paid workflow buttons |

---

## Subagent review summaries

Detailed findings: `C:\Users\jgarr\AppData\Local\Temp\grok-goal-d470372385b3\implementer\workflow-reviews\`

| Review file | Role |
|-------------|------|
| `pm-review.md` | Project Manager (RFI, CO, submittal, daily report, bids) |
| `finance-review.md` | Controller / CFO (cross-domain billing model) |
| `payroll-review.md` | Payroll Manager (time approval, export) |
| `ar-review.md` | AR Clerk (owner `BillingApplication` lifecycle) |
| `ap-review.md` | AP Clerk (sub pay apps, vendor invoices) |

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
| Transition graphs | `tests/Pitbull.Tests.Unit/Workflow/WorkflowTransitionGraphTests.cs` (incl. `PaymentApplicationStatusTransitions`) |
| Sub pay app PUT bypass | `tests/Pitbull.Tests.Unit/Modules/Contracts/ContractsServiceTests.cs` |
| Change orders | `tests/Pitbull.Tests.Unit/Modules/Contracts/ContractsServiceTests.cs` |
| Billing workflow | `tests/Pitbull.Tests.Unit/Billing/BillingApplicationServiceTests.cs` |
| WIP source | `tests/Pitbull.Tests.Unit/Services/WipCalculationServiceTests.cs` |
| Workflow audit | `tests/Pitbull.Tests.Unit/Features/Workflow/WorkflowTransitionServiceTests.cs` |

| Suite | Result | Log |
|-------|--------|-----|
| Workflow unit (`WorkflowTransitionGraphTests` + related) | 17 passed | `workflow-tests.log` |
| Full integration | **264 passed**, 0 failed, 1 skipped | `integration-tests-full.log` |
| Full unit | **3147 passed**, 2 failed (pre-existing: `SecretVaultServiceTests`, `AuthControllerTests`), 2 skipped | `unit-tests-full.log` |
| Bids + change orders integration | 21 passed | `integration-workflow-verify.log` |

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
| `procurement/invoices` | **PASS** | Match / Approve / Mark Paid gated by `getNextVendorInvoiceStatuses` |

Subagent frontend review (2026-06-25): all eight PM/finance workflow pages now match backend allowed transitions.

API smoke evidence: `api-workflow-launch.log` — dual-run against live API (`docker compose up -d`, `dotnet run` on port 5081). Validates bid Draft→Submitted→Won (canonical), RFI Open→Answered, and RFI Open→Closed rejection.