# System Administrator — Functional Role Reference

> **Audience:** AI agent teams building Pitbull Construction Solutions ERP
> **Last updated:** 2026-02-19

---

## 1. Role Description

The System Administrator is the **operations backbone** of Pitbull. They are the person who makes the platform work for everyone else — the one who turns on modules, creates user accounts, assigns roles, configures integrations, imports data from legacy systems, and monitors system health. In most construction companies, this person wears multiple hats: they might be the office manager, the IT manager, or a Controller who also handles the software.

What makes this role unique in construction ERP:

- **Module activation order matters.** You can't configure billing without projects. You can't process payroll without employees. You can't track job cost without a chart of accounts. The System Admin must understand the dependency chain and activate modules in the right sequence.
- **Data migration is the hardest part of go-live.** Most customers are coming from Vista, Sage 300, Foundation, QuickBooks, or spreadsheets. Importing years of vendor records, employee data, project history, and GL balances is complex, error-prone, and high-stakes. The System Admin orchestrates this.
- **Role-based access in construction is nuanced.** A PM should see their projects but not other PMs' projects. The Controller sees everything financial but not HR details like SSNs. Field workers see their timecards and pay stubs only. The System Admin designs and enforces this security model.
- **Integrations are critical.** Construction companies use banks (ACH, positive pay), insurance certificate services (myCOI, PINS), scheduling tools (P6, MS Project), estimating tools, and government portals (E-Verify, LCPtracker). The System Admin configures and monitors these connections.

The System Admin is the **enabler** — they don't use the ERP to do accounting or manage projects. They make it possible for everyone else to do so, efficiently and securely.

### Design Principle

> **Predict what the user wants and offer it before they even know they want it.** When a new company signs up, the system should guide the System Admin through a logical setup sequence, pre-configuring defaults based on company profile (size, trade, union status, states). The goal: from signup to operational in 2 hours, not 2 weeks.

---

## 2. Core Responsibilities

| Area | Description |
|------|-------------|
| **Module Activation** | Enable platform modules in the correct dependency order. Configure each module's settings before users access it. |
| **User Provisioning** | Create user accounts, assign roles and permissions, manage access levels. Handle onboarding (new users) and offboarding (access revocation). |
| **Role & Permission Management** | Define roles (PM, Controller, AP Clerk, etc.) with appropriate permissions. Manage field-level and record-level security (e.g., PM can see only their projects). |
| **Company Configuration** | Set up company master data: legal entities, addresses, fiscal year, tax IDs, bank accounts, logo, default settings. |
| **Data Import / Migration** | Import data from legacy systems (Vista, Sage, Foundation, CSV). Map fields, validate data, resolve conflicts, and verify accuracy post-import. |
| **Chart of Accounts Setup** | Configure or import the GL account structure. Map cost categories to GL accounts. Set up default posting rules. |
| **Integration Configuration** | Set up connections to external systems: banks, insurance trackers, scheduling tools, government portals, email servers. Monitor connection health. |
| **System Health Monitoring** | Monitor performance, storage, error logs, failed jobs, integration sync status. Ensure the platform is running smoothly. |
| **Period Management** | Set up fiscal periods, manage period open/close status in coordination with the Controller. |
| **Backup & Recovery** | Understand data backup policies, recovery procedures, and disaster recovery. (In a SaaS model, much of this is platform-managed, but the Admin must know the policies.) |
| **Support Escalation** | First point of contact for user issues. Resolves configuration problems, escalates bugs to Pitbull support. |
| **Training Coordination** | Ensure new users understand their modules. Coordinate with Pitbull onboarding team for training sessions. |

---

## 3. Data Owned (Entities / Tables)

