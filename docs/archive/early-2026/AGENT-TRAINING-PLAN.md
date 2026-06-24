# Agent Training Plan — Pre-Roadmap Sprint

**Goal:** Cut dispatch-to-merge cycle from ~45 min to ~15 min per feature.

---

## Problem: Every Agent Starts Cold

Today, each prompt includes:
- Architecture overview (modular monolith, CQRS, multi-tenant)
- File location conventions (entities, configs, services, controllers, tests, frontend pages)
- EF migration rules (never delete, check for duplicates)
- Service registration pattern (interface + impl, assembly scanning)
- Controller pattern (authorize, rate limit, company context, error helpers)
- Test pattern (mock services, test CRUD + validation + auth + not-found)
- Frontend pattern (api<T>(), shadcn/ui, Tailwind, nav-items.ts, command-palette)
- What NOT to do (don't modify existing migrations, don't touch other modules)

This is 80-100 lines repeated in every prompt. Multiply by 40 features = wasted tokens and time.

---

## Solution 1: CLAUDE.md — Persistent Agent Instructions

Claude Code reads `.claude/CLAUDE.md` at session start. We already have `.claude/settings.local.json` — need to create a comprehensive CLAUDE.md that covers ALL recurring context.

### Contents:
```
# CLAUDE.md — Pitbull Construction Solutions

## Architecture
- .NET 9 modular monolith, CQRS, PostgreSQL 17
- Multi-tenant (TenantId) + multi-company (CompanyId) with RLS
- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui

## File Conventions
- Entities: src/Modules/Pitbull.{Module}/Entities/
- EF Configs: src/Pitbull.Api/Data/Configurations/
- Services: src/Modules/Pitbull.{Module}/Features/{Feature}/
- Controllers: src/Pitbull.Api/Controllers/
- Migrations: src/Pitbull.Api/Migrations/ (NEVER delete, append-only)
- Tests: tests/Pitbull.Tests.Unit/Api/{Controller}Tests.cs
- Frontend pages: src/Pitbull.Web/pitbull-web/src/app/(dashboard)/
- Nav: src/Pitbull.Web/pitbull-web/src/components/layout/nav-items.ts
- Command palette: src/Pitbull.Web/pitbull-web/src/components/command-palette.tsx

## Entity Pattern
- All inherit BaseEntity (Id, TenantId, CreatedAt, UpdatedAt, IsDeleted, CreatedBy, UpdatedBy)
- Company-scoped entities implement ICompanyScoped (CompanyId property)
- Snake_case table names in EF configuration
- Soft delete: filter !IsDeleted on all queries

## Service Pattern
- Interface + implementation in Features/{Feature}/ directory
- Constructor injection: PitbullDbContext, ITenantContext, ICompanyContext, ILogger
- Registered via assembly scanning (AddPitbullModuleServices<T>)

## Controller Pattern
- [ApiController], [Route("api/[controller]")], [Authorize], [EnableRateLimiting("api")]
- Role-based: [Authorize(Roles = "Admin,Manager")]
- Error helpers: this.BadRequestError(), this.NotFoundError(), this.UnauthorizedError()
- Company context: ICompanyContext (injected, validates IsResolved)
- Always return IActionResult

## Test Pattern
- xUnit + Moq
- Mock all service dependencies
- Test: success, not-found (returns 404), validation (returns 400), auth (returns 401/403)
- Test field passthrough (verify service receives correct values)
- CreateValidRequest() helper pattern for test data

## Frontend Pattern
- api<T>() from src/lib/api.ts for all API calls
- shadcn/ui components (Button, Input, Label, Select, Dialog, Table, Badge, Card)
- lucide-react for icons
- toast from sonner for notifications
- Loading states with Skeleton components
- Empty states with descriptive messages
- Responsive: mobile-first with Tailwind breakpoints

## Migration Rules
1. NEVER delete, squash, or modify existing migration files
2. ONE migration per feature branch
3. Check for duplicate CreateTable against recent migrations
4. Designer.cs is REQUIRED (EF won't recognize migration without it)
5. If wrong, create corrective migration — don't edit original

## Branch Rules
- Create feature/branch-name from main
- Single commit with conventional commit message
- Push branch, do NOT merge to main
- Build validation: dotnet build + dotnet test + npm run build + npm run lint

## What NOT To Do
- Don't modify other modules' files unless explicitly asked
- Don't add NuGet packages without asking
- Don't change global Program.cs config unless the feature requires it
- Don't create frontend files outside the (dashboard) route group
```

