# Product Manager — Functional Role Reference

> **Audience:** AI agent teams building Pitbull Construction Solutions ERP
> **Last updated:** 2026-02-19

---

## 1. Role Description

The Product Manager is the **customer onboarding orchestrator**. They own the path from signup to a fully operational back office — and their job is to make that path brutally short. In a world where Vista onboarding takes 3–6 months and Procore requires days of classroom training, Pitbull's Product Manager designs for a **2-hour time-to-value**. A contractor signs up at 8:00 AM; by 10:00 AM, they have a working chart of accounts, cost codes, active projects, employees loaded, and their first invoice drafted.

This is not a fantasy. It's an architectural requirement that drives every product decision:

- **Module dependencies are understood and orchestrated.** You can't create a billing without a project. You can't run payroll without employees. You can't track costs without cost codes. The Product Manager maps these dependencies and ensures the onboarding flow activates modules in the correct sequence — so the user never hits a dead end.
- **Data bootstrapping replaces data entry.** Instead of asking users to manually configure their company, the system infers and auto-populates. Import a QuickBooks file? AI extracts the chart of accounts, vendor list, and customer list. Upload a subcontract PDF? AI creates the vendor record, subcontract, and schedule of values. Connect to the state licensing board? AI pulls the contractor's license, insurance, and bonding info.
- **Predictive UX is the philosophy.** Anticipate what users need before they ask. Make it so easy they rave to colleagues. Every screen should feel like the system already knows what you're trying to do.
- **Churn is a product failure, not a sales failure.** If a customer churns, the Product Manager owns the root cause analysis. Was onboarding too complex? Did they hit a feature gap? Did they get stuck and nobody noticed? Every churn signal is a product improvement opportunity.

The Product Manager sits between engineering, sales, and customers. They translate construction accounting pain into product requirements, design the user journey from Day 1 through Month 12, and measure everything that matters.

### Design Principle

> **The best onboarding is no onboarding.** The system should configure itself from whatever data the customer already has — QuickBooks exports, Excel spreadsheets, scanned contracts, even a verbal description of their business. The Product Manager's goal is to eliminate every manual setup step until the user's first meaningful action (creating a project, sending an invoice, running payroll) happens within minutes of signup.

---

## 2. Core Responsibilities

| Area | Description |
|------|-------------|
| **Onboarding Journey Design** | Own the complete user journey from signup through full platform adoption. Define the 2-hour onboarding flow, the Day 1 experience, the Week 1 milestones, and the Month 1 success criteria. |
| **Module Dependency Mapping** | Maintain the dependency graph of all platform modules. Ensure the activation sequence is correct: foundational modules (Company Setup, Chart of Accounts, Cost Codes) before operational modules (Projects, AP, AR, Payroll). |
| **Data Migration Strategy** | Design and validate import paths from legacy systems: QuickBooks, Sage, Vista, Procore, Foundation, Timberline, Excel. Every import path must be tested end-to-end with real customer data. |
| **Feature Adoption Tracking** | Monitor which features each customer uses, which they ignore, and which they struggle with. Use adoption data to prioritize product improvements and trigger proactive outreach. |
| **Churn Prevention** | Identify churn signals early: login frequency drops, feature usage declines, support ticket volume increases, billing module unused after 30 days. Design interventions before the customer decides to leave. |
| **Competitive Intelligence** | Maintain deep knowledge of Vista, Procore, Sage 300 CRE, Foundation, Buildertrend, CoConstruct, and other construction ERPs. Understand their onboarding flows, pain points, and feature gaps. Use this to position Pitbull. |
| **AI Agent Orchestration** | Define how AI agents assist onboarding: what gets auto-populated, what gets suggested, what requires human confirmation. Balance automation with user control. |
| **User Feedback Loop** | Collect, categorize, and prioritize user feedback. Maintain a continuous feedback loop between customers and engineering. Every feature request is tracked; every pain point is documented. |
| **Release Planning** | Coordinate feature releases with engineering. Ensure new features have onboarding flows, help documentation, and in-app guidance before they ship. |
| **Platform Vision Alignment** | Keep the product roadmap aligned with the long-term vision: Design → Build → Operate → Maintain. Every feature decision should move toward the full-lifecycle construction platform. |

---

## 3. The 2-Hour Onboarding Goal

### Why 2 Hours?

Construction back-office software has historically required weeks or months to deploy. Vista implementations average 6–12 months with dedicated consultants. Sage 300 CRE requires a trained admin and 2–4 weeks of setup. Even "modern" tools like Procore require multi-day training sessions.

This is unacceptable. A 15-person GC doesn't have an IT department. They don't have 6 months. They have an office manager who Googles "construction accounting software," signs up, and needs to be productive by lunch.

