# Feature Specification: Plan-line edit on the daily crew plan

**Feature Branch**: `cursor/plan-line-edit-verify-9b39`

**Created**: 2026-10-29

**Status**: Draft

**Input**: User description: "Plan-line edit on the daily crew plan. Job 25-031 Cedar Creek Bridge, pour line 04-210 at 60 MH. Foreman Luis Ortega, superintendent Ray Dominguez, PM Marcus Lee, executive Elena Brooks. Verification pilot for issue 97 (parent) and issue 98 (Verify). This spec records behavior already in the app. It does not change that behavior, and it does not close either issue."

## User Scenarios & Testing *(mandatory)*

The daily crew plan on Cedar Creek Bridge (job 25-031) includes pour line 04-210, "Pour Pier 3 column, lift 2", seeded at 6 workers × 10 h = 60 MH. A foreman or a superintendent edits that line on the job page. A project manager and an executive do not get an Edit control. A saved edit is a `dailyPlan.updateLine` write, so it shows on **Changes on this job**.

Roles are chosen on `/login` with `data-testid=role-<role>`. There is no password. Each visitor's sandbox starts from the Summit Highway & Bridge seed. **Reset demo** puts the pour line back to 60 MH, so each scenario can run on its own.

Wording below is the app's wording. The short phrases in the scenario titles ("whole number", "man-hours 60 → 80") are substrings of those sentences.

### User Story 1 - Foreman saves 80 man-hours (Priority: P1)

Luis Ortega opens job 25-031, edits pour line 04-210, sets man-hours to 80, and saves. The line shows 80 MH. A reload still shows 80 MH. Because 10 hours divides 80, the line rebalances to 8 workers × 10 h.

**Why this priority**: This is the edit the field actually makes. If it does not stick, the rest of the plan is not trustworthy.

**Independent Test**: Sign in as the foreman, reset the demo, open `/app/jobs/25-031`, change 04-210 from 60 MH to 80 MH, reload, and read `line-mh`.

**Acceptance Scenarios**:

1. **PB-97-S1** **Given** Luis Ortega is signed in as the foreman and pour line 04-210 on job 25-031 shows 60 MH, **When** he edits that line to 80 man-hours, saves, and reloads `/app/jobs/25-031`, **Then** the line still shows 80 MH (8 workers × 10 h).

---

### User Story 2 - Fractional workers are rejected (Priority: P1)

Ray Dominguez opens the same line and enters 2.5 workers. The server rejects it. The inline error reads `Workers must be a whole number from 1 to 50.` Nothing is written: after a reload the line is still 60 MH.

The Workers field is a number input with step 1. The browser's own constraint check would block the submit before the server answered. The area test sets `novalidate` on the form, the same way `v5/tests/e2e/plan-edit.spec.ts` already does, so the inline error on the page is the server's sentence.

**Why this priority**: A fractional crew size must not land in the plan or in the change feed.

**Independent Test**: Sign in as the superintendent, reset the demo, submit 2.5 workers with native constraint validation turned off, read `error-workers`, reload, and read `line-mh`.

**Acceptance Scenarios**:

1. **PB-97-S2** **Given** Ray Dominguez is signed in as the superintendent and pour line 04-210 shows 60 MH, **When** he enters 2.5 workers and saves, **Then** the form shows the inline error `Workers must be a whole number from 1 to 50.` and a reload still shows 60 MH.

---

### User Story 3 - PM and executive have no Edit control (Priority: P1)

Marcus Lee and Elena Brooks can open the job and read the plan. The plan lines do not render an Edit control (`data-testid=edit-line`). The foreman and the superintendent do see that control on a draft line.

**Why this priority**: Edit rights are part of the role, not a hint in the assistant. The screen has to match.

**Independent Test**: Sign in as the PM, reset the demo, open `/app/jobs/25-031`, and count `edit-line`. Switch to the executive on the same sandbox and count again.

