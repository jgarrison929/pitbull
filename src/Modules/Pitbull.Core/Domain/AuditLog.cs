namespace Pitbull.Core.Domain;

/// <summary>
/// Audit log entry tracking user actions within the system.
/// Used for compliance, debugging, and security monitoring.
/// </summary>
public class AuditLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    
    /// <summary>User who performed the action (null for system operations)</summary>
    public Guid? UserId { get; set; }
    public string? UserEmail { get; set; }
    public string? UserName { get; set; }
    
    /// <summary>Type of action: Login, Create, Update, Delete, Export, AdminAction, etc.</summary>
    public AuditAction Action { get; set; }
    
    /// <summary>Type of resource affected: User, Project, Employee, TimeEntry, etc.</summary>
    public string ResourceType { get; set; } = string.Empty;
    
    /// <summary>ID of the affected resource (if applicable)</summary>
    public string? ResourceId { get; set; }
    
    /// <summary>Human-readable description of what happened</summary>
    public string Description { get; set; } = string.Empty;
    
    /// <summary>JSON containing before/after values or additional context</summary>
    public string? Details { get; set; }
    
    /// <summary>IP address of the request</summary>
    public string? IpAddress { get; set; }
    
    /// <summary>User agent string</summary>
    public string? UserAgent { get; set; }
    
    /// <summary>When the action occurred</summary>
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    
    /// <summary>Whether the action succeeded</summary>
    public bool Success { get; set; } = true;
    
    /// <summary>Error message if the action failed</summary>
    public string? ErrorMessage { get; set; }
}

public enum AuditAction
{
    // Authentication
    Login = 0,
    LoginFailed = 1,
    Logout = 2,
    PasswordChanged = 3,
    PasswordReset = 4,
    
    // CRUD Operations
    Create = 10,
    Read = 11,
    Update = 12,
    Delete = 13,
    
    // Admin Actions
    UserInvited = 20,
    UserActivated = 21,
    UserDeactivated = 22,
    RoleAssigned = 23,
    RoleRemoved = 24,
    SettingsChanged = 25,
    
    // Data Operations
    Export = 30,
    Import = 31,
    BulkUpdate = 32,
    
    // System
    SystemEvent = 40
}
