using Microsoft.AspNetCore.Identity;

namespace Pitbull.Core.Domain;

/// <summary>
/// Application user extending ASP.NET Identity.
/// Supports both internal (employee) and external (subcontractor) users.
/// </summary>
public class AppUser : IdentityUser<Guid>
{
    public Guid TenantId { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string FullName => $"{FirstName} {LastName}".Trim();
    public UserType Type { get; set; } = UserType.Internal;
    public UserStatus Status { get; set; } = UserStatus.Active;
    public string? Title { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; set; }
    public string? RefreshToken { get; set; }
    public DateTime? RefreshTokenExpiryTime { get; set; }

    /// <summary>
    /// Optional link to the Employee record for this user.
    /// When set, time tracking and approval workflows use this directly
    /// instead of falling back to email-based lookup.
    /// </summary>
    public Guid? EmployeeId { get; set; }

    /// <summary>
    /// Optional default company for this user.
    /// Used as the initial company context when the user logs in.
    /// </summary>
    public Guid? CompanyId { get; set; }

    /// <summary>
    /// True for self-service demo signups. Demo users have restricted access:
    /// no admin workspace, can't see other users, data resets with seed version bumps.
    /// </summary>
    public bool IsDemoUser { get; set; }

    // Navigation
    public Tenant Tenant { get; set; } = null!;
}

public class AppRole : IdentityRole<Guid>
{
    public Guid TenantId { get; set; }
    public string? Description { get; set; }
    public bool IsSystemRole { get; set; } = false;
}

public enum UserType
{
    Internal,   // Employees
    External    // Subcontractors, vendors
}

public enum UserStatus
{
    Active,
    Inactive,
    Locked,
    Invited     // Sent invite, hasn't logged in yet
}
