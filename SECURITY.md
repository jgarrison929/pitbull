# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.10.x  | :white_check_mark: |
| < 0.10  | :x:                |

## Reporting a Vulnerability

**Do not report security vulnerabilities through public GitHub issues.**

Please email security concerns to **security@pitbullconstructionsolutions.com** (or contact the maintainers directly).

You should receive a response within 48 hours. If the issue is confirmed, we will release a patch as soon as possible depending on complexity.

## Security Features

### Authentication & Authorization
- **JWT Authentication**: All API endpoints (except auth) require valid JWT tokens
- **Role-Based Access Control (RBAC)**: Admin, Manager, Supervisor, User roles
- **Password Security**: Minimum 8 characters, requires uppercase, lowercase, digit
- **Token Expiration**: 60-minute access tokens, 7-day refresh tokens

### API Security
- **Rate Limiting**: All controllers protected with configurable rate limits
- **Request Size Limits**: Payload size caps (10MB general, 100MB document uploads)
- **Input Validation**: FluentValidation on all commands/queries
- **CORS**: Explicit origin allowlist, no wildcards in production

### Database Security
- **Row-Level Security (RLS)**: PostgreSQL RLS policies enforce tenant isolation at database level
- **Multi-Tenant Isolation**: Defense in depth with both application and database filtering
- **Parameterized Queries**: EF Core prevents SQL injection
- **Encrypted Connections**: TLS required for all database connections

### Infrastructure
- **HTTPS Only**: All production traffic encrypted
- **Security Headers**: X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security
- **Health Checks**: Separate endpoints for liveness/readiness probes
- **Logging**: Structured logging with correlation IDs, sensitive data redacted

### Data Protection
- **Soft Deletes**: Records are marked deleted, not removed
- **Audit Fields**: CreatedAt/UpdatedAt/CreatedBy/UpdatedBy on all entities
- **No Plaintext Secrets**: Environment variables for all credentials

## Security Documentation

- [Row-Level Security Implementation](docs/security/RLS-IMPLEMENTATION.md)
- [Best Practices](docs/BEST-PRACTICES.md)

## Contact

For security questions or concerns, contact the maintainers through GitHub.
