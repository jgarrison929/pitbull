# Navigation Redesign — Pitbull Construction Solutions (HISTORICAL)

> **Status:** Implemented in 0.14.0 (see CHANGELOG)
> **Date:** 2026-02-20 (implemented Feb 2026)
> **Note:** Historical. "Workspace navigation — 7 focused workspaces replace 78-item flat sidebar" delivered. Current frontend uses workspace switcher + command palette. This doc explains the motivation and design decisions leading to the shipped UX. Useful reference for why the change.

**Implemented as of June 2026 (verified):**
- 7 workspaces defined: "my-work", "projects", "finance", "operations", "people", "reports", "admin" in src/Pitbull.Web/pitbull-web/src/components/layout/workspaces.ts
- useWorkspaceNav hook, workspace switcher.
- Command palette (⌘K) for global nav (mentioned in unreleased CHANGELOG).
- RoleDefaults + mobileTabs per role.
- Project-scoped sidebar items via getProjectWorkspaceItems (RFIs, Punch List etc).
- Breadcrumbs, favorites/recents in use-workspace-nav.ts.
- Sidebar reorg in 0.14 per changelog: "Workspace navigation — 7 focused workspaces replace 78-item flat sidebar".
- Mobile: bottom tabs responsive.
- Matches doc principles (7±2 items, role-first, always visible desktop sidebar).
Fully delivered. (Check current nav-items.ts, app-sidebar.tsx, command palette impl for any evolution.)

---

## 1. Executive Summary

### The Problem

Our current sidebar is a 78-item vertical scroll across 11 sections. Every role sees the same structure, filtered only by permissions. A Project Manager scrolls past payroll and HR to find RFIs. A Controller scrolls past project management to find journal entries. A Foreman on a phone gets a hamburger menu that mirrors the desktop disaster. The founder's verdict: "That long scrolling navigation is terrible."

### The Solution: Workspace Navigation

Replace the flat sidebar with a **Workspace Navigation** system inspired by Linear, Notion, and Stripe — adapted for the construction ERP context. The core concept:

1. **Workspace Switcher** — Top of sidebar, one click to switch context (My Work, Projects, Finance, Operations, People, Reports, Admin)
2. **Focused Sidebar** — Each workspace shows only its 5-12 items. Never more than one screen of navigation.
3. **My Work (Default)** — Role-based landing with favorites, recent items, and quick actions. A PM's "My Work" looks different from a Controller's.
4. **Enhanced Command Palette (⌘K)** — Power users skip the sidebar entirely. Fuzzy search every page, entity, and action.
5. **Contextual Navigation** — Inside a project, the sidebar auto-shifts to show project-scoped tools (RFIs, submittals, schedule).
6. **Mobile Workspace Tabs** — Bottom tab bar adapts per role. Foreman gets Time + Daily Reports. Controller gets GL + WIP.

This reduces visible nav items from **78 → 5-12 at any time**, while keeping all 131 pages accessible within 2 clicks or one ⌘K search.

### Design Principles

| # | Principle | What It Means |
|---|-----------|---------------|
| 1 | **Role-first, module-second** | Navigation organizes around what you DO, not where things live in the codebase |
| 2 | **7±2 items visible** | No workspace shows more than 12 items. Miller's Law applied to sidebar. |
| 3 | **Always visible, never overwhelming** | Sidebar stays visible (not hamburger), but shows only your current workspace |
| 4 | **Two-click maximum** | Any page in the system reachable in ≤2 clicks (workspace switch + page click) or ⌘K |
| 5 | **Context follows you** | Enter a project → sidebar shows project tools. Leave → sidebar restores workspace. |
| 6 | **Power users rewarded** | ⌘K, keyboard shortcuts, favorites, and recent items for speed demons |
| 7 | **Mobile is a first-class citizen** | Field roles (Foreman) get a purpose-built mobile experience, not a shrunk desktop |
| 8 | **AI is navigation** | The AI chat and command palette converge — "show me overdue RFIs" is both a query and navigation |

---

## 2. Competitive Analysis Findings

### What Sucks About Enterprise ERP Navigation

| Platform | Primary Pattern | Fatal Flaw | Lesson for Pitbull |
|----------|----------------|------------|-------------------|
| **Salesforce** | Top tabs + App Launcher grid | Click inflation — Lightning added clicks to everything. Cross-cloud inconsistency. 50-tab cap overflows. | One consistent nav model everywhere. Never add clicks to existing flows. |
| **SAP Fiori** | Tile launchpad + micro-apps | Tile overload ("too many tiles, I don't want to scroll!"). Fragmented micro-apps break workflows. Desktop space wasted. | Don't fragment workflows. Don't show everything at once. Respect desktop space. |
| **Odoo** | App grid + per-app top menu | Module switching loses context. Flat app grid with no hierarchy. Cross-module workflows break. | Maintain state across navigation. Group logically, not alphabetically. |
| **Oracle Fusion** | Hamburger menu + springboard | Hidden nav cuts discoverability in half (NN/g research). Deep nesting = 3-4 clicks to start. "Clunky and disconnected." | Always-visible sidebar. Maximum 2 levels of nesting. |
| **Procore** | Left sidebar "Toolbox" | Modules don't work well together. Occasional users lose their mental map. Overwhelming for small teams. | Cross-module workflows must feel unified. Support infrequent users with "My Work" landing. |

