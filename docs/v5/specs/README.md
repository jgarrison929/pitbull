# v5 increment specs

A spec covers one increment, the `<n>` in `5.<feature>.<n>`. It says what the increment builds and how Pitbull Verify proves it on staging. A spec lists:

- user stories
- acceptance checks that name the role, the URL, the action, and the expected numbers or states
- seed and demo data
- a data model sketch
- what is out of scope
- trust-bar risks

The [roadmap](../../roadmap.md) sets the order and the target dates. A feature release, such as 5.1 Schedule, gets a PRD in [`../prd/`](../prd/README.md) before its increment specs are written.

## Ready to build now

Slice IDs builders can take without waiting on each other. Prefer free slices first. Parts A to C of 5.0.3 and the 5.1.1 CPM pure-library slice are already in flight.

| Slice ID | Spec | Migration | Notes |
|---|---|---|---|
| 5.0.3 Part D | [5.0.3](5.0.3-s-curve-and-forecast-methods.md#part-d-plan-history-timestamps-role--time) | **0018** | `daily_plan_events`; history shows role + time |
| 5.0.3 Part E | [5.0.3](5.0.3-s-curve-and-forecast-methods.md#part-e-rail-unknown-job-refusal) | none | Cap 3 approved jobs; exclude 26-010 |
| 5.0.3 Part F | [5.0.3](5.0.3-s-curve-and-forecast-methods.md#part-f-crews-contract-migration) | **0019** | Drop `daily_plans.crew`; `crew_id` NOT NULL |
| 5.1.0-a | [5.1.0](5.1.0-activities-and-gantt.md) | **0020** | Calendars, activities, links tables + Cedar seed |
| 5.1.0-b | [5.1.0](5.1.0-activities-and-gantt.md) | none | `schedule.ts` + typed actions (stack on 5.1.0-a) |
| 5.1.0-c | [5.1.0](5.1.0-activities-and-gantt.md) | none | Gantt UI shell can start now |
| 5.1.0-d | [5.1.0](5.1.0-activities-and-gantt.md) | **0021** | Plan-line `activity_id`; merge after **0020** |
| 5.0.3 Part A | [5.0.3](5.0.3-s-curve-and-forecast-methods.md#part-a-the-s-curve) | none | In flight: `server/curve.ts` |
| 5.0.3 Part B | [5.0.3](5.0.3-s-curve-and-forecast-methods.md#part-b-average-performance-forecast) | **0017** | In flight |
| 5.0.3 Part C | [5.0.3](5.0.3-s-curve-and-forecast-methods.md#part-c-the-dark-theme) | none | In flight |
| 5.1.1 CPM library | [5.1.1](5.1.1-dependencies-and-cpm.md) | none | In flight: pure library, checks 1 to 6 + performance |

Next free migration after 5.1.0-d: **0022** (likely 5.1.1 `activity_links`). 5.1.2 baselines claim **0023** unless the journal moved.

| Version | Spec | Target (PT) |
|---|---|---|
| 5.0.1 | [The superintendent plans the day, and a public roadmap page](5.0.1-superintendent-plans-the-day.md) | shipped 2026-10-25 |
| 5.0.2 | [Crew rates, field history, and the cost drill-down](5.0.2-crew-rates-and-field-history.md) | 2026-10-26 (merged, verifying) |
| 5.0.3 | [The S-curve, Average Performance, and the dark theme](5.0.3-s-curve-and-forecast-methods.md) | 2026-10-28 |
| 5.1.0 | [Activities, calendar, Gantt, and plan-line links](5.1.0-activities-and-gantt.md) | 2026-10-29 |
| 5.1.1 | [Dependencies, float, and the critical path](5.1.1-dependencies-and-cpm.md) | 2026-11-03 |
| 5.1.2 | [Baseline and PV from baseline dates](5.1.2-baseline-and-pv.md) | 2026-11-10 |
| 5.1.3 | [XER and Microsoft Project XML import](5.1.3-schedule-import.md) | 2026-11-17 |

Spec rules:

- The file name is `5.<feature>.<n>-<slug>.md`.
- The status line gives the date it was written (PT) and the `main` commit it was checked against.
- Every acceptance check runs against the staging app. A check that can only run in CI goes in a separate list.
- A claim about InEight cites a claim ID from [`../intel/`](../intel/) or a link from the [fresh-start plan](../fresh-start-plan.md).
- No shipped screen shows a stub, "coming soon", or placeholder text. If part of a feature isn't ready, it stays out of the navigation.
