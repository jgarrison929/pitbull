# Projects / workspace

## User POV

I enter the Pitbull web UI as a known role, navigate to the visible projects/workspace area, and confirm that the project context and available actions make sense for that role. I record what is visible instead of assuming every role has the same workspace.

## Sub-features

- Reaching the projects/workspace surface from the authenticated starting point.
- Confirming the visible project/workspace context.
- Checking that available navigation and actions stay within the signed-in role's scope.
- Capturing a stable, user-visible result as evidence.

## How to get to it

1. Run `C:\pitbull-private\.cursor\skills\verify-pitbull\doctor.ps1` first.
2. Use the local web UI at `http://localhost:3000` after the API is healthy at `http://localhost:5081/health/live`.
3. Authenticate only through the enabled demo flow with a known email and `PitbullDemo2026!`; use `ceo@demo.local` or `pm@demo.local` unless the app exposes another role.
4. Explore the current navigation to find projects/workspace. Do not invent a route or deep link.

## Driving with control helpers / Playwright

- Inspect `e2e\` for the existing project/workspace test and helper conventions before driving.
- Use the repository's `scripts\run-role-e2e.ps1` as the role-aware entry point, with only arguments documented by that script.
- Locate controls by accessible name/role or existing helpers; assert visible project/workspace state rather than implementation details.
- Save screenshots under `.cursor\skills\verify-pitbull\evidence\` and name them with role and feature when practical.

## Gotchas

- Project visibility may differ by role; absence of a project is not automatically a defect.
- Do not create, edit, archive, or delete workspace data unless an existing test explicitly requires it and the run has clear ownership.
- Shared Docker/Postgres means a second driver can make the observed workspace misleading. Use separate ports/profiles or refuse the run.
- A loaded shell is not a passed workspace check; record the actual user-visible project context.
