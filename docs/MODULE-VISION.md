# Pitbull Module Vision

> Strategic planning document - what we're building and why

## Core Philosophy

We're not building "yet another project management tool." We're building the **unified platform** that replaces:
- Vista/Viewpoint (ERP)
- Procore (PM)
- PlanGrid (field)
- Textura (payments)
- ADP/Paychex (payroll)
- BambooHR (HR)
- QuickBooks (small contractor accounting)
- Excel spreadsheets (everything else)

One platform. One database. Everything talks to everything.

---

## Current Modules (Shipped)

### ✅ Core
- Multi-tenant architecture
- RBAC (roles, permissions, JWT claims)
- User management

### ✅ Projects
- Project CRUD
- Project status workflow
- AI-powered project health summaries

### ✅ Bids
- Bid management
- Status workflow (Draft → Submitted → Won/Lost)
- Bid-to-Project conversion ready

### ✅ Contracts
- Subcontracts
- Change Orders
- Payment Applications

### ✅ RFIs
- RFI lifecycle
- Auto-numbering
- Status tracking

### ✅ TimeTracking
- Employees
- Time entries
- Approval workflow
- Labor cost calculations
- Vista export (CSV)

---

## Module Roadmap

### 🔴 ACCOUNTING (Priority 1 - Revenue Generator)

The accounting module is the **heart of any construction ERP**. This is where Vista lives, and this is what we need to replace.

#### Accounts Receivable (AR)
- [ ] Customer master
- [ ] Invoicing (progress billing, T&M, lump sum)
- [ ] Payment receipts
- [ ] Aging reports
- [ ] Retention tracking
- [ ] Integration with Payment Applications (Contracts module)

#### Accounts Payable (AP)
- [ ] Vendor master
- [ ] Invoice entry (with PO matching)
- [ ] Payment processing
- [ ] 1099 tracking
- [ ] Lien waiver management
- [ ] Aging reports

#### General Ledger (GL)
- [ ] Chart of accounts
- [ ] Journal entries
- [ ] Period close
- [ ] Trial balance
- [ ] Financial statements (Income Statement, Balance Sheet, Cash Flow)
- [ ] Multi-company consolidation

#### Job Cost (JC)
- [ ] Cost codes (already have basic structure)
- [ ] Budget vs actual
- [ ] Cost-to-complete projections
- [ ] WIP (Work in Progress) schedule
- [ ] Over/under billing analysis
- [ ] Committed costs tracking
- [ ] Equipment costing

#### Contract Management (CM)
- [ ] Prime contracts (owner-side)
- [ ] Billings schedule
- [ ] SOV (Schedule of Values)
- [ ] AIA billing format (G702/G703)
- [ ] Retention schedules

#### Finance
- [ ] Cash flow forecasting
- [ ] Bank reconciliation
- [ ] Credit card reconciliation
- [ ] Investment tracking

#### Reporting
- [ ] GAAP-compliant financial statements
- [ ] Bonus reporting (separate from GAAP - construction-specific)
- [ ] Custom report builder
- [ ] Audit trail (every transaction traceable)
- [ ] Period comparison (YoY, MoM)

### 🔴 PAYROLL (Priority 2 - Compliance Critical)

#### Core Payroll
- [ ] Pay rates (regular, OT, DT, shift differentials)
- [ ] Pay periods (weekly, bi-weekly, semi-monthly)
- [ ] Timecard import (from TimeTracking module)
- [ ] Earnings calculations
- [ ] Deductions (pre-tax, post-tax, garnishments)
- [ ] Direct deposit / check printing
- [ ] Pay stubs

#### Certified Payroll
- [ ] Prevailing wage rates by locality
- [ ] WH-347 (federal certified payroll)
- [ ] State-specific certified payroll formats
- [ ] Fringe benefit tracking
- [ ] Apprentice ratio compliance

#### Payroll Compliance
- [ ] Federal tax deposits (941, 940)
- [ ] State tax deposits
- [ ] W-2 / W-3 generation
- [ ] 1099 generation
- [ ] New hire reporting
- [ ] Workers' comp reporting
- [ ] Union reporting (if applicable)

### 🟡 HUMAN RESOURCES (Priority 3 - Differentiator)

#### Applicant Tracking (ATS)
- [ ] Job postings
- [ ] Application intake
- [ ] Resume parsing (AI opportunity)
- [ ] Interview scheduling
- [ ] Offer letters
- [ ] Background check integration