### Impact: Eliminates ~60% of prompt boilerplate. Agent knows conventions before I say a word.

---

## Solution 2: Codex Instructions File

Codex CLI reads `AGENTS.md` or a `.codex/` directory for instructions. Create equivalent persistent context.

---

## Solution 3: Worktrees (Eliminate Branch Conflicts)

Today's #1 time waste: agents on shared checkout stepping on each other.

```bash
# Create dedicated worktrees
git worktree add /mnt/c/pitbull-claude main    # Claude Code's workspace
git worktree add /mnt/c/pitbull-codex main     # Codex's workspace
```

Each agent works in its own directory. No dirty tree issues. No branch confusion. No cherry-pick surgery.

**One-time setup, permanent fix.**

---

## Solution 4: Feature Template Generator

Script that scaffolds a complete feature skeleton:

```bash
./scripts/scaffold-feature.sh "PunchList" "Construction" --entities "PunchListItem,PunchListCategory" --pages "punch-list,punch-list/[id]"
```

Generates:
- Entity files with BaseEntity + ICompanyScoped
- EF configuration with snake_case
- Service interface + stub implementation
- Controller with standard CRUD endpoints
- Unit test file with test structure
- Frontend page stubs with standard patterns
- Nav-items.ts entry
- Command palette entry

Agent then fills in business logic instead of writing boilerplate. Cuts implementation time per feature by ~40%.

---

## Solution 5: Pre-Built Prompt Library

For the 40-item roadmap, pre-write prompt templates for common feature types:

### Type A: "New Module" (e.g., Punch List, Bank Reconciliation)
Full entity→service→controller→test→frontend→migration pipeline.

### Type B: "Dashboard/Report" (e.g., AP/AR Aging, Role Dashboards)
Read-only aggregation, no new entities, frontend-heavy.

### Type C: "Enhancement" (e.g., Workflow Indicators, Feedback Widget)
Modify existing pages, no new entities or migrations.

### Type D: "Infrastructure" (e.g., Redis, Caching, RBAC)
Backend-only, cross-cutting concerns.

### Type E: "PDF/Export" (e.g., WIP PDF, Certified Payroll WH-347)
Backend generation + download endpoint + frontend button.

Store at: `docs/prompts/TYPE-{A,B,C,D,E}-TEMPLATE.md`

---

## Solution 6: Parallel Worktree Pipeline

With worktrees + CLAUDE.md + templates, the pipeline becomes:

```
River writes 5-line prompt → Agent reads CLAUDE.md → Scaffold template → Agent fills business logic → Auto-validate → Push branch → Next
```

Instead of:

```
River writes 80-line prompt → Agent explores codebase (5 min) → Agent asks clarifying questions → Agent builds → River reviews → Agent fixes → Push
```

**Target:** 4-6 features per hour instead of 2.

---

## Execution Plan

| Step | What | Time | Who |
|------|------|------|-----|
| 1 | Create .claude/CLAUDE.md | 15 min | River (direct, it's a doc) |
| 2 | Create Codex instructions | 15 min | River |
| 3 | Set up worktrees | 5 min | River |
| 4 | Build scaffold script | 30 min | Sub-agent |
| 5 | Write 5 prompt templates | 30 min | River |
| 6 | Test with first Sprint 1 feature | 15 min | Validate pipeline |

**Total: ~2 hours to set up. Pays for itself in the first sprint.**

---

*Created Feb 19, 2026. Execute before Sprint 1 begins.*
