# Time tracking

## User POV

I open time tracking as a supervisor/PM, see my crew-entry surface, and open the PM time review queue with real submitted entries, without changing anyone's time.

## How it works (source-verified 2026-10-07, origin/main)

- Web routes (`src/Pitbull.Web/pitbull-web/src/app/(dashboard)/time-tracking/`): `/time-tracking`, `/time-tracking/crew-entry`, `/time-tracking/approval` ("PM Time Review"), `/time-tracking/approval/mobile`, `/time-tracking/mobile` (field entry), `/time-tracking/new`, `/time-tracking/audit`, `/time-tracking/print`.
- API (`src/Pitbull.Api/Controllers/TimeEntriesController.cs`): `GET /api/time-entries` (filters `projectId`, `employeeId`, `startDate`, `endDate`, `status`, `foremanId`, paging), `GET /api/time-entries/{id}`, `GET /api/time-entries/review-queue`, `GET /api/time-entries/by-project/{projectId}`, `GET /api/time-entries/cost-report`, `GET /api/time-entries/yesterday-crew`, `GET /api/time-entries/export/vista`, `GET /api/time-entries/audit-trail`.
- Mutations: `POST /api/time-entries`, `PUT /{id}`, `POST /{id}/approve`, `POST /{id}/reject`, `POST /review`, `POST /batch`, and `POST /submit`.

## Live recipe (read-only)

1. `doctor.ps1`.
2. API as PM (`demo-role-login {"role":"pm"}`): `GET /api/time-entries?page=1&pageSize=25` and `GET /api/time-entries/review-queue`.
3. UI as `pm@demo.local`: open `/time-tracking`. Live 2026-10-07 it redirected to `/time-tracking/crew-entry` ("Crew Time Entry", with "Add Employees First" when no crew is assigned). Then open `/time-tracking/approval` and assert "PM Time Review" with queue counts (live: 11 submitted entries, 6 projects, 70.0 hours).

## Gotchas

- `/time-tracking` is a role-dependent redirect. Don't treat landing on `crew-entry` as a failure.
- Time is user- and project-scoped. A different role sees a different queue.
- Do not approve, reject, submit, or batch-edit time in a smoke check. `role-workflows.spec.ts` L3 submits and approves time.
- If shared DB/session state is unclear, report `BLOCKED` instead of resetting data. Stop only what this run started.