### The 7 Anti-Patterns We Will Avoid

1. **Flat Overload** — Never show all 78 items at once
2. **Hidden Navigation (Hamburger)** — Sidebar always visible on desktop
3. **Inconsistent Patterns** — One nav model across all modules
4. **Fragmented Micro-Apps** — Workflows stay unified across modules
5. **Context Loss** — Switching workspaces preserves your place
6. **Click Inflation** — Every redesign action must be equal or fewer clicks
7. **Desktop-Hostile Mobile-First** — Desktop gets full sidebar, mobile gets purpose-built experience

### What Modern Apps Get Right

| App | Pattern | What We Steal |
|-----|---------|---------------|
| **Linear** | Workspace sidebar + ⌘K command palette + keyboard-first | Workspace concept, command palette as primary nav for power users |
| **Notion** | Page tree + favorites + recents + breadcrumbs | Favorites pinning, recent items, breadcrumb-driven context |
| **Stripe** | Clean sectioned sidebar + contextual sub-nav | Section-based sidebar that changes based on context |
| **Vercel** | Project-scoped views + team switching | Project context switching (we already have ProjectSwitcher) |
| **Mercury** | Clean sidebar for complex financial data + progressive disclosure | Finance-specific progressive disclosure patterns |
| **Ramp** | Role-aware defaults + quick actions | Role-based default workspace + floating quick actions |
| **Superhuman/Raycast** | Command palette as THE navigation | ⌘K elevated to first-class navigation, not just search |

---

## 3. The Workspace Model

### Workspace Definitions

The 78 nav items reorganize into **7 workspaces**. Each workspace owns a coherent set of pages that a single persona primarily uses.

#### Workspace: My Work (Default Landing)

**Purpose:** Personalized home base. Role-adaptive. This is what you see first.

| Component | Description |
|-----------|-------------|
| **Favorites** | User-pinned pages (draggable ordering). Max ~10 visible, overflow scrolls. |
| **Recent** | Last 8 visited pages (auto-populated, system-managed) |
| **Quick Actions** | Role-specific action buttons: PM gets "New RFI", "Approve Timecards", "Create Pay App". Controller gets "New Journal Entry", "Close Period". |
| **Alerts** | Badge counts: overdue RFIs, pending approvals, unapproved timecards, billing deadlines |

Items shown: **5-10** (depends on favorites count)

#### Workspace: Projects

**Purpose:** Everything project-centric. PM's primary home.

| Item | Page |
|------|------|
| All Projects | `/projects` |
| Bids | `/bids` |
| *Separator: Active Project* | |
| Overview | `/projects/[id]` |
| Job Cost | `/projects/[id]/job-cost` |
| Daily Reports | `/projects/[id]/daily-reports` |
| Tasks | `/projects/[id]/tasks` |
| RFIs | `/projects/[id]/rfis` |
| Submittals | `/projects/[id]/submittals` |
| Schedule | `/projects/[id]/schedule` |
| Change Orders | `/projects/[id]/change-orders` (or `/change-orders` filtered) |
| Documents | `/projects/[id]/documents` |
| Punch List | `/projects/[id]/punch-list` |
| Progress | `/projects/[id]/progress` |
| Communications | `/projects/[id]/communications` |
| Meetings | `/projects/[id]/meetings` |

Items shown: **2** (no project selected) → **15** (project selected, with contextual section)

The **Project Switcher** lives inside this workspace at the top. When a project is selected, the sidebar dynamically shows project-scoped tools below a separator. When no project is selected, only "All Projects" and "Bids" appear, with a prompt to select a project.

#### Workspace: Finance

**Purpose:** All accounting and financial management. Controller's primary home.

| Item | Page |
|------|------|
| Journal Entries | `/accounting/journal-entries` |
| Chart of Accounts | `/chart-of-accounts` |
| Accounting Periods | `/accounting/periods` |
| WIP Schedule | `/accounting/wip` |
| Bank Reconciliation | `/accounting/bank-reconciliation` |
| Retention | `/accounting/retention` |
| Lien Waivers | `/accounting/lien-waivers` |
| *Separator: Billing* | |
| Owner Contracts | `/billing/contracts` |
| Billing Applications | `/billing/applications` |
| Pay Apps | `/payment-applications` |
| AR Aging | `/billing/aging` |

Items shown: **11**

This merges the current "Financial" and "Billing" groups — the domain expert identified that Controllers work across both, and the split is confusing.

#### Workspace: Operations

**Purpose:** Procurement, vendors, customers, contracts. AP Clerk + AR Clerk territory.

| Item | Page |
|------|------|
| Purchase Orders | `/procurement/purchase-orders` |
| Vendor Invoices | `/procurement/invoices` |
| Vendors | `/vendors` |
| Customers | `/customers` |
| Contracts | `/contracts` |
| Change Orders | `/change-orders` |

