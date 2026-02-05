# API Response Caching

## Overview

Pitbull API implements HTTP response caching for read-only endpoints to improve performance and reduce database load. This follows HTTP caching standards and respects tenant isolation.

## Implementation

### Cacheable Attribute

The `[Cacheable]` attribute adds appropriate HTTP caching headers to GET endpoints:

```csharp
[HttpGet("{id}")]
[Cacheable(DurationSeconds = 180)] // 3 minutes
public async Task<IActionResult> GetById(Guid id)
{
    // Implementation
}
```

### Cache Headers Set

- **Cache-Control**: `private, max-age=X, must-revalidate`
- **ETag**: Generated from response content hash
- **Vary**: `Authorization` (for tenant isolation)

### Cache Durations by Endpoint Type

| Endpoint Type | Duration | Reasoning |
|---------------|----------|-----------|
| Dashboard Stats | 1 minute | Frequently changing aggregate data |
| List Endpoints | 2 minutes | Change when records are added/updated |
| Detail Endpoints | 3 minutes | Individual records change less frequently |
| System Info | 5 minutes | Relatively static configuration data |

### Tenant Isolation

- All responses include `Vary: Authorization` header
- Cache keys are scoped by the JWT token
- No cross-tenant cache pollution

### ETags for Conditional Requests

- Generated from SHA256 hash of response content
- Truncated to 16 characters for brevity
- Enables `If-None-Match` requests (304 responses)

## Browser Behavior

- **Private cache only**: Responses cached in browser, not CDNs
- **Must revalidate**: Browser checks with server when cache expires
- **Conditional requests**: Browser sends ETag for 304 Not Modified responses

## Performance Benefits

- Reduces database queries for repeated requests
- Improves response times for cached content
- Enables efficient conditional requests with ETags
- Reduces bandwidth with 304 responses

## Cache Invalidation

Currently relies on time-based expiration. Future enhancements:

- Event-based cache invalidation when data changes
- Cache tagging for granular invalidation
- Redis/distributed cache for multi-instance deployments

## Configuration

Cache durations are set per-endpoint via the `DurationSeconds` property. No global configuration required.

## Security Considerations

- Private cache only (no public/shared caches)
- Tenant isolation via `Vary: Authorization`
- Must-revalidate prevents stale authenticated data
- ETags don't expose sensitive information (hash-based)