| Entity | Description | Key Fields |
|--------|-------------|------------|
| `Company` | Company master record | CompanyId, LegalName, DBA, TaxId (encrypted), Address, Phone, Website, FiscalYearStart, Logo, Industry, EmployeeCount, StateRegistrations |
| `User` | User accounts | UserId, Email, Name, Status (Active/Inactive/Locked), CreatedDate, LastLoginDate, MFAEnabled, PasswordLastChanged |
| `Role` | Role definitions | RoleId, RoleName, Description, IsSystem (built-in vs. custom), Permissions (JSON) |
| `UserRole` | User-to-role assignment | UserId, RoleId, Scope (Global/Entity/Project), ScopeId, EffectiveDate, ExpirationDate |
| `Permission` | Granular permissions | PermissionId, Module, Action (Create/Read/Update/Delete/Approve/Export), Resource, Description |
| `Module` | Module registry | ModuleId, ModuleName, Status (Inactive/Active/Configuring), ActivatedDate, ActivatedBy, DependsOn (array of ModuleIds), ConfigStatus |
| `ModuleConfig` | Module settings | ModuleId, ConfigKey, ConfigValue, Description, RequiredBeforeActivation |
| `Integration` | External system connections | IntegrationId, IntegrationType (Bank/Insurance/Scheduler/Government/Email), Name, Status (Active/Error/Disabled), LastSyncDate, Config (encrypted JSON) |
| `DataImport` | Import job tracking | ImportId, SourceSystem, ImportType (Vendor/Employee/Project/GL/Transaction), FileName, Status (Uploaded/Validating/Validated/Importing/Complete/Failed), RecordCount, ErrorCount, ImportedBy, ImportDate |
| `DataImportError` | Import error log | ImportId, RowNumber, FieldName, ErrorType, ErrorMessage, SourceValue, Resolution |
| `AuditLog` | System-wide audit trail | LogId, Timestamp, UserId, Action, EntityType, EntityId, OldValue, NewValue, IPAddress, Module |
| `SystemAlert` | System health alerts | AlertId, AlertType (Error/Warning/Info), Source, Message, Timestamp, Acknowledged, AcknowledgedBy |
| `FiscalPeriod` | Period definitions | Year, Period, StartDate, EndDate, Status (Open/SoftClose/HardClose), ClosedBy, ClosedDate |
| `EmailTemplate` | System email templates | TemplateId, TemplateName, Subject, Body, Variables, Module, IsActive |
| `CompanySettings` | Global settings | SettingKey, SettingValue, Category, Description, ModifiedBy, ModifiedDate |

---

## 4. Module Activation Order and Dependencies

This is the **critical knowledge** the System Admin must understand. Modules have dependencies — activating them out of order causes configuration errors and user confusion.

```
PHASE 1: Foundation (Must be first)
├── Company Setup          — Legal entity, addresses, tax IDs, fiscal year
├── Chart of Accounts      — GL structure (can import from template or legacy)
├── Banking                — Bank accounts linked to GL cash accounts
└── User Management        — Admin account, initial roles

PHASE 2: Core Operations (Requires Phase 1)
├── Employee Management    — Requires: Company Setup
│   └── Employee master records, classifications, certifications
├── Vendor Management      — Requires: Company Setup
│   └── Vendor master records, compliance tracking, W-9s
├── Customer Management    — Requires: Company Setup
│   └── Customer/owner master records, billing configuration
└── Project Management     — Requires: COA, Customer Management
    └── Project setup, SOV, cost codes, budgets

PHASE 3: Transactions (Requires Phase 2)
├── Accounts Payable       — Requires: Vendor Management, COA, Banking
│   └── Invoice processing, PO matching, payment runs
├── Accounts Receivable    — Requires: Customer Management, Project Mgmt, COA
│   └── Billing, payment applications, cash receipts
├── Payroll                — Requires: Employee Management, COA, Banking
│   └── Timecard processing, pay calculation, tax filing
└── Purchasing             — Requires: Vendor Management, Project Management
    └── Purchase orders, material tracking

PHASE 4: Advanced (Requires Phase 3)
├── Job Cost               — Requires: Project Mgmt, AP, AR, Payroll
│   └── Cost tracking, budget vs. actual, forecasting
├── Subcontract Management — Requires: Vendor Mgmt, Project Mgmt, AP
│   └── Subcontract setup, pay apps, compliance, retention
├── Certified Payroll      — Requires: Payroll, Project Management
│   └── WH-347 reports, prevailing wage compliance
└── Union Administration   — Requires: Employee Mgmt, Payroll
    └── CBA management, fringe calculations, trust fund reporting

PHASE 5: Intelligence (Requires Phase 4)
├── Financial Reporting    — Requires: GL, AP, AR, Payroll all posting
│   └── WIP schedule, financial statements, bonding packages
├── Document Management    — Can activate anytime but most useful after Phase 3
│   └── Store/retrieve docs linked to all entities
├── Dashboards & Analytics — Requires: Transaction data flowing
│   └── Real-time KPIs, trend analysis, AI insights
└── Compliance Center      — Requires: Employee, Vendor, Project data
    └── Insurance tracking, cert management, regulatory reporting
```