Items shown: **6**

#### Workspace: People

**Purpose:** HR, payroll, time tracking. Payroll Manager + HR Director territory.

| Item | Page |
|------|------|
| Employees | `/employees` |
| Time Tracking | `/time-tracking` |
| Approvals | `/time-tracking/approval` |
| *Separator: Payroll* | |
| Payroll Runs | `/payroll/runs` |
| Certified Payroll | `/payroll/certified` |
| Payroll Reviews | `/payroll/reviews` |
| Wage Determinations | `/payroll/wage-determinations` |
| Payroll Exports | `/payroll/exports` |
| *Separator: Resources* | |
| Cost Codes | `/cost-codes` |
| Equipment | `/equipment` |

Items shown: **10**

#### Workspace: Reports

**Purpose:** All reporting. Cross-role, read-only views.

| Item | Page |
|------|------|
| Weekly Summary | `/reports/weekly-summary` |
| Labor Cost | `/reports/labor-cost` |
| Project Profitability | `/reports/project-profitability` |
| Financial Overview | `/reports/financial-overview` |
| Equipment Utilization | `/reports/equipment` |
| Vista Export | `/reports/vista-export` |
| Time Audit | `/time-tracking/audit` |

Items shown: **7**

#### Workspace: Admin

**Purpose:** System configuration. System Admin only (permission-gated).

| Item | Page |
|------|------|
| Company Settings | `/admin/company` |
| Companies | `/admin/companies` |
| Users | `/admin/users` |
| Roles & Permissions | `/admin/roles` |
| Data Import | `/admin/data-import` |
| Integrations | `/admin/integrations` |
| Pay Periods | `/admin/pay-periods` |
| Compliance | `/admin/compliance` |
| AI Settings | `/admin/ai-settings` |
| API Keys | `/admin/api-keys` |
| System Health | `/admin/system-health` |
| Audit Logs | `/admin/audit-logs` |
| Secrets | `/admin/secrets` |
| Feedback Inbox | `/admin/feedback` |

Items shown: **14** (but only visible to admins)

### Settings — Removed from Main Nav

Settings pages (`/settings/*`) are accessed via:
1. User avatar dropdown → "Settings" (personal preferences, notifications)
2. Admin workspace → module-specific settings (overtime rules, project defaults, etc.)
3. ⌘K search → "Settings: Overtime", "Settings: Notifications", etc.

This removes 10 items from the main nav that 95% of users access once during setup.

---

## 4. Detailed Wireframe Descriptions

### 4.1 Desktop Layout (≥1024px)

```
┌──────────────────────────────────────────────────────────────────────┐
│ [Pitbull Logo] │ Breadcrumbs: Dashboard > Projects > Maple Tower    │
│                │ [Search ⌘K]  [🔔 3]  [Company▾]  [Theme]  [Avatar]│
├────────┬───────┴─────────────────────────────────────────────────────┤
│ SIDE-  │                                                             │
│ BAR    │   Main Content Area                                         │
│ 256px  │                                                             │
│        │                                                             │
│ ┌────┐ │                                                             │
│ │Work│ │                                                             │
│ │spce│ │                                                             │
│ │Swch│ │                                                             │
│ └────┘ │                                                             │
│        │                                                             │
│ Items  │                                                             │
│ for    │                                                             │
│ active │                                                             │
│ work-  │                                                             │
│ space  │                                                             │
│        │                                                             │
│ ────── │                                                             │
│ AI ◆   │                                                             │
│ ────── │                                                             │
│ User   │                                                             │
├────────┴─────────────────────────────────────────────────────────────┤
│ (no footer — clean bottom edge)                                      │
└──────────────────────────────────────────────────────────────────────┘
```

#### Sidebar Anatomy (Top → Bottom)

1. **Logo + Brand** (fixed, 56px height)
   - Pitbull "P" icon + "Pitbull" text + "Construction Solutions" subtitle
   - Clicking logo → Dashboard

2. **Company Switcher** (fixed, 44px height)
   - Dropdown showing current company name
   - Multi-company users can switch here

3. **Workspace Switcher** (fixed, 48px height)
   - Dropdown button showing current workspace name + icon
   - Options: My Work, Projects, Finance, Operations, People, Reports, Admin
   - Each option shows icon + label + item count badge
   - Keyboard: `1-7` keys switch workspaces when sidebar focused

4. **Workspace Items** (scrollable region)
   - Navigation items for the active workspace
   - Section separators within workspaces (thin line + label)
   - Project Switcher appears here when in Projects workspace
   - Active item: amber-400 accent (current brand color)
   - Hover: subtle background highlight

5. **AI Chat Trigger** (fixed, 44px height)
   - "Ask AI" button with sparkle icon
   - Opens the AI chat panel overlay

6. **User Section** (fixed, 64px height)
   - Avatar + Name + Email
   - Click → dropdown: Settings, Help, Shortcuts (?), Logout

#### Workspace Switcher — Interaction Detail

