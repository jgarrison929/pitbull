# Architecture design notes (`docs/architecture/`)

> **Archive — not live.** These notes describe the frozen legacy monolith under `src/`. The live product is **`v5/`** — see [`docs/v5/fresh-start-plan.md`](../v5/fresh-start-plan.md) and root [`AGENTS.md`](../../AGENTS.md).

Early module design notes from initial implementation. Prefer **`docs/ARCHITECTURE.md`** (legacy living doc) and **`src/Modules/*`** only when intentionally working in the frozen app.

| File | Role |
|------|------|
| `AI-ARCHITECTURE-REQUIREMENTS.md` | AI provider / capability requirements |
| `COST-CODE-DESIGN.md` | Cost code foundation design |
| `TIME-TRACKING-DESIGN.md` | Time tracking module design |

## Related docs

| Doc | Use when |
|-----|----------|
| [`docs/roadmap.md`](../roadmap.md) / [`docs/v5/`](../v5/) | **Live** product orientation |
| [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) | Legacy stack, modules, tenancy, services-first patterns |
| [`docs/ROLE-EXPERIENCE.md`](../ROLE-EXPERIENCE.md) | Legacy role home UX (v5 uses four role cards) |
| root [`CHANGELOG.md`](../../CHANGELOG.md) | Legacy 3.x shipped notes |
| `v5/src/content/changelog.ts` | Live in-app changelog |
| `src/Modules/*` | Frozen domain models |

## When to edit files here

- Prefer not — these are frozen design notes  
- For live architecture changes, document under `docs/v5/` or update agent entrypoints  
- Treat notes here as background; verify against `v5/` source for product work  