**The 2-hour target is a hard constraint**, not an aspiration. Every product decision is evaluated against it: "Does this feature add a step to onboarding? If so, can AI eliminate that step?"

### The 2-Hour Flow

```
Minute 0–5: Signup & Company Profile
├── Email, password, company name
├── AI asks: "What type of contractor are you?" (GC, sub, specialty, owner-builder)
├── AI asks: "How many employees?" (1-10, 11-50, 51-200, 200+)
├── AI asks: "What's your primary state?" (for tax and compliance config)
└── AI auto-configures:
    ├── Chart of accounts (construction-specific, based on company size)
    ├── Cost code structure (CSI MasterFormat or custom)
    ├── Tax jurisdictions
    ├── Default payment terms
    └── Module activation recommendations

Minute 5–20: Data Import
├── Option A: "Connect QuickBooks" → OAuth → AI imports:
│   ├── Chart of accounts (mapped to construction accounts)
│   ├── Vendor list → Vendor master
│   ├── Customer list → Customer master
│   ├── Open invoices → AR aging
│   ├── Open bills → AP aging
│   └── Employee list → Employee master (basic info)
│
├── Option B: "Upload spreadsheets" → AI parses:
│   ├── Excel/CSV employee list → Employee records
│   ├── Excel/CSV vendor list → Vendor records
│   ├── Excel/CSV project list → Project records
│   └── Any other tabular data → best-effort mapping
│
├── Option C: "Upload contracts" → AI extracts:
│   ├── Contract PDFs → Project + contract records
│   ├── Subcontract PDFs → Vendor + subcontract + SOV records
│   └── Insurance cert PDFs → Vendor compliance records
│
└── Option D: "Start fresh" → guided manual setup
    (still pre-populated with intelligent defaults)

Minute 20–40: Core Module Setup
├── Projects: Create or verify imported projects
│   ├── AI suggests project structure based on contract data
│   ├── Cost code budgets from estimate imports or manual entry
│   └── Project team assignment
│
├── Employees: Verify or create employee records
│   ├── AI pre-fills from import data
│   ├── Pay rates, tax withholding, union affiliation
│   └── Role assignment (PM, foreman, laborer, office)
│
├── Vendors: Verify or create vendor records
│   ├── AI deduplicates against imported data
│   ├── Compliance tracking setup (insurance, W-9)
│   └── Payment terms and default coding
│
└── Customers: Verify or create customer records
    ├── AI maps from imported data
    └── Default billing terms and contact info

Minute 40–60: First Workflow Execution
├── "Let's create your first invoice"
│   ├── Select project → select billing items → generate AIA G702/G703
│   ├── AI fills in contract values from imported data
│   └── User reviews, adjusts, sends
│
├── "Let's enter your first bill"
│   ├── Upload a vendor invoice → AI extracts and codes
│   └── User reviews and approves
│
├── "Let's set up your first payroll" (if applicable)
│   ├── AI configures tax tables based on state
│   ├── Enter or import timecard data
│   └── Preview payroll run
│
└── Each workflow demonstrates the AI-assist pattern:
    system does the work, user reviews and confirms

Minute 60–90: Customization & Configuration
├── Adjust chart of accounts (add/rename accounts)
├── Customize cost code structure
├── Set up approval workflows
├── Configure payment methods (check, ACH)
├── Set up bank connections
├── Customize report templates
└── AI guides: "Most GCs your size also set up [X]. Want to do that now?"

Minute 90–120: Training & Handoff
├── Interactive walkthrough of daily workflows
│   ├── "Here's how your AP clerk processes an invoice"
│   ├── "Here's how your PM submits a pay app"
│   └── "Here's how you run a job cost report"
│
├── Invite team members
│   ├── Role-based access: PM, AP Clerk, AR Clerk, Payroll, etc.
│   └── Each role gets a tailored first-login experience
│
├── Set up recurring tasks
│   ├── Weekly payment run schedule
│   ├── Monthly billing reminders
│   └── Insurance certificate expiration alerts
│
└── "You're live. Here's what to do next week."
    ├── AI-generated onboarding checklist (personalized)
    ├── Help center links for deep dives
    └── Scheduled check-in with success team
```

---

## 4. Module Activation Order & Dependencies

The Product Manager maintains the canonical module dependency graph. Modules must be activated in an order that respects data dependencies — you cannot create a billing if there's no project, and you cannot create a project if there's no cost code structure.

