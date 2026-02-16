# Crew Timecard Grid - Design Doc

**Author:** River (with Josh's domain guidance)
**Date:** 2026-02-15
**Status:** Draft
**Priority:** Alpha 1 Critical (Field Usable)

---

## Problem

The current time tracking UI is individual entry focused. Construction foremen need to enter time for their entire crew at once -- 10-30 people, same project, end of day. The crew entry grid exists but isn't the default view, has unnecessary columns (cost code), and doesn't support weekly timecards.

## Solution

A configurable crew timecard grid that supports both daily and weekly entry modes. Cost code is auto-assigned (labor), Phase drives man hours reporting, Equipment tracking is built in.

---

## Grid Columns

```
Employee | Project | Phase | Equipment | Equip Hrs | Reg | OT | DT | Total | Notes
```

**What's NOT on the grid:**
- **Cost Code** -- auto-assigned to labor. A crew timecard IS labor. The cost code gets applied in Job Cost to the labor of the phases on the timesheet.
- **Start/End/Break** -- construction tracks hours, not clock times. A foreman knows "8 regular, 2 OT" not "7:02 AM to 5:31 PM minus 32 minutes."

**Why Phase matters:**
- Phase tells you WHERE the man hours went (foundations, framing, electrical rough-in)
- Man hours by phase vs budget is the #1 report PMs care about
- "Phase 1 Foundations: 240 man hours this week (budgeted 200)" drives schedule decisions

**Why Equipment is on the grid:**
- Equipment hours tracked separately from labor hours
- Same employee might run a Cat 320 excavator for 6 hours but work 10 hours total
- Equipment has its own billing rate (HourlyRate + BillingRate on Equipment entity)
- Equipment utilization reporting: "Excavator #320 ran 42 hours this week across 3 projects"

---

## Timecard Modes (Company Configurable)

### Daily Mode
- **Who uses it:** Concrete contractors, heavy highway, any crew that moves between projects daily
- **Header:** Date picker with Today/Yesterday quick buttons
- **Copy action:** "Copy Yesterday" -- same crew roster, same project/phase assignments, blank hours
- **Submit:** One day at a time
- **Grid:** One row per employee for that day

### Weekly Mode
- **Who uses it:** Most general contractors, office staff entering at end of week
- **Header:** Payroll End Date picker (auto-calculates week based on pay period config)
- **Copy action:** "Copy Last Week" -- same crew roster, same assignments, blank hours
- **Submit:** Entire week at once
- **Grid:** One row per employee, but hours columns could be either:
  - **Option A:** Single Reg/OT/DT columns (weekly totals) -- simpler, faster entry
  - **Option B:** Day-by-day breakdown within the week -- more detail, matches paper timecards

**Decision:** Option B (day-by-day breakdown) is the way to go. Contractors with strict compliance requirements need daily detail. This becomes the "Advanced Weekly Entry" and could be toggled as a timecard setting:
- **Simple Weekly:** Single Reg/OT/DT totals per employee (fast entry)
- **Detailed Weekly (default):** Day-by-day breakdown within the week (compliance-ready)

Both modes submit the same underlying TimeEntry records (one per day per employee). The difference is just the UI.

### Configuration Location
Company Settings > Time Tracking:
- **Timecard Mode:** Daily | Weekly (default: Daily)
- **Weekly Entry Mode:** Simple (totals) | Detailed (day-by-day, default)
- **Pay Period Type:** Already built (Weekly, BiWeekly, SemiMonthly, Monthly)
- **Default Project:** Optional, pre-fills project on all rows (overridable per row)
- **Require Phase:** Toggle (required | optional)
- **Require Equipment:** Toggle (required | optional)

---

## Auto Cost Code Assignment

When a crew timecard entry is submitted:
1. System looks up the company's **Default Labor Cost Code** from settings
2. If not configured, falls back to the first active cost code with type "Labor"
3. Cost code is assigned to the TimeEntry record automatically
4. Foreman never sees or selects a cost code

**Why this works:** A crew timecard is always labor. The phase tells you what kind of labor. The cost code is just the GL account bucket -- that's a back office concern.

---

## Data Flow

```
Foreman enters:
  Employee: John Smith
  Project: Highway 99 Interchange
  Phase: Phase 2 - Bridge Deck
  Equipment: CAT 320 Excavator (#EQ-042)
  Equip Hrs: 6
  Reg: 8, OT: 2, DT: 0
  Notes: "Finished south abutment excavation"

System creates TimeEntry:
  EmployeeId: [John Smith]
  ProjectId: [Highway 99]
  PhaseId: [Phase 2 - Bridge Deck]
  CostCodeId: [auto: Labor]        <-- auto-assigned
  EquipmentId: [CAT 320]
  EquipmentHours: 6
  RegularHours: 8
  OvertimeHours: 2
  DoubletimeHours: 0
  TotalHours: 10                   <-- calculated
  Date: 2026-02-15
  Description: "Finished south abutment excavation"
  Status: Pending
```

---

## Man Hours Reporting (the real output)

The crew timecard feeds directly into job cost man hours reporting:

**By Phase:**
| Phase | Budget Hrs | Actual Hrs | Remaining | % Complete |
|-------|-----------|------------|-----------|------------|
| Phase 1 - Foundations | 200 | 240 | -40 | 120% (OVER) |
| Phase 2 - Bridge Deck | 500 | 160 | 340 | 32% |
| Phase 3 - Paving | 300 | 0 | 300 | 0% |

**By Employee (weekly):**
| Employee | Mon | Tue | Wed | Thu | Fri | Sat | Total Reg | Total OT |
|----------|-----|-----|-----|-----|-----|-----|-----------|----------|
| John Smith | 8 | 8 | 8 | 8 | 8 | 4 | 40 | 4 |
| Maria Garcia | 8 | 8 | 8 | 8 | 8 | 0 | 40 | 0 |

**Equipment Utilization:**
| Equipment | Total Hrs | Projects | Avg Hrs/Day |
|-----------|-----------|----------|-------------|
| CAT 320 #EQ-042 | 42 | 3 | 8.4 |
| Bobcat S650 #EQ-015 | 28 | 1 | 5.6 |

---

## UI Changes Required

### 1. Make Crew Entry the Default Time Tracking View
- `/time-tracking` lands on crew entry grid (not individual entry list)
- Tab/view switcher: **Crew Entry** | My Entries | Approval | Pay Periods

### 2. Update Grid Columns
- Remove: Cost Code column
- Keep: Employee, Project, Phase, Equipment, Equip Hrs, Reg, OT, DT, Total, Notes
- Phase and Equipment show conditionally based on company settings

### 3. Add Timecard Mode Support
- Company setting determines Daily vs Weekly
- Header changes based on mode (Date picker vs Payroll End Date picker)
- Copy action changes based on mode (Copy Yesterday vs Copy Last Week)

### 4. Auto Cost Code on Submit
- Look up Default Labor Cost Code from company settings
- Apply to all entries in the batch
- No cost code UI element on crew entry grid

### 5. Payroll End Date Picker (Weekly Mode)
- Dropdown or date picker that snaps to pay period end dates
- Shows: "Week Ending: Feb 15, 2026 (Pay Period: Feb 2 - Feb 15)"
- Prevents entering time outside the current/recent pay periods

---

## API Changes

### New: Company Time Tracking Settings
```
GET  /api/companies/settings/time-tracking
PUT  /api/companies/settings/time-tracking
```

```json
{
  "timecardMode": "daily",
  "weeklyEntryMode": "detailed",
  "defaultProjectId": null,
  "requirePhase": true,
  "requireEquipment": false
}
```

- `timecardMode`: "daily" | "weekly"
- `weeklyEntryMode`: "simple" (totals only) | "detailed" (day-by-day breakdown, default)
- `defaultProjectId`: If set, pre-fills project on all rows (crew stays on one project). Can be overridden per row.
- `requirePhase`: true | false (toggle on timecard settings)
- `requireEquipment`: true | false

### New: Default Cost Codes (Seed Data)
On tenant creation, seed these standard cost codes:
- **Labor** (type: Labor)
- **Equipment** (type: Equipment)
- **Material** (type: Material)
- **Subcontract Labor** (type: Subcontract)
- **Subcontract Material** (type: Subcontract)
- **Subcontract Equipment** (type: Subcontract)
- **Overhead** (type: Overhead)

Crew timecard auto-assigns the "Labor" cost code. Equipment hours auto-assign the "Equipment" cost code. These are editable -- companies can rename or add their own.

### Existing: Time Entry Create (no changes needed)
The `CreateTimeEntryCommand` already supports all fields. Cost code will be set server-side when submitted from crew entry grid.

---

## Default Cost Codes

Every new tenant gets seeded with standard construction cost codes:

| Code | Description | Type |
|------|-------------|------|
| LAB | Labor | Labor |
| EQP | Equipment | Equipment |
| MAT | Material | Material |
| SUB-LAB | Subcontract Labor | Subcontract |
| SUB-MAT | Subcontract Material | Subcontract |
| SUB-EQP | Subcontract Equipment | Subcontract |
| OVH | Overhead | Overhead |

These are starting points. Companies can rename, add, deactivate as needed. Crew timecard auto-assigns "LAB" for labor hours and "EQP" for equipment hours.

---

## Migration Path

1. Seed default cost codes for new tenants (and backfill existing tenants that have none)
2. Add timecard settings to Company (mode, weekly entry mode, default project, require phase/equipment)
3. Default all existing companies to Daily mode, Detailed weekly
4. Update crew entry grid UI (remove cost code column, reorder columns)
5. Add auto cost code assignment in TimeEntry service (LAB for labor, EQP for equipment)
6. Make crew entry the default time tracking view
7. Add weekly mode support with day-by-day breakdown
8. Add simple weekly mode as alternative
9. Add man hours reporting endpoints

---

## Out of Scope (Future)

- Geolocation/GPS verification of field entries
- Photo attachments to timecards
- Digital signature capture (employee + supervisor)
- Offline mode with sync (PWA)
- Certified payroll report generation
- Integration with payroll systems (Vista export already exists)

---

## Risk

- **Low:** Column changes are UI-only, no schema changes needed
- **Low:** Auto cost code is additive logic in the service layer
- **Medium:** Weekly mode needs new UI state management (multiple days in one form)
- **Low:** Company settings is a small schema addition

## Test Plan

- Unit tests for auto cost code assignment logic
- Unit tests for weekly hour aggregation
- Integration tests for company settings CRUD
- Manual testing of grid UX on desktop and tablet
- Verify Vista export still works with auto-assigned cost codes
