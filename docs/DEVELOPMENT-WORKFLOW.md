# Development Workflow

## PR-Based Compound Engineering

**Every change goes through a Pull Request.** No direct commits to main.

### Process

1. Create a feature branch from main (`fix/description` or `feat/description`)
2. Make changes, write tests, commit to branch
3. Open a PR against `main` with description of changes
4. Address review comments on the branch
5. Merge when CI green + review approved

### Branch Naming

- `feature/description`
- `fix/description`
- `hotfix/description`

**main only** (no develop branch). Feature branches + PRs. User merges after review. CI must be green (dotnet build + frontend build+lint).

### Review Standards

- CRITICAL/HIGH findings must be fixed before merge
- MEDIUM findings: fix or document why deferred
- LOW findings: optional, can be batched

### Why PRs Matter

- **Audit trail** — every change has a diff, review, and approval history
- **Smaller diffs** — easier to review than whole-file scans
- **Rollback** — can revert a single PR if it causes issues
- **Context** — review comments are attached to the actual code lines
- **CI gates** — tests must pass before merge
