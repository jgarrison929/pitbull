# Daily reports / field

## User POV

I enter the Pitbull web UI as a known role, reach the field daily-report workflow, and verify the visible report context and controls as a field user would. I distinguish a page that loads from a report that is actually usable.

## Sub-features

- Reaching daily reports from the role's current navigation.
- Inspecting field/report context and visible status.
- Exercising only the smallest role-appropriate smoke path already represented by the app or `e2e\` tests.
- Capturing the user-visible result as evidence.

## How to get to it

1. Run `C:\pitbull-private\.cursor\skills\verify-pitbull\doctor.ps1` before opening the UI.
2. Verify `http://localhost:5081/health/live` without authentication and `http://localhost:3000` responding.
3. If explicitly authorized to start the environment, use `docker compose up -d`, `dotnet run --project src/Pitbull.Api`, and from `src/Pitbull.Web/pitbull-web`, `npm run dev`.
4. When Demo is enabled, use the known role login (`ceo@demo.local` or `pm@demo.local`, as appropriate) with `PitbullDemo2026!`, then navigate to daily reports through the UI. Do not guess a route or role.

## Driving with control helpers / Playwright

- Inspect `e2e\` first and follow the existing Playwright controls and helpers.
- Use `scripts\run-role-e2e.ps1` rather than inventing a role runner; use only its documented arguments.
- Prefer stable accessible controls and visible assertions. Avoid arbitrary sleeps, broad selectors, and unrelated mutations.
- Save screenshots under `.cursor\skills\verify-pitbull\evidence\` with role/feature context.

## Gotchas

- Field data can be role- and project-scoped; do not assume a report should exist for every role.
- Do not submit or alter a daily report during a read-only smoke unless the existing test requires it and ownership/cleanup are explicit.
- If another session or shared Postgres instance may be driving the same data, use separate ports/profiles or refuse to proceed.
- Keep evidence and stop only processes/containers this run started; never kill by bare process name.
