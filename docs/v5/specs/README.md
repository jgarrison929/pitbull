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

Checked against `main` at `d56eb6be` on 2026-10-26 at 10:40 AM (PT). Slices nobody owns yet. Builders can take these without waiting on each other, unless the notes say "stack on".

| Slice ID | Spec | Migration | Notes |
|---|---|---|---|
| 5.0.4-g | [5.0.4](5.0.4-clear-next-steps-and-mobile-polish.md#504-g-guided-demo-path) | none | Guided demo path. Targets `rc/5.0.4`. Needs a and b ([#26](https://github.com/jgarrison929/pitbull/pull/26), [#27](https://github.com/jgarrison929/pitbull/pull/27)) on the RC branch |
| 5.1.1 wire-up | [5.1.1](5.1.1-dependencies-and-cpm.md) | **0022** | `activity_links`, `schedule.linkActivities` and `unlinkActivities`, CPM pass on write, critical-path highlight. The engine is on `main` in `v5/src/lib/cpm.ts`. Stack on 5.1.0-b ([#37](https://github.com/jgarrison929/pitbull/pull/37)) |
| 5.1.2-b | [5.1.2](5.1.2-baseline-and-pv.md) | none | PV reads baseline dates. Stack on 5.1.2-a ([#36](https://github.com/jgarrison929/pitbull/pull/36)) |
| 5.1.2-c | [5.1.2](5.1.2-baseline-and-pv.md) | none | Gantt baseline bar and re-baseline reason form. Stack on 5.1.2-a and 5.1.0-c ([#40](https://github.com/jgarrison929/pitbull/pull/40)) |
| 5.2.0-a | [5.2.0](5.2.0-subcontracts-and-commitments.md#520-a-schema-money-math-seed) | **0024** | Vendors, subcontracts, lines, events, seed. New tables only, so it can start now. Merges after `0021` to `0023` |
| 5.2.0-c | [5.2.0](5.2.0-subcontracts-and-commitments.md#520-c-screens) | none | Screens. Shell can start against 5.2.0-a types |

Next after those: 5.2.0-b (stack on 5.2.0-a), 5.2.0-d (after 5.2.0-c), then 5.2.1-a, 5.2.1-b, 5.2.1-c ([5.2.1](5.2.1-committed-cost-forecast.md)).

## In flight

| Slice ID | PR | Migration | Notes |
|---|---|---|---|
| 5.0.3 Part A | [#12](https://github.com/jgarrison929/pitbull/pull/12) | none | S-curve. Last Verify FAIL was on an older head |
| 5.0.4-a, b | [#26](https://github.com/jgarrison929/pitbull/pull/26), [#27](https://github.com/jgarrison929/pitbull/pull/27) | none | Into `rc/5.0.4`. Last Verify FAIL was on older heads |
| 5.0.4-d, e, f | [#32](https://github.com/jgarrison929/pitbull/pull/32), [#33](https://github.com/jgarrison929/pitbull/pull/33), [#34](https://github.com/jgarrison929/pitbull/pull/34) | none | Into `rc/5.0.4`. Merge order a → b → d → e → f |
| 5.1.0-b | [#37](https://github.com/jgarrison929/pitbull/pull/37) | none | Schedule server module and typed actions |
| 5.1.0-c | [#40](https://github.com/jgarrison929/pitbull/pull/40) | none | Gantt UI |
| 5.1.0-d | [#41](https://github.com/jgarrison929/pitbull/pull/41) | **0021** | Plan-line `activity_id` and picker |
| 5.1.2-a | [#36](https://github.com/jgarrison929/pitbull/pull/36) | **0023** | Baseline schema. Merges after `0022`, or renumbers |
| 5.1.3-a, b, c | [#35](https://github.com/jgarrison929/pitbull/pull/35), [#39](https://github.com/jgarrison929/pitbull/pull/39), [#38](https://github.com/jgarrison929/pitbull/pull/38) | none | XER, Microsoft Project XML, import UI |

Merged since the fresh start: 5.0.3 Part D ([#13](https://github.com/jgarrison929/pitbull/pull/13), `0018`), 5.0.3 Part F ([#10](https://github.com/jgarrison929/pitbull/pull/10), `0019`), 5.1.0-a ([#11](https://github.com/jgarrison929/pitbull/pull/11), `0020`), 5.0.4-0 ([#24](https://github.com/jgarrison929/pitbull/pull/24)), and 5.0.4-c ([#25](https://github.com/jgarrison929/pitbull/pull/25), into `rc/5.0.4`). 5.0.3 Parts B (`0017`), C, and E and the 5.1.1 CPM library came with the fresh-history snapshot.

## Migration numbers

Drizzle's journal is contiguous. A number is a claim, not a file. A migration merges only after every lower claimed number is on `main`, or the later PR renumbers to the next free number when it rebases.

| Number | Owner | State |
|---|---|---|
| `0017` to `0020` | 5.0.3 Parts B, D, F; 5.1.0-a | On `main` |
| `0021` | 5.1.0-d | [#41](https://github.com/jgarrison929/pitbull/pull/41), open |
| `0022` | 5.1.1 `activity_links` | Reserved, no PR. If #36 is ready first, #36 takes `0022` and 5.1.1 takes the next free number |
| `0023` | 5.1.2-a | [#36](https://github.com/jgarrison929/pitbull/pull/36), open |
| `0024` | 5.2.0-a | Claimed |
| `0025` | 5.2.1-a | Claimed |
| `0026`, `0027`, `0028` | 5.2.2, 5.2.3, 5.2.4 (if needed) | Claimed by the [5.2 PRD](../prd/5.2-contracts-and-subs.md) |

5.1.3 adds no migration. The earlier `0024` reservation for a 5.1.3 import audit table is released. If 5.1.3 needs one later, it takes the next free number then.

## Specs by version

| Version | Spec | Target (PT) | State |
|---|---|---|---|
| 5.0.1 | [The superintendent plans the day, and a public roadmap page](5.0.1-superintendent-plans-the-day.md) | 2026-10-25 | Shipped |
| 5.0.2 | [Crew rates, field history, and the cost drill-down](5.0.2-crew-rates-and-field-history.md) | 2026-10-26 | Verified on staging, awaiting tag and production |
| 5.0.3 | [The S-curve, Average Performance, and the dark theme](5.0.3-s-curve-and-forecast-methods.md) | 2026-10-28 | Parts B to F on `main`, Part A open |
| 5.0.4 | [Clear next steps and mobile polish](5.0.4-clear-next-steps-and-mobile-polish.md) | 2026-10-30 | In build on `rc/5.0.4` |
| 5.1.0 | [Activities, calendar, Gantt, and plan-line links](5.1.0-activities-and-gantt.md) | 2026-10-29 | a merged, b to d open |
| 5.1.1 | [Dependencies, float, and the critical path](5.1.1-dependencies-and-cpm.md) | 2026-11-03 | Library on `main`, wire-up ready to build |
| 5.1.2 | [Baseline and PV from baseline dates](5.1.2-baseline-and-pv.md) | 2026-11-06 | a open |
| 5.1.3 | [XER and Microsoft Project XML import](5.1.3-schedule-import.md) | 2026-11-10 | a to c open |
| 5.2.0 | [Subcontracts and commitments](5.2.0-subcontracts-and-commitments.md) | 2026-11-13 | Ready to build |
| 5.2.1 | [The Committed Cost forecast method](5.2.1-committed-cost-forecast.md) | 2026-11-17 | Ready after 5.2.0-b |

Spec rules:

- The file name is `5.<feature>.<n>-<slug>.md`.
- The status line gives the date it was written (PT) and the `main` commit it was checked against.
- Every acceptance check runs against the staging app. A check that can only run in CI goes in a separate list.
- A claim about InEight cites a claim ID from [`../intel/`](../intel/) or a link from the [fresh-start plan](../fresh-start-plan.md).
- No shipped screen shows a stub, "coming soon", or placeholder text. If part of a feature isn't ready, it stays out of the navigation.
