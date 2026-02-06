using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;

namespace Pitbull.TimeTracking.Domain;

/// <summary>
/// Represents an employee's assignment to a project.
/// Controls which projects an employee can log time to.
/// </summary>
public class ProjectAssignment : BaseEntity
{
    /// <summary>
    /// The employee being assigned to the project
    /// </summary>
    public Guid EmployeeId { get; set; }

    /// <summary>
    /// The project the employee is assigned to
    /// </summary>
    public Guid ProjectId { get; set; }

    /// <summary>
    /// The employee's role on this project (Worker, Supervisor, Manager)
    /// </summary>
    public AssignmentRole Role { get; set; } = AssignmentRole.Worker;

    /// <summary>
    /// Date the assignment becomes effective
    /// </summary>
    public DateOnly StartDate { get; set; }

    /// <summary>
    /// Date the assignment ends (null = ongoing/indefinite)
    /// </summary>
    public DateOnly? EndDate { get; set; }

    /// <summary>
    /// Whether this assignment is currently active.
    /// Can be used to temporarily disable an assignment without deleting it.
    /// </summary>
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Optional notes about this assignment
    /// </summary>
    public string? Notes { get; set; }

    // Navigation properties
    public Employee Employee { get; set; } = null!;
    public Project Project { get; set; } = null!;

    /// <summary>
    /// Checks if this assignment is valid for a given date
    /// </summary>
    public bool IsValidForDate(DateOnly date)
    {
        if (!IsActive) return false;
        if (date < StartDate) return false;
        if (EndDate.HasValue && date > EndDate.Value) return false;
        return true;
    }
}
