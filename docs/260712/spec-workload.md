# Spec workload index — 2.12.2 → 3.0.0 (Arc A–E)

**Product PRs:** **~101** (`2.12.2` → `2.22.2`, one bump per PR)  
**Runway PRs:** **21** (`2.22.3` → `3.0.0`) — see [`release-checklist-runway.md`](./release-checklist-runway.md)  
**Total to 3.0.0:** **≈122** PRs from first execution goal `2.12.2`

**Rule:** Every band below needs a spec **before** the first PR in that band merges. Status tracked in each spec header.

**Post-3.0:** Old product-band G themes (2.23–2.97) do **not** block 3.0.0 — see [`docs/roadmap/post-3.0-product-bands.md`](../roadmap/post-3.0-product-bands.md).

---

## Band map (checkpoints at `.2`)

| Band | Versions | Spec file | Status |
|------|----------|-----------|--------|
| **A0** | 2.12.2 (infra) | [`specs/README.md`](../specs/README.md) + program docs | Shipped in 2.12.2 |
| **A1** | 2.12.2 → 2.13.2 | [`mobile-phase1-field-hardening.md`](../specs/mobile-phase1-field-hardening.md) | Pending |
| **A-help** | 2.12.7–2.12.8 | [`help-center-field-workflows.md`](../specs/help-center-field-workflows.md) | Pending |
| **B** | 2.13.3 → 2.14.2 | [`mobile-phase2-plans-viewer.md`](../specs/mobile-phase2-plans-viewer.md) | Pending |
| **C** | 2.14.3 → 2.15.2 | [`mobile-phase3-site-walk-schedule.md`](../specs/mobile-phase3-site-walk-schedule.md) | Pending |
| **D** | 2.15.3 → 2.19.2 (40 PRs) | [`digital-twin-phase2-implementation.md`](../specs/digital-twin-phase2-implementation.md) | Pending |
| **E-AI** | 2.19.3 → 2.21.2 | [`mobile-ai-intelligence.md`](../specs/mobile-ai-intelligence.md) | Pending |
| **E-WF** | 2.21.3 → 2.22.0 | [`workflow-approvals-phase2.md`](../specs/workflow-approvals-phase2.md) | Pending |
| **E-KPI** | 2.22.1 → 2.22.2 | [`role-kpi-drill-contracts.md`](../specs/role-kpi-drill-contracts.md) | Pending |
| **E-help** | 2.22.1 → 2.22.2 | [`help-center-office-workflows.md`](../specs/help-center-office-workflows.md) | Pending |
| **E-CI** | 2.21.5 → 2.22.2 | [`ci-mobile-owner-smoke.md`](../specs/ci-mobile-owner-smoke.md) | Pending |
| **Runway** | 2.22.3 → 3.0.0 | [`release-checklist-runway.md`](./release-checklist-runway.md) | Pending |

---

## Arc A–E specs (core product for 3.0.0)

| Spec | Version range | PRs (approx) |
|------|---------------|--------------|
| [`mobile-phase1-field-hardening.md`](../specs/mobile-phase1-field-hardening.md) | 2.12.2–2.13.2 | 11 from 2.12.1 |
| [`help-center-field-workflows.md`](../specs/help-center-field-workflows.md) | 2.12.7–2.12.8 | subset of A |
| [`mobile-phase2-plans-viewer.md`](../specs/mobile-phase2-plans-viewer.md) | 2.13.3–2.14.2 | 10 |
| [`mobile-phase3-site-walk-schedule.md`](../specs/mobile-phase3-site-walk-schedule.md) | 2.14.3–2.15.2 | 10 |
| [`digital-twin-phase2-implementation.md`](../specs/digital-twin-phase2-implementation.md) | 2.15.3–2.19.2 | 40 |
| [`mobile-ai-intelligence.md`](../specs/mobile-ai-intelligence.md) | 2.19.3–2.21.2 | 20 |
| [`workflow-approvals-phase2.md`](../specs/workflow-approvals-phase2.md) | 2.21.3–2.22.0 | 8 |
| [`role-kpi-drill-contracts.md`](../specs/role-kpi-drill-contracts.md) | 2.22.1–2.22.2 | 2 |
| [`help-center-office-workflows.md`](../specs/help-center-office-workflows.md) | 2.22.1–2.22.2 | subset |
| [`ci-mobile-owner-smoke.md`](../specs/ci-mobile-owner-smoke.md) | 2.21.5–2.22.2 | subset |

**Subtotal A–E:** ~101 PRs (`2.12.1` → `2.22.2`)

---

## Historical / out of ladder

| Spec | Notes |
|------|-------|
| [`owner-self-service-signup.md`](../specs/owner-self-service-signup.md) | **Shipped** (~2.0.x) — not on 2.12→3.0 ladder |
| [`owner-post-signup-onboarding.md`](../specs/owner-post-signup-onboarding.md) | **Shipped** — not on 2.12→3.0 ladder |

---

## Spec production order

1. **2.12.2:** Harden A–E specs + program docs (this session)  
2. **Before each arc:** Re-read that arc’s spec; check off version rows as PRs merge  
3. **Before 2.22.3:** All A–E specs `Status: Shipped through 2.22.2` or honest partial flags  
4. **Post-3.0:** Optionally flesh `product-bands/band-2.N.md` from roadmap themes  

---

## PR count summary

| Phase | Version range | PRs |
|-------|---------------|-----|
| Core product A–E | 2.12.2 → 2.22.2 | ~101 |
| Release checklist runway | 2.22.3 → 3.0.0 | 21 |
| **Grand total to 3.0.0** | **2.12.2 → 3.0.0** | **≈122** |
| Post-3.0 G themes | n/a | not required for major |

---

## Related

- [`goal-prompts.md`](./goal-prompts.md) — copy-paste `/goal` per version  
- [`VERSION-WORKFLOW.md`](./VERSION-WORKFLOW.md) — one bump per PR; major at 2.24.2→3.0.0  
- [`release-checklist-runway.md`](./release-checklist-runway.md) — 2.22.3+ only fixes  
