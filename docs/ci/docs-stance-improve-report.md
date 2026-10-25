# Docs stance improve report

**Date:** 2026-08-06  
**Workflow:** docs-stance-improve (auditor inventory + writer rounds r1–r3)  
**Scope:** agent-facing PM next-gen status only — no VERSION bump, no application code

---

## Baseline (VERSION + next free stamp hint)

| Fact | Value |
|------|--------|
| Root `VERSION` | **`3.7.7`** |
| Next free stamp | **`3.7.8`** |
| Active band | `band-3.8-pm-cpm-practices.md` (**Partial**) |
| Band 3.8 shipped CPM | `3.7.1`–`3.7.5` |
| Diverted (spent; never reclaim) | `3.7.6` dep-audit; `3.7.7` WIP BilledToDate |
| Free remaining in band 3.8 | **`3.7.8`–`3.8.0`** (remapped CPM remainder) |
| Bands 3.5–3.7 | **Shipped** archive |

Truth sources for next work: root `VERSION` → newest `CHANGELOG.md` headers → active band file Status/rows → epic header.

---

## Closed this run

Writer rounds aligned hubs and satellites so agents no longer target **3.4.6** / **3.4.1** as “next”:

| Area | Was (auditor) | Now (verified) |
|------|---------------|----------------|
| Epic `pm-nextgen-3.4-to-4.0.md` | Pending; next 3.4.6; stubs 3.6–3.8 Pending | In progress @ 3.7.7; next free 3.7.8; 3.5–3.7 Shipped; 3.8 Partial |
| `product-bands/README.md` | 3.5 Pending; 3.6–3.8 stub; next 3.4.6 | 3.5–3.7 Shipped; 3.8 Partial; next free 3.7.8 |
| `band-3.8-pm-cpm-practices.md` | 3.7.6–3.8.0 remaining CPM | 3.7.6/3.7.7 Diverted; free **3.7.8–3.8.0** remapped |
| `340-pm-arc/VERSION-WORKFLOW.md` | Next stamp after 3.7.5 → 3.7.6 | Current 3.7.7 → next free 3.7.8 |
| `340-pm-arc/goal-prompts.md` | Opens at 3.4.1 only | Banner + live goals 3.7.8+; archive below |
| `AGENTS.md` | Version-ship → 260712; live row at band-3.5/3.4.1 | Ship → `340-pm-arc/*`; active band-3.8; next 3.7.8; 260712 historical only |
| `specs/README.md` | PM ladder next 3.4.1; template 2.12.2 | Active band-3.8; 3.7.7→3.7.8; template VERSION-neutral |
| `pm-3.8-cpm-notes.md` | 3.7.6+ remaining | Diverted + free 3.7.8–3.8.0 |
| `340-pm-arc/README.md` | Pending; First band 3.5 only | In progress; Active band 3.8 |
| `band-3.5` + `pm-3.5` CI notes | Unchecked DoD; “when shipped” | Shipped archive; DoD/deploy checked |

Cleanup plan Round-3 residual note marked closed. No product feature invent.

---

## Residual drift (still wrong)

**No open high-severity wrong-next-stamp claims** found on re-read of hubs above.

Maintain hygiene only (not wrong product truth):

1. **Acceptance checkboxes** in `docs/roadmap/docs-stance-and-quality-cleanup-plan.md` §2.4 still `- [ ]` though content is aligned — check them on the docs PR or leave as process debt.
2. **Historical ladder text** still correctly lists band starts (`3.4.1`, etc.) and archive `/goal` blocks under the banner — agents must use the **live** section only; re-education if someone skips the banner.
3. **After next stamp (`3.7.8+`):** re-run this workflow or one-line hub bumps (epic, product-bands README, VERSION-WORKFLOW, goal-prompts banner, AGENTS live row) so hubs do not lag again.

Do not treat plan caution text (“do not trust next 3.4.6”) as residual wrongness — it is intentional anti-pattern copy.

---

## Standing rules (truth hierarchy for agents)

1. **Root `VERSION`** beats any doc “next unshipped” line.  
2. **`CHANGELOG.md` published headers** beat band row intent for spent stamps (diverted stamps stay spent).  
3. **Active band file Status + row checkmarks** beat epic/README summary if they disagree — then fix the summary.  
4. **Live arc paths:** `docs/340-pm-arc/VERSION-WORKFLOW.md` + `goal-prompts.md` + `band-3.8-*` for ships; `docs/260712/*` is **complete 3.0 archive only**.  
5. **Never reclaim** published stamps (`3.7.6`, `3.7.7`) for other intents.  
6. Prefer **truth over polish**: Partial / Diverted / InsufficientData over fake green “all clear.”  
7. Docs-only honesty PRs need **no VERSION** stamp unless product code ships.

---

## Suggested next human/agent actions (docs only, no feature invent)

1. Open a **docs chore PR** with r1–r3 hub/satellite edits + this report (no VERSION).  
2. Optionally tick cleanup plan §2.4 acceptance boxes and append a plan changelog row.  
3. For product work: copy **Goal → 3.7.8** from live `goal-prompts.md` only after re-reading `VERSION`.  
4. On every VERSION PR: one-line “next free” refresh on epic + product-bands README + arc README/banner (or re-run `docs-stance-improve`).  
5. Do **not** reopen `docs/260712/*` as the live ladder.

---

*Report only. Product remains `3.7.7` until a deliberate ship to `3.7.8`.*