### Module Configuration Checklist (Per Module)

Each module has settings that must be configured before users access it:

| Module | Key Configuration Items |
|--------|------------------------|
| **Chart of Accounts** | Import or create account structure, set account types, configure auto-posting rules |
| **Employee Management** | Trade codes, classifications, certification types, onboarding workflow steps |
| **Vendor Management** | Vendor categories, compliance requirements, default payment terms, 1099 rules |
| **Customer Management** | Billing formats (AIA, custom), default payment terms, retention defaults |
| **Project Management** | Cost code templates, phase templates, project numbering scheme, default retention rates |
| **Accounts Payable** | Approval workflows, payment methods, check stock setup, positive pay format, tax form config |
| **Accounts Receivable** | G702/G703 templates, billing calendar defaults, collection workflow rules |
| **Payroll** | Pay frequencies, tax jurisdictions, benefit codes, earning/deduction types, certified payroll config |
| **Banking** | Bank connections, ACH formats, positive pay formats, reconciliation rules |
| **Integrations** | API keys, connection strings, sync schedules, field mappings |

---

## 5. Modules Used Daily

| Module | Usage |
|--------|-------|
| **Admin Console** | Primary workspace. User management, module config, system health. |
| **User Management** | Create accounts, assign roles, manage access, review login activity. |
| **Module Configuration** | Activate modules, configure settings, manage dependencies. |
| **Data Import** | Run and monitor data imports from legacy systems. |
| **Integration Hub** | Monitor integration health, configure connections, troubleshoot sync errors. |
| **Audit Log** | Review user activity, investigate issues, support compliance inquiries. |
| **System Health** | Monitor performance, storage, error rates, background job status. |
| **Support Portal** | Submit and track support tickets with Pitbull team. |

---

## 6. Dependencies on Other Roles

| Role | Dependency |
|------|-----------|
| **Controller/CFO** | Controller defines the chart of accounts that System Admin imports/configures. Controller determines fiscal periods and approval workflows. Controller is often the decision-maker on module activation timing. |
| **HR Director** | HR provides employee classification structures, certification types, and onboarding workflow requirements that System Admin configures. |
| **Payroll Manager** | Payroll Manager defines pay frequencies, earning/deduction codes, tax jurisdictions, and certified payroll requirements that System Admin configures. |
| **Project Manager** | PM defines cost code templates, project structures, and SOV formats that System Admin configures. |
| **AP Clerk** | AP defines vendor categories, approval workflows, and payment method requirements that System Admin configures. |
| **AR Clerk** | AR defines billing formats, customer setup requirements, and collection workflow rules that System Admin configures. |
| **Product Manager** | Product Manager (Pitbull side) defines the onboarding sequence, module activation order, and setup wizards that the System Admin follows. |

---

## 7. Workflows

### Initial Company Onboarding (The 2-Hour Path)

