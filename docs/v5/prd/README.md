# v5 PRDs

A PRD defines one feature release, the `<feature>` in `5.<feature>.<increment>`. It states the problem, the users and roles, the scope and what is out of it, how the release fits the data model, and the increment list. The increment specs in [`../specs/`](../specs/README.md) then cover each increment in detail.

The 5.0 core loop has no PRD. Its scope is in the [fresh-start plan](../fresh-start-plan.md), sections 4 and 9.

## Planned PRDs

Each PRD waits for an intel doc on the matching InEight module in [`../intel/`](../intel/). A PRD cites InEight only by claim IDs from that doc or links from the fresh-start plan.

| Release | PRD | Waits on | State |
|---|---|---|---|
| 5.1 Schedule | [`5.1-schedule.md`](5.1-schedule.md) | [`docs/v5/intel/schedule.md`](../intel/schedule.md), merged in #691 on 2026-10-24 | Written 2026-10-24 |
| 5.2 Contracts and subs | [`5.2-contracts-and-subs.md`](5.2-contracts-and-subs.md) | [`docs/v5/intel/contracts.md`](../intel/contracts.md), merged in #694 (old history) on 2026-10-24 | Written 2026-10-26. Specs for 5.2.0 and 5.2.1 written |
| 5.3 Document control | `5.3-document-control.md` | An intel doc on InEight Document | Not started. Intel due 2026-11-20 so the PRD can land with 5.2.2 |
| 5.4 Compliance | `5.4-compliance.md` | An intel doc on InEight Compliance | Not started |
| 5.5 Owner billing and portfolio reporting | `5.5-owner-billing-and-reporting.md` | An intel doc on InEight Report & Explore and owner billing | Not started |

Increment lists live in each PRD and in the [roadmap](../../roadmap.md): [5.1](5.1-schedule.md) and [5.2](5.2-contracts-and-subs.md).

## What a PRD settles before increments start

- The questions still open for Joshua:
  - 5.2: whether the insurance-expiry hold on sub pay applications joins 5.2 (contracts intel, recommendation 5). The [5.2 PRD](5.2-contracts-and-subs.md#open-question-for-joshua) recommends yes, as 5.2.5. It stays out until Joshua decides.
  - Whether 5.0.x stays ahead of 5.1.0. The docs keep 5.0.x first.
- Settled in the 5.2 PRD (2026-10-26): one subcontract record with SOV lines on cost items; Committed Cost EAC = AC + open commitment; minimal sub pay applications with retention are in 5.2; strict defaults instead of warn-or-block settings.
- Settled in the 5.1 PRD (2026-10-24): daily plan lines link to activities in 5.1.0. XER and Microsoft Project XML import land as 5.1.3. PV is "dates from the baseline schedule, linear spread".
- The changes to the data model, sketched against `v5/src/db/schema.ts`.
- The seed story: what the demo company shows for the release, and which numbers the verify run checks.
- The order of the increments, and what each one demos.
