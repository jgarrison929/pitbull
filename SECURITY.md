# Security Policy

## Supported Versions

Only the `main` branch is supported for security fixes.

## Reporting a Vulnerability

**Do not report security vulnerabilities through public GitHub issues.**

Please open a [GitHub Security Advisory](https://github.com/jgarrison929/pitbull/security/advisories/new).

You should receive a response within 48 hours. If the issue is confirmed, we will release a patch as soon as possible depending on complexity.

## Security Features

### Authentication
- Demo sign-in is a role card on `/login`. That flow has no password.
- The session cookie (`pcs_session`) holds a random token. The database stores only the SHA-256 hash (`v5/src/server/session.ts`).
- `requireUser` sends a visitor with no session to `/login`.

### Data
- Application queries go through Drizzle and postgres.js, with bound parameters.
- Each visitor sandbox is scoped to its own company. Sandboxes expire and can be reset from the demo.

### Secrets
- Credentials stay in environment variables. Do not commit them.

## Security Documentation

- [Row-Level Security Implementation](docs/security/RLS-IMPLEMENTATION.md) (historical 3.8.2 notes)

## Contact

For security questions or concerns, contact the maintainers through GitHub.
