# Pitbull Product Review (Codex)

Date: 2026-02-19
Scope reviewed: `docs/ARCHITECTURE.md`, `docs/FUNCTIONAL-REVIEW.md`, `docs/plans/USER-JOURNEY-DAY1-TO-MONTH1.md`, `docs/plans/CUSTOMER-ONBOARDING-FLOW.md`, all docs in `docs/roles/`, API surface in `src/Pitbull.Api/Controllers/`, dashboard pages in `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/`.

## Executive Take
Pitbull has strong execution on project-centric operations (projects, time entry, RFIs, subcontracts, payment apps, PM artifacts) and better modern UX/AI potential than legacy incumbents. However, for a mid-size GC CFO/Controller, it is still not finance-complete enough to become the daily system of record. The main blocker is not UX polish; it is missing AP/AR/GL/WIP depth and compliance-heavy accounting workflows.

If you ship the right financial backbone plus one killer migration/switch feature, this can become a serious Vista/Sage replacement. Without that backbone, it remains a strong PM + field operations platform with partial ERP coverage.

---

## A) Gap Analysis (What Makes a Real GC Say No / Yes)

### What makes a CFO say no today
1. AP/AR/GL are not first-class modules in running code.
`src/Modules/Pitbull.Billing/` and `src/Modules/Pitbull.Portal/` are effectively placeholders (only `.csproj` + build artifacts), while roles docs assume mature AP/AR workflows.

2. No auditable financial close stack.
Current reports are labor/project/equipment/weekly (`src/Pitbull.Api/Controllers/ReportsController.cs`), but no native WIP schedule, AR aging, AP aging, trial balance, bank rec, or close checklist.

3. Retention/lien/compliance workflows are partial.
Contracts store high-level retention and insurance flags, but there is no end-to-end lien waiver chain, statutory state-form handling, or retention-release workflow gates.

4. Payroll compliance depth is insufficient for union/prevailing-wage heavy contractors.
You have strong time capture, but not the full payroll engine, union fringe remittance, certified payroll lifecycle, multi-state tax/deposit system, and garnishment hierarchy expected by larger GCs.

5. Dual-book vision exists conceptually but not as a generalized ledger architecture.
`PaymentApplicationBookEntry` is a good start, but dual-book needs to span all transaction sources and tie to a full GL + subledgers.

6. Current data model underrepresents vendor/customer/commercial relationships.
Subcontractor and client fields are often denormalized strings instead of durable master records with compliance and payment profiles.

### What makes a CFO say yes
1. Modern stack + multi-tenant RLS architecture is credible for scale/security.
2. PM/time-entry workflows are significantly cleaner than Vista-era UX.
3. Contracts + SOV + payment-app lifecycle already exist and can be extended.
4. Audit-first orientation (audit logs, settings entities, workflow states) is good foundation.
5. AI-native positioning is differentiated if tied to reliable accounting controls.

Bottom line: this can win if Pitbull becomes “financially trustworthy” and “migration-safe,” not just “AI + modern UI.”

---

## B) Data Model Gaps (Critical Missing Construction Entities)

### Missing or under-modeled entities
1. Vendor master + vendor compliance model
Needed: `Vendor`, `VendorContact`, `VendorInsurancePolicy`, `VendorW9`, `VendorTaxProfile`, `VendorPaymentMethod`, `VendorHold`.

2. Purchase order system
Needed: `PurchaseOrder`, `PurchaseOrderLine`, `POReceipt`, `POInvoiceMatch`, variance handling entities.

3. AP subledger
Needed: `APInvoice`, `APInvoiceLine`, `APApproval`, `APPaymentRun`, `APPayment`, `APPaymentApplication`, discount/credit/debit memo entities.

4. AR subledger
Needed: `Customer`, `CustomerContractTerms`, `ARInvoice/OwnerPayApp`, `CashReceipt`, `CashApplication`, `CollectionsActivity`.

5. General ledger and period control
Needed: `GLAccount`, `JournalEntry`, `JournalEntryLine`, `AccountingPeriod`, `PeriodCloseTask`, `SourceDocumentLink`.

6. WIP and revenue recognition model
Needed: `WipSnapshot`, `WipLine`, `RevenueRecognitionMethod`, `OverUnderBillingAdjustment`.

7. Retention schedules (AR and AP)
Needed: explicit AR/AP retention ledgers with scheduled release triggers and closeout prerequisites.

8. Lien waiver chain
Needed: `LienWaiverRequest`, `LienWaiverDocument`, `LienWaiverStatus`, jurisdiction/state-form metadata.

9. Insurance/cert compliance normalization
You have `ComplianceDocument`, but need policy-type structured fields, additional-insured checks, and payment gating rules bound to vendors/subs.

10. Payroll compliance extensions
Needed: `PayrollBatch`, `PayrollEarning`, `PayrollDeduction`, `PayrollTax`, `CertifiedPayrollRun`, `UnionFringeRemittance`, `TaxDeposit`.

11. Equipment finance/depreciation
Current equipment operations exist, but missing asset accounting entities (`FixedAsset`, `DepreciationSchedule`, `BookDepreciationEntry`).

