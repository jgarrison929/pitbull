using Pitbull.Core.Domain;

namespace Pitbull.HR.Domain;

/// <summary>
/// Represents a distinct period of employment.
/// Supports the rehire-first pattern common in construction (60% turnover).
/// </summary>
public class EmploymentEpisode : BaseEntity
{
    /// <summary>
    /// Parent employee.
    /// </summary>
    public Guid EmployeeId { get; set; }
    
    /// <summary>
    /// Episode sequence number (1 = first hire, 2 = first rehire, etc.)
    /// </summary>
    public int EpisodeNumber { get; set; }
    
    /// <summary>
    /// Start date of this employment period.
    /// </summary>
    public DateOnly HireDate { get; set; }
    
    /// <summary>
    /// End date of this employment period (null if current).
    /// </summary>
    public DateOnly? TerminationDate { get; set; }
    
    /// <summary>
    /// Reason for separation.
    /// </summary>
    public SeparationReason? SeparationReason { get; set; }
    
    /// <summary>
    /// Whether eligible for rehire after this separation.
    /// </summary>
    public bool? EligibleForRehire { get; set; }
    
    /// <summary>
    /// Notes about separation/rehire eligibility.
    /// </summary>
    public string? SeparationNotes { get; set; }
    
    /// <summary>
    /// Voluntary or involuntary termination.
    /// </summary>
    public bool? WasVoluntary { get; set; }
    
    /// <summary>
    /// Union dispatch reference number (if applicable).
    /// </summary>
    public string? UnionDispatchReference { get; set; }
    
    /// <summary>
    /// Job classification at time of this episode.
    /// </summary>
    public string? JobClassificationAtHire { get; set; }
    
    /// <summary>
    /// Pay rate at time of this episode (snapshot).
    /// </summary>
    public decimal? HourlyRateAtHire { get; set; }
    
    /// <summary>
    /// Position/title at start of episode.
    /// </summary>
    public string? PositionAtHire { get; set; }
    
    /// <summary>
    /// Position/title at end of episode.
    /// </summary>
    public string? PositionAtTermination { get; set; }
    
    // Navigation
    public Employee Employee { get; set; } = null!;
}

/// <summary>
/// Reason for employment separation.
/// </summary>
public enum SeparationReason
{
    /// <summary>Employee chose to leave.</summary>
    Resignation = 1,
    
    /// <summary>Involuntary termination for cause.</summary>
    TerminatedForCause = 2,
    
    /// <summary>Layoff due to lack of work.</summary>
    Layoff = 3,
    
    /// <summary>Position eliminated.</summary>
    PositionEliminated = 4,
    
    /// <summary>End of project/assignment (construction-specific).</summary>
    EndOfProject = 5,
    
    /// <summary>Seasonal work ended.</summary>
    SeasonalEnd = 6,
    
    /// <summary>Employee retired.</summary>
    Retirement = 7,
    
    /// <summary>Union dispatch returned to hall.</summary>
    UnionDispatchEnded = 8,
    
    /// <summary>Job abandonment (no call/no show).</summary>
    JobAbandonment = 9,
    
    /// <summary>Mutual agreement.</summary>
    MutualAgreement = 10,
    
    /// <summary>Other/unspecified reason.</summary>
    Other = 99
}
