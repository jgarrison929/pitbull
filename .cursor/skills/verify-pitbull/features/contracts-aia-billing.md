# Contracts / AIA billing

## User POV

I enter the Pitbull web UI as a known role, reach contracts and the AIA billing surface through the visible product navigation, and confirm that the displayed contract/billing context is understandable and appropriate for that role.

## Sub-features

- Reaching contracts from the authenticated workspace.
- Reaching the AIA billing surface from the current UI.
- Inspecting visible contract, billing, status, or period context.
- Capturing evidence for the exact user-visible state.

## How to get to it

1. Run `C:\pitbull-private\.cursor\skills\verify-pitbull\doctor.ps1`; it must report Docker, port `5432`, API health on `5081`, and web response on `3000` clearly.
2. Use `http://localhost:3000` only after the API is healthy at `http://localhost:5081/health/live`.
3. If a later run authorizes startup, use the interview commands: `docker compose up -d`; `dotnet run --project src/Pitbull.Api`; and `npm run dev` from `src/Pitbull.Web/pitbull-web`.
4. Authenticate through the Demo-enabled role flow using a known email and `PitbullDemo2026!`, then follow the visible navigation to contracts and AIA billing. Do not invent deep links.

## Driving with control helpers / Playwright

- Inspect the relevant files under `e2e\` and use existing Playwright helpers and the role runner `scripts\run-role-e2e.ps1`.
- Assert labels, headings, status, and other user-visible contract/billing context rather than private implementation details.
- Avoid creating or approving billing records in a smoke check unless an existing test explicitly requires it and cleanup ownership is clear.
- Preserve screenshots under `.cursor\skills\verify-pitbull\evidence\`.

## Gotchas

- AIA billing visibility may be role-dependent; compare only with an expectation established by the current app/test.
- Do not treat a blank or unavailable billing surface as a reason to guess a route or seed data.
- Shared Docker/Postgres and concurrent browser sessions can change contract state. Use separate ports/profiles or stop as `BLOCKED`.
- Never clean up by bare process name, and never delete evidence.