```
Layer 0 — Foundation (required, auto-created at signup)
├── Company Profile
├── Chart of Accounts
├── Cost Code Structure
├── Tax Configuration
└── User & Role Management

Layer 1 — Core Entities (required before any operations)
├── Customers (depends on: Company Profile)
├── Vendors (depends on: Company Profile)
├── Employees (depends on: Company Profile, Tax Config)
└── Projects (depends on: Customers, Cost Codes)

Layer 2 — Operational Modules (depends on core entities)
├── Accounts Payable (depends on: Vendors, Projects, Chart of Accounts)
├── Accounts Receivable (depends on: Customers, Projects, Chart of Accounts)
├── Purchase Orders (depends on: Vendors, Projects, Cost Codes)
├── Subcontract Management (depends on: Vendors, Projects, Cost Codes)
└── Timekeeping (depends on: Employees, Projects, Cost Codes)

Layer 3 — Processing Modules (depends on operational data)
├── Payroll (depends on: Employees, Timekeeping, Tax Config)
├── Job Costing (depends on: Projects, AP, AR, Payroll, POs, Subcontracts)
├── Billing (depends on: Projects, Customers, AR, Contract Data)
└── Banking (depends on: Chart of Accounts, AP, AR, Payroll)

Layer 4 — Intelligence & Reporting (depends on all the above)
├── WIP Schedule / Revenue Recognition (depends on: Job Cost, Billing, AR)
├── Financial Statements (depends on: GL, all subledgers)
├── Cash Flow Forecasting (depends on: AP, AR, Payroll, Banking)
├── Compliance Dashboard (depends on: Vendors, Subs, Insurance, Lien Waivers)
└── Executive Dashboard (depends on: all modules)

Layer 5 — Future Vision
├── Digital Twin Integration (depends on: Projects, Job Cost, BIM model)
├── BIM-Linked Procurement (depends on: POs, Vendors, BIM model)
├── CAD/Drawing Management (depends on: Projects, Document Management)
└── Facility Operations (depends on: Digital Twin, Vendor Management)
```

### Dependency Rules

1. **Layer 0 is invisible.** The user never sees "Chart of Accounts setup" as a step. AI generates it from the company profile and import data.
2. **Layer 1 is the import layer.** This is where data migration happens. If the customer imports from QuickBooks, most of Layer 1 is done automatically.
3. **Layers 2–3 are activated on demand.** Don't show AP to a 3-person sub who only needs invoicing. Module recommendations are based on company size, type, and stated needs.
4. **Layer 4 activates automatically** once enough data exists. The WIP schedule doesn't need to be "turned on" — it appears when there are active projects with billings and costs.
5. **Layer 5 is the roadmap.** These modules don't exist yet but the data model and architecture must accommodate them from Day 1.

---

## 5. User Journey Design

### Day 1: "I'm live"

**Goal:** Customer has a working system with real data. They've completed at least one real workflow (sent an invoice, entered a bill, or previewed a payroll).

**Signals of success:**
- At least one project created with budget
- At least one vendor or customer created
- At least one transaction (invoice, bill, or timecard) entered
- User has invited at least one team member
- User has bookmarked or saved the app

**AI behavior on Day 1:**
- Every empty screen shows a contextual prompt: "You don't have any vendors yet. Import from QuickBooks or add your first vendor."
- Progress bar visible: "Your setup is 65% complete. Next: add your employee list."
- Chat assistant available: "I see you imported 47 vendors from QuickBooks. 3 might be duplicates — want me to merge them?"
- Celebrate completions: "🎉 Your first invoice is ready to send! You're ahead of 80% of new customers at this stage."

### Week 1: "I'm using it daily"

**Goal:** Customer has processed at least one full business cycle — entered costs, sent billings, received payments, or run payroll. The system is replacing their old workflow, not supplementing it.

**Signals of success:**
- Daily logins from at least 2 users
- At least 10 transactions entered
- At least one report generated
- Old system (QuickBooks, Excel) is no longer the primary tool for at least one workflow
- No open support tickets older than 24 hours

**AI behavior in Week 1:**
- Suggest workflows the customer hasn't tried: "You've been entering invoices manually. Did you know you can email them directly to vendors@yourcompany.pitbull.com and AI will auto-process them?"
- Flag incomplete setup: "You have 12 subcontracts but no insurance certificates on file. Want to send compliance requests to your subs?"
- Benchmark against peers: "Companies your size typically also set up purchase orders. Want a quick tour?"
- Proactive health check: "I noticed 3 invoices are coded to a suspense account. Want me to suggest the correct cost codes?"

### Month 1: "I can't imagine going back"

**Goal:** Customer is fully operational. All relevant modules are active. The team is self-sufficient. The system is the single source of truth for their back office.

**Signals of success:**
- All invited users are active (logging in weekly+)
- At least one monthly billing cycle completed
- At least one payroll run completed (if applicable)
- WIP schedule or job cost reports are being reviewed
- Customer has recommended Pitbull to at least one peer (NPS tracked)
- No consideration of alternative products