The workspace switcher is a **dropdown menu** at the top of the sidebar (below company switcher). It works like Notion's page/workspace selector:

- **Closed state:** Shows icon + "My Work" (or current workspace name) + chevron
- **Open state:** Dropdown overlay with all 7 workspaces listed vertically
- Each workspace shows: icon, label, and a count badge for actionable items (e.g., "Projects (12)", "Finance (3 pending)")
- **Keyboard shortcut:** `G then M` for My Work, `G then P` for Projects, `G then F` for Finance, etc. (vim-style "go to" chords)
- **Transition:** When switching workspaces, sidebar items crossfade (150ms opacity transition). No jarring jump.

#### Sidebar Collapse (1024–1280px)

On screens between 1024–1280px, the sidebar can collapse to a **48px icon rail**:

```
┌────┐
│ P  │ ← Logo icon
│ Co │ ← Company initial
│────│
│ ★  │ ← My Work
│ 🏗 │ ← Projects
│ 💰 │ ← Finance
│ 📦 │ ← Operations
│ 👥 │ ← People
│ 📊 │ ← Reports
│ ⚙️ │ ← Admin
│────│
│ ◆  │ ← AI
│ JG │ ← User avatar
└────┘
```

- Each icon is a direct workspace link (click to switch workspace AND expand sidebar)
- Hover on an icon → tooltip with workspace name
- Active workspace icon gets amber-400 background
- Toggle collapse: click the `«` button at top of sidebar, or use keyboard shortcut `[`

### 4.2 Contextual Navigation — Project Context

When the URL matches `/projects/[id]/*`, the sidebar automatically enters **Project Context Mode**:

```
┌─────────────────────────┐
│ ← Back to All Projects  │  ← Click to exit project context
│                         │
│ ┌─────────────────────┐ │
│ │ 🏗 Maple Tower      │ │  ← Project name (from URL)
│ │ #2026-003 · Active  │ │  ← Project number + status
│ └─────────────────────┘ │
│                         │
│   Overview              │  ← /projects/[id]
│   Job Cost              │  ← /projects/[id]/job-cost
│   Daily Reports         │  ← /projects/[id]/daily-reports
│   Tasks                 │  ← /projects/[id]/tasks
│   RFIs           (3)    │  ← Badge: 3 open RFIs
│   Submittals     (1)    │  ← Badge: 1 pending
│   Schedule              │
│   Change Orders  (2)    │  ← Badge: 2 pending approval
│   Documents             │
│   Plans & Specs         │
│   Punch List            │
│   Progress              │
│   Projections           │
│   Communications        │
│   Meetings              │
│   Narratives            │
│                         │
│ ─── Also ────────────── │
│   Billing Applications  │  ← Quick link: filtered for this project
│   Subcontracts          │  ← Quick link: filtered for this project
│                         │
│ ────────────────────── │
│   AI ◆ Ask about this   │  ← AI scoped to project context
│   project               │
│ ────────────────────── │
│   👤 User               │
└─────────────────────────┘
```

**Key behaviors:**
- Entering a project URL auto-switches to project context (no workspace switcher visible)
- "← Back to All Projects" returns to the Projects workspace
- Badge counts show actionable items for THIS project
- AI prompt is pre-scoped: "Ask about Maple Tower"
- "Also" section shows cross-module pages filtered to this project (billing apps, subcontracts)

### 4.3 "My Work" Workspace — Role-Adaptive Default

```
┌─────────────────────────┐
│ ★ My Work          ▾    │  ← Workspace switcher
│                         │
│ ─── Favorites ───────── │
│   📊 Dashboard          │  ← User-pinned
│   ❓ RFIs (Project X)   │  ← User-pinned
│   📓 Journal Entries    │  ← User-pinned
│                         │
│ ─── Recent ──────────── │
│   WIP Schedule          │  ← Auto-populated
│   Maple Tower > Tasks   │  ← Shows project context
│   Payroll Runs          │
│   AR Aging              │
│   Employees             │
│                         │
│ ─── Quick Actions ───── │
│   + New RFI             │  ← Role-specific
│   + New Time Entry      │  ← Role-specific
│   + New Journal Entry   │  ← Role-specific
│                         │
│ ─── Alerts ──────────── │
│   🔴 3 Overdue RFIs     │  ← Clickable → filtered view
│   🟡 5 Pending Approvals│
│   🔵 Billing Due Feb 25 │
└─────────────────────────┘
```

**Favorites behavior:**
- Right-click any nav item → "Add to Favorites"
- Or click the ☆ icon that appears on hover
- Drag to reorder favorites
- Favorites sync per user (stored in user preferences API, not just localStorage)

**Recent behavior:**
- System tracks last 8 unique page visits
- Shows breadcrumb-style context: "Maple Tower > Tasks" not just "Tasks"
- Clicking a recent item navigates directly

**Quick Actions per role (default, customizable):**

