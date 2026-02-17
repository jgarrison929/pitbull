namespace Pitbull.Core.Domain;

/// <summary>
/// Immutable diagnostic error record for production error tracking.
/// Does NOT inherit BaseEntity — this is an infrastructure table with no RLS, no soft delete.
/// TenantId is captured for context only (nullable, not enforced).
/// </summary>
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
    public bool Acknowledged { get; set; }
    public DateTime? AcknowledgedAt { get; set; }
    public string? AcknowledgedBy { get; set; }
    public string? Resolution { get; set; }
}
