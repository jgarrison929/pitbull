# Compound Lessons — February 2026

## Migration Duplication Bug
**Problem:** When agents scaffold multiple EF migrations in the same session, each migration captures the full model delta — resulting in duplicate AddColumn calls that fail on apply.
**Solution:** Always diff new migrations against recent ones before committing. One migration per feature per session.
**Pattern:** Before `git add` on any migration file, run `git diff HEAD -- src/Pitbull.Api/Migrations/` and check for duplicate column definitions.
**Files:** `src/Pitbull.Api/Migrations/`

## Service Constructor Test Breakage
**Problem:** Adding new validation or a new service dependency that changes a service constructor breaks ALL test files that instantiate that service directly.
**Solution:** When modifying any service constructor, grep all test files for that service name and update instantiations.
**Pattern:** `grep -r "new ServiceName(" tests/` before committing.
**Files:** `tests/Pitbull.Tests.Unit/`

## MassTransit Commercial License Surprise
**Problem:** MassTransit v9 went commercial (Massient license). Upgrading crashed production.
**Solution:** Migrated to DotNetCore.CAP (MIT, v10.0.1). Always check licenses before upgrading major packages.
**Pattern:** Before any `dotnet add package`, check the license on NuGet/GitHub. Prefer MIT/Apache 2.0.
**Files:** `src/Pitbull.Api/Pitbull.Api.csproj`

## DateTime UTC Strict Mode
**Problem:** Npgsql 9.x rejects DateTimeKind.Unspecified. Breaks inserts/updates for any DateTime field.
**Solution:** Global fix in `PitbullDbContext.SaveChangesAsync()` converts all Unspecified → UTC before save.
**Pattern:** Never add manual DateTime.UtcNow conversions in individual services — the DbContext handles it globally.
**Files:** `src/Modules/Pitbull.Core/Data/PitbullDbContext.cs`

## DataProtection Key Persistence
**Problem:** Default ASP.NET DataProtection = ephemeral keys in containers. AI API keys encrypted with DataProtection became undecryptable after Railway redeploys.
**Solution:** `PersistKeysToDbContext<PitbullDbContext>()` stores keys in PostgreSQL. Keys survive container restarts.
**Files:** `src/Pitbull.Api/Program.cs`

## Worktree + Turbopack Incompatibility
**Problem:** Git worktrees with symlinked node_modules break Turbopack (Next.js dev server). Build failures on frontend.
**Solution:** Don't use worktrees for this project. Single repo, sequential agent dispatch.
**Pattern:** One agent at a time, one working directory.

## Agent Team Context Exhaustion
**Problem:** Agent teams with 4+ specialists burn through context fast (~300K tokens in 30 min). At 0% context, auto-compact loses branch awareness.
**Solution:** Commit partial work before context gets critical. After compaction, send fresh focused prompts (not multi-task).
**Pattern:** Monitor context % in tmux output. When < 15%, tell team to finish current task and commit.

## Enum Value Freezing
**Problem:** TimeEntryStatus enum values (Submitted=0, Approved=1, Rejected=2, Draft=3) are stored in database. Reordering would corrupt data.
**Solution:** Mark frozen enums with comment `// FROZEN — DO NOT REORDER`. Add new values at end only.
**Pattern:** All enums stored as integers in DB are implicitly frozen. String-stored enums are safe to reorder but shouldn't be without migration.
**Files:** Any enum used as an entity property.

## Agent Team Migration Snapshot Corruption (Feb 20)
**Problem:** Agent team created punch list entities, but the migration it generated only had ALTER/ADD COLUMN — no CREATE TABLE. The model snapshot was updated to include the new tables, but the migration assumed they already existed. Production crashed on deploy because tables didn't exist.
**Root Cause:** Agent team likely scaffolded entities first (updating snapshot), then ran a second migration add that only captured the delta from the already-updated snapshot. Two-step entity creation in one session = broken migration.
**Solution:** Reset model snapshot to last known-good state (git show <commit>:path > path), then regenerate migration. New migration correctly has CREATE TABLE.
**Pattern:** After any agent team builds new entities, ALWAYS verify the migration has CREATE TABLE (not just ALTER). Run `grep "CreateTable" <migration>.cs` before committing. If empty or missing, reset snapshot and regenerate.
**Prevention:** Add to compound review checklist: "Does the migration create new tables? Verify with grep."
**Files:** `src/Pitbull.Api/Migrations/`
