using System.Collections.Concurrent;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pitbull.Api.Extensions;
using Pitbull.Api.Services;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/diagnostics")]
[Authorize(Policy = "SystemAdmin.Health")]
[Produces("application/json")]
[Tags("Diagnostics")]
public class DiagnosticsController(IDiagnosticsService diagnosticsService) : ControllerBase
{
    // Simple in-memory rate limiter for the anonymous POST endpoint: 10 requests/min/IP
    private static readonly ConcurrentDictionary<string, RateLimitEntry> _rateLimitStore = new();
    private const int MaxRequestsPerMinute = 10;
    private const int MaxTrackedIPs = 10_000;
    private static DateTime _lastEviction = DateTime.UtcNow;

    /// <summary>
    /// List diagnostic errors (paged, filterable)
    /// </summary>
    [HttpGet("errors")]
    public async Task<IActionResult> List(
        [FromQuery] string? source,
        [FromQuery] string? level,
        [FromQuery] bool? acknowledged,
        [FromQuery] DateTime? since,
        [FromQuery] DateTime? until,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var filter = new DiagnosticErrorFilter(source, level, acknowledged, since, until, page, pageSize);
        var result = await diagnosticsService.ListAsync(filter);
        return Ok(result);
    }

    /// <summary>
    /// Get error summary (counts by source/level for last 24h/7d/30d)
    /// </summary>
    [HttpGet("errors/summary")]
    public async Task<IActionResult> Summary()
    {
        var result = await diagnosticsService.GetSummaryAsync();
        return Ok(result);
    }

    /// <summary>
    /// Get diagnostic error by ID
    /// </summary>
    [HttpGet("errors/{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var error = await diagnosticsService.GetByIdAsync(id);
        if (error is null)
            return this.NotFoundError("Diagnostic error not found");
        return Ok(error);
    }

    /// <summary>
    /// Report a frontend error (anonymous, rate-limited to 10/min/IP).
    /// Accepts a slim public DTO only — TenantId/UserId/UserEmail and other attribution fields are ignored.
    /// </summary>
    [HttpPost("errors")]
    [AllowAnonymous]
    // Platform rate limiter (per-IP) in addition to the in-memory 10/min guard below.
    [EnableRateLimiting("register")]
    public async Task<IActionResult> ReportError([FromBody] PublicDiagnosticErrorRequest request)
    {
        // Rate limiting: 10 requests per minute per IP
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        if (!CheckRateLimit(ip))
        {
            Response.Headers.RetryAfter = "60";
            return StatusCode(429, new { error = "Too many error reports. Try again later.", code = "RATE_LIMITED" });
        }

        // Reject empty / oversized payloads early (service also bounds + LogSafe).
        var message = request.Message ?? string.Empty;
        if (string.IsNullOrWhiteSpace(message))
            return BadRequest(new { error = "Message is required", code = "VALIDATION_ERROR" });
        if (message.Length > 4000)
            return BadRequest(new { error = "Message exceeds 4000 characters", code = "VALIDATION_ERROR" });
        if (request.StackTrace is { Length: > 16_000 })
            return BadRequest(new { error = "StackTrace exceeds 16000 characters", code = "VALIDATION_ERROR" });
        if (request.Metadata is { Length: > 4000 })
            return BadRequest(new { error = "Metadata exceeds 4000 characters", code = "VALIDATION_ERROR" });
        if (request.PageUrl is { Length: > 2048 })
            return BadRequest(new { error = "PageUrl exceeds 2048 characters", code = "VALIDATION_ERROR" });

        // Slim DTO only: never accept client TenantId/UserId/UserEmail/StackTrace forgery surface.
        var sanitizedRequest = new CreateDiagnosticErrorRequest
        {
            Source = "frontend",
            Level = request.Level,
            Message = message,
            ExceptionType = request.ExceptionType,
            StackTrace = request.StackTrace,
            ComponentStack = request.ComponentStack,
            BrowserInfo = request.BrowserInfo,
            PageUrl = request.PageUrl,
            Metadata = request.Metadata,
            CorrelationId = request.CorrelationId,
            TraceId = request.TraceId,
            IpAddress = ip,
            UserAgent = request.UserAgent ?? Request.Headers.UserAgent.ToString(),
            TenantId = null,
            UserId = null,
            UserEmail = null
        };

        var error = await diagnosticsService.CreateAsync(sanitizedRequest);
        return StatusCode(201, new { id = error.Id });
    }

    /// <summary>
    /// Acknowledge a diagnostic error with optional resolution notes
    /// </summary>
    [HttpPatch("errors/{id:guid}/acknowledge")]
    public async Task<IActionResult> Acknowledge(Guid id, [FromBody] AcknowledgeRequest request)
    {
        var userEmail = User.FindFirst("email")?.Value ?? User.Identity?.Name ?? "unknown";
        var error = await diagnosticsService.AcknowledgeAsync(id, userEmail, request.Resolution);
        if (error is null)
            return this.NotFoundError("Diagnostic error not found");
        return Ok(error);
    }

    private static bool CheckRateLimit(string ip)
    {
        var now = DateTime.UtcNow;

        // Periodic eviction: remove expired entries to prevent unbounded memory growth
        if (now - _lastEviction > TimeSpan.FromMinutes(5) || _rateLimitStore.Count > MaxTrackedIPs)
        {
            _lastEviction = now;
            foreach (var kvp in _rateLimitStore)
            {
                if (now - kvp.Value.WindowStart > TimeSpan.FromMinutes(2))
                    _rateLimitStore.TryRemove(kvp.Key, out _);
            }
        }

        var entry = _rateLimitStore.GetOrAdd(ip, _ => new RateLimitEntry());

        lock (entry)
        {
            // Reset window if it's expired
            if (now - entry.WindowStart > TimeSpan.FromMinutes(1))
            {
                entry.WindowStart = now;
                entry.Count = 0;
            }

            if (entry.Count >= MaxRequestsPerMinute)
                return false;

            entry.Count++;
            return true;
        }
    }

    private class RateLimitEntry
    {
        public DateTime WindowStart { get; set; } = DateTime.UtcNow;
        public int Count { get; set; }
    }
}
