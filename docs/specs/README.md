# Product specs (`docs/specs/`)

**Status:** Living template — ship stamp with 2.12.2  
**Active product arc:** PM next-gen **3.4 → 4.0.0** — [`docs/roadmap/pm-nextgen-3.4-to-4.0.md`](../roadmap/pm-nextgen-3.4-to-4.0.md) · [`docs/340-pm-arc/`](../340-pm-arc/)  
**Historical 3.0 workload:** [`docs/260712/spec-workload.md`](../260712/spec-workload.md)  
**Version rules (PM arc):** [`docs/340-pm-arc/VERSION-WORKFLOW.md`](../340-pm-arc/VERSION-WORKFLOW.md) · historical [`docs/260712/VERSION-WORKFLOW.md`](../260712/VERSION-WORKFLOW.md)

## When to write a spec

| Change | Spec required |
|--------|---------------|
| New user-facing feature | Yes — before code |
| Bugfix / hardening in existing feature | Reference existing spec § or addendum |
| Release runway 2.22.3+ | No new product specs — checklist only |
| Post-3.0 product bands | Optional; does not block 3.0.0 |

## Spec header (required)

```markdown
# Spec: {Title}

**Status:** Pending | In progress | Shipped through {version}
**Version band:** {e.g. 2.12.2 → 2.13.2}
**Related:** {docs, modules}
```

## Sections (required for agent-ready)

1. **Problem** — what hurts today  
2. **Personas** — who is affected  
3. **User journey** — numbered steps  
4. **Primary code touchpoints** — concrete paths under `src/`, `e2e/`, `tests/`  
5. **API touchpoints** — routes, DTOs, permissions (or “UI-only”)  
6. **Version table** — one row per PR with deliverable, files, acceptance checkboxes, tests  
7. **Non-goals**  
8. **Test plan** — unit, integration, E2E commands  
9. **Help center** — what to add to `help/page.tsx`  
10. **Truth rules** — proxies labeled; no invented KPIs  
11. **Band DoD** — checkpoint version acceptance  

## Agent-ready checklist (per version row)

A `/goal` may start only when the target version row has:

- [ ] One-sentence deliverable  
- [ ] File list (existing or “create: path”)  
- [ ] Acceptance `- [ ]` items an agent can verify  
- [ ] Named tests or explicit “manual only”  
- [ ] Out-of-scope note if scope could sprawl  

## Status lifecycle

- `Pending` — spec written, no PRs merged  
- `In progress` — band partially shipped  
- `Shipped through X.Y.Z` — band complete; link CHANGELOG entries  
- `Post-3.0.0` — not required for major  

## 3.0.0 product specs (Arc A–E)

| Spec | Band |
|------|------|
| [mobile-phase1-field-hardening.md](./mobile-phase1-field-hardening.md) | A |
| [help-center-field-workflows.md](./help-center-field-workflows.md) | A subset |
| [mobile-phase2-plans-viewer.md](./mobile-phase2-plans-viewer.md) | B |
| [mobile-phase3-site-walk-schedule.md](./mobile-phase3-site-walk-schedule.md) | C |
| [digital-twin-phase2-implementation.md](./digital-twin-phase2-implementation.md) | D |
| [mobile-ai-intelligence.md](./mobile-ai-intelligence.md) | E |
| [workflow-approvals-phase2.md](./workflow-approvals-phase2.md) | E |
| [role-kpi-drill-contracts.md](./role-kpi-drill-contracts.md) | E |
| [help-center-office-workflows.md](./help-center-office-workflows.md) | E |
| [ci-mobile-owner-smoke.md](./ci-mobile-owner-smoke.md) | E |

## Historical (shipped; out of 2.12→3.0 ladder)

- [owner-self-service-signup.md](./owner-self-service-signup.md)  
- [owner-post-signup-onboarding.md](./owner-post-signup-onboarding.md)  

## Post-3.0 product bands

See [`product-bands/README.md`](./product-bands/README.md).

**PM next-gen (live ladder):** [`docs/roadmap/pm-nextgen-3.4-to-4.0.md`](../roadmap/pm-nextgen-3.4-to-4.0.md) — first agent-ready band [`product-bands/band-3.5-pm-rfi-submittal-mobile.md`](./product-bands/band-3.5-pm-rfi-submittal-mobile.md) (next stamp **`3.4.1`**).

Older theme parking lot: [`docs/roadmap/post-3.0-product-bands.md`](../roadmap/post-3.0-product-bands.md).