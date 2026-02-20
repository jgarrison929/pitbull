# Comprehensive Executive Roadmap — All Suggestions

**Source:** `docs/EXECUTIVE-REVIEW-FEB19.md` (8 C-suite perspectives)
**Date:** February 19, 2026
**Context:** Pre-seed fundraise ($500K) in motion. Every item below strengthens demo, investor pitch, or production readiness.

---

## Legend

- 🔴 **Critical** — Blocks demos, investor conversations, or first customer
- 🟡 **High** — Major demo/product improvement
- 🟢 **Medium** — Quality of life, professional polish
- ⚪ **Foundation** — Infrastructure, security, scalability

Priority ordering considers: demo impact → investor readiness → customer retention → technical debt.

---

## FINANCIAL MODULE GAPS (CFO — Sarah Chen)

| # | Item | Priority | Effort | Notes |
|---|------|----------|--------|-------|
| F1 | **AP/AR Aging Dashboard** (Current/30/60/90/120+) | 🔴 | 1-2 days | Most-viewed report for any GC controller. Morning ritual. |
| F2 | **WIP-to-GL Auto-Journaling** | 🔴 | 1-2 days | "Post to GL" action on WIP report creates overbilling/underbilling entries. Closes the loop. |
| F3 | **Bank Reconciliation MVP** | 🟡 | 2-3 days | Mark-as-reconciled on journal entries. Proves GL is a real book of record. |
| F4 | **Multi-currency / Sales Tax** | 🟢 | 3-5 days | State-line work, materials tax. Not urgent for initial demos but needed for production. |
| F5 | **WH-347 PDF Export** | 🟡 | 1-2 days | Certified payroll DOL compliance format. Entities exist, need PDF generation. |

## OPERATIONS & FIELD (VP Ops — Marcus Rivera)

| # | Item | Priority | Effort | Notes |
|---|------|----------|--------|-------|
| O1 | **Mobile Daily Report + Photo Capture** | 🟡 | 2-3 days | Camera integration on daily reports. Highest-value field workflow after time entry. |
| O2 | **Push Notifications for RFI/Submittal Deadlines** | 🟡 | 1-2 days | Email notifications on overdue RFIs. Wire to existing Resend integration. |
| O3 | **Offline-Ready Time Entry (PWA)** | 🟢 | 3-5 days | Service worker caching for time entry. Non-negotiable for field adoption long-term. |
| O4 | **Dedicated Mobile Views** | 🟢 | 2-3 days | Big buttons, minimal nav, task-focused flows for field workers on 6" screens. |
| O5 | **GPS/Geofence on Time Entry** | 🟢 | 2-3 days | Proves workers on-site for prevailing wage jobs. Compliance differentiator. |

## TECHNICAL / ARCHITECTURE (CTO — Demo Contact C03)

| # | Item | Priority | Effort | Notes |
|---|------|----------|--------|-------|
| T1 | **Redis for Production** | 🔴 | 0.5 day | Provision on Railway or implement PG LISTEN/NOTIFY. Events lost on restart = unacceptable for financial data. |
| T2 | **Response Caching for Reference Data** | 🟡 | 1-2 days | Redis/in-memory cache for CoA, cost codes, project lists, employee rosters. Read-heavy endpoints. |
| T3 | **Structured Logging + Health Dashboard** | 🟡 | 1-2 days | Serilog JSON sinks + wire MonitoringController to visible admin page with response time percentiles. |
| T4 | **AI Service Decomposition** | 🟢 | 2-3 days | Split AiService into chat, batch doc processing, and predictive services. |
| T5 | **Migration Testing Strategy** | 🟢 | 1 day | Blue-green deployment approach for 52+ migrations at scale. |

## SALES & DEMO (VP Sales — Demo Contact)

