# Functional Role Reference Docs

> **Audience:** AI agent teams building Pitbull Construction Solutions ERP
> **Last updated:** 2026-02-19

---

## Overview

These documents define the eight core functional roles in a construction company's back office. Each role doc describes what that person does, what data they own, what workflows they execute, how they interact with other roles, and how AI agents should assist them. These are the primary reference documents for building Pitbull's product — every feature should be traceable to one or more role docs.

---

## Role Index

### [AP-CLERK.md](./AP-CLERK.md) — Accounts Payable Clerk

The AP Clerk is the gatekeeper of outbound cash. They process vendor invoices, manage subcontractor pay applications, execute payment runs, track retention, collect lien waivers, monitor insurance compliance, and handle 1099 reporting. In construction, AP is uniquely complex because subcontractor payments involve progress billings, retention withholding, compliance gates, and lien law requirements. This doc covers the full AP lifecycle from vendor setup through payment processing, including detailed lien waiver flows and the AI automation opportunities that eliminate manual invoice entry and compliance tracking.

### [AR-CLERK.md](./AR-CLERK.md) — Accounts Receivable Clerk

The AR Clerk is the revenue collection engine. They turn earned work into cash by managing owner billings (AIA G702/G703 pay applications, T&M invoices, lump sum billings), tracking receivables, processing payments, and managing retention receivable. Construction AR is complex because billing formats vary by contract type, retention is standard, and cash collection directly impacts the company's ability to pay its own vendors and subcontractors. This doc covers billing workflows, payment application, AR aging management, and how AI can auto-generate billings from schedule of values data.

### [CONTROLLER-CFO.md](./CONTROLLER-CFO.md) — Controller / CFO

The Controller is the chief financial steward, maintaining two parallel accounting views: standard GAAP financials and construction-specific job cost accounting. They own the general ledger, WIP (Work-in-Progress) schedule, revenue recognition (percentage-of-completion method), financial statements, bank reconciliations, and period close processes. This doc covers the unique challenge of construction accounting where the WIP schedule — not the income statement — tells the true financial story, and how AI can automate the most painful monthly processes like WIP preparation and variance analysis.

### [HR-DIRECTOR.md](./HR-DIRECTOR.md) — HR Director

The HR Director manages the employee lifecycle in an industry with extreme regulatory complexity. Construction HR deals with union labor agreements, prevailing wage requirements, multi-state employment, OSHA compliance, high turnover in field positions, and seasonal workforce fluctuations. This doc covers employee onboarding, benefits administration, compliance tracking, safety program management, and workforce planning. AI opportunities include automated compliance monitoring, predictive turnover analysis, and streamlined multi-state tax setup for employees who work across jurisdictions.

### [PAYROLL-MANAGER.md](./PAYROLL-MANAGER.md) — Payroll Manager

The Payroll Manager is the execution engine for employee compensation, applying the complex rules of construction payroll: union rates, prevailing wages, multi-state withholding, certified payroll reporting, garnishments, and fringe benefits. They transform approved timecards into accurate paychecks, tax deposits, union remittances, and government reports. This doc covers the full payroll cycle from timecard approval through check/ACH distribution, including the intricate calculations required for Davis-Bacon prevailing wage projects and multi-union environments where a single employee may work under different agreements in the same week.

### [PRODUCT-MANAGER.md](./PRODUCT-MANAGER.md) — Product Manager

The Product Manager is the customer onboarding orchestrator. They own the path from signup to a fully operational back office — designing for a 2-hour time-to-value that makes Vista's 6-month implementations obsolete. This doc covers the module dependency graph (you can't bill without projects, can't pay without employees, can't track costs without cost codes), the user journey from Day 1 through Month 1, the metrics that matter (TTFV, feature adoption, churn signals), and the predictive UX philosophy of anticipating what users need before they ask. It also covers competitive pain points, AI-assisted onboarding, and how the onboarding architecture scales as Pitbull expands to digital twins, BIM, and CAD.

### [PROJECT-MANAGER.md](./PROJECT-MANAGER.md) — Project Manager

The Project Manager is the revenue engine of a construction company. They own the projects that generate all income — managing contracts, budgets, cost tracking, change orders, subcontracts, billings, and schedules. The PM lives at the intersection of field operations and financial management, translating physical construction progress into financial data that drives every other role's work. This doc covers project lifecycle management, cost control workflows, billing processes, subcontractor management, and how AI can provide real-time cost forecasting, automated change order impact analysis, and predictive schedule alerts.

### [SYSTEM-ADMIN.md](./SYSTEM-ADMIN.md) — System Administrator

The System Administrator is the operations backbone of Pitbull. They turn on modules, create user accounts, assign roles, configure integrations, import data from legacy systems, and monitor system health. In most construction companies, this person wears multiple hats — they might be the office manager, IT manager, or a Controller who also handles the software. This doc covers platform configuration, user management, data migration, integration setup, security administration, and how AI reduces the admin burden so that a non-technical office manager can confidently manage a full ERP deployment without consultants or IT staff.

---

## How to Use These Docs

1. **Building a new feature?** Find the role(s) it serves and read their doc(s). Understand their workflows, pain points, and what they expect from the system.
2. **Designing a UI?** The role doc tells you what data the user needs to see, what actions they take, and what decisions require human judgment vs. AI automation.
3. **Writing AI agent logic?** The "AI Agent Assistance Opportunities" section in each doc lists specific behaviors the AI should exhibit for that role.
4. **Resolving a design conflict?** Role dependencies (Section 5 in each doc) show how roles interact. If AP needs something from PM, both docs describe the handoff.
5. **Prioritizing work?** The pain points section in each doc identifies where legacy systems fail. These are Pitbull's highest-value opportunities.

---

## Architecture Principle

Every role doc follows the same structure:

1. Role Description
2. Core Responsibilities
3. Data Owned (Entities/Tables)
4. Modules Used Daily
5. Dependencies on Other Roles
6. Workflows
7. Key Reports
8. AI Agent Assistance Opportunities
9. Pain Points in Vista/Legacy Systems
10. Key Business Rules
11. Integration Points
12. Connection to Long-Term Vision

This consistency ensures AI agent teams can quickly find the information they need across any role.

---

*These documents are living references. Update them as the product evolves, new workflows emerge, and new roles are identified.*