**AI behavior in Month 1:**
- Shift from setup assistance to optimization: "You're paying vendors an average of 8 days early. Want to optimize payment timing to improve cash flow?"
- Surface insights: "Project 2024-015 is trending 12% over budget on concrete. Here's the cost code detail."
- Introduce advanced features: "You've been creating AIA billings manually. Want to try auto-generating them from your schedule of values?"
- Request feedback: "You've been using Pitbull for 30 days. What's working? What's frustrating? [Quick survey]"

---

## 6. Metrics the Product Manager Tracks

### Onboarding Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| **Time to First Value (TTFV)** | < 30 minutes | Time from signup to first meaningful action (creating a project, sending an invoice, entering a bill). |
| **Time to Operational (TTO)** | < 2 hours | Time from signup to "system is handling a real workflow." |
| **Onboarding Completion Rate** | > 85% | Percentage of signups that complete the full onboarding flow (reach "operational" status). |
| **Data Import Success Rate** | > 95% | Percentage of QuickBooks/Sage/Excel imports that complete without errors. |
| **Module Activation Rate** | Track per module | Percentage of customers who activate each module within 30 days. Identifies which modules are discoverable. |

### Engagement Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| **DAU/MAU Ratio** | > 0.5 | Daily active users / monthly active users. Construction ERP should be used daily by at least the office staff. |
| **Feature Depth** | > 3 modules | Average number of modules actively used per customer. Deeper usage = stickier customer. |
| **Team Activation Rate** | > 80% | Percentage of invited users who log in and perform an action within 7 days. |
| **AI Suggestion Acceptance Rate** | > 60% | How often users accept AI-generated suggestions (auto-coded invoices, suggested next steps). Measures AI quality. |
| **Support Ticket Volume per User** | < 1/month | Lower is better. High ticket volume means the product is confusing. |

### Retention Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| **30-Day Retention** | > 90% | Percentage of customers still active after 30 days. |
| **90-Day Retention** | > 85% | Percentage of customers still active after 90 days. Critical — this is when annual contracts renew. |
| **Net Revenue Retention (NRR)** | > 110% | Revenue from existing customers (including upsells) / revenue from same customers 12 months ago. |
| **Churn Rate** | < 5% annual | Monthly: < 0.5%. Any month above 1% triggers a root cause analysis. |
| **NPS Score** | > 50 | Net Promoter Score. Surveyed at 30, 90, and 365 days. |

### Churn Signals (Early Warning)

| Signal | Risk Level | Response |
|--------|-----------|----------|
| **Login frequency drops >50% week-over-week** | 🟡 Medium | AI sends "We miss you" nudge with personalized tips |
| **No transactions entered in 7 days** | 🟡 Medium | Success team outreach: "Need help with anything?" |
| **Support ticket unresolved >48 hours** | 🔴 High | Escalate to support lead + PM review |
| **Billing module unused after 30 days** | 🟡 Medium | AI suggests billing setup with guided walkthrough |
| **Only 1 user active (should be 3+)** | 🟡 Medium | Prompt: "Invite your team — here's how AP and PM roles work" |
| **Customer exports all data** | 🔴 High | Immediate success team outreach — likely evaluating alternatives |
| **Payment method expired/removed** | 🔴 High | Automated + human outreach to update billing |

---

## 7. AI Agent Assistance in Onboarding

### The AI Onboarding Copilot

Every new customer gets an AI copilot that orchestrates their onboarding. This is not a chatbot — it's an intelligent agent that:

1. **Analyzes imported data** to understand the customer's business: company size, project types, revenue range, accounting complexity.
2. **Generates a personalized onboarding plan:** "Based on your QuickBooks data, you're a 35-employee GC with 12 active projects. Here's your recommended setup path."
3. **Auto-populates everything possible:** Chart of accounts, cost codes, tax rates, payment terms — all derived from imports and industry defaults.
4. **Guides the user through decisions that require human input:** "I set up your standard cost code structure. Do you also use phase codes to separate labor, material, and subcontractor costs per code?"
5. **Learns from every onboarding** to improve the next one: "87% of GCs your size activate the Purchase Order module within 60 days. Want to set it up now?"

### Specific AI Behaviors