12. Customer-facing commercial model
Needed: owner billing terms, portal requirements, pay-when-paid rules, and dispute/short-pay tracking.

---

## C) Workflow Gaps (End-to-End Process Breaks)

### What cannot be completed fully in-system yet
1. Procure-to-pay
No complete flow: requisition -> PO -> receipt -> invoice match -> approval -> payment run -> GL posting.

2. Subcontractor compliance-gated payment
Partial today: subcontract + pay app. Missing strict enforcement chain: insurance validity + prior unconditional waiver + required docs -> payable eligibility.

3. Order-to-cash / owner billing
Partial today: project/sov/pay app views. Missing full AR lifecycle with cash application, collections, retention billing at closeout, and disputes.

4. Month-end close
Cannot run true construction close without GL close controls, WIP generation/approval, AR/AP aging reconciliation, and period lock discipline.

5. Certified payroll + union remittance
Time tracking exists; compliance-grade payroll/reporting/remittance lifecycle is not complete.

6. New project to final billing without leaving system
You can get far operationally, but finance/compliance requirements still force external spreadsheets/systems.

---

## D) Predictive UX Opportunities (Concrete 3-5 per Module)

### Core
1. When a new tenant/company is created, auto-generate a role + settings baseline by contractor type and state.
2. When a user repeatedly changes company context, auto-pin preferred company/project and preload those filters.
3. When a module is unused for 30+ days, suggest settings cleanup or deactivation.

### Projects
1. When project type + size are selected, auto-suggest phase/cost-code template and staffing baseline.
2. When estimated completion slips beyond threshold, auto-create schedule-risk task bundle.
3. When budget variance crosses configured trigger, auto-open forecast review workflow.

### Bids
1. When subcontractor quotes deviate from historical unit cost by >X%, auto-flag outliers.
2. When bid due date is near and quote coverage is low, auto-trigger reminder campaign.
3. When bid-to-project conversion occurs, auto-map winning line items into initial budget/SOV draft.

### RFIs
1. When a new RFI resembles existing resolved RFIs, auto-suggest prior answer pack and likely responsible party.
2. When an RFI stays open past SLA, auto-escalate and draft follow-up correspondence.
3. When cost-impact text implies change order, auto-draft CO stub with linked provenance.

### TimeTracking
1. When crews repeat similar daily allocations, auto-suggest prior day/week template.
2. When submitted hours conflict with assignment/schedule patterns, auto-flag before approval.
3. When overtime thresholds are likely to be exceeded midweek, warn PM/payroll proactively.
4. When approval backlog builds, auto-prioritize queue by payroll deadline risk.

### Employees
1. When hire packet is incomplete, show one-click “payroll-ready gap” checklist by blocker severity.
2. When certifications near expiration, auto-schedule reminders and project reassignment suggestions.
3. When employee is assigned to prevailing-wage/union job, auto-suggest missing compliance records.

### Reports
1. When a user repeatedly exports same filters, auto-save and schedule distribution.
2. When margin trend worsens materially, auto-generate “top 5 drivers” explanation.
3. When report anomalies are detected (hours spike, cost drop), auto-link to source transactions.

### Contracts
1. When subcontract value and retainage terms are set, auto-generate payment cadence forecast.
2. When pay app submitted with missing prerequisites (signed contract/lien/insurance), block and explain exact gap.
3. When COs are approved, auto-update revised subcontract value and downstream forecast impacts.

### Companies
1. When company settings conflict (e.g., weekly pay but mismatched work week), auto-suggest correction.
2. When one company diverges materially from peer settings, offer standardization actions.
3. When company onboarding stalls, auto-surface “next best action” to admins.

### ProjectManagement
1. When meetings produce action items with due dates, auto-create linked tasks and reminders.
2. When daily reports mention delays/weather disruptions, auto-suggest schedule impact update.
3. When submittal status stalls, auto-notify assignees and draft status email.
4. When document revisions are uploaded, auto-distribute to impacted stakeholders.

### AI
1. When user opens AI chat inside entity context, auto-inject structured context (project, date range, status).
2. When AI recommendations would mutate data, auto-generate preview diff + approval checklist.
3. When model confidence is low, auto-route to human review instead of hard execution.

### SystemAdmin
1. When permission changes increase risk (broad admin grants), auto-request secondary approval.
2. When API key usage spikes abnormally, auto-recommend scope reduction/rotation.
3. When error rates rise by module, auto-prioritize incident queue with blast radius estimate.

### Notifications
1. When a user consistently ignores a notification type, suggest digest/priority tuning.
2. When approvals approach cutoff deadlines, escalate channel from in-app -> email -> SMS/webhook.
3. When workflow blockers persist, auto-bundle related alerts into one “action packet.”

---

## E) AI Agent Architecture (First-Class Users)

### 1) Identity model
Create `AgentPrincipal` as a first-class subject type parallel to human users.
- `AgentId` (GUID)
- `TenantId`, optional `CompanyScope`
- `AgentType` (system, tenant-installed, module-specialist)
- `OwningUserId` (sponsor) and `SupervisingRole`
- `CredentialType` (keypair/service-token/OIDC workload identity)
- `Status` (active, suspended, revoked)

