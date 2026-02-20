# Executive Team Product Review — Pitbull Construction Solutions

**Date:** February 19, 2026
**Product:** Pitbull Construction Solutions — AI-First Construction ERP
**Target Market:** Commercial General Contractors ($50M–$500M annual revenue)
**Positioning:** Self-hosted alternative to Procore, Vista, and Sage

---

## Platform Snapshot

| Metric | Value |
|--------|-------|
| Backend LOC | ~55,000 (.NET 9, C#) |
| Frontend LOC | ~83,000 (Next.js 16, TypeScript, React 19) |
| Test LOC | ~46,000 |
| Total Test Methods | 1,932 ([Fact] + [Theory]) |
| Test Files | 177 |
| API Controllers | 57 (unique controller classes) |
| Dashboard Pages | 100+ (Next.js App Router) |
| Modules | 14 domain modules + 3 infrastructure |
| Domain Entities | 37 |
| EF Migrations | 52 |
| Design Specs (written, queued) | 25 |
| Documentation Files | 89 |
| Build Warnings | 0 |
| Known Vulnerabilities | 0 |

**Modules Shipped:** Core, Projects, Bids, RFIs, Submittals, Contracts (with SOV + Change Orders), Payment Applications (G702/G703), TimeTracking (with crew entry, approval, mobile, audit, certified payroll), Employees (onboarding wizard + CSV import), Equipment, Billing (Vendors, Customers, Chart of Accounts, Retention, Lien Waivers), GL (Journal Entries + Accounting Periods), WIP Schedule (cost-to-cost), Procurement (Purchase Orders + Vendor Invoice Matching), ProjectManagement (12 sub-pages: schedule, job cost, submittals, plans & specs, communications, daily reports, progress, projections, meetings, documents, tasks, narratives), Reports, AI (embedded chat, smart fields, document intelligence), Notifications, SystemAdmin, Portal (stub)

**Architecture:** Modular monolith with CQRS pattern, multi-tenant + multi-company PostgreSQL Row-Level Security, CAP event bus (PostgreSQL outbox + Redis Streams), PostHog analytics, Railway auto-deploy

---

## 1. CFO / Controller — Sarah Chen

### What Impressed Me

- **GL Foundation is real, not decorative.** Journal entries have full debit/credit validation with mandatory balance checking. Accounting periods support open/closed/locked state machine — this prevents back-posting, which is the #1 audit finding we see at mid-market GCs. The fact that this shipped on day one of the GL module shows someone understands GAAP.

- **WIP Schedule uses cost-to-cost method correctly.** The calculation engine handles earned revenue = (costs-to-date / estimated-total-cost) × contract-value. This is the standard method for ASC 606 compliance in construction. Having this built-in rather than as a spreadsheet export is a major differentiator — most GCs under $200M do this in Excel.

- **Retention tracking has real financial controls.** The retention module supports policy-based caps (percentage rate + max amount ceiling), partial release workflows with balance validation, and status tracking (Held → PartiallyReleased → Released). This is exactly the data a surety bond underwriter asks for.

- **Payment Applications follow the G702/G703 dual-book model.** The contract-to-SOV-to-pay-app pipeline is structurally correct. Schedule of Values with line-item tracking, continuation sheets — this is how real AIA billing works.

- **Chart of Accounts with proper account types.** Account number + name + type (Asset/Liability/Equity/Revenue/Expense) with sub-types. This maps cleanly to how construction accountants think.

### What Concerns Me

- **No AP/AR aging reports.** We have vendors, customers, and invoices, but I don't see aging buckets (Current/30/60/90+). Every controller I've worked with opens their day with an AR aging report. This is table-stakes for a demo to any GC's back office.

- **No bank reconciliation.** Journal entries exist but there's no pathway to reconcile a GL cash account against a bank statement. For a self-hosted ERP, this is critical — GCs need to close their books without exporting to QuickBooks.

- **WIP-to-GL integration is not wired.** The WIP schedule calculates overbilling/underbilling, but I don't see automatic journal entry creation for WIP adjustments. This means the WIP report and the GL are separate worlds right now. Auditors will ask about this.

- **No multi-currency or tax handling.** For GCs doing work across state lines or with international subs, this matters. At minimum, sales tax on materials is a real workflow.

- **Certified payroll reports exist but WH-347 export format is unclear.** The entities are there (CertifiedPayrollReport, PrevailingWageRate) but I need to see PDF/export generation to confirm Department of Labor compliance.

### Top 3 Priorities (Next 2 Weeks)

1. **AP/AR Aging Dashboard** — Build aging summary (Current/30/60/90/120+) for both vendors and customers. This is the single most-viewed report for any construction accounting team.
2. **WIP-to-GL Auto-Journaling** — When a WIP report is generated, offer a "Post to GL" action that creates the overbilling/underbilling adjusting entries. This closes the loop between project accounting and financial reporting.
3. **Bank Reconciliation MVP** — Even a simple "mark-as-reconciled" workflow on journal entries/transactions would demonstrate that the GL is a real book of record, not just a ledger dump.

---

## 2. VP of Operations — Marcus Rivera

### What Impressed Me

- **Time tracking is production-grade.** The system supports individual entry, crew entry (foreman enters time for entire crew), mobile-optimized views, weekly timesheet grids, supervisor approval workflows, and a full audit trail. This is not a toy — it's what field operations actually needs. The crew-entry grid alone eliminates the paper timecard problem.

- **Project Management has 12 functional sub-modules.** Schedule, job cost, submittals, plans & specs, daily reports, communications, meetings, progress tracking, projections, documents, tasks, and narratives. This covers the full PM toolkit. Most competing platforms launch with 3-4 of these.

- **Equipment tracking is built-in.** Equipment assignments, utilization tracking, and cost allocation per project. This is often an afterthought in construction ERPs but is critical for GCs running their own fleet.

- **Daily reports are first-class citizens.** Not buried in a notes field — they have their own entity, their own page, linked to projects. Field supers can document weather, manpower, activities, and issues. This is exactly what gets referenced during claims and disputes.

- **Employee onboarding wizard is surprisingly polished.** 6-step wizard with personal info, emergency contacts, tax info (including Davis-Bacon and certified payroll flags), company assignment, and compliance documents. CSV import for bulk onboarding. This solves the spring hiring surge problem.

### What Concerns Me

- **No offline/PWA capability for field use.** Construction sites routinely have poor connectivity. Time entry, daily reports, and photo documentation need to work offline and sync when connectivity returns. This is non-negotiable for field adoption.

- **Mobile experience needs a dedicated view, not just responsive.** The responsive Tailwind layouts work, but field workers on a dusty 6-inch screen need big buttons, minimal navigation, and task-focused flows. The current mobile time-tracking page is a good start but daily reports and inspections need the same treatment.

- **No photo/document capture from mobile.** Daily reports without attached photos are incomplete. I need camera integration for progress photos, safety observations, and delivery documentation.

- **No GPS or geofence for time entry.** For prevailing wage jobs, we need to prove workers were on-site. GPS stamp on time entries or geofenced clock-in would be a compliance differentiator.

- **RFI and submittal workflows lack push notifications.** The notification system exists, but I need real-time push (mobile or email) when an RFI is overdue or a submittal needs review. Response time on RFIs directly impacts schedule.

### Top 3 Priorities (Next 2 Weeks)

1. **Mobile Daily Report with Photo Capture** — Add camera/photo upload to daily reports on mobile. This is the single highest-value field workflow after time entry.
2. **Push Notification for RFI/Submittal Deadlines** — Wire email notifications to RFI due dates and submittal review deadlines. Overdue RFIs cost real money.
3. **Offline-Ready Time Entry (PWA)** — Implement service worker caching for the time-entry flow so field workers can enter time without connectivity and sync later.

---

## 3. CTO — Demo Contact C03

### What Impressed Me

- **Architecture is genuinely well-structured.** The modular monolith with CQRS is the right call at this stage — it gives domain isolation without the operational complexity of microservices. Each module (14 of them) has clean boundaries: domain entities in Core, features in vertical slices, services with interface-first design. The auto-DI registration via assembly scanning (`AddPitbullModuleServices<T>()`) is elegant and avoids manual service registration sprawl.

- **Multi-tenancy is enforced at two layers.** Application-level query filters (TenantId + CompanyId + soft-delete on every query) AND PostgreSQL Row-Level Security via `set_config('app.current_tenant', ...)`. This defense-in-depth approach means even a bug in application code can't leak cross-tenant data. The company-level RLS is a bonus — true multi-company isolation within a tenant.

- **Test coverage is exceptional for this stage.** 1,932 test methods across 177 files. In-memory database testing with proper tenant context injection. Both unit tests (controller + service level) and integration test infrastructure (real PostgreSQL). Zero build warnings, zero vulnerabilities. This is production-quality engineering discipline.

- **Event bus architecture is forward-looking.** CAP with PostgreSQL outbox + Redis Streams provides reliable async messaging with at-least-once delivery. The outbox pattern means events survive process crashes. The fallback to in-memory when Redis is unavailable (Railway deployment) shows pragmatic engineering.

- **Rate limiting is comprehensive.** All 57+ controllers have rate limiting applied. 10 distinct rate limiting policies in Program.cs (sliding window, fixed window, concurrency). This is unusual for a pre-revenue product and shows security-first thinking.

### What Concerns Me

- **No Redis in production deployment.** The Railway deployment falls back to in-memory event bus, which means events are lost on restart. For a construction ERP processing financial transactions, this is a reliability gap. Redis needs to be provisioned or an alternative durable queue (PostgreSQL-only pub/sub, or SQS) should be used.

- **Database migration strategy at scale.** 52 migrations and growing. EF Core migrations work fine for single-tenant, but with hundreds of tenants sharing one database with RLS, migration rollback becomes risky. Need a migration testing strategy and potentially a blue-green deployment approach.

- **No caching layer for read-heavy endpoints.** Projects, cost codes, chart of accounts — these are read 100x for every write. There's no Redis caching, no response caching headers, no ETag support. At 50+ concurrent users per tenant, the database will be the bottleneck.

- **AI service is tightly coupled to controller layer.** The AiService handles chat, suggestions, and document intelligence in a single service. As AI capabilities grow, this should be decomposed — separate services for real-time chat, batch document processing, and predictive analytics.

- **No observability beyond PostHog.** PostHog is great for product analytics, but I don't see structured logging (Serilog sinks), distributed tracing (OpenTelemetry), or APM. When a customer reports slow WIP calculation, we need request-level traces.

### Top 3 Priorities (Next 2 Weeks)

1. **Provision Redis for Production** — Either add a Redis instance to Railway or implement PostgreSQL LISTEN/NOTIFY as a durable fallback for the event bus. Losing events in a financial system is unacceptable.
2. **Add Response Caching for Reference Data** — Implement Redis caching (or in-memory with short TTL) for chart of accounts, cost codes, project lists, and employee rosters. These are read-heavy, write-rare endpoints that will be the first performance bottleneck.
3. **Structured Logging + Health Dashboard** — Add Serilog with structured JSON logging and a basic health check dashboard (already have MonitoringController + SystemHealthService — wire them to a visible admin page with response time percentiles).

---

## 4. VP of Sales — Demo Contact

### What Impressed Me

- **The demo story writes itself.** I can walk a prospect through: create a project → add a subcontract → generate a pay app → track retention → file a lien waiver → run WIP schedule → post to GL. That's an end-to-end construction accounting workflow in one platform. Procore can't do the financial side. Vista can't do the project management side. We do both.

- **The breadth is staggering for a startup.** 100+ dashboard pages, 14 modules, 25 design specs for features in the pipeline. When a prospect asks "do you handle [X]?" the answer is almost always yes or "it's on our near-term roadmap with a design spec already written." That confidence closes deals.

- **AI features are a wedge.** Embedded AI chat that understands your project data, smart field suggestions, document intelligence — this is the "future of construction" story that gets executive attention. No incumbent has this. This is the 2-minute demo moment that makes CFOs lean forward.

- **Self-hosted positioning eliminates a major objection.** "Your data never leaves your servers" — this is what we hear from GCs who won't put financials in Procore's cloud. Our on-premise story is genuine, not a checkbox feature.

- **Price disruption opportunity is massive.** Procore charges $30-50/user/month and gates features by tier. Vista costs $200K+ to implement. We can undercut both dramatically with a flat-fee or per-company model because there are no per-seat costs in a self-hosted architecture.

### What Concerns Me

- **No live demo environment with realistic data.** The DemoBootstrapper exists but has a type mismatch issue. For sales demos, I need a one-click demo environment with realistic GC data: 15-20 active projects, 200 employees, 50 subs, 6 months of time entries, in-progress pay apps. The current seed data appears minimal.

- **No comparison/competitive matrix documentation.** When a prospect asks "how do you compare to Procore/Vista/Sage?" I need a feature-by-feature matrix. This should be available in the product itself (help page or marketing site).

- **Onboarding time is unclear.** How long from "sign contract" to "entering time on a real project?" If the answer is more than 2 weeks, mid-market GCs won't switch. The migration accelerator spec exists but isn't implemented — this is the #1 sales blocker.

- **No customer-facing reporting.** The reports module exists but I need 5-6 polished PDF exports: WIP schedule, project cost summary, retention summary, certified payroll WH-347, aged receivables. These are what controllers print for their Monday morning meeting and what banks/sureties request.

- **No integration story.** GCs use QuickBooks, Sage, ADP, ProCore. Even a basic CSV export/import or a QuickBooks Online sync would unlock deals where Pitbull replaces part of their stack, not all of it.

### Top 3 Priorities (Next 2 Weeks)

1. **Production-Quality Demo Environment** — Fix the DemoBootstrapper and populate it with a realistic GC dataset (15+ projects, 200+ employees, financial history). This is the single most important sales tool.
2. **PDF Export for Top 5 Reports** — WIP Schedule, Project Cost Summary, Retention Summary, Certified Payroll, and Aged AR. These are "leave-behind" documents that keep the conversation going after a demo.
3. **Migration Accelerator MVP** — Even a guided CSV import for chart of accounts, projects, vendors, and employees from Vista/Sage would cut onboarding from months to days.

---

## 5. Head of Product — Lisa Tran

### What Impressed Me

- **The feature architecture is remarkably consistent.** Every module follows the same patterns: list view with filters → detail view → create/edit → status transitions. Users learn one interaction model and it applies everywhere. The shadcn/ui component library ensures visual consistency. This is hard to maintain across 100+ pages and they've done it.

- **Settings are module-aware.** Each module has its own settings page (bid settings, contract settings, RFI settings, time-tracking settings, etc.). This means customization doesn't require touching global config. Smart for multi-company deployments where each entity might have different workflows.

- **Command palette (Cmd+K) is implemented.** Global search across projects, bids, contracts, employees, and RFIs from a single keyboard shortcut. This is a power-user feature that signals sophistication and dramatically improves navigation in a 100+ page application.

- **The design spec backlog is a product manager's dream.** 25 detailed specs covering everything from AI agent onboarding to data flow architecture to payroll compliance. Each spec has entity definitions, API contracts, UI wireframes, and implementation phases. This means we can estimate, prioritize, and staff feature development with confidence.

- **Customer onboarding has a gating flow.** New customers go through a setup wizard (company info → chart of accounts → cost codes → first project) before reaching the main dashboard. This prevents the "blank screen" problem that kills adoption in complex products.

### What Concerns Me

- **No user feedback or NPS mechanism.** PostHog tracks usage patterns but there's no way for users to report issues, request features, or provide satisfaction feedback within the product. For an early product, direct user feedback is the highest-signal input.

- **Too many navigation items.** The sidebar has 20+ top-level items across 5 groups (core, project management, financial, accounting, admin). For a first-time user, this is overwhelming. Need progressive disclosure — show core items first, reveal advanced modules as the user matures.

- **No contextual help or tooltips.** Construction accounting has domain-specific terminology (retainage, AIA billing, SOV, WIP). New users from smaller GCs may not know these terms. In-context help or a glossary would reduce support burden.

- **Status transitions are implicit.** Lien waivers go Requested → Received → Approved, but the user has to know this flow. There should be a visual workflow indicator (breadcrumb or stepper) showing where a record is in its lifecycle and what actions are available.

- **No dashboard customization.** The main dashboard is static. Different roles need different views — a PM wants project status, a controller wants financial summaries, a field super wants today's schedule. Role-based dashboard or widget customization would dramatically improve perceived value.

### Top 3 Priorities (Next 2 Weeks)

1. **Role-Based Dashboard Widgets** — Implement 3-4 dashboard layouts: PM view (project health), Controller view (financial summaries), Field view (today's tasks + time entry), Executive view (KPIs). Let users choose their default.
2. **In-App Feedback Widget** — Add a simple "Send Feedback" button that captures the user's current page, role, and freeform text. Route to a support queue. This is essential for alpha users.
3. **Workflow Status Indicators** — Add visual stepper/breadcrumb components to lien waivers, pay apps, RFIs, and submittals showing the current state and available transitions.

---

## 6. VP of Construction — Tom Reilly

### What Impressed Me

- **Subcontract management is structurally sound.** Contract → Schedule of Values → Change Orders → Payment Applications. This is the correct hierarchy. The SOV with line-item tracking means we can track work-in-place at the cost-code level, which is how PMs actually manage budgets. The dual-book model (owner-side and sub-side) for pay apps is sophisticated.

- **Job cost tracking links to the right entities.** Job cost entries reference project, cost code, and phase. Budget vs. actual comparisons are at the cost-code level. This is how a PM knows they're over budget on concrete before it's too late. The projections module adds forecast capability — unusual for a product at this stage.

- **RFI workflow is complete.** Create → assign → track response → close. With AI-suggested answers. This is the workflow that PMs spend 30% of their day on. Having it integrated (not in a separate app like Bluebeam or Procore) means less context-switching.

- **Change order management follows industry standards.** Linked to contracts, with proper cost impact tracking. The status workflow (Pending → Approved → Rejected) with cost impact roll-up to the contract total is exactly right.

- **Plans & specs management is a hidden gem.** Spec sections, drawing registers, revision tracking. This is usually a separate product (PlanGrid, now Autodesk Build). Having it integrated means a PM can click from an RFI to the relevant spec section to the daily report referencing that issue. That connected workflow is the real value.

### What Concerns Me

- **No Gantt chart or visual schedule.** The schedule module has tasks and dependencies, but construction PMs expect a Gantt view. A table of tasks is not a schedule — it's a list. This is one of the first things a PM will look for in a demo.

- **No bid-to-project-to-contract pipeline automation.** We can create bids, projects, and contracts independently, but the workflow of "won this bid → create project → issue subcontracts from bid items" should be guided and semi-automatic. This is where hours of manual data entry get eliminated.

- **No submittal log PDF export.** Submittals need to be printed and distributed — architects require a submittal log as part of project close-out documentation. Need a formatted PDF/Excel export.

- **No punch list or deficiency tracking.** At project close-out, the PM walks the building with the architect and creates a punch list. This is a distinct workflow from general tasks — it needs its own entity with location tagging, photo documentation, and sign-off tracking.

- **Lien waiver tracking needs vendor portal integration.** Currently, waiver status is tracked internally. The real workflow involves sending the waiver request to the sub, receiving the signed document back, and reviewing it. The vendor portal stub exists but needs to be fleshed out for this critical compliance flow.

### Top 3 Priorities (Next 2 Weeks)

1. **Gantt Chart for Project Schedule** — Even a read-only Gantt visualization of the existing schedule data would transform the demo. Use a library like `gantt-task-react` or similar. This is visually the most impactful feature for PM demos.
2. **Bid-to-Project Conversion Wizard** — Guided workflow to convert a won bid into a project with subcontracts pre-populated from bid line items. This demonstrates automation value.
3. **Punch List Module** — Dedicated entity with location, category, responsible party, photo attachment, and sign-off. This is a short build (similar to existing RFI structure) with high demo impact for project close-out stories.

---

## 7. CISO — Rachel Kim

### What Impressed Me

- **Row-Level Security is genuinely implemented, not just claimed.** PostgreSQL RLS policies with `set_config('app.current_tenant', ...)` and `set_config('app.current_company', ...)` set on every request via middleware. Application-level query filters provide a second layer. This dual-enforcement model means a coding error in one layer doesn't expose tenant data. This is the strongest multi-tenant isolation I've seen in a construction SaaS product.

- **Rate limiting is applied universally.** Every controller has rate limiting policies. 10 distinct policies defined (sliding window, fixed window, concurrency limiters) calibrated by endpoint sensitivity. Auth endpoints have stricter limits. This prevents brute force, credential stuffing, and API abuse out of the box.

- **Audit trail is comprehensive.** Dedicated AuditLog entity with action tracking, entity-level change recording, and a dedicated admin audit viewer page. Time entry audit trail is separately implemented with before/after snapshots. This satisfies SOC 2 Type II evidence requirements.

- **Authentication follows industry standards.** ASP.NET Identity with JWT, proper claim-based authorization, role-based access control with Admin/Manager/User tiers, API key management for service-to-service auth. The auth pages (login, signup, forgot-password, reset-password, verify-email, invite flow) cover the complete lifecycle.

- **Zero build warnings, zero known vulnerabilities.** The codebase compiles clean with no security analyzer warnings. No TODO/HACK/FIXME markers in source code. This discipline is rare and indicates that security considerations are addressed at development time, not deferred.

### What Concerns Me

- **No data encryption at rest.** PostgreSQL stores data unencrypted by default. For a product handling financial data, payroll information, and SSN-adjacent employee data, we need transparent data encryption (TDE) or column-level encryption for sensitive fields.

- **JWT key management needs hardening.** The JWT signing key is an environment variable (`Jwt__Key`). For production, this should be in a secrets manager (AWS Secrets Manager, HashiCorp Vault, Azure Key Vault) with rotation capability. A compromised JWT key means complete auth bypass.

- **No RBAC beyond three tiers.** Admin/Manager/User is too coarse. A PM shouldn't see payroll data. A field worker shouldn't see contract financials. Feature-level permissions (can_view_payroll, can_approve_pay_apps, can_edit_contracts) are needed for SOC 2 and for customer requirements.

- **File storage security is unclear.** There's a FilesController and IFileStorageService, but I don't see virus scanning, content-type validation, or file size limits documented. Uploaded files (lien waiver documents, daily report photos) are an attack vector.

- **No penetration test or security audit documented.** For investor readiness, we need at least one third-party pen test report, even if it's automated (Burp Suite, OWASP ZAP). This is a checkbox item for enterprise procurement.

### Top 3 Priorities (Next 2 Weeks)

1. **Feature-Level RBAC** — Implement permission-based authorization (e.g., `[Authorize(Policy = "CanApprovePaymentApplications")]`). Map permissions to roles (Admin gets all, Manager gets department-specific, User gets restricted). This is both a security requirement and a sales requirement — every GC will ask about role permissions.
2. **Secrets Management** — Move JWT keys, database credentials, and API keys to a proper secrets manager. Document the key rotation procedure. This is foundational for any SOC 2 conversation.
3. **File Upload Security** — Implement content-type validation, file size limits, and virus scanning (ClamAV or similar) on the file upload endpoint. Block executable uploads. This prevents the most common attack vector in web applications.

---

## 8. Head of AI — Dr. Amir Patel

### What Impressed Me

- **AI is embedded, not bolted on.** The AI chat understands project context (it queries the database for project-specific data before responding). Smart field suggestions are integrated into entity creation forms. Document intelligence processes uploaded files. This is AI that enhances existing workflows rather than requiring users to learn a new tool.

- **The AI architecture has room to grow.** The IAiService interface abstracts the AI provider, and the implementation supports multiple capabilities (chat, suggest, document analysis). The design specs include an AI Agent Onboarding system with agent identity — this shows a roadmap toward autonomous agents.

- **AI-suggested RFI answers are a genuine time-saver.** RFIs are the most tedious PM workflow. Having AI draft an initial response based on plans, specs, and project history could save 20-30 minutes per RFI for a busy PM handling 10+ per week.

- **PostHog analytics provide behavioral data for AI training.** Usage patterns captured in PostHog (both frontend and backend) give us the behavioral data needed to build predictive models. Which screens do users visit before creating a change order? Which filters do they always apply? This data trains the AI to anticipate needs.

- **25 design specs as structured training data.** The comprehensive specs (AIA billing, payroll compliance, retention, etc.) serve as domain knowledge that can be embedded into AI context windows. The AI can reference these specs to provide domain-accurate guidance.

### What Concerns Me

- **No predictive analytics yet.** We have historical data (job cost, time entries, pay apps) but no models predicting project outcomes. "This project is trending 12% over budget based on similar projects" would be a killer demo feature and a genuine differentiator.

- **AI hallucination risk in financial context.** AI suggesting an RFI answer is low-risk. AI suggesting a journal entry amount or a WIP calculation is high-risk. We need confidence scoring and mandatory human review for AI actions that affect financial data.

- **No AI-assisted data entry.** The biggest time sink in construction ERP is data entry — entering 200 time cards, 50 line items on an SOV, cost code assignments. AI should be auto-filling repetitive fields, suggesting cost code allocations based on description text, and pre-populating forms from historical patterns.

- **Document intelligence scope is unclear.** Can it OCR a scanned subcontract and extract key terms? Can it read a vendor invoice PDF and match it to a PO? These are high-value use cases that would justify AI spend. The current document intelligence appears limited to chat-based Q&A.

- **No AI cost monitoring.** Each AI API call costs money. With 200+ users potentially triggering AI suggestions on every form, costs could spiral. Need a token usage dashboard and per-tenant AI budget controls.

### Top 3 Priorities (Next 2 Weeks)

1. **Cost-to-Complete Prediction Model** — Using historical job cost data, build a model that predicts final cost at completion. Display as a "AI Forecast" widget on the project dashboard. This is the single highest-value AI feature for a GC — it predicts problems before they happen.
2. **AI-Powered Invoice Data Extraction** — When a vendor invoice PDF is uploaded, use document AI to extract invoice number, amount, line items, and match against open POs. This automates the most tedious AP workflow.
3. **AI Usage Dashboard** — Track token consumption per tenant, per feature. Display in admin settings. Set alert thresholds. This prevents cost surprises and gives us data to optimize prompt efficiency.

---

## Synthesized Prioritized Roadmap — Next 2 Weeks

The executive team convened to synthesize individual priorities into a unified, sequenced roadmap. Priorities were ranked by **demo impact** (what makes a $50-500M GC say "I need this") and **investor readiness** (what demonstrates product-market fit and technical maturity).

### Tier 1: Critical Path (Days 1-5) — "Close the Demo Loop"

| # | Initiative | Sponsors | Justification |
|---|-----------|----------|---------------|
| 1 | **Production Demo Environment** | Sales, Product | Cannot demo without realistic data. Fix DemoBootstrapper, seed 15+ projects, 200+ employees, 6 months of financial history. Every other initiative depends on being able to show it. |
| 2 | **Gantt Chart Visualization** | Construction, Sales | The single most visually impactful missing feature. PMs expect a Gantt. Without it, we look like a database with a nice UI, not a construction platform. Read-only Gantt over existing schedule data. |
| 3 | **AP/AR Aging Dashboard** | CFO, Sales | Every GC controller's morning starts with aging reports. Current/30/60/90+ for both vendors and customers. This validates the entire financial module in one screen. |

### Tier 2: High Impact (Days 3-8) — "Demonstrate Depth"

| # | Initiative | Sponsors | Justification |
|---|-----------|----------|---------------|
| 4 | **PDF Export: Top 5 Reports** | CFO, Sales, Construction | WIP Schedule, Project Cost Summary, Retention Summary, Certified Payroll (WH-347), Aged AR. These are the documents that get printed, handed to banks, and filed for audits. They prove the system is a book of record. |
| 5 | **Role-Based Dashboard** | Product, CISO | 3 dashboard layouts (PM, Controller, Executive) that show the right data to the right role. Doubles as a feature-level permission demo. Solves the "overwhelming sidebar" problem. |
| 6 | **WIP-to-GL Auto-Journaling** | CFO, CTO | Connects project accounting to financial reporting. When a WIP report shows overbilling, one click creates the adjusting journal entries. This is the moment a controller realizes they can close books in Pitbull. |

### Tier 3: Differentiation (Days 6-12) — "The Future of Construction"

| # | Initiative | Sponsors | Justification |
|---|-----------|----------|---------------|
| 7 | **AI Cost-to-Complete Prediction** | AI, Construction, Sales | "Your AI predicts project outcomes" is the headline feature that separates us from every incumbent. Historical job cost data feeds a prediction model showing estimated final cost. This is the demo moment. |
| 8 | **Mobile Daily Reports + Photos** | Operations, Construction | Photos from the field are the most shared artifact in construction. A foreman snapping a photo of concrete pour progress and attaching it to a daily report from their phone is a visceral demo. |
| 9 | **Feature-Level RBAC** | CISO, Product | Enterprise buyers require it. "Who can approve a pay app over $100K?" needs a clear answer. Permission-based authorization mapped to configurable roles. |

### Tier 4: Foundation (Days 8-14) — "Production Readiness"

| # | Initiative | Sponsors | Justification |
|---|-----------|----------|---------------|
| 10 | **Redis for Production Events** | CTO | Event bus reliability is non-negotiable for financial data. Provision Redis on Railway or implement PostgreSQL-based durable messaging. |
| 11 | **Migration Accelerator MVP** | Sales, Operations | CSV import for chart of accounts, projects, vendors, and employees. "How fast can we switch?" is the deal-closing question. Even a guided import cuts onboarding from months to weeks. |
| 12 | **Workflow Status Indicators** | Product | Visual steppers on lien waivers, pay apps, RFIs, and submittals. Low engineering effort, high UX impact. Makes the system feel guided rather than free-form. |

---

## Competitive Positioning Summary

| Capability | Pitbull | Procore | Vista/Viewpoint | Sage 300 CRE |
|-----------|---------|---------|-----------------|---------------|
| Project Management (12 modules) | ✅ Full | ✅ Full | ❌ Limited | ❌ None |
| Financial/GL/WIP | ✅ Built-in | ❌ None (integrates) | ✅ Full | ✅ Full |
| AI-Embedded Features | ✅ Chat + Smart Fields | ⚠️ Basic | ❌ None | ❌ None |
| Self-Hosted Option | ✅ Native | ❌ Cloud only | ⚠️ Legacy on-prem | ⚠️ Legacy on-prem |
| Multi-Tenant + Multi-Company | ✅ RLS-backed | ❌ Per-account | ⚠️ Per-database | ⚠️ Per-database |
| Modern UI/UX | ✅ React 19 + Tailwind | ✅ Modern | ❌ Windows client | ❌ Windows client |
| Time Tracking + Crew Entry | ✅ Full | ⚠️ Basic | ⚠️ Via integration | ❌ Separate product |
| Per-Seat Cost | ✅ $0 (self-hosted) | ❌ $30-50/user/mo | ❌ $$$$ | ❌ $$$$ |
| Implementation Time | ✅ Days (target) | ⚠️ Weeks | ❌ 6-18 months | ❌ 6-12 months |

---

## Investor Readiness Assessment

| Dimension | Score | Evidence |
|-----------|-------|----------|
| **Technical Foundation** | 9/10 | .NET 9 + Next.js 16 + PostgreSQL 17. CQRS monolith. 1,932 tests. Zero warnings. RLS multi-tenancy. |
| **Feature Breadth** | 8/10 | 14 modules, 100+ pages. Covers project management AND financial management — unusual for a startup. |
| **AI Differentiation** | 7/10 | Embedded chat + smart fields. Strong roadmap (predictive analytics, document AI). Ahead of incumbents but needs more demo-ready features. |
| **Market Positioning** | 9/10 | Clear gap between Procore (PM only) and Vista (finance only, legacy). Self-hosted disruption of per-seat pricing. |
| **Demo Readiness** | 6/10 | Strong feature set but needs realistic demo data, Gantt chart, PDF exports, and polished demo flow. |
| **Production Readiness** | 6/10 | Missing Redis in prod, fine-grained RBAC, encryption at rest, and caching. Architecture supports it — execution needed. |
| **Team Velocity** | 10/10 | GL + WIP + Retention + Lien Waivers + Procurement all shipped in a single sprint. 25 detailed design specs queued. Execution speed is exceptional. |

**Overall: 7.9/10 — Strong foundation with clear, addressable gaps.**

The 2-week roadmap above, if executed, would push Demo Readiness to 8/10 and begin addressing Production Readiness. The team velocity (10/10) gives high confidence that this roadmap is achievable.

---

*Review conducted by the Pitbull Executive Team, February 19, 2026.*
*Next review scheduled: March 5, 2026.*
