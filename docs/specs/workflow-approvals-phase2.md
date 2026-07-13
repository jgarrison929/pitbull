# Spec: Workflow approvals Phase 2

**Status:** In progress — lifecycle **frozen 2.21.3** (Time entries)  
**Version band:** 2.21.3 → 2.22.0 (8 PRs)  
**Related:** [`WORKFLOW-EVALUATION-MATRIX.md`](../WORKFLOW-EVALUATION-MATRIX.md), Phase 1 CO + billing

## Problem

Approvals Phase 1 covers change orders and owner billing; other lifecycles lack a unified **My Approvals** mobile glance with real pending counts.

## Personas

PM, Manager, CFO (read), field (submit only where applicable).

## User journey

1. PM opens home on phone → **Pending approvals** card with real count  
2. Opens list → approves/rejects **one** expanded lifecycle  
3. Transitions mirror existing `workflow-transitions` rules  

## Primary code touchpoints

| Area | Paths |
|------|-------|
| PM home | `src/.../components/dashboard/role-views/pm-dashboard.tsx` |
| Workflow transitions | search `workflow-transitions` in web |
| CO / time / PO controllers | `ChangeOrdersController`, time entry approval APIs, procurement if present |
| Help | `help/page.tsx` |

## API touchpoints

| Endpoint (target) | Notes |
|-------------------|--------|
| `GET /api/approvals/pending` (or under existing dashboard) | Aggregate counts by lifecycle — **real DB counts** |
| Existing approve/reject for chosen lifecycle | Reuse; do not fork rules |

### Frozen expansion (2.21.3)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Mobile approve lifecycle** | **Time entries** | Field-adjacent; existing approve/reject APIs; PM/Manager gate |
| **Deferred (not this band)** | RFIs, POs, submittals | Office-heavy; avoid multi-lifecycle UI in one band |
| **Already Phase 1** | Change orders, owner billing apps | Do not re-implement |

**API routes (canonical — implement in 2.21.4+):**

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/approvals/pending` | Aggregate pending counts by lifecycle key (`timeEntries`, `changeOrders`, …) — **real DB counts**, RLS/company scoped |
| GET | existing time entry pending/list for review | Reuse list filters for “Submitted” awaiting approval |
| POST | existing time entry approve / reject | Reuse; no forked status strings |

**Mobile UX:** PM home **Pending approvals** card → count for `timeEntries` (and Phase 1 types if already available) → drill to one-tap approve/reject for **time entries only**.

**Transition source of truth:** `workflow-transitions` (web) + API status enums — 2.21.7 mirrors strings.

## Version table

| Version | Deliverable | Acceptance |
|---------|-------------|------------|
| 2.21.3 | Spec freeze: which lifecycle expands | **Time entries** + API routes frozen above |
| 2.21.4 | API: pending approvals aggregate | Returns real counts; RLS safe |
| 2.21.5 | Mobile card on PM home | Count matches API; empty honest |
| 2.21.6 | Approve/reject from mobile (one lifecycle) | Success path + error toast |
| 2.21.7 | Mirror `workflow-transitions.ts` | No divergent status strings |
| 2.21.8 | Integration test approval chain | Pass |
| 2.21.9 | Help: approvals workflow | Card |
| 2.22.0 | Phase 2 checkpoint | Spec Status shipped through 2.22.0 |

## Non-goals

- Rebuild all office approval UIs  
- Fake badge counts  

## Truth rules

- Show real pending counts from DB — not badge fiction  

## Band DoD (2.22.0)

- [ ] Aggregate + one mobile approve path + tests + help  
