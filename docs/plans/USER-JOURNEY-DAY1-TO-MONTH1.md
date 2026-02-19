# User Journey: Day 1 to Month 1

**Date:** February 18, 2026  
**Author:** River (audit agent)  
**Status:** Roadmap Reference  
**Sources:** FUNCTIONAL-REVIEW.md, CUSTOMER-ONBOARDING-FLOW.md, full codebase audit (86 routes, 54 controllers)

---

## Persona

**Karen Mitchell, Office Manager / Controller**  
- 50-person general contractor, $45M annual revenue  
- Currently on Vista (Trimble Viewpoint) and supplementing with spreadsheets  
- Managing 12 active projects, 35 field employees, 8 office staff  
- Needs: payroll processing, job costing, payment applications, compliance tracking  
- Pain points: Vista is expensive and clunky, data lives in too many places, field guys can't use it  
- Success metric: "Can I close a pay period and send a payment app faster than Vista?"

---

## Day 1 — Setup & Onboarding

### What happens step by step

#### 1. Sign Up (`/signup`)
**File:** `src/Pitbull.Web/pitbull-web/src/app/(auth)/signup/page.tsx`

Three-step wizard:
1. **Account** — First name, last name, email, password (with strength meter), confirm password, terms checkbox
2. **Company** — Company name (required), industry type dropdown (GC, specialty, etc.), employee range (1-10 through 500+)
3. **Invite Team** — Up to 10 email/role pairs (Admin, Manager, Supervisor, User, Viewer). Skippable.

On submit:
- Calls `register()` from AuthContext → `POST /api/auth/register`
- Auto-creates tenant + company + first user as Admin (via `RoleSeeder`)
- Sends bulk invitations via `POST /api/invitation/bulk` (non-blocking — signup succeeds even if invites fail)
- Redirects to `/settings/company/setup`
- Shows success toast

**What works:** Clean 3-step flow, password validation is real-time, role picker is appropriate for construction teams, skip option for invites is good.

#### 2. Company Setup Wizard (`/settings/company/setup`)
**File:** `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/settings/company/setup/page.tsx`

Four-step wizard:
1. **Company Profile** — Name, address, phone, tax ID, license number
2. **Contractor Type** — General Contractor / Specialty / Design-Build / CM at Risk (with descriptions and preset module configs)
3. **Module Activation** — Toggle: Projects, Contracts, Bids, RFIs, Reports (all on by default)
4. **Initial Settings** — Project numbering format, default retainage %, auto-create phases, contract approval workflow, bid defaults, RFI defaults, report date range default

**What works:** Contractor type presets are smart — selecting "General Contractor" enables all modules. Settings defaults are sensible (10% retainage, sequential approval, etc.).

#### 3. First Dashboard Load (`/`)
**File:** `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/page.tsx`

Dashboard shows:
- **Welcome Tour** (`components/onboarding/welcome-tour.tsx`) — Modal walkthrough of key features. API-backed (`/api/onboarding/tour`), step-by-step with "Go to Page" links.
- **Onboarding Checklist** (`components/onboarding/onboarding-checklist.tsx`) — 8-item checklist backed by `/api/onboarding/checklist`:
  1. Complete company profile → `/settings/company/setup`
  2. Select contractor type → `/settings/company/setup`
  3. Activate modules → `/settings/company/setup`
  4. Configure module settings → `/settings`
  5. Invite team members → `/admin/users`
  6. Create your first project → `/projects/new`
  7. Add employees → `/employees/new`
  8. Review cost codes → `/cost-codes`
- KPI cards (Active Projects, Hours This Week, Pending Approvals, Open RFIs)
- Project Budget Health, Weekly Hours Trend, Upcoming Deadlines, Recent Activity

#### 4. Invite Team Members
**Two paths exist:**
- During signup Step 3 (bulk invite via `/api/invitation/bulk`)
- Post-signup via Admin → Users (`/admin/users`)

Invited users receive email → click link → `/invite/[token]` → set password → join tenant with assigned role.

**File:** `src/Pitbull.Web/pitbull-web/src/app/(auth)/invite/[token]/page.tsx`  
**Backend:** `src/Pitbull.Api/Controllers/InvitationController.cs`

### What's missing or broken in this flow