| # | Item | Priority | Effort | Notes |
|---|------|----------|--------|-------|
| S1 | **Production Demo Environment** | 🔴 | 2-3 days | Fix DemoBootstrapper. Seed: 15+ projects, 200+ employees, 50 subs, 6 months financial history. EVERYTHING depends on this. |
| S2 | **PDF Export: Top 5 Reports** | 🔴 | 2-3 days | WIP Schedule, Project Cost Summary, Retention Summary, Certified Payroll (WH-347), Aged AR. "Leave-behind" docs for bank/surety/auditor. |
| S3 | **Migration Accelerator MVP** | 🟡 | 2-3 days | Guided CSV import for CoA, projects, vendors, employees from Vista/Sage. "How fast can we switch?" closes deals. |
| S4 | **Competitive Feature Matrix** | 🟢 | 0.5 day | Pitbull vs Procore vs Vista vs Sage comparison page. In-product or marketing site. |
| S5 | **Integration Story (QuickBooks/ADP/CSV)** | 🟡 | 2-3 days | Basic CSV export/import or QB Online sync. Lets Pitbull replace part of stack, not all. |

## PRODUCT / UX (Head of Product — Lisa Tran)

| # | Item | Priority | Effort | Notes |
|---|------|----------|--------|-------|
| P1 | **Role-Based Dashboard Widgets** | 🟡 | 2-3 days | PM view (project health), Controller view (financials), Field view (today's tasks), Executive view (KPIs). |
| P2 | **In-App Feedback Widget** | 🟢 | 0.5 day | "Send Feedback" button capturing page, role, freeform text. Essential for alpha users. |
| P3 | **Workflow Status Indicators** | 🟡 | 1-2 days | Visual stepper/breadcrumb on lien waivers, pay apps, RFIs, submittals. Low effort, high UX impact. |
| P4 | **Progressive Sidebar Disclosure** | 🟢 | 1 day | Show core items first, reveal advanced modules as user matures. Reduces overwhelm. |
| P5 | **Contextual Help / Glossary** | 🟢 | 1 day | Tooltips for domain terms (retainage, SOV, WIP). Reduces support burden. |
| P6 | **Dashboard Customization** | 🟢 | 3-5 days | Widget drag-and-drop or layout selection per user. |

## CONSTRUCTION / PM (VP Construction — Tom Reilly)

| # | Item | Priority | Effort | Notes |
|---|------|----------|--------|-------|
| C1 | **Gantt Chart Visualization** | 🔴 | 2-3 days | Read-only Gantt over existing schedule data. PMs expect this. Without it, we look like a database. |
| C2 | **Bid-to-Project Conversion Wizard** | 🟡 | 1-2 days | Won bid → create project → pre-populate subcontracts from bid items. Automation story. |
| C3 | **Punch List Module** | 🟡 | 2-3 days | Dedicated entity: location, category, responsible party, photo, sign-off. Project close-out story. |
| C4 | **Submittal Log PDF Export** | 🟢 | 1 day | Formatted PDF/Excel for architect close-out documentation. |
| C5 | **Vendor Portal for Lien Waivers** | 🟢 | 3-5 days | Subs submit signed waivers through portal. Flesh out existing Portal stub. |

## SECURITY (CISO — Rachel Kim)

| # | Item | Priority | Effort | Notes |
|---|------|----------|--------|-------|
| X1 | **Feature-Level RBAC** | 🟡 | 3-5 days | Policy-based auth (CanApprovePayApps, CanViewPayroll). Map to configurable roles. Enterprise requirement. |
| X2 | **Secrets Management** | 🟢 | 1 day | Move JWT keys, DB creds, API keys to secrets manager. Document rotation procedure. SOC 2 prerequisite. |
| X3 | **File Upload Security** | 🟢 | 1 day | Content-type validation, file size limits, virus scanning (ClamAV). Block executables. |
| X4 | **Data Encryption at Rest** | 🟢 | 1-2 days | Column-level encryption for SSN-adjacent data, or PostgreSQL TDE. |
| X5 | **Penetration Test** | 🟢 | External | Third-party pen test report. Investor checkbox item. |

## AI / INTELLIGENCE (Head of AI — Dr. Amir Patel)

| # | Item | Priority | Effort | Notes |
|---|------|----------|--------|-------|
| A1 | **Cost-to-Complete Prediction** | 🟡 | 3-5 days | Historical job cost → predict final cost. "AI Forecast" widget on project dashboard. THE demo headline. |
| A2 | **AI Invoice Data Extraction** | 🟡 | 2-3 days | Upload vendor invoice PDF → extract number, amount, line items → match to open PO. Automates AP. |
| A3 | **AI Usage Dashboard** | 🟢 | 1 day | Token consumption per tenant, per feature. Alert thresholds. Prevents cost surprises. |
| A4 | **AI Confidence Scoring** | 🟢 | 1 day | Mandatory human review for AI actions affecting financial data. Risk mitigation. |
| A5 | **AI-Assisted Data Entry** | 🟡 | 2-3 days | Auto-fill repetitive fields, suggest cost codes from descriptions, pre-populate from history. Predictive UX moat. |

---

## EXECUTION SCHEDULE

### Sprint 1 (Days 1-3): "Close the Demo Loop"
**Goal:** A demo you'd show an investor.

| Task | Agent | Est |
|------|-------|-----|
| S1: Demo environment + realistic seed data | Claude Code | 3 days |
| C1: Gantt chart visualization (read-only) | Codex | 2 days |
| F1: AP/AR aging dashboard | Claude Code (parallel) | 1 day |
| T1: Redis on Railway | Sub-agent | 0.5 day |

### Sprint 2 (Days 3-6): "Demonstrate Depth"
**Goal:** Prove the financials are real.

| Task | Agent | Est |
|------|-------|-----|
| S2: PDF exports (WIP, cost summary, retention, certified payroll, aged AR) | Claude Code | 3 days |
| F2: WIP-to-GL auto-journaling | Codex | 1 day |
| P1: Role-based dashboard widgets (3 layouts) | Codex | 2 days |
| P3: Workflow status indicators | Sub-agent | 1 day |

### Sprint 3 (Days 6-9): "The Future"
**Goal:** AI and field differentiation.

| Task | Agent | Est |
|------|-------|-----|
| A1: Cost-to-complete prediction model | Claude Code | 3 days |
| O1: Mobile daily reports + photo capture | Codex | 2 days |
| C2: Bid-to-project conversion wizard | Sub-agent | 1 day |
| A5: AI-assisted data entry (smart fill) | Claude Code | 2 days |

### Sprint 4 (Days 9-14): "Production Hardening"
**Goal:** Enterprise-ready for first customer.

| Task | Agent | Est |
|------|-------|-----|
| X1: Feature-level RBAC | Claude Code | 3 days |
| S3: Migration accelerator MVP (CSV import) | Codex | 2 days |
| C3: Punch list module | Sub-agent | 2 days |
| T2: Response caching | Sub-agent | 1 day |
| T3: Structured logging + health dashboard | Sub-agent | 1 day |
| S5: QuickBooks/CSV integration | Codex | 2 days |

### Backlog (Post-Sprint 4)
- F3: Bank reconciliation MVP
- F4: Multi-currency / sales tax
- O3: Offline PWA
- O4: Dedicated mobile views
- O5: GPS/geofence
- T4: AI service decomposition
- T5: Migration testing strategy
- P2: In-app feedback widget
- P4: Progressive sidebar disclosure
- P5: Contextual help / glossary
- P6: Dashboard customization
- C4: Submittal log PDF
- C5: Vendor portal
- X2: Secrets management
- X3: File upload security
- X4: Encryption at rest
- X5: Penetration test
- A2: AI invoice extraction
- A3: AI usage dashboard
- A4: AI confidence scoring
- O2: Push notifications for RFI/submittal deadlines
- S4: Competitive feature matrix

---

## INVESTOR PITCH ALIGNMENT

These features directly address what a pre-seed investor evaluates:

| Investor Question | Answer (Post-Roadmap) |
|---|---|
| "Can I see a demo?" | S1: Full demo env with realistic data |
| "How do you compare to Procore?" | C1: Gantt + financials. Procore has no GL. We have both. |
| "Is the financial module real?" | F1: Aging + F2: WIP-to-GL + S2: PDF reports. Real book of record. |
| "What's the AI story?" | A1: Predictive cost-to-complete. No incumbent has this. |
| "Can you handle enterprise?" | X1: Feature RBAC + T1: Redis + T3: Observability |
| "How fast is onboarding?" | S3: Migration accelerator. Days, not months. |
| "What's the moat?" | AI prediction + predictive UX + full-stack (PM + Finance in one). No one else does both well. |
| "Show me field usage" | O1: Photo daily reports on mobile. Visceral demo. |
| "How fast do you ship?" | ~120K lines in one day. 10/10 velocity score. |

---

*Compiled from EXECUTIVE-REVIEW-FEB19.md. All 40 suggestions catalogued, 0 dropped.*
*Next review: March 5, 2026.*
