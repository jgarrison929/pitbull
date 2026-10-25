# Product specs (`docs/specs/`)

**Status:** Template + **legacy** 3.x specs (archive).  
**Live product arc:** Pitbull **v5 / 5.0.x** — see [`docs/roadmap.md`](../roadmap.md) and increment specs under [`docs/v5/specs/`](../v5/specs/).  
**Do not** treat PM next-gen 3.4→4.0 or the 3.0.0 program as live work.

| Era | Where |
|-----|--------|
| **Live (v5)** | [`docs/v5/specs/`](../v5/specs/) · index [`docs/v5/specs/README.md`](../v5/specs/README.md) |
| Legacy feature specs (this folder) | Shipped or abandoned with frozen `src/` @ `legacy-3.8.2-final` |
| Legacy band specs | [`product-bands/`](./product-bands/) — archive |
| Historical 3.0 workload | [`docs/260712/spec-workload.md`](../260712/spec-workload.md) |

## When to write a spec

| Change | Spec required |
|--------|---------------|
| New **v5** user-facing increment | Yes — under `docs/v5/specs/` before (or with) code |
| Bug fix / hardening in existing v5 feature | Reference existing v5 spec § or addendum |
| Touch frozen `src/` only | Prefer not; if unavoidable, do not invent a live product band |

## Spec header (legacy template — still useful)

```markdown
# Spec: {Title}

**Status:** Pending | In progress | Shipped through {version} | Archive
**Version band:** {e.g. 5.0.3 or historical 2.12.2 → 2.13.2}
**Related:** {docs, paths under v5/ or historical modules}
```

For **v5** increments, follow the conventions in [`docs/v5/specs/README.md`](../v5/specs/README.md) (file name `5.<feature>.<n>-<slug>.md`, acceptance checks Pitbull Verify can run on staging).

## Sections (agent-ready — still the bar)

1. **Problem** — what hurts today  
2. **Personas** — who is affected (v5: executive / pm / superintendent / foreman)  
3. **User journey** — numbered steps  
4. **Primary code touchpoints** — concrete paths under `v5/` (legacy: `src/`, `e2e/`, `tests/`)  
5. **API / server touchpoints** — routes, actions, DTOs (or “UI-only”)  
6. **Version table** — one row per PR with deliverable, files, acceptance checkboxes, tests  
7. **Non-goals**  
8. **Test plan** — unit, e2e, verify-v5 checks  
9. **Truth rules** — proxies labeled; no invented KPIs  
10. **Band / increment DoD** — checkpoint acceptance  

## Status lifecycle

- `Pending` — spec written, no PRs merged  
- `In progress` — partially shipped  
- `Shipped through X.Y.Z` — complete; link changelog / roadmap evidence  
- `Archive` — frozen with legacy 3.x; not a live build queue  

## Historical 3.0.0 product specs (Arc A–E) — archive

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

## Post-3.0 / PM next-gen product bands — archive

See [`product-bands/README.md`](./product-bands/README.md). Those bands targeted the frozen 3.8.2 app. Live schedule/CPM work for v5 lives under [`docs/v5/specs/`](../v5/specs/) and [`docs/roadmap.md`](../roadmap.md).
