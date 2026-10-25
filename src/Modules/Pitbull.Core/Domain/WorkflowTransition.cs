namespace Pitbull.Core.Domain;

public class WorkflowTransition : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public string EntityType { get; set; } = string.Empty;
    public Guid EntityId { get; set; }
    public string? FromStatus { get; set; }
    public string ToStatus { get; set; } = string.Empty;
    public Guid ChangedByUserId { get; set; }
    public DateTime ChangedAt { get; set; }
    public string? Comment { get; set; }
    public string? ChangedByName { get; set; }
}
