# Production Error Tracking — Design Doc

**Author:** River Banks Garrison
**Date:** 2026-02-17
**Status:** Ready for implementation
**Branch:** `feature/error-tracking`

---

## Problem

Production bugs (#108 PM pages 404, #109 admin users crash) are invisible to us. Users hit errors, and we only know about them when someone reports them manually. We can't reproduce from code review alone — we need the actual error details from production.

## Goal

Capture backend exceptions AND frontend JavaScript errors automatically in a `diagnostic_errors` table. Expose an API for querying them. Enable a cron job (River) to poll for new errors and auto-investigate.

## Non-Goals

- No external dependencies (no Sentry, no Datadog)
- No real-time websocket notifications (cron polling is sufficient)
- No error aggregation/deduplication (v2)
- No user-facing error dashboard (admin-only API is enough for now)

---

## Architecture

### 1. DiagnosticError Entity (Core module)

```csharp
// Does NOT inherit BaseEntity — not tenant-scoped (infra table)
// But we capture TenantId when available for context
public class DiagnosticError
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    
    // Source: "backend" | "frontend"
    public string Source { get; set; } = string.Empty;
    
    // Error classification
    public string Level { get; set; } = "error"; // "error" | "warning" | "fatal"
    public int? HttpStatusCode { get; set; }
    public string? RequestMethod { get; set; }
    public string? RequestPath { get; set; }
    public string? QueryString { get; set; }
    
    // Error details
    public string Message { get; set; } = string.Empty;
    public string? ExceptionType { get; set; }
    public string? StackTrace { get; set; }
    
    // Context
    public Guid? TenantId { get; set; }
    public string? UserId { get; set; }
    public string? UserEmail { get; set; }
    public string? CorrelationId { get; set; }
    public string? TraceId { get; set; }
    public string? UserAgent { get; set; }
    public string? IpAddress { get; set; }
    
    // Frontend-specific
    public string? ComponentStack { get; set; }
    public string? BrowserInfo { get; set; }
    public string? PageUrl { get; set; }
    
    // Metadata (JSON blob for anything extra)
    public string? Metadata { get; set; }
    
    // Tracking
    public bool Acknowledged { get; set; } = false;
    public DateTime? AcknowledgedAt { get; set; }
    public string? AcknowledgedBy { get; set; }
    public string? Resolution { get; set; }
}
```

### 2. Backend: Enhance ExceptionMiddleware

The existing `ExceptionMiddleware` already catches unhandled exceptions. Enhance it to:

1. Resolve `PitbullDbContext` from DI (scoped)
2. Create a `DiagnosticError` record with full context
3. Save to database
4. Continue returning the existing error response (no behavior change for users)

**Important:** The middleware must NOT throw if the diagnostic save fails — wrap the save in try/catch and log to Serilog as fallback. The error response to the user must always go through.

```csharp
// In the catch block, AFTER logging to Serilog and BEFORE writing response:
try
{
    var dbContext = context.RequestServices.GetService<PitbullDbContext>();
    if (dbContext != null)
    {
        var error = new DiagnosticError
        {
            Source = "backend",
            Level = "error",
            HttpStatusCode = 500,
            RequestMethod = context.Request.Method,
            RequestPath = context.Request.Path,
            QueryString = context.Request.QueryString.ToString(),
            Message = ex.Message,
            ExceptionType = ex.GetType().FullName,
            StackTrace = ex.ToString(), // Full stack trace in production
            TenantId = /* extract from claims or middleware */,
            UserId = context.User?.FindFirst("sub")?.Value,
            UserEmail = context.User?.FindFirst("email")?.Value,
            CorrelationId = correlationId,
            TraceId = traceId,
            UserAgent = context.Request.Headers.UserAgent.ToString(),
            IpAddress = context.Connection.RemoteIpAddress?.ToString()
        };
        dbContext.Set<DiagnosticError>().Add(error);
        await dbContext.SaveChangesAsync();
    }
}
catch (Exception saveEx)
{
    logger.LogWarning(saveEx, "Failed to save diagnostic error to database");
}
```

**Also capture 4xx errors** that indicate bugs (not user input errors):
- Add a second middleware (or response filter) that logs 404s on API routes (not static files)
- This would have caught bug #108 immediately

### 3. Backend: DiagnosticsController

```
[ApiController]
[Route("api/diagnostics")]
[Authorize(Roles = "Admin")]
```

Endpoints:
- `GET /api/diagnostics/errors` — List errors (paged, filterable by source/level/date range/acknowledged)
- `GET /api/diagnostics/errors/{id}` — Get error detail
- `POST /api/diagnostics/errors` — Report frontend error (this one is `[AllowAnonymous]` but rate-limited)
- `PATCH /api/diagnostics/errors/{id}/acknowledge` — Mark as acknowledged with resolution notes
- `GET /api/diagnostics/errors/summary` — Counts by source/level for last 24h/7d/30d

**Rate limiting on the POST endpoint:** Max 10 errors per IP per minute. Prevent abuse from bots.

### 4. Frontend: Global Error Capture

**A. React Error Boundary (component crashes)**

Wrap the app in a top-level error boundary that:
- Catches React render errors
- POSTs to `/api/diagnostics/errors` with component stack, page URL, browser info
- Shows user-friendly error page

```tsx
// src/components/error-boundary.tsx
class GlobalErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    fetch('/api/diagnostics/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'frontend',
        level: 'error',
        message: error.message,
        stackTrace: error.stack,
        componentStack: errorInfo.componentStack,
        pageUrl: window.location.href,
        browserInfo: navigator.userAgent,
        metadata: JSON.stringify({
          timestamp: new Date().toISOString(),
          viewport: `${window.innerWidth}x${window.innerHeight}`
        })
      })
    }).catch(() => {}); // Fire and forget
  }
}
```

**B. window.onerror + unhandledrejection (JS runtime errors)**

```tsx
// In layout.tsx or _app.tsx
if (typeof window !== 'undefined') {
  window.onerror = (message, source, lineno, colno, error) => {
    fetch('/api/diagnostics/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'frontend',
        level: 'error',
        message: String(message),
        stackTrace: error?.stack,
        pageUrl: window.location.href,
        browserInfo: navigator.userAgent,
        metadata: JSON.stringify({ source, lineno, colno })
      })
    }).catch(() => {});
  };

  window.addEventListener('unhandledrejection', (event) => {
    fetch('/api/diagnostics/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'frontend',
        level: 'error',
        message: event.reason?.message || String(event.reason),
        stackTrace: event.reason?.stack,
        pageUrl: window.location.href,
        browserInfo: navigator.userAgent
      })
    }).catch(() => {});
  });
}
```

**C. API response interceptor (catch 4xx/5xx from fetch calls)**

In the existing `api<T>()` helper, add error reporting:

```tsx
// When response is not ok (4xx/5xx), report it
if (!response.ok && response.status >= 500) {
  fetch('/api/diagnostics/errors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: 'frontend',
      level: response.status >= 500 ? 'error' : 'warning',
      httpStatusCode: response.status,
      requestMethod: method,
      requestPath: url,
      message: `API ${method} ${url} returned ${response.status}`,
      pageUrl: window.location.href,
      browserInfo: navigator.userAgent
    })
  }).catch(() => {});
}
```

### 5. Database Migration

```sql
CREATE TABLE diagnostic_errors (
    "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "Timestamp" timestamp with time zone NOT NULL DEFAULT now(),
    "Source" varchar(20) NOT NULL,
    "Level" varchar(20) NOT NULL DEFAULT 'error',
    "HttpStatusCode" integer,
    "RequestMethod" varchar(10),
    "RequestPath" varchar(2048),
    "QueryString" varchar(2048),
    "Message" text NOT NULL,
    "ExceptionType" varchar(500),
    "StackTrace" text,
    "TenantId" uuid,
    "UserId" varchar(200),
    "UserEmail" varchar(500),
    "CorrelationId" varchar(100),
    "TraceId" varchar(100),
    "UserAgent" text,
    "IpAddress" varchar(50),
    "ComponentStack" text,
    "BrowserInfo" text,
    "PageUrl" varchar(2048),
    "Metadata" jsonb,
    "Acknowledged" boolean NOT NULL DEFAULT false,
    "AcknowledgedAt" timestamp with time zone,
    "AcknowledgedBy" varchar(200),
    "Resolution" text
);

-- Index for querying recent errors
CREATE INDEX "IX_diagnostic_errors_Timestamp" ON diagnostic_errors ("Timestamp" DESC);
CREATE INDEX "IX_diagnostic_errors_Source_Level" ON diagnostic_errors ("Source", "Level");
CREATE INDEX "IX_diagnostic_errors_Acknowledged" ON diagnostic_errors ("Acknowledged") WHERE "Acknowledged" = false;

-- NO RLS on this table — it's infrastructure, not business data
-- TenantId is captured for context but not enforced
```

### 6. River Integration (Cron)

After this ships, I'll set up a cron job:
- Every 30 minutes, `GET /api/diagnostics/errors?acknowledged=false&since=<last_check>`
- If new errors found: investigate the stack trace/context, alert Josh if it's a real bug
- Auto-acknowledge known noise (health checks, bots, etc.)

---

## File Locations

| Component | Path |
|-----------|------|
| Entity | `src/Modules/Pitbull.Core/Domain/DiagnosticError.cs` |
| EF Config | `src/Modules/Pitbull.Core/Data/DiagnosticErrorConfiguration.cs` |
| DbContext | Add `DbSet<DiagnosticError>` to `PitbullDbContext` |
| Migration | `src/Modules/Pitbull.Core/Data/Migrations/` (new migration) |
| ExceptionMiddleware | `src/Pitbull.Api/Middleware/ExceptionMiddleware.cs` (enhance existing) |
| 404 Middleware | `src/Pitbull.Api/Middleware/ApiNotFoundMiddleware.cs` (new) |
| Controller | `src/Pitbull.Api/Controllers/DiagnosticsController.cs` |
| Error Boundary | `src/Pitbull.Web/pitbull-web/src/components/error-boundary.tsx` |
| Error Reporter | `src/Pitbull.Web/pitbull-web/src/lib/error-reporter.ts` |
| API helper update | `src/Pitbull.Web/pitbull-web/src/lib/api.ts` (enhance existing) |

## Constraints

- `diagnostic_errors` has NO RLS — it's infrastructure. TenantId is informational only.
- Frontend POST endpoint is `[AllowAnonymous]` with rate limiting (10/min/IP)
- Middleware save MUST NOT fail the original request — always try/catch
- Stack traces are stored in production (this is an internal admin table, not user-facing)
- No cascade delete — errors persist independently of other entities

## Testing

- Unit test: ExceptionMiddleware saves DiagnosticError on unhandled exception
- Unit test: DiagnosticsController CRUD operations
- Unit test: Rate limiting on anonymous POST
- Integration test: Frontend error POST → appears in GET list
- Manual test: Trigger a real error on production, verify it appears in the table

## What This Solves

- **Bug #108:** Would have captured the exact 404 response — which endpoint, what tenant, what user
- **Bug #109:** Would have captured the React component stack trace — exact component that crashed and why
- **Future:** Any production error automatically flows to River for investigation
