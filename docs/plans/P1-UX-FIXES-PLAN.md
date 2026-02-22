# P1 UX Fixes Implementation Plan (Josh Testing Feb 21)

## Scope
This plan covers the 6 UX-focused P1 items from `docs/feedback/JOSH-TESTING-FEB21.md`:
1. Workspace switch should route to default page
2. Project "Add Time Entry" should open crew timecard
3. Project dashboard KPI cards should drill down
4. Team assignment should be possible from project dashboard
5. "Projections" should be renamed to "Cost Projections" and feel grid-first
6. Punch list form needs visual polish/layout cleanup

Note: This intentionally excludes the separate P1 domain item for LS unit type in Progress Entry.

---

## Priority Order
1. Workspace default routing (navigation friction across the app)
2. Add Time Entry -> Crew Timecard routing (daily workflow)
3. Project dashboard drill-down links (actionability)
4. Team assignment from dashboard (data entry in context)
5. Cost Projections terminology/grid treatment (industry alignment)
6. Punch list form polish (usability/visual hierarchy)

---

## 1) Workspace Navigation Should Route to Default Page

### Goal
When user switches workspace, navigate immediately to a landing page for that workspace (instead of only changing sidebar content).

### Files to change
- `src/Pitbull.Web/pitbull-web/src/components/layout/workspaces.ts`
- `src/Pitbull.Web/pitbull-web/src/components/layout/app-sidebar.tsx`
- `src/Pitbull.Web/pitbull-web/src/components/layout/mobile-bottom-nav.tsx`
- `src/Pitbull.Web/pitbull-web/src/hooks/use-workspace-nav.ts` (optional small API extension)

### Exact changes
- In `workspaces.ts`:
  - Add exported helper:
    - `getWorkspaceLandingHref(workspaceId: WorkspaceId, projectId: string | null): string`
  - Map landing routes:
    - `my-work` -> `/`
    - `projects` -> `/projects`
    - `finance` -> `/accounting/journal-entries` (or first permitted finance item)
    - `operations` -> `/procurement/purchase-orders`
    - `people` -> `/time-tracking`
    - `reports` -> `/reports`
    - `admin` -> `/admin/company`
- In `app-sidebar.tsx`:
  - Replace direct `onSelect={setActiveWorkspace}` with handler:
    - set workspace
    - `router.push(getWorkspaceLandingHref(id, currentProjectId))`
  - Keep existing behavior for project-context back button.
- In `mobile-bottom-nav.tsx`:
  - Replace `firstHref` logic (`ws.items[0]?.href`) with `getWorkspaceLandingHref(ws.id, null)`.
  - This avoids Projects incorrectly routing to `/` (because projects workspace items are dynamic/empty in static config).
- Optional: expose helper via `use-workspace-nav.ts` if desired for consistency.

### Acceptance criteria
- Switching to Projects always routes to `/projects`.
- All workspace switches update URL immediately on desktop and mobile.
- No logout/re-login needed to "activate" workspace route behavior.

---

## 2) Project "Add Time Entry" Should Route to Crew Timecard

### Goal
From project context, "Add Time Entry" should open crew entry and preselect the project.

### Files to change
- `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/projects/[id]/page.tsx`
- `src/Pitbull.Web/pitbull-web/src/components/projects/project-labor-summary.tsx`
- `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/time-tracking/crew-entry/page.tsx`

### Exact changes
- In `projects/[id]/page.tsx`:
  - Change both links:
    - `/time-tracking/new?projectId=${id}`
    - -> `/time-tracking/crew-entry?projectId=${id}`
  - Locations:
    - empty-state "Log Time"
    - quick action "Add Time Entry"
- In `project-labor-summary.tsx`:
  - Change empty-state CTA:
    - `/time-tracking/new?projectId=${projectId}`
    - -> `/time-tracking/crew-entry?projectId=${projectId}`
- In `time-tracking/crew-entry/page.tsx`:
  - Add `useSearchParams` import/use.
  - Read `projectId` query param on load.
  - After crew projects are loaded, if query `projectId` is present and valid for user:
    - set active form project via existing form update methods:
      - `dailyForm.updateProject(projectId)`
      - `weeklyDetailedForm.updateProject(projectId)`
      - `weeklySimpleForm.updateProject(projectId)`
  - Guard to avoid reapplying on every render (one-time `prefilledProjectRef`).

### Acceptance criteria
- From project dashboard, Add Time Entry opens crew page with project selected.
- Works in daily and weekly modes.
- If project is not in the user’s assignable project list, show a toast and leave current selection unchanged.

---

## 3) Project Dashboard KPI Cards Should Be Drill-Down Enabled

### Goal
KPI cards on project overview should be clickable and route to appropriate detail pages.

### Files to change
- `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/projects/[id]/page.tsx`
- `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/projects/[id]/unit-cost/page.tsx` (new)
- `src/Pitbull.Web/pitbull-web/src/components/layout/workspaces.ts` (add nav item)

