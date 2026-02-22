# Josh Testing Feedback — Feb 21, 2026 (4:09 PM PST)

Source: Production testing at https://pitbull-web-production.up.railway.app

---

## CRITICAL BUGS

### 1. Workspace Switcher Broken
- **Issue:** Can't swap workspaces after initial login. Only works on first login, then requires logout/re-login to switch.
- **Impact:** BLOCKER — users can't navigate the app
- **Priority:** P0

### 2. Change Orders Returns 404
- **Issue:** Change Orders page returns 404
- **Impact:** Broken feature
- **Priority:** P0

### 3. Progress Entry Fails to Save
- **Issue:** Clicking "Create Entry" on progress entry form fails silently
- **Impact:** Core workflow broken
- **Priority:** P0

---

## UX / NAVIGATION ISSUES

### 4. Workspace Navigation Should Route to Default Page
- **Issue:** Switching to Projects workspace should route directly to "All Projects" list, not require an extra click
- **Priority:** P1

### 5. Add Time Entry Routes to Single Entry Instead of Crew Timecard
- **Issue:** From project → "Add Time Entry" goes to single employee time entry form, should go to crew timecard for that project
- **URL:** `/time-tracking/new?projectId=...`
- **Expected:** Route to crew timecard pre-filtered to this project
- **Priority:** P1

### 6. Project Dashboard Should Be Drill-Down Enabled
- **Issue:** All dashboard items shown on Project Overview should be clickable/drill-down
- **Specific items:**
  - **Hours Logged** → should link to PM Labor Drilldown page (show how hours accumulated)
  - **Budget Consumed** → should link to Unit Cost Report (see where budget consumed)
  - **Open RFIs** → should link to RFIs tab
- **Priority:** P1

### 7. Can't Assign Team Members from Project Dashboard
- **Issue:** Team member assignment requires going to a different area. Should be doable from the project dashboard.
- **Principle:** "Don't make people go to different areas to start data entry if we are showing it on the dashboard"
- **Priority:** P1

---

## FEATURE NEEDS (Domain-Specific)

### 8. Documents Tab — Full File Management System
- **Vision:** SharePoint/file-folder look and feel
- **Requirements:**
  - Link documents from RFIs, Submittals, Plans & Specs to this module
  - File sharing capabilities
  - Permissions by Project and by Role
  - Handle sensitive data
- **Note from Josh:** "This module will need a full spec to be iterated on several times and we'll need to address file storage and handling sensitive data"
- **Priority:** P2 (needs full spec first)

### 9. Schedule — Modern P6/Procore Killer
- **Vision:** "Very modern feel and performance of Primavera P6 or Procore but fucking way better"
- **Requirements:**
  - Task linkages (FS, FF, SS, SF dependencies)
  - Ease of entry
  - Standardized to AEC industry
- **Priority:** P2 (major feature, needs spec)

### 10. Job Cost — Needs Domain Research
- **Issue:** Current implementation needs market research and domain expertise from construction job cost accountants
- **Action:** Research what modern construction job cost should look like
- **Priority:** P2 (needs research + spec)

### 11. Progress Entry — Add Lump Sum (LS) Unit Type
- **Issue:** Unit type options need to include "LS" for Lump Sum
- **Priority:** P1

### 12. Progress Entry — Status Should Follow Workflow/Lifecycle
- **Issue:** Status field should update based on workflow, not manual selection
- **Need:** Domain expertise from PM/SPM/PX on common workflows
- **Priority:** P2

### 13. Projections → Cost Projections
- **Issue:** "Projections" should be "Cost Projections" (industry standard terminology)
- **Reference:** CMiC, Vista, SAGE all use "PM Cost Projections" or "JC Cost Projections"
- **UI:** Should be a grid/Excel-type entry interface
- **Why:** "Help make transitioning the old timers from Excel easier"
- **Priority:** P1

### 14. Punch List Form — Needs Polish
- **Issue:** Form captures good info but looks crowded and jumbled
- **Action:** Give it spacing, visual hierarchy, cleaner layout
- **Priority:** P1

---

## SUMMARY BY PRIORITY

| Priority | Count | Items |
|----------|-------|-------|
| P0 (Broken) | 3 | Workspace switcher, Change Orders 404, Progress Entry save |
| P1 (Must Fix) | 6 | Default routing, crew timecard, dashboard drilldowns, team assign, LS unit, projections rename, punch list polish |
| P2 (Needs Spec) | 4 | Documents system, Schedule overhaul, Job Cost research, Workflow lifecycle |

---

## KEY PRINCIPLES FROM JOSH

1. **"Don't make people go to different areas to start data entry if we are showing it on the dashboard"** — If you show it, make it actionable
2. **"Grid/Excel type entry interface"** — Old timers need familiar patterns
3. **"We need domain expertise"** — Schedule, Job Cost, and Workflow need real construction PM input
4. **"Standardized to the AEC industry"** — Use industry terminology and patterns (CMiC, Vista, SAGE as reference)