| Role | Quick Action 1 | Quick Action 2 | Quick Action 3 |
|------|---------------|----------------|----------------|
| PM | New RFI | Approve Timecards | New Daily Report |
| Controller | New Journal Entry | Close Period | WIP Schedule |
| AP Clerk | Enter Invoice | Payment Run | Vendor Lookup |
| AR Clerk | New Pay App | Apply Cash Receipt | AR Aging |
| Payroll | Process Payroll | Certified Payroll | Chase Approvals |
| HR | New Employee | Compliance Check | Onboarding |
| Foreman | Enter Crew Time | Daily Report | Punch List |
| Admin | System Health | User Management | Audit Log |

---

## 5. Mobile Navigation Strategy

### The Problem Today

- Desktop sidebar is `hidden lg:flex` — completely gone below 1024px
- Mobile bottom nav (`sm:hidden`) only exists below 640px with 3 hardcoded tabs + "More" sheet
- **Tablet gap (640–1024px):** No sidebar AND no bottom nav. Only a hamburger in the header.
- Mobile sidebar (`AppSidebarMobile`) duplicates desktop code with less granular permissions (bug)
- Quick Action FAB exists but is `md:hidden` (below 768px only)

### The New Mobile Strategy

#### Phone (< 640px) — Role-Adaptive Bottom Tabs

Replace the hardcoded 3-tab bottom nav with **role-adaptive bottom tabs** (4 tabs + More):

**PM Bottom Tabs:**
```
┌───────────────────────────────────────┐
│  🏠        🏗️        ❓       ⏱️      │
│ Home    Projects    RFIs    Time     ≡ │
└───────────────────────────────────────┘
```

**Controller Bottom Tabs:**
```
┌───────────────────────────────────────┐
│  🏠        📓        📈       💰      │
│ Home    Journal    WIP     Billing   ≡ │
└───────────────────────────────────────┘
```

**Foreman Bottom Tabs:**
```
┌───────────────────────────────────────┐
│  🏠        ⏱️        📝       📋      │
│ Home    Time     Report   Punch     ≡ │
└───────────────────────────────────────┘
```

**AP Clerk Bottom Tabs:**
```
┌───────────────────────────────────────┐
│  🏠        🧾        🧱       🏢      │
│ Home   Invoices    POs    Vendors    ≡ │
└───────────────────────────────────────┘
```

The `≡` (More) tab opens a bottom sheet with:
- All other workspaces (scrollable list)
- Search bar at top
- Recent items
- Settings / Help / Logout

#### Tablet (640–1024px) — Collapsed Rail + Top Bar

The icon rail (48px) is always visible. Tapping an icon opens a popover/sheet with that workspace's items. This closes the current "tablet gap" where neither sidebar nor bottom nav exists.

```
┌────┬───────────────────────────────────────────┐
│ P  │ Header: Breadcrumbs + Search + Notifications│
│ ★  ├───────────────────────────────────────────┤
│ 🏗 │                                             │
│ 💰 │  Main Content Area                          │
│ 📦 │                                             │
│ 👥 │                                             │
│ 📊 │                                             │
│ ⚙️ │                                             │
│ ◆  │                                             │
│ 👤 │                                             │
└────┴───────────────────────────────────────────┘
```

#### Touch Targets

All mobile interactive elements: minimum 44×44px (already enforced in current design system). Bottom tab bar items: 48px height with icon + label.

#### Offline / Field Considerations

Foreman personas often have poor connectivity on jobsites. The current PWA/offline infrastructure supports this. Mobile nav should:
- Cache the nav structure for offline rendering
- Show connection status indicator (already exists: `connection-status.tsx`)
- Support offline time entry and daily reports (existing feature)

---

## 6. Role-Based Navigation Defaults

### First Login Experience

When a user logs in for the first time, their default workspace and favorites are set based on their primary role:

| Role | Default Workspace | Auto-Favorites | Bottom Tabs (Mobile) |
|------|------------------|----------------|---------------------|
| **Project Manager** | Projects | Dashboard, Projects, RFIs, Time Approval, Job Cost | Home, Projects, RFIs, Time |
| **Controller/CFO** | Finance | Dashboard, Journal Entries, WIP, Financial Overview, AP Aging | Home, Journal, WIP, Billing |
| **AP Clerk** | Operations | Dashboard, Vendor Invoices, Purchase Orders, Vendors | Home, Invoices, POs, Vendors |
| **AR Clerk** | Finance | Dashboard, Billing Applications, AR Aging, Cash Receipts | Home, Pay Apps, AR Aging, Customers |
| **Payroll Manager** | People | Dashboard, Payroll Runs, Certified Payroll, Time Tracking | Home, Payroll, Time, Certified |
| **HR Director** | People | Dashboard, Employees, Compliance, Onboarding | Home, Employees, Compliance, Onboarding |
| **Foreman** | My Work | Time Entry, Daily Reports, Equipment | Home, Time, Report, Punch |
| **Executive/Owner** | My Work | Dashboard, Project Profitability, Financial Overview, WIP | Home, Dashboard, Reports, Projects |
| **System Admin** | Admin | System Health, Users, Audit Logs, Integrations | Home, Health, Users, Audit |

### Customization

