# Twin cycle CI notes (2.8.4–3.0.0)

See implementer `ci-notes.md` for session detail. Production version stamps: `VERSION` = 3.0.0.

Key CI lessons:
1. Seed overlay fuel must use a real user id for `PmProgressEntry.EnteredByUserId` on PostgreSQL.
2. Keep ESLint prefer-const clean on pure helpers under `src/lib`.
3. Role E2E L4 remains the long pole after .NET integration tests.