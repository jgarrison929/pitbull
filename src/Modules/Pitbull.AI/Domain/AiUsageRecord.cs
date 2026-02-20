using Pitbull.Core.Domain;

namespace Pitbull.AI.Domain;

public class AiUsageRecord : BaseEntity, ITenantScoped
{
    public Guid UserId { get; set; }
    public string Provider { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public int TokensIn { get; set; }
    public int TokensOut { get; set; }
    public decimal EstimatedCost { get; set; }
    public string? Feature { get; set; }
    public int DurationMs { get; set; }
    public decimal ConfidenceScore { get; set; }
    public DateTime RequestedAt { get; set; }
}