Users can customize at any time:
- **Change default workspace:** Settings > Navigation > Default Workspace
- **Edit favorites:** Right-click → Add/Remove from Favorites, or drag in "My Work"
- **Edit mobile tabs:** Settings > Navigation > Mobile Tabs (choose 4 from permitted pages)
- **Edit quick actions:** Settings > Navigation > Quick Actions

All navigation preferences stored via API (not just localStorage) so they roam across devices.

### Multi-Role Users

Some users have multiple roles (e.g., PM who also does billing). They see the union of all permitted items. Their default workspace is set by their primary role, but they can change it. The workspace switcher shows all workspaces they have permission to access.

---

## 7. Progressive Disclosure Strategy

### Layer 1: Workspace (Always Visible)

The workspace switcher is always visible. 7 workspaces max. Each workspace icon has a tooltip describing what's inside. New users see workspace names; experienced users recognize icons.

### Layer 2: Workspace Items (One Click)

Switching workspaces reveals 5-12 items. These are the primary pages for that domain. No sub-menus, no accordions, no nested groups. Flat list within each workspace.

### Layer 3: Page-Level Actions (In Context)

Within a page (e.g., `/projects`), additional actions (New Project, Import, Filters) are in the page header — not in the sidebar. The sidebar is for navigation; pages own their actions.

### Layer 4: Command Palette (Power Users)

⌘K reveals everything. Fuzzy search across all 131 pages, all entities, all actions. This is the escape hatch — if a user can't find something in 2 clicks, ⌘K will find it.

### Layer 5: Settings and Admin (Intentionally Hidden)

Settings (10 pages) and Admin (14 pages) are not in the main nav flow. Settings accessed via user dropdown. Admin is a workspace only visible to admin-permissioned users. New users are never overwhelmed by configuration they don't need.

### Onboarding: First-Time Tour

New users get a 3-step tour:
1. "This is your workspace switcher. You're starting in **My Work** — your favorites and recent items live here."
2. "Use **⌘K** to search for anything — pages, projects, employees, actions."
3. "Star ☆ any page to add it to your favorites for quick access."

No comprehensive 20-step tour. Three concepts: workspaces, search, favorites.

---

## 8. Command Palette / Search Integration

### Current State

The command palette already exists (805 lines, custom Dialog + Input implementation). It supports:
- 23 navigation commands
- 5 create commands
- 6 entity search prefixes (`emp:`, `proj:`, `eq:`, `bid:`, `rfi:`, `con:`)
- Recent search history (localStorage)
- Arrow key + Enter keyboard navigation

### Enhancements

#### 8.1 Unified Search Experience

Merge the command palette with a new top-bar search input. On desktop, the header shows a search input (`⌘K` to focus). Clicking it or pressing ⌘K opens the full command palette dialog.

```
┌─────────────────────────────────────────────────────────┐
│ 🔍 Search pages, projects, people...            ⌘K     │
└─────────────────────────────────────────────────────────┘
                        ↓ (on focus)
┌─────────────────────────────────────────────────────────┐
│ 🔍 │ approve timec...                                   │
├─────────────────────────────────────────────────────────┤
│ ⏎ Pages                                                 │
│   ✅ Time Tracking > Approval        /time-tracking/... │
│                                                         │
│ ⏎ Actions                                               │
│   ▶ Approve all pending timecards                       │
│                                                         │
│ ⏎ Recent                                                │
│   📊 Dashboard                                          │
│   📓 Journal Entries                                    │
│   🏗 Maple Tower > RFIs                                 │
├─────────────────────────────────────────────────────────┤
│ 💡 Tip: Type ">" for commands, "@" for people           │
└─────────────────────────────────────────────────────────┘
```

#### 8.2 Search Categories

| Prefix | Category | Examples |
|--------|----------|---------|
| (none) | Fuzzy match all | "journal" → Journal Entries page |
| `>` | Commands / Actions | "> new rfi" → Create RFI action |
| `@` | People | "@john" → Employee record |
| `#` | Projects | "#maple" → Maple Tower project |
| `$` | Financial entities | "$inv-2026-001" → Invoice lookup |
| `?` | Help / AI | "? how to close a period" → AI answer or help article |

#### 8.3 Smart Suggestions

The command palette learns from usage:
- Most-searched terms appear first in suggestions
- "This morning" context: if you always open Journal Entries at 8am, it rises in suggestions at 8am
- Project context: if you're on a project page, entity search scopes to that project first

#### 8.4 Replace cmdk with shadcn Command

