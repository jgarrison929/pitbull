# Domain Expertise Agents — Construction ERP

**Author:** Josh Garrison
**Date:** 2026-02-17
**Status:** Roadmap directive

## Purpose

Build domain expertise agents into Claude Code agent teams to debate workflows and implementation decisions. These agents represent real construction industry roles and ensure features are built with best-of-breed practices, not developer assumptions.

## Domain Expertise Roles

Each role brings a specific perspective to feature design and implementation:

### Field Operations
- **Foreman** — Crew management, daily time entry, equipment tracking, field productivity
- **General Foreman** — Multi-crew coordination, resource allocation, labor planning
- **Superintendent** — Site-level management, schedule oversight, subcontractor coordination, safety compliance
- **Field Engineer** — Survey, layout, quality control, as-built documentation, field problem solving

### Project Management
- **Project Engineer** — RFIs, submittals, document control, cost tracking, change management
- **Project Manager** — Budget ownership, schedule management, owner relations, risk assessment, revenue projection
- **Scheduler** — CPM scheduling, resource leveling, delay analysis, schedule updates, look-ahead planning

### Estimating & Preconstruction
- **Estimator** — Quantity takeoff, bid assembly, subcontractor scoping, bid day coordination, historical cost data

### Executive Leadership
- **CEO** — Strategic decisions, market positioning, growth planning, investor relations
- **CFO** — Financial reporting (GAAP + Bonus), cash flow management, banking relationships, bonding capacity
- **CTO** — Technology strategy, system architecture, integration decisions, AI/automation roadmap
- **CIO** — IT infrastructure, security, compliance, system administration, user management

### Finance & Accounting
- **Job Cost Accountant** — Cost coding, budget tracking, cost-to-complete, WIP schedules, over/under billing
- **Accounts Payable** — Vendor payments, subcontractor pay apps, retention, lien waivers
- **Accounts Receivable** — Owner billing, payment applications, AIA documents, collections
- **General Ledger** — Chart of accounts, journal entries, month-end close, intercompany transactions
- **Cash Management** — Cash forecasting, debt service, equipment financing, project cash flow

### Support Functions
- **HR** — Employee onboarding, labor compliance, certified payroll, prevailing wage, benefits administration
- **Safety** — OSHA compliance, incident tracking, safety plans, toolbox talks, EMR management
- **Risk Manager** — Insurance requirements, subcontractor compliance, bonding, contract review, claims management
- **Legal** — Contract terms, dispute resolution, lien rights, regulatory compliance
- **Marketing** — Proposal writing, qualification statements, client relationship management
- **IT** — System administration, user provisioning, integrations, mobile device management
- **Commissioning** — System startup, testing/balancing, closeout documentation, warranty management

## Functional Areas (ERP Core)

These agents debate and validate implementation across these standardized ERP domains:

### Financial
- **Accounting** — GAAP and Bonus dual-book support
- **Job Costing** — Cost codes, phases, cost types, budget vs actual, forecasting
- **Accounts Payable** — Invoice processing, payment scheduling, 1099 tracking
- **Accounts Receivable** — Billing cycles, retention, payment tracking
- **General Ledger** — Chart of accounts, financial statements, period close
- **Cash Management** — Cash flow projection, bank reconciliation
- **Payroll** — Time entry → payroll processing → export, union/prevailing wage, certified payroll

### Project Delivery
- **Construction Project Management** — Schedule, budget, RFIs, submittals, daily reports, change orders
- **Engineering** — Document management, revision control, drawing sets, specifications
- **Contract & Risk Management** — Contract lifecycle, insurance tracking, compliance workflows, lien management
- **Subcontractor Payments & Compliance** — Pay applications, retention, lien waivers, insurance verification, prequalification

### Operations
- **HR & Labor Compliance** — Hiring, onboarding, certifications, prevailing wage, EEO reporting
- **IT Applications Development** — API integrations, custom workflows, automation
- **Mobile Device Workflows** — Field data capture, offline capability, photo documentation
- **Service Management** — Work orders, dispatch, preventive maintenance, warranty tracking

## Target Market Segments

The core ERP functionality is standardized. Company setup and onboarding toggles configure the system for each contractor type:

### Heavy/Civil
- **Civil General Contractors** — Earthwork, site development, utilities, concrete
- **Heavy Highway** — Roads, bridges, interchanges, DOT compliance
- **Road and Bridge** — Paving, structural, traffic management
- **Water and Waste Water Treatment** — Process piping, mechanical, electrical, instrumentation
- **Gas Pipeline Distribution** — Pipeline construction, directional drilling, compliance/safety

### Building
- **Architects** — Design management, specifications, bidding support
- **Engineering Firms** — Design-build, consulting, inspection services

### Specialty
- **Electrical Contractors** — Power distribution, low voltage, fire alarm, controls
- **Mechanical/HVAC/Plumbing** — Mechanical systems, service management, preventive maintenance
- **Professional Services Contractors** — Consulting, inspection, testing, commissioning
- **Commissioning** — System startup, performance verification, closeout

## Implementation Strategy

### In Claude Code Agent Teams
When building a feature, include relevant domain experts as team members:
- Building time entry? Include: Foreman, Payroll, Job Cost Accountant, PM
- Building payment applications? Include: AP, PM, CFO, Risk Manager, Legal
- Building scheduling? Include: Scheduler, Superintendent, PM, Field Engineer
- Building HR onboarding? Include: HR, Safety, Legal, Payroll

### Company Setup / Onboarding
Each contractor type gets a setup profile that pre-configures:
- Enabled modules
- Default cost code structures
- Industry-specific terminology
- Compliance requirements (prevailing wage, certified payroll, DOT, etc.)
- Report templates
- Workflow defaults

### Settings Per Module
Every module has a settings page (company-scoped) that allows customization within GAAP/industry constraints. Follow the `TimecardSettings` pattern.