| Issue | Severity | Detail |
|-------|----------|--------|
| **No email verification** | Medium | Signup spec calls for it (Section 4.1 of onboarding flow doc), but `/verify-email` page is placeholder — no backend flow. Users go straight to dashboard. |
| **No setup gating** | Medium | Onboarding flow spec says "redirect to `/setup` if incomplete" but dashboard loads regardless. Users can skip the entire wizard. |
| **Duplicate `/register` page may still exist** | Low | Functional review flagged it. If still present, it has a broken "Add team members" TODO stub. `/signup` is the correct page. |
| **Industry type / employee range not persisted** | Medium | Signup Step 2 collects `industryType` and `employeeRange` but `register()` only sends `firstName, lastName, email, password, companyName`. This data is lost. |
| **No "What should I do first?" guidance after setup wizard** | Low | Setup wizard ends → user lands on settings page, not dashboard. Welcome tour and checklist exist on dashboard but user has to navigate there. |
| **Overtime rules only in localStorage** | High | `/settings/overtime` saves to browser only, not API. See Functional Review #6. Karen configures overtime on her laptop; her payroll clerk on a different machine sees different rules. |

---

## Day 2-3 — Data Entry

### Dependency Order (Critical Path)

Karen needs to enter data in this specific order because of foreign key / dropdown dependencies:

```
1. Cost Codes (standalone — no dependencies)
   └── Required by: Time Entries, Job Cost tracking
   
2. Employees (standalone — no dependencies)
   └── Required by: Time Entries, Project Assignments
   
3. Projects (standalone, but better with cost codes)
   └── Required by: Time Entries, Contracts, RFIs, Daily Reports
   
4. Equipment (standalone)
   └── Referenced by: Time Entries (optional)
   
5. Contracts/Subcontracts (requires Projects)
   └── Required by: Payment Applications, Change Orders, SOV
   
6. Time Entries (requires Employees + Projects + Cost Codes)
   └── Required by: Approvals, Reports, Payroll, Vista Export
```

**The sidebar does NOT present these in dependency order.** (See Navigation Audit below.)

### Adding Cost Codes
**Route:** `/cost-codes`  
**File:** `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/cost-codes/page.tsx`

Full CRUD with dialog-based create/edit. Fields: Code, Description, Division, Cost Type (Labor/Material/Equipment/Subcontract/Other), Active status. Pagination, search, filtering, sorting all work. Mobile card layout exists. Summary cards show counts by type.

**What works well:** This page is solid. Search with debounce, proper pagination (25/page), sort on all columns, good empty state with keyboard shortcut hint (N to add).

**What's missing:** No bulk import on this page (but CSV import exists at `/admin/data-import` for cost codes). No seed/template button for standard CSI division codes — Karen has to manually enter hundreds of codes or use CSV import.

### Adding Employees
**Route:** `/employees/new` (single) or `/employees/import` (CSV bulk)  
**Files:**
- `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/employees/new/page.tsx`
- `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/employees/import/page.tsx`

**Single entry:** Form collects name, email, phone, employee number, classification, title, hire date, base hourly rate, certifications, emergency contacts.

**CSV import:** Upload CSV with template download, row-by-row validation preview, confirm/cancel. Parser supports quoted fields (RFC 4180).

