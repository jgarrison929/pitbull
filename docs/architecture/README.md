# Architecture design notes (`docs/architecture/`)

Early module design notes from initial implementation. Prefer **`docs/ARCHITECTURE.md`** and **`src/Modules/*`** for current architecture.

| File | Role |
|------|------|
| `AI-ARCHITECTURE-REQUIREMENTS.md` | AI provider / capability requirements |
| `COST-CODE-DESIGN.md` | Cost code foundation design |
| `TIME-TRACKING-DESIGN.md` | Time tracking module design |

## Living docs

| Doc | Use when |
|-----|----------|
| [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) | Stack, modules, tenancy, services-first patterns |
| [`docs/ROLE-EXPERIENCE.md`](../ROLE-EXPERIENCE.md) | Role home UX, role-summary, KPI drills |
| [`docs/BEST-PRACTICES.md`](../BEST-PRACTICES.md) | Coding conventions |
| root [`CHANGELOG.md`](../../CHANGELOG.md) | What shipped |
| `src/Modules/*` | Domain models and APIs |

## When to edit files here

- Update `docs/ARCHITECTURE.md` when module boundaries, tenancy, or host stack change  
- Add a note here only for a **net-new subsystem** not yet in `src/`  
- Treat design notes as background; verify APIs against controllers and EF entities  
