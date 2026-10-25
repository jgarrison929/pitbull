using Pitbull.Core.Domain;

namespace Pitbull.TimeTracking.Domain;

/// <summary>
/// Union membership and prevailing wage classification for an employee.
/// Supports multiple active affiliations with effective date ranges
/// for Davis-Bacon compliance and certified payroll reporting.
/// </summary>
public class EmployeeUnionAffiliation : BaseEntity
{
    public Guid EmployeeId { get; set; }

    // Union
    public string? UnionName { get; set; }
    public string? LocalNumber { get; set; }
    public string? MemberId { get; set; }
    public string? Craft { get; set; }
    public string? ApprenticeLevel { get; set; }

    // Prevailing Wage
    public string? ClassificationCode { get; set; }
    public string? ClassificationName { get; set; }
    public string? Jurisdiction { get; set; }

    public DateOnly? EffectiveDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public string? Notes { get; set; }

    // Navigation
    public Employee? Employee { get; set; }
}