Migrate from the current custom Dialog+Input implementation to the shadcn/ui `<Command>` component (wraps cmdk). This gives us:
- Better fuzzy matching (cmdk's built-in scoring)
- Group/separator support
- Accessible by default
- Consistent with our component library

---

## 9. AI Agent Integration Points

### Philosophy

The AI isn't a separate feature — it's navigation. When a user asks "show me overdue RFIs for Maple Tower," the AI both answers AND navigates (or offers to navigate). AI surfaces in three places in the nav:

### 9.1 AI in the Sidebar

The sidebar has a persistent "Ask AI" trigger near the bottom:

```
│ ─── AI ───────────────── │
│ ◆ Ask Pitbull AI          │  ← Opens AI chat panel
│   "What's behind schedule?"│  ← Contextual prompt hint
└───────────────────────────┘
```

The hint text changes based on context:
- On Dashboard: "What needs my attention today?"
- In a Project: "What's behind schedule on Maple Tower?"
- In Finance: "Show me journal entries pending approval"
- In Payroll: "Any certified payroll reports due this week?"

### 9.2 AI in the Command Palette

The `?` prefix in ⌘K routes to AI:
- `? overdue rfis` → AI responds in the command palette with a summary + "Navigate to RFIs" action
- `? who approved invoice 2026-001` → AI answers with entity link
- `? close period 2026-01` → AI provides checklist + "Go to Period Close" action

This means the command palette is both search AND conversational AI. The boundary between "finding a page" and "asking a question" disappears.

### 9.3 AI as Navigation Agent

The AI can perform navigation actions on behalf of the user:
- "Take me to the WIP schedule" → navigates to `/accounting/wip`
- "Show me all overdue RFIs across projects" → navigates to `/rfis?status=overdue`
- "Create a new journal entry for depreciation" → navigates to `/accounting/journal-entries/new` with pre-filled template

This positions the AI as a **navigation agent** — it understands the app's structure and can route users to the right place faster than any menu.

### 9.4 AI-Powered Alerts in "My Work"

The "Alerts" section in My Work can include AI-generated insights:
- "3 projects are trending over budget — review projections"
- "Certified payroll for Highway 101 is due Friday"
- "5 vendor insurance certificates expire next week"

These are actionable: clicking navigates to the relevant page with appropriate filters.

---

## 10. Migration Plan from Current Sidebar

### Phase 0: Preparation (1 sprint)

**Goal:** Lay groundwork without changing visible UI.

| Task | Description | Files |
|------|-------------|-------|
| Create workspace data model | Define workspace types, items per workspace, role defaults in a new `workspaces.ts` | `components/layout/workspaces.ts` (new) |
| User nav preferences API | Backend endpoint to store/retrieve user favorites, default workspace, mobile tab config | New controller + service |
| Unify sidebar components | Merge `AppSidebar` and `AppSidebarMobile` into one component with responsive modes | `app-sidebar.tsx`, delete `app-sidebar-mobile.tsx` |
| Fix mobile permission bug | Mobile sidebar uses role check instead of `usePermissions()` — fix before redesign | `app-sidebar-mobile.tsx` → unified component |
| Upgrade command palette to cmdk/shadcn | Replace custom Dialog+Input with shadcn `<Command>` | `command-palette.tsx` |

### Phase 1: Workspace Switcher (1 sprint)

**Goal:** Replace the flat sidebar with workspace-based navigation. Desktop only.

| Task | Description |
|------|-------------|
| Implement workspace switcher dropdown | Top of sidebar, replaces current section headers |
| Implement "My Work" workspace | Favorites, recents, quick actions, alerts |
| Reorganize nav items into workspaces | Migrate from `nav-items.ts` to `workspaces.ts` |
| Implement favorites system | Right-click → favorite, persist via API |
| Implement recent tracking | Track last 8 page visits in context |
| Project context mode | Auto-enter project workspace when URL matches `/projects/[id]/*` |
| Sidebar collapse (icon rail) | Implement 48px collapsed mode for 1024-1280px |

### Phase 2: Mobile + Tablet (1 sprint)

**Goal:** Role-adaptive mobile tabs, fix tablet gap.

| Task | Description |
|------|-------------|
| Role-adaptive bottom tabs | Replace hardcoded 3-tab bar with role-based 4+More tabs |
| Tablet rail nav | Show icon rail (48px) on 640-1024px screens |
| Unified responsive breakpoints | Clean up the 3 different mobile strategies into one coherent system |
| Mobile workspace access via "More" sheet | Full workspace browsing from bottom sheet |

### Phase 3: Command Palette Enhancement (1 sprint)

**Goal:** Make ⌘K a first-class navigation tool.

| Task | Description |
|------|-------------|
| Search bar in header | Persistent search input that opens command palette on focus |
| Category prefixes | Implement `>`, `@`, `#`, `$`, `?` prefix routing |
| AI integration in palette | `?` prefix routes to AI, responses render inline |
| Smart suggestions | Usage-based ranking, time-of-day context |

### Phase 4: Role Defaults + Onboarding (0.5 sprint)

**Goal:** New users get a tailored experience out of the box.

| Task | Description |
|------|-------------|
| Role-based default configuration | Set default workspace, favorites, quick actions, mobile tabs per role |
| First-time onboarding tour | 3-step tooltip tour (workspaces, ⌘K, favorites) |
| Navigation settings page | `/settings/navigation` for users to customize all nav preferences |

### Rollout Strategy

- **Feature flag:** `nav-v2` flag enables new navigation. Current sidebar remains as fallback.
- **Gradual rollout:** Enable for internal team first, then beta users, then all.
- **Feedback mechanism:** "Try the new navigation" toggle in settings with a "Send Feedback" link.
- **Kill switch:** Feature flag can be toggled off per-user or globally.

---

## 11. Estimated Implementation Effort

| Phase | Scope | Sprint Estimate | Complexity |
|-------|-------|----------------|------------|
| Phase 0: Preparation | Data model, unified sidebar, cmdk upgrade | 1 sprint | Medium |
| Phase 1: Workspace Switcher | Core workspace nav, favorites, recents, project context | 1 sprint | High |
| Phase 2: Mobile + Tablet | Role-adaptive tabs, tablet rail, responsive cleanup | 1 sprint | Medium |
| Phase 3: Command Palette | Enhanced search, categories, AI integration | 1 sprint | High |
| Phase 4: Role Defaults | Onboarding, settings, role configuration | 0.5 sprint | Low |

**Total: ~4.5 sprints**

### Key Technical Decisions

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| Workspace data model | TypeScript config + user preferences API | Workspaces defined in code, user customizations in DB |
| Favorites storage | User preferences API (not just localStorage) | Must roam across devices for field workers |
| Command palette library | Migrate to shadcn `<Command>` (cmdk) | Better fuzzy matching, consistent with design system |
| Sidebar collapse | CSS transition with localStorage toggle | Simple, no server state needed |
| Role detection | From JWT claims (existing `useAuth` + `usePermissions`) | Already have role infrastructure |
| Feature flag | LaunchDarkly or simple DB flag | Gradual rollout with kill switch |

### Risk Factors

| Risk | Mitigation |
|------|-----------|
| User resistance to change | Feature flag rollout, side-by-side comparison, "classic" fallback for 90 days |
| 131 pages need re-mapping to workspaces | Some pages may not fit cleanly — use ⌘K as catch-all for edge cases |
| Mobile bottom tab customization complexity | Start with role defaults, add customization in Phase 4 |
| Performance (loading workspace data) | Workspace definitions are static TypeScript — no API call needed for structure |
| AI integration scope creep (Phase 3) | MVP: `?` prefix shows simple AI response. Full conversational nav is a future phase. |

---

## Appendix A: Navigation Item Count Comparison

| Metric | Current | Proposed |
|--------|---------|----------|
| Items visible at once (desktop) | 20-40+ (scrolling required) | 5-12 (no scrolling) |
| Maximum items in any workspace | N/A (flat list) | 15 (Projects with project context) |
| Clicks to reach any page | 1-3 (but must scroll to find) | 1-2 (workspace switch + click) |
| Sections/headers visible | 8-11 | 1 (active workspace) |
| Settings items in main nav | 10 | 0 (moved to user dropdown) |
| Admin items in main nav | 17 | 0 (separate workspace, permission-gated) |
| Mobile nav items | 3 tabs + hamburger | 4 role-adaptive tabs + More sheet |

## Appendix B: Role × Workspace Primary Usage

| Role | Primary Workspace | Time Spent |
|------|------------------|-----------|
| Project Manager | Projects | 70% |
| Controller/CFO | Finance | 60% |
| AP Clerk | Operations | 80% |
| AR Clerk | Finance | 75% |
| Payroll Manager | People | 85% |
| HR Director | People | 80% |
| Foreman | My Work (mobile) | 95% |
| Executive/Owner | My Work + Reports | 90% |
| System Admin | Admin | 70% |

## Appendix C: Keyboard Shortcuts (Proposed)

| Shortcut | Action |
|----------|--------|
| `⌘K` / `Ctrl+K` | Open command palette |
| `[` | Toggle sidebar collapse |
| `G then M` | Go to My Work workspace |
| `G then P` | Go to Projects workspace |
| `G then F` | Go to Finance workspace |
| `G then O` | Go to Operations workspace |
| `G then H` | Go to People (HR) workspace |
| `G then R` | Go to Reports workspace |
| `G then A` | Go to Admin workspace |
| `G then S` | Go to Settings |
| `?` | Open keyboard shortcuts help |
| `N then R` | New RFI |
| `N then T` | New Time Entry |
| `N then J` | New Journal Entry |
| `N then P` | New Project |
| `/` | Focus search |

## Appendix D: Current vs. Proposed Workspace Mapping

### Items Removed from Main Nav
- Settings: Preferences, Notifications, Overtime Rules, Timecards, Projects, Contracts, Bids, RFIs, Reports, Company Setup → **User dropdown → Settings page**
- Help Center → **User dropdown → Help**
- Footer links (Privacy, Terms, Shortcuts, Version) → **User dropdown**

### Items Reorganized
- "Resources" (Employees, Cost Codes, Equipment, Audit Trail) → **Split across People and relevant workspaces**
- "Financial" + "Billing" → **Merged into Finance workspace**
- "Procurement" (POs, Invoices, Vendors, Customers, Contracts, Change Orders) → **Renamed to Operations**
- "Project Management" (14 project-scoped items) → **Projects workspace, contextual on project selection**
- "Reports" (6 items) → **Reports workspace + Time Audit moved here**
- "Admin" (17 items) → **Admin workspace, removed AI Usage/Health Dashboard duplicates**