| Onboarding Stage | AI Action |
|-----------------|-----------|
| **Signup** | Auto-detect state from browser locale. Pre-fill tax config. Suggest company type from business name. |
| **Data Import** | Parse uploaded files regardless of format. Map columns intelligently. Deduplicate vendors/customers across import sources. Flag data quality issues. |
| **Project Setup** | Extract project info from contracts. Suggest cost code budgets from historical data or industry benchmarks. Auto-create project team from employee roles. |
| **Vendor Setup** | Auto-classify vendors by trade (electrician, plumber, concrete). Pull insurance and licensing from public databases. Generate compliance request emails. |
| **Employee Setup** | Determine tax jurisdictions from home and work addresses. Calculate withholding from W-4 data. Identify union affiliation from job classification. |
| **First Workflows** | Pre-fill forms with best-guess data. Explain each field in context. Show "before and after" comparisons: "Here's what this would look like in QuickBooks vs. Pitbull." |
| **Ongoing** | Monitor for unused features. Surface tips at the right moment. Predict needs from behavior patterns: "You just created 5 subcontracts — want to set up the lien waiver tracking now?" |

### The "Zero Configuration" Target

For every entity in the system, the Product Manager defines:

- **What can be auto-generated?** (Chart of accounts → yes, from industry template)
- **What can be imported?** (Vendor list → yes, from QuickBooks, Excel, CSV)
- **What can be inferred?** (Tax jurisdiction → yes, from address)
- **What requires human decision?** (Approval workflow thresholds → yes, ask the user)

The goal: reduce human decisions to the absolute minimum. Everything else is handled by AI or intelligent defaults.

---

## 8. Predictive UX Philosophy

### Core Principle

> **Anticipate what users need before they ask. Make it so easy they rave to colleagues.**

This isn't a tagline — it's an engineering requirement. Every feature, every screen, every interaction is evaluated against this principle.

### What Predictive UX Looks Like

**Empty states are onboarding opportunities:**
- Bad: "No invoices found."
- Good: "No invoices yet. Upload a vendor invoice and I'll extract and code it automatically — or create one manually."

**Context-aware suggestions:**
- Bad: Generic "Help" button.
- Good: "I see you're looking at the AP aging report. Three invoices are past due — want to schedule a payment run for Friday?"

**Proactive error prevention:**
- Bad: Error message after the user submits: "Cost code required."
- Good: Auto-fill cost code from vendor history. If uncertain, highlight the field: "I'm 72% sure this goes to 31100-Labor. Confirm or change?"

**Progressive disclosure:**
- Bad: Show every field on every form, overwhelming new users.
- Good: Show essential fields. Collapse advanced options. Expand automatically when the user's data suggests they need them: "You selected a union employee — here are the fringe benefit fields."

**Workflow continuation:**
- Bad: User finishes creating a project and lands on a blank dashboard.
- Good: "Project created! Next: add cost code budgets (I pre-filled from your estimate), then assign your team. Or skip ahead and create your first billing."

### The "One-Click" Rule

Every common action should be achievable in one click from the context where the user thinks about it:

- Viewing an overdue invoice → one click to email the customer a reminder
- Reviewing a sub pay app → one click to approve and queue for payment
- Looking at job cost report → one click to drill into the over-budget cost code
- Reading an insurance expiration alert → one click to send a renewal request to the vendor

---

## 9. Pain Points in Competing Products

### Vista (Trimble Viewpoint)

| Pain Point | Impact | Pitbull Advantage |
|------------|--------|-------------------|
| **Implementation takes 6–12 months** with dedicated consultants billing $200–300/hr. | Small/mid GCs can't afford the time or cost. Many abandon the implementation. | 2-hour self-service onboarding. No consultants required. |
| **On-premise architecture** requires IT infrastructure, VPN for remote access, and manual upgrades. | Field staff can't access data. Upgrades are disruptive multi-day events. | Cloud-native, mobile-first. Automatic updates. |
| **1990s-era UI** with green-screen-style forms and deeply nested menus. | New employees take weeks to learn navigation. Training cost is significant. | Modern web UI with AI-guided navigation. |
| **No AI assistance.** Every invoice, cost code, and report configuration is manual. | AP clerks spend hours on data entry that AI could eliminate. | AI-first: auto-extract, auto-code, auto-match. |
| **Module licensing is complex.** Customers pay per module, per user, per concurrent session. | Companies limit who has access to save money, reducing adoption. | Simple per-company pricing. Everyone gets access. |
| **Reporting requires Crystal Reports expertise** or expensive custom report development. | Users can't self-serve reports. They wait for IT or consultants. | Built-in report builder + AI-generated reports from natural language queries. |

### Procore

| Pain Point | Impact | Pitbull Advantage |
|------------|--------|-------------------|
| **Procore is project management, not accounting.** It requires a separate accounting system (QuickBooks, Sage, Vista) and constant synchronization. | Double entry. Data conflicts. The "single source of truth" is actually two sources that don't agree. | One platform: project management AND accounting. No sync required. |
| **Unlimited-user pricing sounds good but starts at ~$10K/year** and scales with revenue. Mid-size GCs pay $30K–$75K/year. | Expensive for what you get — especially since you still need accounting software on top. | Competitive pricing that includes the full back office. |
| **Training is required.** Procore University is a multi-day investment for each role. | Delays time-to-value. New hires need training before they're productive. | AI-guided UX eliminates formal training. Users learn by doing. |
| **Financial management is an add-on,** not native. Budget, forecast, and cost tracking feel bolted on. | PMs who live in Procore still jump to Vista for "real" job cost reporting. | Job cost is native. PMs, controllers, and AP all see the same data. |

