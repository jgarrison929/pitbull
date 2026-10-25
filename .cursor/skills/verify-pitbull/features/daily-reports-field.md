# Daily reports / field

## User POV

I enter as field leadership (superintendent) or PM, open the mobile Field report wizard and a project's Daily Reports log, and verify the visible report context and controls. I distinguish a page that loads from a report that is actually usable.

## How it works (source-verified 2026-10-07, origin/main)

- Web: `/daily-reports/mobile` (the "Field report" 4-step wizard: job, date, type, foreman ...; e2e `FIELD_REPORT_PATH` in `e2e/tests/mobile-field-report.spec.ts`) and `/projects/{id}/daily-reports` ("Daily Reports" log with New Report, totals, and status filter). There is **no** top-level `/daily-reports` page. A 307 on `/daily-reports` while signed out is only the auth middleware.
- API is project-scoped: `/api/projects/{projectId}/daily-reports` (`ProjectDailyReportsController` in `src/Pitbull.Api/Controllers/ProjectManagementControllers.cs`). It has list/get/create/update/delete and `/{id}/submit|approve|lock`, photos, rollup, weather, and deliveries (+ OCR). `GET /api/daily-reports` returns 404.
- Demo seed (`src/Pitbull.Api/Demo/DemoBootstrapper.cs`) creates **no** daily reports on main, so every project's list is empty unless a test created reports.

## Live recipe (read-only)

1. `doctor.ps1`.
2. API as PM: for each project from `GET /api/projects`, call `GET /api/projects/{id}/daily-reports?page=1&pageSize=10` and record `totalCount`.
3. UI as `superintendent@demo.local`: open `/daily-reports/mobile` and assert the "Field report" heading with step `1 / 4` "Which job?". Then open a project from the `/projects` list, go to `/projects/{id}/daily-reports`, and assert "Daily Reports" with the totals.
4. Report detail (`GET /api/projects/{id}/daily-reports/{reportId}` and the detail UI) is `verified-unreachable` read-only when every list is empty. The prerequisite is an existing report, which needs a create/submit run (`mobile-field-report.spec.ts` "field completes minimal 4-step field report" or `role-workflows.spec.ts` L10), and those mutate shared data.

## Gotchas

- Field data is role- and project-scoped. Don't expect reports for every role.
- Do not submit, approve, lock, or delete a report during a read-only smoke unless ownership and cleanup are explicit.
- If another session may be driving the same DB, use separate ports/profiles or refuse.
- Keep evidence. Stop only processes this run started, and never kill by bare process name.