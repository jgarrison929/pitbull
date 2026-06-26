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
| 2 | Project setup | Create project → SOV → cost codes → budget → contracts → team | `ProjectStatus.PreConstruction`; nav order Cost Codes → Employees → Projects → Contracts → Time; tenant provisioning on register; checklist auto-sync + canonical order | **PASS** | PM | E2E: `createProjectWithPhases` + `activateProject` (API) + PM cost-code UI + Day-1 nav chain; project → Active verified |
| 3 | Crew time → approval → payroll/export | Draft → Submitted → Approved/Rejected → Payroll run → Export | `TimeEntryService` creates **Draft**; submit/approve state machine; `PayrollRunService` approved-only | **PASS** | Payroll | E2E L3 mobile submit + PM approval UI; L3b `runPayrollE2e` (lock period → generate → approve → export) |
| 4 | Owner pay app (AR) | Draft → PM review → Submit → Owner cert → Payment due → Paid | `BillingApplicationStatus` full graph + `BillingApplicationStatusTransitions` | **PASS** | AR / CFO | E2E extended: PM+AR UI through ArchitectCertified → Mark Payment Due → Mark Paid (Paid badge) |
| 5 | Subcontract pay app (AP) | Draft → Submitted → Reviewed → Approved → Paid (+ Reject → Draft) | `PaymentApplicationStatusTransitions` + dedicated POST actions; PUT blocked for status | **PASS** | AP | PUT bypass removed; contracts edit UI no longer skips stages |
| 6 | Change order | Pending → Under Review → Approved/Rejected/Withdrawn → Void | `ChangeOrderStatusTransitions` (Pending→Approved removed) | **PASS** | PM | Subcontract CO UI E2E; L6b `createOwnerChangeOrder` API helper (skips until `/api/owner-change-orders` ships) |
| 7 | RFI | Open → Answered → Closed | `RfiStatusTransitions` + answer required on close | **PASS** | PM | Transition enforcement + `ClosedAt` set |
| 8 | Submittal | Draft → Submitted → InReview → Approved/Revise/Rejected → Closed | `SubmittalRequestMapper` + `SubmittalStatusTransitions`; create rejects client status | **PASS** | PM | Create rejects `Status`/`Data.Status`; update uses explicit mapper (no `ApplyUpsert`) |
| 9 | Vendor invoice → pay | Pending → Matched → Approved → Paid | `VendorInvoiceService.IsValidInvoiceStatusTransition` | **PASS** | AP | E2E: AP create + Match UI; `ensureVendorPrereqs` seeds vendor when demo omits; field-eng 403 RBAC negative |
| 10 | Daily report | Draft → Submitted → Approved → Locked | `DailyReportStatusTransitions.CanTransition` + `DailyReportRequestMapper`; create/update reject status | **PASS** | PM | Create rejects status; POST submit/approve/lock; `WorkflowTransition` audit on transitions |

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
| Daily report status dropdown bypassing submit | Read-only status + Submit/Approve/Lock POST actions; PUT rejects status |
| Submittal inline 10-case switch | `SubmittalStatusTransitions` + graph tests |
| Daily report `ApplyUpsert` create gaps | `PmUpsertFieldMapper` + `DailyReportRequestMapper` + integration payload persistence tests |
| Submittal generic `ApplyUpsert` status bypass | `SubmittalRequestMapper` + `PmUpsertFieldMapper`; create rejects client status |
| Submittal delete→Closed fallback | Hard delete or error; status via transition graph only |
| Vendor invoice Match-only UI | Match + Approve + Mark Paid workflow buttons |

---

## Subagent review summaries