### Sage 300 CRE (formerly Timberline)

| Pain Point | Impact | Pitbull Advantage |
|------------|--------|-------------------|
| **Desktop application** that must be installed on every user's machine. | No mobile access. No field access without VPN. IT support burden. | Web-native. Works on any device with a browser. |
| **Pervasive SQL database** that's difficult to integrate with modern tools. | Custom integrations are expensive and fragile. | REST API-first architecture. Standard integrations. |
| **Steep learning curve.** Power users love it; everyone else avoids it. | Only 2–3 people in the office can use the system effectively. | Designed for the whole office, not just power users. |
| **No vendor/sub portal.** All communication is email, phone, or paper. | AP drowns in "where's my check?" calls. Subs submit paper pay apps. | Built-in vendor portal for status checks, invoice submission, and compliance. |

### Foundation Software

| Pain Point | Impact | Pitbull Advantage |
|------------|--------|-------------------|
| **Decent product but limited scalability.** Designed for small GCs and struggles above $50M revenue. | Growing companies have to migrate to Vista or Sage — painful and expensive. | Scales from $1M to $500M+ without re-platforming. |
| **Minimal automation.** Data entry is largely manual. | Same inefficiencies as larger systems, just cheaper. | AI-powered automation regardless of company size. |

---

## 10. Workflows

### New Customer Onboarding

```
Customer Signs Up
│
├── 1. Company Profile Collection
│   ├── Basics: name, type, size, state
│   ├── AI auto-configures: COA, cost codes, tax tables
│   └── AI recommends: module activation plan
│
├── 2. Data Migration
│   ├── Auto-detect: "I see a QuickBooks file — want to import?"
│   ├── Multi-source merge: QuickBooks + Excel + PDFs combined
│   ├── AI deduplication and validation
│   └── User review and confirmation
│
├── 3. Module Activation (progressive)
│   ├── Core modules auto-enabled
│   ├── Operational modules suggested based on company profile
│   ├── Advanced modules introduced when usage patterns indicate readiness
│   └── Each activation includes mini-onboarding for that module
│
├── 4. First Workflow Execution
│   ├── AI identifies the most valuable first action per role
│   ├── Guided walkthrough with real data (not sample data)
│   └── Celebration + next step suggestion
│
├── 5. Team Invitation
│   ├── Role-based invitation with tailored first-login
│   ├── Each role sees a personalized dashboard
│   └── Role-specific onboarding checklist
│
└── 6. Ongoing Optimization
    ├── Weekly AI health check: "Here's what's working, here's what to try"
    ├── Monthly success review: metrics, benchmarks, recommendations
    └── Quarterly business review: ROI analysis, feature roadmap preview
```

### Feature Release Rollout

```
New Feature Ready
│
├── 1. In-App Announcement
│   ├── Contextual: shown where the feature lives, not a generic banner
│   ├── Dismissable: user can say "not now" and get reminded later
│   └── Actionable: "Try it now" button that opens a guided demo
│
├── 2. Targeted Enablement
│   ├── Identify customers who would benefit most (from usage data)
│   ├── Proactive outreach: "We just launched X and based on your workflow, it could save you 3 hours/week"
│   └── Offer assisted setup for complex features
│
├── 3. Adoption Monitoring
│   ├── Track uptake per customer segment
│   ├── Identify friction points from dropoff data
│   └── Iterate on onboarding flow based on real usage
│
└── 4. Feedback Collection
    ├── In-app micro-surveys (2 questions max)
    ├── Usage analytics: what's used, what's ignored, what's confusing
    └── Support ticket categorization for feature-specific issues
```

---

## 11. Data Owned (Entities / Tables)