### 2) Permission model
Use capability-scoped RBAC + guardrails.
- Agent gets roles like users, but with additional machine constraints:
  - allowed modules/resources
  - max transaction amount
  - allowed operating windows
  - required approval policies by action class
- Support explicit deny rules and company-level fences.

### 3) Supervision chain
Every mutating action is policy-evaluated:
- `AutoApprove` for low-risk deterministic actions
- `HumanApprove` for medium/high-risk
- `DualApprove` for financial high-impact actions
Store policy decision and approver links in immutable audit records.

### 4) Audit trail technical pattern
For every agent mutation, persist:
- `ActorType = Agent`
- `ActorId = AgentId`
- `ImpersonatedSubject` (if acting on behalf of user)
- `Action`, `TargetEntity`, `Before/After` snapshot hash
- `Prompt/ToolCall/ModelVersion` metadata (or secure pointer)
- `CorrelationId`, `PolicyDecisionId`, `ApprovalChainId`
- `ConfidenceScore` and `ReasonCode`

This enables statements like:
“Agent Major Tom (AgentId X), policy Y, approved by User Z, created `TimeEntry` for Employee A at timestamp T from source context C.”

### 5) Operational controls
- Kill switch per agent and per tenant
- Rate limits + spend limits
- Deterministic replay for critical agent actions
- Signed action envelopes for non-repudiation

---

## F) Competitive Positioning (Vista / Procore / Sage / FOUNDATION)

### Where Pitbull already wins
1. UX velocity and usability versus Vista/Sage legacy flows.
2. Unified operational experience (projects + field + PM artifacts + time) with modern web stack.
3. AI-native architecture and potential for proactive automation.
4. Faster extensibility in a modular monolith than many incumbent suites.

### Where Pitbull is weakest
1. Financial depth (AP/AR/GL/WIP/tax/payroll compliance) relative to Vista/Sage/FOUNDATION.
2. Portal and ecosystem maturity (owner/sub/vendor integrations, established workflows).
3. Proven migration tooling and implementation playbooks for high-friction replacements.

### One feature that would make a GC switch
“Autonomous month-end close with audit-ready WIP and drill-through.”
If Pitbull can produce trusted WIP/over-under/close outputs with full source traceability and materially reduce close effort, CFOs will sponsor replacement even if some edge features lag.

---

## G) Technical Debt / Architecture Risks at Scale (100 tenants, 1000 concurrent users)

### Key risks
1. Controller/API surface is very broad and unevenly normalized.
Large all-in-one controllers (notably `ProjectManagementControllers.cs`) can become change-risk hotspots and slow team velocity.

2. Module reality mismatch.
Product claims AP/AR breadth via role docs, but implementation lags in critical modules (`Billing`, `Portal`). This creates roadmap credibility risk.

3. Query/performance risk as data grows.
Project/time/report workflows with large paged lists can degrade without aggressive indexing, partitioning strategy, and read-model optimization.

4. Eventing maturity.
CAP integration exists, but long-running compensating workflows and idempotent saga discipline must harden before heavy finance automations.

5. Auth/storage hardening.
JWT and refresh tokens in localStorage/cookie context are workable for now, but enterprise buyers will demand stricter session and secret posture.

6. Domain boundaries not yet finance-grade.
Current modular monolith is fine, but finance domains need stronger invariant boundaries before autonomous agentic actions increase mutation volume.

### When to split the modular monolith
Do not split yet. Split when at least two are true:
1. A domain exceeds team autonomy limits (frequent merge contention + release coupling).
2. Data/throughput profiles diverge (e.g., high-volume time events vs. monthly close heavy finance ops).
3. Independent scaling requirements require isolated stores/SLAs.

Likely first extraction candidates later: payroll calc engine, document processing/AI inference pipeline, external portal edge services.

---

## H) Top 10 Priorities Before Real GC Evaluation (Ordered)

1. Ship AP and AR foundations (vendor/customer masters, AP/AR subledgers, cash application).
2. Ship GL + accounting periods + auditable posting engine.
3. Ship WIP schedule and over/under billing workflow with approval/audit chain.
4. Complete retention + lien waiver state machine with payment gating.
5. Deliver AIA G702/G703 authoritative generation and owner billing package workflows.
6. Deliver payroll compliance core (certified payroll, union fringe, multi-state/tax deposit framework).
7. Build migration accelerator: Vista/Sage import mappings + reconciliation cockpit.
8. Normalize purchase order + invoice match workflow (3-way match + variance approval).
9. Implement AI agent governance layer (identity, policies, supervision, immutable agent audit).
10. Add executive trust dashboard: close readiness, data quality, reconciliation status, and control exceptions.

---

## Final Assessment
Pitbull is currently strongest as a construction operations platform with serious ERP potential, not yet a full financial system of record for a $50M-$500M GC. The path to category leadership is clear: become the first construction ERP that is both AI-native and auditor-trusted.

If the next phase prioritizes finance-complete workflows and migration confidence over feature sprawl, Pitbull can win competitive displacement deals rather than just greenfield pilots.