**Acceptance Scenarios**:

1. **PB-97-S3** **Given** a fresh sandbox on job 25-031, **When** Marcus Lee (PM) and then Elena Brooks (executive) open `/app/jobs/25-031`, **Then** neither page shows an Edit control on a plan line.

---

### User Story 4 - The PM's change feed names the foreman (Priority: P2)

Luis edits 04-210 from 60 MH to 80 MH on screen. Marcus opens the same job. **Changes on this job** shows a new row by Luis Ortega. The summary is the app's sentence:

`Changed 04-210 Pour Pier 3 column, lift 2 on Bridge Crew 2's plan: man-hours 60 → 80 (8 workers × 10 h).`

The row is `Luis Ortega ·` plus that sentence. The seed already has an older Luis Ortega row on this job (a note on the pour). That older row does not contain `man-hours 60 → 80`.

**Why this priority**: The feed is how the PM sees a field edit without opening the foreman's chat. It depends on story 1 having saved.

**Independent Test**: As the foreman, save 80 MH on 04-210. Switch to the PM in the same sandbox (role switch keeps the sandbox). Read `job-changes` for one row that contains both `Luis Ortega` and `man-hours 60 → 80`.

**Acceptance Scenarios**:

1. **PB-97-S4** **Given** the PM's change feed on job 25-031 has no `man-hours 60 → 80` row, **When** Luis Ortega changes pour line 04-210 from 60 MH to 80 MH and Marcus Lee opens `/app/jobs/25-031`, **Then** the feed shows one row for Luis Ortega whose text contains `man-hours 60 → 80`.

---

### User Story 5 - Cancel and Escape discard the edit (Priority: P2)

Luis opens the line form, changes man-hours, and does not save. Cancel closes the form and leaves 60 MH. Opening the form again and pressing Escape from the activity field (the field the form focuses) does the same. A reload still shows 60 MH.

**Why this priority**: An in-progress edit must not stick unless someone saves it. Story 1 is the save path; this is the discard path.

**Independent Test**: As the foreman, open the 04-210 form, change man-hours, press Cancel, reopen, change man-hours, press Escape on the activity field, reload, and read `line-mh`.

**Acceptance Scenarios**:

1. **PB-97-S5** **Given** Luis Ortega has the 04-210 form open with a man-hours value he has not saved, **When** he presses Cancel, **Then** the form closes and the line still shows 60 MH.
2. **PB-97-S5** **Given** he opens that form again and changes man-hours without saving, **When** he presses Escape on the activity field, **Then** the form closes and a reload still shows 60 MH.

### Edge Cases

- Workers outside the whole-number range 1–50, including 2.5, produce `Workers must be a whole number from 1 to 50.` on `error-workers`. The stored line does not change.
- Escape while the cost-code list is open closes that list and does not discard the edit. The combobox stops the key so the form's Escape handler does not run. Escape from the activity field does discard the edit.
- Edit is only rendered for a draft plan, and only for a foreman or a superintendent. An issued, reported, or approved plan has no Edit control for anyone.
- Setting man-hours to 80 when hours are 10 rebalances workers from 6 to 8. The saved summary includes both the man-hours and `8 workers × 10 h`.
- The seed's note edit by Luis Ortega stays on the feed. The man-hours scenario looks for `man-hours 60 → 80`, not for the name alone.
- Switching roles keeps the sandbox, so the PM sees the foreman's write. **Reset demo** drops that write and restores 60 MH.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A foreman MUST be able to change pour line 04-210 on job 25-031 from 60 man-hours to 80 man-hours, and the line MUST still show 80 MH after a reload.
- **FR-002**: When a superintendent submits 2.5 workers on that line, the form MUST show the inline error `Workers must be a whole number from 1 to 50.` and the stored line MUST stay at 60 MH.
- **FR-003**: The PM and the executive MUST NOT see an Edit control on plan lines on `/app/jobs/25-031`.
- **FR-004**: After the foreman's saved edit, the PM's **Changes on this job** list MUST show one row whose text contains `Luis Ortega` and `man-hours 60 → 80`.
- **FR-005**: Cancel MUST close an in-progress edit without saving. Escape from the activity field MUST do the same. After either one, and after a reload, the line MUST show 60 MH.
- **FR-006**: A saved man-hours change MUST be recorded as `dailyPlan.updateLine` with the app's summary sentence, which names the cost code, the activity, the crew, and `man-hours 60 → 80 (8 workers × 10 h)`.

