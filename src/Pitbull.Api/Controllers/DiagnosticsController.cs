using System.Collections.Concurrent;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pitbull.Api.Extensions;
using Pitbull.Api.Services;

namespace Pitbull.Api.Controllers;

[ApiController]
[Route("api/diagnostics")]
[Authorize(Roles = "Admin")]
[Produces("application/json")]
[Tags("Diagnostics")]
public class DiagnosticsController(IDiagnosticsService diagnosticsService) : ControllerBase
{
    // Simple in-memory rate limiter for the anonymous POST endpoint: 10 requests/min/IP
    private static readonly ConcurrentDictionary<string, RateLimitEntry> _rateLimitStore = new();
    private const int MaxRequestsPerMinute = 10;

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
    /// Report a frontend error (anonymous, rate-limited to 10/min/IP)
    /// </summary>
    [HttpPost("errors")]
    [AllowAnonymous]
    public async Task<IActionResult> ReportError([FromBody] CreateDiagnosticErrorRequest request)
    {
        // Rate limiting: 10 requests per minute per IP
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        if (!CheckRateLimit(ip))
            return StatusCode(429, new { error = "Too many error reports. Try again later." });

        // Enforce source as frontend for anonymous reports
        var sanitizedRequest = request with
        {
            Source = "frontend",
            IpAddress = ip,
            UserAgent = request.UserAgent ?? Request.Headers.UserAgent.ToString()
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
