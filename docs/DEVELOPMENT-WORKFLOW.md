# Development Workflow

## PR-Based Compound Engineering

**Every change goes through a Pull Request.** No direct commits to main.

### Process

1. **Claude Code** creates a feature branch (`fix/description` or `feat/description`)
2. **Claude Code** makes changes, writes tests, commits to branch
3. **Claude Code** opens a PR against `main` with description of changes
4. **Codex** reviews the PR diff (`gh pr diff <number>`) and posts review comments
5. **Claude Code** addresses review comments on the branch
6. **Codex** re-reviews until clean
7. **Merge** when CI green + review approved

### Branch Naming

- `fix/` — bug fixes, stability improvements
- `feat/` — new features, test coverage
- `security/` — security hardening
- `refactor/` — code quality, architecture

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
