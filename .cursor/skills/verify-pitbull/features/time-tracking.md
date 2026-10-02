# Time tracking

## User POV

I open the time-tracking area as the selected role, understand what period/project context is shown, and verify the visible state without accidentally changing someone else's time data.

## Sub-features

- Reaching time tracking from the role's current navigation.
- Inspecting the visible period, project, and entry state.
- Verifying any role-appropriate controls that are already exposed.
- Saving evidence of the observed state and reporting unclear or blocked flows.

## How to get to it

1. Start with `C:\pitbull-private\.cursor\skills\verify-pitbull\doctor.ps1`.
2. Use `http://localhost:3000` and verify the unauthenticated API health URL `http://localhost:5081/health/live` before browser work.
3. If startup is explicitly authorized, use `docker compose up -d`, `dotnet run --project src/Pitbull.Api`, and `npm run dev` from `src/Pitbull.Web/pitbull-web` exactly as documented in the skill.
4. Log in only with Demo enabled, a known demo email, and `PitbullDemo2026!`; navigate to time tracking through the current UI rather than guessing a route.

## Driving with control helpers / Playwright

- Check `e2e\` and the existing `scripts\run-role-e2e.ps1` flow for time-tracking coverage before writing or running anything new.
- Use control helpers, labels, and roles; avoid arbitrary sleeps and avoid brittle coordinate clicks.
- Prefer read-only inspection for a smoke check. If a mutation is required by an existing test, make ownership and cleanup explicit.
- Keep screenshots in `.cursor\skills\verify-pitbull\evidence\`.

## Gotchas

- Time values can be user- and project-scoped; never infer a defect from a different role's expected view.
- Do not submit, edit, or delete time unless the test explicitly calls for it.
- If the shared database/session state is unclear, refuse to drive and report `BLOCKED` rather than trying to reset data.
- Cleanup never means killing a bare process name; only stop resources this run started and identified.
