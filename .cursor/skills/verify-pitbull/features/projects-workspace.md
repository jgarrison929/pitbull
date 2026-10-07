# Projects / workspace

## User POV

I enter the Pitbull web UI as a known role, open Projects, pick a project from the list, and confirm the project dashboard shows real context (number, status, budget, dates, client) and the project tabs. I record what is visible instead of assuming every role has the same workspace.

## How it works (source-verified 2026-10-07, origin/main)

- Web: `/projects` (list with search/status filter and "+ New Project"), `/projects/{id}` (dashboard), and project tabs under `/projects/{id}/...` (daily-reports, rfis, submittals, schedule, job-cost, documents, punch-list, site-walk, twin, and more) in `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/projects/`.
- API: `GET /api/projects`, `GET /api/projects/{id}`, `GET /api/projects/{id}/stats`, `.../rfi-cost-summary`, `.../today-on-site`, `.../ai-summary` (`src/Pitbull.Api/Controllers/ProjectsController.cs`). Mutations: `POST /api/projects`, `PUT/DELETE /api/projects/{id}`, `POST /api/projects/{id}/activate`.
- The web client sends `X-Company-Id` for the active company (`src/Pitbull.Web/pitbull-web/src/lib/api.ts`).

## Live recipe (read-only)

1. `doctor.ps1`.
2. API: `POST /api/auth/demo-role-login {"role":"pm"}` -> `GET /api/projects?page=1&pageSize=50` -> `GET /api/projects/{id}` and `/stats`.
3. UI: sign in as `pm@demo.local` through the `/login` email form, open `/projects`, and take a project `href` from the rendered list (`a[href^="/projects/"]`). Open it and assert the project name, number, status, and budget in `main`.

## Gotchas

- **Company scope:** header-less API calls do not send `X-Company-Id`, so an ID taken from `GET /api/projects` may belong to a company that isn't active in the browser. The UI then shows "Failed to load project dashboard" with 404s on `/api/projects/{id}`, `/stats`, and `/rfi-cost-summary`. Navigate from the UI list instead of deep-linking API IDs.
- Live 2026-10-07: PM saw 8 projects via header-less API (CEO saw 18). The UI list shows the active company's projects.
- The project dashboard also calls `GET /api/projects/{id}/rfis` (403 for PM on some projects) and `GET /api/cost-predictions/project/{id}` (404 when no prediction exists). Treat these as noise unless the feature under test depends on them.
- Overlays such as tours can intercept clicks on list links. Use the link's `href` with `page.goto` when a click times out.
- Do not create, edit, archive, or delete projects in a smoke check. `role-workflows.spec.ts` L2 creates projects.
- A loaded shell is not a pass. Record the visible project context.