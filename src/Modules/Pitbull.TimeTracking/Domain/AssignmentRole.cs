namespace Pitbull.TimeTracking.Domain;

/// <summary>
/// Role an employee plays on a specific project assignment
/// </summary>
public enum AssignmentRole
{
    /// <summary>
    /// Standard worker performing labor on the project
    /// </summary>
    Worker = 0,

    /// <summary>
    /// Field supervisor overseeing work on the project
    /// </summary>
    Supervisor = 1,

    /// <summary>
    /// Project manager with full oversight and approval authority
    /// </summary>
    Manager = 2
}
