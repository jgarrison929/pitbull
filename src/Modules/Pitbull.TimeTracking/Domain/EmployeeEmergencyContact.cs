using Pitbull.Core.Domain;

namespace Pitbull.TimeTracking.Domain;

/// <summary>
/// Emergency contact for an employee. At least one is typically
/// required during onboarding for construction site safety compliance.
/// </summary>
public class EmployeeEmergencyContact : BaseEntity
{
    public Guid EmployeeId { get; set; }

    public string Name { get; set; } = string.Empty;
    public string Relationship { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Address { get; set; }
    public bool IsPrimary { get; set; }

    // Navigation
    public Employee? Employee { get; set; }
}