### Exact changes
- In `projects/[id]/page.tsx`:
  - Wrap cards in `<Link>` or make card content clickable with `asChild`:
    - Hours Logged -> `/reports/labor-cost?projectId=${id}` (PM labor drilldown)
    - Budget Consumed -> `/projects/${id}/unit-cost`
    - Open RFIs -> `/projects/${id}/rfis`
  - Add hover/focus affordance classes for clickable cards.
- Add new page `projects/[id]/unit-cost/page.tsx`:
  - Fetch from existing endpoint:
    - `GET /api/projects/{projectId}/unit-costs?page=1&pageSize=500`
  - Render table/grid by cost code and key unit-cost columns.
  - Include breadcrumbs and project-context header.
- In `workspaces.ts`:
  - Add project workspace nav item:
    - label `Unit Cost Report`
    - href `${base}/unit-cost`
    - permission `Projects.View`

### Acceptance criteria
- All 3 KPI cards are clickable with keyboard and mouse.
- Budget Consumed click opens a real report page backed by API unit-cost data.

---

## 4) Team Assignment From Project Dashboard

### Goal
Allow adding/removing team assignments directly from project overview.

### Files to change
- `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/projects/[id]/page.tsx`
- `src/Pitbull.Web/pitbull-web/src/lib/types.ts` (if needed for assignment request typing)
- `src/Pitbull.Web/pitbull-web/src/components/ui/dialog.tsx` (reuse only, no API change expected)

### Exact changes
- In `projects/[id]/page.tsx`:
  - Add "Manage Team" button to Team Members card header.
  - Add dialog with:
    - employee selector (from `/api/employees?isActive=true&pageSize=200`)
    - role selector mapped to `AssignmentRole` enum values expected by `POST /api/project-assignments`
    - optional start/end dates + notes
  - On submit:
    - call `POST /api/project-assignments` with `{ employeeId, projectId: id, role, startDate, endDate, notes }`
    - refresh team list via existing assignments request
  - Add remove action per row:
    - `DELETE /api/project-assignments/{assignmentId}`
    - refresh list after success
  - Add toasts for success/error states.
- In `lib/types.ts`:
  - Add/confirm typed request model for project assignment create payload and role enum mapping used by this dialog.

### Acceptance criteria
- PM can assign and unassign members from dashboard without leaving page.
- Team list updates immediately after mutation.
- Duplicate assignment returns conflict toast (no silent failure).

---

## 5) Rename "Projections" -> "Cost Projections" + Grid-First UX

### Goal
Use industry terminology and make page feel like a cost projection grid.

### Files to change
- `src/Pitbull.Web/pitbull-web/src/components/layout/workspaces.ts`
- `src/Pitbull.Web/pitbull-web/src/components/layout/nav-items.ts`
- `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/projects/[id]/projections/page.tsx`
- `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/projects/[id]/page.tsx` (if any text references added)

### Exact changes
- Rename labels:
  - Sidebar/workspace labels:
    - `Projections` -> `Cost Projections` in `workspaces.ts` and `nav-items.ts`.
  - Page copy in `projections/page.tsx`:
    - title `Monthly Projections` -> `Monthly Cost Projections`
    - card title/description and CTA copy similarly.
  - Toast/messages:
    - `Projection created/updated/deleted` -> `Cost projection ...`
- Grid-first behavior improvements in `projections/page.tsx`:
  - Keep desktop table as primary interaction.
  - Add inline-edit affordance for top financial fields (Budget/EAC/ETC/VAC) with save row action.
  - Keep dialog for full-detail edits (description/assumptions).
  - Preserve mobile card layout unchanged.

### Acceptance criteria
- No "Projections" label remains in project nav; users see "Cost Projections".
- Desktop flow supports quick grid-style edits for key numeric fields.

---

## 6) Punch List Form Visual Polish

### Goal
Reduce visual clutter and improve information hierarchy in punch list create/edit dialog.

### Files to change
- `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/projects/[id]/punch-list/page.tsx`

### Exact changes
- In punch list dialog section:
  - Increase dialog width:
    - `sm:max-w-2xl` -> `sm:max-w-4xl`
    - add `max-h-[90vh] overflow-y-auto` for consistent scroll.
  - Re-group fields into clear sections (with headings/separators):
    - `Item Details`: description, location, category
    - `Assignment & Schedule`: responsible party, assigned to, due date, status, priority
    - `Impact`: cost impact, schedule impact, notes
    - `Attachments`: existing files + uploader
  - Adjust dense 3-column rows to 2-column where labels/inputs are longer.
  - Increase spacing:
    - section wrapper from `space-y-4` -> `space-y-6`
    - form group paddings from `py-2` -> `py-3`
  - Make footer actions more prominent:
    - keep cancel secondary, save primary amber.
  - Ensure mobile stack remains single-column with readable touch targets.

### Acceptance criteria
- Form reads in top-down logical sections.
- No cramped three-field clusters on common tablet widths.
- Save path is unchanged functionally (UI-only polish).

---

## Suggested Delivery Sequence
1. Implement #1 and #2 in same PR (navigation/time-entry routing).
2. Implement #3 and #4 in next PR (project dashboard actionability).
3. Implement #5 and #6 in third PR (terminology + visual polish).

This sequencing minimizes merge risk and gives rapid user-visible wins first.