```
HOUR 1: Foundation Setup
│
├── 0:00 - 0:10  Account Created / Welcome
│   ├── Company name, admin email, password
│   ├── AI: "What type of construction? GC, sub, specialty?"
│   ├── AI: "How many employees? 10-50, 50-200, 200+?"
│   ├── AI: "Union, non-union, or both?"
│   └── AI: Pre-configures defaults based on profile
│
├── 0:10 - 0:20  Company Setup
│   ├── Legal entity details, addresses, tax IDs
│   ├── Fiscal year (most construction = calendar year)
│   ├── State registrations
│   └── Logo upload
│
├── 0:20 - 0:35  Chart of Accounts
│   ├── Option A: Use Pitbull construction template (recommended)
│   ├── Option B: Import from legacy system (Vista, Sage CSV)
│   ├── Option C: Custom build (rare for initial setup)
│   └── AI: Suggests accounts based on company type and size
│
├── 0:35 - 0:45  Banking Setup
│   ├── Add bank accounts
│   ├── Link to GL cash accounts
│   └── Configure ACH/check settings
│
├── 0:45 - 0:60  User Setup (First Wave)
│   ├── Create user accounts for key staff
│   ├── Assign roles (Controller, PM, AP, AR, Payroll, HR)
│   ├── Send invitation emails
│   └── AI: Suggests roles based on job titles entered
│
HOUR 2: Module Activation
│
├── 1:00 - 1:10  Vendor Management
│   ├── Configure compliance requirements
│   ├── Import vendor master (if migrating)
│   └── Set up key vendors manually
│
├── 1:10 - 1:20  Employee Management
│   ├── Configure classifications and trades
│   ├── Import employee master (if migrating)
│   └── Enter key employees manually
│
├── 1:20 - 1:30  Customer / Owner Setup
│   ├── Enter primary customers
│   ├── Configure billing formats
│   └── Set retention defaults
│
├── 1:30 - 1:45  Project Setup
│   ├── Configure cost code templates
│   ├── Enter 1-2 active projects (to validate workflow)
│   ├── Build SOV for test project
│   └── AI: Import project data from legacy if available
│
├── 1:45 - 1:55  Transaction Module Activation
│   ├── AP: Quick config, test invoice entry
│   ├── AR: Quick config, test billing
│   ├── Payroll: Basic config (full config may extend beyond 2 hours)
│   └── AI: Validates all dependencies are met before activation
│
└── 1:55 - 2:00  Validation & Go-Live Checklist
    ├── Run system validation (all modules healthy?)
    ├── Review user access (everyone can log in?)
    ├── Verify GL balances (if opening balances imported)
    ├── Confirm billing cycle is set up correctly
    └── Schedule follow-up training sessions
```

### User Provisioning (New User)

```
New User Request (from manager or HR)
│
├── 1. Create user account
│   ├── Email address (login credential)
│   ├── Name, title, department
│   └── AI: Suggest role based on title ("AP Clerk" → AP Clerk role)
│
├── 2. Assign role(s)
│   ├── Select from predefined roles
│   ├── Set scope (which entities/projects they can access)
│   └── AI: "This user is a PM — assign to which projects?"
│
├── 3. Configure access
│   ├── Module access determined by role
│   ├── Project-level access (PM: only their projects)
│   ├── Entity-level access (multi-entity companies)
│   └── Field-level restrictions (e.g., hide SSN from PM role)
│
├── 4. Send invitation
│   ├── Email with login link and temporary password
│   ├── MFA setup prompt on first login
│   └── Guided tour of their modules on first login
│
└── 5. AI: Track onboarding completion
    ├── Did they log in?
    ├── Did they complete the guided tour?
    ├── Did they perform their first action (enter a timecard, process an invoice)?
    └── If inactive after 48 hours: send reminder or alert System Admin
```

### Data Import (Legacy Migration)

```
Data Import Process
│
├── 1. Select source system
│   ├── Vista (SQL Server export)
│   ├── Sage 300 CRE (database export)
│   ├── Foundation (CSV export)
│   ├── QuickBooks (IIF or CSV)
│   └── Generic CSV
│
├── 2. Upload source data
│   ├── AI: Auto-detect file format and column mapping
│   ├── AI: Suggest field mappings based on column headers
│   └── Admin reviews and adjusts mappings
│
├── 3. Validation
│   ├── AI validates data against Pitbull schema:
│   │   ├── Required fields present?
│   │   ├── Data types correct?
│   │   ├── Referential integrity (vendor exists for invoice)?
│   │   ├── Duplicate detection (same vendor twice?)
│   │   └── Value range checks (pay rate reasonable?)
│   ├── Generate validation report
│   └── Admin resolves errors (fix source data or apply rules)
│
├── 4. Preview import
│   ├── Show sample records as they'll appear in Pitbull
│   ├── Highlight transformations (field mapping, value conversion)
│   └── Admin confirms
│
├── 5. Execute import
│   ├── Import in transaction batches (rollback on failure)
│   ├── Progress indicator with record count
│   └── Error log for any records that fail
│
├── 6. Verification
│   ├── Record counts: source vs. imported
│   ├── Control totals: dollar amounts match?
│   ├── Spot check: sample records correct?
│   └── Admin signs off on import
│
└── 7. Post-import cleanup
    ├── Resolve any skipped records
    ├── Update references (GL account mappings, etc.)
    └── Run reconciliation reports
```

### Daily System Administration

