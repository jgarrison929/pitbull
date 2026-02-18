# Pitbull Construction Solutions — Functional Review

**Date:** February 17, 2026
**Branch:** `review/functional-audit`
**Scope:** Every frontend page (86 routes), all API controllers (54), shared infrastructure
**Methodology:** Static code audit of every page component, API wrapper, auth layer, and backend endpoint

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Top 10 Issues for Demo Readiness](#top-10-issues-for-demo-readiness)
3. [Persona-Based Walkthrough](#persona-based-walkthrough)
4. [Page-by-Page Audit](#page-by-page-audit)
5. [API & Infrastructure Issues](#api--infrastructure-issues)
6. [AI Integration Gaps](#ai-integration-gaps)
7. [Recommended Quick Wins](#recommended-quick-wins)
8. [What Works Well](#what-works-well)

---

## Executive Summary

Pitbull has **strong bones**. The CQRS architecture is sound, the modular monolith is well-organized, and many core workflows (project creation, bid management, time entry) are functional end-to-end. The shadcn/ui component library gives everything a polished baseline.

**But the app is not demo-ready.** There are critical navigation failures on mobile, admin pages that any user can access, data that silently vanishes on form submission, and a token system that logs users out without warning. These aren't edge cases — they're things a prospect would hit in the first 10 minutes.

### By the Numbers

| Category | Count |
|----------|-------|
| Total frontend pages audited | 86 |
| Backend controllers audited | 54 |
| Critical issues (demo blockers) | 12 |
| High-severity issues | 18 |
| Medium-severity issues | 30+ |
| Pages with good loading states | ~60% |
| Pages with mobile-responsive tables | ~40% |
| Admin pages missing access control | 6 |

---

## Top 10 Issues for Demo Readiness

### 1. No Mobile Navigation (CRITICAL)

**Impact:** The entire app is unusable on phones and tablets below `lg` breakpoint.

The sidebar is wrapped in `hidden lg:flex` and there is no hamburger menu, bottom nav, slide-out drawer, or any alternative navigation. On any screen under 1024px, users see the page content but have absolutely no way to navigate anywhere else. They're stranded.

**Files:** `src/components/layout/sidebar.tsx`
**Fix estimate:** 4-6 hours (add Sheet/Drawer component triggered by hamburger button)

---

### 2. Six Admin Pages Have No Access Control (CRITICAL)

**Impact:** Any authenticated user can access sensitive admin functionality.

These pages check `isLoading` and `isAuthenticated` but never verify the user's role:

| Page | Path | Risk |
|------|------|------|
| Roles Management | `/admin/roles` | Users can view/modify role definitions |
| Role Detail | `/admin/roles/[id]` | Users can edit permissions |
| API Keys | `/admin/api-keys` | Users can create/revoke API keys |
| AI Settings | `/admin/ai-settings` | Users can change AI provider config |
| System Health | `/admin/system-health` | Users can see infrastructure details |
| Pay Periods | `/admin/pay-periods` | Users can lock/close pay periods |

The sidebar correctly hides the Admin section for non-admins, but direct URL access is unguarded.

**Files:** Each page's `useEffect` block
**Fix estimate:** 1-2 hours (add role check + redirect to each page)

---

### 3. Employee Certifications Are Never Saved (CRITICAL)

**Impact:** HR data entry work is silently lost.

The employee create/edit forms collect certification data (name, issuer, number, dates) in the UI, but the `handleSubmit` function builds the API payload without including the `certifications` array. Users fill out certifications, hit Save, see a success toast, and the data is gone.

**Files:** `src/app/(dashboard)/employees/new/page.tsx`, `src/app/(dashboard)/employees/[id]/edit/page.tsx`
**Fix estimate:** 30 minutes (include certifications in the POST/PUT body)

---

### 4. No JWT Token Refresh (CRITICAL)

**Impact:** Users are silently logged out mid-work with no recovery.

The `api()` wrapper catches 401 responses and immediately calls `logout()`, which clears all state and redirects to `/login`. There is no refresh token flow, no "session expired" warning, and no way to re-authenticate without losing unsaved work. Construction foremen filling out 30-minute crew time entries will lose everything.

**Files:** `src/lib/api.ts`, `src/lib/auth.ts`, `src/contexts/AuthContext.tsx`
**Fix estimate:** 8-12 hours (implement refresh token endpoint + client-side refresh logic)

---

### 5. Duplicate Registration Pages (HIGH)

**Impact:** User confusion, maintenance burden, and one page has broken features.

Both `/signup` and `/register` exist as separate implementations:

- `/signup` — Cleaner, modern design, functional
- `/register` — Older implementation with a broken "Add team members" feature (hardcoded `TODO` at line 177), confusing post-registration flow

A prospect clicking different links could land on either page with different experiences.

**Files:** `src/app/(auth)/signup/page.tsx`, `src/app/(auth)/register/page.tsx`
**Fix estimate:** 1 hour (delete `/register`, redirect to `/signup`)

---

### 6. Overtime Rules Only Saved to localStorage (HIGH)

**Impact:** Company overtime configuration is per-browser, not per-tenant.

The overtime settings page (`/settings/overtime`) saves California overtime rules, custom overtime thresholds, and rule configurations to `localStorage` only. There's no API call. Different computers in the same company will have different overtime rules. Clearing browser data wipes the configuration.

**Files:** `src/app/(dashboard)/settings/overtime/page.tsx`
**Fix estimate:** 4-6 hours (create API endpoint + persist to database)

---

### 7. Time Tracking Week Inconsistency (HIGH)

**Impact:** Hours could be assigned to wrong weeks, causing payroll errors.

Different time tracking pages use different week boundaries:

- `TimeEntryApproval` page: `getDay() === 0` (Sunday start)
- `CrewTimeEntry` page: `getDay() === 1` (Monday start)
- Backend `ReportService.cs`: `StartOfWeekMonday()` helper (Monday start)
- Company settings allow configuring work week start day, but pages don't read this setting

**Files:** Multiple time tracking pages, `ReportService.cs`
**Fix estimate:** 3-4 hours (read company work-week setting, apply consistently)

---

### 8. Tables Not Scrollable on Small Screens (HIGH)

**Impact:** Data is cut off and unreadable on tablets and small laptops.

At least 12 pages render wide `<Table>` components without `overflow-x-auto` wrappers:

- Time entry approval (8 columns including day-of-week)
- All admin pages (users, companies, roles, audit logs, API keys, pay periods)
- Employee list
- Equipment list
- Cost codes

**Files:** Multiple pages
**Fix estimate:** 2-3 hours (add `overflow-x-auto` wrapper to each table)

---

### 9. Search Sort Toggle Is Broken (HIGH)

**Impact:** The sort button in global search (Cmd+K) does nothing.

The `sortMode` state cycles between values when clicked, but the `filteredResults` useMemo never reads `sortMode`. Results always display in the original API order regardless of which sort option is selected.

**Files:** `src/app/(dashboard)/search/page.tsx`
**Fix estimate:** 30 minutes (add sort logic to the filteredResults memo)

---

### 10. Payment App Rejection Uses Wrong Endpoint (HIGH)

**Impact:** Rejecting a payment application may not work correctly.

The payment application detail page's reject action sends a generic `PUT` to the entity endpoint instead of calling a dedicated `/reject` action endpoint. This means rejection logic (status validation, notifications, audit trail) may not execute.

**Files:** `src/app/(dashboard)/project-management/payment-apps/[id]/page.tsx`
**Fix estimate:** 1 hour (add dedicated reject endpoint, update frontend)

---

## Persona-Based Walkthrough

### Sarah Chen — Company Admin

**First impression:** Logs in successfully. Dashboard loads with KPIs, recent activity, quick actions. Looks professional.

**What works:**
- Login flow is smooth with password visibility toggle
- Dashboard shows meaningful metrics with auto-refresh
- Company settings page is excellent (6 sections, work week config, CA overtime rules)
- User management has invite flow and role assignment
- Audit logs show system activity

**What breaks:**
- Navigates to Admin section — all pages load. Goes to AI Settings to configure API keys — works. But if she shares the `/admin/ai-settings` URL with PM Mike "to check something," Mike can access it too because there's no role gate.
- Tries to access the app on her iPad at a job site — sidebar vanishes, she's stuck on whatever page she was viewing
- Goes to Settings → Overtime to configure company rules — saves them — next day on her office desktop, the rules are gone (localStorage only)
- Creates an employee, fills out certifications section — saves — goes back to edit — certifications are empty

**What's missing:**
- No bulk user management (import, mass role assignment)
- No tenant/company usage metrics
- No system backup/restore controls
- Email verification is a placeholder (page exists but no backend flow)

---

### Demo Contact — Project Manager

**First impression:** Dashboard gives him project overview. Navigation to projects is intuitive.

**What works:**
- Project creation form is excellent: auto-save, validation, multi-step
- Project detail page has comprehensive sub-navigation (tasks, daily reports, RFIs, schedule, documents, etc.)
- Bid management with scoring and comparison tools
- Can create subcontracts with SOV line items
- Change order workflow exists
- AI chat panel available for questions

**What breaks:**
- Opens project list — sees 50 projects but no "next page" button. His company has 200 active projects.
- Opens time entry approval — table has 8 columns and on his 13" laptop some columns are cut off with no horizontal scroll
- Tries to reject a payment application — clicks reject — unclear if it actually processed correctly (wrong endpoint)
- Uses global search to find a project — tries to sort results by date — sort button clicks but nothing changes
- Navigates between project sub-pages — some have skeleton loaders (tasks, daily reports, RFIs, submittals) and some just show blank white space while loading (documents, communications, meetings, schedule)

**What's missing:**
- No project-level dashboard with KPI summary
- No email notifications for RFI responses, change order approvals, etc.
- No Gantt chart for schedule (currently a list/table view)
- No way to bulk-approve time entries
- Cannot attach files to RFIs or daily reports (file upload not implemented)
- No activity feed showing recent changes across a project

---

### Demo Contact V01 — Superintendent

**First impression:** Needs to do time entry for his crew at the end of each day, usually from his phone at the job site.

**What works:**
- Crew time entry has three modes (daily, weekly detailed, weekly simple) — smart
- Templates for common crew configurations save time
- Mobile time entry page exists with phone-optimized layout
- Equipment tracking integrated into time entries

**What breaks:**
- Opens the app on his phone → **cannot navigate anywhere**. The sidebar is hidden and there's no mobile menu.
- If he bookmarks the crew entry page directly, he can use it, but:
  - The week shown might start on Sunday (approval page) or Monday (crew entry) depending on which page he's on — payroll confusion
  - Mobile time entry looks up employees by email — his crew members don't always know their company email addresses
  - If his session expires mid-entry (no token refresh), he loses everything with no warning

**What's missing:**
- No offline mode for job sites with poor connectivity
- No daily report quick-entry from mobile
- No photo attachment for daily reports
- No crew favorites or recent selections
- No push notifications for approval requests

---

### Lisa Park — Estimator

**First impression:** Goes straight to Bids section.

**What works:**
- Bid list with status filtering and search
- New bid form with project linkage
- Bid item line items with quantities and pricing
- Bid scoring/comparison tool for evaluating sub bids
- Can convert winning bid to project (with validation)

**What breaks:**
- Bid edit page has weaker validation than the creation page — required fields aren't enforced
- CSV export from SOV page has escaping issues (commas in descriptions break columns)
- Report breadcrumbs all point to `/reports/labor-cost` regardless of which report she's viewing

**What's missing:**
- No bid templates or copy-from-previous
- No integration with plan rooms or bid boards
- No automated bid deadline reminders
- No cost history for estimating reference
- No markup/margin calculator

---

### Jake Wilson — New Employee

**First impression:** Gets an invite email link, clicks it.

**What works:**
- Invite token acceptance flow is complete and secure (validates token, shows company name, allows password creation)
- Login after account creation works
- Dashboard loads with relevant quick actions

**What breaks:**
- After login, Jake doesn't know where to go. There's no onboarding wizard or "getting started" guide.
- Clicks on "My Tasks" — sees an empty state that says tasks will appear as assigned. Good empty state message, but no guidance on what to do next.
- Tries to view his profile — Settings → Profile works and shows his info
- Looks for his time entries — has to navigate through the sidebar to Time Tracking, but the sidebar has many sections and no contextual help

**What's missing:**
- No onboarding checklist or wizard
- No contextual help or tooltips
- No "getting started" documentation accessible from the app
- No guided tour of key features
- Cannot view his own certifications (they weren't saved — see Issue #3)

---

## Page-by-Page Audit

### Authentication Pages

| Page | Status | Notes |
|------|--------|-------|
| `/login` | Working | Good error handling, password toggle, responsive layout |
| `/signup` | Working | Clean form, company creation flow |
| `/register` | Broken | Duplicate of signup, "Add team members" feature is a TODO stub |
| `/forgot-password` | Working | Proper email enumeration prevention (always shows success) |
| `/reset-password` | Working | Token validation, password confirmation |
| `/verify-email` | Placeholder | Page exists but no backend verification flow implemented |
| `/invite/[token]` | Working | Token validation, password creation, company display |

### Dashboard & Navigation

| Page | Status | Notes |
|------|--------|-------|
| Dashboard | Working | KPI cards, skeleton loaders, auto-refresh, quick actions |
| Sidebar | Partial | Works on desktop, completely missing on mobile, active link detection broken for settings paths, project ID regex too narrow (UUID only) |
| Search | Broken | Sort toggle non-functional, errors silently swallowed, no debounce on search input |

### Project Management

| Page | Status | Notes |
|------|--------|-------|
| Projects list | Partial | Loads 50 projects, no pagination controls, no "load more" |
| New project | Working | Excellent form validation, auto-save, multi-step |
| Project detail | Working | Good sub-navigation, overview tab with metrics |
| Tasks | Working | Skeleton loader, CRUD operations, status badges |
| Daily reports | Working | Date-based entry, weather fields, crew log |
| RFIs | Working | List + create + detail views, status workflow |
| Submittals | Working | Basic list, skeleton loader |
| Documents | Partial | List view only, no upload functionality |
| Communications | Partial | List view, no loading skeleton |
| Meetings | Partial | List view, no loading skeleton |
| Narratives | Working | Rich text entry |
| Schedule | Partial | Table/list view, no Gantt, no loading skeleton |
| Plans & Specs | Partial | List view, no file viewer |
| Job Cost | Working | Cost tracking by code |
| Progress | Working | Percentage tracking |
| Projections | Working | Budget vs actual |
| Print | Working | Print-optimized layout |

### Bids

| Page | Status | Notes |
|------|--------|-------|
| Bid list | Working | Search, filters, status badges |
| New bid | Working | Form validation, project linkage |
| Bid detail | Working | Line items, scoring, comparison |
| Bid edit | Partial | Weaker validation than create form |

### Contracts & Subcontracts

| Page | Status | Notes |
|------|--------|-------|
| Contract list | Working | Status filtering |
| New contract | Partial | Delegates to SubcontractEditor component |
| Contract detail | Working | Overview, linked documents |
| Contract edit | Partial | Same delegation pattern |
| SOV | Partial | Inline editing works, CSV export has escaping bugs |
| Change orders | Partial | No status transition validation |
| Payment apps | Partial | Period date validation missing (end >= start) |
| Print | Working | Print-optimized layout |

### Time Tracking

| Page | Status | Notes |
|------|--------|-------|
| Main list | Working | Date filtering, employee grouping |
| New entry | Working | Form validation, equipment/phase selection |
| Approval | Partial | Week start inconsistency (Sunday vs Monday), table not scrollable, no bulk approve |
| Crew entry | Working | Three modes, templates, but Monday-based weeks |
| Mobile | Partial | Good layout but email-based employee lookup is fragile, no offline |
| Print | Working | Hardcoded 2000 entry limit |

### Employees & Equipment

| Page | Status | Notes |
|------|--------|-------|
| Employee list | Working | Search, role filtering |
| New employee | Broken | Certifications and emergency contacts not saved |
| Employee detail | Working | View mode correct |
| Employee edit | Broken | Same certification/emergency contact data loss |
| Employee import | Partial | CSV parser breaks on quoted fields with commas |
| Employee onboarding | Working | Step-by-step flow |
| Equipment | Working | CRUD, utilization tracking |
| Cost codes | Partial | No sorting, no pagination, no search |

### Reports

| Page | Status | Notes |
|------|--------|-------|
| Labor cost | Working | Group by employee/cost code/phase, export |
| Profitability | Working | Project-level profit margins |
| Equipment utilization | Working | Usage percentages, cost tracking |
| Weekly summary | Working | Employee × day grid |
| Financial overview | Partial | CSV export has escaping issues |
| Vista export | Partial | Bypasses `api()` wrapper, uses undocumented Accept header pattern |

**Cross-cutting report issue:** Breadcrumb links on all report pages hardcode href to `/reports/labor-cost` instead of the current report.

### Admin Pages

| Page | Access Control | Loading | Responsive |
|------|---------------|---------|------------|
| Users | Has admin gate | Has skeleton | Table not scrollable |
| Companies | Has admin gate | Has skeleton | Table not scrollable |
| Company settings | Has admin gate | Has skeleton | Responsive |
| Roles | **NO admin gate** | No skeleton | Table not scrollable |
| Role detail | **NO admin gate** | Has skeleton | OK |
| Audit logs | Has admin gate | Has skeleton | Table not scrollable |
| API Keys | **NO admin gate** | No skeleton | Table not scrollable |
| AI Settings | **NO admin gate** | Has skeleton | OK |
| System Health | **NO admin gate** | No skeleton | OK |
| Compliance | Has admin gate | No skeleton | OK |
| Data Import | Has admin gate | No skeleton | OK |
| Pay Periods | **NO admin gate** | Has skeleton | Table not scrollable |

### Settings Pages

| Page | Status | Notes |
|------|--------|-------|
| Hub | Working | Grid of setting categories |
| Profile | Working | View/edit personal info |
| Company setup | Working | Company details, work week |
| Notifications | Partial | UI exists, unclear if preferences persist |
| Bid settings | Working | Default configurations |
| Contract settings | Working | Default configurations |
| Project settings | Working | Default configurations |
| Report settings | Working | Default configurations |
| RFI settings | Working | Default configurations |
| Overtime | Broken | Saves to localStorage only, not backend |
| Payment app settings | Working | Default configurations |
| Employee onboarding | Working | Template configuration |

### Other Pages

| Page | Status | Notes |
|------|--------|-------|
| My Tasks | Working | Good empty state, status filtering, mobile card layout |
| RFI list | Working | Filtering, search |
| RFI new | Partial | "Similar RFIs" feature uses mocked data, file upload not implemented |
| RFI detail | Working | Status workflow, response tracking |
| Payment app list | Working | Status filtering |
| Payment app detail | Broken | Reject action uses wrong endpoint |
| Change orders | Working | Status tracking |

---

## API & Infrastructure Issues

### Authentication & Security

| Issue | Severity | Detail |
|-------|----------|--------|
| No token refresh | Critical | 401 → immediate logout, unsaved data lost |
| No JWT signature validation client-side | Medium | `auth.ts` decodes JWT payload but doesn't validate signature. This is fine since the server validates, but stale/tampered tokens may show wrong UI state until next API call |
| Auth cookie lacks HttpOnly flag | Medium | JWT stored in a cookie that JavaScript can read — XSS could steal tokens |
| `isLoading` dead code in AuthContext | Low | `isLoading` state is declared but never set to `true` — components checking it will always skip loading states |
| Login/register errors not propagated | Medium | `AuthContext` catches errors and logs to console but `login()`/`register()` return void — callers can't distinguish success from failure through return values (they work around this with try/catch on the api() call) |

### API Wrapper (`api.ts`)

| Issue | Severity | Detail |
|-------|----------|--------|
| No request timeout | Medium | Long-running requests hang indefinitely. No `AbortController` or timeout. |
| No retry logic | Low | Transient network errors fail immediately |
| 401 handling is destructive | Critical | See Top 10 #4 |
| PostHog error tracking works | Good | API errors are tracked with context |

### Company Context

| Issue | Severity | Detail |
|-------|----------|--------|
| Silent failures on company switch | Medium | If the companies API fails, the error is caught and swallowed — user sees no companies |
| Race condition potential | Low | Multiple rapid company switches could interleave API calls |
| No company data caching | Low | Company list re-fetched on every mount |

### Sidebar Navigation

| Issue | Severity | Detail |
|-------|----------|--------|
| Active link detection broken for settings | Medium | Settings sub-pages don't highlight correctly because the pathname matching doesn't account for the settings path hierarchy |
| Project ID regex too narrow | Low | Only matches standard UUID format — some pages use slugs or shortcodes that won't match |

---

## AI Integration Gaps

### Current State

The AI integration has three components:
1. **AI Chat Panel** — Floating chat interface for asking questions
2. **AI Suggest** — Endpoint exists but unclear frontend integration
3. **AI Document** — Document understanding endpoint

### Issues

| Gap | Detail |
|-----|--------|
| Error messages are generic | AI chat errors show "Failed to get response" — the actual error reason from the provider is lost |
| No conversation length management | Chat can grow indefinitely, eventually hitting token limits with no graceful handling |
| No streaming | Responses arrive all at once — for long analyses, users stare at a spinner with no progress indication |
| No context awareness | The chat doesn't know what page/project/bid the user is currently viewing — users must manually describe their context |
| Mocked "Similar RFIs" | The RFI creation page has an AI-powered "Similar RFIs" section that uses hardcoded mock data instead of real AI lookups |
| No AI in reports | Reports could benefit from AI-generated summaries or anomaly detection, but there's no integration |
| No AI in bid analysis | Bid comparison/scoring could use AI to flag unusual pricing, but it's purely manual |
| Provider fallback works well | The `AiService` gracefully tries preferred provider, then falls back — good pattern |
| API key management is solid | Encrypted storage with fingerprinting, expiration, revocation — well-implemented |

### Recommendations

1. **Quick win:** Pass current page context (project ID, entity type) to AI chat so it can give contextual answers
2. **Quick win:** Show actual AI error messages instead of generic failures
3. **Medium effort:** Add streaming for chat responses
4. **Medium effort:** Implement the Similar RFIs feature with real embeddings
5. **Larger effort:** Add AI summaries to report pages

---

## Recommended Quick Wins

Each item is estimated at **under 2 hours** of development time.

| # | Fix | Time | Impact |
|---|-----|------|--------|
| 1 | Add admin role check to 6 unguarded admin pages | 1-2h | Closes security hole |
| 2 | Add `overflow-x-auto` to all table containers | 1-2h | Tables readable on smaller screens |
| 3 | Include certifications array in employee form submit | 30min | Stops silent data loss |
| 4 | Delete `/register` page, redirect to `/signup` | 30min | Removes confusion |
| 5 | Fix search sort toggle (wire `sortMode` into `filteredResults` memo) | 30min | Sort actually works |
| 6 | Fix report breadcrumb hrefs (use current report path) | 30min | Correct navigation |
| 7 | Add loading skeletons to 5 admin pages that lack them | 1-2h | Consistent loading UX |
| 8 | Fix payment app reject to use dedicated endpoint | 1h | Rejection workflow works |
| 9 | Add date range validation to report filters (from <= to) | 30min | Prevents confusing empty results |
| 10 | Fix CSV export escaping in SOV and financial overview | 1h | Clean exports |
| 11 | Add `overflow-x-auto` + mobile card layout to time entry approval | 1-2h | Usable on tablets |
| 12 | Remove dead `isLoading` code from AuthContext or wire it up properly | 30min | Prevents future bugs |
| 13 | Show actual AI error messages in chat panel | 30min | Better debugging |
| 14 | Add pagination controls to project list | 1-2h | Works for companies with 50+ projects |
| 15 | Fix sidebar active link detection for settings pages | 1h | Correct highlighting |

**Total quick win effort: ~12-16 hours for all 15 items**

---

## What Works Well

Credit where it's due — significant parts of Pitbull are well-built:

### Architecture
- **CQRS with MediatR** is clean and consistent across all modules
- **Result<T> pattern** prevents exception-based flow control — error handling is explicit
- **Modular monolith** structure keeps domains separated without microservice overhead
- **Multi-tenancy with RLS** is defense-in-depth — app layer AND database layer

### Frontend Patterns
- **shadcn/ui** provides a polished, consistent component library
- **Skeleton loaders** are used on ~60% of pages — good loading UX
- **Mobile card layouts** exist alongside desktop tables on many pages (My Tasks, Bids, Projects)
- **Empty states** are thoughtful and contextual on most pages
- **Form validation** with real-time feedback on project creation and bid creation

### Specific Features
- **Bid scoring and comparison** — genuinely useful for evaluating sub bids
- **Crew time entry with 3 modes** — adapts to different superintendent workflows
- **Company settings** — comprehensive with work week config, overtime rules UI, 6 organized sections
- **Invite flow** — secure token-based account creation works end-to-end
- **AI API key management** — encrypted, fingerprinted, with expiration and revocation
- **PostHog error tracking** — API errors are tracked with context for debugging
- **Dashboard** — meaningful KPIs with auto-refresh and quick actions

### Code Quality
- **Consistent file structure** — vertical slices with command/handler/validator pattern
- **FluentValidation** on most write operations
- **CancellationToken** passed everywhere
- **AsNoTracking()** on all query paths
- **TypeScript strict mode** on the frontend

---

## Summary

Pitbull is a **70% complete product** with solid architecture and a few critical gaps that undermine the experience. The good news is that the top 15 issues can be fixed in roughly 2 sprint days. The mobile navigation gap is the single biggest blocker — it makes the app literally unusable for the superintendent and field worker personas who are a core audience for construction software.

**Priority order for fixes:**
1. Mobile navigation (biggest user impact)
2. Admin page access control (security)
3. Employee certification data loss (data integrity)
4. Token refresh (session reliability)
5. Everything else in the quick wins list

After these fixes, Pitbull would be ready for a controlled demo with prospects. Before these fixes, a prospect on a tablet would be stuck on the first page they land on.
