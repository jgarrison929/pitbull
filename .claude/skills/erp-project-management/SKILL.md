---
name: erp-project-management
description: Construction project management domain expert. Use when working on project schedules, RFIs, submittals, daily reports, meetings, tasks, plans & specs, or any PM workflow. Understands how PMs, superintendents, and architects interact.
---

# AAI-ERP Project Management Domain — Construction PM Expert

## Your Role
You understand how construction project managers actually work: managing schedules, tracking RFIs, processing submittals, writing daily reports, running meetings, and coordinating between owner, architect, subs, and field crews.

## PM Module Structure (12 sub-modules)

1. **Schedule** — Activities, dependencies (FS/FF/SS/SF), critical path, baselines, Gantt
2. **Job Cost** — Budget vs actual at cost code level, commitments, forecasting
3. **RFIs** — Questions to architect with response tracking, cost/schedule impact
4. **Submittals** — Product data/shop drawings with review workflow, ball-in-court
5. **Daily Reports** — Field documentation: weather, manpower, activities, safety
6. **Plans & Specs** — Drawing registers, revision tracking, spec sections
7. **Communications** — Letters, emails, phone logs with reference linking
8. **Meetings** — OAC meetings, sub meetings, safety meetings with minutes
9. **Progress** — Project % complete tracking
10. **Projections** — Cost-at-completion forecasting
11. **Documents** — File storage with category management
12. **Tasks** — Action items linked to RFIs, submittals, meetings

## RFI Workflow

```
PM creates RFI → assigns to Architect/Engineer
  ↓
Architect responds (or requests clarification)
  ↓
PM reviews response → Accept or Request revision
  ↓
Track impact: Cost impact ($) + Schedule impact (days)
  ↓
If cost/schedule impact → Create Change Order
  ↓
Close RFI
```

### RFI Key Fields
- Number (auto-sequential per project: RFI-001, RFI-002)
- Subject, Question, Response
- DateSubmitted, DateRequired, DateResponded
- ResponsibleParty (who needs to answer)
- Impact: Cost ($), Schedule (days), Type (Cost/Schedule/Both)
- Status: Draft → Open → Responded → Closed
- AI: Similar RFIs suggested from past projects

### RFI Response Time = Money
Average RFI costs $1,000-$4,000 in delays. Every day an RFI sits unanswered costs the project money. Track response time and surface overdue RFIs prominently.

## Submittal Workflow

```
PM creates submittal → specifies spec section + required date
  ↓
PM submits to Architect for review
  ↓
Architect reviews → Approved / Approved as Noted / Revise & Resubmit / Rejected
  ↓
If Revise & Resubmit → Sub revises → Re-submit
  ↓
Track ball-in-court: Who has it right now? How long have they had it?
```

### Ball-in-Court
Critical tracking: at any moment, every submittal is in someone's hands. The system must show who has it and how long they've had it. This drives accountability.

## Daily Reports

### Required Content
- **Date and weather** (temperature, conditions, precipitation)
- **Manpower** (number of workers by trade)
- **Work performed** (narrative of activities)
- **Equipment used** (what was on site)
- **Visitors** (inspectors, owner reps)
- **Safety observations** (near misses, incidents)
- **Delays** (weather, material, labor)
- **Photos** (progress documentation)

### Why It Matters
Daily reports are the #1 referenced document in construction claims and disputes. "What happened on March 15th?" gets answered by the daily report. They must be complete, accurate, and contemporaneous (written same day).

## Schedule Entities

The existing schedule model is comprehensive:
- `PmSchedule` — container with data date, calendar type
- `PmScheduleActivity` — tasks with WBS hierarchy, planned/actual dates, float, critical flag
- `PmScheduleDependency` — FS/FF/SS/SF with lag
- `PmScheduleBaseline` — snapshot for comparison

### Schedule Views
- **Gantt chart** — THE expected view for any PM (spec at docs/plans/GANTT-CHART-VISUALIZATION.md)
- **Activity list** — table with filters
- **3-week lookahead** — near-term schedule for field coordination

## Punch List (spec at docs/plans/PUNCH-LIST-MODULE.md)

Close-out workflow: PM + architect walk building → document deficiencies → assign to responsible sub → track completion → verify fix → release retention.

## Common Mistakes
1. Not tracking ball-in-court on submittals (who has it?)
2. RFIs without cost/schedule impact assessment
3. Daily reports without weather (critical for claims)
4. Missing the connection between PM data and financial data (RFI impact → change order → billing)
5. Schedule without dependencies (it's just a task list without FS/FF/SS/SF)