```
Daily Tasks
├── 1. Review system health dashboard
│   ├── Any errors overnight?
│   ├── Integration sync status (bank feeds, insurance service, etc.)
│   ├── Background job status (scheduled reports, data syncs)
│   └── Storage utilization
│
├── 2. Review user access requests
│   ├── New user requests
│   ├── Role change requests
│   ├── Access revocation (terminated employees)
│   └── AI: Auto-flag users who haven't logged in for 30+ days
│
├── 3. Monitor integration health
│   ├── Bank feed connected and syncing?
│   ├── Insurance certificate service connected?
│   ├── Government portals accessible?
│   └── Resolve any connection errors
│
├── 4. Review audit log for anomalies
│   ├── Unusual login patterns (off-hours, new locations)
│   ├── Mass data exports
│   ├── Permission escalation attempts
│   └── AI: Flag unusual patterns for review
│
└── 5. Support user issues
    ├── Password resets
    ├── Configuration questions
    ├── Data correction requests
    └── Feature requests → escalate to Pitbull team
```

---

## 8. Key Reports

| Report | Frequency | Description |
|--------|-----------|-------------|
| **System Health Dashboard** | Real-time | Uptime, response time, error rate, storage, active users, background job status. |
| **User Activity Report** | Weekly | Login frequency, module usage, last login date, inactive users. |
| **Audit Log Report** | On demand | Filterable log of all system actions: who did what, when, to what record. |
| **Integration Status** | Daily | Connection status, last sync time, error count for each integration. |
| **Data Import History** | On demand | All imports: date, source, record count, error count, status. |
| **Module Activation Status** | On demand | Which modules are active, pending configuration, or inactive. Dependencies met? |
| **Role Permission Matrix** | On demand | Which roles have access to which modules and actions. Used for security audits. |
| **Failed Login Report** | Daily | Failed login attempts — potential security issues or users needing password help. |
| **Storage Utilization** | Weekly | Document storage usage by module and entity type. |
| **License/User Count** | Monthly | Active users vs. licensed seats. Usage trends. |

---

## 9. AI Agent Assistance Opportunities

### Onboarding Intelligence

- **Company profile auto-configuration:** Based on answers to 3-5 questions (company type, size, union status, states, trades), AI pre-configures: COA template, cost code templates, compliance requirements, module settings, and suggested roles. System Admin reviews and adjusts — not builds from scratch.
- **Smart module activation:** AI guides the System Admin through module activation in the correct order, validating dependencies at each step. "You can't activate Payroll yet — Employee Management needs 3 more configuration items completed."
- **Migration wizard with AI mapping:** When importing from Vista or Sage, AI recognizes the source system's data structure and auto-maps fields to Pitbull's schema. Handles the gnarly transformations (Vista's 6-digit account numbers → Pitbull's hierarchical COA).

### User Provisioning Automation

- **Role suggestion:** When creating a new user, AI suggests the appropriate role based on job title, department, and the roles used by similar users at similar companies. "Job title 'AP Specialist' → suggested role: AP Clerk."
- **Access scope recommendation:** For PMs, AI suggests project access based on the project team assignments. For Controllers, it suggests entity access based on the company structure. "This PM is assigned to 3 projects — grant access to those projects."
- **Offboarding automation:** When an employee is terminated in HR, AI automatically disables their user account, revokes access, and generates an offboarding audit report. "Employee Jane Smith terminated in HR → User account disabled, 7 active sessions terminated, access revoked from 3 projects."
- **Inactive user management:** AI identifies users who haven't logged in for 30+ days and suggests action: remind, deactivate, or remove. "15 users haven't logged in this month — 5 are field workers (seasonal?), 3 are terminated employees whose accounts weren't deactivated."

### System Health Intelligence

- **Predictive monitoring:** AI identifies patterns that precede system issues: increasing error rates, slowing response times, integration failures. Alerts the Admin before users notice problems.
- **Integration self-healing:** When an integration connection fails, AI attempts common fixes (token refresh, retry with backoff) before alerting the Admin. Only escalates persistent failures.
- **Usage analytics:** AI analyzes module usage patterns and suggests configuration improvements. "AP Clerk processes 200 invoices/month but only uses auto-coding 10% of the time — suggest training or configuration update to improve adoption."
- **Configuration recommendations:** AI compares the company's configuration against best practices and peer companies (anonymized). "90% of similar-sized GCs have automatic lien waiver tracking enabled — would you like to turn it on?"

### Data Import Intelligence

