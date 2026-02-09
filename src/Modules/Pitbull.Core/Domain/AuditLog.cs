namespace Pitbull.Core.Domain;

/// <summary>
/// Immutable audit log entry for tracking all system activity
/// </summary>
public class AuditLog
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid TenantId { get; private set; }
    public Guid? UserId { get; private set; }
    public string? UserEmail { get; private set; }
    public string? UserName { get; private set; }
    public AuditAction Action { get; private set; }
    public string ResourceType { get; private set; } = string.Empty;
    public string? ResourceId { get; private set; }
    public string Description { get; private set; } = string.Empty;
    public string? Details { get; private set; } // JSON
    public string? IpAddress { get; private set; }
    public string? UserAgent { get; private set; }
    public DateTime Timestamp { get; private set; } = DateTime.UtcNow;
    public bool Success { get; private set; } = true;
    public string? ErrorMessage { get; private set; }

    private AuditLog() { }

    public static AuditLog Create(
        Guid tenantId,
        Guid? userId,
        string? userEmail,
        string? userName,
        AuditAction action,
        string resourceType,
        string? resourceId,
        string description,
        string? details = null,
        string? ipAddress = null,
        string? userAgent = null,
        bool success = true,
        string? errorMessage = null)
    {
        return new AuditLog
        {
            TenantId = tenantId,
            UserId = userId,
            UserEmail = userEmail,
            UserName = userName,
            Action = action,
            ResourceType = resourceType,
            ResourceId = resourceId,
            Description = description,
            Details = details,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            Success = success,
            ErrorMessage = errorMessage
        };
    }
}

public enum AuditAction
{
    Create = 1,
    Read = 2,
    Update = 3,
    Delete = 4,
    Login = 5,
    Logout = 6,
    FailedLogin = 7,
    PasswordReset = 8,
    RoleChange = 9,
    Export = 10,
    Import = 11,
    StatusChange = 12,
    Approval = 13,
    Rejection = 14
}
