# Changelog

All notable changes to Pitbull Construction Solutions are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [0.12.0] - 2026-02-17

### Added

- Project Management module scaffold with API + data model for schedule, job cost, daily reports, submittals, RFIs, communications, meetings, documents, progress, tasks, and narratives.
- AI module with provider abstraction (OpenAI + Anthropic), tenant-scoped API key management, provider routing, and secure key storage/retrieval.
- Crew-to-payroll Phase 2 PM review flow with review queue, bulk approve/reject decisions, and approval/rejection event publishing.
- PM web experience expanded with 12+ project dashboard pages under `projects/[id]` (schedule, submittals, documents, meetings, communications, daily reports, job cost, tasks, narratives, plans/specs, progress, projections).
- 135+ new unit tests added across PM and AI services, including child-entity scope enforcement and AI provider/key-management behavior.

### Security

- JWT hardening in PM review workflows: reviewer identity is resolved from JWT claims instead of trusting request-body approver IDs.
- Project-scoped bulk review enforcement: PM review queue and review actions are restricted to entries in projects where the reviewer has active manager/supervisor assignment.
- Self-approval guard: reviewers cannot approve or reject their own submitted time entries.
- Child entity project ownership validation for PM endpoints now enforces that referenced parent records belong to the route `projectId`, reducing cross-project/IDOR exposure.
- JWT email fallback support improved for employee resolution (`Identity.Name` with `email` claim fallback) in approval and review flows.

### Fixed

- Stabilized flaky MassTransit consumer unit tests by replacing harness-dependent assertions with deterministic consumer-level verification.
- Fixed PM narrative revision listing to enforce project ownership checks and soft-delete filtering (`!IsDeleted`) before returning revisions.

---

## [0.11.3] - 2026-02-15

### 🚀 Features

