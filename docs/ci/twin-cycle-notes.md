# Twin cycle CI notes (2.8.4-2.10.0)

> **Historical — not the live product.** Describes the removed 3.8.2 app (tag `legacy-3.8.2-final`). Live product is `v5/`.


See implementer `ci-notes.md` for session detail. Twin MVP product stamp: `VERSION` = 2.10.0 (not a major).

Key CI lessons:
1. Seed overlay fuel must use a real user id for `PmProgressEntry.EnteredByUserId` on PostgreSQL.
2. Keep ESLint prefer-const clean on pure helpers under `src/lib`.
3. Role E2E L4 remains the long pole after .NET integration tests.