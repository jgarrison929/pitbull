# Spec: Workflow approvals Phase 2

**Status:** Pending  
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

**2.21.3 must freeze which lifecycles expand** (recommended: time entries **or** RFIs **or** POs — pick one for mobile approve).

## Version table

| Version | Deliverable | Acceptance |
|---------|-------------|------------|
| 2.21.3 | Spec freeze: which lifecycle expands | This file lists chosen lifecycle + API routes |
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