- **Source system auto-detection:** Upload a file → AI identifies the source system, version, and data type without being told. "This looks like a Vista 6.0 AP vendor export with 2,847 records."
- **Intelligent field mapping:** AI maps source columns to Pitbull fields with confidence scores. High-confidence mappings are auto-applied; low-confidence mappings are presented for Admin review.
- **Data quality scoring:** Before import, AI scores the data quality: completeness, consistency, freshness. "Vendor data quality: 78% — 156 vendors missing tax classification, 42 have expired addresses. Import anyway or fix first?"
- **Incremental migration support:** AI supports phased migration — import vendors this week, employees next week, projects the following week — while maintaining referential integrity across imports.

---

## 10. Pain Points in Vista / Legacy Systems That Pitbull Solves

| Vista / Legacy Pain | Pitbull Solution |
|---------------------|-----------------|
| **Vista setup takes weeks.** Initial implementation of Vista typically requires 3-6 months with consultants. Even adding a new module takes days of configuration. | **2-hour onboarding path.** AI-guided setup with smart defaults gets a company operational in a single session. Module activation is measured in minutes, not days. |
| **User management is arcane.** Vista's security model is notoriously complex — security groups, data security, form-level access, row-level security each configured separately. | **Role-based access with templates.** Pre-built roles (PM, Controller, AP, AR, etc.) with clear permission descriptions. Custom roles built visually, not through SQL or cryptic security forms. |
| **Data migration requires consultants.** Moving from another system to Vista (or vice versa) typically involves a consulting firm, custom SQL scripts, and weeks of effort. | **Self-service data import** with AI mapping, validation, and error resolution. No SQL required. No consultants required for standard imports. |
| **Integration is custom-coded.** Connecting Vista to banks, insurance services, or other tools requires custom API development or middleware. | **Pre-built integrations** with configuration-only setup. Bank feeds, insurance certificate services, and common construction tools connect through a configuration interface. |
| **System monitoring is reactive.** You find out Vista has a problem when users complain. No proactive health monitoring. | **Real-time health dashboard** with proactive alerts. AI identifies issues before users notice. Integration status monitored continuously. |
| **Period management is risky.** Closing a period in Vista is irreversible and complex. Opening a period requires careful coordination. | **Flexible period management** with soft-close (prevents accidental posting) and hard-close (locked by Controller). Reopening has an approval workflow with full audit trail. |
| **Audit trail is incomplete.** Vista logs some changes but not all. Querying the audit log requires SQL knowledge. | **Comprehensive audit trail** on every field of every record. Searchable, filterable, exportable — no SQL required. |
| **No guided setup.** Vista drops you into a blank system with hundreds of configuration options and no guidance on where to start. | **Guided onboarding wizard** with AI that understands dependencies and guides the Admin through setup in the correct order. |

---

## 11. Role-Based Access Model

```
BUILT-IN ROLES (Configurable, not hardcoded):

┌─────────────────┬───────────────────────────────────────────┐
│ Role            │ Access Scope                              │
├─────────────────┼───────────────────────────────────────────┤
│ System Admin    │ ALL modules, ALL data, ALL config         │
│                 │ Cannot: post GL entries (separation of    │
│                 │ duties — admin configures, doesn't transact)│
├─────────────────┼───────────────────────────────────────────┤
│ Controller/CFO  │ GL, AP, AR, Payroll, Job Cost, Reporting  │
│                 │ All entities, all projects                │
│                 │ Period management, approval authority      │
├─────────────────┼───────────────────────────────────────────┤
│ Project Manager │ Projects (own only), Job Cost, Billing,   │
│                 │ Timecards, Subs, RFIs, Submittals, DRs   │
│                 │ Cannot: see other PMs' projects           │
├─────────────────┼───────────────────────────────────────────┤
│ AP Clerk        │ AP, Vendor Mgmt, PO matching, Banking     │
│                 │ (payments only), 1099                     │
│                 │ Cannot: approve own invoices               │
├─────────────────┼───────────────────────────────────────────┤
│ AR Clerk        │ AR, Customer Mgmt, Billing, Cash Receipts │
│                 │ Cannot: approve write-offs or adjustments  │
├─────────────────┼───────────────────────────────────────────┤
│ Payroll Manager │ Payroll, Employee Inquiry, Tax Mgmt       │
│                 │ Read-only: Job Cost (labor distribution)   │
│                 │ Cannot: modify employee master record      │
├─────────────────┼───────────────────────────────────────────┤
│ HR Director     │ Employee Mgmt, Compliance, Benefits,      │
│                 │ Union Admin, Training                     │
│                 │ Cannot: process payroll                    │
├─────────────────┼───────────────────────────────────────────┤
│ Field Worker    │ Timecard entry, pay stub view,            │
│                 │ cert upload, personal info                │
│                 │ Mobile-only access for many               │
├─────────────────┼───────────────────────────────────────────┤
│ Superintendent  │ Daily reports, timecard approval,          │
│                 │ project documents (read), field photos    │
│                 │ Job cost (read-only, own projects)        │
├─────────────────┼───────────────────────────────────────────┤
│ Executive       │ All dashboards and reports (read-only)    │
│                 │ No transaction entry                      │
│                 │ Approval authority for large items        │
└─────────────────┴───────────────────────────────────────────┘

SEGREGATION OF DUTIES (System-Enforced):
- Person who enters an invoice ≠ person who approves it
- Person who creates a payment run ≠ person who approves it
- Person who enters a JE ≠ person who approves it
- System Admin ≠ transaction poster (admin configures, doesn't transact)
- Person who sets up a vendor ≠ person who approves first payment
```

