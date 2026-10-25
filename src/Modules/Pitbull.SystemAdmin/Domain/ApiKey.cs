using Pitbull.Core.Domain;

namespace Pitbull.SystemAdmin.Domain;

/// <summary>
/// API key for external integrations (ERP sync, mobile apps, webhooks).
/// Keys are stored as SHA-256 hashes — the plaintext is only shown once on creation.
/// </summary>
public class ApiKey : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string KeyHash { get; set; } = string.Empty;
    public string KeyPrefix { get; set; } = string.Empty; // First 8 chars for identification
    public ApiKeyStatus Status { get; set; } = ApiKeyStatus.Active;
    public DateTime? ExpiresAt { get; set; }
    public DateTime? LastUsedAt { get; set; }
    public string? Scopes { get; set; } // Comma-separated: "read,write,admin"
    public string? Description { get; set; }
    public string CreatedByEmail { get; set; } = string.Empty;
    public DateTime? RevokedAt { get; set; }
    public string? RevokedBy { get; set; }
}

public enum ApiKeyStatus
{
    Active,
    Revoked,
    Expired
}