#### Onboarding
- [ ] Document collection (I-9, W-4, direct deposit)
- [ ] Equipment assignment
- [ ] Training assignment
- [ ] Policy acknowledgments
- [ ] Welcome workflow automation

#### Benefits Administration
- [ ] Plan enrollment
- [ ] Life events
- [ ] Open enrollment
- [ ] COBRA administration
- [ ] Benefits cost tracking

#### Leave Management
- [ ] PTO accrual and tracking
- [ ] FMLA tracking and compliance
- [ ] Leave of absence workflows
- [ ] State-specific leave laws (CA, NY, etc.)

#### 401k & Retirement
- [ ] Contribution tracking
- [ ] Employer match calculations
- [ ] Vesting schedules
- [ ] 401k reporting (5500 support)

#### Compliance Reporting
- [ ] EEO-1 reporting
- [ ] OSHA 300 log
- [ ] State-specific requirements
- [ ] Disability reporting
- [ ] Federal contractor compliance (OFCCP)

#### Employee Data Warehouse
- [ ] Employment history
- [ ] Education history
- [ ] Performance reviews
- [ ] Training & certifications (with expiration tracking)
- [ ] Skills inventory
- [ ] Compensation history
- [ ] Disciplinary records
- [ ] Emergency contacts

---

## Gap Analysis: Current vs Vision

| Area | Current State | Gap |
|------|--------------|-----|
| **Project Management** | ✅ Solid foundation | Need document management, submittals |
| **Bidding** | ✅ Basic workflow | Need bid leveling, takeoff integration |
| **Contracts** | ✅ Subcontracts, COs, Pay Apps | Need prime contracts, AIA billing |
| **Time Tracking** | ✅ Full CRUD + approvals | Need mobile app, GPS/geofence |
| **Job Costing** | 🟡 Cost codes exist | Need full JC module with WIP |
| **Accounting** | 🔴 Not started | Full module needed |
| **Payroll** | 🔴 Not started | Full module needed |
| **HR** | 🔴 Not started | Full module needed |

---

## Phased Approach

### Phase 1: Foundation (DONE ✅)
- Multi-tenant, RBAC, Projects, Bids, Contracts, RFIs, TimeTracking
- 806 tests, Railway deployed

### Phase 2: HR Core (NEXT)
- **Employee data warehouse** - the source of truth
- Employment history, pay rates (with effective dates), classifications
- Certifications & training (with expiration tracking)
- Absorbs/replaces thin Employee entity from TimeTracking
- **Why first:** Can't do payroll or job costing without employees

### Phase 3: Payroll
- Payroll calculations from TimeTracking data
- Tax compliance, deductions
- Certified payroll (huge construction differentiator)
- **Why second:** Needs HR employee data + TimeTracking hours

### Phase 4: Job Costing
- Full budget vs actual by cost code
- Labor burden calculations (uses Payroll rates)
- WIP schedule, cost-to-complete
- **Why third:** Needs employees + time + actual pay rates

### Phase 5: Accounting Core
- GL, Chart of Accounts
- AP (vendor invoices, PO matching)
- AR (progress billing, retention)
- Financial statements
- **Why fourth:** JC feeds the numbers, Accounting reports them

---

## Agent Automation Vision

The core functions are **primitives that agents orchestrate**:

| Function | Agent Use Case |
|----------|---------------|
| **HR.CreateEmployee** | Onboarding agent processes new hire paperwork |
| **Payroll.CalculatePay** | Payroll agent runs weekly/bi-weekly cycles |
| **Payroll.GenerateCertified** | Compliance agent produces certified payroll on demand |
| **JC.ProjectCostToComplete** | PM agent forecasts project financials |
| **AR.GenerateProgressBilling** | Billing agent creates AIA pay apps from SOV |
| **AP.MatchInvoiceToPO** | AP agent processes vendor invoices |
| **GL.ReconcileBank** | Accounting agent handles bank recs |

Build the API right, agents handle the repetitive work.

---

## Competitive Advantage

1. **Unified platform** - No more data silos, no more integrations to maintain
2. **AI-first** - Document analysis, compliance checking, anomaly detection
3. **Construction-native** - Built by people who know construction, not adapted from generic software
4. **Cloud-only** - No on-prem headaches, always current
5. **Modern UX** - Not a 1990s interface with a fresh coat of paint

---

*Last updated: February 8, 2026*