---

## 12. Key Business Rules

1. **Module dependencies are enforced.** The system will not allow activation of a module until its dependencies are active and configured. No workarounds.
2. **Every user must have exactly one primary role.** Additional roles can be assigned for cross-functional access, but the primary role determines the default dashboard and navigation.
3. **MFA is mandatory for admin and financial roles.** System Admin, Controller, AP, AR, Payroll, and HR roles require multi-factor authentication. No exceptions.
4. **Terminated employees lose access immediately.** When HR marks an employee as terminated, the system auto-disables their user account within 15 minutes. Active sessions are terminated.
5. **Audit log is immutable.** No one — including the System Admin — can modify or delete audit log entries. They are append-only and retained per the company's data retention policy (minimum 7 years).
6. **Data imports create audit records.** Every imported record is tagged with the import batch ID, source system, and import date. This supports data lineage tracking.
7. **Role changes require two-party approval** for sensitive roles (Admin, Controller, Payroll). The System Admin can propose the change, but a second admin or the Controller must approve.
8. **Integration credentials are encrypted** at rest and never displayed in full after initial entry. Connection testing validates without exposing secrets.
9. **Period close is a two-step process.** Soft-close (prevents accidental posting but allows authorized corrections) → Hard-close (locked, requires Controller + Admin approval to reopen).
10. **System configuration changes are versioned.** Every settings change is tracked with before/after values, timestamp, and user. Configuration can be compared across dates.

---

## 13. Connection to Long-Term Vision

Pitbull's future is **Design → Build → Operate → Maintain** — a full lifecycle platform with digital twins, BIM integration, and CAD tools, all web-native on one platform.

For the System Administrator, this evolution means:

- **Module ecosystem expansion:** As Pitbull adds Design (CAD/BIM), Operations (facility management), and Maintenance (asset lifecycle) modules, the System Admin's activation and configuration responsibilities grow. The dependency chain extends: BIM data feeds estimating, estimating feeds project setup, project data feeds digital twin, digital twin feeds operations.
- **Integration hub evolution:** Today the Admin connects to banks and insurance services. Tomorrow: BIM authoring tools, IoT sensor platforms, facility management systems, permitting portals. The integration hub becomes the nervous system of the entire platform.
- **AI-managed configuration:** As the platform matures, AI takes over more configuration decisions. Instead of the Admin choosing settings, AI observes usage patterns and suggests optimizations. The Admin shifts from configuration to governance — ensuring the AI's suggestions align with company policies.
- **Multi-tenant complexity:** As companies use Pitbull across more lifecycle phases, the access model becomes richer. A designer might need read access to job cost data to inform future designs. A facility manager might need access to as-built BIM data and warranty records from the construction phase. The Admin ensures seamless-but-secure cross-phase data access.

The System Admin's role today — turning on modules and managing users — becomes the foundation for a platform governance role that spans the entire building lifecycle.

---

*This document is a living reference for AI agent teams. When building any feature that touches system configuration, user management, or platform setup, consult this document to understand the System Admin's perspective and constraints.*