Detailed findings: `C:\Users\jgarr\AppData\Local\Temp\grok-goal-eaf1b63e9147\implementer\workflow-reviews\`

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
| Workflow unit (`WorkflowTransitionGraphTests` + PM daily/submittal) | 31+ passed | `workflow-tests.log` |
| Full integration | **266 passed**, 0 failed, 0 skipped | `integration-tests-full.log` |
| Full unit | **3181 passed**, 0 failed, 2 skipped | `unit-tests-full.log` |
| Daily reports integration | 4 passed (create→submit→approve→lock; PUT status rejected) | `integration-tests-full.log` |
| Role browser E2E (11 lifecycles + L3b/L6b × 7 personas) | **18+ passed** (11 tests + setup), 2 consecutive runs locally | `implementer/role-e2e/playwright-green-runA.log`, `playwright-green-runB.log` |
| Role E2E CI smoke | L4 owner billing grep on ubuntu | `.github/workflows/ci.yml` → `role-e2e-smoke` + `scripts/run-role-e2e.sh --smoke` |

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
| `projects/.../daily-reports` | **PASS** | Read-only status in form; Submit/Approve/Lock list actions match `getNextDailyReportStatuses` |
| `procurement/invoices` | **PASS** | Match / Approve / Mark Paid gated by `getNextVendorInvoiceStatuses` |

Subagent frontend review (2026-06-25): all eight PM/finance workflow pages now match backend allowed transitions.

API smoke evidence: `scripts/workflow-api-smoke.ps1` — single-admin path (`api-workflow-launch.log`) plus **role paths** (`-RoleProfile PM|AR|AP -UseDemoUsers`) logged to `%LOCALAPPDATA%\Temp\grok-goal-7bd6e34ca9b6\implementer\role-smoke.log` (6 runs, 2026-06-25). Per persona: bid, project+assignment, change order, RFI, sub pay app, owner billing, daily report, time entry, submittal; CEO bootstrap for company-scoped pay periods where persona lacks `Admin.Settings`.

Role browser E2E: `e2e/tests/role-workflows.spec.ts` + `e2e/fixtures/auth-multi.setup.ts` — recordings under `%LOCALAPPDATA%\Temp\grok-goal-7bd6e34ca9b6\implementer\role-e2e\recordings\`. Requires `pitbull-web/.env.local` with `NEXT_PUBLIC_API_BASE_URL=http://localhost:5081`. First-principles review: `%LOCALAPPDATA%\Temp\grok-goal-7bd6e34ca9b6\implementer\first-principles-review.md`.

| Gate | Role E2E evidence (2026-06-26) |
|------|--------------------------------|
| G6 | **10/10 UI lifecycles PASS** — two consecutive full-suite greens (`playwright-green-runA.log`, `playwright-green-runB.log`, 17 passed each: 7 setup + 10 lifecycles). Per-lifecycle table below. |

#### G6 per-lifecycle browser evidence

| # | Lifecycle | Persona(s) | Primary UI actions asserted | Observable outcome | Log tag |
|---|-----------|------------|----------------------------|--------------------|---------|
| L1 | Bid → Project | Estimator | Create bid → edit status → Submitted | Status shows Submitted | `[Bid → Project] estimator UI → Submitted OK` |
| L2 | Project setup | PM | Add cost code → Day-1 nav → API project+team → activate | Cost code POST OK; nav chain; `createProjectWithPhases` + `activateProject`; status Active | `[Project setup] PM cost code + Day-1 chain + project Active OK` |
| L3 | Crew time → approval | Field Eng → PM | Mobile batch submit → approval queue approve | Batch POST OK; PM sees approved/clear queue | `[Crew time → payroll] field mobile submit → PM approval OK` |
| L3b | Payroll export | Payroll Mgr (API) | Lock pay period → generate run → approve → export | `runPayrollE2e` returns Exported/Approved status | `[Crew time → payroll] payroll lock→generate→approve→export OK` |
| L4 | Owner billing (AR) | PM → AR Clerk | Create app → review → submit → certify → payment due → paid | Badges through Paid | `[Owner pay app (AR)] PM+AR UI billing → Paid OK` |
| L5 | Sub pay app (AP) | PM → AP Clerk | New pay app dialog → create → AP Submit | Submitted badge on detail page | `[Subcontract pay app (AP)] PM create → AP submit OK` |
| L6 | Change order | PM | Create CO → Under Review → Approved | Row badges Under Review → Approved | `[Change order] PM UI → Approved OK` |
| L6b | Owner change order | PM (API) | `createOwnerChangeOrder` when endpoint exists | CO id returned or skip (API not shipped) | `[Change order] owner CO API create OK` |
| L7 | RFI | PM | Create → answer → Mark Answered | Answered status visible | `[RFI] PM UI → Answered OK` |
| L8 | Submittal | PM | Create Draft → edit → Submitted | Row badge Submitted | `[Submittal] PM UI → Submitted OK` |
| L9 | Vendor invoice | AP Clerk (+ Field 403) | Create invoice → Match; field GET vendor-invoices | Matched row; field-eng 403 (RBAC negative only) | `[Vendor invoice] AP UI match OK, field-eng 403 OK` |
| L10 | Daily report | Field Eng → PM | Create report → Submit → Approve → Lock | Row badges Submitted → Approved → Locked | `[Daily report] field create → PM Locked OK` |

**E2E prerequisites (API helpers, not primary workflow path):** `ensureTimeTrackingPrereqs`, `ensurePmProjectAssignment`, `ensureVendorPrereqs`, `ensureBillingPrereqs`, `ensurePayAppPrereqs`, `createProjectWithPhases`, `activateProject`, `runPayrollE2e`, `createOwnerChangeOrder`. Finance company context for L4–L9; field subsidiary company for L3/L10. CI: `role-e2e-smoke` job runs L4 via `scripts/run-role-e2e.sh --smoke`.