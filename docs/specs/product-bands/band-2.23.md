# Spec: Product band 2.23 — WIP mobile drill

**Status:** Post-3.0.0 (draft only — **not** on 2.12→3.0 path)  
**Version band:** Historical draft; re-home under 3.x after major  
**Theme:** WIP report drill-through mobile cards

## Problem

Controllers need WIP glance on phone; full GL detail must stay desktop.

## Version table

| Version | Deliverable |
|---------|-------------|
| 2.22.3 | WIP summary API `?view=mobile` slim DTO |
| 2.22.4 | Mobile WIP card on CFO home |
| 2.22.5 | Drill to filtered project list |
| 2.22.6 | Label "WIP proxy — not audited statement" |
| 2.22.7 | Vitest href + API contract |
| 2.22.8 | Help: WIP mobile FAQ |
| 2.22.9 | PostHog `wip_mobile_drill` |
| 2.23.0 | Empty state honest copy |
| 2.23.1 | Integration test RLS |
| 2.23.2 | Checkpoint — WIP mobile band |

## Truth rules

- WIP figures from existing service — no invented consolidation