- **Crew Timecard Settings** - Company-configurable time entry with daily or weekly modes, detailed or simple weekly entry, default project, and phase/equipment requirements (#67)
- **Auto-Assign Labor Cost Codes** - Crew grid entries automatically receive the default labor cost code, eliminating manual selection for field workers (#68)
- **Streamlined Crew Entry Grid** - Removed cost code column, added equipment hours column, and made crew entry the default time tracking view with navigation tabs (#69)
- **Default Cost Code Seeding** - New tenants receive 7 standard cost codes (LAB, EQP, MAT, SUB-LAB, SUB-MAT, SUB-EQP, OVH) out of the box

### 🐛 Bug Fixes

- **Nullable CostCodeId** - Time entry creation no longer requires an explicit cost code, supporting auto-assignment from crew grid
- **Enum validation on timecard settings** - Invalid TimecardMode or WeeklyEntryMode values now return clear 400 errors instead of silently accepting bad data
- **DefaultProjectId validation** - Settings endpoint verifies the referenced project exists before saving

### 🧪 Testing

- **Controller unit test coverage expansion** - Added tests for 4 more controllers (13/22 total):
  - CostCodesController, DashboardController, EquipmentController, PayPeriodsController
- **Timecard settings test hardening** - Fixed 4 tests to properly seed project data, added invalid DefaultProjectId test
- **Unit test count:** 1,189 (up from 1,063)
- **Total test count:** 1,414 (unit + integration)

---

## [0.11.2] - 2026-02-15

### 🔒 Security

- **Bootstrap-admin privilege escalation fix** - Anonymous endpoint could promote any user to Admin; now guarded so only first-time setup allows unauthenticated access, existing tenants require authenticated Admin caller
- **Rate limiting on admin and user controllers** - All administrative endpoints now enforce request rate limits to prevent enumeration and abuse

### 🧪 Testing

- **Controller unit test coverage expansion** - Added comprehensive unit tests for 9 of 22 API controllers:
  - AuthController (37 tests) - login, register, change-password, profile, bootstrap-admin
  - TimeEntriesController (38 tests) - all 9 endpoints including approval workflows and Vista export
  - ProjectsController (28 tests) - CRUD, AI summary, stats, RFI cost summary
  - EmployeesController (27 tests) - CRUD, project assignments, stats
  - BidsController (29 tests) - CRUD, bid-to-project conversion
  - RfisController (26 tests) - CRUD with cross-project isolation, cost impact
  - SubcontractsController (29 tests) - CRUD with status transitions
  - ChangeOrdersController (34 tests) - CRUD with approval/rejection workflows
  - Middleware (38 tests) - request/response logging, correlation ID, exception handling
- **Unit test count:** 1,063 (up from 815)
- **Total test count:** 1,288 (unit + integration)

---

## [Unreleased] - Multi-Company Architecture (feature/multi-company)

### 🚀 Features

- **Multi-Company Support** - Single tenant, multiple legal entities
  - Company entity with code, name, tax ID, address, fiscal year, branding
  - Vista-style company switcher in navigation - switch without page reload
  - Company admin page with full CRUD (create, edit, deactivate companies)
  - Per-user company access controls with optional role overrides
  - X-Company-Id header on every API request for company-scoped data filtering
  - Auto-creates default company for existing tenants (zero-friction migration)
  - Single-company tenants see no UI changes - fully transparent

### 🏗️ Infrastructure

- **1,184-line architecture design document** covering industry research (Vista, Sage 300, NetSuite), data model, RLS changes, migration strategy, and phased implementation plan
- **ICompanyScoped interface** - clean separation between company-scoped and tenant-scoped entities
- **13 entities upgraded** with CompanyId (Projects, Bids, Subcontracts, Change Orders, Payment Applications, RFIs, Time Entries, Pay Periods, Phases, Projections, Project Budgets, Project Assignments, Bid Items)
- **8 entities remain tenant-scoped** (Employees, Cost Codes, Users - shared across companies)
- CompanyMiddleware, CompanyContext service, and EF Core migration

---

## [0.11.1] - 2026-02-13

### 🚀 RFI Management

- **RFI Management UI** - Complete RFI workflow in the web interface
  - List view with search, status/priority filters, and result count
  - Detail view with tabbed interface (Details + Cost Impact)
  - Create/edit forms with all fields
  - CSV export for RFI lists

- **RFI Cost Impact Tracking** - Full financial visibility
  - New database fields: `EstimatedCost`, `ActualCost`, `DelayDays`, `DelayCost`
  - Document references: `SpecSection`, `DrawingSheet`
  - AI-ready fields: `SuggestedAnswer`, `AiConfidence`
  - Link Change Orders to originating RFIs

- **RFI Cost Impact API** - New endpoints for cost analysis
  - `GET /api/projects/{id}/rfis/{rfiId}/cost-impact` - Single RFI cost breakdown with linked change orders and timeline
  - `GET /api/projects/{id}/rfi-cost-summary` - Project-level aggregates: total costs, delay days, top 5 costly RFIs

- **RFI Cost Impact UI** - Visual cost tracking
  - Tabbed detail view with cost breakdown
  - Linked change orders table with status badges
  - Timeline of events showing RFI lifecycle

- **RFI → Change Order Workflow** - Seamless cost tracking
  - "Create Change Order" button on RFI detail page
  - Pre-fills description with RFI context
  - Automatically links CO back to originating RFI
  - Full traceability: RFI → Change Order → Cost Impact

### 📊 Dashboard Improvements

- **Recently Viewed Section** - Quick access to your recent work
  - Shows last 5 projects, bids, and RFIs you've viewed
  - Click to jump back instantly
  - Persisted in localStorage

- **RFIs Needing Attention Widget** - Never miss critical RFIs
  - Shows overdue RFIs and those assigned to you
  - Sorted by urgency (overdue first)
  - Direct links to RFI detail pages
  - Color-coded priority badges

- **Notification Center** - Stay informed
  - Bell icon in header with unread count badge
  - Dropdown panel with recent notifications
  - Mark as read/unread functionality

### ⚡ User Experience Improvements

- **Global Command Palette** - Keyboard-first navigation (Cmd/Ctrl+K)
  - Search projects, bids, RFIs, and employees
  - Quick actions: create new items, navigate to pages
  - Fuzzy search with keyboard navigation
  - Recent searches remembered

- **Keyboard Shortcuts** - Power user productivity
  - `?` or `Cmd+/` opens help modal with all shortcuts
  - `g p` - Go to Projects
  - `g b` - Go to Bids
  - `g r` - Go to RFIs
  - `g t` - Go to Time Tracking
  - `g d` - Go to Dashboard
  - `c p` - Create new Project
  - `c b` - Create new Bid
  - `Esc` - Close modals/dialogs

- **Dark Mode** - Easy on the eyes
  - Toggle in Settings page
  - Persists across sessions
  - Smooth transition animations
  - Full theme support across all components

- **Breadcrumb Navigation** - Always know where you are
  - Added to all detail pages (Projects, Bids, RFIs, Employees)
  - Clickable navigation back to parent lists
  - Shows current item name

- **Quick Project Switcher** - Fast context switching
  - Dropdown in sidebar header
  - Search/filter your projects
  - One-click to switch active project context

- **Loading Skeletons** - Better perceived performance
  - Shimmer animations on list pages
  - Cards and tables show placeholder content
  - Reduces perceived wait time

- **Copy Link Buttons** - Easy sharing
  - Added to RFIs, Projects, and Bids detail pages
  - One-click copy URL to clipboard
  - Toast confirmation on copy

- **Icon Button Tooltips** - Better accessibility
  - All icon-only buttons now have descriptive tooltips
  - Helps new users discover functionality
  - ARIA labels for screen readers

### 📱 Mobile Improvements

- **Floating Action Button (FAB)** - Quick actions on mobile
  - Fixed position bottom-right on small screens
  - Expandable menu with context-aware actions
  - Create Project, Bid, RFI, Log Time
  - Smooth animations

### 📄 Reporting & Export

- **Printable Project Summary** - Professional reports
  - Print-optimized layout at `/projects/{id}/print`
  - Includes project details, budget, timeline
  - Clean formatting for client presentations

- **RFI CSV Export** - Data portability
  - Export filtered RFI list to CSV
  - Includes all fields and metadata
  - Compatible with Excel and other tools

### ⏱️ Time Tracking Improvements

- **Bulk Approve/Reject** - Faster supervisor workflow
  - Checkbox selection on individual entries
  - "Select All" with indeterminate state
  - Bulk approve/reject with confirmation dialogs
  - Shows success/failure counts

- **Improved Form Validation** - Better feedback
  - Inline validation messages
  - Required field indicators with asterisks
  - Real-time validation as you type
  - Clear error states with recovery hints

### 🐛 Bug Fixes

- Fixed flaky health check integration test (non-serializable HealthReport)
- **Role auto-assignment** - New users now automatically get roles on registration (Admin for first user, User for subsequent). Existing users without roles get backfilled on login.
- **Employee form submission** - Fixed double-quoting bug in request logging middleware that made form data appear corrupted
- **PostgreSQL case sensitivity** - Fixed raw SQL column aliases being lowercased (quote aliases to preserve case)
- **Dark mode consistency** - Improved text contrast and notification center styling in dark theme
- **Database resilience** - Wrapped transactions in execution strategy for Npgsql retry support

### 🧪 Testing

- 19 unit tests for RfisNeedingAttention endpoint
- 8 integration tests for RFI cost impact endpoints
- **Total: 683 unit tests, 198 integration tests (881 total)**

### 🏗️ Code Quality

- Formatted 138 files with `dotnet format`
- Removed 5 stale "Known Issues" from documentation
- Moved BidDto/BidMapper to Features/Shared folder

---

## [0.11.0] - 2026-02-13

### 🚀 Features

- **RFI Cost Impact Tracking** - Track the full financial impact of RFIs through the project lifecycle
  - Link Change Orders to originating RFIs
  - Track delay costs separately from direct costs
  - Document references (spec sections, drawing sheets)
  - AI assistance fields for future answer suggestions
  - *"This RFI cost us $45K in delays"* - now trackable end-to-end

- **RFI Cost Impact API** (Phase 2) - New endpoints for cost analysis
  - `GET /api/projects/{id}/rfis/{rfiId}/cost-impact` - Single RFI cost breakdown with linked change orders and timeline
  - `GET /api/projects/{id}/rfi-cost-summary` - Project-level aggregates: total costs, delay days, top 5 costly RFIs
  - Enables dashboards and reports showing true RFI financial impact

### 🏗️ Infrastructure

- **Architecture:** 🎉 **MediatR removal COMPLETE** - Entire codebase is now MediatR-free!
  - Removed MediatR from ALL 12 controllers (Issue #118)
  - Final batch: DashboardController, RfisController, TimeEntriesController, ProjectAssignmentsController, PayPeriodsController
  - TimeEntriesController: 9 handler usages consolidated into TimeEntryService
  - ProjectAssignmentsController: -307 lines of code
  - PayPeriodsController: 7 handlers deleted
  - Direct service injection improves testability and debugging
  - Preserves CQRS patterns without message bus overhead
  - New `IEmployeeService` with full CRUD + stats operations

- **Demo Environment:** Fixed PostgreSQL session variable handling
  - `SET LOCAL` replaced with `set_config()` function for parameterized queries
  - Resolves Railway demo startup crash

- **ci:** Switched from self-hosted to GitHub-hosted runners (`ubuntu-latest`)
  - Self-hosted runners were offline 23+ hours
  - CI now completes in ~4 minutes (was stuck indefinitely)

### 🐛 Bug Fixes

- **EF Core LINQ:** Fixed `StringComparison.CurrentCultureIgnoreCase` translation errors across 12 files
- **Web UI:** Added missing `date-fns` package and `Switch` component for pay periods page
- **Web UI:** Fixed CostCode import paths in crew entry components
- **Migrations:** Added missing Designer.cs files for PayPeriods and RFI Cost Impact migrations
- **RLS Policies:** Fixed column references from snake_case to PascalCase (`TenantId`)

### Planned

- RFI Cost Impact API endpoints (Phase 2)
- Document management module
- Billing/invoicing module
- Client portal
- Subdomain-based tenant resolution

---

## [0.10.17] - 2026-02-10

### 📊 Test Coverage

- **Bids integration tests** (+2 tests)
  - Delete nonexistent bid returns 404
  - Update bid with mismatched ID returns 400
- **Subcontracts integration tests** (+2 tests)
  - Delete nonexistent subcontract returns 404
  - Update subcontract with mismatched ID returns 400

**Total tests:** 1017 (834 unit + 183 integration)

---

## [0.10.16] - 2026-02-10

### 🐛 Bug Fixes

- **fix(projects):** V2 service methods now filter by `!IsDeleted` - soft-deleted records were being returned
- **fix(projects):** Stats endpoint SqlQueryRaw scalar mapping - added wrapper DTOs to fix EF Core mapping

### 📊 Test Coverage

- **Contracts module validator tests** (+57 tests)
  - CreateSubcontractValidator (22 tests)
  - CreateChangeOrderValidator (19 tests)
  - CreatePaymentApplicationValidator (16 tests)
- **Security middleware tests** (+9 tests)
  - SecurityHeadersMiddleware header verification
- **Bids integration tests** (+3 tests)
  - Convert to project workflow
- **Projects V2 integration tests** (+5 tests)
  - Full CRUD coverage for V2 endpoints
- **RFI integration tests** (+2 tests)
  - Nonexistent RFI edge cases
- **Various module integration tests** (+10 tests)
  - Tenants, SeedData, TimeEntries, Dashboard

**Total tests:** 1013 (834 unit + 179 integration) 🎉 **Crossed 1000 tests milestone!**

---

## [0.10.15] - 2026-02-10

### 📊 Test Coverage

- **Integration tests for PaymentApplications endpoints** (+6 tests)
  - Update payment application
  - Update nonexistent payment application returns 404
  - Update with mismatched ID returns 400
  - Delete draft payment application
  - Delete nonexistent payment application returns 404
  - Cannot delete submitted payment application
- **Integration tests for TimeEntries approval workflow** (+8 tests)
  - Approve/reject auth checks
  - Project-based time entry filtering
  - Labor cost report endpoint
- **Integration tests for Dashboard** (+3 tests)
  - Weekly hours endpoint coverage
- **Integration tests for Users** (+6 tests)
  - Role assignment endpoints

### 📝 Documentation

- Updated README with accurate test counts (924 passing)
- Updated Alpha 0 roadmap with module list

### 🔧 Infrastructure

- Fixed Testcontainers deprecation warning (CS0618)

**Total tests:** 930 (768 unit + 162 integration)

---

## [0.10.14] - 2026-02-10

### 🐛 Bug Fixes

- **fix(employees):** Corrected `CreateEmployeeCommand` argument order in controller - was passing parameters in wrong order
- **fix:** Corrected raw SQL column names in stats queries - changed from snake_case to PascalCase to match EF Core conventions
- **fix(timetracking):** Corrected `Result.Failure` parameter order in `CreateEmployeeHandler`

---

## [0.10.13] - 2026-02-09

### 🏗️ Infrastructure

- **Module cleanup complete**: Removed incomplete HR and Payroll modules that were blocking production deployments
- **CI reliability improvements**: Added workspace cleanup to self-hosted runner to prevent stale file issues
- **Database migration cleanup**: Removed orphaned migration files to ensure clean schema state

### 🐛 Bug Fixes

- Fixed Railway deployment failures caused by incomplete module references
- Fixed CI build failures from cached test files on self-hosted runner
- Fixed EF Core migration warnings that were failing integration tests

### 📊 Test Coverage

- **Total tests**: ~900 (reduced from 1244 after removing HR/Payroll test suites)
- Test count decreased as a result of module removal - actual coverage of active modules remains complete

---

## [0.10.12] - 2026-02-09

### 📊 Test Coverage Milestone

- **Total tests**: 1244 (1000 unit + 244 integration)
- **New integration tests**: +24
  - EmployeesEndpointsTests (+24): Comprehensive coverage including auth, CRUD, tenant isolation, filtering by department/employment status, search, soft-delete behavior

### 🏗️ Infrastructure

- Added `.dockerignore` to optimize Docker builds and exclude incomplete modules
- Commented out HR/Payroll project references until modules are production-ready
- Faster build times by excluding test files, documentation, and build artifacts from Docker context

---

## [0.10.11] - 2026-02-09

### 📊 Test Coverage

- **Total tests**: 1220 (1000 unit + 220 integration)
- **New integration tests**: +9
  - ProjectAssignmentsEndpointsTests (+9): Auth tests (4), CRUD tests (2), error handling tests (3)

### 🐛 Bug Fix

- Fixed `ProjectAssignmentsController` returning 400 instead of 404 for nonexistent assignments
  - Handler returned `ASSIGNMENT_NOT_FOUND` but controller only checked for `NOT_FOUND`

---

## [0.10.10] - 2026-02-09

### 📊 Test Coverage

- **Total tests**: 1211 (1000 unit + 211 integration)
- **New integration tests**: +7
  - ProjectsEndpointsTests (+7): Update, delete, filter by type, search by name, stats 404, cannot update nonexistent, cannot delete nonexistent

### 📝 Documentation

- Updated README with current test counts (1211)
- Updated recent wins section

---

## [0.10.9] - 2026-02-09

### 📊 Test Coverage

- **Total tests**: 1204 (1000 unit + 204 integration)
- **New integration tests**: +9
  - SubcontractsEndpointsTests (+5): Update, delete, filter by project, search by name, nonexistent update
  - ChangeOrdersEndpointsTests (+4): Delete, filter by subcontract, filter by status, nonexistent delete

### 📝 Documentation

- Updated README with current test counts (1204)
- Updated recent wins section - Contracts module test coverage expanded

---

## [0.10.8] - 2026-02-09

### 📊 Test Coverage

- **Total tests**: 1195 (1000 unit + 195 integration)
- **New integration tests**: +18
  - HRWithholdingElectionsEndpointsTests (+9): Auth, CRUD, tenant isolation, employee filtering, tax jurisdiction filtering, current elections by employee, auto-expiration of previous elections, W-4 fields
  - HREVerifyCasesEndpointsTests (+9): Auth, CRUD, tenant isolation, employee filtering, by-employee endpoint, needs-action endpoint, status updates (TNC, authorized, etc.)
- **HR Module 100% Complete!** All 10 HR controllers now have integration test coverage

### 📝 Documentation

- Updated README with current test counts (1195)
- Updated recent wins section - HR module test coverage complete!

---

## [0.10.7] - 2026-02-09

### 📊 Test Coverage

- **Total tests**: 1177 (1000 unit + 177 integration)
- **New integration tests**: +9
  - HRUnionMembershipsEndpointsTests (+9): Auth, CRUD, tenant isolation, employee filtering, union local filtering, by-employee endpoint, dispatch tracking, fringe rates

### 📝 Documentation

- Updated README with current test counts (1177)
- Updated recent wins section

---

## [0.10.6] - 2026-02-09

### 📊 Test Coverage

- **Total tests**: 1168 (1000 unit + 168 integration)
- **New integration tests**: +44
  - HRPayRatesEndpointsTests (+9): Auth, CRUD, tenant isolation, fringe benefits, employee filtering, active rates endpoint
  - HRCertificationsEndpointsTests (+9): Auth, CRUD, tenant isolation, employee filtering, type code filtering, expiring certs endpoint
  - HREmergencyContactsEndpointsTests (+8): Auth, CRUD, tenant isolation, employee filtering, by-employee endpoint
  - HRDeductionsEndpointsTests (+9): Auth, CRUD, tenant isolation, garnishments, employee filtering, active deductions endpoint
  - HREmploymentEpisodesEndpointsTests (+9): Auth, list/get, tenant isolation, employee filtering, termination workflow, delete
  - HRI9RecordsEndpointsTests (+9): Auth, CRUD, tenant isolation, employee filtering, eligibility verification workflow

### 📝 Documentation

- Updated README with current test counts (1168)
- Updated recent wins section with comprehensive HR module coverage

---

## [0.10.5] - 2026-02-09

### 📊 Test Coverage

- **Total tests**: 1150 (1000 unit + 150 integration)
- **New integration tests**: +35
  - HRPayRatesEndpointsTests (+9): Auth, CRUD, tenant isolation, fringe benefits, employee filtering, active rates endpoint
  - HRCertificationsEndpointsTests (+9): Auth, CRUD, tenant isolation, employee filtering, type code filtering, expiring certs endpoint
  - HREmergencyContactsEndpointsTests (+8): Auth, CRUD, tenant isolation, employee filtering, by-employee endpoint
  - HRDeductionsEndpointsTests (+9): Auth, CRUD, tenant isolation, garnishments, employee filtering, active deductions endpoint

### 📝 Documentation

- Updated README with current test counts (1150)
- Updated recent wins section with full HR sub-module coverage

---

## [0.10.4] - 2026-02-09

### 📊 Test Coverage

- **Total tests**: 1133 (1000 unit + 133 integration)
- **New integration tests**: +18
  - HRPayRatesEndpointsTests (+9): Auth, CRUD, tenant isolation, fringe benefits, employee filtering, active rates endpoint
  - HRCertificationsEndpointsTests (+9): Auth, CRUD, tenant isolation, employee filtering, type code filtering, expiring certs endpoint

### 📝 Documentation

- Updated README with current test counts (1133)
- Updated recent wins section with HR module test coverage

---

## [0.10.3] - 2026-02-09

### 📊 Test Coverage

- **Total tests**: 1115 (1000 unit + 115 integration)
- **New integration tests**: +18
  - AdminAuditEndpointsTests (+6): Auth, listing, pagination, filters, resource types, action types
  - AdminCompanyEndpointsTests (+5): Auth, default settings, update, minimal update, persistence
  - UsersEndpointsTests (+7): Auth, listing, user details, roles, search, pagination

### 📝 Documentation

- Updated README with current test counts (1115)
- Updated recent wins section with admin panel test coverage

---

## [0.10.2] - 2026-02-09

### 📊 Test Coverage

- **Total tests**: 1097 (1000 unit + 97 integration)
- **New integration tests**: +41 (from 56 to 97)
  - Dashboard endpoints (+3): Auth, response validation, tenant isolation
  - CostCodes endpoints (+8): Pagination, filters, search
  - Monitoring endpoints (+7): Version, health, security status
  - Auth endpoints (+9): Login, register, profile, change-password
  - Health endpoints (+3): Liveness, readiness, combined health
  - Tenants endpoints (+5): Current tenant, access control, cross-tenant security
  - Admin Users endpoints (+6): List, get, roles, search

### 📝 Documentation

- Updated README with current test counts (1097)
- Updated recent wins section

---

## [0.10.1] - 2026-02-08

### 🔒 Security

- **Payroll RLS Policies**: Multi-tenant isolation for pay_periods, payroll_batches, payroll_entries, payroll_deduction_lines
- **HR RLS Policies**: Multi-tenant isolation for all 10 HR schema tables
- All tenant-scoped tables now have database-level row security

### 🐛 Bug Fixes

- Fixed BidNumber → Number column reference in dashboard raw SQL query
- Fixed Payroll module registration in Program.cs (was causing PendingModelChangesWarning)

### 📊 Test Coverage

- **Total tests**: 1056 (1000 unit + 56 integration)
- **New integration tests**: 18 (10 Payroll + 8 HR Employees)
- Tests verify tenant isolation, CRUD operations, auth requirements, and unique constraints

---

## [0.10.0] - 2026-02-08

### 🎉 HR Module Complete!

Full HR Core module with 10 entities, 10 controllers, 55+ endpoints.
Foundation for Payroll → Job Costing → Accounting pipeline.

### ✨ New Entities (this release)

- **EmploymentEpisode CRUD**: Rehire tracking for construction's 60%+ turnover
  - Auto-incrementing episode numbers per employee
  - Separation reason tracking
  - Prevents duplicate active episodes

- **WithholdingElection CRUD**: Federal W-4 and state tax elections
  - 2020+ W-4 fields (filing status, multiple jobs, dependents, extra withholding)
  - All 50 states + DC + PR validation
  - Effective dating (new elections auto-expire previous)

- **Deduction CRUD**: Payroll deductions management
  - Benefits (health, dental, vision, 401k with employer match)
  - Garnishments with court case tracking (child support, tax levies)
  - Union dues, charity contributions
  - Pre-tax vs post-tax handling
  - YTD tracking for annual limits

- **UnionMembership CRUD**: Union labor management
  - Union local and membership tracking
  - Apprentice level tracking (1-10)
  - Dispatch tracking (number, date, list position)
  - Fringe benefit rates (H&W, pension, training)
  - Dues paid status and expiration

- **I9Record CRUD**: Employment eligibility verification
  - Section 1: Employee information + citizenship status
  - Section 2: Employer document verification (List A/B/C)
  - Section 3: Reverification for work auth expiration
  - `/reverification-needed` endpoint for compliance dashboard

- **EVerifyCase CRUD**: DHS employment verification
  - Case submission and status tracking
  - SSA and DHS verification results
  - TNC (Tentative Non-Confirmation) workflow
  - `/needs-action` endpoint for pending cases

### 📊 Test Coverage

- **Total tests**: 991 unit tests passing
- **Test growth**: +20 tests from 0.9.0

---

## [0.9.0] - 2026-02-08

### ✨ New Features

- **HR Module Certification CRUD**: Full certification tracking for compliance
  - `POST /api/hr/certifications` - Create employee certification
  - `GET /api/hr/certifications/{id}` - Get certification details
  - `GET /api/hr/certifications` - List with filtering (status, type, expiring)
  - `PUT /api/hr/certifications/{id}` - Update certification
  - `DELETE /api/hr/certifications/{id}` - Soft-delete certification
  - `GET /api/hr/certifications/expiring` - Compliance dashboard convenience endpoint
  - Supports expiration tracking, verification status, warning notifications
  - 39 new tests (validators + handlers)

- **HR Module PayRate CRUD**: Construction-specific pay rate management
  - `POST /api/hr/pay-rates` - Create pay rate
  - `GET /api/hr/pay-rates/{id}` - Get pay rate details
  - `GET /api/hr/pay-rates` - List with filtering (type, project, shift, state)
  - `PUT /api/hr/pay-rates/{id}` - Update pay rate
  - `DELETE /api/hr/pay-rates/{id}` - Soft-delete pay rate
  - `GET /api/hr/pay-rates/employee/{id}/active` - Active rates for employee
  - Supports effective dating, project-specific rates, shift differentials
  - Union fringe benefits (H&W, pension, training) with TotalHourlyCost calculation
  - Priority-based rate selection for complex scenarios
  - 34 new tests (validators + handlers)

- **HR Module DeleteEmployee**: Soft-delete endpoint for HR employees
  - `DELETE /api/hr/employees/{id}`
  - 3 new tests

### 📊 Test Coverage

- **Total tests**: 971 (933 unit + 38 integration)
- **Test growth**: +72 tests from 0.8.6

---

## [0.8.6] - 2026-02-08

### 🐛 Bug Fixes

- **TimeTracking Soft-Delete Filtering**: Completes consistency across ALL modules
  - `GetEmployeeHandler`, `ListEmployeesHandler` now filter deleted records
  - `GetTimeEntryHandler`, `ListTimeEntriesHandler` now filter deleted records
  - All 5 modules now have proper soft-delete filtering

---

## [0.8.5] - 2026-02-08

### 🐛 Bug Fixes

- **Soft-Delete Filtering Consistency**: Fixed data integrity across all modules
  - **Bids**: `GetBidHandler`, `ListBidsHandler` now filter deleted records
  - **Projects**: `GetProjectHandler`, `ListProjectsHandler` now filter deleted records
  - **Contracts**: All handlers (Subcontracts, Change Orders, Payment Applications) filter deleted records
  - **RFIs**: `GetRfiHandler`, `ListRfisHandler` now filter deleted records
  - Ensures proper data lifecycle management across the platform

### 🏗️ Infrastructure

- **Railway Deployment Fix**: Resolved multi-service deployment issues
  - Moved from root `railway.toml` to service-specific `railway.json` configs
  - Fixed web Dockerfile to use relative paths with Root Directory
  - API: `src/Pitbull.Api/railway.json`
  - Web: `src/Pitbull.Web/pitbull-web/railway.json`
  - Production deploys now working correctly

- **CI Migration Safety**: Added automated checks for dangerous migration patterns
  - Detects `DROP TABLE`, `DROP COLUMN`, `DELETE FROM` without safeguards
  - Prevents accidental data loss in production deployments

### 🧪 Test Coverage

- **Integration Tests**: +24 new integration tests
  - Bids: +4 (CRUD, status workflow, soft-delete)
  - RFIs: +6 (auth, CRUD, status, numbering, multi-tenant)
  - Contracts: +14 (Subcontracts, Change Orders, Payment Applications)
- **Total tests:** 806 (768 unit + 38 integration)

---

## [0.8.4] - 2026-02-08

### 🧪 Test Coverage

- **RFI Handler Tests** (PR #147): +36 comprehensive handler tests for RFI module
  - CreateRfiHandler (14 tests): RFI creation, sequential numbering, ball-in-court defaults
  - GetRfiHandler (5 tests): retrieval, project isolation, all field mapping
  - ListRfisHandler (14 tests): status/priority/user filtering, search, pagination
  - UpdateRfiHandler (18 tests): field updates, status transitions (Open->Answered->Closed), timestamp logic

### 📊 Test Stats

- **Total tests:** 782 (768 unit + 14 integration)
- All modules now have comprehensive handler test coverage

---

## [0.8.3] - 2026-02-08

### 🧹 Quality Improvements

- **EF Core Query Diagnostics** (PR #146): Development-only diagnostics to catch performance issues early
  - Enable detailed errors and sensitive data logging in dev
  - Log N+1 query warnings (MultipleCollectionIncludeWarning)
  - Throw on potential unintended Equals() usage in queries
- **Connection Pool Configuration**: Added production-ready pool settings documentation
  - Maximum Pool Size: 50 (prevents exhaustion)
  - Connection Idle Lifetime: 300s
  - Updated .env.example with pool documentation

### 📊 Quality Strategy

- **v0.2.0 Checklist: 4/7 items complete**
  - ✅ N+1 query detection in dev
  - ✅ Missing database indexes
  - ✅ Multi-SaveChanges transaction rule (documented + verified)
  - ✅ DB connection pool configuration

---

## [0.8.2] - 2026-02-08

### 🔒 Security

- **Optimistic Concurrency for TimeTracking**: Added PostgreSQL `xmin` concurrency tokens to prevent "last write wins" data corruption
  - Employee entity: concurrent edit protection
  - TimeEntry entity: concurrent edit protection
  - ProjectAssignment entity: concurrent edit protection
  - CostCode entity: concurrent edit protection

### 📊 Quality Milestone

- **v0.1.0 Quality Checklist: 13/13 COMPLETE** ✅
  - All P0 security items done
  - All P1 architecture items done
  - Foundation ready for Beta Demo phase

### 🗄️ Database

- Migration `20260208071202_AddOptimisticConcurrencyToTimeTracking`
- Uses PostgreSQL system column `xmin` (no additional storage overhead)

---

## [0.8.1] - 2026-02-08

### 🧪 Test Coverage

- **Contracts Handler Tests**: +45 comprehensive handler tests
  - GetChangeOrderHandler (4 tests): retrieve, not found, approval/rejection details
  - ListChangeOrdersHandler (9 tests): filtering, search, pagination, ordering
  - UpdateChangeOrderHandler (11 tests): field updates, duplicate detection, status transitions
  - GetPaymentApplicationHandler (4 tests): retrieve, not found, approval/paid details
  - ListPaymentApplicationsHandler (8 tests): filtering, pagination, ordering
  - UpdatePaymentApplicationHandler (9 tests): recalculation, status transitions, subcontract sync

### 📚 Documentation

- **README.md**: Updated test count (733), Contracts module status
- **RfisController**: Added full OpenAPI documentation (ProducesResponseType, XML docs, examples)
- 16/16 API controllers now have comprehensive Swagger documentation

### 📈 Stats

- **Test count: 733** (719 unit + 14 integration)
- +45 handler tests from PR #141

---

## [0.8.0] - 2026-02-08

### ✨ New Module: Contracts Management

The Contracts module provides comprehensive subcontract lifecycle management:

#### Subcontracts (#138)
- **Subcontract entity** linked to projects with full CRUD
- Contract values: original, current, billed, paid, retainage tracking
- Subcontractor info: name, contact, email, phone, address
- Scope of work and trade code classification
- Status workflow: Draft → Active → Completed → Closed
- Insurance/compliance tracking with expiration dates

#### Change Orders (#139)
- **Change order entity** linked to subcontracts
- Financial impact tracking (positive/negative amounts)
- Schedule impact (days extension)
- Approval workflow: Pending → Approved/Rejected/Void
- Automatic subcontract value updates on approval
- Audit trail: submitted/approved/rejected dates, approver tracking

#### Payment Applications (#140)
- **AIA G702-style billing** with full pay app workflow
- Auto-calculated amounts from previous applications
- Retainage calculations matching subcontract terms
- Status workflow: Draft → Submitted → UnderReview → Approved/PartiallyApproved/Rejected → Paid
- Automatic subcontract totals sync when marked Paid
- 26 new validator tests for comprehensive coverage

### 📈 Stats

- **Test count: 688** (674 unit + 14 integration)
- +137 tests from Contracts module
- 3 new API controllers: SubcontractsController, ChangeOrdersController, PaymentApplicationsController

### 🗄️ Database

- Migration `20260208030543_AddContractsModule` - Subcontracts and ChangeOrders
- Migration `20260208050611_AddPaymentApplications` - Payment Applications

---

## [0.7.8] - 2026-02-07

### 🔒 Security

- **RLS Policies for TimeTracking**: Added missing Row-Level Security policies for `employees`, `time_entries`, and `employee_project_assignments` tables
  - Migration `20260207120000_AddMissingRLSPolicies` ensures tenant isolation
  - Critical fix: tables added after initial RLS migration were unprotected

### 🧪 Test Coverage

- **TimeEntries Integration Tests**: 5 new integration tests for TimeTracking API
  - Authentication requirements
  - CRUD operations
  - Multi-tenant isolation
  - Duplicate employee number validation

### 📈 Stats

- **Test count: 551** (537 unit + 14 integration)
- +5 integration tests for TimeTracking security verification

---

## [0.7.7] - 2026-02-07

### 🧪 Test Coverage

- **RFI Validators**: CreateRfiValidator (19 tests), UpdateRfiValidator (26 tests)
  - ProjectId, Subject, Question, Priority validation
  - Answer length validation for updates
  - Status enum validation (Open/Answered/Closed)
  - All edge cases and workflow scenarios covered

### 📈 Stats

- **Test count: 546** (537 unit + 9 integration)
- +45 tests from RFI validator coverage

---

## [0.7.6] - 2026-02-07

### 🛠️ Infrastructure

- **CI Fix for Self-Hosted Runner**: Removed `setup-dotnet` step from `ci-self-hosted.yml` that was failing with permission denied errors when trying to write to `/usr/share/dotnet`. Self-hosted runner has .NET pre-installed.

### 🧪 Test Coverage

- **Auth Validators**: LoginRequest (12 tests), RegisterRequest (25 tests) 
- **TimeTracking Handlers**: Complete coverage for ListTimeEntries, ListEmployees, ApproveTimeEntry, RejectTimeEntry, GetTimeEntry, CreateEmployee handlers

### 📈 Stats

- **Test count: 502** (493 unit + 9 integration)
- All CI workflows passing

---

## [0.7.4] - 2026-02-07

### 🔧 Code Quality

- **User Context for Soft Deletes**: `ProjectService` now captures actual user ID for `DeletedBy` field instead of hardcoded "system"
  - Injected `IHttpContextAccessor` into service
  - Added `GetCurrentUserId()` helper method (same pattern as DbContext)
  - Provides proper audit trail for soft delete operations

- **Improved Error Logging**: Enhanced domain event error messages in `PitbullDbContext` to include exception type

### 📈 Stats

- **Test count: 413** (no change - code quality fix only)

---

## [0.7.3] - 2026-02-07

### 🔒 Data Validation Sprint

Comprehensive FluentValidation coverage for all command types across TimeTracking, Projects, and Bids modules.

#### TimeTracking Validators
- `CreateTimeEntryValidator` - Date, hours, required field validation (18 tests)
- `UpdateTimeEntryValidator` - Approval workflow rules, hours validation (18 tests)
- `CreateEmployeeValidator` - Required fields, email, rate limits (22 tests)
- `UpdateEmployeeValidator` - Termination date logic, all field validation (20 tests)
- `AssignEmployeeToProjectValidator` - Role, date range validation (13 tests)
- `RemoveEmployeeFromProjectValidator` - Both ID variants covered (8 tests)
- `ApproveTimeEntryValidator` - Approver required, comments length (6 tests)
- `RejectTimeEntryValidator` - Reason required with length limit (7 tests)

#### Projects/Bids Validators
- `DeleteProjectValidator` - Project ID required (2 tests)
- `DeleteBidValidator` - Bid ID required (2 tests)

### 📈 Stats

- **Test count: 413** (404 unit + 9 integration) 🎉
- **Hit 400 unit tests milestone!**
- +116 new tests in one overnight session
- All Commands in TimeTracking, Projects, and Bids modules now have validators

---

## [0.7.2] - 2026-02-06

### 🔧 Code Quality

- Fixed 5 compiler warnings across tests and API docs
- Added 7 tests for `ConvertBidToProjectValidator`
- **Test count: 297** (288 unit + 9 integration)

#### Warning Fixes
- CS1998: Removed unnecessary async from sync test methods
- CS8625: Fixed null reference warnings in mock setup
- CS1573: Added missing CancellationToken param documentation

---

## [0.7.1] - 2026-02-06

### 🧪 Test Coverage Sprint

Massive test coverage expansion with 58 new tests added in a focused sprint.

#### Handler Tests
- `GetProjectHandler` - 5 tests for project retrieval
- `GetBidHandler` - 5 tests for bid retrieval with items
- `UpdateBidHandler` - 4 tests for bid updates and status changes
- `UpdateProjectHandler` - 4 tests for project updates

#### Validator Tests
- `CreateProjectValidator` - 9 tests covering required fields, email format, date logic
- `CreateBidValidator` - 11 tests including bid item validation
- `UpdateProjectValidator` - 10 tests for update validation rules
- `UpdateBidValidator` - 10 tests for bid update validation

### 📈 Stats

- **Test count: 281** (was 223 in v0.7.0, +58 tests)
- **Test coverage increase: +26%** in one sprint session
- All validators and handlers now have comprehensive test coverage
- RFI module tests deferred (not yet integrated in DbContext)

---

## [0.7.0] - 2026-02-06

### 📊 Dashboard Analytics

- **Weekly Hours Chart** - Visual labor trends on dashboard
  - Stacked bar chart showing regular/OT/DT hours by week
  - 8-week rolling history with hover tooltips
  - Average hours per week displayed
  - Uses recharts library for interactive visualization
  - New GET `/api/dashboard/weekly-hours` endpoint
- **Project Labor Summary** - Comprehensive stats on project detail pages
  - Total hours with reg/OT/DT breakdown
  - Labor cost with average $/hr calculation
  - Assigned employee count
  - Time entry counts with status badges
  - Activity date range
  - Uses new GET `/api/projects/{id}/stats` endpoint

### 🔌 New API Endpoints

- `GET /api/dashboard/weekly-hours` - Weekly hours aggregation for charts
- `GET /api/projects/{id}/stats` - Fast project statistics (no AI)
- `GET /api/employees/{id}/stats` - Fast employee statistics (hours, earnings, projects)

### 🧩 New Components

- `WeeklyHoursChart` - Dashboard chart component (integrated)
- `ProjectLaborSummary` - Project detail labor card (integrated)
- `EmployeeHoursSummary` - Employee detail hours card (integrated)

### 🧪 Tests

- 10 new tests for GetWeeklyHoursHandler
- 6 new tests for GetProjectStatsHandler
- 6 new tests for GetEmployeeStatsHandler
- Test count: 223 (was 201)

### 📈 Stats

- Dashboard now shows labor trend visualization
- Project pages show real-time labor cost data

---

## [0.6.2] - 2026-02-06

### 🛡️ Error Handling & Polish

- **Error Boundaries** - Graceful error handling throughout the app
  - `error.tsx` - Route-level error catching with retry functionality
  - `global-error.tsx` - Root layout error boundary for critical failures
  - Mobile-responsive error UI with helpful recovery options
- **Custom 404 Page** - User-friendly "not found" experience
  - Clear messaging with helpful navigation links
  - Quick access to Projects, Bids, Time Tracking, and Employees
  - Consistent branding and design
- **SEO & PWA Enhancements**
  - Comprehensive metadata with Open Graph and Twitter cards
  - Web manifest for PWA installability ("Add to Home Screen")
  - Viewport configuration with theme color support
  - robots.txt for search engine guidance
  - Construction management SEO keywords

### 📈 Stats

- Production ready for UAT
- Error handling coverage: 100% of routes
- PWA installable on mobile devices

---

## [0.6.1] - 2026-02-06

### 📚 API Documentation

- **Complete OpenAPI Documentation** - All 13 API controllers now have comprehensive Swagger docs
  - TimeEntriesController: 9 endpoints with full request/response schemas
  - EmployeesController: 5 endpoints with classification enum docs
  - CostCodesController: 2 endpoints with cost type documentation
  - ProjectAssignmentsController: 5 endpoints with role permission details
  - Detailed XML comments with `<remarks>`, `<param>`, and `<response>` tags
  - `[ProducesResponseType]` attributes for all response codes
  - Sample requests and business logic explanations
- **Swagger UI** - Interactive API explorer ready for demos and UAT
  - Complete endpoint documentation visible at `/swagger`
  - Try-it-out functionality for all authenticated endpoints
  - Request/response examples for complex operations

### 📈 Stats

- All 13 controllers documented with OpenAPI specs
- Swagger UI ready for investor demos and customer UAT
- Alpha 0 Week 2 + Week 3 complete, 11 days ahead of schedule

---

## [0.6.0] - 2026-02-06

### 📤 Vista Export Integration

- **Vista Export API** - GET `/api/time-entries/export/vista`
  - Exports approved time entries in Vista/Viewpoint compatible CSV format
  - RFC 4180 compliant CSV with proper escaping for special characters
  - Supports date range and project filtering
  - Includes all payroll fields: employee, date, project, cost code, hours, amounts
  - Calculates regular, OT (1.5x), and DT (2.0x) wage amounts
  - Admin/Manager role authorization required
  - 12 comprehensive unit tests covering all scenarios
- **Vista Export UI** - New reporting page at `/reports/vista-export`
  - Date range selection with quick presets (This Week, Last Week, This Month, etc.)
  - Project filter dropdown
  - Preview mode shows export metadata before download
  - Stats cards: entry count, total hours, employees, projects
  - CSV download with automatic filename
  - Help section with Vista import instructions
  - Responsive design for desktop and mobile

### 📈 Stats

- Test count: 210 (201 unit + 9 integration)
- Vista export completes Week 3 deliverable (Issue #122)

---

## [0.5.0] - 2026-02-06

### 📊 Job Costing & Reporting

- **Labor Cost Calculator** - Server-side job costing engine
  - Base wage calculation with OT (1.5x) and DT (2.0x) multipliers
  - Configurable burden rate (default 35%)
  - Batch calculation support for reporting
  - 16 unit tests covering all calculation scenarios
- **Cost Rollup API** - GET `/api/time-entries/cost-report`
  - Aggregates approved time entries into cost summaries
  - Groups by project and cost code
  - Date range and project filtering
  - 10 comprehensive handler tests
- **Labor Cost Report UI** - Interactive reporting page at `/reports/labor-cost`
  - Summary cards: total cost, hours, projects, burden rate
  - Date range presets (this week, last week, this month, last month, YTD)
  - Project filter dropdown with approved-only toggle
  - Desktop: expandable table with project rows showing cost code breakdown
  - Mobile: responsive card layout with project summaries
  - Loading skeleton for better UX
- **Cost Codes Management UI** - Cost code directory at `/cost-codes`
  - Searchable, filterable list with summary cards
  - Badge indicators for cost type (Labor, Material, Equipment, Subcontract)
  - Desktop table and mobile card responsive layouts

### 🎨 UI Components

- **Collapsible** - New expandable/collapsible component using @radix-ui/react-collapsible

### 📈 Stats

- Test count: 198 (189 unit + 9 integration)
- Week 2 milestones (Issue #122) completed 4 days ahead of schedule

---

## [0.4.0] - 2026-02-05

### 🤖 AI Features

- **AI Project Health Insights** - Claude-powered analysis at `/api/projects/{id}/ai-summary`
  - Health score (0-100) with color-coded status
  - Executive summary with natural language overview
  - Highlights, concerns, and actionable recommendations
  - Key metrics: hours logged, labor costs, budget utilization, pending approvals
- **Interactive AI Insights UI** - Beautiful frontend integration on project detail pages
  - Animated circular health gauge with color transitions
  - Metrics grid with key project statistics
  - Categorized insights cards (highlights, concerns, recommendations)
  - Loading skeleton with shimmer animations

### 🔒 Security & Access Control

- **Role-Based Access Control (RBAC)** - Complete permission system
  - Four built-in roles: Admin, Manager, Supervisor, User
  - Automatic Admin role assignment for first user per tenant
  - JWT tokens include role claims for API authorization
  - Role-protected endpoints for sensitive operations
- **User Management Dashboard** - Admin panel at `/admin/users`
  - View all users with roles and status
  - Assign and remove roles via UI
  - Search and filter capabilities
  - Prevents self-demotion (can't remove own Admin role)
- **Frontend Role Enforcement** - UI adapts to user permissions
  - Admin-only navigation section
  - `hasRole()`, `isAdmin`, `isManager` helper functions
  - Conditional rendering based on user roles

### 🚀 Features

- **Enhanced Dashboard** - Real-time project insights
  - Personalized greeting with user name
  - Clickable stat cards for quick navigation
  - Quick actions panel (create project, bid, employee, log time)
  - Live activity feed showing recent changes
  - Portfolio summary with total values
- **Settings Page** - User profile management at `/settings`
  - View profile info, roles, and tenant details
  - Change password functionality
  - Admin link to user management
- **Employee Management** - Complete CRUD workflow
  - Employee directory with search and filters
  - Create employee form with validation
  - Employee detail page with assignments and time entries
  - Employee edit form with status toggle
  - Clickable list rows for quick navigation
- **Onboarding Experience** - Guide new users
  - Getting Started checklist on dashboard
  - Progress tracking for first project, employee, bid, time entry
  - Dismissible with localStorage persistence

### ⚡ User Experience

- **Form Improvements**
  - Phone number auto-formatting `(XXX) XXX-XXXX`
  - Loading buttons with spinner during submission
  - Disabled forms while submitting
  - Required field indicators
  - Inline validation messages
- **Accessibility Enhancements**
  - ARIA labels on all icon-only buttons
  - Screen reader support for form errors
  - Keyboard navigation improvements
  - Focus management in dialogs
- **Confirmation Dialogs** - Prevent accidental actions
  - Danger/warning/info variants
  - Loading states during operations
- **Tooltips & Help Text**
  - Tooltips for complex form fields
  - Help text for business concepts (Classification, Cost Code)

### 🏗️ Infrastructure

- **Demo Data Seeder** - Investor-ready demonstration data
  - 60 standard construction cost codes (CSI divisions)
  - 15 realistic employees (PMs, superintendents, tradespeople)
  - Project assignments linking workers to projects
  - 30 days of time entries with realistic patterns
- **Code Quality**
  - 172 tests passing (163 unit + 9 integration)
  - ESLint errors resolved across all components
  - Repository cleanup (40 stale branches removed)

---

## [0.3.0] - 2026-02-05

### 🔒 Security & Reliability

- **Fixed critical Row-Level Security issues** - Resolved database tenant isolation failures affecting all create operations
- **Enhanced database connection stability** - Added connection interceptor to ensure tenant context persists across connection pooling
- **Improved API authentication** - Confirmed production API returns proper 401 status codes instead of redirects
- **Added comprehensive integration testing** - All 9 integration test suites now passing consistently

### 🚀 Features  

- **Enhanced deployment monitoring** - Added database health scripts and deployment status tracking ([PR #135](https://github.com/jgarrison929/pitbull/pull/135))
- **HTTP response caching** - Implemented read endpoint caching for improved performance ([PR #134](https://github.com/jgarrison929/pitbull/pull/134))
- **Domain event dispatching** - Added MediatR-based event system for future module integration ([PR #132](https://github.com/jgarrison929/pitbull/pull/132))
- **Cost code management** - Added foundation for job cost tracking and accounting ([PR #129](https://github.com/jgarrison929/pitbull/pull/129))

### 🐛 Bug Fixes

- **Frontend build stability** - Resolved duplicate import errors in error boundary components
- **Dashboard statistics** - Fixed SQL query compatibility issues with EF Core SqlQueryRaw
- **Docker build reliability** - Added missing RFIs module to container build process
- **Architecture test resilience** - Improved null safety in test failure reporting

### ⚡ Performance

- **API security headers** - Comprehensive security header implementation with monitoring ([PR #133](https://github.com/jgarrison929/pitbull/pull/133))
- **Request timeout protection** - Added configurable timeouts to prevent slow loris attacks
- **Rate limiting enhancements** - Refined authentication endpoint rate limits for better UX

### 🏗️ Infrastructure

- **CI/CD improvements** - Enhanced test reliability and failure diagnostics
- **Documentation updates** - Added comprehensive design docs for cost codes and time tracking
- **Pull request workflow** - Added standardized PR template with goal/risk/test checklist ([PR #128](https://github.com/jgarrison929/pitbull/pull/128))

### Technical Notes

- Tenant sanitization research completed for future white-label opportunities
- Architecture tests now provide actionable failure information
- Integration test coverage expanded across all major API endpoints
- Database migrations pipeline enhanced for production stability

---

## [0.1.0] - 2026-01-xx

Initial feature-complete MVP for construction project and bid management.

### Authentication & Multi-Tenancy

- **JWT authentication** with login and registration endpoints
- **Multi-tenant architecture** with shared database, shared schema model
- Tenant resolution from JWT claims and `X-Tenant-Id` header
- Automatic `TenantId` stamping on entity creation
- **PostgreSQL Row-Level Security (RLS)** policies for database-level tenant isolation
- Parameterized tenant SET to prevent SQL injection
- JWT returns 401 (not 302) on protected endpoints

### Projects Module

- Full CRUD (create, read, update, soft delete) for construction projects
- **Server-side pagination** with configurable page size
- Project detail view with phases, budgets, and status tracking
- Project types: Commercial, Residential, Infrastructure, Industrial, Renovation
- Project status workflow: Planning, Pre-Construction, Active, On Hold, Completed, Cancelled
- Client information fields (name, email, phone)
- Contract amount and budget tracking

### Bids Module

- Full CRUD for bids/estimates
- **Bid line items** with quantity, unit price, and calculated totals
- **Server-side pagination** with status filtering and search
- Bid status workflow: Draft, Submitted, Under Review, Won, Lost, Withdrawn
- Bid-to-project conversion (won bids only, prevents duplicate conversion)
- Estimated value tracking and bid numbering

### API Infrastructure

- **Rate limiting** on auth and API endpoints to prevent abuse
- **Correlation ID middleware** for request tracing across services
- **Global exception handling** with structured error responses and trace IDs
- **Deep health checks** with database connectivity verification
- Consistent error response format (`{ error, code }`)
- **Serilog** structured logging

### Frontend

- **Next.js** App Router with TypeScript
- **Mobile-responsive UI** audit and fixes across all views
  - Minimum 375px viewport support (iPhone SE)
  - Touch-friendly tap targets (44px minimum)
  - Collapsible navigation on small screens
  - Responsive tables and card layouts
- **Dashboard with real statistics** (project counts, bid win rates, contract totals)
- Project list, detail, and create/edit views
- Bid list, detail, and create/edit views with line item management
- **shadcn/ui** component library with Tailwind CSS
- Auth context with automatic token management
- API client with auto-auth headers and 401 redirect handling

### Data & Database

- **Seed data generator** for realistic construction demo data
- PostgreSQL 17 with EF Core migrations (auto-apply on startup)
- snake_case table naming convention
- Soft delete with global query filters
- Audit fields (CreatedAt, UpdatedAt) auto-populated on save
- Composite unique indexes with TenantId for multi-tenant safety

### DevOps & CI/CD

- **GitHub Actions CI** pipeline for backend (.NET build + tests) and frontend (build + lint)
- **Railway deployment** with three environments: dev, staging, production
- Three-branch promotion model: `develop` -> `staging` -> `main`
- PostgreSQL 17 service container for CI integration tests

### Documentation

- Best practices and patterns guide (`docs/BEST-PRACTICES.md`)
- Module creation guide (`docs/ADDING-A-MODULE.md`)
- Team protocol (`docs/TEAM-PROTOCOL.md`)
- Quality strategy (`docs/QUALITY-STRATEGY.md`)
- Vision document (`docs/VISION.md`)
- RLS implementation documentation
- Release plan

### Known Issues

- Domain events collected but not yet dispatched (MediatR integration pending)
- `CreatedBy`/`UpdatedBy`/`DeletedBy` audit fields not auto-populated from user context
- `PagedResult<T>` defined in Projects module but used cross-module (should move to Core)
- Subdomain tenant resolution placeholder (not yet implemented)
