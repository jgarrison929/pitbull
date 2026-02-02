using Pitbull.Core.Domain;

namespace Pitbull.Projects.Domain;

/// <summary>
/// Core project entity. The hub that everything else connects to.
/// </summary>
public class Project : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string Number { get; set; } = string.Empty; // e.g. "PRJ-2026-001"
    public string? Description { get; set; }
    public ProjectStatus Status { get; set; } = ProjectStatus.Bidding;
    public ProjectType Type { get; set; } = ProjectType.Commercial;

    // Location
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? ZipCode { get; set; }

    // Client
    public string? ClientName { get; set; }
    public string? ClientContact { get; set; }
    public string? ClientEmail { get; set; }
    public string? ClientPhone { get; set; }

    // Schedule
    public DateTime? StartDate { get; set; }
    public DateTime? EstimatedCompletionDate { get; set; }
    public DateTime? ActualCompletionDate { get; set; }

    // Financials
    public decimal ContractAmount { get; set; }
    public decimal? OriginalBudget { get; set; }

    // Reference back to bid if converted
    public Guid? SourceBidId { get; set; }

    // Superintendent / PM
    public Guid? ProjectManagerId { get; set; }
    public Guid? SuperintendentId { get; set; }

    // Navigation
    public ICollection<Phase> Phases { get; set; } = [];
    public ProjectBudget? Budget { get; set; }
    public ICollection<Projection> Projections { get; set; } = [];
}
