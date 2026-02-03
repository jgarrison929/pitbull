# Contributing to Pitbull Construction Solutions

Thanks for your interest in contributing to Pitbull! This guide will get you up and running.

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
| .NET SDK | 9.0+ | Backend API |
| Node.js | 22+ | Frontend build |
| PostgreSQL | 17+ | Database |
| Git | Latest | Version control |
| GitHub CLI (`gh`) | Latest | PR workflow |

### Setup

1. **Clone the repo:**

   ```bash
   git clone https://github.com/jgarrison929/pitbull.git
   cd pitbull
   ```

2. **Backend setup:**

   ```bash
   cd src/Pitbull.Api
   dotnet restore
   ```

   Configure your local PostgreSQL connection in `src/Pitbull.Api/appsettings.Development.json`:

   ```json
   {
     "ConnectionStrings": {
       "PitbullDb": "Host=localhost;Database=pitbull_dev;Username=postgres;Password=your_password"
     }
   }
   ```

   Run the API (migrations auto-apply on startup):

   ```bash
   dotnet run
   ```

3. **Frontend setup:**

   ```bash
   cd src/Pitbull.Web/pitbull-web
   npm ci
   npm run dev
   ```

4. **Seed data (optional):**

   The project includes a seed data generator for realistic construction demo data. See the seed endpoint documentation for details.

---

## Development Workflow

### Branching Strategy

We use a three-branch promotion model:

| Branch | Purpose | Deploys To |
|--------|---------|------------|
| `main` | Production (sacred) | Railway production |
| `staging` | Pre-release testing | Railway staging |
| `develop` | Active development (default) | Railway dev |

**All feature branches target `develop`.** Never commit directly to `main` or `staging`.

### Branch Naming

Use conventional prefixes:

- `feat/<short-name>` -- New features
- `fix/<short-name>` -- Bug fixes
- `docs/<short-name>` -- Documentation
- `test/<short-name>` -- Test additions
- `refactor/<short-name>` -- Code restructuring

### Workflow

1. **Start from develop:**

   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feat/your-feature
   ```

2. **Do your work.** Commit early, commit often.

3. **Build before pushing:**

   ```bash
   # Backend
   cd src/Pitbull.Api && dotnet build

   # Frontend
   cd src/Pitbull.Web/pitbull-web && npm run build
   ```

   Both must pass. No exceptions.

4. **Push and open a PR:**

   ```bash
   git push -u origin feat/your-feature
   gh pr create --title "feat: your feature description" --base develop
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

### CQRS with MediatR

Commands (writes) and queries (reads) are separated:

- **Commands** implement `ICommand<TResponse>` and change state
- **Queries** implement `IQuery<TResponse>` and only read data
- Both return `Result<T>` -- never throw exceptions for business logic failures

### Vertical Slice Architecture

Each feature gets its own folder containing everything it needs:

```
Pitbull.Projects/
  Features/
    CreateProject/
      CreateProjectCommand.cs     # Request + response DTOs
      CreateProjectHandler.cs     # Business logic
      CreateProjectValidator.cs   # FluentValidation rules
```

No hunting across `Services/`, `Repositories/`, and `DTOs/` folders. Everything for a feature lives together.

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
- **No repositories:** Inject `PitbullDbContext` directly, use `db.Set<T>()`
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

Both of these must pass:

```bash
# Backend build
cd src/Pitbull.Api && dotnet build

# Frontend build + lint
cd src/Pitbull.Web/pitbull-web && npm run build && npm run lint
```

### CI Pipeline

GitHub Actions runs automatically on push/PR to `main` and `develop`:

**Backend:**
- `dotnet restore` / `dotnet build --configuration Release`
- Unit tests (`tests/Pitbull.Tests.Unit`)
- Integration tests with PostgreSQL 17 service container

**Frontend:**
- `npm ci` / `npm run build` / `npm run lint`

Both jobs must pass before merge.

### Writing Tests

- Unit tests go in `tests/Pitbull.Tests.Unit/`
- Integration tests use a real PostgreSQL instance via service containers
- Test the handler, not the controller -- controllers are thin
- Use the Result pattern assertions: check `result.IsSuccess` and `result.ErrorCode`

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
