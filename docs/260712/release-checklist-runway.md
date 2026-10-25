# 3.0.0 release checklist runway (2.22.3 → 3.0.0)

**Product workload ends at `2.22.2`.** No new features after that — only verification, fixes, and the major stamp.

**Plain language:** This band is the **final QA and fix window** before version `3.0.0`. Each PR still bumps one version step.

---

## PR budget

| Segment | PRs |
|---------|-----|
| `2.22.3` → `2.22.9` | 7 |
| `2.22.9` → `2.23.0` | 1 |
| `2.23.0` → `2.23.9` | 10 |
| `2.23.9` → `2.24.0` | 1 |
| `2.24.0` → `2.24.2` | 3 |
| `2.24.2` → `3.0.0` | 1 |
| **Total runway** | **21** (from `2.22.2` on main) |

*(From `2.22.2`: next is `2.22.3` … through `2.24.2` then major `3.0.0`.)*

---

## 3.0.0 release checklist (verify during runway)

**Status:** All items verified at 2.24.2 RC; major **3.0.0** stamped. See `runway-evidence.md`.

Copy from [`plan1.md`](./plan1.md); each item should be **checked** before `3.0.0` merges.

1. Mobile3 Phases 1–3 acceptance per specs + E2E evidence  
2. Twin Phase 2 core shipped or feature-flagged with honest CHANGELOG  
3. Help center covers field + PM + executive workflows  
4. Every shipped Arc A–E feature has `docs/specs/*` with `Status: Shipped through 2.22.2`  
5. CI runs mobile + owner-signup smoke  
6. Performance: paginated mobile lists, batched summaries, no client ledger aggregation on phone  
7. Truth rules intact ([`AGENTS.md`](../../AGENTS.md), twin spec §7)

---

## Suggested runway allocation

| Version | Focus |
|---------|--------|
| 2.22.3 | Runway opens — snapshot checklist; fix any P0 regressions from 2.22.2 |
| 2.22.4 | Checklist §1 — mobile E2E + spec sign-off evidence |
| 2.22.5 | Checklist §2 — twin Phase 2 flags + copy audit |
| 2.22.6 | Checklist §3 — help center walkthrough all personas |
| 2.22.7 | Checklist §4 — spec index audit (`spec-workload.md` all Shipped) |
| 2.22.8 | Checklist §5 — CI jobs green; add missing smoke if needed |
| 2.22.9 | Checklist §6 — perf spot-check (payload size, virtualization) |
| 2.23.0 | Checklist §7 — truth rules review (KPI labels, twin overlays) |
| 2.23.1 | Buffer fixes from audit |
| 2.23.2 | Buffer fixes |
| 2.23.3 | Buffer fixes |
| 2.23.4 | Demo seed parity spot-check |
| 2.23.5 | Role E2E local full pass notes |
| 2.23.6 | CHANGELOG narrative draft for 3.0.0 |
| 2.23.7 | Docs: ARCHITECTURE / ROLE-EXPERIENCE drift check |
| 2.23.8 | Remaining P1 fixes only |
| 2.23.9 | Remaining P1 fixes only |
| 2.24.0 | `preflight.ps1 -FullWeb -DotNet` + deploy smoke on demo |
| 2.24.1 | Final fix buffer |
| 2.24.2 | **Release candidate** — all checklist boxes checked |
| **3.0.0** | Major merge — VERSION 3.0.0; CHANGELOG major section |

---

## /goal prompt (runway template)

```text
/goal Ship Pitbull {NEXT_VERSION}: 3.0.0 release checklist runway.

Read: docs/260712/release-checklist-runway.md, docs/260712/plan1.md §3.0.0 release checklist.

Scope: ONLY fixes and verification for the row assigned to {NEXT_VERSION}. No new features.
Bump {CURRENT} → {NEXT} + CHANGELOG.
Exit: preflight green; single PR.
```

Major goal (after 2.24.2):

```text
/goal Ship Pitbull 3.0.0: major release.

Prerequisite: main at 2.24.2; all items in release-checklist-runway.md checked.
Bump 2.24.2 → 3.0.0; CHANGELOG major section.
Exit: full preflight; single PR.
```

Filled per-version blocks: [`goal-prompts.md`](./goal-prompts.md) §Runway.