**CRITICAL BUG:** Certifications and emergency contacts are collected in the UI but NOT included in the API payload on submit. Data is silently lost. (Functional Review #3)

**CSV import issue:** Parser breaks on quoted fields with commas per the functional review, but the code does implement RFC 4180 parsing. May need testing.

### Adding Projects
**Route:** `/projects/new`  
**File:** `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/projects/new/page.tsx`

Multi-step form with auto-save. Fields include project number, name, description, address, client info, dates, budget, status. Validation is strong.

**What works:** Excellent form — auto-save prevents data loss, validation is real-time, multi-step keeps it manageable.

**What's missing:** No project import via CSV (would help Vista migration). Project list has no pagination (Functional Review: loads 50, no "next page" for companies with 200+ projects). **Update:** Data import at `/admin/data-import` supports project CSV import.

### CSV Import Hub
**Route:** `/admin/data-import`  
**File:** `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/admin/data-import/page.tsx`  
**Backend:** `src/Pitbull.Api/Controllers/DataImportController.cs`

Supports importing:
- Employees
- Projects  
- Cost Codes
- Equipment
- Time Entries

Features: Template download per type, file upload with drag-and-drop, preview with validation (row-by-row errors shown), confirm to commit, import history log. Export also available for time entries, employees, projects, cost codes.

**What works:** Two-phase import (preview → confirm) is the right pattern. History tracking is good for audit.

**What's missing:** 
- Located under Admin section — Karen might not find it. Should be accessible from the entity pages too (e.g., button on `/employees` that says "Import CSV").
- No Vista-specific import format. Karen's Vista data exports in a specific format; she'd need to reformat to match Pitbull's CSV template.
- Role-gated to Admin/Manager — correct, but the import button on `/employees/import` is a separate page that also exists. Two import paths for employees.

### Data Entry Summary Table

| Entity | Single Create | CSV Import | Bulk Import via Admin | Works? |
|--------|--------------|------------|----------------------|--------|
| Cost Codes | ✅ `/cost-codes` | — | ✅ `/admin/data-import` | ✅ Solid |
| Employees | ⚠️ `/employees/new` (cert bug) | ✅ `/employees/import` | ✅ `/admin/data-import` | ⚠️ Cert/emergency data lost |
| Projects | ✅ `/projects/new` | — | ✅ `/admin/data-import` | ✅ Good |
| Equipment | ✅ `/equipment` | — | ✅ `/admin/data-import` | ✅ Good |
| Time Entries | ✅ `/time-tracking/new` | — | ✅ `/admin/data-import` | ✅ Good |
| Contracts | ✅ `/contracts/new` | — | ❌ No CSV import | Manual only |
| RFIs | ✅ `/rfis/new` | — | ❌ No CSV import | Manual only |

---

## Week 1 — First Value Moment

### First Time Entries Submitted by Crew

**Three entry modes (smart!):**
1. **Individual entry** — `/time-tracking/new` — Single time entry for one employee
2. **Crew entry** — `/time-tracking/crew-entry` — Superintendent enters for whole crew. Three sub-modes: daily, weekly detailed, weekly simple. Templates for common crews.
3. **Mobile entry** — `/time-tracking/mobile` — Phone-optimized layout for field use

**What works:**
- Crew entry with templates saves significant time vs individual entry
- Three modes accommodate different superintendent workflows  
- Mobile layout exists and is phone-optimized
- Equipment hours can be tracked alongside labor

**What breaks:**
- **Week start inconsistency:** Approval page uses Monday start. Crew entry uses Monday start. But company settings allow configuring work week start day, and pages don't read this setting. (Functional Review #7) If Karen's company uses a Sunday–Saturday work week (common in construction), hours could land in wrong weeks.
- **Mobile navigation now works** — mobile sidebar is implemented via Sheet/hamburger in header (`app-sidebar-mobile.tsx` wired into `app-header.tsx`). This was flagged as broken in the Functional Review but has since been built.
- **No token refresh** — Field workers filling out 30-minute crew entries lose everything if JWT expires mid-session. No warning, no recovery. (Functional Review #4)
- **Mobile employee lookup by email** — Field crew may not know their company email addresses

### PM Reviews and Approves

**Route:** `/time-tracking/approval`  
**File:** `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/time-tracking/approval/page.tsx`

Approval page shows:
- Review queue filtered by project, date range
- Checkbox selection for batch operations
- Per-entry approve/reject with comments
- Summary statistics

**What works:** Queue concept is right. Project and date filtering works. Individual approve/reject with comments.

**What's missing:**
- **No bulk approve** — Cannot "approve all" for a project/week. Each entry needs individual action. For 35 field workers × 5 days = 175 entries/week, this is painful.
- **Table not scrollable on smaller screens** — 8+ columns cut off without horizontal scroll
- **No notification to PM** when entries are submitted — PM has to check the approval queue proactively

### First Reports Generated

**Routes:**
- `/reports/labor-cost` — Hours by employee, cost code, or phase with date range
- `/reports/project-profitability` — Budget vs actual by project
- `/reports/weekly-summary` — Employee × day grid for the week
- `/reports/financial-overview` — High-level financial metrics
- `/reports/equipment` — Equipment utilization rates
- `/reports/vista-export` — Export time data in Vista-compatible format

**What works:** Labor cost report with grouping (by employee, cost code, phase) is the core "first value" report. Weekly summary gives a payroll-ready view. Reports have export functionality.

**What breaks:**
- **Breadcrumb links on ALL report pages hardcode to `/reports/labor-cost`** — navigating between reports via breadcrumbs always goes to labor cost (Functional Review)
- **CSV export escaping issues** — Commas in descriptions break column alignment (Functional Review)
- **Vista export bypasses the `api()` wrapper** — Uses direct fetch with undocumented Accept header pattern. May have auth/error handling gaps.

### What Makes Karen Say "This Is Better"

1. **Crew time entry with templates** — Vista doesn't have anything this fast for bulk entry
2. **Real-time dashboard** — Active projects, hours this week, pending approvals at a glance (Vista requires running reports)
3. **Mobile access** — Her supers can enter time from the job site (Vista mobile is terrible)
4. **AI chat panel** — Can ask questions about projects/data (nothing like this in Vista)
5. **Modern UI** — shadcn/ui looks professional; Vista looks like 2005

---

## Week 2-3 — Deeper Adoption

### Subcontracts and Compliance

**Routes:**
- `/contracts` — Contract list with status filtering
- `/contracts/new` — New subcontract via SubcontractEditor component
- `/contracts/[id]` — Contract detail (overview, linked docs)
- `/contracts/[id]/sov` — Schedule of Values (inline editing)
- `/admin/compliance` — Compliance document tracking

**What works:** Contract creation with SOV line items works. Compliance tracking page exists.

**What breaks:**
- **SOV CSV export has escaping bugs** — commas in description fields break columns
- **Change orders have no status transition validation** — can jump between statuses arbitrarily
- **No file attachments on contracts** — Document upload not implemented (documents page is list-view only)

### RFIs and Change Orders

**Routes:**
- `/rfis` — RFI list with filtering and search
- `/rfis/new` — Create RFI (has "Similar RFIs" AI feature — but uses **mocked data**, not real AI)
- `/rfis/[id]` — RFI detail with status workflow and response tracking
- `/change-orders` — Change order list
- `/contracts/[id]/change-orders` — Per-contract change orders

**What works:** RFI status workflow (Open → Responded → Closed) works. RFI list has good filtering.

**What's missing:**
- **No file attachments on RFIs** — Cannot attach drawings, photos, or markups
- **Similar RFIs feature is fake** — Uses hardcoded mock data, not real AI embeddings
- **No email notifications** for RFI responses or change order approvals
- **Change order workflow** — No status transition validation (can mark as Approved without going through review)

### Payment Applications

**Routes:**
- `/payment-applications` — List of all payment apps
- `/payment-applications/[id]` — Detail with approve/reject
- `/contracts/[id]/payment-applications` — Per-contract payment apps

**What works:** Payment app list with status filtering. Detail page shows line items and amounts.

**What breaks:**
- **Reject action uses wrong endpoint** — Sends generic PUT instead of dedicated `/reject` endpoint. Rejection logic (status validation, notifications, audit trail) may not execute. (Functional Review #10)
- **Period date validation missing** — End date can be before start date
- **No AIA G702/G703 format** — Construction industry standard payment application format. Currently a generic form.

### AI Features (What Works Right Now)

**Components:**
- **AI Chat Panel** (`components/ai-chat-panel.tsx`) — Floating chat in dashboard layout. Available on every page. Can ask questions about projects, costs, etc.
- **AI Suggest** — API endpoint exists (`AiSuggestController.cs`) but unclear frontend integration
- **AI Document** — Document understanding endpoint (`AiDocumentController.cs`)

**What actually works:**
- Chat panel is accessible from any page
- Provider fallback (preferred → fallback) works gracefully
- API key management is solid (encrypted, fingerprinted, with expiration)

**What doesn't work:**
- **No context awareness** — Chat doesn't know what page/project you're viewing. Have to manually explain context.
- **No streaming** — Long responses show spinner with no progress
- **Generic error messages** — "Failed to get response" instead of actual error
- **No conversation length management** — Will eventually hit token limits
- **Similar RFIs = mocked** — Fake data, not real embeddings
- **No AI in reports** — Could flag anomalies, generate summaries
- **No AI in bid analysis** — Could flag unusual pricing in sub bids

---

## Month 1 — First Close

### First Pay Period Closed

**Route:** `/admin/pay-periods`  
**Backend:** `src/Pitbull.Api/Controllers/PayPeriodsController.cs`

Pay period management allows creating, locking, and closing pay periods.

**What works:** Pay period CRUD exists. Lock/close workflow.

**What breaks:**
- **No admin access control on the page** — Any authenticated user can access `/admin/pay-periods` directly (Functional Review #2). A field worker could accidentally lock a pay period.
- **Overtime rules in localStorage only** — Overtime calculations for the pay period may be wrong or inconsistent across browsers. If Karen configured California overtime on her laptop and the payroll clerk runs reports on a different machine, the calculations differ.
- **Week start inconsistency** — If time entries span the wrong weeks, payroll totals will be off.

### First Payment App Cycle Complete

**Workflow:**
1. Create subcontract with SOV → `/contracts/new`
2. Sub does work → track progress at `/contracts/[id]/sov`
3. Create payment application → `/contracts/[id]/payment-applications`
4. Review and approve → `/payment-applications/[id]`
5. Print/export → `/contracts/[id]/print`

**What's blocking a clean cycle:**
- Reject endpoint is wrong (Functional Review #10)
- No AIA G702/G703 format
- No retainage tracking workflow (settings exist but unclear if calculations are end-to-end)
- SOV CSV export has escaping bugs

### Vista Export (Migration Path)

**Route:** `/reports/vista-export`  
**File:** `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/reports/vista-export/page.tsx`

Exports time entry data in Vista-compatible format. Features:
- Date range presets (this week, last week, this month, last month, YTD)
- Project filter
- Monday-based week start (using `getWeekStart` utility)
- Shows metadata: filename, row count, total hours, employee count, project count

**What works:** Export with date presets and project filtering is the right UX. Preview metadata before download.

**What breaks:**
- **Bypasses `api()` wrapper** — Uses direct `fetch` with `getToken()` and custom `Accept: text/csv` header. Misses error tracking, doesn't benefit from any future token refresh logic.
- **No Vista-to-Pitbull import** — Karen can get data OUT of Pitbull into Vista format, but can't bring her Vista data INTO Pitbull. She'd need to manually reformat Vista exports to match Pitbull's CSV templates.

### What Data Proves the System Is Working

Karen needs to see by Month 1:
1. ✅ **Dashboard KPIs** — Active projects, hours this week, pending approvals, budget health (all exist)
2. ⚠️ **Labor cost report matching her payroll** — Exists but overtime rules are localStorage-only
3. ⚠️ **Payment app amounts matching contract SOV** — Exists but reject workflow is broken
4. ✅ **Weekly summary matching time cards** — Report exists and groups by employee × day
5. ⚠️ **Vista export matching what she'd generate in Vista** — Export exists but format compatibility unverified
6. ❌ **Audit trail of all approvals** — Audit logs exist (`/admin/audit-logs`) but no approval-specific view

---

## Navigation Audit

### Current Sidebar Structure

**File:** `src/Pitbull.Web/pitbull-web/src/components/layout/nav-items.ts`

```
MAIN NAV
├── Dashboard          /
├── Projects           /projects
├── Bids               /bids
├── Time Tracking      /time-tracking
├── Employees          /employees
├── Cost Codes         /cost-codes
├── Equipment          /equipment
├── Contracts          /contracts
├── Change Orders      /change-orders
├── Pay Apps           /payment-applications

PROJECT MANAGEMENT (context-sensitive, requires selected project)
├── Schedule           /projects/[id]/schedule
├── Job Cost           /projects/[id]/job-cost
├── RFIs               /projects/[id]/rfis
├── Submittals         /projects/[id]/submittals
├── Plans & Specs      /projects/[id]/plans-specs
├── Communications     /projects/[id]/communications
├── Daily Reports      /projects/[id]/daily-reports
├── Progress           /projects/[id]/progress
├── Projections        /projects/[id]/projections
├── Meetings           /projects/[id]/meetings
├── Documents          /projects/[id]/documents
├── Tasks              /projects/[id]/tasks
├── Narratives         /projects/[id]/narratives

REPORTS
├── Labor Cost         /reports/labor-cost
├── Project Profit     /reports/project-profitability
├── Weekly Summary     /reports/weekly-summary
├── Financial Overview /reports/financial-overview
├── Equipment Util     /reports/equipment
├── Vista Export       /reports/vista-export

SETTINGS
├── Preferences        /settings
├── Notifications      /settings/notifications
├── Overtime Rules     /settings/overtime
├── Projects           /settings/projects
├── Contracts          /settings/contracts
├── Bids               /settings/bids
├── RFIs               /settings/rfis
├── Reports            /settings/reports
├── Company Setup      /settings/company/setup

ADMIN (Admin role only)
├── Company Settings   /admin/company
├── Users              /admin/users
├── Roles & Perms      /admin/roles
├── API Keys           /admin/api-keys
├── System Health      /admin/system-health
├── Pay Periods        /admin/pay-periods
├── Companies          /admin/companies
├── AI Settings        /admin/ai-settings
├── Audit Logs         /admin/audit-logs
├── Compliance         /admin/compliance
├── Data Import        /admin/data-import
```

### Is the Sidebar Organized in the Order Users Need Things?

**No.** The current order is alphabetical/categorical, not workflow-driven. A new user following the onboarding checklist would bounce around:

1. Onboarding checklist says "Review cost codes" → Cost Codes is item 6 in main nav
2. Then "Add employees" → Employees is item 5 (above cost codes)
3. Then "Create first project" → Projects is item 2
4. Then they need Time Tracking (item 4) but need to set up crew first
5. Then Contracts (item 8) which requires projects
6. Change Orders (item 9) and Pay Apps (item 10) are last, which is correct

**The sidebar accidentally gets the end right** (contracts → change orders → pay apps) but the middle is jumbled.

### Dead Ends Where Users Get Stuck

1. **Project Management section with no project selected** — Shows "Select a project to navigate" with all 13 items grayed out and disabled. No link to project list or project creation. User has to know to go to Projects first.

2. **Documents page** (`/projects/[id]/documents`) — List view only, no upload functionality. User sees empty list with no way to add documents.

3. **Communications** and **Meetings** pages — List view, no create functionality apparent, no loading skeleton. Feel like stubs.

4. **Plans & Specs** — List view, no file viewer. Can't actually view plans.

5. **Schedule** — Table/list view, no Gantt chart. For a PM used to Primavera or MS Project, this feels empty.

6. **Settings → Notifications** — UI exists but unclear if preferences actually persist to backend.

### Pages That Exist But Aren't Useful Yet (Stubs/Placeholders)

| Page | Route | State |
|------|-------|-------|
| Verify Email | `/verify-email` | Placeholder — no backend flow |
| Register (duplicate) | `/register` | Should be deleted, redirects to `/signup` |
| Documents | `/projects/[id]/documents` | List only, no upload |
| Communications | `/projects/[id]/communications` | List only, no loading skeleton |
| Meetings | `/projects/[id]/meetings` | List only, no loading skeleton |
| Plans & Specs | `/projects/[id]/plans-specs` | List only, no file viewer |
| Schedule | `/projects/[id]/schedule` | Table only, no Gantt |
| Similar RFIs | In `/rfis/new` | Uses mocked data, not real AI |
| Submittals | `/projects/[id]/submittals` | Basic list, minimal functionality |

### Ideal Navigation Order for a New User

```
GETTING STARTED (new section, shown during first month)
├── Company Setup      /settings/company/setup
├── Cost Codes         /cost-codes
├── Employees          /employees
├── Data Import        /admin/data-import

CORE WORKFLOW
├── Dashboard          /
├── Projects           /projects
├── Time Tracking      /time-tracking
├── Approvals          /time-tracking/approval  (deserves top-level visibility)

FINANCIAL
├── Contracts          /contracts
├── Change Orders      /change-orders
├── Pay Apps           /payment-applications
├── Bids               /bids

PROJECT DETAILS (context-sensitive)
├── Daily Reports
├── RFIs
├── Job Cost
├── Schedule
├── Tasks
├── Progress
├── Submittals
├── Documents

REPORTING
├── Weekly Summary     (most used for payroll)
├── Labor Cost
├── Project Profitability
├── Financial Overview
├── Vista Export
├── Equipment Utilization

EQUIPMENT & RESOURCES
├── Equipment          /equipment

SETTINGS & ADMIN
├── (collapse into single section)
```

**Key changes:**
- **Promote Approvals** — It's buried under Time Tracking but PMs check it daily
- **Group financial workflow** — Contracts → Change Orders → Pay Apps → Bids (in execution order)
- **Move Data Import** out of Admin into a "Getting Started" section visible during onboarding
- **Reorder reports** — Weekly Summary first (payroll), Vista Export higher (migration users need it)
- **Move Equipment down** — It's a setup-once, reference-rarely entity

---

## Gap Analysis

### Phase 1: Day 1 Blockers

| # | Gap | Type | Effort | Impact |
|---|-----|------|--------|--------|
| 1 | **Admin page access control** — 6 pages unguarded (roles, API keys, AI settings, system health, pay periods) | Fix | 2h | Critical security hole |
| 2 | **Employee certifications not saved** | Fix | 30min | Data integrity — silent data loss |
| 3 | **Overtime rules → localStorage only** | Build | 4-6h | Wrong payroll calculations |
| 4 | **Industry type / employee range lost on signup** | Fix | 1h | Signup data collected but discarded |
| 5 | **Delete `/register` duplicate page** | Fix | 30min | Remove confusion |
| 6 | **Setup wizard → redirect to dashboard after** | Fix | 30min | Users finish setup and land on settings, not dashboard |

### Phase 2: Day 2-3 Blockers

| # | Gap | Type | Effort | Impact |
|---|-----|------|--------|--------|
| 7 | **Token refresh** — no JWT refresh, silent logout | Build | 8-12h | Field workers lose data mid-entry |
| 8 | **Project list pagination** | Fix | 1-2h | Companies with 50+ projects can't see all |
| 9 | **CSV export escaping** (SOV, financial overview) | Fix | 1h | Broken exports |
| 10 | **Report breadcrumbs hardcoded** to labor-cost | Fix | 30min | Wrong navigation |
| 11 | **Standard CSI cost code template** — one-click seed | Build | 3-4h | Saves hours of manual entry |

### Phase 3: Week 1 Blockers

| # | Gap | Type | Effort | Impact |
|---|-----|------|--------|--------|
| 12 | **Week start inconsistency** — pages don't read company setting | Fix | 3-4h | Payroll hours in wrong weeks |
| 13 | **Bulk approve time entries** | Build | 4-6h | 175 entries/week is unbearable one-by-one |
| 14 | **Table horizontal scroll** on 12+ pages | Fix | 2-3h | Tables cut off on laptops/tablets |
| 15 | **Search sort toggle broken** | Fix | 30min | Sort button does nothing |
| 16 | **Notification for new time entries pending approval** | Build | 4-6h | PMs don't know entries are waiting |

### Phase 4: Week 2-3 Blockers

| # | Gap | Type | Effort | Impact |
|---|-----|------|--------|--------|
| 17 | **Payment app reject endpoint** | Fix | 1h | Rejection may not work |
| 18 | **File attachments on RFIs** | Build | 6-8h | Can't attach drawings/photos |
| 19 | **Change order status validation** | Fix | 2h | Can jump statuses arbitrarily |
| 20 | **AI context awareness** | Build | 4-6h | Chat doesn't know what page you're on |
| 21 | **Real Similar RFIs** (replace mocked data) | Build | 8-12h | AI feature is fake |
| 22 | **Payment app date validation** | Fix | 30min | End can precede start |

### Phase 5: Month 1 Blockers

| # | Gap | Type | Effort | Impact |
|---|-----|------|--------|--------|
| 23 | **AIA G702/G703 payment app format** | Build | 12-16h | Industry standard, prospects expect it |
| 24 | **Vista import format** (not just export) | Build | 8-12h | Karen can't bring Vista data in |
| 25 | **Email notifications** for approvals, RFI responses | Build | 8-12h | No one knows when action is needed |
| 26 | **Approval audit trail view** | Build | 4-6h | Karen needs to prove who approved what |

### Priority Ship Order

**Sprint 1 (unblock Day 1):** Items 1-6 → ~9 hours
- Admin access control, cert bug, overtime to DB, signup data fix, delete register, setup redirect

**Sprint 2 (unblock Week 1):** Items 7, 12-15 → ~18 hours  
- Token refresh, week start consistency, bulk approve, table scroll, search sort

**Sprint 3 (unblock financial workflows):** Items 8-10, 17, 19, 22 → ~6 hours
- Pagination, CSV escaping, breadcrumbs, payment reject, change order validation, date validation

**Sprint 4 (unblock Month 1):** Items 16, 23, 25 → ~26 hours
- Notifications, AIA format, email notifications

**Sprint 5 (delight / competitive advantage):** Items 11, 18, 20, 21, 24, 26 → ~46 hours
- CSI template, file attachments, AI context, real Similar RFIs, Vista import, audit trail

---

## Route Map (Complete)

### Auth Routes (7)
| Route | File | Status |
|-------|------|--------|
| `/login` | `(auth)/login/page.tsx` | ✅ Working |
| `/signup` | `(auth)/signup/page.tsx` | ✅ Working |
| `/forgot-password` | `(auth)/forgot-password/page.tsx` | ✅ Working |
| `/reset-password` | `(auth)/reset-password/page.tsx` | ✅ Working |
| `/verify-email` | `(auth)/verify-email/page.tsx` | ⚠️ Placeholder |
| `/invite/[token]` | `(auth)/invite/[token]/page.tsx` | ✅ Working |
| `/register` | `(auth)/register/page.tsx` | ❌ Duplicate, delete |

### Dashboard Routes (82)
| Route | Status | Notes |
|-------|--------|-------|
| `/` (Dashboard) | ✅ | KPIs, welcome tour, checklist |
| `/projects` | ⚠️ | No pagination past 50 |
| `/projects/new` | ✅ | Excellent form |
| `/projects/[id]` | ✅ | Good sub-nav |
| `/projects/[id]/tasks` | ✅ | CRUD works |
| `/projects/[id]/daily-reports` | ✅ | Date-based entry |
| `/projects/[id]/rfis` | ✅ | Status workflow |
| `/projects/[id]/submittals` | ✅ | Basic list |
| `/projects/[id]/documents` | ⚠️ | No upload |
| `/projects/[id]/communications` | ⚠️ | Stub |
| `/projects/[id]/meetings` | ⚠️ | Stub |
| `/projects/[id]/narratives` | ✅ | Rich text |
| `/projects/[id]/schedule` | ⚠️ | No Gantt |
| `/projects/[id]/plans-specs` | ⚠️ | No file viewer |
| `/projects/[id]/job-cost` | ✅ | Cost tracking |
| `/projects/[id]/progress` | ✅ | % tracking |
| `/projects/[id]/projections` | ✅ | Budget vs actual |
| `/projects/[id]/print` | ✅ | Print layout |
| `/bids` | ✅ | Search, filters |
| `/bids/new` | ✅ | Form validation |
| `/bids/[id]` | ✅ | Scoring, comparison |
| `/bids/[id]/edit` | ⚠️ | Weaker validation |
| `/time-tracking` | ✅ | Date filtering |
| `/time-tracking/new` | ✅ | Single entry |
| `/time-tracking/approval` | ⚠️ | No bulk approve, table overflow |
| `/time-tracking/crew-entry` | ✅ | 3 modes, templates |
| `/time-tracking/mobile` | ⚠️ | Email-based lookup fragile |
| `/time-tracking/print` | ✅ | Hardcoded 2000 limit |
| `/employees` | ✅ | Search, filtering |
| `/employees/new` | ❌ | Certs not saved |
| `/employees/[id]` | ✅ | View works |
| `/employees/[id]/edit` | ❌ | Certs not saved |
| `/employees/import` | ⚠️ | CSV parser edge cases |
| `/employees/onboarding` | ✅ | Step-by-step |
| `/cost-codes` | ✅ | Full CRUD, pagination |
| `/equipment` | ✅ | CRUD, utilization |
| `/contracts` | ✅ | Status filtering |
| `/contracts/new` | ✅ | SubcontractEditor |
| `/contracts/[id]` | ✅ | Overview |
| `/contracts/[id]/edit` | ✅ | Same editor |
| `/contracts/[id]/sov` | ⚠️ | CSV escaping bug |
| `/contracts/[id]/change-orders` | ⚠️ | No status validation |
| `/contracts/[id]/payment-applications` | ⚠️ | No date validation |
| `/contracts/[id]/print` | ✅ | Print layout |
| `/change-orders` | ✅ | Status tracking |
| `/payment-applications` | ✅ | Status filtering |
| `/payment-applications/[id]` | ❌ | Reject endpoint wrong |
| `/project-management/tasks/my` | ✅ | Good empty state |
| `/rfis` | ✅ | Filtering, search |
| `/rfis/new` | ⚠️ | Similar RFIs mocked |
| `/rfis/[id]` | ✅ | Status workflow |
| `/search` | ⚠️ | Sort broken |
| `/reports` | ✅ | Report hub |
| `/reports/labor-cost` | ✅ | Grouping, export |
| `/reports/project-profitability` | ✅ | Margins |
| `/reports/weekly-summary` | ✅ | Employee × day |
| `/reports/financial-overview` | ⚠️ | CSV escaping |
| `/reports/equipment` | ✅ | Utilization |
| `/reports/vista-export` | ⚠️ | Bypasses api() |
| `/settings` | ✅ | Settings hub |
| `/settings/profile` | ✅ | Personal info |
| `/settings/company/setup` | ✅ | 4-step wizard |
| `/settings/notifications` | ⚠️ | Persistence unclear |
| `/settings/overtime` | ❌ | localStorage only |
| `/settings/bids` | ✅ | Defaults |
| `/settings/contracts` | ✅ | Defaults |
| `/settings/projects` | ✅ | Defaults |
| `/settings/reports` | ✅ | Defaults |
| `/settings/rfis` | ✅ | Defaults |
| `/settings/payment-applications` | ✅ | Defaults |
| `/settings/employee-onboarding` | ✅ | Template config |
| `/admin/company` | ✅ | Has admin gate |
| `/admin/users` | ✅ | Has admin gate |
| `/admin/companies` | ✅ | Has admin gate |
| `/admin/roles` | ❌ | NO admin gate |
| `/admin/roles/[id]` | ❌ | NO admin gate |
| `/admin/api-keys` | ❌ | NO admin gate |
| `/admin/ai-settings` | ❌ | NO admin gate |
| `/admin/system-health` | ❌ | NO admin gate |
| `/admin/pay-periods` | ❌ | NO admin gate |
| `/admin/audit-logs` | ✅ | Has admin gate |
| `/admin/compliance` | ✅ | Has admin gate |
| `/admin/data-import` | ✅ | Has admin gate |

---

## Summary

Pitbull can get a user from Day 1 to Month 1 **with friction**. The bones are strong — signup flow, company setup wizard, onboarding checklist, CRUD on all core entities, time entry with 3 modes, approval workflow, reports, Vista export. The architecture (CQRS, multi-tenant RLS, modular monolith) is production-grade.

**What blocks a smooth Day 1 → Month 1 path:**
1. Security holes (6 unguarded admin pages)
2. Data integrity bugs (certifications lost, overtime in localStorage)  
3. Session reliability (no token refresh)
4. Workflow gaps (no bulk approve, reject endpoint wrong, no notifications)
5. Navigation doesn't match the user's mental model

**Total effort to unblock the critical path: ~60 hours across 3 sprints.**

The first sprint (9 hours) fixes the security and data integrity issues. The second sprint (18 hours) fixes session reliability and the approval workflow. The third sprint (6 hours) patches the remaining rough edges. After those 33 hours, Karen can run her company on Pitbull for a month. The remaining 27 hours add delight features (AI improvements, Vista import, AIA format) that make Month 2 a no-brainer.
