using Pitbull.Core.Domain;

namespace Pitbull.TimeTracking.Domain;

/// <summary>
/// Represents an employee who can log time entries.
/// This contains the information needed for payroll and job costing calculations.
/// </summary>
public class Employee : BaseEntity
{
    /// <summary>
    /// Employee number or badge number (used for timeclock integration)
    /// </summary>
    public string EmployeeNumber { get; set; } = string.Empty;

    /// <summary>
    /// Employee's first name
    /// </summary>
    public string FirstName { get; set; } = string.Empty;

    /// <summary>
    /// Employee's last name
    /// </summary>
    public string LastName { get; set; } = string.Empty;

    /// <summary>
    /// Full display name
    /// </summary>
    public string FullName => $"{FirstName} {LastName}".Trim();

    /// <summary>
    /// Employee's email address (for login and notifications)
    /// </summary>
    public string? Email { get; set; }

    /// <summary>
    /// Employee's mobile phone (for mobile app notifications)
    /// </summary>
    public string? Phone { get; set; }

    /// <summary>
    /// Employee's job title/role
    /// </summary>
    public string? Title { get; set; }

    /// <summary>
    /// Employee's classification for pay rate calculations
    /// </summary>
    public EmployeeClassification Classification { get; set; }

    /// <summary>
    /// Base hourly pay rate for regular hours
    /// </summary>
    public decimal BaseHourlyRate { get; set; }

    /// <summary>
    /// Whether this employee is currently active (can log time)
    /// </summary>
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Date the employee was hired
    /// </summary>
    public DateOnly? HireDate { get; set; }

    /// <summary>
    /// Date the employee was terminated (if applicable)
    /// </summary>
    public DateOnly? TerminationDate { get; set; }

    /// <summary>
    /// Supervisor who can approve this employee's time entries
    /// </summary>
    public Guid? SupervisorId { get; set; }

    /// <summary>
    /// Additional notes about the employee
    /// </summary>
    public string? Notes { get; set; }

    // Navigation properties
    public Employee? Supervisor { get; set; }
    public ICollection<Employee> Subordinates { get; set; } = [];
    public ICollection<TimeEntry> TimeEntries { get; set; } = [];
    public ICollection<TimeEntry> ApprovedTimeEntries { get; set; } = [];
    public ICollection<ProjectAssignment> ProjectAssignments { get; set; } = [];
}

/// <summary>
/// Employee classification affects pay rates and approval workflows
/// </summary>
public enum EmployeeClassification
{
    /// <summary>
    /// Hourly worker (most common for field workers)
    /// </summary>
    Hourly = 0,

    /// <summary>
    /// Salaried employee (typically office staff, managers)
    /// </summary>
    Salaried = 1,

    /// <summary>
    /// Contractor/subcontractor (different rate calculation)
    /// </summary>
    Contractor = 2,

    /// <summary>
    /// Apprentice (may have different rate structure)
    /// </summary>
    Apprentice = 3,

    /// <summary>
    /// Supervisor/foreman (can approve other time entries)
    /// </summary>
    Supervisor = 4
}