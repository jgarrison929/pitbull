using Pitbull.Core.Domain;

namespace Pitbull.HR.Domain;

/// <summary>
/// Employee union membership and dispatch tracking.
/// Essential for construction - union workers dispatched from hall.
/// </summary>
public class UnionMembership : BaseEntity
{
    public Guid EmployeeId { get; set; }
    
    /// <summary>
    /// Union local identifier (e.g., "IBEW Local 11", "UA Local 78").
    /// </summary>
    public string UnionLocal { get; set; } = string.Empty;
    
    /// <summary>
    /// Union membership number.
    /// </summary>
    public string MembershipNumber { get; set; } = string.Empty;
    
    /// <summary>
    /// Trade classification (Journeyman, Apprentice, Foreman, etc.)
    /// </summary>
    public string Classification { get; set; } = string.Empty;
    
    /// <summary>
    /// Apprentice level if applicable (1-4 typically).
    /// </summary>
    public int? ApprenticeLevel { get; set; }
    
    /// <summary>
    /// Date joined union.
    /// </summary>
    public DateOnly? JoinDate { get; set; }
    
    /// <summary>
    /// Current dues-paid status.
    /// </summary>
    public bool DuesPaid { get; set; }
    
    /// <summary>
    /// Dues paid through date.
    /// </summary>
    public DateOnly? DuesPaidThrough { get; set; }
    
    /// <summary>
    /// Reference number for current dispatch from hall.
    /// </summary>
    public string? DispatchNumber { get; set; }
    
    /// <summary>
    /// Date of current dispatch.
    /// </summary>
    public DateOnly? DispatchDate { get; set; }
    
    /// <summary>
    /// Dispatch list position (for out-of-work tracking).
    /// </summary>
    public int? DispatchListPosition { get; set; }
    
    /// <summary>
    /// Fringe benefit rate (hourly).
    /// </summary>
    public decimal? FringeRate { get; set; }
    
    /// <summary>
    /// Health & welfare contribution rate.
    /// </summary>
    public decimal? HealthWelfareRate { get; set; }
    
    /// <summary>
    /// Pension contribution rate.
    /// </summary>
    public decimal? PensionRate { get; set; }
    
    /// <summary>
    /// Training fund rate.
    /// </summary>
    public decimal? TrainingRate { get; set; }
    
    public DateOnly EffectiveDate { get; set; }
    public DateOnly? ExpirationDate { get; set; }
    public string? Notes { get; set; }
    
    public Employee Employee { get; set; } = null!;
    
    public bool IsActive => !ExpirationDate.HasValue || ExpirationDate.Value >= DateOnly.FromDateTime(DateTime.UtcNow);
}
