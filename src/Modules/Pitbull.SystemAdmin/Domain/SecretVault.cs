using Pitbull.Core.Domain;

namespace Pitbull.SystemAdmin.Domain;

public class SecretVault : BaseEntity
{
    public string Key { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;

    [Encrypted]
    public string EncryptedValue { get; set; } = string.Empty;

    /// <summary>Truncated SHA-256 of the secret value for correlation only (never plaintext slices).</summary>
    public string KeyFingerprint { get; set; } = string.Empty;
    public SecretCategory Category { get; set; } = SecretCategory.Integration;
    public DateTime LastRotated { get; set; }
    public string? Description { get; set; }
}

public enum SecretCategory
{
    API,
    SMTP,
    Integration,
    Authentication,
    Database,
    Analytics,
    Infrastructure
}