| Entity | Description | Key Fields |
|--------|-------------|------------|
| `CustomerAccount` | Customer company record in Pitbull | AccountId, CompanyName, CompanyType, EmployeeCount, PrimaryState, SubscriptionTier, SignupDate, OnboardingStatus, HealthScore |
| `OnboardingPlan` | Personalized onboarding checklist | AccountId, PlanVersion, Steps[], CompletedSteps[], EstimatedCompletionMinutes, ActualCompletionMinutes |
| `OnboardingStep` | Individual onboarding step | StepId, PlanId, StepType (Import/Configure/Workflow/Invite), Module, Status (Pending/InProgress/Completed/Skipped), StartedAt, CompletedAt, AIAssisted |
| `DataImport` | Import job tracking | ImportId, AccountId, Source (QuickBooks/Sage/Excel/CSV/PDF), Status, RecordsImported, RecordsFailed, ErrorLog, StartedAt, CompletedAt |
| `ModuleActivation` | Module activation per account | AccountId, ModuleId, ActivatedDate, ActivatedBy (User/AI/System), FirstUsedDate, UsageFrequency |
| `FeatureUsage` | Feature adoption tracking | AccountId, FeatureId, FirstUsedDate, LastUsedDate, UsageCount, UsageFrequencyBucket (Daily/Weekly/Monthly/Rare/Never) |
| `ChurnSignal` | Early warning signals | AccountId, SignalType, DetectedDate, Severity (Low/Medium/High/Critical), ResponseAction, ResolvedDate |
| `AIOnboardingSuggestion` | AI-generated suggestions | SuggestionId, AccountId, SuggestionType, Content, Presented, Accepted, DismissedAt, Context |
| `NPSSurvey` | Net Promoter Score surveys | AccountId, SurveyDate, Score, Verbatim, FollowUpAction, DaysSinceSignup |
| `CompetitiveIntel` | Competitive feature tracking | CompetitorId, FeatureArea, TheirApproach, OurAdvantage, PainPointsSolved, LastUpdated |
| `ProductRoadmapItem` | Roadmap items | ItemId, Title, Description, Module, Priority, CustomerRequestCount, Status (Backlog/Planned/InProgress/Shipped), TargetQuarter |

---

## 12. Dependencies on Other Roles

| Role | Dependency |
|------|-----------|
| **System Admin** | System Admin configures the platform infrastructure that the onboarding flow uses — module activation, user roles, integrations. Product Manager designs what the onboarding flow should be; System Admin ensures the configuration framework supports it. |
| **Controller/CFO** | Controller defines the chart of accounts and financial policies. Product Manager ensures the AI-generated default COA is accurate enough that Controllers only need to tweak it, not rebuild it. |
| **Project Manager** | PM is often the first power user. Product Manager ensures the PM's workflows (billing, job cost, change orders) are discoverable and functional on Day 1. |
| **AP Clerk** | AP Clerk processes the first vendor invoices. Product Manager ensures the AP workflow (OCR, auto-code, PO match) demonstrates AI value immediately. |
| **AR Clerk** | AR Clerk sends the first customer invoices. Product Manager ensures billing templates (AIA G702/G703, T&M, lump sum) are ready at onboarding. |
| **Payroll Manager** | Payroll is complex and often the last module activated. Product Manager designs a phased payroll onboarding that doesn't overwhelm during the first 2 hours but activates smoothly in Week 1–2. |
| **HR Director** | HR provides employee data that feeds multiple modules. Product Manager ensures employee import and setup is early in the onboarding flow to unblock downstream modules (payroll, timekeeping). |

---

## 13. Key Business Rules

1. **Onboarding is never "done" — it's a spectrum.** Track progress from 0% to 100% across all modules. Show the customer where they are and what's next.
2. **AI auto-population requires human confirmation for financial data.** Auto-generate the chart of accounts, but show it to the user before it goes live. One wrong account mapping cascades through every report.
3. **Data imports are idempotent.** A customer should be able to re-import from the same source without creating duplicates. Every import has merge logic.
4. **Module recommendations are based on evidence, not upselling.** Don't push payroll on a 3-person sub who uses a payroll service. Suggest it when usage patterns indicate they'd benefit.
5. **Onboarding progress persists across sessions.** If a user starts onboarding at 8 AM and comes back at 2 PM, they pick up exactly where they left off.
6. **Every onboarding step has a "skip for now" option.** Never block progress because a non-critical step isn't complete. Track skipped steps and remind later.
7. **The AI copilot is conversational, not prescriptive.** It suggests, explains, and helps — it doesn't demand or block. Users must always feel in control.
8. **Churn signals trigger automated AND human responses.** AI handles the nudges; the success team handles the conversations. Both are necessary.
9. **Competitive data is refreshed quarterly.** The Product Manager reviews competitor products, pricing, and positioning every quarter and updates internal docs.
10. **No feature ships without an onboarding plan.** Every new feature includes: discovery mechanism, first-use experience, help documentation, and adoption metrics.

---

## 14. Connection to Long-Term Vision

Pitbull's long-term vision is the full construction lifecycle: **Design → Build → Operate → Maintain** — delivered as a single web-native platform with AI at its core.

For the Product Manager, this means today's onboarding architecture must scale to tomorrow's capabilities:

### Phase 1: Back Office (Now)
- Accounting, job cost, payroll, project management, compliance
- 2-hour onboarding target
- AI auto-populates from existing data

