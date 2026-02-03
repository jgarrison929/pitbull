# Security Policy

## Reporting Security Vulnerabilities

If you discover a security vulnerability in Pitbull Construction Solutions, please report it responsibly:

### For Critical Vulnerabilities (RCE, SQLi, XSS, etc.)
- **DO NOT** create a public issue
- Email: jgarrison929@gmail.com
- Include: detailed description, reproduction steps, affected versions
- Expected response time: 48 hours

### For Lower-Risk Issues (dependency updates, config issues)
- Create a GitHub issue with the `security` label
- Use the template below

## Security Update Process

### Automated Dependency Monitoring
- **Dependabot** runs weekly scans for all dependencies
- **CI Pipeline** blocks builds with vulnerable packages
- Critical vulnerabilities are auto-fixed when possible

### Manual Security Review
- Security-sensitive PRs require manual review
- All authentication/authorization changes are reviewed
- Database migration security is validated

## Security Features

### Current Protections
- ✅ Rate limiting on authentication endpoints (5 req/min)
- ✅ Request size limits (API: 1MB, Documents: 50MB)
- ✅ Input validation and sanitization
- ✅ JWT token authentication with configurable expiration
- ✅ SQL injection protection via parameterized queries
- ✅ XSS protection via strict input validation
- ✅ CORS configuration for cross-origin protection
- ✅ Environment variable validation at startup

### Planned Security Enhancements
- [ ] Content Security Policy (CSP) headers
- [ ] Security headers middleware (HSTS, X-Frame-Options, etc.)
- [ ] Audit logging for sensitive operations
- [ ] Multi-factor authentication (MFA)
- [ ] API key-based authentication option

## Security Issue Template

```
**Security Issue Type**: [Vulnerability/Dependency/Configuration]
**Severity**: [Critical/High/Medium/Low]
**Affected Component**: [API/Frontend/Database/CI]
**Description**: 
**Reproduction Steps**:
1. 
2. 
3. 
**Impact**: 
**Suggested Fix**: 
```

## Supported Versions

Only the latest development version receives security updates. This is a pre-release project.

| Version | Supported |
| ------- | --------- |
| develop | ✅ |
| main    | ✅ |
| older   | ❌ |

## Security Best Practices for Contributors

### Code Security
- Never commit secrets, API keys, or passwords
- Use parameterized queries for all database operations
- Validate and sanitize all user inputs
- Follow principle of least privilege for permissions
- Review third-party dependencies before adding

### Environment Security
- Use environment variables for configuration
- Enable startup configuration validation
- Use HTTPS in production deployments
- Implement proper error handling without information leakage

### Testing Security
- Include security test cases for new features
- Test authentication and authorization paths
- Validate input sanitization in unit tests
- Test rate limiting and size limit behaviors

For more details, see our [Architecture Decision Records](docs/ADRs/) and [Quality Strategy](docs/QUALITY-STRATEGY.md).