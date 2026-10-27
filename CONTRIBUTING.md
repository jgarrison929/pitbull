# Contributing to Pitbull Construction Solutions

Thanks for your interest in contributing to Pitbull! This guide will get you up and running.

**Live product is [`v5/`](v5/)** (Next.js + Drizzle). Agent rules: [`AGENTS.md`](AGENTS.md). Roadmap: [`docs/roadmap.md`](docs/roadmap.md). The `src/` monolith is frozen at `legacy-3.8.2-final`.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Architecture Overview](#architecture-overview)
- [Code Style and Standards](#code-style-and-standards)
- [Testing Requirements](#testing-requirements)
- [Submitting Issues](#submitting-issues)

---

## Getting Started

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 24+ (Active LTS) | Live app (`v5/`) |
| PostgreSQL | 17+ | Database |
| Git | Latest | Version control |
| GitHub CLI (`gh`) | Latest | PR workflow |
| .NET SDK | 10.0+ | **Legacy only** — frozen `src/` |

### Setup (live — v5)

1. **Clone the repo:**

   ```bash
   git clone https://github.com/jgarrison929/pitbull.git
   cd pitbull
   ```

2. **v5 app:**

   ```bash
   cd v5
   nvm use            # see .nvmrc
   npm ci
   # set DATABASE_URL to a Postgres URL
   npm run db:prepare
   npm run dev        # http://localhost:3000
   ```

   Full runbook: [`v5/README.md`](v5/README.md). Checks: `npm run lint && npm run typecheck && npm test && npm run build && npm run e2e`.

### Setup (legacy 3.8.2)

The 3.8.2 API and web were removed from this tree. Recover them from tag `legacy-3.8.2-final`. Do not `cd` into that tree on `main`.

---

## Releases and versioning

**Live (v5 / 5.0.x):** keep root **`VERSION`**, **`v5/package.json`**, and the newest entry in **`v5/src/content/changelog.ts`** aligned. Public versions are `5.<feature>.<increment>` — see [`docs/roadmap.md`](docs/roadmap.md) and [`AGENTS.md`](AGENTS.md).

**Deploy model:** merges to `main` deploy to Railway **staging**. Production deploys when a `vX.Y.Z` tag is promoted onto the `production` branch by `.github/workflows/release.yml`. See `deploy/RAILWAY-SETUP.md` (v5 caveats at the top).

**Builders do not enable auto-merge**; Verify/Watch owns merge after `ci-gate` PASS.

### Legacy release checklist (frozen 3.x line)

Root `CHANGELOG.md` and the .NET/web package stamps below describe the **legacy** ship process. Do not use them as the primary path for v5 increments.

1. Move items from `## [Unreleased]` in `CHANGELOG.md` into a new header with **date and time** of publish, e.g.  
   `## [2.3.0] - 2026-07-10T12:58:16-07:00`  
   (ISO-8601 with offset preferred; date-only `YYYY-MM-DD` still works for older entries)
2. Bump root `VERSION` and `v5/package.json` together (prefer `scripts/bump-version.ps1` / `scripts/stamp-version.ps1`)
3. Bump the `v5/package-lock.json` `pcs-v5` version fields to match
4. Add the matching entry at the top of `v5/src/content/changelog.ts`
5. Run local preflight: `./scripts/preflight.ps1` (optional `-FullWeb`). `-DotNet` fails: the legacy test projects were removed.
6. Merge the PR to `main`. Staging deploys after CI.
7. Tag and push to promote production when appropriate:
   ```bash
   git checkout main && git pull
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```
   The Release workflow checks that the tag matches root `VERSION`, the commit is on `main`, and CI succeeded, then fast-forwards `production`.
8. Confirm production health (`/health`, `/status` on v5; legacy also had `/api/version`)

**Rollback:** re-run the Release workflow (`workflow_dispatch`) with a previous tag and `force_rollback: true`, or redeploy a prior Railway deployment. Migrations are forward-only; prefer a forward fix when schema already advanced.

**In-app release notes (v5):** `v5/src/content/changelog.ts` (public `/changelog`). Root `CHANGELOG.md` remains the Keep a Changelog file for the legacy 3.x line.

---

## Development Workflow

### Branching Strategy

Feature work merges to `main`. Production is a separate release branch moved only by tagged promotes:

| Branch | Purpose | Deploys To |
|--------|---------|------------|
| `main` | Integration (sacred; PR-only) | Railway **staging** |
| `production` | Release pointer (tag-gated) | Railway **production** |

Feature branches are created from main and target main via PR. Never commit directly to `main` or `production`. Do not push to `production` by hand; use `git tag vX.Y.Z && git push origin vX.Y.Z` (or the Release workflow `workflow_dispatch` for rollback).

### Branch Naming

Use conventional prefixes:

- `feat/<short-name>` -- New features
- `fix/<short-name>` -- Bug fixes
- `docs/<short-name>` -- Documentation
- `test/<short-name>` -- Test additions
- `refactor/<short-name>` -- Code restructuring

### Workflow

Feature branches are created from `main` and merge via PR. The `production` branch is a release pointer only (see Branching Strategy).

1. **Create feature branch from main:**

   ```bash
   git checkout main
   git pull origin main
   git checkout -b feat/your-feature
   ```

2. **Do your work.** Commit early, commit often.

3. **Validate before pushing** (live product):

   ```bash
   cd v5
   npm run lint && npm run typecheck && npm test
   npm run build && npm run e2e
   ```

   Legacy `src/` builds are optional and only when that tree is intentionally touched.

4. **Push and open a PR:**

   ```bash
   git push -u origin feat/your-feature
   gh pr create --title "feat: your feature description" --base main  # or use GitHub UI
   ```

### Conventional Commits

All commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
feat: add bid-to-project conversion endpoint
fix: resolve FK constraint error on user registration
docs: add best practices guide
chore: update NuGet packages
refactor: extract validation pipeline behavior
test: add unit tests for project creation
```

**Rules:**
- One concern per commit. Don't mix a bug fix with a feature.
- Use the imperative mood: "add feature" not "added feature."
- Keep the subject line under 72 characters.

---

## Architecture Overview

### Modular Monolith

Pitbull is a **modular monolith** -- a single deployable unit with clear internal module boundaries.

```
src/
  Modules/
    Pitbull.Core/         # Shared kernel: DbContext, CQRS, multi-tenancy, base entities
    Pitbull.Projects/     # Project management domain
    Pitbull.Bids/         # Bid/estimating domain
  Pitbull.Api/            # ASP.NET Core host -- controllers, middleware, DI
  Pitbull.Web/            # Next.js frontend (App Router)
  Infrastructure/         # Cross-cutting infra (email, storage, etc.)
```

Each module owns its domain entities, features, EF configurations, and validators. The API project wires everything together but contains no business logic.

### CQRS (direct service injection, no MediatR in controllers)

Commands/queries separated via `ICommand`/`IQuery` + handlers, but controllers use direct service injection (post-MediatR removal).

- Handlers often return `Result<T>`
- Services registered via AddPitbullModule + AddPitbullModuleServices
- See docs/ARCHITECTURE.md and module code for current patterns. (MediatR was removed Feb 2026 per CHANGELOG.)

### Feature + Service Pattern

Some features use dedicated folders (e.g. Projects/Features/CreateProject/*Command.cs), but most modules use service interfaces + impls (e.g. IProjectService / ProjectService). Controllers inject services directly. No repositories. See actual code in Modules/ for patterns.

### Multi-Tenancy

Shared database, shared schema model with two enforcement layers:

1. **Application-level:** Middleware resolves tenant from JWT claims and stamps entities automatically
2. **Database-level:** PostgreSQL Row-Level Security (RLS) policies enforce data isolation

### Frontend

- **Next.js** with App Router
- **shadcn/ui** component library (copied into project, fully customizable)
- **Tailwind CSS** for styling
- Mobile-first responsive design

For deeper architecture details, see `docs/BEST-PRACTICES.md` and `docs/ADDING-A-MODULE.md`.

---

## Code Style and Standards

### Backend (.NET)

- **Result pattern:** Handlers return `Result<T>`, never throw for business logic failures
- **FluentValidation:** Create a validator class per command -- the pipeline runs them automatically
- **Entity configuration:** snake_case tables, enums as strings, explicit decimal precision
- **Queries:** Always use `.AsNoTracking()` for read operations
- **Controllers:** `[Authorize]` at the class level. Only `AuthController` is public.
- **Error codes:** Uppercase strings: `NOT_FOUND`, `VALIDATION_ERROR`, `INVALID_STATUS`
- **No repositories:** Inject `PitbullDbContext` directly, use `db.Set<T>()` (or module services)
- **Pass `CancellationToken`** through all async calls

### Frontend (TypeScript/React)

- **TypeScript** for all files -- no plain JS
- **Mobile-first:** Use responsive Tailwind classes (`sm:`, `md:`, `lg:`)
- **Minimum viewport:** 375px (iPhone SE), no horizontal scroll
- **Touch targets:** Minimum 44px for interactive elements
- **API client:** Use the `api()` wrapper from `src/lib/api.ts`, never raw `fetch`
- **Auth:** Use the `useAuth()` hook, never access tokens directly
- **Linting:** `npm run lint` must pass with zero warnings

### General

- Keep it simple. MVP first, refactor later.
- One concern per file, one concern per commit.
- If stuck for more than 10 minutes, ask for help.

---

## Testing Requirements

### Before Every PR

Both of these must pass from `v5/`:

```bash
npm run lint && npm run typecheck && npm test
npm run build
```

### CI Pipeline

GitHub Actions runs `.github/workflows/ci.yml` on push/PR to `main`. The required check is `ci-gate`. The v5 job (lint, typecheck, unit tests, build, Playwright smoke) runs on every push to `main` and on PRs that touch `v5/**` or that workflow.

Required jobs must pass before merge. Production promote also requires a successful CI run on the tagged commit (see `.github/workflows/release.yml`).

### MediatR community license

The 3.8.2 API that registered MediatR was removed with that tree (tag `legacy-3.8.2-final`). v5 does not use it.

### Writing Tests

- v5 unit tests live under `v5/` and run with `npm test` (Vitest). Playwright smoke is `npm run e2e`.
- The 3.8.2 xUnit projects were removed with that tree (tag `legacy-3.8.2-final`).

---

## Submitting Issues

### Bug Reports

Use `gh issue create` or the GitHub UI with the `bug` label. Include:

1. **Summary:** One-line description of the problem
2. **Steps to reproduce:** Numbered list, specific API calls or UI actions
3. **Expected behavior:** What should happen
4. **Actual behavior:** What actually happens (include error messages, status codes)
5. **Environment:** Browser, OS, API endpoint, relevant headers
6. **Severity:**
   - **P0** -- Production down, data loss
   - **P1** -- Major feature broken, no workaround
   - **P2** -- Feature broken, workaround exists
   - **P3** -- Minor issue, cosmetic

### Feature Requests

Use the `feature` label. Include:

1. **User story:** "As a [role], I want [feature] so that [benefit]"
2. **Acceptance criteria:** What "done" looks like
3. **Context:** Why this matters, any competitor references

### Labels

- `bug` -- Something is broken
- `feature` -- New functionality
- `docs` -- Documentation improvements
- `chore` -- Maintenance, dependencies, CI

---

## Questions?

Check the existing docs in `docs/` or open a discussion issue. When in doubt, ask.