### Key Entities *(include if feature involves data)*

- **Daily plan line**: One cost code on one crew's draft plan. The pour line is cost code 04-210, activity "Pour Pier 3 column, lift 2", quantity in the line's unit, workers (whole number), hours, and man-hours (workers × hours). Job 25-031, Bridge Crew 2.
- **Action run**: The write log for a sandbox. `dailyPlan.updateLine` stores the signed-in user and the summary. **Changes on this job** lists those writes for the job, newest first, with the user's name.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After the foreman saves 80 MH and reloads `/app/jobs/25-031`, `line-mh` on cost code 04-210 reads 80.
- **SC-002**: After the superintendent submits 2.5 workers, `error-workers` contains `whole number`, and after reload `line-mh` on 04-210 still reads 60.
- **SC-003**: On `/app/jobs/25-031`, the count of `edit-line` is 0 for the PM and 0 for the executive.
- **SC-004**: On the PM's `/app/jobs/25-031` change feed, exactly one `job-changes` row contains both `Luis Ortega` and `man-hours 60 → 80` after the foreman's screen edit.
- **SC-005**: After Cancel, and again after Escape, the line form is hidden and `line-mh` reads 60, including after reload.

## Assumptions

- The seeded company is Summit Highway & Bridge. Job 25-031 is Cedar Creek Bridge. Pour line 04-210 starts at 6 workers, 10 hours, and 60 MH. The plan for that line is a draft, so a foreman or superintendent can edit it.
- Demo entry is a role card (`role-foreman`, `role-superintendent`, `role-pm`, `role-executive`). The seed names are Luis Ortega, Ray Dominguez, Marcus Lee, and Elena Brooks.
- This document describes behavior that is already shipped. The pilot does not change the edit rules, the error sentence, or the change-feed sentence to match a shorter scenario title.
- `v5/tests/e2e/plan-edit.spec.ts` stays. It also drives the assistant, the cost-code search, and an ambiguous line. None of those is the whole of PB-97-S1 through PB-97-S5, so those cases were not moved.
- **Reset demo** restores the seed, including 60 MH on 04-210. Each area scenario resets (or starts from a new sandbox) so it does not depend on another scenario.
- The area screenshots are the viewport at 1280×800, light theme (`pcs_theme=light`), on `/app/jobs/25-031`. Each pair is keyed by scenario and role. PB-97-S3 has two pairs, one for the PM and one for the executive, on that same page, viewport, theme, and seed. The before shot is pour line 04-210 at rest. The after shot is that same line after the role hovers and clicks it. No Edit control appears.
- Issue 97 is the parent and issue 98 is the Verify sub-issue. This spec references both. It closes neither.
- PostHog stays off unless `NEXT_PUBLIC_POSTHOG_KEY` is set. A `pb_test_run` cookie is verification tooling for a later staging pass. It is not a product control, and it does not unmask inputs. Chrome rejects a raw `;` in a cookie value, so the area tests percent-encode `pr=…;scenario=…;suite=…`. `document.cookie` decodes it, and the gate reads that shape.
- Evidence images from a local area run are copied under `docs/v5/specs/pilot/001-plan-line-edit/evidence/`. The run's `scenarios.md` is generated from the test results into `v5/test-results/areas/plan-edit/` and is not committed.