### Phase 2: Field Operations (Next)
- Timekeeping from mobile devices, daily reports, safety checklists
- Onboarding extends: field staff get a mobile-first experience
- AI connects field data to office workflows in real time

### Phase 3: Preconstruction & Estimating
- Takeoffs, bidding, proposal generation
- Onboarding includes estimate import and bid template setup
- AI generates cost estimates from historical project data

### Phase 4: Digital Twins & BIM
- 3D building models linked to cost data, schedules, and maintenance records
- Onboarding includes model upload and data linking
- AI maps cost codes to model elements automatically

### Phase 5: CAD & Design Tools
- Web-native CAD for construction drawings, markups, and as-builts
- Full circle: design in Pitbull, build with Pitbull, operate with Pitbull
- The onboarding flow encompasses the entire building lifecycle

### The Product Manager's Role Across All Phases

At every phase, the Product Manager's core mission stays the same:
- **Map the dependencies.** New modules plug into the existing graph.
- **Design the user journey.** Each phase adds user personas (estimator, BIM coordinator, facility manager) with their own onboarding flows.
- **Maintain the 2-hour promise.** Even as the platform grows, a new customer's first experience should feel simple. Advanced capabilities reveal themselves as the customer is ready.
- **Measure everything.** New metrics for new modules, but the fundamentals (TTFV, retention, NPS) stay constant.

The Product Manager ensures that Pitbull doesn't become the next Vista — a powerful but impenetrable system that requires an army of consultants. The platform grows in capability while staying accessible. **Power and simplicity are not opposites — they're the design challenge.**

---

## 15. Key Reports

| Report | Frequency | Description |
|--------|-----------|-------------|
| **Onboarding Funnel** | Daily | Signup → Profile → Import → First Workflow → Operational. Dropoff at each step. |
| **Time-to-Value Distribution** | Weekly | Histogram of TTFV across all customers. Identify outliers and friction points. |
| **Module Adoption Matrix** | Weekly | Heat map of module usage by customer segment (size, type, age). |
| **AI Suggestion Performance** | Weekly | Acceptance rate, accuracy, and impact of AI suggestions by type. |
| **Churn Risk Dashboard** | Daily | All customers ranked by churn risk score with signal details. |
| **Feature Usage Depth** | Monthly | Which features are used daily vs. weekly vs. never. Guides deprecation and investment. |
| **Competitive Win/Loss** | Monthly | New customers by previous system. Lost prospects by chosen competitor. Reasons for both. |
| **NPS Trend** | Monthly | NPS score over time by cohort (signup month). Identifies systemic improvements or regressions. |
| **Support Ticket Analysis** | Weekly | Tickets categorized by module, feature, and root cause. Top 10 pain points ranked by volume. |
| **Data Import Health** | Daily | Import success rates by source, error types, and resolution time. |

---

## 16. Integration Points

```
                    ┌──────────────────────────┐
                    │     Product Manager       │
                    │  (Onboarding Orchestrator) │
                    └────────────┬─────────────┘
                                 │
        ┌────────────┬───────────┼───────────┬────────────┐
        │            │           │           │            │
   ┌────▼─────┐ ┌───▼────┐ ┌───▼────┐ ┌────▼─────┐ ┌───▼─────┐
   │ Customer │ │   AI   │ │ Module │ │ Analytics│ │ Success │
   │  Signup  │ │ Engine │ │ Config │ │ Platform │ │  Team   │
   └──────────┘ └────────┘ └────────┘ └──────────┘ └─────────┘
        │            │           │           │            │
        │       ┌────▼────┐     │      ┌────▼─────┐     │
        │       │  Data   │     │      │  Churn   │     │
        └───────► Import  │     │      │  Signal  │◄────┘
                │ Pipeline│     │      │  Engine  │
                └─────────┘     │      └──────────┘
                                │
                    ┌───────────▼───────────┐
                    │    All Functional     │
                    │    Modules (AP, AR,   │
                    │    Payroll, Job Cost, │
                    │    PM, HR, Banking)   │
                    └──────────────────────┘
```

### External Integration Points
- **QuickBooks Online/Desktop** — OAuth-based import of COA, vendors, customers, employees, transactions
- **Sage 300 CRE / Timberline** — File-based import of legacy data
- **Procore** — API integration for project data, RFIs, submittals (for customers transitioning)
- **State licensing boards** — Auto-verify contractor licenses and bond status
- **Insurance verification services** — Auto-pull subcontractor insurance certificates
- **IRS TIN matching** — Validate vendor tax information during import

---

*This document is a living reference for AI agent teams. When building any feature that touches onboarding, user experience, module activation, data migration, or customer success, consult this document to understand the Product Manager's perspective and priorities.*
