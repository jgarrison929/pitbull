using Pitbull.Core.Domain;

namespace Pitbull.Core.Entities;

public sealed class EmailDigestSetting : BaseEntity
{
    public Guid UserId { get; set; }
    public DigestFrequency Frequency { get; set; } = DigestFrequency.None;
    public TimeOnly SendTime { get; set; } = new(8, 0);
    public DayOfWeek? DayOfWeek { get; set; }
    public DateTime? LastSentAt { get; set; }
}

public enum DigestFrequency
{
    None = 0,
    Daily = 1,
    Weekly = 2,
}
