using Pitbull.Core.Domain;

namespace Pitbull.AI.Domain;

public class AiApiKey : BaseEntity
{
    public string Provider { get; set; } = string.Empty;
    public string EncryptedApiKey { get; set; } = string.Empty;
    public string KeyFingerprint { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime? LastUsedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
}
