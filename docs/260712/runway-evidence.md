# 3.0.0 runway evidence log

**Started:** 2.22.3 (product closed at 2.22.2)  
**Rules:** verification and fixes only — no new product features.

## Checklist snapshot (opened 2.22.3)

| # | Item | Status at open | Evidence path |
|---|------|----------------|---------------|
| 1 | Mobile3 Phases 1–3 + E2E | Specs Shipped 2.13.2–2.15.2; E2E present | `docs/specs/mobile-phase*.md`, `e2e/tests/mobile-field-report.spec.ts` |
| 2 | Twin Phase 2 | Shipped 2.19.2 | `docs/specs/digital-twin-phase2-implementation.md`, `docs/ci/twin-phase2-notes.md` |
| 3 | Help field + PM + executive | Field 2.12.8; approvals 2.21.9; office 2.22.2 | `help/page.tsx`, help-* libs |
| 4 | Arc A–E specs Status Shipped | See §4 audit | `docs/260712/spec-workload.md` + `docs/specs/*` |
| 5 | CI mobile + owner smoke | Jobs live; optional required | `docs/ci/mobile-owner-smoke-notes.md` |
| 6 | Perf: paginated lists, no phone ledger | Policy in AGENTS; list virtualization present | `list-virtualization.ts`, mobile3 docs |
| 7 | Truth rules | AGENTS + twin §7; KPI proxies labeled | ROLE-EXPERIENCE, AI-TRUST-BOUNDARY |

### P0 regressions from 2.22.2 (2.22.3)

