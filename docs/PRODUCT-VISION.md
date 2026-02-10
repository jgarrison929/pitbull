# Pitbull Product Vision - Full Module Map

**Last Updated:** 2026-02-10
**Status:** Long-term roadmap (not all built now)

This documents where we want the platform to go. Current Alpha focuses on core modules; this is the full ERP vision.

---

## 🏗️ Project Management Module

### Jobs
- Job Master (project setup, details, status)
- Job Cost (cost tracking, budget vs actual)
- Phase Setup (WBS, phases, cost code assignments)

### Change Orders
- Owner Change Orders (contract modifications)
- Subcontractor Change Orders (linked to subs)
- CO Approval Workflow

### Submittals
- Submittal Log
- Submittal Review/Approval
- Spec Section Linking

### RFIs
- RFI Log
- RFI Response Tracking
- Drawing/Spec References

---

## 💰 Accounting Module

### AP (Accounts Payable)
- **AP Entry** - Invoice entry, coding
- **AP Review** - Approval workflow
- **AP Lookup** - Search/query invoices
- **AP Vendor Master** - Vendor setup, 1099 tracking, payment terms

### CM (Cash Management)
- **Cash Management Entry** - Receipts, disbursements
- **Cash Management Review** - Approval workflow
- **Cash Management Reporting** - Cash flow, bank reconciliation

### GL (General Ledger)
- **GL Transactions** - Journal entries, transaction log
- **GL Chart of Accounts** - Account setup, hierarchy
- **GL Code Setup** - Cost types, categories
- **GL Entry** - Manual journal entries
- **GL Reconciliation** - Period close, account reconciliation
- **GL Reporting** - Trial balance, financial statements

---

## 👥 HR (Human Resources) Module

### HR Employee Master
Central employee record linking to all sub-modules:

#### Employee Profile
- Basic info, contact, emergency contacts
- Interview Comments
- Payroll Information (rates, deductions, tax setup)
- Contacts (references, emergency)
- Dependents
- Work Schedule
- Previous Work Experience
- Education

#### Tracking & History
- **Accident Tracking** + History
- **Benefits** + Benefits Tracking History
- **Grievances** + Grievance Tracking History
- **Training/Continuing Education**
- **Review History** (performance reviews)
- **Disciplinary Action History**
- **Skills History**
- **Salary History**
- **Reward History**
- **Dependents History**

#### Compliance
- **ACA Lookback** - Affordable Care Act tracking

### HR Asset Tracking
Track company assets issued to employees:
- Keys
- Vehicles
- Gas cards / Company credit cards
- Mobile phones
- Laptops / Computers
- iPads / Tablets
- Any company asset

**Purpose:** Know exactly what to retrieve during offboarding.

### HR Reports
- Headcount reports
- Turnover analysis
- Benefits enrollment
- Training compliance
- Asset inventory by employee

---

## 🔐 System Admin Module

### User Management
- **Add User** - User provisioning
- **Modify User** - Profile updates, status changes
- **Roles** - Role definitions, permissions

### Security Module
Granular security by:
- **Forms** - Which forms users can access
- **Reports** - Which reports users can run
- **Attachment Security Types** - Document access control
- **Module-level** - Enable/disable entire modules
- **Form-level** - Field-level permissions within forms

---

## 📊 Data Warehouse (Future)

As data grows, scale to:
- Separate OLTP (transactional) from OLAP (analytical)
- Star/snowflake schema for reporting
- Historical data retention
- Cross-module analytics
- Executive dashboards

---

## Current State (Alpha 0)

**Built:**
- ✅ Projects (basic)
- ✅ Bids
- ✅ RFIs (basic)
- ✅ TimeTracking
- ✅ Employees (basic)
- ✅ Contracts (Subcontracts, COs, Pay Apps)
- ✅ RBAC (Roles, Users)
- ✅ Multi-tenancy

**Next (Alpha 1 / Beta):**
- Documents module
- Portal (sub self-service)
- Billing (owner billing)

**Future:**
- Full Accounting (AP, CM, GL)
- Full HR suite
- Security module expansion
- Data warehouse

---

## Architecture Notes

- Each major module = separate Pitbull.* assembly
- Shared kernel in Pitbull.Core
- Multi-tenant by default (RLS)
- API-first (all UI through REST endpoints)
- Event-driven where modules need to communicate