- Preflight FullWeb+DotNet green on 2.22.2 ship (#373).
- No P0 code defects found at runway open.
- Residual risk: mobile/owner E2E remain `continue-on-error` (documented).

---

## §1 Mobile E2E + spec sign-off (2.22.4)

| Spec | Status | E2E / notes |
|------|--------|-------------|
| mobile-phase1-field-hardening | Shipped 2.13.2 | Phase 1 field capture paths |
| mobile-phase2-plans-viewer | Shipped 2.14.2 | Plans viewer mobile |
| mobile-phase3-site-walk-schedule | Shipped 2.15.2 | Site walk + schedule |
| mobile-field-report E2E | In CI `mobile-smoke` | `e2e/tests/mobile-field-report.spec.ts` |
| ROLE map | `e2e/fixtures/ROLE-PERSONA-MAP.md` | Demo personas |

**Sign-off:** Mobile3 band complete for 3.0.0 acceptance subject to CI optional risk above.

---

## §2 Twin Phase 2 (2.22.5)

| Check | Result |
|-------|--------|
| Spec Status | Shipped through 2.19.2 |
| Feature flags / honest empty | Twin overlays never default all-green (help twin truth legend) |
| Demo skip spatial | `is_demo_user` skip when RequireSpatial (prior band) |
| CI notes | `docs/ci/twin-phase2-notes.md` |

**Copy audit:** Help twin truth legend + zone picker twin sections present; no "all clear" default green language found in help twin modules.

---

## §3 Help walkthrough personas (2.22.6)

| Persona | Help section | Live |
|---------|--------------|------|
| Field / Super | Field workflows + zone/twin | yes |
| PM | Approvals workflow | yes |
| CEO / CFO / Estimator | Office workflows | yes |
| All | FAQ: mobile, approvals, office roles | yes |

Walkthrough: open `/help` as each demo role — cards deep-link to real routes.

---

## §4 Spec-workload audit (2.22.7)

| Spec file | Status line |
|-----------|-------------|
| mobile-phase1–3 | Shipped 2.13.2–2.15.2 |
| digital-twin-phase2-implementation | Shipped 2.19.2 |
| mobile-ai-intelligence | Shipped 2.21.2 |
| workflow-approvals-phase2 | Shipped 2.22.0 |
| role-kpi-drill-contracts | Shipped 2.22.2 |
| help-center-office-workflows | Shipped 2.22.2 |
| help-center-field-workflows | Complete 2.12.7–8 |
| ci-mobile-owner-smoke | Shipped 2.22.2 (optional required) |

Arc A–E product specs closed. Historical owner signup specs marked out-of-ladder.

---

## §5 CI jobs (2.22.8)

Documented in `docs/ci/mobile-owner-smoke-notes.md` + `workflow-approvals-phase2-notes.md`.  
Jobs: `mobile-smoke`, `owner-signup-smoke` with continue-on-error; role smoke + unit/web required via main pipeline.

---

## §6 Perf spot-check (2.22.9)

| Check | Result |
|-------|--------|
| List virtualization helper | `list-virtualization.ts` + tests |
| Mobile DTO / view=mobile pattern | Documented AGENTS; used on field lists |
| No client portfolio aggregation on phone | Field dashboard is capture+glance (audit 2.22.1) |
| Bundle | next build preflight green each runway ship |

---

## §7 Truth rules (2.23.0)

| Rule | Verified |
|------|----------|
| No fake executive KPIs | role-kpi contracts + labels |
| AR−AP net labeled proxy | office help + ROLE-EXPERIENCE |
| Twin empty ≠ all-clear | help twin truth |
| AI confirm-to-apply | AI-TRUST-BOUNDARY / prior band |
| Demo restrictions | DemoRestrictionMiddleware |

---

## Buffer / later runway

| Version | Notes |
|---------|-------|
| 2.23.1–2.23.3 | Buffer — no open P0/P1 at open unless discovered |
| 2.23.4 | Demo seed parity — personas in ROLE-PERSONA-MAP |
| 2.23.5 | Role E2E local notes |
| 2.23.6 | CHANGELOG 3.0.0 narrative draft |
| 2.23.7 | ARCHITECTURE / ROLE-EXPERIENCE drift |
| 2.23.8–2.23.9 | Remaining P1 |
| 2.24.0 | Full preflight + deploy smoke notes |
| 2.24.1 | Final buffer |
| 2.24.2 | RC — all checklist boxes checked |
| 3.0.0 | Major stamp |

### Checklist close-out (update at 2.24.2)

- [x] §1 Mobile3  
- [x] §2 Twin Phase 2  
- [x] §3 Help  
- [x] §4 Specs  
- [x] §5 CI documented  
- [x] §6 Perf  
- [x] §7 Truth  

## Ship stamp 2.22.4
Section 1 Mobile E2E + specs confirmed. CI mobile-smoke present (optional required).


## Ship stamp 2.22.5
Section 2 Twin Phase 2 + help twin truth copy audited.


## Ship stamp 2.22.6
Section 3 Help field + approvals + office personas verified on /help.


## Ship stamp 2.22.7
Section 4 Spec index audit complete (product specs Shipped).


## Ship stamp 2.22.8
Section 5 CI jobs green-or-documented (continue-on-error risk accepted).


## Ship stamp 2.22.9
Section 6 Perf spot-check: list virtualization + field capture-only policy.


## Ship stamp 2.23.0
Section 7 Truth rules: KPI proxies, twin empty, AI trust boundary reviewed.


## Ship stamp 2.23.1
Buffer: no P0/P1 fixes required; preflight green.


## Ship stamp 2.23.2
Buffer: clean.


## Ship stamp 2.23.3
Buffer: clean.


## Ship stamp 2.23.4
Demo seed: ROLE-PERSONA-MAP + demo-role-login keys aligned (ceo/cfo/pm/superintendent/estimator).


## Ship stamp 2.23.5
Role E2E: L4 role smoke in CI; local full pass via preflight + documented e2e projects.


## Ship stamp 2.23.6
### 3.0.0 CHANGELOG narrative draft

Major 3.0.0 summarizes Arc A-E product bands (mobile3, digital twin Phase 2, field AI intelligence with confirm-to-apply, workflow approvals Phase 2 time-entry mobile lifecycle, KPI drill contracts + office help) plus runway verification to release candidate.


## Ship stamp 2.23.7
ARCHITECTURE.md + ROLE-EXPERIENCE.md still match stack (.NET 10, Next 16, title-first roles). No material drift requiring code fix.


## Ship stamp 2.23.8
P1 buffer: none open.


## Ship stamp 2.23.9
P1 buffer: none open.


## Ship stamp 2.24.0
Full preflight FullWeb+DotNet PASS. Deploy: Railway live per deploy docs; demo smoke = health + login personas post-deploy (ops).


## Ship stamp 2.24.1
Final buffer: clean.


## Ship stamp 2.24.2 - RELEASE CANDIDATE
All checklist sections 1-7 evidence recorded. Ready for major 3.0.0.


## Ship stamp 3.0.0 - MAJOR
Prerequisite main was 2.24.2 RC. Major VERSION stamp 3.0.0.

